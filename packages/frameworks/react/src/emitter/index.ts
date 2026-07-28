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

type StateBinding = EnrichedGraphBinding & { storage: 'state' | 'ref' };
type EmitContext = {
	readonly ir: EnrichedIR;
	readonly componentId: string;
	readonly statesById: ReadonlyMap<string, StateBinding>;
	readonly events: ReadonlyMap<string, EnrichedEventRecord>;
	readonly currentNames: ReadonlyMap<string, string>;
	readonly hookNames: ReadonlyMap<ReactHook, string>;
	readonly nextNames: ReadonlyMap<string, string>;
	readonly setterNames: ReadonlyMap<string, string>;
	readonly setupRefName: string;
	readonly handleNames: ReadonlyMap<string, string>;
	readonly hostRefNames: ReadonlyMap<string, string>;
	readonly edgeRefNames: ReadonlyMap<string, string>;
	readonly sharedPropRoutes: ReadonlyMap<string, SharedPropRoute>;
	readonly edgeSharedProps: ReadonlyMap<string, ReadonlyArray<{ name: string; value: string }>>;
	readonly sharedHookNames: ReadonlyMap<string, string>;
	readonly names: NameAllocator;
	readonly persistenceWrites: { emitted: boolean };
};
type ReactHook =
	| 'createContext'
	| 'useCallback'
	| 'useContext'
	| 'useRef'
	| 'useState'
	| 'useSyncExternalStore';
