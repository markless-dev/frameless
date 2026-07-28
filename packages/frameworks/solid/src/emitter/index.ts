import { analyze } from 'yuku-analyzer';
import { generate } from 'yuku-codegen';
import {
	ENRICHED_IR_VERSION,
	FRAMELESS_STATE_GLOBAL,
	type EnrichedComponent,
	type EnrichedEventRecord,
	type EnrichedGraphBinding,
	type EnrichedIR,
	type EventHandlerRecord,
	type FramelessPersistenceRecord,
	type SerializableAstNode,
	type SharedDefinition,
	type TemplateNode,
} from '@frameless/compiler';
import * as t from './estree.ts';

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
	| 'Show'
	| 'createContext'
	| 'useContext'
	| 'createEffect'
	| 'onMount'
	| 'onCleanup';
type EmitContext = {
	readonly api: ReadonlyMap<ApiName, string>;
	readonly bindingsById: ReadonlyMap<string, EnrichedGraphBinding>;
	readonly computedByName: ReadonlyMap<string, EnrichedGraphBinding>;
	readonly events: ReadonlyMap<string, EnrichedEventRecord>;
	readonly imports: Set<ApiName>;
	readonly lexicalNames: ReadonlySet<string>;
	readonly names: NameAllocator;
	readonly persistenceByGraph: ReadonlyMap<string, FramelessPersistenceRecord>;
	readonly persistenceWrites: { emitted: boolean };
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
	const converted = node ? structuredClone(node) : null;
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

function containsElement(node: TemplateNode): boolean {
	if (node.kind === 'host') return true;
	if (node.kind === 'fragment') return node.children.some(containsElement);
	if (node.kind === 'branch') return node.arms.some((arm) => arm.children.some(containsElement));
	if (node.kind === 'keyed-repeat') return node.row.some(containsElement);
	return false;
}

function memberPath(node: t.Node): { root: t.Identifier; path: string[] } | null {
	const path: string[] = [];
	let current = node;
	while (t.isMemberExpression(current) && !current.computed && t.isIdentifier(current.property)) {
		path.unshift(current.property.name);
		current = current.object;
	}
	return t.isIdentifier(current) ? { root: current, path } : null;
}

function equivalent(left: unknown, right: unknown): boolean {
	const ignored = new Set([
		'start',
		'end',
		'loc',
		'raw',
		'comments',
		'leadingComments',
		'trailingComments',
	]);
	const normalize = (value: any): any => {
		if (Array.isArray(value)) return value.map(normalize);
		if (!value || typeof value !== 'object') return value;
		return Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => !ignored.has(key))
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, normalize(child)]),
		);
	};
	return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function printProgram(program: any): string {
	const result = generate(program, { comments: true, quotes: 'single' });
	if (result.errors.length)
		throw new Error(
			`yuku-codegen failed: ${result.errors.map((error) => error.message).join('; ')}`,
		);
	return result.code;
}

function printTopLevel(program: any): string {
	const imports = program.body.filter((statement: any) => statement.type === 'ImportDeclaration');
	const declarations = program.body.filter(
		(statement: any) => statement.type !== 'ImportDeclaration',
	);
	return [
		...(imports.length ? [printProgram(t.program(imports))] : []),
		...declarations.map((declaration: any) => printProgram(t.program([declaration]))),
	].join('\n\n');
}

function reanalyzeExpression(
	value: t.Expression,
	transform: (module: ReturnType<typeof analyze>, expression: t.Expression) => void,
): t.Expression {
	const source = printProgram(
		t.program([
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier('__framelessExpression'),
					t.cloneNode(value, true),
				),
			]),
		]),
	);
	const module = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	if (module.diagnostics.length)
		throw new Error(
			`yuku-analyzer rejected emitted expression: ${module.diagnostics.map((item) => item.message).join('; ')}`,
		);
	const declaration = module.ast.body[0] as any;
	const analyzed = declaration.declarations[0].init as t.Expression;
	transform(module, analyzed);
	return declaration.declarations[0].init as t.Expression;
}

function readKey(graphNodeId: string, path: readonly string[]): string {
	return `${graphNodeId}\u0000${path.join('\u0000')}`;
}

/**
 * The graph location a repeat item ranges over. A top-level repeat resolves to a
 * state node with an EMPTY path; a nested repeat sourced from its enclosing row
 * (`@for (const row of group.rows)`) resolves to the SAME state node under a
 * path - `state:groups` + `['rows']`. Carrying only the graphNodeId, as this
 * emitter used to, made the second case inexpressible. T033.
 */
type RepeatItemSource = { readonly graphNodeId: string; readonly path: readonly string[] };

function reconcileReadSemantics(
	ast: t.Expression,
	reads: readonly { readonly graphNodeId: string; readonly path: readonly string[] }[],
	construct: string,
	bindings: readonly EnrichedGraphBinding[],
	props: EnrichedComponent['props'],
	locals: EnrichedComponent['locals'],
	repeatItems: ReadonlyMap<string, RepeatItemSource> = new Map(),
): void {
	const bindingsByName = new Map(bindings.map((binding) => [binding.name, binding]));
	const propsByLocal = new Map(props.entries.map((entry) => [entry.localName, entry]));
	const localsByName = new Map(
		locals.flatMap((local) => local.names.map((name) => [name, local] as const)),
	);
	const recordedReads = new Map(
		reads.map((read) => [readKey(read.graphNodeId, read.path), read]),
	);
	const astReads = new Set<string>();
	reanalyzeExpression(ast, (module) => {
		for (const reference of module.unresolvedReferences) {
			const path = reference.node as any;
			let current = path;
			let parent = module.parentOf(current) as any;
			while (parent?.type === 'MemberExpression' && parent.object === current) {
				current = parent;
				parent = module.parentOf(current) as any;
			}
			if (parent?.type === 'AssignmentExpression' && parent.left === current) continue;
			const chain = memberPath(current);
			if (!chain) return;
			let suffix = chain.path;
			if (parent?.type === 'CallExpression' && parent.callee === current && suffix.length)
				suffix = suffix.slice(0, -1);

			const candidates: Array<{ graphNodeId: string; path: readonly string[] }> = [];
			const prop = propsByLocal.get(path.name);
			if (prop)
				candidates.push({
					graphNodeId: prop.graphNodeId,
					path: [...prop.path, ...suffix],
				});
			const binding = bindingsByName.get(path.name);
			if (binding) candidates.push({ graphNodeId: binding.id, path: suffix });
			const repeatItem = repeatItems.get(path.name);
			if (repeatItem)
				candidates.push({
					graphNodeId: repeatItem.graphNodeId,
					path: [...repeatItem.path, ...suffix],
				});
			if (!prop && !binding && !repeatItem) {
				const local = localsByName.get(path.name);
				for (const read of local?.reads ?? [])
					candidates.push({
						graphNodeId: read.graphNodeId,
						path: [...read.path, ...suffix],
					});
			}

			for (const candidate of candidates) {
				const key = readKey(candidate.graphNodeId, candidate.path);
				astReads.add(key);
				if (!recordedReads.has(key))
					throw new Error(
						`${construct} AST read absent from records: ${candidate.graphNodeId}/${candidate.path.join('/')}`,
					);
			}
		}
	});
	for (const [key, read] of recordedReads)
		if (!astReads.has(key))
			throw new Error(
				`${construct} read record absent from AST: ${read.graphNodeId}/${read.path.join('/')}`,
			);
}

function reconcileHandlerWrites(
	fn: t.ArrowFunctionExpression,
	handler: EventHandlerRecord,
	eventId: string,
	bindings: readonly EnrichedGraphBinding[],
): void {
	const bindingsByName = new Map(bindings.map((binding) => [binding.name, binding]));
	type Mutation = {
		readonly node: t.AssignmentExpression | t.UpdateExpression;
		readonly root: string;
		readonly path: readonly string[];
		readonly locallyBound: boolean;
	};
	const mutations: Mutation[] = [];
	reanalyzeExpression(fn, (module, analyzed) => {
		module.walk(
			{
				AssignmentExpression(node: any) {
					const target = memberPath(node.left);
					if (target)
						mutations.push({
							node,
							root: target.root.name,
							path: target.path,
							locallyBound: Boolean(module.symbolOf(target.root)),
						});
				},
				UpdateExpression(node: any) {
					const target = memberPath(node.argument);
					if (target)
						mutations.push({
							node,
							root: target.root.name,
							path: target.path,
							locallyBound: Boolean(module.symbolOf(target.root)),
						});
				},
			},
			analyzed,
		);
	});

	const matched = new Set<Mutation>();
	const aliasRoots = new Set<string>();
	for (const write of handler.writes) {
		const binding = bindings.find((entry) => entry.id === write.graphNodeId)!;
		const expectedPath = write.via === 'handler-local-alias' ? write.path.slice(1) : write.path;
		const mutation = mutations.find((candidate) => {
			if (matched.has(candidate) || candidate.path.join('/') !== expectedPath.join('/'))
				return false;
			if (
				write.via === 'direct' &&
				(candidate.locallyBound || candidate.root !== binding.name)
			)
				return false;
			if (write.via === 'handler-local-alias' && !candidate.locallyBound) return false;
			if (write.operation === 'assign')
				return (
					t.isAssignmentExpression(candidate.node, {
						operator: write.assignmentOperator,
					}) &&
					Boolean(write.value) &&
					equivalent(candidate.node.right, expression(write.value))
				);
			return (
				t.isUpdateExpression(candidate.node, { operator: write.updateOperator }) &&
				candidate.node.prefix === write.prefix
			);
		});
		if (!mutation)
			throw new Error(
				`EventHandlerRecord ${eventId} has write record absent from handler AST: ${write.graphNodeId}/${write.path.join('/')}`,
			);
		matched.add(mutation);
		if (write.via === 'handler-local-alias') aliasRoots.add(mutation.root);
	}
	for (const mutation of mutations) {
		if (matched.has(mutation)) continue;
		const binding = bindingsByName.get(mutation.root);
		if ((!mutation.locallyBound && binding) || aliasRoots.has(mutation.root))
			throw new Error(
				`EventHandlerRecord ${eventId} has handler AST write absent from records: ${binding?.id ?? mutation.root}/${mutation.path.join('/')}`,
			);
	}
}

/**
 * Accept the FULL declared condition grammar, exactly as React does.
 *
 * Until T012 this validator threw `SyncPolicy <id> has unsupported sync shape`
 * for every policy that was not `{when: constant-truthy true, actions:
 * ['preventDefault']}`. That made the three-way contract unauthorable for the
 * conditional case: `if (event.key === 'Enter') event.preventDefault()` compiled
 * on React and hard-failed on Solid.
 *
 * There is nothing for Solid to refuse here. Its handlers are synchronous and
 * resident, so the declared actions are already performed in the authored body
 * at the authored moment; the policy is a CROSS-CHECK, not a lowering
 * instruction. That is the same position React is in - and it is why widening
 * this was only ever half the work, the other half being `normalizeHandler`.
 */
function validateSyncPolicy(
	eventId: string,
	policy: RecordLike,
	bindingIds: ReadonlySet<string>,
): void {
	const validateCondition = (condition: RecordLike): void => {
		const type = condition?.type;
		if (type === 'and' || type === 'or') {
			exactKeys(condition, ['type', 'conditions'], `SyncPolicyCondition ${eventId}`);
			if (!Array.isArray(condition.conditions) || condition.conditions.length === 0)
				throw new Error(`SyncPolicy ${eventId} has unsupported sync shape`);
			condition.conditions.forEach(validateCondition);
		} else if (type === 'not') {
			exactKeys(condition, ['type', 'condition'], `SyncPolicyCondition ${eventId}`);
			if (!condition.condition || typeof condition.condition !== 'object')
				throw new Error(`SyncPolicy ${eventId} has unsupported sync shape`);
			validateCondition(condition.condition);
		} else if (type === 'graph-truthy') {
			exactKeys(
				condition,
				['type', 'graphNodeId', 'path'],
				`SyncPolicyCondition ${eventId}`,
			);
			if (typeof condition.graphNodeId !== 'string' || !bindingIds.has(condition.graphNodeId))
				throw new Error(
					`SyncPolicyCondition ${eventId} has dangling graph record id: ${String(condition.graphNodeId)}`,
				);
			if (
				!Array.isArray(condition.path) ||
				condition.path.some((part: unknown) => typeof part !== 'string')
			)
				throw new Error(`SyncPolicyCondition ${eventId} has malformed path`);
		} else if (type === 'constant-truthy')
			exactKeys(condition, ['type', 'value'], `SyncPolicyCondition ${eventId}`);
		else if (type === 'event-equals')
			exactKeys(condition, ['type', 'field', 'value'], `SyncPolicyCondition ${eventId}`);
		else throw new Error(`SyncPolicy ${eventId} has unsupported sync shape`);
	};
	exactKeys(
		policy,
		'branches' in policy ? ['branches'] : ['when', 'actions'],
		`SyncPolicy ${eventId}`,
	);
	const branches = 'branches' in policy ? policy.branches : [policy];
	if (!Array.isArray(branches) || branches.length === 0)
		throw new Error(`SyncPolicy ${eventId} has unsupported sync shape`);
	for (const branch of branches as RecordLike[]) {
		exactKeys(branch, ['when', 'actions'], `SyncPolicyBranch ${eventId}`);
		if (
			!Array.isArray(branch.actions) ||
			branch.actions.some(
				(action: unknown) =>
					!['preventDefault', 'stopPropagation'].includes(String(action)),
			) ||
			!branch.when ||
			typeof branch.when !== 'object'
		)
			throw new Error(`SyncPolicy ${eventId} has unsupported sync shape`);
		validateCondition(branch.when);
	}
}

