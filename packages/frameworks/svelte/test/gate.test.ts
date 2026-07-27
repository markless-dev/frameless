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

function policiesFor(file: string, source: string): string[] {
	return checkSources([{ file, source }]).violations.map((entry) => entry.policy);
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
		expect(SVELTE_GATE_POLICIES.map((policy) => policy.id)).toEqual([
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

	test('MUTATION: rejects emitted source without the generated header', () => {
		const mutant = mutate(s1, '<!-- @generated by @frameless/svelte', '<!-- hand written');
		expect(policiesFor('generated/HeaderMutant.svelte', mutant)).toContain(
			'generated-header',
		);
	});

	test('MUTATION: rejects the Svelte 4 on:click directive spelling', () => {
		// The same lexical substitution flips category across the major version -
		// the exact reason IR-4's version corollary is not amended. IR-4 is
		// DEFERRED, so only baseline-safe forms may be emitted.
		const mutant = mutate(s1, 'onclick={', 'on:click={');
		const policies = policiesFor('generated/LegacyMutant.svelte', mutant);
		expect(policies).toContain('no-legacy-event-directive');
	});

	test('MUTATION: rejects bind: and $bindable, whose failure mode is a dev-only warning', () => {
		const directive = mutate(s3, 'value={text}', 'bind:value={text}');
		expect(policiesFor('generated/BindMutant.svelte', directive)).toContain('no-bindable');
		const bindable = mutate(s3, 'let { initial,', 'let { initial = $bindable(),');
		expect(policiesFor('generated/BindableMutant.svelte', bindable)).toContain('no-bindable');
	});

	test('MUTATION: rejects stopPropagation, and the emitter refuses to produce it', async () => {
		const mutant = mutate(s3, 'event.preventDefault();', 'event.stopPropagation();');
		expect(policiesFor('generated/StopPropagationMutant.svelte', mutant)).toContain(
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

	test('MUTATION: rejects an unsanctioned svelte-ignore code', () => {
		const mutant = mutate(
			s3,
			'a11y_click_events_have_key_events',
			'state_unsafe_mutation',
		);
		const violations = checkSources([
			{ file: 'generated/IgnoreMutant.svelte', source: mutant },
		]).violations;
		expect(violations.map((entry) => entry.policy)).toContain('sanctioned-svelte-ignore');
		expect(violations.find((entry) => entry.policy === 'sanctioned-svelte-ignore')?.message)
			.toContain('state_unsafe_mutation');
		// TWO INDEPENDENT LINES on the same mutant. The sanctioned list is the
		// emitter's own; the inventory reaches it as a FORM with a version floor.
		// Neither is derived from the other's verdict.
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
	});

	test('MUTATION: rejects whitespace between two siblings', () => {
		// MEASURED at 5.56.8: Svelte keeps this as a single space text node while
		// JSX drops the whole whitespace-only line, so the emitted text content
		// would diverge from React's and Solid's.
		const mutant = mutate(s1, /<\/output\n(\t*)>/, '</output>\n$1');
		expect(policiesFor('generated/WhitespaceMutant.svelte', mutant)).toContain(
			'no-inter-sibling-whitespace',
		);
	});

	test('MUTATION: persistence-bearing IR fails closed in the gate and the emitter', async () => {
		const artifact = structuredClone(await golden('s1-render-once.json'));
		(artifact.records.persistence as unknown[]).push({ graphNodeId: 'state:count' });
		const result = checkSources([
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
	test('rejects an update expression inside $derived', () => {
		const mutant = mutate(s1, 'count * multiplier', 'count++ * multiplier');
		const violations = checkSources([
			{ file: 'generated/DerivedUpdateMutant.svelte', source: mutant },
		]).violations;
		expect(violations.map((entry) => entry.policy)).toContain('derived-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'derived-expression-purity')?.message,
		).toContain('update expression');
	});

	test('rejects an assignment inside $derived', () => {
		const mutant = mutate(s1, 'count * multiplier', '(count = 2) * multiplier');
		const violations = checkSources([
			{ file: 'generated/DerivedAssignMutant.svelte', source: mutant },
		]).violations;
		expect(violations.map((entry) => entry.policy)).toContain('derived-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'derived-expression-purity')?.message,
		).toContain('assignment');
	});

	test('rejects a known-mutating method call inside $derived', () => {
		const mutant = mutate(s2, 'todos.filter((todo) => todo.done)', 'todos.sort()');
		const violations = checkSources([
			{ file: 'generated/DerivedSortMutant.svelte', source: mutant },
		]).violations;
		expect(violations.map((entry) => entry.policy)).toContain('derived-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'derived-expression-purity')?.message,
		).toContain('.sort()');
	});

	test('rejects a delete expression inside $derived', () => {
		const mutant = mutate(s1, '${prefix}${count', '${delete globalThis.x}${count');
		expect(policiesFor('generated/DerivedDeleteMutant.svelte', mutant)).toContain(
			'derived-expression-purity',
		);
	});

	test('ANTI-VACUITY: a non-mutating call and a mutation OUTSIDE $derived are accepted', () => {
		// S2's own derived is `todos.filter(...).length`. If this policy were
		// "reject any call" the clean corpus would already be red, and every row
		// above would be measuring nothing.
		expect(s2).toContain('$derived(todos.filter((todo) => todo.done).length)');
		expect(policiesFor('generated/S2.svelte', s2)).not.toContain(
			'derived-expression-purity',
		);
		// S2's handlers assign to `todos` and call `.slice()`/`.concat()` all over.
		// The policy reads $derived ancestry, not text.
		expect(s2).toContain('todos = todos.concat(item);');
		// And a planted assignment in a handler stays accepted - proving the walk
		// really is scoped to $derived arguments rather than to the whole script.
		const handlerMutant = mutateAll(s2, "draft = '';", "draft = ''; next = next + 1;");
		expect(policiesFor('generated/HandlerMutant.svelte', handlerMutant)).not.toContain(
			'derived-expression-purity',
		);
	});

	test('states what it cannot see, so a pass is never read as a purity proof', () => {
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
		expect(policiesFor('generated/Blind.svelte', source)).not.toContain(
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

	test('rejects a rune MEMBER form that the bare rune does not license', () => {
		// `$state.raw` arrived at 5.19 and `$derived.by`, `$props.id` and
		// `$effect.pre` all have their own floors. Allowing `$state` must not
		// silently allow everything hanging off it.
		const mutant = mutate(s1, 'let count = $state(1);', 'let count = $state.raw(1);');
		const violations = checkSources([
			{ file: 'generated/RuneMemberMutant.svelte', source: mutant },
		]).violations;
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('$state.raw');
	});

	test('rejects an import of on() from svelte/events - worked example 6, in code', () => {
		// The denied arm of the rewritten worked example 6. The emitter refuses a
		// declared stopPropagation at emit time; this is the independent check that
		// the on() vehicle cannot arrive by any other route either.
		const mutant = mutate(
			s1,
			"import { untrack } from 'svelte';",
			"import { untrack } from 'svelte';\n\timport { on } from 'svelte/events';",
		);
		const violations = checkSources([
			{ file: 'generated/ForeignImportMutant.svelte', source: mutant },
		]).violations;
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('svelte/events#on');
	});

	test('rejects template forms above the 5.0 baseline: {@html}, {@attach}, {#key}', () => {
		// {@attach} is 5.29 and is one of the four constructs T005 recorded as
		// satisfying the corollary's FIRST conjunct at 5.56.8 and failing the second
		// one alone. This is where that ruling is enforced rather than described.
		const html = mutate(s1, '{derived}', '{@html derived}');
		expect(policiesFor('generated/HtmlTagMutant.svelte', html)).toContain(
			'baseline-form-inventory',
		);
		const attach = mutate(s1, 'data-s1-root=""', 'data-s1-root="" {@attach (node) => {}}');
		const attachViolations = checkSources([
			{ file: 'generated/AttachMutant.svelte', source: attach },
		]).violations;
		expect(attachViolations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			attachViolations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('AttachTag');
		const key = mutate(
			mutate(s2, '{#if todos.length === 0}', '{#key todos.length}{#if todos.length === 0}'),
			'{/if}',
			'{/if}{/key}',
		);
		expect(policiesFor('generated/KeyBlockMutant.svelte', key)).toContain(
			'baseline-form-inventory',
		);
	});

	test('rejects a camelCased event attribute, which Svelte accepts and ignores', () => {
		// `onClick={...}` parses, compiles, and is simply a dead attribute - the
		// exact "compiles clean and is WRONG" class. The shape is inventoried, not
		// the event names, so this stays total over an open set of event names.
		const mutant = mutate(s3, 'onclick={', 'onClick={');
		const violations = checkSources([
			{ file: 'generated/CamelEventMutant.svelte', source: mutant },
		]).violations;
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('onClick');
	});

	test('rejects a svelte-ignore annotation in a component with no rune', () => {
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
		const violations = checkSources([
			{ file: 'generated/RunesFreeMutant.svelte', source: runesFree },
		]).violations;
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
