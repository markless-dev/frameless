import generateModule from '@babel/generator';
import traverseModule from '@babel/traverse';
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

const generate = ((generateModule as any).default ?? generateModule) as typeof generateModule;
const traverse = ((traverseModule as any).default ?? traverseModule) as typeof traverseModule;
const LEGACY_STRING_FIELDS = new Set(['functionSource', 'handlerSources', 'valueSource']);

type RecordLike = Record<string, any>;
type StateBinding = EnrichedGraphBinding & { readonly storage: 'signal' | 'store' | 'local' };
type ApiName =
	| 'createSignal'
	| 'createStore'
	| 'produce'
	| 'reconcile'
	| 'untrack'
	| 'For'
	| 'Show';
type EmitContext = {
	readonly api: ReadonlyMap<ApiName, string>;
	readonly computedByName: ReadonlyMap<string, EnrichedGraphBinding>;
	readonly events: ReadonlyMap<string, EnrichedEventRecord>;
	readonly imports: Set<ApiName>;
	readonly lexicalNames: ReadonlySet<string>;
	readonly names: NameAllocator;
	readonly propsByLocal: ReadonlyMap<string, EnrichedComponent['props']['entries'][number]>;
	readonly propsName: string;
	readonly settersById: ReadonlyMap<string, string>;
	readonly statesById: ReadonlyMap<string, StateBinding>;
	readonly statesByName: ReadonlyMap<string, StateBinding>;
	readonly storeKeys: ReadonlyMap<string, string>;
};
type RenderedNode = t.JSXElement | t.JSXExpressionContainer | t.JSXFragment | t.JSXText;

function walk(value: unknown, visit: (record: RecordLike) => void): void {
	if (!value || typeof value !== 'object') return;
	visit(value as RecordLike);
	for (const child of Object.values(value)) {
		if (Array.isArray(child)) child.forEach((entry) => walk(entry, visit));
		else walk(child, visit);
	}
}

function exactKeys(value: object, allowed: readonly string[], construct: string): void {
	const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
	if (unknown.length) throw new Error(`${construct} has unknown semantic field: ${unknown[0]}`);
}

function assertArray(value: unknown, construct: string): asserts value is any[] {
	if (!Array.isArray(value)) throw new Error(`${construct} is malformed: expected an array`);
}

function validatePath(value: unknown, construct: string): asserts value is string[] {
	assertArray(value, `${construct} path`);
	if (value.some((part) => typeof part !== 'string'))
		throw new Error(`${construct} has malformed path`);
}

function expression(node: SerializableAstNode | null | undefined): t.Expression {
	const converted = fromEstree(node);
	if (!converted || !t.isExpression(converted)) {
		throw new Error(`Expected an expression, received ${converted?.type ?? 'null'}`);
	}
	return converted;
}

function itemMemberPath(node: SerializableAstNode, item: string): string[] | null {
	const path: string[] = [];
	let current: RecordLike | undefined = node as RecordLike;
	while (
		current?.type === 'MemberExpression' &&
		current.computed === false &&
		current.property?.type === 'Identifier'
	) {
		path.unshift(current.property.name);
		current = current.object;
	}
	return current?.type === 'Identifier' && current.name === item && path.length ? path : null;
}