/** Fail closed before any target AST is constructed. */
export function validateEnrichedIr(ir: EnrichedIR): void {
	if (hasComposition(ir)) {
		validateCompositionIr(ir);
		validatePersistenceCorrelation(ir);
		return;
	}
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
	if (!Array.isArray(ir.components))
		throw new Error('Fixture-family Solid emitter requires exactly one component');
	if (ir.components.length > 1)
		throw new Error(
			'EnrichedComponent cannot be lowered: multi-component modules land in the Solid composition package',
		);
	if (ir.components.length !== 1)
		throw new Error('Fixture-family Solid emitter requires exactly one component');
	if (ir.imports.length !== 0)
		throw new Error(
			'Fixture-family Solid emitter has no disclosed author-module import mapping',
		);
	const component: EnrichedComponent = ir.components[0]!;
	exactKeys(
		component,
		['id', 'name', 'evaluation', 'props', 'locals', 'guards', 'template'],
		'EnrichedComponent',
	);
	if (typeof component.id !== 'string' || component.id.length === 0)
		throw new Error('EnrichedComponent has malformed id');
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
		[
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
			'handleForwards',
			'behaviors',
			'handleCalls',
			'persistence',
		],
		'EnrichedRecordTable',
	);
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
		['handleForwards', ir.records.handleForwards],
		['behaviors', ir.records.behaviors],
		['handleCalls', ir.records.handleCalls],
		['persistence', ir.records.persistence],
	] as const)
		if (!Array.isArray(records))
			throw new Error(`EnrichedRecordTable ${family} has malformed record family`);
	if (
		ir.records.persistence.some(
			(record) => !record || typeof record !== 'object' || Array.isArray(record),
		)
	)
		throw new Error('EnrichedRecordTable persistence has malformed record family');
	validatePersistenceCorrelation(ir);
	for (const imported of ir.imports) {
		exactKeys(
			imported,
			['localName', 'source', 'kind', 'importedName', 'resolvesTo'],
			'ModuleImport',
		);
		if (
			typeof imported.localName !== 'string' ||
			typeof imported.source !== 'string' ||
			!['default', 'named', 'namespace'].includes(imported.kind) ||
			(imported.importedName !== undefined && typeof imported.importedName !== 'string') ||
			(imported.resolvesTo !== undefined && imported.resolvesTo !== 'tsrx-module')
		)
			throw new Error('ModuleImport has malformed construct');
	}
	const bindingIds = new Set(ir.records.bindings.map((binding) => binding.id));
	const componentIds = new Set(ir.components.map((entry) => entry.id));
	const validateComponentId = (construct: string, componentId: unknown): void => {
		if (typeof componentId !== 'string' || !componentIds.has(componentId))
			throw new Error(`${construct} has unknown component id: ${String(componentId)}`);
	};
	const eventIds = new Set(ir.records.events.map((event) => event.id));
	if (bindingIds.size !== ir.records.bindings.length)
		throw new Error('EnrichedRecordTable has duplicate binding record ids');
	if (eventIds.size !== ir.records.events.length)
		throw new Error('EnrichedRecordTable has duplicate event record ids');
	if (!bindingIds.has(component.props.graphNodeId))
		throw new Error(
			`ComponentProps has dangling graph record id: ${component.props.graphNodeId}`,
		);

	const validateRead = (
		read: RecordLike,
		construct: string,
		via: boolean,
		behaviorInput = false,
	): void => {
		exactKeys(
			read,
			via
				? ['graphNodeId', 'path', 'via', ...(behaviorInput ? ['provenance'] : [])]
				: ['componentId', 'graphNodeId', 'path'],
			construct,
		);
		if (!via) validateComponentId(construct, read.componentId);
		if (typeof read.graphNodeId !== 'string' || !bindingIds.has(read.graphNodeId))
			throw new Error(
				`${construct} has dangling graph record id: ${String(read.graphNodeId)}`,
			);
		validatePath(read.path, construct);
		if (via && !['direct', 'alias', 'local', 'repeat-item'].includes(read.via))
			throw new Error(`${construct} has unsupported read shape`);
		if (behaviorInput && !['layer-a', 'derived-from-ast'].includes(read.provenance))
			throw new Error(`${construct} has unsupported provenance`);
	};
	const validateAst = (construct: string, value: unknown): void => {
		if (
			!value ||
			typeof value !== 'object' ||
			typeof (value as { type?: unknown }).type !== 'string'
		)
			throw new Error(`${construct} has malformed AST`);
	};
	const stringPath = (value: unknown): boolean =>
		Array.isArray(value) && value.every((part) => typeof part === 'string');
	const validateStructuralSite = (construct: string, site: RecordLike): void => {
		exactKeys(site, ['expression', 'reads'], construct);
		validateAst(`${construct} expression`, site.expression);
		assertArray(site.reads, `${construct} reads`);
		for (const read of site.reads)
			validateRead(read as RecordLike, `${construct} GraphReadRef`, true);
	};
	const validateSite = (
		site: RecordLike,
		construct: string,
		readConstruct: string,
		repeatItems?: ReadonlyMap<string, RepeatItemSource>,
	): void => {
		exactKeys(site, ['expression', 'reads'], construct);
		if (!site.expression || typeof site.expression.type !== 'string')
			throw new Error(`${construct} has malformed expression AST`);
		const ast = expression(site.expression);
		assertArray(site.reads, `${construct} reads`);
		site.reads.forEach((read: RecordLike) =>
			validateRead(read, `${construct} GraphReadRef`, true),
		);
		reconcileReadSemantics(
			ast,
			site.reads,
			readConstruct,
			ir.records.bindings,
			component.props,
			component.locals,
			repeatItems,
		);
	};

	for (const entry of component.props.entries) {
		// IR-8's `type` is ADMITTED AND SHAPE-CHECKED, DELIBERATELY NOT PRINTED YET.
		// This emitter is one of exactly TWO that reject an unknown nested key on
		// this construct - qwik, svelte, vue and angular accept it silently - so
		// admitting it here is what lets the field exist at all. Printing it is a
		// later step and is blocked on the .jsx -> .tsx migration: TS8010 forbids a
		// type annotation in a .jsx file, which is what this emitter still writes.
		exactKeys(
			entry,
			['sourceName', 'localName', 'path', 'alias', 'graphNodeId', 'defaultValue', 'type'],
			'PropDestructuringEntry',
		);
		if (entry.defaultValue !== undefined) expression(entry.defaultValue);
		if (
			entry.type !== undefined &&
			(typeof entry.type !== 'object' ||
				entry.type === null ||
				typeof entry.type.type !== 'string')
		)
			throw new Error(
				`PropDestructuringEntry has malformed type annotation AST: ${entry.localName}`,
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
			],
			construct,
		);
		validateComponentId(construct, write.componentId);
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
		if (local.initializer)
			reconcileReadSemantics(
				expression(local.initializer),
				local.reads,
				`LocalDeclaration ${local.names[0]} has local initializer`,
				ir.records.bindings,
				component.props,
				component.locals,
			);
	}
	for (const binding of ir.records.bindings) {
		exactKeys(
			binding,
			[
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
			],
			'EnrichedGraphBinding',
		);
		validateComponentId(`EnrichedGraphBinding ${binding.id}`, binding.componentId);
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
			reconcileReadSemantics(
				expression(binding.initializer),
				binding.reads,
				`State binding ${binding.id} has state initializer`,
				ir.records.bindings,
				component.props,
				component.locals,
			);
		}
		if (binding.kind === 'computed') {
			if (!binding.computed)
				throw new Error(`Computed binding ${binding.id} is missing its expression site`);
			validateSite(
				binding.computed as RecordLike,
				`Computed binding ${binding.id}`,
				`Computed binding ${binding.id} has computed binding`,
			);
			const fn = expression(binding.computed.expression);
			if (!t.isArrowFunctionExpression(fn) || fn.async || fn.params.length !== 0)
				throw new Error(
					`Computed binding ${binding.id} must be a synchronous zero-argument arrow`,
				);
			reconcileReadSemantics(
				fn,
				binding.reads,
				`Computed binding ${binding.id} has binding read records`,
				ir.records.bindings,
				component.props,
				component.locals,
			);
		}
	}
	for (const alias of ir.records.aliases) {
		exactKeys(
			alias,
			[
				'componentId',
				'id',
				'name',
				'target',
				'graphNodeId',
				'path',
				'declarationKind',
				'sourceSpan',
			],
			'EnrichedAliasRecord',
		);
		validateComponentId(`EnrichedAliasRecord ${alias.id}`, alias.componentId);
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
	// Keyed by graphNodeId: this answers "which field identifies a row of this
	// array state", which the handler identity-mutation guard and the array-state
	// coverage check both ask. Nested repeats live UNDER a path of the same state
	// node, so they are keyed separately in `keyByCollection` below.
	const keyByState = new Map<string, string>();
	// Keyed by the full collection LOCATION (graphNodeId + path). `state:groups`
	// and `state:groups/rows` are different collections and may legitimately be
	// keyed by different fields; conflating them was the single-state-node
	// assumption T033 lifted.
	const keyByCollection = new Map<string, string>();
	const repeatItemsByEventId = new Map<string, ReadonlyMap<string, RepeatItemSource>>();
	const validateTemplate = (
		node: TemplateNode,
		location: string,
		repeatItems: ReadonlyMap<string, RepeatItemSource> = new Map(),
	): void => {
		if (!node || typeof node !== 'object')
			throw new Error(
				`TemplateNode has malformed construct at ${location}: ${String((node as any)?.kind)}`,
			);
		if (node.kind === 'component-reference') {
			exactKeys(
				node,
				['kind', 'id', 'edgeId', 'target', 'props', 'children'],
				'TemplateComponentReference',
			);
			if (
				typeof node.id !== 'string' ||
				typeof node.edgeId !== 'string' ||
				!node.target ||
				typeof node.target !== 'object' ||
				!Array.isArray(node.props) ||
				!Array.isArray(node.children)
			)
				throw new Error('TemplateComponentReference has malformed construct');
			exactKeys(
				node.target,
				node.target.module === 'self'
					? ['localName', 'module']
					: ['localName', 'module', 'exportedName'],
				'TemplateComponentReference target',
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
				exactKeys(
					prop,
					['name', 'kind', 'value', 'graphNodeId', 'path'],
					'ComponentPropExpression',
				);
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
				validateStructuralSite('ComponentPropExpression value', prop.value as RecordLike);
			}
			throw new Error(
				'TemplateComponentReference cannot be lowered: composition constructs land in the Solid composition package',
			);
		}
		if (node.kind === 'default-slot-projection') {
			exactKeys(node, ['kind', 'id', 'site'], 'TemplateDefaultSlotProjection');
			if (typeof node.id !== 'string' || !node.site || typeof node.site !== 'object')
				throw new Error('TemplateDefaultSlotProjection has malformed construct');
			validateStructuralSite('TemplateDefaultSlotProjection site', node.site as RecordLike);
			throw new Error(
				'TemplateDefaultSlotProjection cannot be lowered: composition constructs land in the Solid composition package',
			);
		}
		if (
			!['host', 'text', 'dynamic-text', 'fragment', 'branch', 'keyed-repeat'].includes(
				node.kind,
			)
		)
			throw new Error(
				`TemplateNode has malformed construct at ${location}: ${String(node.kind)}`,
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
				`TemplateDynamicText ${location} has dynamic text`,
				repeatItems,
			);
			return;
		}
		if (node.kind === 'fragment') {
			exactKeys(node, ['kind', 'id', 'children'], 'TemplateFragment');
			node.children.forEach((child, index) =>
				validateTemplate(child, `${location}.children[${index}]`, repeatItems),
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
			if (!node.tag || !t.isValidIdentifier(node.tag))
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
					`DynamicBinding ${node.id}/${binding.name} has ${binding.kind} binding`,
					repeatItems,
				);
			}
			for (const id of node.eventIds) {
				if (!eventIds.has(id))
					throw new Error(`TemplateHost ${node.id} has dangling event record id: ${id}`);
				repeatItemsByEventId.set(id, repeatItems);
			}
			node.children.forEach((child, index) =>
				validateTemplate(child, `${location}.children[${index}]`, repeatItems),
			);
			return;
		}
		if (node.kind === 'branch') {
			exactKeys(node, ['kind', 'id', 'expression', 'reads', 'arms'], 'TemplateBranch');
			validateSite(
				{ expression: node.expression, reads: node.reads },
				`TemplateBranch ${node.id}`,
				`TemplateBranch ${node.id} has branch`,
				repeatItems,
			);
			if (
				node.arms.length !== 2 ||
				node.arms[0]?.kind !== 'then' ||
				node.arms[1]?.kind !== 'else'
			)
				throw new Error(`TemplateBranch ${node.id} requires ordered then/else arms`);
			for (const [armIndex, arm] of node.arms.entries()) {
				exactKeys(arm, ['kind', 'children'], 'TemplateBranchArm');
				// PM adjudication (2026-07-20): a COMPLETELY empty arm is a sanctioned
				// authored `@else {}` shape lowering to <Show when> without a
				// fallback — a real Solid idiom, not a silent fragment. Only arms with
				// content that carries no element fail closed (the anchor-visibility
				// premise from T003 applies to non-empty arms).
				if (arm.children.length > 0 && !arm.children.some(containsElement))
					throw new Error(`TemplateBranchArm ${arm.kind} in ${node.id} is element-less`);
				arm.children.forEach((child, index) =>
					validateTemplate(
						child,
						`${location}.arms[${armIndex}].children[${index}]`,
						repeatItems,
					),
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
		validateSite(
			node.collection as RecordLike,
			`TemplateKeyedRepeat ${node.id} collection`,
			`TemplateKeyedRepeat ${node.id} has keyed-repeat collection`,
			repeatItems,
		);
		// A collection must denote EXACTLY ONE graph location. `direct` is the
		// top-level case; a lone `repeat-item` read is a nested repeat whose
		// collection is a member of its enclosing row (`group.rows`). Anything
		// else - no read at all, or several - is unresolved and fails closed.
		const [onlyRead, ...extraReads] = node.collection.reads;
		const collectionRead =
			onlyRead &&
			extraReads.length === 0 &&
			(onlyRead.via === 'direct' || onlyRead.via === 'repeat-item')
				? onlyRead
				: undefined;
		const path = itemMemberPath(node.key.expression, node.item);
		const keyRead = node.key.reads.find((read) => read.via === 'repeat-item');
		if (
			!path ||
			path.length !== 1 ||
			!keyRead ||
			!collectionRead ||
			keyRead.graphNodeId !== collectionRead.graphNodeId ||
			keyRead.path.join('/') !== [...collectionRead.path, ...path].join('/')
		)
			throw new Error(`TemplateKeyedRepeat ${node.id} has unconsumed key semantics`);
		const rowRepeatItems = new Map(repeatItems);
		rowRepeatItems.set(node.item, {
			graphNodeId: collectionRead.graphNodeId,
			path: collectionRead.path,
		});
		validateSite(
			node.key as RecordLike,
			`TemplateKeyedRepeat ${node.id} key`,
			`TemplateKeyedRepeat ${node.id} has keyed-repeat key`,
			rowRepeatItems,
		);
		const collectionKey = readKey(collectionRead.graphNodeId, collectionRead.path);
		const prior = keyByCollection.get(collectionKey);
		if (prior && prior !== path[0])
			throw new Error(`TemplateKeyedRepeat ${node.id} conflicts with key ${prior}`);
		keyByCollection.set(collectionKey, path[0]!);
		// A repeat over the state node ITSELF states that node's row identity and
		// always wins; a nested repeat only fills a gap, so an outer repeat's key
		// is never overwritten by the collection nested inside it.
		if (collectionRead.path.length === 0 || !keyByState.has(collectionRead.graphNodeId))
			keyByState.set(collectionRead.graphNodeId, path[0]!);
		node.row.forEach((child, index) =>
			validateTemplate(child, `${location}.row[${index}]`, rowRepeatItems),
		);
	};
	component.template.forEach((node, index) => validateTemplate(node, `template[${index}]`));
	for (const guard of component.guards) {
		exactKeys(guard, ['id', 'test', 'whenTrue'], 'GuardReturn');
		validateSite(
			guard.test as RecordLike,
			`GuardReturn ${guard.id} test`,
			`GuardReturn ${guard.id} has guard test`,
		);
		if (guard.whenTrue.kind === 'null')
			exactKeys(guard.whenTrue, ['kind'], `GuardResult ${guard.id}`);
		else if (guard.whenTrue.kind === 'expression') {
			exactKeys(guard.whenTrue, ['kind', 'value'], `GuardResult ${guard.id}`);
			validateSite(
				guard.whenTrue.value as RecordLike,
				`GuardResult ${guard.id} expression`,
				`GuardResult ${guard.id} has guard result`,
			);
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
			['componentId', 'id', 'hostNodeId', 'eventName', 'syncPolicy', 'handlers'],
			'EnrichedEventRecord',
		);
		validateComponentId(`EnrichedEventRecord ${event.id}`, event.componentId);
		if (!event.handlers.length)
			throw new Error(`EnrichedEventRecord ${event.id} has malformed handlers`);
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
		for (const handler of event.handlers) {
			exactKeys(handler, ['expression', 'reads', 'writes'], 'EventHandlerRecord');
			validateSite(
				{ expression: handler.expression, reads: handler.reads },
				`EventHandlerRecord ${event.id}`,
				`EventHandlerRecord ${event.id} has handler`,
				repeatItemsByEventId.get(event.id),
			);
			const fn = expression(handler.expression);
			/**
			 * ASYNC HANDLERS ARE ACCEPTED. This check used to read
			 * `|| fn.async` and threw `requires a synchronous arrow`. That
			 * clause was an ACCIDENT, not a v-limit - see docs/DEFECTS.md
			 * entry 11 and
			 * docs/goals/frameless-defects-and-targets-v1/notes/T046-solid-async.md.
			 * It arrived with the emitter's original landing commit (1309b00,
			 * "codex killed at ceiling; PM completing"), never had a test or a
			 * comment, and is this same function's computed-binding predicate -
			 * the one throwing `must be a synchronous zero-argument arrow` - with
			 * the arity clause dropped. Solid's pipeline was already async-safe:
			 * `reanalyzeExpression` wraps NOTHING, so an async arrow re-parses
			 * as valid module source, and `normalizeHandler` mutates the arrow
			 * in place so `fn.async` survives to output untouched.
			 *
			 * The arity clause is deliberately NOT reinstated here: an event
			 * handler legitimately takes an `event` parameter, which is why
			 * that computed-binding predicate (a zero-argument computed) and
			 * this site differ.
			 */
			if (!t.isArrowFunctionExpression(fn))
				throw new Error(`EventHandlerRecord ${event.id} requires an arrow function`);
			handler.writes.forEach((write) =>
				validateWrite(write as RecordLike, `EventHandlerRecord ${event.id}`),
			);
			reconcileHandlerWrites(fn, handler, event.id, ir.records.bindings);
		}
		if (event.syncPolicy) validateSyncPolicy(event.id, event.syncPolicy, bindingIds);
	}
	for (const event of ir.records.events)
		if (!hostIds.has(event.hostNodeId))
			throw new Error(
				`EnrichedEventRecord ${event.id} has dangling host record id: ${event.hostNodeId}`,
			);
	const validateSharedWrite = (write: any, construct: string): void => {
		exactKeys(
			write,
			[
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
				'sourceSpan',
				'order',
			],
			construct,
		);
		const span = write.sourceSpan;
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
			!span ||
			typeof span.filename !== 'string' ||
			typeof span.start !== 'number' ||
			typeof span.end !== 'number' ||
			typeof write.order !== 'number'
		)
			throw new Error(`${construct} has malformed construct`);
		if (write.value !== undefined) validateAst(`${construct} value`, write.value);
		write.arguments?.forEach((argument: unknown) =>
			validateAst(`${construct} argument`, argument),
		);
	};
	for (const definition of ir.records.sharedDefinitions) {
		exactKeys(
			definition,
			[
				'id',
				'name',
				'scope',
				'cells',
				'methods',
				'graphBindings',
				'returnProperties',
				'dependencies',
			],
			'SharedDefinition',
		);
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
			exactKeys(
				cell,
				cell.kind === 'state'
					? ['kind', 'name', 'graphNodeId', 'valueKind', 'initializer']
					: ['kind', 'name', 'graphNodeId', 'expression', 'dependencies'],
				'SharedDefinitionCell',
			);
			if (
				typeof cell.name !== 'string' ||
				typeof cell.graphNodeId !== 'string' ||
				(cell.kind === 'state'
					? !['scalar', 'object', 'array', 'unknown'].includes(cell.valueKind)
					: cell.kind !== 'computed' ||
						!Array.isArray(cell.dependencies) ||
						!cell.dependencies.every(
							(dependency: unknown) =>
								typeof dependency === 'string' &&
								definition.graphBindings.includes(dependency),
						))
			)
				throw new Error('SharedDefinitionCell has malformed construct');
			if (cell.kind === 'state')
				validateAst('SharedDefinitionCell initializer', cell.initializer);
			else validateAst('SharedDefinitionCell expression', cell.expression);
		}
		for (const method of definition.methods) {
			exactKeys(method, ['name', 'site', 'writes'], 'SharedDefinitionMethod');
			if (typeof method.name !== 'string' || !Array.isArray(method.writes))
				throw new Error('SharedDefinitionMethod has malformed construct');
			validateAst('SharedDefinitionMethod site', method.site);
			method.writes.forEach((write: any) =>
				validateSharedWrite(write, 'SharedDefinitionMethod write'),
			);
		}
		for (const property of definition.returnProperties) {
			exactKeys(
				property,
				property.kind === 'graph'
					? ['kind', 'name', 'graphNodeId', 'path']
					: ['kind', 'name'],
				'SharedReturnProperty',
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
			exactKeys(dependency, ['definitionId', 'definitionName'], 'SharedDependency');
			if (
				typeof dependency.definitionId !== 'string' ||
				typeof dependency.definitionName !== 'string'
			)
				throw new Error('SharedDependency has malformed construct');
		}
	}
	for (const instance of ir.records.sharedInstances) {
		exactKeys(instance, ['definitionId', 'componentId', 'localName'], 'SharedInstance');
		validateComponentId('SharedInstance', instance.componentId);
		if (typeof instance.definitionId !== 'string' || typeof instance.localName !== 'string')
			throw new Error('SharedInstance has malformed construct');
	}
	for (const read of ir.records.sharedReads) {
		exactKeys(
			read,
			['definitionId', 'propertyName', 'path', 'componentId', 'site'],
			'SharedRead',
		);
		validateComponentId('SharedRead', read.componentId);
		if (
			typeof read.definitionId !== 'string' ||
			typeof read.propertyName !== 'string' ||
			!stringPath(read.path)
		)
			throw new Error('SharedRead has malformed construct');
		validateStructuralSite('SharedRead site', read.site as RecordLike);
	}
	for (const call of ir.records.sharedCalls) {
		exactKeys(
			call,
			['definitionId', 'methodName', 'arguments', 'componentId', 'eventId', 'site', 'order'],
			'SharedCall',
		);
		validateComponentId('SharedCall', call.componentId);
		if (
			typeof call.definitionId !== 'string' ||
			typeof call.methodName !== 'string' ||
			!Array.isArray(call.arguments) ||
			(call.eventId !== undefined && typeof call.eventId !== 'string') ||
			typeof call.order !== 'number'
		)
			throw new Error('SharedCall has malformed construct');
		call.arguments.forEach((argument) => validateAst('SharedCall argument', argument));
		validateStructuralSite('SharedCall site', call.site as RecordLike);
	}
	for (const write of ir.records.sharedWrites) validateSharedWrite(write, 'SharedWrite');
	for (const binding of ir.records.elementHandleBindings) {
		exactKeys(
			binding,
			['id', 'handleName', 'componentId', 'hostNodeId'],
			'ElementHandleBinding',
		);
		validateComponentId('ElementHandleBinding', binding.componentId);
		if (
			typeof binding.id !== 'string' ||
			typeof binding.handleName !== 'string' ||
			typeof binding.hostNodeId !== 'string'
		)
			throw new Error('ElementHandleBinding has malformed construct');
	}
	const handleBindingIds = new Set(ir.records.elementHandleBindings.map((binding) => binding.id));
	for (const forward of ir.records.handleForwards) {
		exactKeys(
			forward,
			['handleBindingId', 'edgeId', 'childComponentId', 'childHostNodeId'],
			'HandleForwardRecord',
		);
		if (
			typeof forward.handleBindingId !== 'string' ||
			typeof forward.edgeId !== 'string' ||
			typeof forward.childComponentId !== 'string' ||
			typeof forward.childHostNodeId !== 'string'
		)
			throw new Error('HandleForwardRecord has malformed construct');
		if (!handleBindingIds.has(forward.handleBindingId))
			throw new Error('HandleForwardRecord has dangling handleBindingId');
		if (!componentIds.has(forward.childComponentId))
			throw new Error('HandleForwardRecord has dangling componentId');
		if (
			ir.records.elementHandleBindings.find(
				(binding) => binding.id === forward.handleBindingId,
			)?.hostNodeId !== forward.childHostNodeId
		)
			throw new Error('HandleForwardRecord child host disagrees with its handle binding');
	}
	for (const behavior of ir.records.behaviors) {
		exactKeys(
			behavior,
			['id', 'hostNodeId', 'componentId', 'behavior', 'inputs', 'returnsCleanup', 'order'],
			'BehaviorRecord',
		);
		validateComponentId('BehaviorRecord', behavior.componentId);
		if (
			typeof behavior.id !== 'string' ||
			typeof behavior.hostNodeId !== 'string' ||
			!Array.isArray(behavior.inputs) ||
			typeof behavior.returnsCleanup !== 'boolean' ||
			typeof behavior.order !== 'number'
		)
			throw new Error('BehaviorRecord has malformed construct');
		validateAst('BehaviorRecord behavior', behavior.behavior);
		for (const input of behavior.inputs)
			validateRead(input as RecordLike, 'BehaviorRecord GraphReadRef', true, true);
	}
	for (const call of ir.records.handleCalls) {
		exactKeys(
			call,
			[
				'handleBindingId',
				'componentId',
				'method',
				'arguments',
				'optional',
				'eventId',
				'site',
				'order',
			],
			'HandleCallRecord',
		);
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
		call.arguments.forEach((argument) => validateAst('HandleCallRecord argument', argument));
		validateStructuralSite('HandleCallRecord site', call.site as RecordLike);
	}
	for (const [construct, records] of [
		['SharedDefinition', ir.records.sharedDefinitions],
		['SharedInstance', ir.records.sharedInstances],
		['SharedRead', ir.records.sharedReads],
		['SharedCall', ir.records.sharedCalls],
		['SharedWrite', ir.records.sharedWrites],
		['ElementHandleBinding', ir.records.elementHandleBindings],
		['HandleForwardRecord', ir.records.handleForwards],
		['BehaviorRecord', ir.records.behaviors],
		['HandleCallRecord', ir.records.handleCalls],
	] as const)
		if (records.length)
			throw new Error(
				`${construct} cannot be lowered: composition constructs land in the Solid composition package`,
			);
	for (const binding of ir.records.bindings.filter(
		(entry) => entry.kind === 'state' && entry.valueKind === 'array',
	)) {
		if (!keyByState.has(binding.id))
			throw new Error(`Array state ${binding.id} has unconsumed keyed identity semantics`);
	}
}

