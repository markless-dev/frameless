export type Node = any;
export type Statement = any;
export type Expression = any;
export type Identifier = any;
export type ArrowFunctionExpression = any;
export type AssignmentPattern = any;
export type ExportNamedDeclaration = any;
export type ExpressionStatement = any;
export type FunctionDeclaration = any;
export type IfStatement = any;
export type JSXAttribute = any;
export type JSXElement = any;
export type JSXExpressionContainer = any;
export type JSXFragment = any;
export type JSXSpreadAttribute = any;
export type JSXSpreadChild = any;
export type JSXText = any;
export type MemberExpression = any;
export type ReturnStatement = any;
export type VariableDeclaration = any;
export type VariableDeclarator = any;

type Properties = Record<string, unknown>;
const node = (type: string, properties: Properties = {}): any => ({ type, ...properties });
const matches = (value: unknown, type: string, properties?: Properties): boolean =>
	Boolean(
		value &&
		typeof value === 'object' &&
		(value as any).type === type &&
		(!properties ||
			Object.entries(properties).every(
				([key, expected]) => (value as any)[key] === expected,
			)),
	);

export const identifier = (name: string): any => node('Identifier', { name });
export const stringLiteral = (value: string): any =>
	node('Literal', { value, raw: JSON.stringify(value) });
