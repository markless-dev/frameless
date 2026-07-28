import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import sveltePlugin from 'eslint-plugin-svelte';
import { parse } from 'svelte/compiler';
import type { EnrichedIR } from '@frameless/compiler';
import { dirname, normalize, relative, resolve } from 'pathe';
import { SANCTIONED_SVELTE_IGNORE_CODES } from '../emitter/index.ts';

export type DossierRef =
	// Svelte 5 removed event modifiers; the two IR-5 actions become ordinary
	// in-body statements, and stopPropagation fails closed rather than growing an
	// untested on()-from-svelte/events path.
	| 'frameless-svelte-v1 T002 ruling 4'
	// IR-1 (bindable props) is out of scope on two independent axes, and its
	// failure mode is a DEV-ONLY console warning that passes tests.
	| 'frameless-svelte-v1 T002 ruling 5 (IR-1)'
	// IR-7: purity is never asserted while $derived expects a pure expression.
	// Conservative syntactic guard, not a purity proof.
	| 'frameless-svelte-v1 T002 ruling 5 (IR-7)'
	// IR-4 deferred, version corollary NOT amended: emit only baseline-safe forms.
	| 'frameless-svelte-v1 T002 ruling 3'
	// The BASELINE FORM INVENTORY - the explicit allowlist that asserts T002
	// ruling 3's second conjunct instead of assuming it.
	| 'frameless-svelte-v1 T005 baseline form inventory'
	// Warning-free emission with a fixed, sanctioned suppression list.
	| 'frameless-svelte-v1 T002 ruling 6'
	// Qwik's artifact-required policy, transposed: fail closed on persistence.
	| 'T002-qwik-architecture D8'
	// The THIRD-PARTY arbiter. T005 ruled the missing eslint-plugin-svelte import a
	// real gap in ARBITER INDEPENDENCE: every policy above encodes what WE decided,
	// while these encode what the Svelte team decided.
	| 'frameless-svelte-v1 T005 lint arbiter'
	// The whitespace layout the template printer depends on, MEASURED at 5.56.8.
	| 'frameless-svelte-v1 T003 measurement 3';

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

function persistenceArtifactPolicy() {
	const policy = {
		id: 'persistence-render-lowering',
		dossierRef: 'T002-qwik-architecture D8',
	} as const;
	Object.defineProperty(policy, 'requiresArtifact', { enumerable: false, value: true });
	return policy as typeof policy & { readonly requiresArtifact: true };
}

// ---------------------------------------------------------------------------
// the third-party arbiter (T005)
// ---------------------------------------------------------------------------

/**
 * THE GAP THIS CLOSES, in T005's words: the react, solid and qwik gates each
 * import their framework's own eslint plugin, and this one imported `parse` and
 * frameless-owned policies only. It is NOT a Gate 1 gap - `compile()` IS the
 * framework's own toolchain at the pin - it is a gap in ARBITER INDEPENDENCE.
 * Every other policy in this file encodes what THIS REPO decided; the rules
 * below encode what the Svelte team decided, and nothing here can quietly agree
 * with the emitter because nothing here was written next to it.
 *
 * The missing class is "compiles clean and is WRONG". It is not hypothetical:
 * defect 1 was named by eslint-plugin-qwik's `no-async-prevent-default` and
 * `compile()` could never have caught it. The Svelte instance of that class is
 * `svelte/require-each-key`: an unkeyed `{#each}` compiles with zero warnings,
 * reconciles by index, and is WRONG - and neither `compile()` nor any policy
 * above sees it, while the IR is carrying the key the whole time.
 *
 * WIRING. `configs.recommended` is a 4-entry flat-config array and is used
 * whole, because its `svelte:base:setup-for-svelte` entry already carries the
 * `files` globs, the `svelte-eslint-parser` instance and the processor. Picking
 * rules out of it by hand would mean re-deriving that wiring, and
 * `svelte-eslint-parser` is not directly resolvable from this package.
 */
export type OmittedEslintRule = {
	readonly rule: string;
	readonly reason: string;
};

/**
 * EXPLICIT OMISSIONS. Qwik records the same thing as
 * `QWIK_ESLINT_RULES_REQUIRING_TYPES`, for the same reason: a rule dropped
 * silently is indistinguishable from a rule that never fired, and the second one
 * is what an arbiter is supposed to make impossible.
 *
 * These three are turned OFF explicitly rather than left on-and-silent, because
 * an applied rule that CANNOT fire is a green vacuum sitting inside the applied
 * set. Everything not named here stays exactly as `recommended` set it.
 */
