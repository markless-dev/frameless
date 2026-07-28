import { compile } from 'svelte/compiler';
import {
	ENRICHED_IR_VERSION,
	type EnrichedComponent,
	type EnrichedEventRecord,
	type EnrichedGraphBinding,
	type EnrichedIR,
	type StaticAttribute,
	type SyncPolicy,
	type TemplateNode,
} from '@frameless/compiler';
import {
	arrow,
	call,
	containsIdentifierFrom,
	type Expression,
	expression,
	expressionStatement,
	identifier,
	indentContinuation,
	type Node,
	printExpression,
	printStatements,
	type Statement,
	variable,
	walk,
} from './estree.ts';

type StateBinding = EnrichedGraphBinding & { readonly kind: 'state' };

type EmitContext = {
	readonly component: EnrichedComponent;
	readonly eventsById: ReadonlyMap<string, EnrichedEventRecord>;
	/**
	 * Names Svelte treats as reactive at component top level - `$props()`
	 * destructurings, `$state` locals and `$derived` locals. Reading one of
	 * these outside a closure is what raises `state_referenced_locally`.
	 */
	readonly reactiveNames: Set<string>;
	readonly usedApis: Set<SvelteApi>;
	/** Elements that received a sanctioned `svelte-ignore`, by warning code. */
	readonly suppressed: Set<string>;
};

type SvelteApi = 'untrack';

/**
 * Void elements are emitted WITHOUT the self-closing slash.
 *
 * MEASURED, not stylistic. The template printer keeps sibling boundaries free
 * of whitespace by moving a line break to just before an element's final `>`
 * (see `joinSiblings`). That only works when every element chunk ends with a
 * bare `>`; `<input ... />` would put the break between the `/` and the `>`,
 * which is not a self-closing start tag. `<input>` is standard HTML for a void
 * element and Svelte 5 accepts it. Non-void tags are never self-closed either -
 * Svelte 5 warns `element_invalid_self_closing_tag` on `<span />`.
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

/**
 * The ONLY Svelte warning codes this emitter is allowed to suppress, and the
 * only tags it will suppress them at.
 *
 * Both codes are observations about the AUTHORED template - the IR declares a
 * click handler on a `<form>` - not about the lowering. A faithful emitter
 * cannot remove them and must not silently ignore them either, so they are
 * suppressed at the emission site with Svelte's own sanctioned annotation, the
 * list is fixed here, and `assertCompilesClean` proves the suppression is
 * EXACTLY right in both directions: a code that would not have fired is a
 * redundant suppression and throws, and a code that fires without a suppression
 * throws too.
 */
export const SANCTIONED_SVELTE_IGNORE_CODES = [
	'a11y_click_events_have_key_events',
	'a11y_no_noninteractive_element_interactions',
] as const;
const A11Y_EVENT_HOST_TAGS = new Set(['form']);

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
 * `type` is IR-8: ADMITTED AND SHAPE-CHECKED HERE, DELIBERATELY NOT PRINTED.
 * Admitting a key without checking its shape would trade one blind spot for
 * another, so a `type` that is not an AST node is rejected by name too.
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
	}
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
		throw new Error('Svelte emitter requires at least one component per IR artifact');
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
// script block
// ---------------------------------------------------------------------------

/**
 * DECISION SITE - docs/emitter-idiom-policy.md, worked example 7, "`$props()`
 * destructuring WITH FALLBACK VALUES", ruled **DENIED**; the entry was corrected
 * and rewritten by frameless-svelte-v1 T008 after its first G5 limb was measured
 * FALSE.
 *
 * Read the two halves apart, because they were previously conflated. Plain
 * destructuring - what this function does, unconditionally - is NOT what the
 * ruling denies: MEASURED at 5.56.8, `let { label } = $props()` lowers to a live
 * `$$props.label` read inside a `template_effect`, so a destructured prop IS
 * reactive. What is denied is the FALLBACK, which is why a declared prop default
 * throws below instead of becoming `let { x = default } = $props()`: a fallback
 * is not turned into a reactive state proxy (`$.prop($$props, 'x', 23, () =>
 * ...)`, with no `proxy()` anywhere in the emitted module), so an object or
 * array default is not equivalent to defaulting at each read site.
 */