/** Fail closed before any target AST is constructed. */
export function validateEnrichedIr(ir: EnrichedIR): void {
	walk(ir, (record) => {
		for (const field of LEGACY_STRING_FIELDS)
			if (field in record)
				throw new Error(`Legacy source-string field is forbidden: ${field}`);
		if (
			Array.isArray(record.path) &&
			record.path.some((part) => typeof part === 'string' && /[()=>]/.test(part))
		)
			throw new Error(`Degraded read/write path is forbidden: ${record.path.join(' / ')}`);
	});
	exactKeys(
		ir,
		['version', 'filename', 'imports', 'module', 'components', 'records'],
		'EnrichedIR',
	);
	if (ir.version !== ENRICHED_IR_VERSION)
		throw new Error(`Expected ${ENRICHED_IR_VERSION}, received ${String(ir.version)}`);
	if (typeof ir.filename !== 'string') throw new Error('EnrichedIR filename is malformed');
	if (!Array.isArray(ir.components) || ir.components.length !== 1)
		throw new Error('Fixture-family Solid emitter requires exactly one component');
	if (ir.imports.length !== 0)
		throw new Error(
			'Fixture-family Solid emitter has no disclosed author-module import mapping',
		);
	const component: EnrichedComponent = ir.components[0]!;
	exactKeys(
		component,
		['name', 'evaluation', 'props', 'locals', 'guards', 'template'],
		'EnrichedComponent',
	);
	if (!t.isValidIdentifier(component.name) || !/^\p{Lu}/u.test(component.name))
		throw new Error(`Unsupported component name: ${component.name}`);
	exactKeys(
		component.evaluation,
		['ordinaryLocals', 'computedBindings'],
		'ComponentEvaluationPolicy',
	);
	if (
		component.evaluation.ordinaryLocals !== 'once-per-instance' ||
		component.evaluation.computedBindings !== 'reactive'
	)
		throw new Error(`Unsupported evaluation policy for ${component.name}`);
	exactKeys(ir.module, ['exports'], 'ModuleRecord');
	if (ir.module.exports.length !== 1)
		throw new Error(
			`Fixture-family Solid emitter requires one named export for ${component.name}`,
		);
	for (const exported of ir.module.exports)
		exactKeys(exported, ['kind', 'componentName', 'exportedName'], 'ComponentExport');
	const exported = ir.module.exports[0]!;
	if (
		exported.kind !== 'named' ||
		exported.componentName !== component.name ||
		exported.exportedName !== component.name
	)
		throw new Error(
			`Fixture-family Solid emitter requires a same-name named export for ${component.name}`,
		);

	exactKeys(component.props, ['graphNodeId', 'entries'], 'ComponentProps');
	exactKeys(
		ir.records,
		['bindings', 'aliases', 'events', 'stateReads', 'stateWrites'],
		'EnrichedRecordTable',
	);
	const bindingIds = new Set(ir.records.bindings.map((binding) => binding.id));
	const eventIds = new Set(ir.records.events.map((event) => event.id));
	if (bindingIds.size !== ir.records.bindings.length)
		throw new Error('EnrichedRecordTable has duplicate binding record ids');
	if (eventIds.size !== ir.records.events.length)
		throw new Error('EnrichedRecordTable has duplicate event record ids');
	if (!bindingIds.has(component.props.graphNodeId))
		throw new Error(
			`ComponentProps has dangling graph record id: ${component.props.graphNodeId}`,
		);

	const validateRead = (read: RecordLike, construct: string, via: boolean): void => {
		exactKeys(read, via ? ['graphNodeId', 'path', 'via'] : ['graphNodeId', 'path'], construct);
		if (typeof read.graphNodeId !== 'string' || !bindingIds.has(read.graphNodeId))
			throw new Error(
				`${construct} has dangling graph record id: ${String(read.graphNodeId)}`,
			);
		validatePath(read.path, construct);
		if (via && !['direct', 'alias', 'local', 'repeat-item'].includes(read.via))
			throw new Error(`${construct} has unsupported read shape`);
	};
	const validateSite = (site: RecordLike, construct: string): void => {
		exactKeys(site, ['expression', 'reads'], construct);
		if (!site.expression || typeof site.expression.type !== 'string')
			throw new Error(`${construct} has malformed expression AST`);
		expression(site.expression);
		assertArray(site.reads, `${construct} reads`);
		site.reads.forEach((read: RecordLike) =>
			validateRead(read, `${construct} GraphReadRef`, true),
		);
	};

	for (const entry of component.props.entries) {
		exactKeys(
			entry,
			['sourceName', 'localName', 'path', 'alias', 'graphNodeId'],
			'PropDestructuringEntry',
		);
		if (entry.alias !== (entry.sourceName !== entry.localName))
			throw new Error(
				`PropDestructuringEntry has inconsistent alias metadata: ${entry.localName}`,
			);
		validatePath(entry.path, `PropDestructuringEntry ${entry.localName}`);
		const alias = ir.records.aliases.find((record) => record.name === entry.localName);
		if (
			!alias ||
			alias.graphNodeId !== entry.graphNodeId ||
			alias.path.join('/') !== entry.path.join('/')
		)
			throw new Error(`Prop alias map does not resolve ${entry.localName}`);
	}

	const validateWrite = (write: RecordLike, construct: string): void => {
		exactKeys(
			write,
			[
				'graphNodeId',
				'path',
				'operation',
				'assignmentOperator',
				'updateOperator',
				'prefix',
				'method',
				'value',
				'arguments',
				'sourceSpan',
				'via',
			],
			construct,
		);
		if (!bindingIds.has(write.graphNodeId))
			throw new Error(`${construct} has dangling graph record id: ${write.graphNodeId}`);
		validatePath(write.path, construct);
		const directAssign =
			write.operation === 'assign' &&
			write.assignmentOperator === '=' &&
			write.via === 'direct' &&
			write.path.length === 0 &&
			write.value;
		const directUpdate =
			write.operation === 'update' &&
			['++', '--'].includes(write.updateOperator) &&
			write.via === 'direct' &&
			write.path.length === 0;
		const memberAssign =
			write.operation === 'assign' &&
			write.assignmentOperator === '=' &&
			write.via === 'handler-local-alias' &&
			write.path[0] === '*' &&
			write.path.length > 1 &&
			write.value;
		if (!directAssign && !directUpdate && !memberAssign)
			throw new Error(`${construct} has unsupported write shape for ${write.graphNodeId}`);
		if (write.value) expression(write.value);
	};

	for (const local of component.locals) {
		exactKeys(
			local,
			[
				'order',
				'declarationKind',
				'names',
				'pattern',
				'initializer',
				'reads',
				'semanticRecordIds',
			],
			'LocalDeclaration',
		);
		if (
			!Number.isInteger(local.order) ||
			!['const', 'let'].includes(local.declarationKind) ||
			local.names.length !== 1 ||
			local.pattern?.type !== 'Identifier'
		)
			throw new Error(
				`LocalDeclaration has unsupported declaration shape: ${local.names.join(',')}`,
			);
		if (local.initializer) expression(local.initializer);
		for (const id of local.semanticRecordIds)
			if (!bindingIds.has(id))
				throw new Error(`LocalDeclaration has dangling semantic record id: ${id}`);
		for (const read of local.reads)
			validateRead(read as RecordLike, 'LocalDeclaration GraphReadRef', true);
	}
	for (const binding of ir.records.bindings) {
		exactKeys(
			binding,
			[
				'id',
				'name',
				'kind',
				'declarationKind',
				'writable',
				'valueKind',
				'async',
				'asyncCapable',
				'initialValue',
				'initializer',
				'computed',
				'reads',
				'writes',
			],
			'EnrichedGraphBinding',
		);
		if (!['prop', 'state', 'computed'].includes(binding.kind))
			throw new Error(`Unsupported binding construct: ${binding.kind}`);
		if (binding.async || binding.asyncCapable)
			throw new Error(
				`Unsupported async state construct in ${binding.kind} binding ${binding.id}`,
			);
		binding.reads.forEach((read) =>
			validateRead(
				read as RecordLike,
				`EnrichedGraphBinding ${binding.id} StateReadRecord`,
				false,
			),
		);
		binding.writes.forEach((write) =>
			validateWrite(
				write as RecordLike,
				`EnrichedGraphBinding ${binding.id} StateWriteRecord`,
			),
		);
		if (binding.kind === 'state') {
			if (!binding.initializer)
				throw new Error(`State binding ${binding.id} is missing an initializer AST`);
			if (!['scalar', 'object', 'array', 'unknown'].includes(binding.valueKind ?? ''))
				throw new Error(
					`State binding ${binding.id} has unsupported valueKind: ${String(binding.valueKind)}`,
				);
			expression(binding.initializer);
		}
		if (binding.kind === 'computed') {
			if (!binding.computed)
				throw new Error(`Computed binding ${binding.id} is missing its expression site`);
			validateSite(binding.computed as RecordLike, `Computed binding ${binding.id}`);
			const fn = expression(binding.computed.expression);
			if (!t.isArrowFunctionExpression(fn) || fn.async || fn.params.length !== 0)
				throw new Error(
					`Computed binding ${binding.id} must be a synchronous zero-argument arrow`,
				);
		}
	}
	for (const alias of ir.records.aliases) {
		exactKeys(
			alias,
			['id', 'name', 'target', 'graphNodeId', 'path', 'declarationKind', 'sourceSpan'],
			'EnrichedAliasRecord',
		);
		if (!bindingIds.has(alias.graphNodeId))
			throw new Error(
				`EnrichedAliasRecord ${alias.id} has dangling graph record id: ${alias.graphNodeId}`,
			);
		validatePath(alias.path, `EnrichedAliasRecord ${alias.id}`);
	}
	ir.records.stateReads.forEach((read) =>
		validateRead(read as RecordLike, 'StateReadRecord', false),
	);
	ir.records.stateWrites.forEach((write) =>
		validateWrite(write as RecordLike, 'StateWriteRecord'),
	);

	const hostIds = new Set<string>();
	const keyByState = new Map<string, string>();
	const validateTemplate = (node: TemplateNode, location: string): void => {
		if (
			!node ||
			typeof node !== 'object' ||
			!['host', 'text', 'dynamic-text', 'fragment', 'branch', 'keyed-repeat'].includes(
				(node as TemplateNode).kind,
			)
		)
			throw new Error(
				`TemplateNode has malformed construct at ${location}: ${String((node as any)?.kind)}`,
			);
		if (node.kind === 'text') {
			exactKeys(node, ['kind', 'id', 'value'], 'TemplateText');
			if (typeof node.value !== 'string')
				throw new Error(`TemplateText has malformed value at ${location}`);
			return;
		}
		if (node.kind === 'dynamic-text') {
			exactKeys(node, ['kind', 'id', 'expression', 'reads'], 'TemplateDynamicText');
			validateSite(
				{ expression: node.expression, reads: node.reads },
				`TemplateDynamicText ${location}`,
			);
			return;
		}
		if (node.kind === 'fragment') {
			exactKeys(node, ['kind', 'id', 'children'], 'TemplateFragment');
			node.children.forEach((child, index) =>
				validateTemplate(child, `${location}.children[${index}]`),
			);
			return;
		}
		if (node.kind === 'host') {
			exactKeys(
				node,
				[
					'kind',
					'id',
					'tag',
					'staticAttributes',
					'dynamicBindings',
					'eventIds',
					'children',
				],
				'TemplateHost',
			);
			if (!node.tag || !t.isValidIdentifier(node.tag, false))
				throw new Error(`TemplateHost ${node.id} has malformed tag`);
			hostIds.add(node.id);
			for (const attribute of node.staticAttributes)
				exactKeys(attribute, ['name', 'value'], 'StaticAttribute');
			for (const binding of node.dynamicBindings) {
				exactKeys(binding, ['kind', 'name', 'expression', 'reads'], 'DynamicBinding');
				if (!['attribute', 'property'].includes(binding.kind))
					throw new Error(`DynamicBinding has unsupported kind: ${binding.kind}`);
				validateSite(
					{ expression: binding.expression, reads: binding.reads },
					`DynamicBinding ${node.id}/${binding.name}`,
				);
			}
			for (const id of node.eventIds)
				if (!eventIds.has(id))
					throw new Error(`TemplateHost ${node.id} has dangling event record id: ${id}`);
			node.children.forEach((child, index) =>
				validateTemplate(child, `${location}.children[${index}]`),
			);
			return;
		}
		if (node.kind === 'branch') {
			exactKeys(node, ['kind', 'id', 'expression', 'reads', 'arms'], 'TemplateBranch');
			validateSite(
				{ expression: node.expression, reads: node.reads },
				`TemplateBranch ${node.id}`,
			);
			if (
				node.arms.length !== 2 ||
				node.arms[0]?.kind !== 'then' ||
				node.arms[1]?.kind !== 'else'
			)
				throw new Error(`TemplateBranch ${node.id} requires ordered then/else arms`);
			for (const [armIndex, arm] of node.arms.entries()) {
				exactKeys(arm, ['kind', 'children'], 'TemplateBranchArm');
				arm.children.forEach((child, index) =>
					validateTemplate(child, `${location}.arms[${armIndex}].children[${index}]`),
				);
			}
			return;
		}
		exactKeys(
			node,
			['kind', 'id', 'item', 'index', 'collection', 'key', 'row', 'empty'],
			'TemplateKeyedRepeat',
		);
		if (node.index != null)
			throw new Error(`TemplateKeyedRepeat ${node.id} has unsupported index binding`);
		if (node.empty.length !== 0)
			throw new Error(`TemplateKeyedRepeat ${node.id} has unconsumed empty semantics`);
		validateSite(node.collection as RecordLike, `TemplateKeyedRepeat ${node.id} collection`);
		validateSite(node.key as RecordLike, `TemplateKeyedRepeat ${node.id} key`);
		const path = itemMemberPath(node.key.expression, node.item);
		const keyRead = node.key.reads.find((read) => read.via === 'repeat-item');
		const collectionRead = node.collection.reads.find((read) => read.via === 'direct');
		if (
			!path ||
			path.length !== 1 ||
			!keyRead ||
			keyRead.path.join('/') !== path.join('/') ||
			!collectionRead
		)
			throw new Error(`TemplateKeyedRepeat ${node.id} has unconsumed key semantics`);
		const prior = keyByState.get(collectionRead.graphNodeId);
		if (prior && prior !== path[0])
			throw new Error(`TemplateKeyedRepeat ${node.id} conflicts with key ${prior}`);
		keyByState.set(collectionRead.graphNodeId, path[0]!);
		node.row.forEach((child, index) => validateTemplate(child, `${location}.row[${index}]`));
	};
	component.template.forEach((node, index) => validateTemplate(node, `template[${index}]`));
	for (const guard of component.guards) {
		exactKeys(guard, ['id', 'test', 'whenTrue'], 'GuardReturn');
		validateSite(guard.test as RecordLike, `GuardReturn ${guard.id} test`);
		if (guard.whenTrue.kind === 'null')
			exactKeys(guard.whenTrue, ['kind'], `GuardResult ${guard.id}`);
		else if (guard.whenTrue.kind === 'expression') {
			exactKeys(guard.whenTrue, ['kind', 'value'], `GuardResult ${guard.id}`);
			validateSite(guard.whenTrue.value as RecordLike, `GuardResult ${guard.id} expression`);
		} else if (guard.whenTrue.kind === 'template') {
			exactKeys(guard.whenTrue, ['kind', 'children'], `GuardResult ${guard.id}`);
			guard.whenTrue.children.forEach((node, index) =>
				validateTemplate(node, `guard:${guard.id}[${index}]`),
			);
		} else throw new Error(`GuardResult ${guard.id} has malformed construct`);
	}

	for (const event of ir.records.events) {
		exactKeys(
			event,
			['id', 'hostNodeId', 'eventName', 'syncPolicy', 'handlers'],
			'EnrichedEventRecord',
		);
		if (!event.handlers.length)
			throw new Error(`EnrichedEventRecord ${event.id} has malformed handlers`);
		for (const handler of event.handlers) {
			exactKeys(handler, ['expression', 'reads', 'writes'], 'EventHandlerRecord');
			validateSite(
				{ expression: handler.expression, reads: handler.reads },
				`EventHandlerRecord ${event.id}`,
			);
			const fn = expression(handler.expression);
			if (!t.isArrowFunctionExpression(fn) || fn.async)
				throw new Error(`EventHandlerRecord ${event.id} requires a synchronous arrow`);
			handler.writes.forEach((write) =>
				validateWrite(write as RecordLike, `EventHandlerRecord ${event.id}`),
			);
		}
		if (event.syncPolicy) {
			const policy = event.syncPolicy as RecordLike;
			exactKeys(policy, ['when', 'actions'], `SyncPolicy ${event.id}`);
			if (
				policy.when?.type !== 'constant-truthy' ||
				policy.when.value !== true ||
				!Array.isArray(policy.actions) ||
				policy.actions.some((action: string) => action !== 'preventDefault')
			)
				throw new Error(`SyncPolicy ${event.id} has unsupported sync shape`);
		}
		for (const handler of event.handlers) {
			for (const write of handler.writes.filter(
				(entry) => entry.via === 'handler-local-alias',
			)) {
				const key = keyByState.get(write.graphNodeId);
				if (key && write.path.slice(1).join('/') === key)
					throw new Error(
						`TemplateKeyedRepeat has unsupported identity mutation: ${write.graphNodeId}/${key}`,
					);
			}
		}
	}
	for (const event of ir.records.events)
		if (!hostIds.has(event.hostNodeId))
			throw new Error(
				`EnrichedEventRecord ${event.id} has dangling host record id: ${event.hostNodeId}`,
			);
	for (const binding of ir.records.bindings.filter(
		(entry) => entry.kind === 'state' && entry.valueKind === 'array',
	)) {
		if (!keyByState.has(binding.id))
			throw new Error(`Array state ${binding.id} has unconsumed keyed identity semantics`);
	}
}

