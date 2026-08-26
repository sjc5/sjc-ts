import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { PLUGIN_NAME } from "../plugin.ts";
import { RULE_NAME, rule } from "./convertible-naming-convention.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "ts" } },
});

tester.run(`${PLUGIN_NAME}/${RULE_NAME}`, rule, {
	valid: [
		{
			name: "unambiguous value names",
			code: `const cssVars = 1, CssVars = 2, CSS_VARS = 3, css_vars = 4;`,
		},
		{
			name: "strict PascalCase types",
			code: `class CssVars<TValue> {}
interface HttpResponse {}
type XmlNode = string;
enum CssUnit { PixelValue, PX_VALUE }`,
		},
		{
			name: "owned bindings and members",
			code: `const { external_name: localName } = source;
function parseCss(_rawValue: string) {}
class Parser {
	cssVars = 1;
	#cachedValue = 2;
	parseXml() {}
}`,
		},
		{
			name: "external names are ignored",
			code: `import { CSSValue } from "external";
const value = source.CSSValue;
const payload = { CSSValue: value, "CSS-VALUE": value };
class Derived extends Base { override CSSValue() {} }`,
		},
	],
	invalid: [
		{
			name: "ambiguous value acronym",
			code: `const CSSVars = 1;`,
			errors: 1,
		},
		{
			name: "ambiguous names across owned bindings",
			code: `function parseCSS({ HTTPCode: localHTTPCode }: { HTTPCode: string }) {
	try {} catch (XMLError) {}
}`,
			errors: 4,
		},
		{
			name: "type names must be strict PascalCase",
			code: `class CSSVars<TURL> {}
interface httpResponse {}
type XMLNode = string;
enum cssUnit {}`,
			errors: 5,
		},
		{
			name: "owned member names",
			code: `class Parser {
	CSSVars = 1;
	parseXML() {}
}
interface Result { HTTPCode: number; parseXML(): void }`,
			errors: 4,
		},
		{
			name: "mixed and malformed snake casing",
			code: `const css_Vars = 1, CSS__VARS = 2, _CSSVars = 3;`,
			errors: 3,
		},
	],
});
