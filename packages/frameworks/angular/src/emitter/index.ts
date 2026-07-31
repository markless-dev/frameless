import { parseTemplate } from '@angular/compiler';
import {
	ENRICHED_IR_VERSION,
	type EnrichedComponent,
	type EnrichedEventRecord,
	type EnrichedGraphBinding,
	type EnrichedIR,
	type LocalDeclaration,
	type SerializableAstNode,
	type StaticAttribute,
	type SyncPolicy,
	type TemplateNode,
} from '@frameless/compiler';
import {
	assign,
	expression,
	expressionStatement,
	type Expression,
	indentBlock,
	indentContinuation,
	member,
	type Node,
	printExpression,
	printStatements,
	returnStatement,
	type Statement,
	thisExpression,
	walk,
} from './estree.ts';

/**
 * The lowered signature of one IR event record.
 *
 * `forVariables` are the enclosing `@for` item names, OUTERMOST FIRST. They are a
 * STRUCTURAL template fact, which is what makes passing them admissible where a
 * content fact would not be (`frameless-angular-v1` T002 ruling 3d).
 */
type LoweredHandler = {
	readonly event: EnrichedEventRecord;
	readonly name: string;
	readonly forVariables: readonly string[];
	readonly eventParameter: string;
	/**
	 * Whether the AUTHORED arrow carried `async`. Like `eventParameter`, this is a
	 * DECLARED SIGNATURE fact - a flag on the arrow node, alongside its parameter
	 * list - and never a fact about the body, so reading it is admissible where
	 * inspecting statements would be a content trigger (ruling 3a).
	 */
	readonly isAsync: boolean;
};

type EmitContext = {
	readonly component: EnrichedComponent;
	/**
	 * Every name this emitter promotes to a CLASS MEMBER: props (including
	 * `onTrace`), state, derived, and ordinary component locals. Computed from
	 * DECLARED IR FIELDS - `component.props.entries` and `component.locals[].names`
	 * - before any handler body is read, which is the property that makes
	 * `this.`-qualification a total function rather than a content trigger.
	 */
	readonly members: ReadonlySet<string>;
	readonly handlersByEventId: ReadonlyMap<string, LoweredHandler>;
	/**
	 * Host node id -> the `#name` template reference variable, for every
	 * `ElementHandleBinding` this component owns. Empty for every scenario in the
	 * corpus, which is what keeps the emitted bytes of the eight goldens unmoved.
	 */
	readonly handleHosts: ReadonlyMap<string, string>;
	/**
	 * Host node id -> the `#name` template reference variable the `attach=`
	 * lowering reads its node through. Shares the handle's own reference when the
	 * host already carries one, and is empty for every scenario in the corpus.
	 */
	readonly behaviorHosts: ReadonlyMap<string, string>;
	readonly behaviorPlans: readonly AngularBehaviorPlan[];
	/**
	 * STEP 5. Class name -> element selector, for every name a `component-reference`
	 * may take: each `.tsrx` `ModuleImport` plus every component DECLARED IN THIS
	 * MODULE. Angular is the second of the two lanes that can carry both - a `.ts`
	 * file holds as many `@Component` classes as the module has components - so
	 * there is no self-reference limit to record here.
	 */
	readonly referenceableComponents: ReadonlyMap<string, string>;
	/** Class names this component's template actually referenced, for `imports:`. */
	readonly referenced: Set<string>;
};

/**
 * Names the emitted CLASS introduces itself. A component member with one of these
 * names would silently collide with emitter-owned machinery, so it is refused
 * rather than renamed.
 */
const RESERVED_MEMBER_NAMES = new Set([
	'constructor',
	'ngOnInit',
	// STEP 4's three hooks join the list for the reason the first two are on it: a
	// component member of the same name would silently collide with a method the
	// emitted class owns.
	'ngAfterViewInit',
	'ngDoCheck',
	'ngOnDestroy',
]);

/**
 * Void elements are emitted WITHOUT the self-closing slash. MEASURED at
 * `@angular/compiler` 22.0.8 through `parseTemplate`, which is the same parser
 * `ng build` runs: `<input data-action="new" [value]="draft">` returns
 * `errors === null`.
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

/** Indent of the template literal's contents inside the `@Component` decorator. */
const TEMPLATE_INDENT = '\t\t';

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
 * `type` and `optional` are IR-8: ADMITTED AND SHAPE-CHECKED HERE, DELIBERATELY
 * NOT PRINTED. Admitting a key without checking its shape would trade one blind
 * spot for another, so a `type` that is not an AST node is rejected by name too,
 * and so is an `optional` that is not a boolean.
 *
 * `optional` IS ALSO CHECKED AGAINST `type`, not just in isolation. The two are
 * read from ONE `TSPropertySignature` at the compiler's only supply site, so an
 * `optional` arriving WITHOUT a `type` did not come from source - it is
 * requiredness synthesized somewhere downstream, which is precisely the
 * invention this phase refuses. This lane rejects that pairing even though it
 * prints neither field, because a validator that only guards what it consumes
 * is how the nested blind spot arose in the first place.
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
		throw new Error('Angular emitter requires at least one component per IR artifact');
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
	for (const [family, records] of Object.entries(ir.records as unknown as Record<string, unknown>))
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
// this.-qualification: THE ONE transformation applied to a transplanted body
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
				`Angular emitter has no lowering for the binding pattern ${String(pattern.type)}`,
			);
	}
}

/**
 * THE TWO-NAME GLOBALS ALLOWLIST, ruled by `frameless-app-fidelity-v1` T003.
 *
 * `Promise` and `setTimeout` MAY be named in a transplanted body. Nothing else
 * may. The list is SHARED WITH THE VUE LANE - `packages/frameworks/vue/src/emitter/index.ts`
 * declares the same two names for the same ruling and enforces them with the same
 * fail-closed throw - and the two copies exist rather than one import because
 * neither package depends on the other and the shared package they both import,
 * `@frameless/compiler`, is an IR contract rather than a per-lane emission policy.
 * A THIRD NAME IS A NEW RULING, NOT AN EDIT, and it has to move both copies.
 *
 * WHY EXACTLY THESE TWO, AND WHY THE LIST IS NOT LONGER. T003 censused all 17
 * compiler fixtures comment-stripped: the ONLY globals named in authored
 * executable code are `Promise` and `setTimeout`, in S11 and S12 alone. `Date`,
 * `JSON`, `Math`, `console`, `fetch`, `localStorage` and `document` score ZERO.
 * The standing argument this file used to make against an allowlist - that it
 * "would be untested dead code, which in an emitter is worse than absent code" -
 * is what SELECTS these two and REFUSES the rest: these two have ten call sites
 * and two whole applications exercising them, and every other candidate has none.
 *
 * `Date` IS REFUSED ON DETERMINISM, NOT ON DEFERRAL. It is a nondeterministic
 * clock, and this repo proves by BYTE-EQUALITY - the derivation proofs, the
 * ratified goldens, and e2e's "all observations equal" across six lanes. The
 * literal dates in S13, S15 and S17 are the determinism the oracle requires, not
 * a workaround for a missing capability.
 *
 * The IR's one statement-injecting channel - `ir.records.persistence`, which
 * injects `__framelessWrite(...)` into handler bodies - is still refused whole by
 * `emit()`, so that identifier can never arrive here. Any OTHER new free name is
 * still a loud throw and a deliberate edit.
 */
const TRANSPLANTED_GLOBALS: ReadonlySet<string> = new Set(['Promise', 'setTimeout']);

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
 * RULING 3e AS RESTATED BY `frameless-angular-v1` T003a, which supersedes T002's
 * original "verbatim transplant with nothing rewritten inside it".
 *
 * The lowered method body is transplanted with EXACTLY ONE transformation, and it
 * is TOTAL, SCOPE-AWARE and FAIL-CLOSED:
 *
 *   Every free identifier occurrence that resolves - under ordinary lexical
 *   scoping, with body-local declarations, function/arrow parameters and `@for`
 *   loop variables shadowing - to a name in the component's DECLARED BINDING SET
 *   is qualified as `this.<name>`.
 *
 * Operators are untouched: `next++` becomes `this.next++`. NOTHING ELSE MOVES -
 * not `event`, not body-local `const`, not lambda parameters, not `@for`
 * variables (they arrive as method parameters). An identifier whose binding
 * cannot be resolved is a THROW, never a guess.
 *
 * WHY THIS IS ADMISSIBLE WHERE RULING 3a's INLINING RULE WAS NOT. 3a's forbidden
 * content trigger was a DISCRIMINATING PREDICATE OVER BODY CONTENTS SELECTING
 * BETWEEN TWO EMISSION SHAPES - which is why two careful readers of one corpus
 * counted 2 and 6 inlinable handlers. This is a total function applied
 * identically to every handler, over a name set that is a DECLARED IR FACT known
 * before any body is read. No subset, no branch, no shape choice, no boundary to
 * disagree about. Gate 3 is not engaged; Gate 5 is not engaged. Same
 * admissibility ground as 3d's `@for` variables.
 *
 * THE GLOBALS ALLOWLIST IS EXACTLY TWO NAMES - `Promise` and `setTimeout` - and
 * it is declared and argued at `TRANSPLANTED_GLOBALS` above. This comment used to
 * read "THERE IS NO GLOBALS ALLOWLIST, deliberately", on the ground that `Math`,
 * `JSON`, `console` and friends have ZERO instances across the corpus and an
 * allowlist would therefore be untested dead code. THAT ARGUMENT STILL STANDS AND
 * IT IS WHAT KEEPS THE LIST AT TWO: `frameless-app-fidelity-v1` T003 censused the
 * corpus and found these two names - and ONLY these two - in authored executable
 * code, at ten call sites across S11 and S12. Every other candidate still scores
 * zero and is still refused. A THIRD NAME IS A NEW RULING.
 *
 * A name that is neither in scope, nor a declared member, nor one of the two is
 * still a loud throw and a deliberate edit.
 *
 * Reference positions only. A non-computed member property, a non-computed object
 * key, a declaration id and a function parameter are all IDENTIFIERS that are not
 * references, and each is stepped over by name below rather than by a generic
 * walk. A shorthand property whose value is qualified loses its shorthand,
 * because `{ count }` and `{ count: this.count }` are different objects.
 */
function qualify(node: Node, members: ReadonlySet<string>, scope: ReadonlySet<string>): Node {
	const visit = (value: Node, inScope: ReadonlySet<string>): Node =>
		qualify(value, members, inScope);
	const visitAll = (values: Array<Node | null> | undefined, inScope: ReadonlySet<string>): void => {
		if (!values) return;
		for (const [index, entry] of values.entries())
			if (entry) values[index] = visit(entry, inScope);
	};
	const inner = (names: Iterable<string>): Set<string> => {
		const next = new Set(scope);
		for (const name of names) next.add(name);
		return next;
	};

	switch (node.type) {
		case 'Identifier': {
			const name = String(node.name);
			if (scope.has(name)) return node;
			if (members.has(name)) return member(thisExpression(), name);
			// LAST, NOT FIRST. A body-local binding and a declared component member
			// both SHADOW the allowlist, because a component that declares its own
			// `setTimeout` means `this.setTimeout` and an authored `const Promise = ...`
			// means the local. The global is only reached when nothing else binds the
			// name, which is exactly when it IS the global.
			if (TRANSPLANTED_GLOBALS.has(name)) return node;
			throw new Error(
				`Angular emitter cannot resolve the identifier ${JSON.stringify(name)} in a transplanted body: ` +
					'it is neither a body-local binding, a function parameter, a @for variable, a declared ' +
					`component member (${[...members].sort().join(', ')}), nor one of the two allowlisted ` +
					`globals (${[...TRANSPLANTED_GLOBALS].sort().join(', ')}). The emitter throws rather than ` +
					'guessing whether it is a global',
			);
		}
		case 'Literal':
		case 'ThisExpression':
		case 'Super':
			return node;
		case 'TemplateLiteral':
			visitAll(node.expressions as Node[], scope);
			return node;
		case 'TaggedTemplateExpression':
			node.tag = visit(node.tag, scope);
			node.quasi = visit(node.quasi, scope);
			return node;
		case 'MemberExpression':
			node.object = visit(node.object, scope);
			if (node.computed) node.property = visit(node.property, scope);
			return node;
		case 'CallExpression':
		case 'NewExpression':
			node.callee = visit(node.callee, scope);
			visitAll(node.arguments as Node[], scope);
			return node;
		case 'ObjectExpression':
			for (const property of (node.properties ?? []) as Node[]) {
				if (property.type === 'SpreadElement') {
					property.argument = visit(property.argument, scope);
					continue;
				}
				if (property.type !== 'Property')
					throw new Error(
						`Angular emitter has no lowering for the object member ${String(property.type)}`,
					);
				if (property.computed) property.key = visit(property.key, scope);
				const before = property.value;
				property.value = visit(property.value, scope);
				if (property.shorthand && property.value !== before) property.shorthand = false;
			}
			return node;
		case 'ArrayExpression':
			visitAll(node.elements as Array<Node | null>, scope);
			return node;
		case 'SpreadElement':
			node.argument = visit(node.argument, scope);
			return node;
		case 'ArrowFunctionExpression':
		case 'FunctionExpression': {
			const names = new Set<string>();
			for (const param of (node.params ?? []) as Node[]) declaredNames(param, names);
			const nested = inner(names);
			node.body = visit(node.body, nested);
			return node;
		}
		case 'BinaryExpression':
		case 'LogicalExpression':
			node.left = visit(node.left, scope);
			node.right = visit(node.right, scope);
			return node;
		case 'AssignmentExpression':
			node.left = visit(node.left, scope);
			node.right = visit(node.right, scope);
			return node;
		case 'UnaryExpression':
		case 'UpdateExpression':
		case 'AwaitExpression':
			node.argument = visit(node.argument, scope);
			return node;
		case 'ConditionalExpression':
			node.test = visit(node.test, scope);
			node.consequent = visit(node.consequent, scope);
			node.alternate = visit(node.alternate, scope);
			return node;
		case 'SequenceExpression':
			visitAll(node.expressions as Node[], scope);
			return node;
		case 'ChainExpression':
			node.expression = visit(node.expression, scope);
			return node;
		case 'BlockStatement': {
			const nested = inner(blockScopeNames((node.body ?? []) as Node[]));
			visitAll(node.body as Node[], nested);
			return node;
		}
		case 'ExpressionStatement':
			node.expression = visit(node.expression, scope);
			return node;
		case 'ReturnStatement':
		case 'ThrowStatement':
			if (node.argument) node.argument = visit(node.argument, scope);
			return node;
		case 'IfStatement':
			node.test = visit(node.test, scope);
			node.consequent = visit(node.consequent, scope);
			if (node.alternate) node.alternate = visit(node.alternate, scope);
			return node;
		case 'VariableDeclaration':
			for (const declarator of (node.declarations ?? []) as Node[])
				if (declarator.init) declarator.init = visit(declarator.init, scope);
			return node;
		default:
			throw new Error(
				`Angular emitter has no lowering for the expression node ${String(node.type)}`,
			);
	}
}