class NameAllocator {
	readonly #used: Set<string>;
	constructor(used: Iterable<string>) {
		this.#used = new Set(used);
	}
	claim(preferred: string): string {
		let candidate = preferred;
		let suffix = 2;
		while (this.#used.has(candidate)) candidate = `${preferred}${suffix++}`;
		this.#used.add(candidate);
		return candidate;
	}
}

function collectAuthoredNames(ir: EnrichedIR): Set<string> {
	const names = new Set<string>();
	walk(ir, (record) => {
		if (record.type === 'Identifier' && typeof record.name === 'string') names.add(record.name);
		if (typeof record.item === 'string') names.add(record.item);
		if (typeof record.index === 'string') names.add(record.index);
	});
	for (const binding of ir.records.bindings) names.add(binding.name);
	for (const local of ir.components[0]!.locals) local.names.forEach((name) => names.add(name));
	return names;
}

function setterBase(name: string): string {
	return `set${name[0]!.toUpperCase()}${name.slice(1)}`;
}
function member(object: t.Expression, property: string): t.MemberExpression {
	return t.memberExpression(object, t.identifier(property));
}
function pathMember(root: t.Expression, path: readonly string[]): t.Expression {
	return path.reduce<t.Expression>((value, field) => member(value, field), root);
}

function api(context: EmitContext, name: ApiName): t.Identifier {
	context.imports.add(name);
	return t.identifier(context.api.get(name)!);
}

function rewriteBabelExpression(result: t.Expression, context: EmitContext): t.Expression {
	const wrapper = t.file(t.program([t.expressionStatement(result)]));
	traverse(wrapper, {
		AssignmentExpression: {
			exit(path) {
				if (
					!t.isIdentifier(path.node.left) ||
					path.scope.getBinding(path.node.left.name) ||
					context.lexicalNames.has(path.node.left.name)
				)
					return;
				const state = context.statesByName.get(path.node.left.name);
				if (!state || state.storage === 'local') return;
				if (path.node.operator !== '=')
					throw new Error(`Unsupported state assignment operator: ${path.node.operator}`);
				const setter = t.identifier(context.settersById.get(state.id)!);
				let value = path.node.right;
				if (state.storage === 'store') {
					const key = context.storeKeys.get(state.id);
					const options = key
						? [
								t.objectExpression([
									t.objectProperty(t.identifier('key'), t.stringLiteral(key)),
								]),
							]
						: [];
					value = t.callExpression(api(context, 'reconcile'), [value, ...options]);
				}
				path.replaceWith(t.callExpression(setter, [value]));
				path.skip();
			},
		},
		UpdateExpression: {
			exit(path) {
				if (
					!t.isIdentifier(path.node.argument) ||
					path.scope.getBinding(path.node.argument.name) ||
					context.lexicalNames.has(path.node.argument.name)
				)
					return;
				const state = context.statesByName.get(path.node.argument.name);
				if (!state || state.storage === 'local') return;
				if (state.storage !== 'signal' || !path.parentPath.isExpressionStatement())
					throw new Error(
						`Unsupported value-observed state update: ${state.name}${path.node.operator}`,
					);
				const operator = path.node.operator === '++' ? '+' : '-';
				path.replaceWith(
					t.callExpression(t.identifier(context.settersById.get(state.id)!), [
						t.binaryExpression(
							operator,
							t.callExpression(t.identifier(state.name), []),
							t.numericLiteral(1),
						),
					]),
				);
				path.skip();
			},
		},
		Identifier(path) {
			const name = path.node.name;
			const writeTarget =
				(path.parentPath.isAssignmentExpression() && path.key === 'left') ||
				(path.parentPath.isUpdateExpression() && path.key === 'argument');
			if (
				writeTarget ||
				!path.isReferencedIdentifier() ||
				path.scope.getBinding(name) ||
				context.lexicalNames.has(name)
			)
				return;
			const prop = context.propsByLocal.get(name);
			const state = context.statesByName.get(name);
			const computed = context.computedByName.get(name);
			let replacement: t.Expression | null = null;
			if (prop) replacement = pathMember(t.identifier(context.propsName), prop.path);
			else if (state?.storage === 'signal')
				replacement = t.callExpression(t.identifier(state.name), []);
			else if (computed) replacement = t.callExpression(t.identifier(computed.name), []);
			if (!replacement) return;
			path.replaceWith(replacement);
			if (path.parentPath.isObjectProperty() && path.parentPath.node.shorthand)
				path.parentPath.node.shorthand = false;
			path.skip();
		},
	});
	const statement = wrapper.program.body[0];
	if (!t.isExpressionStatement(statement))
		throw new Error('Expression rewrite lost its wrapper statement');
	return statement.expression;
}

function rewriteExpression(node: SerializableAstNode, context: EmitContext): t.Expression {
	return rewriteBabelExpression(expression(node), context);
}

function jsxAttribute(name: string, value: string | true | t.Expression): t.JSXAttribute {
	return t.jsxAttribute(
		t.jsxIdentifier(name),
		value === true
			? null
			: typeof value === 'string'
				? t.stringLiteral(value)
				: t.jsxExpressionContainer(value),
	);
}

function expressionFromNodes(nodes: readonly TemplateNode[], context: EmitContext): t.Expression {
	const children = nodes.map((node) => templateNode(node, context));
	if (children.length === 0)
		return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), []);
	if (children.length === 1 && (t.isJSXElement(children[0]) || t.isJSXFragment(children[0])))
		return children[0];
	return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), children);
}

