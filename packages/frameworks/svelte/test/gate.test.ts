import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { EnrichedIR } from '@frameless/compiler';
import { dirname, resolve } from 'pathe';
import { beforeAll, describe, expect, test } from 'vitest';
import { emit } from '../src/emitter/index.ts';
import type { GatePolicy } from '../src/gate/index.ts';
import {
	BASELINE_FORM_INVENTORY,
	checkGeneratedFiles,
	checkSources,
	collectEmittedForms,
	discoverGeneratedFiles,
	SVELTE_ESLINT_RULES_APPLIED,
	SVELTE_ESLINT_RULES_OMITTED,
	SVELTE_GATE_POLICIES,
} from '../src/gate/index.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');
const sveltePackageRoot = dirname(createRequire(import.meta.url).resolve('svelte/package.json'));

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(await readFile(resolve(compilerGoldenRoot, name), 'utf8')) as EnrichedIR;
}

/**
 * MUTATION CONSTRUCTOR - every mutant in this file is built with this. Copied
 * verbatim in intent from `packages/frameworks/qwik/test/gate.test.ts`, whose own
 * doc comment instructs a new adapter to do exactly this and NOT to reach for a
 * bare `.replace()`.
 *
 * `String.prototype.replace` promises to return a string, NOT to have matched.
 * When the search misses it returns the input unchanged, with no error, and the
 * test then asserts a gate policy against source the gate has every right to
 * accept - green while measuring nothing. That is defect 3 cause B
 * (defects-and-targets T006/T007), where a CRLF checkout made one Solid search
 * literal unmatchable and the row had been asserting against a non-mutant for as
 * long as it had existed. This corpus is exposed the same way: its mutants are
 * built from emitted files read off disk, which the emitter is free to reshape.
 *
 * The assertion is on the OUTPUT, not on the search: a search that matched but
 * changed nothing yields a non-mutant just the same, and is rejected the same.
 */
function mutate(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replace(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`gate mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert a policy against a non-mutant',
	);
}

/** `replaceAll` twin of `mutate`, with the same output-side precondition. */
function mutateAll(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replaceAll(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`gate mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert a policy against a non-mutant',
	);
}

let s1 = '';
let s2 = '';
let s3 = '';
beforeAll(async () => {
	[s1, s2, s3] = await Promise.all(
		['S1', 'S2', 'S3'].map((name) =>
			readFile(resolve(packageRoot, `generated/${name}.svelte`), 'utf8'),
		),
	);
});

async function policiesFor(file: string, source: string): Promise<string[]> {
	return (await checkSources([{ file, source }])).violations.map((entry) => entry.policy);
}

/** The messages the THIRD-PARTY arbiter produced, keyed by its `eslint:` prefix. */
async function eslintMessagesFor(
	file: string,
	source: string,
): Promise<Array<{ policy: string; message: string }>> {
	return (await checkSources([{ file, source }])).violations
		.filter((entry) => entry.policy.startsWith('eslint:'))
		.map((entry) => ({ policy: entry.policy, message: entry.message }));
}

/**
 * A floor recorded as `verified` has to cite an artifact that can be re-read, in
 * the RESOLVED svelte package rather than in a document. A missing file throws
 * rather than returning false: "the citation is gone" and "the citation is
 * wrong" are different failures and must not collapse into one another.
 */
async function citationHolds(citation: {
	readonly file: string;
	readonly needle: string;
}): Promise<boolean> {
	const text = await readFile(resolve(sveltePackageRoot, citation.file), 'utf8');
	return text.includes(citation.needle);
}

