import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { babelParse, compileScript, parse } from '@vue/compiler-sfc';
import { ESLint } from 'eslint';
import vuePlugin from 'eslint-plugin-vue';
import type { EnrichedIR } from '@frameless/compiler';
import { dirname, normalize, relative, resolve } from 'pathe';

export type DossierRef =
	// SFC with <script setup>, no lang="ts", and BOTH arbiters - @vue/compiler-sfc
	// and eslint-plugin-vue. The directive SPELLING was this ruling's until T005
	// re-ran worked example 2; it now belongs to the entry below.
	| 'frameless-vue-v1 T002 ruling 2'
	// docs/emitter-idiom-policy.md worked example 2a: v-bind/v-on shorthands WITH A
	// VALUE are sugar, all six gates PASS. 2b (v-slot / #header) is DENIED and has
	// no emitter path. Adopted by frameless-vue-v1 T006.
	| 'frameless-vue-v1 T005 shorthand ruling (worked example 2a)'
	// SUPERSEDED, AND LEFT HERE UNREFERENCED ON PURPOSE. This read "IR-8: the IR
	// carries no prop type field, so a type would have to be invented from
	// expression contents. Gate 3 and Gate 4 both forbid that." IR-8 LANDED at
	// T003 of frameless-emitter-capability-v1: the field exists, Gate 3 now
	// PASSES on a declared trigger, and Gate 4 is repairable by narrowing to
	// fully-annotated components. The denial survives on the entry below instead.
	// Deleting this line would erase the record that the ruling ever rested here.
	| 'frameless-vue-v1 T002 ruling 3 (IR-8) - SUPERSEDED'
	// `no-typed-props` re-derived after IR-8 landed. GATE 5 DECIDES AND FAILS,
	// measured at 3.5.40: the type-argument form compiles to runtime prop options
	// the array form has none of, so an absent boolean prop becomes `false` rather
	// than `undefined`, `visible=""` flips from FALSY to TRUTHY, and two
	// diagnostics appear enforcing a `required: true` no IR field declares.
	| 'frameless-emitter-capability-v1 T010 (Gate 5, IR-8 landed)'
	// IR-1/IR-2: no bindable prop kind and no emit concept. defineModel/defineEmits
	// are out of scope on two independent axes.
	| 'frameless-vue-v1 T002 ruling 5 (IR-1/IR-2)'
	// IR-5: two declared actions, emitted as ordinary in-body statements.
	// stopPropagation fails closed rather than growing an untested path.
	| 'frameless-vue-v1 T002 ruling 5 (IR-5)'
	// IR-7: purity is never asserted while computed() expects a pure expression.
	// Conservative syntactic guard, not a purity proof.
	| 'frameless-vue-v1 T002 ruling 5 (IR-7)'
	// IR-4 deferred, version corollary NOT amended: emit only baseline-safe forms.
	// The inventory is what asserts the second conjunct instead of assuming it.
	| 'frameless-vue-v1 T002 ruling 5 (IR-4 baseline form inventory)'
	// The whitespace layout the template printer depends on, MEASURED at 3.5.40.
	| 'frameless-vue-v1 T003 measurement M1'
	// Qwik's artifact-required policy, transposed: fail closed on persistence.
	| 'T002-qwik-architecture D8'
	// The THIRD-PARTY arbiter. Every policy above encodes what WE decided; these
	// encode what the Vue team decided.
	| 'frameless-vue-v1 T003 lint arbiter';

export type GatePolicy = {
	readonly id: string;
	readonly dossierRef: DossierRef;
	readonly requiresArtifact?: true;
};
export type GateViolation = {
	readonly file: string;
	readonly policy: string;
	readonly dossierRef: DossierRef;
	readonly message: string;
	readonly line: number | null;
};
export type GateResult = {
	readonly files: readonly string[];
	readonly policies: readonly GatePolicy[];
	readonly violations: readonly GateViolation[];
	readonly unevaluated: ReadonlyArray<{
		readonly policy: string;
		readonly reason: 'requires-artifact';
	}>;
};

type Node = Record<string, any>;

function persistenceArtifactPolicy() {
	const policy = {
		id: 'persistence-render-lowering',
		dossierRef: 'T002-qwik-architecture D8',
	} as const;
	Object.defineProperty(policy, 'requiresArtifact', { enumerable: false, value: true });
	return policy as typeof policy & { readonly requiresArtifact: true };
}

// ---------------------------------------------------------------------------
// the third-party arbiter
// ---------------------------------------------------------------------------

export type OmittedEslintRule = {
	readonly rule: string;
	readonly reason: string;
};

export type ExcludedEslintTier = {
	readonly tier: string;
	readonly reason: string;
	/**
	 * The rule ids that tier ACTUALLY reports on the shipped corpus, measured at
	 * eslint-plugin-vue 10.10.0. `test/gate.test.ts` re-measures it, so a
	 * correctness rule arriving in an excluded tier turns this red instead of
	 * disappearing.
	 */
	readonly firesOnCorpus: readonly string[];
};

/**
 * THE TIER DECISION, and it is the sharpest difference between this gate and the
 * Svelte one.
 *
 * eslint-plugin-svelte's `recommended` is an arbiter. eslint-plugin-vue's upper
 * tiers are substantially a FORMATTER: `strongly-recommended` is the plugin's own
 * "Priority B: strongly recommended for improving readability" set. This lane
 * applies `flat/essential` - "Priority A: Essential (Error Prevention)", 85 rules
 * - and excludes the two tiers above it.
 *
 * That exclusion is recorded here rather than made silently, because a tier
 * dropped without a reason is indistinguishable from a tier nobody looked at. It
 * is also MEASURED rather than argued: the `firesOnCorpus` lists below are the
 * exact rule ids each tier reports on the shipped S1/S2/S3, and two of them would
 * not merely be noisy - they would break the observable this board exists to
 * protect.
 *
 * THE LISTS SHRANK FROM EIGHT IDS TO SIX, and the reason belongs here rather than
 * only in the rows. `vue/v-on-style` and `vue/v-bind-style` demand the `@` and `:`
 * shorthands and fired against the shipped longhand for as long as this gate has
 * existed. `frameless-vue-v1` T005 put that datum through all six gates of
 * `docs/emitter-idiom-policy.md` - a rule in a READABILITY tier, against output
 * that compiles with an exact empty diagnostic set, is candidate sugar and not a
 * forced-lowering trigger - ruled the valued shorthands SUGAR, and T006 adopted
 * them. Both rules are now satisfied. THAT IS NOT A REASON TO ADOPT THE TIER: the
 * exclusion never rested on them, and the two content-newline rules, which would
 * break the cross-lane text observation outright, still decide it on their own.
 */
export const VUE_ESLINT_TIERS_EXCLUDED: readonly ExcludedEslintTier[] = [
	{
		tier: 'flat/strongly-recommended',
		reason:
			'THE PLUGIN\'S OWN "Priority B: strongly recommended for improving readability" tier, and on this corpus every rule it still reports is a formatting rule. vue/singleline-html-element-content-newline and vue/multiline-html-element-content-newline demand a line break between a tag and its text content, which MEASURED at 3.5.40 under whitespace:\'condense\' turns <button>increment</button> into <button> increment </button> - they would BREAK the text observation the e2e lane asserts equal across six frameworks, and they are what carries this exclusion. vue/require-prop-types demands the prop types the IR does not carry (IR-8, deferred by T002 ruling 3). vue/html-indent demands spaces where this repository indents with tabs. vue/html-self-closing demands <input/> where the emitter emits the standard void-element <input>. vue/max-attributes-per-line is pure layout. WHAT IS NO LONGER IN THIS LIST, recorded because its absence is a measurement and not an omission: vue/v-on-style and vue/v-bind-style demand the @ and : shorthands and fired against the SHIPPED LONGHAND until frameless-vue-v1 T005 ruled the valued shorthands SUGAR on all six gates and T006 adopted them; the emitter now satisfies both, so they are silent. That is NOT a reason to adopt the tier - the exclusion never rested on them, and the two content-newline rules alone still decide it.',
		firesOnCorpus: [
			'vue/html-indent',
			'vue/html-self-closing',
			'vue/max-attributes-per-line',
			'vue/multiline-html-element-content-newline',
			'vue/require-prop-types',
			'vue/singleline-html-element-content-newline',
		],
	},
	{
		tier: 'flat/recommended',
		reason:
			'The "Priority C: recommended, minimising arbitrary choices and cognitive overhead" tier, and it is a SUPERSET of flat/strongly-recommended - so excluding it follows from the row above rather than from anything it adds on its own. Measured on the shipped corpus it reports exactly the same six rule ids: the eight rules it adds (vue/attributes-order, vue/block-order, vue/no-lone-template, vue/no-multiple-slot-args, vue/no-required-prop-with-default, vue/no-v-html, vue/order-in-components, vue/this-in-template) are all silent on emitted output today. The list dropped from eight ids to six for the same reason the row above did - vue/v-on-style and vue/v-bind-style stopped firing once T006 adopted the shorthands - and this row inherits that verdict rather than restating it. Recorded so that a later rule arriving in this tier and firing is a red test here rather than an unexamined exclusion.',
		firesOnCorpus: [
			'vue/html-indent',
			'vue/html-self-closing',
			'vue/max-attributes-per-line',
			'vue/multiline-html-element-content-newline',
			'vue/require-prop-types',
			'vue/singleline-html-element-content-newline',
		],
	},
];