type SharedPropRoute = {
	readonly rootComponentId: string;
	readonly consumerComponentIds: ReadonlySet<string>;
	readonly edgeIds: ReadonlySet<string>;
	readonly propName: string;
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

/**
 * THE SCRATCH WRAPPER IS ASYNC ON PURPOSE - see docs/DEFECTS.md entry 12, T047.
 *
 * This builds a throwaway arrow purely to get scope analysis out of
 * `reanalyzeFunction`, splices the transformed node back out, and discards the
 * wrapper - it NEVER reaches output. It used to be synchronous, which meant any
 * statement containing an `await` re-parsed in non-async context, where `await`
 * is a reserved identifier. THE WITNESSED RED, verbatim, on an authored async
 * handler:
 *
 *     yuku-analyzer rejected emitted handler: 'await' is reserved in an
 *     async/module context and cannot be used as an identifier; Expected a
 *     semicolon or an implicit semicolon after a statement, but found 'ready'
 *
 * Thrown from `reanalyzeFunction` <- here <- `replaceVersionReads` <-
 * `toConstSsa`, so the React emitter could not emit ANY handler containing
 * `await`. Measured against the same `yuku-analyzer` the emitter uses:
 *
 *     wrapper async=false: diagnostics=2  unresolved=[]
 *     wrapper async=true:  diagnostics=0  unresolved=[phase,ready]
 *
 * The `unresolved=[]` on the sync wrapper is the part to read twice: had the
 * diagnostic ever been suppressed rather than fixed, free-name replacement would
 * have silently done NOTHING. So the throw above must stay loud.
 *
 * It cannot change any existing output: in `sourceType: 'module'` - which is what
 * `reanalyzeFunction` analyzes under - `await` is ALREADY reserved as an
 * identifier, so no body that parses today parses differently under an async
 * wrapper. The falsifier is cheap and it is in this card's verify:
 * `regenerate.ts` plus `git diff --exit-code -- generated`.
 *
 * The flag is set here rather than in `estree.ts`'s `arrowFunctionExpression`
 * because this is the ONLY wrapper that is thrown away; every other arrow that
 * helper builds is real output whose `async` must stay false.
 */
function replaceFreeNames(node: t.Node, replacements: ReadonlyMap<string, string>): void {
	const statement = t.isStatement(node);
	const fn = t.arrowFunctionExpression(
		[],
		statement ? t.blockStatement([t.cloneNode(node, true)]) : t.cloneNode(node, true),
	);
	fn.async = true;
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
	if (ir.components.length === 0)
		throw new Error('React emitter requires at least one component per IR artifact');
	for (const component of ir.components) {
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
		keys('ComponentEvaluationPolicy', component.evaluation, [
			'ordinaryLocals',
			'computedBindings',
		]);
		keys('ComponentProps', component.props, ['graphNodeId', 'entries']);
		if (
			component.evaluation.ordinaryLocals !== 'once-per-instance' ||
			component.evaluation.computedBindings !== 'reactive'
		)
			throw new Error(`Unsupported evaluation policy for ${component.name}`);
	}
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
		'handleForwards',
		'behaviors',
		'handleCalls',
		'persistence',
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
	for (const exported of ir.module.exports) {
		if (!ir.components.some((component) => component.name === exported.componentName))
			throw new Error(`ComponentExport has unknown component: ${exported.componentName}`);
	}
	const bindingIds = new Set(ir.records.bindings.map((binding) => binding.id));
	const sharedGraphIds = new Set(
		ir.records.sharedDefinitions.flatMap((definition) => definition.graphBindings),
	);
	const componentIds = new Set(ir.components.map((entry) => entry.id));
	const validateComponentId = (construct: string, componentId: unknown): void => {
		if (typeof componentId !== 'string' || !componentIds.has(componentId))
			throw new Error(`${construct} has unknown component id: ${String(componentId)}`);
	};
	for (const component of ir.components)
		for (const entry of component.props.entries) {
			keys('PropDestructuringEntry', entry, [
				'sourceName',
				'localName',
				'path',
				'alias',
				'graphNodeId',
				'defaultValue',
				// IR-8. ADMITTED AND SHAPE-CHECKED, DELIBERATELY NOT PRINTED YET.
				// This emitter is one of exactly TWO that reject an unknown nested
				// key on this construct - qwik, svelte, vue and angular accept it
				// silently - so admitting it here is what lets the field exist at
				// all. Printing it is a later step. The .jsx -> .tsx migration that
				// used to block it HAS LANDED - TS8010 forbids a type annotation in
				// a .jsx file and this emitter now writes .tsx - so the remaining
				// work is the printing itself, not the extension.
				'type',
				// IR-8 REQUIREDNESS, ADMITTED AND SHAPE-CHECKED, NOT PRINTED HERE.
				// Supplied beside `type` from the same `TSPropertySignature`, so
				// this lane admits it for the same reason it admits `type`: the
				// field cannot exist at all unless the two validators that reject
				// unknown nested keys let it through. The Vue lane consumes it -
				// its runtime prop declarations need requiredness to express a
				// contract - while React reads props positionally out of a
				// destructured parameter and has nothing to do with the flag yet.
				'optional',
			]);
			if (
				entry.type !== undefined &&
				(typeof entry.type !== 'object' ||
					entry.type === null ||
					typeof (entry.type as { type?: unknown }).type !== 'string')
			)
				throw new Error(
					`PropDestructuringEntry has malformed type annotation AST: ${entry.localName}`,
				);
			if (entry.optional !== undefined && typeof entry.optional !== 'boolean')
				throw new Error(
					`PropDestructuringEntry has malformed optional flag: ${entry.localName}`,
				);
			// Requiredness and type have ONE supply site and are read from one
			// member, so `optional` without `type` is requiredness invented
			// downstream rather than reported from source.
			if (entry.optional !== undefined && entry.type === undefined)
				throw new Error(
					`PropDestructuringEntry declares optionality without a type annotation: ${entry.localName}`,
				);
			const alias = ir.records.aliases.find(
				(record) => record.componentId === component.id && record.name === entry.localName,
			);
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
			throw new Error(`Persistence record has no React state binding: ${record.graphNodeId}`);
		if ((binding ?? sharedCell)!.name !== record.bindingName)
			throw new Error(`Persistence record binding name does not match ${record.graphNodeId}`);
	}
	for (const component of ir.components)
		if (
			component.props.entries.length > 0 &&
			!ir.records.bindings.some(
				(binding) =>
					binding.id === component.props.graphNodeId &&
					binding.componentId === component.id,
			)
		)
			throw new Error(
				`ComponentProps has dangling graph record id: ${component.props.graphNodeId}`,
			);
	const hostIds = new Set<string>();
	const validateRead = (
		read: Record<string, unknown>,
		construct: string,
		graphRead: boolean,
		behaviorInput = false,
	): void => {
		keys(
			construct,
			read,
			graphRead
				? ['graphNodeId', 'path', 'via', ...(behaviorInput ? ['provenance'] : [])]
				: ['componentId', 'graphNodeId', 'path'],
		);
		if (!graphRead) validateComponentId(construct, read.componentId);
		if (
			typeof read.graphNodeId !== 'string' ||
			(!bindingIds.has(read.graphNodeId) && !sharedGraphIds.has(read.graphNodeId))
		)
			throw new Error(
				`${construct} has dangling graph record id: ${String(read.graphNodeId)}`,
			);
		if (!Array.isArray(read.path) || read.path.some((part) => typeof part !== 'string'))
			throw new Error(`${construct} has malformed path`);
		if (graphRead && !['direct', 'alias', 'local', 'repeat-item'].includes(String(read.via)))
			throw new Error(`${construct} has unsupported read shape`);
		if (behaviorInput && !['layer-a', 'derived-from-ast'].includes(String(read.provenance)))
			throw new Error(`${construct} has unsupported provenance`);
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
			node.children.forEach(validateTemplate);
			return;
		}
		if (node.kind === 'default-slot-projection') {
			keys('TemplateDefaultSlotProjection', node, ['kind', 'id', 'site']);
			if (typeof node.id !== 'string' || !node.site || typeof node.site !== 'object')
				throw new Error('TemplateDefaultSlotProjection has malformed construct');
			validateExpressionSite('TemplateDefaultSlotProjection site', node.site);
			return;
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
	for (const component of ir.components)
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
	for (const component of ir.components)
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
	for (const component of ir.components) component.template.forEach(validateTemplate);
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
	const validateSharedWrite = (write: any, construct: string): void => {
		keys(construct, write, [
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
		]);
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
		if (write.value !== undefined) ast(`${construct} value`, write.value);
		write.arguments?.forEach((argument: unknown) => ast(`${construct} argument`, argument));
	};
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
			keys(
				'SharedDefinitionCell',
				cell,
				cell.kind === 'state'
					? ['kind', 'name', 'graphNodeId', 'valueKind', 'initializer']
					: ['kind', 'name', 'graphNodeId', 'expression', 'dependencies'],
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
			if (cell.kind === 'state') ast('SharedDefinitionCell initializer', cell.initializer);
			else ast('SharedDefinitionCell expression', cell.expression);
		}
		for (const method of definition.methods) {
			keys('SharedDefinitionMethod', method, ['name', 'site', 'writes']);
			if (typeof method.name !== 'string' || !Array.isArray(method.writes))
				throw new Error('SharedDefinitionMethod has malformed construct');
			ast('SharedDefinitionMethod site', method.site);
			method.writes.forEach((write: any) =>
				validateSharedWrite(write, 'SharedDefinitionMethod write'),
			);
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
	for (const write of ir.records.sharedWrites) validateSharedWrite(write, 'SharedWrite');
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
	const handleBindingIds = new Set(ir.records.elementHandleBindings.map((binding) => binding.id));
	for (const forward of ir.records.handleForwards) {
		keys('HandleForwardRecord', forward, [
			'handleBindingId',
			'edgeId',
			'childComponentId',
			'childHostNodeId',
		]);
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
		if (!handleBindingIds.has(call.handleBindingId))
			throw new Error(
				`HandleCallRecord has dangling ElementHandleBinding: ${call.handleBindingId}`,
			);
		if (call.eventId && !eventIds.has(call.eventId))
			throw new Error(`HandleCallRecord has dangling event: ${call.eventId}`);
	}
	const definitionIds = new Set(ir.records.sharedDefinitions.map((entry) => entry.id));
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
	for (const definition of ir.records.sharedDefinitions) {
		const instances = ir.records.sharedInstances.filter(
			(instance) => instance.definitionId === definition.id,
		);
		if (instances.length === 0)
			throw new Error(`SharedDefinition ${definition.name} has no SharedInstance records`);
		const methodNames = new Set(definition.methods.map((method) => method.name));
		for (const call of ir.records.sharedCalls.filter(
			(call) => call.definitionId === definition.id,
		))
			if (!methodNames.has(call.methodName))
				throw new Error(`SharedCall has unknown method ${call.methodName}`);
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
	for (const behavior of ir.records.behaviors)
		if (!hostIds.has(behavior.hostNodeId))
			throw new Error(`BehaviorRecord has dangling host: ${behavior.hostNodeId}`);
	for (const handle of ir.records.elementHandleBindings)
		if (!hostIds.has(handle.hostNodeId))
			throw new Error(`ElementHandleBinding has dangling host: ${handle.hostNodeId}`);
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
	for (const imported of ir.imports)
		if (imported.resolvesTo !== 'tsrx-module')
			throw new Error(
				`ModuleImport cannot be lowered without tsrx-module resolution: ${imported.source}`,
			);
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
	for (const component of ir.components) {
		names.add(component.name);
		for (const local of component.locals) local.names.forEach((name) => names.add(name));
	}
	for (const imported of ir.imports) names.add(imported.localName);
	for (const definition of ir.records.sharedDefinitions) {
		names.add(definition.name);
		definition.cells.forEach((cell) => names.add(cell.name));
		definition.methods.forEach((method) => names.add(method.name));
	}
	for (const handle of ir.records.elementHandleBindings) names.add(handle.handleName);
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
	for (const entry of component.props.entries) names.add(entry.localName);
	for (const local of component.locals) local.names.forEach((name) => names.add(name));
	return names;
}
const hookName = (context: EmitContext, hook: ReactHook): string => context.hookNames.get(hook)!;
const setterFor = (context: EmitContext, state: StateBinding): string =>
	context.setterNames.get(state.id)!;
const nextFor = (context: EmitContext, state: StateBinding): string =>
	context.nextNames.get(state.id)!;
const member = (object: t.Expression, property: string): t.MemberExpression =>
	t.memberExpression(object, t.identifier(property));

function persistenceForGraph(
	context: EmitContext,
	graphNodeId: string,
): FramelessPersistenceRecord | undefined {
	return context.ir.records.persistence.find((record) => record.graphNodeId === graphNodeId);
}

function persistenceSeed(record: FramelessPersistenceRecord): t.Expression {
	if (!record.access.render) return t.stringLiteral(record.authoredInitial);
	if (record.seed.lowering !== 'pre-paint') return t.stringLiteral(record.authoredInitial);
	const landing = record.seed.landings.find(
		(candidate) =>
			candidate.target === 'react' &&
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

function referencedGraphIds(
	component: EnrichedComponent,
	records: EnrichedIR['records'],
): Set<string> {
	const ids = new Set<string>();
	walk({ guards: component.guards, template: component.template }, (record) => {
		if (typeof record.graphNodeId === 'string') ids.add(record.graphNodeId);
	});
	for (const binding of records.bindings) {
		if (binding.componentId === component.id && binding.kind === 'computed') {
			for (const read of binding.computed?.reads ?? []) ids.add(read.graphNodeId);
		}
	}
	for (const behavior of records.behaviors)
		if (behavior.componentId === component.id)
			for (const input of behavior.inputs) ids.add(input.graphNodeId);
	return ids;
}

function identifierIsUsed(ir: EnrichedIR, component: EnrichedComponent, name: string): boolean {
	let used = false;
	walk(
		{
			guards: component.guards,
			template: component.template,
			events: ir.records.events.filter((event) => event.componentId === component.id),
			bindings: ir.records.bindings.filter((binding) => binding.componentId === component.id),
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

/**
 * REACT'S CANONICAL PROP SPELLINGS. `class` and `for` are the two everyone knows.
 * The other three are T051's repair, and they are the same defect one layer down.
 *
 * THE DEFECT. `DOM_BOOLEAN_CONTENT_ATTRIBUTES` in `@frameless/compiler` admits
 * fourteen names, on an admission rule that asked what the DOM accepts. Three of
 * them - `autofocus`, `autoplay`, `readonly` - are not react props at all, so
 * react-dom 19.2.3 SERVED NOTHING IN BOTH STATES and raised
 * `console.error: Invalid DOM property \`readonly\`. Did you mean \`readOnly\`?`,
 * where the other five lanes served the attribute. MEASURED, both states, at
 * react-dom 19.2.3, on the element each name is defined on:
 *
 *   readonly={true}  -> <input/>                 + console.error
 *   readOnly={true}  -> <input readOnly=""/>     silent, getAttribute -> ""
 *   disabled={true}  -> <button disabled=""/>    the unmoved control
 *
 * WHY THIS IS OURS AND NOT REACT'S. React supports all three under these names.
 * We emitted the wrong spelling. It is not an out-of-envelope test and was not
 * filed upstream.
 *
 * THE CONSOLE ERROR IS THE INSTRUMENT, NOT THE PROBLEM. `runScenario` requires
 * `consoleErrors: 0`, so any corpus fixture binding one of the three would have
 * gone red in the react lane - loudly and for the right reason. It stayed hidden
 * only because no fixture binds them. That budget was NOT weakened.
 *
 * react-dom raises it ONCE PER PROP NAME PER PROCESS, on whichever render comes
 * first, in EITHER state - measured in fresh processes rendering each state
 * first, because measuring it in one process reports the second state as silent
 * and makes the warning look state-dependent. It is not.
 *
 * COST, NAMED AND MEASURED, because it is not a clean win in bytes. React
 * serializes `autoFocus` down to lowercase `autofocus=""`, but `autoPlay` and
 * `readOnly` are written to the payload CAMELCASE - `<video autoPlay="">`. HTML
 * attribute names are case-insensitive to a parser, so `getAttribute('autoplay')`
 * reads `""` and this project's live-DOM oracle sees six equal lanes. But
 * `startTagCarriesAttribute` in the three-way contract matches served BYTES with
 * a case-sensitive regex, so a future scenario that reads the served payload in
 * the TRUE state would see react's `autoPlay=""` as absent. Today S9 reads served
 * bytes only in the FALSE state, where every lane is absent, so nothing observes
 * this. It is recorded here rather than discovered later.
 *
 * Registered two-sided in `test/emitter.test.ts`, where the map is asserted EQUAL
 * to the set of admitted names react-dom actually rejects - executed, not listed -
 * so a react version that renames a prop moves this map or goes red.
 *
 * @see docs/DEFECTS.md entry 13
 */
const REACT_PROP_SPELLINGS: ReadonlyMap<string, string> = new Map([
	['class', 'className'],
	['for', 'htmlFor'],
	['autofocus', 'autoFocus'],
	['autoplay', 'autoPlay'],
	['readonly', 'readOnly'],
]);

/** Exported for the two-sided registration in `test/emitter.test.ts`. */
export const reactPropSpellings = (): ReadonlyMap<string, string> => REACT_PROP_SPELLINGS;

function jsxName(name: string): string {
	return REACT_PROP_SPELLINGS.get(name) ?? name;
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
	if (node.kind === 'default-slot-projection')
		return t.jsxExpressionContainer(expression(node.site.expression));
	if (node.kind === 'component-reference') {
		const forwardedHandleName = context.ir.records.handleForwards
			.filter((forward) => forward.edgeId === node.edgeId)
			.map((forward) =>
				context.ir.records.elementHandleBindings.find(
					(binding) => binding.id === forward.handleBindingId,
				),
			)
			.find(Boolean)?.handleName;
		const attributes = node.props
			.filter((prop) => prop.name !== forwardedHandleName)
			.map((prop) =>
				t.jsxAttribute(
					t.jsxIdentifier(prop.name),
					t.jsxExpressionContainer(expression(prop.value.expression)),
				),
			);
		for (const prop of context.edgeSharedProps.get(node.edgeId) ?? [])
			attributes.push(
				t.jsxAttribute(
					t.jsxIdentifier(prop.name),
					t.jsxExpressionContainer(t.identifier(prop.value)),
				),
			);
		const forwarded = context.edgeRefNames.get(node.edgeId);
		if (forwarded)
			attributes.push(
				t.jsxAttribute(
					t.jsxIdentifier('ref'),
					t.jsxExpressionContainer(t.identifier(forwarded)),
				),
			);
		const name = t.jsxIdentifier(node.target.localName);
		const children = node.children.map((child) => templateNode(child, context));
		return t.jsxElement(
			t.jsxOpeningElement(name, attributes, children.length === 0),
			children.length === 0
				? null
				: t.jsxClosingElement(t.jsxIdentifier(node.target.localName)),
			children,
			children.length === 0,
		);
	}
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
				t.jsxStringValue(attribute.value === true ? '' : attribute.value),
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
	const hostRef = context.hostRefNames.get(node.id);
	if (hostRef)
		attributes.push(
			t.jsxAttribute(t.jsxIdentifier('ref'), t.jsxExpressionContainer(t.identifier(hostRef))),
		);
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

/** Node types that open a new function scope inside a handler body. */
const NESTED_FUNCTION_TYPES: ReadonlySet<string> = new Set([
	'ArrowFunctionExpression',
	'FunctionExpression',
	'FunctionDeclaration',
	'ObjectMethod',
	'ClassMethod',
]);

/**
 * `settle().then`, `defer`, `rows.forEach` - enough to point at ONE callback when
 * a handler has several. Best-effort by design: it returns '' rather than
 * guessing at a shape it does not recognise, and the caller falls back.
 */
function describeCallee(node: any): string {
	if (!node) return '';
	if (node.type === 'Identifier') return node.name;
	if (node.type === 'ThisExpression') return 'this';
	if (node.type === 'CallExpression') {
		const callee = describeCallee(node.callee);
		return callee ? `${callee}()` : '';
	}
	if (node.type === 'MemberExpression') {
		const object = describeCallee(node.object);
		if (!object) return '';
		if (node.computed) return `${object}[...]`;
		return t.isIdentifier(node.property) ? `${object}.${node.property.name}` : '';
	}
	return '';
}

/** Name the nested function a refused write sits in, so the author can find it. */
function describeNestedFunction(module: ReturnType<typeof analyze>, fn: any): string {
	const parent: any = module.parentOf(fn);
	if (parent?.type === 'CallExpression' && parent.arguments?.includes(fn)) {
		const callee = describeCallee(parent.callee);
		if (callee) return `the function passed to ${callee}(...)`;
	}
	if (parent?.type === 'Property' && parent.value === fn && t.isIdentifier(parent.key))
		return `the function assigned to "${parent.key.name}"`;
	if (parent?.type === 'VariableDeclarator' && t.isIdentifier(parent.id))
		return `the function assigned to "${parent.id.name}"`;
	if (fn.type === 'FunctionDeclaration' && t.isIdentifier(fn.id))
		return `the nested function "${fn.id.name}"`;
	return 'a nested function';
}

/**
 * FAIL CLOSED on a state write this emitter cannot lower.
 *
 * `emitMutableHandler` walks `fn.body.body` - the TOP-LEVEL statements of the
 * handler body - so a write inside any nested function (a `.then` continuation, a
 * callback prop, a side-effecting array method) was never a candidate for
 * lowering. It was copied through verbatim into the emitted output, where it
 * became an assignment to the `const` that `useState` destructured. `toConstSsa`
 * then made it worse for a state that ALSO has a top-level write: the nested
 * write TARGET was rewritten as if it were a version READ, so the emitter
 * manufactured an assignment to a name it had just frozen with `const`.
 *
 * Both are invalid TypeScript - `TS2588` - and both are dead at runtime, because
 * React re-renders off the setter and nothing called it. Neither was refused by
 * anything, and no instrument in this repo saw them: the corpus has never
 * contained a nested write.
 *
 * THIS REFUSES; IT DOES NOT LOWER. Lowering nested writes correctly is a design
 * change - the Solid emitter already does it and a later ruling can port that
 * approach. Until then a loud refusal is strictly better than a silent
 * miscompile, so the message names the write, the function it sits in, and the
 * output it prevented. See docs/DEFECTS.md entry 8 and T044.
 */
function assertLowerableWrites(
	module: ReturnType<typeof analyze>,
	analyzed: t.ArrowFunctionExpression,
	writable: ReadonlyMap<string, StateBinding>,
	event: EnrichedEventRecord,
): void {
	if (writable.size === 0) return;
	for (const reference of module.unresolvedReferences) {
		if (!writable.has(reference.name)) continue;
		// A write target may be the root of a member chain: `rows[0].label = x`.
		let node: any = reference.node;
		let parent: any = module.parentOf(node);
		while (parent?.type === 'MemberExpression' && parent.object === node) {
			node = parent;
			parent = module.parentOf(node);
		}
		const isWriteTarget =
			(parent?.type === 'AssignmentExpression' && parent.left === node) ||
			(parent?.type === 'UpdateExpression' && parent.argument === node);
		if (!isWriteTarget) continue;
		// The innermost function scope between the write and the handler itself.
		// None means the write is a top-level statement, which lowers correctly.
		let nested: any = null;
		let ancestor: any = parent;
		while (ancestor && ancestor !== analyzed) {
			if (!nested && NESTED_FUNCTION_TYPES.has(ancestor.type)) nested = ancestor;
			ancestor = module.parentOf(ancestor);
		}
		if (!nested) continue;
		const name = reference.name;
		throw new Error(
			`React emitter cannot lower the state write to "${name}" in ${event.id}: it is inside ` +
				`${describeNestedFunction(module, nested)}, and write-lowering rewrites ONLY the ` +
				`top level of a handler body. Emitting it would copy "${name} = ..." through ` +
				`verbatim, as an assignment to the const that useState destructured - which tsc ` +
				`rejects (TS2588 "Cannot assign to '${name}' because it is a constant") and which ` +
				`would not re-render even if it ran. Move the write to the top level of the ` +
				`handler body. Nested writes DO lower correctly in the Solid emitter; porting that ` +
				`is a design change this refusal deliberately does not make. See docs/DEFECTS.md ` +
				`entry 8.`,
		);
	}
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
	reanalyzeFunction(fn, (module, analyzed) => {
		// BEFORE any renaming, while the references still carry the AUTHORED state
		// names an author would recognise in the diagnostic.
		assertLowerableWrites(module, analyzed, writable, event);
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
			const version = count === 1 ? variable : context.names.claim(`${variable}${count}`);
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
			const version = count === 1 ? variable : context.names.claim(`${variable}${count}`);
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
	fn.body.body = fn.body.body.flatMap((statement: t.Statement) => {
		const variable = syncVariableName(statement, writable, context);
		if (!variable) return [statement];
		const state = writable.find((candidate) => nextFor(context, candidate) === variable);
		const persistence = state ? persistenceForGraph(context, state.id) : undefined;
		if (!state || !persistence) return [statement];
		const sync = (statement as t.ExpressionStatement).expression;
		const finalValue =
			state.storage === 'ref' ? (sync as any).right : (sync as any).arguments[0];
		return [statement, ...persistenceStatements(context, persistence, finalValue)];
	});
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
	const fn = toConstSsa(emitMutableHandler(handler, event, context), writable, context);
	if (leafControl) replaceLeafCurrentTarget(fn);
	return fn;
}

function emitEvent(
	event: EnrichedEventRecord,
	context: EmitContext,
	leafControl: boolean,
): t.ArrowFunctionExpression {
	const handleCalls = context.ir.records.handleCalls
		.filter((call) => call.componentId === context.componentId && call.eventId === event.id)
		.sort((left, right) => left.order - right.order);
	if (handleCalls?.length) {
		const statements = handleCalls.map((call) => {
			const handle = context.handleNames.get(call.handleBindingId);
			if (!handle)
				throw new Error(`HandleCallRecord has no emitted handle: ${call.handleBindingId}`);
			const current = member(t.identifier(handle), 'current');
			const invoke = t.callExpression(
				member(t.cloneNode(current), call.method),
				call.arguments.map(expression),
			);
			return t.ifStatement(
				t.binaryExpression('!==', t.cloneNode(current), t.nullLiteral()),
				t.blockStatement([t.expressionStatement(invoke)]),
			);
		});
		return t.arrowFunctionExpression([], t.blockStatement(statements));
	}
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

type SharedTier = 'props' | 'scalar-context' | 'object-context' | 'store';

function directComponentReferences(
	component: EnrichedComponent,
): Array<Extract<TemplateNode, { kind: 'component-reference' }>> {
	const nodes = component.template.flatMap((node) =>
		node.kind === 'fragment' ? node.children : [node],
	);
	return nodes.filter(
		(node): node is Extract<TemplateNode, { kind: 'component-reference' }> =>
			node.kind === 'component-reference' && node.target.module === 'self',
	);
}

function findPropsRoot(
	ir: EnrichedIR,
	definition: SharedDefinition,
): { root: EnrichedComponent; edges: string[]; consumers: string[] } | null {
	const consumers = [
		...new Set(
			ir.records.sharedInstances
				.filter((instance) => instance.definitionId === definition.id)
				.map((instance) => instance.componentId),
		),
	];
	if (consumers.length === 0) return null;
	for (const root of ir.components) {
		if (consumers.includes(root.id)) continue;
		const references = directComponentReferences(root);
		const edges: string[] = [];
		let complete = true;
		for (const consumerId of consumers) {
			const consumer = ir.components.find((component) => component.id === consumerId)!;
			const reference = references.find((node) => node.target.localName === consumer.name);
			if (!reference) {
				complete = false;
				break;
			}
			edges.push(reference.edgeId);
		}
		if (complete) return { root, edges, consumers };
	}
	return null;
}

function sharedTier(ir: EnrichedIR, definition: SharedDefinition): SharedTier {
	const stateCells = definition.cells.filter((cell) => cell.kind === 'state');
	if (definition.scope === 'page' || definition.methods.length > 0) return 'store';
	if (stateCells.length === 1 && stateCells[0]!.valueKind === 'scalar')
		return findPropsRoot(ir, definition) ? 'props' : 'scalar-context';
	const cellNames = new Set(
		definition.returnProperties
			.filter((item) => item.kind === 'graph')
			.map((item) => item.name),
	);
	const consumers = new Map<string, Set<string>>();
	for (const read of ir.records.sharedReads.filter(
		(item) => item.definitionId === definition.id,
	)) {
		const set = consumers.get(read.componentId) ?? new Set<string>();
		set.add(read.propertyName);
		consumers.set(read.componentId, set);
	}
	if (consumers.size > 0 && [...consumers.values()].every((set) => set.size === cellNames.size))
		return 'object-context';
	return 'store';
}

function sharedInstanceDeclaration(
	ir: EnrichedIR,
	component: EnrichedComponent,
	localName: string,
	definition: SharedDefinition,
	context: EmitContext,
): t.VariableDeclaration {
	const tier = sharedTier(ir, definition);
	const hook = context.sharedHookNames.get(definition.id)!;
	if (tier === 'props') {
		const route = context.sharedPropRoutes.get(definition.id);
		if (!route) throw new Error(`SharedDefinition ${definition.name} has no props-tier route`);
		const read = ir.records.sharedReads.find(
			(item) => item.definitionId === definition.id && item.componentId === component.id,
		);
		if (!read) throw new Error(`SharedInstance ${localName} has no SharedRead for props tier`);
		return t.variableDeclaration('const', [
			t.variableDeclarator(
				t.identifier(localName),
				t.objectExpression([
					t.objectProperty(t.identifier(read.propertyName), t.identifier(route.propName)),
				]),
			),
		]);
	}
	if (tier === 'object-context')
		return t.variableDeclaration('const', [
			t.variableDeclarator(t.identifier(localName), t.callExpression(t.identifier(hook), [])),
		]);
	const reads = ir.records.sharedReads.filter(
		(read) => read.definitionId === definition.id && read.componentId === component.id,
	);
	const calls = ir.records.sharedCalls.filter(
		(call) => call.definitionId === definition.id && call.componentId === component.id,
	);
	const properties: t.Node[] = [];
	for (const name of new Set(reads.map((read) => read.propertyName))) {
		properties.push(
			t.objectProperty(
				t.identifier(name),
				t.callExpression(
					t.identifier(hook),
					tier === 'store' ? [t.stringLiteral(name)] : [],
				),
			),
		);
	}
	for (const name of new Set(calls.map((call) => call.methodName))) {
		properties.push(
			t.objectProperty(
				t.identifier(name),
				member(t.callExpression(t.identifier(hook), [t.stringLiteral('store')]), name),
			),
		);
	}
	return t.variableDeclaration('const', [
		t.variableDeclarator(t.identifier(localName), t.objectExpression(properties)),
	]);
}

function sharedNames(definition: SharedDefinition, allocator: NameAllocator) {
	const stem =
		definition.name.startsWith('use') && definition.name.length > 3
			? definition.name.slice(3)
			: `${definition.name[0]!.toUpperCase()}${definition.name.slice(1)}`;
	return {
		context: allocator.claim(withGeneratedSuffix(stem, 'Context')),
		provider: allocator.claim(withGeneratedSuffix(stem, 'Provider')),
		createStore: allocator.claim(`create${withGeneratedSuffix(stem, 'Store')}`),
		moduleStore: allocator.claim(
			lowercaseFirst(withGeneratedSuffix(stem, 'Store')),
		),
		subscribeNothing: allocator.claim(
			`subscribe${withGeneratedSuffix(stem, 'ToNothing')}`,
		),
		getNothing: allocator.claim(`get${withGeneratedSuffix(stem, 'Nothing')}`),
	};
}

function withGeneratedSuffix(base: string, suffix: string): string {
	return base.endsWith(suffix) ? base : `${base}${suffix}`;
}

function lowercaseFirst(name: string): string {
	return `${name[0]!.toLowerCase()}${name.slice(1)}`;
}

function functionProperty(name: string, params: t.Node[], body: t.Statement[]): t.Node {
	return {
		type: 'Property',
		key: t.identifier(name),
		value: {
			type: 'FunctionExpression',
			id: null,
			params,
			body: t.blockStatement(body),
			async: false,
			generator: false,
			expression: false,
		},
		kind: 'init',
		method: true,
		computed: false,
		shorthand: false,
	};
}

function missingProviderGuard(valueName: string, definition: SharedDefinition): t.Statement {
	return t.ifStatement(
		t.binaryExpression('===', t.identifier(valueName), t.nullLiteral()),
		t.blockStatement([
			{
				type: 'ThrowStatement',
				argument: t.newExpression(t.identifier('Error'), [
					t.stringLiteral(`${definition.name} is missing its provider`),
				]),
			},
		]),
	);
}

function emitSharedDeclarations(
	ir: EnrichedIR,
	context: EmitContext,
	usedHooks: Set<ReactHook>,
): t.Statement[] {
	const output: t.Statement[] = [];
	for (const definition of ir.records.sharedDefinitions) {
		const tier = sharedTier(ir, definition);
		if (tier === 'props') continue;
		const names = sharedNames(definition, context.names);
		const hook = context.sharedHookNames.get(definition.id)!;
		const stateCells = definition.cells.filter((cell) => cell.kind === 'state');
		if (tier === 'scalar-context' || tier === 'object-context') {
			usedHooks.add('createContext');
			usedHooks.add('useContext');
			if (tier === 'object-context') usedHooks.add('useState');
			output.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier(names.context),
						t.callExpression(t.identifier(hookName(context, 'createContext')), [
							t.nullLiteral(),
						]),
					),
				]),
			);
			output.push(
				t.functionDeclaration(
					t.identifier(hook),
					[],
					t.blockStatement([
						t.variableDeclaration('const', [
							t.variableDeclarator(
								t.identifier('value'),
								t.callExpression(t.identifier(hookName(context, 'useContext')), [
									t.identifier(names.context),
								]),
							),
						]),
						missingProviderGuard('value', definition),
						t.returnStatement(t.identifier('value')),
					]),
				),
			);
			const objectProperties = definition.returnProperties
				.filter((property) => property.kind === 'graph')
				.map((property) => {
					const cell = definition.cells.find(
						(candidate) => candidate.graphNodeId === property.graphNodeId,
					);
					if (!cell)
						throw new Error(`SharedReturnProperty has no cell: ${property.name}`);
					const value =
						cell.kind === 'state'
							? t.identifier(cell.name)
							: unwrapSharedComputed(cell.expression);
					return t.objectProperty(t.identifier(property.name), value);
				});
			const initial =
				tier === 'scalar-context'
					? (() => {
							const cell = stateCells[0]!;
							const persistence = persistenceForGraph(context, cell.graphNodeId);
							return persistence
								? persistenceSeed(persistence)
								: expression(cell.initializer);
						})()
					: t.callExpression(
							t.arrowFunctionExpression(
								[],
								t.blockStatement([
									...stateCells.map((cell) =>
										t.variableDeclaration('const', [
											t.variableDeclarator(
												t.identifier(cell.name),
												persistenceForGraph(context, cell.graphNodeId)
													? persistenceSeed(
															persistenceForGraph(
																context,
																cell.graphNodeId,
															)!,
														)
													: expression(cell.initializer),
											),
										]),
									),
									t.returnStatement(t.objectExpression(objectProperties)),
								]),
							),
							[],
						);
			const providerBody: t.Statement[] = [];
			let providerValue = initial;
			if (tier === 'object-context') {
				providerBody.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.arrayPattern([t.identifier('value')]),
							t.callExpression(t.identifier(hookName(context, 'useState')), [
								t.arrowFunctionExpression([], initial),
							]),
						),
					]),
				);
				providerValue = t.identifier('value');
			}
			providerBody.push(
				t.returnStatement(
					t.jsxElement(
						t.jsxOpeningElement(
							t.jsxIdentifier(names.context),
							[
								t.jsxAttribute(
									t.jsxIdentifier('value'),
									t.jsxExpressionContainer(providerValue),
								),
							],
							false,
						),
						t.jsxClosingElement(t.jsxIdentifier(names.context)),
						[t.jsxExpressionContainer(t.identifier('children'))],
					),
				),
			);
			output.push(
				t.exportNamedDeclaration(
					t.functionDeclaration(
						t.identifier(names.provider),
						[
							t.objectPattern([
								t.objectProperty(
									t.identifier('children'),
									t.identifier('children'),
									false,
									true,
								),
							]),
						],
						t.blockStatement(providerBody),
					),
				),
			);
			continue;
		}
		usedHooks.add('useSyncExternalStore');
		if (definition.scope !== 'page') {
			usedHooks.add('createContext');
			usedHooks.add('useContext');
			usedHooks.add('useState');
		}
		output.push(createStoreDeclaration(definition, names.createStore, context));
		if (definition.scope === 'page')
			output.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier(names.moduleStore),
						t.callExpression(t.identifier(names.createStore), []),
					),
				]),
			);
		else {
			output.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier(names.context),
						t.callExpression(t.identifier(hookName(context, 'createContext')), [
							t.nullLiteral(),
						]),
					),
				]),
			);
			output.push(storeProviderDeclaration(names, context));
		}
		output.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(names.subscribeNothing),
					t.arrowFunctionExpression(
						[],
						t.arrowFunctionExpression([], t.blockStatement([])),
					),
				),
			]),
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(names.getNothing),
					t.arrowFunctionExpression([], t.numericLiteral(0)),
				),
			]),
		);
		output.push(storeHookDeclaration(definition, names, hook, context));
	}
	return output;
}