// ---------------------------------------------------------------------------
// handler lowering
// ---------------------------------------------------------------------------

function upperCamel(segment: string): string {
	if (!/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/.test(segment))
		throw new Error(
			`Angular emitter cannot derive a method-name segment from ${JSON.stringify(segment)}`,
		);
	return segment
		.split(/[-_]/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}

/**
 * RULING 3b - `on<HostNodeId><EventName>`, each segment upper-camelled from
 * DECLARED IR FIELDS verbatim (`h7` + `input` -> `onH7Input`).
 *
 * Keyed on `(hostNodeId, eventName)`, never on contents and never on a counter.
 * Deliberately NOT the IR id (`event:N`): an index shifts every downstream name
 * when a handler is inserted upstream, so a one-line source edit would rewrite the
 * whole class and every golden with it.
 */
function handlerMethodName(event: EnrichedEventRecord): string {
	return `on${upperCamel(event.hostNodeId)}${upperCamel(event.eventName)}`;
}

/**
 * IR-5 under Angular 22, and it is the same shape as the Vue lane's.
 *
 * `stopPropagation` FAILS CLOSED: zero instances across all twelve existing
 * goldens, so an emitter path for it would be untested dead code. The gate
 * carries a matching `no-stop-propagation` row over emitted output.
 *
 * `preventDefault` is emitted as an ORDINARY IN-BODY STATEMENT, which is what the
 * authored handler already spells and what the react, solid, qwik, svelte and vue
 * lanes already emit. Angular has a second route - a template statement
 * EVALUATING TO `false` makes Angular call `preventDefault()` for you - and this
 * emitter does not use it: every lowered call site is `onX($event)`, whose value
 * is the method's `undefined` return.
 *
 * The body-verbatim property is also what makes IR-5 FREE here: S3's four
 * `syncPolicy` bodies carry `event.preventDefault()`, which transplants unchanged
 * into a resident SYNCHRONOUS class method, so the Qwik QRL-laziness failure has
 * no analogue.
 */
function syncPolicyGuard(event: EnrichedEventRecord, handlerBody: readonly Statement[]): void {
	const policy: SyncPolicy | undefined = event.syncPolicy;
	if (!policy) return;
	const branches = 'branches' in policy ? policy.branches : [policy];
	for (const branch of branches)
		if (branch.actions.includes('stopPropagation'))
			throw new Error(
				`Angular emitter fails closed on a declared stopPropagation (${event.id}): the corpus has no instance to test the lowering against, and an untested emitter path is worse than an absent one`,
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
			`Angular event ${event.id} declares an unconditional preventDefault its handler body does not spell as a top-level preventDefault() call`,
		);
}

/**
 * RULING 3a - EVERY event record is lowered to a class method, unconditionally.
 *
 * T001 counted 13 of 14 needing lowering; the Judge counted 15 records and up to
 * SIX inlinable by the letter of Angular 22's action grammar. THAT DISAGREEMENT
 * IS THE RULING: "is this body inlinable?" is a judgement call about a grammar
 * boundary, and a judgement call inside an emitter is drift. Uniform lowering
 * deletes the question.
 *
 * RULING 3d - the signature is
 * `on<Host><Event>(<enclosing @for variables, outermost first>, <event>)`, and
 * BOTH kinds of parameter are passed ALWAYS. S1's increment never reads its
 * event and still receives `$event`; deciding otherwise requires inspecting the
 * body, the same content trigger 3a refuses. Unused parameters do not fail
 * `pnpm check`: the root tsconfig sets `strict` but not `noUnusedParameters`.
 */
function loweredHandlerBody(
	handler: LoweredHandler,
	members: ReadonlySet<string>,
): readonly Statement[] {
	const record = handler.event;
	if (record.handlers.length !== 1)
		throw new Error(`Angular emitter does not support multiple handlers for ${record.id}`);
	const arrow = expression(record.handlers[0]!.expression);
	if (arrow.type !== 'ArrowFunctionExpression')
		throw new Error(`Event handler ${record.id} is not an arrow function`);
	const scope = new Set<string>([...handler.forVariables, handler.eventParameter]);
	const body: Statement[] =
		arrow.body.type === 'BlockStatement'
			? ((qualify(arrow.body, members, scope).body ?? []) as Statement[])
			: [expressionStatement(qualify(arrow.body, members, scope))];
	syncPolicyGuard(record, body);
	return body;
}

/** The injected `ChangeDetectorRef` field an async handler notifies through. */
const CHANGE_DETECTOR_MEMBER = 'changeDetector';

/**
 * ZONELESS CHANGE DETECTION AFTER A SUSPENSION POINT, and why the emitter has to
 * spell it.
 *
 * MEASURED IN A BROWSER by S8, and by nothing before it. Angular 22 scaffolds
 * are zoneless (`demos/angular-official/src/app/app.ts` records the
 * measurement), and this lane holds component state in PLAIN CLASS FIELDS. That
 * works for a synchronous handler for one reason only: invoking a template
 * `(click)` listener notifies the scheduler itself, so the writes the listener
 * made are picked up by the tick that follows. AN `await` ENDS THAT. The
 * continuation runs after the listener has already returned, nothing notifies
 * anything, and the fields are updated while THE DOM IS NEVER RE-RENDERED.
 *
 * The state is correct and the page is stale, which is the worst shape a defect
 * can have: `ng build` compiles it, `parse-emitted` parses it,
 * `emitted-typecheck` type-checks it and the emitted output READS correctly. It
 * took a served payload to see it, which is the whole reason S8 is a corpus
 * scenario and not a unit test. Measured verbatim: after the release click the
 * board's own `ticks` field held 3 and `[data-async="ticks"]` still read 1;
 * clicking ANY other control made it jump to 3 in one tick.
 *
 * The notification is `ChangeDetectorRef.markForCheck()`, which in zoneless
 * Angular marks the ancestor path for traversal AND notifies the scheduler, so
 * it schedules a tick rather than merely flagging a view. It is inserted at the
 * END of every suspension segment except the first: the first is the one the
 * listener's own notification already covers, and a segment with no write still
 * gets one because a `markForCheck` on a clean view is a no-op tick, which is
 * cheaper than deciding write-freedom from a transplanted body.
 *
 * WHAT THIS DELIBERATELY IS NOT. The other answer is to lower every cell to an
 * Angular signal, which notifies on write wherever the write happens and would
 * make this function unnecessary. That is a re-lowering of the whole lane and an
 * architecture decision; this is the minimal correct one, and it moves ZERO
 * bytes in any synchronous scenario because it is gated on `isAsync`.
 */
function notifyAfterSuspension(body: readonly Statement[]): Statement[] {
	const notify = (): Statement =>
		expressionStatement({
			type: 'CallExpression',
			callee: member(member(thisExpression(), CHANGE_DETECTOR_MEMBER), 'markForCheck'),
			arguments: [],
			optional: false,
		} as Expression);
	// Hand-rolled rather than `walk()`, because `walk()` cannot be told to stop:
	// a nested function has its own suspension structure and its own
	// notification problem, and this pass does not claim to solve that one.
	const suspends = (value: unknown): boolean => {
		if (!value || typeof value !== 'object') return false;
		if (Array.isArray(value)) return value.some(suspends);
		const node = value as Record<string, unknown>;
		if (node.type === 'AwaitExpression') return true;
		if (
			typeof node.type === 'string' &&
			['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration'].includes(
				node.type,
			)
		)
			return false;
		return Object.values(node).some(suspends);
	};
	const result: Statement[] = [];
	let seenSuspension = false;
	for (const statement of body) {
		if (suspends(statement)) {
			if (seenSuspension) result.push(notify());
			seenSuspension = true;
		}
		result.push(statement);
	}
	if (seenSuspension) result.push(notify());
	return result;
}

/**
 * RULING 3e's surviving property, stated where it is implemented: the CLASS
 * METHOD KEEPS THE IR'S OWN PARAMETER NAME. `$event` is not a rename of the
 * author's identifier - it is Angular's ONLY spelling for "the event at this
 * binding site", it appears only in the template, and the author's identifier
 * never existed there. The emitter chooses WHAT TO PASS, not what was written.
 *
 * WHEN THE IR DECLARES NO PARAMETER there is no name to keep, and ruling 3d still
 * requires the event be passed - S1's increment receives `$event` it never reads.
 * The emitter therefore invents one, and it invents `_event` rather than `event`
 * so that `no-unused-vars` in this repository's own lint pass has nothing to say
 * about generated output. THAT IS NOT A CONTENT TRIGGER: `params.length === 0` is
 * the handler's DECLARED SIGNATURE - the very field this function already reads to
 * find the name - and it selects a NAME, never an emission SHAPE. Every zero-
 * parameter handler gets the identical treatment; nothing about the body is
 * inspected, and the call site still passes `$event` either way.
 */
function eventParameterName(record: EnrichedEventRecord): string {
	const arrow = expression(record.handlers[0]?.expression);
	if (arrow.type !== 'ArrowFunctionExpression')
		throw new Error(`Event handler ${record.id} is not an arrow function`);
	const params = (arrow.params ?? []) as Node[];
	if (params.length > 1)
		throw new Error(
			`Angular emitter has no lowering for a ${params.length}-parameter handler (${record.id})`,
		);
	if (params.length === 0) return '_event';
	if (params[0]!.type !== 'Identifier')
		throw new Error(
			`Angular emitter has no lowering for a destructured handler parameter (${record.id})`,
		);
	return String(params[0]!.name);
}

/**
 * DID THE AUTHOR WRITE `async`? Read from the arrow's own modifier flag, the same
 * DECLARED SIGNATURE this file already reads `params` from, so it is admissible
 * where inspecting the body would not be.
 *
 * Angular supports async event handlers natively, so this lane LOWERS the
 * construct rather than refusing it (`frameless-defects-and-targets-v1` T043 §5,
 * ruling R1). A fail-closed throw was considered and RULED AGAINST: it would have
 * left this lane the only one unable to express a mainstream construct its own
 * framework supports, and - the deciding reason - it would not have closed the
 * hole it was reached for, which was that NOTHING TYPECHECKED EMITTED ANGULAR.
 * See `test/emitted-typecheck.test.ts`, the instrument that was the real repair.
 */
function handlerIsAsync(record: EnrichedEventRecord): boolean {
	const arrow = expression(record.handlers[0]?.expression);
	if (arrow.type !== 'ArrowFunctionExpression')
		throw new Error(`Event handler ${record.id} is not an arrow function`);
	return arrow.async === true;
}

/**
 * The `@for` item names enclosing every event id, computed from the TEMPLATE
 * before any handler body is read.
 *
 * This pass also asserts the template/record join in BOTH directions: an event id
 * referenced by no host, or referenced twice, or a record no host references, is
 * a throw rather than a silently dropped handler.
 */
function collectEventScopes(component: EnrichedComponent): Map<string, string[]> {
	const scopes = new Map<string, string[]>();
	const stack: string[] = [];
	const visit = (nodes: readonly TemplateNode[]): void => {
		for (const node of nodes) {
			if (node.kind === 'host') {
				for (const eventId of node.eventIds) {
					if (scopes.has(eventId))
						throw new Error(
							`Angular emitter found the event id ${eventId} on more than one host node`,
						);
					scopes.set(eventId, [...stack]);
				}
				visit(node.children);
				continue;
			}
			if (node.kind === 'branch') {
				for (const arm of node.arms) visit(arm.children);
				continue;
			}
			if (node.kind === 'keyed-repeat') {
				stack.push(node.item);
				visit(node.row);
				stack.pop();
				visit(node.empty);
				continue;
			}
			if (node.kind === 'fragment') visit(node.children);
		}
	};
	visit(component.template);
	return scopes;
}

// ---------------------------------------------------------------------------
// the class body
// ---------------------------------------------------------------------------

/**
 * EVERY emitted declaration carries `: any` UNLESS IR-8 supplies a type for it,
 * and only `@Input()` members can be supplied today.
 *
 * THE CLAUSE THAT USED TO STAND HERE IS WITHDRAWN AS MEASURED FALSE.  It read
 * "`PropDestructuringEntry` is `sourceName`/`localName`/`path`/`alias`/
 * `graphNodeId`/`defaultValue?` and carries NO type, so any emitted type would be
 * INFERRED from what the corpus happens to do with the member - a content-based
 * trigger (Gate 3) that is unsound outside the exercised subset (Gate 4)".
 * `frameless-emitter-capability-v1` T003 added `PropDestructuringEntry.type`,
 * sourced from an annotation THE AUTHOR WROTE, so the trigger is now a declared
 * IR field rather than a content inference: Gate 3 PASSES, and Gate 4 is not at
 * risk because the field is ABSENT wherever nothing was authored and this
 * function falls straight back to `: any` there.
 *
 * WHAT IS STILL TRUE, AND IS THE REASON THE OTHER THREE CALLERS BELOW ARE
 * UNTOUCHED: locals, getters and handler parameters have no IR type channel at
 * all.  IR-8 supplies PROP types only, so `setup`, `count`, `prefix`,
 * `get derived()` and every `$event` parameter keep `: any`, and a green here
 * must not be read as "the emitted class is typed".  `strictTemplates` now
 * type-checks BINDINGS INTO this component - which an `any` input defeated
 * entirely - while `$event` at the fifteen lowered call sites stays `any`.
 *
 * The annotation is not decoration. The scaffold's `strict` implies
 * `noImplicitAny`, and a bare `count;` is TS7008 while a bare `event` parameter
 * is TS7006 - so an unannotated member would not survive `ng build` at all.
 * `event: Event` is refused for the opposite reason: the real DOM type makes
 * `event.currentTarget.value` a type error, which would be this emitter inventing
 * a type the IR does not carry in order to look better typed than it is.
 */
const MEMBER_TYPE = ': any';

/**
 * `!` on a TYPED `@Input()`, and ONLY on a typed one.
 *
 * MEASURED against `demos/angular-official`, whose scaffold leaves TypeScript
 * 6.0.3's default `strict` on and relaxes `noImplicitAny` ALONE: an `@Input()`
 * declared `label: string;` with no initialiser is TS2564 "Property 'label' has
 * no initializer and is not definitely assigned in the constructor", because
 * `strictPropertyInitialization` rides on `strict`. Angular writes inputs after
 * construction, so the assertion is TRUE of how the class is used and is the
 * form the framework's own documentation uses for a non-required input.
 *
 * It is scoped to the typed branch because `: any` never trips TS2564 and adding
 * `!` there would move eight goldens' bytes for no diagnostic. AND IT ASSERTS
 * NOTHING TO ANGULAR: `!` is erased before the AOT compiler sees the class, so
 * an unbound input still reads `undefined` exactly as it did before - the IR has
 * no requiredness field and this emitter still claims none.
 */
const DEFINITE_ASSIGNMENT = '!';

type ClassMember = { readonly text: string };

const TYPE_PROBE = '__frameless_angular_type__';

/**
 * IR-8 CONSUMPTION, AND THE HAZARD IT IS BUILT AGAINST.
 *
 * `PropDestructuringEntry.type` is a serialized type-node subtree in the dialect
 * `@tsrx/core` (oxc) produces.  `yuku-codegen` prints the ESTree/typescript-eslint
 * dialect.  THEY DISAGREE ON `TSFunctionType`, AND THE DISAGREEMENT IS SILENT:
 * MEASURED at yuku-codegen 0.7.0, handing the corpus's own `onTrace` node
 * straight to `generate()` prints `() => ;` - MALFORMED TEXT - and returns
 * `errors: []`.  A permissive `structuredClone`-and-hope converter of the kind
 * `expression()` can safely use for VALUE nodes would therefore have shipped a
 * broken type into eight emitted files with every instrument green, because no
 * instrument in this lane reads a type it did not itself print.
 *
 * So this converter is TOTAL AND FAIL-CLOSED: every accepted node kind is named
 * here, every field it forwards is copied BY NAME, and anything else throws.
 * The accepted set is exactly what the corpus authors today, which is what keeps
 * it out of Gate 4 territory - there is no branch here that nothing exercises.
 * Widening it is a deliberate edit with a fixture behind it, not a default.
 */
function typeNode(node: SerializableAstNode, where: string): Node {
	const kind = String((node as { readonly type?: unknown }).type ?? '');
	const record = node as Record<string, any>;
	switch (kind) {
		// Leaf keywords carry no children, so the two dialects cannot disagree.
		case 'TSStringKeyword':
		case 'TSNumberKeyword':
		case 'TSBooleanKeyword':
		case 'TSVoidKeyword':
		case 'TSUnknownKeyword':
			return { type: kind };
		case 'TSTypeReference': {
			// oxc and ESTree agree on `typeName` and on `typeArguments` here; only a
			// BARE identifier is accepted, because `A.B` would name a type this
			// emitter cannot prove is imported into the emitted module.
			if (record.typeName?.type !== 'Identifier')
				throw new Error(
					`Angular emitter refuses a qualified type name in ${where}: only a bare type reference can be proven resolvable in emitted output`,
				);
			const reference: Node = {
				type: 'TSTypeReference',
				typeName: { type: 'Identifier', name: String(record.typeName.name) },
			};
			if (record.typeArguments === undefined) return reference;
			if (record.typeArguments?.type !== 'TSTypeParameterInstantiation')
				throw new Error(
					`Angular emitter received unexpected type arguments in ${where}: ${String(record.typeArguments?.type)}`,
				);
			return {
				...reference,
				typeArguments: {
					type: 'TSTypeParameterInstantiation',
					params: (record.typeArguments.params as SerializableAstNode[]).map((param) =>
						typeNode(param, where),
					),
				},
			};
		}
		case 'TSFunctionType': {
			// THE DIALECT DELTA, AND THE ONLY ONE THE CORPUS REACHES. oxc spells the
			// parameter list `parameters` and the return type `typeAnnotation`;
			// yuku-codegen reads `params` and `returnType`. Renaming them is what
			// turns `() => ;` back into the authored signature.
			const parameters = (record.parameters ?? record.params) as SerializableAstNode[] | undefined;
			const returns = (record.typeAnnotation ?? record.returnType) as Record<string, any> | undefined;
			if (!Array.isArray(parameters) || returns?.type !== 'TSTypeAnnotation')
				throw new Error(
					`Angular emitter received a malformed function type in ${where}`,
				);
			return {
				type: 'TSFunctionType',
				params: parameters.map((parameter) => typeParameter(parameter, where)),
				returnType: {
					type: 'TSTypeAnnotation',
					typeAnnotation: typeNode(returns.typeAnnotation as SerializableAstNode, where),
				},
			};
		}
		default:
			throw new Error(
				`Angular emitter has no IR-8 lowering for the type node ${kind || 'without a type'} in ${where}`,
			);
	}
}

/** One parameter of a `TSFunctionType`; annotated plain identifiers only. */
function typeParameter(node: SerializableAstNode, where: string): Node {
	const record = node as Record<string, any>;
	if (record.type !== 'Identifier' || record.typeAnnotation?.type !== 'TSTypeAnnotation')
		throw new Error(
			`Angular emitter has no IR-8 lowering for the function-type parameter ${String(record.type)} in ${where}: only an annotated plain identifier is printed`,
		);
	return {
		type: 'Identifier',
		name: String(record.name),
		typeAnnotation: {
			type: 'TSTypeAnnotation',
			typeAnnotation: typeNode(record.typeAnnotation.typeAnnotation as SerializableAstNode, where),
		},
	};
}

/**
 * Render an IR-8 type node as the text after a member's `:`.
 *
 * Isolated through a declarator with an asserted prefix/suffix, exactly as
 * `printExpression` does, so a codegen change surfaces as a throw rather than a
 * silently truncated type. The single-line assertion is not cosmetic: a class
 * member is spliced into an indented body, and `printStatements` re-indents from
 * column zero, so a wrapped type would arrive with the wrong leading tabs.
 */
function printTypeAnnotation(node: SerializableAstNode, where: string): string {
	const prefix = `const ${TYPE_PROBE}: `;
	const printed = printStatements([
		{
			type: 'VariableDeclaration',
			kind: 'const',
			declarations: [
				{
					type: 'VariableDeclarator',
					id: {
						type: 'Identifier',
						name: TYPE_PROBE,
						typeAnnotation: { type: 'TSTypeAnnotation', typeAnnotation: typeNode(node, where) },
					},
					init: null,
				},
			],
		},
	]);
	if (!printed.startsWith(prefix) || !printed.endsWith(';') || printed.includes('\n'))
		throw new Error(
			`Angular emitter could not isolate a printed type for ${where} from ${JSON.stringify(printed.slice(0, 80))}`,
		);
	return printed.slice(prefix.length, -1);
}

/**
 * `@Input() <localName>: any;` IS A RULING, NOT A DEFAULT, and this is the decision
 * site the idiom policy's "Recording a ruling" item 2 requires a comment at.
 *
 * Declaring the prop as a signal `input()` instead is NO-SUGAR - **denied, not
 * deferred** - per `frameless-angular-v1` T005, folded into
 * `docs/emitter-idiom-policy.md` as worked example 11 by T008. Six outcomes:
 * G1 PASS, G2 PASS, G3 PASS, G4 PASS (narrowed), G5 FAIL, G6 FAIL. No gate is
 * DEFERRED: the lane landed, so both deferring conditions are discharged.
 *
 * GATE 5 DECIDES IT, on two limbs MEASURED at `@angular/core` 22.0.8 by AOT-building
 * the shipped `generated/S1.ts` VERBATIM beside a twin whose only change is this
 * declaration form:
 *
 * 1. REACTIVITY DEPTH. `computed(() => instance.derived)` returns `kit:2` under
 *    `@Input()` and stays `kit:2` even after `ApplicationRef.tick()`, at which point
 *    the component's own DOM reads `kit:10`; under `input()` the same computed
 *    returns `kit:10`. The emitted class's derived member is not a reactive producer
 *    under the baseline and IS one under the candidate.
 * 2. THE EXPORTED MEMBER TYPE. It changes `any` -> `InputSignal<any>`, so a consumer
 *    write `instance.<prop> = v` renders under the baseline and throws
 *    `TypeError: ... is not a function` under the candidate. That is both "throw or
 *    error behavior" and "the module's exports" from Gate 5's list, and it follows
 *    from the candidate by construction.
 *
 * NOT THE REASON, and it must not be reinstated: "required inputs throw NG0950".
 * MEASURED FALSE for this emitter - plain `input()` read unset returns `undefined`
 * exactly as `@Input()` does, and `input.required()` is UNREACHABLE, because
 * `PropDestructuringEntry` has no `required` field and this function throws on the
 * only adjacent field, `defaultValue`. IR-8 DID NOT CHANGE THIS: it supplies a
 * TYPE, never a REQUIREDNESS, and the `!` below is a definite-assignment
 * assertion to TypeScript rather than a claim to Angular that the input must be
 * bound - see `DEFINITE_ASSIGNMENT`.
 *
 * Gate 6 also FAILs, and it is the honest negative result: `pnpm e2e` would NOT go
 * red if this line silently became `input()`, because both arms were measured to
 * render identically. The six-row green proves ACTIVATION NEUTRALITY; it does not
 * pin this form choice. The only thing that does is the frameless-owned
 * `no-signal-members` policy in `../gate/index.ts`.
 */
/**
 * STEP 5. The prop locals a `default-slot-projection` consumes. Angular projects
 * child content through `<ng-content />`, never through an `@Input()`, so these
 * names must not become class members: an `@Input() children` would announce an
 * input no parent binds and leave the member permanently `undefined`.
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

function propMembers(component: EnrichedComponent): ClassMember[] {
	const projected = slotProjectedPropNames(component);
	return component.props.entries
		.filter((entry) => !projected.has(entry.localName))
		.map((entry) => {
		if (entry.defaultValue !== undefined)
			throw new Error(
				`Angular emitter has no lowering for a prop default value: ${entry.localName}`,
			);
		if (entry.path.length !== 1)
			throw new Error(
				`Angular emitter requires a single-segment prop path, received ${entry.path.join('.')}`,
			);
		if (entry.alias || entry.sourceName !== entry.localName)
			throw new Error(
				`Angular emitter refuses the aliased prop ${entry.sourceName} -> ${entry.localName}: the only Angular spelling is @Input('${entry.sourceName}') ${entry.localName}, which @angular-eslint/no-input-rename - a rule INSIDE this lane's applied set - reports`,
			);
		if (entry.type === undefined) return { text: `@Input() ${entry.localName}${MEMBER_TYPE};` };
		return {
			text: `@Input() ${entry.localName}${DEFINITE_ASSIGNMENT}: ${printTypeAnnotation(
				entry.type,
				`@Input() ${entry.localName} of ${component.name}`,
			)};`,
		};
		});
}

function componentBinding(
	ir: EnrichedIR,
	component: EnrichedComponent,
	local: LocalDeclaration,
): EnrichedGraphBinding | undefined {
	const bindings = ir.records.bindings.filter(
		(binding) => binding.componentId === component.id && local.semanticRecordIds.includes(binding.id),
	);
	if (bindings.length > 1)
		throw new Error(
			`Angular local has unsupported multi-semantic shape: ${local.names.join(',')}`,
		);
	return bindings[0];
}

function localName(local: LocalDeclaration): string {
	if (local.names.length !== 1 || local.pattern.type !== 'Identifier')
		throw new Error(
			`Angular emitter has no lowering for the destructured component local ${local.names.join(',')}: a class member is a single name`,
		);
	return local.names[0]!;
}

/**
 * `ComponentEvaluationPolicy.ordinaryLocals` is `once-per-instance`, and in
 * Angular the once-per-instance site that is ALSO after inputs are set is
 * `ngOnInit`. A field initialiser runs at CONSTRUCTION, before Angular has
 * written a single `@Input`, so `prefix = \`${this.label}:\`` would read
 * `undefined` and `this.onTrace('setup', …)` would call it.
 *
 * EVERY non-derived local is initialised there, UNIFORMLY - including `count = 1`,
 * which would have been safe as a field initialiser. Splitting on "does this
 * initialiser read a prop?" is a discriminating predicate over expression contents
 * choosing between two emission shapes, which is exactly ruling 3a's refusal.
 *
 * `computedBindings: 'reactive'` becomes a GETTER, which Angular re-evaluates on
 * every change-detection pass. That is the only construct in the emitted class
 * that re-runs, and it is why the gate carries the IR-7 purity guard over getters.
 */
// ---------------------------------------------------------------------------
// step 4 - behaviors (`attach=`)
// ---------------------------------------------------------------------------

/**
 * ONE INSTALL/DISPOSE PAIR PER HOST, carrying every behavior declared on that
 * host in authored `order`, installed forwards and torn down BACKWARDS - the
 * host-level granularity the React lane already has.
 *
 * THE SANCTIONED SET FOR THIS CONSTRUCT, and why this is FORCED LOWERING rather
 * than a sugar question. `attach=` needs three things Angular has no single
 * construct for: a reference to the rendered node, a mount-time install, and a
 * re-run keyed on a declared input. The node reference is `@ViewChild` + a
 * template reference variable, which Step 3 already ruled and shipped; the
 * install point is `ngAfterViewInit`, because that is the first hook at which a
 * `@ViewChild` element query is resolved; teardown is `ngOnDestroy`. All three
 * float at Angular 2.0, and there is no second spelling of any of them for a
 * non-signal component - which is exactly the position the idiom policy's
 * preamble describes for Angular, where the baseline is simply the more
 * permissive of the sanctioned forms.
 *
 * THE RE-RUN IS THE ONE PLACE THERE WAS A CHOICE, and it is `ngDoCheck` with an
 * explicit previous-value comparison:
 *
 *   - `ngOnChanges` sees only `@Input()` props. A behavior input is whatever
 *     graph node the author read, and the corpus's own probe reads `state`, so
 *     `ngOnChanges` is not total over the domain and Gate 4 would kill it.
 *   - `effect()` from `@angular/core` needs the inputs to be SIGNALS. This class
 *     is all-decorator and all-plain-field by worked example 11's measurement, so
 *     adopting it here would mean re-spelling every state field as a signal -
 *     a different ruling on a different construct, not this one.
 *
 * `ngDoCheck` runs on every change-detection cycle, so the comparison is what
 * makes the re-run keyed on the input rather than on the cycle - the same manual
 * previous-value check the SOLID lane performs inside its `createEffect`.
 */
type AngularBehaviorPlan = {
	readonly hostNodeId: string;
	readonly templateRef: string;
	readonly backing: string;
	/** True when the `@ViewChild` field is this lowering's own, not the handle's. */
	readonly ownsBacking: boolean;
	readonly installName: string;
	readonly disposeName: string;
	readonly installedName: string;
	readonly captures: ReadonlyArray<{ readonly member: string; readonly field: string }>;
	readonly steps: ReadonlyArray<{
		readonly methodName: string;
		readonly parameters: readonly string[];
		readonly body: string;
		readonly captureMembers: readonly string[];
		readonly cleanupName: string | null;
	}>;
};

function claimMemberName(base: string, taken: Set<string>): string {
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
 * cleanup, re-run on a declared input change - and to let THE CLEANUP OBSERVE THE
 * INPUT VALUES CURRENT AT ITS OWN INSTALL. React gets that from closure identity;
 * Solid by running the cleanup before assigning its captures. Angular would get
 * the opposite for free: `ngDoCheck` fires after the field has already changed,
 * so a cleanup body qualified to `this.value` would read the NEW value.
 *
 * The input names are therefore appended to the authored function's own PARAMETER
 * LIST and the current values are passed at install. `qualify()` is scope-aware
 * and already treats a parameter as in-scope, so the appended parameters suppress
 * exactly the `this.`-qualification that would otherwise re-read through the
 * field - and `qualify()` stays total, which is the property Step 3 declined to
 * spend on the `ElementRef` unwrap.
 */
function angularBehaviorPlans(
	ir: EnrichedIR,
	component: EnrichedComponent,
	hostIds: ReadonlySet<string>,
	handleHosts: ReadonlyMap<string, string>,
	members: ReadonlySet<string>,
	taken: Set<string>,
): readonly AngularBehaviorPlan[] {
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
	for (const behavior of [...ir.records.behaviors].sort(
		(left, right) => left.order - right.order,
	)) {
		if (!hostIds.has(behavior.hostNodeId))
			throw new Error(
				`Angular behavior ${behavior.id} names a host this component does not render: ${behavior.hostNodeId}`,
			);
		byHost.set(behavior.hostNodeId, [...(byHost.get(behavior.hostNodeId) ?? []), behavior]);
	}
	const plans: AngularBehaviorPlan[] = [];
	for (const [hostNodeId, hostBehaviors] of byHost) {
		// A host that already carries an element handle SHARES its template
		// reference variable and its `@ViewChild`. A second `#name` on one element
		// is legal Angular but would mean two queries for one node.
		const shared = handleHosts.get(hostNodeId);
		const templateRef = shared ?? claimMemberName('attachHost', taken);
		const backing = `elementRef${upperCamel(hostNodeId)}`;
		if (shared === undefined && members.has(backing))
			throw new Error(
				`Angular emitter refuses the attach behavior on ${hostNodeId}: its backing member ${backing} collides with a declared component member`,
			);
		const captures: Array<{ member: string; field: string }> = [];
		const steps = hostBehaviors.map((behavior) => {
			const fn = expression(behavior.behavior);
			if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')
				throw new Error(
					`Angular emitter has no lowering for a non-literal attach behavior: ${behavior.id}`,
				);
			const params = (fn.params ?? []) as Node[];
			if (params.some((param) => param.type !== 'Identifier'))
				throw new Error(
					`Angular emitter has no lowering for a destructured attach parameter: ${behavior.id}`,
				);
			const paramNames = params.map((param) => String(param.name));
			const captureMembers: string[] = [];
			for (const input of behavior.inputs) {
				// REFUSED RATHER THAN GUESSED, and for the same reason in all three lanes
				// Step 4 opened: a parameter can only shadow a BASE name, so a `value.a.b`
				// read has no capture spelling. React and Solid carry the full path in
				// their dependency channels; this lane has none and the corpus has no
				// instance.
				if (input.path.length > 0)
					throw new Error(
						`Angular emitter has no lowering for a behavior input with a member path (${behavior.id}: ${input.graphNodeId}.${input.path.join('.')})`,
					);
				if (input.via !== 'direct')
					throw new Error(
						`Angular emitter has no lowering for a ${input.via} behavior input: ${behavior.id}`,
					);
				const binding = bindingById.get(input.graphNodeId);
				if (!binding)
					throw new Error(`BehaviorRecord input has no binding: ${input.graphNodeId}`);
				if (!members.has(binding.name))
					throw new Error(
						`Angular behavior ${behavior.id} reads ${binding.name}, which is not a declared component member`,
					);
				if (paramNames.includes(binding.name))
					throw new Error(
						`Angular emitter refuses the attach behavior ${behavior.id}: its input ${binding.name} collides with its own parameter of the same name`,
					);
				if (!captureMembers.includes(binding.name)) captureMembers.push(binding.name);
				if (!captures.some((entry) => entry.member === binding.name))
					captures.push({
						member: binding.name,
						field: claimMemberName(`${binding.name}Input`, taken),
					});
			}
			const parameters = [...paramNames, ...captureMembers];
			const scope = new Set(parameters);
			const lowered =
				fn.body.type === 'BlockStatement'
					? ((qualify(fn.body, members, scope) as Node).body as Statement[])
					: [returnStatement(qualify(fn.body, members, scope) as Expression)];
			return {
				methodName: claimMemberName('behavior', taken),
				parameters,
				body: printStatements(lowered),
				captureMembers,
				cleanupName: behavior.returnsCleanup ? claimMemberName('cleanup', taken) : null,
			};
		});
		plans.push({
			hostNodeId,
			templateRef,
			backing,
			ownsBacking: shared === undefined,
			installName: claimMemberName('installAttachHost', taken),
			disposeName: claimMemberName('disposeAttachHost', taken),
			installedName: claimMemberName('attachHostInstalled', taken),
			captures,
			steps,
		});
	}
	return plans;
}

function classMembers(
	ir: EnrichedIR,
	component: EnrichedComponent,
	context: EmitContext,
): {
	readonly members: ClassMember[];
	readonly implementsOnInit: boolean;
	readonly usesViewChild: boolean;
	readonly usesChangeDetector: boolean;
	readonly lifecycle: readonly string[];
} {
	const members: ClassMember[] = [...propMembers(component)];
	const fields: ClassMember[] = [];
	const getters: ClassMember[] = [];
	const initialisation: Statement[] = [];
	let usesViewChild = false;
	let usesChangeDetector = false;
	for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
		const name = localName(local);
		const binding = componentBinding(ir, component, local);
		if (binding?.kind === 'element') {
			// STEP 3, REFS, AND THE ONE LANE WHERE THE HANDLE IS NOT THE NODE.
			//
			// `@ViewChild('input')` resolves to an `ElementRef`, never to the element -
			// no Angular query of any generation hands back the raw node - so a lane
			// that promised `this.input` IS the node has to unwrap somewhere. It
			// unwraps HERE, in a getter, and NOT by rewriting the handler:
			// `qualify()` earns its totality argument by mapping every declared member
			// name to `this.<name>` identically, and teaching it to splice
			// `?.nativeElement` into an optional chain would make it produce a DIFFERENT
			// shape for one name set - and would have to synthesise `ChainExpression`
			// wrappers, which yuku-codegen has already been measured to print malformed
			// and report `errors: []` for (see `typeNode`). One getter keeps `qualify`
			// total and keeps every lane's handler AST identical.
			//
			// The getter reads `undefined` until `ngAfterViewInit`, which is what solid,
			// svelte, vue and qwik all read for an unbound handle; only react's
			// `useRef(null)` reads `null`. No oracle can tell them apart - `?.`
			// short-circuits on either - so the majority spelling is kept rather than
			// normalised.
			//
			// `@ViewChild` and not `viewChild()`: the signal query floors at 17.2, the
			// decorator at 2.0, and this class is already all-decorator (`@Input`).
			// `@angular-eslint/prefer-signals` - the rule that would report the choice -
			// lives upstream in `all`, NOT in `recommended`, so this lane's derived
			// applied set is silent on it; that is worked example 11's measurement, and
			// it is why this is the baseline rather than a denied sugar.
			// See notes/T005-refs.md.
			const handle = ir.records.elementHandleBindings.find(
				(record) => record.componentId === component.id && record.handleName === name,
			);
			if (!handle || context.handleHosts.get(handle.hostNodeId) !== name)
				throw new Error(
					`Angular element handle ${name} has no emitted template reference variable`,
				);
			const backing = `elementRef${upperCamel(handle.hostNodeId)}`;
			if (context.members.has(backing))
				throw new Error(
					`Angular emitter refuses the element handle ${name}: its backing member ${backing} collides with a declared component member`,
				);
			usesViewChild = true;
			fields.push({ text: `@ViewChild('${name}') ${backing}?: ElementRef;` });
			getters.push({
				text: `get ${name}()${MEMBER_TYPE} {\n\treturn this.${backing}?.nativeElement;\n}`,
			});
			continue;
		}
		if (binding?.kind === 'computed') {
			if (!binding.computed) throw new Error(`Computed binding ${binding.id} has no expression`);
			const site = expression(binding.computed.expression);
			if (site.type !== 'ArrowFunctionExpression' || site.params.length !== 0)
				throw new Error(`Computed binding ${binding.id} is not a zero-argument arrow`);
			if (site.body.type === 'BlockStatement')
				throw new Error(
					`Angular emitter has no lowering for a statement-bodied computed: ${binding.name}`,
				);
			const body = printStatements([
				returnStatement(qualify(site.body, context.members, new Set())),
			]);
			getters.push({ text: `get ${name}()${MEMBER_TYPE} {\n${indentBlock(body, '\t')}\n}` });
			continue;
		}
		// A STATE local's own `initializer` is the authored `state(1)` CALL, whose
		// callee is a markless primitive with no Angular counterpart. The binding
		// record carries the unwrapped value, which is what a class field holds. An
		// ordinary local has no binding record, so its own initializer is the value.
		// Selected on `binding.kind`, a declared IR field, never on contents.
		let initializer;
		if (binding?.kind === 'state') {
			if (local.declarationKind !== 'let')
				throw new Error(`Angular state requires a let binding in the IR: ${binding.name}`);
			if (!binding.initializer)
				throw new Error(`Angular state binding ${binding.id} has no initializer`);
			initializer = binding.initializer;
		} else {
			if (binding)
				throw new Error(
					`Angular emitter has no lowering for the ${binding.kind} binding ${binding.id}`,
				);
			if (!local.initializer) throw new Error(`Angular local ${name} has no initializer`);
			initializer = local.initializer;
		}
		fields.push({ text: `${name}${MEMBER_TYPE};` });
		initialisation.push(
			assign(
				member(thisExpression(), name),
				qualify(expression(initializer), context.members, new Set()) as Expression,
			),
		);
	}
	// STEP 4, BEHAVIORS. Fields first, then the transplanted behavior methods,
	// then the install/dispose pair, then the lifecycle hooks that drive them.
	const install: string[] = [];
	const doCheck: string[] = [];
	const destroy: string[] = [];
	for (const plan of context.behaviorPlans) {
		if (plan.ownsBacking) {
			usesViewChild = true;
			fields.push({ text: `@ViewChild('${plan.templateRef}') ${plan.backing}?: ElementRef;` });
		}
		for (const step of plan.steps)
			if (step.cleanupName) fields.push({ text: `private ${step.cleanupName}${MEMBER_TYPE};` });
		for (const capture of plan.captures)
			fields.push({ text: `private ${capture.field}${MEMBER_TYPE};` });
		// Only a host with declared inputs has an `ngDoCheck` to guard, so a host
		// without them gets no flag - an always-true private field nothing reads is
		// exactly what `@typescript-eslint/no-unused-private-class-members` is for.
		if (plan.captures.length) fields.push({ text: `private ${plan.installedName} = false;` });
	}
	members.push(...fields, ...getters);
	for (const plan of context.behaviorPlans) {
		for (const step of plan.steps) {
			const parameters = step.parameters.map((name) => `${name}${MEMBER_TYPE}`).join(', ');
			members.push({
				text: `private ${step.methodName}(${parameters})${MEMBER_TYPE} {\n${indentBlock(step.body, '\t')}\n}`,
			});
		}
		const installBody: string[] = [];
		for (const step of plan.steps) {
			const args = [
				`this.${plan.backing}?.nativeElement`,
				...step.captureMembers.map((name) => `this.${name}`),
			].join(', ');
			installBody.push(
				step.cleanupName
					? `this.${step.cleanupName} = this.${step.methodName}(${args});`
					: `this.${step.methodName}(${args});`,
			);
		}
		for (const capture of plan.captures)
			installBody.push(`this.${capture.field} = this.${capture.member};`);
		if (plan.captures.length) installBody.push(`this.${plan.installedName} = true;`);
		members.push({
			text: `private ${plan.installName}(): void {\n${indentBlock(installBody.join('\n'), '\t')}\n}`,
		});
		const disposeBody: string[] = [];
		for (const step of [...plan.steps].reverse()) {
			if (!step.cleanupName) continue;
			disposeBody.push(
				`if (typeof this.${step.cleanupName} === 'function') {\n\tthis.${step.cleanupName}();\n}`,
				`this.${step.cleanupName} = undefined;`,
			);
		}
		if (disposeBody.length)
			members.push({
				text: `private ${plan.disposeName}(): void {\n${indentBlock(disposeBody.join('\n'), '\t')}\n}`,
			});
		install.push(`this.${plan.installName}();`);
		if (disposeBody.length) destroy.push(`this.${plan.disposeName}();`);
		if (plan.captures.length) {
			const changed = plan.captures
				.map((capture) => `this.${capture.field} !== this.${capture.member}`)
				.join(' || ');
			// The `installed` guard is not defensive padding. `ngDoCheck` runs BEFORE
			// `ngAfterViewInit` on the first cycle, and a `@ViewChild` element query is
			// not resolved until `ngAfterViewInit` - so without it the first check would
			// install against an undefined node and the real install would then run a
			// second time.
			const reinstall = [
				...(disposeBody.length ? [`this.${plan.disposeName}();`] : []),
				`this.${plan.installName}();`,
			].join('\n');
			doCheck.push(
				`if (this.${plan.installedName} && (${changed})) {\n${indentBlock(reinstall, '\t')}\n}`,
			);
		}
	}
	// `@angular-eslint/no-empty-lifecycle-method` is in the applied set, and
	// `implements OnInit` without an `ngOnInit` is a type error, so BOTH are
	// emitted together or neither is. The same rule governs every hook below.
	const implementsOnInit = initialisation.length > 0;
	if (implementsOnInit) {
		const body = printStatements(initialisation);
		members.push({ text: `ngOnInit(): void {\n${indentBlock(body, '\t')}\n}` });
	}
	const lifecycle: string[] = [];
	if (install.length) {
		lifecycle.push('AfterViewInit');
		members.push({
			text: `ngAfterViewInit(): void {\n${indentBlock(install.join('\n'), '\t')}\n}`,
		});
	}
	if (doCheck.length) {
		lifecycle.push('DoCheck');
		members.push({ text: `ngDoCheck(): void {\n${indentBlock(doCheck.join('\n'), '\t')}\n}` });
	}
	if (destroy.length) {
		lifecycle.push('OnDestroy');
		members.push({
			text: `ngOnDestroy(): void {\n${indentBlock(destroy.join('\n'), '\t')}\n}`,
		});
	}
	const handlerMembers: ClassMember[] = [];
	for (const handler of context.handlersByEventId.values()) {
		const parameters = [...handler.forVariables, handler.eventParameter]
			.map((parameter) => `${parameter}${MEMBER_TYPE}`)
			.join(', ');
		const lowered = loweredHandlerBody(handler, context.members);
		const body = printStatements(
			handler.isAsync ? notifyAfterSuspension(lowered) : lowered,
		);
		if (handler.isAsync) usesChangeDetector = true;
		// DEFECTS.md entry 9. `qualify()` transplants the arrow's BODY into this
		// template, so before this line the arrow's `async` modifier had nowhere to
		// go and was dropped - the string `async` occurred ZERO times in this file.
		// The modifier and the return type move TOGETHER because an `async` method
		// annotated `: void` is itself a type error.
		const modifier = handler.isAsync ? 'async ' : '';
		const returnType = handler.isAsync ? ': Promise<void>' : ': void';
		handlerMembers.push({
			text: `${modifier}${handler.name}(${parameters})${returnType} {\n${indentBlock(body, '\t')}\n}`,
		});
	}
	// The injected field is declared IMMEDIATELY BEFORE the methods that use it,
	// so a reader meets the notification channel where the notifications are.
	// `inject()` rather than a constructor parameter: the emitted classes have no
	// constructor at all, and adding one for this would put a second
	// initialisation site beside `ngOnInit`.
	if (usesChangeDetector)
		members.push({
			text: `private readonly ${CHANGE_DETECTOR_MEMBER} = inject(ChangeDetectorRef);`,
		});
	members.push(...handlerMembers);
	return { members, implementsOnInit, usesViewChild, usesChangeDetector, lifecycle };
}

// ---------------------------------------------------------------------------
// the template
// ---------------------------------------------------------------------------

function escapeText(value: string): string {
	if (/[`\\]/.test(value) || value.includes('${'))
		throw new Error(
			`Angular emitter refuses the template text ${JSON.stringify(value)}: it would terminate or interpolate the TypeScript template literal the inline template lives in`,
		);
	if (value.includes('{{') || value.includes('}}'))
		throw new Error(
			`Angular emitter refuses the template text ${JSON.stringify(value)}: {{ and }} are Angular's interpolation delimiters and the corpus has no instance to test an escaping against`,
		);
	if (value !== value.trim() || value.length === 0)
		throw new Error(
			`Angular emitter refuses the template text ${JSON.stringify(value)}: Angular's preserveWhitespaces:false default condenses a run of whitespace to a single space and keeps a lone newline verbatim, so a text node whose own edges are whitespace renders differently from the react, solid, qwik, svelte and vue lanes`,
		);
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttributeValue(value: string): string {
	if (/[`\\]/.test(value) || value.includes('${'))
		throw new Error(
			`Angular emitter refuses the attribute value ${JSON.stringify(value)}: it would terminate or interpolate the TypeScript template literal the inline template lives in`,
		);
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/**
 * An EXPRESSION is JavaScript, not text, so only the characters that would end
 * the attribute or break out of the enclosing TypeScript template literal are
 * handled - and the last two are refused rather than escaped, because the corpus
 * has zero instances and an untested escaping is worse than a throw.
 */
function templateExpression(value: Expression, indent: string): string {
	const printed = indentContinuation(printExpression(value), indent);
	if (printed.includes('`') || printed.includes('${') || printed.includes('\\'))
		throw new Error(
			`Angular emitter refuses the template expression ${JSON.stringify(printed.slice(0, 60))}: a backtick, a \${ or a backslash would terminate or interpolate the TypeScript template literal the inline template lives in`,
		);
	return printed.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

const ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/**
 * Angular's binding syntaxes are reserved. `[x]`, `(x)`, `[(x)]`, `*ngIf` and
 * `#ref` all arrive through the ATTRIBUTE NAME position, so refusing the whole
 * punctuation surface keeps a binding from ever being smuggled in as a static
 * attribute.
 */
function assertPlainAttributeName(name: string): void {
	if (!ATTRIBUTE_NAME.test(name))
		throw new Error(`Angular emitter rejects the attribute name ${JSON.stringify(name)}`);
}

function staticAttribute(attribute: StaticAttribute): string {
	assertPlainAttributeName(attribute.name);
	return attribute.value === true
		? attribute.name
		: `${attribute.name}="${escapeAttributeValue(attribute.value)}"`;
}

function eventBindingName(eventName: string): string {
	if (!/^[a-z]+$/.test(eventName))
		throw new Error(`Angular emitter rejects the event name ${JSON.stringify(eventName)}`);
	return `(${eventName})`;
}

function width(indent: string, text: string): number {
	return indent.length * 4 + text.length;
}

/**
 * Angular DISTINGUISHES property and attribute bindings, where Vue and Svelte
 * leave the choice to the runtime. `DynamicBinding.kind` carries the IR's own
 * answer, so `property` becomes `[name]` and `attribute` becomes `[attr.name]`
 * with no emitter judgement in between.
 */
function attributesOf(
	node: Extract<TemplateNode, { kind: 'host' }>,
	indent: string,
	context: EmitContext,
): string[] {
	const attributes = node.staticAttributes.map(staticAttribute);
	// STEP 3, REFS. The template half of the `@ViewChild` pair: a template
	// reference variable is the ONLY thing an Angular element query can name, so
	// `#input` is not a spelling choice - without it there is nothing for
	// `@ViewChild('input')` to select. See `classMembers` for the class half.
	const templateRef = context.handleHosts.get(node.id) ?? context.behaviorHosts.get(node.id);
	if (templateRef !== undefined) attributes.push(`#${templateRef}`);
	for (const binding of node.dynamicBindings) {
		assertPlainAttributeName(binding.name);
		const target = binding.kind === 'property' ? binding.name : `attr.${binding.name}`;
		attributes.push(
			`[${target}]="${templateExpression(expression(binding.expression), `${indent}\t`)}"`,
		);
	}
	for (const eventId of node.eventIds) {
		const handler = context.handlersByEventId.get(eventId);
		if (!handler) throw new Error(`Unknown event record: ${eventId}`);
		// `$event` appears ONLY here. See `eventParameterName`.
		const args = [...handler.forVariables, '$event'].join(', ');
		attributes.push(`${eventBindingName(handler.event.eventName)}="${handler.name}(${args})"`);
	}
	return attributes;
}

/**
 * THE WHITESPACE RULE, MEASURED at `@angular/compiler` 22.0.8 (T003 measurement
 * M1) rather than carried over from the Vue or Svelte lanes, both of which apply
 * DIFFERENT rules.
 *
 * Angular's `preserveWhitespaces: false` default drops whitespace-ONLY text nodes
 * outright and collapses a run of two or more whitespace characters inside a
 * content-bearing node to a single space - but a LONE newline survives verbatim.
 * Measured through `parseTemplate`, per arm:
 *
 *   - `<div>\n\t<p>a</p>\n\t<span>b</span>\n</div>` -> texts `a`, `b`. The
 *     whitespace-only nodes are gone, so BLOCK-LEVEL children may be broken
 *     across lines.
 *   - `<button>\n\tincrement\n</button>` -> text `" increment\n"`. Both edges
 *     survive, one condensed and one verbatim.
 *   - `<p>{{ a }}\n/{{ b }}</p>` -> BoundText strings `["", "\n/", ""]`, so S2's
 *     `1/2` observation would render as `1\n/2`.
 *
 * The rule that follows: a run of children may be broken across lines only if
 * EVERY child renders as an element or a block. One text or interpolation child
 * anywhere in the run and the whole run is emitted inline.
 *
 * THAT RULE IS REQUIRED HERE, NOT MERELY CONSERVATIVE, and that is the one place
 * the Vue lane's answer does NOT transfer. Vue measured a LONE INTERPOLATION
 * child on its own line as SAFE and recorded its identical rule as conservatism.
 * Re-measured against Angular it is false: `<output>\n\t{{ a }}\n</output>` keeps
 * BOTH edges as literal segments of the interpolation's BoundText. Inheriting the
 * Vue measurement instead of re-running it would have shipped that arm silently
 * wrong - `test/parse-emitted.test.ts` carries the row.
 *
 * `whitespace-stable-text` in the gate re-checks the RESULT independently, by
 * reading Angular's own parsed template and rejecting any emitted text - plain or
 * interpolated - that carries an untrimmed edge.
 */
function isBlockLevel(node: TemplateNode): boolean {
	if (
		node.kind === 'host' ||
		node.kind === 'branch' ||
		node.kind === 'keyed-repeat' ||
		node.kind === 'component-reference'
	)
		return true;
	// `default-slot-projection` is deliberately NOT block-level, for the same
	// reason it is not in the Vue lane: it stands where React prints `{children}`,
	// and the whitespace rule above is what makes the classification observable.
	if (node.kind === 'fragment') return node.children.every(isBlockLevel);
	return false;
}

function renderChildren(
	children: readonly TemplateNode[],
	indent: string,
	inline: boolean,
	context: EmitContext,
): string {
	const chunks = children.flatMap((child) => renderNode(child, indent, inline, context));
	return inline ? chunks.join('') : chunks.join(`\n${indent}`);
}

function renderHost(
	node: Extract<TemplateNode, { kind: 'host' }>,
	indent: string,
	inline: boolean,
	context: EmitContext,
): string[] {
	if (!/^[a-z][a-z0-9-]*$/.test(node.tag))
		throw new Error(`Angular emitter rejects the host tag ${JSON.stringify(node.tag)}`);
	const attributes = attributesOf(node, indent, context);
	const singleLine = `<${node.tag}${attributes.map((attribute) => ` ${attribute}`).join('')}>`;
	const fits =
		!attributes.some((attribute) => attribute.includes('\n')) &&
		width(indent, singleLine) <= PRINT_WIDTH;
	if (inline && !fits)
		throw new Error(
			`Angular emitter cannot inline <${node.tag}>: it sits in a text-bearing run and needs a multi-line start tag`,
		);
	const open = fits
		? singleLine
		: `<${node.tag}\n${attributes.map((attribute) => `${indent}\t${attribute}`).join('\n')}\n${indent}>`;
	if (VOID_ELEMENTS.has(node.tag)) {
		if (node.children.length)
			throw new Error(`Angular void element <${node.tag}> cannot have children`);
		return [open];
	}
	const close = `</${node.tag}>`;
	if (node.children.length === 0) return [open + close];
	if (inline || !node.children.every(isBlockLevel))
		return [open + renderChildren(node.children, indent, true, context) + close];
	return [
		`${open}\n${indent}\t${renderChildren(node.children, `${indent}\t`, false, context)}\n${indent}${close}`,
	];
}

/**
 * A branch becomes Angular 17+ BUILT-IN CONTROL FLOW - `@if` / `@else` - never
 * `*ngIf`.
 *
 * `@if`/`@else`/`@for` IS A RULING, NOT A PREFERENCE, and this is the decision
 * site the idiom policy's "Recording a ruling" item 2 requires a comment at.
 * Ruled SUGAR, ADOPTED - re-run in full against the landed lane by
 * `frameless-angular-v1` T009 and folded into `docs/emitter-idiom-policy.md` as
 * worked example 5 by T011. Six outcomes: G1 PASS, G2 PASS, G3 PASS, G4 PASS
 * (narrowed), G5 PASS, G6 PASS. No gate is DEFERRED - the lane landed, so both
 * deferring conditions are discharged - and this is the first Angular entry to
 * reach PASS at every gate.
 *
 * GATE 6 CARRIES IT, and it is the only gate that was ever in doubt. This
 * comment used to assert, bare, that `@angular-eslint/template/prefer-control-flow`
 * is in this lane's applied rule set and reports `*ngIf`/`*ngFor` directly. That
 * claim is now MEASURED TRUE rather than asserted: the applied set is DERIVED
 * from upstream's own `meta.docs.recommended === 'recommended'`, and
 * `prefer-control-flow` is 1 of only 4 template rules in it out of 41. On the
 * shipped candidate it reports 0 messages; on the `*ngIf`/`*ngFor` baseline it
 * reports 3, by name - "Use built-in control flow instead of directive ngIf /
 * ngForOf" - with a planted `([ngModel])` drawing `banana-in-box` as the
 * calibration proving the harness can report at all. See `test/gate.test.ts`.
 *
 * THE CONTRAST WITH WORKED EXAMPLE 11 IS THE ARGUMENT, and it is the same
 * metadata read taken twice. `prefer-signals` lives in `all`, not `recommended`,
 * so the applied set is SILENT on a planted `seed = input()` and that entry's
 * Gate 6 FAILs; upstream made the opposite call here and the applied set is
 * LOUD. Opposite answers because the measurements are opposite.
 *
 * NOT THE REASON, and it must not be reinstated: "`NgIf` carries `@deprecated
 * 20.0`, therefore the baseline/candidate assignment inverts." MEASURED AND
 * REFUTED TWICE OVER. The policy's baseline definition has no deprecation limb
 * at all, and `*ngIf`/`*ngFor` AOT-compiles with 0 errors and 0 warnings at
 * 22.0.8 under `strict` + `strictTemplates`, including a `*ngFor` arm carrying
 * no `trackBy`. The deprecation surfaces only as TypeScript SUGGESTION
 * diagnostic 6385, which `ng build`, `performCompilation` and this repo's
 * emitted-typecheck lanes all decline to collect. A tag is not a diagnostic. So
 * `*ngIf`/`*ngFor` stays the baseline and `@if`/`@for` stays the candidate: the
 * ASSIGNMENT is unchanged and the RULING is what moved.
 *
 * THE HONEST NEGATIVE. Gate 5 measured the two forms behaviourally
 * indistinguishable - node identity preserved identically across reverse,
 * whole-object replacement, removal and prepend - so `pnpm e2e` would NOT go red
 * on a competent switch to `*ngIf`. It would go red on an incompetent one:
 * dropping `@if` without adding `imports: [NgIf]` yields NG8103 and the guarded
 * subtree renders not at all. What pins this form choice is the emitter gate,
 * not the browser.
 *
 * TWO THINGS A LATER AUDITOR MUST NOT REDISCOVER AS A SURPRISE - both of which
 * this comment previously recorded as OPEN, and both of which are now closed.
 * 1. GATE 6'S READING WAS CONTESTABLE and was decided on Gate 5's own routing
 *    sentence, which sends non-behavioural reasons to Gate 6 and demands only
 *    that they be MEASURED. The contest came from the preamble stating its
 *    lane-and-version-and-behaviour requirement as ONE UNDIVIDED SENTENCE above
 *    a PASS clause that is a DISJUNCTION - so read as governing every arm it
 *    contradicted its own second arm, and this entry flipped to FAIL along with
 *    worked example 10, which is ALREADY SHIPPED in the Qwik emitter on the
 *    identical ground. `frameless-defects-and-targets-v1` T040 SCOPED the
 *    requirement to the behavioural arm; this entry is carried by the
 *    claimed-benefit arm and was NOT re-scored. Both readings, and the scoping,
 *    are recorded in
 *    `docs/goals/frameless-angular-v1/notes/T009-control-flow.md`.
 * 2. GATE 6'S PASS DEPENDS ON UPSTREAM keeping `prefer-control-flow` in its
 *    `recommended` metadata tier - AND THAT DEPENDENCY IS TRIPWIRED, which this
 *    comment used to deny by calling it the single most fragile input in the
 *    ruling and leaving it there. It cannot move silently. `test/gate.test.ts`
 *    asserts ANGULAR_ESLINT_TEMPLATE_RULES_DERIVED equals the EXACT FOUR NAMES
 *    - banana-in-box, eqeqeq, no-negated-async, prefer-control-flow - and
 *    separately asserts ANGULAR_ESLINT_RULES_APPLIED does NOT contain
 *    `@angular-eslint/prefer-signals`, the opposite-direction read worked
 *    example 11 turns on. A DEMOTION of prefer-control-flow OR A PROMOTION of
 *    prefer-signals therefore goes RED BY NAME on a routine `pnpm test`, and
 *    four further rows fail with them: the applied-set cardinalities 17/12/4,
 *    the baseline-floor row asserting prefer-control-flow is applied, and the
 *    `*ngFor` mutation row expecting it to report. So the re-run of worked
 *    example 5 that a tier move would owe is TRIGGERED BY A FAILING TEST rather
 *    than left to be noticed. The residual risk is only what a tripwire cannot
 *    cover: it fires when the lockfile moves, so it says nothing about an
 *    upstream release nobody has installed.
 *
 * `*ngIf` would additionally need an `imports: [NgIf]` entry on the standalone
 * component, which is machinery the IR does not declare. The version floor this
 * costs is recorded in the gate's baseline form inventory, and it is ZERO reach:
 * `@if` floors at 17.0 but the emitted module already floors at 19.0 on the
 * absence of a `standalone` key, which dominates it.
 */
function renderBranch(
	node: Extract<TemplateNode, { kind: 'branch' }>,
	indent: string,
	context: EmitContext,
): string[] {
	if (node.arms.length < 1 || node.arms.length > 2)
		throw new Error(`Angular branch ${node.id} requires a then arm and at most one else arm`);
	if (node.arms[0]!.kind !== 'then')
		throw new Error(`Angular branch ${node.id} must open with a then arm`);
	if (node.arms[1] && node.arms[1].kind !== 'else')
		throw new Error(
			`Angular emitter has no lowering for a ${node.arms[1].kind} branch arm (${node.id})`,
		);
	const test = templateExpression(expression(node.expression), indent);
	const chunks = [`@if (${test}) {`, ...blockBody(node.arms[0]!.children, indent, context)];
	const elseArm = node.arms[1];
	if (elseArm && elseArm.children.length) {
		chunks.push('} @else {', ...blockBody(elseArm.children, indent, context));
	}
	chunks.push('}');
	return [chunks.join(`\n${indent}`)];
}

/** The interior of an `@if`/`@for` block, one indent level in. */
function blockBody(
	children: readonly TemplateNode[],
	indent: string,
	context: EmitContext,
): string[] {
	if (!children.every(isBlockLevel))
		throw new Error(
			'Angular emitter has no lowering for a control-flow block whose children are not all block level: the block braces sit on their own lines, so a text child would gain the whitespace edges measurement M1 rejects',
		);
	return [`\t${renderChildren(children, `${indent}\t`, false, context)}`];
}

/**
 * `@for`'s `track` is SYNTACTICALLY MANDATORY - measured: omitting it makes
 * `parseTemplate` report `@for loop must have a "track" expression`. That closes
 * the `require-each-key` hole at the compiler, exactly as
 * `frameless-angular-v1` T002's dissent 2 predicted, and the IR's `key`
 * expression supplies it directly.
 *
 * `@for … ; track …` OVER `*ngFor` + `trackBy:` IS A RULING, and this is the
 * second of the two decision sites it is recorded at - see `renderBranch` above
 * for the full six-gate record. Ruled SUGAR, ADOPTED by `frameless-angular-v1`
 * T009, folded in as `docs/emitter-idiom-policy.md` worked example 5 by T011.
 * All six gates PASS; none is DEFERRED. THE DECIDING GATE IS G6, and the
 * measurement is that the lane's applied `@angular-eslint` set - DERIVED from
 * upstream's `meta.docs.recommended === 'recommended'` - carries
 * `prefer-control-flow` as 1 of only 4 template rules of 41, reporting the
 * `*ngFor` baseline by name and the shipped `@for` zero times.
 *
 * THE `track` MANDATE ABOVE IS G6'S SECOND LIMB, and its force comes from the
 * asymmetry: under the baseline, `trackBy` is OPTIONAL AND ITS OMISSION SILENT -
 * measured, a `*ngFor` arm with no `trackBy` at all AOT-compiles with 0
 * diagnostics at 22.0.8. The candidate cannot be written wrong in that way; the
 * baseline can, and nothing would say so.
 *
 * G4 IS TOTAL ON A NARROWED RULE whose every term is a declared IR field: no
 * `index`, no `empty`, an identifier-safe `item`. The refusals below are that
 * narrowing, and they are also the exhibited counterexamples the gate wants. At
 * `abb5e44` the corpus offered 8 control-flow blocks across 4 of 5 goldens - S3
 * emits neither `@if` nor `@for`, S1 emits no `@for` - and every one takes the
 * sugar with zero refusals. S6 has since added a ninth. THE COUNT MOVES WITH THE
 * CORPUS; THE RULING IS AT THE FORM LEVEL AND DOES NOT.
 *
 * G5 measured node identity across reverse, whole-object replacement with
 * preserved ids, removal and prepend: nodes MOVE rather than being recreated,
 * IDENTICALLY IN BOTH ARMS. The one candidate-only behaviour found - a dev-mode
 * `console.warn` NG0955 on duplicate track keys, where NEITHER arm throws - is
 * the candidate being MORE diagnostic, and is not on Gate 5's failure list.
 */
function renderKeyedRepeat(
	node: Extract<TemplateNode, { kind: 'keyed-repeat' }>,
	indent: string,
	context: EmitContext,
): string[] {
	if (node.index)
		throw new Error(`Angular keyed repeat ${node.id} has no lowering for an index binding`);
	if (node.empty.length)
		throw new Error(`Angular keyed repeat ${node.id} has no lowering for an empty fallback`);
	if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(node.item))
		throw new Error(`Angular emitter rejects the repeat item name ${JSON.stringify(node.item)}`);
	const collection = templateExpression(expression(node.collection.expression), indent);
	const key = templateExpression(expression(node.key.expression), indent);
	return [
		[
			`@for (${node.item} of ${collection}; track ${key}) {`,
			...blockBody(node.row, indent, context),
			'}',
		].join(`\n${indent}`),
	];
}

function renderNode(
	node: TemplateNode,
	indent: string,
	inline: boolean,
	context: EmitContext,
): string[] {
	if (node.kind === 'text') return [escapeText(node.value)];
	if (node.kind === 'dynamic-text')
		return [`{{ ${templateExpression(expression(node.expression), indent)} }}`];
	if (node.kind === 'fragment')
		return [renderChildren(node.children, indent, inline || !isBlockLevel(node), context)];
	if (node.kind === 'branch') return renderBranch(node, indent, context);
	if (node.kind === 'keyed-repeat') return renderKeyedRepeat(node, indent, context);
	if (node.kind === 'host') return renderHost(node, indent, inline, context);
	if (node.kind === 'component-reference')
		return renderComponentReference(node, indent, inline, context);
	// STEP 5. `<ng-content />` is Angular's only content-projection construct and
	// the only member of the sanctioned set for this one, so the six gates have
	// nothing to decide. It takes no expression: an unfilled `<ng-content />`
	// renders its fallback children and this emitter prints none, so it renders
	// NOTHING - which is React's and Solid's `{children}` behaviour.
	if (node.kind === 'default-slot-projection') {
		if (expression(node.site.expression).type !== 'Identifier')
			throw new Error(
				'Angular emitter has no lowering for a default-slot projection that is not a plain prop read',
			);
		return ['<ng-content />'];
	}
	throw new Error(
		`Angular emitter has no lowering for template node kind ${(node as { kind: string }).kind}`,
	);
}

/**
 * STEP 5, COMPOSITION. A component reference is the child's ELEMENT SELECTOR,
 * and the parent's `@Component` gains the child class in `imports:`.
 *
 * Standalone is the only mode here: `@Component` at 22.0.8 is standalone by
 * default, and the emitted classes carry no `NgModule`, so `imports:` on the
 * decorator is the whole resolution mechanism. The selector is derived from the
 * IR component name by `componentSelector`, the same total function the child's
 * own decorator uses, so the two sides cannot drift.
 */
function renderComponentReference(
	node: Extract<TemplateNode, { kind: 'component-reference' }>,
	indent: string,
	inline: boolean,
	context: EmitContext,
): string[] {
	const name = node.target.localName;
	const selector = context.referenceableComponents.get(name);
	if (selector === undefined)
		throw new Error(
			`TemplateComponentReference names no import or component in this module: ${name}`,
		);
	context.referenced.add(name);
	const attributes = node.props.map((prop) => {
		assertPlainAttributeName(prop.name);
		return `[${prop.name}]="${templateExpression(expression(prop.value.expression), `${indent}\t`)}"`;
	});
	const singleLine = `<${selector}${attributes.map((attribute) => ` ${attribute}`).join('')}>`;
	const fits =
		!attributes.some((attribute) => attribute.includes('\n')) &&
		width(indent, singleLine) <= PRINT_WIDTH;
	if (inline && !fits)
		throw new Error(
			`Angular emitter cannot inline <${selector}>: it sits in a text-bearing run and needs a multi-line start tag`,
		);
	const open = fits
		? singleLine
		: `<${selector}\n${attributes.map((attribute) => `${indent}\t${attribute}`).join('\n')}\n${indent}>`;
	const close = `</${selector}>`;
	if (node.children.length === 0) return [open + close];
	if (inline || !node.children.every(isBlockLevel))
		return [open + renderChildren(node.children, indent, true, context) + close];
	return [
		`${open}\n${indent}\t${renderChildren(node.children, `${indent}\t`, false, context)}\n${indent}${close}`,
	];
}

// ---------------------------------------------------------------------------
// output verification
// ---------------------------------------------------------------------------

/**
 * ARBITER 1, run by the emitter itself so a template Angular's own parser rejects
 * never reaches disk. `frameless-angular-v1` T002 ruling 4 makes it PRIMARY: it
 * interrogates this board's central risk directly - did forced lowering produce a
 * template Angular accepts? MEASURED at 22.0.8: a clean template returns
 * `errors === null` and a track-deleted `@for` returns exactly one error.
 */
export function templateDiagnostics(template: string, filename: string): string[] {
	const parsed = parseTemplate(template, filename);
	return (parsed.errors ?? []).map((error) => String(error.msg ?? error));
}

function assertTemplateParsesClean(template: string, filename: string): void {
	const found = templateDiagnostics(template, filename);
	if (found.length)
		throw new Error(
			`Emitted Angular template ${filename} did not parse with an empty error set: ${found.join(' | ')}`,
		);
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

/** `RenderOnce` -> `frameless-render-once`. Derived from the IR's own name only. */
export function componentSelector(name: string): string {
	if (!/^[A-Z][A-Za-z0-9]*$/.test(name))
		throw new Error(`Angular emitter cannot derive a selector from ${JSON.stringify(name)}`);
	return `frameless-${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

/**
 * Emit one Angular 22 standalone component from `frameless-enriched-ir/2` as a
 * single `.ts` file.
 *
 * WHAT IS DELIBERATELY ABSENT FROM THE METADATA, because absence is the decision:
 *
 *   - NO `changeDetection`. At Angular 22 `OnPush` IS the default and
 *     `@angular-eslint/prefer-on-push-component-change-detection` - which IS in
 *     this lane's applied set - reports only an explicit opt-out. So emitted
 *     components are OnPush-CHECKED, and a downstream lane must not assume eager
 *     checking. Ruled by `frameless-angular-v1` T003a.
 *   - NO `standalone`. It defaults to `true` from Angular 19, and
 *     `@angular-eslint/prefer-standalone` reports `standalone: false`. The floor
 *     that costs is recorded in the gate's baseline form inventory.
 *   - NO `imports`. Built-in control flow needs none, which is a second reason
 *     `@if`/`@for` beat `*ngIf`/`*ngFor` here.
 *
 * Unlike a `.vue` or `.svelte` module, a `.ts` module CAN honour the IR's named
 * `ComponentExport` by spelling, so the class is exported under the IR's own
 * `exportedName` and the emitter asserts the two agree.
 */
/**
 * The `hostNodeId -> #templateRef` map, plus every fail-closed check that has to
 * hold before one byte of `#name` or `@ViewChild` is printed.
 *
 * TWO OF THESE CHECKS ARE ANGULAR-ONLY, and both are lane limits rather than
 * missing work.
 *
 * 1. A TEMPLATE REFERENCE VARIABLE SHADOWS THE COMPONENT MEMBER OF THE SAME NAME
 *    inside the template. `#input` makes `input` resolve to the ELEMENT in any
 *    template expression, while the class getter of the same name resolves to the
 *    element too - but through `ElementRef`, and only after `ngAfterViewInit`. The
 *    two are not the same value at the same time, so a template expression that
 *    reads a handle name is REFUSED rather than emitted into that ambiguity. No
 *    other lane has this problem: Svelte, Vue and the JSX lanes all read the
 *    author's own variable.
 * 2. A CALL WITH NO `eventId` IS REFUSED. Angular resolves a non-static
 *    `@ViewChild` at `ngAfterViewInit`, and this emitter's once-per-instance site
 *    is `ngOnInit`, which runs BEFORE it. Such a call would read `null`. Its
 *    repair is `ngAfterViewInit`, a Step 4 lifecycle construct.
 *
 * `handleCalls` is otherwise an ASSERTION here, not a lowering: the handler AST is
 * transplanted into a class method by `qualify()`, so `input?.focus()` becomes
 * `this.input?.focus()` with no help from this function - and a record the handler
 * does not spell would vanish in silence. Same shape as `syncPolicyGuard`.
 */
function elementHandleHosts(
	ir: EnrichedIR,
	component: EnrichedComponent,
	members: ReadonlySet<string>,
): ReadonlyMap<string, string> {
	const handleHosts = new Map<string, string>();
	for (const binding of ir.records.elementHandleBindings) {
		if (binding.componentId !== component.id)
			throw new Error(
				`ElementHandleBinding ${binding.id} belongs to another component: ${binding.componentId}`,
			);
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(binding.handleName))
			throw new Error(
				`Angular emitter cannot bind an element handle named ${JSON.stringify(binding.handleName)}: a template reference variable is a bare identifier`,
			);
		if (!members.has(binding.handleName))
			throw new Error(
				`ElementHandleBinding ${binding.id} names no component local: ${binding.handleName}`,
			);
		if (handleHosts.has(binding.hostNodeId))
			throw new Error(
				`Angular emitter cannot bind two element handles to one host: ${binding.hostNodeId}`,
			);
		handleHosts.set(binding.hostNodeId, binding.handleName);
	}
	if (handleHosts.size === 0) return handleHosts;
	const hostIds = new Set<string>();
	walk(component.template, (record) => {
		if (record.kind === 'host' && typeof record.id === 'string') hostIds.add(record.id);
	});
	for (const [hostNodeId, name] of handleHosts)
		if (!hostIds.has(hostNodeId))
			throw new Error(
				`Angular element handle ${name} names a host this component does not render: ${hostNodeId}`,
			);
	const shadowed = new Set(handleHosts.values());
	walk(component.template, (record) => {
		if (record.type === 'Identifier' && shadowed.has(String(record.name)))
			throw new Error(
				`Angular emitter refuses the template expression read of the element handle ${String(record.name)}: the #${String(record.name)} template reference variable shadows the component member of the same name, so the two spellings would not be the same value`,
			);
	});
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
				`Angular emitter has no lowering for a handle call outside an event handler (${name}.${call.method}): @ViewChild resolves at ngAfterViewInit and this emitter's once-per-instance site is ngOnInit, which runs first`,
			);
		const event = eventById.get(call.eventId);
		if (!event) throw new Error(`HandleCallRecord has dangling event: ${call.eventId}`);
		let spelled = false;
		walk(
			event.handlers.map((handler) => handler.expression),
			(record) => {
				const callee = record.callee as Record<string, any> | undefined;
				if (record.type !== 'CallExpression' || !callee) return;
				if (
					callee.type === 'MemberExpression' &&
					callee.computed === false &&
					callee.object?.type === 'Identifier' &&
					callee.object.name === name &&
					callee.property?.type === 'Identifier' &&
					callee.property.name === call.method
				)
					spelled = true;
			},
		);
		if (!spelled)
			throw new Error(
				`Angular event ${call.eventId} declares a handle call ${name}.${call.method}() its handler AST does not spell`,
			);
	}
	return handleHosts;
}

/** One emitted `@Component` class, plus what its decorator and module need. */
type EmittedClass = {
	readonly text: string;
	readonly angularImports: readonly string[];
};

function emitComponentClass(
	ir: EnrichedIR,
	component: EnrichedComponent,
	referenceableComponents: ReadonlyMap<string, string>,
	exported: boolean,
): EmittedClass {
	if (component.guards.length)
		throw new Error(
			`Angular emitter has no lowering for an early component guard (${component.name}): a component class has no return statement to guard`,
		);

	const componentEvents = ir.records.events.filter((event) => event.componentId === component.id);
	const scopes = collectEventScopes(component);
	for (const eventId of scopes.keys())
		if (!componentEvents.some((event) => event.id === eventId))
			throw new Error(`Angular emitter found a template event id with no record: ${eventId}`);

	const members = new Set<string>();
	for (const entry of component.props.entries) members.add(entry.localName);
	for (const local of component.locals) for (const name of local.names) members.add(name);
	for (const name of members)
		if (RESERVED_MEMBER_NAMES.has(name))
			throw new Error(
				`Angular emitter refuses the component member ${JSON.stringify(name)}: it collides with a member the emitted class introduces`,
			);

	const handlersByEventId = new Map<string, LoweredHandler>();
	const takenNames = new Set([...members, ...RESERVED_MEMBER_NAMES]);
	for (const event of componentEvents) {
		const forVariables = scopes.get(event.id);
		if (!forVariables)
			throw new Error(
				`Angular emitter found the event record ${event.id} on no host node, so its lowered method would never be called`,
			);
		const name = handlerMethodName(event);
		if (takenNames.has(name))
			throw new Error(
				`Angular emitter refuses the lowered method name ${name}: two records collide on (hostNodeId, eventName) or a component member already owns the name. RULED: throw rather than append a disambiguating suffix, because a counter makes names depend on record order and reintroduces exactly the golden instability the naming scheme exists to prevent`,
			);
		takenNames.add(name);
		handlersByEventId.set(event.id, {
			event,
			name,
			forVariables,
			eventParameter: eventParameterName(event),
			isAsync: handlerIsAsync(event),
		});
	}

	const handleHosts = elementHandleHosts(ir, component, members);
	const hostIds = new Set<string>();
	walk(component.template, (record) => {
		if (record.kind === 'host' && typeof record.id === 'string') hostIds.add(record.id);
	});
	const behaviorNames = new Set<string>([...members, ...RESERVED_MEMBER_NAMES, ...takenNames]);
	const behaviorPlans = angularBehaviorPlans(
		ir,
		component,
		hostIds,
		handleHosts,
		members,
		behaviorNames,
	);
	const context: EmitContext = {
		component,
		members,
		handlersByEventId,
		handleHosts,
		behaviorHosts: new Map(behaviorPlans.map((plan) => [plan.hostNodeId, plan.templateRef])),
		behaviorPlans,
		referenceableComponents,
		referenced: new Set<string>(),
	};

	const template = renderChildren(component.template, TEMPLATE_INDENT, false, context);
	assertTemplateParsesClean(template, `${component.name}.html`);
	const emitted = classMembers(ir, component, context);
	const body = emitted.members.map((entry) => indentBlock(entry.text, '\t')).join('\n');
	const interfaces = [...(emitted.implementsOnInit ? ['OnInit'] : []), ...emitted.lifecycle];
	const angularImports = [
		...(emitted.lifecycle.includes('AfterViewInit') ? ['type AfterViewInit'] : []),
		'Component',
		...(emitted.lifecycle.includes('DoCheck') ? ['type DoCheck'] : []),
		...(emitted.usesChangeDetector ? ['ChangeDetectorRef'] : []),
		...(emitted.usesViewChild ? ['ElementRef'] : []),
		...(emitted.usesChangeDetector ? ['inject'] : []),
		// CONDITIONAL, AND `pnpm lint` IS WHAT SETTLED IT. Three prior-step tests
		// asserted that a component with NO props still emits `Input` in its import
		// list, so this was written unconditional first and then reverted to match
		// them. THE REVERT TOOK `pnpm lint` FROM 0 WARNINGS TO 2:
		// `eslint(no-unused-vars): Identifier 'Input' is imported but never used`
		// on `generated-composition/C1-slot.ts` and `M2-page.ts`. The old contract
		// had never been exercised by a COMMITTED artifact - every one of the eight
		// `generated/` scenarios declares at least one `@Input()`, so the propless
		// case existed only inside a test's source string - and Step 5 emits the
		// first modules that have no props at all. The three tests were updated
		// with the lint evidence rather than the emitter bent to keep them green.
		...(body.includes('@Input()') ? ['Input'] : []),
		...(emitted.lifecycle.includes('OnDestroy') ? ['type OnDestroy'] : []),
		...(emitted.implementsOnInit ? ['type OnInit'] : []),
		...(emitted.usesViewChild ? ['ViewChild'] : []),
	];
	// STEP 5. `imports:` is emitted ONLY for the classes this template actually
	// referenced, in the module's own component order, so a decorator never
	// declares a dependency the template does not use - Angular's own
	// `NG8113 unused import` diagnostic is what would report that, and the
	// emitter fails closed of it rather than relying on the demo build to notice.
	const referenced = [...referenceableComponents.keys()].filter((name) =>
		context.referenced.has(name),
	);
	return {
		text:
			'@Component({\n' +
			`\tselector: '${componentSelector(component.name)}',\n` +
			(referenced.length ? `\timports: [${referenced.join(', ')}],\n` : '') +
			`\ttemplate: \`\n${TEMPLATE_INDENT}${template}\n\t\`,\n` +
			'})\n' +
			`${exported ? 'export ' : ''}class ${component.name}${interfaces.length ? ` implements ${interfaces.join(', ')}` : ''} ${body ? `{\n${body}\n}` : '{}'}\n`,
		angularImports,
	};
}

export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	if (ir.records.persistence.length)
		throw new Error('Angular emitter does not support persistence-bearing IR');
	// STEP 5 SPLIT THIS GATE. `imports`, `component-reference` and
	// `default-slot-projection` are LOWERED, and so is the MULTI-COMPONENT MODULE:
	// a `.ts` file holds as many `@Component` classes as the module has
	// components, so this lane has no counterpart to the one-component-per-file
	// limit the Svelte and Vue lanes record. Only the `shared` family stays
	// refused, and now by its own name.
	if (
		ir.records.sharedDefinitions.length ||
		ir.records.sharedInstances.length ||
		ir.records.sharedReads.length ||
		ir.records.sharedCalls.length ||
		ir.records.sharedWrites.length
	)
		throw new Error('Angular emitter does not support shared constructs');
	// `handleForwards` hands a child's node to a PARENT module. It stays refused by
	// name: the construct needs a `@ViewChild` on the PARENT that resolves through
	// the child's own view, which is a second element-query generation this lane
	// has not measured, and no fixture in this step's corpus carries one.
	if (ir.records.handleForwards.length)
		throw new Error('Angular emitter does not support forwarding a handle to a parent module');
	if (ir.module.exports.length !== 1)
		throw new Error('Angular emitter emits exactly one exported component per module');
	const exported = ir.module.exports[0]!;
	if (exported.kind !== 'named')
		throw new Error(
			`Angular emitter requires a named export, received ${exported.kind} ${exported.exportedName}`,
		);
	if (exported.exportedName !== exported.componentName)
		throw new Error(
			`Angular emitter requires an export whose exportedName is the component name, received ${exported.exportedName} for ${exported.componentName}`,
		);
	const moduleImports = moduleImportSpecifiers(ir);
	const referenceableComponents = new Map<string, string>([
		...[...moduleImports.keys()].map(
			(name) => [name, componentSelector(name)] as [string, string],
		),
		...ir.components.map(
			(component) => [component.name, componentSelector(component.name)] as [string, string],
		),
	]);
	const classes = ir.components.map((component) =>
		emitComponentClass(
			ir,
			component,
			referenceableComponents,
			component.name === exported.componentName,
		),
	);
	const angularImports = [...new Set(classes.flatMap((entry) => entry.angularImports))];
	const ORDER = [
		'type AfterViewInit',
		'ChangeDetectorRef',
		'Component',
		'type DoCheck',
		'ElementRef',
		'inject',
		'Input',
		'type OnDestroy',
		'type OnInit',
		'ViewChild',
	];
	angularImports.sort((left, right) => ORDER.indexOf(left) - ORDER.indexOf(right));
	return (
		`// @generated by @frameless/angular from ${exported.componentName}; do not edit.\n` +
		`import { ${angularImports.join(', ')} } from '@angular/core';\n` +
		[...moduleImports]
			.map(([name, source]) => `import { ${name} } from '${source}';\n`)
			.join('') +
		'\n' +
		classes.map((entry) => entry.text).join('\n')
	);
}

/**
 * STEP 5. `ModuleImport` -> the specifier the emitted `.ts` module imports.
 *
 * `.tsrx` -> `.ts` here rather than `.jsx`: this lane's artifact is a plain
 * TypeScript module with no JSX in it at all, so the React/Solid/Qwik `.jsx`
 * convention would name a file that does not exist. The extension is DROPPED
 * entirely, which is what every emitted Angular demo module already does and
 * what Angular's own resolution expects.
 */
function moduleImportSpecifiers(ir: EnrichedIR): Map<string, string> {
	const specifiers = new Map<string, string>();
	const declared = new Set(ir.components.map((component) => component.name));
	for (const imported of ir.imports) {
		if (imported.resolvesTo !== 'tsrx-module' || !imported.source.endsWith('.tsrx'))
			throw new Error(`ModuleImport cannot be lowered: ${imported.source}`);
		if (imported.kind !== 'named' || typeof imported.importedName !== 'string')
			throw new Error(
				`Angular emitter has no lowering for a ${imported.kind} ModuleImport: ${imported.source}`,
			);
		if (imported.importedName !== imported.localName)
			throw new Error(
				`Angular emitter has no lowering for a renamed ModuleImport: ${imported.importedName} as ${imported.localName}`,
			);
		if (!/^[A-Z][A-Za-z0-9]*$/.test(imported.localName))
			throw new Error(`Angular emitter rejects the import binding ${imported.localName}`);
		if (specifiers.has(imported.localName) || declared.has(imported.localName))
			throw new Error(
				`Angular emitter cannot import ${imported.localName}: the name is already declared in this module`,
			);
		specifiers.set(imported.localName, imported.source.replace(/\.tsrx$/, ''));
	}
	return specifiers;
}