/**
 * EXPLICIT OMISSIONS inside the APPLIED tier. Qwik records the same thing as
 * `QWIK_ESLINT_RULES_REQUIRING_TYPES` and Svelte as `SVELTE_ESLINT_RULES_OMITTED`,
 * for the same reason: a rule dropped silently is indistinguishable from a rule
 * that never fired, and the second one is what an arbiter is supposed to make
 * impossible.
 */
export const VUE_ESLINT_RULES_OMITTED: readonly OmittedEslintRule[] = [
	{
		rule: 'vue/comment-directive',
		reason:
			"DISABLED DELIBERATELY, AND IT IS A STRENGTHENING, NOT A WEAKENING. This rule is the plugin's implementation of `<!-- eslint-disable -->` inside markup, and ESLint's own allowInlineConfig: false does NOT reach it. MEASURED at eslint-plugin-vue 10.10.0 on the unkeyed-v-for mutant: with this rule ON and one `<!-- eslint-disable vue/require-v-for-key -->` in the template the arbiter reported NOTHING; with it OFF the same mutant reported vue/require-v-for-key. Emitted TEXT silencing the arbiter that is judging it is the one thing a gate over generated output must not permit. Off, no message can be suppressed, so the applied set can only ever report MORE. The Svelte lane omits svelte/comment-directive for the identical reason and on an identical measurement.",
	},
	{
		rule: 'vue/multi-word-component-names',
		reason:
			'READS THE FILE NAME, and the file names here are the repository\'s scenario ids. A .vue single-file component declares no name, so this rule falls back to the basename - S1, S2, S3 - which is the corpus convention shared byte-for-byte with the react, solid, qwik and svelte lanes and is not a Vue naming decision at all. The names the IR actually declares (RenderOnce, KeyedTodo, EventForm) ARE multi-word, and the emitter carries each one in the generated header. Satisfying the rule instead would mean emitting defineOptions({ name }), a Vue 3.3 macro - a version-gated form this lane may not adopt while IR-4 is deferred.',
	},
];

const OMITTED_ESLINT_RULES = new Set(VUE_ESLINT_RULES_OMITTED.map((entry) => entry.rule));

/**
 * The applied tier's rule ids, READ OFF the config itself rather than
 * transcribed. Transcribing would freeze the set at the version that was read: a
 * rule added to `essential` in a later eslint-plugin-vue would then be silently
 * absent, which is the same failure the omission list exists to prevent, one
 * level up.
 */
const APPLIED_TIER = 'flat/essential';

type FlatConfigEntry = { readonly rules?: Readonly<Record<string, unknown>> };

function tierEntries(tier: string): readonly FlatConfigEntry[] {
	const configs = (vuePlugin as unknown as { configs: Record<string, unknown> }).configs;
	const entries = configs[tier];
	if (!Array.isArray(entries))
		throw new Error(`eslint-plugin-vue no longer publishes the config ${tier}`);
	return entries as readonly FlatConfigEntry[];
}

function tierRuleSeverities(tier: string): Map<string, unknown> {
	const severities = new Map<string, unknown>();
	for (const entry of tierEntries(tier))
		for (const [rule, severity] of Object.entries(entry.rules ?? {}))
			severities.set(rule, severity);
	return severities;
}

/** Every applied-tier rule this gate actually runs, sorted. */
export const VUE_ESLINT_RULES_APPLIED: readonly string[] = [...tierRuleSeverities(APPLIED_TIER)]
	.filter(([rule, severity]) => severity !== 'off' && !OMITTED_ESLINT_RULES.has(rule))
	.map(([rule]) => rule)
	.sort();

let cachedEslint: ESLint | undefined;
function makeEslint(): ESLint {
	cachedEslint ??= new ESLint({
		cwd: PACKAGE_ROOT,
		overrideConfigFile: true,
		// Emitted output must not be able to configure the gate that reads it.
		allowInlineConfig: false,
		overrideConfig: [
			...(tierEntries(APPLIED_TIER) as never[]),
			{
				files: ['**/*.vue'],
				rules: Object.fromEntries(
					VUE_ESLINT_RULES_OMITTED.map((entry) => [entry.rule, 'off']),
				),
			} as never,
		],
	});
	return cachedEslint;
}

/**
 * `eslint:` marks a THIRD-PARTY arbiter, following the qwik and svelte gates. The
 * frameless-owned policies in this file keep their BARE ids: they are not eslint
 * rules at all - they are hand-written walkers over Vue's own SFC parse tree - so
 * a `frameless/` prefix would imply a plugin that does not exist. The distinction
 * the prefix carries is "who decided this", and here it is carried by presence
 * versus absence of `eslint:`.
 */
function eslintPolicyId(ruleId: string | null | undefined): string {
	return `eslint:${ruleId ?? 'parse'}`;
}

async function eslintViolations(file: string, source: string): Promise<GateViolation[]> {
	const [result] = await makeEslint().lintText(source, {
		filePath: resolve(PACKAGE_ROOT, file),
		warnIgnored: false,
	});
	return (result?.messages ?? []).map((message) =>
		violation(file, eslintPolicyId(message.ruleId), message.message, message.line ?? null),
	);
}

const ESLINT_POLICIES = VUE_ESLINT_RULES_APPLIED.map((rule) => ({
	id: `eslint:${rule}`,
	dossierRef: 'frameless-vue-v1 T003 lint arbiter' as const,
}));

export const VUE_GATE_POLICIES = [
	{ id: 'generated-header', dossierRef: 'frameless-vue-v1 T002 ruling 2' },
	{
		id: 'require-directive-shorthand',
		dossierRef: 'frameless-vue-v1 T005 shorthand ruling (worked example 2a)',
	},
	{
		id: 'directive-carries-value',
		dossierRef: 'frameless-vue-v1 T005 shorthand ruling (worked example 2a)',
	},
	{ id: 'no-directive-modifier', dossierRef: 'frameless-vue-v1 T002 ruling 5 (IR-5)' },
	{ id: 'no-two-way-binding', dossierRef: 'frameless-vue-v1 T002 ruling 5 (IR-1/IR-2)' },
	// The ref moved WITH the grounds. `frameless-vue-v1 T002 ruling 3` denied this
	// form BECAUSE IR-8 was missing; IR-8 landed at T003 of
	// `frameless-emitter-capability-v1` and the denial was re-derived there on a
	// measured Gate 5 failure instead. Leaving the old ref would have sent anyone
	// checking this policy to a document whose stated blocker is now discharged.
	{ id: 'no-typed-props', dossierRef: 'frameless-emitter-capability-v1 T010 (Gate 5, IR-8 landed)' },
	{ id: 'no-stop-propagation', dossierRef: 'frameless-vue-v1 T002 ruling 5 (IR-5)' },
	{ id: 'computed-expression-purity', dossierRef: 'frameless-vue-v1 T002 ruling 5 (IR-7)' },
	{ id: 'condense-stable-text', dossierRef: 'frameless-vue-v1 T003 measurement M1' },
	{
		id: 'baseline-form-inventory',
		dossierRef: 'frameless-vue-v1 T002 ruling 5 (IR-4 baseline form inventory)',
	},
	persistenceArtifactPolicy(),
	...ESLINT_POLICIES,
] as const satisfies readonly GatePolicy[];

const POLICIES = new Map<string, GatePolicy>(VUE_GATE_POLICIES.map((policy) => [policy.id, policy]));
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATED_HEADER = '<!-- @generated by @frameless/vue';

function violation(
	file: string,
	policy: string,
	message: string,
	line: number | null = null,
): GateViolation {
	return {
		file,
		policy,
		dossierRef:
			POLICIES.get(policy)?.dossierRef ??
			// `eslint:parse` is the only unpublished eslint policy: it is what a
			// message with no ruleId becomes, which is a parser failure rather than a
			// rule verdict. It still belongs to the arbiter.
			(policy.startsWith('eslint:')
				? 'frameless-vue-v1 T003 lint arbiter'
				: 'frameless-vue-v1 T002 ruling 2'),
		message,
		line,
	};
}

/** Depth-first walk that never follows a `parent` or `loc` back-reference. */
function walk(value: unknown, visit: (record: Node) => void): void {
	if (!value || typeof value !== 'object') return;
	if (Array.isArray(value)) {
		value.forEach((entry) => walk(entry, visit));
		return;
	}
	const record = value as Node;
	visit(record);
	for (const [key, child] of Object.entries(record)) {
		if (key === 'parent' || key === 'loc' || key === 'codegenNode') continue;
		walk(child, visit);
	}
}

// ---------------------------------------------------------------------------
// the two ASTs this gate reads
// ---------------------------------------------------------------------------

/**
 * Vue's template AST tags node kinds with NUMBERS. Only the kinds a PARSED (not
 * yet transformed) template can carry are named; anything else becomes
 * `NODE_<n>`, which the inventory then rejects, so a new node kind fails closed
 * rather than being silently accepted as "some number".
 */
const TEMPLATE_NODE_NAMES: Readonly<Record<number, string>> = {
	0: 'ROOT',
	1: 'ELEMENT',
	2: 'TEXT',
	3: 'COMMENT',
	4: 'SIMPLE_EXPRESSION',
	5: 'INTERPOLATION',
	6: 'ATTRIBUTE',
	7: 'DIRECTIVE',
	8: 'COMPOUND_EXPRESSION',
};

function templateNodeName(type: unknown): string {
	return typeof type === 'number'
		? (TEMPLATE_NODE_NAMES[type] ?? `NODE_${type}`)
		: `NODE_${String(type)}`;
}