export const SVELTE_ESLINT_RULES_OMITTED: readonly OmittedEslintRule[] = [
	{
		rule: 'svelte/no-unused-props',
		reason:
			"REQUIRES TYPE INFORMATION - the qwik gate's *_REQUIRING_TYPES class exactly. lib/rules/no-unused-props.js calls getTypeScriptTools(context) and returns an empty visitor when there is no TypeScript PROGRAM, so it is silent BY CONSTRUCTION rather than by verdict. REASON RE-DERIVED: this used to say 'on plain emitted .svelte', and that description stopped being true when the emitter started writing <script lang=\"ts\">. The VERDICT IS UNCHANGED, because lang was never the trigger - measured at eslint-plugin-svelte 3.22.0, getTypeScriptTools returns null unless sourceCode.parserServices carries a `program` AND hasFullTypeInformation, which needs parserOptions.project. This gate sets no project, so the rule is silent over emitted output with or without lang=\"ts\". Unblocked by the same thing that unblocks qwik's two: a tsconfig covering emitted output wired into the parser, at which point it moves back into the applied set.",
	},
	{
		rule: 'svelte/require-event-dispatcher-types',
		reason:
			"INAPPLICABLE AT THE PIN. ONE OF THE THREE AXES THIS ENTRY USED TO NAME HAS DIED, AND IT IS RECORDED RATHER THAN DELETED. The dead one: the rule's create() sets isTs only for a <script lang=\"ts\"|\"typescript\"> block and returns at Program:exit when it is false - this entry said the emitter 'never produces' one, and since the lang=\"ts\" flip it always does, so that axis NO LONGER CONTRIBUTES. The verdict survives on the two that remain, both measured at eslint-plugin-svelte 3.22.0 / svelte 5.56.8: (1) its meta declares conditions: [{ svelteVersions: ['3/4'] }], and createRule's wrapper calls shouldRun(svelteContext, conditions) and returns an EMPTY VISITOR before create() ever runs, so at the 5.56.8 pin the rule cannot fire at all - this axis alone is decisive; (2) it reports only on a tracked ESM reference to createEventDispatcher from 'svelte', the Svelte 3/4 mechanism, and this emitter emits no such call anywhere (grep over src/ and generated/: zero occurrences).",
	},
	{
		rule: 'svelte/comment-directive',
		reason:
			"DISABLED DELIBERATELY, AND IT IS A STRENGTHENING, NOT A WEAKENING. This rule is the plugin's implementation of `<!-- eslint-disable -->` inside markup, and ESLint's own allowInlineConfig: false does NOT reach it. MEASURED at eslint-plugin-svelte 3.22.0 on the unkeyed-{#each} mutant: with this rule ON and one `<!-- eslint-disable svelte/require-each-key -->` in the markup the arbiter reported NOTHING; with it OFF the same mutant reported svelte/require-each-key. Emitted TEXT silencing the arbiter that is judging it is the one thing a gate over generated output must not permit. Off, no message can be suppressed, so the applied set can only ever report MORE. Nothing depends on it: svelte/no-unused-svelte-ignore computes its own unused set by re-running svelte's compiler.",
	},
];

const OMITTED_ESLINT_RULES = new Set(SVELTE_ESLINT_RULES_OMITTED.map((entry) => entry.rule));

/**
 * The rule ids `configs.recommended` actually leaves ENABLED, read off the config
 * itself rather than transcribed. Transcribing would freeze the set at the
 * version that was read: a rule added to `recommended` in a later
 * eslint-plugin-svelte would then be silently absent, which is the same failure
 * the omission list above exists to prevent, one level up.
 *
 * Later entries win, exactly as flat config resolves them - `recommended` turns
 * core `no-inner-declarations` and `no-self-assign` OFF in its base entry and
 * replaces the first with `svelte/no-inner-declarations`.
 */
function recommendedRuleSeverities(): Map<string, unknown> {
	const severities = new Map<string, unknown>();
	for (const entry of sveltePlugin.configs.recommended as ReadonlyArray<{
		readonly rules?: Readonly<Record<string, unknown>>;
	}>)
		for (const [rule, severity] of Object.entries(entry.rules ?? {}))
			severities.set(rule, severity);
	return severities;
}

/** Every `recommended` rule this gate actually runs, sorted. */
export const SVELTE_ESLINT_RULES_APPLIED: readonly string[] = [...recommendedRuleSeverities()]
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
			...(sveltePlugin.configs.recommended as never[]),
			{
				files: ['**/*.svelte'],
				rules: Object.fromEntries(
					SVELTE_ESLINT_RULES_OMITTED.map((entry) => [entry.rule, 'off']),
				),
			} as never,
		],
	});
	return cachedEslint;
}

