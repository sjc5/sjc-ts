import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { PLUGIN_NAME } from "../plugin.ts";
import { RULE_NAME, rule } from "./no-common-boolean-function-prefixes.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "ts" } },
});

tester.run(`${PLUGIN_NAME}/${RULE_NAME}`, rule, {
	valid: [
		{
			name: "exact prefixes and ordinary words",
			code: `function is() {}
const are = () => true;
function has() {}
const should = () => true;
function island() {}
const area = () => true;
function hash() {}
const shoulder = () => true;`,
		},
		{
			name: "boolean values and accessors",
			code: `const isReady = true;
class Status { get isReady() { return true; } }
const status = { get areReady() { return true; } };`,
		},
	],
	invalid: [
		{
			name: "function declarations and variables",
			code: `function isReady() {}
const areTargetsConnected = () => true;
function hasSelection() {}
const shouldResize = () => true;`,
			errors: 4,
		},
		{
			name: "methods and function-valued properties",
			code: `class Status {
	isReady() {}
	areReady = () => true;
}
const status = {
	isActive() {},
	areConnected: function () {},
};
interface StatusLike { isAvailable(): boolean }`,
			errors: 5,
		},
		{
			name: "explicit TypeScript function types",
			code: `interface StatusLike {
	isReady: () => boolean;
	hasValue?: (() => boolean) | undefined;
}
declare const areReady: () => boolean;
class Status { shouldRun: () => boolean; }
function consume(isEnabled: () => boolean) { isEnabled(); }`,
			errors: 5,
		},
	],
});