function hasComposition(ir: EnrichedIR): boolean {
	return (
		ir.components.length !== 1 ||
		ir.imports.length > 0 ||
		ir.records.sharedDefinitions.length > 0 ||
		ir.records.elementHandleBindings.length > 0 ||
		ir.records.handleForwards.length > 0 ||
		ir.records.behaviors.length > 0 ||
		ir.records.handleCalls.length > 0 ||
		ir.components.some((component) =>
			JSON.stringify(component.template).match(/component-reference|default-slot-projection/),
		)
	);
}

function validateCompositionIr(ir: EnrichedIR): void {
	exactKeys(
		ir,
		['version', 'filename', 'imports', 'module', 'components', 'records'],
		'EnrichedIR',
	);
	if (ir.version !== ENRICHED_IR_VERSION)
		throw new Error(`Expected ${ENRICHED_IR_VERSION}, received ${String(ir.version)}`);
	if (typeof ir.filename !== 'string' || ir.components.length === 0)
		throw new Error('Composition EnrichedIR has malformed module shape');
	const componentIds = new Set(ir.components.map((component) => component.id));
	if (componentIds.size !== ir.components.length)
		throw new Error('EnrichedComponent has duplicate component id');
	const bindingIds = new Set(ir.records.bindings.map((binding) => binding.id));
	const sharedGraphIds = new Set(
		ir.records.sharedDefinitions.flatMap((definition) => definition.graphBindings),
	);
	const eventIds = new Set(ir.records.events.map((event) => event.id));
	const hostIds = new Set<string>();
	const edgeIds = new Set<string>();
	const validateComponentId = (construct: string, componentId: unknown): void => {
		if (typeof componentId !== 'string' || !componentIds.has(componentId))
			throw new Error(`${construct} has unknown component id: ${String(componentId)}`);
	};
	const validateAst = (construct: string, value: unknown): void => {
		if (!value || typeof value !== 'object' || typeof (value as RecordLike).type !== 'string')
			throw new Error(`${construct} has malformed AST`);
	};
	const validateSite = (construct: string, site: any): void => {
		exactKeys(site, ['expression', 'reads'], construct);
		validateAst(`${construct} expression`, site.expression);
		assertArray(site.reads, `${construct} reads`);
		for (const read of site.reads) {
			exactKeys(read, ['graphNodeId', 'path', 'via'], `${construct} GraphReadRef`);
			if (
				typeof read.graphNodeId !== 'string' ||
				(!bindingIds.has(read.graphNodeId) && !sharedGraphIds.has(read.graphNodeId)) ||
				!Array.isArray(read.path) ||
				read.path.some((part: unknown) => typeof part !== 'string') ||
				!['direct', 'alias', 'local', 'repeat-item'].includes(read.via)
			)
				throw new Error(`${construct} has malformed GraphReadRef`);
		}
	};
	const validateTemplate = (node: TemplateNode): void => {
		if (node.kind === 'component-reference') {
			exactKeys(
				node,
				['kind', 'id', 'edgeId', 'target', 'props', 'children'],
				'TemplateComponentReference',
			);
			if (
				typeof node.id !== 'string' ||
				typeof node.edgeId !== 'string' ||
				!Array.isArray(node.props) ||
				!Array.isArray(node.children)
			)
				throw new Error('TemplateComponentReference has malformed construct');
			edgeIds.add(node.edgeId);
			exactKeys(
				node.target,
				node.target.module === 'self'
					? ['localName', 'module']
					: ['localName', 'module', 'exportedName'],
				'TemplateComponentReference target',
			);
			if (typeof node.target.localName !== 'string' || typeof node.target.module !== 'string')
				throw new Error('TemplateComponentReference target has malformed construct');
			if (
				node.target.module === 'self' &&
				!ir.components.some((component) => component.name === node.target.localName)
			)
				throw new Error(
					`TemplateComponentReference has dangling local component: ${node.target.localName}`,
				);
			for (const prop of node.props) {
				exactKeys(
					prop,
					['name', 'kind', 'value', 'graphNodeId', 'path'],
					'ComponentPropExpression',
				);
				if (
					typeof prop.name !== 'string' ||
					!['graph-reference', 'callback', 'serializable', 'opaque'].includes(prop.kind)
				)
					throw new Error('ComponentPropExpression has malformed construct');
				validateSite('ComponentPropExpression value', prop.value);
			}
			node.children.forEach(validateTemplate);
			return;
		}
		if (node.kind === 'default-slot-projection') {
			exactKeys(node, ['kind', 'id', 'site'], 'TemplateDefaultSlotProjection');
			validateSite('TemplateDefaultSlotProjection site', node.site);
			return;
		}
		if (node.kind === 'host') {
			hostIds.add(node.id);
			for (const eventId of node.eventIds)
				if (!eventIds.has(eventId))
					throw new Error(`TemplateHost has dangling event id: ${eventId}`);
			node.children.forEach(validateTemplate);
			return;
		}
		if (node.kind === 'fragment') {
			node.children.forEach(validateTemplate);
			return;
		}
		if (node.kind === 'branch') {
			node.arms.forEach((arm) => arm.children.forEach(validateTemplate));
			return;
		}
		if (node.kind === 'keyed-repeat') {
			node.row.forEach(validateTemplate);
			node.empty.forEach(validateTemplate);
			return;
		}
		if (!['text', 'dynamic-text'].includes(node.kind))
			throw new Error(`TemplateNode has malformed construct: ${String((node as any).kind)}`);
	};
	for (const component of ir.components) {
		exactKeys(
			component,
			['id', 'name', 'evaluation', 'props', 'locals', 'guards', 'template'],
			'EnrichedComponent',
		);
		if (!t.isValidIdentifier(component.name) || !/^\p{Lu}/u.test(component.name))
			throw new Error(`Unsupported component name: ${component.name}`);
		if (
			component.evaluation.ordinaryLocals !== 'once-per-instance' ||
			component.evaluation.computedBindings !== 'reactive'
		)
			throw new Error(`Unsupported evaluation policy for ${component.name}`);
		if (
			component.props.entries.length > 0 &&
			!ir.records.bindings.some(
				(binding) =>
					binding.componentId === component.id &&
					binding.id === component.props.graphNodeId,
			)
		)
			throw new Error(
				`ComponentProps has dangling graph record id: ${component.props.graphNodeId}`,
			);
		component.template.forEach(validateTemplate);
	}
	for (const imported of ir.imports) {
		exactKeys(
			imported,
			['localName', 'source', 'kind', 'importedName', 'resolvesTo'],
			'ModuleImport',
		);
		if (imported.resolvesTo !== 'tsrx-module' || !imported.source.endsWith('.tsrx'))
			throw new Error(`ModuleImport cannot be lowered: ${imported.source}`);
	}
	for (const exported of ir.module.exports) {
		exactKeys(exported, ['kind', 'componentName', 'exportedName'], 'ComponentExport');
		if (!ir.components.some((component) => component.name === exported.componentName))
			throw new Error(`ComponentExport has unknown component: ${exported.componentName}`);
	}
	for (const definition of ir.records.sharedDefinitions) {
		exactKeys(
			definition,
			[
				'id',
				'name',
				'scope',
				'cells',
				'methods',
				'graphBindings',
				'returnProperties',
				'dependencies',
			],
			'SharedDefinition',
		);
		if (
			typeof definition.name !== 'string' ||
			definition.name.length === 0 ||
			!t.isValidIdentifier(definition.name) ||
			!['request', 'container', 'page'].includes(definition.scope)
		)
			throw new Error('SharedDefinition has malformed construct');
		for (const cell of definition.cells) {
			if (cell.kind === 'state') {
				exactKeys(
					cell,
					['kind', 'name', 'graphNodeId', 'valueKind', 'initializer'],
					'SharedDefinitionCell',
				);
				if (!['scalar', 'object', 'array'].includes(cell.valueKind))
					throw new Error(`SharedDefinitionCell ${cell.name} has unsupported valueKind`);
				validateAst('SharedDefinitionCell initializer', cell.initializer);
			} else {
				exactKeys(
					cell,
					['kind', 'name', 'graphNodeId', 'expression', 'dependencies'],
					'SharedDefinitionCell',
				);
				if (cell.kind !== 'computed')
					throw new Error('SharedDefinitionCell has malformed construct');
				validateAst('SharedDefinitionCell expression', cell.expression);
				if (
					cell.dependencies.some(
						(dependency) => !definition.graphBindings.includes(dependency),
					)
				)
					throw new Error('SharedDefinitionCell has malformed construct');
			}
		}
		for (const method of definition.methods) {
			exactKeys(method, ['name', 'site', 'writes'], 'SharedDefinitionMethod');
			if (typeof method.name !== 'string' || !Array.isArray(method.writes))
				throw new Error('SharedDefinitionMethod has malformed construct');
			validateAst('SharedDefinitionMethod site', method.site);
		}
		for (const property of definition.returnProperties) {
			if (property.kind === 'graph') {
				const cell = definition.cells.find((candidate) => candidate.name === property.name);
				if (!cell || cell.graphNodeId !== property.graphNodeId)
					throw new Error(
						`SharedReturnProperty ${property.name} does not resolve to its shared cell`,
					);
			} else if (!definition.methods.some((method) => method.name === property.name)) {
				throw new Error(
					`SharedReturnProperty ${property.name} does not resolve to its shared method`,
				);
			}
		}
		const instances = ir.records.sharedInstances.filter(
			(instance) => instance.definitionId === definition.id,
		);
		if (instances.length === 0)
			throw new Error(`SharedDefinition ${definition.name} has no SharedInstance records`);
		const recordedWrites = ir.records.sharedWrites.filter(
			(write) => write.definitionId === definition.id,
		);
		const methodWrites = definition.methods.flatMap((method) => method.writes);
		if (
			recordedWrites.length !== methodWrites.length ||
			methodWrites.some(
				(write, index) =>
					recordedWrites[index]?.graphNodeId !== write.graphNodeId ||
					recordedWrites[index]?.order !== write.order ||
					recordedWrites[index]?.operation !== write.operation,
			)
		)
			throw new Error(
				`SharedWrite records are incomplete for SharedDefinition ${definition.name}`,
			);
	}
	const definitionIds = new Set(ir.records.sharedDefinitions.map((definition) => definition.id));
	for (const [construct, records] of [
		['SharedInstance', ir.records.sharedInstances],
		['SharedRead', ir.records.sharedReads],
		['SharedCall', ir.records.sharedCalls],
		['SharedWrite', ir.records.sharedWrites],
	] as const)
		for (const record of records)
			if (!definitionIds.has(record.definitionId))
				throw new Error(
					`${construct} has dangling SharedDefinition: ${record.definitionId}`,
				);
	for (const record of [
		...ir.records.bindings,
		...ir.records.aliases,
		...ir.records.events,
		...ir.records.stateReads,
		...ir.records.stateWrites,
		...ir.records.sharedInstances,
		...ir.records.sharedReads,
		...ir.records.sharedCalls,
		...ir.records.elementHandleBindings,
		...ir.records.behaviors,
		...ir.records.handleCalls,
	])
		validateComponentId(
			record.constructor?.name ?? 'Composition record',
			(record as any).componentId,
		);
	const handleIds = new Set(ir.records.elementHandleBindings.map((binding) => binding.id));
	for (const call of ir.records.handleCalls) {
		if (!handleIds.has(call.handleBindingId))
			throw new Error(
				`HandleCallRecord has dangling ElementHandleBinding: ${call.handleBindingId}`,
			);
		if (!call.optional)
			throw new Error('HandleCallRecord requires null-guarded optional access');
	}
	for (const forward of ir.records.handleForwards) {
		if (!handleIds.has(forward.handleBindingId))
			throw new Error('HandleForwardRecord has dangling handleBindingId');
		validateComponentId('HandleForwardRecord', forward.childComponentId);
		if (!edgeIds.has(forward.edgeId))
			throw new Error(`HandleForwardRecord has dangling edge: ${forward.edgeId}`);
	}
	for (const behavior of ir.records.behaviors) {
		if (!hostIds.has(behavior.hostNodeId))
			throw new Error(`BehaviorRecord has dangling host: ${behavior.hostNodeId}`);
		if (typeof behavior.returnsCleanup !== 'boolean')
			throw new Error('BehaviorRecord has malformed cleanup provenance');
		for (const input of behavior.inputs) {
			exactKeys(
				input,
				['graphNodeId', 'path', 'via', 'provenance'],
				'BehaviorRecord GraphReadRef',
			);
			if (!['layer-a', 'derived-from-ast'].includes(input.provenance))
				throw new Error('BehaviorRecord GraphReadRef has unsupported provenance');
		}
	}
	for (const handle of ir.records.elementHandleBindings)
		if (!hostIds.has(handle.hostNodeId))
			throw new Error(`ElementHandleBinding has dangling host: ${handle.hostNodeId}`);
	walk(ir, (record) => {
		for (const field of LEGACY_STRING_FIELDS)
			if (field in record)
				throw new Error(`Legacy source-string field is forbidden: ${field}`);
	});
}