/**
 * `eslint:` marks a THIRD-PARTY arbiter, following the qwik gate. The eight
 * frameless-owned policies in this file keep their BARE ids: unlike qwik's, they
 * are not eslint rules at all - they are hand-written walkers over svelte's own
 * parse tree - so a `frameless/` prefix would imply a plugin that does not exist.
 * The distinction the prefix carries is "who decided this", and here it is
 * carried by presence versus absence of `eslint:`.
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

const ESLINT_POLICIES = SVELTE_ESLINT_RULES_APPLIED.map((rule) => ({
	id: `eslint:${rule}`,
	dossierRef: 'frameless-svelte-v1 T005 lint arbiter' as const,
}));

export const SVELTE_GATE_POLICIES = [
	{ id: 'generated-header', dossierRef: 'frameless-svelte-v1 T002 ruling 6' },
	{ id: 'no-legacy-event-directive', dossierRef: 'frameless-svelte-v1 T002 ruling 3' },
	{ id: 'no-bindable', dossierRef: 'frameless-svelte-v1 T002 ruling 5 (IR-1)' },
	{ id: 'no-stop-propagation', dossierRef: 'frameless-svelte-v1 T002 ruling 4' },
	{ id: 'derived-expression-purity', dossierRef: 'frameless-svelte-v1 T002 ruling 5 (IR-7)' },
	{ id: 'sanctioned-svelte-ignore', dossierRef: 'frameless-svelte-v1 T002 ruling 6' },
	{
		id: 'no-inter-sibling-whitespace',
		dossierRef: 'frameless-svelte-v1 T003 measurement 3',
	},
	{
		id: 'baseline-form-inventory',
		dossierRef: 'frameless-svelte-v1 T005 baseline form inventory',
	},
	persistenceArtifactPolicy(),
	...ESLINT_POLICIES,
] as const satisfies readonly GatePolicy[];

const POLICIES = new Map<string, GatePolicy>(
	SVELTE_GATE_POLICIES.map((policy) => [policy.id, policy]),
);
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATED_HEADER = '<!-- @generated by @frameless/svelte';

type Node = Record<string, any>;

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
				? 'frameless-svelte-v1 T005 lint arbiter'
				: 'frameless-svelte-v1 T002 ruling 6'),
		message,
		line,
	};
}

function lineOf(source: string, offset: number | undefined): number | null {
	if (typeof offset !== 'number') return null;
	return source.slice(0, offset).split('\n').length;
}

/** Depth-first walk that never follows the `parent` back-references Svelte adds. */
function walk(value: unknown, visit: (record: Node) => void): void {
	if (!value || typeof value !== 'object') return;
	if (Array.isArray(value)) {
		value.forEach((entry) => walk(entry, visit));
		return;
	}
	const record = value as Node;
	visit(record);
	for (const [key, child] of Object.entries(record)) {
		if (key === 'parent' || key === 'metadata') continue;
		walk(child, visit);
	}
}

// ---------------------------------------------------------------------------
// IR-7
// ---------------------------------------------------------------------------