function showNode(
	node: Extract<TemplateNode, { kind: 'branch' }>,
	context: EmitContext,
): t.JSXElement {
	const name = t.jsxIdentifier(api(context, 'Show').name);
	const fallback = expressionFromNodes(node.arms[1]!.children, context);
	const children = expressionFromNodes(node.arms[0]!.children, context);
	return t.jsxElement(
		t.jsxOpeningElement(
			name,
			[
				jsxAttribute('when', rewriteExpression(node.expression, context)),
				jsxAttribute('fallback', fallback),
			],
			false,
		),
		t.jsxClosingElement(t.cloneNode(name)),
		[children as t.JSXElement | t.JSXFragment],
		false,
	);
}

function repeatNode(
	node: Extract<TemplateNode, { kind: 'keyed-repeat' }>,
	context: EmitContext,
): t.JSXElement {
	const lexicalNames = new Set(context.lexicalNames).add(node.item);
	if (node.index) lexicalNames.add(node.index);
	const rowContext = { ...context, lexicalNames };
	const callback = t.arrowFunctionExpression(
		[t.identifier(node.item)],
		expressionFromNodes(node.row, rowContext),
	);
	const name = t.jsxIdentifier(api(context, 'For').name);
	return t.jsxElement(
		t.jsxOpeningElement(
			name,
			[jsxAttribute('each', rewriteExpression(node.collection.expression, context))],
			false,
		),
		t.jsxClosingElement(t.cloneNode(name)),
		[t.jsxExpressionContainer(callback)],
		false,
	);
}

