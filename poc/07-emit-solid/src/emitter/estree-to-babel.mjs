import * as t from '@babel/types';

export function fromEstree(node) {
  if (node == null) return null;
  switch (node.type) {
    case 'Identifier': return t.identifier(node.name);
    case 'Literal':
      if (node.value === null) return t.nullLiteral();
      if (typeof node.value === 'string') return t.stringLiteral(node.value);
      if (typeof node.value === 'number') return t.numericLiteral(node.value);
      if (typeof node.value === 'boolean') return t.booleanLiteral(node.value);
      throw new Error(`Unsupported Literal value: ${String(node.value)}`);
    case 'ArrayExpression': return t.arrayExpression(node.elements.map(fromEstree));
    case 'ObjectExpression': return t.objectExpression(node.properties.map(fromEstree));
    case 'Property': return t.objectProperty(fromEstree(node.key), fromEstree(node.value), node.computed, node.shorthand);
    case 'SpreadElement': return t.spreadElement(fromEstree(node.argument));
    case 'MemberExpression': return t.memberExpression(fromEstree(node.object), fromEstree(node.property), node.computed, node.optional ?? false);
    case 'CallExpression': return t.callExpression(fromEstree(node.callee), node.arguments.map(fromEstree), node.optional ?? false);
    case 'ArrowFunctionExpression': return t.arrowFunctionExpression(node.params.map(fromEstree), fromEstree(node.body), node.async ?? false);
    case 'BlockStatement': return t.blockStatement(node.body.map(fromEstree));
    case 'ExpressionStatement': return t.expressionStatement(fromEstree(node.expression));
    case 'VariableDeclaration': return t.variableDeclaration(node.kind, node.declarations.map(fromEstree));
    case 'VariableDeclarator': return t.variableDeclarator(fromEstree(node.id), fromEstree(node.init));
    case 'AssignmentExpression': return t.assignmentExpression(node.operator, fromEstree(node.left), fromEstree(node.right));
    case 'UpdateExpression': return t.updateExpression(node.operator, fromEstree(node.argument), node.prefix);
    case 'BinaryExpression': return t.binaryExpression(node.operator, fromEstree(node.left), fromEstree(node.right));
    case 'UnaryExpression': return t.unaryExpression(node.operator, fromEstree(node.argument), node.prefix);
    case 'IfStatement': return t.ifStatement(fromEstree(node.test), fromEstree(node.consequent), fromEstree(node.alternate));
    case 'TemplateLiteral': return t.templateLiteral(node.quasis.map(fromEstree), node.expressions.map(fromEstree));
    case 'TemplateElement': return t.templateElement({ raw: node.value.raw, cooked: node.value.cooked }, node.tail);
    default: throw new Error(`Unsupported frameless-enriched-ir/1 AST node: ${node.type}`);
  }
}
