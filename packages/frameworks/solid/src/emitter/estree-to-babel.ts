import * as t from '@babel/types';
import type { SerializableAstNode } from '@frameless/compiler';

type EstreeNode = SerializableAstNode & Record<string, any>;

/** Convert the cycle-free ESTree subset in frameless-enriched-ir/1 into Babel AST. */
export function fromEstree(input: SerializableAstNode | null | undefined): t.Node | null {
	if (input == null) return null;
	const node = input as EstreeNode;
	switch (node.type) {
		case 'Identifier':
			return t.identifier(node.name);
		case 'Literal':
			if (node.value === null) return t.nullLiteral();
			if (typeof node.value === 'string') return t.stringLiteral(node.value);
			if (typeof node.value === 'number') return t.numericLiteral(node.value);
			if (typeof node.value === 'boolean') return t.booleanLiteral(node.value);
			throw new Error(`Unsupported Literal value: ${String(node.value)}`);
		case 'ArrayExpression':
			return t.arrayExpression(
				node.elements.map(fromEstree) as Array<t.Expression | t.SpreadElement | null>,
			);
		case 'ObjectExpression':
			return t.objectExpression(
				node.properties.map(fromEstree) as Array<
					t.ObjectMethod | t.ObjectProperty | t.SpreadElement
				>,
			);
		case 'Property':
			return t.objectProperty(
				fromEstree(node.key) as t.Expression,
				fromEstree(node.value) as t.Expression | t.PatternLike,
				Boolean(node.computed),
				Boolean(node.shorthand),
			);
		case 'SpreadElement':
			return t.spreadElement(fromEstree(node.argument) as t.Expression);
		case 'MemberExpression':
			return t.memberExpression(
				fromEstree(node.object) as t.Expression,
				fromEstree(node.property) as t.Expression | t.Identifier,
				Boolean(node.computed),
				Boolean(node.optional),
			);
		case 'ChainExpression':
			return fromEstree(node.expression);
		case 'CallExpression':
			return t.callExpression(
				fromEstree(node.callee) as t.Expression | t.V8IntrinsicIdentifier,
				node.arguments.map(fromEstree) as Array<
					t.Expression | t.SpreadElement | t.ArgumentPlaceholder
				>,
			);
		case 'ArrowFunctionExpression':
			return t.arrowFunctionExpression(
				node.params.map(fromEstree) as Array<t.Identifier | t.Pattern | t.RestElement>,
				fromEstree(node.body) as t.BlockStatement | t.Expression,
				Boolean(node.async),
			);
		case 'FunctionExpression':
			return t.functionExpression(
				node.id ? (fromEstree(node.id) as t.Identifier) : null,
				node.params.map(fromEstree) as Array<t.Identifier | t.Pattern | t.RestElement>,
				fromEstree(node.body) as t.BlockStatement,
				Boolean(node.generator),
				Boolean(node.async),
			);
		case 'BlockStatement':
			return t.blockStatement(node.body.map(fromEstree) as t.Statement[]);
		case 'ReturnStatement':
			return t.returnStatement(fromEstree(node.argument) as t.Expression | null);
		case 'ExpressionStatement':
			return t.expressionStatement(fromEstree(node.expression) as t.Expression);
		case 'VariableDeclaration':
			return t.variableDeclaration(
				node.kind,
				node.declarations.map(fromEstree) as t.VariableDeclarator[],
			);
		case 'VariableDeclarator':
			return t.variableDeclarator(
				fromEstree(node.id) as t.LVal,
				fromEstree(node.init) as t.Expression | null,
			);
		case 'AssignmentExpression':
			return t.assignmentExpression(
				node.operator,
				fromEstree(node.left) as t.LVal,
				fromEstree(node.right) as t.Expression,
			);
		case 'UpdateExpression':
			return t.updateExpression(
				node.operator,
				fromEstree(node.argument) as t.Expression,
				Boolean(node.prefix),
			);
		case 'BinaryExpression':
			return t.binaryExpression(
				node.operator,
				fromEstree(node.left) as t.Expression,
				fromEstree(node.right) as t.Expression,
			);
		case 'LogicalExpression':
			return t.logicalExpression(
				node.operator,
				fromEstree(node.left) as t.Expression,
				fromEstree(node.right) as t.Expression,
			);
		case 'UnaryExpression':
			return t.unaryExpression(
				node.operator,
				fromEstree(node.argument) as t.Expression,
				Boolean(node.prefix),
			);
		case 'ConditionalExpression':
			return t.conditionalExpression(
				fromEstree(node.test) as t.Expression,
				fromEstree(node.consequent) as t.Expression,
				fromEstree(node.alternate) as t.Expression,
			);
		case 'IfStatement':
			return t.ifStatement(
				fromEstree(node.test) as t.Expression,
				fromEstree(node.consequent) as t.Statement,
				fromEstree(node.alternate) as t.Statement | null,
			);
		case 'TemplateLiteral':
			return t.templateLiteral(
				node.quasis.map(fromEstree) as t.TemplateElement[],
				node.expressions.map(fromEstree) as t.Expression[],
			);
		case 'TemplateElement':
			return t.templateElement(
				{ raw: node.value.raw, cooked: node.value.cooked },
				Boolean(node.tail),
			);
		default:
			throw new Error(`Unsupported frameless-enriched-ir/1 AST node: ${node.type}`);
	}
}