function eventAttributeName(name: string): string {
	return `on${name[0]!.toUpperCase()}${name.slice(1)}`;
}

function templateNode(node: TemplateNode, context: EmitContext): RenderedNode {
	if (node.kind === 'text') return t.jsxText(node.value);
	if (node.kind === 'dynamic-text')
		return t.jsxExpressionContainer(rewriteExpression(node.expression, context));
	if (node.kind === 'fragment')
		return t.jsxFragment(
			t.jsxOpeningFragment(),
			t.jsxClosingFragment(),
			node.children.map((child) => templateNode(child, context)),
		);
	if (node.kind === 'branch') return showNode(node, context);
	if (node.kind === 'keyed-repeat') return repeatNode(node, context);
	const attributes: t.JSXAttribute[] = node.staticAttributes.map((attribute) =>
		jsxAttribute(attribute.name, attribute.value),
	);
	for (const binding of node.dynamicBindings) {
		const value = rewriteExpression(binding.expression, context);
		attributes.push(jsxAttribute(binding.name, value));
		if (binding.kind === 'property' && binding.name === 'value')
			attributes.push(jsxAttribute('attr:value', t.cloneNode(value, true)));
	}
	for (const eventId of node.eventIds) {
		const event = context.events.get(eventId);
		if (!event) throw new Error(`Unknown event record: ${eventId}`);
		attributes.push(
			jsxAttribute(eventAttributeName(event.eventName), emitEvent(event, context)),
		);
	}
	const name = t.jsxIdentifier(node.tag);
	const children = node.children.map((child) => templateNode(child, context));
	const selfClosing = children.length === 0;
	return t.jsxElement(
		t.jsxOpeningElement(name, attributes, selfClosing),
		selfClosing ? null : t.jsxClosingElement(t.cloneNode(name)),
		children,
		selfClosing,
	);
}