function propsDeclaration(component: EnrichedComponent): Statement | null {
	if (component.props.entries.length === 0) return null;
	const properties = component.props.entries.map((entry) => {
		if (entry.defaultValue !== undefined)
			throw new Error(
				`Svelte emitter has no lowering for a prop default value: ${entry.localName}`,
			);
		if (entry.path.length !== 1)
			throw new Error(
				`Svelte emitter requires a single-segment prop path, received ${entry.path.join('.')}`,
			);
		return {
			type: 'Property',
			kind: 'init',
			method: false,
			computed: false,
			shorthand: entry.path[0] === entry.localName,
			key: identifier(entry.path[0]!),
			value: identifier(entry.localName),
		};
	});
	return variable(
		'let',
		{ type: 'ObjectPattern', properties },
		call(identifier('$props'), []),
	);
}

/**
 * `ComponentEvaluationPolicy.ordinaryLocals` is `once-per-instance`, so a local
 * initializer that reads a prop or a `$state` must NOT re-run when that value
 * changes. Svelte's own escape hatch for a once-only read is `untrack`, which is
 * the same lowering the Solid emitter already uses for the same policy.
 *
 * It is also the exact fix for `state_referenced_locally`, which Svelte raises on
 * precisely this shape - MEASURED at 5.56.8: the unwrapped form warns and the
 * wrapped form is clean, in both `client` and `server` generation.
 */
function onceValue(value: Expression, context: EmitContext): Expression {
	if (!containsIdentifierFrom(value, context.reactiveNames)) return value;
	context.usedApis.add('untrack');
	return call(identifier('untrack'), [arrow([], value)]);
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

function scriptStatements(ir: EnrichedIR, context: EmitContext): Statement[] {
	const component = context.component;
	const componentBindings = ir.records.bindings.filter(
		(binding) => binding.componentId === component.id,
	);
	const bindingById = new Map(componentBindings.map((binding) => [binding.id, binding]));
	const statements: Statement[] = [];
	const props = propsDeclaration(component);
	if (props) statements.push(props);
	for (const entry of component.props.entries) context.reactiveNames.add(entry.localName);

	for (const local of [...component.locals].sort((left, right) => left.order - right.order)) {
		const semantic = local.semanticRecordIds
			.map((id) => bindingById.get(id))
			.filter((binding): binding is EnrichedGraphBinding => Boolean(binding));
		if (semantic.length > 1)
			throw new Error(
				`Svelte local has unsupported multi-semantic shape: ${local.names.join(',')}`,
			);
		const state = semantic.find((binding) => binding.kind === 'state') as
			| StateBinding
			| undefined;
		const computed = semantic.find((binding) => binding.kind === 'computed');
		if (state) {
			if (local.declarationKind !== 'let')
				throw new Error(`Svelte $state requires a let binding: ${state.name}`);
			statements.push(
				variable(
					'let',
					identifier(state.name),
					call(identifier('$state'), [
						onceValue(expression(state.initializer), context),
					]),
				),
			);
			context.reactiveNames.add(state.name);
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
					`Svelte emitter has no lowering for a statement-bodied computed: ${computed.name}`,
				);
			statements.push(
				variable(
					'const',
					identifier(computed.name),
					call(identifier('$derived'), [site.body]),
				),
			);
			context.reactiveNames.add(computed.name);
			continue;
		}
		if (!local.initializer)
			throw new Error(`Svelte local ${local.names.join(',')} has no initializer`);
		const initializer = onceValue(expression(local.initializer), context);
		if (!local.names.some((name) => identifierIsUsed(ir, component, name))) {
			// A once-per-instance setup call whose binding nothing reads. Emitting
			// the declaration would leave an unused variable; the observable effect
			// is the call itself, so only the call is emitted.
			statements.push(expressionStatement(initializer));
			continue;
		}
		// An ordinary local is a plain binding: not a rune, therefore not reactive,
		// and deliberately not added to `reactiveNames`.
		statements.push(variable(local.declarationKind, expression(local.pattern), initializer));
	}
	return statements;
}

// ---------------------------------------------------------------------------
// template
// ---------------------------------------------------------------------------

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

const ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function staticAttribute(attribute: StaticAttribute): string {
	assertPlainAttributeName(attribute.name);
	return attribute.value === true
		? attribute.name
		: `${attribute.name}="${escapeAttributeValue(attribute.value)}"`;
}