// Yuku prints Literal.raw verbatim in quoted JSX attributes. Values that HTML/JSX
// would reinterpret or that cannot stay on one quoted line use a JS expression.
export const jsxStringValue = (value: string): any =>
	/[&"\r\n]/.test(value) ? jsxExpressionContainer(stringLiteral(value)) : stringLiteral(value);
export const numericLiteral = (value: number): any =>
	node('Literal', { value, raw: String(value) });
export const booleanLiteral = (value: boolean): any =>
	node('Literal', { value, raw: String(value) });
export const nullLiteral = (): any => node('Literal', { value: null, raw: 'null' });
export const arrayPattern = (elements: any[]): any => node('ArrayPattern', { elements });
export const objectPattern = (properties: any[]): any => node('ObjectPattern', { properties });
export const assignmentPattern = (left: any, right: any): any =>
	node('AssignmentPattern', { left, right });
export const objectProperty = (key: any, value: any, computed = false, shorthand = false): any =>
	node('Property', { key, value, kind: 'init', method: false, computed, shorthand });
export const objectExpression = (properties: any[]): any =>
	node('ObjectExpression', { properties });
export const spreadElement = (argument: any): any => node('SpreadElement', { argument });
export const memberExpression = (object: any, property: any, computed = false): any =>
	node('MemberExpression', { object, property, computed, optional: false });
export const callExpression = (callee: any, args: any[]): any =>
	node('CallExpression', { callee, arguments: args, optional: false });
export const arrowFunctionExpression = (params: any[], body: any): any =>
	node('ArrowFunctionExpression', {
		params,
		body,
		async: false,
		expression: body.type !== 'BlockStatement',
		generator: false,
	});
export const blockStatement = (body: any[]): any => node('BlockStatement', { body });
export const expressionStatement = (expression: any): any =>
	node('ExpressionStatement', { expression });
export const variableDeclarator = (id: any, init: any): any =>
	node('VariableDeclarator', { id, init });
export const variableDeclaration = (kind: string, declarations: any[]): any =>
	node('VariableDeclaration', { kind, declarations });
export const assignmentExpression = (operator: string, left: any, right: any): any =>
	node('AssignmentExpression', { operator, left, right });
export const binaryExpression = (operator: string, left: any, right: any): any =>
	node('BinaryExpression', { operator, left, right });
export const conditionalExpression = (test: any, consequent: any, alternate: any): any =>
	node('ConditionalExpression', { test, consequent, alternate });
export const logicalExpression = (operator: string, left: any, right: any): any =>
	node('LogicalExpression', { operator, left, right });
export const unaryExpression = (operator: string, argument: any): any =>
	node('UnaryExpression', { operator, argument, prefix: true });
export const updateExpression = (operator: string, argument: any, prefix = false): any =>
	node('UpdateExpression', { operator, argument, prefix });
export const newExpression = (callee: any, args: any[]): any =>
	node('NewExpression', { callee, arguments: args });
export const returnStatement = (argument: any): any => node('ReturnStatement', { argument });
export const ifStatement = (test: any, consequent: any): any =>
	node('IfStatement', { test, consequent, alternate: null });
export const functionDeclaration = (id: any, params: any[], body: any): any =>
	node('FunctionDeclaration', {
		id,
		params,
		body,
		async: false,
		generator: false,
		expression: false,
	});
export const exportNamedDeclaration = (declaration: any): any =>
	node('ExportNamedDeclaration', { declaration, specifiers: [], source: null });
export const exportDefaultDeclaration = (declaration: any): any =>
	node('ExportDefaultDeclaration', { declaration });
export const exportSpecifier = (local: any, exported: any): any =>
	node('ExportSpecifier', { local, exported, exportKind: 'value' });
export const exportNamedSpecifiers = (specifiers: any[]): any =>
	node('ExportNamedDeclaration', { declaration: null, specifiers, source: null });
export const importSpecifier = (local: any, imported: any): any =>
	node('ImportSpecifier', { local, imported, importKind: 'value' });
export const importDefaultSpecifier = (local: any): any =>
	node('ImportDefaultSpecifier', { local });
export const importNamespaceSpecifier = (local: any): any =>
	node('ImportNamespaceSpecifier', { local });
export const importDeclaration = (specifiers: any[], source: any): any =>
	node('ImportDeclaration', { specifiers, source, importKind: 'value' });
export const program = (body: any[]): any => node('Program', { body, sourceType: 'module' });
export const jsxIdentifier = (name: string): any => node('JSXIdentifier', { name });
export const jsxAttribute = (name: any, value: any): any => node('JSXAttribute', { name, value });
export const jsxOpeningElement = (name: any, attributes: any[], selfClosing: boolean): any =>
	node('JSXOpeningElement', { name, attributes, selfClosing });
export const jsxClosingElement = (name: any): any => node('JSXClosingElement', { name });
export const jsxElement = (
	openingElement: any,
	closingElement: any,
	children: any[],
	selfClosing = false,
): any => node('JSXElement', { openingElement, closingElement, children, selfClosing });
export const jsxExpressionContainer = (expression: any): any =>
	node('JSXExpressionContainer', { expression });
export const jsxText = (value: string): any => node('JSXText', { value, raw: value });
export const jsxOpeningFragment = (): any => node('JSXOpeningFragment');
export const jsxClosingFragment = (): any => node('JSXClosingFragment');
export const jsxFragment = (openingFragment: any, closingFragment: any, children: any[]): any =>
	node('JSXFragment', { openingFragment, closingFragment, children });

export const cloneNode = <T>(value: T, _deep = true): T => structuredClone(value);
export const isIdentifier = (value: unknown, properties?: Properties): boolean =>
	matches(value, 'Identifier', properties);
export const isArrayPattern = (value: unknown): boolean => matches(value, 'ArrayPattern');
export const isObjectPattern = (value: unknown): boolean => matches(value, 'ObjectPattern');
export const isArrowFunctionExpression = (value: unknown): boolean =>
	matches(value, 'ArrowFunctionExpression');
export const isBlockStatement = (value: unknown): boolean => matches(value, 'BlockStatement');
export const isCallExpression = (value: unknown): boolean => matches(value, 'CallExpression');
export const isMemberExpression = (value: unknown): boolean => matches(value, 'MemberExpression');
export const isObjectProperty = (value: unknown): boolean => matches(value, 'Property');
export const isExpressionStatement = (value: unknown): boolean =>
	matches(value, 'ExpressionStatement');
export const isAssignmentExpression = (value: unknown, properties?: Properties): boolean =>
	matches(value, 'AssignmentExpression', properties);
export const isUpdateExpression = (value: unknown): boolean => matches(value, 'UpdateExpression');
export const isVariableDeclaration = (value: unknown, properties?: Properties): boolean =>
	matches(value, 'VariableDeclaration', properties);
export const isReturnStatement = (value: unknown): boolean => matches(value, 'ReturnStatement');
export const isJSXElement = (value: unknown): boolean => matches(value, 'JSXElement');
export const isStringLiteral = (value: unknown): boolean =>
	matches(value, 'Literal') && typeof (value as any).value === 'string';
export const isNumericLiteral = (value: unknown): boolean =>
	matches(value, 'Literal') && typeof (value as any).value === 'number';
export const isBooleanLiteral = (value: unknown): boolean =>
	matches(value, 'Literal') && typeof (value as any).value === 'boolean';
export const isNullLiteral = (value: unknown): boolean =>
	matches(value, 'Literal') && (value as any).value === null;
export const isStatement = (value: unknown): boolean =>
	Boolean(
		(value as any)?.type?.endsWith('Statement') ||
		(value as any)?.type?.endsWith('Declaration'),
	);
export const isExpression = (value: unknown): boolean =>
	Boolean(
		value &&
		typeof value === 'object' &&
		!isStatement(value) &&
		!String((value as any).type).startsWith('JSX'),
	);
