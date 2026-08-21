import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { PLUGIN_NAME } from "../plugin.ts";
import { RULE_NAME, rule } from "./no-complex-implicit-return.ts";

RuleTester.describe = describe;
RuleTester.it = it;

// Parsed as TypeScript unless a test case names a file of its own.
const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "ts" } },
});

tester.run(`${PLUGIN_NAME}/${RULE_NAME}`, rule, {
	valid: [
		{
			name: "single-line expression",
			code: `const f = () => 1;`,
		},
		{
			name: "single-line call",
			code: `const f = () => make(a, b);`,
		},
		{
			name: "single-line expression wrapped in multi-line parens",
			code: `const f = () => (
	value
);`,
		},
		{
			name: "object literal nested inside a single-line expression",
			code: `const f = () => (a ? { a: 1 } : null);`,
		},
		{
			name: "arrow that already has a block body",
			code: `const f = () => {
	return { a: 1 };
};`,
		},
	],
	invalid: [
		{
			name: "object literal",
			code: `const f = () => ({ a: 1 });`,
			output: `const f = () => { return { a: 1 }; };`,
			errors: 1,
		},
		{
			name: "multi-line object literal",
			code: `const f = () => ({
	a: 1,
});`,
			output: `const f = () => { return {
	a: 1,
}; };`,
			errors: 1,
		},
		{
			name: "multi-line expression that is not an object literal",
			code: `const f = () => make(
	a,
	b,
);`,
			output: `const f = () => { return make(
	a,
	b,
); };`,
			errors: 1,
		},
		{
			name: "async arrow",
			code: `const f = async () => ({ a: 1 });`,
			output: `const f = async () => { return { a: 1 }; };`,
			errors: 1,
		},
		{
			name: "object literal as an argument",
			code: `use(() => ({ a: 1 }), b);`,
			output: `use(() => { return { a: 1 }; }, b);`,
			errors: 1,
		},
		{
			name: "redundant parens are all dropped",
			code: `const f = () => ((({ a: 1 })));`,
			output: `const f = () => { return { a: 1 }; };`,
			errors: 1,
		},
		{
			name: "object literal asserted with `as`",
			code: `const f = () => ({ a: 1 } as const);`,
			output: `const f = () => { return { a: 1 } as const; };`,
			errors: 1,
		},
		{
			name: "parens around the object literal go too",
			code: `const f = () => ({ a: 1 }) as const;`,
			output: `const f = () => { return { a: 1 } as const; };`,
			errors: 1,
		},
		{
			name: "object literal with `satisfies`",
			code: `const f = () => ({ a: 1 } satisfies Rec);`,
			output: `const f = () => { return { a: 1 } satisfies Rec; };`,
			errors: 1,
		},
		{
			name: "object literal with a non-null assertion",
			code: `const f = () => ({ a: 1 })!;`,
			output: `const f = () => { return { a: 1 }!; };`,
			errors: 1,
		},
		{
			// `{ a: 1 } as const!` does not parse, so the outer pair stays.
			name: "parens the expression actually needs are kept",
			code: `const f = () => (({ a: 1 }) as const)!;`,
			output: `const f = () => { return ({ a: 1 } as const)!; };`,
			errors: 1,
		},
		{
			name: "multi-line JSX",
			filename: "case.tsx",
			code: `const f = () => (
	<div>
		hi
	</div>
);`,
			output: `const f = () => { return <div>
		hi
	</div>; };`,
			errors: 1,
		},
		{
			name: "multi-line template literal",
			code: `const f = () => \`a
b\`;`,
			output: `const f = () => { return \`a
b\`; };`,
			errors: 1,
		},
		{
			name: "parens are kept when a comment hides behind them",
			code: `const f = () => (
	// why
	{
		a: 1,
	}
);`,
			output: `const f = () => { return (
	// why
	{
		a: 1,
	}
); };`,
			errors: 1,
		},
		{
			name: "parens around the object literal are kept for a comment",
			code: `const f = () => (/* why */ { a: 1 }) as const;`,
			output: `const f = () => { return (/* why */ { a: 1 }) as const; };`,
			errors: 1,
		},
		{
			name: "a comment before the body stays outside the braces",
			code: `const f = () =>
	// why
	make(
		a,
	);`,
			output: `const f = () =>
	// why
	{ return make(
		a,
	); };`,
			errors: 1,
		},
		{
			// Overlapping fixes are applied one per pass, outermost first.
			name: "arrow nested inside an arrow",
			code: `const f = () => ({
	g: () => ({ a: 1 }),
});`,
			output: `const f = () => { return {
	g: () => ({ a: 1 }),
}; };`,
			errors: 2,
		},
	],
});