function validatePersistenceCorrelation(ir: EnrichedIR): void {
	const persistenceIds = new Set(ir.records.persistence.map((record) => record.graphNodeId));
	if (persistenceIds.size !== ir.records.persistence.length)
		throw new Error('EnrichedRecordTable has duplicate persistence graph node ids');
	for (const record of ir.records.persistence) {
		const binding = ir.records.bindings.find(
			(candidate) => candidate.id === record.graphNodeId && candidate.kind === 'state',
		);
		const sharedCell = ir.records.sharedDefinitions
			.flatMap((definition) => definition.cells)
			.find(
				(candidate) =>
					candidate.kind === 'state' && candidate.graphNodeId === record.graphNodeId,
			);
		if (!binding && !sharedCell)
			throw new Error(`Persistence record has no Solid state binding: ${record.graphNodeId}`);
		if ((binding ?? sharedCell)!.name !== record.bindingName)
			throw new Error(`Persistence record binding name does not match ${record.graphNodeId}`);
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

function persistenceSeed(record: FramelessPersistenceRecord): t.Expression {
	if (!record.access.render || record.seed.lowering !== 'pre-paint')
		return t.stringLiteral(record.authoredInitial);
	const landing = record.seed.landings.find(
		(candidate) =>
			candidate.target === 'solid' &&
			candidate.kind === 'sync-read-seed-slot' &&
			candidate.graphNodeId === record.graphNodeId,
	);
	if (!landing) return t.stringLiteral(record.authoredInitial);
	const container = t.memberExpression(
		t.identifier('globalThis'),
		t.identifier(FRAMELESS_STATE_GLOBAL),
	);
	const slot = t.memberExpression(container, t.stringLiteral(record.key.literal), true);
	slot.optional = true;
	return t.logicalExpression(
		'??',
		{ type: 'ChainExpression', expression: slot },
		t.stringLiteral(record.authoredInitial),
	);
}

function persistenceStatements(
	context: EmitContext,
	record: FramelessPersistenceRecord,
	value: t.Expression,
): t.Statement[] {
	context.persistenceWrites.emitted = true;
	return [
		t.expressionStatement(
			t.callExpression(t.identifier('__framelessWrite'), [
				t.stringLiteral(record.key.literal),
				t.stringLiteral(record.antiFlashAttribute),
				t.cloneNode(value, true),
			]),
		),
	];
}

function persistenceHelperDeclaration(): t.Statement {
	return t.functionDeclaration(
		t.identifier('__framelessWrite'),
		[t.identifier('key'), t.identifier('attr'), t.identifier('value')],
		t.blockStatement([
			{
				type: 'TryStatement',
				block: t.blockStatement([
					t.expressionStatement(
						t.callExpression(member(t.identifier('localStorage'), 'setItem'), [
							t.identifier('key'),
							t.identifier('value'),
						]),
					),
				]),
				handler: {
					type: 'CatchClause',
					param: null,
					body: t.blockStatement([
						t.expressionStatement(t.unaryExpression('void', t.numericLiteral(0))),
					]),
				},
				finalizer: null,
			},
			t.expressionStatement(
				t.callExpression(
					member(member(t.identifier('document'), 'documentElement'), 'setAttribute'),
					[t.identifier('attr'), t.identifier('value')],
				),
			),
		]),
	);
}

function appendPersistenceWrites(fn: t.ArrowFunctionExpression, context: EmitContext): void {
	if (!t.isBlockStatement(fn.body)) return;
	const stateBySetter = new Map(
		[...context.statesById.values()]
			.filter((state) => context.settersById.has(state.id))
			.map((state) => [context.settersById.get(state.id)!, state]),
	);
	fn.body.body = fn.body.body.flatMap((statement: t.Statement) => {
		if (
			!t.isExpressionStatement(statement) ||
			!t.isCallExpression(statement.expression) ||
			!t.isIdentifier(statement.expression.callee)
		)
			return [statement];
		const state = stateBySetter.get(statement.expression.callee.name);
		const persistence = state ? context.persistenceByGraph.get(state.id) : undefined;
		if (!state || !persistence) return [statement];
		const argument = statement.expression.arguments[0];
		const finalValue =
			state.storage === 'signal' && argument && t.isExpression(argument)
				? argument
				: t.identifier(state.name);
		return [statement, ...persistenceStatements(context, persistence, finalValue)];
	});
}

function rewriteExpressionAst(result: t.Expression, context: EmitContext): t.Expression {
	return reanalyzeExpression(result, (module, analyzed) => {
		const replace = (current: any, replacement: any): void => {
			const parent = module.parentOf(current) as any;
			if (!parent) throw new Error('Expression rewrite lost its parent');
			for (const [key, value] of Object.entries(parent)) {
				if (value === current) {
					parent[key] = replacement;
					return;
				}
				if (Array.isArray(value)) {
					const index = value.indexOf(current);
					if (index >= 0) {
						value[index] = replacement;
						return;
					}
				}
			}
			throw new Error('Expression rewrite could not replace a node');
		};
		const unresolved = new Set(module.unresolvedReferences.map((reference) => reference.node));
		for (const reference of module.unresolvedReferences) {
			const node = reference.node as any;
			const parent = module.parentOf(node) as any;
			const writeTarget =
				(parent?.type === 'AssignmentExpression' && parent.left === node) ||
				(parent?.type === 'UpdateExpression' && parent.argument === node);
			if (writeTarget || context.lexicalNames.has(node.name)) continue;
			const prop = context.propsByLocal.get(node.name);
			const state = context.statesByName.get(node.name);
			const computed = context.computedByName.get(node.name);
			let replacement: t.Expression | null = null;
			if (prop) replacement = pathMember(t.identifier(context.propsName), prop.path);
			else if (state?.storage === 'signal')
				replacement = t.callExpression(t.identifier(state.name), []);
			else if (computed) replacement = t.callExpression(t.identifier(computed.name), []);
			if (!replacement) continue;
			if (parent?.type === 'Property' && parent.shorthand) parent.shorthand = false;
			replace(node, replacement);
		}
		const writes: any[] = [];
		module.walk(
			{
				AssignmentExpression(node: any) {
					writes.push(node);
				},
				UpdateExpression(node: any) {
					writes.push(node);
				},
			},
			analyzed,
		);
		for (const node of writes.reverse()) {
			const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
			if (
				!t.isIdentifier(target) ||
				!unresolved.has(target) ||
				context.lexicalNames.has(target.name)
			)
				continue;
			const state = context.statesByName.get(target.name);
			if (!state || state.storage === 'local') continue;
			if (node.type === 'AssignmentExpression') {
				if (node.operator !== '=')
					throw new Error(`Unsupported state assignment operator: ${node.operator}`);
				let value = node.right;
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
				replace(
					node,
					t.callExpression(t.identifier(context.settersById.get(state.id)!), [value]),
				);
			} else {
				const parent = module.parentOf(node) as any;
				if (state.storage !== 'signal' || parent?.type !== 'ExpressionStatement')
					throw new Error(
						`Unsupported value-observed state update: ${state.name}${node.operator}`,
					);
				const operator = node.operator === '++' ? '+' : '-';
				replace(
					node,
					t.callExpression(t.identifier(context.settersById.get(state.id)!), [
						t.binaryExpression(
							operator,
							t.callExpression(t.identifier(state.name), []),
							t.numericLiteral(1),
						),
					]),
				);
			}
		}
	});
}

function rewriteExpression(node: SerializableAstNode, context: EmitContext): t.Expression {
	return rewriteExpressionAst(expression(node), context);
}

function jsxAttribute(name: string, value: string | true | t.Expression): t.JSXAttribute {
	return t.jsxAttribute(
		t.jsxIdentifier(name),
		value === true
			? null
			: typeof value === 'string'
				? t.jsxStringValue(value)
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
	const elseChildren = node.arms[1]!.children;
	const children = expressionFromNodes(node.arms[0]!.children, context);
	// An authored empty `@else {}` is sanctioned: Show without a
	// fallback attribute — the Solid idiom, not an empty-fragment fallback.
	const attributes = [jsxAttribute('when', rewriteExpression(node.expression, context))];
	if (elseChildren.length > 0) {
		attributes.push(jsxAttribute('fallback', expressionFromNodes(elseChildren, context)));
	}
	return t.jsxElement(
		t.jsxOpeningElement(name, attributes, false),
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
	const statements: t.Statement[] = fn.body.body;
	const remove = new Set<number>();
	const replacements = new Map<number, t.Statement>();
	for (const write of deepWrites) {
		const state = context.statesById.get(write.graphNodeId);
		if (!state || state.storage !== 'store')
			throw new Error(`Member write ${write.graphNodeId} does not target a store cell`);
		const expectedPath = write.path.slice(1);
		const assignmentIndex = statements.findIndex((statement) => {
			if (
				!t.isExpressionStatement(statement) ||
				!t.isAssignmentExpression(statement.expression)
			)
				return false;
			const target = memberPath(statement.expression.left);
			return Boolean(
				target &&
				target.path.join('/') === expectedPath.join('/') &&
				statement.expression.operator === write.assignmentOperator &&
				write.value &&
				equivalent(statement.expression.right, expression(write.value)),
			);
		});
		const assignment = statements[assignmentIndex];
		const assignmentTarget =
			assignment &&
			t.isExpressionStatement(assignment) &&
			t.isAssignmentExpression(assignment.expression)
				? memberPath(assignment.expression.left)
				: null;
		const aliasName = assignmentTarget?.root.name ?? '';
		const aliasIndex = statements.findIndex(
			(statement) =>
				t.isVariableDeclaration(statement) &&
				statement.declarations.some((entry: t.VariableDeclarator) =>
					t.isIdentifier(entry.id, { name: aliasName }),
				),
		);
		const aliasStatement = statements[aliasIndex];
		const declaration =
			aliasStatement && t.isVariableDeclaration(aliasStatement)
				? aliasStatement.declarations.find((entry: t.VariableDeclarator) =>
						t.isIdentifier(entry.id, { name: aliasName }),
					)
				: null;
		if (
			assignmentIndex < 0 ||
			aliasIndex < 0 ||
			!assignment ||
			!t.isExpressionStatement(assignment) ||
			!t.isAssignmentExpression(assignment.expression) ||
			!declaration ||
			!t.isCallExpression(declaration.init) ||
			!t.isMemberExpression(declaration.init.callee) ||
			!t.isIdentifier(declaration.init.callee.object) ||
			!t.isIdentifier(declaration.init.callee.property, { name: 'find' }) ||
			!t.isArrowFunctionExpression(declaration.init.arguments[0])
		)
			throw new Error(
				`Could not structurally lower store member write ${write.graphNodeId}/${write.path.join('/')}`,
			);
		const receiverName = declaration.init.callee.object.name;
		const predicate = declaration.init.arguments[0];
		let copyIndex = -1;
		if (receiverName !== state.name) {
			copyIndex = statements.findIndex(
				(statement) =>
					t.isVariableDeclaration(statement) &&
					statement.declarations.some(
						(entry: t.VariableDeclarator) =>
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
		const publication = handler.writes.find(
			(candidate) =>
				candidate !== write &&
				candidate.graphNodeId === write.graphNodeId &&
				candidate.via === 'direct' &&
				candidate.operation === 'assign' &&
				candidate.path.length === 0 &&
				candidate.value,
		);
		const rootIndex = statements.findIndex((statement) =>
			Boolean(
				publication &&
				t.isExpressionStatement(statement) &&
				t.isAssignmentExpression(statement.expression, {
					operator: publication.assignmentOperator,
				}) &&
				t.isIdentifier(statement.expression.left, { name: state.name }) &&
				equivalent(statement.expression.right, expression(publication.value)),
			),
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
		remove.add(assignmentIndex);
		remove.add(rootIndex);
		if (copyIndex >= 0) remove.add(copyIndex);
	}
	fn.body.body = statements.flatMap((statement, index) =>
		replacements.has(index) ? [replacements.get(index)!] : remove.has(index) ? [] : [statement],
	);
}

type SolidSyncPlan = {
	readonly actions: readonly string[];
	/**
	 * The SHIPPED path only: strip the authored `preventDefault()` and re-emit it
	 * as the first statement. See `normalizeHandler` for why this is the only
	 * policy shape that gets rewritten at all.
	 */
	readonly renormalize: boolean;
};

/**
 * Solid's handlers are SYNCHRONOUS AND RESIDENT, so a declared `SyncPolicy`
 * needs no lowering: the authored calls already run at the authored moment,
 * under the authored guard. The policy is a CROSS-CHECK here, exactly as it is
 * in React.
 *
 * The `branches` form gets a NAMED refusal. Before T012 it reached
 * `policy.actions.length` on a record that has no `actions` and produced a raw
 * `TypeError: Cannot read properties of undefined (reading 'length')` - measured,
 * not inferred. A multi-handler policy means the event prop carries several
 * handler functions each contributing a branch, which this reconciliation does
 * not model; refusing by name is the fail-closed answer.
 */
function syncPlan(event: EnrichedEventRecord): SolidSyncPlan | null {
	const policy = event.syncPolicy as RecordLike | undefined;
	if (!policy) return null;
	if ('branches' in policy)
		throw new Error(
			`SyncPolicy ${event.id} declares a multi-handler sync policy; the Solid emitter reconciles one branch per event prop`,
		);
	const actions = (policy.actions ?? []) as readonly string[];
	const unconditional =
		policy.when?.type === 'constant-truthy' && Boolean(policy.when.value);
	return {
		actions,
		renormalize: unconditional && actions.length === 1 && actions[0] === 'preventDefault',
	};
}

function containsSyncActionCall(node: unknown, action: string): boolean {
	let found = false;
	walk(node, (record) => {
		if (
			record.type === 'CallExpression' &&
			record.callee?.type === 'MemberExpression' &&
			!record.callee.computed &&
			record.callee.property?.type === 'Identifier' &&
			record.callee.property.name === action
		)
			found = true;
	});
	return found;
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
	const plan = syncPlan(event);
	const actions = plan?.actions ?? [];
	if (actions.length && !t.isIdentifier(parameter))
		throw new Error(`Sync policy ${event.id} requires an identifier event parameter`);
	// Cross-check, in React's shape: a declared action absent from the handler AST
	// means the IR and the body disagree, and Solid has no channel to make up the
	// difference. Run BEFORE any rewriting, against what the author wrote.
	for (const action of actions)
		if (!containsSyncActionCall(fn, action))
			throw new Error(`Sync policy ${action} is absent from ${event.id}'s handler AST`);
	if (t.isIdentifier(parameter)) {
		const authored = fn.body.body.some((statement: t.Statement) =>
			isPreventDefault(statement, parameter.name),
		);
		if (authored && !actions.includes('preventDefault'))
			throw new Error(`Undeclared preventDefault synchronization in ${event.id}`);
		// THE ONLY REWRITE. Strip-and-renormalize applies to the shipped path
		// alone - a single unconditional branch declaring exactly preventDefault -
		// so that path stays byte-identical while every other policy leaves the
		// authored body untouched, exactly as React does.
		//
		// Doing this for ANY non-empty `actions` was the most dangerous line in
		// this emitter, and the over-narrow validator was the only thing hiding it.
		// MEASURED with the validator widened and this line unfixed:
		//
		//   - a CONDITIONAL policy emitted `event.preventDefault();` at the top of
		//     the handler AND kept the authored call inside the `if`, because the
		//     strip-filter only ever looked at top-level statements. A cancellation
		//     the author guarded fired unconditionally.
		//   - a policy declaring ONLY `stopPropagation` emitted a
		//     `event.preventDefault()` that appears nowhere in the program.
		if (plan?.renormalize && authored)
			fn.body.body = fn.body.body.filter(
				(statement: t.Statement) => !isPreventDefault(statement, parameter.name),
			);
	}
	const rewritten = rewriteExpressionAst(fn, context);
	if (!t.isArrowFunctionExpression(rewritten) || !t.isBlockStatement(rewritten.body))
		throw new Error(`Event handler ${event.id} was not preserved as an arrow`);
	if (plan?.renormalize) {
		const eventParameter = rewritten.params[0];
		if (!t.isIdentifier(eventParameter))
			throw new Error(`Sync policy ${event.id} lost its event parameter`);
		rewritten.body.body.unshift(
			t.expressionStatement(
				t.callExpression(member(t.identifier(eventParameter.name), 'preventDefault'), []),
			),
		);
	}
	appendPersistenceWrites(rewritten, context);
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
	return reads.some((read) => {
		const kind = context.bindingsById.get(read.graphNodeId)?.kind;
		return kind === 'state' || kind === 'prop';
	});
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
			const persistence = context.persistenceByGraph.get(state.id);
			const initializer = persistence
				? persistenceSeed(persistence)
				: onceValue(rewriteExpression(state.initializer!, context), local.reads, context);
			if (mapped.storage === 'signal') {
				const elements: Array<t.Node | null> = [t.identifier(state.name)];
				if (state.writes.length > 0)
					elements.push(t.identifier(context.settersById.get(state.id)!));
				body.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.arrayPattern(elements),
							t.callExpression(api(context, 'createSignal'), [initializer]),
						),
					]),
				);
			} else if (mapped.storage === 'store') {
				const elements: Array<t.Node | null> = [t.identifier(state.name)];
				if (state.writes.length > 0)
					elements.push(t.identifier(context.settersById.get(state.id)!));
				body.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.arrayPattern(elements),
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
					t.variableDeclarator(structuredClone(local.pattern) as t.LVal, initializer),
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
			component.props.entries.length > 0 ? [t.identifier(context.propsName)] : [],
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

type CompositionNames = {
	readonly context: string;
	readonly provider: string;
	readonly createShared: string;
	readonly moduleShared: string;
};

type CompositionContext = {
	readonly ir: EnrichedIR;
	readonly component: EnrichedComponent;
	readonly base: EmitContext;
	readonly propsName: string;
	readonly sharedLocals: ReadonlyMap<string, SharedDefinition>;
	readonly sharedNames: ReadonlyMap<string, CompositionNames>;
	readonly directiveNames: ReadonlyMap<string, string>;
};

function compositionAuthoredNames(ir: EnrichedIR): Set<string> {
	const names = collectAuthoredNames(ir);
	for (const component of ir.components) {
		names.add(component.name);
		for (const local of component.locals) local.names.forEach((name) => names.add(name));
	}
	for (const definition of ir.records.sharedDefinitions) {
		names.add(definition.name);
		definition.cells.forEach((cell) => names.add(cell.name));
		definition.methods.forEach((method) => names.add(method.name));
	}
	return names;
}

function componentAuthoredNames(ir: EnrichedIR, component: EnrichedComponent): Set<string> {
	const names = new Set<string>();
	const scopedRecords = {
		component,
		bindings: ir.records.bindings.filter((record) => record.componentId === component.id),
		events: ir.records.events.filter((record) => record.componentId === component.id),
		sharedInstances: ir.records.sharedInstances.filter(
			(record) => record.componentId === component.id,
		),
		sharedReads: ir.records.sharedReads.filter((record) => record.componentId === component.id),
		sharedCalls: ir.records.sharedCalls.filter((record) => record.componentId === component.id),
		elementHandles: ir.records.elementHandleBindings.filter(
			(record) => record.componentId === component.id,
		),
		behaviors: ir.records.behaviors.filter((record) => record.componentId === component.id),
		handleCalls: ir.records.handleCalls.filter((record) => record.componentId === component.id),
	};
	walk(scopedRecords, (record) => {
		if (record.type === 'Identifier' && typeof record.name === 'string') names.add(record.name);
		if (typeof record.item === 'string') names.add(record.item);
		if (typeof record.index === 'string') names.add(record.index);
	});
	for (const binding of scopedRecords.bindings)
		if (binding.id !== component.props.graphNodeId) names.add(binding.name);
	for (const local of component.locals) local.names.forEach((name) => names.add(name));
	return names;
}

function sharedStem(definition: SharedDefinition): string {
	return definition.name.startsWith('use') && definition.name.length > 3
		? definition.name.slice(3)
		: `${definition.name[0]!.toUpperCase()}${definition.name.slice(1)}`;
}

function withGeneratedSuffix(base: string, suffix: string): string {
	return base.endsWith(suffix) ? base : `${base}${suffix}`;
}

function lowercaseFirst(name: string): string {
	return `${name[0]!.toLowerCase()}${name.slice(1)}`;
}

function replaceChild(parent: any, current: any, replacement: any): void {
	for (const [key, value] of Object.entries(parent)) {
		if (value === current) {
			parent[key] = replacement;
			return;
		}
		if (Array.isArray(value)) {
			const index = value.indexOf(current);
			if (index >= 0) {
				value[index] = replacement;
				return;
			}
		}
	}
	throw new Error('Composition expression rewrite could not replace a node');
}

function rewriteCompositionExpression(
	node: SerializableAstNode,
	context: CompositionContext,
): t.Expression {
	const rewritten = rewriteExpression(node, context.base);
	return reanalyzeExpression(rewritten, (module, analyzed) => {
		const members: any[] = [];
		module.walk(
			{
				MemberExpression(value: any) {
					members.push(value);
				},
			},
			analyzed,
		);
		for (const value of members.reverse()) {
			if (value.computed || !t.isIdentifier(value.object) || !t.isIdentifier(value.property))
				continue;
			const definition = context.sharedLocals.get(value.object.name);
			if (!definition) continue;
			const returned = definition.returnProperties.find(
				(property) => property.name === value.property.name,
			);
			if (!returned || returned.kind !== 'graph') continue;
			const parent = module.parentOf(value) as any;
			if (parent?.type === 'CallExpression' && parent.callee === value) continue;
			replaceChild(parent, value, t.callExpression(t.cloneNode(value, true), []));
		}
	});
}

function captureBehaviorInputs(
	value: t.Expression,
	captures: ReadonlyMap<string, string>,
): t.Expression {
	if (captures.size === 0) return value;
	return reanalyzeExpression(value, (module, analyzed) => {
		const calls: any[] = [];
		module.walk(
			{
				CallExpression(call: any) {
					calls.push(call);
				},
			},
			analyzed,
		);
		for (const call of calls.reverse()) {
			if (!t.isIdentifier(call.callee) || call.arguments.length !== 0) continue;
			const capture = captures.get(call.callee.name);
			if (!capture) continue;
			replaceChild(module.parentOf(call), call, t.identifier(capture));
		}
	});
}

function compositionTemplateNode(node: TemplateNode, context: CompositionContext): RenderedNode {
	if (node.kind === 'text') return t.jsxText(node.value);
	if (node.kind === 'dynamic-text')
		return t.jsxExpressionContainer(rewriteCompositionExpression(node.expression, context));
	if (node.kind === 'default-slot-projection')
		return t.jsxExpressionContainer(member(t.identifier(context.propsName), 'children'));
	if (node.kind === 'fragment')
		return t.jsxFragment(
			t.jsxOpeningFragment(),
			t.jsxClosingFragment(),
			node.children.map((child) => compositionTemplateNode(child, context)),
		);
	if (node.kind === 'component-reference') {
		const attributes: t.JSXAttribute[] = [];
		const forward = context.ir.records.handleForwards.find(
			(record) => record.edgeId === node.edgeId,
		);
		for (const prop of node.props) {
			let value: t.Expression;
			if (forward && prop.graphNodeId) {
				const handle = context.ir.records.elementHandleBindings.find(
					(binding) => binding.id === forward.handleBindingId,
				);
				if (!handle) throw new Error('HandleForwardRecord lost its parent handle');
				value = t.arrowFunctionExpression(
					[t.identifier('node')],
					t.assignmentExpression(
						'=',
						t.identifier(handle.handleName),
						t.identifier('node'),
					),
				);
			} else value = rewriteCompositionExpression(prop.value.expression, context);
			attributes.push(jsxAttribute(prop.name, value));
		}
		const name = t.jsxIdentifier(node.target.localName);
		const children = node.children.map((child) => compositionTemplateNode(child, context));
		const selfClosing = children.length === 0;
		return t.jsxElement(
			t.jsxOpeningElement(name, attributes, selfClosing),
			selfClosing ? null : t.jsxClosingElement(t.cloneNode(name)),
			children,
			selfClosing,
		);
	}
	if (node.kind === 'branch') {
		const name = t.jsxIdentifier(api(context.base, 'Show').name);
		const attributes = [
			jsxAttribute('when', rewriteCompositionExpression(node.expression, context)),
		];
		if (node.arms[1]!.children.length)
			attributes.push(
				jsxAttribute(
					'fallback',
					expressionFromCompositionNodes(node.arms[1]!.children, context),
				),
			);
		return t.jsxElement(
			t.jsxOpeningElement(name, attributes, false),
			t.jsxClosingElement(t.cloneNode(name)),
			[expressionFromCompositionNodes(node.arms[0]!.children, context) as any],
			false,
		);
	}
	if (node.kind === 'keyed-repeat') {
		const lexicalNames = new Set(context.base.lexicalNames).add(node.item);
		if (node.index) lexicalNames.add(node.index);
		const rowContext = { ...context, base: { ...context.base, lexicalNames } };
		const name = t.jsxIdentifier(api(context.base, 'For').name);
		return t.jsxElement(
			t.jsxOpeningElement(
				name,
				[
					jsxAttribute(
						'each',
						rewriteCompositionExpression(node.collection.expression, context),
					),
				],
				false,
			),
			t.jsxClosingElement(t.cloneNode(name)),
			[
				t.jsxExpressionContainer(
					t.arrowFunctionExpression(
						[t.identifier(node.item)],
						expressionFromCompositionNodes(node.row, rowContext),
					),
				),
			],
			false,
		);
	}
	const attributes: t.JSXAttribute[] = node.staticAttributes.map((attribute) =>
		jsxAttribute(attribute.name, attribute.value),
	);
	for (const binding of node.dynamicBindings)
		attributes.push(
			jsxAttribute(binding.name, rewriteCompositionExpression(binding.expression, context)),
		);
	const attach = context.directiveNames.get(node.id);
	const forward = context.ir.records.handleForwards.find(
		(record) =>
			record.childComponentId === context.component.id && record.childHostNodeId === node.id,
	);
	if (forward) {
		const parentHandle = context.ir.records.elementHandleBindings.find(
			(binding) => binding.id === forward.handleBindingId,
		)!;
		const prop = context.component.props.entries.find(
			(entry) =>
				entry.sourceName === parentHandle.handleName ||
				entry.localName === parentHandle.handleName,
		);
		const propName = prop?.sourceName ?? parentHandle.handleName.split('.').at(-1)!;
		const callbackBody: t.Statement[] = [
				t.expressionStatement(
					t.callExpression(member(t.identifier(context.propsName), propName), [
						t.identifier('node'),
					]),
				),
				t.expressionStatement(
					t.callExpression(api(context.base, 'onCleanup'), [
						t.arrowFunctionExpression(
							[],
							t.callExpression(member(t.identifier(context.propsName), propName), [
								t.identifier('undefined'),
							]),
						),
					]),
				),
			];
		if (attach)
			callbackBody.push(
				t.expressionStatement(
					t.callExpression(t.identifier(attach), [t.identifier('node')]),
				),
			);
		const callback = t.arrowFunctionExpression(
			[t.identifier('node')],
			t.blockStatement(callbackBody),
		);
		attributes.push(jsxAttribute('ref', callback));
	} else {
		const handle = context.ir.records.elementHandleBindings.find(
			(binding) =>
				binding.componentId === context.component.id && binding.hostNodeId === node.id,
		);
		if (handle && !handle.handleName.includes('.')) {
			if (attach)
				attributes.push(
					jsxAttribute(
						'ref',
						t.arrowFunctionExpression(
							[t.identifier('node')],
							t.blockStatement([
								t.expressionStatement(
									t.assignmentExpression(
										'=',
										t.identifier(handle.handleName),
										t.identifier('node'),
									),
								),
								t.expressionStatement(
									t.callExpression(t.identifier(attach), [t.identifier('node')]),
								),
							]),
						),
					),
				);
			else attributes.push(jsxAttribute('ref', t.identifier(handle.handleName)));
		} else if (attach) attributes.push(jsxAttribute('ref', t.identifier(attach)));
	}
	for (const eventId of node.eventIds) {
		const event = context.base.events.get(eventId);
		if (!event) throw new Error(`Unknown event record: ${eventId}`);
		const emitted = emitEvent(event, context.base);
		attributes.push(
			jsxAttribute(
				eventAttributeName(event.eventName),
				rewriteCompositionExpression(emitted as SerializableAstNode, context) as any,
			),
		);
	}
	const name = t.jsxIdentifier(node.tag);
	const children = node.children.map((child) => compositionTemplateNode(child, context));
	const selfClosing = children.length === 0;
	return t.jsxElement(
		t.jsxOpeningElement(name, attributes, selfClosing),
		selfClosing ? null : t.jsxClosingElement(t.cloneNode(name)),
		children,
		selfClosing,
	);
}

function expressionFromCompositionNodes(
	nodes: readonly TemplateNode[],
	context: CompositionContext,
): t.Expression {
	const children = nodes.map((node) => compositionTemplateNode(node, context));
	if (children.length === 0)
		return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), []);
	if (children.length === 1 && (t.isJSXElement(children[0]) || t.isJSXFragment(children[0])))
		return children[0];
	return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), children);
}

function sharedMethodArrow(
	definition: SharedDefinition,
	method: SharedDefinition['methods'][number],
	context: EmitContext,
): t.ArrowFunctionExpression {
	const site = method.site as any;
	const fn = site.type === 'Property' ? site.value : site;
	if (!fn || !['FunctionExpression', 'ArrowFunctionExpression'].includes(fn.type))
		throw new Error(`SharedDefinitionMethod ${method.name} has unsupported AST`);
	const arrow = t.arrowFunctionExpression(
		structuredClone(fn.params ?? []),
		structuredClone(fn.body),
	);
	const rewritten = rewriteExpressionAst(arrow, context);
	if (!t.isArrowFunctionExpression(rewritten))
		throw new Error(`SharedDefinitionMethod ${method.name} lost its action shape`);
	appendPersistenceWrites(rewritten, context);
	return rewritten;
}

function emitSharedFamily(
	ir: EnrichedIR,
	definition: SharedDefinition,
	names: CompositionNames,
	base: EmitContext,
): t.Statement[] {
	const body: t.Statement[] = [];
	const statesById = new Map<string, StateBinding>();
	const statesByName = new Map<string, StateBinding>();
	const settersById = new Map<string, string>();
	const writtenCellIds = new Set(
		definition.methods.flatMap((method) => method.writes.map((write) => write.graphNodeId)),
	);
	const computedByName = new Map<string, EnrichedGraphBinding>();
	for (const cell of definition.cells) {
		if (cell.kind === 'state') {
			const storage: StateBinding['storage'] =
				cell.valueKind === 'scalar' ? 'signal' : 'store';
			const state = {
				componentId: '',
				id: cell.graphNodeId,
				name: cell.name,
				kind: 'state',
				writable: true,
				valueKind: cell.valueKind,
				reads: [],
				writes: [],
				storage,
			} as StateBinding;
			statesById.set(state.id, state);
			statesByName.set(state.name, state);
			if (writtenCellIds.has(state.id))
				settersById.set(state.id, base.names.claim(setterBase(state.name)));
		} else {
			computedByName.set(cell.name, {
				componentId: '',
				id: cell.graphNodeId,
				name: cell.name,
				kind: 'computed',
				writable: false,
				reads: [],
				writes: [],
				computed: { expression: cell.expression, reads: [] },
			} as EnrichedGraphBinding);
		}
	}
	const sharedContext: EmitContext = {
		...base,
		bindingsById: new Map(statesById),
		computedByName,
		lexicalNames: new Set(),
		propsByLocal: new Map(),
		propsName: base.names.claim('sharedProps'),
		settersById,
		statesById,
		statesByName,
		storeKeys: new Map(),
	};
	for (const cell of definition.cells) {
		if (cell.kind === 'state') {
			const state = statesById.get(cell.graphNodeId)!;
			const persistence = sharedContext.persistenceByGraph.get(cell.graphNodeId);
			const elements: Array<t.Node | null> = [t.identifier(cell.name)];
			const setter = settersById.get(cell.graphNodeId);
			if (setter) elements.push(t.identifier(setter));
			body.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.arrayPattern(elements),
						t.callExpression(
							api(base, state.storage === 'signal' ? 'createSignal' : 'createStore'),
							[
								persistence
									? persistenceSeed(persistence)
									: expression(cell.initializer),
							],
						),
					),
				]),
			);
		} else {
			body.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier(cell.name),
						rewriteExpressionAst(expression(cell.expression), sharedContext),
					),
				]),
			);
		}
	}
	for (const method of definition.methods)
		body.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(method.name),
					sharedMethodArrow(definition, method, sharedContext),
				),
			]),
		);
	const properties = definition.returnProperties.map((property) => {
		return t.objectProperty(
			t.identifier(property.name),
			t.identifier(property.name),
			false,
			true,
		);
	});
	body.push(t.returnStatement(t.objectExpression(properties)));
	const output: t.Statement[] = [
		t.functionDeclaration(t.identifier(names.createShared), [], t.blockStatement(body)),
	];
	if (definition.scope === 'page') {
		output.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(names.moduleShared),
					t.callExpression(t.identifier(names.createShared), []),
				),
			]),
			t.functionDeclaration(
				t.identifier(definition.name),
				[],
				t.blockStatement([t.returnStatement(t.identifier(names.moduleShared))]),
			),
		);
		return output;
	}
	output.push(
		t.variableDeclaration('const', [
			t.variableDeclarator(
				t.identifier(names.context),
				t.callExpression(api(base, 'createContext'), []),
			),
		]),
		t.functionDeclaration(
			t.identifier(definition.name),
			[],
			t.blockStatement([
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier('value'),
						t.callExpression(api(base, 'useContext'), [t.identifier(names.context)]),
					),
				]),
				t.ifStatement(
					{
						type: 'UnaryExpression',
						operator: '!',
						prefix: true,
						argument: t.identifier('value'),
					},
					t.blockStatement([
						{
							type: 'ThrowStatement',
							argument: {
								type: 'NewExpression',
								callee: t.identifier('Error'),
								arguments: [
									t.stringLiteral(`${definition.name} is missing its provider`),
								],
							},
						},
					]),
				),
				t.returnStatement(t.identifier('value')),
			]),
		),
	);
	const providerProps = new NameAllocator(['value', names.createShared]).claim('props');
	const providerName = t.jsxIdentifier(`${names.context}.Provider`);
	output.push(
		t.exportNamedDeclaration(
			t.functionDeclaration(
				t.identifier(names.provider),
				[t.identifier(providerProps)],
				t.blockStatement([
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.identifier('value'),
							t.callExpression(t.identifier(names.createShared), []),
						),
					]),
					t.returnStatement(
						t.jsxElement(
							t.jsxOpeningElement(
								providerName,
								[jsxAttribute('value', t.identifier('value'))],
								false,
							),
							t.jsxClosingElement(t.cloneNode(providerName)),
							[
								t.jsxExpressionContainer(
									member(t.identifier(providerProps), 'children'),
								),
							],
							false,
						),
					),
				]),
			),
		),
	);
	return output;
}

