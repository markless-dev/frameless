import { analyze } from 'yuku-analyzer';
import { generate } from 'yuku-codegen';
import {
	ENRICHED_IR_VERSION,
	type EnrichedComponent,
	type EnrichedEventRecord,
	type EnrichedGraphBinding,
	type EnrichedIR,
	type JsonValue,
	type SerializableAstNode,
	type SyncPolicyCondition,
	type TemplateNode,
} from '@frameless/compiler';

type Node = Record<string, any>;
type Expression = Node;
type Statement = Node;
type StateBinding = EnrichedGraphBinding & { readonly kind: 'state' };
type EmitContext = {
	readonly arrayStoreStateNames: ReadonlySet<string>;
	readonly callbackProps: ReadonlySet<string>;
	readonly component: EnrichedComponent;
	readonly computedByName: ReadonlyMap<string, EnrichedGraphBinding>;
	readonly eventsById: ReadonlyMap<string, EnrichedEventRecord>;
	readonly imports: Set<QwikApi>;
	readonly lexicalNames: ReadonlySet<string>;
	readonly propsByLocal: ReadonlyMap<
		string,
		EnrichedComponent['props']['entries'][number]
	>;
	readonly propsName: string;
	readonly storeStateNames: ReadonlySet<string>;
	readonly statesByName: ReadonlyMap<string, StateBinding>;
	readonly onceSignals: ReadonlySet<string>;
	/** Names bound by `useSignal()` to a rendered element, read through `.value`. */
	readonly elementHandleNames: ReadonlySet<string>;
	/**
	 * Host node id -> the `ref={}` target name, for every `ElementHandleBinding`
	 * this component owns. Empty for every scenario in the corpus.
	 */
	readonly handleHosts: ReadonlyMap<string, string>;
};
type QwikApi =
	| '$'
	| 'component$'
	| 'sync$'
	| 'useComputed$'
	| 'useSignal'
	| 'useStore'
	| 'useTask$';
type RenderedNode = Node;