const TEMPLATE_NODE_TYPE = { ELEMENT: 1, TEXT: 2, DIRECTIVE: 7 } as const;

type Parsed = {
	readonly descriptor: Node;
	readonly template: Node | null;
	/** Every directive node in the emitted template, in source order. */
	readonly directives: Node[];
	/** The `<script setup>` body as a Babel statement array. */
	readonly script: Node[];
	/** Line of the first `<script setup>` content character, for line reporting. */
	readonly scriptLineBase: number;
};

function lineOfScript(parsed: Parsed, node: Node): number | null {
	const line = node.loc?.start?.line;
	return typeof line === 'number' ? parsed.scriptLineBase + line - 1 : null;
}

function lineOfTemplate(node: Node): number | null {
	const line = node.loc?.start?.line;
	return typeof line === 'number' ? line : null;
}

/**
 * Parse a directive's expression as JavaScript.
 *
 * Wrapped in parentheses so that a value in EXPRESSION position - which is what
 * every directive value except `v-for` is - parses as one, rather than as a
 * statement that happens to look like a block. `v-for` is skipped by the only
 * caller, because `todo in todos` is not a JavaScript expression at all.
 */
function directiveExpressionAst(content: string): Node | null {
	try {
		return babelParse(`(\n${content}\n)`, { sourceType: 'module' }) as unknown as Node;
	} catch {
		// A directive value the emitter produced that Babel cannot read is already a
		// compile-time error upstream (`compileDiagnostics`) and an `eslint:parse`
		// violation here. Returning null keeps this walker from turning a parse
		// failure into a policy verdict it has no basis for.
		return null;
	}
}

// ---------------------------------------------------------------------------
// IR-7
// ---------------------------------------------------------------------------

/**
 * Methods whose whole purpose is to mutate their receiver. Deliberately NOT a
 * list of "calls" - `todos.value.filter(...)` inside a `computed` is correct and
 * must stay accepted, which is what stops this policy from degenerating into
 * "reject any call".
 */
const KNOWN_MUTATING_METHODS = new Set([
	'add',
	'append',
	'appendChild',
	'assign',
	'clear',
	'copyWithin',
	'defineProperty',
	'delete',
	'fill',
	'insertBefore',
	'pop',
	'push',
	'remove',
	'removeAttribute',
	'replaceChildren',
	'reverse',
	'set',
	'setAttribute',
	'shift',
	'sort',
	'splice',
	'unshift',
	'write',
]);

/**
 * IR-7 - THE CONSERVATIVE GUARD, NOT A PURITY PROOF.
 *
 * `ExpressionSite.expression` is an arbitrary AST node and the IR never asserts
 * that it is pure, while Vue's `computed()` requires a pure getter. Vue reports a
 * violation, if at all, as a DEV-ONLY warning - so absence of a red test is not
 * evidence of correctness here. S1's `computed` is trivial and will always pass,
 * which is exactly why the green it produces is a vacuum.
 *
 * A real purity proof is a compiler-wide change with no forcing case, so this is
 * the decidable subset instead: a syntactic reject-list applied to the EMITTER'S
 * OWN OUTPUT, which converts "silently wrong later" into "loudly wrong at gate
 * time" for the shapes it can see.
 *
 * WHAT IT CANNOT SEE, stated plainly rather than implied:
 *   - mutation performed inside a function the getter CALLS. `computed(() => f())`
 *     is accepted no matter what `f` assigns; the walk never leaves the getter.
 *   - a mutating method this list does not name, including any method on a
 *     user-defined object, and any mutation through a computed member access.
 *   - a getter with a side effect, which is syntactically indistinguishable from
 *     a property read.
 *   - anything reached through `eval`, `Function`, or a dynamic property name.
 * It is therefore SOUND ONLY as a reject-list: a violation is real, a pass is
 * not a proof.
 */
function impureNodes(argument: Node): Array<{ node: Node; reason: string }> {
	const found: Array<{ node: Node; reason: string }> = [];
	walk(argument, (node) => {
		if (node.type === 'AssignmentExpression')
			found.push({ node, reason: `assignment (${String(node.operator ?? '=')})` });
		else if (node.type === 'UpdateExpression')
			found.push({ node, reason: `update expression (${String(node.operator ?? '')})` });
		else if (node.type === 'UnaryExpression' && node.operator === 'delete')
			found.push({ node, reason: 'delete expression' });
		else if (
			(node.type === 'CallExpression' || node.type === 'NewExpression') &&
			node.callee?.type === 'MemberExpression' &&
			!node.callee.computed &&
			node.callee.property?.type === 'Identifier' &&
			KNOWN_MUTATING_METHODS.has(node.callee.property.name)
		)
			found.push({
				node,
				reason: `call to the known-mutating method .${node.callee.property.name}()`,
			});
	});
	return found;
}

function computedArguments(script: readonly Node[]): Node[] {
	const args: Node[] = [];
	walk(script, (node) => {
		if (
			node.type === 'CallExpression' &&
			node.callee?.type === 'Identifier' &&
			node.callee.name === 'computed' &&
			node.arguments?.length
		)
			args.push(node.arguments[0] as Node);
	});
	return args;
}

// ---------------------------------------------------------------------------
// the baseline form inventory
// ---------------------------------------------------------------------------

/**
 * THE PRECONDITION THIS ASSERTS.
 *
 * `frameless-vue-v1` T002 ruling 5 DEFERRED IR-4 and did NOT amend the emitter
 * idiom policy's version corollary. That corollary has two conjuncts, and the
 * second - "the emitter can know the version it is targeting" - is satisfiable
 * two ways: an explicit target-version input, or an emitter that emits ONLY
 * baseline-version-safe forms. This lane is the second way, and the policy's own
 * baseline-form-inventory section names it: "The Svelte lane is the second way.
 * So are Vue and Angular, by inheritance."
 *
 * That is a CLAIM ABOUT EMITTED OUTPUT, and it was already false-by-drift once in
 * the Svelte lane, which grew its emitted form set after the ruling with no
 * record and no check. This inventory is the assertion: an explicit allowlist of
 * every form the emitter may put in its output, each with the version floor
 * claimed for it and an honest statement of whether that floor was verified.
 * Emitted output carrying a form that is not on the list is a violation, so
 * growing the emitter's surface is a deliberate edit here rather than a silent
 * widening.
 *
 * FLOOR HONESTY IS THE POINT. A floor is a CLAIM about the earliest version at
 * which the form is available and means what the emitter needs; it is a lower
 * bound and need not be tight. `status: 'unverified'` carries the reason it could
 * not be checked, and a guessed floor recorded as verified is precisely the
 * failure this exists to stop. A `verified` entry must cite a file inside the
 * RESOLVED vue package and verbatim text in it; `test/gate.test.ts` re-reads every
 * citation, and calibrates that checker in both directions.
 *
 * WHAT IT CANNOT SEE, stated plainly: it reads emitted TEXT, so it cannot know
 * what a form MEANS at a version this repo does not have installed. It catches a
 * new form arriving unannounced. It does not catch a form whose semantics changed
 * under a fixed spelling - `const { x } = defineProps(...)` parses at every Vue 3
 * version and is only reactive from 3.5, which is why the floor column exists and
 * why it is not decoration.
 */
export type BaselineFormKind =
	| 'sfc-block'
	| 'template-node'
	| 'directive'
	| 'directive-modifier'
	| 'macro'
	| 'import';

export type FloorEvidence =
	| {
			readonly status: 'verified';
			/** Path INSIDE the resolved vue package. Re-read by the gate test. */
			readonly file: string;
			/** Verbatim text that must be present at that path. */
			readonly needle: string;
	  }
	| { readonly status: 'unverified'; readonly reason: string };

export type BaselineForm = {
	readonly kind: BaselineFormKind;
	readonly form: string;
	/** The earliest Vue version this inventory CLAIMS the form is safe at. */
	readonly floor: string;
	readonly evidence: FloorEvidence;
};

/**
 * EVERY FLOOR BELOW READS `unverified`, and the reason is a MEASURED property of
 * the resolved package rather than laziness: `vue@3.5.40` as installed ships NO
 * CHANGELOG and, unlike svelte, not a single `@since` tag - `grep -c '@since'`
 * over its shipped `.d.ts` files returns 0, and its type entry point is a
 * seven-line re-export of `@vue/runtime-dom`. There is therefore no artifact in
 * this repo that dates any of these forms. Presence at the pin is not a floor; it
 * is equally consistent with "3.0" and with "nobody wrote one down".
 */
const SCRIPT_SETUP_FLOOR_REASON =
	'3.2 is the release in which <script setup> and its compiler macros stopped being experimental, which is documentary evidence from the Vue release history - not from any artifact this repo has. The resolved vue@3.5.40 ships no CHANGELOG and no @since tag anywhere in its type declarations, so the floor could not be checked against something on disk.';

/**
 * THE RULING T010 DELIBERATELY LEFT UNMADE, made here (T009, Step 1.5).
 *
 * `script[setup,lang=ts]` REPLACES the bare `script[setup]` row rather than
 * joining it, on the SAME reasoning worked example 2a used when `:` and `@`
 * replaced the `v-bind`/`v-on` longhands a few rows below: this inventory is an
 * allowlist of every form the emitter MAY produce, and after Step 1.5 there is no
 * emission site left that can produce a bare `<script setup>`. Keeping both would
 * permit a form nothing emits - a silent widening - and would cost a regression to
 * the un-attributed spelling its second independent detector.
 *
 * THE FLOOR IS 3.2 BECAUSE `<script setup>` IS THE BINDING CONJUNCT, NOT `lang`.
 * A `lang` attribute on an SFC script block predates Vue 3 entirely, so it cannot
 * raise the floor above the row it replaces.
 */
