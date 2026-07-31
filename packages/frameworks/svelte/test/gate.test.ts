import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { dirname, resolve } from 'pathe';
import { beforeAll, describe, expect, test } from 'vitest';
import { emit } from '../src/emitter/index.ts';
import { isUnbuiltEmitted } from './unbuilt-scenarios.ts';
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
import {
	COMPOSITION_EXTENSION,
	compositionFixtures,
} from '../scripts/regenerate-composition.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');
const sveltePackageRoot = dirname(createRequire(import.meta.url).resolve('svelte/package.json'));

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(await readFile(resolve(compilerGoldenRoot, name), 'utf8')) as EnrichedIR;
}

/**
 * THE SCENARIO INVENTORY IS DERIVED, NOT RE-LITERALLED.
 *
 * This list was `['generated/S1.svelte', 'generated/S2.svelte',
 * 'generated/S3.svelte']` until S4 landed, and the hand-edit it then demanded
 * was not free: the inventory is the FIRST statement of the gate test below, so
 * the whole run aborted there and the emitted S4 file never reached
 * `checkGeneratedFiles()`, `eslint-plugin-svelte`, or any policy. A literal that
 * must be edited once per scenario is the same defect one scenario later, and
 * four more scenarios are queued.
 *
 * The derivation source is the compiler's ratified golden corpus - `s<n>-*.json`
 * - which is INDEPENDENT of `generated/`: one is the IR this repo agreed to
 * compile, the other is what the emitter actually wrote. Comparing them is a
 * real cross-check rather than a restatement, and it is two-sidedly fail-closed:
 * an emitter that stops writing a scenario goes red, and a stray extra file in
 * `generated/` goes red too. `CALIBRATION: the derived inventory...` below
 * watches both directions happen.
 */