describe('Svelte dossier gate', () => {
	test('publishes independent source and artifact-required policies', () => {
		// The frameless-owned policies keep BARE ids; every third-party verdict is
		// prefixed `eslint:`. That prefix is the whole record of who decided a rule,
		// so it is pinned from both sides.
		expect(
			SVELTE_GATE_POLICIES.map((policy) => policy.id).filter(
				(id) => !id.startsWith('eslint:'),
			),
		).toEqual([
			'generated-header',
			'no-legacy-event-directive',
			'no-bindable',
			'no-stop-propagation',
			'derived-expression-purity',
			'sanctioned-svelte-ignore',
			'no-inter-sibling-whitespace',
			'baseline-form-inventory',
			'persistence-render-lowering',
		]);
		expect(
			SVELTE_GATE_POLICIES.map((policy) => policy.id).filter((id) =>
				id.startsWith('eslint:'),
			),
		).toEqual(SVELTE_ESLINT_RULES_APPLIED.map((rule) => `eslint:${rule}`));
		expect(
			(SVELTE_GATE_POLICIES as readonly GatePolicy[])
				.filter((policy) => policy.requiresArtifact)
				.map((policy) => policy.id),
		).toEqual(['persistence-render-lowering']);
	});

	test('discovers and accepts the clean S1/S2/S3 emitted corpus', async () => {
		expect(await discoverGeneratedFiles()).toEqual([
			'generated/S1.svelte',
			'generated/S2.svelte',
			'generated/S3.svelte',
		]);
		const result = await checkGeneratedFiles();
		// [] IS NOT SELF-EVIDENT EVIDENCE - every policy below carries a mutation
		// row proving it can reject, and the two anti-vacuity rows prove the two
		// policies most at risk of degenerating into "reject everything" do not.
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
		expect(result.unevaluated).toEqual([
			{ policy: 'persistence-render-lowering', reason: 'requires-artifact' },
		]);
		expect(Object.keys(result)).toEqual(['files', 'policies', 'violations']);
		for (const file of result.files)
			expect(await readFile(resolve(packageRoot, file), 'utf8')).toContain(
				'@generated by @frameless/svelte',
			);
	});

	// CALIBRATION for the mutation constructor itself. A helper nobody has watched
	// fail is not evidence that it can fail, and the failure it guards against is
	// silent by construction.
	test('CALIBRATION: a mutation that leaves the source unchanged is loud', () => {
		expect(() => mutate(s1, 'text that is not in the emitted S1', 'x')).toThrow(
			/did not change the source/,
		);
		expect(s1).toContain('$state(');
		expect(() => mutate(s1, '$state(', '$state(')).toThrow(/did not change the source/);
		expect(() => mutateAll(s1, 'text that is not in the emitted S1', 'x')).toThrow(
			/did not change the source/,
		);
	});

	test('MUTATION: rejects emitted source without the generated header', async () => {
		const mutant = mutate(s1, '<!-- @generated by @frameless/svelte', '<!-- hand written');
		expect(await policiesFor('generated/HeaderMutant.svelte', mutant)).toContain(
			'generated-header',
		);
	});

	test('MUTATION: rejects the Svelte 4 on:click directive spelling', async () => {
		// The same lexical substitution flips category across the major version -
		// the exact reason IR-4's version corollary is not amended. IR-4 is
		// DEFERRED, so only baseline-safe forms may be emitted.
		const mutant = mutate(s1, 'onclick={', 'on:click={');
		const policies = await policiesFor('generated/LegacyMutant.svelte', mutant);
		expect(policies).toContain('no-legacy-event-directive');
	});

	test('MUTATION: rejects bind: and $bindable, whose failure mode is a dev-only warning', async () => {
		const directive = mutate(s3, 'value={text}', 'bind:value={text}');
		expect(await policiesFor('generated/BindMutant.svelte', directive)).toContain('no-bindable');
		const bindable = mutate(s3, 'let { initial,', 'let { initial = $bindable(),');
		expect(await policiesFor('generated/BindableMutant.svelte', bindable)).toContain('no-bindable');
	});

	test('MUTATION: rejects stopPropagation, and the emitter refuses to produce it', async () => {
		const mutant = mutate(s3, 'event.preventDefault();', 'event.stopPropagation();');
		expect(await policiesFor('generated/StopPropagationMutant.svelte', mutant)).toContain(
			'no-stop-propagation',
		);
		// The gate is the second line. The first is the emitter: a declared
		// stopPropagation throws rather than growing an on()-from-svelte/events
		// path that the corpus has no instance to test.
		const artifact = structuredClone(await golden('s3-event-form.json'));
		const event = artifact.records.events.find((entry) => entry.syncPolicy)!;
		(event as unknown as { syncPolicy: { actions: string[] } }).syncPolicy.actions.push(
			'stopPropagation',
		);
		expect(() => emit(artifact)).toThrow(/fails closed on a declared stopPropagation/);
	});

	test('MUTATION: rejects an unsanctioned svelte-ignore code', async () => {
		const mutant = mutate(
			s3,
			'a11y_click_events_have_key_events',
			'state_unsafe_mutation',
		);
		const violations = (await checkSources([
			{ file: 'generated/IgnoreMutant.svelte', source: mutant },
		])).violations;
		expect(violations.map((entry) => entry.policy)).toContain('sanctioned-svelte-ignore');
		expect(violations.find((entry) => entry.policy === 'sanctioned-svelte-ignore')?.message)
			.toContain('state_unsafe_mutation');
		// TWO INDEPENDENT LINES on the same mutant. The sanctioned list is the
		// emitter's own; the inventory reaches it as a FORM with a version floor.
		// Neither is derived from the other's verdict.
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
	});

	test('MUTATION: rejects whitespace between two siblings', async () => {
		// MEASURED at 5.56.8: Svelte keeps this as a single space text node while
		// JSX drops the whole whitespace-only line, so the emitted text content
		// would diverge from React's and Solid's.
		const mutant = mutate(s1, /<\/output\n(\t*)>/, '</output>\n$1');
		expect(await policiesFor('generated/WhitespaceMutant.svelte', mutant)).toContain(
			'no-inter-sibling-whitespace',
		);
	});

	test('MUTATION: persistence-bearing IR fails closed in the gate and the emitter', async () => {
		const artifact = structuredClone(await golden('s1-render-once.json'));
		(artifact.records.persistence as unknown[]).push({ graphNodeId: 'state:count' });
		const result = await checkSources([
			{ file: 'generated/PersistenceMutant.svelte', source: s1, artifact },
		]);
		expect(result.unevaluated).toEqual([]);
		expect(result.violations).toEqual([
			expect.objectContaining({ policy: 'persistence-render-lowering' }),
		]);
		expect(() => emit(artifact)).toThrow(/does not support persistence-bearing IR/);
	});
});