/**
 * Svelte directives are reserved. `bind:` is out of scope on two independent
 * axes and its failure mode is a dev-only console warning; `class:`/`style:`
 * are IR-6 and `use:` has no IR vocabulary at all. Refusing the whole
 * colon-namespaced surface keeps a directive from ever arriving as an attribute
 * name that happens to contain a colon.
 */
function assertPlainAttributeName(name: string): void {
	if (!ATTRIBUTE_NAME.test(name))
		throw new Error(`Svelte emitter rejects the attribute name ${JSON.stringify(name)}`);
}

function eventAttributeName(eventName: string): string {
	if (!/^[a-z]+$/.test(eventName))
		throw new Error(`Svelte emitter rejects the event name ${JSON.stringify(eventName)}`);
	return `on${eventName}`;
}

/**
 * DECISION SITE - docs/emitter-idiom-policy.md, worked example 6, "Svelte 5 -
 * routing a declared `stopPropagation` through `on()` from `svelte/events`",
 * ruled **DENIED** (goal frameless-svelte-v1, T005 ruling; folded into the policy
 * by T008). The entry was REWRITTEN rather than amended, as the policy's
 * re-opening section requires.
 *
 * The ruling in one line: the baseline `onname={...}` event attribute is what
 * this function keeps, `on()` is refused, and a declared `stopPropagation` is
 * refused OUTRIGHT rather than routed anywhere. G1 FAIL (the `on()` arm's whole
 * justification is Svelte's docs, with Svelte in the lockfile and measurement
 * demonstrably possible), G5 FAIL (the repair narrowed PER EVENT RECORD, which
 * makes a mixed-mechanism component the normal case - S3 carries four events -
 * and delegated-versus-attached is an event-ROUTING difference the compiler
 * cannot see, because `mixed_event_handler_syntaxes` fires for `on:` + `onname`
 * and NOT for `on()`). G2/G3 PASS, G4 PASS by the named refusal below, G6 PASS
 * for the attribute arm and FAIL for the `on()` arm - no standing check can
 * exist for a path the emitter refuses to emit.
 *
 * The baseline is the attribute form because the alternatives are not free:
 * MEASURED at 5.56.8, `on:click` in a runes component warns
 * `event_directive_deprecated`, and mixing the two spellings is the hard error
 * `mixed_event_handler_syntaxes`.
 *
 * IR-5 under Svelte 5.
 *
 * Svelte 5 REMOVED event modifiers, and its event attributes receive the native
 * DOM event, so a declared action is emitted as an ordinary in-body statement -
 * exactly what React and Solid already emit, and exactly what the authored
 * handler already spells.
 *
 * `stopPropagation` FAILS CLOSED. The s1/s2/s3 corpus contains zero instances,
 * so the alternative - routing the whole component through `on()` from
 * `svelte/events` - would be untested dead code, and in an emitter that is worse
 * than absent code. It throws here instead, and the gate carries a matching row -
 * `no-stop-propagation` over emitted output, plus `baseline-form-inventory`,
 * which rejects an `on` imported from `svelte/events` by any route at all.
 *
 * `preventDefault` is emitted in the delegated attribute form. MEASURED at
 * 5.56.8 in a real browser, not inferred: clicking a `<button type="submit">`
 * whose delegated `onclick` calls `preventDefault()` left the Document-request
 * count unchanged, while the same page with the call removed issued the form's
 * GET. The signal tracked the product parameter, not the emission form - the
 * `on()` variant behaved identically in both cells.
 */
function syncPolicyGuard(event: EnrichedEventRecord, handlerBody: Statement[]): void {
	const policy: SyncPolicy | undefined = event.syncPolicy;
	if (!policy) return;
	const branches = 'branches' in policy ? policy.branches : [policy];
	for (const branch of branches)
		if (branch.actions.includes('stopPropagation'))
			throw new Error(
				`Svelte emitter fails closed on a declared stopPropagation (${event.id}): Svelte 5 delegates click/input/change to the root and simulates propagation, so the attribute form cannot be trusted to stop an ancestor handler, and the on()-from-svelte/events path has no instance in the corpus to test it against`,
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
			`Svelte event ${event.id} declares an unconditional preventDefault its handler body does not spell as a top-level preventDefault() call`,
		);
}

