import generateModule from '@babel/generator';
import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
	ENRICHED_IR_VERSION,
	type EnrichedComponent,
	type EnrichedEventRecord,
	type EnrichedGraphBinding,
	type EnrichedIR,
	type EventHandlerRecord,
	type SerializableAstNode,
	type TemplateNode,
} from '@frameless/compiler';
import { fromEstree } from './estree-to-babel.ts';

const LEGACY_STRING_FIELDS = new Set(['functionSource', 'handlerSources', 'valueSource']);
const generate = ((generateModule as any).default ?? generateModule) as typeof generateModule;
const traverse = ((traverseModule as any).default ?? traverseModule) as typeof traverseModule;

type StateBinding = EnrichedGraphBinding & { storage: 'state' | 'ref' };
type EmitContext = {
	readonly statesById: ReadonlyMap<string, StateBinding>;
	readonly events: ReadonlyMap<string, EnrichedEventRecord>;
};
type RenderedNode =
	| t.JSXElement
	| t.JSXExpressionContainer
	| t.JSXFragment
	| t.JSXSpreadChild
	| t.JSXText;

function walk(value: unknown, visit: (record: Record<string, unknown>) => void): void {
	if (!value || typeof value !== 'object') return;
	visit(value as Record<string, unknown>);
	for (const child of Object.values(value)) {
		if (Array.isArray(child)) child.forEach((entry) => walk(entry, visit));
		else walk(child, visit);
	}
}

/** Fail closed at the public emitter boundary before constructing output AST. */
export function validateEnrichedIr(ir: EnrichedIR): void {
	if (ir.version !== ENRICHED_IR_VERSION) {
		throw new Error(`Expected ${ENRICHED_IR_VERSION}, received ${String(ir.version)}`);
	}
	if (ir.components.length !== 1) {
		throw new Error('Fixture-family React emitter requires exactly one component per IR artifact');
	}
	const component = ir.components[0]!;
	if (
		component.evaluation.ordinaryLocals !== 'once-per-instance' ||
		component.evaluation.computedBindings !== 'reactive'
	) {
		throw new Error(`Unsupported evaluation policy for ${component.name}`);
	}
	const exported = ir.module.exports.find((entry) => entry.componentName === component.name);
	if (!exported || exported.kind !== 'named' || exported.exportedName !== component.name) {
		throw new Error(`Fixture-family React emitter requires a same-name named export for ${component.name}`);
	}
	for (const entry of component.props.entries) {
		const alias = ir.records.aliases.find((record) => record.name === entry.localName);
		if (
			!alias ||
			alias.graphNodeId !== entry.graphNodeId ||
			alias.path.join('/') !== entry.path.join('/')
		) {
			throw new Error(`Prop alias map does not resolve ${entry.localName}`);
		}
	}
	walk(ir, (record) => {
		for (const field of LEGACY_STRING_FIELDS) {
			if (field in record) throw new Error(`Legacy source-string field is forbidden: ${field}`);
		}
		if (
			Array.isArray(record.path) &&
			record.path.some((part) => typeof part === 'string' && /[()=>]/.test(part))
		) {
			throw new Error(`Degraded read/write path is forbidden: ${record.path.join(' / ')}`);
		}
	});
	for (const imported of ir.imports) {
		if (imported.source.startsWith('@markless/') || imported.source.startsWith('@tsrx/')) {
			throw new Error(`Target-coupled runtime import is forbidden: ${imported.source}`);
		}
	}
	if (ir.imports.length !== 0) {
		throw new Error('Fixture-family React emitter has no disclosed author-module import mapping');
	}
}

const setterName = (name: string): string => `set${name[0]!.toUpperCase()}${name.slice(1)}`;
const nextName = (name: string): string => `next${name[0]!.toUpperCase()}${name.slice(1)}`;
const currentName = (name: string): string =>
	name === 'next' ? 'id' : `current${name[0]!.toUpperCase()}${name.slice(1)}`;
const member = (object: t.Expression, property: string): t.MemberExpression =>
	t.memberExpression(object, t.identifier(property));

function referencedGraphIds(
	component: EnrichedComponent,
	records: EnrichedIR['records'],
): Set<string> {
	const ids = new Set<string>();
	walk({ guards: component.guards, template: component.template }, (record) => {
		if (typeof record.graphNodeId === 'string') ids.add(record.graphNodeId);
	});
	for (const binding of records.bindings) {
		if (binding.kind === 'computed') {
			for (const read of binding.computed?.reads ?? []) ids.add(read.graphNodeId);
		}
	}
	return ids;
}