/**
 * Methods whose whole purpose is to mutate their receiver. Deliberately NOT a
 * list of "calls" - `todos.filter(...)` inside a `$derived` is correct and must
 * stay accepted, which is what stops this policy from degenerating into "reject
 * any call".
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
 * that it is pure, while `$derived` requires a pure, re-runnable expression.
 * Svelte reports a violation as `state_unsafe_mutation` or
 * `effect_update_depth_exceeded`, and some of those are DEV-ONLY - so absence of
 * a red test is not evidence of correctness here. S1's `$derived` is trivial and
 * will always pass, which is exactly why the green it produces is a vacuum.
 *
 * A real purity proof is a compiler-wide change with no forcing case, so this is
 * the decidable subset instead: a syntactic reject-list applied to the EMITTER'S
 * OWN OUTPUT, which converts "silently wrong later" into "loudly wrong at gate
 * time" for the shapes it can see.
 *
 * WHAT IT CANNOT SEE, stated plainly rather than implied:
 *   - mutation performed inside a function the expression CALLS. `$derived(f())`
 *     is accepted no matter what `f` assigns; the walk never leaves the
 *     expression.
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

function derivedArguments(instance: Node | null | undefined): Node[] {
	const args: Node[] = [];
	walk(instance, (node) => {
		if (node.type !== 'CallExpression') return;
		const callee = node.callee as Node | undefined;
		const isDerived =
			callee?.type === 'Identifier'
				? callee.name === '$derived'
				: callee?.type === 'MemberExpression' &&
					!callee.computed &&
					callee.object?.type === 'Identifier' &&
					callee.object.name === '$derived' &&
					callee.property?.type === 'Identifier' &&
					callee.property.name === 'by';
		if (isDerived && node.arguments?.length) args.push(node.arguments[0] as Node);
	});
	return args;
}

// ---------------------------------------------------------------------------
// the baseline form inventory
// ---------------------------------------------------------------------------

/**
 * THE PRECONDITION THIS ASSERTS.
 *
 * T002 ruling 3 DEFERRED IR-4 and did NOT amend the policy's version corollary.
 * That corollary has two conjuncts, and the second one - "the emitter can know
 * the version it is targeting" - is satisfiable two ways: an explicit
 * target-version input, or an emitter that emits ONLY baseline-version-safe
 * forms. This lane is the second way.
 *
 * Nothing asserted it. T003 then added two `svelte-ignore` codes AFTER T002
 * ruled, so "emits only baseline-safe forms" was already an unasserted
 * precondition over a GROWING set - instrument rule 2 at the emitter. This
 * inventory is the assertion: an explicit allowlist of every form the emitter
 * may put in its output, each with the version floor claimed for it and an
 * honest statement of whether that floor was verified. Emitted output carrying
 * a form that is not on the list is a violation, so growing the emitter's
 * surface is a deliberate edit here rather than a silent widening.
 *
 * FLOOR HONESTY IS THE POINT. A floor is a CLAIM about the earliest version at
 * which the form is available and means what the emitter needs; it is a lower
 * bound and need not be tight. `status: 'unverified'` carries the reason it
 * could not be checked, and a guessed floor recorded as verified is precisely
 * the failure this exists to stop. A `verified` entry must cite a file inside
 * the RESOLVED svelte package and verbatim text in it; `test/gate.test.ts`
 * re-reads every citation, and calibrates that checker in both directions.
 *
 * WHAT IT CANNOT SEE, stated plainly: it reads emitted TEXT, so it cannot know
 * what a form MEANS at a version this repo does not have installed. It catches
 * a new form arriving unannounced. It does not catch a form whose semantics
 * changed under a fixed spelling - `onclick={...}` parses in Svelte 4 too and
 * means something else entirely there, which is why the floor column exists and
 * why it is not decoration.
 */
export type BaselineFormKind =
	| 'rune'
	| 'import'
	| 'template-node'
	| 'event-attribute'
	| 'svelte-ignore-code';

export type FloorEvidence =
	| {
			readonly status: 'verified';
			/** Path INSIDE the resolved svelte package. Re-read by the gate test. */
			readonly file: string;
			/** Verbatim text that must be present at that path. */
			readonly needle: string;
	  }
	| { readonly status: 'unverified'; readonly reason: string };

export type BaselineForm = {
	readonly kind: BaselineFormKind;
	readonly form: string;
	/** The earliest Svelte version this inventory CLAIMS the form is safe at. */
	readonly floor: string;
	readonly evidence: FloorEvidence;
};

/**
 * MEASURED at 5.56.8, and the measurement is the reason every floor below reads
 * `unverified` rather than being asserted from the shipped types: the resolved
 * package documents a floor for exactly the members that arrived after 5.0
 * (`@since 5.20.0` on `$props.id`, `@since 5.36` on `settled`), and carries NO
 * tag on `$state`, `$derived`, `$props` or `untrack`. An ABSENT tag is not a
 * floor - it is equally consistent with "5.0" and with "nobody wrote one down" -
 * and the package ships no CHANGELOG. Recording 5.0 from T001's version-boundary
 * table is a claim; calling it verified would be the guess this file exists to
 * refuse.
 */
const RUNE_FLOOR_REASON =
	'5.0 is T001\'s version-boundary table, which is documentary. The resolved package declares this rune with no @since tag and ships no CHANGELOG, so the floor could not be checked against an artifact this repo has.';

const TEMPLATE_FLOOR_REASON =
	'The construct predates Svelte 5 and is unchanged by it, so 5.0 is a safe lower bound rather than a tight one. Nothing in the resolved package dates it.';

