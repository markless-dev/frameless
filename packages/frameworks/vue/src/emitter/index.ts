import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import {
	ENRICHED_IR_VERSION,
	type EnrichedComponent,
	type EnrichedEventRecord,
	type EnrichedGraphBinding,
	type EnrichedIR,
	type SerializableAstNode,
	type StaticAttribute,
	type SyncPolicy,
	type TemplateNode,
} from '@frameless/compiler';
import {
	arrow,
	call,
	type Expression,
	expression,
	expressionStatement,
	identifier,
	importDeclaration,
	indentContinuation,
	literal,
	member,
	type Node,
	printExpression,
	printStatements,
	type Statement,
	variable,
	walk,
} from './estree.ts';

type StateBinding = EnrichedGraphBinding & { readonly kind: 'state' };

/**
 * How a bare identifier in a SCRIPT expression has to be respelled.
 *
 * `<script setup>` is the reason this exists at all, and it applies to the
 * SCRIPT ONLY. Template expressions are emitted VERBATIM: Vue's own compiler
 * resolves them against `bindingMetadata`, unwraps refs and reaches props
 * without any help from this emitter. In the script block there is no such
 * resolution - a prop is only reachable through the object `defineProps()`
 * returns, and a `ref` is only readable through `.value`.
 */
type ScriptRewrite =
	| { readonly kind: 'prop'; readonly path: readonly string[] }
	| { readonly kind: 'ref' };

type EmitContext = {
	readonly component: EnrichedComponent;
	readonly eventsById: ReadonlyMap<string, EnrichedEventRecord>;
	/** Bare-identifier respellings applied to SCRIPT expressions only. */
	readonly rewrites: Map<string, ScriptRewrite>;
	readonly usedApis: Set<VueApi>;
	/**
	 * Host node id -> the template-ref name, for every `ElementHandleBinding` this
	 * component owns. Empty for every scenario in the corpus.
	 */
	readonly handleHosts: ReadonlyMap<string, string>;
	/**
	 * Host node id -> the template-ref name the `attach=` lowering reads the node
	 * through. Shares the handle's own ref when the host already carries one, and
	 * is empty for every scenario in the corpus.
	 */
	readonly behaviorHosts: Map<string, string>;
	readonly behaviorPlans: VueBehaviorPlan[];
	/**
	 * STEP 5. Local name -> emitted `.vue` specifier, one entry per `ModuleImport`
	 * that resolves to a `.tsrx` module. A `component-reference` may only name a
	 * key of this map; see the lane-limit note on `emit`.
	 */
	readonly componentImports: ReadonlyMap<string, string>;
};

type VueApi = 'computed' | 'onMounted' | 'onUnmounted' | 'ref' | 'watch';

/**
 * Names this emitter introduces into `<script setup>` scope itself. A component
 * local with one of these names would silently shadow the emitter's own binding,
 * so it is refused rather than renamed - renaming would make emitted identifiers
 * stop matching the authored ones for no gain the corpus can test.
 */
const RESERVED_SCRIPT_NAMES = new Set([
	'props',
	'ref',
	'computed',
	'defineProps',
	// STEP 4 added three more emitter-introduced bindings. They join the list for
	// the same reason the first four are on it: a component local of the same name
	// would silently shadow the import this lane emits.
	'onMounted',
	'onUnmounted',
	'watch',
]);

/**
 * Void elements are emitted WITHOUT the self-closing slash.
 *
 * `<input>` is standard HTML for a void element and Vue's SFC template parser
 * accepts it - MEASURED at 3.5.40 through `compileTemplate`, which is also what
 * `@vitejs/plugin-vue` calls. `vue/html-self-closing` would demand `<input/>`
 * instead; that rule lives in the `strongly-recommended` tier, which this lane
 * does not apply, and the reason is recorded in `VUE_ESLINT_TIERS_EXCLUDED`.
 */
const VOID_ELEMENTS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
]);

/** Column budget for keeping a start tag on one line. A tab counts as four. */
const PRINT_WIDTH = 100;

function exactKeys(construct: string, value: object, allowed: readonly string[]): void {
	const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
	if (unknown.length) throw new Error(`${construct} has unknown semantic field: ${unknown[0]}`);
}

/**
 * NESTED EXACTNESS. ADDED BY T010 AFTER IT WAS MEASURED MISSING, NOT ASSUMED.
 *
 * Every other allowlist in `validateEnrichedIr` guards a top-level or one-deep
 * construct, and this lane's anti-drift probe plants its unknown field on
 * `EnrichedIR` - which every lane already caught. MEASURED at 127a75b, before
 * this function existed: a key planted on a `PropDestructuringEntry` was
 * accepted by qwik, svelte, vue AND angular with BYTE-IDENTICAL output across
 * all eight goldens, while react and solid threw. Four validators had simply
 * never looked this deep, and that asymmetry is why IR-8's `type` could be
 * added believing all six agreed. The probe was aimed one level too high.
 *
 * `type` and `optional` are IR-8, and THIS LANE NOW PRINTS BOTH - see
 * `propsDeclaration` for the runtime-declaration form and the boolean carve-out.
 * They are still shape-checked here rather than at the point of use, because the
 * validator is the fail-closed boundary and a malformed field must be named
 * before any output AST is built: a `type` that is not an AST node is rejected
 * by name, and so is an `optional` that is not a boolean.
 *
 * `optional` IS ALSO CHECKED AGAINST `type`, not just in isolation. The two are
 * read from ONE `TSPropertySignature` at the compiler's only supply site, so an
 * `optional` arriving WITHOUT a `type` did not come from source - it is
 * requiredness synthesized somewhere downstream, which is precisely the
 * invention this phase refuses, and which this lane would otherwise print
 * straight into a `required:` field.
 */