function unwrapSharedComputed(node: SerializableAstNode): t.Expression {
	const value = expression(node);
	if (!t.isArrowFunctionExpression(value))
		throw new Error('Shared computed expression must be an arrow');
	if (!t.isBlockStatement(value.body)) return value.body;
	const returned = value.body.body.find((statement: any) => t.isReturnStatement(statement));
	if (!returned?.argument) throw new Error('Shared computed expression has no return');
	return returned.argument;
}

function createStoreDeclaration(
	definition: SharedDefinition,
	name: string,
	context: EmitContext,
): t.FunctionDeclaration {
	const body: t.Statement[] = [];
	const stateCells = definition.cells.filter((cell) => cell.kind === 'state');
	const listenerNames = new Map(
		stateCells.map((cell) => [cell.graphNodeId, context.names.claim(`${cell.name}Listeners`)]),
	);
	const versionNames = new Map(
		stateCells.map((cell) => [cell.graphNodeId, context.names.claim(`${cell.name}Version`)]),
	);
	const snapshotNames = new Map(
		stateCells.map((cell) => [cell.graphNodeId, context.names.claim(`${cell.name}Snapshot`)]),
	);
	const snapshotVersionNames = new Map(
		stateCells.map((cell) => [
			cell.graphNodeId,
			context.names.claim(`${cell.name}SnapshotVersion`),
		]),
	);
	const writeNames = new Map(
		stateCells
			.filter((cell) =>
				definition.methods.some((method) =>
					method.writes.some((write) => write.graphNodeId === cell.graphNodeId),
				),
			)
			.map((cell) => [
				cell.graphNodeId,
				context.names.claim(`write${cell.name[0]!.toUpperCase()}${cell.name.slice(1)}`),
			]),
	);
	const listenerName = (cell: { graphNodeId: string }) => listenerNames.get(cell.graphNodeId)!;
	const versionName = (cell: { graphNodeId: string }) => versionNames.get(cell.graphNodeId)!;
	const snapshotName = (cell: { graphNodeId: string }) => snapshotNames.get(cell.graphNodeId)!;
	const snapshotVersionName = (cell: { graphNodeId: string }) =>
		snapshotVersionNames.get(cell.graphNodeId)!;
	const writeName = (cell: { graphNodeId: string }) => writeNames.get(cell.graphNodeId)!;
	for (const cell of stateCells) {
		const persistence = persistenceForGraph(context, cell.graphNodeId);
		body.push(
			t.variableDeclaration('let', [
				t.variableDeclarator(
					t.identifier(cell.name),
					persistence ? persistenceSeed(persistence) : expression(cell.initializer),
				),
			]),
			t.variableDeclaration('let', [
				t.variableDeclarator(t.identifier(versionName(cell)), t.numericLiteral(0)),
			]),
			t.variableDeclaration('let', [
				t.variableDeclarator(t.identifier(snapshotName(cell)), t.identifier(cell.name)),
			]),
			t.variableDeclaration('let', [
				t.variableDeclarator(
					t.identifier(snapshotVersionName(cell)),
					t.identifier(versionName(cell)),
				),
			]),
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(listenerName(cell)),
					t.newExpression(t.identifier('Set'), []),
				),
			]),
		);
	}
	for (const cell of stateCells) {
		if (!writeNames.has(cell.graphNodeId)) continue;
		const next = context.names.claim(`next${cell.name[0]!.toUpperCase()}${cell.name.slice(1)}`);
		body.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(writeName(cell)),
					t.arrowFunctionExpression(
						[t.identifier(next), t.identifier('changed')],
						t.blockStatement([
							t.ifStatement(
								t.callExpression(member(t.identifier('Object'), 'is'), [
									t.identifier(cell.name),
									t.identifier(next),
								]),
								t.blockStatement([t.returnStatement(null)]),
							),
							t.expressionStatement(
								t.assignmentExpression(
									'=',
									t.identifier(cell.name),
									t.identifier(next),
								),
							),
							t.expressionStatement(
								t.updateExpression('++', t.identifier(versionName(cell))),
							),
							t.expressionStatement(
								t.callExpression(member(t.identifier('changed'), 'add'), [
									t.stringLiteral(cell.name),
								]),
							),
						]),
					),
				),
			]),
		);
	}
	const properties: t.Node[] = [];
	for (const cell of definition.cells) {
		const cap = `${cell.name[0]!.toUpperCase()}${cell.name.slice(1)}`;
		if (cell.kind === 'state')
			properties.push(
				t.objectProperty(
					t.identifier(`get${cap}`),
					t.arrowFunctionExpression(
						[],
						t.blockStatement([
							t.ifStatement(
								t.binaryExpression(
									'!==',
									t.identifier(snapshotVersionName(cell)),
									t.identifier(versionName(cell)),
								),
								t.blockStatement([
									t.expressionStatement(
										t.assignmentExpression(
											'=',
											t.identifier(snapshotName(cell)),
											t.identifier(cell.name),
										),
									),
									t.expressionStatement(
										t.assignmentExpression(
											'=',
											t.identifier(snapshotVersionName(cell)),
											t.identifier(versionName(cell)),
										),
									),
								]),
							),
							t.returnStatement(t.identifier(snapshotName(cell))),
						]),
					),
				),
			);
		else
			properties.push(
				t.objectProperty(
					t.identifier(`get${cap}`),
					t.arrowFunctionExpression([], unwrapSharedComputed(cell.expression)),
				),
			);
		if (cell.kind === 'state') {
			const persistence = persistenceForGraph(context, cell.graphNodeId);
			if (persistence)
				properties.push(
					t.objectProperty(
						t.identifier(`getServer${cap}`),
						t.arrowFunctionExpression([], t.stringLiteral(persistence.authoredInitial)),
					),
				);
		}
		const dependencies = cell.kind === 'state' ? [cell.graphNodeId] : cell.dependencies;
		const dependentCells = dependencies
			.map((id) => stateCells.find((candidate) => candidate.graphNodeId === id))
			.filter(Boolean) as typeof stateCells;
		properties.push(
			t.objectProperty(
				t.identifier(`subscribe${cap}`),
				t.arrowFunctionExpression(
					[t.identifier('listener')],
					t.blockStatement([
						...dependentCells.map((dependency) =>
							t.expressionStatement(
								t.callExpression(
									member(t.identifier(listenerName(dependency)), 'add'),
									[t.identifier('listener')],
								),
							),
						),
						t.returnStatement(
							t.arrowFunctionExpression(
								[],
								t.blockStatement(
									dependentCells.map((dependency) =>
										t.expressionStatement(
											t.callExpression(
												member(
													t.identifier(listenerName(dependency)),
													'delete',
												),
												[t.identifier('listener')],
											),
										),
									),
								),
							),
						),
					]),
				),
			),
		);
	}
	for (const method of definition.methods) {
		const property = expression(method.site as SerializableAstNode) as any;
		const params = property.value?.params ?? [];
		const changedName = context.names.claim('changed');
		const initialNames = new Map(
			stateCells.map((cell) => [
				cell.graphNodeId,
				context.names.claim(`initial${cell.name[0]!.toUpperCase()}${cell.name.slice(1)}`),
			]),
		);
		const methodBody: t.Statement[] = [
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(changedName),
					t.newExpression(t.identifier('Set'), []),
				),
			]),
			...stateCells.map((cell) =>
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier(initialNames.get(cell.graphNodeId)!),
						t.identifier(cell.name),
					),
				]),
			),
		];
		for (const write of [...method.writes].sort((left, right) => left.order - right.order)) {
			const cell = stateCells.find(
				(candidate) => candidate.graphNodeId === write.graphNodeId,
			);
			if (!cell) throw new Error(`SharedWrite has no state cell: ${write.graphNodeId}`);
			let next: t.Expression;
			if (
				write.operation === 'assign' &&
				(write.assignmentOperator === undefined || write.assignmentOperator === '=')
			)
				next = write.path.length
					? immutablePatch(t.identifier(cell.name), write.path, expression(write.value))
					: expression(write.value);
			else if (write.operation === 'assign' && write.assignmentOperator?.endsWith('=')) {
				const target = write.path.reduce<t.Expression>(
					(value, part) => member(value, part),
					t.identifier(cell.name),
				);
				const value = t.binaryExpression(
					write.assignmentOperator.slice(0, -1),
					target,
					expression(write.value),
				);
				next = write.path.length
					? immutablePatch(t.identifier(cell.name), write.path, value)
					: value;
			} else if (write.operation === 'update') {
				const target = write.path.reduce<t.Expression>(
					(value, part) => member(value, part),
					t.identifier(cell.name),
				);
				const value = t.binaryExpression(
					write.updateOperator === '++' ? '+' : '-',
					target,
					t.numericLiteral(1),
				);
				next = write.path.length
					? immutablePatch(t.identifier(cell.name), write.path, value)
					: value;
			} else if (write.operation === 'call' && write.method && write.path.length === 0) {
				const cloneName = context.names.claim(
					`next${cell.name[0]!.toUpperCase()}${cell.name.slice(1)}`,
				);
				const clone =
					cell.valueKind === 'array'
						? t.callExpression(member(t.identifier(cell.name), 'slice'), [])
						: t.objectExpression([t.spreadElement(t.identifier(cell.name))]);
				methodBody.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(t.identifier(cloneName), clone),
					]),
					t.expressionStatement(
						t.callExpression(
							member(t.identifier(cloneName), write.method),
							(write.arguments ?? []).map(expression),
						),
					),
					t.expressionStatement(
						t.callExpression(t.identifier(writeName(cell)), [
							t.identifier(cloneName),
							t.identifier(changedName),
						]),
					),
				);
				continue;
			} else
				throw new Error(
					`SharedWrite has unsupported assignment operator: ${write.assignmentOperator}`,
				);
			methodBody.push(
				t.expressionStatement(
					t.callExpression(t.identifier(writeName(cell)), [
						next,
						t.identifier(changedName),
					]),
				),
			);
		}
		for (const cell of stateCells) {
			const persistence = persistenceForGraph(context, cell.graphNodeId);
			if (!persistence) continue;
			methodBody.push(
				t.ifStatement(
					t.callExpression(member(t.identifier(changedName), 'has'), [
						t.stringLiteral(cell.name),
					]),
					t.blockStatement(
						persistenceStatements(context, persistence, t.identifier(cell.name)),
					),
				),
			);
		}
		const changedCellName = context.names.claim('changedCell');
		const notificationBody: t.Statement[] = [];
		for (const cell of stateCells) {
			const listener = context.names.claim('listener');
			notificationBody.push(
				t.ifStatement(
					t.logicalExpression(
						'&&',
						t.binaryExpression(
							'===',
							t.identifier(changedCellName),
							t.stringLiteral(cell.name),
						),
						t.unaryExpression(
							'!',
							t.callExpression(member(t.identifier('Object'), 'is'), [
								t.identifier(initialNames.get(cell.graphNodeId)!),
								t.identifier(cell.name),
							]),
						),
					),
					t.blockStatement([
						{
							type: 'ForOfStatement',
							await: false,
							left: t.variableDeclaration('const', [
								t.variableDeclarator(t.identifier(listener), null),
							]),
							right: t.identifier(listenerName(cell)),
							body: t.expressionStatement(
								t.callExpression(t.identifier(listener), []),
							),
						},
					]),
				),
			);
		}
		methodBody.push({
			type: 'ForOfStatement',
			await: false,
			left: t.variableDeclaration('const', [
				t.variableDeclarator(t.identifier(changedCellName), null),
			]),
			right: t.identifier(changedName),
			body: t.blockStatement(notificationBody),
		});
		properties.push(functionProperty(method.name, params, methodBody));
	}
	body.push(t.returnStatement(t.objectExpression(properties)));
	return t.functionDeclaration(t.identifier(name), [], t.blockStatement(body));
}