/** `indent` is the ELEMENT's indent; attribute lines sit one level deeper. */
function eventAttribute(event: EnrichedEventRecord, indent: string): string {
	if (event.handlers.length !== 1)
		throw new Error(`Svelte emitter does not support multiple handlers for ${event.id}`);
	const handler = expression(event.handlers[0]!.expression);
	if (handler.type !== 'ArrowFunctionExpression')
		throw new Error(`Event handler ${event.id} is not an arrow function`);
	const body: Statement[] =
		handler.body.type === 'BlockStatement'
			? handler.body.body
			: [expressionStatement(handler.body)];
	syncPolicyGuard(event, body);
	return `${eventAttributeName(event.eventName)}={${indentContinuation(printExpression(handler), `${indent}\t`)}}`;
}

function width(indent: string, text: string): number {
	return indent.length * 4 + text.length;
}

function attributesOf(node: Extract<TemplateNode, { kind: 'host' }>, indent: string): string[] {
	const attributes = node.staticAttributes.map(staticAttribute);
	for (const binding of node.dynamicBindings) {
		assertPlainAttributeName(binding.name);
		// Svelte decides attribute-versus-property itself from the tag and the
		// name, so `kind` needs no separate spelling here.
		attributes.push(
			`${binding.name}={${indentContinuation(printExpression(expression(binding.expression)), `${indent}\t`)}}`,
		);
	}
	return attributes;
}

/**
 * Sibling boundaries carry no whitespace, so a line break is inserted just
 * BEFORE the previous chunk's final `>` - inside the tag, where it cannot become
 * a text node.
 *
 * MEASURED at 5.56.8: naive indentation between siblings survives compilation as
 * a single space (`</output> <button`), which would make emitted Svelte's text
 * content differ from React's and Solid's, where JSX drops whitespace-only
 * lines. Server-rendering the layout this function produces is byte-identical to
 * server-rendering the same template with every line break removed.
 *
 * A chunk that ends in `}` - a `{/if}` or `{/each}` - offers no such position,
 * so the next sibling follows it directly on the same line.
 */
function appendSibling(left: string, right: string, indent: string): string {
	if (!left.endsWith('>')) return left + right;
	const head = left.slice(0, -1).replace(/\n[\t ]*$/, '');
	return `${head}\n${indent}>${right}`;
}

function joinSiblings(chunks: readonly string[], indent: string): string {
	return chunks.reduce((left, right) => appendSibling(left, right, indent));
}

function renderChildren(children: readonly TemplateNode[], indent: string): string {
	return joinSiblings(
		children.map((child) => renderNode(child, indent, false)),
		indent,
	);
}

/** True when this parent's children must be printed with no added whitespace. */
function hasTextChild(children: readonly TemplateNode[]): boolean {
	return children.some((child) => child.kind === 'text' || child.kind === 'dynamic-text');
}

function renderHost(
	node: Extract<TemplateNode, { kind: 'host' }>,
	indent: string,
	inline: boolean,
	context: EmitContext,
): string {
	if (!/^[a-z][a-z0-9-]*$/.test(node.tag))
		throw new Error(`Svelte emitter rejects the host tag ${JSON.stringify(node.tag)}`);
	const attributes = attributesOf(node, indent);
	for (const eventId of node.eventIds) {
		const event = context.eventsById.get(eventId);
		if (!event) throw new Error(`Unknown event record: ${eventId}`);
		attributes.push(eventAttribute(event, indent));
	}
	const singleLine = `<${node.tag}${attributes.map((attribute) => ` ${attribute}`).join('')}>`;
	const fits =
		!attributes.some((attribute) => attribute.includes('\n')) &&
		width(indent, singleLine) <= PRINT_WIDTH;
	if (inline && !fits)
		throw new Error(
			`Svelte emitter cannot inline <${node.tag}>: it sits beside text and needs a multi-line start tag`,
		);
	const open = fits
		? singleLine
		: `<${node.tag}\n${attributes.map((attribute) => `${indent}\t${attribute}`).join('\n')}\n${indent}>`;
	const isVoid = VOID_ELEMENTS.has(node.tag);
	if (isVoid) {
		if (node.children.length)
			throw new Error(`Svelte void element <${node.tag}> cannot have children`);
		return prefixIgnores(node, open, context);
	}
	const close = `</${node.tag}>`;
	if (node.children.length === 0) return prefixIgnores(node, open + close, context);
	if (inline || hasTextChild(node.children)) {
		const children = node.children
			.map((child) => renderNode(child, indent, true))
			.join('');
		return prefixIgnores(node, open + children + close, context);
	}
	const chunks = [
		open,
		...node.children.map((child) => renderNode(child, `${indent}\t`, false)),
	];
	const body = joinSiblings(chunks, `${indent}\t`);
	return prefixIgnores(node, appendSibling(body, close, indent), context);
}