const SCRIPT_SETUP_TS_FLOOR_REASON =
	'Same 3.2 as the bare <script setup> row it replaces, and for the same documentary reason: <script setup> is the binding conjunct, since a lang attribute on an SFC script block predates Vue 3 entirely and cannot raise the floor. RE-MEASURED at this task rather than inherited, against the vue this repo actually resolves (vue@3.5.40, @vue/compiler-sfc@3.5.40): the package ships no CHANGELOG, and @since appears zero times across its shipped type declarations, so NOTHING ON DISK DATES THIS FORM. What the pin does establish is that the form COMPILES there - compileScript accepts <script setup lang="ts"> over untyped source with an empty diagnostic set in all four COMPILE_MODES - and that is presence at the pin, not a floor, exactly as the shorthand row says of its own compiler-core citation. Recorded unverified for that reason.';

const DIRECTIVE_FLOOR_REASON =
	'The directive predates Vue 3 entirely and its longhand spelling is unchanged by it, so 3.0 is a safe lower bound rather than a tight one. Nothing in the resolved package dates it.';

const SHORTHAND_FLOOR_REASON =
	'The ":" and "@" shorthands predate Vue 3 entirely, so 3.0 is a safe lower bound rather than a tight one - the same footing the v-bind/v-on longhand rows sat on before worked example 2a replaced them. compiler-core@3.5.40 dist/compiler-core.cjs.js:2435 normalises ":" to bind and "@" to on inside ondirname at parse time, which proves the EQUIVALENCE and dates nothing: it is the code as shipped at the pin, not a record of the version the spelling arrived in. Nothing in the resolved package dates either spelling, so this floor is recorded unverified exactly as the longhand ones were, and upgrading it would be recording a floor nobody verified.';

const TEMPLATE_NODE_FLOOR_REASON =
	'A parse-tree node kind of the Vue 3 template compiler, present for the whole Vue 3 line, so 3.0 is a safe lower bound rather than a tight one. The number-to-name mapping is this gate\'s own; the resolved package dates neither the kind nor the numbering.';

const RUNTIME_IMPORT_FLOOR_REASON =
	'ref() and computed() are Vue 3 reactivity primitives present since the 3.0 composition API, which is documentary. The resolved package carries no @since tag and no CHANGELOG, so the floor could not be checked against an artifact this repo has.';

export const BASELINE_FORM_INVENTORY: readonly BaselineForm[] = [
	{
		kind: 'sfc-block',
		form: 'template',
		floor: '3.0',
		evidence: { status: 'unverified', reason: DIRECTIVE_FLOOR_REASON },
	},
	{
		kind: 'sfc-block',
		form: 'script[setup,lang=ts]',
		floor: '3.2',
		evidence: { status: 'unverified', reason: SCRIPT_SETUP_TS_FLOOR_REASON },
	},
	{
		kind: 'macro',
		form: 'defineProps',
		floor: '3.2',
		evidence: { status: 'unverified', reason: SCRIPT_SETUP_FLOOR_REASON },
	},
	{
		kind: 'import',
		form: 'vue#ref',
		floor: '3.0',
		evidence: { status: 'unverified', reason: RUNTIME_IMPORT_FLOOR_REASON },
	},
	{
		kind: 'import',
		form: 'vue#computed',
		floor: '3.0',
		evidence: { status: 'unverified', reason: RUNTIME_IMPORT_FLOOR_REASON },
	},
	...(['v-if', 'v-else', 'v-for'] as const).map(
		(form): BaselineForm => ({
			kind: 'directive',
			form,
			floor: '3.0',
			evidence: { status: 'unverified', reason: DIRECTIVE_FLOOR_REASON },
		}),
	),
	// `:` and `@` REPLACE the `v-bind` and `v-on` rows this list used to carry.
	// The inventory is an allowlist of every form the emitter MAY put in its
	// output, so leaving the longhands on it after worked example 2a's adoption
	// would permit a form no emission site can produce - a silent widening in the
	// other direction, and one that would cost a longhand regression its second
	// independent detector.
	...(['@', ':'] as const).map(
		(form): BaselineForm => ({
			kind: 'directive',
			form,
			floor: '3.0',
			evidence: { status: 'unverified', reason: SHORTHAND_FLOOR_REASON },
		}),
	),
	...(
		[
			'ROOT',
			'ELEMENT',
			'TEXT',
			'INTERPOLATION',
			'SIMPLE_EXPRESSION',
			'ATTRIBUTE',
			'DIRECTIVE',
		] as const
	).map(
		(form): BaselineForm => ({
			kind: 'template-node',
			form,
			floor: '3.0',
			evidence: { status: 'unverified', reason: TEMPLATE_NODE_FLOOR_REASON },
		}),
	),
];

const INVENTORY = new Set(BASELINE_FORM_INVENTORY.map((entry) => `${entry.kind}:${entry.form}`));

export type ObservedForm = {
	readonly kind: BaselineFormKind;
	readonly form: string;
	readonly line: number | null;
};

/**
 * The DIRECTIVE form as SPELLED, not as resolved.
 *
 * `v-bind:key` and `:key` are the same directive to Vue's parser - `name` is
 * `bind` for both, normalised inside `ondirname` at parse time - and they are NOT
 * the same form to this inventory, because choosing between them is the
 * emission-site decision `docs/emitter-idiom-policy.md` worked example 2a rules.
 * Reading `rawName` is what keeps the two apart. Since T006 adopted the shorthand
 * the polarity is reversed: `:` and `@` are the inventoried forms and a reverted
 * `v-bind:key` arrives here as the un-inventoried form `v-bind`, independently of
 * `require-directive-shorthand` reaching the same verdict from the other side.
 */
function directiveForm(directive: Node): string {
	const raw = String(directive.rawName ?? `v-${String(directive.name)}`);
	if (raw.startsWith('v-')) return raw.split(/[:.]/)[0]!;
	return raw.slice(0, 1);
}

function observeForms(parsed: Parsed): ObservedForm[] {
	const found: ObservedForm[] = [];
	const descriptor = parsed.descriptor;
	if (descriptor.template)
		found.push({
			kind: 'sfc-block',
			form: 'template',
			line: lineOfTemplate(descriptor.template as Node),
		});
	if (descriptor.script)
		found.push({
			kind: 'sfc-block',
			form: `script${descriptor.script.lang ? `[lang=${String(descriptor.script.lang)}]` : ''}`,
			line: lineOfTemplate(descriptor.script as Node),
		});
	if (descriptor.scriptSetup)
		found.push({
			kind: 'sfc-block',
			form: `script[setup${descriptor.scriptSetup.lang ? `,lang=${String(descriptor.scriptSetup.lang)}` : ''}]`,
			line: lineOfTemplate(descriptor.scriptSetup as Node),
		});
	for (const style of (descriptor.styles ?? []) as Node[])
		found.push({ kind: 'sfc-block', form: 'style', line: lineOfTemplate(style) });
	for (const block of (descriptor.customBlocks ?? []) as Node[])
		found.push({
			kind: 'sfc-block',
			form: `custom[${String(block.type)}]`,
			line: lineOfTemplate(block),
		});

	if (parsed.template)
		walk(parsed.template, (node) => {
			if (typeof node.type !== 'number') return;
			found.push({
				kind: 'template-node',
				form: templateNodeName(node.type),
				line: lineOfTemplate(node),
			});
			if (node.type !== TEMPLATE_NODE_TYPE.DIRECTIVE) return;
			const line = lineOfTemplate(node);
			found.push({ kind: 'directive', form: directiveForm(node), line });
			for (const modifier of (node.modifiers ?? []) as Array<Node | string>)
				found.push({
					kind: 'directive-modifier',
					form: String((modifier as Node)?.content ?? modifier),
					line,
				});
		});

	walk(parsed.script, (node) => {
		if (node.type === 'ImportDeclaration') {
			const from = String((node.source as Node | undefined)?.value ?? '?');
			const specifiers = (node.specifiers ?? []) as Node[];
			const line = lineOfScript(parsed, node);
			if (specifiers.length === 0) found.push({ kind: 'import', form: `${from}#*`, line });
			for (const specifier of specifiers)
				found.push({
					kind: 'import',
					form: `${from}#${
						specifier.type === 'ImportSpecifier'
							? String(specifier.imported?.name ?? '?')
							: specifier.type === 'ImportDefaultSpecifier'
								? 'default'
								: '*'
					}`,
					line,
				});
		}
		if (
			node.type === 'CallExpression' &&
			node.callee?.type === 'Identifier' &&
			/^(?:define[A-Z]|withDefaults$)/.test(String(node.callee.name))
		)
			found.push({
				kind: 'macro',
				form: String(node.callee.name),
				line: lineOfScript(parsed, node),
			});
	});
	return found;
}

/**
 * Every form the emitted source actually contains, deduped and sorted. Exported
 * because a fail-closed allowlist that observes NOTHING passes vacuously, and
 * `test/gate.test.ts` pins the observed set of the shipped corpus against a
 * literal - so a walk that stopped descending is a red test rather than a
 * silently green gate.
 */