function isPreventDefault(statement: t.Statement, parameter: string): boolean {
	return (
		t.isExpressionStatement(statement) &&
		t.isCallExpression(statement.expression) &&
		statement.expression.arguments.length === 0 &&
		t.isMemberExpression(statement.expression.callee) &&
		!statement.expression.callee.computed &&
		t.isIdentifier(statement.expression.callee.object, { name: parameter }) &&
		t.isIdentifier(statement.expression.callee.property, { name: 'preventDefault' })
	);
}

function lowerStoreMemberWrites(
	fn: t.ArrowFunctionExpression,
	handler: EventHandlerRecord,
	context: EmitContext,
): void {
	if (!t.isBlockStatement(fn.body)) return;
	const deepWrites = handler.writes.filter((write) => write.via === 'handler-local-alias');
	if (!deepWrites.length) return;
	const statements = fn.body.body;
	const remove = new Set<number>();
	const replacements = new Map<number, t.Statement>();
	for (const write of deepWrites) {
		const state = context.statesById.get(write.graphNodeId);
		if (!state || state.storage !== 'store')
			throw new Error(`Member write ${write.graphNodeId} does not target a store cell`);
		const leaf = write.path.at(-1)!;
		let aliasIndex = -1;
		let aliasName = '';
		let receiverName = '';
		let predicate: t.ArrowFunctionExpression | null = null;
		for (let index = 0; index < statements.length; index++) {
			const statement = statements[index];
			if (!t.isVariableDeclaration(statement)) continue;
			const declaration = statement.declarations.find(
				(entry) =>
					t.isIdentifier(entry.id) &&
					t.isCallExpression(entry.init) &&
					t.isMemberExpression(entry.init.callee) &&
					t.isIdentifier(entry.init.callee.object) &&
					t.isIdentifier(entry.init.callee.property, { name: 'find' }) &&
					t.isArrowFunctionExpression(entry.init.arguments[0]),
			);
			if (
				!declaration ||
				!t.isIdentifier(declaration.id) ||
				!t.isCallExpression(declaration.init) ||
				!t.isMemberExpression(declaration.init.callee) ||
				!t.isIdentifier(declaration.init.callee.object) ||
				!t.isArrowFunctionExpression(declaration.init.arguments[0])
			)
				continue;
			const assignment = statements[index + 1];
			if (
				!t.isExpressionStatement(assignment) ||
				!t.isAssignmentExpression(assignment.expression) ||
				!t.isMemberExpression(assignment.expression.left) ||
				!t.isIdentifier(assignment.expression.left.object, { name: declaration.id.name }) ||
				!t.isIdentifier(assignment.expression.left.property, { name: leaf })
			)
				continue;
			aliasIndex = index;
			aliasName = declaration.id.name;
			receiverName = declaration.init.callee.object.name;
			predicate = declaration.init.arguments[0];
			break;
		}
		if (aliasIndex < 0 || !predicate)
			throw new Error(
				`Could not structurally lower store member write ${write.graphNodeId}/${write.path.join('/')}`,
			);
		let copyIndex = -1;
		if (receiverName !== state.name) {
			copyIndex = statements.findIndex(
				(statement) =>
					t.isVariableDeclaration(statement) &&
					statement.declarations.some(
						(entry) =>
							t.isIdentifier(entry.id, { name: receiverName }) &&
							t.isCallExpression(entry.init) &&
							t.isMemberExpression(entry.init.callee) &&
							t.isIdentifier(entry.init.callee.object, { name: state.name }) &&
							t.isIdentifier(entry.init.callee.property, { name: 'slice' }),
					),
			);
			if (copyIndex < 0 || copyIndex > aliasIndex)
				throw new Error(
					`Store member write ${write.graphNodeId} has an unsupported copy receiver`,
				);
		}
		const assignment = statements[aliasIndex + 1] as t.ExpressionStatement;
		const rootIndex = statements.findIndex(
			(statement, index) =>
				index > aliasIndex &&
				t.isExpressionStatement(statement) &&
				t.isAssignmentExpression(statement.expression) &&
				t.isIdentifier(statement.expression.left, { name: state.name }),
		);
		if (rootIndex < 0)
			throw new Error(
				`Store member write ${write.graphNodeId} has no authored structural publication`,
			);
		const draftName = context.names.claim('storeDraft');
		const draft = t.identifier(draftName);
		const aliasDeclaration = t.variableDeclaration('const', [
			t.variableDeclarator(
				t.identifier(aliasName),
				t.callExpression(member(t.cloneNode(draft), 'find'), [
					t.cloneNode(predicate, true),
				]),
			),
		]);
		const callback = t.arrowFunctionExpression(
			[t.cloneNode(draft)],
			t.blockStatement([aliasDeclaration, t.cloneNode(assignment, true)]),
		);
		const call = t.expressionStatement(
			t.callExpression(t.identifier(context.settersById.get(state.id)!), [
				t.callExpression(api(context, 'produce'), [callback]),
			]),
		);
		const insertion = copyIndex >= 0 ? copyIndex : aliasIndex;
		replacements.set(insertion, call);
		remove.add(aliasIndex);
		remove.add(aliasIndex + 1);
		remove.add(rootIndex);
		if (copyIndex >= 0) remove.add(copyIndex);
	}
	fn.body.body = statements.flatMap((statement, index) =>
		replacements.has(index) ? [replacements.get(index)!] : remove.has(index) ? [] : [statement],
	);
}

