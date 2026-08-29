import { defineRule, type ESTree } from "@oxlint/plugins";

export const RULE_NAME = "no-common-boolean-function-prefixes";

const MESSAGE_ID = "reserved_boolean_prefix";
const BOOLEAN_VALUE_PREFIX = /^(?:is|are|has|should)[^a-z]/;

type NamedIdentifier =
	| ESTree.IdentifierName
	| ESTree.IdentifierReference
	| ESTree.BindingIdentifier
	| ESTree.LabelIdentifier
	| ESTree.TSIndexSignatureName
	| ESTree.TSThisParameter
	| ESTree.PrivateIdentifier;

function testForFunctionValue(node: ESTree.Expression | null): boolean {
	return (
		node?.type === "ArrowFunctionExpression" ||
		node?.type === "FunctionExpression" ||
		node?.type === "TSEmptyBodyFunctionExpression"
	);
}

export const rule = defineRule({
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Reserve `is`, `are`, `has`, and `should` prefixes followed by a non-lowercase ASCII character for boolean values rather than functions.",
		},
		schema: [],
		messages: {
			[MESSAGE_ID]:
				"Function `{{name}}` uses a prefix reserved for boolean values. Functions are themselves truthy, so omitting `()` would silently behave as true.",
		},
	},
	create(context) {
		function checkName(node: NamedIdentifier) {
			if (BOOLEAN_VALUE_PREFIX.test(node.name)) {
				context.report({
					node,
					messageId: MESSAGE_ID,
					data: { name: node.name },
				});
			}
		}

		function checkPropertyName(key: ESTree.PropertyKey, computed: boolean) {
			if (
				!computed &&
				(key.type === "Identifier" || key.type === "PrivateIdentifier")
			) {
				checkName(key);
			}
		}

		function checkFunction(node: ESTree.Function) {
			if (node.id) {
				checkName(node.id);
			}
		}

		function checkMethod(node: ESTree.MethodDefinition) {
			if (node.kind === "method") {
				checkPropertyName(node.key, node.computed);
			}
		}

		function checkProperty(node: ESTree.PropertyDefinition) {
			if (
				testForFunctionValue(node.value) ||
				containsFunctionType(node.typeAnnotation?.typeAnnotation)
			) {
				checkPropertyName(node.key, node.computed);
			}
		}

		function containsFunctionType(
			type: ESTree.TSType | undefined,
		): boolean {
			if (!type) {
				return false;
			}

			switch (type.type) {
				case "TSFunctionType":
					return true;
				case "TSParenthesizedType":
					return containsFunctionType(type.typeAnnotation);
				case "TSIntersectionType":
				case "TSUnionType":
					return type.types.some(containsFunctionType);
				default:
					return false;
			}
		}

		function checkIdentifierType(node: NamedIdentifier) {
			if (
				"typeAnnotation" in node &&
				containsFunctionType(node.typeAnnotation?.typeAnnotation)
			) {
				checkName(node);
			}
		}

		function checkObjectProperty(node: ESTree.ObjectProperty) {
			if (
				node.kind === "init" &&
				(node.method || testForFunctionValue(node.value))
			) {
				checkPropertyName(node.key, node.computed);
			}
		}

		return {
			FunctionDeclaration: checkFunction,
			FunctionExpression: checkFunction,
			TSDeclareFunction: checkFunction,
			TSEmptyBodyFunctionExpression: checkFunction,
			Identifier: checkIdentifierType,
			VariableDeclarator(node) {
				if (
					node.id.type === "Identifier" &&
					testForFunctionValue(node.init) &&
					!containsFunctionType(
						node.id.typeAnnotation?.typeAnnotation,
					)
				) {
					checkName(node.id);
				}
			},
			ObjectExpression(node) {
				for (const property of node.properties) {
					if (property.type === "Property") {
						checkObjectProperty(property);
					}
				}
			},
			MethodDefinition: checkMethod,
			TSAbstractMethodDefinition: checkMethod,
			PropertyDefinition: checkProperty,
			TSAbstractPropertyDefinition: checkProperty,
			TSMethodSignature(node) {
				if (node.kind === "method") {
					checkPropertyName(node.key, node.computed);
				}
			},
			TSPropertySignature(node) {
				if (containsFunctionType(node.typeAnnotation?.typeAnnotation)) {
					checkPropertyName(node.key, node.computed);
				}
			},
		};
	},
});