function validatePropEntries(entries: EnrichedIR['components'][number]['props']['entries']): void {
	for (const entry of entries) {
		exactKeys('PropDestructuringEntry', entry, [
			'sourceName',
			'localName',
			'path',
			'alias',
			'graphNodeId',
			'defaultValue',
			'type',
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
		if (entry.optional !== undefined && entry.type === undefined)
			throw new Error(
				`PropDestructuringEntry declares optionality without a type annotation: ${entry.localName}`,
			);
	}
}

/**
 * SHAPE-CHECKS THE TWO RECORD FAMILIES THIS LANE STARTED CONSUMING AT STEP 3.
 *
 * Before refs landed here, `validateEnrichedIr` checked only that
 * `elementHandleBindings` and `handleCalls` were ARRAYS - the family loop below -
 * because the emitter refused any IR that carried one. That is the same defect
 * class T003 measured and T010 closed one level up: four lanes accepted a field
 * planted on a nested `PropDestructuringEntry` with byte-identical output while
 * react and solid threw. React validates both families key-by-key (its inline
 * `keys` closure, NOT an `exactKeys`); this lane now does too, so a field added to
 * either record fails HERE, by name, rather than being dropped by a lane that
 * consumes it.
 *
 * `handleForwards` is deliberately NOT checked here: `emit` still
 * refuses it, so it stays unreachable, and a checker over an unreachable path
 * asserts nothing. Step 5 owns it.
 */
function validateHandleRecords(ir: EnrichedIR): void {
	const componentIds = new Set(ir.components.map((component) => component.id));
	const eventIds = new Set(ir.records.events.map((event) => event.id));
	const handleIds = new Set<string>();
	for (const binding of ir.records.elementHandleBindings) {
		exactKeys('ElementHandleBinding', binding, [
			'id',
			'handleName',
			'componentId',
			'hostNodeId',
		]);
		if (
			typeof binding.id !== 'string' ||
			typeof binding.handleName !== 'string' ||
			typeof binding.hostNodeId !== 'string'
		)
			throw new Error('ElementHandleBinding has malformed construct');
		if (!componentIds.has(binding.componentId))
			throw new Error(`ElementHandleBinding has dangling componentId: ${binding.componentId}`);
		handleIds.add(binding.id);
	}
	for (const call of ir.records.handleCalls) {
		exactKeys('HandleCallRecord', call, [
			'handleBindingId',
			'componentId',
			'method',
			'arguments',
			'optional',
			'eventId',
			'site',
			'order',
		]);
		if (
			typeof call.handleBindingId !== 'string' ||
			typeof call.method !== 'string' ||
			!Array.isArray(call.arguments) ||
			typeof call.optional !== 'boolean' ||
			(call.eventId !== undefined && typeof call.eventId !== 'string') ||
			typeof call.order !== 'number'
		)
			throw new Error('HandleCallRecord has malformed construct');
		if (!componentIds.has(call.componentId))
			throw new Error(`HandleCallRecord has dangling componentId: ${call.componentId}`);
		if (!handleIds.has(call.handleBindingId))
			throw new Error(
				`HandleCallRecord has dangling ElementHandleBinding: ${call.handleBindingId}`,
			);
		if (call.eventId !== undefined && !eventIds.has(call.eventId))
			throw new Error(`HandleCallRecord has dangling event: ${call.eventId}`);
	}
}

/** Fail closed at the public emitter boundary before constructing output. */
/**
 * SHAPE-CHECKS THE RECORD FAMILY THIS LANE STARTED CONSUMING AT STEP 4.
 *
 * Same defect class as `validateHandleRecords`, one construct along, and it was
 * MEASURED before it was written rather than assumed from the board's summary.
 * The brief inherited from T005 says the split is "react and solid reject a
 * planted field, the other four accept silently". At `BehaviorRecord` THAT IS
 * WRONG, and it is wrong in the direction that matters: measured at 48dd38d on a
 * real `attach=` IR, only REACT rejects an unknown field planted on a
 * `BehaviorRecord`. SOLID ACCEPTS IT, through `validateEnrichedIr` AND through
 * `emit()`, even though its own `validateEnrichedIr` contains an `exactKeys` call
 * naming exactly this construct.
 *
 * The cause is structural, not a missing line: `validateEnrichedIr` in
 * `packages/frameworks/solid/src/emitter/index.ts` EARLY-RETURNS into
 * `validateCompositionIr` when `hasComposition(ir)` holds, and `hasComposition`
 * returns true the moment `elementHandleBindings`, `handleCalls` OR `behaviors`
 * is non-empty. So the strict path's key checks for those three families are
 * UNREACHABLE FOR ANY IR THAT CARRIES ONE - a checker that can only run when it
 * has nothing to check. `validateCompositionIr` does check
 * `BehaviorRecord GraphReadRef`, which is why a field planted on an INPUT is
 * still caught there and a field planted on the RECORD is not.
 *
 * The real matrix at this construct is therefore ONE-versus-FIVE, not two-versus-
 * four. See notes/T006-effects.md.
 */
function validateBehaviorRecords(ir: EnrichedIR): void {
	const componentIds = new Set(ir.components.map((component) => component.id));
	for (const behavior of ir.records.behaviors) {
		exactKeys('BehaviorRecord', behavior, [
			'id',
			'hostNodeId',
			'componentId',
			'behavior',
			'inputs',
			'returnsCleanup',
			'order',
		]);
		if (
			typeof behavior.id !== 'string' ||
			typeof behavior.hostNodeId !== 'string' ||
			!Array.isArray(behavior.inputs) ||
			typeof behavior.returnsCleanup !== 'boolean' ||
			typeof behavior.order !== 'number'
		)
			throw new Error('BehaviorRecord has malformed construct');
		if (
			!behavior.behavior ||
			typeof behavior.behavior !== 'object' ||
			typeof (behavior.behavior as { type?: unknown }).type !== 'string'
		)
			throw new Error(`BehaviorRecord has malformed behavior AST: ${behavior.id}`);
		if (!componentIds.has(behavior.componentId))
			throw new Error(`BehaviorRecord has dangling componentId: ${behavior.componentId}`);
		for (const input of behavior.inputs) {
			exactKeys('BehaviorRecord GraphReadRef', input, [
				'graphNodeId',
				'path',
				'via',
				'provenance',
			]);
			if (typeof input.graphNodeId !== 'string' || !Array.isArray(input.path))
				throw new Error('BehaviorRecord GraphReadRef has malformed construct');
			if (!['layer-a', 'derived-from-ast'].includes(String(input.provenance)))
				throw new Error(
					`BehaviorRecord GraphReadRef has unsupported provenance: ${String(input.provenance)}`,
				);
		}
	}
}

/**
 * STEP 5. Shape checks for the two template kinds this step made reachable, and
 * for the prop expressions that ride a `component-reference` edge.
 *
 * THIS IS THE T003/T010 DEFECT CLASS AT THIS STEP'S RECORDS. Every lane that has
 * ever opened a construct without one of these has accepted an unknown field in
 * silence - measured at `PropDestructuringEntry` (T002), `ElementHandleBinding`
 * and `HandleCallRecord` (T005), `BehaviorRecord` (T006) and again at
 * `HandleCallRecord` in the SOLID lane at this step. The check is written at the
 * same commit as the lowering so this lane never joins that list.
 *
 * `validateEnrichedIr` walks EVERY component, not just the emitted one, because
 * a multi-component module is refused in `emit` rather than here: the shape of a
 * record must not depend on whether the lane happens to be able to print it.
 */
function validateCompositionNodes(ir: EnrichedIR): void {
	const visit = (node: TemplateNode): void => {
		if (node.kind === 'component-reference') {
			exactKeys('TemplateComponentReference', node, [
				'kind',
				'id',
				'edgeId',
				'target',
				'props',
				'children',
			]);
			if (typeof node.edgeId !== 'string' || !Array.isArray(node.props))
				throw new Error('TemplateComponentReference has malformed construct');
			exactKeys(
				'TemplateComponentReference target',
				node.target,
				node.target.module === 'self'
					? ['localName', 'module']
					: ['localName', 'module', 'exportedName'],
			);
			if (
				typeof node.target.localName !== 'string' ||
				typeof node.target.module !== 'string'
			)
				throw new Error('TemplateComponentReference target has malformed construct');
			for (const prop of node.props) {
				exactKeys('ComponentPropExpression', prop, [
					'name',
					'kind',
					'value',
					'graphNodeId',
					'path',
				]);
				if (
					typeof prop.name !== 'string' ||
					!['graph-reference', 'callback', 'serializable', 'opaque'].includes(prop.kind)
				)
					throw new Error('ComponentPropExpression has malformed construct');
				exactKeys('ComponentPropExpression value', prop.value, ['expression', 'reads']);
			}
			node.children.forEach(visit);
			return;
		}
		if (node.kind === 'default-slot-projection') {
			exactKeys('TemplateDefaultSlotProjection', node, ['kind', 'id', 'site']);
			exactKeys('TemplateDefaultSlotProjection site', node.site, ['expression', 'reads']);
			return;
		}
		if (node.kind === 'host' || node.kind === 'fragment') node.children.forEach(visit);
		else if (node.kind === 'branch') node.arms.forEach((arm) => arm.children.forEach(visit));
		else if (node.kind === 'keyed-repeat') {
			node.row.forEach(visit);
			node.empty.forEach(visit);
		}
	};
	for (const component of ir.components) {
		component.template.forEach(visit);
		for (const guard of component.guards)
			if (guard.whenTrue.kind === 'template') guard.whenTrue.children.forEach(visit);
	}
}

export function validateEnrichedIr(ir: EnrichedIR): void {
	exactKeys('EnrichedIR', ir, [
		'version',
		'filename',
		'imports',
		'module',
		'components',
		'records',
	]);
	if (ir.version !== ENRICHED_IR_VERSION)
		throw new Error(`Expected ${ENRICHED_IR_VERSION}, received ${String(ir.version)}`);
	if (ir.components.length === 0)
		throw new Error('Vue emitter requires at least one component per IR artifact');
	for (const component of ir.components) {
		exactKeys('EnrichedComponent', component, [
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
		exactKeys('ComponentEvaluationPolicy', component.evaluation, [
			'ordinaryLocals',
			'computedBindings',
		]);
		exactKeys('ComponentProps', component.props, ['graphNodeId', 'entries']);
		validatePropEntries(component.props.entries);
		if (
			component.evaluation.ordinaryLocals !== 'once-per-instance' ||
			component.evaluation.computedBindings !== 'reactive'
		)
			throw new Error(`Unsupported evaluation policy for ${component.name}`);
	}
	exactKeys('EnrichedRecordTable', ir.records, [
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
	for (const [family, records] of Object.entries(
		ir.records as unknown as Record<string, unknown>,
	))
		if (!Array.isArray(records))
			throw new Error(`EnrichedRecordTable ${family} has malformed record family`);
	validateHandleRecords(ir);
	validateBehaviorRecords(ir);
	validateCompositionNodes(ir);
	exactKeys('ModuleRecord', ir.module, ['exports']);
	for (const imported of ir.imports)
		exactKeys('ModuleImport', imported, [
			'localName',
			'source',
			'kind',
			'importedName',
			'resolvesTo',
		]);
	for (const exported of ir.module.exports) {
		exactKeys('ComponentExport', exported, ['kind', 'componentName', 'exportedName']);
		if (!ir.components.some((component) => component.name === exported.componentName))
			throw new Error(`ComponentExport has unknown component: ${exported.componentName}`);
	}
}

// ---------------------------------------------------------------------------
// script expression rewriting
// ---------------------------------------------------------------------------

/** Every name a binding pattern introduces, so an inner scope can shadow. */
function declaredNames(pattern: Node | null | undefined, into: Set<string>): void {
	if (!pattern) return;
	switch (pattern.type) {
		case 'Identifier':
			into.add(String(pattern.name));
			return;
		case 'ObjectPattern':
			for (const property of (pattern.properties ?? []) as Node[])
				declaredNames(
					property.type === 'RestElement' ? property.argument : property.value,
					into,
				);
			return;
		case 'ArrayPattern':
			for (const element of (pattern.elements ?? []) as Array<Node | null>)
				declaredNames(element, into);
			return;
		case 'AssignmentPattern':
			declaredNames(pattern.left, into);
			return;
		case 'RestElement':
			declaredNames(pattern.argument, into);
			return;
		default:
			throw new Error(
				`Vue emitter has no script lowering for the binding pattern ${String(pattern.type)}`,
			);
	}
}

/** Names a block introduces, collected before the block body is visited. */
function blockScopeNames(body: readonly Node[]): Set<string> {
	const names = new Set<string>();
	for (const statement of body) {
		if (statement.type === 'VariableDeclaration')
			for (const declarator of (statement.declarations ?? []) as Node[])
				declaredNames(declarator.id, names);
		else if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration')
			declaredNames(statement.id, names);
	}
	return names;
}

/**
 * THE SCRIPT-SIDE RESPELLING, and the one place the Vue lane needs an expression
 * rewriter where React, Solid and Svelte need none.
 *
 * It is SCOPE-AWARE rather than a name substitution, because a handler-local
 * `const count = todos.length` and a component-level `count` ref are the same
 * spelling with different meanings, and S2 contains exactly that. It also
 * refuses, rather than guesses: an AST node type it has never been taught is a
 * throw, so an IR expression shape this emitter does not understand fails at
 * emit time instead of producing plausible-looking Vue.
 *
 * Reference positions only. A non-computed member property, a non-computed
 * object key, a declaration id and a function parameter are all IDENTIFIERS that
 * are not references, and each is stepped over by name below rather than by a
 * generic walk. A shorthand property whose value is respelled loses its
 * shorthand, because `{ count }` and `{ count: count.value }` are different
 * objects.
 */
function rewriteScript(
	node: Node,
	rewrites: ReadonlyMap<string, ScriptRewrite>,
	shadowed: ReadonlySet<string>,
): Node {
	const visit = (value: Node, scope: ReadonlySet<string>): Node =>
		rewriteScript(value, rewrites, scope);
	const visitAll = (values: Array<Node | null> | undefined, scope: ReadonlySet<string>): void => {
		if (!values) return;
		for (const [index, entry] of values.entries())
			if (entry) values[index] = visit(entry, scope);
	};
	const inner = (names: Iterable<string>): Set<string> => {
		const next = new Set(shadowed);
		for (const name of names) next.add(name);
		return next;
	};

	switch (node.type) {
		case 'Identifier': {
			const name = String(node.name);
			if (shadowed.has(name)) return node;
			const rewrite = rewrites.get(name);
			if (!rewrite) return node;
			if (rewrite.kind === 'ref') return member(identifier(name), 'value');
			return rewrite.path.reduce<Expression>(
				(object, segment) => member(object, segment),
				identifier('props'),
			);
		}
		case 'Literal':
		case 'ThisExpression':
		case 'Super':
			return node;
		case 'TemplateLiteral':
			visitAll(node.expressions as Node[], shadowed);
			return node;
		case 'TaggedTemplateExpression':
			node.tag = visit(node.tag, shadowed);
			node.quasi = visit(node.quasi, shadowed);
			return node;
		case 'MemberExpression':
			node.object = visit(node.object, shadowed);
			if (node.computed) node.property = visit(node.property, shadowed);
			return node;
		case 'CallExpression':
		case 'NewExpression':
			node.callee = visit(node.callee, shadowed);
			visitAll(node.arguments as Node[], shadowed);
			return node;
		case 'ObjectExpression':
			for (const property of (node.properties ?? []) as Node[]) {
				if (property.type === 'SpreadElement') {
					property.argument = visit(property.argument, shadowed);
					continue;
				}
				if (property.type !== 'Property')
					throw new Error(
						`Vue emitter has no script lowering for the object member ${String(property.type)}`,
					);
				if (property.computed) property.key = visit(property.key, shadowed);
				const before = property.value;
				property.value = visit(property.value, shadowed);
				if (property.shorthand && property.value !== before) property.shorthand = false;
			}
			return node;
		case 'ArrayExpression':
			visitAll(node.elements as Array<Node | null>, shadowed);
			return node;
		case 'SpreadElement':
			node.argument = visit(node.argument, shadowed);
			return node;
		case 'ArrowFunctionExpression':
		case 'FunctionExpression': {
			const names = new Set<string>();
			for (const param of (node.params ?? []) as Node[]) declaredNames(param, names);
			const scope = inner(names);
			visitAll(node.params as Node[], scope);
			node.body = visit(node.body, scope);
			return node;
		}
		case 'BinaryExpression':
		case 'LogicalExpression':
			node.left = visit(node.left, shadowed);
			node.right = visit(node.right, shadowed);
			return node;
		case 'AssignmentExpression':
			node.left = visit(node.left, shadowed);
			node.right = visit(node.right, shadowed);
			return node;
		case 'UnaryExpression':
		case 'UpdateExpression':
		case 'AwaitExpression':
			node.argument = visit(node.argument, shadowed);
			return node;
		case 'ConditionalExpression':
			node.test = visit(node.test, shadowed);
			node.consequent = visit(node.consequent, shadowed);
			node.alternate = visit(node.alternate, shadowed);
			return node;
		case 'SequenceExpression':
			visitAll(node.expressions as Node[], shadowed);
			return node;
		case 'ChainExpression':
			node.expression = visit(node.expression, shadowed);
			return node;
		case 'BlockStatement': {
			const scope = inner(blockScopeNames((node.body ?? []) as Node[]));
			visitAll(node.body as Node[], scope);
			return node;
		}
		case 'ExpressionStatement':
			node.expression = visit(node.expression, shadowed);
			return node;
		case 'ReturnStatement':
		case 'ThrowStatement':
			if (node.argument) node.argument = visit(node.argument, shadowed);
			return node;
		case 'IfStatement':
			node.test = visit(node.test, shadowed);
			node.consequent = visit(node.consequent, shadowed);
			if (node.alternate) node.alternate = visit(node.alternate, shadowed);
			return node;
		case 'VariableDeclaration':
			for (const declarator of (node.declarations ?? []) as Node[])
				if (declarator.init) declarator.init = visit(declarator.init, shadowed);
			return node;
		default:
			throw new Error(
				`Vue emitter has no script lowering for the expression node ${String(node.type)}`,
			);
	}
}

// ---------------------------------------------------------------------------
// script block
// ---------------------------------------------------------------------------

/**
 * DECISION SITE - `defineProps` takes the RUNTIME DECLARATION form when the IR
 * carries authored prop types, and the ARRAY form when it does not. NEVER a type
 * argument.
 *
 * THE PREMISE THIS COMMENT USED TO CARRY IS DEAD, AND IT IS RECORDED RATHER THAN
 * ERASED. It said `PropDestructuringEntry` is
 * `sourceName`/`localName`/`path`/`alias`/`graphNodeId`/`defaultValue?` and that
 * "every emitted type would therefore be INFERRED". Both halves are now false:
 * the construct carries `type` (IR-8, supplied from the authored `@tsrx/core`
 * annotation) and `optional` (its requiredness, from the same type-literal
 * member). Nothing printed below is inferred from what the corpus does with a
 * prop; every value is read from syntax the author wrote. The gate's copy of
 * this premise was repaired earlier; THIS one - the actual decision site -
 * outlived it, which is why the refusal it justified stood two tasks longer
 * than its reason did.
 *
 * WHAT IS PRINTED, and why this shape rather than the two obvious alternatives:
 *
 *   defineProps({ label: { type: String, required: true }, … })
 *
 * `defineProps<T>()` and `withDefaults()` STAY DENIED at Gate 5. The runtime
 * declaration reaches the same call-site type checking with no type argument, no
 * TypeScript syntax in the emitted expression and no new dependency.
 *
 * BARE CONSTRUCTORS - `{ label: String }` - WERE MEASURED AND REJECTED. They
 * make every prop OPTIONAL, so `props.multiplier` becomes `number | undefined`
 * and the emitted component's OWN script fails strict TS regardless of any
 * parent: TS2722 on the `onTrace` calls and TS18048 on the `multiplier` read.
 * That is why `required` is not decoration here - it is what makes the printed
 * declaration type-check at all.
 *
 * `required` IS READ, NEVER SYNTHESIZED. It is `!optional`, and `optional` is
 * the `?` the author did or did not write. An entry with no `type` has no
 * `optional` either, and this function falls back to the array form rather than
 * assert a contract for a prop whose annotation it never saw.
 *
 * BOOLEAN IS THE ONE CARVE-OUT, AND IT IS BEHAVIOURAL, NOT STYLISTIC. `{ visible:
 * Boolean }` makes Vue cast an empty-string binding, flipping `visible=""` from
 * FALSY to TRUTHY and turning `<p>hidden</p>` into `<section data-scenario="s1">`
 * at vue@3.5.40 - measured three times independently. So a boolean prints
 * `type: null`, which normalizes to the array form's exact behaviour, while
 * KEEPING its `required`: the coercion hazard is a reason to drop the
 * constructor, not a reason to drop a second fact the source also states.
 * `type: null` is fail-closed for every type node this map does not recognise,
 * so an unmapped kind degrades to today's behaviour instead of guessing.
 *
 * A declared prop DEFAULT throws for the same reason one level down: Vue's only
 * baseline-safe route to a default in `<script setup>` is `withDefaults()`, which
 * requires the type-argument form. There is no corpus instance, so the
 * alternative would be untested dead code.
 *
 * DESTRUCTURING IS ALSO REFUSED, and that refusal is version-shaped rather than
 * stylistic. Reactive props destructure only became non-experimental in Vue 3.5;
 * before that, `const { multiplier } = defineProps(…)` reads the prop ONCE, and
 * S1's `computed` reads `multiplier` on every recomputation. IR-4 is deferred, so
 * this lane discharges the version corollary by emitting only baseline-safe
 * forms - and `props.multiplier` means the same thing at every Vue 3 version.
 *
 * `defineModel()` IS ALSO REFUSED HERE, on a ruling of record:
 * `docs/emitter-idiom-policy.md` WORKED EXAMPLE 12b (T009/T010, re-derived T012),
 * DENIED at the deciding Gate 5; Gates 3, 4 and 6 deny independently, 1 and 2 PASS.
 * This DECLARATION IS 12b's domain - whichever of the two forms it takes, the
 * printed prop ENTRIES are the same set - and ITS SIZE IS NOT A LITERAL THIS
 * COMMENT OWNS:
 * `derivePrintedPropEntries()` in `test/gate.test.ts` counts it off the goldens,
 * THROWS on empty, and pins the shipped message to it - corpus-derived and
 * CHECKED THERE, which is where today's figures are. This clause used to carry
 * them anyway, one sentence after disclaiming them; they were false two
 * scenarios later while the derivation stayed green.
 * ZERO are in reach BY CONSTRUCTION: one shared `prop:props` node
 * (`writable: false`, zero writes) leaves per-prop write-back no IR channel - a
 * missing per-prop IDENTITY (IR-1), not IR-8's TYPE.
 * IR-4 is NOT why this is refused - `v-model` and `defineModel` FAIL four gates
 * at the version this repo ships, and FAIL outranks DEFERRED.
 */
/**
 * TS type node -> Vue runtime prop constructor. TOTAL BY FAILING CLOSED.
 *
 * Every kind this map does not name returns `null`, which is Vue's own "do not
 * type-check this prop" and is behaviourally identical to the array form - so an
 * unrecognised annotation degrades to today's output instead of printing a guess
 * into an emitted artifact. Only the kinds the corpus actually carries are
 * mapped; adding speculative rows would be untested dead code, and the SHAPE of
 * a wrong row is a rendering change rather than a cosmetic one.
 *
 * `TSBooleanKeyword` IS DELIBERATELY ABSENT rather than missing. `Boolean` is
 * the one constructor that CASTS: it turns an empty-string binding into `true`,
 * which is a rendering change, so boolean falls through to `null` on purpose.
 * Its `required` still prints - see `propsDeclaration`.
 */
const PROP_TYPE_CONSTRUCTORS: ReadonlyMap<string, string> = new Map([
	['TSStringKeyword', 'String'],
	['TSNumberKeyword', 'Number'],
	['TSFunctionType', 'Function'],
]);

function propConstructor(type: SerializableAstNode | undefined): Expression {
	const name = type ? PROP_TYPE_CONSTRUCTORS.get(String(type.type)) : undefined;
	return name ? identifier(name) : literal(null);
}

function propOptionsProperty(name: string, type: SerializableAstNode, optional: boolean): Node {
	return {
		type: 'Property',
		kind: 'init',
		computed: false,
		method: false,
		shorthand: false,
		key: identifier(name),
		value: {
			type: 'ObjectExpression',
			properties: [
				{
					type: 'Property',
					kind: 'init',
					computed: false,
					method: false,
					shorthand: false,
					key: identifier('type'),
					value: propConstructor(type),
				},
				{
					type: 'Property',
					kind: 'init',
					computed: false,
					method: false,
					shorthand: false,
					key: identifier('required'),
					value: literal(!optional),
				},
			],
		},
	};
}

/**
 * STEP 5. `ModuleImport` -> the `.vue` specifier the emitted SFC imports. Same
 * one-for-one extension substitution React and Solid make to `.jsx`; nothing
 * else about the specifier is touched.
 *
 * The binding name is additionally checked against `RESERVED_SCRIPT_NAMES` and
 * the component's own scope, because `<script setup>` puts imports and setup
 * bindings in ONE namespace - an import that collided would shadow a binding the
 * template already resolves through, silently.
 */
function moduleImportSpecifiers(
	ir: EnrichedIR,
	component: EnrichedComponent,
): Map<string, string> {
	const specifiers = new Map<string, string>();
	const bound = new Set<string>([
		...RESERVED_SCRIPT_NAMES,
		...component.props.entries.map((entry) => entry.localName),
		...component.locals.flatMap((local) => local.names),
	]);
	for (const imported of ir.imports) {
		if (imported.resolvesTo !== 'tsrx-module' || !imported.source.endsWith('.tsrx'))
			throw new Error(`ModuleImport cannot be lowered: ${imported.source}`);
		if (imported.kind === 'namespace')
			throw new Error(
				`Vue emitter has no lowering for a namespace ModuleImport: ${imported.source}`,
			);
		if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(imported.localName))
			throw new Error(`Vue emitter rejects the import binding ${imported.localName}`);
		if (specifiers.has(imported.localName) || bound.has(imported.localName))
			throw new Error(
				`Vue emitter cannot import ${imported.localName}: the name is already bound in this module`,
			);
		specifiers.set(imported.localName, imported.source.replace(/\.tsrx$/, '.vue'));
	}
	return specifiers;
}

/**
 * STEP 5. The prop locals a `default-slot-projection` consumes, which Vue does
 * NOT deliver as props.
 *
 * `<Frame>...</Frame>` hands its children to Vue's DEFAULT SLOT, not to a
 * `children` prop, so declaring one in `defineProps` would announce an interface
 * no caller can satisfy and leave the emitted `props` binding unread. React and
 * Solid are the other way round - `children` really is a prop there - so this is
 * a genuine per-lane difference in where the same authored parameter lands, and
 * it is dropped from the declaration rather than declared and ignored.
 *
 * A name read BOTH as a slot site and somewhere else has no Vue spelling at all
 * (the slot content is not a value), and is refused by name in `emit`.
 */
function slotProjectedPropNames(component: EnrichedComponent): Set<string> {
	const names = new Set<string>();
	walk(component.template, (record) => {
		if (record.kind !== 'default-slot-projection') return;
		const site = record.site?.expression;
		if (site?.type === 'Identifier' && typeof site.name === 'string') names.add(site.name);
	});
	return names;
}

function propsDeclaration(component: EnrichedComponent): Statement | null {
	const projected = slotProjectedPropNames(component);
	const entries = component.props.entries.filter((entry) => !projected.has(entry.localName));
	if (entries.length === 0) return null;
	const names: string[] = [];
	for (const entry of entries) {
		if (entry.defaultValue !== undefined)
			throw new Error(
				`Vue emitter has no lowering for a prop default value: ${entry.localName}`,
			);
		if (entry.path.length !== 1)
			throw new Error(
				`Vue emitter requires a single-segment prop path, received ${entry.path.join('.')}`,
			);
		names.push(entry.path[0]!);
	}
	// ALL OR NOTHING, and the alternative is worse than it looks. A component
	// whose entries are only PARTLY annotated cannot be declared honestly in one
	// object: the unannotated entries have no authored requiredness, so they
	// would have to be given an INVENTED `required` - or a `required: false` that
	// silently contradicts a source that may well demand them. Emitting the array
	// form for the whole component keeps every prop in one regime and fails
	// closed to the behaviour this lane already ships. MEASURED at the time of
	// writing: annotation is per-component all-or-nothing across the corpus
	// (RenderOnce 4/4, the other seven scenarios 0/15), so this branch is a
	// guard against a corpus that changes, not a live split.
	const typed = entries.every((entry) => entry.type !== undefined);
	if (!typed)
		return variable(
			'const',
			identifier('props'),
			call(identifier('defineProps'), [
				{ type: 'ArrayExpression', elements: names.map((name) => literal(name)) },
			]),
		);
	return variable(
		'const',
		identifier('props'),
		call(identifier('defineProps'), [
			{
				type: 'ObjectExpression',
				properties: entries.map((entry, index) =>
					propOptionsProperty(names[index]!, entry.type!, entry.optional === true),
				),
			},
		]),
	);
}

function identifierIsUsed(ir: EnrichedIR, component: EnrichedComponent, name: string): boolean {
	let found = false;
	walk(
		{
			guards: component.guards,
			template: component.template,
			events: ir.records.events.filter((event) => event.componentId === component.id),
			bindings: ir.records.bindings.filter(
				(binding) => binding.componentId === component.id,
			),
		},
		(record) => {
			if (record.type === 'Identifier' && record.name === name) found = true;
		},
	);
	return found;
}

function collectRewrites(ir: EnrichedIR, context: EmitContext): void {
	const component = context.component;
	for (const entry of component.props.entries)
		context.rewrites.set(entry.localName, { kind: 'prop', path: entry.path });
	const componentBindings = ir.records.bindings.filter(
		(binding) => binding.componentId === component.id,
	);
	const bindingById = new Map(componentBindings.map((binding) => [binding.id, binding]));
	for (const local of component.locals) {
		for (const name of local.names)
			if (RESERVED_SCRIPT_NAMES.has(name))
				throw new Error(
					`Vue emitter refuses the component local ${JSON.stringify(name)}: it would shadow a binding <script setup> emission introduces`,
				);
		for (const id of local.semanticRecordIds) {
			const binding = bindingById.get(id);
			if (!binding) continue;
			// An `element` binding joins `state` and `computed` here because a Vue
			// template ref IS a `ref()`: a SCRIPT read of it needs `.value` for exactly
			// the same reason. The template needs no rewrite - Vue's own compiler
			// unwraps setup refs there, which is why the whole `ScriptRewrite` family
			// is script-scoped.
			if (
				binding.kind === 'state' ||
				binding.kind === 'computed' ||
				binding.kind === 'element'
			)
				context.rewrites.set(binding.name, { kind: 'ref' });
		}
	}
}

// ---------------------------------------------------------------------------
// step 4 - behaviors (`attach=`)
// ---------------------------------------------------------------------------

/**
 * ONE INSTALL/DISPOSE PAIR PER HOST, carrying every behavior declared on that
 * host in authored `order`, installed forwards and torn down BACKWARDS - the same
 * host-level granularity the React lane already has.
 *
 * THE SANCTIONED SET FOR THIS CONSTRUCT, stated before the gates rather than
 * after, and measured at vue@3.5.40:
 *
 *   1. `onMounted` + `onUnmounted` + `watch(sources, cb, { flush: 'post' })` over
 *      a template ref. Floors at 3.0. THIS IS WHAT IS EMITTED.
 *   2. A custom directive object (`vAttach = { mounted, updated, unmounted }`).
 *      Floors at 3.0, and is OUTSIDE the sanctioned set for this construct:
 *      `updated` fires on every component update, not on a declared input
 *      change, so the re-run obligation could only be met by re-implementing the
 *      dirty check inside the hook - at which point the directive is carrying no
 *      weight - and `<script setup>`'s `vFoo` naming convention would put a
 *      second synthesized name in template scope for nothing.
 *   3. A function ref `:ref="(el) => ..."`. Outside the set for the same reason
 *      the string form beat it at Step 3, plus one more: a function ref is
 *      re-invoked on RE-RENDER, which is neither mount nor a declared input
 *      change, so an unrelated re-render would tear the behavior down and
 *      reinstall it.
 *
 * There is therefore no baseline-versus-candidate pair to run the six gates over
 * - the same position Step 3's Svelte half was in - and every API named in (1)
 * floors at 3.0, so this lane's standing discharge of the idiom policy's version
 * corollary ("emit nothing but forms whose floor is 3.0/3.2") is unchanged.
 */
type VueBehaviorPlan = {
	readonly hostNodeId: string;
	readonly refName: string;
	/** True when the ref is this lowering's own, rather than a shared handle. */
	readonly ownsRef: boolean;
	readonly installName: string;
	readonly disposeName: string;
	readonly captureSources: readonly Expression[];
	readonly steps: ReadonlyArray<{
		readonly behaviorName: string;
		readonly behavior: Expression;
		readonly captureArguments: readonly Expression[];
		readonly cleanupName: string | null;
	}>;
};

function claimName(base: string, taken: Set<string>): string {
	let name = base;
	let index = 1;
	while (taken.has(name)) {
		name = `${base}${index}`;
		index += 1;
	}
	taken.add(name);
	return name;
}

/**
 * THE INPUT CAPTURE, AND WHY IT IS A PARAMETER RATHER THAN A REWRITE.
 *
 * `attach=` obliges the emitter to install with the node, honour a returned
 * cleanup, re-run on a declared input change - and, the quiet one, to let THE
 * CLEANUP OBSERVE THE INPUT VALUES CURRENT AT ITS OWN INSTALL. React gets that
 * from closure identity, Solid by running the cleanup before assigning its
 * captures. Vue would get the opposite for free: `disposeX()` runs after the ref
 * has already been written, so a cleanup body reading `value.value` would see the
 * NEW value and diverge from both shipped lanes.
 *
 * So the input names are appended to the authored function's own PARAMETER LIST
 * and the current values are passed at install. The body is transplanted with no
 * identifier renamed; `rewriteScript` is scope-aware and already treats a
 * parameter as shadowed, so the appended parameters suppress exactly the `.value`
 * respelling that would otherwise re-read through the ref.
 */
function vueBehaviorPlans(
	ir: EnrichedIR,
	component: EnrichedComponent,
	hostIds: ReadonlySet<string>,
	handleHosts: ReadonlyMap<string, string>,
	context: EmitContext,
	scopeNames: ReadonlySet<string>,
	taken: Set<string>,
): readonly VueBehaviorPlan[] {
	for (const behavior of ir.records.behaviors)
		if (behavior.componentId !== component.id)
			throw new Error(
				`BehaviorRecord ${behavior.id} belongs to another component: ${behavior.componentId}`,
			);
	const bindingById = new Map(
		ir.records.bindings
			.filter((binding) => binding.componentId === component.id)
			.map((binding) => [binding.id, binding]),
	);
	const byHost = new Map<string, Array<(typeof ir.records.behaviors)[number]>>();
	for (const behavior of [...ir.records.behaviors].sort((left, right) => left.order - right.order)) {
		if (!hostIds.has(behavior.hostNodeId))
			throw new Error(
				`Vue behavior ${behavior.id} names a host this component does not render: ${behavior.hostNodeId}`,
			);
		byHost.set(behavior.hostNodeId, [...(byHost.get(behavior.hostNodeId) ?? []), behavior]);
	}
	const plans: VueBehaviorPlan[] = [];
	for (const [hostNodeId, hostBehaviors] of byHost) {
		// A host that already carries an element handle SHARES its template ref. Two
		// `ref=` attributes on one element is not a Vue form, and synthesizing a
		// second name would be the shape `elementHandleHosts` already refuses.
		const shared = handleHosts.get(hostNodeId);
		const refName = shared ?? claimName('attachHost', taken);
		const captureNames: string[] = [];
		const steps = hostBehaviors.map((behavior) => {
			const fn = expression(behavior.behavior);
			if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')
				throw new Error(
					`Vue emitter has no lowering for a non-literal attach behavior: ${behavior.id}`,
				);
			const params = (fn.params ?? []) as Node[];
			if (params.some((param) => param.type !== 'Identifier'))
				throw new Error(
					`Vue emitter has no lowering for a destructured attach parameter: ${behavior.id}`,
				);
			const paramNames = new Set(params.map((param) => String(param.name)));
			const captures: string[] = [];
			for (const input of behavior.inputs) {
				// REFUSED RATHER THAN GUESSED, and for the same reason in all three lanes
				// Step 4 opened: a parameter can only shadow a BASE name, so a `value.a.b`
				// read has no capture spelling here. React and Solid carry the full path in
				// their dependency channels; this lane has none and the corpus has no
				// instance, so the shape throws by name instead of shipping a watch source
				// that is right and a capture that is stale.
				if (input.path.length > 0)
					throw new Error(
						`Vue emitter has no lowering for a behavior input with a member path (${behavior.id}: ${input.graphNodeId}.${input.path.join('.')})`,
					);
				if (input.via !== 'direct')
					throw new Error(
						`Vue emitter has no lowering for a ${input.via} behavior input: ${behavior.id}`,
					);
				const binding = bindingById.get(input.graphNodeId);
				if (!binding)
					throw new Error(`BehaviorRecord input has no binding: ${input.graphNodeId}`);
				if (paramNames.has(binding.name))
					throw new Error(
						`Vue emitter refuses the attach behavior ${behavior.id}: its input ${binding.name} collides with its own parameter of the same name`,
					);
				if (!captures.includes(binding.name)) captures.push(binding.name);
				if (!captureNames.includes(binding.name)) captureNames.push(binding.name);
			}
			fn.params = [...params, ...captures.map((name) => identifier(name))];
			return {
				behaviorName: claimName('behavior', taken),
				behavior: rewriteScript(fn, context.rewrites, new Set()),
				captureArguments: captures.map((name) =>
					rewriteScript(identifier(name), context.rewrites, new Set()),
				),
				cleanupName: behavior.returnsCleanup ? claimName('cleanup', taken) : null,
			};
		});
		plans.push({
			hostNodeId,
			refName,
			ownsRef: shared === undefined,
			installName: claimName('installAttachHost', new Set(scopeNames)),
			disposeName: claimName('disposeAttachHost', new Set(scopeNames)),
			captureSources: captureNames.map((name) =>
				arrow([], rewriteScript(identifier(name), context.rewrites, new Set())),
			),
			steps,
		});
	}
	return plans;
}

function vueBehaviorStatements(plan: VueBehaviorPlan, context: EmitContext): Statement[] {
	const statements: Statement[] = [];
	if (plan.ownsRef) {
		context.usedApis.add('ref');
		statements.push(variable('const', identifier(plan.refName), call(identifier('ref'), [])));
	}
	for (const step of plan.steps)
		statements.push(variable('const', identifier(step.behaviorName), step.behavior));
	for (const step of plan.steps)
		if (step.cleanupName)
			statements.push(variable('let', identifier(step.cleanupName), null));
	const node = member(identifier(plan.refName), 'value');
	const installBody: Statement[] = plan.steps.map((step) => {
		const invocation = call(identifier(step.behaviorName), [node, ...step.captureArguments]);
		return step.cleanupName
			? expressionStatement({
					type: 'AssignmentExpression',
					operator: '=',
					left: identifier(step.cleanupName),
					right: invocation,
				})
			: expressionStatement(invocation);
	});
	const disposeBody: Statement[] = [];
	for (const step of [...plan.steps].reverse()) {
		if (!step.cleanupName) continue;
		disposeBody.push({
			type: 'IfStatement',
			test: {
				type: 'BinaryExpression',
				operator: '===',
				left: {
					type: 'UnaryExpression',
					operator: 'typeof',
					prefix: true,
					argument: identifier(step.cleanupName),
				},
				right: literal('function'),
			},
			consequent: {
				type: 'BlockStatement',
				body: [expressionStatement(call(identifier(step.cleanupName), []))],
			},
			alternate: null,
		});
		disposeBody.push(
			expressionStatement({
				type: 'AssignmentExpression',
				operator: '=',
				left: identifier(step.cleanupName),
				right: identifier('undefined'),
			}),
		);
	}
	statements.push(
		variable(
			'const',
			identifier(plan.installName),
			arrow([], { type: 'BlockStatement', body: installBody }),
		),
	);
	// No behavior on this host returns a cleanup, so there is nothing to dispose.
	// An empty `disposeX` handed to `onUnmounted` would be a lifecycle hook that
	// does nothing - the shape `@angular-eslint/no-empty-lifecycle-method` exists
	// to catch in the sibling lane - so neither is emitted.
	const disposes = disposeBody.length > 0;
	if (disposes)
		statements.push(
			variable(
				'const',
				identifier(plan.disposeName),
				arrow([], { type: 'BlockStatement', body: disposeBody }),
			),
		);
	context.usedApis.add('onMounted');
	statements.push(expressionStatement(call(identifier('onMounted'), [identifier(plan.installName)])));
	if (disposes) {
		context.usedApis.add('onUnmounted');
		statements.push(
			expressionStatement(call(identifier('onUnmounted'), [identifier(plan.disposeName)])),
		);
	}
	if (plan.captureSources.length) {
		context.usedApis.add('watch');
		// `flush: 'post'` is not decoration: the re-install reads the node out of the
		// template ref, so it has to run AFTER Vue has patched the DOM for the same
		// change. It is also what keeps the re-run ordered like the shipped lanes -
		// dispose, then install, once per change.
		statements.push(
			expressionStatement(
				call(identifier('watch'), [
					{ type: 'ArrayExpression', elements: [...plan.captureSources] },
					arrow([], {
						type: 'BlockStatement',
						body: [
							...(disposes
								? [expressionStatement(call(identifier(plan.disposeName), []))]
								: []),
							expressionStatement(call(identifier(plan.installName), [])),
						],
					}),
					{
						type: 'ObjectExpression',
						properties: [
							{
								type: 'Property',
								kind: 'init',
								computed: false,
								shorthand: false,
								method: false,
								key: identifier('flush'),
								value: literal('post'),
							},
						],
					},
				]),
			),
		);
	}
	return statements;
}

/**
 * `ComponentEvaluationPolicy.ordinaryLocals` is `once-per-instance`, and in Vue
 * that needs NO lowering at all: `<script setup>` is the component's `setup()`
 * body, which runs exactly once per instance and is not itself a reactive
 * effect. Solid needs `untrack` here and Svelte needs `untrack` for the same
 * policy; Vue is the target where the policy is already the language's default,
 * so nothing is emitted to enforce it.
 *
 * `computedBindings: 'reactive'` is what `computed()` supplies, and it is the
 * only construct in the emitted script that re-runs.
 */
function scriptStatements(ir: EnrichedIR, context: EmitContext): Statement[] {
	const component = context.component;
	const componentBindings = ir.records.bindings.filter(
		(binding) => binding.componentId === component.id,
	);
	const bindingById = new Map(componentBindings.map((binding) => [binding.id, binding]));
	const statements: Statement[] = [];
	const props = propsDeclaration(component);
	if (props) statements.push(props);

	const rewrite = (node: Expression): Expression =>
		rewriteScript(node, context.rewrites, new Set());

	for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
		const semantic = local.semanticRecordIds
			.map((id) => bindingById.get(id))
			.filter((binding): binding is EnrichedGraphBinding => Boolean(binding));
		const handle = semantic.find((binding) => binding.kind === 'element');
		if (handle) {
			if (semantic.length > 1)
				throw new Error(
					`Vue element handle has unsupported multi-semantic shape: ${local.names.join(',')}`,
				);
			// THE AUTHORED `element<T>()` CALL IS NOT EMITTED. A Vue template ref is a
			// `ref()` whose name matches the template's `ref="..."` string; Vue's runtime
			// writes the node into it on mount and `null` on unmount.
			//
			// `ref()` and NOT `useTemplateRef('input')`: `useTemplateRef` is 3.5+, and
			// this lane's discharge of the idiom policy's version corollary is that it
			// emits nothing but forms in the gate's BASELINE_FORM_INVENTORY, every one of
			// which floors at 3.0/3.2. A 3.5 form would raise the emitted module's floor
			// for a spelling change - and MEASURED at 3.5.40, `useTemplateRef` produces
			// template codegen IDENTICAL to the string-ref form anyway.
			//
			// `ref()` AND NOT `ref(null)`, AND THAT IS A CORRECTION THIS STEP HAD TO
			// MAKE. `ref(null)` was emitted first and is a HARD TYPE ERROR: measured with
			// the demo's own `vue-tsc` over the emitted SFC, `ref(null)` infers
			// `Ref<null>` and `input?.focus()` reports
			// `TS2339: Property 'focus' does not exist on type 'never'`. `compileDiagnostics`
			// - THIS LANE'S OWN in-process oracle, and the thing `assertCompilesClean`
			// runs - reported an EXACT EMPTY diagnostic set on the same file in all four
			// `COMPILE_MODES`. The lane's own checker is structurally blind to this class,
			// which is the `pnpm e2e` warning one level in.
			//
			// NO TYPE ARGUMENT, and that asymmetry with the Qwik lane is deliberate.
			// Qwik's bare `useSignal()` is `Signal<unknown>`, which its `ref` prop
			// REFUSES, so that lane is forced into a fixed `HTMLElement` bound it cannot
			// source from the IR. Vue is not forced: `ref()` is clean under `vue-tsc`.
			// Importing Qwik's guess here would narrow a lane whose toolchain does not
			// ask for it and would make `input?.select()` red in Vue for no reason.
			// See notes/T005-refs.md for all four candidates and their measurements.
			context.usedApis.add('ref');
			statements.push(
				variable('const', identifier(handle.name), call(identifier('ref'), [])),
			);
			continue;
		}
		if (semantic.length > 1)
			throw new Error(
				`Vue local has unsupported multi-semantic shape: ${local.names.join(',')}`,
			);
		const state = semantic.find((binding) => binding.kind === 'state') as
			| StateBinding
			| undefined;
		const computed = semantic.find((binding) => binding.kind === 'computed');
		if (state) {
			if (local.declarationKind !== 'let')
				throw new Error(`Vue state requires a let binding in the IR: ${state.name}`);
			context.usedApis.add('ref');
			// `const`, not `let`: the BINDING never changes, only `.value` does.
			statements.push(
				variable(
					'const',
					identifier(state.name),
					call(identifier('ref'), [rewrite(expression(state.initializer))]),
				),
			);
			continue;
		}
		if (computed) {
			if (!computed.computed)
				throw new Error(`Computed binding ${computed.id} has no expression`);
			const site = expression(computed.computed.expression);
			if (site.type !== 'ArrowFunctionExpression' || site.params.length !== 0)
				throw new Error(`Computed binding ${computed.id} is not a zero-argument arrow`);
			if (site.body.type === 'BlockStatement')
				throw new Error(
					`Vue emitter has no lowering for a statement-bodied computed: ${computed.name}`,
				);
			context.usedApis.add('computed');
			statements.push(
				variable(
					'const',
					identifier(computed.name),
					call(identifier('computed'), [
						{
							type: 'ArrowFunctionExpression',
							id: null,
							params: [],
							body: rewrite(site.body),
							generator: false,
							async: false,
							expression: true,
						},
					]),
				),
			);
			continue;
		}
		if (!local.initializer)
			throw new Error(`Vue local ${local.names.join(',')} has no initializer`);
		const initializer = rewrite(expression(local.initializer));
		if (!local.names.some((name) => identifierIsUsed(ir, component, name))) {
			// A once-per-instance setup call whose binding nothing reads. Emitting the
			// declaration would leave an unused variable; the observable effect is the
			// call itself, so only the call is emitted.
			statements.push(expressionStatement(initializer));
			continue;
		}
		statements.push(variable(local.declarationKind, expression(local.pattern), initializer));
	}
	for (const plan of context.behaviorPlans)
		statements.push(...vueBehaviorStatements(plan, context));
	return statements;
}

// ---------------------------------------------------------------------------
// template
// ---------------------------------------------------------------------------

/**
 * `{` and `}` are escaped so an authored text node can never be read as a Vue
 * interpolation. MEASURED at 3.5.40: `&#123;&#123; x &#125;&#125;` in template
 * text compiles to the literal string `{{ x }}` rather than an interpolation,
 * because the tokenizer looks for `{{` in the raw source and entity decoding
 * happens afterwards.
 */
function escapeText(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('{', '&#123;')
		.replaceAll('}', '&#125;');
}

function escapeAttributeValue(value: string): string {
	return escapeText(value).replaceAll('"', '&quot;');
}

/**
 * A DIRECTIVE VALUE is JavaScript, not text, so only the two characters that
 * would end the attribute or start an entity are escaped.
 *
 * MEASURED at 3.5.40, because the whole construction depends on Vue decoding
 * entities BEFORE it parses the expression, and that is a hypothesis until it is
 * run: `v-on:click="(e) =&gt; { if (a &amp;&amp; b) …"` and
 * `v-on:click="log(&quot;hi&quot;)"` both compile to the decoded JavaScript.
 * `<` and `>` are deliberately left RAW - they are legal inside a quoted HTML
 * attribute value (measured: `if (a < b)` compiles), and escaping them would
 * make every emitted arrow unreadable for no behavioural gain.
 */
function escapeDirectiveValue(value: string): string {
	const escaped = value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
	// The SFC block parser finds `</template>` by scanning raw text, so an
	// expression carrying an end-tag-shaped sequence would truncate the block.
	// No corpus instance; refused rather than half-handled.
	if (escaped.includes('</'))
		throw new Error(
			`Vue emitter refuses a directive value containing "</": it would terminate the SFC template block (${value.slice(0, 60)})`,
		);
	return escaped;
}

const ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/**
 * Vue directives are reserved. `v-model` is IR-1 and out of scope; `v-slot` is
 * IR-3; `v-html` is an XSS vector with no IR vocabulary. Refusing the whole
 * `v-`/`:`/`@`/`#` surface as an ATTRIBUTE NAME keeps a directive from ever
 * arriving through the static-attribute path.
 */
function assertPlainAttributeName(name: string): void {
	if (!ATTRIBUTE_NAME.test(name) || name.startsWith('v-'))
		throw new Error(`Vue emitter rejects the attribute name ${JSON.stringify(name)}`);
}

function staticAttribute(attribute: StaticAttribute): string {
	assertPlainAttributeName(attribute.name);
	return attribute.value === true
		? attribute.name
		: `${attribute.name}="${escapeAttributeValue(attribute.value)}"`;
}

/**
 * DECISION SITE - the VALUED SHORTHANDS `@` and `:`, never a modifier, never
 * `v-slot`.
 *
 * `docs/emitter-idiom-policy.md` worked example 2a rules `v-bind`/`v-on`
 * shorthands WITH A VALUE **sugar** - all six gates PASS - and this emitter
 * adopts them. The ruling is `frameless-vue-v1` T005, folded into the policy and
 * implemented here by T006. It is recorded at the decision site rather than only
 * in the document because, in the policy's own words, a ruling that exists only
 * in a document will be re-litigated by the next person to open the emitter.
 *
 * WHAT THE RULING TURNS ON, so a reader does not have to take it on trust:
 * `@vue/compiler-core@3.5.40` `dist/compiler-core.cjs.js:2435` normalises `':'`
 * to `bind` and `'@'` to `on` inside `ondirname`, at PARSE TIME, before any
 * argument or modifier is read; the raw spelling survives only as `rawName`.
 * Equivalence is therefore total over every argument by construction, and it was
 * confirmed by measurement: identical template codegen and identical production
 * `compileScript` output in all four `ssr x isProd` modes, and byte-identical
 * SSR HTML.
 *
 * THAT SSR ARM IS A DATED MEASUREMENT, NOT A COVERAGE CLAIM, and it is written
 * that way deliberately. It used to read "for all three scenario components",
 * which was true of what T005 measured - three was the entire corpus then - but
 * phrased as coverage it silently became a false claim about every corpus that
 * followed. RE-MEASURED at `81be833` (2026-07-27, `vue@3.5.40`) over EVERY
 * `generated/S<n>.vue` shipped at that commit, each rendered through
 * `vue/server-renderer` against a mechanical longhand twin (`:` to `v-bind:`,
 * `@` to `v-on:`, applied inside `<template>` only) with the demo's own
 * scenario props: BYTE-IDENTICAL IN EVERY ONE, 70 shorthands respelled, and a
 * planted attribute rename per file confirming the comparator can report a
 * difference at all. The plant is an attribute NAME rather than a `.stop`
 * modifier because T005 already measured the SSR channel to be BLIND to event
 * routing - the codegen arm above is what carries that half, not this one.
 * Scope is "the whole emitted corpus at that commit", which a new scenario
 * EXTENDS rather than falsifies.
 *
 * ALWAYS WITH A VALUE, and that conjunct is load-bearing rather than decorative.
 * MEASURED at 3.5.40: a VALUE-LESS `:count` and a value-less `v-bind:count` both
 * compile as Vue 3.4's same-name shorthand - a version-gated form the baseline
 * inventory would accept, because the inventory reads the directive form and not
 * whether it carries a value - and a value-less `v-on` is a hard syntax error in
 * both spellings. The hazard is SYMMETRIC and pre-existing; the flip neither
 * creates nor enlarges it. All three emission sites below interpolate `="..."`
 * unconditionally so none of them can produce one, and the gate's
 * `directive-carries-value` policy asserts that over emitted output rather than
 * leaving it as a property of how this file happens to be written.
 *
 * WHAT IS STILL REFUSED, and why each refusal is separate from the adoption:
 *   - `.prevent`/`.stop`/`.self` and every other v-on modifier. IR-5's two
 *     declared actions are emitted as ORDINARY IN-BODY STATEMENTS - what React,
 *     Solid and Svelte already emit, and what the authored handler already
 *     spells. 2a covers `:` and `@` with a value and nothing else.
 *   - the `.foo="x"` PROP shorthand. `ondirname` pre-seeds a `prop` modifier for
 *     `'.'`, so it is a FOURTH shorthand carrying extra semantics, which worked
 *     example 2 never named and no ruling covers.
 *   - `#header` and every `v-slot` form. Worked example 2b is DENIED: G4 UNKNOWN
 *     (no deciding function - the IR's only slot kind is default-slot-projection,
 *     IR-3) and G6 FAIL (no check can exist for a path the emitter refuses to
 *     emit). Re-open only when IR-3 gains named-slot vocabulary.
 *
 * IR-5 under Vue 3.5.40.
 *
 * `stopPropagation` FAILS CLOSED. The corpus contains ZERO instances of it, so
 * an emitter path for it would be untested dead code, which in an emitter is
 * worse than absent code. It throws here, and the gate carries a matching
 * `no-stop-propagation` row over emitted output.
 *
 * THE SIZE OF THAT CORPUS IS NOT A LITERAL THIS COMMENT OWNS. It is whatever
 * `packages/compiler/test/goldens/s<n>-*.json` holds - the same derivation
 * `test/compile-emitted.test.ts`'s `scenarioCorpus()` reads its rows from, which
 * THROWS on empty rather than passing vacuously. RE-DERIVED at `81be833` by
 * scanning every golden in that directory: `stopPropagation` in none of them,
 * and the only IR-5 action present anywhere is `preventDefault`, eight
 * occurrences and all of them in `s3-event-form`.
 *
 * THE COUNT THIS REPLACES WAS NEVER TRUE, which is a different defect from a
 * stale one and is named so it does not get repaired as one. "zero instances
 * across all twelve existing goldens" was written at `5ca20c7`, when that
 * directory held THREE files; it has since been wrong in both directions
 * without ever once having been right. The substantive zero held throughout,
 * and that is exactly what made it durable - a true finding is what lends a
 * false count its credibility.
 *
 * `preventDefault` is emitted in the plain in-body form and MEASURED, not
 * assumed: `test/emitted-smoke.browser.test.ts` M3 varies the PRODUCT parameter
 * (the call present, then absent) inside a real `v-on:click` on a real
 * `<button type="submit">` and watches the form's submission track the call
 * rather than the emission form, with a negative control proving the observer can
 * see a submission at all.
 */
function syncPolicyGuard(event: EnrichedEventRecord, handlerBody: Statement[]): void {
	const policy: SyncPolicy | undefined = event.syncPolicy;
	if (!policy) return;
	const branches = 'branches' in policy ? policy.branches : [policy];
	for (const branch of branches)
		if (branch.actions.includes('stopPropagation'))
			throw new Error(
				`Vue emitter fails closed on a declared stopPropagation (${event.id}): the corpus has no instance to test the lowering against, and an untested emitter path is worse than an absent one`,
			);
	if ('branches' in policy) return;
	const unconditional =
		policy.when.type === 'constant-truthy' &&
		Boolean(policy.when.value) &&
		policy.actions.includes('preventDefault');
	if (!unconditional) return;
	const spelled = handlerBody.some(
		(statement) =>
			statement.type === 'ExpressionStatement' &&
			statement.expression?.type === 'CallExpression' &&
			statement.expression.arguments?.length === 0 &&
			statement.expression.callee?.type === 'MemberExpression' &&
			!statement.expression.callee.computed &&
			statement.expression.callee.property?.type === 'Identifier' &&
			statement.expression.callee.property.name === 'preventDefault',
	);
	if (!spelled)
		throw new Error(
			`Vue event ${event.id} declares an unconditional preventDefault its handler body does not spell as a top-level preventDefault() call`,
		);
}

/**
 * EMISSION SITE 1 of 3 for the adopted shorthand - the sole `v-on` spelling,
 * reached only through `eventAttribute()`, which appends `="..."` unconditionally.
 * `/^[a-z]+$/` is the whole `v-on` argument domain worked example 2a states its
 * totality against; 9 members of it were compiled in both spellings across four
 * modes with zero divergence.
 */
function eventDirectiveName(eventName: string): string {
	if (!/^[a-z]+$/.test(eventName))
		throw new Error(`Vue emitter rejects the event name ${JSON.stringify(eventName)}`);
	return `@${eventName}`;
}

/** `indent` is the ELEMENT's indent; attribute lines sit one level deeper. */
function eventAttribute(event: EnrichedEventRecord, indent: string): string {
	if (event.handlers.length !== 1)
		throw new Error(`Vue emitter does not support multiple handlers for ${event.id}`);
	const handler = expression(event.handlers[0]!.expression);
	if (handler.type !== 'ArrowFunctionExpression')
		throw new Error(`Event handler ${event.id} is not an arrow function`);
	const body: Statement[] =
		handler.body.type === 'BlockStatement'
			? handler.body.body
			: [expressionStatement(handler.body)];
	syncPolicyGuard(event, body);
	// VERBATIM. Template expressions are resolved by Vue's own compiler against
	// `bindingMetadata`, so a ref is unwrapped and a prop is reached without any
	// respelling here - the emitted handler is character-for-character the one the
	// IR declares, which is also what makes it readable against Vue's own docs.
	const printed = indentContinuation(printExpression(handler), `${indent}\t`);
	return `${eventDirectiveName(event.eventName)}="${escapeDirectiveValue(printed)}"`;
}

function width(indent: string, text: string): number {
	return indent.length * 4 + text.length;
}

function attributesOf(node: Extract<TemplateNode, { kind: 'host' }>, indent: string): string[] {
	const attributes = node.staticAttributes.map(staticAttribute);
	for (const binding of node.dynamicBindings) {
		assertPlainAttributeName(binding.name);
		// EMISSION SITE 2 of 3 for the adopted shorthand. `:` covers both
		// `attribute` and `property` kinds: Vue's runtime decides
		// attribute-versus-property itself from the tag and the name, the same way
		// Svelte does, so `kind` needs no separate spelling. The `.prop` and `.attr`
		// modifiers exist but are modifiers, and `.foo="x"` is a fourth shorthand no
		// ruling covers - see the decision site on `syncPolicyGuard`.
		//
		// `assertPlainAttributeName` above is what keeps this site total: it rejects
		// every attribute name beginning `:`, `@`, `#` or `v-`, so a directive can
		// never arrive through the static-attribute path and be respelled here.
		attributes.push(
			`:${binding.name}="${escapeDirectiveValue(
				indentContinuation(printExpression(expression(binding.expression)), `${indent}\t`),
			)}"`,
		);
	}
	return attributes;
}

/**
 * THE WHITESPACE RULE, MEASURED at 3.5.40 (T003 measurement M1) rather than
 * carried over from the Svelte lane, whose compiler applies a DIFFERENT rule.
 *
 * Vue's SFC template compiler defaults to `whitespace: 'condense'`. Measured, per
 * arm, through `compileTemplate` and `renderToString`:
 *
 *   - whitespace-only text between two ELEMENTS, CONTAINING A NEWLINE: REMOVED.
 *     `<div><p>a</p>\n<span>b</span></div>` renders `<div><p>a</p><span>b</span></div>`.
 *   - the same whitespace WITHOUT a newline: KEPT, condensed to one space. The
 *     newline is load-bearing, not decorative.
 *   - whitespace that shares a text node with content: CONDENSED, NOT REMOVED.
 *     `<button>\n\tincrement\n</button>` renders `<button> increment </button>`,
 *     and `<p>{{ a }}\n/{{ b }}</p>` renders `<p>1 /2</p>` - which is exactly
 *     S2's `1/2` observation turning into `1 /2` against the react, solid and
 *     svelte lanes.
 *
 * The rule that follows: a run of children may be broken across lines only if
 * EVERY child renders as an element. One text or interpolation child anywhere in
 * the run and the whole run is emitted inline. That is conservative - a lone
 * interpolation child measured safe on its own line - and conservative is the
 * point, because the unsafe arm is silent.
 *
 * `condense-stable-text` in the gate re-checks the RESULT independently, by
 * reading Vue's own condensed AST and rejecting any emitted text node with
 * leading or trailing whitespace.
 */
function isBlockLevel(node: TemplateNode): boolean {
	if (
		node.kind === 'host' ||
		node.kind === 'branch' ||
		node.kind === 'keyed-repeat' ||
		node.kind === 'component-reference'
	)
		return true;
	// `default-slot-projection` is deliberately NOT block-level. It stands where
	// React prints `{children}` and Solid prints `{props.children}`, both of which
	// keep their parent on one line, and `@vue/compiler-sfc` CONDENSES the
	// whitespace either way - so the inline classification is what keeps this
	// lane's served payload character-for-character equal to theirs at the slot
	// site, which is the axis s6 joined the corpus to protect.
	if (node.kind === 'fragment') return node.children.every(isBlockLevel);
	return false;
}

function renderChildren(children: readonly TemplateNode[], indent: string, inline: boolean): string {
	const chunks = children.flatMap((child) => renderNode(child, indent, inline));
	return inline ? chunks.join('') : chunks.join(`\n${indent}`);
}

function renderHost(
	node: Extract<TemplateNode, { kind: 'host' }>,
	indent: string,
	inline: boolean,
	structural: readonly string[],
): string[] {
	if (!/^[a-z][a-z0-9-]*$/.test(node.tag))
		throw new Error(`Vue emitter rejects the host tag ${JSON.stringify(node.tag)}`);
	const attributes = [...structural, ...attributesOf(node, indent)];
	// STEP 3, REFS. A PLAIN `ref="name"` ATTRIBUTE, not `:ref="(el) => ..."`.
	//
	// Both are sanctioned at 3.5.40 and both floor at 3.0, so the tie is broken on
	// the mechanism the compiler itself provides: with `<script setup>` and a setup
	// binding of the same name, `@vue/compiler-sfc` rewrites the STRING form into a
	// `ref_key`/`ref` pair in inline mode and resolves it against `setupState` in
	// non-inline mode. That machinery exists BECAUSE this is the form. A function
	// ref asks Vue to run an assignment it does not need to run. See
	// notes/T005-refs.md for the measurement, including the codegen in all four
	// `COMPILE_MODES`.
	const handleName = activeContext().handleHosts.get(node.id);
	// STEP 4, BEHAVIORS. The `attach=` lowering reads its node through a template
	// ref too, and SHARES the handle's ref when the host already has one - two
	// `ref=` attributes on one element is not a Vue form.
	const behaviorRef = activeContext().behaviorHosts.get(node.id);
	const refName = handleName ?? behaviorRef;
	if (refName !== undefined) attributes.push(`ref="${escapeAttributeValue(refName)}"`);
	for (const eventId of node.eventIds) {
		const event = activeContext().eventsById.get(eventId);
		if (!event) throw new Error(`Unknown event record: ${eventId}`);
		attributes.push(eventAttribute(event, indent));
	}
	const singleLine = `<${node.tag}${attributes.map((attribute) => ` ${attribute}`).join('')}>`;
	const fits =
		!attributes.some((attribute) => attribute.includes('\n')) &&
		width(indent, singleLine) <= PRINT_WIDTH;
	if (inline && !fits)
		throw new Error(
			`Vue emitter cannot inline <${node.tag}>: it sits in a text-bearing run and needs a multi-line start tag`,
		);
	const open = fits
		? singleLine
		: `<${node.tag}\n${attributes.map((attribute) => `${indent}\t${attribute}`).join('\n')}\n${indent}>`;
	if (VOID_ELEMENTS.has(node.tag)) {
		if (node.children.length)
			throw new Error(`Vue void element <${node.tag}> cannot have children`);
		return [open];
	}
	const close = `</${node.tag}>`;
	if (node.children.length === 0) return [open + close];
	if (inline || !node.children.every(isBlockLevel))
		return [open + renderChildren(node.children, indent, true) + close];
	return [
		`${open}\n${indent}\t${renderChildren(node.children, `${indent}\t`, false)}\n${indent}${close}`,
	];
}

/**
 * A branch becomes `v-if` / `v-else` ON THE ARM'S OWN ELEMENT, never a wrapping
 * `<template v-if>`.
 *
 * The wrapper is the general form and is refused deliberately: `<template>`
 * compiles to a Fragment, and a Fragment is server-rendered with `<!--[-->` /
 * `<!--]-->` anchor comments that would appear in the served payload the e2e
 * lane reads. An arm shape this emitter cannot place a directive on is therefore
 * a throw rather than a wrapper the corpus has no instance to test.
 */
function renderBranch(
	node: Extract<TemplateNode, { kind: 'branch' }>,
	indent: string,
	inline: boolean,
): string[] {
	if (node.arms.length < 1 || node.arms.length > 2)
		throw new Error(`Vue branch ${node.id} requires a then arm and at most one else arm`);
	if (node.arms[0]!.kind !== 'then')
		throw new Error(`Vue branch ${node.id} must open with a then arm`);
	if (node.arms[1] && node.arms[1].kind !== 'else')
		throw new Error(
			`Vue emitter has no lowering for a ${node.arms[1].kind} branch arm (${node.id})`,
		);
	const test = escapeDirectiveValue(printExpression(expression(node.expression)));
	const arm = (
		children: readonly TemplateNode[],
		directive: string,
		id: string,
	): string[] => {
		if (children.length !== 1 || children[0]!.kind !== 'host')
			throw new Error(
				`Vue emitter has no lowering for a branch arm that is not exactly one host element (${id}): a v-if/v-else directive needs an element to sit on, and <template> would introduce a server-rendered fragment anchor`,
			);
		return renderHost(children[0]!, indent, inline, [directive]);
	};
	const chunks = arm(node.arms[0]!.children, `v-if="${test}"`, node.id);
	const elseArm = node.arms[1];
	if (elseArm && elseArm.children.length) chunks.push(...arm(elseArm.children, 'v-else', node.id));
	return chunks;
}

function renderKeyedRepeat(
	node: Extract<TemplateNode, { kind: 'keyed-repeat' }>,
	indent: string,
	inline: boolean,
): string[] {
	if (node.index)
		throw new Error(`Vue keyed repeat ${node.id} has no lowering for an index binding`);
	if (node.empty.length)
		throw new Error(`Vue keyed repeat ${node.id} has no lowering for an empty fallback`);
	if (node.row.length !== 1 || node.row[0]!.kind !== 'host')
		throw new Error(
			`Vue emitter requires a keyed repeat row to be exactly one host element (${node.id}): v-for and :key need an element to sit on`,
		);
	const collection = escapeDirectiveValue(
		printExpression(expression(node.collection.expression)),
	);
	const key = escapeDirectiveValue(printExpression(expression(node.key.expression)));
	// EMISSION SITE 3 of 3 for the adopted shorthand - the literal key attribute.
	// `v-for` keeps its longhand: it has no shorthand at all, and `todo in todos`
	// is not a JavaScript expression, so it is a different construct entirely.
	return renderHost(node.row[0]!, indent, inline, [
		`v-for="${escapeDirectiveValue(node.item)} in ${collection}"`,
		`:key="${key}"`,
	]);
}

function renderNode(node: TemplateNode, indent: string, inline: boolean): string[] {
	if (node.kind === 'text') return [escapeText(node.value)];
	if (node.kind === 'dynamic-text')
		return [
			`{{ ${escapeDirectiveValue(
				indentContinuation(printExpression(expression(node.expression)), indent),
			)} }}`,
		];
	if (node.kind === 'fragment')
		return [renderChildren(node.children, indent, inline || !isBlockLevel(node))];
	if (node.kind === 'branch') return renderBranch(node, indent, inline);
	if (node.kind === 'keyed-repeat') return renderKeyedRepeat(node, indent, inline);
	if (node.kind === 'host') return renderHost(node, indent, inline, []);
	if (node.kind === 'component-reference') return renderComponentReference(node, indent, inline);
	// STEP 5. `<slot />` is the only Vue construct that renders a component's
	// default children, so this is a singleton sanctioned set and the six gates
	// have nothing to decide - the same shape T005 recorded for `bind:this` in the
	// Svelte lane. Vue delivers the parent's children to it with no call and no
	// optional guard: an unfilled `<slot />` renders its fallback content, and
	// this emitter prints none, so it renders NOTHING. That is the React and Solid
	// behaviour for `{children}` without the Svelte lane's `?.()` problem.
	if (node.kind === 'default-slot-projection') {
		const site = expression(node.site.expression);
		if (site.type !== 'Identifier')
			throw new Error(
				'Vue emitter has no lowering for a default-slot projection that is not a plain prop read',
			);
		return ['<slot />'];
	}
	throw new Error(
		`Vue emitter has no lowering for template node kind ${(node as { kind: string }).kind}`,
	);
}

/**
 * STEP 5, COMPOSITION. `<script setup>` puts an imported binding directly in
 * template scope, so a component reference is a PascalCase tag over the import
 * this module already prints - no `components:` option and no resolution table.
 */
function renderComponentReference(
	node: Extract<TemplateNode, { kind: 'component-reference' }>,
	indent: string,
	inline: boolean,
): string[] {
	const name = node.target.localName;
	// The template-side face of the multi-component lane limit; see `emit`.
	if (node.target.module === 'self')
		throw new Error(
			`Vue emitter has no lowering for a same-module component reference (${name}): a .vue SFC declares exactly one component`,
		);
	if (!activeContext().componentImports.has(name))
		throw new Error(`TemplateComponentReference has no matching ModuleImport: ${name}`);
	const attributes = node.props.map((prop) => {
		assertPlainAttributeName(prop.name);
		return `:${prop.name}="${escapeDirectiveValue(
			indentContinuation(printExpression(expression(prop.value.expression)), `${indent}\t`),
		)}"`;
	});
	const singleLine = `<${name}${attributes.map((attribute) => ` ${attribute}`).join('')}`;
	const fits =
		!attributes.some((attribute) => attribute.includes('\n')) &&
		width(indent, `${singleLine} />`) <= PRINT_WIDTH;
	if (inline && !fits)
		throw new Error(
			`Vue emitter cannot inline <${name}>: it sits in a text-bearing run and needs a multi-line start tag`,
		);
	const open = fits
		? `${singleLine}>`
		: `<${name}\n${attributes.map((attribute) => `${indent}\t${attribute}`).join('\n')}\n${indent}>`;
	if (node.children.length === 0) return [fits ? `${singleLine} />` : `${open}</${name}>`];
	const close = `</${name}>`;
	if (inline || !node.children.every(isBlockLevel))
		return [open + renderChildren(node.children, indent, true) + close];
	return [
		`${open}\n${indent}\t${renderChildren(node.children, `${indent}\t`, false)}\n${indent}${close}`,
	];
}

/**
 * The template printer is a pure string walk, so the context is held in a
 * module-local rather than threaded through every signature. `emit` is
 * synchronous and single-shot, so there is no interleaving to worry about; the
 * accessor throws rather than returning `undefined` if that ever stops holding.
 */
let currentContext: EmitContext | null = null;
function activeContext(): EmitContext {
	if (!currentContext) throw new Error('Vue template printer ran outside emit()');
	return currentContext;
}

// ---------------------------------------------------------------------------
// output verification
// ---------------------------------------------------------------------------

/**
 * The four modes the emitted SFC has to be clean in. `ssr` picks a different
 * code generator entirely (`@vue/compiler-ssr` rather than `@vue/compiler-dom`),
 * and `isProd` changes what the script compiler keeps, so neither is a
 * formality.
 */
export const COMPILE_MODES = [
	{ ssr: false, isProd: false },
	{ ssr: false, isProd: true },
	{ ssr: true, isProd: false },
	{ ssr: true, isProd: true },
] as const;

/**
 * Every diagnostic `@vue/compiler-sfc` produces for an emitted module, across all
 * four modes, as plain strings.
 *
 * TIPS ARE COLLECTED ALONGSIDE ERRORS, and that is not tidiness. `tips` is where
 * `validateHtmlNesting` lands, whose own message says the shape "can cause
 * hydration errors" - which is the property this whole board exists to protect.
 * MEASURED at 3.5.40: `<p><div>x</div></p>` produces zero errors and one tip.
 *
 * `ssrCssVars: []` is passed deliberately. With `ssr: true` and no `ssrCssVars`
 * at all, `compileTemplate` calls `warnOnce` and writes to the real `console`,
 * which would be an unowned diagnostic channel this function cannot see.
 */
export function compileDiagnostics(source: string, filename: string): string[] {
	const found: string[] = [];
	const { descriptor, errors } = parse(source, { filename });
	for (const error of errors) found.push(String(error));
	if (found.length) return found;
	// A SCRIPT BLOCK THAT IS NOT `setup` IS STILL AN ERROR - that is the Options
	// API leaking into this lane's output, and it is what the calibration arm in
	// test/compile-emitted.test.ts mutates for. NO SCRIPT BLOCK AT ALL IS NOT.
	//
	// STEP 5 MADE THAT CASE REACHABLE for the first time: a purely presentational
	// component - `frame.tsrx` is one - has no state, no events and no props Vue
	// declares, because its only prop is the slot-projected `children`, which this
	// lane delivers through `<slot />` rather than through `defineProps`. Vue's own
	// answer to that is a TEMPLATE-ONLY SFC, and `parse` drops a `<script setup>`
	// block whose content is only whitespace, so the previous unconditional check
	// rejected the emitter's own correct output. Measured: it did.
	if (!descriptor.scriptSetup && descriptor.script)
		return [`emitted Vue SFC ${filename} has no <script setup> block`];
	if (!descriptor.template) return [`emitted Vue SFC ${filename} has no <template> block`];
	for (const { ssr, isProd } of COMPILE_MODES) {
		let bindings;
		try {
			bindings = descriptor.scriptSetup
				? compileScript(descriptor, { id: filename, inlineTemplate: false, isProd })
						.bindings
				: undefined;
		} catch (error) {
			found.push(`compileScript(ssr=${ssr}, prod=${isProd}): ${(error as Error).message}`);
			continue;
		}
		const template = compileTemplate({
			source: descriptor.template.content,
			filename,
			id: filename,
			ssr,
			ssrCssVars: [],
			isProd,
			compilerOptions: { bindingMetadata: bindings },
		});
		for (const error of template.errors) found.push(String(error));
		for (const tip of template.tips) found.push(`tip: ${tip}`);
	}
	return found;
}

function assertCompilesClean(source: string, filename: string): void {
	const found = compileDiagnostics(source, filename);
	if (found.length)
		throw new Error(
			`Emitted Vue module ${filename} did not compile with an empty diagnostic set: ${found.join(' | ')}`,
		);
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

/**
 * Emit the supported Vue 3 `<script setup>` surface from
 * `frameless-enriched-ir/2` as a single-file component.
 *
 * A `.vue` module is one component exported as the module DEFAULT, so the IR's
 * named `ComponentExport` cannot be honoured by spelling; the component name is
 * carried in the generated header instead. That is a property of the target
 * format, not a choice, and it is the same divergence the Svelte lane records.
 *
 * The script block carries `lang="ts"` AND PRINTS NO TYPE. That pairing is not an
 * oversight: `frameless-emitter-capability-v1` T002 MEASURED that the coupling is
 * ONE-DIRECTIONAL - `@vue/compiler-sfc` compileScript on `<script setup lang="ts">`
 * over untyped source is clean, while a type WITHOUT the attribute throws - so the
 * attribute can land in its own behaviour-neutral step ahead of the annotations.
 * See `propsDeclaration` for the still-standing IR-8 ruling on what may be printed.
 */
/**
 * The `hostNodeId -> template-ref name` map, plus every fail-closed check that
 * has to hold before one byte of `ref="..."` is printed.
 *
 * `handleCalls` IS AN ASSERTION HERE, NOT A LOWERING, and an unasserted one would
 * be invisible. Vue template expressions are emitted VERBATIM and Vue's compiler
 * unwraps setup refs itself, so `input?.focus()` needs no rewriting and this
 * emitter never builds the call. The cost is that a `HandleCallRecord` the handler
 * does NOT spell would be dropped in silence - the module would compile, run, and
 * quietly not do the declared thing. Same shape as `syncPolicyGuard`.
 *
 * A call with NO `eventId` is REFUSED rather than checked: Vue writes a template
 * ref during mount, and `<script setup>` is the `setup()` body, which runs BEFORE
 * mount. Such a call would run against `null`. That is a Vue lifecycle fact, and
 * its repair is `onMounted` - a Step 4 construct, not this one's.
 */
function elementHandleHosts(
	ir: EnrichedIR,
	component: EnrichedComponent,
): ReadonlyMap<string, string> {
	const handleHosts = new Map<string, string>();
	for (const binding of ir.records.elementHandleBindings) {
		if (binding.componentId !== component.id)
			throw new Error(
				`ElementHandleBinding ${binding.id} belongs to another component: ${binding.componentId}`,
			);
		// A dotted handle name is a FORWARDED handle's spelling and this lane has no
		// lowering for one; refusing it keeps `ref="a.b"` off the printer, where Vue
		// would resolve it as a flat string key that matches no setup binding.
		if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(binding.handleName))
			throw new Error(
				`Vue emitter cannot bind an element handle named ${JSON.stringify(binding.handleName)}`,
			);
		if (handleHosts.has(binding.hostNodeId))
			throw new Error(
				`Vue emitter cannot bind two element handles to one host: ${binding.hostNodeId}`,
			);
		handleHosts.set(binding.hostNodeId, binding.handleName);
	}
	const hostIds = new Set<string>();
	walk(component.template, (record) => {
		if (record.kind === 'host' && typeof record.id === 'string') hostIds.add(record.id);
	});
	for (const [hostNodeId, name] of handleHosts)
		if (!hostIds.has(hostNodeId))
			throw new Error(
				`Vue element handle ${name} names a host this component does not render: ${hostNodeId}`,
			);
	const nameById = new Map(
		ir.records.elementHandleBindings.map((binding) => [binding.id, binding.handleName]),
	);
	const eventById = new Map(
		ir.records.events
			.filter((event) => event.componentId === component.id)
			.map((event) => [event.id, event]),
	);
	for (const call of ir.records.handleCalls) {
		if (call.componentId !== component.id)
			throw new Error(`HandleCallRecord belongs to another component: ${call.componentId}`);
		const name = nameById.get(call.handleBindingId)!;
		if (!call.eventId)
			throw new Error(
				`Vue emitter has no lowering for a handle call outside an event handler (${name}.${call.method}): a template ref is written on mount, and <script setup> runs before it`,
			);
		const event = eventById.get(call.eventId);
		if (!event) throw new Error(`HandleCallRecord has dangling event: ${call.eventId}`);
		let spelled = false;
		walk(
			event.handlers.map((handler) => handler.expression),
			(record) => {
				const callee = record.callee as Record<string, unknown> | undefined;
				if (record.type !== 'CallExpression' || !callee) return;
				if (
					callee.type === 'MemberExpression' &&
					callee.computed === false &&
					(callee.object as Record<string, unknown> | undefined)?.type === 'Identifier' &&
					(callee.object as Record<string, unknown>).name === name &&
					(callee.property as Record<string, unknown> | undefined)?.type ===
						'Identifier' &&
					(callee.property as Record<string, unknown>).name === call.method
				)
					spelled = true;
			},
		);
		if (!spelled)
			throw new Error(
				`Vue event ${call.eventId} declares a handle call ${name}.${call.method}() its handler AST does not spell`,
			);
	}
	return handleHosts;
}

export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	if (ir.records.persistence.length)
		throw new Error('Vue emitter does not support persistence-bearing IR');
	// STEP 5 SPLIT THIS GATE. `imports`, `component-reference` and
	// `default-slot-projection` are LOWERED; the `shared` family and the
	// multi-component module are refused BY THEIR OWN NAMES.
	//
	// THE MULTI-COMPONENT REFUSAL IS A LANE LIMIT, NOT A DEFERRAL - the same one
	// the Svelte lane records, for the same reason and with a different escape
	// hatch rejected. A `.vue` SFC is one component; the construct that would
	// declare a second in the same file is `defineComponent({ setup, render })`,
	// which abandons the `<template>` block entirely and would put this lane's
	// output on a render-function path none of its instruments cover -
	// `compileDiagnostics`, the SSR whitespace contract and the `ref_key`
	// machinery T005 chose the string ref for all assume the SFC template
	// compiler. That is outside the sanctioned set for this construct, not merely
	// second in a tie, so the module is refused and recorded.
	if (ir.components.length !== 1)
		throw new Error(
			`Vue emitter has no lowering for a multi-component module (${ir.components.map((component) => component.name).join(', ')}): a .vue SFC declares exactly one component`,
		);
	if (
		ir.records.sharedDefinitions.length ||
		ir.records.sharedInstances.length ||
		ir.records.sharedReads.length ||
		ir.records.sharedCalls.length ||
		ir.records.sharedWrites.length
	)
		throw new Error('Vue emitter does not support shared constructs');
	// STEP 4 OPENED `behaviors`. `handleForwards` STAYS REFUSED, by name: it hands
	// a child's node to a PARENT module, which needs the composition path Step 5
	// owns.
	if (ir.records.handleForwards.length)
		throw new Error('Vue emitter does not support forwarding a handle to a parent module');
	if (ir.module.exports.length !== 1)
		throw new Error('A .vue module exports exactly one component');
	const component = ir.components[0]!;
	if (component.guards.length)
		throw new Error(
			`Vue emitter has no lowering for an early component guard (${component.name}): a .vue component has no return statement to guard`,
		);
	if (component.template.length !== 1)
		throw new Error(
			`Vue emitter requires exactly one root template node (${component.name}): multiple roots compile to a Fragment, which is server-rendered with anchor comments the e2e lane would read out of the payload`,
		);
	// STEP 5. A slot-projected prop local is NOT a value in this lane - the content
	// lives in the default slot - so any OTHER read of the same name has no
	// spelling here and is refused by name rather than lowered to a `props.x` that
	// would be `undefined` at runtime.
	const projectedNames = slotProjectedPropNames(component);
	if (projectedNames.size) {
		// The projection sites are skipped by NOT DESCENDING INTO THEM. `walk` visits
		// every nested object, so a guard inside the visitor would still let the
		// site's own `Identifier` through and refuse every slot in the corpus -
		// measured, on the first run of this check.
		const readOutsideProjections = (nodes: readonly TemplateNode[], into: Set<string>): void => {
			const collect = (value: unknown): void => {
				walk(value, (record) => {
					if (record.type === 'Identifier' && typeof record.name === 'string')
						into.add(record.name);
				});
			};
			for (const node of nodes) {
				if (node.kind === 'default-slot-projection') continue;
				if (node.kind === 'host') {
					collect(node.dynamicBindings);
					readOutsideProjections(node.children, into);
				} else if (node.kind === 'fragment') readOutsideProjections(node.children, into);
				else if (node.kind === 'component-reference') {
					collect(node.props);
					readOutsideProjections(node.children, into);
				} else if (node.kind === 'branch') {
					collect(node.expression);
					node.arms.forEach((arm) => readOutsideProjections(arm.children, into));
				} else if (node.kind === 'keyed-repeat') {
					collect([node.collection, node.key]);
					readOutsideProjections(node.row, into);
					readOutsideProjections(node.empty, into);
				} else collect(node);
			}
		};
		const read = new Set<string>();
		readOutsideProjections(component.template, read);
		walk(
			ir.records.events.filter((event) => event.componentId === component.id),
			(record) => {
				if (record.type === 'Identifier' && typeof record.name === 'string')
					read.add(record.name);
			},
		);
		for (const projected of projectedNames)
			if (read.has(projected))
				throw new Error(
					`Vue emitter has no lowering for reading the slot-projected prop ${projected} as a value: Vue delivers child content through the default slot, not through a prop`,
				);
	}
	const handleHosts = elementHandleHosts(ir, component);
	const componentImports = moduleImportSpecifiers(ir, component);
	const context: EmitContext = {
		component,
		componentImports,
		eventsById: new Map(
			ir.records.events
				.filter((event) => event.componentId === component.id)
				.map((event) => [event.id, event]),
		),
		rewrites: new Map<string, ScriptRewrite>(),
		usedApis: new Set<VueApi>(),
		handleHosts,
		behaviorHosts: new Map<string, string>(),
		behaviorPlans: [],
	};
	currentContext = context;
	try {
		collectRewrites(ir, context);
		const hostIds = new Set<string>();
		walk(component.template, (record) => {
			if (record.kind === 'host' && typeof record.id === 'string') hostIds.add(record.id);
		});
		const scopeNames = new Set<string>([
			...RESERVED_SCRIPT_NAMES,
			...component.props.entries.map((entry) => entry.localName),
			...component.locals.flatMap((local) => local.names),
			...handleHosts.values(),
		]);
		const taken = new Set<string>(scopeNames);
		walk(
			ir.records.behaviors.filter((behavior) => behavior.componentId === component.id),
			(record) => {
				if (record.type === 'Identifier' && typeof record.name === 'string')
					taken.add(record.name);
			},
		);
		const behaviorPlans = vueBehaviorPlans(
			ir,
			component,
			hostIds,
			handleHosts,
			context,
			scopeNames,
			taken,
		);
		context.behaviorPlans.push(...behaviorPlans);
		for (const plan of behaviorPlans) context.behaviorHosts.set(plan.hostNodeId, plan.refName);
		const statements = scriptStatements(ir, context);
		const template = renderChildren(component.template, '\t', false);
		const imports: Statement[] = context.usedApis.size
			? [importDeclaration([...context.usedApis].sort(), 'vue')]
			: [];
		// A `.vue` SFC's component is its DEFAULT export, so every cross-module
		// component reference imports the default binding whatever the IR's
		// `ComponentExport` named it - the same substitution the Svelte lane makes.
		for (const [localName, source] of componentImports)
			imports.push({
				type: 'ImportDeclaration',
				specifiers: [{ type: 'ImportDefaultSpecifier', local: identifier(localName) }],
				source: { type: 'Literal', value: source, raw: `'${source}'` },
			} as unknown as Statement);
		const body = [...imports, ...statements];
		const script = printStatements(body)
			.split('\n')
			.map((line) => (line === '' ? line : `\t${line}`))
			.join('\n');
		// A TEMPLATE-ONLY SFC when there is nothing to put in the script block. An
		// empty `<script setup>` is not a smaller version of a script block: `parse`
		// drops it, so the emitted module would claim a setup block it does not have.
		// See the matching arm in `compileDiagnostics`.
		const source =
			`<!-- @generated by @frameless/vue from ${component.name}; do not edit. -->\n` +
			(body.length ? `<script setup lang="ts">\n${script}\n</script>\n\n` : '') +
			`<template>\n\t${template}\n</template>\n`;
		assertCompilesClean(source, `${component.name}.vue`);
		return source;
	} finally {
		currentContext = null;
	}
}
