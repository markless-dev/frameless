import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
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
};

type VueApi = 'computed' | 'ref';

/**
 * Names this emitter introduces into `<script setup>` scope itself. A component
 * local with one of these names would silently shadow the emitter's own binding,
 * so it is refused rather than renamed - renaming would make emitted identifiers
 * stop matching the authored ones for no gain the corpus can test.
 */
const RESERVED_SCRIPT_NAMES = new Set(['props', 'ref', 'computed', 'defineProps']);

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
 * `type` is IR-8: ADMITTED AND SHAPE-CHECKED HERE, DELIBERATELY NOT PRINTED.
 * Admitting a key without checking its shape would trade one blind spot for
 * another, so a `type` that is not an AST node is rejected by name too. What
 * this lane may do with the field once it prints one is decided in the gate,
 * not here - see the `no-typed-props` policy in `src/gate/index.ts`.
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
 * DECISION SITE - `defineProps` takes the ARRAY form, never a type argument.
 *
 * `docs/emitter-idiom-policy.md` Gate 3 forbids a content-based trigger and Gate
 * 4 forbids a rule that is unsound outside a recognised subset. `defineProps<{ …
 * }>()` needs a type per prop, and the IR carries none: `PropDestructuringEntry`
 * is `sourceName`/`localName`/`path`/`alias`/`graphNodeId`/`defaultValue?` and
 * `EnrichedComponent.props` adds nothing. Every emitted type would therefore be
 * INFERRED from what the corpus happens to do with the prop, which is exactly
 * both refusals. Named IR-8 and DEFERRED by frameless-vue-v1 T002 ruling 3.
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
 * This array IS 12b's domain, and ITS SIZE IS NOT A LITERAL THIS COMMENT OWNS:
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
function propsDeclaration(component: EnrichedComponent): Statement | null {
	if (component.props.entries.length === 0) return null;
	const names: string[] = [];
	for (const entry of component.props.entries) {
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
	return variable(
		'const',
		identifier('props'),
		call(identifier('defineProps'), [
			{ type: 'ArrayExpression', elements: names.map((name) => literal(name)) },
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
			if (binding.kind === 'state' || binding.kind === 'computed')
				context.rewrites.set(binding.name, { kind: 'ref' });
		}
	}
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
	if (node.kind === 'host' || node.kind === 'branch' || node.kind === 'keyed-repeat')
		return true;
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
	throw new Error(
		`Vue emitter has no lowering for template node kind ${(node as { kind: string }).kind}`,
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
	if (!descriptor.scriptSetup)
		return [`emitted Vue SFC ${filename} has no <script setup> block`];
	if (!descriptor.template) return [`emitted Vue SFC ${filename} has no <template> block`];
	for (const { ssr, isProd } of COMPILE_MODES) {
		let bindings;
		try {
			bindings = compileScript(descriptor, { id: filename, inlineTemplate: false, isProd })
				.bindings;
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
 * There is no `lang="ts"`. See `propsDeclaration` for the ruling (IR-8).
 */
export function emit(ir: EnrichedIR): string {
	validateEnrichedIr(ir);
	if (ir.records.persistence.length)
		throw new Error('Vue emitter does not support persistence-bearing IR');
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
		throw new Error('Vue emitter does not support composition or shared/handle constructs');
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
	const context: EmitContext = {
		component,
		eventsById: new Map(
			ir.records.events
				.filter((event) => event.componentId === component.id)
				.map((event) => [event.id, event]),
		),
		rewrites: new Map<string, ScriptRewrite>(),
		usedApis: new Set<VueApi>(),
	};
	currentContext = context;
	try {
		collectRewrites(ir, context);
		const statements = scriptStatements(ir, context);
		const template = renderChildren(component.template, '\t', false);
		const imports: Statement[] = context.usedApis.size
			? [importDeclaration([...context.usedApis].sort(), 'vue')]
			: [];
		const script = printStatements([...imports, ...statements])
			.split('\n')
			.map((line) => (line === '' ? line : `\t${line}`))
			.join('\n');
		const source =
			`<!-- @generated by @frameless/vue from ${component.name}; do not edit. -->\n` +
			`<script setup>\n${script}\n</script>\n\n` +
			`<template>\n\t${template}\n</template>\n`;
		assertCompilesClean(source, `${component.name}.vue`);
		return source;
	} finally {
		currentContext = null;
	}
}