function storeProviderDeclaration(
	names: ReturnType<typeof sharedNames>,
	context: EmitContext,
): t.ExportNamedDeclaration {
	return t.exportNamedDeclaration(
		t.functionDeclaration(
			t.identifier(names.provider),
			[
				t.objectPattern([
					t.objectProperty(
						t.identifier('children'),
						t.identifier('children'),
						false,
						true,
					),
				]),
			],
			t.blockStatement([
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.arrayPattern([t.identifier('store')]),
						t.callExpression(t.identifier(hookName(context, 'useState')), [
							t.identifier(names.createStore),
						]),
					),
				]),
				t.returnStatement(
					t.jsxElement(
						t.jsxOpeningElement(
							t.jsxIdentifier(names.context),
							[
								t.jsxAttribute(
									t.jsxIdentifier('value'),
									t.jsxExpressionContainer(t.identifier('store')),
								),
							],
							false,
						),
						t.jsxClosingElement(t.jsxIdentifier(names.context)),
						[t.jsxExpressionContainer(t.identifier('children'))],
					),
				),
			]),
		),
	);
}

function storeHookDeclaration(
	definition: SharedDefinition,
	names: ReturnType<typeof sharedNames>,
	hook: string,
	context: EmitContext,
): t.FunctionDeclaration {
	const body: t.Statement[] = [];
	if (definition.scope === 'page')
		body.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(t.identifier('store'), t.identifier(names.moduleStore)),
			]),
		);
	else {
		body.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier('store'),
					t.callExpression(t.identifier(hookName(context, 'useContext')), [
						t.identifier(names.context),
					]),
				),
			]),
			missingProviderGuard('store', definition),
		);
	}
	let subscribe: t.Expression = t.identifier(names.subscribeNothing);
	let snapshot: t.Expression = t.identifier(names.getNothing);
	let serverSnapshot: t.Expression = t.identifier(names.getNothing);
	const graphProperties = definition.returnProperties.filter(
		(property) => property.kind === 'graph',
	);
	for (let index = graphProperties.length - 1; index >= 0; index -= 1) {
		const property = graphProperties[index]!;
		const cap = `${property.name[0]!.toUpperCase()}${property.name.slice(1)}`;
		const test = t.binaryExpression(
			'===',
			t.identifier('cell'),
			t.stringLiteral(property.name),
		);
		subscribe = t.conditionalExpression(
			test,
			member(t.identifier('store'), `subscribe${cap}`),
			subscribe,
		);
		snapshot = t.conditionalExpression(
			test,
			member(t.identifier('store'), `get${cap}`),
			snapshot,
		);
		const persistence = persistenceForGraph(context, property.graphNodeId);
		serverSnapshot = t.conditionalExpression(
			t.cloneNode(test, true),
			member(t.identifier('store'), persistence ? `getServer${cap}` : `get${cap}`),
			serverSnapshot,
		);
	}
	body.push(
		t.variableDeclaration('const', [
			t.variableDeclarator(
				t.identifier('value'),
				t.callExpression(t.identifier(hookName(context, 'useSyncExternalStore')), [
					subscribe,
					snapshot,
					serverSnapshot,
				]),
			),
		]),
	);
	for (const property of graphProperties)
		body.push(
			t.ifStatement(
				t.binaryExpression('===', t.identifier('cell'), t.stringLiteral(property.name)),
				t.blockStatement([t.returnStatement(t.identifier('value'))]),
			),
		);
	body.push(t.returnStatement(t.identifier('store')));
	return t.functionDeclaration(
		t.identifier(hook),
		[t.identifier('cell')],
		t.blockStatement(body),
	);
}