function identifierIsUsed(ir: EnrichedIR, name: string): boolean {
	let used = false;
	walk(
		{
			guards: ir.components[0]!.guards,
			template: ir.components[0]!.template,
			events: ir.records.events,
			bindings: ir.records.bindings,
		},
		(record) => {
			if (record.type === 'Identifier' && record.name === name) used = true;
		},
	);
	return used;
}

function expression(node: SerializableAstNode | null | undefined): t.Expression {
	const converted = fromEstree(node);
	if (!converted || !t.isExpression(converted)) {
		throw new Error(`Expected an expression, received ${converted?.type ?? 'null'}`);
	}
	return converted;
}

function unwrapComputed(binding: EnrichedGraphBinding): t.Expression {
	if (!binding.computed) throw new Error(`Computed ${binding.id} has no expression`);
	const fn = expression(binding.computed.expression);
	if (!t.isArrowFunctionExpression(fn) || fn.params.length !== 0) {
		throw new Error(`Computed ${binding.id} must be a zero-argument arrow`);
	}
	if (t.isBlockStatement(fn.body)) {
		const returns = fn.body.body.filter(
			(statement): statement is t.ReturnStatement => t.isReturnStatement(statement),
		);
		if (returns.length !== 1 || !returns[0]!.argument) {
			throw new Error(`Computed ${binding.id} needs one returned expression`);
		}
		return returns[0]!.argument;
	}
	return fn.body;
}

function useStateInitializer(initializer: t.Expression): t.Expression {
	// T002 ruling 1: primitive literals are passed directly; prop-reading and
	// otherwise non-literal initializers remain lazy once-per-instance functions.
	if (
		t.isStringLiteral(initializer) ||
		t.isNumericLiteral(initializer) ||
		t.isBooleanLiteral(initializer) ||
		t.isNullLiteral(initializer)
	) {
		return initializer;
	}
	return t.arrowFunctionExpression([], t.blockStatement([t.returnStatement(initializer)]));
}

function emitOnceGuard(
	expressions: t.Expression[],
	body: t.Statement[],
	usedHooks: Set<string>,
): void {
	if (expressions.length === 0) return;
	usedHooks.add('useRef');
	const ref = t.identifier('setupDone');
	body.push(
		t.variableDeclaration('const', [
			t.variableDeclarator(
				ref,
				t.callExpression(t.identifier('useRef'), [t.nullLiteral()]),
			),
		]),
	);
	body.push(
		t.ifStatement(
			t.binaryExpression('===', member(t.cloneNode(ref), 'current'), t.nullLiteral()),
			t.blockStatement([
				t.expressionStatement(
					t.assignmentExpression(
						'=',
						member(t.cloneNode(ref), 'current'),
						t.booleanLiteral(true),
					),
				),
				...expressions.map((item) => t.expressionStatement(item)),
			]),
		),
	);
}

function jsxName(name: string): string {
	if (name === 'class') return 'className';
	if (name === 'for') return 'htmlFor';
	return name;
}

function eventProp(name: string, tag: string): string {
	// T002 ruling 9: leaf controls use React's idiomatic onChange surface.
	if (name === 'input' && ['input', 'textarea', 'select'].includes(tag)) return 'onChange';
	return `on${name[0]!.toUpperCase()}${name.slice(1)}`;
}

function expressionFromChildren(children: readonly TemplateNode[], context: EmitContext): t.Expression {
	const rendered = children.map((child) => templateNode(child, context));
	if (rendered.length === 0) return t.nullLiteral();
	if (rendered.length === 1) return rendered[0]! as unknown as t.Expression;
	return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), rendered);
}

function branchExpression(
	node: Extract<TemplateNode, { kind: 'branch' }>,
	context: EmitContext,
): t.Expression {
	let alternate: t.Expression = t.nullLiteral();
	for (let index = node.arms.length - 1; index >= 0; index -= 1) {
		const arm = node.arms[index]!;
		const result = expressionFromChildren(arm.children, context);
		if (arm.kind === 'else') alternate = result;
		else alternate = t.conditionalExpression(expression(arm.test?.expression ?? node.expression), result, alternate);
	}
	return alternate;
}

