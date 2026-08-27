import { defineRule, type ESTree } from "@oxlint/plugins";

export const RULE_NAME = "convertible-naming-convention";

const VALUE_MESSAGE_ID = "value_name";
const TYPE_MESSAGE_ID = "type_name";

type NamedIdentifier =
	| ESTree.IdentifierName
	| ESTree.IdentifierReference
	| ESTree.BindingIdentifier
	| ESTree.PrivateIdentifier;

function withoutLeadingUnderscores(name: string): string {
	return name.replace(/^_+/, "");
}

function isConvertibleValueName(name: string): boolean {
	const bare = withoutLeadingUnderscores(name);
	return (
		(/^[a-z][a-zA-Z0-9]*$/.test(bare) && !/[A-Z]{2}/.test(bare)) ||
		(/^[A-Z][a-zA-Z0-9]*$/.test(bare) && !/[A-Z]{2}/.test(bare)) ||
		/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(bare) ||
		/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(bare)
	);
}

function isStrictPascalCase(name: string): boolean {
	return /^[A-Z][a-zA-Z0-9]*$/.test(name) && !/[A-Z]{2}/.test(name);
}

function isTypeParameterName(name: string): boolean {
	return (
		isStrictPascalCase(name) ||
		(name.startsWith("T") && isStrictPascalCase(name.slice(1)))
	);
}

function propertyName(
	key: ESTree.PropertyKey,
	computed: boolean,
): ESTree.IdentifierName | ESTree.PrivateIdentifier | undefined {
	if (
		computed ||
		(key.type !== "Identifier" && key.type !== "PrivateIdentifier")
	) {
		return undefined;
	}
	return key;
}

export const rule = defineRule({
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Require owned identifiers to use casing with unambiguous word boundaries.",
		},
		schema: [],
		messages: {
			[VALUE_MESSAGE_ID]:
				"Owned name `{{name}}` must use unambiguous camel, Pascal, or snake casing.",
			[TYPE_MESSAGE_ID]:
				"Type-like name `{{name}}` must use strict PascalCase without consecutive capitals.",
		},
	},
	create(context) {
		function checkValue(node: NamedIdentifier) {
			if (node.name !== "this" && !isConvertibleValueName(node.name)) {
				context.report({
					node,
					messageId: VALUE_MESSAGE_ID,
					data: { name: node.name },
				});
			}
		}

		function checkType(node: ESTree.BindingIdentifier) {
			if (!isStrictPascalCase(node.name)) {
				context.report({
					node,
					messageId: TYPE_MESSAGE_ID,
					data: { name: node.name },
				});
			}
		}

		function checkTypeParameter(node: ESTree.BindingIdentifier) {
			if (!isTypeParameterName(node.name)) {
				context.report({
					node,
					messageId: TYPE_MESSAGE_ID,
					data: { name: node.name },
				});
			}
		}

		function checkBinding(node: ESTree.Node) {
			switch (node.type) {
				case "Identifier":
					checkValue(node);
					break;
				case "AssignmentPattern":
					checkBinding(node.left);
					break;
				case "ArrayPattern":
					for (const element of node.elements) {
						if (element) {
							checkBinding(element);
						}
					}
					break;
				case "ObjectPattern":
					for (const property of node.properties) {
						checkBinding(
							property.type === "RestElement"
								? property.argument
								: property.value,
						);
					}
					break;
				case "RestElement":
					checkBinding(node.argument);
					break;
				case "TSParameterProperty":
					checkBinding(node.parameter);
					break;
			}
		}

		function checkParameters(nodes: Array<ESTree.ParamPattern>) {
			for (const node of nodes) {
				checkBinding(node);
			}
		}

		function checkMember(
			node:
				| ESTree.MethodDefinition
				| ESTree.PropertyDefinition
				| ESTree.AccessorProperty,
		) {
			if (node.override) {
				return;
			}
			const name = propertyName(node.key, node.computed);
			if (name && name.name !== "constructor") {
				checkValue(name);
			}
		}

		return {
			VariableDeclarator(node) {
				checkBinding(node.id);
			},
			FunctionDeclaration(node) {
				if (node.id) {
					checkValue(node.id);
				}
				checkParameters(node.params);
			},
			FunctionExpression(node) {
				if (node.id) {
					checkValue(node.id);
				}
				checkParameters(node.params);
			},
			ArrowFunctionExpression(node) {
				checkParameters(node.params);
			},
			TSDeclareFunction(node) {
				if (node.id) {
					checkValue(node.id);
				}
				checkParameters(node.params);
			},
			TSEmptyBodyFunctionExpression(node) {
				if (node.id) {
					checkValue(node.id);
				}
				checkParameters(node.params);
			},
			CatchClause(node) {
				if (node.param) {
					checkBinding(node.param);
				}
			},
			ClassDeclaration(node) {
				if (node.id) {
					checkType(node.id);
				}
			},
			ClassExpression(node) {
				if (node.id) {
					checkType(node.id);
				}
			},
			MethodDefinition: checkMember,
			TSAbstractMethodDefinition: checkMember,
			PropertyDefinition: checkMember,
			TSAbstractPropertyDefinition: checkMember,
			AccessorProperty: checkMember,
			TSAbstractAccessorProperty: checkMember,
			TSTypeAliasDeclaration(node) {
				checkType(node.id);
			},
			TSInterfaceDeclaration(node) {
				checkType(node.id);
			},
			TSEnumDeclaration(node) {
				checkType(node.id);
			},
			TSEnumMember(node) {
				if (node.id.type === "Identifier") {
					checkValue(node.id);
				}
			},
			TSTypeParameter(node) {
				checkTypeParameter(node.name);
			},
			TSPropertySignature(node) {
				const name = propertyName(node.key, node.computed);
				if (name) {
					checkValue(name);
				}
			},
			TSMethodSignature(node) {
				const name = propertyName(node.key, node.computed);
				if (name) {
					checkValue(name);
				}
				checkParameters(node.params);
			},
			TSCallSignatureDeclaration(node) {
				checkParameters(node.params);
			},
			TSConstructSignatureDeclaration(node) {
				checkParameters(node.params);
			},
			TSIndexSignature(node) {
				checkParameters(node.parameters);
			},
			ImportDefaultSpecifier(node) {
				checkValue(node.local);
			},
			ImportNamespaceSpecifier(node) {
				checkValue(node.local);
			},
			ImportSpecifier(node) {
				if (
					node.imported.type !== "Identifier" ||
					node.local.name !== node.imported.name
				) {
					checkValue(node.local);
				}
			},
		};
	},
});