/**
 * The `svelte-ignore` entries are DERIVED from the emitter's own sanctioned list
 * so the two cannot drift apart.
 *
 * MEASURED at 5.56.8, three components x two generate modes x dev/prod, because
 * this board has twice recorded a different answer for it. What an emitted
 * module gets for an unrecognised code depends on whether the component is in
 * RUNES mode, and nothing in the emitter asserts that it is:
 *
 *   - runes component: `unknown_code` warns (and a Svelte 4 dash-case spelling
 *     warns `legacy_code`), and the real warnings still fire - the annotation
 *     does not suppress them.
 *   - runes-free component: NO diagnostic at all, and the real warnings still
 *     fire. Silent.
 *
 * The deciding line is `if (runes)` in the resolved package's
 * `src/compiler/utils/extract_svelte_ignore.js:38`: in runes mode an
 * unrecognised code is reported, in legacy mode it is pushed onto the ignore
 * list unreported, where it suppresses nothing.
 *
 * Both arms fail LOUDLY at emit time in THIS repo, because `assertCompilesClean`
 * fails on any warning at all and the unsuppressed a11y codes are warnings. The
 * exposure is at a CONSUMER's version, where nothing runs `assertCompilesClean`:
 * a consumer on a minor where one of these codes was renamed gets the a11y noise
 * with no diagnostic pointing at the cause, and in a runes-free emitted module
 * not even the rename is reported. That is why these codes are inventory
 * entries with floors, and why `svelteIgnoreNeedsRunesMode` below refuses an
 * annotation the compiler would not validate.
 */
const SVELTE_IGNORE_FLOOR_REASON =
	'MEASURED present at 5.56.8 (svelte/src/compiler/warnings.js `codes`, plus emit()\'s two-sided suppression check, which proves the code both fires and is suppressed). PRESENCE at the pin is not a FLOOR: nothing in the resolved package says when the code was introduced or whether it was renamed on the way.';

export const BASELINE_FORM_INVENTORY: readonly BaselineForm[] = [
	{
		kind: 'rune',
		form: '$state',
		floor: '5.0',
		evidence: { status: 'unverified', reason: RUNE_FLOOR_REASON },
	},
	{
		kind: 'rune',
		form: '$derived',
		floor: '5.0',
		evidence: { status: 'unverified', reason: RUNE_FLOOR_REASON },
	},
	{
		kind: 'rune',
		form: '$props',
		floor: '5.0',
		evidence: { status: 'unverified', reason: RUNE_FLOOR_REASON },
	},
	{
		kind: 'import',
		form: 'svelte#untrack',
		floor: '5.0',
		evidence: {
			status: 'unverified',
			reason: "5.0 is T001's version-boundary table, which is documentary. The resolved package declares untrack at types/index.d.ts:604 with no @since tag - immediately below a settled() that DOES carry @since 5.36 - and ships no CHANGELOG, so the floor could not be checked against an artifact this repo has.",
		},
	},
	...(
		[
			'Fragment',
			'RegularElement',
			'Text',
			'ExpressionTag',
			'Attribute',
			'Comment',
			'IfBlock',
			'EachBlock',
		] as const
	).map(
		(form): BaselineForm => ({
			kind: 'template-node',
			form,
			floor: '5.0',
			evidence: { status: 'unverified', reason: TEMPLATE_FLOOR_REASON },
		}),
	),
	{
		// STEP 4, BEHAVIORS - and THE FIRST ENTRY IN THIS INVENTORY WITH A VERIFIED
		// FLOOR, which is why the calibration test that asserted "every entry is
		// unverified" had to move.
		//
		// It is also the first entry that COSTS this lane version reach, and that is
		// stated rather than buried: every other form here floors at 5.0, and a module
		// carrying an `attach=` behavior floors at 5.29 instead. The cost is confined
		// to behavior-bearing modules - the eight goldens carry none - and it is
		// accepted because `{@attach}` is the ONLY member of this framework's
		// sanctioned set for the construct, not a preferred one. `use:` is outside the
		// set on measurement: `svelte/src/internal/client/dom/elements/actions.js`
		// calls the action inside `untrack(...)`, so the re-run obligation is
		// unreachable through it, and a synthesized `{update, destroy}` wrapper that
		// reaches it was measured to give the CLEANUP the post-change input value,
		// diverging from the shipped React and Solid lanes. See
		// docs/goals/frameless-emitter-capability-v1/notes/T006-effects.md.
		kind: 'template-node',
		form: 'AttachTag',
		floor: '5.29',
		evidence: {
			status: 'verified',
			file: 'types/index.d.ts',
			needle: '@since 5.29',
		},
	},
	{
		kind: 'event-attribute',
		form: 'on<name>',
		floor: '5.0',
		evidence: {
			status: 'unverified',
			reason: 'MEASURED at 5.56.8 that this is the form a runes component must use: the Svelte 4 `on:name` directive warns event_directive_deprecated in a runes component, and mixing the two spellings is the hard error mixed_event_handler_syntaxes. That measurement dates neither form - the same lexical shape parses in Svelte 4 and means a string attribute there, which is exactly why the floor matters and exactly why it is not verified.',
		},
	},
	...SANCTIONED_SVELTE_IGNORE_CODES.map(
		(form): BaselineForm => ({
			kind: 'svelte-ignore-code',
			form,
			floor: '5.0',
			evidence: { status: 'unverified', reason: SVELTE_IGNORE_FLOOR_REASON },
		}),
	),
];