/**
 * IR-7 - the sleeper. S1's `$derived` is trivial and will always pass, which is
 * the definition of a green vacuum, so the policy is calibrated against planted
 * members of the set it claims to catch (instrument rule 4) and against two
 * shapes it must NOT catch.
 */
describe('MUTATION: derived-expression-purity (IR-7)', () => {
	test('rejects an update expression inside $derived', async () => {
		const mutant = mutate(s1, 'count * multiplier', 'count++ * multiplier');
		const violations = (await checkSources([
			{ file: 'generated/DerivedUpdateMutant.svelte', source: mutant },
		])).violations;
		expect(violations.map((entry) => entry.policy)).toContain('derived-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'derived-expression-purity')?.message,
		).toContain('update expression');
	});

	test('rejects an assignment inside $derived', async () => {
		const mutant = mutate(s1, 'count * multiplier', '(count = 2) * multiplier');
		const violations = (await checkSources([
			{ file: 'generated/DerivedAssignMutant.svelte', source: mutant },
		])).violations;
		expect(violations.map((entry) => entry.policy)).toContain('derived-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'derived-expression-purity')?.message,
		).toContain('assignment');
	});

	test('rejects a known-mutating method call inside $derived', async () => {
		const mutant = mutate(s2, 'todos.filter((todo) => todo.done)', 'todos.sort()');
		const violations = (await checkSources([
			{ file: 'generated/DerivedSortMutant.svelte', source: mutant },
		])).violations;
		expect(violations.map((entry) => entry.policy)).toContain('derived-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'derived-expression-purity')?.message,
		).toContain('.sort()');
	});

	test('rejects a delete expression inside $derived', async () => {
		const mutant = mutate(s1, '${prefix}${count', '${delete globalThis.x}${count');
		expect(await policiesFor('generated/DerivedDeleteMutant.svelte', mutant)).toContain(
			'derived-expression-purity',
		);
	});

	test('ANTI-VACUITY: a non-mutating call and a mutation OUTSIDE $derived are accepted', async () => {
		// S2's own derived is `todos.filter(...).length`. If this policy were
		// "reject any call" the clean corpus would already be red, and every row
		// above would be measuring nothing.
		expect(s2).toContain('$derived(todos.filter((todo) => todo.done).length)');
		expect(await policiesFor('generated/S2.svelte', s2)).not.toContain(
			'derived-expression-purity',
		);
		// S2's handlers assign to `todos` and call `.slice()`/`.concat()` all over.
		// The policy reads $derived ancestry, not text.
		expect(s2).toContain('todos = todos.concat(item);');
		// And a planted assignment in a handler stays accepted - proving the walk
		// really is scoped to $derived arguments rather than to the whole script.
		const handlerMutant = mutateAll(s2, "draft = '';", "draft = ''; next = next + 1;");
		expect(await policiesFor('generated/HandlerMutant.svelte', handlerMutant)).not.toContain(
			'derived-expression-purity',
		);
	});

	test('states what it cannot see, so a pass is never read as a purity proof', async () => {
		// NOT a policy failure - a DOCUMENTED blind spot, pinned so that closing it
		// later is a deliberate change rather than an accident. `$derived(f())` is
		// accepted no matter what `f` does, because the walk never leaves the
		// expression.
		const source = [
			'<!-- @generated by @frameless/svelte from Blind; do not edit. -->',
			'<script>',
			'\tlet count = $state(1);',
			'\tfunction impure() {',
			'\t\tcount += 1;',
			'\t\treturn count;',
			'\t}',
			'\tconst derived = $derived(impure());',
			'</script>',
			'',
			'<p>{derived}</p>',
		].join('\n');
		expect(await policiesFor('generated/Blind.svelte', source)).not.toContain(
			'derived-expression-purity',
		);
	});
});