export function collectEmittedForms(source: string): ReadonlyArray<{
	readonly kind: BaselineFormKind;
	readonly form: string;
}> {
	const parsed = parseEmitted('generated/inline.vue', source);
	if (!parsed) throw new Error('collectEmittedForms received a source Vue could not parse');
	const seen = new Set<string>();
	const forms: Array<{ kind: BaselineFormKind; form: string }> = [];
	for (const observation of observeForms(parsed)) {
		const key = `${observation.kind}:${observation.form}`;
		if (seen.has(key)) continue;
		seen.add(key);
		forms.push({ kind: observation.kind, form: observation.form });
	}
	return forms.sort((left, right) =>
		`${left.kind}:${left.form}`.localeCompare(`${right.kind}:${right.form}`),
	);
}

function inventoryViolations(file: string, parsed: Parsed): GateViolation[] {
	const violations: GateViolation[] = [];
	const reported = new Set<string>();
	for (const observation of observeForms(parsed)) {
		const key = `${observation.kind}:${observation.form}`;
		if (INVENTORY.has(key) || reported.has(key)) continue;
		reported.add(key);
		violations.push(
			violation(
				file,
				'baseline-form-inventory',
				`Emitted Vue source uses the ${observation.kind} form ${JSON.stringify(observation.form)}, which is not in the baseline form inventory. IR-4 is DEFERRED, so this emitter's only discharge of the version corollary's second conjunct is that it emits nothing but baseline-version-safe forms; a new form has to be added to BASELINE_FORM_INVENTORY with a recorded version floor and an honest floor-evidence status`,
				observation.line,
			),
		);
	}
	return violations;
}

// ---------------------------------------------------------------------------
// policies
// ---------------------------------------------------------------------------

function parseEmitted(file: string, source: string): Parsed | null {
	const { descriptor, errors } = parse(source, { filename: file });
	if (errors.length) return null;
	let script: Node[] = [];
	let scriptLineBase = 1;
	if (descriptor.scriptSetup) {
		scriptLineBase = descriptor.scriptSetup.loc.start.line;
		try {
			script = (compileScript(descriptor, { id: file, inlineTemplate: false })
				.scriptSetupAst ?? []) as unknown as Node[];
		} catch {
			script = [];
		}
	}
	const template = (descriptor.template?.ast ?? null) as Node | null;
	const directives: Node[] = [];
	if (template)
		walk(template, (node) => {
			if (node.type === TEMPLATE_NODE_TYPE.DIRECTIVE) directives.push(node);
		});
	return {
		descriptor: descriptor as unknown as Node,
		template,
		directives,
		script,
		scriptLineBase,
	};
}

/**
 * THE MEASURED WHITESPACE POLICY (T003 measurement M1), stated as a property of
 * the RESULT rather than of the layout that produced it.
 *
 * Vue's SFC template compiler defaults to `whitespace: 'condense'`, and
 * `descriptor.template.ast` is already condensed - MEASURED at 3.5.40, which is
 * what makes this readable straight off Vue's own tree instead of reimplementing
 * the rule. Condense removes a whitespace-only text node only when it is a first
 * or last child or sits between two elements with a newline in it; in every other
 * position it survives as a single space, and whitespace sharing a text node with
 * content is condensed rather than removed.
 *
 * All three of those failures land in the same observable, so one check catches
 * them all: AFTER CONDENSE, NO EMITTED TEXT NODE MAY CARRY LEADING OR TRAILING
 * WHITESPACE.
 *
 *   `<button>\n\tincrement\n</button>`  -> TEXT " increment "  rejected
 *   `<p>{{ a }}\n/{{ b }}</p>`          -> TEXT " /"           rejected, and this
 *                                          is S2's `1/2` becoming `1 /2`
 *   `<p>a</p> <span>b</span>`           -> TEXT " "            rejected
 *   the shipped layout                  -> the node is gone    accepted
 *
 * WHAT IT REFUSES THAT IS NOT AN EMITTER BUG: a declared IR text node that itself
 * begins or ends with whitespace. Condense's treatment of such a node depends on
 * its neighbours, so the emitter cannot place it safely and this fails closed
 * rather than emitting something whose rendering depends on where it landed.
 *
 * IT WALKS `children` ONLY, and that is not a shortcut. An `AttributeNode.value`
 * is ALSO a type-2 TEXT node in Vue's AST, so a generic walk reports every
 * `data-s1-root=""` in the corpus - measured on the first run of this policy.
 * Attribute values are not condensed and are not the observable.
 */
function condenseViolations(file: string, parsed: Parsed): GateViolation[] {
	const violations: GateViolation[] = [];
	const visit = (node: Node): void => {
		for (const child of (node.children ?? []) as Node[]) {
			if (child.type === TEMPLATE_NODE_TYPE.TEXT) {
				const content = String(child.content ?? '');
				if (content !== content.trim() || content.length === 0)
					violations.push(
						violation(
							file,
							'condense-stable-text',
							`Emitted Vue template has the condensed text node ${JSON.stringify(content)}, which carries leading or trailing whitespace. Vue's whitespace:'condense' default removes a whitespace-only node only between two elements across a newline and condenses it to a single space everywhere else, so this text would render differently from the react, solid, qwik and svelte lanes`,
							lineOfTemplate(child),
						),
					);
			}
			visit(child);
		}
	};
	if (parsed.template) visit(parsed.template);
	return violations;
}

/**
 * THE TWO SPELLINGS WORKED EXAMPLE 2a ADOPTED, keyed by the directive `name`
 * Vue's parser normalises to.
 *
 * Read off `@vue/compiler-core@3.5.40` `dist/compiler-core.cjs.js:2435`, inside
 * `ondirname`, verbatim:
 *
 *   const name = raw === "." || raw === ":" ? "bind" : raw === "@" ? "on"
 *     : raw === "#" ? "slot" : raw.slice(2);
 *
 * `.` is deliberately NOT here even though it also normalises to `bind`: it
 * pre-seeds a `prop` modifier, so it is a fourth form carrying extra semantics,
 * and `#`/`slot` is worked example 2b, ruled DENIED.
 */
const SHORTHAND_FOR: Readonly<Record<string, string | undefined>> = { bind: ':', on: '@' };

/**
 * The directives that are legitimately value-less, as a FAIL-CLOSED allowlist.
 *
 * `v-else` is the only member the emitter produces, and it takes no expression at
 * all. Everything else is required to carry one, so a value-less directive this
 * list does not name is a violation rather than a silent pass - including a
 * value-less `:x`, which is Vue 3.4's same-name shorthand and is exactly the
 * construct `directive-carries-value` exists to keep out.
 */
const DIRECTIVES_WITHOUT_A_VALUE = new Set(['else']);

/**
 * THE POLICIES THAT PIN THE EMITTED DIRECTIVE SPELLING, and the reason there are
 * three of them rather than one.
 *
 * `frameless-vue-v1` T005 MEASURED that no behavioural check can distinguish the
 * shorthand from the longhand, because they are behaviourally identical - empty
 * diagnostics, byte-identical codegen in all four modes, byte-identical SSR HTML.
 * A silent revert to `v-on:click` would have zero user-visible consequence and
 * draw no complaint from `@vue/compiler-sfc`, from `eslint-plugin-vue`'s applied
 * tier, or from the six-lane e2e. These text policies are therefore the ONLY
 * thing holding the adopted form, which is why worked example 2a required the
 * shorthand policy to be INVERTED rather than deleted.
 *
 * `require-directive-shorthand` pins the spelling in BOTH directions - a longhand
 * is a violation and so is a shorthand outside the adopted pair - and
 * `baseline-form-inventory` reaches the same two spellings independently, as
 * FORMS, from a different authority. `directive-carries-value` covers the
 * conjunct neither of them can see, because both read the form and not whether it
 * carries a value.
 */