function addKeyToRow(value: t.Expression, key: t.Expression): t.JSXElement {
	if (!t.isJSXElement(value)) {
		throw new Error('A keyed repeat row must have one host root in this fixture contract');
	}
	value.openingElement.attributes.unshift(
		t.jsxAttribute(t.jsxIdentifier('key'), t.jsxExpressionContainer(key)),
	);
	return value;
}

function templateNode(node: TemplateNode, context: EmitContext): RenderedNode {
	if (node.kind === 'text') return t.jsxText(node.value);
	if (node.kind === 'dynamic-text') {
		return t.jsxExpressionContainer(expression(node.expression));
	}
	if (node.kind === 'fragment') {
		return t.jsxFragment(
			t.jsxOpeningFragment(),
			t.jsxClosingFragment(),
			node.children.map((child) => templateNode(child, context)),
		);
	}
	if (node.kind === 'branch') {
		return t.jsxExpressionContainer(branchExpression(node, context));
	}
	if (node.kind === 'keyed-repeat') {
		const params: t.Identifier[] = [t.identifier(node.item)];
		if (node.index) params.push(t.identifier(node.index));
		const row = addKeyToRow(expressionFromChildren(node.row, context), expression(node.key.expression));
		const map = t.callExpression(member(expression(node.collection.expression), 'map'), [
			t.arrowFunctionExpression(params, row),
		]);
		return t.jsxExpressionContainer(map);
	}

	const attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute> = [];
	for (const attribute of node.staticAttributes) {
		attributes.push(
			t.jsxAttribute(
				t.jsxIdentifier(jsxName(attribute.name)),
				attribute.value === true ? null : t.stringLiteral(attribute.value),
			),
		);
	}
	for (const binding of node.dynamicBindings) {
		attributes.push(
			t.jsxAttribute(
				t.jsxIdentifier(jsxName(binding.name)),
				t.jsxExpressionContainer(expression(binding.expression)),
			),
		);
	}
	for (const eventId of node.eventIds) {
		const event = context.events.get(eventId);
		if (!event) throw new Error(`Unknown event record: ${eventId}`);
		attributes.push(
			t.jsxAttribute(
				t.jsxIdentifier(eventProp(event.eventName, node.tag)),
				t.jsxExpressionContainer(
					emitEvent(event, context, ['input', 'textarea', 'select'].includes(node.tag)),
				),
			),
		);
	}
	const name = t.jsxIdentifier(node.tag);
	const children = node.children.map((child) => templateNode(child, context));
	const selfClosing = children.length === 0;
	return t.jsxElement(
		t.jsxOpeningElement(name, attributes, selfClosing),
		selfClosing ? null : t.jsxClosingElement(t.jsxIdentifier(node.tag)),
		children,
		selfClosing,
	);
}

function containsCall(fn: t.Expression, methodName: string): boolean {
	let found = false;
	const file = t.file(t.program([t.expressionStatement(t.cloneNode(fn, true))]));
	traverse(file, {
		CallExpression(path) {
			if (
				t.isMemberExpression(path.node.callee) &&
				t.isIdentifier(path.node.callee.property, { name: methodName })
			) {
				found = true;
			}
		},
	});
	return found;
}

type DeepWritePlan = {
	readonly aliasDeclaration: t.VariableDeclaration;
	readonly assignment: t.ExpressionStatement;
	readonly predicate: t.ArrowFunctionExpression;
	readonly receiver: string;
	readonly state: StateBinding;
	readonly write: EventHandlerRecord['writes'][number];
};