const INVENTORY = new Set(
	BASELINE_FORM_INVENTORY.map((entry) => `${entry.kind}:${entry.form}`),
);

/** The shape of an event attribute an emitted runes component may carry. */
const EVENT_ATTRIBUTE_SHAPE = /^on[a-z]+$/;

/**
 * Fields of a Svelte template node that hold OTHER TEMPLATE NODES. Deliberately
 * an explicit list rather than "every key": `expression`, `test`, `key` and an
 * attribute's spread argument hold ESTree, which is a different vocabulary and
 * is checked by the rune and import observers instead.
 *
 * Fail-closed follows from the list being about EDGES, not node types: a node
 * kind this file has never seen still arrives as a child of a field named here,
 * and is observed - and then rejected, because it is not in the inventory.
 */
const TEMPLATE_CHILD_FIELDS = [
	'nodes',
	'fragment',
	'consequent',
	'alternate',
	'body',
	'pending',
	'then',
	'catch',
	'fallback',
	'attributes',
	'value',
] as const;

export type ObservedForm = {
	readonly kind: BaselineFormKind;
	readonly form: string;
	readonly line: number | null;
};

function observeTemplate(source: string, fragment: unknown, found: ObservedForm[]): void {
	const seen = new Set<unknown>();
	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		if (!value || typeof value !== 'object') return;
		const node = value as Node;
		if (typeof node.type !== 'string' || seen.has(node)) return;
		seen.add(node);
		const line = lineOf(source, node.start);
		found.push({ kind: 'template-node', form: node.type, line });
		if (node.type === 'Attribute' && /^on/i.test(String(node.name ?? '')))
			found.push({
				kind: 'event-attribute',
				form: EVENT_ATTRIBUTE_SHAPE.test(String(node.name)) ? 'on<name>' : String(node.name),
				line,
			});
		if (node.type === 'Comment') {
			const data = String(node.data ?? '').trim();
			if (data.startsWith('svelte-ignore'))
				for (const code of data
					.slice('svelte-ignore'.length)
					.split(/[\s,]+/)
					.filter(Boolean))
					found.push({ kind: 'svelte-ignore-code', form: code, line });
		}
		for (const field of TEMPLATE_CHILD_FIELDS) visit(node[field]);
	};
	visit(fragment);
}

/**
 * Runes are observed BY SPELLING, not by asking the compiler, because the
 * question is what the emitted TEXT contains. `$state.raw` is observed as
 * `$state.raw` and not as `$state`, so a member arriving on a rune this
 * inventory already allows is still a new form.
 *
 * `$$props` and `$$restProps` are compiler-internal and start with two dollars,
 * which the pattern excludes deliberately - they are never emitted, and they are
 * not forms this emitter chooses.
 */
const RUNE_IDENTIFIER = /^\$[A-Za-z]/;