function directiveViolations(file: string, parsed: Parsed): GateViolation[] {
	const violations: GateViolation[] = [];
	for (const directive of parsed.directives) {
		const raw = String(directive.rawName ?? `v-${String(directive.name)}`);
		const line = lineOfTemplate(directive);
		// THE SPELLING IS READ OFF `rawName`, NOT off `name`, and that is the whole
		// mechanism. `:` and `.` BOTH normalise to `name === 'bind'` inside
		// `ondirname`, so a policy keyed on `name` would accept `.foo="x"` as if it
		// were the adopted `:foo="x"`. `rawName` is the only field that survives the
		// normalisation.
		const shorthand = SHORTHAND_FOR[String(directive.name)];
		if (raw.startsWith('v-')) {
			if (shorthand)
				violations.push(
					violation(
						file,
						'require-directive-shorthand',
						`Emitted Vue source uses the directive longhand ${JSON.stringify(raw)}; docs/emitter-idiom-policy.md worked example 2a rules the VALUED v-bind and v-on shorthands SUGAR on all six gates and frameless-vue-v1 T006 adopted them at all three emission sites, so the emitted spelling is ${JSON.stringify(shorthand)}. Nothing upstream can see this: the two spellings are BEHAVIOURALLY IDENTICAL - measured byte-identical template codegen and production compileScript output in all four ssr x isProd modes, and byte-identical SSR HTML - so this text policy is the only thing pinning the form`,
						line,
					),
				);
		} else if (raw.slice(0, 1) !== shorthand)
			violations.push(
				violation(
					file,
					'require-directive-shorthand',
					`Emitted Vue source uses the directive shorthand ${JSON.stringify(raw)}, which is not one of the two forms worked example 2a adopted. The v-slot shorthand "#" is worked example 2b, ruled DENIED - G4 UNKNOWN, because there is no deciding function and the IR's only slot kind is default-slot-projection (IR-3), and G6 FAIL, because no check can exist for a path the emitter refuses to emit. The prop shorthand "." resolves to the SAME directive name as ":" and is told apart only by rawName: ondirname pre-seeds a prop modifier for it, which makes it a fourth form carrying extra semantics that no ruling covers`,
					line,
				),
			);
		if (!DIRECTIVES_WITHOUT_A_VALUE.has(String(directive.name))) {
			const exp = directive.exp as Node | undefined;
			if (!exp || String(exp.content ?? '').trim().length === 0)
				violations.push(
					violation(
						file,
						'directive-carries-value',
						`Emitted Vue source uses ${JSON.stringify(raw)} WITHOUT A VALUE. Worked example 2a adopts the shorthands WITH A VALUE only, and the value-less spelling is a separate, version-gated construct no other policy here can see: MEASURED at 3.5.40, a value-less ":count" and a value-less "v-bind:count" BOTH compile as Vue 3.4's same-name shorthand, which baseline-form-inventory accepts at its recorded floor of 3.0 because it reads the directive FORM and not whether it carries a value; a value-less v-on is a hard syntax error in both spellings. The hazard is symmetric and pre-existing, and this policy asserts that it cannot arrive rather than repairing it`,
						line,
					),
				);
		}
		const modifiers = ((directive.modifiers ?? []) as Array<Node | string>).map((modifier) =>
			String((modifier as Node)?.content ?? modifier),
		);
		if (modifiers.length)
			violations.push(
				violation(
					file,
					'no-directive-modifier',
					`Emitted Vue source uses the directive modifier(s) ${modifiers.join(', ')} on ${raw}; IR-5 declares two actions and they are emitted as ordinary in-body statements, and worked example 2a covers the ":" and "@" shorthands WITH A VALUE only - the modifier surface is explicitly outside it`,
					line,
				),
			);
		// TEMPLATE LIMB of `no-two-way-binding`, and it carries ITS OWN grounds.
		// This message used to justify itself with "worked example 3 is already
		// ruled DENIED at Gate 5" - and worked example 3 rules `defineEmits`, a
		// DIFFERENT macro. A correct rule resting on a borrowed reason, in a string
		// read at the moment someone decides whether to trust the rule. The script
		// limb below was repaired for the same defect by T008; this is the other
		// half, on `frameless-vue-v1` T009's own measurements against vue@3.5.40.
		//
		// THE COUNTS IN THIS MESSAGE ARE CHECKED, NOT JUST STATED. T010 folded them
		// in as figures nothing could falsify and S7 falsified them one commit
		// later. `test/gate.test.ts` now DERIVES the domain from the emitted
		// templates and asserts this string spells the derived value, with a
		// planted-scenario calibration proving the assertion moves. Editing
		// a number here without moving the corpus goes red; growing the corpus
		// without editing here goes red too.
		//
		// S10 (TodoMVC) MOVED BOTH FIGURES, AND THE RULING WAS RE-ARGUED RATHER
		// THAN RE-NUMBERED - `frameless-real-apps-v1` T006. The instrument did its
		// job: the corpus grew, this string went red, and it went red on the exact
		// two numbers. But going red only says "restate"; it does not say the
		// ruling still holds. Re-derived over the ten-scenario corpus: EIGHT ->
		// TWELVE instances, and the sugar's reach ONE -> THREE. The verdict is
		// unchanged because three of twelve is still a recognized subset, which is
		// Gate 4's own FAIL criterion; what CHANGED is the repair narrowing's
		// domain, from one shipped instance to three, and that makes the Gate 3
		// unsoundness reachable on three rather than one. The denial is stronger
		// than it was, not weaker, and the message now says which way it moved.
		// Also re-measured and UNCHANGED: every one of the nine handlers outside
		// the sugar's reach still calls `props.onTrace(...)`, so the message's
		// stated REASON survives the tenth scenario as well as its counts do.
		//
		// S12 (the CODEX CLONE) MOVED BOTH FIGURES AGAIN - `frameless-app-suite-v1`
		// T006 - and it is the FIRST scenario to move the domain by TAG rather than
		// by count. Eighteen -> NINETEEN instances, seven -> EIGHT applicable, and
		// the outside count is unchanged at ELEVEN, which is itself the datum: S12
		// added exactly one host to this domain and it landed INSIDE the sugar's
		// reach, so the ratio moved 39% -> 42% and the verdict did not, because a
		// recognized subset is Gate 4's FAIL criterion at either figure.
		// WHAT IS ACTUALLY NEW is that every one of the previous eighteen instances
		// was an `<input>`. S12's composer is the corpus's first `value`-bound
		// `<textarea>` - S7 has shipped a textarea since long before this entry
		// existed, but it binds `data-notes`, not `value` - so this domain has now
		// been shown to span two TAGS as well as two bound property kinds. That
		// matters to G5 and it was MEASURED on the new tag rather than assumed from
		// the input case; the fifth difference in the list below is one only a
		// textarea can exhibit, because an input has no text child to interpolate.
		//
		// S13 (the HACKER NEWS FRONT PAGE) MOVED BOTH FIGURES A THIRD TIME -
		// `frameless-app-axes-v1` T002 - AND ITS RE-ARGUMENT IS A NEGATIVE RESULT,
		// which is why it is written down rather than folded into the numbers.
		// Nineteen -> TWENTY instances, eight -> NINE applicable, outside unchanged
		// at ELEVEN again, ratio 42% -> 45%. The verdict is unchanged on Gate 4's
		// own criterion. What is worth recording is what did NOT move: S13's single
		// contribution is its footer search `<input>`, structurally identical to
		// S10's new-todo field, so the bound-property-kind span is still {value,
		// checked} and the tag span is still {input, textarea} and not one of the
		// five G5 differences below changes. The eleventh scenario added a property
		// kind and the twelfth added a tag; the thirteenth is a whole application
		// with sixty-two hosts and twenty-seven recorded events and it added
		// neither. That is the first evidence here that the G5 list is COMPLETE
		// rather than merely un-probed, and it is a stronger reading than another
		// renumbering would have been.
		// RE-DERIVED, NOT CARRIED: all eleven outside handlers still call
		// `props.onTrace(...)`, checked by walking the emitted templates with
		// `@vue/compiler-sfc` independently of `test/gate.test.ts`'s own walk.
		if (directive.name === 'model')
			violations.push(
				violation(
					file,
					'no-two-way-binding',
					'Emitted Vue source uses v-model. Worked example 12a rules this form DENIED on ITS OWN grounds, MEASURED against vue@3.5.40 - do not read it as worked example 3, which rules a different macro (defineEmits), and do not read it as denied at Gate 2, which it PASSES. G4 FAIL: the domain is every host renderHost() prints with a value/checked binding from attributesOf() plus a same-host event from eventAttribute(); re-enumerated over the thirteen-scenario corpus it holds TWENTY shipped instances and the sugar applies to NINE, because the other eleven handlers do strictly more than the assignment - they call props.onTrace(...), which is the e2e oracle observation channel, and v-model generates $event => ((x) = $event) and nothing else. THE ELEVENTH, TWELFTH AND THIRTEENTH SCENARIOS EACH RE-ARGUED THIS GATE RATHER THAN MERELY RENUMBERING IT. COUNTS FIRST: nine of twenty is still a recognized subset - 45%, against the 42% the twelfth scenario left, the 39% the eleventh left and the 25% the tenth did - so Gate 4 FAILs on exactly the criterion it failed on before, and the repair narrowing this entry recorded - handlers whose declared writes is exactly the bound node, whose reads is empty, and which carry no syncPolicy - has gone from ONE shipped instance (S2 event:0) to THREE (adding S10 event:2, S10 event:6) to SEVEN (adding S11 event:2, S11 event:5, S11 event:6, S11 event:10) to EIGHT (adding S12 event:4) to NINE (adding S13 event:26), each measured off the goldens by TWO INDEPENDENT DERIVATIONS THAT AGREE - one walking the emitted templates with @vue/compiler-sfc, one walking the compiler goldens handler ASTs. S11\'S GROUND WAS A SECOND BOUND PROPERTY KIND: every applicable instance before it bound value, so the narrowing had only ever been exercised on TEXT INPUTS, and S11 event:6 is the FIRST v-model-shaped checked instance in the corpus - so the G3 unsoundness below is reachable through event.currentTarget.checked as well as through event.currentTarget.value, and a matcher written against the .value shape alone would be wrong on a shipped handler. S12\'S GROUND IS A SECOND TAG, AND IT IS THE STRONGER OF THE TWO because it moves G5 rather than only G3: every one of the previous eighteen instances was an <input>, and S12\'s composer is the corpus\'s first value-bound <textarea> - S7 ships a textarea but binds data-notes, not value. The domain therefore spans two tags as well as two bound property kinds, and the fifth G5 difference listed below EXISTS ONLY ON THE NEW TAG. A candidate sugar whose correct cases have grown ninefold while staying a minority of its domain, and which has now crossed into a second bound property kind AND a second element type, has not moved toward totality; it has widened the surface on which the unchecked right-hand side would be wrong, and widened it onto a tag whose SSR behaviour differs in kind. G3 FAIL on the repair: StateWriteRecord (schema.ts:266) records operation "assign" and carries the right-hand side only as an AST, so draft = event.currentTarget.value and draft = otherEl.value are the SAME declared record, and separating them means matching the shape of an expression. G5 FAIL, five measured differences, the last of them measured on S12\'s new tag rather than carried over from the input case: the value stops being a vnode prop and the element LOSES the NEED_HYDRATION patch flag (40 PROPS|NEED_HYDRATION becomes 512 NEED_PATCH), reproduced on <textarea> as well as on <input>; vModelText.created attaches its own input/compositionstart/compositionend/change listeners and DROPS any input fired while el.composing is true; vModelText.mounted writes el.value unconditionally, on hydration too; on a checkbox the SSR OUTPUT itself gains an Array.isArray(...) ? ssrLooseContain(...) branch the baseline does not have; and ON A TEXTAREA THE TWO FORMS SSR-RENDER FROM DIFFERENT SOURCES ENTIRELY - the baseline emits ssrRenderAttrs(_temp0 = mergeProps({ value: _ctx.draft }, _attrs)) and then interpolates ("value" in _temp0) ? _temp0.value : "", so a parent-supplied value participates, while v-model emits ssrRenderAttrs(_attrs) and interpolates ssrInterpolate(_ctx.draft) directly, so it does not. That is a fallthrough-attribute semantic the input case cannot exhibit at all, because an input has no text child. S13\'S GROUND IS THE ONE NOBODY LOOKED FOR, AND IT IS A NEGATIVE: THE FOURTH WHOLE APPLICATION PRODUCED NO NEW SHAPE AT ALL. The HN front page contributes exactly ONE host to this domain - its footer search field - and that host is a plain <input> with a value bind and an input handler, structurally identical to S10\'s new-todo field. It moves the COUNT (nineteen -> twenty), the RATIO (42% -> 45%) and the narrowing\'s reach (eight -> nine), and it moves NEITHER the bound-property-kind span (still value and checked) NOR the tag span (still <input> and <textarea>), so not one of the five G5 differences below changes. THAT ABSENCE IS THE DATUM: the eleventh scenario added a property kind, the twelfth added a tag, and the thirteenth - a whole application with sixty-two hosts, twenty-seven recorded events and its own form - added neither, which is the first evidence in this corpus that the G5 list is COMPLETE rather than merely un-probed. THE ONE THING S13 DOES CARRY THAT NOTHING ELSE HERE DOES is an id attribute on the bound host, because a <label for> points at it; it is recorded because it is the first, and it is recorded as IRRELEVANT because vModelText is selected on type and not on any other attribute, so an id changes no lowering. AND THE STATED REASON WAS RE-DERIVED, NOT CARRIED: all ELEVEN handlers outside the sugar still call props.onTrace(...) - the outside count did not move, because S13\'s single new instance landed INSIDE the reach. G6 FAIL: no emitted artifact to regress. IR-1 and IR-2 are real gaps but they are NOT what denies this form, and IR-4 was never its blocker - v-model on a host element is not version-gated at all',
					line,
				),
			);
	}
	return violations;
}