function deepWritePlans(
	fn: t.ArrowFunctionExpression,
	event: EnrichedEventRecord,
	context: EmitContext,
): Map<string, DeepWritePlan> {
	const plans = new Map<string, DeepWritePlan>();
	const deepWrites = event.handlers
		.flatMap((handler) => handler.writes)
		.filter((write) => write.via === 'handler-local-alias');
	if (deepWrites.length === 0) return plans;
	const file = t.file(t.program([t.expressionStatement(fn)]));
	traverse(file, {
		VariableDeclarator(path) {
			if (
				!t.isIdentifier(path.node.id) ||
				!t.isCallExpression(path.node.init) ||
				!t.isMemberExpression(path.node.init.callee) ||
				!t.isIdentifier(path.node.init.callee.property, { name: 'find' })
			) {
				return;
			}
			const predicate = path.node.init.arguments[0];
			const receiver = path.node.init.callee.object;
			if (!t.isArrowFunctionExpression(predicate) || !t.isIdentifier(receiver)) return;
			const declarationPath = path.parentPath;
			const assignment = declarationPath.getSibling(Number(declarationPath.key) + 1)?.node;
			if (
				!t.isExpressionStatement(assignment) ||
				!t.isAssignmentExpression(assignment.expression) ||
				!t.isMemberExpression(assignment.expression.left) ||
				!t.isIdentifier(assignment.expression.left.object, { name: path.node.id.name })
			) {
				return;
			}
			const leaf = t.isIdentifier(assignment.expression.left.property)
				? assignment.expression.left.property.name
				: null;
			const write = deepWrites.find((candidate) => candidate.path.at(-1) === leaf);
			if (!write) return;
			const state = context.statesById.get(write.graphNodeId);
			if (!state) throw new Error(`Deep write refers to unknown state: ${write.graphNodeId}`);
			plans.set(path.node.id.name, {
				aliasDeclaration: declarationPath.node as t.VariableDeclaration,
				assignment,
				predicate,
				receiver: receiver.name,
				state,
				write,
			});
		},
	});
	if (plans.size !== deepWrites.length) {
		throw new Error(`Could not structurally lower every deep write in ${event.id}`);
	}
	return plans;
}

function immutablePatch(base: t.Expression, path: readonly string[], value: t.Expression): t.Expression {
	if (path.length === 0) return value;
	const [head, ...tail] = path;
	if (!head || head === '*') throw new Error(`Unsupported immutable patch path: ${path.join('/')}`);
	const current = member(t.cloneNode(base), head);
	return t.objectExpression([
		t.spreadElement(t.cloneNode(base)),
		t.objectProperty(t.identifier(head), immutablePatch(current, tail, value)),
	]);
}

function replaceLeafCurrentTarget(fn: t.ArrowFunctionExpression): void {
	const eventParam = fn.params[0];
	if (!t.isIdentifier(eventParam)) return;
	const file = t.file(t.program([t.expressionStatement(fn)]));
	traverse(file, {
		MemberExpression(path) {
			if (
				t.isIdentifier(path.node.object, { name: eventParam.name }) &&
				t.isIdentifier(path.node.property, { name: 'currentTarget' }) &&
				!path.node.computed
			) {
				path.node.property = t.identifier('target');
			}
		},
	});
}

