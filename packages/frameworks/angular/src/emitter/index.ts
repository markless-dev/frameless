import { parseTemplate } from '@angular/compiler';
import {
	ENRICHED_IR_VERSION,
	type EnrichedComponent,
	type EnrichedEventRecord,
	type EnrichedGraphBinding,
	type EnrichedIR,
	type LocalDeclaration,
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
};

/**
 * Names the emitted CLASS introduces itself. A component member with one of these
 * names would silently collide with emitter-owned machinery, so it is refused
 * rather than renamed.
 */
const RESERVED_MEMBER_NAMES = new Set(['constructor', 'ngOnInit']);

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

/** Fail closed at the public emitter boundary before constructing output. */
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
 * THERE IS NO GLOBALS ALLOWLIST, deliberately. `Math`, `JSON`, `console` and
 * friends have ZERO instances across the corpus, so an allowlist would be
 * untested dead code, which in an emitter is worse than absent code. The IR's
 * one other statement-injecting channel - `ir.records.persistence`, which injects
 * `__framelessWrite(...)` into handler bodies - is refused whole by `emit()`, so
 * that identifier can never arrive here either. A new free name is a loud throw
 * and a deliberate edit.
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
			throw new Error(
				`Angular emitter cannot resolve the identifier ${JSON.stringify(name)} in a transplanted body: ` +
					'it is neither a body-local binding, a function parameter, a @for variable, nor a declared ' +
					`component member (${[...members].sort().join(', ')}). The emitter throws rather than guessing ` +
					'whether it is a global',
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
 * EVERY emitted declaration carries `: any`, and that is IR-8 recorded rather
 * than closed.
 *
 * `PropDestructuringEntry` is `sourceName`/`localName`/`path`/`alias`/
 * `graphNodeId`/`defaultValue?` and carries NO type, so any emitted type would be
 * INFERRED from what the corpus happens to do with the member - a content-based
 * trigger (Gate 3) that is unsound outside the exercised subset (Gate 4).
 * `frameless-angular-v1` T002 ruling 5 puts prop types OUT OF SCOPE for T003 and
 * requires this limitation be written down so a green is not over-read:
 * `strictTemplates` types `$event` at all fifteen lowered call sites and validates
 * every `@for` track expression, but an `any` member defeats it exactly as it
 * defeats `svelte-check`.
 *
 * The annotation is not decoration. The scaffold's `strict` implies
 * `noImplicitAny`, and a bare `count;` is TS7008 while a bare `event` parameter
 * is TS7006 - so an unannotated member would not survive T004's `ng build` at
 * all. `event: Event` is refused for the opposite reason: the real DOM type makes
 * `event.currentTarget.value` a type error, which would be this emitter inventing
 * a type the IR does not carry in order to look better typed than it is.
 */
const MEMBER_TYPE = ': any';

type ClassMember = { readonly text: string };

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
 * only adjacent field, `defaultValue`.
 *
 * Gate 6 also FAILs, and it is the honest negative result: `pnpm e2e` would NOT go
 * red if this line silently became `input()`, because both arms were measured to
 * render identically. The six-row green proves ACTIVATION NEUTRALITY; it does not
 * pin this form choice. The only thing that does is the frameless-owned
 * `no-signal-members` policy in `../gate/index.ts`.
 */
function propMembers(component: EnrichedComponent): ClassMember[] {
	return component.props.entries.map((entry) => {
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
		return { text: `@Input() ${entry.localName}${MEMBER_TYPE};` };
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
function classMembers(
	ir: EnrichedIR,
	component: EnrichedComponent,
	context: EmitContext,
): { readonly members: ClassMember[]; readonly implementsOnInit: boolean } {
	const members: ClassMember[] = [...propMembers(component)];
	const fields: ClassMember[] = [];
	const getters: ClassMember[] = [];
	const initialisation: Statement[] = [];
	for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
		const name = localName(local);
		const binding = componentBinding(ir, component, local);
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
	members.push(...fields, ...getters);
	// `@angular-eslint/no-empty-lifecycle-method` is in the applied set, and
	// `implements OnInit` without an `ngOnInit` is a type error, so BOTH are
	// emitted together or neither is.
	const implementsOnInit = initialisation.length > 0;
	if (implementsOnInit) {
		const body = printStatements(initialisation);
		members.push({ text: `ngOnInit(): void {\n${indentBlock(body, '\t')}\n}` });
	}
	for (const handler of context.handlersByEventId.values()) {
		const parameters = [...handler.forVariables, handler.eventParameter]
			.map((parameter) => `${parameter}${MEMBER_TYPE}`)
			.join(', ');
		const body = printStatements(loweredHandlerBody(handler, context.members));
		members.push({
			text: `${handler.name}(${parameters}): void {\n${indentBlock(body, '\t')}\n}`,
		});
	}
	return { members, implementsOnInit };
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
	if (node.kind === 'host' || node.kind === 'branch' || node.kind === 'keyed-repeat') return true;
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
 * That is not a preference: `@angular-eslint/template/prefer-control-flow` is in
 * this lane's applied rule set and reports `*ngIf`/`*ngFor` directly (MEASURED,
 * see `test/gate.test.ts`). `*ngIf` would additionally need an `imports: [NgIf]`
 * entry on the standalone component, which is machinery the IR does not declare.
 * The version floor this costs is recorded in the gate's baseline form inventory.
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
	throw new Error(
		`Angular emitter has no lowering for template node kind ${(node as { kind: string }).kind}`,
	);
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
export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	if (ir.records.persistence.length)
		throw new Error('Angular emitter does not support persistence-bearing IR');
	if (
		ir.components.length !== 1 ||
		ir.imports.length ||
		ir.records.sharedDefinitions.length ||
		ir.records.sharedInstances.length ||
		ir.records.sharedReads.length ||
		ir.records.sharedCalls.length ||
		ir.records.sharedWrites.length ||
		ir.records.elementHandleBindings.length ||
		ir.records.handleForwards.length ||
		ir.records.behaviors.length ||
		ir.records.handleCalls.length
	)
		throw new Error('Angular emitter does not support composition or shared/handle constructs');
	if (ir.module.exports.length !== 1)
		throw new Error('Angular emitter emits exactly one exported component per module');
	const component = ir.components[0]!;
	const exported = ir.module.exports[0]!;
	if (exported.kind !== 'named' || exported.exportedName !== component.name)
		throw new Error(
			`Angular emitter requires a named export whose exportedName is the component name, received ${exported.kind} ${exported.exportedName}`,
		);
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
		});
	}

	const context: EmitContext = { component, members, handlersByEventId };

	const template = renderChildren(component.template, TEMPLATE_INDENT, false, context);
	assertTemplateParsesClean(template, `${component.name}.html`);
	const emitted = classMembers(ir, component, context);
	const body = emitted.members.map((entry) => indentBlock(entry.text, '\t')).join('\n');
	const imported = ['Component', 'Input', ...(emitted.implementsOnInit ? ['type OnInit'] : [])];
	return (
		`// @generated by @frameless/angular from ${component.name}; do not edit.\n` +
		`import { ${imported.join(', ')} } from '@angular/core';\n\n` +
		'@Component({\n' +
		`\tselector: '${componentSelector(component.name)}',\n` +
		`\ttemplate: \`\n${TEMPLATE_INDENT}${template}\n\t\`,\n` +
		'})\n' +
		`export class ${component.name}${emitted.implementsOnInit ? ' implements OnInit' : ''} {\n${body}\n}\n`
	);
}
