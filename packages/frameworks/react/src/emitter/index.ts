import { analyze } from 'yuku-analyzer';
import { generate } from 'yuku-codegen';
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
import * as t from './estree.ts';

const LEGACY_STRING_FIELDS = new Set(['functionSource', 'handlerSources', 'valueSource']);

type StateBinding = EnrichedGraphBinding & { storage: 'state' | 'ref' };
type EmitContext = {
	readonly statesById: ReadonlyMap<string, StateBinding>;
	readonly events: ReadonlyMap<string, EnrichedEventRecord>;
	readonly currentNames: ReadonlyMap<string, string>;
	readonly hookNames: ReadonlyMap<'useRef' | 'useState', string>;
	readonly nextNames: ReadonlyMap<string, string>;
	readonly setterNames: ReadonlyMap<string, string>;
	readonly setupRefName: string;
	readonly names: NameAllocator;
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

function visitEstree(
	value: unknown,
	visit: (node: any, parent: any | null) => void,
	parent: any | null = null,
): void {
	if (!value || typeof value !== 'object') return;
	const record = value as Record<string, any>;
	if (typeof record.type === 'string') visit(record, parent);
	for (const [key, child] of Object.entries(record)) {
		if (
			['start', 'end', 'loc', 'comments', 'leadingComments', 'trailingComments'].includes(key)
		)
			continue;
		if (Array.isArray(child)) child.forEach((entry) => visitEstree(entry, visit, record));
		else visitEstree(child, visit, record);
	}
}

function printProgram(program: any): string {
	const result = generate(program, { comments: true, quotes: 'single' });
	if (result.errors.length) {
		throw new Error(
			`yuku-codegen failed: ${result.errors.map((error) => error.message).join('; ')}`,
		);
	}
	return result.code;
}

function declaredNames(program: t.Node): string[] {
	const names: string[] = [];
	const pattern = (node: any): void => {
		if (t.isIdentifier(node)) names.push(node.name);
		else if (node?.type === 'AssignmentPattern') pattern(node.left);
		else if (node?.type === 'RestElement') pattern(node.argument);
		else if (node?.type === 'ArrayPattern') node.elements.forEach(pattern);
		else if (node?.type === 'ObjectPattern')
			node.properties.forEach((entry: any) =>
				pattern(entry.type === 'RestElement' ? entry.argument : entry.value),
			);
	};
	visitEstree(program, (node) => {
		if (
			node.type === 'ImportSpecifier' ||
			node.type === 'ImportDefaultSpecifier' ||
			node.type === 'ImportNamespaceSpecifier'
		)
			pattern(node.local);
		else if (node.type === 'VariableDeclarator') pattern(node.id);
		else if (node.type === 'FunctionDeclaration') {
			pattern(node.id);
			node.params.forEach(pattern);
		} else if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression')
			node.params.forEach(pattern);
	});
	return names.sort();
}

function reanalyzeFunction(
	fn: t.ArrowFunctionExpression,
	transform: (module: ReturnType<typeof analyze>, analyzed: t.ArrowFunctionExpression) => void,
): void {
	const source = printProgram(
		t.program([
			t.variableDeclaration('const', [
				t.variableDeclarator(t.identifier('__framelessHandler'), t.cloneNode(fn, true)),
			]),
		]),
	);
	const module = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	if (module.diagnostics.length) {
		throw new Error(
			`yuku-analyzer rejected emitted handler: ${module.diagnostics.map((item) => item.message).join('; ')}`,
		);
	}
	const declaration = module.ast.body[0] as any;
	const analyzed = declaration.declarations[0].init as t.ArrowFunctionExpression;
	transform(module, analyzed);
	Object.keys(fn).forEach((key) => delete (fn as any)[key]);
	Object.assign(fn, analyzed);
}

function replaceFreeNames(node: t.Node, replacements: ReadonlyMap<string, string>): void {
	const statement = t.isStatement(node);
	const fn = t.arrowFunctionExpression(
		[],
		statement ? t.blockStatement([t.cloneNode(node, true)]) : t.cloneNode(node, true),
	);
	reanalyzeFunction(fn, (module) => {
		for (const reference of module.unresolvedReferences) {
			const replacement = replacements.get(reference.name);
			if (!replacement || replacement === reference.name) continue;
			reference.node.name = replacement;
			const parent = module.parentOf(reference.node as any) as any;
			if (parent?.type === 'Property' && parent.shorthand) parent.shorthand = false;
		}
	});
	const replacement = statement ? fn.body.body[0] : fn.body;
	Object.keys(node as any).forEach((key) => delete (node as any)[key]);
	Object.assign(node as any, replacement);
}

/** Fail closed at the public emitter boundary before constructing output AST. */
export function validateEnrichedIr(ir: EnrichedIR): void {
	const keys = (construct: string, value: object, allowed: readonly string[]): void => {
		const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
		if (unknown.length)
			throw new Error(`${construct} has unknown semantic field: ${unknown[0]}`);
	};
	keys('EnrichedIR', ir, ['version', 'filename', 'imports', 'module', 'components', 'records']);
	if (ir.version !== ENRICHED_IR_VERSION) {
		throw new Error(`Expected ${ENRICHED_IR_VERSION}, received ${String(ir.version)}`);
	}
	if (ir.components.length > 1) {
		throw new Error(
			'EnrichedComponent cannot be lowered: multi-component modules land in the React composition package',
		);
	}
	if (ir.components.length !== 1) {
		throw new Error(
			'Fixture-family React emitter requires exactly one component per IR artifact',
		);
	}
	const component = ir.components[0]!;
	keys('EnrichedComponent', component, [
		'id',
		'name',
		'evaluation',
		'props',
		'locals',
		'guards',
		'template',
	]);
	if (typeof component.id !== 'string' || component.id.length === 0)
		throw new Error('EnrichedComponent has malformed id');
	keys('ComponentEvaluationPolicy', component.evaluation, ['ordinaryLocals', 'computedBindings']);
	keys('ComponentProps', component.props, ['graphNodeId', 'entries']);
	keys('EnrichedRecordTable', ir.records, [
		'bindings',
		'aliases',
		'events',
		'stateReads',
		'stateWrites',
		'sharedDefinitions',
		'sharedInstances',
		'sharedReads',
		'sharedCalls',
		'sharedWrites',
		'elementHandleBindings',
		'behaviors',
		'handleCalls',
	]);
	for (const [family, records] of [
		['bindings', ir.records.bindings],
		['aliases', ir.records.aliases],
		['events', ir.records.events],
		['stateReads', ir.records.stateReads],
		['stateWrites', ir.records.stateWrites],
		['sharedDefinitions', ir.records.sharedDefinitions],
		['sharedInstances', ir.records.sharedInstances],
		['sharedReads', ir.records.sharedReads],
		['sharedCalls', ir.records.sharedCalls],
		['sharedWrites', ir.records.sharedWrites],
		['elementHandleBindings', ir.records.elementHandleBindings],
		['behaviors', ir.records.behaviors],
		['handleCalls', ir.records.handleCalls],
	] as const)
		if (!Array.isArray(records))
			throw new Error(`EnrichedRecordTable ${family} has malformed record family`);
	keys('ModuleRecord', ir.module, ['exports']);
	for (const imported of ir.imports) {
		keys('ModuleImport', imported, [
			'localName',
			'source',
			'kind',
			'importedName',
			'resolvesTo',
		]);
		if (
			typeof imported.localName !== 'string' ||
			typeof imported.source !== 'string' ||
			!['default', 'named', 'namespace'].includes(imported.kind) ||
			(imported.importedName !== undefined && typeof imported.importedName !== 'string') ||
			(imported.resolvesTo !== undefined && imported.resolvesTo !== 'tsrx-module')
		)
			throw new Error('ModuleImport has malformed construct');
	}
	for (const exportedEntry of ir.module.exports)
		keys('ComponentExport', exportedEntry, ['kind', 'componentName', 'exportedName']);
	if (
		component.evaluation.ordinaryLocals !== 'once-per-instance' ||
		component.evaluation.computedBindings !== 'reactive'
	) {
		throw new Error(`Unsupported evaluation policy for ${component.name}`);
	}
	const exported = ir.module.exports.find((entry) => entry.componentName === component.name);
	if (!exported || exported.kind !== 'named' || exported.exportedName !== component.name) {
		throw new Error(
			`Fixture-family React emitter requires a same-name named export for ${component.name}`,
		);
	}
	const bindingIds = new Set(ir.records.bindings.map((binding) => binding.id));
	const componentIds = new Set(ir.components.map((entry) => entry.id));
	const validateComponentId = (construct: string, componentId: unknown): void => {
		if (typeof componentId !== 'string' || !componentIds.has(componentId))
			throw new Error(`${construct} has unknown component id: ${String(componentId)}`);
	};
	for (const entry of component.props.entries) {
		keys('PropDestructuringEntry', entry, [
			'sourceName',
			'localName',
			'path',
			'alias',
			'graphNodeId',
			'defaultValue',
		]);
		const alias = ir.records.aliases.find((record) => record.name === entry.localName);
		if (
			!alias ||
			alias.graphNodeId !== entry.graphNodeId ||
			alias.path.join('/') !== entry.path.join('/')
		) {
			throw new Error(`Prop alias map does not resolve ${entry.localName}`);
		}
		if (!bindingIds.has(entry.graphNodeId))
			throw new Error(
				`PropDestructuringEntry has dangling graph record id: ${entry.graphNodeId}`,
			);
	}
	const eventIds = new Set(ir.records.events.map((event) => event.id));
	if (bindingIds.size !== ir.records.bindings.length)
		throw new Error('EnrichedRecordTable has duplicate binding record ids');
	if (eventIds.size !== ir.records.events.length)
		throw new Error('EnrichedRecordTable has duplicate event record ids');
	if (!bindingIds.has(component.props.graphNodeId))
		throw new Error(
			`ComponentProps has dangling graph record id: ${component.props.graphNodeId}`,
		);
	const hostIds = new Set<string>();
	const validateRead = (
		read: Record<string, unknown>,
		construct: string,
		graphRead: boolean,
	): void => {
		keys(
			construct,
			read,
			graphRead ? ['graphNodeId', 'path', 'via'] : ['componentId', 'graphNodeId', 'path'],
		);
		if (!graphRead) validateComponentId(construct, read.componentId);
		if (typeof read.graphNodeId !== 'string' || !bindingIds.has(read.graphNodeId))
			throw new Error(
				`${construct} has dangling graph record id: ${String(read.graphNodeId)}`,
			);
		if (!Array.isArray(read.path) || read.path.some((part) => typeof part !== 'string'))
			throw new Error(`${construct} has malformed path`);
		if (graphRead && !['direct', 'alias', 'local', 'repeat-item'].includes(String(read.via)))
			throw new Error(`${construct} has unsupported read shape`);
	};
	const validateExpressionSite = (
		construct: string,
		site: { expression: SerializableAstNode; reads: readonly { graphNodeId: string }[] },
	): void => {
		keys(construct, site, ['expression', 'reads']);
		if (
			!site.expression ||
			typeof site.expression.type !== 'string' ||
			!Array.isArray(site.reads)
		)
			throw new Error(`${construct} has malformed expression site`);
		for (const read of site.reads)
			validateRead(
				read as unknown as Record<string, unknown>,
				`${construct} GraphReadRef`,
				true,
			);
	};
	const validateTemplate = (node: TemplateNode): void => {
		if (!node || typeof node !== 'object') {
			throw new Error(
				`TemplateNode has malformed construct: ${String((node as { kind?: unknown })?.kind)}`,
			);
		}
		if (node.kind === 'component-reference') {
			keys('TemplateComponentReference', node, [
				'kind',
				'id',
				'edgeId',
				'target',
				'props',
				'children',
			]);
			if (
				typeof node.id !== 'string' ||
				typeof node.edgeId !== 'string' ||
				!node.target ||
				typeof node.target !== 'object' ||
				!Array.isArray(node.props) ||
				!Array.isArray(node.children)
			)
				throw new Error('TemplateComponentReference has malformed construct');
			keys(
				'TemplateComponentReference target',
				node.target,
				node.target.module === 'self'
					? ['localName', 'module']
					: ['localName', 'module', 'exportedName'],
			);
			if (
				typeof node.target.localName !== 'string' ||
				typeof node.target.module !== 'string' ||
				(node.target.module !== 'self' &&
					(!('exportedName' in node.target) ||
						typeof node.target.exportedName !== 'string'))
			)
				throw new Error('TemplateComponentReference target has malformed construct');
			for (const prop of node.props) {
				keys('ComponentPropExpression', prop, [
					'name',
					'kind',
					'value',
					'graphNodeId',
					'path',
				]);
				if (
					typeof prop.name !== 'string' ||
					!['graph-reference', 'callback', 'serializable', 'opaque'].includes(
						prop.kind,
					) ||
					(prop.graphNodeId !== undefined && typeof prop.graphNodeId !== 'string') ||
					(prop.path !== undefined &&
						(!Array.isArray(prop.path) ||
							prop.path.some((part: unknown) => typeof part !== 'string')))
				)
					throw new Error('ComponentPropExpression has malformed construct');
				validateExpressionSite('ComponentPropExpression value', prop.value);
			}
			throw new Error(
				'TemplateComponentReference cannot be lowered: composition constructs land in the React composition package',
			);
		}
		if (node.kind === 'default-slot-projection') {
			keys('TemplateDefaultSlotProjection', node, ['kind', 'id', 'site']);
			if (typeof node.id !== 'string' || !node.site || typeof node.site !== 'object')
				throw new Error('TemplateDefaultSlotProjection has malformed construct');
			validateExpressionSite('TemplateDefaultSlotProjection site', node.site);
			throw new Error(
				'TemplateDefaultSlotProjection cannot be lowered: composition constructs land in the React composition package',
			);
		}
		if (
			!['host', 'text', 'dynamic-text', 'fragment', 'branch', 'keyed-repeat'].includes(
				node.kind,
			)
		)
			throw new Error(`TemplateNode has malformed construct: ${String(node.kind)}`);
		if (node.kind === 'text') {
			keys('TemplateText', node, ['kind', 'id', 'value']);
			if (typeof node.value !== 'string') throw new Error('TemplateText has malformed value');
			return;
		}
		if (node.kind === 'dynamic-text') {
			keys('TemplateDynamicText', node, ['kind', 'id', 'expression', 'reads']);
			validateExpressionSite('TemplateDynamicText expression site', {
				expression: node.expression,
				reads: node.reads,
			});
			return;
		}
		if (node.kind === 'fragment') {
			keys('TemplateFragment', node, ['kind', 'id', 'children']);
			if (!Array.isArray(node.children))
				throw new Error('TemplateFragment has malformed children');
			node.children.forEach(validateTemplate);
			return;
		}
		if (node.kind === 'host') {
			keys('TemplateHost', node, [
				'kind',
				'id',
				'tag',
				'staticAttributes',
				'dynamicBindings',
				'eventIds',
				'children',
			]);
			if (
				!node.tag ||
				!Array.isArray(node.children) ||
				!Array.isArray(node.eventIds) ||
				!Array.isArray(node.staticAttributes) ||
				!Array.isArray(node.dynamicBindings)
			)
				throw new Error(`TemplateHost ${node.id} is malformed`);
			hostIds.add(node.id);
			for (const attribute of node.staticAttributes)
				keys('StaticAttribute', attribute, ['name', 'value']);
			for (const binding of node.dynamicBindings) {
				keys('DynamicBinding', binding, ['kind', 'name', 'expression', 'reads']);
				if (!['attribute', 'property'].includes(binding.kind))
					throw new Error(`DynamicBinding has unsupported kind: ${binding.kind}`);
				validateExpressionSite('DynamicBinding expression site', {
					expression: binding.expression,
					reads: binding.reads,
				});
			}
			for (const id of node.eventIds)
				if (!eventIds.has(id))
					throw new Error(`TemplateHost ${node.id} has dangling event record id: ${id}`);
			node.children.forEach(validateTemplate);
			return;
		}
		if (node.kind === 'branch') {
			keys('TemplateBranch', node, ['kind', 'id', 'expression', 'reads', 'arms']);
			if (!Array.isArray(node.arms) || node.arms.length === 0)
				throw new Error(`TemplateBranch ${node.id} has malformed arms`);
			validateExpressionSite('TemplateBranch expression site', {
				expression: node.expression,
				reads: node.reads,
			});
			for (const arm of node.arms) {
				keys('TemplateBranchArm', arm, ['kind', 'test', 'children']);
				if (!['then', 'else-if', 'else'].includes(arm.kind) || !Array.isArray(arm.children))
					throw new Error(
						`TemplateBranchArm has malformed construct: ${String(arm.kind)}`,
					);
				if (arm.kind === 'else-if' && !arm.test)
					throw new Error(`TemplateBranchArm ${arm.kind} has malformed test`);
				if (arm.test) validateExpressionSite('TemplateBranchArm test', arm.test);
				arm.children.forEach(validateTemplate);
			}
			return;
		}
		keys('TemplateKeyedRepeat', node, [
			'kind',
			'id',
			'item',
			'index',
			'collection',
			'key',
			'row',
			'empty',
		]);
		if (!node.item || !Array.isArray(node.row) || !Array.isArray(node.empty))
			throw new Error(`TemplateKeyedRepeat ${node.id} is malformed`);
		if (node.empty.length)
			throw new Error(`TemplateKeyedRepeat ${node.id} has unsupported non-empty empty arm`);
		validateExpressionSite('TemplateKeyedRepeat collection', node.collection);
		validateExpressionSite('TemplateKeyedRepeat key', node.key);
		node.row.forEach(validateTemplate);
		node.empty.forEach(validateTemplate);
	};
	for (const local of component.locals) {
		keys('LocalDeclaration', local, [
			'order',
			'declarationKind',
			'names',
			'pattern',
			'initializer',
			'reads',
			'semanticRecordIds',
		]);
		for (const id of local.semanticRecordIds)
			if (!bindingIds.has(id))
				throw new Error(`LocalDeclaration has dangling semantic record id: ${id}`);
		for (const read of local.reads)
			validateRead(
				read as unknown as Record<string, unknown>,
				'LocalDeclaration GraphReadRef',
				true,
			);
	}
	for (const binding of ir.records.bindings) {
		keys('EnrichedGraphBinding', binding, [
			'componentId',
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
		]);
		validateComponentId(`EnrichedGraphBinding ${binding.id}`, binding.componentId);
		for (const read of binding.reads)
			validateRead(
				read as unknown as Record<string, unknown>,
				`EnrichedGraphBinding ${binding.id} StateReadRecord`,
				false,
			);
		if (binding.kind === 'computed') {
			if (!binding.computed)
				throw new Error(
					`EnrichedGraphBinding ${binding.id} has malformed computed expression`,
				);
			validateExpressionSite(`EnrichedGraphBinding ${binding.id} computed`, binding.computed);
		}
	}
	for (const alias of ir.records.aliases) {
		keys('EnrichedAliasRecord', alias, [
			'componentId',
			'id',
			'name',
			'target',
			'graphNodeId',
			'path',
			'declarationKind',
			'sourceSpan',
		]);
		validateComponentId(`EnrichedAliasRecord ${alias.id}`, alias.componentId);
		if (!bindingIds.has(alias.graphNodeId))
			throw new Error(
				`EnrichedAliasRecord ${alias.id} has dangling graph record id: ${alias.graphNodeId}`,
			);
	}
	for (const guard of component.guards) {
		keys('GuardReturn', guard, ['id', 'test', 'whenTrue']);
		validateExpressionSite(`GuardReturn ${guard.id} test`, guard.test);
		keys(
			`GuardResult ${guard.id}`,
			guard.whenTrue,
			guard.whenTrue.kind === 'null'
				? ['kind']
				: guard.whenTrue.kind === 'expression'
					? ['kind', 'value']
					: ['kind', 'children'],
		);
		if (guard.whenTrue.kind === 'expression')
			validateExpressionSite(`GuardResult ${guard.id} expression`, guard.whenTrue.value);
		else if (guard.whenTrue.kind === 'template')
			guard.whenTrue.children.forEach(validateTemplate);
		else if (guard.whenTrue.kind !== 'null')
			throw new Error(`GuardResult ${guard.id} has malformed construct`);
	}
	component.template.forEach(validateTemplate);
	const validateWrite = (
		write: EventHandlerRecord['writes'][number],
		construct: string,
	): void => {
		keys(construct, write, [
			'componentId',
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
		]);
		validateComponentId(construct, write.componentId);
		if (!bindingIds.has(write.graphNodeId))
			throw new Error(`${construct} has dangling graph record id: ${write.graphNodeId}`);
		const directAssign =
			write.operation === 'assign' &&
			write.assignmentOperator === '=' &&
			(write.via ?? 'direct') === 'direct' &&
			write.path.length === 0 &&
			write.value;
		const directUpdate =
			write.operation === 'update' &&
			['++', '--'].includes(write.updateOperator ?? '') &&
			(write.via ?? 'direct') === 'direct' &&
			write.path.length === 0;
		const aliasAssign =
			write.operation === 'assign' &&
			write.assignmentOperator === '=' &&
			write.via === 'handler-local-alias' &&
			write.path[0] === '*' &&
			write.path.length > 1 &&
			write.value;
		if (!directAssign && !directUpdate && !aliasAssign)
			throw new Error(`${construct} has unsupported write shape for ${write.graphNodeId}`);
	};
	for (const binding of ir.records.bindings) {
		binding.writes.forEach((write) =>
			validateWrite(write, `EnrichedGraphBinding ${binding.id} StateWriteRecord`),
		);
	}
	for (const write of ir.records.stateWrites) validateWrite(write, 'StateWriteRecord');
	for (const read of ir.records.stateReads)
		validateRead(read as unknown as Record<string, unknown>, 'StateReadRecord', false);
	const validateSyncCondition = (condition: Record<string, unknown>, eventId: string): void => {
		const type = condition.type;
		if (type === 'and' || type === 'or') {
			keys(`SyncPolicyCondition ${eventId}`, condition, ['type', 'conditions']);
			if (!Array.isArray(condition.conditions) || condition.conditions.length === 0)
				throw new Error(`SyncPolicy ${eventId} has unsupported sync shape`);
			condition.conditions.forEach((entry) =>
				validateSyncCondition(entry as Record<string, unknown>, eventId),
			);
		} else if (type === 'not') {
			keys(`SyncPolicyCondition ${eventId}`, condition, ['type', 'condition']);
			if (!condition.condition || typeof condition.condition !== 'object')
				throw new Error(`SyncPolicy ${eventId} has unsupported sync shape`);
			validateSyncCondition(condition.condition as Record<string, unknown>, eventId);
		} else if (type === 'graph-truthy') {
			keys(`SyncPolicyCondition ${eventId}`, condition, ['type', 'graphNodeId', 'path']);
			if (typeof condition.graphNodeId !== 'string' || !bindingIds.has(condition.graphNodeId))
				throw new Error(
					`SyncPolicyCondition ${eventId} has dangling graph record id: ${String(condition.graphNodeId)}`,
				);
			if (
				!Array.isArray(condition.path) ||
				condition.path.some((part) => typeof part !== 'string')
			)
				throw new Error(`SyncPolicyCondition ${eventId} has malformed path`);
		} else if (type === 'constant-truthy')
			keys(`SyncPolicyCondition ${eventId}`, condition, ['type', 'value']);
		else if (type === 'event-equals')
			keys(`SyncPolicyCondition ${eventId}`, condition, ['type', 'field', 'value']);
		else throw new Error(`SyncPolicy ${eventId} has unsupported sync shape`);
	};
	for (const event of ir.records.events) {
		keys('EnrichedEventRecord', event, [
			'componentId',
			'id',
			'hostNodeId',
			'eventName',
			'syncPolicy',
			'handlers',
		]);
		validateComponentId(`EnrichedEventRecord ${event.id}`, event.componentId);
		if (!event.handlers.length)
			throw new Error(`EnrichedEventRecord ${event.id} has malformed handlers`);
		for (const handler of event.handlers) {
			keys('EventHandlerRecord', handler, ['expression', 'reads', 'writes']);
			validateExpressionSite(`EventHandlerRecord ${event.id} expression site`, {
				expression: handler.expression,
				reads: handler.reads,
			});
			handler.writes.forEach((write) =>
				validateWrite(write, `EventHandlerRecord ${event.id}`),
			);
		}
		if (event.syncPolicy) {
			const policy = event.syncPolicy as unknown as Record<string, unknown>;
			keys(
				`SyncPolicy ${event.id}`,
				policy,
				'branches' in policy ? ['branches'] : ['when', 'actions'],
			);
			const branches = 'branches' in policy ? policy.branches : [policy];
			if (
				!Array.isArray(branches) ||
				branches.length === 0 ||
				branches.some(
					(branch) =>
						!branch ||
						typeof branch !== 'object' ||
						!Array.isArray((branch as { actions?: unknown }).actions) ||
						(branch as { actions: unknown[] }).actions.some(
							(action) =>
								!['preventDefault', 'stopPropagation'].includes(String(action)),
						),
				)
			) {
				throw new Error(`SyncPolicy ${event.id} has unsupported sync shape`);
			}
			for (const branch of branches as Record<string, unknown>[]) {
				keys(`SyncPolicyBranch ${event.id}`, branch, ['when', 'actions']);
				if (!branch.when || typeof branch.when !== 'object')
					throw new Error(`SyncPolicy ${event.id} has unsupported sync shape`);
				validateSyncCondition(branch.when as Record<string, unknown>, event.id);
			}
		}
	}
	for (const event of ir.records.events)
		if (!hostIds.has(event.hostNodeId))
			throw new Error(
				`EnrichedEventRecord ${event.id} has dangling host record id: ${event.hostNodeId}`,
			);
	const ast = (construct: string, value: unknown): void => {
		if (
			!value ||
			typeof value !== 'object' ||
			typeof (value as { type?: unknown }).type !== 'string'
		)
			throw new Error(`${construct} has malformed AST`);
	};
	const stringPath = (value: unknown): boolean =>
		Array.isArray(value) && value.every((part) => typeof part === 'string');
	for (const definition of ir.records.sharedDefinitions) {
		keys('SharedDefinition', definition, [
			'id',
			'name',
			'scope',
			'cells',
			'methods',
			'graphBindings',
			'returnProperties',
			'dependencies',
		]);
		if (
			typeof definition.id !== 'string' ||
			typeof definition.name !== 'string' ||
			definition.name.trim().length === 0 ||
			!['request', 'container', 'page'].includes(definition.scope) ||
			!Array.isArray(definition.cells) ||
			!Array.isArray(definition.methods) ||
			!stringPath(definition.graphBindings) ||
			!Array.isArray(definition.returnProperties) ||
			!Array.isArray(definition.dependencies)
		)
			throw new Error('SharedDefinition has malformed construct');
		for (const cell of definition.cells) {
			keys('SharedDefinitionCell', cell, ['name', 'graphNodeId', 'valueKind']);
			if (
				typeof cell.name !== 'string' ||
				typeof cell.graphNodeId !== 'string' ||
				!['scalar', 'object', 'array', 'unknown'].includes(cell.valueKind)
			)
				throw new Error('SharedDefinitionCell has malformed construct');
		}
		for (const method of definition.methods) {
			keys('SharedDefinitionMethod', method, ['name', 'site']);
			if (typeof method.name !== 'string')
				throw new Error('SharedDefinitionMethod has malformed construct');
			ast('SharedDefinitionMethod site', method.site);
		}
		for (const property of definition.returnProperties) {
			keys(
				'SharedReturnProperty',
				property,
				property.kind === 'graph'
					? ['kind', 'name', 'graphNodeId', 'path']
					: ['kind', 'name'],
			);
			if (
				typeof property.name !== 'string' ||
				(property.kind === 'graph'
					? typeof property.graphNodeId !== 'string' || !stringPath(property.path)
					: property.kind !== 'method')
			)
				throw new Error('SharedReturnProperty has malformed construct');
		}
		for (const dependency of definition.dependencies) {
			keys('SharedDependency', dependency, ['definitionId', 'definitionName']);
			if (
				typeof dependency.definitionId !== 'string' ||
				typeof dependency.definitionName !== 'string'
			)
				throw new Error('SharedDependency has malformed construct');
		}
	}
	for (const instance of ir.records.sharedInstances) {
		keys('SharedInstance', instance, ['definitionId', 'componentId', 'localName']);
		validateComponentId('SharedInstance', instance.componentId);
		if (typeof instance.definitionId !== 'string' || typeof instance.localName !== 'string')
			throw new Error('SharedInstance has malformed construct');
	}
	for (const read of ir.records.sharedReads) {
		keys('SharedRead', read, ['definitionId', 'propertyName', 'path', 'componentId', 'site']);
		validateComponentId('SharedRead', read.componentId);
		if (
			typeof read.definitionId !== 'string' ||
			typeof read.propertyName !== 'string' ||
			!stringPath(read.path)
		)
			throw new Error('SharedRead has malformed construct');
		validateExpressionSite('SharedRead site', read.site);
	}
	for (const call of ir.records.sharedCalls) {
		keys('SharedCall', call, [
			'definitionId',
			'methodName',
			'arguments',
			'componentId',
			'eventId',
			'site',
			'order',
		]);
		validateComponentId('SharedCall', call.componentId);
		if (
			typeof call.definitionId !== 'string' ||
			typeof call.methodName !== 'string' ||
			!Array.isArray(call.arguments) ||
			(call.eventId !== undefined && typeof call.eventId !== 'string') ||
			typeof call.order !== 'number'
		)
			throw new Error('SharedCall has malformed construct');
		call.arguments.forEach((argument) => ast('SharedCall argument', argument));
		validateExpressionSite('SharedCall site', call.site);
	}
	for (const write of ir.records.sharedWrites) {
		keys('SharedWrite', write, [
			'definitionId',
			'graphNodeId',
			'path',
			'operation',
			'assignmentOperator',
			'updateOperator',
			'prefix',
			'method',
			'value',
			'arguments',
			'order',
		]);
		if (
			typeof write.definitionId !== 'string' ||
			typeof write.graphNodeId !== 'string' ||
			!stringPath(write.path) ||
			!['assign', 'update', 'call', 'delete'].includes(write.operation) ||
			(write.assignmentOperator !== undefined &&
				typeof write.assignmentOperator !== 'string') ||
			(write.updateOperator !== undefined && !['++', '--'].includes(write.updateOperator)) ||
			(write.prefix !== undefined && typeof write.prefix !== 'boolean') ||
			(write.method !== undefined && typeof write.method !== 'string') ||
			(write.arguments !== undefined && !Array.isArray(write.arguments)) ||
			typeof write.order !== 'number'
		)
			throw new Error('SharedWrite has malformed construct');
		if (write.value !== undefined) ast('SharedWrite value', write.value);
		write.arguments?.forEach((argument) => ast('SharedWrite argument', argument));
	}
	for (const binding of ir.records.elementHandleBindings) {
		keys('ElementHandleBinding', binding, ['id', 'handleName', 'componentId', 'hostNodeId']);
		validateComponentId('ElementHandleBinding', binding.componentId);
		if (
			typeof binding.id !== 'string' ||
			typeof binding.handleName !== 'string' ||
			typeof binding.hostNodeId !== 'string'
		)
			throw new Error('ElementHandleBinding has malformed construct');
	}
	for (const behavior of ir.records.behaviors) {
		keys('BehaviorRecord', behavior, [
			'id',
			'hostNodeId',
			'componentId',
			'behavior',
			'inputs',
			'returnsCleanup',
			'order',
		]);
		validateComponentId('BehaviorRecord', behavior.componentId);
		if (
			typeof behavior.id !== 'string' ||
			typeof behavior.hostNodeId !== 'string' ||
			!Array.isArray(behavior.inputs) ||
			typeof behavior.returnsCleanup !== 'boolean' ||
			typeof behavior.order !== 'number'
		)
			throw new Error('BehaviorRecord has malformed construct');
		ast('BehaviorRecord behavior', behavior.behavior);
		for (const input of behavior.inputs)
			validateRead(
				input as unknown as Record<string, unknown>,
				'BehaviorRecord GraphReadRef',
				true,
			);
	}
	for (const call of ir.records.handleCalls) {
		keys('HandleCallRecord', call, [
			'handleBindingId',
			'componentId',
			'method',
			'arguments',
			'optional',
			'eventId',
			'site',
			'order',
		]);
		validateComponentId('HandleCallRecord', call.componentId);
		if (
			typeof call.handleBindingId !== 'string' ||
			typeof call.method !== 'string' ||
			!Array.isArray(call.arguments) ||
			typeof call.optional !== 'boolean' ||
			(call.eventId !== undefined && typeof call.eventId !== 'string') ||
			typeof call.order !== 'number'
		)
			throw new Error('HandleCallRecord has malformed construct');
		call.arguments.forEach((argument) => ast('HandleCallRecord argument', argument));
		validateExpressionSite('HandleCallRecord site', call.site);
	}
	for (const [construct, records] of [
		['SharedDefinition', ir.records.sharedDefinitions],
		['SharedInstance', ir.records.sharedInstances],
		['SharedRead', ir.records.sharedReads],
		['SharedCall', ir.records.sharedCalls],
		['SharedWrite', ir.records.sharedWrites],
		['ElementHandleBinding', ir.records.elementHandleBindings],
		['BehaviorRecord', ir.records.behaviors],
		['HandleCallRecord', ir.records.handleCalls],
	] as const)
		if (records.length)
			throw new Error(
				`${construct} cannot be lowered: composition constructs land in the React composition package`,
			);
	walk(ir, (record) => {
		for (const field of LEGACY_STRING_FIELDS) {
			if (field in record)
				throw new Error(`Legacy source-string field is forbidden: ${field}`);
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
		throw new Error(
			'Fixture-family React emitter has no disclosed author-module import mapping',
		);
	}
}

const setterName = (name: string): string => `set${name[0]!.toUpperCase()}${name.slice(1)}`;
const nextName = (name: string): string => `next${name[0]!.toUpperCase()}${name.slice(1)}`;
class NameAllocator {
	readonly #used: Set<string>;
	constructor(used: Iterable<string>) {
		this.#used = new Set(used);
	}
	claim(preferred: string, separator = ''): string {
		let candidate = preferred;
		let suffix = 2;
		while (this.#used.has(candidate)) candidate = `${preferred}${separator}${suffix++}`;
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
const hookName = (context: EmitContext, hook: 'useRef' | 'useState'): string =>
	context.hookNames.get(hook)!;
const setterFor = (context: EmitContext, state: StateBinding): string =>
	context.setterNames.get(state.id)!;
const nextFor = (context: EmitContext, state: StateBinding): string =>
	context.nextNames.get(state.id)!;
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
	const converted = node == null ? null : (structuredClone(node) as t.Node);
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
		const returns = fn.body.body.filter((statement: any): statement is t.ReturnStatement =>
			t.isReturnStatement(statement),
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
	context: EmitContext,
): void {
	if (expressions.length === 0) return;
	usedHooks.add('useRef');
	const ref = t.identifier(context.setupRefName);
	body.push(
		t.variableDeclaration('const', [
			t.variableDeclarator(
				ref,
				t.callExpression(t.identifier(hookName(context, 'useRef')), [t.nullLiteral()]),
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

function expressionFromChildren(
	children: readonly TemplateNode[],
	context: EmitContext,
): t.Expression {
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
		else
			alternate = t.conditionalExpression(
				expression(arm.test?.expression ?? node.expression),
				result,
				alternate,
			);
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
		const row = addKeyToRow(
			expressionFromChildren(node.row, context),
			expression(node.key.expression),
		);
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
				attribute.value === true ? null : t.jsxStringValue(attribute.value),
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
	visitEstree(fn, (node) => {
		if (t.isCallExpression(node)) {
			if (
				t.isMemberExpression(node.callee) &&
				t.isIdentifier(node.callee.property, { name: methodName })
			) {
				found = true;
			}
		}
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
	const parents = new Map<any, any>();
	visitEstree(fn, (node, parent) => {
		if (parent) parents.set(node, parent);
	});
	visitEstree(fn, (declarator) => {
		if (declarator.type === 'VariableDeclarator') {
			if (
				!t.isIdentifier(declarator.id) ||
				!t.isCallExpression(declarator.init) ||
				!t.isMemberExpression(declarator.init.callee) ||
				!t.isIdentifier(declarator.init.callee.property, { name: 'find' })
			) {
				return;
			}
			const predicate = declarator.init.arguments[0];
			const receiver = declarator.init.callee.object;
			if (!t.isArrowFunctionExpression(predicate) || !t.isIdentifier(receiver)) return;
			const declaration = parents.get(declarator) as t.VariableDeclaration;
			const block = parents.get(declaration);
			const assignment = block?.body?.[block.body.indexOf(declaration) + 1];
			if (
				!t.isExpressionStatement(assignment) ||
				!t.isAssignmentExpression(assignment.expression) ||
				!t.isMemberExpression(assignment.expression.left) ||
				!t.isIdentifier(assignment.expression.left.object, { name: declarator.id.name })
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
			plans.set(declarator.id.name, {
				aliasDeclaration: declaration,
				assignment,
				predicate,
				receiver: receiver.name,
				state,
				write,
			});
		}
	});
	if (plans.size !== deepWrites.length) {
		throw new Error(`Could not structurally lower every deep write in ${event.id}`);
	}
	return plans;
}

function immutablePatch(
	base: t.Expression,
	path: readonly string[],
	value: t.Expression,
): t.Expression {
	if (path.length === 0) return value;
	const [head, ...tail] = path;
	if (!head || head === '*')
		throw new Error(`Unsupported immutable patch path: ${path.join('/')}`);
	const current = member(t.cloneNode(base), head);
	return t.objectExpression([
		t.spreadElement(t.cloneNode(base)),
		t.objectProperty(t.identifier(head), immutablePatch(current, tail, value)),
	]);
}

function replaceLeafCurrentTarget(fn: t.ArrowFunctionExpression): void {
	const eventParam = fn.params[0];
	if (!t.isIdentifier(eventParam)) return;
	reanalyzeFunction(fn, (module, analyzed) => {
		const parameter = analyzed.params[0];
		const symbol = t.isIdentifier(parameter) ? module.symbolOf(parameter as any) : null;
		module.walk(
			{
				MemberExpression(node: any) {
					if (
						t.isIdentifier(node.object) &&
						module.symbolOf(node.object) === symbol &&
						t.isIdentifier(node.property, { name: 'currentTarget' }) &&
						!node.computed
					) {
						node.property = t.identifier('target');
					}
				},
			},
			analyzed as any,
		);
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

	const writable = new Map<string, StateBinding>();
	for (const write of handler.writes) {
		const state = context.statesById.get(write.graphNodeId);
		if (!state) throw new Error(`Write refers to unknown state: ${write.graphNodeId}`);
		writable.set(state.name, state);
	}
	const nextByState = new Map(
		[...writable.values()].map((state) => [state.name, nextFor(context, state)]),
	);
	reanalyzeFunction(fn, (module) => {
		for (const reference of module.unresolvedReferences) {
			const replacement = nextByState.get(reference.name);
			if (!replacement) continue;
			reference.node.name = replacement;
			const parent = module.parentOf(reference.node as any) as any;
			if (parent?.type === 'Property' && parent.shorthand) parent.shorthand = false;
		}
	});
	const deepPlans = deepWritePlans(fn, { ...event, handlers: [handler] }, context);
	const removedDeclarations = new Set<t.Statement>();
	const removedAssignments = new Set<t.Statement>();
	for (const plan of deepPlans.values()) {
		removedDeclarations.add(plan.aliasDeclaration);
		const copyDeclaration = fn.body.body.find(
			(statement: any) =>
				t.isVariableDeclaration(statement) &&
				statement.declarations.some(
					(declaration: any) =>
						t.isIdentifier(declaration.id, { name: plan.receiver }) &&
						t.isCallExpression(declaration.init) &&
						t.isMemberExpression(declaration.init.callee) &&
						t.isIdentifier(declaration.init.callee.property, { name: 'slice' }),
				),
		);
		if (copyDeclaration) removedDeclarations.add(copyDeclaration);
		const redundantRoot = fn.body.body.find(
			(statement: any) =>
				t.isExpressionStatement(statement) &&
				t.isAssignmentExpression(statement.expression) &&
				t.isIdentifier(statement.expression.left, { name: nextFor(context, plan.state) }),
		);
		if (redundantRoot) removedAssignments.add(redundantRoot);
	}

	const syncStatement = (state: StateBinding): t.ExpressionStatement =>
		state.storage === 'ref'
			? t.expressionStatement(
					t.assignmentExpression(
						'=',
						member(t.identifier(state.name), 'current'),
						t.identifier(nextFor(context, state)),
					),
				)
			: t.expressionStatement(
					t.callExpression(t.identifier(setterFor(context, state)), [
						t.identifier(nextFor(context, state)),
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
				t.variableDeclarator(t.identifier(nextFor(context, state)), initial),
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
			const mapped = t.callExpression(
				member(t.identifier(nextFor(context, plan.state)), 'map'),
				[
					t.arrowFunctionExpression(
						[t.identifier(item.name)],
						t.conditionalExpression(
							t.cloneNode(plan.predicate.body, true) as t.Expression,
							updatedItem,
							t.identifier(item.name),
						),
					),
				],
			);
			body.push(
				t.expressionStatement(
					t.assignmentExpression('=', t.identifier(nextFor(context, plan.state)), mapped),
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
					(candidate) => nextFor(context, candidate) === target.name,
				);
				if (state) body.push(syncStatement(state));
			}
		}
	}
	fn.body.body = body;
	return fn;
}

function replaceVersionReads(node: t.Node, versions: ReadonlyMap<string, string>): void {
	replaceFreeNames(node, versions);
}

function toConstSsa(
	fn: t.ArrowFunctionExpression,
	writable: readonly StateBinding[],
	context: EmitContext,
): t.ArrowFunctionExpression {
	if (!t.isBlockStatement(fn.body)) return fn;
	const nextToState = new Map(writable.map((state) => [nextFor(context, state), state]));
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
					const current = context.currentNames.get(state.id);
					if (!current)
						throw new Error(
							`StateBinding ${state.id} has no generated snapshot identifier`,
						);
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
			const version =
				count === 1 ? variable : context.names.claim(`${variable}${count}`);
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
			const version =
				count === 1 ? variable : context.names.claim(`${variable}${count}`);
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

		const syncVariable = syncVariableName(statement, writable, context);
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
		const variable = syncVariableName(output[index]!, writable, context);
		if (variable) finalSync.set(variable, index);
	}
	fn.body.body = output.filter((statement, index) => {
		const variable = syncVariableName(statement, writable, context);
		return !variable || finalSync.get(variable) === index;
	});
	collapseRefSyncVersions(fn, writable);
	removeDeadPureVersions(fn);
	normalizeSoleVersionNames(fn, writable, context);
	return fn;
}

function collapseRefSyncVersions(
	fn: t.ArrowFunctionExpression,
	writable: readonly StateBinding[],
): void {
	if (!t.isBlockStatement(fn.body)) return;
	for (const state of writable.filter((candidate) => candidate.storage === 'ref')) {
		const sync = fn.body.body.find(
			(statement: any): statement is t.ExpressionStatement =>
				t.isExpressionStatement(statement) &&
				t.isAssignmentExpression(statement.expression, { operator: '=' }) &&
				t.isMemberExpression(statement.expression.left) &&
				t.isIdentifier(statement.expression.left.object, { name: state.name }) &&
				t.isIdentifier(statement.expression.left.property, { name: 'current' }) &&
				t.isIdentifier(statement.expression.right),
		);
		if (
			!sync ||
			!t.isAssignmentExpression(sync.expression) ||
			!t.isIdentifier(sync.expression.right)
		) {
			continue;
		}
		const version = sync.expression.right.name;
		const declaration = fn.body.body.find(
			(statement: any): statement is t.VariableDeclaration =>
				t.isVariableDeclaration(statement, { kind: 'const' }) &&
				statement.declarations.length === 1 &&
				t.isIdentifier(statement.declarations[0]!.id, { name: version }),
		);
		const initializer = declaration?.declarations[0]!.init;
		if (!declaration || !initializer || !t.isExpression(initializer)) continue;
		sync.expression.right = t.cloneNode(initializer, true);
		fn.body.body = fn.body.body.filter((statement: any) => statement !== declaration);
	}
}

function normalizeSoleVersionNames(
	fn: t.ArrowFunctionExpression,
	writable: readonly StateBinding[],
	context: EmitContext,
): void {
	reanalyzeFunction(fn, (module, analyzed) => {
		for (const state of writable.filter((candidate) => candidate.storage === 'state')) {
			const base = nextFor(context, state);
			if (module.resolve(base, module.scopeOf(analyzed as any))) continue;
			const versions = module.symbols.filter(
				(symbol) =>
					new RegExp(`^${base}\\d+$`).test(symbol.name) &&
					symbol.declarations.some((declaration) => {
						let parent: any = declaration;
						while (parent && parent !== analyzed) parent = module.parentOf(parent);
						return parent === analyzed;
					}),
			);
			if (versions.length !== 1) continue;
			for (const declaration of versions[0]!.declarations) {
				if (t.isIdentifier(declaration)) (declaration as any).name = base;
			}
			for (const reference of versions[0]!.references) reference.node.name = base;
		}
	});
}

function syncVariableName(
	statement: t.Statement,
	writable: readonly StateBinding[],
	context: EmitContext,
): string | null {
	if (!t.isExpressionStatement(statement)) return null;
	const value = statement.expression;
	if (t.isCallExpression(value) && t.isIdentifier(value.callee)) {
		const calleeName = value.callee.name;
		const state = writable.find((candidate) => setterFor(context, candidate) === calleeName);
		return state ? nextFor(context, state) : null;
	}
	if (
		t.isAssignmentExpression(value, { operator: '=' }) &&
		t.isMemberExpression(value.left) &&
		t.isIdentifier(value.left.object) &&
		t.isIdentifier(value.left.property, { name: 'current' })
	) {
		const object = value.left.object as t.Identifier;
		const state = writable.find((candidate) => candidate.name === object.name);
		return state ? nextFor(context, state) : null;
	}
	return null;
}

function removeDeadPureVersions(fn: t.ArrowFunctionExpression): void {
	const pure = (node: any): boolean => {
		if (!node || typeof node !== 'object') return true;
		if (
			[
				'CallExpression',
				'NewExpression',
				'AssignmentExpression',
				'UpdateExpression',
				'AwaitExpression',
				'YieldExpression',
			].includes(node.type)
		)
			return false;
		return Object.entries(node).every(
			([key, value]) =>
				['start', 'end', 'loc', 'comments'].includes(key) ||
				(Array.isArray(value) ? value.every(pure) : pure(value)),
		);
	};
	let changed = true;
	while (changed) {
		changed = false;
		reanalyzeFunction(fn, (module, analyzed) => {
			module.walk(
				{
					VariableDeclaration(node: any, context: any) {
						if (changed || node.declarations.length !== 1) return;
						const declaration = node.declarations[0];
						if (
							!t.isIdentifier(declaration.id) ||
							!/^next[A-Z]/.test(declaration.id.name)
						)
							return;
						const symbol = module.symbolOf(declaration.id);
						if (!symbol || symbol.references.length || !pure(declaration.init)) return;
						context.remove();
						changed = true;
					},
				},
				analyzed as any,
			);
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
	const fn = toConstSsa(
		emitMutableHandler(handler, event, context),
		writable,
		context,
	);
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
				? (
						event.syncPolicy as {
							branches: ReadonlyArray<{ actions: readonly string[] }>;
						}
					).branches.flatMap((branch) => branch.actions)
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
			value = t.assignmentPattern(
				t.identifier(entry.localName),
				expression(entry.defaultValue),
			);
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
			emitOnceGuard(pendingInitializers.splice(0), body, usedHooks, context);
			if (mapped.storage === 'ref') {
				usedHooks.add('useRef');
				body.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.identifier(state.name),
							t.callExpression(t.identifier(hookName(context, 'useRef')), [initializer]),
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
								t.identifier(setterFor(context, mapped)),
							]),
							t.callExpression(t.identifier(hookName(context, 'useState')), [
								useStateInitializer(initializer),
							]),
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
		const pattern = structuredClone(local.pattern) as t.Node;
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
					t.callExpression(t.identifier(hookName(context, 'useState')), [
						t.arrowFunctionExpression([], initializer),
					]),
				),
			]),
		);
	}
	if (pendingInitializers.length) {
		throw new Error(
			'A side-effectful once-local could not be folded into a following state initializer',
		);
	}

	for (const guard of component.guards) {
		let result: t.Expression;
		if (guard.whenTrue.kind === 'null') result = t.nullLiteral();
		else if (guard.whenTrue.kind === 'expression')
			result = expression(guard.whenTrue.value.expression);
		else result = expressionFromChildren(guard.whenTrue.children, context);
		body.push(t.ifStatement(expression(guard.test.expression), t.returnStatement(result)));
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

/** Emit one automatic-runtime .jsx module from frameless-enriched-ir/2. */
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
	const allocator = new NameAllocator(collectAuthoredNames(ir));
	const hookNames = new Map<'useRef' | 'useState', string>([
		['useRef', allocator.claim('useRef')],
		['useState', allocator.claim('useState')],
	]);
	const setterNames = new Map<string, string>();
	const nextNames = new Map<string, string>();
	for (const state of statesById.values()) {
		setterNames.set(state.id, allocator.claim(setterName(state.name)));
		nextNames.set(state.id, allocator.claim(nextName(state.name)));
	}
	const setupRefName = allocator.claim('setupDone');
	const currentNames = new Map<string, string>();
	[...statesById.values()].forEach((state, index) => {
		const base = `currentState${index + 1}`;
		currentNames.set(state.id, allocator.claim(base, '_'));
	});
	const context: EmitContext = {
		statesById,
		events: new Map(ir.records.events.map((event) => [event.id, event])),
		currentNames,
		hookNames,
		nextNames,
		setterNames,
		setupRefName,
		names: allocator,
	};
	const hooks = new Set<string>();
	const exported = componentFunction(ir, component, context, hooks);
	const imports = t.importDeclaration(
		[...hooks]
			.sort()
			.map((hook) =>
				t.importSpecifier(
					t.identifier(hookName(context, hook as 'useRef' | 'useState')),
					t.identifier(hook),
				),
			),
		t.stringLiteral('react'),
	);
	imports.comments = [
		{
			type: 'Line',
			position: 'before',
			sameLine: false,
			value: ' @generated by @frameless/react; do not edit.',
		},
	];
	const program = t.program([imports, exported]);
	const expectedNames = declaredNames(program);
	const source = `${printProgram(program)}\n`;
	const verified = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	if (verified.diagnostics.length) {
		throw new Error(
			`Emitted React module failed collision verification: ${verified.diagnostics.map((item) => item.message).join('; ')}`,
		);
	}
	const actualNames = verified.symbols
		.flatMap((symbol) => symbol.declarations.map(() => symbol.name))
		.sort();
	if (expectedNames.join('\0') !== actualNames.join('\0')) {
		throw new Error('Emitted React module failed identifier-mapping verification');
	}
	for (const reference of verified.references) {
		if (
			reference.symbol &&
			verified.resolve(reference.name, reference.scope, reference.space) !== reference.symbol
		) {
			throw new Error(`Emitted React module failed scope verification for ${reference.name}`);
		}
	}
	const reactImports = new Map(
		verified.imports
			.filter((entry) => entry.specifier === 'react' && entry.name && entry.local)
			.map((entry) => [entry.name!, entry.local!]),
	);
	for (const hook of hooks) {
		const localName = hookName(context, hook as 'useRef' | 'useState');
		const imported = reactImports.get(hook);
		if (!imported || imported.name !== localName) {
			throw new Error(`Emitted React module failed import identity verification for ${hook}`);
		}
		let calls = 0;
		verified.walk({
			CallExpression(node: any) {
				if (!t.isIdentifier(node.callee, { name: localName })) return;
				calls += 1;
				if (verified.symbolOf(node.callee) !== imported) {
					throw new Error(
						`Emitted React module failed hook identity verification for ${hook}`,
					);
				}
			},
		});
		if (calls === 0)
			throw new Error(`Emitted React module failed hook use verification for ${hook}`);
	}
	for (const state of statesById.values()) {
		if (state.storage !== 'state') continue;
		const name = setterFor(context, state);
		let setterSymbol: ReturnType<typeof verified.symbolOf> = null;
		verified.walk({
			VariableDeclarator(node: any) {
				const setter = node.id?.type === 'ArrayPattern' ? node.id.elements[1] : null;
				if (t.isIdentifier(setter, { name })) setterSymbol = verified.symbolOf(setter);
			},
		});
		if (!setterSymbol)
			throw new Error(`Emitted React module failed setter declaration verification for ${name}`);
		for (const reference of verified.references) {
			if (reference.name === name && reference.symbol !== setterSymbol) {
				throw new Error(`Emitted React module failed setter identity verification for ${name}`);
			}
		}
	}
	return source;
}