function emitMutableHandler(
	handler: EventHandlerRecord,
	event: EnrichedEventRecord,
	context: EmitContext,
): t.ArrowFunctionExpression {
	const converted = expression(handler.expression);
	if (!t.isArrowFunctionExpression(converted)) {
		throw new Error(`Event handler ${event.id} is not an arrow function`);
	}
	const fn = converted;
	if (!t.isBlockStatement(fn.body)) fn.body = t.blockStatement([t.expressionStatement(fn.body)]);

	const deepPlans = deepWritePlans(fn, { ...event, handlers: [handler] }, context);
	const removedDeclarations = new Set<t.Statement>();
	const removedAssignments = new Set<t.Statement>();
	for (const plan of deepPlans.values()) {
		removedDeclarations.add(plan.aliasDeclaration);
		const copyDeclaration = fn.body.body.find(
			(statement) =>
				t.isVariableDeclaration(statement) &&
				statement.declarations.some(
					(declaration) =>
						t.isIdentifier(declaration.id, { name: plan.receiver }) &&
						t.isCallExpression(declaration.init) &&
						t.isMemberExpression(declaration.init.callee) &&
						t.isIdentifier(declaration.init.callee.property, { name: 'slice' }),
				),
		);
		if (copyDeclaration) removedDeclarations.add(copyDeclaration);
		const redundantRoot = fn.body.body.find(
			(statement) =>
				t.isExpressionStatement(statement) &&
				t.isAssignmentExpression(statement.expression) &&
				t.isIdentifier(statement.expression.left, { name: plan.state.name }),
		);
		if (redundantRoot) removedAssignments.add(redundantRoot);
	}

	const writable = new Map<string, StateBinding>();
	for (const write of handler.writes) {
		const state = context.statesById.get(write.graphNodeId);
		if (!state) throw new Error(`Write refers to unknown state: ${write.graphNodeId}`);
		writable.set(state.name, state);
	}
	const nextByState = new Map(
		[...writable.values()].map((state) => [state.name, nextName(state.name)]),
	);
	const wrapper = t.file(t.program([t.expressionStatement(fn)]));
	traverse(wrapper, {
		Identifier(path) {
			const replacement = nextByState.get(path.node.name);
			if (!replacement) return;
			const isWriteTarget =
				(path.parentPath.isAssignmentExpression() && path.key === 'left') ||
				(path.parentPath.isUpdateExpression() && path.key === 'argument');
			if (!path.isReferencedIdentifier() && !isWriteTarget) return;
			path.replaceWith(t.identifier(replacement));
			if (path.parentPath.isObjectProperty() && t.isObjectProperty(path.parent) && path.parent.shorthand) {
				path.parent.shorthand = false;
			}
		},
	});

	const syncStatement = (state: StateBinding): t.ExpressionStatement =>
		state.storage === 'ref'
			? t.expressionStatement(
					t.assignmentExpression(
						'=',
						member(t.identifier(state.name), 'current'),
						t.identifier(nextName(state.name)),
					),
				)
			: t.expressionStatement(
					t.callExpression(t.identifier(setterName(state.name)), [
						t.identifier(nextName(state.name)),
					]),
				);

	const body: t.Statement[] = [];
	for (const state of writable.values()) {
		const initial =
			state.storage === 'ref'
				? member(t.identifier(state.name), 'current')
				: t.identifier(state.name);
		body.push(
			t.variableDeclaration('let', [
				t.variableDeclarator(t.identifier(nextName(state.name)), initial),
			]),
		);
	}
	for (const statement of fn.body.body) {
		if (removedDeclarations.has(statement) || removedAssignments.has(statement)) continue;
		let replacedDeep = false;
		for (const plan of deepPlans.values()) {
			if (statement !== plan.assignment) continue;
			const item = plan.predicate.params[0];
			if (!t.isIdentifier(item)) {
				throw new Error('Deep row selector requires an identifier parameter');
			}
			const leafPath = plan.write.path.slice(1);
			const updatedItem = immutablePatch(
				t.identifier(item.name),
				leafPath,
				expression(plan.write.value),
			);
			const mapped = t.callExpression(member(t.identifier(nextName(plan.state.name)), 'map'), [
				t.arrowFunctionExpression(
					[t.identifier(item.name)],
					t.conditionalExpression(
						t.cloneNode(plan.predicate.body, true) as t.Expression,
						updatedItem,
						t.identifier(item.name),
					),
				),
			]);
			body.push(
				t.expressionStatement(
					t.assignmentExpression('=', t.identifier(nextName(plan.state.name)), mapped),
				),
				syncStatement(plan.state),
			);
			replacedDeep = true;
		}
		if (replacedDeep) continue;
		body.push(statement);
		if (
			t.isExpressionStatement(statement) &&
			(t.isAssignmentExpression(statement.expression) ||
				t.isUpdateExpression(statement.expression))
		) {
			const target = t.isAssignmentExpression(statement.expression)
				? statement.expression.left
				: statement.expression.argument;
			if (t.isIdentifier(target)) {
				const state = [...writable.values()].find(
					(candidate) => nextName(candidate.name) === target.name,
				);
				if (state) body.push(syncStatement(state));
			}
		}
	}
	fn.body.body = body;
	return fn;
}

function replaceVersionReads(node: t.Node, versions: ReadonlyMap<string, string>): void {
	const file = t.file(t.program([t.isStatement(node) ? node : t.expressionStatement(node as t.Expression)]));
	traverse(file, {
		Identifier(path) {
			const replacement = versions.get(path.node.name);
			if (!replacement || replacement === path.node.name || !path.isReferencedIdentifier()) return;
			path.replaceWith(t.identifier(replacement));
			if (path.parentPath.isObjectProperty() && t.isObjectProperty(path.parent) && path.parent.shorthand) {
				path.parent.shorthand = false;
			}
		},
	});
}