function observeScript(source: string, scope: unknown, found: ObservedForm[]): void {
	walk(scope, (node) => {
		const line = lineOf(source, node.start as number | undefined);
		if (
			node.type === 'MemberExpression' &&
			!node.computed &&
			node.object?.type === 'Identifier' &&
			RUNE_IDENTIFIER.test(String(node.object.name)) &&
			node.property?.type === 'Identifier'
		) {
			found.push({
				kind: 'rune',
				form: `${String(node.object.name)}.${String(node.property.name)}`,
				line,
			});
			return;
		}
		if (node.type === 'Identifier' && RUNE_IDENTIFIER.test(String(node.name)))
			found.push({ kind: 'rune', form: String(node.name), line });
		if (node.type === 'ImportDeclaration') {
			const from = String((node.source as Node | undefined)?.value ?? '?');
			const specifiers = (node.specifiers ?? []) as Node[];
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
	});
}

/**
 * A `$state.raw` observation also emits a bare `$state` observation from the
 * member expression's own object identifier, which is on the inventory. Both are
 * kept: the set difference is what decides, and the bare one is a true statement
 * about the text.
 */
function observeForms(source: string, root: Node): ObservedForm[] {
	const found: ObservedForm[] = [];
	observeTemplate(source, root.fragment, found);
	for (const scope of [root.fragment, root.instance, root.module])
		observeScript(source, scope, found);
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
	const root = parse(source, { modern: true }) as unknown as Node;
	const seen = new Set<string>();
	const forms: Array<{ kind: BaselineFormKind; form: string }> = [];
	for (const observation of observeForms(source, root)) {
		const key = `${observation.kind}:${observation.form}`;
		if (seen.has(key)) continue;
		seen.add(key);
		forms.push({ kind: observation.kind, form: observation.form });
	}
	return forms.sort((left, right) =>
		`${left.kind}:${left.form}`.localeCompare(`${right.kind}:${right.form}`),
	);
}

function inventoryViolations(file: string, source: string, root: Node): GateViolation[] {
	const observations = observeForms(source, root);
	const violations: GateViolation[] = [];
	const reported = new Set<string>();
	for (const observation of observations) {
		const key = `${observation.kind}:${observation.form}`;
		if (INVENTORY.has(key) || reported.has(key)) continue;
		reported.add(key);
		violations.push(
			violation(
				file,
				'baseline-form-inventory',
				`Emitted Svelte source uses the ${observation.kind} form ${JSON.stringify(observation.form)}, which is not in the baseline form inventory. IR-4 is DEFERRED, so this emitter's only discharge of the version corollary's second conjunct is that it emits nothing but baseline-version-safe forms; a new form has to be added to BASELINE_FORM_INVENTORY with a recorded version floor and an honest floor-evidence status`,
				observation.line,
			),
		);
	}
	// The `svelte-ignore` codes above are only VALIDATED by the compiler in a
	// runes component - measured at 5.56.8, deciding line
	// `svelte/src/compiler/utils/extract_svelte_ignore.js:38`. In a runes-free
	// module an unrecognised code is silently accepted and suppresses nothing, so
	// an emitted annotation there is unguarded by anything upstream.
	const ignores = observations.filter((entry) => entry.kind === 'svelte-ignore-code');
	const hasRune = observations.some(
		(entry) => entry.kind === 'rune' && INVENTORY.has(`rune:${entry.form}`),
	);
	if (ignores.length && !hasRune)
		violations.push(
			violation(
				file,
				'baseline-form-inventory',
				`Emitted Svelte source carries a svelte-ignore annotation (${ignores
					.map((entry) => entry.form)
					.join(', ')}) but contains no rune, so Svelte compiles it in legacy mode and does NOT validate the codes - MEASURED at 5.56.8: an unrecognised code there produces no diagnostic at all and suppresses nothing`,
				ignores[0]!.line,
			),
		);
	return violations;
}

// ---------------------------------------------------------------------------
// policies
// ---------------------------------------------------------------------------

function isWhitespaceText(node: Node): boolean {
	return node.type === 'Text' && String(node.data ?? '').trim() === '';
}

/**
 * A node that survives into the DOM. Comments are stripped by the compiler and
 * whitespace-only text is what this policy is about, so neither counts as the
 * content a whitespace node could be sitting BETWEEN.
 *
 * This also covers a `<script>` block: `parse` lifts it into `root.instance` but
 * leaves the text around it in the fragment, so the emitted file's leading
 * whitespace arrives as two separate whitespace-only nodes at the top of the
 * root fragment. Neither has content before it, so neither is a violation.
 */
function isContentNode(node: Node): boolean {
	return node.type !== 'Comment' && !isWhitespaceText(node);
}

function sourceViolations(file: string, source: string): GateViolation[] {
	const violations: GateViolation[] = [];
	if (!source.startsWith(GENERATED_HEADER))
		violations.push(
			violation(
				file,
				'generated-header',
				`Emitted Svelte source must open with ${JSON.stringify(GENERATED_HEADER)}`,
				1,
			),
		);
	let root: Node;
	try {
		root = parse(source, { modern: true }) as unknown as Node;
	} catch (error) {
		return [
			...violations,
			violation(
				file,
				'generated-header',
				`svelte/compiler could not parse emitted source: ${(error as Error).message}`,
			),
		];
	}
	const instance = root.instance as Node | null;
	violations.push(...inventoryViolations(file, source, root));
	walk(root.fragment, (node) => {
		if (node.type === 'OnDirective')
			violations.push(
				violation(
					file,
					'no-legacy-event-directive',
					`Emitted Svelte source uses the legacy on:${String(node.name)} directive; Svelte 5 spells this as an on${String(node.name)} attribute and IR-4 is deferred, so only baseline-safe forms may be emitted`,
					lineOf(source, node.start),
				),
			);
		if (node.type === 'BindDirective')
			violations.push(
				violation(
					file,
					'no-bindable',
					`Emitted Svelte source uses bind:${String(node.name)}; two-way binding is out of scope and its failure mode is a dev-only console warning`,
					lineOf(source, node.start),
				),
			);
		if (node.type === 'Fragment') {
			const nodes = (node.nodes ?? []) as Node[];
			for (const [index, child] of nodes.entries()) {
				if (!isWhitespaceText(child)) continue;
				if (!nodes.slice(0, index).some(isContentNode)) continue;
				if (!nodes.slice(index + 1).some(isContentNode)) continue;
				violations.push(
					violation(
						file,
						'no-inter-sibling-whitespace',
						'Emitted Svelte source has whitespace between two siblings; Svelte keeps it as a single space while JSX drops it, so the emitted text content would diverge from the React and Solid lanes',
						lineOf(source, child.start),
					),
				);
			}
		}
		if (node.type === 'Comment') {
			const data = String(node.data ?? '').trim();
			if (!data.startsWith('svelte-ignore')) return;
			const codes = data
				.slice('svelte-ignore'.length)
				.split(/[\s,]+/)
				.filter(Boolean);
			for (const code of codes)
				if (!(SANCTIONED_SVELTE_IGNORE_CODES as readonly string[]).includes(code))
					violations.push(
						violation(
							file,
							'sanctioned-svelte-ignore',
							`Emitted Svelte source suppresses ${code}, which is not in the sanctioned set [${SANCTIONED_SVELTE_IGNORE_CODES.join(', ')}]`,
							lineOf(source, node.start),
						),
					);
		}
	});
	for (const scope of [root.fragment, instance])
		walk(scope, (node) => {
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
						'Emitted Svelte source calls stopPropagation(); Svelte 5 delegates click/input/change to the root and simulates propagation, and the emitter fails closed on the declared action rather than growing an untested on() path',
						lineOf(source, node.start),
					),
				);
			if (
				node.type === 'CallExpression' &&
				node.callee?.type === 'Identifier' &&
				node.callee.name === '$bindable'
			)
				violations.push(
					violation(
						file,
						'no-bindable',
						'Emitted Svelte source declares a $bindable prop; two-way binding is out of scope',
						lineOf(source, node.start),
					),
				);
		});
	for (const argument of derivedArguments(instance))
		for (const { node, reason } of impureNodes(argument))
			violations.push(
				violation(
					file,
					'derived-expression-purity',
					`Emitted $derived() expression contains a ${reason}; IR-7 never asserts purity, and Svelte reports the violation as state_unsafe_mutation or effect_update_depth_exceeded - some of them dev-only`,
					lineOf(source, node.start),
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
			'Svelte emission fails closed on persistence-bearing IR; render-time persistence has no Svelte lowering yet',
		),
	];
}