function compositionComponent(
	ir: EnrichedIR,
	component: EnrichedComponent,
	base: EmitContext,
	sharedNames: ReadonlyMap<string, CompositionNames>,
	exportedNames: ReadonlyMap<string, string>,
): t.Statement {
	const body: t.Statement[] = [];
	const componentNames = new NameAllocator([
		...componentAuthoredNames(ir, component),
		...base.api.values(),
		...ir.imports.map((entry) => entry.localName),
		...ir.components.map((entry) => entry.name),
		...ir.records.sharedDefinitions.map((entry) => entry.name),
		...[...sharedNames.values()].flatMap((entry) => Object.values(entry)),
	]);
	const propsName = componentNames.claim('props');
	const sharedLocals = new Map<string, SharedDefinition>();
	for (const instance of ir.records.sharedInstances.filter(
		(record) => record.componentId === component.id,
	)) {
		const definition = ir.records.sharedDefinitions.find(
			(candidate) => candidate.id === instance.definitionId,
		)!;
		sharedLocals.set(instance.localName, definition);
	}
	const directiveNames = new Map<string, string>();
	for (const hostId of new Set(
		ir.records.behaviors
			.filter((behavior) => behavior.componentId === component.id)
			.map((behavior) => behavior.hostNodeId),
	))
		directiveNames.set(hostId, componentNames.claim('attachHost'));
	const componentBindings = ir.records.bindings.filter(
		(binding) => binding.componentId === component.id,
	);
	const storeKeys = collectStoreKeys(component);
	const statesById = new Map<string, StateBinding>();
	const statesByName = new Map<string, StateBinding>();
	for (const binding of componentBindings.filter((entry) => entry.kind === 'state')) {
		const storage: StateBinding['storage'] =
			binding.valueKind === 'object' ||
			binding.valueKind === 'array' ||
			storeKeys.has(binding.id)
				? 'store'
				: 'signal';
		const mapped = { ...binding, storage } as StateBinding;
		statesById.set(mapped.id, mapped);
		statesByName.set(mapped.name, mapped);
	}
	const settersById = new Map<string, string>();
	for (const state of statesById.values())
		if (state.writes.length > 0)
			settersById.set(state.id, componentNames.claim(setterBase(state.name)));
	const componentBase: EmitContext = {
		...base,
		names: componentNames,
		bindingsById: new Map(componentBindings.map((binding) => [binding.id, binding])),
		computedByName: new Map(
			componentBindings
				.filter((binding) => binding.kind === 'computed')
				.map((binding) => [binding.name, binding]),
		),
		lexicalNames: new Set(),
		propsByLocal: new Map(component.props.entries.map((entry) => [entry.localName, entry])),
		propsName,
		settersById,
		statesById,
		statesByName,
		storeKeys,
	};
	const context: CompositionContext = {
		ir,
		component,
		base: componentBase,
		propsName,
		sharedLocals,
		sharedNames,
		directiveNames,
	};
	for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
		const handle = ir.records.elementHandleBindings.find(
			(binding) =>
				binding.componentId === component.id && local.names.includes(binding.handleName),
		);
		if (handle) {
			body.push(
				t.variableDeclaration('let', [
					t.variableDeclarator(t.identifier(handle.handleName), null),
				]),
			);
			continue;
		}
		const definition = sharedLocals.get(local.names[0]!);
		if (definition) {
			body.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier(local.names[0]!),
						t.callExpression(t.identifier(definition.name), []),
					),
				]),
			);
			continue;
		}
		const state = local.semanticRecordIds.map((id) => statesById.get(id)).find(Boolean);
		if (state) {
			const persistence = componentBase.persistenceByGraph.get(state.id);
			const elements: Array<t.Node | null> = [t.identifier(state.name)];
			const setter = settersById.get(state.id);
			if (setter) elements.push(t.identifier(setter));
			body.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.arrayPattern(elements),
						t.callExpression(
							api(
								componentBase,
								state.storage === 'signal' ? 'createSignal' : 'createStore',
							),
							[
								persistence
									? persistenceSeed(persistence)
									: rewriteCompositionExpression(state.initializer!, context),
							],
						),
					),
				]),
			);
			continue;
		}
		if (local.initializer)
			body.push(
				t.variableDeclaration(local.declarationKind, [
					t.variableDeclarator(
						structuredClone(local.pattern),
						rewriteCompositionExpression(local.initializer, context),
					),
				]),
			);
	}
	for (const [hostId, directiveName] of directiveNames) {
		const behaviors = ir.records.behaviors
			.filter(
				(behavior) =>
					behavior.componentId === component.id && behavior.hostNodeId === hostId,
			)
			.sort((left, right) => left.order - right.order);
		const cleanupNames = behaviors.map(() => componentNames.claim('cleanup'));
		const directiveBody: t.Statement[] = [];
		type BehaviorCapture = {
			readonly current: t.Expression;
			readonly name: string;
			readonly nextName: string;
		};
		type BehaviorPlan = {
			readonly behavior: (typeof behaviors)[number];
			readonly call: t.Expression;
			readonly captures: readonly BehaviorCapture[];
			readonly changedName: string | null;
			readonly cleanupName: string;
		};
		const plans: BehaviorPlan[] = [];
		for (const [index, behavior] of behaviors.entries()) {
			const captures = new Map<string, string>();
			const behaviorCaptures: BehaviorCapture[] = [];
			for (const input of behavior.inputs) {
				const state = statesById.get(input.graphNodeId);
				if (!state || captures.has(state.name)) continue;
				const capture = componentNames.claim(`${state.name}Input`);
				captures.set(state.name, capture);
				const current =
					state.storage === 'signal'
						? t.callExpression(t.identifier(state.name), [])
						: pathMember(t.identifier(state.name), input.path);
				behaviorCaptures.push({
					current,
					name: capture,
					nextName: componentNames.claim(`${capture}Next`),
				});
			}
			const behaviorExpression = captureBehaviorInputs(
				rewriteCompositionExpression(behavior.behavior, context),
				captures,
			);
			const behaviorCall = t.callExpression(behaviorExpression, [t.identifier('node')]);
			plans.push({
				behavior,
				call: behaviorCall,
				captures: behaviorCaptures,
				changedName: behaviorCaptures.length
					? componentNames.claim('behaviorChanged')
					: null,
				cleanupName: cleanupNames[index]!,
			});
		}
		for (const plan of plans) {
			for (const capture of plan.captures)
				directiveBody.push(
					t.variableDeclaration('let', [
						t.variableDeclarator(t.identifier(capture.name), capture.current),
					]),
				);
			if (plan.behavior.returnsCleanup)
				directiveBody.push(
					t.variableDeclaration('let', [
						t.variableDeclarator(
							t.identifier(plan.cleanupName),
							t.identifier('undefined'),
						),
					]),
					t.expressionStatement(
						t.assignmentExpression('=', t.identifier(plan.cleanupName), plan.call),
					),
				);
			else directiveBody.push(t.expressionStatement(plan.call));
		}
		const trackedPlans = plans.filter((plan) => plan.captures.length > 0);
		if (trackedPlans.length > 0) {
			const readyName = componentNames.claim('behaviorInputsReady');
			directiveBody.push(
				t.variableDeclaration('let', [
					t.variableDeclarator(t.identifier(readyName), t.booleanLiteral(false)),
				]),
			);
			const effectBody: t.Statement[] = [];
			for (const plan of trackedPlans) {
				for (const capture of plan.captures)
					effectBody.push(
						t.variableDeclaration('const', [
							t.variableDeclarator(t.identifier(capture.nextName), capture.current),
						]),
					);
				const changes = plan.captures.map((capture) =>
					t.binaryExpression(
						'!==',
						t.identifier(capture.nextName),
						t.identifier(capture.name),
					),
				);
				let changed = changes[0]!;
				for (const change of changes.slice(1))
					changed = t.logicalExpression('||', changed, change);
				effectBody.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(t.identifier(plan.changedName!), changed),
					]),
				);
			}
			effectBody.push(
				t.ifStatement(
					t.unaryExpression('!', t.identifier(readyName)),
					t.blockStatement([
						t.expressionStatement(
							t.assignmentExpression(
								'=',
								t.identifier(readyName),
								t.booleanLiteral(true),
							),
						),
						t.returnStatement(null),
					]),
				),
			);
			for (const plan of [...trackedPlans].reverse()) {
				if (!plan.behavior.returnsCleanup) continue;
				effectBody.push(
					t.ifStatement(
						t.logicalExpression(
							'&&',
							t.identifier(plan.changedName!),
							t.binaryExpression(
								'===',
								t.unaryExpression('typeof', t.identifier(plan.cleanupName)),
								t.stringLiteral('function'),
							),
						),
						t.blockStatement([
							t.expressionStatement(
								t.callExpression(t.identifier(plan.cleanupName), []),
							),
							t.expressionStatement(
								t.assignmentExpression(
									'=',
									t.identifier(plan.cleanupName),
									t.identifier('undefined'),
								),
							),
						]),
					),
				);
			}
			for (const plan of trackedPlans)
				for (const capture of plan.captures)
					effectBody.push(
						t.expressionStatement(
							t.assignmentExpression(
								'=',
								t.identifier(capture.name),
								t.identifier(capture.nextName),
							),
						),
					);
			for (const plan of trackedPlans)
				effectBody.push(
					t.ifStatement(
						t.identifier(plan.changedName!),
						t.blockStatement([
							plan.behavior.returnsCleanup
								? t.expressionStatement(
										t.assignmentExpression(
											'=',
											t.identifier(plan.cleanupName),
											plan.call,
										),
									)
								: t.expressionStatement(plan.call),
						]),
					),
				);
			directiveBody.push(
				t.expressionStatement(
					t.callExpression(api(componentBase, 'createEffect'), [
						t.arrowFunctionExpression([], t.blockStatement(effectBody)),
					]),
				),
			);
		}
		const cleanupBody: t.Statement[] = [];
		for (let index = behaviors.length - 1; index >= 0; index -= 1) {
			if (!behaviors[index]!.returnsCleanup) continue;
			cleanupBody.push(
				t.ifStatement(
					t.binaryExpression(
						'===',
						{
							type: 'UnaryExpression',
							operator: 'typeof',
							prefix: true,
							argument: t.identifier(cleanupNames[index]!),
						},
						t.stringLiteral('function'),
					),
					t.blockStatement([
						t.expressionStatement(
							t.callExpression(t.identifier(cleanupNames[index]!), []),
						),
						t.expressionStatement(
							t.assignmentExpression(
								'=',
								t.identifier(cleanupNames[index]!),
								t.identifier('undefined'),
							),
						),
					]),
				),
			);
		}
		if (cleanupBody.length)
			directiveBody.push(
				t.expressionStatement(
					t.callExpression(api(componentBase, 'onCleanup'), [
						t.arrowFunctionExpression([], t.blockStatement(cleanupBody)),
					]),
				),
			);
		body.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(directiveName),
					t.arrowFunctionExpression(
						[t.identifier('node')],
						t.blockStatement([
							t.expressionStatement(
								t.callExpression(api(componentBase, 'onMount'), [
									t.arrowFunctionExpression([], t.blockStatement(directiveBody)),
								]),
							),
						]),
					),
				),
			]),
		);
	}
	body.push(t.returnStatement(expressionFromCompositionNodes(component.template, context)));
	const declaration = t.functionDeclaration(
		t.identifier(component.name),
		component.props.entries.length > 0 ||
			ir.records.handleForwards.some((forward) => forward.childComponentId === component.id)
			? [t.identifier(propsName)]
			: [],
		t.blockStatement(body),
	);
	return exportedNames.has(component.name) ? t.exportNamedDeclaration(declaration) : declaration;
}