function toConstSsa(
	fn: t.ArrowFunctionExpression,
	writable: readonly StateBinding[],
): t.ArrowFunctionExpression {
	if (!t.isBlockStatement(fn.body)) return fn;
	const nextToState = new Map(writable.map((state) => [nextName(state.name), state]));
	const versions = new Map<string, string>();
	const counters = new Map<string, number>();
	const output: t.Statement[] = [];

	for (const statement of fn.body.body) {
		if (
			t.isVariableDeclaration(statement, { kind: 'let' }) &&
			statement.declarations.length === 1 &&
			t.isIdentifier(statement.declarations[0]!.id)
		) {
			const variable = statement.declarations[0]!.id.name;
			const state = nextToState.get(variable);
			if (state) {
				if (state.storage === 'ref') {
					const current = currentName(state.name);
					output.push(
						t.variableDeclaration('const', [
							t.variableDeclarator(
								t.identifier(current),
								statement.declarations[0]!.init as t.Expression,
							),
						]),
					);
					versions.set(variable, current);
				} else {
					versions.set(variable, state.name);
				}
				continue;
			}
		}

		if (
			t.isExpressionStatement(statement) &&
			t.isAssignmentExpression(statement.expression, { operator: '=' }) &&
			t.isIdentifier(statement.expression.left) &&
			nextToState.has(statement.expression.left.name)
		) {
			const variable = statement.expression.left.name;
			const count = (counters.get(variable) ?? 0) + 1;
			counters.set(variable, count);
			const version = `${variable}${count === 1 ? '' : count}`;
			const initializer = statement.expression.right;
			replaceVersionReads(initializer, versions);
			output.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(t.identifier(version), initializer),
				]),
			);
			versions.set(variable, version);
			continue;
		}

		if (
			t.isExpressionStatement(statement) &&
			t.isUpdateExpression(statement.expression) &&
			t.isIdentifier(statement.expression.argument) &&
			nextToState.has(statement.expression.argument.name)
		) {
			const variable = statement.expression.argument.name;
			const count = (counters.get(variable) ?? 0) + 1;
			counters.set(variable, count);
			const version = `${variable}${count === 1 ? '' : count}`;
			const prior = t.identifier(versions.get(variable) ?? variable);
			const operator = statement.expression.operator === '++' ? '+' : '-';
			output.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier(version),
						t.binaryExpression(operator, prior, t.numericLiteral(1)),
					),
				]),
			);
			versions.set(variable, version);
			continue;
		}

		const syncVariable = syncVariableName(statement, writable);
		if (syncVariable) {
			const cloned = t.cloneNode(statement, true);
			replaceVersionReads(cloned, versions);
			output.push(cloned);
			continue;
		}

		const cloned = t.cloneNode(statement, true);
		replaceVersionReads(cloned, versions);
		output.push(cloned);
	}

	// Each mutable lowering write was followed by a sync. Retain only the final
	// sync per cell, at its authored final-write position (T002 rulings 4 and 5).
	const finalSync = new Map<string, number>();
	for (let index = 0; index < output.length; index += 1) {
		const variable = syncVariableName(output[index]!, writable);
		if (variable) finalSync.set(variable, index);
	}
	fn.body.body = output.filter((statement, index) => {
		const variable = syncVariableName(statement, writable);
		return !variable || finalSync.get(variable) === index;
	});
	collapseRefSyncVersions(fn, writable);
	removeDeadPureVersions(fn);
	normalizeSoleVersionNames(fn, writable);
	return fn;
}

function collapseRefSyncVersions(
	fn: t.ArrowFunctionExpression,
	writable: readonly StateBinding[],
): void {
	if (!t.isBlockStatement(fn.body)) return;
	for (const state of writable.filter((candidate) => candidate.storage === 'ref')) {
		const sync = fn.body.body.find(
			(statement): statement is t.ExpressionStatement =>
				t.isExpressionStatement(statement) &&
				t.isAssignmentExpression(statement.expression, { operator: '=' }) &&
				t.isMemberExpression(statement.expression.left) &&
				t.isIdentifier(statement.expression.left.object, { name: state.name }) &&
				t.isIdentifier(statement.expression.left.property, { name: 'current' }) &&
				t.isIdentifier(statement.expression.right),
		);
		if (!sync || !t.isAssignmentExpression(sync.expression) || !t.isIdentifier(sync.expression.right)) {
			continue;
		}
		const version = sync.expression.right.name;
		const declaration = fn.body.body.find(
			(statement): statement is t.VariableDeclaration =>
				t.isVariableDeclaration(statement, { kind: 'const' }) &&
				statement.declarations.length === 1 &&
				t.isIdentifier(statement.declarations[0]!.id, { name: version }),
		);
		const initializer = declaration?.declarations[0]!.init;
		if (!declaration || !initializer || !t.isExpression(initializer)) continue;
		sync.expression.right = t.cloneNode(initializer, true);
		fn.body.body = fn.body.body.filter((statement) => statement !== declaration);
	}
}