function exactKeys(construct: string, value: object, allowed: readonly string[]): void {
	const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
	if (unknown.length)
		throw new Error(`${construct} has unknown semantic field: ${unknown[0]}`);
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

function walk(value: unknown, visit: (record: Record<string, any>) => void): void {
	if (!value || typeof value !== 'object') return;
	visit(value as Record<string, any>);
	for (const child of Object.values(value)) {
		if (Array.isArray(child)) child.forEach((entry) => walk(entry, visit));
		else walk(child, visit);
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
 * `handleForwards` and `behaviors` are deliberately NOT checked: `emit` still
 * refuses BOTH, so they stay unreachable, and a checker over an unreachable path
 * asserts nothing. Step 4 MEASURED that this lane has no in-envelope lowering for
 * `behaviors` at all and left the refusal standing, so unlike the svelte, vue and
 * angular lanes this one gains no `validateBehaviorRecords` - see the refusal in
 * `emit` and notes/T006-effects.md.
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

/** Fail closed at the public emitter boundary before constructing output AST. */
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
		throw new Error('Qwik emitter requires at least one component per IR artifact');
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
	validateHandleRecords(ir);
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
	// V1-V3 and the unknown-condition arm of V5. The limit is QWIK'S, so it lives
	// here and not in @frameless/compiler: React and Solid lower `graph-truthy`
	// with no difficulty, and encoding Qwik's weakness in the shared contract
	// would export it to every other adapter (T011 §2, §5).
	for (const event of ir.records.events) syncActionPlan(event);
}

function identifier(name: string): Node {
	return { type: 'Identifier', name };
}

function literal(value: string | number | boolean | null): Node {
	return { type: 'Literal', value, raw: typeof value === 'string' ? JSON.stringify(value) : String(value) };
}

function member(object: Expression, property: string): Expression {
	return {
		type: 'MemberExpression',
		object,
		property: identifier(property),
		computed: false,
		optional: false,
	};
}

function call(callee: Expression, args: Expression[]): Expression {
	return { type: 'CallExpression', callee, arguments: args, optional: false };
}

function arrow(
	params: Node[],
	body: Expression | Statement,
	options: { readonly async?: boolean; readonly expression?: boolean } = {},
): Expression {
	return {
		type: 'ArrowFunctionExpression',
		id: null,
		params,
		body,
		generator: false,
		async: options.async ?? false,
		expression: options.expression ?? body.type !== 'BlockStatement',
	};
}

function block(body: Statement[]): Statement {
	return { type: 'BlockStatement', body };
}

function expressionStatement(expression: Expression): Statement {
	return { type: 'ExpressionStatement', expression };
}

function variable(name: string, init: Expression): Statement {
	return {
		type: 'VariableDeclaration',
		kind: 'const',
		declarations: [{ type: 'VariableDeclarator', id: identifier(name), init }],
	};
}

function pathMember(root: Expression, path: readonly string[]): Expression {
	return path.reduce<Expression>((value, part) => member(value, part), root);
}

function expression(node: SerializableAstNode | null | undefined): Expression {
	const cloned = node ? (structuredClone(node) as Node) : null;
	if (!cloned || typeof cloned.type !== 'string')
		throw new Error(`Expected an expression, received ${cloned?.type ?? 'null'}`);
	return cloned;
}

function callbackName(node: Node, context: EmitContext): string | null {
	return node.type === 'Identifier' && context.callbackProps.has(node.name) ? node.name : null;
}

function callbackCalls(value: unknown, callbacks: ReadonlySet<string>): Node[] {
	const calls: Node[] = [];
	walk(value, (record) => {
		if (
			record.type === 'CallExpression' &&
			record.callee?.type === 'Identifier' &&
			callbacks.has(record.callee.name)
		)
			calls.push(record);
	});
	return calls;
}

function rewriteExpression(
	value: Expression,
	context: EmitContext,
	bound: ReadonlySet<string> = context.lexicalNames,
	elementForEvent?: { readonly element: string; readonly event: string },
): Expression {
	const rewrite = (node: any, lexical: ReadonlySet<string>): any => {
		if (!node || typeof node !== 'object') return node;
		if (Array.isArray(node)) return node.map((entry) => rewrite(entry, lexical));
		if (node.type === 'Identifier') {
			if (lexical.has(node.name)) return structuredClone(node);
			const prop = context.propsByLocal.get(node.name);
			if (prop) {
				const path = [...prop.path];
				if (context.callbackProps.has(node.name))
					path[path.length - 1] = `${path[path.length - 1]}$`;
				return pathMember(identifier(context.propsName), path);
			}
			if (context.storeStateNames.has(node.name)) return structuredClone(node);
			if (
				context.statesByName.has(node.name) ||
				context.onceSignals.has(node.name) ||
				// STEP 3, REFS. A Qwik element handle IS a `Signal`, so a read of it goes
				// through `.value` for exactly the same reason a state read does. This is
				// the whole lowering of `input?.focus()` in this lane.
				context.elementHandleNames.has(node.name)
			)
				return member(identifier(node.name), 'value');
			if (context.computedByName.has(node.name))
				return member(identifier(node.name), 'value');
			return structuredClone(node);
		}
		if (node.type === 'MemberExpression') {
			if (
				elementForEvent &&
				!node.computed &&
				node.object?.type === 'Identifier' &&
				node.object.name === elementForEvent.event &&
				node.property?.type === 'Identifier' &&
				node.property.name === 'currentTarget'
			)
				return identifier(elementForEvent.element);
			return {
				...structuredClone(node),
				object: rewrite(node.object, lexical),
				property: node.computed ? rewrite(node.property, lexical) : structuredClone(node.property),
			};
		}
		if (node.type === 'Property') {
			const rewrittenValue = rewrite(node.value, lexical);
			return {
				...structuredClone(node),
				key: node.computed ? rewrite(node.key, lexical) : structuredClone(node.key),
				value: rewrittenValue,
				shorthand:
					node.shorthand &&
					rewrittenValue.type === 'Identifier' &&
					rewrittenValue.name === node.key?.name,
			};
		}
		if (node.type === 'ArrowFunctionExpression') {
			const nested = new Set(lexical);
			for (const parameter of node.params) {
				walk(parameter, (record) => {
					if (record.type === 'Identifier') nested.add(record.name);
				});
			}
			return {
				...structuredClone(node),
				params: structuredClone(node.params),
				body: rewrite(node.body, nested),
			};
		}
		if (node.type === 'UpdateExpression' && node.argument?.type === 'Identifier') {
			const state = context.statesByName.get(node.argument.name);
			if (state) {
				if (node.operator !== '++' && node.operator !== '--')
					throw new Error(`Unsupported Qwik state update operator: ${node.operator}`);
				return {
					type: 'AssignmentExpression',
					operator: node.operator === '++' ? '+=' : '-=',
					left: member(identifier(state.name), 'value'),
					right: literal(1),
				};
			}
		}
		if (node.type === 'AssignmentExpression' && node.left?.type === 'Identifier') {
			const state = context.statesByName.get(node.left.name);
			if (state) {
				if (context.storeStateNames.has(state.name)) {
					if (node.operator !== '=')
						throw new Error(
							`Unsupported Qwik store replacement operator: ${node.operator}`,
						);
					if (!context.arrayStoreStateNames.has(state.name))
						throw new Error(
							`Qwik object store ${state.name} has no proxy-preserving whole-value replacement`,
						);
					const next = rewrite(node.right, lexical);
					const args: Expression[] = [
						literal(0),
						member(identifier(state.name), 'length'),
					];
					if (next.type !== 'ArrayExpression' || next.elements.length)
						args.push({ type: 'SpreadElement', argument: next });
					return call(member(identifier(state.name), 'splice'), args);
				}
				if (!['=', '+=', '-=', '*=', '/='].includes(node.operator))
					throw new Error(`Unsupported Qwik state assignment operator: ${node.operator}`);
				return {
					...structuredClone(node),
					left: member(identifier(state.name), 'value'),
					right: rewrite(node.right, lexical),
				};
			}
		}
		const result: Node = {};
		for (const [key, child] of Object.entries(node)) {
			if (['start', 'end', 'loc'].includes(key)) {
				result[key] = child;
				continue;
			}
			result[key] = rewrite(child, lexical);
		}
		return result;
	};
	return rewrite(value, bound);
}

function awaitCallbackCall(value: Expression, context: EmitContext): Expression {
	const calleeName = callbackName(value.callee, context);
	if (!calleeName)
		throw new Error('Qwik callback lowering expected a direct callback prop call');
	const rewritten = rewriteExpression(value, context);
	return { type: 'AwaitExpression', argument: rewritten };
}

function containsIdentifier(value: unknown, name: string): boolean {
	let found = false;
	walk(value, (record) => {
		if (record.type === 'Identifier' && record.name === name) found = true;
	});
	return found;
}

function identifierIsUsed(ir: EnrichedIR, component: EnrichedComponent, name: string): boolean {
	return containsIdentifier(
		{
			guards: component.guards,
			template: component.template,
			events: ir.records.events.filter((event) => event.componentId === component.id),
			bindings: ir.records.bindings.filter((binding) => binding.componentId === component.id),
		},
		name,
	);
}

function jsxAttribute(name: string, value: string | true | Expression): Node {
	return {
		type: 'JSXAttribute',
		name: { type: 'JSXIdentifier', name },
		value:
			value === true
				? null
				: typeof value === 'string'
					? literal(value)
					: { type: 'JSXExpressionContainer', expression: value },
	};
}

function expressionFromNodes(nodes: readonly TemplateNode[], context: EmitContext): Expression {
	if (nodes.length === 0) return literal(null);
	const children = nodes.map((node) => templateNode(node, context));
	if (children.length === 1 && ['JSXElement', 'JSXFragment'].includes(children[0]!.type))
		return children[0]!;
	return {
		type: 'JSXFragment',
		openingFragment: { type: 'JSXOpeningFragment' },
		closingFragment: { type: 'JSXClosingFragment' },
		children,
	};
}

function branchExpression(
	node: Extract<TemplateNode, { kind: 'branch' }>,
	context: EmitContext,
): Expression {
	if (node.arms.length !== 2)
		throw new Error(`Qwik branch ${node.id} requires explicit then and else arms`);
	return {
		type: 'ConditionalExpression',
		test: rewriteExpression(expression(node.expression), context),
		consequent: expressionFromNodes(node.arms[0]!.children, context),
		alternate: expressionFromNodes(node.arms[1]!.children, context),
	};
}

function keyedRepeatExpression(
	node: Extract<TemplateNode, { kind: 'keyed-repeat' }>,
	context: EmitContext,
): Expression {
	if (node.empty.length)
		throw new Error(`Qwik keyed repeat ${node.id} does not support a non-empty fallback`);
	if (node.row.length !== 1)
		throw new Error(`Qwik keyed repeat ${node.id} requires one row root`);
	const lexicalNames = new Set(context.lexicalNames).add(node.item);
	if (node.index) lexicalNames.add(node.index);
	const rowContext = { ...context, lexicalNames };
	const row = templateNode(node.row[0]!, rowContext);
	if (row.type !== 'JSXElement')
		throw new Error(`Qwik keyed repeat ${node.id} row root must be a host element`);
	row.openingElement.attributes.unshift(
		jsxAttribute(
			'key',
			rewriteExpression(expression(node.key.expression), rowContext),
		),
	);
	const params = [identifier(node.item)];
	if (node.index) params.push(identifier(node.index));
	return call(
		member(
			rewriteExpression(expression(node.collection.expression), context),
			'map',
		),
		[arrow(params, row)],
	);
}

function eventAttributeName(name: string): string {
	return `on${name[0]!.toUpperCase()}${name.slice(1)}$`;
}

type SyncAction = 'preventDefault' | 'stopPropagation';
type SyncActionPlan = {
	/** `null` when the declared branch is unconditional: no guard is synthesized. */
	readonly guard: SyncPolicyCondition | null;
	readonly actions: readonly SyncAction[];
};

const SYNTHESIZABLE_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * V1/V5 - the recursive half of the Qwik-only refusal set.
 *
 * `graph-truthy` is the one condition Qwik genuinely cannot express: the guard
 * would have to read reactive state, and a `sync$()` QRL may close over nothing
 * (see `syncActionPlan`). An unrecognised condition `type` is refused under V5
 * for the same reason a body that referenced a binding would be - the emitter
 * cannot prove closure over a construct it does not know, so it fails closed.
 */
function assertLowerableCondition(condition: SyncPolicyCondition, eventId: string): void {
	switch (condition.type) {
		case 'and':
		case 'or':
			condition.conditions.forEach((entry) => assertLowerableCondition(entry, eventId));
			return;
		case 'not':
			assertLowerableCondition(condition.condition, eventId);
			return;
		case 'graph-truthy':
			throw new Error(
				`Qwik event ${eventId} declares a conditional sync action whose guard reads graph state ${condition.graphNodeId}; Qwik sync$() QRLs cannot close over reactive state`,
			);
		case 'constant-truthy':
		case 'event-equals':
			return;
		default:
			throw new Error(
				`Qwik event ${eventId} synthesized sync$ body is not closed: unsupported guard condition ${JSON.stringify(
					(condition as { readonly type?: unknown }).type ?? null,
				)}`,
			);
	}
}

/**
 * DECISION SITE - docs/emitter-idiom-policy.md, ruling "Qwik - a declared
 * `SyncPolicy` is split into a leading `sync$()` QRL and the handler is emitted
 * as a QRL array" (goal frameless-defects-and-targets-v1, T015 ruling 4 / T003
 * for the unconditional case, T011 §3.1 for the conditional one).
 *
 * An ordinary Qwik event handler is a lazily fetched QRL: by the time its
 * segment arrives the browser has already performed the default action. T002
 * witnessed this behaviourally - clicking a `type="submit"` button whose handler
 * body is nothing but `event.preventDefault()` still issued the form's GET, the
 * segment arriving ~58ms after dispatch. That handler is fully SYNCHRONOUS: the
 * cause is QRL laziness, not `async`, which is why neither this lowering nor the
 * gate policy guarding it looks at `async`.
 *
 * A `sync$()` QRL is different: it is serialized inline into the HTML
 * (`qrlToString` gives it an empty chunk and an index into the container's
 * `qFuncs` table) and the loader resolves it without a network round trip, so it
 * runs during dispatch. Cancellation therefore goes in a leading `sync$()` and
 * the rest of the body stays in the ordinary QRL behind it.
 *
 * HARD CONSTRAINT: a `sync$()` body cannot close over anything - no signals, no
 * stores, no module scope (@qwik.dev/core core.mjs:15905, enforced in dev by
 * round-tripping the function through `new Function`). This emitter satisfies
 * that BY CONSTRUCTION rather than by analysis: the guard is SYNTHESIZED from
 * the declared condition tree (`conditionExpression`), which after
 * `assertLowerableCondition` can only produce event-field reads and JSON
 * literals. `assertClosedSyncBody` then re-proves the result, so a future
 * condition type cannot slip a binding in unnoticed.
 *
 * The trigger is the IR's declared `SyncPolicy`, never the handler's contents
 * (emitter-idiom-policy Gate 3). What this function refuses, per T011 §5:
 *
 * - V1 a guard containing `graph-truthy` (`assertLowerableCondition`);
 * - V2 the `branches` form - one QRL array per event prop, so a policy naming
 *   several handler functions has nowhere to go;
 * - V3 a statically false `constant-truthy` guard. Deleting the authored call
 *   would be equivalent only if the constant fold is right and would silently
 *   disable a real cancellation if it is wrong, so this refuses instead. Never
 *   weaken the gate to accommodate a degenerate input.
 *
 * V4 (a declared action the handler body does not spell) lives in
 * `normalizeHandler`, which is where the body is in hand.
 */
function syncActionPlan(event: EnrichedEventRecord): SyncActionPlan | null {
	const policy = event.syncPolicy;
	if (!policy) return null;
	if ('branches' in policy)
		throw new Error(
			`Qwik event ${event.id} declares a multi-handler sync policy; Qwik emits one QRL array per event prop`,
		);
	// A branch declaring no action declares nothing for Qwik to hoist; the
	// handler is emitted exactly as it would be with no policy at all.
	if (!policy.actions.length) return null;
	if (policy.when.type === 'constant-truthy' && !policy.when.value)
		throw new Error(
			`Qwik event ${event.id} declares a sync action guarded by a statically false condition`,
		);
	assertLowerableCondition(policy.when, event.id);
	return {
		guard: policy.when.type === 'constant-truthy' ? null : policy.when,
		actions: policy.actions as readonly SyncAction[],
	};
}

function jsonExpression(value: JsonValue): Expression {
	if (value === null || typeof value !== 'object') return literal(value);
	if (Array.isArray(value))
		return { type: 'ArrayExpression', elements: value.map(jsonExpression) };
	return {
		type: 'ObjectExpression',
		properties: Object.entries(value).map(([key, entry]) => ({
			type: 'Property',
			kind: 'init',
			method: false,
			shorthand: false,
			computed: false,
			key: literal(key),
			value: jsonExpression(entry),
		})),
	};
}

/**
 * Synthesize the `sync$()` guard from the declared condition tree. NEVER lifted
 * from authored source: a tree that survived `assertLowerableCondition` can only
 * yield reads of the event parameter and JSON literals, which is what makes
 * closure freedom a property of this generator rather than a conclusion of an
 * analysis (T011 §1.2).
 *
 * `event-equals` emits `===` even where the author wrote `==`: the IR, not the
 * source text, is the contract, and Markless's own evaluator compares strictly.
 */
function conditionExpression(
	condition: SyncPolicyCondition,
	eventParameter: string,
	eventId: string,
): Expression {
	switch (condition.type) {
		case 'and':
		case 'or': {
			const operator = condition.type === 'and' ? '&&' : '||';
			if (!condition.conditions.length) return literal(condition.type === 'and');
			return condition.conditions
				.map((entry) => conditionExpression(entry, eventParameter, eventId))
				.reduce((left, right) => ({
					type: 'LogicalExpression',
					operator,
					left,
					right,
				}));
		}
		case 'not':
			return {
				type: 'UnaryExpression',
				operator: '!',
				prefix: true,
				argument: conditionExpression(condition.condition, eventParameter, eventId),
			};
		case 'constant-truthy':
			return literal(Boolean(condition.value));
		case 'event-equals':
			return {
				type: 'BinaryExpression',
				operator: '===',
				left: SYNTHESIZABLE_IDENTIFIER.test(condition.field)
					? member(identifier(eventParameter), condition.field)
					: {
							type: 'MemberExpression',
							object: identifier(eventParameter),
							property: literal(condition.field),
							computed: true,
							optional: false,
						},
				right: jsonExpression(condition.value),
			};
		default:
			throw new Error(
				`Qwik event ${eventId} synthesized sync$ body is not closed: unsupported guard condition ${JSON.stringify(
					(condition as { readonly type?: unknown }).type ?? null,
				)}`,
			);
	}
}

/**
 * V5 - the emitter asserting its own precondition (T007 rule 2). §1.2 of the
 * T011 ruling proves this cannot fire for any condition Markless can currently
 * produce; it exists for the day the IR grows a condition type that can, which
 * is the failure mode `unknown-template-node.test.ts` exists for.
 */
function assertClosedSyncBody(node: Node, eventParameter: string, eventId: string): void {
	const visit = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		const record = value as Node;
		if (record.type === 'Identifier') {
			if (record.name !== eventParameter)
				throw new Error(
					`Qwik event ${eventId} synthesized sync$ body is not closed: it references ${record.name}`,
				);
			return;
		}
		if (record.type === 'MemberExpression') {
			visit(record.object);
			if (record.computed) visit(record.property);
			return;
		}
		if (record.type === 'Property') {
			if (record.computed) visit(record.key);
			visit(record.value);
			return;
		}
		for (const child of Object.values(record)) visit(child);
	};
	visit(node);
}

function syncActionStatement(
	statement: Statement,
	eventParameter: string,
	actions: readonly SyncAction[],
): SyncAction | null {
	if (statement.type !== 'ExpressionStatement') return null;
	const candidate = statement.expression;
	if (candidate?.type !== 'CallExpression' || candidate.arguments?.length !== 0) return null;
	const callee = candidate.callee;
	if (
		callee?.type !== 'MemberExpression' ||
		callee.computed ||
		callee.object?.type !== 'Identifier' ||
		callee.object.name !== eventParameter ||
		callee.property?.type !== 'Identifier'
	)
		return null;
	const name = callee.property.name as SyncAction;
	return actions.includes(name) ? name : null;
}

/**
 * Remove the authored action calls the leading `sync$()` QRL now performs. The
 * synthesized guard re-evaluates the condition, so the lazy remainder keeps the
 * authored `if` minus those calls - sound precisely because the condition is
 * pure over event fields. Collapse rules from T003 carry over: an `if` whose
 * consequent empties out is dropped entirely, and an empty body becomes a
 * one-element QRL array.
 */
function stripSyncActions(
	statements: readonly Statement[],
	eventParameter: string,
	actions: readonly SyncAction[],
	removed: Set<SyncAction>,
): Statement[] {
	const stripBranch = (statement: Statement): Statement | null => {
		if (statement.type === 'BlockStatement') {
			const body = stripSyncActions(statement.body, eventParameter, actions, removed);
			return body.length ? { ...statement, body } : null;
		}
		const [only] = stripSyncActions([statement], eventParameter, actions, removed);
		return only ?? null;
	};
	const result: Statement[] = [];
	for (const statement of statements) {
		const action = syncActionStatement(statement, eventParameter, actions);
		if (action) {
			removed.add(action);
			continue;
		}
		if (statement.type === 'BlockStatement') {
			const body = stripSyncActions(statement.body, eventParameter, actions, removed);
			if (body.length) result.push({ ...statement, body });
			continue;
		}
		if (statement.type === 'IfStatement') {
			const consequent = stripBranch(statement.consequent);
			const alternate = statement.alternate ? stripBranch(statement.alternate) : null;
			if (!consequent && !alternate) continue;
			result.push({ ...statement, consequent: consequent ?? block([]), alternate });
			continue;
		}
		result.push(statement);
	}
	return result;
}

function containsCurrentTarget(value: unknown, eventName: string): boolean {
	let found = false;
	walk(value, (record) => {
		if (
			record.type === 'MemberExpression' &&
			!record.computed &&
			record.object?.type === 'Identifier' &&
			record.object.name === eventName &&
			record.property?.type === 'Identifier' &&
			record.property.name === 'currentTarget'
		)
			found = true;
	});
	return found;
}

type NormalizedHandler = {
	/** The lazy QRL body, with any hoisted cancellation already removed. */
	readonly handler: Expression;
	/** True once the hoisted cancellation was the whole body. */
	readonly empty: boolean;
	/** The authored event parameter name, reused by the sync$() QRL. */
	readonly eventParameter: string;
};

function normalizeHandler(
	event: EnrichedEventRecord,
	handler: EnrichedEventRecord['handlers'][number],
	context: EmitContext,
	plan: SyncActionPlan | null,
): NormalizedHandler {
	const converted = expression(handler.expression);
	if (converted.type !== 'ArrowFunctionExpression')
		throw new Error(`Event handler ${event.id} is not an arrow function`);
	const authoredBody =
		converted.body.type === 'BlockStatement'
			? converted.body.body
			: [expressionStatement(converted.body)];
	const firstParameter = converted.params[0];
	let eventElement:
		| { readonly element: string; readonly event: string }
		| undefined;
	const params = structuredClone(converted.params);
	if (firstParameter) {
		if (firstParameter.type !== 'Identifier')
			throw new Error(`Qwik event ${event.id} requires an identifier event parameter`);
		const secondParameter = converted.params[1];
		if (secondParameter && secondParameter.type !== 'Identifier')
			throw new Error(`Qwik event ${event.id} requires an identifier element parameter`);
		const needsElement =
			Boolean(secondParameter) ||
			containsCurrentTarget(converted.body, firstParameter.name);
		if (needsElement) {
			const used = new Set<string>();
			walk(converted, (record) => {
				if (record.type === 'Identifier') used.add(record.name);
			});
			let elementName = secondParameter?.name ?? 'element';
			for (let suffix = 2; !secondParameter && used.has(elementName); suffix += 1)
				elementName = `element${suffix}`;
			if (!secondParameter) params.push(identifier(elementName));
			eventElement = { event: firstParameter.name, element: elementName };
		}
	}
	// The leading sync$() QRL emitted alongside this handler is what actually
	// performs the declared actions, so the authored calls are removed from the
	// lazy QRL body rather than left to run too late.
	//
	// V4, fail closed and now widened to BOTH actions and to guarded positions:
	// if the IR declares an action this emitter cannot locate, the split would
	// silently drop it - refuse to emit instead.
	if (plan && firstParameter?.type !== 'Identifier')
		throw new Error(
			`Qwik event ${event.id} declares a sync action but its handler has no identifier event parameter`,
		);
	const removed = new Set<SyncAction>();
	const body =
		plan && firstParameter?.type === 'Identifier'
			? stripSyncActions(authoredBody, firstParameter.name, plan.actions, removed)
			: authoredBody;
	for (const action of plan?.actions ?? [])
		if (!removed.has(action))
			throw new Error(
				`Qwik event ${event.id} declares the sync action ${action} its handler body does not spell as a ${firstParameter?.type === 'Identifier' ? firstParameter.name : 'event'}.${action}() call`,
			);
	// The converse of V4, and NOT in the T011 ruling - it is here because T012
	// measured the hole while pinning the condition vocabulary.
	//
	// MEASURED: `if (k) { event.preventDefault(); } else { event.stopPropagation(); }`
	// compiles cleanly, and Markless extracts ONLY the consequent's action into
	// the SyncPolicy. The else-branch call is therefore an ordinary statement to
	// this emitter, and before this check it was emitted into the lazily fetched
	// remainder - where a stopPropagation runs after bubbling has finished. That
	// is defect 1's exact failure mode, arriving through a door V4 does not
	// watch. The gate catches the emitted shape; this refuses to produce it.
	//
	// SCOPED TO `plan` DELIBERATELY. With no declared policy at all, this emitter
	// still emits the authored call into the lazy QRL, and the GATE is what
	// rejects that. Two reasons, not one: an action with no policy is
	// unreachable from authored source (Markless refuses a guard it cannot
	// extract with MARKLESS_SYNC_POLICY_UNEXTRACTABLE rather than dropping the
	// policy), and the green-vacuum guards in test/gate.test.ts RECONSTRUCT
	// unfixed main's output by deleting syncPolicy from a real IR. Refusing that
	// input would destroy the only mechanism this package has for proving its
	// released expectations are not vacuous.
	if (plan && firstParameter?.type === 'Identifier')
		for (const action of ['preventDefault', 'stopPropagation'] as const) {
			let stranded = false;
			walk(body, (record) => {
				if (
					record.type === 'CallExpression' &&
					record.callee?.type === 'MemberExpression' &&
					!record.callee.computed &&
					record.callee.object?.type === 'Identifier' &&
					record.callee.object.name === firstParameter.name &&
					record.callee.property?.type === 'Identifier' &&
					record.callee.property.name === action
				)
					stranded = true;
			});
			if (stranded)
				throw new Error(
					`Qwik event ${event.id} calls ${firstParameter.name}.${action}() at a position its SyncPolicy does not declare; a lazily fetched QRL runs after the browser has already acted`,
				);
		}
	const lowerStatement = (
		statement: Statement,
	): { readonly sawCallback: boolean; readonly statement: Statement } => {
		const calls = callbackCalls(statement, context.callbackProps);
		if (!calls.length)
			return {
				sawCallback: false,
				statement: rewriteExpression(
					statement,
					context,
					context.lexicalNames,
					eventElement,
				),
			};
		if (
			statement.type === 'ExpressionStatement' &&
			statement.expression.type === 'CallExpression' &&
			calls.length === 1 &&
			callbackName(statement.expression.callee, context)
		)
			return {
				sawCallback: true,
				statement: expressionStatement(
					{
						type: 'AwaitExpression',
						argument: rewriteExpression(
							statement.expression,
							context,
							context.lexicalNames,
							eventElement,
						),
					},
				),
			};
		if (statement.type === 'BlockStatement') {
			const lowered = lowerBlock(statement.body);
			return { sawCallback: lowered.sawCallback, statement: block(lowered.statements) };
		}
		if (statement.type === 'IfStatement') {
			if (callbackCalls(statement.test, context.callbackProps).length)
				throw new Error(
					`Qwik v1 rejects control flow that depends on a callback return value in ${event.id}`,
				);
			const consequent = lowerStatement(statement.consequent);
			const alternate = statement.alternate ? lowerStatement(statement.alternate) : null;
			return {
				sawCallback: consequent.sawCallback || Boolean(alternate?.sawCallback),
				statement: {
					...rewriteExpression(
						{ ...statement, consequent: block([]), alternate: null },
						context,
						context.lexicalNames,
						eventElement,
					),
					consequent: consequent.statement,
					alternate: alternate?.statement ?? null,
				},
			};
		}
		throw new Error(
			`Qwik v1 callbacks must be observational expression statements in ${event.id}`,
		);
	};
	const lowerBlock = (
		statements: Statement[],
	): { readonly sawCallback: boolean; readonly statements: Statement[] } => {
		const lowered = statements.map(lowerStatement);
		for (let index = 0; index < lowered.length; index += 1) {
			if (
				lowered[index]!.sawCallback &&
				lowered
					.slice(index + 1)
					.some((later) => !later.sawCallback)
			)
				throw new Error(
					`Qwik v1 rejects synchronous actions after an awaited callback in ${event.id}`,
				);
		}
		return {
			sawCallback: lowered.some((entry) => entry.sawCallback),
			statements: lowered.map((entry) => entry.statement),
		};
	};
	const lowered = lowerBlock(body);
	// Removing the authored action calls can leave a parameter with no remaining
	// reference; an unused parameter is an eslint `no-unused-vars` violation in
	// the gate. Only trailing parameters are dropped, and only when a statement
	// was actually removed, so every other handler is byte-identical.
	while (
		plan &&
		params.length &&
		!containsIdentifier(lowered.statements, params[params.length - 1]!.name)
	)
		params.pop();
	return {
		handler: arrow(params, block(lowered.statements), {
			async: lowered.sawCallback || converted.async,
			expression: false,
		}),
		empty: lowered.statements.length === 0,
		eventParameter: firstParameter?.type === 'Identifier' ? firstParameter.name : 'event',
	};
}

function emitEvent(event: EnrichedEventRecord, context: EmitContext): Expression {
	if (event.handlers.length !== 1)
		throw new Error(`Qwik emitter does not support multiple handlers for ${event.id}`);
	const plan = syncActionPlan(event);
	const normalized = normalizeHandler(event, event.handlers[0]!, context, plan);
	// No declared sync action - T004 ruling 1 applies unchanged: $-suffixed JSX
	// event props take the raw handler; the optimizer wraps it.
	if (!plan) return normalized.handler;
	// Declared sync actions, per the decision site above: a leading sync$() QRL
	// that runs during dispatch, then the lazy remainder. Qwik accepts an array
	// of QRLs for one event prop and runs them in order.
	//
	// MEASURED against @qwik.dev/core 2.0.0-beta.38 by T012 step 1, on the
	// official `pnpm create qwik` pipeline: a GUARDED body survives the
	// optimizer intact. `sync$(fn)` becomes `_qrlSync(fn, "<source>")`, the prop
	// serializes as `q-e:keydown="#0|<chunk>#_run#1"`, and index 0 of the
	// container's qFuncs table is the guard verbatim -
	// `event=>{if(event.key==="Enter"){event.preventDefault();}}`. Two-sided
	// behavioural check on the same build: Enter into a form guarded by
	// `key === 'Enter'` did not navigate; the same key into one guarded by
	// `key === 'Escape'` did.
	context.imports.add('sync$');
	const actionCalls = plan.actions.map((action) =>
		expressionStatement(call(member(identifier(normalized.eventParameter), action), [])),
	);
	const syncBody = block(
		plan.guard
			? [
					{
						type: 'IfStatement',
						test: conditionExpression(
							plan.guard,
							normalized.eventParameter,
							event.id,
						),
						consequent: block(actionCalls),
						alternate: null,
					},
				]
			: actionCalls,
	);
	assertClosedSyncBody(syncBody, normalized.eventParameter, event.id);
	const cancel = call(identifier('sync$'), [
		arrow([identifier(normalized.eventParameter)], syncBody, {
			async: false,
			expression: false,
		}),
	]);
	// A one-element array rather than a bare sync$() when nothing is left: one
	// shape for the whole lowering, so the array is what "an event with declared
	// cancellation" always looks like in emitted output.
	if (normalized.empty) return { type: 'ArrayExpression', elements: [cancel] };
	// The remainder MUST be wrapped in $() here. Ruling 1's raw-handler form
	// applies to the handler expression given directly to the prop; MEASURED
	// against @qwik.dev/core 2.0.0-beta.38, the optimizer does not extract array
	// ELEMENTS. A raw arrow inside the array stays an inline closure, never
	// becomes a QRL, and is silently dropped from `q-e:click` during
	// serialization - the emitted button loses its handler entirely. With $() the
	// element becomes a real segment and serializes as `#0|<chunk>#_run#<ref>`.
	context.imports.add('$');
	return {
		type: 'ArrayExpression',
		elements: [cancel, call(identifier('$'), [normalized.handler])],
	};
}

function templateNode(node: TemplateNode, context: EmitContext): RenderedNode {
	if (node.kind === 'text') return { type: 'JSXText', value: node.value, raw: node.value };
	if (node.kind === 'dynamic-text')
		return {
			type: 'JSXExpressionContainer',
			expression: rewriteExpression(expression(node.expression), context),
		};
	if (node.kind === 'fragment')
		return {
			type: 'JSXFragment',
			openingFragment: { type: 'JSXOpeningFragment' },
			closingFragment: { type: 'JSXClosingFragment' },
			children: node.children.map((child) => templateNode(child, context)),
		};
	if (node.kind === 'branch')
		return { type: 'JSXExpressionContainer', expression: branchExpression(node, context) };
	if (node.kind === 'keyed-repeat')
		return {
			type: 'JSXExpressionContainer',
			expression: keyedRepeatExpression(node, context),
		};
	const attributes = node.staticAttributes.map((attribute) =>
		jsxAttribute(attribute.name, attribute.value),
	);
	for (const binding of node.dynamicBindings)
		attributes.push(
			jsxAttribute(
				binding.name,
				rewriteExpression(expression(binding.expression), context),
			),
		);
	// STEP 3, REFS. Qwik's `ref` prop accepts a `Signal<Element | undefined>` OR a
	// `(el) => void` callback; both are sanctioned at 2.0.0-beta.38 and both have
	// been there for the whole v2 line, so the tie breaks on obligations: the signal
	// form reuses `useSignal`, which this emitter already imports and already
	// respells through `.value`, while the callback form would need a QRL boundary
	// the optimizer has to serialize. See notes/T005-refs.md.
	const handleName = context.handleHosts.get(node.id);
	if (handleName !== undefined) attributes.push(jsxAttribute('ref', identifier(handleName)));
	for (const eventId of node.eventIds) {
		const event = context.eventsById.get(eventId);
		if (!event) throw new Error(`Unknown event record: ${eventId}`);
		attributes.push(jsxAttribute(eventAttributeName(event.eventName), emitEvent(event, context)));
	}
	const name = { type: 'JSXIdentifier', name: node.tag };
	const children = node.children.map((child) => templateNode(child, context));
	const selfClosing = children.length === 0;
	return {
		type: 'JSXElement',
		openingElement: {
			type: 'JSXOpeningElement',
			name,
			attributes,
			selfClosing,
		},
		closingElement: selfClosing
			? null
			: { type: 'JSXClosingElement', name: structuredClone(name) },
		children,
		selfClosing,
	};
}

function callbackProps(ir: EnrichedIR, component: EnrichedComponent): Set<string> {
	const propNames = new Set(component.props.entries.map((entry) => entry.localName));
	const callbacks = new Set<string>();
	walk(
		{
			locals: component.locals,
			events: ir.records.events.filter((event) => event.componentId === component.id),
		},
		(record) => {
			if (
				record.type === 'CallExpression' &&
				record.callee?.type === 'Identifier' &&
				propNames.has(record.callee.name)
			)
				callbacks.add(record.callee.name);
		},
	);
	return callbacks;
}

function collectionInitializerKind(
	initializer: SerializableAstNode | null | undefined,
): 'array' | 'object' | null {
	if (!initializer || typeof initializer !== 'object' || Array.isArray(initializer))
		return null;
	const node = initializer as Node;
	if (node.type === 'ArrayExpression') return 'array';
	if (node.type === 'ObjectExpression') return 'object';
	if (
		node.type === 'CallExpression' &&
		node.callee?.type === 'MemberExpression' &&
		!node.callee.computed &&
		node.callee.property?.type === 'Identifier' &&
		['concat', 'filter', 'map', 'slice'].includes(node.callee.property.name)
	)
		return 'array';
	return null;
}

/**
 * The `hostNodeId -> ref target` map, plus every fail-closed check that has to
 * hold before one byte of `ref={}` is printed.
 *
 * `handleCalls` IS AN ASSERTION HERE, NOT A LOWERING. `rewriteExpression` already
 * turns `input?.focus()` into `input.value?.focus()` from the name set alone, so
 * this emitter never builds the call - and a `HandleCallRecord` the handler does
 * NOT spell would be dropped in silence, leaving a module that compiles, resumes,
 * and quietly does not do the declared thing. Same shape as `syncActionPlan`.
 *
 * A call with NO `eventId` is REFUSED: `ref` writes the signal during render, and
 * the component body runs before that. Its repair is `useVisibleTask$` - a Step 4
 * lifecycle construct.
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
		if (!SYNTHESIZABLE_IDENTIFIER.test(binding.handleName))
			throw new Error(
				`Qwik emitter cannot bind an element handle named ${JSON.stringify(binding.handleName)}`,
			);
		if (handleHosts.has(binding.hostNodeId))
			throw new Error(
				`Qwik emitter cannot bind two element handles to one host: ${binding.hostNodeId}`,
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
				`Qwik element handle ${name} names a host this component does not render: ${hostNodeId}`,
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
				`Qwik emitter has no lowering for a handle call outside an event handler (${name}.${call.method}): ref writes the signal during render, and the component body runs first`,
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
				`Qwik event ${call.eventId} declares a handle call ${name}.${call.method}() its handler AST does not spell`,
			);
	}
	return handleHosts;
}

function componentDeclaration(
	ir: EnrichedIR,
	component: EnrichedComponent,
): { readonly declaration: Statement; readonly imports: ReadonlySet<QwikApi> } {
	const componentBindings = ir.records.bindings.filter(
		(binding) => binding.componentId === component.id,
	);
	const states = componentBindings.filter(
		(binding): binding is StateBinding => binding.kind === 'state',
	);
	const storeKinds = new Map(
		states.flatMap((state) => {
			const kind = collectionInitializerKind(state.initializer);
			return kind ? [[state.name, kind] as const] : [];
		}),
	);
	const callbacks = callbackProps(ir, component);
	const onceSignals = new Set<string>();
	for (const local of component.locals) {
		if (
			local.semanticRecordIds.length === 0 &&
			local.names.some((name) => identifierIsUsed(ir, component, name))
		)
			local.names.forEach((name) => onceSignals.add(name));
	}
	const imports = new Set<QwikApi>(['component$']);
	const handleHosts = elementHandleHosts(ir, component);
	const context: EmitContext = {
		elementHandleNames: new Set(handleHosts.values()),
		handleHosts,
		arrayStoreStateNames: new Set(
			[...storeKinds].filter(([, kind]) => kind === 'array').map(([name]) => name),
		),
		callbackProps: callbacks,
		component,
		computedByName: new Map(
			componentBindings
				.filter((binding) => binding.kind === 'computed')
				.map((binding) => [binding.name, binding]),
		),
		eventsById: new Map(
			ir.records.events
				.filter((event) => event.componentId === component.id)
				.map((event) => [event.id, event]),
		),
		imports,
		lexicalNames: new Set(),
		propsByLocal: new Map(component.props.entries.map((entry) => [entry.localName, entry])),
		propsName: 'props',
		storeStateNames: new Set(storeKinds.keys()),
		statesByName: new Map(states.map((state) => [state.name, state])),
		onceSignals,
	};
	const body: Statement[] = [];
	const bindingById = new Map(componentBindings.map((binding) => [binding.id, binding]));
	for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
		const semantic = local.semanticRecordIds
			.map((id) => bindingById.get(id))
			.filter((binding): binding is EnrichedGraphBinding => Boolean(binding));
		const handle = semantic.find((binding) => binding.kind === 'element');
		if (handle) {
			if (semantic.length > 1)
				throw new Error(
					`Qwik element handle has unsupported multi-semantic shape: ${local.names.join(',')}`,
				);
			// THE AUTHORED `element<T>()` CALL IS NOT EMITTED. `useSignal()` with no
			// argument is the Qwik declaration a `ref={}` writes into, and reads of it
			// are respelled `.value` by `rewriteExpression` above.
			//
			// THE TYPE ARGUMENT IS NOT DECORATION - MEASURED, IT IS THE DIFFERENCE
			// BETWEEN VALID AND INVALID OUTPUT. `useSignal()` bare is `Signal<unknown>`
			// (`UseSignal` in `@qwik.dev/core` 2.0.0-beta.38 `dist/core-internal.d.ts`
			// :4884-4887), and the `ref` prop is
			// `Ref<EL> = Signal<Element | undefined> | RefFnInterface<EL>` (:2971), so the
			// bare form is a hard TS2322 at the prop AND a TS2339 at every `.value`
			// read - at `strict` and at `strict: false` alike, because assignability is
			// not a strictness setting. The lane's own `emitted-typecheck` row watches
			// both go away.
			//
			// `HTMLElement` and NOT the authored `element<HTMLInputElement>()` narrowing:
			// `ElementHandleBinding` carries `id`, `handleName`, `componentId` and
			// `hostNodeId` and NO element type, so there is no declared channel to read
			// one from - the authored type argument survives only on the local's
			// initializer, which this branch discards. Widening from a discarded AST is
			// the same move T002 struck from Step 1 for `ComponentPropExpression.type`.
			// `HTMLElement` is chosen because the signal arm of `Ref` is
			// `Signal<Element | undefined>` REGARDLESS of `EL`, so one fixed bound is
			// total over every host tag - and it is the narrowest bound carrying the DOM
			// methods a handle call reaches. A call to a method that is NOT on
			// `HTMLElement` would be type-invalid here; the corpus has no instance, and
			// the repair is an element type on the IR record, not a wider guess.
			imports.add('useSignal');
			body.push(
				variable(handle.name, {
					...call(identifier('useSignal'), []),
					// `typeArguments`, NOT `typeParameters`. MEASURED at yuku-codegen
					// 0.7.0: the same node under `typeParameters` prints
					// `const input = useSignal();` with `errors: []` - the type argument is
					// dropped in total silence, which is the identical hazard the Angular
					// lane's `typeNode` converter was built against.
					typeArguments: {
						type: 'TSTypeParameterInstantiation',
						params: [
							{
								type: 'TSTypeReference',
								typeName: identifier('HTMLElement'),
							},
						],
					},
				}),
			);
			continue;
		}
		if (semantic.length > 1)
			throw new Error(
				`Qwik local has unsupported multi-semantic shape: ${local.names.join(',')}`,
			);
		const state = semantic.find((binding) => binding.kind === 'state') as
			| StateBinding
			| undefined;
		const computed = semantic.find((binding) => binding.kind === 'computed');
		if (state) {
			const storeKind = storeKinds.get(state.name);
			imports.add(storeKind ? 'useStore' : 'useSignal');
			body.push(
				variable(
					state.name,
					call(identifier(storeKind ? 'useStore' : 'useSignal'), [
						rewriteExpression(expression(state.initializer), context),
					]),
				),
			);
			continue;
		}
		if (computed) {
			if (!computed.computed)
				throw new Error(`Computed binding ${computed.id} has no expression`);
			const computedExpression = expression(computed.computed.expression);
			if (
				computedExpression.type !== 'ArrowFunctionExpression' ||
				computedExpression.params.length !== 0
			)
				throw new Error(`Computed binding ${computed.id} is not a zero-argument arrow`);
			if (callbackCalls(computedExpression, callbacks).length)
				throw new Error(`Qwik computed ${computed.name} cannot invoke a callback prop`);
			imports.add('useComputed$');
			body.push(
				variable(
					computed.name,
					call(identifier('useComputed$'), [
						arrow([], rewriteExpression(computedExpression.body, context)),
					]),
				),
			);
			continue;
		}
		if (!local.initializer)
			throw new Error(`Qwik local ${local.names.join(',')} has no initializer`);
		const used = local.names.some((name) => identifierIsUsed(ir, component, name));
		const calls = callbackCalls(local.initializer, callbacks);
		if (!used) {
			const initializer = expression(local.initializer);
			if (
				calls.length !== 1 ||
				initializer.type !== 'CallExpression' ||
				!callbackName(initializer.callee, context)
			)
				throw new Error(
					`Qwik render-once setup ${local.names.join(',')} must be one observational callback`,
				);
			imports.add('useTask$');
			body.push(
				expressionStatement(
					call(identifier('useTask$'), [
						arrow(
							[],
							block([
								expressionStatement(awaitCallbackCall(initializer, context)),
							]),
							{ async: true, expression: false },
						),
					]),
				),
			);
			continue;
		}
		if (calls.length)
			throw new Error(
				`Qwik v1 rejects ordinary locals that depend on callback return values: ${local.names.join(',')}`,
			);
		if (local.names.length !== 1 || local.pattern.type !== 'Identifier')
			throw new Error(`Qwik once-local requires one identifier: ${local.names.join(',')}`);
		imports.add('useSignal');
		body.push(
			variable(
				local.names[0]!,
				call(identifier('useSignal'), [
					arrow([], rewriteExpression(expression(local.initializer), context)),
				]),
			),
		);
	}
	for (const guard of component.guards) {
		let result: Expression;
		if (guard.whenTrue.kind === 'null') result = literal(null);
		else if (guard.whenTrue.kind === 'expression')
			result = rewriteExpression(expression(guard.whenTrue.value.expression), context);
		else result = expressionFromNodes(guard.whenTrue.children, context);
		body.push({
			type: 'IfStatement',
			test: rewriteExpression(expression(guard.test.expression), context),
			consequent: { type: 'ReturnStatement', argument: result },
			alternate: null,
		});
	}
	body.push({
		type: 'ReturnStatement',
		argument: expressionFromNodes(component.template, context),
	});
	const callback = arrow(
		component.props.entries.length ? [identifier(context.propsName)] : [],
		block(body),
		{ expression: false },
	);
	const declaration = {
		type: 'VariableDeclaration',
		kind: 'const',
		declarations: [
			{
				type: 'VariableDeclarator',
				id: identifier(component.name),
				init: call(identifier('component$'), [callback]),
			},
		],
	};
	return {
		declaration: {
			type: 'ExportNamedDeclaration',
			declaration,
			specifiers: [],
			source: null,
		},
		imports,
	};
}

function printProgram(program: Node): string {
	const result = generate(program as any, { comments: true, quotes: 'single' });
	if (result.errors.length)
		throw new Error(
			`yuku-codegen failed: ${result.errors.map((error) => error.message).join('; ')}`,
		);
	return result.code;
}

function printTopLevel(program: Node): string {
	const imports = program.body.filter((statement: Node) => statement.type === 'ImportDeclaration');
	const declarations = program.body.filter(
		(statement: Node) => statement.type !== 'ImportDeclaration',
	);
	return [
		...(imports.length ? [printProgram({ type: 'Program', sourceType: 'module', body: imports })] : []),
		...declarations.map((declaration: Node) =>
			printProgram({ type: 'Program', sourceType: 'module', body: [declaration] }),
		),
	].join('\n\n');
}

/** Emit the supported Qwik v2 structural surface from frameless-enriched-ir/2. */
export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	if (ir.records.persistence.length)
		throw new Error(
			'Qwik emitter does not support persistence-bearing IR; persistence-on-Qwik is deferred',
		);
	if (
		ir.components.length !== 1 ||
		ir.imports.length ||
		ir.records.sharedDefinitions.length ||
		ir.records.sharedInstances.length ||
		ir.records.sharedReads.length ||
		ir.records.sharedCalls.length ||
		ir.records.sharedWrites.length
	)
		throw new Error('Qwik emitter does not support composition or shared constructs');
	// `handleForwards` hands a child's node to a PARENT module, which needs the
	// composition path Step 5 owns. It stays refused by name.
	if (ir.records.handleForwards.length)
		throw new Error('Qwik emitter does not support forwarding a handle to a parent module');
	// STEP 4 OPENED `behaviors` IN THE SVELTE, VUE AND ANGULAR LANES AND
	// DELIBERATELY LEFT THIS ONE REFUSED. THE REFUSAL IS A MEASUREMENT, NOT AN
	// OMISSION, AND IT IS THE ONE FINDING OF THAT STEP WORTH READING TWICE.
	//
	// `attach=` obliges the emitter to run application code against a MOUNTED DOM
	// NODE. Measured at @qwik.dev/core 2.0.0-beta.38, the resolved build:
	//
	//   1. The `ref` prop - BOTH arms of `Ref<EL> = Signal<Element | undefined> |
	//      RefFnInterface<EL>` (`dist/core-internal.d.ts:2971`) - is applied by
	//      `applyRef` (`dist/core.mjs:4815`), which has exactly TWO call sites,
	//      `createNewElement` (`:4868`) and `patchProperty` (`:5035`). Both are in
	//      the CLIENT vnode diff. `dist/server.mjs` contains ZERO occurrences of
	//      `applyRef`. So for markup this container SERVER-RENDERED AND RESUMED -
	//      which is the only mode this lane ships - a `ref` callback never runs.
	//   2. `useTask$` runs before render and has no DOM on the server.
	//   3. The construct that DOES run against a mounted node is the visible-
	//      lifecycle family, and this lane BANS it in two places: `emit` throws on
	//      `useVisibleTask$`/`onQVisible$` a few lines below, and the gate policy
	//      `no-visible-task` (`src/gate/index.ts`) additionally bans `q-e:qvisible`
	//      and `on:qvisible` over emitted source. That ban is the lane's
	//      activation-neutrality doctrine - "it must do no client work merely
	//      because the element became visible" (`frameless-qwik-v1` T001) - and
	//      lowering `attach=` onto it would make EVERY behavior-bearing component
	//      eagerly wake its container, which is the property this whole target
	//      exists to demonstrate.
	//
	// `useOnDocument('DOMContentLoaded', ...)` would evade the marker regex and is
	// NOT a loophole this emitter walks through: it is the same eager client work
	// under a spelling the ban does not name.
	//
	// So Qwik has no `attach=` idiom inside its design envelope, and the owner's
	// standing rule is that a framework is not tested outside its envelope and that
	// output is not read as a defect. The construct is refused BY NAME, with the
	// reason, rather than lowered onto a form the lane already forbids.
	if (ir.records.behaviors.length)
		throw new Error(
			'Qwik emitter does not support element attach behaviors: the only Qwik construct that runs application code against a mounted node is the visible-lifecycle family, which this lane bans as eager client work, and the ref prop is applied only by the client vnode diff (never by dist/server.mjs) so it does not run for resumed markup',
		);
	const component = ir.components[0]!;
	const { declaration, imports } = componentDeclaration(ir, component);
	const orderedApis = [
		'$',
		'component$',
		'sync$',
		'useComputed$',
		'useSignal',
		'useStore',
		'useTask$',
	] as const;
	const importDeclaration = {
		type: 'ImportDeclaration',
		specifiers: orderedApis
			.filter((name) => imports.has(name))
			.map((name) => ({
				type: 'ImportSpecifier',
				imported: identifier(name),
				local: identifier(name),
			})),
		source: literal('@qwik.dev/core'),
	};
	const source = `// @generated by @frameless/qwik; do not edit.\n${printTopLevel({
		type: 'Program',
		sourceType: 'module',
		body: [importDeclaration, declaration],
	})}\n`;
	if (/\buseVisibleTask\$\b|\bonQVisible\$\b/.test(source))
		throw new Error('Qwik emission introduced a forbidden visible task');
	// `tsx`, NOT `jsx`, AND THE CHANGE IS A REPAIR THIS STEP FORCED RATHER THAN A
	// TIDY-UP. This artifact became `.tsx` at `frameless-emitter-capability-v1` T009
	// / T011 and `formatEmitted` moved with it; THIS verifier did not. MEASURED at
	// yuku-analyzer 0.7.0 on `const input = useSignal<HTMLElement>()` beside a JSX
	// element: `jsx` reports `Empty parentheses are only valid as arrow function
	// parameters` - it reads `<` as a comparison - `ts` reports `Expected '>' to
	// close a type assertion`, and only `tsx` reports zero. So the moment this lane
	// prints its first type argument, a `jsx` verifier rejects VALID output. The
	// eight goldens are byte-identical across the change, which is what makes it
	// safe to land here: they carry no type, so `jsx` and `tsx` agree on all of them.
	//
	// The same `lang: 'jsx'` sits on `.tsx` output in the react and solid emitters.
	// It is NOT wrong there yet - neither prints a type - and it is REPORTED rather
	// than changed, because moving a verifier those lanes' 73 standing `pnpm check`
	// errors are measured against is not this step's to do.
	const verified = analyze(source, { lang: 'tsx', sourceType: 'module', preserveParens: false });
	if (verified.diagnostics.length)
		throw new Error(
			`Emitted Qwik module failed output verification: ${verified.diagnostics.map((item) => item.message).join('; ')}`,
		);
	return source;
}