function emitComposition(ir: EnrichedIR): string {
	const allocator = new NameAllocator(compositionAuthoredNames(ir));
	const apiNames = new Map<ApiName, string>();
	for (const name of [
		'createSignal',
		'createStore',
		'produce',
		'reconcile',
		'untrack',
		'For',
		'Show',
		'createContext',
		'useContext',
		'createEffect',
		'onMount',
		'onCleanup',
	] as const)
		apiNames.set(name, allocator.claim(name));
	const persistenceWrites = { emitted: false };
	const base: EmitContext = {
		api: apiNames,
		bindingsById: new Map(),
		computedByName: new Map(),
		events: new Map(ir.records.events.map((event) => [event.id, event])),
		imports: new Set(),
		lexicalNames: new Set(),
		names: allocator,
		persistenceByGraph: new Map(
			ir.records.persistence.map((record) => [record.graphNodeId, record]),
		),
		persistenceWrites,
		propsByLocal: new Map(),
		propsName: allocator.claim('moduleProps'),
		settersById: new Map(),
		statesById: new Map(),
		statesByName: new Map(),
		storeKeys: new Map(),
	};
	const sharedNames = new Map<string, CompositionNames>();
	for (const definition of ir.records.sharedDefinitions) {
		const stem = sharedStem(definition);
		sharedNames.set(definition.id, {
			context: allocator.claim(withGeneratedSuffix(stem, 'Context')),
			provider: allocator.claim(withGeneratedSuffix(stem, 'Provider')),
			createShared: allocator.claim(`create${withGeneratedSuffix(stem, 'Shared')}`),
			moduleShared: allocator.claim(
				lowercaseFirst(withGeneratedSuffix(stem, 'Shared')),
			),
		});
	}
	const declarations: t.Statement[] = [];
	for (const imported of ir.imports) {
		if (imported.kind !== 'named')
			throw new Error(`ModuleImport ${imported.localName} has unsupported import kind`);
		declarations.push(
			t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(imported.localName),
						t.identifier(imported.importedName!),
					),
				],
				t.stringLiteral(imported.source.replace(/\.tsrx$/, '.jsx')),
			),
		);
	}
	for (const definition of ir.records.sharedDefinitions)
		declarations.push(
			...emitSharedFamily(ir, definition, sharedNames.get(definition.id)!, base),
		);
	const exportedNames = new Map(
		ir.module.exports.map((entry) => [entry.componentName, entry.exportedName]),
	);
	for (const component of ir.components)
		declarations.push(compositionComponent(ir, component, base, sharedNames, exportedNames));
	const imports: t.Statement[] = [];
	const addImport = (source: string, candidates: ApiName[]): void => {
		const names = candidates.filter((name) => base.imports.has(name));
		if (names.length)
			imports.push(
				t.importDeclaration(
					names.map((name) =>
						t.importSpecifier(t.identifier(base.api.get(name)!), t.identifier(name)),
					),
					t.stringLiteral(source),
				),
			);
	};
	addImport('solid-js', [
		'createSignal',
		'untrack',
		'For',
		'Show',
		'createContext',
		'useContext',
		'createEffect',
		'onMount',
		'onCleanup',
	]);
	addImport('solid-js/store', ['createStore', 'produce', 'reconcile']);
	const programBody = [...imports, ...declarations];
	if (persistenceWrites.emitted) {
		let lastImport = -1;
		programBody.forEach((statement, index) => {
			if (statement.type === 'ImportDeclaration') lastImport = index;
		});
		programBody.splice(lastImport + 1, 0, persistenceHelperDeclaration());
	}
	const source = `// @generated by @frameless/solid; do not edit.\n// Solid event batching exposes final post-dispatch state while preserving authored write order (T004b); no deferred notifications are needed.\n${printTopLevel(t.program(programBody))}\n`;
	const verified = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	if (verified.diagnostics.length)
		throw new Error(
			`Emitted Solid composition module failed output verification: ${verified.diagnostics.map((item) => item.message).join('; ')}`,
		);
	return source;
}

