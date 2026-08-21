import { defineRule, type ESTree, type SourceCode } from "@oxlint/plugins";

export const RULE_NAME = "no-complex-implicit-return";

const MESSAGE_ID = "use_braces";

function returnedObjectLiteral(
	node: ESTree.Expression,
): ESTree.ObjectExpression | undefined {
	let current = node;
	while (
		current.type === "ParenthesizedExpression" ||
		current.type === "TSAsExpression" ||
		current.type === "TSSatisfiesExpression" ||
		current.type === "TSTypeAssertion" ||
		current.type === "TSNonNullExpression"
	) {
		current = current.expression;
	}
	return current.type === "ObjectExpression" ? current : undefined;
}

function wrappingParenRange(
	source: SourceCode,
	node: ESTree.Node,
): [number, number] {
	let start = node.range[0];
	let end = node.range[1];
	let left = source.getTokenBefore(node);
	let right = source.getTokenAfter(node);
	while (left?.value === "(" && right?.value === ")") {
		start = left.range[0];
		end = right.range[1];
		left = source.getTokenBefore(left);
		right = source.getTokenAfter(right);
	}
	return [start, end];
}

// Wrapping parens are only ever there because `{` cannot open an arrow
// body, so an explicit return makes them droppable — but nothing except
// whitespace and comments can sit behind them, and a comment must not be
// dropped along with them.
function hidesComment(
	source: SourceCode,
	range: [number, number],
	node: ESTree.Node,
): boolean {
	return /[^\s()]/.test(
		source.text.slice(range[0], node.range[0]) +
			source.text.slice(node.range[1], range[1]),
	);
}

export const rule = defineRule({
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow implicit returns from arrow functions when the returned value is an object literal or an expression spanning multiple lines; single-line expressions may keep the implicit form.",
		},
		fixable: "code",
		schema: [],
		messages: {
			[MESSAGE_ID]:
				"Arrow functions that return an object literal or an expression spanning multiple lines should use braces and an explicit return.",
		},
	},
	create(context) {
		const source = context.sourceCode;
		return {
			ArrowFunctionExpression(node) {
				const body = node.body;
				if (body.type === "BlockStatement") {
					return;
				}
				const isMultiLine = body.loc.start.line !== body.loc.end.line;
				const obj = returnedObjectLiteral(body);
				if (!isMultiLine && !obj) {
					return;
				}
				context.report({
					node: body,
					messageId: MESSAGE_ID,
					fix(fixer) {
						const outer = wrappingParenRange(source, body);
						const keep = hidesComment(source, outer, body);
						const start = keep ? outer[0] : body.range[0];
						const end = keep ? outer[1] : body.range[1];
						// The object literal carries its own parens when a
						// TS operator wraps it, as in `({ a: 1 }) as const`.
						const inner = obj
							? wrappingParenRange(source, obj)
							: undefined;
						const text =
							obj && inner && !hidesComment(source, inner, obj)
								? source.text.slice(start, inner[0]) +
									source.getText(obj) +
									source.text.slice(inner[1], end)
								: source.text.slice(start, end);
						return fixer.replaceTextRange(
							outer,
							`{ return ${text}; }`,
						);
					},
				});
			},
		};
	},
});