function normalizeSoleVersionNames(
	fn: t.ArrowFunctionExpression,
	writable: readonly StateBinding[],
): void {
	const file = t.file(t.program([t.expressionStatement(fn)]));
	traverse(file, {
		ArrowFunctionExpression(path) {
			if (path.node !== fn) return;
			path.scope.crawl();
			for (const state of writable.filter((candidate) => candidate.storage === 'state')) {
				const base = nextName(state.name);
				if (path.scope.hasBinding(base)) continue;
				const versions = Object.keys(path.scope.bindings).filter((name) =>
					new RegExp(`^${base}\\d+$`).test(name),
				);
				if (versions.length === 1) path.scope.rename(versions[0]!, base);
			}
			path.stop();
		},
	});
}

function syncVariableName(statement: t.Statement, writable: readonly StateBinding[]): string | null {
	if (!t.isExpressionStatement(statement)) return null;
	const value = statement.expression;
	if (t.isCallExpression(value) && t.isIdentifier(value.callee)) {
		const calleeName = value.callee.name;
		const state = writable.find((candidate) => setterName(candidate.name) === calleeName);
		return state ? nextName(state.name) : null;
	}
	if (
		t.isAssignmentExpression(value, { operator: '=' }) &&
		t.isMemberExpression(value.left) &&
		t.isIdentifier(value.left.object) &&
		t.isIdentifier(value.left.property, { name: 'current' })
	) {
		const object = value.left.object as t.Identifier;
		const state = writable.find((candidate) => candidate.name === object.name);
		return state ? nextName(state.name) : null;
	}
	return null;
}

function removeDeadPureVersions(fn: t.ArrowFunctionExpression): void {
	let changed = true;
	while (changed) {
		changed = false;
		const file = t.file(t.program([t.expressionStatement(fn)]));
		traverse(file, {
			VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
				if (!t.isIdentifier(path.node.id) || !/^next[A-Z]/.test(path.node.id.name)) return;
				const binding = path.scope.getBinding(path.node.id.name);
				if (!binding || binding.referenced || !path.get('init').isPure()) return;
				path.parentPath.remove();
				changed = true;
			},
		});
	}
}

function emitSingleHandler(
	handler: EventHandlerRecord,
	event: EnrichedEventRecord,
	context: EmitContext,
	leafControl: boolean,
): t.ArrowFunctionExpression {
	const writable = [...new Set(handler.writes.map((write) => write.graphNodeId))].map((id) => {
		const state = context.statesById.get(id);
		if (!state) throw new Error(`Write refers to unknown state: ${id}`);
		return state;
	});
	const fn = toConstSsa(emitMutableHandler(handler, event, context), writable);
	if (leafControl) replaceLeafCurrentTarget(fn);
	return fn;
}

function emitEvent(
	event: EnrichedEventRecord,
	context: EmitContext,
	leafControl: boolean,
): t.ArrowFunctionExpression {
	const requiredActions =
		'actions' in (event.syncPolicy ?? {})
			? (event.syncPolicy as { actions: readonly string[] }).actions
			: 'branches' in (event.syncPolicy ?? {})
				? (event.syncPolicy as { branches: ReadonlyArray<{ actions: readonly string[] }> }).branches.flatMap(
						(branch) => branch.actions,
					)
				: [];
	for (const action of requiredActions) {
		if (!containsCall(expression(event.handlers[0]!.expression), action)) {
			throw new Error(`Sync policy ${action} is absent from ${event.id}'s handler AST`);
		}
	}
	const handlers = event.handlers.map((handler) =>
		emitSingleHandler(handler, event, context, leafControl),
	);
	if (handlers.length === 1) return handlers[0]!;
	const eventParam = t.identifier('event');
	return t.arrowFunctionExpression(
		[eventParam],
		t.blockStatement(
			handlers.map((handler) =>
				t.expressionStatement(t.callExpression(handler, [t.identifier('event')])),
			),
		),
	);
}