/** Emit one Solid 1.x-compatible .jsx module from frameless-enriched-ir/2. */
export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	if (hasComposition(ir)) return emitComposition(ir);
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
		if (state.storage !== 'local' && state.writes.length > 0)
			settersById.set(state.id, allocator.claim(setterBase(state.name)));
	const propsBinding = ir.records.bindings.find(
		(binding) => binding.id === component.props.graphNodeId,
	);
	if (!propsBinding)
		throw new Error(
			`ComponentProps has dangling graph record id: ${component.props.graphNodeId}`,
		);
	const persistenceWrites = { emitted: false };
	const context: EmitContext = {
		api: apiNames,
		bindingsById: new Map(ir.records.bindings.map((binding) => [binding.id, binding])),
		computedByName: new Map(
			ir.records.bindings
				.filter((binding) => binding.kind === 'computed')
				.map((binding) => [binding.name, binding]),
		),
		events: new Map(ir.records.events.map((event) => [event.id, event])),
		imports: new Set(),
		lexicalNames: new Set(),
		names: allocator,
		persistenceByGraph: new Map(
			ir.records.persistence.map((record) => [record.graphNodeId, record]),
		),
		persistenceWrites,
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
	if (persistenceWrites.emitted) declarations.push(persistenceHelperDeclaration());
	declarations.push(exported);
	const source = `// @generated by @frameless/solid; do not edit.\n${printTopLevel(t.program(declarations))}\n`;
	const verified = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	if (verified.diagnostics.length) {
		throw new Error(
			`Emitted Solid module failed output verification: ${verified.diagnostics.map((item) => item.message).join('; ')}`,
		);
	}
	return source;
}
