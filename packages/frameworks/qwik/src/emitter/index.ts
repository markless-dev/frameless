import { analyze } from 'yuku-analyzer';
import { generate } from 'yuku-codegen';
import {
	ENRICHED_IR_VERSION,
	type EnrichedComponent,
	type EnrichedEventRecord,
	type EnrichedGraphBinding,
	type EnrichedIR,
	type SerializableAstNode,
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

function walk(value: unknown, visit: (record: Record<string, any>) => void): void {
	if (!value || typeof value !== 'object') return;
	visit(value as Record<string, any>);
	for (const child of Object.values(value)) {
		if (Array.isArray(child)) child.forEach((entry) => walk(entry, visit));
		else walk(child, visit);
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
			if (context.statesByName.has(node.name) || context.onceSignals.has(node.name))
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

/**
 * DECISION SITE - docs/emitter-idiom-policy.md, ruling "Qwik - unconditional
 * `preventDefault()` is split into a leading `sync$()` QRL and the handler is
 * emitted as a QRL array" (goal frameless-defects-and-targets-v1, T015 ruling 4
 * / T003, all six gates PASS).
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
 * stores, no module scope. Only the unconditional case is lowered here, and its
 * emitted body is exactly `<param>.preventDefault()`, which captures nothing.
 *
 * The trigger is the IR's declared `SyncPolicy`, never the handler's contents
 * (emitter-idiom-policy Gate 3). Only an unconditional branch qualifies: a
 * single branch, guarded by `constant-truthy` with a truthy value, whose actions
 * include `preventDefault`. Everything else - a `branches` list, a
 * `graph-truthy` or `event-equals` guard - is CONDITIONAL cancellation, whose
 * `sync$()` body would need to read state and which is deliberately out of scope
 * here (T011/T012 own that design).
 */
function hoistsPreventDefault(event: EnrichedEventRecord): boolean {
	const policy = event.syncPolicy;
	if (!policy || 'branches' in policy) return false;
	if (!policy.actions.includes('preventDefault')) return false;
	return policy.when.type === 'constant-truthy' && Boolean(policy.when.value);
}

function isPreventDefaultStatement(statement: Statement, eventParameter: string): boolean {
	if (statement.type !== 'ExpressionStatement') return false;
	const candidate = statement.expression;
	return (
		candidate?.type === 'CallExpression' &&
		candidate.arguments?.length === 0 &&
		candidate.callee?.type === 'MemberExpression' &&
		!candidate.callee.computed &&
		candidate.callee.object?.type === 'Identifier' &&
		candidate.callee.object.name === eventParameter &&
		candidate.callee.property?.type === 'Identifier' &&
		candidate.callee.property.name === 'preventDefault'
	);
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
	// cancels the default action, so the authored call is removed from the lazy
	// QRL body rather than left to run too late. Fail closed: if the IR declares
	// an unconditional preventDefault this emitter cannot locate, the split would
	// silently drop a declared action - refuse to emit instead.
	const hoisted = hoistsPreventDefault(event);
	const body = hoisted
		? authoredBody.filter(
				(statement: Statement) =>
					!(
						firstParameter?.type === 'Identifier' &&
						isPreventDefaultStatement(statement, firstParameter.name)
					),
			)
		: authoredBody;
	if (hoisted && body.length === authoredBody.length)
		throw new Error(
			`Qwik event ${event.id} declares an unconditional preventDefault its handler body does not spell as a top-level ${firstParameter?.type === 'Identifier' ? firstParameter.name : 'event'}.preventDefault() call`,
		);
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
	// Removing the authored preventDefault() can leave a parameter with no
	// remaining reference; an unused parameter is an eslint `no-unused-vars`
	// violation in the gate. Only trailing parameters are dropped, and only when
	// a statement was actually removed, so every other handler is byte-identical.
	while (
		hoisted &&
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
	const normalized = normalizeHandler(event, event.handlers[0]!, context);
	// No declared cancellation - T004 ruling 1 applies unchanged: $-suffixed JSX
	// event props take the raw handler; the optimizer wraps it.
	if (!hoistsPreventDefault(event)) return normalized.handler;
	// Unconditional cancellation, per the decision site above: a leading sync$()
	// QRL that runs during dispatch, then the lazy remainder. Qwik accepts an
	// array of QRLs for one event prop and runs them in order.
	context.imports.add('sync$');
	const cancel = call(identifier('sync$'), [
		arrow(
			[identifier(normalized.eventParameter)],
			block([
				expressionStatement(
					call(member(identifier(normalized.eventParameter), 'preventDefault'), []),
				),
			]),
			{ async: false, expression: false },
		),
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
	const context: EmitContext = {
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
		ir.records.sharedWrites.length ||
		ir.records.elementHandleBindings.length ||
		ir.records.handleForwards.length ||
		ir.records.behaviors.length ||
		ir.records.handleCalls.length
	)
		throw new Error('Qwik emitter does not support composition or shared/handle constructs');
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
	const verified = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	if (verified.diagnostics.length)
		throw new Error(
			`Emitted Qwik module failed output verification: ${verified.diagnostics.map((item) => item.message).join('; ')}`,
		);
	return source;
}