/**
 * THE BASELINE FORM INVENTORY (frameless-svelte-v1 T005).
 *
 * T002 ruling 3 deferred IR-4 and left the version corollary intact, and this
 * emitter discharges the corollary's second conjunct the OTHER way: by emitting
 * only baseline-version-safe forms. Nothing asserted that until now, and T003
 * had already grown the set once - so the population this guards is FUTURE
 * emitted forms, which is non-empty by construction.
 *
 * The order of the rows below is deliberate: the anti-vacuity row comes first,
 * because an allowlist whose walk observes nothing accepts everything and every
 * red row after it would be measuring the mutant rather than the policy.
 */
describe('MUTATION: baseline-form-inventory (T005)', () => {
	test('ANTI-VACUITY: the observed form set of the shipped corpus is pinned exactly', () => {
		// If the walk stopped descending, or a whole observer silently returned
		// nothing, the inventory would still be green on every mutant below - it
		// would just have stopped looking. This is the row that catches that, and
		// it is also the freshness pin: a fourth form appearing in emitted output
		// is a red test here before it is anything else.
		const common = [
			{ kind: 'event-attribute', form: 'on<name>' },
			{ kind: 'import', form: 'svelte#untrack' },
		];
		expect(collectEmittedForms(s1)).toEqual([
			...common,
			{ kind: 'rune', form: '$derived' },
			{ kind: 'rune', form: '$props' },
			{ kind: 'rune', form: '$state' },
			...['Attribute', 'Comment', 'ExpressionTag', 'Fragment', 'IfBlock', 'RegularElement', 'Text'].map(
				(form) => ({ kind: 'template-node', form }),
			),
		]);
		expect(collectEmittedForms(s2)).toEqual([
			...common,
			{ kind: 'rune', form: '$derived' },
			{ kind: 'rune', form: '$props' },
			{ kind: 'rune', form: '$state' },
			...[
				'Attribute',
				'Comment',
				'EachBlock',
				'ExpressionTag',
				'Fragment',
				'IfBlock',
				'RegularElement',
				'Text',
			].map((form) => ({ kind: 'template-node', form })),
		]);
		expect(collectEmittedForms(s3)).toEqual([
			...common,
			{ kind: 'rune', form: '$props' },
			{ kind: 'rune', form: '$state' },
			{ kind: 'svelte-ignore-code', form: 'a11y_click_events_have_key_events' },
			{ kind: 'svelte-ignore-code', form: 'a11y_no_noninteractive_element_interactions' },
			...['Attribute', 'Comment', 'ExpressionTag', 'Fragment', 'RegularElement', 'Text'].map(
				(form) => ({ kind: 'template-node', form }),
			),
		]);
		// And every observed form is on the inventory, which is the same claim the
		// clean-corpus row makes from the other side.
		const listed = new Set(
			BASELINE_FORM_INVENTORY.map((entry) => `${entry.kind}:${entry.form}`),
		);
		for (const source of [s1, s2, s3])
			for (const observed of collectEmittedForms(source))
				expect(listed).toContain(`${observed.kind}:${observed.form}`);
	});

	test('rejects a rune MEMBER form that the bare rune does not license', async () => {
		// `$state.raw` arrived at 5.19 and `$derived.by`, `$props.id` and
		// `$effect.pre` all have their own floors. Allowing `$state` must not
		// silently allow everything hanging off it.
		const mutant = mutate(s1, 'let count = $state(1);', 'let count = $state.raw(1);');
		const violations = (await checkSources([
			{ file: 'generated/RuneMemberMutant.svelte', source: mutant },
		])).violations;
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('$state.raw');
	});

	test('rejects an import of on() from svelte/events - worked example 6, in code', async () => {
		// The denied arm of the rewritten worked example 6. The emitter refuses a
		// declared stopPropagation at emit time; this is the independent check that
		// the on() vehicle cannot arrive by any other route either.
		const mutant = mutate(
			s1,
			"import { untrack } from 'svelte';",
			"import { untrack } from 'svelte';\n\timport { on } from 'svelte/events';",
		);
		const violations = (await checkSources([
			{ file: 'generated/ForeignImportMutant.svelte', source: mutant },
		])).violations;
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('svelte/events#on');
	});

	test('rejects template forms above the 5.0 baseline: {@html}, {@attach}, {#key}', async () => {
		// {@attach} is 5.29 and is one of the four constructs T005 recorded as
		// satisfying the corollary's FIRST conjunct at 5.56.8 and failing the second
		// one alone. This is where that ruling is enforced rather than described.
		const html = mutate(s1, '{derived}', '{@html derived}');
		expect(await policiesFor('generated/HtmlTagMutant.svelte', html)).toContain(
			'baseline-form-inventory',
		);
		const attach = mutate(s1, 'data-s1-root=""', 'data-s1-root="" {@attach (node) => {}}');
		const attachViolations = (await checkSources([
			{ file: 'generated/AttachMutant.svelte', source: attach },
		])).violations;
		expect(attachViolations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			attachViolations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('AttachTag');
		const key = mutate(
			mutate(s2, '{#if todos.length === 0}', '{#key todos.length}{#if todos.length === 0}'),
			'{/if}',
			'{/if}{/key}',
		);
		expect(await policiesFor('generated/KeyBlockMutant.svelte', key)).toContain(
			'baseline-form-inventory',
		);
	});

	test('rejects a camelCased event attribute, which Svelte accepts and ignores', async () => {
		// `onClick={...}` parses, compiles, and is simply a dead attribute - the
		// exact "compiles clean and is WRONG" class. The shape is inventoried, not
		// the event names, so this stays total over an open set of event names.
		const mutant = mutate(s3, 'onclick={', 'onClick={');
		const violations = (await checkSources([
			{ file: 'generated/CamelEventMutant.svelte', source: mutant },
		])).violations;
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('onClick');
	});

	test('rejects a svelte-ignore annotation in a component with no rune', async () => {
		// MEASURED at 5.56.8, deciding line
		// svelte/src/compiler/utils/extract_svelte_ignore.js:38 `if (runes)`:
		//   runes component     -> an unrecognised code WARNS unknown_code
		//   runes-free component -> NO diagnostic at all, and it suppresses nothing
		// Both arms still fail to suppress. So an emitted annotation in a runes-free
		// module is validated by nobody, and this refuses to emit into that hole.
		const runesFree = mutateAll(
			mutate(s3, 'let { initial, onTrace } = $props();', 'export let initial, onTrace;'),
			'$state(',
			'(',
		);
		const violations = (await checkSources([
			{ file: 'generated/RunesFreeMutant.svelte', source: runesFree },
		])).violations;
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('legacy mode');
	});

	test('every recorded floor is a claim with an evidence status attached to it', async () => {
		expect(BASELINE_FORM_INVENTORY.length).toBeGreaterThan(0);
		for (const entry of BASELINE_FORM_INVENTORY) {
			expect(entry.floor, `${entry.kind}:${entry.form}`).toMatch(/^\d+\.\d+/);
			if (entry.evidence.status === 'unverified') {
				// The REASON is the deliverable. "unverified" with no reason is a
				// guess wearing an honest label.
				expect(entry.evidence.reason.length, `${entry.kind}:${entry.form}`).toBeGreaterThan(
					40,
				);
				continue;
			}
			await expect(
				citationHolds(entry.evidence),
				`${entry.kind}:${entry.form} cites ${entry.evidence.file}`,
			).resolves.toBe(true);
		}
	});

	test('CALIBRATION: a verified floor citation is re-read, and can fail', async () => {
		// EVERY entry is `unverified` today, so the loop above never enters its
		// verified branch and would be vacuous on its own. This plants both arms.
		// The real one is `$props.id()`, which the resolved package's own shipped
		// types date at 5.20.0 - the shape a verified floor has to have.
		await expect(
			citationHolds({ file: 'types/index.d.ts', needle: '@since 5.20.0' }),
		).resolves.toBe(true);
		await expect(
			citationHolds({ file: 'types/index.d.ts', needle: '@since 0.1.0-not-a-real-tag' }),
		).resolves.toBe(false);
		await expect(
			citationHolds({ file: 'types/there-is-no-such-file.d.ts', needle: 'x' }),
		).rejects.toThrow();
		expect(
			BASELINE_FORM_INVENTORY.every((entry) => entry.evidence.status === 'unverified'),
			'if this fails a floor was verified - good; delete this line and keep the loop above',
		).toBe(true);
	});
});

/**
 * THE THIRD-PARTY ARBITER (frameless-svelte-v1 T005, implemented by T009).
 *
 * Every policy above encodes what THIS REPO decided. These encode what the Svelte
 * team decided, and the whole point is that nobody here got a vote.
 *
 * TWO-SIDED BY CONSTRUCTION. The green side is the shipped corpus drawing ZERO
 * messages from all 34 applied rules; the red side is four planted violations,
 * each asserted by RULE ID and by the upstream MESSAGE TEXT rather than by "some
 * violation appeared". A gate that has only ever been green is not evidence, and
 * a gate that cannot be shown to go red is not a gate.
 */
describe('third-party arbiter: eslint-plugin-svelte (T009)', () => {
	test('GREEN SIDE: the shipped corpus draws no message from any applied rule', async () => {
		for (const [name, source] of [
			['S1', s1],
			['S2', s2],
			['S3', s3],
		] as const)
			expect(
				await eslintMessagesFor(`generated/${name}.svelte`, source),
				`${name} drew an upstream message`,
			).toEqual([]);
		// ANTI-VACUITY for the green side itself: an arbiter wired to nothing is
		// also green. The applied set is non-trivial and the omissions are named.
		expect(SVELTE_ESLINT_RULES_APPLIED.length).toBeGreaterThan(30);
		expect(SVELTE_ESLINT_RULES_APPLIED).toContain('svelte/require-each-key');
	});

	/**
	 * THE ROW THAT EARNS THE ARBITER ITS KEEP.
	 *
	 * An unkeyed `{#each}` compiles with ZERO warnings, so `compile()` - the Gate 1
	 * oracle this lane already had - cannot see it. No frameless policy sees it
	 * either: nothing above reads block keys. And it is WRONG, not stylistic -
	 * Svelte reconciles an unkeyed block by index, so removing or reordering a todo
	 * re-associates the surviving DOM with the wrong item. S2's IR carries
	 * `todo.id` the entire time.
	 *
	 * That is exactly the missing class T005 named: "compiles clean and is WRONG",
	 * the Svelte twin of defect 1, which eslint-plugin-qwik's
	 * `no-async-prevent-default` caught and `compile()` never could have.
	 */
	test('RED: svelte/require-each-key catches an unkeyed {#each} that compiles clean', async () => {
		const mutant = mutate(s2, '{#each todos as todo (todo.id)}', '{#each todos as todo}');
		expect(await eslintMessagesFor('generated/EachKeyMutant.svelte', mutant)).toEqual([
			{ policy: 'eslint:svelte/require-each-key', message: 'Each block should have a key' },
		]);
		// The other side of the claim: NOTHING ELSE in this gate objects, and the
		// Svelte compiler itself is silent. Without the arbiter this mutant ships.
		expect(await policiesFor('generated/EachKeyMutant.svelte', mutant)).toEqual([
			'eslint:svelte/require-each-key',
		]);
	});

	test('RED: svelte/no-at-html-tags, independently of the baseline form inventory', async () => {
		const mutant = mutate(s1, '{derived}', '{@html derived}');
		expect(await eslintMessagesFor('generated/HtmlArbiterMutant.svelte', mutant)).toEqual([
			{
				policy: 'eslint:svelte/no-at-html-tags',
				message: '`{@html}` can lead to XSS attack.',
			},
		]);
		// TWO INDEPENDENT LINES on one mutant, from two independent authorities: the
		// inventory rejects `{@html}` as an un-inventoried FORM, upstream rejects it
		// as an XSS vector. Neither verdict is derived from the other's.
		expect(await policiesFor('generated/HtmlArbiterMutant.svelte', mutant)).toContain(
			'baseline-form-inventory',
		);
	});

	/**
	 * INDEPENDENT THIRD-PARTY CONFIRMATION of T003's two-sided suppression claim.
	 *
	 * This rule re-runs svelte's own compiler and reports any `svelte-ignore` that
	 * suppressed NOTHING. It is silent on S3's two shipped codes - which is upstream
	 * agreeing, by a mechanism this repo did not write, that both codes really do
	 * fire and really are suppressed. A third `svelte-ignore` planted on S1, where
	 * no a11y warning exists to suppress, is reported immediately.
	 */
	test('RED: svelte/no-unused-svelte-ignore, and it is SILENT on S3 shipped codes', async () => {
		const mutant = mutate(
			s1,
			'<div data-s1-root=""',
			'<!-- svelte-ignore a11y_click_events_have_key_events --><div data-s1-root=""',
		);
		expect(await eslintMessagesFor('generated/UnusedIgnoreMutant.svelte', mutant)).toEqual([
			{
				policy: 'eslint:svelte/no-unused-svelte-ignore',
				message: 'svelte-ignore comment is used, but not warned',
			},
		]);
		expect(s3).toContain(
			'<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->',
		);
		expect(await eslintMessagesFor('generated/S3.svelte', s3)).toEqual([]);
	});

	test('RED: svelte/no-useless-mustaches', async () => {
		const mutant = mutate(s1, '>increment<', ">{'increment'}<");
		expect(await eslintMessagesFor('generated/MustacheMutant.svelte', mutant)).toEqual([
			{
				policy: 'eslint:svelte/no-useless-mustaches',
				message: 'Unexpected mustache interpolation with a string literal value.',
			},
		]);
	});

	/**
	 * THE FOUR RULES THAT WERE MEASURED SILENT during wiring, resolved rather than
	 * left as "unknown". The question was whether each needed type information or
	 * whether the PLANT was malformed. The answer, for all four: THE PLANT WAS
	 * MALFORMED. None of the four reads TypeScript - none imports `ts-utils` or
	 * calls `getTypeScriptTools` - and each fires on a well-formed plant below.
	 *
	 * These rows exist because "it did not fire" is the one observation that looks
	 * identical whether the instrument is working or absent.
	 */
	test('RESOLVED: four rules measured silent were malformed plants, not type-gated', async () => {
		// 1. no-not-function-handler. The first plants were SYNTAX ERRORS, which
		//    never reach any rule; a parse failure surfaces as `eslint:parse`.
		const handler = mutate(
			s1,
			'<p data-branch="hidden">hidden</p>',
			'<p data-branch="hidden" onclick={\'nope\'}>hidden</p>',
		);
		expect(
			(await eslintMessagesFor('generated/HandlerLiteralMutant.svelte', handler)).map(
				(entry) => entry.policy,
			),
		).toContain('eslint:svelte/no-not-function-handler');

		// 2. no-dom-manipulating. Not type-gated either - but its ONLY trigger is a
		//    variable bound by `bind:this={id}` (lib/rules/no-dom-manipulating.js
		//    keys on SvelteDirective[kind='Binding']). `no-bindable` rejects that
		//    form one policy earlier, so upstream can only ever speak here on a
		//    mutant this gate has ALREADY rejected. Recorded, not papered over.
		const dom = mutate(
			mutate(s1, 'let count = $state(1);', 'let count = $state(1);\n\tlet node;'),
			'<p data-branch="hidden">',
			'<p bind:this={node} data-branch="hidden">',
		).replace('count++;', 'count++;\n\t\t\t\t\tnode.remove();');
		const domPolicies = await policiesFor('generated/DomManipulationMutant.svelte', dom);
		expect(domPolicies).toContain('eslint:svelte/no-dom-manipulating');
		expect(domPolicies).toContain('no-bindable');

		// 3. prefer-svelte-reactivity.
		const mutableSet = mutate(
			s1,
			'let count = $state(1);',
			'let count = $state(1);\n\tconst seen = new Set();\n\tseen.add(1);',
		);
		expect(await eslintMessagesFor('generated/MutableSetMutant.svelte', mutableSet)).toEqual([
			{
				policy: 'eslint:svelte/prefer-svelte-reactivity',
				message:
					'Found a mutable instance of the built-in Set class. Use SvelteSet instead.',
			},
		]);

		// 4. no-unnecessary-state-wrap.
		const stateWrap = mutate(
			mutate(
				s1,
				"import { untrack } from 'svelte';",
				"import { untrack } from 'svelte';\n\timport { SvelteSet } from 'svelte/reactivity';",
			),
			'let count = $state(1);',
			'let count = $state(1);\n\tlet seen = $state(new SvelteSet());',
		);
		expect(
			await eslintMessagesFor('generated/StateWrapMutant.svelte', stateWrap),
		).toEqual([
			{
				policy: 'eslint:svelte/no-unnecessary-state-wrap',
				message: 'SvelteSet is already reactive, $state wrapping is unnecessary.',
			},
		]);
	});

	test('a parse failure reaches the report as eslint:parse, not as silence', async () => {
		// The arbiter's own failure mode. `eslint:parse` is the one eslint policy id
		// that is not published in SVELTE_GATE_POLICIES, because it is a parser
		// outcome rather than a rule verdict - so this row is what proves it is
		// reported at all, and that it still carries the arbiter's dossier ref.
		const mutant = mutate(s1, 'onclick={() => {', 'onclick={notAFunction() => {');
		const violations = (
			await checkSources([{ file: 'generated/ParseMutant.svelte', source: mutant }])
		).violations;
		const parse = violations.find((entry) => entry.policy === 'eslint:parse');
		expect(parse?.message).toMatch(/Parsing error/);
		expect(parse?.dossierRef).toBe('frameless-svelte-v1 T005 lint arbiter');
	});

	/**
	 * THE OMISSION LIST. Three rules from `recommended` are turned off, and each
	 * one is turned off for a reason recorded in code rather than dropped in
	 * silence - the same discipline as the qwik gate's
	 * QWIK_ESLINT_RULES_REQUIRING_TYPES.
	 */
	test('records every omitted rule explicitly, with a reason', () => {
		expect(SVELTE_ESLINT_RULES_OMITTED.map((entry) => entry.rule)).toEqual([
			'svelte/no-unused-props',
			'svelte/require-event-dispatcher-types',
			'svelte/comment-directive',
		]);
		for (const entry of SVELTE_ESLINT_RULES_OMITTED) {
			expect(entry.reason.length, entry.rule).toBeGreaterThan(80);
			expect(SVELTE_ESLINT_RULES_APPLIED, entry.rule).not.toContain(entry.rule);
		}
		// The applied set is READ OFF `recommended` rather than transcribed, so a
		// rule upstream adds arrives here automatically - and a rule that vanishes
		// from `recommended` turns this red rather than passing unnoticed.
		expect([...SVELTE_ESLINT_RULES_APPLIED, ...SVELTE_ESLINT_RULES_OMITTED.map((e) => e.rule)])
			.toHaveLength(37);
	});

	test('emitted text cannot silence the arbiter that is judging it', async () => {
		// Two vehicles, both refused. ESLint's own inline config is off
		// (allowInlineConfig: false), and svelte/comment-directive - the plugin's
		// separate markup implementation of the same thing, which allowInlineConfig
		// does NOT reach - is in the omission list above. A gate over GENERATED
		// output whose verdict the generator can turn off is not a gate.
		const mutant = mutate(s2, '{#each todos as todo (todo.id)}', '{#each todos as todo}');
		for (const suppression of [
			'<!-- eslint-disable svelte/require-each-key -->',
			'<!-- eslint-disable -->',
		]) {
			const suppressed = mutate(mutant, '<section data-scenario="s2"', `${suppression}<section data-scenario="s2"`);
			expect(
				(await eslintMessagesFor('generated/SuppressedMutant.svelte', suppressed)).map(
					(entry) => entry.policy,
				),
				suppression,
			).toContain('eslint:svelte/require-each-key');
		}
	});
});