function componentFunction(
	ir: EnrichedIR,
	component: EnrichedComponent,
	context: EmitContext,
	usedHooks: Set<string>,
): t.ExportNamedDeclaration {
	const props = component.props.entries.map((entry) => {
		const key = t.identifier(entry.sourceName);
		let value: t.Identifier | t.AssignmentPattern = t.identifier(entry.localName);
		if (entry.defaultValue) {
			value = t.assignmentPattern(t.identifier(entry.localName), expression(entry.defaultValue));
		}
		return t.objectProperty(
			key,
			value,
			false,
			entry.sourceName === entry.localName && !entry.defaultValue,
		);
	});
	const body: t.Statement[] = [];
	const pendingInitializers: t.Expression[] = [];
	const bindingById = new Map(ir.records.bindings.map((binding) => [binding.id, binding]));

	for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
		const semantic = local.semanticRecordIds
			.map((id) => bindingById.get(id))
			.filter((binding): binding is EnrichedGraphBinding => Boolean(binding));
		const state = semantic.find((binding) => binding.kind === 'state');
		const computed = semantic.find((binding) => binding.kind === 'computed');
		if (state) {
			const mapped = context.statesById.get(state.id)!;
			const initializer = expression(state.initializer);
			emitOnceGuard(pendingInitializers.splice(0), body, usedHooks);
			if (mapped.storage === 'ref') {
				usedHooks.add('useRef');
				body.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.identifier(state.name),
							t.callExpression(t.identifier('useRef'), [initializer]),
						),
					]),
				);
			} else {
				usedHooks.add('useState');
				body.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.arrayPattern([
								t.identifier(state.name),
								t.identifier(setterName(state.name)),
							]),
							t.callExpression(t.identifier('useState'), [useStateInitializer(initializer)]),
						),
					]),
				);
			}
			continue;
		}
		if (computed) {
			body.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(t.identifier(computed.name), unwrapComputed(computed)),
				]),
			);
			continue;
		}
		const initializer = expression(local.initializer);
		if (!local.names.some((name) => identifierIsUsed(ir, name))) {
			pendingInitializers.push(initializer);
			continue;
		}
		usedHooks.add('useState');
		const pattern = fromEstree(local.pattern);
		if (
			!pattern ||
			(!t.isIdentifier(pattern) && !t.isArrayPattern(pattern) && !t.isObjectPattern(pattern))
		) {
			throw new Error(`Ordinary local ${local.names.join(',')} has an unsupported pattern`);
		}
		body.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.arrayPattern([pattern]),
					t.callExpression(t.identifier('useState'), [
						t.arrowFunctionExpression([], initializer),
					]),
				),
			]),
		);
	}
	if (pendingInitializers.length) {
		throw new Error('A side-effectful once-local could not be folded into a following state initializer');
	}

	for (const guard of component.guards) {
		let result: t.Expression;
		if (guard.whenTrue.kind === 'null') result = t.nullLiteral();
		else if (guard.whenTrue.kind === 'expression') result = expression(guard.whenTrue.value.expression);
		else result = expressionFromChildren(guard.whenTrue.children, context);
		body.push(
			t.ifStatement(expression(guard.test.expression), t.returnStatement(result)),
		);
	}
	const rendered =
		component.template.length === 1 && component.template[0]!.kind === 'branch'
			? branchExpression(component.template[0], context)
			: expressionFromChildren(component.template, context);
	body.push(t.returnStatement(rendered));
	const fn = t.functionDeclaration(
		t.identifier(component.name),
		[t.objectPattern(props)],
		t.blockStatement(body),
	);
	return t.exportNamedDeclaration(fn);
}

/** Emit one automatic-runtime .jsx module from frameless-enriched-ir/1. */
export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	const component = ir.components[0]!;
	const visible = referencedGraphIds(component, ir.records);
	const statesById = new Map<string, StateBinding>();
	for (const binding of ir.records.bindings.filter((entry) => entry.kind === 'state')) {
		statesById.set(binding.id, {
			...binding,
			storage: visible.has(binding.id) ? 'state' : 'ref',
		});
	}
	const context: EmitContext = {
		statesById,
		events: new Map(ir.records.events.map((event) => [event.id, event])),
	};
	const hooks = new Set<string>();
	const exported = componentFunction(ir, component, context, hooks);
	const imports = t.importDeclaration(
		[...hooks]
			.sort()
			.map((hook) => t.importSpecifier(t.identifier(hook), t.identifier(hook))),
		t.stringLiteral('react'),
	);
	imports.leadingComments = [
		{ type: 'CommentLine', value: ' @generated by @frameless/react; do not edit.' } as t.CommentLine,
	];
	const program = t.program([imports, exported], [], 'module');
	return `${generate(program, { comments: true, jsescOption: { minimal: true } }).code}\n`;
}