// ---------------------------------------------------------------------------
// entry points
// ---------------------------------------------------------------------------

async function collectSvelteFiles(root: string, directory: string): Promise<string[]> {
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
		if (entry.isDirectory())
			files.push(...(await collectSvelteFiles(root, relative(root, child))));
		else if (entry.isFile() && entry.name.endsWith('.svelte'))
			files.push(normalize(relative(root, child)));
	}
	return files;
}

export async function discoverGeneratedFiles(
	options: { readonly cwd?: string; readonly directory?: string } = {},
): Promise<string[]> {
	const cwd = resolve(options.cwd ?? PACKAGE_ROOT);
	return (await collectSvelteFiles(cwd, options.directory ?? 'generated')).sort();
}

/**
 * ASYNC because `ESLint.lintText` is. The change is confined to this package and
 * its test: `packages/cli/src/node-runtime.ts` already declares `checkSources`
 * as returning `Promise<GateResult>` and already awaits it, and `src/index.ts`
 * only re-exports.
 */
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
		violations.push(...sourceViolations(file, source));
		violations.push(...(await eslintViolations(file, source)));
		const artifactViolations = artifact ? persistenceViolations(file, artifact) : undefined;
		if (artifactViolations) violations.push(...artifactViolations);
		else unevaluatedPolicies.add('persistence-render-lowering');
	}
	const result = {
		files: entries.map((entry) => entry.file),
		policies: SVELTE_GATE_POLICIES,
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