const TYPE_ONLY_MACROS = new Set(['withDefaults']);

/**
 * THE `lang` LIMB THAT USED TO STAND HERE IS WITHDRAWN. T010, on measurement.
 *
 * It raised `no-typed-props` on `<script setup lang="...">` - the LANGUAGE
 * ATTRIBUTE, not a typed prop - and justified itself with "the IR carries no
 * prop type field (PropDestructuringEntry)". T003 supplied that field, so the
 * reason died; `s1-render-once`'s golden now carries four of them including a
 * full `TSFunctionType`. Two further measurements at 3.5.40 say the trigger was
 * never the right one even while the reason held:
 *
 *  - `<script setup lang="ts">` over UNTYPED source compiles clean and yields
 *    the IDENTICAL `props: ['label', 'multiplier', 'visible', 'onTrace']`
 *    option as the no-lang baseline. The only delta is a `defineComponent()`
 *    wrapper. A lang attribute does not imply a printed type; the coupling runs
 *    one way only, which is what makes Step 1.5 a legal seam.
 *  - REMOVING THIS LIMB OPENS NO HOLE, and that was measured rather than hoped.
 *    `baseline-form-inventory` refuses the very same mutant on ITS OWN grounds -
 *    the sfc-block form `script[setup,lang=ts]` is not in the recorded
 *    inventory and IR-4 is DEFERRED - and the type-argument limb below refuses
 *    `defineProps<T>()` and `withDefaults()` directly. TS the parser cannot read
 *    (type arguments with no `lang`) draws `eslint:parse`. Three independent
 *    refusals remain; this was the fourth, and the only one whose id, name and
 *    stated reason all pointed somewhere other than where it fired.
 *
 * SO THE VERDICT SURVIVES AND THIS LIMB DOES NOT. A `no-typed-props` violation
 * on a file containing zero types taught a reader nothing, and left the real
 * refusal - Gate 5, below - looking like a formality behind it. Note for
 * whoever runs Step 1.5: DELETING THIS DID NOT UNBLOCK THE `lang="ts"` FLIP.
 * `baseline-form-inventory` still refuses that form and must be given a
 * measured version floor first; that is a ruling, not a side effect.
 */
function scriptViolations(file: string, parsed: Parsed): GateViolation[] {
	const violations: GateViolation[] = [];
	walk(parsed.script, (node) => {
		if (node.type !== 'CallExpression' || node.callee?.type !== 'Identifier') return;
		const name = String(node.callee.name);
		const line = lineOfScript(parsed, node);
		// TWO MACROS, TWO BRANCHES, TWO MESSAGES.
		//
		// These shared one branch and one message until `frameless-vue-v1` T010,
		// and the shared message was entirely about `defineEmits` - so a
		// `defineModel` call was refused on another macro's grounds. Worked
		// examples 3 and 12b are different entries reaching the same answer by
		// different routes: 3 decides on the callback-prop call/emit delta, 12b on
		// the props/emits surface `defineModel` synthesizes. Neither reason
		// substitutes for the other, and the split is what keeps that true.
		//
		// The printed-entry and distinct-name counts below are DERIVED from the
		// compiler goldens by `test/gate.test.ts` and asserted against this string,
		// for the same reason as the template limb above.
		if (name === 'defineModel')
			violations.push(
				violation(
					file,
					'no-two-way-binding',
					'Emitted Vue source calls defineModel(). Worked example 12b rules it DENIED on ITS OWN grounds, MEASURED against vue@3.5.40. It is NOT worked example 3, which rules defineEmits, and it is NOT denied at Gate 2 - that prediction is REFUTED: useModel (runtime-core 3.5.40, useModel setter) reads the PARENT vnode props at runtime and falls back to a purely local value when the parent did not use v-model, so defineModel is the child module declaring itself and asks nothing of anyone. G4 FAIL: the domain is every PropDestructuringEntry propsDeclaration() prints into defineProps([...]); re-enumerated over the thirteen-scenario corpus it holds TWENTY-FIVE printed entries spanning seven distinct prop names, and the sugar applies to ZERO of them, because its precondition is the component writing back to the prop. The repair narrowing "props the component writes back to" is NOT STATABLE: every prop entry in every golden shares ONE graph node, prop:props, declared writable=false with zero writes, so per-prop write-back has no channel in the IR at all. THE ELEVENTH AND TWELFTH SCENARIOS WERE EACH RE-MEASURED AGAINST THIS CLAIM AND NEITHER DENTED IT, AND EACH WAS A STRICTLY STRONGER TEST THAN THE ONE BEFORE. S11 is TodoMVC ADVANCED - a second whole application and the first whose defining mechanism is ASYNCHRONOUS, with nineteen recorded events of which two suspend across an await. If any authoring were going to write back through a prop it would be a handler resuming from a remote answer, and none does. S12 is the CODEX CLONE, a THIRD whole application, the largest TEMPLATE in the corpus at fifty-three hosts, and the first module here to STREAM: one of its nine recorded events suspends THREE TIMES in a single handler and writes the message list after each resume. A streaming child pushing partial answers upward is the single most natural shape a written-back prop could take - it is what `defineModel` exists for - and this corpus\'s strongest available instance of it still declares exactly one printed entry, onTrace, a name already in the corpus, which is why the entry count moved from twenty-three to twenty-four while the distinct-name figure held at seven. Its prop graph is one node, prop:props, writable=false with zero writes. S13 is the HACKER NEWS FRONT PAGE, a FOURTH whole application and the FIRST one this repo emits in all SIX lanes, with sixty-two template hosts and twenty-seven recorded events; it is also the first module here whose defining problem is that IT HAS NO DOOR - fetch-on-render is unreachable in every lane, so every byte it renders is seeded in the component. A component that cannot ask its parent for data is the shape most likely to reach for a prop channel in the other direction, and it does not: one printed entry, onTrace, a name the corpus already had, so the entry count moved twenty-four -> twenty-five while the distinct-name figure held at seven for the fifth consecutive time. Its prop graph is one node, prop:props, writable=false with zero writes. FOUR whole applications, an async axis, a three-chunk stream and now a doorless page have each been the strongest available chance for a written-back prop to appear, and none produced one - so ZERO is re-derived here for the FIFTH time, not carried forward. That is IR-1, and it is distinct from IR-8, which is a missing prop TYPE field. G5 FAIL: defineModel("x") compiles to props: mergeModels([...], { x: {}, xModifiers: {} }) plus emits: ["update:x"] plus a customRef local, so the module SILENTLY gains a prop the author never declared, gains an emits option, and changes every read site from a value to a ref - and xModifiers COLLIDES with a legal frameless prop of that name with ZERO diagnostics, because mergeModels falls to extend({}, normalizePropsOrEmits(a), normalizePropsOrEmits(b)) and the synthesized object wins. That is the Vue instance of worked example 4 Angular count/countChange, measured here rather than borrowed. G6 FAIL: no emitted artifact to regress; this check pins the DENIAL, not the sugar. IR-4 was never the blocker - four gates FAIL at the version this repo ships, and FAIL outranks DEFERRED',
					line,
				),
			);
		// T008's message, MEASURED, and it folds through this split verbatim.
		if (name === 'defineEmits')
			violations.push(
				violation(
					file,
					'no-two-way-binding',
					`Emitted Vue source calls ${name}(); IR-1 gives no bindable prop kind and IR-2 gives no emit concept, and worked example 3 rules the defineEmits form DENIED at Gate 5 on three grounds T007 MEASURED against vue@3.5.40: with no handler supplied by the parent, the declared-prop baseline throws TypeError while emit() is a silent no-op; props.onTrace(...) returns the handler's value while emit(...) returns undefined; and the two forms resolve different parent spellings, with on-trace reaching the baseline only and onTraceOnce reaching emit() only. The fallthrough-$attrs rationale this message used to carry is WITHDRAWN as measured false - frameless DECLARES the callback prop, and a declared prop is held back from $attrs exactly as a declared emit is`,
					line,
				),
			);
		// THE REFUSAL SURVIVES. ITS REASON DOES NOT, AND THE REPLACEMENT WAS
		// MEASURED RATHER THAN REASONED.
		//
		// This message used to read "the IR carries no prop type field, so the
		// type would have to be invented from expression contents (IR-8,
		// deferred)". T003 SUPPLIED THAT FIELD. `PropDestructuringEntry.type`
		// exists, `s1-render-once`'s golden carries four of them including a full
		// `TSFunctionType`, and a deferral whose blocker has landed is not a
		// denial. Re-derived through all six gates at vue@3.5.40:
		//
		//   G3 now PASSES - the trigger "the entry declares a type" reads a
		//   DECLARED IR field, which is exactly what the old message said was
		//   unavailable. G4 is REPAIRABLE, so it does not decide either: annotation
		//   is per-component all-or-nothing in the corpus today (RenderOnce 4 of 4
		//   typed, the other seven goldens 0 of 15), so "components whose every
		//   entry carries a type" is a stated, emitter-decidable narrowing.
		//
		// G5 DECIDES, AND IT FAILS ON THREE RUNTIME MEASUREMENTS. The array form
		// compiles to `props: ['label', ...]`; the type-argument form compiles to
		// `props: { visible: { type: Boolean, required: true }, ... }` - runtime
		// prop OPTIONS, which the baseline has none of. Rendered both ways:
		//   1. `visible` absent -> baseline gives `undefined`, candidate gives
		//      `false`. Boolean casting invents a value.
		//   2. `visible=""` -> baseline gives the string `""`, which is FALSY;
		//      candidate gives `true`, which is TRUTHY. A `v-if` on that prop
		//      renders the other branch. This is a rendering change, not a typing
		//      one, and it lands on the ONE corpus component that could take the
		//      sugar today.
		//   3. Two diagnostics appear that the baseline never emits - `Missing
		//      required prop: "visible"` and `Invalid prop: type check failed`.
		//      `required: true` is synthesized from the TS type being
		//      non-optional, and NO IR FIELD DECLARES REQUIREDNESS - so the
		//      candidate asserts something about every prop that the IR never
		//      said, which is the invention the old message named in the wrong
		//      place.
		//
		// G6: this check pins the DENIAL, not the sugar. Re-open on a measurement
		// that these three deltas are gone or intended - NOT on IR-8, which has
		// already landed and did not change the answer.
		if (TYPE_ONLY_MACROS.has(name) || node.typeParameters || node.typeArguments)
			violations.push(
				violation(
					file,
					'no-typed-props',
					`Emitted Vue source calls ${name}() in its type-argument form. The IR-8 rationale this message used to carry is WITHDRAWN as measured false: PropDestructuringEntry DOES carry a type field since T003 and s1-render-once's golden holds four, so Gate 3 now PASSES on a declared trigger and Gate 4 is repairable by narrowing to components whose every entry is annotated (RenderOnce 4 of 4; the other seven goldens 0 of 15). GATE 5 DECIDES AND FAILS, measured at vue@3.5.40: the array form compiles to props: ['label', ...] while the type-argument form compiles to props: { visible: { type: Boolean, required: true }, ... }, and those runtime options change what renders - an absent "visible" goes from undefined to false, and visible="" goes from the FALSY string "" to a TRUTHY true, flipping any v-if reading it. Two diagnostics also appear that the baseline never emits, Missing required prop and Invalid prop type check failed, and the required:true they enforce is synthesized from TS non-optionality that NO IR FIELD DECLARES. Re-open on those three deltas, not on IR-8`,
					line,
				),
			);
	});
	return violations;
}