/**
 * The sanctioned annotation is emitted INLINE, with no whitespace between it and
 * the element, so it can never introduce a text node at a sibling boundary.
 */
function prefixIgnores(
	node: Extract<TemplateNode, { kind: 'host' }>,
	rendered: string,
	context: EmitContext,
): string {
	if (!node.eventIds.length || !A11Y_EVENT_HOST_TAGS.has(node.tag)) return rendered;
	for (const code of SANCTIONED_SVELTE_IGNORE_CODES) context.suppressed.add(code);
	return `<!-- svelte-ignore ${SANCTIONED_SVELTE_IGNORE_CODES.join(', ')} -->${rendered}`;
}

function renderBranch(
	node: Extract<TemplateNode, { kind: 'branch' }>,
	indent: string,
	inline: boolean,
): string {
	if (node.arms.length < 1 || node.arms.length > 2)
		throw new Error(`Svelte branch ${node.id} requires a then arm and at most one else arm`);
	if (node.arms[0]!.kind !== 'then')
		throw new Error(`Svelte branch ${node.id} must open with a then arm`);
	if (node.arms[1] && node.arms[1].kind !== 'else')
		throw new Error(
			`Svelte emitter has no lowering for a ${node.arms[1].kind} branch arm (${node.id})`,
		);
	const test = printExpression(expression(node.expression));
	const arm = (children: readonly TemplateNode[]): string =>
		inline
			? children.map((child) => renderNode(child, indent, true)).join('')
			: `\n${indent}\t${renderChildren(children, `${indent}\t`)}\n${indent}`;
	const elseArm = node.arms[1];
	const otherwise =
		elseArm && elseArm.children.length ? `{:else}${arm(elseArm.children)}` : '';
	return `{#if ${test}}${arm(node.arms[0]!.children)}${otherwise}{/if}`;
}

function renderKeyedRepeat(
	node: Extract<TemplateNode, { kind: 'keyed-repeat' }>,
	indent: string,
	inline: boolean,
): string {
	if (node.index)
		throw new Error(`Svelte keyed repeat ${node.id} has no lowering for an index binding`);
	if (node.empty.length)
		throw new Error(`Svelte keyed repeat ${node.id} has no lowering for an empty fallback`);
	if (node.row.length === 0) throw new Error(`Svelte keyed repeat ${node.id} has no row`);
	const collection = printExpression(expression(node.collection.expression));
	const key = printExpression(expression(node.key.expression));
	const row = inline
		? node.row.map((child) => renderNode(child, indent, true)).join('')
		: `\n${indent}\t${renderChildren(node.row, `${indent}\t`)}\n${indent}`;
	return `{#each ${collection} as ${node.item} (${key})}${row}{/each}`;
}

function renderNode(node: TemplateNode, indent: string, inline: boolean): string {
	const context = activeContext();
	if (node.kind === 'text') return escapeText(node.value);
	if (node.kind === 'dynamic-text')
		return `{${indentContinuation(printExpression(expression(node.expression)), indent)}}`;
	if (node.kind === 'fragment')
		return inline
			? node.children.map((child) => renderNode(child, indent, true)).join('')
			: renderChildren(node.children, indent);
	if (node.kind === 'branch') return renderBranch(node, indent, inline);
	if (node.kind === 'keyed-repeat') return renderKeyedRepeat(node, indent, inline);
	if (node.kind === 'host') return renderHost(node, indent, inline, context);
	throw new Error(
		`Svelte emitter has no lowering for template node kind ${(node as { kind: string }).kind}`,
	);
}

/**
 * The template printer is a pure string walk, so the context is held in a
 * module-local rather than threaded through every signature. `emit` is
 * synchronous and single-shot, so there is no interleaving to worry about; the
 * accessor throws rather than returning `undefined` if that ever stops holding.
 */
let currentContext: EmitContext | null = null;
function activeContext(): EmitContext {
	if (!currentContext) throw new Error('Svelte template printer ran outside emit()');
	return currentContext;
}

// ---------------------------------------------------------------------------
// output verification
// ---------------------------------------------------------------------------