function syncActions(event: EnrichedEventRecord): readonly string[] {
	if (!event.syncPolicy) return [];
	const policy = event.syncPolicy as { actions: readonly string[] };
	return policy.actions;
}

function normalizeHandler(
	event: EnrichedEventRecord,
	handler: EventHandlerRecord,
	context: EmitContext,
): t.ArrowFunctionExpression {
	const converted = expression(handler.expression);
	if (!t.isArrowFunctionExpression(converted))
		throw new Error(`Event handler ${event.id} is not an arrow function`);
	const fn = converted;
	if (!t.isBlockStatement(fn.body)) fn.body = t.blockStatement([t.expressionStatement(fn.body)]);
	lowerStoreMemberWrites(fn, handler, context);
	const parameter = fn.params[0];
	const actions = syncActions(event);
	if (actions.length && !t.isIdentifier(parameter))
		throw new Error(`Sync policy ${event.id} requires an identifier event parameter`);
	if (t.isIdentifier(parameter)) {
		let authored = false;
		fn.body.body = fn.body.body.filter((statement) => {
			if (!isPreventDefault(statement, parameter.name)) return true;
			authored = true;
			return false;
		});
		if (authored && !actions.includes('preventDefault'))
			throw new Error(`Undeclared preventDefault synchronization in ${event.id}`);
	}
	const rewritten = rewriteBabelExpression(fn, context);
	if (!t.isArrowFunctionExpression(rewritten) || !t.isBlockStatement(rewritten.body))
		throw new Error(`Event handler ${event.id} was not preserved as an arrow`);
	if (actions.length) {
		const eventParameter = rewritten.params[0];
		if (!t.isIdentifier(eventParameter))
			throw new Error(`Sync policy ${event.id} lost its event parameter`);
		rewritten.body.body.unshift(
			t.expressionStatement(
				t.callExpression(member(t.identifier(eventParameter.name), 'preventDefault'), []),
			),
		);
	}
	return rewritten;
}

function emitEvent(event: EnrichedEventRecord, context: EmitContext): t.ArrowFunctionExpression {
	const handlers = event.handlers.map((handler) => normalizeHandler(event, handler, context));
	if (handlers.length === 1) return handlers[0]!;
	const parameter = t.identifier('event');
	return t.arrowFunctionExpression(
		[parameter],
		t.blockStatement(
			handlers.map((handler) =>
				t.expressionStatement(t.callExpression(handler, [t.cloneNode(parameter)])),
			),
		),
	);
}

function referencedGraphIds(
	component: EnrichedComponent,
	records: EnrichedIR['records'],
): Set<string> {
	const ids = new Set<string>();
	walk({ guards: component.guards, template: component.template }, (record) => {
		if (typeof record.graphNodeId === 'string') ids.add(record.graphNodeId);
	});
	for (const binding of records.bindings)
		if (binding.kind === 'computed')
			for (const read of binding.computed?.reads ?? []) ids.add(read.graphNodeId);
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

function needsUntrack(reads: readonly { graphNodeId: string }[], context: EmitContext): boolean {
	return reads.some(
		(read) =>
			read.graphNodeId === context.statesById.get(read.graphNodeId)?.id ||
			read.graphNodeId.startsWith('prop:'),
	);
}

function onceValue(
	value: t.Expression,
	reads: readonly { graphNodeId: string }[],
	context: EmitContext,
): t.Expression {
	if (!needsUntrack(reads, context)) return value;
	return t.callExpression(api(context, 'untrack'), [t.arrowFunctionExpression([], value)]);
}

function componentFunction(
	ir: EnrichedIR,
	component: EnrichedComponent,
	context: EmitContext,
): t.ExportNamedDeclaration {
	const body: t.Statement[] = [];
	const bindingById = new Map(ir.records.bindings.map((binding) => [binding.id, binding]));
	for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
		const semantic = local.semanticRecordIds
			.map((id) => bindingById.get(id))
			.filter((binding): binding is EnrichedGraphBinding => Boolean(binding));
		if (semantic.length > 1)
			throw new Error(
				`LocalDeclaration has unsupported multi-semantic shape: ${local.names.join(',')}`,
			);
		const state = semantic.find((binding) => binding.kind === 'state');
		const computed = semantic.find((binding) => binding.kind === 'computed');
		if (state) {
			const mapped = context.statesById.get(state.id)!;
			const initializer = onceValue(
				rewriteExpression(state.initializer!, context),
				local.reads,
				context,
			);
			if (mapped.storage === 'signal') {
				body.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.arrayPattern([
								t.identifier(state.name),
								t.identifier(context.settersById.get(state.id)!),
							]),
							t.callExpression(api(context, 'createSignal'), [initializer]),
						),
					]),
				);
			} else if (mapped.storage === 'store') {
				body.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.arrayPattern([
								t.identifier(state.name),
								t.identifier(context.settersById.get(state.id)!),
							]),
							t.callExpression(api(context, 'createStore'), [initializer]),
						),
					]),
				);
			} else
				body.push(
					t.variableDeclaration('let', [
						t.variableDeclarator(t.identifier(state.name), initializer),
					]),
				);
			continue;
		}
		if (computed) {
			body.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier(computed.name),
						rewriteExpression(computed.computed!.expression, context),
					),
				]),
			);
			continue;
		}
		const initializer = onceValue(
			rewriteExpression(local.initializer!, context),
			local.reads,
			context,
		);
		if (identifierIsUsed(ir, local.names[0]!))
			body.push(
				t.variableDeclaration(local.declarationKind, [
					t.variableDeclarator(fromEstree(local.pattern) as t.LVal, initializer),
				]),
			);
		else body.push(t.expressionStatement(initializer));
	}
	for (const guard of component.guards) {
		let result: t.Expression;
		if (guard.whenTrue.kind === 'null') result = t.nullLiteral();
		else if (guard.whenTrue.kind === 'expression')
			result = rewriteExpression(guard.whenTrue.value.expression, context);
		else result = expressionFromNodes(guard.whenTrue.children, context);
		body.push(
			t.ifStatement(
				rewriteExpression(guard.test.expression, context),
				t.returnStatement(result),
			),
		);
	}
	body.push(t.returnStatement(expressionFromNodes(component.template, context)));
	return t.exportNamedDeclaration(
		t.functionDeclaration(
			t.identifier(component.name),
			[t.identifier(context.propsName)],
			t.blockStatement(body),
		),
	);
}