function stopPropagationViolations(file: string, parsed: Parsed): GateViolation[] {
	const violations: GateViolation[] = [];
	const scan = (root: unknown, line: number | null): void => {
		walk(root, (node) => {
			if (
				node.type === 'CallExpression' &&
				node.callee?.type === 'MemberExpression' &&
				!node.callee.computed &&
				node.callee.property?.type === 'Identifier' &&
				node.callee.property.name === 'stopPropagation'
			)
				violations.push(
					violation(
						file,
						'no-stop-propagation',
						'Emitted Vue source calls stopPropagation(); the corpus has zero instances across all thirteen goldens, so the emitter fails closed on the declared action rather than growing an emitter path nothing can test',
						line,
					),
				);
		});
	};
	scan(parsed.script, null);
	for (const directive of parsed.directives) {
		if (directive.name === 'for') continue;
		const exp = directive.exp as Node | undefined;
		if (!exp || typeof exp.content !== 'string') continue;
		const ast = directiveExpressionAst(exp.content);
		if (ast) scan(ast, lineOfTemplate(directive));
	}
	return violations;
}

async function sourceViolations(file: string, source: string): Promise<GateViolation[]> {
	const violations: GateViolation[] = [];
	if (!source.startsWith(GENERATED_HEADER))
		violations.push(
			violation(
				file,
				'generated-header',
				`Emitted Vue source must open with ${JSON.stringify(GENERATED_HEADER)}`,
				1,
			),
		);
	const parsed = parseEmitted(file, source);
	if (!parsed) {
		const { errors } = parse(source, { filename: file });
		return [
			...violations,
			violation(
				file,
				'generated-header',
				`@vue/compiler-sfc could not parse emitted source: ${errors.map(String).join('; ')}`,
			),
		];
	}
	violations.push(...inventoryViolations(file, parsed));
	violations.push(...condenseViolations(file, parsed));
	violations.push(...directiveViolations(file, parsed));
	violations.push(...scriptViolations(file, parsed));
	violations.push(...stopPropagationViolations(file, parsed));
	for (const argument of computedArguments(parsed.script))
		for (const { node, reason } of impureNodes(argument))
			violations.push(
				violation(
					file,
					'computed-expression-purity',
					`Emitted computed() getter contains a ${reason}; IR-7 never asserts purity, and Vue reports the violation - if at all - as a dev-only warning`,
					lineOfScript(parsed, node),
				),
			);
	return violations;
}

function persistenceViolations(file: string, artifact: EnrichedIR): GateViolation[] | undefined {
	const persistence = (artifact.records as { readonly persistence?: unknown }).persistence;
	if (!Array.isArray(persistence)) return undefined;
	if (persistence.length === 0) return [];
	return [
		violation(
			file,
			'persistence-render-lowering',
			'Vue emission fails closed on persistence-bearing IR; render-time persistence has no Vue lowering yet',
		),
	];
}

// ---------------------------------------------------------------------------
// entry points
// ---------------------------------------------------------------------------

async function collectVueFiles(root: string, directory: string): Promise<string[]> {
	const absolute = resolve(root, directory);
	const entries = await readdir(absolute, { withFileTypes: true }).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		},
	);
	const files: string[] = [];
	for (const entry of entries) {
		const child = resolve(absolute, entry.name);
		if (entry.isDirectory()) files.push(...(await collectVueFiles(root, relative(root, child))));
		else if (entry.isFile() && entry.name.endsWith('.vue'))
			files.push(normalize(relative(root, child)));
	}
	return files;
}

export async function discoverGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<string[]> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	return (await collectVueFiles(cwd, options.directory ?? 'generated')).sort();
}

/** ASYNC because `ESLint.lintText` is, matching the Svelte gate's signature. */
export async function checkSources(
	entries: ReadonlyArray<{
		readonly file: string;
		readonly source: string;
		readonly artifact?: EnrichedIR;
	}>,
): Promise<GateResult> {
	const violations: GateViolation[] = [];
	const unevaluatedPolicies = new Set<string>();
	for (const { file, source, artifact } of entries) {
		violations.push(...(await sourceViolations(file, source)));
		violations.push(...(await eslintViolations(file, source)));
		const artifactViolations = artifact ? persistenceViolations(file, artifact) : undefined;
		if (artifactViolations) violations.push(...artifactViolations);
		else unevaluatedPolicies.add('persistence-render-lowering');
	}
	const result = {
		files: entries.map((entry) => entry.file),
		policies: VUE_GATE_POLICIES,
		violations,
	} as unknown as GateResult;
	Object.defineProperty(result, 'unevaluated', {
		enumerable: false,
		value: [...unevaluatedPolicies].map((policy) => ({
			policy,
			reason: 'requires-artifact',
		})),
	});
	return result;
}

export async function checkGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<GateResult> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	const files = await discoverGeneratedFiles({ cwd, directory: options.directory });
	const entries = await Promise.all(
		files.map(async (file) => ({ file, source: await readFile(resolve(cwd, file), 'utf8') })),
	);
	return checkSources(entries);
}