const SVELTE_IGNORE_COMMENT = /<!-- svelte-ignore [^>]*-->/g;

function warningCodes(source: string, filename: string): string[] {
	const codes = new Set<string>();
	for (const generate of ['client', 'server'] as const) {
		const result = compile(source, { filename, generate, dev: true });
		for (const warning of result.warnings) codes.add(warning.code);
	}
	return [...codes].sort();
}

/**
 * TWO-SIDED. The emitted source must compile with no warnings at all, AND the
 * set of codes that would have fired without the sanctioned annotations must be
 * exactly the set this emitter chose to suppress.
 *
 * The second half exists because Svelte does NOT report a redundant
 * `svelte-ignore` - MEASURED at 5.56.8 - so an over-firing suppression rule is
 * invisible to the first half alone.
 */
function assertCompilesClean(source: string, filename: string, suppressed: Set<string>): void {
	const emitted = warningCodes(source, filename);
	if (emitted.length)
		throw new Error(
			`Emitted Svelte module ${filename} did not compile warning-free: ${emitted.join(', ')}. Every emitted form must be warning-free; a code that is legitimate for the authored shape has to be added to SANCTIONED_SVELTE_IGNORE_CODES with a reason.`,
		);
	const withoutIgnores = warningCodes(source.replaceAll(SVELTE_IGNORE_COMMENT, ''), filename);
	const expected = [...suppressed].sort();
	if (withoutIgnores.join('|') !== expected.join('|'))
		throw new Error(
			`Emitted Svelte module ${filename} suppresses [${expected.join(', ')}] but without those annotations Svelte reports [${withoutIgnores.join(', ')}]. A suppression that changes nothing is a silent over-fire.`,
		);
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

/**
 * Emit the supported Svelte 5 runes surface from frameless-enriched-ir/2 as a
 * single-file component.
 *
 * A `.svelte` module is one component exported as the module DEFAULT, so the
 * IR's named `ComponentExport` cannot be honoured by spelling; the component
 * name is carried in the generated header instead. That is a property of the
 * target format, not a choice, and it is the one place the Svelte lane diverges
 * structurally from the React, Solid and Qwik lanes.
 */
export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	if (ir.records.persistence.length)
		throw new Error('Svelte emitter does not support persistence-bearing IR');
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
		throw new Error('Svelte emitter does not support composition or shared/handle constructs');
	if (ir.module.exports.length !== 1)
		throw new Error('A .svelte module exports exactly one component');
	const component = ir.components[0]!;
	if (component.guards.length)
		throw new Error(
			`Svelte emitter has no lowering for an early component guard (${component.name}): a .svelte component has no return statement to guard`,
		);
	const context: EmitContext = {
		component,
		eventsById: new Map(
			ir.records.events
				.filter((event) => event.componentId === component.id)
				.map((event) => [event.id, event]),
		),
		reactiveNames: new Set<string>(),
		usedApis: new Set<SvelteApi>(),
		suppressed: new Set<string>(),
	};
	currentContext = context;
	try {
		const statements = scriptStatements(ir, context);
		const template = renderChildren(component.template, '');
		const imports: Statement[] = context.usedApis.has('untrack')
			? [
					{
						type: 'ImportDeclaration',
						specifiers: [
							{
								type: 'ImportSpecifier',
								imported: identifier('untrack'),
								local: identifier('untrack'),
							},
						],
						source: { type: 'Literal', value: 'svelte', raw: "'svelte'" },
					} as Node,
				]
			: [];
		const script = printStatements([...imports, ...statements])
			.split('\n')
			.map((line) => (line === '' ? line : `\t${line}`))
			.join('\n');
		// `lang="ts"` WITH NO TYPE PRINTED. T002 measured the coupling as
		// ONE-DIRECTIONAL at svelte/compiler 5.56.8 - `<script lang="ts">` over
		// untyped source is clean in BOTH client and server modes with zero
		// warnings, while a type WITHOUT the attribute throws - which is what lets
		// the attribute land in its own behaviour-neutral step ahead of the
		// annotations. Printing the types is a later step.
		const source = `<!-- @generated by @frameless/svelte from ${component.name}; do not edit. -->\n<script lang="ts">\n${script}\n</script>\n\n${template}\n`;
		assertCompilesClean(source, `${component.name}.svelte`, context.suppressed);
		return source;
	} finally {
		currentContext = null;
	}
}