function collectStoreKeys(component: EnrichedComponent): Map<string, string> {
	const keys = new Map<string, string>();
	walk(component.template, (record) => {
		if (record.kind !== 'keyed-repeat') return;
		const collection = record.collection?.reads?.find(
			(read: RecordLike) => read.via === 'direct',
		);
		const key = record.key?.reads?.find((read: RecordLike) => read.via === 'repeat-item');
		if (collection && key?.path?.length === 1) keys.set(collection.graphNodeId, key.path[0]);
	});
	return keys;
}

/** Emit one Solid 1.x-compatible .jsx module from frameless-enriched-ir/1. */
export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	const component = ir.components[0]!;
	const authored = collectAuthoredNames(ir);
	const allocator = new NameAllocator(authored);
	const apiNames = new Map<ApiName, string>();
	for (const name of [
		'createSignal',
		'createStore',
		'produce',
		'reconcile',
		'untrack',
		'For',
		'Show',
	] as const)
		apiNames.set(name, allocator.claim(name));
	const visible = referencedGraphIds(component, ir.records);
	const storeKeys = collectStoreKeys(component);
	const statesById = new Map<string, StateBinding>();
	const statesByName = new Map<string, StateBinding>();
	for (const binding of ir.records.bindings.filter((entry) => entry.kind === 'state')) {
		const storage: StateBinding['storage'] =
			binding.valueKind === 'array' ||
			binding.valueKind === 'object' ||
			storeKeys.has(binding.id)
				? 'store'
				: visible.has(binding.id)
					? 'signal'
					: 'local';
		const mapped = { ...binding, storage } as StateBinding;
		statesById.set(binding.id, mapped);
		statesByName.set(binding.name, mapped);
	}
	const settersById = new Map<string, string>();
	for (const state of statesById.values())
		if (state.storage !== 'local')
			settersById.set(state.id, allocator.claim(setterBase(state.name)));
	const propsBinding = ir.records.bindings.find(
		(binding) => binding.id === component.props.graphNodeId,
	);
	if (!propsBinding)
		throw new Error(
			`ComponentProps has dangling graph record id: ${component.props.graphNodeId}`,
		);
	const context: EmitContext = {
		api: apiNames,
		computedByName: new Map(
			ir.records.bindings
				.filter((binding) => binding.kind === 'computed')
				.map((binding) => [binding.name, binding]),
		),
		events: new Map(ir.records.events.map((event) => [event.id, event])),
		imports: new Set(),
		lexicalNames: new Set(),
		names: allocator,
		propsByLocal: new Map(component.props.entries.map((entry) => [entry.localName, entry])),
		propsName: propsBinding.name,
		settersById,
		statesById,
		statesByName,
		storeKeys,
	};
	const exported = componentFunction(ir, component, context);
	const solidNames: ApiName[] = ['createSignal', 'untrack', 'For', 'Show'];
	const storeNames: ApiName[] = ['createStore', 'produce', 'reconcile'];
	const declarations: t.Statement[] = [];
	const addImport = (source: string, candidates: ApiName[]): void => {
		const names = candidates.filter((name) => context.imports.has(name));
		if (!names.length) return;
		declarations.push(
			t.importDeclaration(
				names.map((name) =>
					t.importSpecifier(t.identifier(context.api.get(name)!), t.identifier(name)),
				),
				t.stringLiteral(source),
			),
		);
	};
	addImport('solid-js', solidNames);
	addImport('solid-js/store', storeNames);
	(declarations[0] ?? exported).leadingComments = [
		{
			type: 'CommentLine',
			value: ' @generated by @frameless/solid; do not edit.',
		} as t.CommentLine,
	];
	declarations.push(exported);
	return `${generate(t.program(declarations, [], 'module'), { comments: true, jsescOption: { minimal: true } }).code}\n`;
}