function componentFunction(
	ir: EnrichedIR,
	component: EnrichedComponent,
	context: EmitContext,
	usedHooks: Set<ReactHook>,
): t.FunctionDeclaration {
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
	if (
		ir.records.handleForwards.some((forward) => forward.childComponentId === component.id) &&
		!component.props.entries.some((entry) => entry.sourceName === 'ref')
	)
		props.push(t.objectProperty(t.identifier('ref'), t.identifier('ref'), false, true));
	for (const route of context.sharedPropRoutes.values())
		if (route.consumerComponentIds.has(component.id))
			props.push(
				t.objectProperty(
					t.identifier(route.propName),
					t.identifier(route.propName),
					false,
					true,
				),
			);
	const body: t.Statement[] = [];
	const callbackRefStatements: t.Statement[] = [];
	const pendingInitializers: t.Expression[] = [];
	const bindingById = new Map(ir.records.bindings.map((binding) => [binding.id, binding]));
	const componentHandles = ir.records.elementHandleBindings.filter(
		(binding) =>
			binding.componentId === component.id &&
			!ir.records.handleForwards.some(
				(forward) =>
					forward.childComponentId === component.id &&
					forward.childHostNodeId === binding.hostNodeId,
			),
	);
	for (const [definitionId, route] of context.sharedPropRoutes)
		if (route.rootComponentId === component.id) {
			const definition = ir.records.sharedDefinitions.find(
				(candidate) => candidate.id === definitionId,
			)!;
			const cell = definition.cells.find((candidate) => candidate.kind === 'state');
			if (!cell || cell.kind !== 'state')
				throw new Error(
					`SharedDefinition ${definition.name} has no props-tier scalar cell`,
				);
			usedHooks.add('useState');
			const persistence = persistenceForGraph(context, cell.graphNodeId);
			const initializer = persistence
				? persistenceSeed(persistence)
				: expression(cell.initializer);
			body.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.arrayPattern([t.identifier(route.propName)]),
						t.callExpression(t.identifier(hookName(context, 'useState')), [
							persistence ? t.arrowFunctionExpression([], initializer) : initializer,
						]),
					),
				]),
			);
		}
	for (const handle of componentHandles) {
		usedHooks.add('useRef');
		body.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(context.handleNames.get(handle.id)!),
					t.callExpression(t.identifier(hookName(context, 'useRef')), [t.nullLiteral()]),
				),
			]),
		);
	}
	for (const [hostNodeId, callbackName] of context.hostRefNames) {
		const behaviors = ir.records.behaviors
			.filter(
				(behavior) =>
					behavior.componentId === component.id && behavior.hostNodeId === hostNodeId,
			)
			.sort((left, right) => left.order - right.order);
		if (!behaviors.length) continue;
		usedHooks.add('useCallback');
		const nodeName = context.names.claim('node');
		const callbackBody: t.Statement[] = [];
		const hostHandle = componentHandles.find((handle) => handle.hostNodeId === hostNodeId);
		const forwardedHandle = ir.records.handleForwards.find(
			(forward) =>
				forward.childComponentId === component.id && forward.childHostNodeId === hostNodeId,
		);
		const exposedHandleName = hostHandle
			? context.handleNames.get(hostHandle.id)!
			: forwardedHandle
				? 'ref'
				: null;
		if (exposedHandleName)
			callbackBody.push(
				t.expressionStatement(
					t.assignmentExpression(
						'=',
						member(t.identifier(exposedHandleName), 'current'),
						t.identifier(nodeName),
					),
				),
			);
		const cleanupNames: string[] = [];
		for (const behavior of behaviors) {
			const cleanupName = context.names.claim('cleanup');
			cleanupNames.push(cleanupName);
			callbackBody.push(
				t.variableDeclaration('const', [
					t.variableDeclarator(
						t.identifier(cleanupName),
						t.callExpression(expression(behavior.behavior), [t.identifier(nodeName)]),
					),
				]),
			);
		}
		const cleanupBody: t.Statement[] = [];
		for (let index = behaviors.length - 1; index >= 0; index -= 1) {
			if (!behaviors[index]!.returnsCleanup) continue;
			const cleanupName = cleanupNames[index]!;
			cleanupBody.push(
				t.ifStatement(
					t.binaryExpression(
						'===',
						t.unaryExpression('typeof', t.identifier(cleanupName)),
						t.stringLiteral('function'),
					),
					t.blockStatement([
						t.expressionStatement(t.callExpression(t.identifier(cleanupName), [])),
					]),
				),
			);
		}
		if (exposedHandleName)
			cleanupBody.push(
				t.expressionStatement(
					t.assignmentExpression(
						'=',
						member(t.identifier(exposedHandleName), 'current'),
						t.nullLiteral(),
					),
				),
			);
		callbackBody.push(
			t.returnStatement(t.arrowFunctionExpression([], t.blockStatement(cleanupBody))),
		);
		const dependencies = new Map<string, t.Expression>();
		if (forwardedHandle) dependencies.set('forwarded-handle', t.identifier('ref'));
		for (const behavior of behaviors)
			for (const input of behavior.inputs) {
				const binding = bindingById.get(input.graphNodeId);
				if (!binding)
					throw new Error(`BehaviorRecord input has no binding: ${input.graphNodeId}`);
				let value: t.Expression = t.identifier(binding.name);
				for (const part of input.path) value = member(value, part);
				dependencies.set(`${input.graphNodeId}\0${input.path.join('\0')}`, value);
			}
		callbackRefStatements.push(
			t.variableDeclaration('const', [
				t.variableDeclarator(
					t.identifier(callbackName),
					t.callExpression(t.identifier(hookName(context, 'useCallback')), [
						t.arrowFunctionExpression(
							[t.identifier(nodeName)],
							t.blockStatement(callbackBody),
						),
						{ type: 'ArrayExpression', elements: [...dependencies.values()] },
					]),
				),
			]),
		);
	}

	for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
		if (
			componentHandles.some(
				(handle) =>
					local.semanticRecordIds.includes(handle.id) ||
					local.names.includes(handle.handleName),
			)
		)
			continue;
		const sharedInstance = ir.records.sharedInstances.find(
			(instance) =>
				instance.componentId === component.id && local.names.includes(instance.localName),
		);
		if (sharedInstance) {
			const definition = ir.records.sharedDefinitions.find(
				(candidate) => candidate.id === sharedInstance.definitionId,
			);
			if (!definition)
				throw new Error(
					`SharedInstance has no SharedDefinition: ${sharedInstance.definitionId}`,
				);
			body.push(
				sharedInstanceDeclaration(
					ir,
					component,
					sharedInstance.localName,
					definition,
					context,
				),
			);
			continue;
		}
		const semantic = local.semanticRecordIds
			.map((id) => bindingById.get(id))
			.filter((binding): binding is EnrichedGraphBinding => Boolean(binding));
		const state = semantic.find((binding) => binding.kind === 'state');
		const computed = semantic.find((binding) => binding.kind === 'computed');
		if (state) {
			const mapped = context.statesById.get(state.id)!;
			const persistence = persistenceForGraph(context, state.id);
			const initializer = persistence
				? persistenceSeed(persistence)
				: expression(state.initializer);
			emitOnceGuard(pendingInitializers.splice(0), body, usedHooks, context);
			if (mapped.storage === 'ref') {
				usedHooks.add('useRef');
				body.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.identifier(state.name),
							t.callExpression(t.identifier(hookName(context, 'useRef')), [
								initializer,
							]),
						),
					]),
				);
			} else {
				usedHooks.add('useState');
				const elements: Array<t.Node | null> = [t.identifier(state.name)];
				if (state.writes.length > 0)
					elements.push(t.identifier(setterFor(context, mapped)));
				body.push(
					t.variableDeclaration('const', [
						t.variableDeclarator(
							t.arrayPattern(elements),
							t.callExpression(t.identifier(hookName(context, 'useState')), [
								persistence
									? t.arrowFunctionExpression([], initializer)
									: useStateInitializer(initializer),
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
		if (!local.names.some((name) => identifierIsUsed(ir, component, name))) {
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
	body.push(...callbackRefStatements);

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
		props.length > 0 ? [t.objectPattern(props)] : [],
		t.blockStatement(body),
	);
	return fn;
}

/** Emit one automatic-runtime .tsx module from frameless-enriched-ir/2. */
export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	const composition =
		ir.components.length > 1 ||
		ir.imports.length > 0 ||
		ir.records.sharedDefinitions.length > 0 ||
		ir.records.elementHandleBindings.length > 0 ||
		ir.records.behaviors.length > 0 ||
		ir.records.handleCalls.length > 0 ||
		ir.components.some((component) =>
			JSON.stringify(component.template).match(/component-reference|default-slot-projection/),
		);
	const visible = new Set<string>();
	for (const component of ir.components)
		for (const id of referencedGraphIds(component, ir.records)) visible.add(id);
	const statesById = new Map<string, StateBinding>();
	for (const binding of ir.records.bindings.filter((entry) => entry.kind === 'state')) {
		statesById.set(binding.id, {
			...binding,
			storage: visible.has(binding.id) ? 'state' : 'ref',
		});
	}
	const allocator = new NameAllocator(collectAuthoredNames(ir));
	const hookNames = new Map<ReactHook, string>([
		['createContext', allocator.claim('createContext')],
		['useCallback', allocator.claim('useCallback')],
		['useContext', allocator.claim('useContext')],
		['useRef', allocator.claim('useRef')],
		['useState', allocator.claim('useState')],
		['useSyncExternalStore', allocator.claim('useSyncExternalStore')],
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
	const handleNames = new Map(
		ir.records.elementHandleBindings.map((binding) => [binding.id, binding.handleName]),
	);
	const sharedHookNames = new Map(
		ir.records.sharedDefinitions.map((definition) => [definition.id, definition.name]),
	);
	const sharedPropRoutes = new Map<string, SharedPropRoute>();
	const edgeSharedProps = new Map<string, Array<{ name: string; value: string }>>();
	for (const definition of ir.records.sharedDefinitions) {
		if (sharedTier(ir, definition) !== 'props') continue;
		const found = findPropsRoot(ir, definition);
		if (!found) throw new Error(`SharedDefinition ${definition.name} has no direct props root`);
		const stem =
			definition.name.startsWith('use') && definition.name.length > 3
				? definition.name.slice(3)
				: definition.name;
		const propName = allocator.claim(`${stem[0]!.toLowerCase()}${stem.slice(1)}SharedValue`);
		const route: SharedPropRoute = {
			rootComponentId: found.root.id,
			consumerComponentIds: new Set(found.consumers),
			edgeIds: new Set(found.edges),
			propName,
		};
		sharedPropRoutes.set(definition.id, route);
		for (const edgeId of found.edges) {
			const props = edgeSharedProps.get(edgeId) ?? [];
			props.push({ name: propName, value: propName });
			edgeSharedProps.set(edgeId, props);
		}
	}
	const hooks = new Set<ReactHook>();
	const persistenceWrites = { emitted: false };
	const baseContext = {
		ir,
		statesById,
		events: new Map(ir.records.events.map((event) => [event.id, event])),
		currentNames,
		hookNames,
		nextNames,
		setterNames,
		setupRefName,
		handleNames,
		sharedHookNames,
		sharedPropRoutes,
		edgeSharedProps,
		names: allocator,
		persistenceWrites,
	};
	const body: t.Statement[] = [];
	for (const imported of ir.imports) {
		const local = t.identifier(imported.localName);
		const specifier =
			imported.kind === 'default'
				? t.importDefaultSpecifier(local)
				: imported.kind === 'namespace'
					? t.importNamespaceSpecifier(local)
					: t.importSpecifier(local, t.identifier(imported.importedName!));
		body.push(
			t.importDeclaration(
				[specifier],
				// `.jsx`, NOT `.tsx`, even though the module this names is emitted as
				// `X.tsx`. A specifier ending `.tsx` is TS5097 in any consumer that
				// has not enabled `allowImportingTsExtensions` (which also forces
				// `noEmit`), whereas `.jsx` resolves to `X.tsx` under TypeScript's
				// JS-to-TS extension substitution and under Vite's - measured:
				// `knownTsOutputRE = /\.(?:js|mjs|cjs|jsx)$/` at vite 7.3.1, 7.3.6
				// and 8.0.16. So the emitted extension moved and the emitted
				// SPECIFIER deliberately did not. The React gate's
				// `recordedRelativeImportSpecifiers` mirrors this exactly.
				t.stringLiteral(imported.source.replace(/\.tsrx$/, '.jsx')),
			),
		);
	}
	const sharedContext: EmitContext = {
		...baseContext,
		componentId: ir.components[0]!.id,
		hostRefNames: new Map(),
		edgeRefNames: new Map(),
	};
	if (composition) body.push(...emitSharedDeclarations(ir, sharedContext, hooks));
	const deferredExports: t.Statement[] = [];
	for (const component of ir.components) {
		const componentNames = new NameAllocator([
			...componentAuthoredNames(ir, component),
			...hookNames.values(),
			...ir.imports.map((entry) => entry.localName),
			...ir.components.map((entry) => entry.name),
			...ir.records.sharedDefinitions.map((entry) => entry.name),
			...[...sharedPropRoutes.values()].map((entry) => entry.propName),
		]);
		const componentStates = [...statesById.values()].filter(
			(state) => state.componentId === component.id,
		);
		const componentSetterNames = new Map<string, string>();
		const componentNextNames = new Map<string, string>();
		for (const state of componentStates) {
			componentSetterNames.set(state.id, componentNames.claim(setterName(state.name)));
			componentNextNames.set(state.id, componentNames.claim(nextName(state.name)));
		}
		const componentCurrentNames = new Map<string, string>();
		componentStates.forEach((state, index) => {
			componentCurrentNames.set(
				state.id,
				componentNames.claim(`currentState${index + 1}`, '_'),
			);
		});
		const hostRefNames = new Map<string, string>();
		const edgeRefNames = new Map<string, string>();
		for (const handle of ir.records.elementHandleBindings.filter(
			(binding) =>
				binding.componentId === component.id &&
				!ir.records.handleForwards.some(
					(forward) =>
						forward.childComponentId === component.id &&
						forward.childHostNodeId === binding.hostNodeId,
				),
		)) {
			const behaviors = ir.records.behaviors.some(
				(behavior) =>
					behavior.componentId === component.id &&
					behavior.hostNodeId === handle.hostNodeId,
			);
			hostRefNames.set(
				handle.hostNodeId,
				behaviors
					? componentNames.claim(
							`attach${handle.handleName[0]!.toUpperCase()}${handle.handleName.slice(1)}`,
						)
					: handle.handleName,
			);
		}
		for (const behavior of ir.records.behaviors.filter(
			(item) => item.componentId === component.id,
		))
			if (!hostRefNames.has(behavior.hostNodeId))
				hostRefNames.set(behavior.hostNodeId, componentNames.claim('attachHost'));
		for (const forward of ir.records.handleForwards) {
			if (
				forward.childComponentId === component.id &&
				!ir.records.behaviors.some(
					(behavior) =>
						behavior.componentId === component.id &&
						behavior.hostNodeId === forward.childHostNodeId,
				)
			)
				hostRefNames.set(forward.childHostNodeId, 'ref');
			const owner = ir.records.elementHandleBindings.find(
				(binding) =>
					binding.id === forward.handleBindingId && binding.componentId === component.id,
			);
			if (owner) edgeRefNames.set(forward.edgeId, owner.handleName);
		}
		const context: EmitContext = {
			...baseContext,
			componentId: component.id,
			currentNames: componentCurrentNames,
			hostRefNames,
			edgeRefNames,
			nextNames: componentNextNames,
			names: componentNames,
			setterNames: componentSetterNames,
			setupRefName: componentNames.claim('setupDone'),
		};
		const declaration = componentFunction(ir, component, context, hooks);
		const exports = ir.module.exports.filter((entry) => entry.componentName === component.name);
		const direct = exports.find(
			(entry) => entry.kind === 'named' && entry.exportedName === component.name,
		);
		body.push(direct ? t.exportNamedDeclaration(declaration) : declaration);
		for (const exported of exports.filter((entry) => entry !== direct)) {
			if (exported.kind === 'default')
				deferredExports.push(t.exportDefaultDeclaration(t.identifier(component.name)));
			else
				deferredExports.push(
					t.exportNamedSpecifiers([
						t.exportSpecifier(
							t.identifier(component.name),
							t.identifier(exported.exportedName),
						),
					]),
				);
		}
	}
	body.push(...deferredExports);
	const imports = t.importDeclaration(
		[...hooks]
			.sort()
			.map((hook) =>
				t.importSpecifier(t.identifier(hookName(sharedContext, hook)), t.identifier(hook)),
			),
		t.stringLiteral('react'),
	);
	const first = hooks.size ? imports : body[0];
	if (first)
		first.comments = [
			{
				type: 'Line',
				position: 'before',
				sameLine: false,
				value: ' @generated by @frameless/react; do not edit.',
			},
		];
	const programBody = hooks.size ? [imports, ...body] : body;
	if (persistenceWrites.emitted) {
		let lastImport = -1;
		programBody.forEach((statement, index) => {
			if (statement.type === 'ImportDeclaration') lastImport = index;
		});
		programBody.splice(lastImport + 1, 0, persistenceHelperDeclaration());
	}
	const program = t.program(programBody);
	const expectedNames = declaredNames(program);
	const source = `${printTopLevel(program)}\n`;
	const verified = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	if (verified.diagnostics.length) {
		throw new Error(
			`Emitted React module failed collision verification: ${verified.diagnostics.map((item) => item.message).join('; ')}\n${source}`,
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
		const localName = hookName(sharedContext, hook);
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
		if (state.storage !== 'state' || state.writes.length === 0) continue;
		const name = setterFor(sharedContext, state);
		let setterSymbol: ReturnType<typeof verified.symbolOf> = null;
		verified.walk({
			VariableDeclarator(node: any) {
				const setter = node.id?.type === 'ArrayPattern' ? node.id.elements[1] : null;
				if (t.isIdentifier(setter, { name })) setterSymbol = verified.symbolOf(setter);
			},
		});
		if (!setterSymbol)
			throw new Error(
				`Emitted React module failed setter declaration verification for ${name}`,
			);
		for (const reference of verified.references) {
			if (reference.name === name && reference.symbol !== setterSymbol) {
				throw new Error(
					`Emitted React module failed setter identity verification for ${name}`,
				);
			}
		}
	}
	return source;
}