function scenarioCorpus(extension: string, directory = 'generated'): string[] {
	const files = readdirSync(compilerGoldenRoot)
		.map((entry) => /^s(\d+)-[\w-]+\.json$/.exec(entry)?.[1])
		.filter((digits): digits is string => digits !== undefined)
		.map((digits) => `${directory}/S${digits}.${extension}`)
		// THE SUBTRACTION, declared once in ./unbuilt-scenarios.ts.
		.filter((file) => !isUnbuiltEmitted(file))
		.sort();
	// Fail LOUD rather than returning []. An empty derivation would make the
	// inventory assertion agree with an empty `generated/` directory, which is the
	// one way a derived list could be greener than the literal it replaced.
	if (files.length === 0)
		throw new Error(`no s<n>-*.json scenario goldens found in ${compilerGoldenRoot}`);
	return files;
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

/**
 * EVERY emitted scenario source, keyed by its `generated/…` path, loaded from
 * the derived inventory. The three named bindings below are kept because the
 * mutation rows are per-scenario by design and cite constructs only one
 * scenario ships; this map is what the WHOLE-CORPUS rows iterate, so a new
 * scenario joins them without an edit.
 */
const emittedSources = new Map<string, string>();
let s1 = '';
let s2 = '';
let s3 = '';
beforeAll(async () => {
	for (const file of scenarioCorpus('svelte'))
		emittedSources.set(file, await readFile(resolve(packageRoot, file), 'utf8'));
	s1 = emittedSources.get('generated/S1.svelte')!;
	s2 = emittedSources.get('generated/S2.svelte')!;
	s3 = emittedSources.get('generated/S3.svelte')!;
});

async function policiesFor(file: string, source: string): Promise<string[]> {
	return (await checkSources([{ file, source }])).violations.map((entry) => entry.policy);
}

/**
 * THE COMPOSITION TIER AS THE GATE IS MEANT TO SEE IT: the committed emitted
 * bytes PAIRED WITH the fixture artifact each was emitted from.
 *
 * The pairing is DERIVED from `compositionFixtures`, the same list
 * `scripts/regenerate-composition.ts` writes the directory from, so a fixture
 * that is added or renamed cannot leave a file gated without its artifact - the
 * failure mode that would silently disable `undisclosed-import` and
 * `persistence-render-lowering` at once. Rebuilt per call rather than cached, so
 * no row can leave a mutated artifact behind for the next one.
 */
async function compositionEntries(): Promise<
	Array<{ file: string; source: string; artifact: EnrichedIR }>
> {
	return Promise.all(
		[...compositionFixtures]
			.map((name) => ({
				name,
				file: `generated-composition/${name}${COMPOSITION_EXTENSION}`,
			}))
			.sort((left, right) => left.file.localeCompare(right.file))
			.map(async ({ name, file }) => {
				const filename = `test/composition-fixtures/${name}.tsrx`;
				return {
					file,
					source: await readFile(resolve(packageRoot, file), 'utf8'),
					artifact: await buildEnrichedIr({
						filename,
						source: await readFile(resolve(packageRoot, filename), 'utf8'),
					}),
				};
			}),
	);
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
			'undisclosed-import',
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

	test('discovers and accepts the clean emitted scenario corpus', async () => {
		const corpus = scenarioCorpus('svelte');
		expect(await discoverGeneratedFiles()).toEqual(corpus);
		const result = await checkGeneratedFiles();
		// The gate's OWN file list, asserted rather than assumed. `discoverGeneratedFiles`
		// and `checkGeneratedFiles` are separate entry points; a gate that discovered
		// four files and checked three would otherwise report [] violations and look
		// identical to a gate that checked all four.
		expect(result.files).toEqual(corpus);
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

	/**
	 * THE SECOND OUTPUT DIRECTORY, AND THIS ROW IS NOW COVERAGE - IT USED TO BE A
	 * DEBT PIN AND THE DEBT IS PAID. THIS WAS THE WORST OF THE SIX LANES.
	 *
	 * `frameless-app-axes-v1` T015 measured every lane against every generation
	 * tier: this gate's standing corpus is `generated/` ONLY, and
	 * `generated-composition/` shipped committed artifacts no policy in this
	 * package had ever been pointed at. THIS LANE DREW FOUR VIOLATIONS ACROSS TWO
	 * FILES - the most of any lane - and one of them was not an inventory question
	 * at all. T018 paid that fourth one at the emitter; T017 ruled the other three.
	 *
	 * A PIN LEFT STANDING AFTER ITS DEBT IS PAID IS A CHECK THAT CANNOT FAIL. The
	 * old row asserted "this directory STILL DRAWS violations", so once the forms
	 * were ruled it could only be satisfied by NOT applying the ruling.
	 *
	 * WHAT T017 RULED, and the three answers are of TWO different kinds:
	 *
	 * - `template-node:RenderTag` - `{@render children?.()}`, the Svelte 5 snippet
	 *   render tag this lane's own composition ruling selected - and
	 *   `template-node:Component`, a component reference in a template. Template
	 *   node kinds ARE inside the inventory's declared domain, so both are
	 *   ADMISSIONS at floor 5.0, which is this lane's own floor, so neither costs
	 *   any version reach. `RenderTag` was NOT a free admission: `rejects template
	 *   forms outside the inventory` further down used `{@render thing()}` as its
	 *   example of a form this lane MUST REJECT while `M1-panel.svelte` SHIPPED
	 *   `{@render children?.()}`. That row is INVERTED, not deleted - see its own
	 *   comment, and note that its `{@attach}` arm was inverted for exactly this
	 *   reason one card earlier.
	 * - `import:./M1-panel.svelte#default` - a RELATIVE SIBLING MODULE import, and
	 *   NOT an inventory form at all. The only `import:` entry here is
	 *   `svelte#untrack`, a framework PACKAGE specifier with a version floor; a
	 *   relative path names no framework and has no version, so allowlisting the
	 *   literal would admit ONE FILENAME and the next composed pair would reopen
	 *   the identical red. Relative specifiers therefore LEAVE the inventory's
	 *   domain and are resolved against the artifact's own recorded imports by
	 *   `undisclosed-import`, which is the mechanism React and Solid already ship.
	 *   Angular and Vue took the same ruling in the same card.
	 *
	 * THE ONE THAT WAS PAID AT THE EMITTER, AND IT WAS NEVER AN INVENTORY QUESTION
	 * - WHICH IS WHY THIS DIRECTORY BEING UNGATED MATTERED.
	 * `eslint:svelte/no-useless-mustaches` fired on `M2-page.svelte` because the
	 * emitter printed `label={'Composed'}` for a static string prop where
	 * `label="Composed"` is the idiomatic spelling. THE THIRD-PARTY ARBITER
	 * REPORTED THAT FROM THE DAY THE FILE WAS COMMITTED AND NOTHING WAS LISTENING.
	 * T018 fixed it at `quotableStringProp` in `src/emitter/index.ts` and
	 * REGENERATED the artifact; the rule was never silenced, and a row further down
	 * plants the exact shape the emitter used to print and watches upstream still
	 * report it. The spelling is still pinned BOTH WAYS below.
	 *
	 * `pnpm lint` CANNOT SEE ANY OF THIS, and it is worth keeping written down:
	 * `pnpm lint` is oxlint over 93 rules and does not carry
	 * `svelte/no-useless-mustaches`; it linted this very file at 0 warnings, 0
	 * errors while the finding was live. THIS GATE is the only instrument in the
	 * repo that holds the rule.
	 *
	 * WHAT THIS ROW IS AND IS NOT. It is the SAME SHAPE as React's
	 * `discovers and gates every generated composition module with its fixture
	 * artifact`: discovered, every file supplied WITH ITS FIXTURE ARTIFACT, and
	 * BOTH halves asserted - 0 violations AND 0 unevaluated. It still does NOT go
	 * through `checkGeneratedFiles()`, which SUPPLIES NO ARTIFACT; the standing
	 * corpus is `generated/` only, deliberately, exactly as in React and Solid.
	 *
	 * KILLED BOTH WAYS by the two rows immediately below: an ON-DISK ARTIFACT
	 * MUTATION and an INVENTORY-ENTRY REMOVAL. Neither writes to disk; both read
	 * the committed bytes. Measured in
	 * `docs/goals/frameless-app-axes-v1/notes/T015-composition-gate-hole.md`,
	 * `.../notes/T018-emitter-findings.md` and
	 * `.../notes/T020-relative-import-ruling.md`.
	 */
	test('discovers and gates every generated composition module with its fixture artifact', async () => {
		const expected = compositionFixtures
			.map((name) => `generated-composition/${name}${COMPOSITION_EXTENSION}`)
			.sort();
		expect(expected.length).toBeGreaterThan(0);
		expect(await discoverGeneratedFiles({ directory: 'generated-composition' })).toEqual(
			expected,
		);
		// NOT `checkGeneratedFiles`, deliberately - see the comment above.
		const result = await checkSources(await compositionEntries());
		expect(result.files).toEqual(expected);
		expect(
			result.violations.map((entry) => ({ file: entry.file, policy: entry.policy })),
			JSON.stringify(result.violations, null, 2),
		).toEqual([]);
		// THE HALF THAT IS EASY TO LOSE. A tier gated with no artifact is "clean"
		// because the artifact-required policies never ran, which is indistinguishable
		// from a clean tier unless this is asserted too.
		expect(result.unevaluated).toEqual([]);
		// THE RULED FORMS ARE STILL PRESENT IN THE BYTES AND STILL OBSERVED. "0
		// violations" would also be true of a tier that had stopped emitting them, or
		// of a walk that had stopped seeing them, and both are different facts.
		const panel = await readFile(
			resolve(packageRoot, `generated-composition/M1-panel${COMPOSITION_EXTENSION}`),
			'utf8',
		);
		const composed = await readFile(
			resolve(packageRoot, `generated-composition/M2-page${COMPOSITION_EXTENSION}`),
			'utf8',
		);
		expect(panel).toContain('{@render children?.()}');
		expect(composed).toContain("from './M1-panel.svelte'");
		expect(collectEmittedForms(panel)).toContainEqual({
			kind: 'template-node',
			form: 'RenderTag',
		});
		expect(collectEmittedForms(composed)).toContainEqual({
			kind: 'template-node',
			form: 'Component',
		});
		// THE PAID DEBT IS STILL PINNED TO ITS SPELLING, BOTH WAYS. The artifact must
		// carry the quoted attribute AND must not carry the mustache anywhere, so an
		// emitter regression turns this row red rather than leaving a stale
		// expectation. The negative half is the load-bearing one: the positive half
		// alone would still pass if a second, useless mustache appeared beside it.
		expect(composed).toContain('label="Composed"');
		expect(composed).not.toContain("={'");
		expect(
			result.violations.map((entry) => entry.policy),
			JSON.stringify(result.violations, null, 2),
		).not.toContain('eslint:svelte/no-useless-mustaches');
	});

	/**
	 * KILL 1 OF 2 FOR THE ROW ABOVE - THE ON-DISK ARTIFACT MUTATION.
	 *
	 * The green above says "every relative specifier this tier emits is one the
	 * fixture artifact records". A green that cannot go red says nothing, and the
	 * failure mode is specific: `recordedRelativeImportSpecifiers` reproduces the
	 * emitter's `.tsrx` -> `.svelte` substitution BY HAND, so a mirror that drifted
	 * from the emitter - or one that accepted ANY relative specifier - would leave
	 * the row above just as green.
	 *
	 * So the emitted specifier is changed to one the artifact does NOT record,
	 * WITH the real artifact still supplied, and `undisclosed-import` must fire.
	 * Nothing is written to disk: the committed bytes are read and mutated in
	 * memory, exactly as every other mutation row in this file does.
	 */
	test('MUTATION: a relative specifier the artifact does not record is rejected', async () => {
		const entries = await compositionEntries();
		const page = entries.find((entry) => entry.file.endsWith(`M2-page${COMPOSITION_EXTENSION}`))!;
		expect(page.source).toContain("from './M1-panel.svelte'");
		const mutant = mutate(page.source, "from './M1-panel.svelte'", "from './M9-elsewhere.svelte'");
		const result = await checkSources([
			{
				file: `generated-composition/UnrecordedMutant${COMPOSITION_EXTENSION}`,
				source: mutant,
				artifact: page.artifact,
			},
		]);
		const undisclosed = result.violations.filter((entry) => entry.policy === 'undisclosed-import');
		expect(undisclosed.length, JSON.stringify(result.violations, null, 2)).toBe(1);
		expect(undisclosed[0]!.message).toContain('./M9-elsewhere.svelte');
		// AND THE OTHER DIRECTION OF THE SAME MECHANISM: the artifact is what makes
		// the real specifier acceptable, so withdrawing it must reopen the red on the
		// UNMUTATED bytes. This is what stops "the policy is satisfied by the source
		// alone" passing as "the policy consults the artifact".
		const withoutArtifact = await checkSources([{ file: page.file, source: page.source }]);
		expect(
			withoutArtifact.violations.map((entry) => entry.policy),
			JSON.stringify(withoutArtifact.violations, null, 2),
		).toEqual(['undisclosed-import']);
		expect(withoutArtifact.violations[0]!.message).toContain('./M1-panel.svelte');
		// A VIOLATION, NOT `unevaluated` - the same asymmetry React records. An
		// artifact-less caller must not be the way to make this check disappear.
		expect(withoutArtifact.unevaluated.map((entry) => entry.policy)).not.toContain(
			'undisclosed-import',
		);
	});

	/**
	 * KILL 2 OF 2 FOR THE COVERAGE ROW - THE INVENTORY-ENTRY REMOVAL.
	 *
	 * "0 violations" would stay true if the tier had stopped being OBSERVED rather
	 * than started being ALLOWED - a walk that quietly stopped descending looks
	 * identical from the outside, and this card narrowed what `observeForms`
	 * reports. So the tier's observed forms are measured against the inventory
	 * MINUS the two entries T017 admitted, through the SAME
	 * `BASELINE_FORM_INVENTORY` the gate derives its allowlist from, and the
	 * uncovered set must be exactly those two.
	 *
	 * Both are removed together rather than one at a time because they entered
	 * together and each covers a DIFFERENT file - `RenderTag` in `M1-panel` and
	 * `Component` in `M2-page` - so a single-entry removal would leave the other
	 * file's admission unwatched.
	 */
	test('MUTATION: removing the RenderTag and Component entries reopens the composition tier', async () => {
		const admitted = new Set(['template-node:RenderTag', 'template-node:Component']);
		const listed = new Set(
			BASELINE_FORM_INVENTORY.map((entry) => `${entry.kind}:${entry.form}`).filter(
				(key) => !admitted.has(key),
			),
		);
		// The removal really removed something, or this row measures nothing.
		expect(listed.size).toBe(BASELINE_FORM_INVENTORY.length - admitted.size);
		const uncovered = new Set<string>();
		for (const entry of await compositionEntries())
			for (const observed of collectEmittedForms(entry.source)) {
				const key = `${observed.kind}:${observed.form}`;
				if (!listed.has(key)) uncovered.add(key);
			}
		expect([...uncovered].sort()).toEqual([...admitted].sort());
	});

	/**
	 * CALIBRATION for the DERIVED inventory. A derived list that nobody has
	 * watched go red is not an instrument - and the literal it replaced at least
	 * failed loudly when it drifted. Both directions are driven through the SAME
	 * `discoverGeneratedFiles()` the assertion above calls, against a throwaway
	 * root, so this measures the real comparison and not a lookalike.
	 */
	test('CALIBRATION: the derived inventory goes red on a missing and on an extra file', async () => {
		const corpus = scenarioCorpus('svelte');
		// THE FLOOR. Every scenario ratified so far must still be in the derivation.
		// A lower bound, so S5 and later widen it with no edit here, while a golden
		// that silently disappeared is red.
		expect(corpus).toEqual(
			expect.arrayContaining([
				'generated/S1.svelte',
				'generated/S2.svelte',
				'generated/S3.svelte',
				'generated/S4.svelte',
			]),
		);
		const root = await realpath(await mkdtemp(resolve(tmpdir(), 'frameless-svelte-inventory-')));
		try {
			await mkdir(resolve(root, 'generated'));
			const stub = '<!-- inventory calibration -->\n';
			for (const file of corpus.slice(0, -1)) await writeFile(resolve(root, file), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).not.toEqual(corpus);
			await writeFile(resolve(root, corpus.at(-1)!), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).toEqual(corpus);
			await writeFile(resolve(root, 'generated/S99.svelte'), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).not.toEqual(corpus);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
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

	test('rejects template forms outside the inventory: {@html}, {#key} - and ACCEPTS {@attach}, {@render}', async () => {
		// THIS ROW HAS NOW HAD TWO ARMS INVERTED, ONE PER CARD, AND THE PATTERN IS
		// THE POINT RATHER THAN THE COINCIDENCE.
		//
		// It used to name `{@attach}`: Step 4 lowers `attach=` onto `{@attach}`, so
		// `template-node:AttachTag` became an INVENTORIED form with a floor of 5.29
		// and a VERIFIED citation - the first verified floor this lane has.
		//
		// It ALSO named `{@render thing()}` as a form this lane MUST REJECT, while
		// `generated-composition/M1-panel.svelte` HAD BEEN SHIPPING
		// `{@render children?.()}` since the day composition landed. A standing test
		// and a committed artifact were in direct contradiction, and this package only
		// got away with asserting both because the gated corpus was `generated/` only
		// - the SAME contradiction the Angular lane carried on `<ng-content>`, which
		// the T017 dispatch named for Angular alone. `frameless-app-axes-v1` T017
		// admitted `template-node:RenderTag` at 5.0, so this arm is inverted too.
		//
		// INVERTED, NOT DELETED, BOTH TIMES: "the gate ACCEPTS the form we
		// deliberately added" is exactly as load-bearing as "it rejects the ones we
		// did not", and a deleted arm would leave nothing watching the admission.
		// `{@html}` and `{#key}` are untouched and are what keep this row biting.
		const html = mutate(s1, '{derived}', '{@html derived}');
		expect(await policiesFor('generated/HtmlTagMutant.svelte', html)).toContain(
			'baseline-form-inventory',
		);
		const key = mutate(
			mutate(s2, '{#if todos.length === 0}', '{#key todos.length}{#if todos.length === 0}'),
			'{/if}',
			'{/if}{/key}',
		);
		expect(await policiesFor('generated/KeyBlockMutant.svelte', key)).toContain(
			'baseline-form-inventory',
		);
		// THE TWO INVERTED ARMS, driven through the SAME call as the two above so the
		// difference between them is the inventory and nothing else.
		const attach = mutate(s1, 'data-s1-root=""', 'data-s1-root="" {@attach (node) => {}}');
		expect(await policiesFor('generated/AttachMutant.svelte', attach)).not.toContain(
			'baseline-form-inventory',
		);
		const render = mutate(s1, '{derived}', '{@render thing()}');
		expect(await policiesFor('generated/RenderMutant.svelte', render)).not.toContain(
			'baseline-form-inventory',
		);
		// AND THE ADMISSIONS ARE PINNED TO THEIR RECORDED FLOORS, so an arm that went
		// green because someone deleted the entry and the observer with it is still
		// red here.
		expect(
			BASELINE_FORM_INVENTORY.find(
				(entry) => entry.kind === 'template-node' && entry.form === 'RenderTag',
			)?.floor,
		).toBe('5.0');
		expect(
			BASELINE_FORM_INVENTORY.find(
				(entry) => entry.kind === 'template-node' && entry.form === 'AttachTag',
			)?.floor,
		).toBe('5.29');
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
		await expect(
			citationHolds({ file: 'types/index.d.ts', needle: '@since 5.20.0' }),
		).resolves.toBe(true);
		await expect(
			citationHolds({ file: 'types/index.d.ts', needle: '@since 0.1.0-not-a-real-tag' }),
		).resolves.toBe(false);
		await expect(
			citationHolds({ file: 'types/there-is-no-such-file.d.ts', needle: 'x' }),
		).rejects.toThrow();
		// THIS LINE USED TO ASSERT THAT EVERY ENTRY IS `unverified`, with a note
		// saying "if this fails a floor was verified - good". STEP 4 IS WHEN THAT
		// HAPPENED: `template-node:AttachTag` floors at 5.29 and the resolved package
		// dates it itself, so the loop above now really does enter its verified
		// branch. The assertion is INVERTED rather than deleted, so the loop cannot
		// go vacuous again without this row noticing.
		const verified = BASELINE_FORM_INVENTORY.filter(
			(entry) => entry.evidence.status === 'verified',
		);
		expect(verified.map((entry) => `${entry.kind}:${entry.form}`)).toEqual([
			'template-node:AttachTag',
		]);
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
		// Iterates the DERIVED corpus. This row used to name S1/S2/S3, so a fourth
		// emitted component could join the repo without the Svelte team's own rules
		// ever being run over it.
		expect(emittedSources.size).toBe(scenarioCorpus('svelte').length);
		for (const [file, source] of emittedSources)
			expect(
				await eslintMessagesFor(file, source),
				`${file} drew an upstream message`,
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

	/**
	 * TWO PLANTS, AND THE SECOND ONE IS WHY THIS ROW MATTERS AFTER T018.
	 *
	 * The first plant is a TEXT mustache. It proves the rule is wired, and it is
	 * the plant this row shipped with - but it does NOT prove the rule reaches a
	 * COMPONENT ATTRIBUTE, which is the position the emitter was actually printing
	 * `label={'Composed'}` into. A green from a text plant is compatible with the
	 * rule never looking at attributes at all.
	 *
	 * So the second plant reverts the REAL artifact, byte for byte, to the exact
	 * spelling the emitter emitted before `quotableStringProp` - and upstream still
	 * reports it. Paired with the control on the SHIPPED artifact, which draws zero
	 * eslint messages, that is what makes the fix's green distinguishable from a
	 * disabled rule. `pnpm lint` cannot make this distinction at any strength: it
	 * is oxlint, it does not carry `svelte/no-useless-mustaches`, and it linted
	 * `generated-composition/M2-page.svelte` at 0 warnings and 0 errors on the day
	 * the finding was live.
	 */
	test('RED: svelte/no-useless-mustaches - in TEXT and on a COMPONENT PROP', async () => {
		const mutant = mutate(s1, '>increment<', ">{'increment'}<");
		expect(await eslintMessagesFor('generated/MustacheMutant.svelte', mutant)).toEqual([
			{
				policy: 'eslint:svelte/no-useless-mustaches',
				message: 'Unexpected mustache interpolation with a string literal value.',
			},
		]);
		const composed = await readFile(
			resolve(packageRoot, `generated-composition/M2-page${COMPOSITION_EXTENSION}`),
			'utf8',
		);
		// The CONTROL first: what ships draws nothing, so the plant below is
		// attributable to the plant and not to anything else in the file.
		expect(await eslintMessagesFor('generated-composition/M2-page.svelte', composed)).toEqual(
			[],
		);
		const planted = mutate(composed, 'label="Composed"', "label={'Composed'}");
		expect(
			await eslintMessagesFor('generated-composition/MustachePropMutant.svelte', planted),
		).toEqual([
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
