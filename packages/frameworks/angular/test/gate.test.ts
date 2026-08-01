import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import ngPlugin from '@angular-eslint/eslint-plugin';
import tplPlugin from '@angular-eslint/eslint-plugin-template';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { beforeAll, describe, expect, test } from 'vitest';
import { emit, templateDiagnostics } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
import type { GatePolicy } from '../src/gate/index.ts';
import {
	ANGULAR_ARBITER_TOOLCHAIN,
	ANGULAR_BASELINE_FLOOR,
	ANGULAR_ESLINT_RULES_ADDED,
	ANGULAR_ESLINT_RULES_APPLIED,
	ANGULAR_ESLINT_RULES_OMITTED,
	ANGULAR_ESLINT_TEMPLATE_RULES_DERIVED,
	ANGULAR_ESLINT_TS_RULES_DERIVED,
	ANGULAR_GATE_POLICIES,
	BASELINE_FORM_INVENTORY,
	checkGeneratedFiles,
	checkSources,
	collectEmittedForms,
	discoverGeneratedFiles,
} from '../src/gate/index.ts';
import {
	COMPOSITION_EXTENSION,
	compositionFixtures,
} from '../scripts/regenerate-composition.ts';
import { isUnbuiltEmitted } from './unbuilt-scenarios.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');
const require = createRequire(import.meta.url);

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(await readFile(resolve(compilerGoldenRoot, name), 'utf8')) as EnrichedIR;
}

/**
 * THE SCENARIO INVENTORY IS DERIVED, NOT RE-LITERALLED.
 *
 * This list was `['generated/S1.ts', 'generated/S2.ts', 'generated/S3.ts']`
 * until S4 landed, and the hand-edit it then demanded was not free: the
 * inventory is the FIRST statement of the gate test below, so the whole run
 * aborted there and the emitted S4 file never reached `checkGeneratedFiles()`,
 * `@angular-eslint`, or any policy. A literal that must be edited once per
 * scenario is the same defect one scenario later, and four more scenarios are
 * queued.
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
		// THE SEAM FOR A REFUSED SCENARIO, AND IT SUBTRACTS NOTHING AT HEAD. This
		// line used to read "this lane REFUSES S11 on its global-identifier ban, so
		// there is no artifact for the gate to read". MEASURED: `ANGULAR_UNBUILT_SCENARIOS`
		// is EMPTY, and `generated/S11.ts` and `generated/S12.ts` are BOTH on disk -
		// `frameless-app-fidelity-v1` T003 ruled the globals allowlist
		// (`TRANSPLANTED_GLOBALS` in src/emitter/index.ts) and T007 landed it, which
		// deleted both rows. The filter STAYS because the seam has to survive the next
		// refusal, and an empty subtraction is not an unwatched one: `emitter.test.ts`
		// asserts the emptiness EXACTLY, drives both formerly-refused goldens through
		// the real `emit()` and requires them to SUCCEED with their artifacts present,
		// and keeps a `Math` row as the live negative control that the fail-closed arm
		// still throws.
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
 * long as it had existed.
 */
function mutate(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replace(search, replacement);
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
	for (const file of scenarioCorpus('ts'))
		emittedSources.set(file, await readFile(resolve(packageRoot, file), 'utf8'));
	s1 = emittedSources.get('generated/S1.ts')!;
	s2 = emittedSources.get('generated/S2.ts')!;
	s3 = emittedSources.get('generated/S3.ts')!;
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

async function violationsFor(file: string, source: string) {
	return (await checkSources([{ file, source }])).violations;
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
 * A floor recorded as `verified` has to cite an artifact that can be re-read, in a
 * RESOLVED package rather than in a document. A missing file throws rather than
 * returning false: "the citation is gone" and "the citation is wrong" are
 * different failures and must not collapse into one another.
 */
async function citationHolds(citation: {
	readonly package: string;
	readonly file: string;
	readonly needle: string;
}): Promise<boolean> {
	const root = resolve(require.resolve(`${citation.package}/package.json`), '..');
	return (await readFile(resolve(root, citation.file), 'utf8')).includes(citation.needle);
}

describe('Angular dossier gate', () => {
	test('publishes independent source and artifact-required policies', () => {
		// The frameless-owned policies keep BARE ids; every third-party verdict is
		// prefixed `eslint:`. That prefix is the whole record of who decided a rule,
		// so it is pinned from both sides.
		expect(
			ANGULAR_GATE_POLICIES.map((policy) => policy.id).filter(
				(id) => !id.startsWith('eslint:'),
			),
		).toEqual([
			'generated-header',
			'template-parse',
			'whitespace-stable-text',
			'no-signal-members',
			'no-two-way-binding',
			'no-output-emitter',
			'no-change-detection-override',
			'no-stop-propagation',
			'getter-expression-purity',
			'baseline-form-inventory',
			'undisclosed-import',
			'persistence-render-lowering',
		]);
		expect(
			ANGULAR_GATE_POLICIES.map((policy) => policy.id).filter((id) => id.startsWith('eslint:')),
		).toEqual(ANGULAR_ESLINT_RULES_APPLIED.map((rule) => `eslint:${rule}`));
		expect(
			(ANGULAR_GATE_POLICIES as readonly GatePolicy[])
				.filter((policy) => policy.requiresArtifact)
				.map((policy) => policy.id),
		).toEqual(['persistence-render-lowering']);
	});

	/**
	 * THE ROW THAT REPLACED `./ungated-scenarios.ts`, AND THE ONE THAT KEEPS THE
	 * `imports` INVENTORY ENTRY FROM BECOMING DECORATIVE.
	 *
	 * That file declared S14 as EMITTED-THEN-GATE-REJECTED and asserted the
	 * rejection two-sidedly. `frameless-app-axes-v1` T009 RULED THE FORM IN - the
	 * `imports` array on `@Component`, floor 14.0, BELOW this lane's 19.0 floor -
	 * so the rejection is gone and the list would be EMPTY. It was deleted rather
	 * than emptied, because its own two-sided row asserted `length > 0`: an empty
	 * declaration is a check that cannot fail, and that tripwire is what its doc
	 * comment promised would fire the day the ruling landed.
	 *
	 * WHAT WAS LOST WITH IT IS A STANDING CHECK, AND THIS ROW IS ITS REPLACEMENT.
	 * An allowlist entry for a form nothing emits is indistinguishable from an
	 * entry for a form everything emits: both are green. So this asserts BOTH
	 * HALVES on the REAL golden through the REAL emitter - that S14 still PRINTS
	 * `imports`, and that the inventory still ADMITS it - plus the mutant that
	 * proves the second half can go red.
	 *
	 * IT IS NOT A BEHAVIOURAL CLAIM AND MUST NOT BE READ AS ONE. T009 measured
	 * `@angular/compiler-cli@22.0.8` compiling this module IDENTICALLY with and
	 * without the entry - 0 diagnostics either way, `dependencies: [HnItem]` in
	 * both arms - because `StandaloneComponentScopeReader` seeds the component's
	 * own scope and skips a self-entry. Every static layer in this repo is BLIND
	 * to the recursion. The evidence that it renders is the chromium drive
	 * recorded in `docs/goals/frameless-app-axes-v1/notes/T014-angular-s14.md`.
	 */
	test('S14 really prints the `imports` form, and the inventory really admits it', async () => {
		const ir = (await golden('s14-hn-item.json')) as EnrichedIR;
		// HALF ONE: the emitter takes it and PRINTS the form. This is the half that
		// makes the inventory entry non-decorative - if the emitter stopped writing
		// `imports`, the entry would be an allowlist row for nothing and the
		// clean-corpus rows would stay perfectly green.
		let emittedSource = '';
		expect(() => {
			emittedSource = formatEmitted(emit(ir));
		}, 's14-hn-item.json must EMIT').not.toThrow();
		expect(emittedSource).toContain('@generated by @frameless/angular');
		expect(collectEmittedForms(emittedSource)).toContainEqual({
			kind: 'component-metadata',
			form: 'imports',
		});
		// The form is there because the component NAMES ITSELF - the only route
		// this emitter has to `imports` at all.
		expect(emittedSource).toContain('imports: [HnItem]');
		// HALF TWO: the gate now ACCEPTS what it used to reject, and on the whole
		// module rather than on that one line.
		const result = await checkSources([{ file: 'generated/S14.ts', source: emittedSource }]);
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
		// And the artifact really is PRESENT, rather than accepted in the abstract
		// while the lane still ships nothing - the inverse of the absence assertion
		// the deleted file made.
		expect(
			readdirSync(resolve(packageRoot, 'generated')).includes('S14.ts'),
			'S14.ts must exist in generated/',
		).toBe(true);
	});

	/**
	 * THE MUTATION FOR THE ROW ABOVE: pull the entry back out of the inventory and
	 * the very same module must draw `baseline-form-inventory` again. Without this
	 * the row above would be satisfied by a gate that admitted everything, and the
	 * entry would be unfalsifiable rather than merely blind.
	 */
	test('MUTATION: without the `imports` entry, S14 is rejected again', async () => {
		const source = formatEmitted(emit((await golden('s14-hn-item.json')) as EnrichedIR));
		// The mutant is the SOURCE, not the inventory: `imports` is renamed to a key
		// nothing has ruled on, which is the same uninventoried-form path the entry
		// discharges. `mutate` throws rather than silently matching nothing.
		const mutant = mutate(source, 'imports: [HnItem],', 'importsNotRuledOn: [HnItem],');
		const violations = await violationsFor('generated/ImportsMutant.ts', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('"importsNotRuledOn"');
	});

	/**
	 * THE CONTROL FOR THE ROWS ABOVE. Without it, "the gate reported a violation"
	 * proves only that `checkSources` reports SOMETHING - a gate that rejected
	 * every input would satisfy it just as well. A SHIPPED artifact goes through
	 * the same call and must come back clean.
	 */
	test('CONTROL: a SHIPPED artifact is not rejected by the same call', async () => {
		const shipped = scenarioCorpus('ts');
		expect(shipped.length).toBeGreaterThan(0);
		const first = shipped[0]!;
		const result = await checkSources([
			{ file: first, source: await readFile(resolve(packageRoot, first), 'utf8') },
		]);
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
	});

	test('discovers and accepts the clean emitted scenario corpus', async () => {
		const corpus = scenarioCorpus('ts');
		expect(await discoverGeneratedFiles()).toEqual(corpus);
		const result = await checkGeneratedFiles();
		// The gate's OWN file list, asserted rather than assumed. `discoverGeneratedFiles`
		// and `checkGeneratedFiles` are separate entry points; a gate that discovered
		// four files and checked three would otherwise report [] violations and look
		// identical to a gate that checked all four.
		expect(result.files).toEqual(corpus);
		// [] IS NOT SELF-EVIDENT EVIDENCE - every policy below carries a mutation
		// row proving it can reject, and the anti-vacuity rows prove the two
		// policies most at risk of degenerating into "reject everything" do not.
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
		expect(result.unevaluated).toEqual([
			{ policy: 'persistence-render-lowering', reason: 'requires-artifact' },
		]);
		expect(Object.keys(result)).toEqual(['files', 'policies', 'violations']);
		for (const file of result.files)
			expect(await readFile(resolve(packageRoot, file), 'utf8')).toContain(
				'@generated by @frameless/angular',
			);
	});

	/**
	 * THE SECOND OUTPUT DIRECTORY, AND THIS ROW IS NOW COVERAGE - IT USED TO BE A
	 * DEBT PIN AND THE DEBT IS PAID.
	 *
	 * `frameless-app-axes-v1` T009 found, and T015 re-measured across all six
	 * lanes and all three generation tiers, that this gate's standing corpus is
	 * `generated/` ONLY, and that `generated-composition/` shipped three committed
	 * artifacts no policy in this package had ever been pointed at. T015 pinned the
	 * hole as an EXACT violation set rather than pretending it was closed; T018
	 * grew that pin from two to three by fixing `parseEmitted`; T017 ruled all
	 * three forms. This row is what the pin promised would replace it.
	 *
	 * A PIN LEFT STANDING AFTER ITS DEBT IS PAID IS A CHECK THAT CANNOT FAIL. The
	 * old row asserted "this directory STILL DRAWS violations", so once the forms
	 * were ruled it could only be satisfied by NOT applying the ruling. Keeping it
	 * beside the fix would have been an anchor asserting the opposite of what the
	 * gate now claims.
	 *
	 * WHAT T017 RULED, and why each one is a different KIND of answer:
	 *
	 * - `template-node:Content` - `<ng-content />`, Angular's content projection
	 *   node. A template node kind IS inside the inventory's declared domain, so
	 *   this is an ADMISSION: floor 2.0, `unverified`, below this lane's 19.0
	 *   standalone floor so `ANGULAR_BASELINE_FLOOR` cannot move. It was never a
	 *   free admission, because `rejects a template node kind above the emitted
	 *   surface` further down this file used `<ng-content>` as its example of a
	 *   form this lane MUST REJECT while two committed artifacts SHIPPED it. That
	 *   row is INVERTED, not deleted - see its own comment.
	 * - `import:./M1-panel#Panel` - a RELATIVE SIBLING MODULE import, and NOT an
	 *   inventory form at all. Every `import:` entry here is a framework PACKAGE
	 *   specifier with a version floor; a relative path names no framework and has
	 *   no version, so allowlisting the literal would admit ONE FILENAME and the
	 *   next composed pair would reopen the identical red. Relative specifiers
	 *   therefore LEAVE the inventory's domain and are resolved against the
	 *   artifact's own recorded imports by `undisclosed-import`, which is the
	 *   mechanism React and Solid already ship. Vue and Svelte took the same
	 *   ruling in the same card.
	 *
	 * WHAT THIS ROW IS AND IS NOT. It is the SAME SHAPE as React's
	 * `discovers and gates every generated composition module with its fixture
	 * artifact`: the tier is discovered, every file is supplied WITH ITS FIXTURE
	 * ARTIFACT, and BOTH halves are asserted - 0 violations AND 0 unevaluated. The
	 * second half is the one that is easy to lose: a tier gated without artifacts
	 * would be "clean" only because the artifact-required policies never ran.
	 *
	 * IT STILL DOES NOT GO THROUGH `checkGeneratedFiles()`. That entry point
	 * SUPPLIES NO ARTIFACT, so routing this directory through it would re-introduce
	 * exactly the blindness this row exists to remove - and React and Solid do not
	 * do it either. The standing corpus is still `generated/` only, deliberately.
	 *
	 * KILLED BOTH WAYS by the two rows immediately below: an ON-DISK ARTIFACT
	 * MUTATION (the emitted specifier no longer matches what the fixture records)
	 * and an INVENTORY-ENTRY REMOVAL (the tier's observed forms measured against
	 * the inventory MINUS the `Content` row). Neither writes to disk; both read the
	 * committed bytes.
	 *
	 * `C1-slot.ts` is still the only multi-component emitted file in this package,
	 * which is why `generated/` was never affected by the `parseEmitted` blindness;
	 * the last assertion here pins that so it stays true.
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
		// THE RETIRED CONTRADICTION, ASSERTED RATHER THAN DESCRIBED. The construct the
		// mutation row further down used to plant as a REJECTED form is the construct
		// these committed artifacts SHIP - in TWO files - and it is now an accepted
		// inventory form observed in both. If either side moves alone, this goes red.
		const panel = await readFile(
			resolve(packageRoot, 'generated-composition/M1-panel.ts'),
			'utf8',
		);
		const slotPage = await readFile(
			resolve(packageRoot, 'generated-composition/C1-slot.ts'),
			'utf8',
		);
		expect(panel).toContain('<ng-content />');
		expect(slotPage).toContain('<ng-content />');
		expect(collectEmittedForms(panel)).toContainEqual({
			kind: 'template-node',
			form: 'Content',
		});
		// `C1-slot.ts` carries BOTH of its forms - the `imports` metadata T014
		// admitted and the `Content` node T017 did - and the `Content` one is observed
		// inside `Frame`, the FIRST of the file's two components. That is the
		// component the pre-T018 `parseEmitted` threw away, so asserting it here is
		// what keeps the parser fix from silently regressing behind a green tier.
		expect(slotPage).toContain('imports: [Frame]');
		expect(collectEmittedForms(slotPage)).toContainEqual({
			kind: 'component-metadata',
			form: 'imports',
		});
		expect(collectEmittedForms(slotPage)).toContainEqual({
			kind: 'template-node',
			form: 'Content',
		});
		const secondComponentLine = slotPage
			.slice(0, slotPage.indexOf('@Component({', slotPage.indexOf('@Component({') + 1))
			.split('\n').length;
		expect(slotPage.split('\n').findIndex((line) => line.includes('<ng-content />')) + 1)
			.toBeLessThan(secondComponentLine);
		// And `generated/` really is single-component throughout, which is what
		// confined that blindness to this directory while it lasted. STILL TRUE.
		for (const file of scenarioCorpus('ts'))
			expect(
				(await readFile(resolve(packageRoot, file), 'utf8')).match(/^@Component\(\{$/gm)
					?.length ?? 0,
				file,
			).toBe(1);
	});

	/**
	 * KILL 1 OF 2 FOR THE ROW ABOVE - THE ON-DISK ARTIFACT MUTATION.
	 *
	 * The green above says "every relative specifier these files emit is one the
	 * fixture artifact records". A green that cannot go red says nothing, and the
	 * failure mode is specific: `recordedRelativeImportSpecifiers` reproduces the
	 * emitter's `.tsrx` -> extensionless substitution BY HAND, so a mirror that
	 * drifted from the emitter - or one that accepted ANY relative specifier -
	 * would leave the row above just as green.
	 *
	 * So the emitted specifier is changed to one the artifact does NOT record,
	 * WITH the real artifact still supplied, and `undisclosed-import` must fire on
	 * it. Nothing is written to disk: the committed bytes are read and mutated in
	 * memory, exactly as every other mutation row in this file does.
	 *
	 * THE CONTROL IS THE ROW ABOVE, which proves the unmutated pair is accepted -
	 * so this is a measurement of the recorded set and not of a policy that
	 * rejects every relative import it sees.
	 */
	test('MUTATION: a relative specifier the artifact does not record is rejected', async () => {
		const entries = await compositionEntries();
		const page = entries.find((entry) => entry.file.endsWith(`M2-page${COMPOSITION_EXTENSION}`))!;
		expect(page.source).toContain("from './M1-panel'");
		const mutant = mutate(page.source, "from './M1-panel'", "from './M9-elsewhere'");
		const result = await checkSources([
			{ file: 'generated-composition/UnrecordedMutant.ts', source: mutant, artifact: page.artifact },
		]);
		const undisclosed = result.violations.filter((entry) => entry.policy === 'undisclosed-import');
		expect(undisclosed.length, JSON.stringify(result.violations, null, 2)).toBe(1);
		expect(undisclosed[0]!.message).toContain('./M9-elsewhere');
		// AND THE OTHER DIRECTION OF THE SAME MECHANISM: the artifact is what makes
		// the real specifier acceptable, so withdrawing it must reopen the red on the
		// UNMUTATED bytes. This is what stops "the policy is satisfied by the source
		// alone" passing as "the policy consults the artifact".
		const withoutArtifact = await checkSources([{ file: page.file, source: page.source }]);
		expect(
			withoutArtifact.violations.map((entry) => entry.policy),
			JSON.stringify(withoutArtifact.violations, null, 2),
		).toEqual(['undisclosed-import']);
		expect(withoutArtifact.violations[0]!.message).toContain('./M1-panel');
		// A VIOLATION, NOT `unevaluated` - the same asymmetry React records. An
		// artifact-less caller must not be the way to make this check disappear.
		expect(withoutArtifact.unevaluated.map((entry) => entry.policy)).not.toContain(
			'undisclosed-import',
		);
	});

	/**
	 * KILL 2 OF 2 FOR THE COVERAGE ROW - THE INVENTORY-ENTRY REMOVAL.
	 *
	 * The other half of that green is the `template-node:Content` admission, and
	 * "the tier is clean" would stay true if the form had stopped being OBSERVED
	 * rather than started being ALLOWED - a walk that quietly stopped descending
	 * looks identical from the outside.
	 *
	 * So the tier's observed forms are measured against the inventory MINUS the
	 * `Content` entry, through the SAME `BASELINE_FORM_INVENTORY` the gate derives
	 * its allowlist from, and the uncovered set must be exactly `Content`. That is
	 * red if the entry is removed AND red if the observation is lost, which are the
	 * two ways this green could become a lie.
	 */
	test('MUTATION: removing the Content entry from the inventory reopens the composition tier', async () => {
		const listed = new Set(
			BASELINE_FORM_INVENTORY.filter(
				(entry) => !(entry.kind === 'template-node' && entry.form === 'Content'),
			).map((entry) => `${entry.kind}:${entry.form}`),
		);
		// The removal really removed something, or this row measures nothing.
		expect(listed.size).toBe(BASELINE_FORM_INVENTORY.length - 1);
		const uncovered = new Set<string>();
		for (const entry of await compositionEntries())
			for (const observed of collectEmittedForms(entry.source)) {
				const key = `${observed.kind}:${observed.form}`;
				if (!listed.has(key)) uncovered.add(key);
			}
		expect([...uncovered]).toEqual(['template-node:Content']);
	});

	/**
	 * THE MUTATION THAT KILLS THE `parseEmitted` FIX - and it is the one mutation
	 * the shipped corpus cannot supply, because every rejected form it contains
	 * sits in a SINGLE-component file where the old parser saw it anyway.
	 *
	 * The defect was: `parseEmitted` overwrote its component binding on every
	 * match, so a module declaring two components was inspected only at the LAST
	 * one. Every component-scoped policy in this gate - inventory, whitespace,
	 * two-way, changeDetection, getter purity, template-parse - silently skipped
	 * everything before it. A gate that inspects half a file is indistinguishable
	 * from a clean file, which is the whole reason this row exists.
	 *
	 * So: THREE rejected forms planted on the FIRST of two components, each
	 * reaching the gate through a DIFFERENT scoped path - template nodes, decorator
	 * metadata, and class members - so a partial fix that reconnected only one of
	 * them is still red. Each is asserted with the LINE it was reported at, and
	 * every line is proved to fall INSIDE the first component. A file-level "the
	 * gate said something" would pass just as well if the second component had
	 * grown the form instead; the line is what makes this attributable.
	 *
	 * THE CONTROL, and it is what stops this row degenerating into "the gate
	 * rejects everything": the same three policies are asserted ABSENT from the
	 * unmutated artifact, which since T017 admitted `template-node:Content` draws
	 * NO violations at all. The control got STRONGER when the ruling landed - it
	 * used to have to tolerate one unruled form, and an empty expectation is the
	 * sharpest form this assertion can take.
	 */
	test('MUTATION: a form on the FIRST of two components is rejected, not skipped', async () => {
		const slot = await readFile(
			resolve(packageRoot, 'generated-composition/C1-slot.ts'),
			'utf8',
		);
		// The file really does declare two components, or this row measures nothing.
		expect(slot.match(/^@Component\(\{$/gm)?.length ?? 0).toBe(2);
		// THE CONTROL FIRST. Unmutated, this file is CLEAN - it draws nothing, and it
		// is passed here with no artifact deliberately, because it has no imports at
		// all, so `undisclosed-import` has nothing to consult and nothing to say.
		expect(await policiesFor('generated-composition/C1-slot.ts', slot)).toEqual([]);

		// 1. TEMPLATE-scoped: a two-way binding inside `Frame`'s template.
		const twoWay = mutate(slot, '<section data-frame>', '<section data-frame [(value)]="x">');
		// 2. METADATA-scoped: a changeDetection override on `Frame`'s decorator.
		const changeDetection = mutate(
			twoWay,
			"selector: 'frameless-frame',",
			"selector: 'frameless-frame',\n\tchangeDetection: 1,",
		);
		// 3. CLASS-MEMBER-scoped: an impure getter on the `Frame` class body.
		const mutant = mutate(
			changeDetection,
			'class Frame {}',
			'class Frame {\n\tseen: number[] = [];\n\tget bad() {\n\t\tthis.seen.push(1);\n\t\treturn 1;\n\t}\n}',
		);

		// The boundary is computed on the MUTANT, not on the original: two of the
		// three plants insert lines ahead of the second decorator, so an ordinal read
		// off the unmutated file would be off by three and the row would fail for a
		// reason that has nothing to do with what it measures.
		expect(mutant.match(/^@Component\(\{$/gm)?.length ?? 0).toBe(2);
		const secondComponentLine =
			mutant
				.slice(0, mutant.indexOf('@Component({', mutant.indexOf('@Component({') + 1))
				.split('\n').length;

		const violations = await violationsFor('generated-composition/FirstComponentMutant.ts', mutant);
		for (const policy of [
			'no-two-way-binding',
			'no-change-detection-override',
			'getter-expression-purity',
		]) {
			const reported = violations.filter((entry) => entry.policy === policy);
			expect(reported.length, `${policy}\n${JSON.stringify(violations, null, 2)}`).toBeGreaterThan(0);
			for (const entry of reported)
				expect(entry.line, `${policy} reported at ${String(entry.line)}`).toBeLessThan(
					secondComponentLine,
				);
		}
	});

	/**
	 * CALIBRATION for the DERIVED inventory. A derived list that nobody has
	 * watched go red is not an instrument - and the literal it replaced at least
	 * failed loudly when it drifted. Both directions are driven through the SAME
	 * `discoverGeneratedFiles()` the assertion above calls, against a throwaway
	 * root, so this measures the real comparison and not a lookalike.
	 */
	test('CALIBRATION: the derived inventory goes red on a missing and on an extra file', async () => {
		const corpus = scenarioCorpus('ts');
		// THE FLOOR. Every scenario ratified so far must still be in the derivation.
		// A lower bound, so S5 and later widen it with no edit here, while a golden
		// that silently disappeared is red.
		expect(corpus).toEqual(
			expect.arrayContaining([
				'generated/S1.ts',
				'generated/S2.ts',
				'generated/S3.ts',
				'generated/S4.ts',
			]),
		);
		const root = await realpath(await mkdtemp(resolve(tmpdir(), 'frameless-angular-inventory-')));
		try {
			await mkdir(resolve(root, 'generated'));
			const stub = '// inventory calibration\n';
			for (const file of corpus.slice(0, -1)) await writeFile(resolve(root, file), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).not.toEqual(corpus);
			await writeFile(resolve(root, corpus.at(-1)!), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).toEqual(corpus);
			await writeFile(resolve(root, 'generated/S99.ts'), stub);
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
		expect(s1).toContain('@Component({');
		expect(() => mutate(s1, '@Component({', '@Component({')).toThrow(
			/did not change the source/,
		);
	});

	test('MUTATION: rejects emitted source without the generated header', async () => {
		const mutant = mutate(s1, '// @generated by @frameless/angular', '// hand written');
		expect(await policiesFor('generated/HeaderMutant.ts', mutant)).toContain('generated-header');
	});

	/**
	 * ARBITER 1 AS A STANDING POLICY. `frameless-angular-v1` T002 ruling 4 requires
	 * an EXACT EMPTY error set over all three templates WITH a mutation calibration
	 * proving red - a check that cannot fail is not a check.
	 */
	test('MUTATION: template-parse goes red on a template Angular refuses', async () => {
		const mutant = mutate(s1, '{{ derived }}', '{{ derived++ }}');
		const violations = await violationsFor('generated/ParseMutant.ts', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('template-parse');
		expect(violations.find((entry) => entry.policy === 'template-parse')?.message).toContain(
			'Unexpected end of expression',
		);
		// And the emitter would never have produced it, which is the second line.
		expect(templateDiagnostics('{{ derived++ }}', 'probe.html')).not.toEqual([]);
	});

	test('MUTATION: template-parse reports a component with no inline template at all', async () => {
		const mutant = mutate(s1, /\ttemplate: `[\s\S]*?\n\t`,\n/, '');
		expect(await policiesFor('generated/NoTemplateMutant.ts', mutant)).toContain(
			'template-parse',
		);
	});

	/**
	 * THE ROW THAT ENFORCES A SETTLED RULING, and the arbiter demonstrably cannot do
	 * it. The decorator-vs-signal member declaration was ruled NO-SUGAR twice
	 * independently, and `frameless-angular-v1` T005 re-ran all six gates against
	 * this landed lane at `@angular/core` 22.0.8 and upheld it - DENIED, not
	 * deferred, decided at Gate 5. Gate 6 FAILED, which is the reason this row
	 * matters: `pnpm e2e` would NOT go red on the sugar, because both arms render
	 * identically. This policy is the sole enforcement point, so its dossier ref is
	 * pinned here too - a silent revert to the provisional "held out for T005"
	 * wording would mean the ruling had been un-recorded.
	 */
	test('MUTATION: rejects a signal member, which the applied arbiter is SILENT about', async () => {
		const mutant = mutate(s2, '@Input() seed: any;', 'seed = input();');
		const violations = await violationsFor('generated/SignalMutant.ts', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('no-signal-members');
		expect(
			violations.find((entry) => entry.policy === 'no-signal-members')?.dossierRef,
		).toBe('frameless-angular-v1 T005 (decorator-vs-signal, DENIED at G5 and G6)');
		// MEASURED, and this is why the policy is frameless-owned rather than
		// delegated: @angular-eslint/prefer-signals holds the OPPOSITE view but
		// upstream keeps it in `all`, not `recommended`. Zero upstream messages.
		expect(await eslintMessagesFor('generated/SignalMutant.ts', mutant)).toEqual([]);
		for (const api of ['signal(0)', 'computed(() => 1)', 'model()', 'output()']) {
			const each = mutate(s2, 'this.draft = event.currentTarget.value;', `const x = ${api};`);
			expect(await policiesFor('generated/SignalMutant.ts', each), api).toContain(
				'no-signal-members',
			);
		}
	});

	test('MUTATION: rejects two-way binding, which banana-in-box does NOT report', async () => {
		const mutant = mutate(s2, '[value]="draft"', '[(ngModel)]="draft"');
		const violations = await violationsFor('generated/TwoWayMutant.ts', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('no-two-way-binding');
		// The applied template rule `banana-in-box` reports only the ([x])
		// MISORDERING, never the construct - measured, which is what makes this a
		// frameless-owned policy rather than a delegated one.
		expect(await eslintMessagesFor('generated/TwoWayMutant.ts', mutant)).toEqual([]);
		// Angular's own parse is what is read, not the text: the emitted spelling
		// arrives as BindingType.TwoWay.
		expect(
			violations.find((entry) => entry.policy === 'no-two-way-binding')?.message,
		).toContain('two-way binds ngModel');
	});

	/**
	 * RULING 2 - `@Output()`/`EventEmitter` is REFUSED, and here BOTH authorities
	 * reach that refusal by different mechanisms. The frameless policy reads the
	 * IR's own contract (`onTrace` is a callback PROP with 2- and 3-argument call
	 * sites, and `emit()` takes one value); the arbiter reaches it from Angular's
	 * naming guidance. Agreement from two independent directions is the strongest
	 * result a ruling can get.
	 */
	test('MUTATION: rejects @Output/EventEmitter, and upstream independently agrees', async () => {
		const mutant = mutate(
			s2,
			'@Input() onTrace: any;',
			'@Output() onTrace = new EventEmitter();',
		);
		const violations = await violationsFor('generated/OutputMutant.ts', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('no-output-emitter');
		expect(violations.map((entry) => entry.policy)).toContain(
			'eslint:@angular-eslint/no-output-on-prefix',
		);
	});

	/**
	 * `frameless-angular-v1` T003a: at Angular 22 OnPush IS the default and the
	 * applied rule reports only an explicit opt-out. Both directions are asserted,
	 * because the consequence T004 inherits is that emitted components are
	 * OnPush-CHECKED.
	 */
	test('MUTATION: rejects an explicit changeDetection, and upstream agrees on Default', async () => {
		const explicitDefault = mutate(
			s1,
			'\tselector:',
			'\tchangeDetection: ChangeDetectionStrategy.Default,\n\tselector:',
		);
		const violations = await violationsFor('generated/CdMutant.ts', explicitDefault);
		expect(violations.map((entry) => entry.policy)).toContain('no-change-detection-override');
		expect(violations.map((entry) => entry.policy)).toContain(
			'eslint:@angular-eslint/prefer-on-push-component-change-detection',
		);
		// Even an explicit OnPush is refused: it is redundant at 22 and it is a form
		// the inventory has no floor for, so it is a deliberate edit rather than a
		// drift.
		const explicitOnPush = mutate(
			s1,
			'\tselector:',
			'\tchangeDetection: ChangeDetectionStrategy.OnPush,\n\tselector:',
		);
		expect(await policiesFor('generated/CdOnPushMutant.ts', explicitOnPush)).toContain(
			'no-change-detection-override',
		);
	});

	test('MUTATION: rejects stopPropagation, and the emitter refuses to produce it', async () => {
		const mutant = mutate(s3, 'event.preventDefault();', 'event.stopPropagation();');
		expect(await policiesFor('generated/StopPropagationMutant.ts', mutant)).toContain(
			'no-stop-propagation',
		);
		// The gate is the second line. The first is the emitter: a declared
		// stopPropagation throws rather than growing a path the corpus has no
		// instance to test.
		const artifact = structuredClone(await golden('s3-event-form.json'));
		const event = artifact.records.events.find((entry) => entry.syncPolicy)!;
		(event as unknown as { syncPolicy: { actions: string[] } }).syncPolicy.actions.push(
			'stopPropagation',
		);
		expect(() => emit(artifact)).toThrow(/fails closed on a declared stopPropagation/);
	});

	test('MUTATION: persistence-bearing IR fails closed in the gate and the emitter', async () => {
		const artifact = structuredClone(await golden('s1-render-once.json'));
		(artifact.records.persistence as unknown[]).push({ graphNodeId: 'state:count' });
		const result = await checkSources([
			{ file: 'generated/PersistenceMutant.ts', source: s1, artifact },
		]);
		expect(result.unevaluated).toEqual([]);
		expect(result.violations).toEqual([
			expect.objectContaining({ policy: 'persistence-render-lowering' }),
		]);
		expect(() => emit(artifact)).toThrow(/does not support persistence-bearing IR/);
	});
});

/**
 * M1 - the measured whitespace rule, as a STANDING POLICY rather than a one-off
 * probe. `test/parse-emitted.test.ts` measures what Angular's
 * `preserveWhitespaces: false` default does; this is the check that the emitter
 * never produces a layout it damages. Every arm of the measurement has a row,
 * INCLUDING the arm that refuted the Vue lane's answer.
 */
describe('MUTATION: whitespace-stable-text (M1)', () => {
	test('ANTI-VACUITY: the shipped corpus is accepted, newlines between elements and all', async () => {
		// If this policy were "reject any whitespace" the clean corpus would already
		// be red, and every row below would be measuring the mutant rather than the
		// policy. The emitted templates are full of newline-separated siblings.
		expect(s1).toContain('</output>\n\t\t\t\t\t<button');
		// The DERIVED corpus, so a new scenario's template layout is measured
		// against this policy the day it lands.
		for (const [file, source] of emittedSources)
			expect(await policiesFor(file, source), file).not.toContain('whitespace-stable-text');
	});

	test('rejects a text child on its own line - <button> increment\\n</button>', async () => {
		const mutant = mutate(s1, '>increment</button>', '>\n\t\t\t\t\t\tincrement\n\t\t\t\t\t</button>');
		const violations = await violationsFor('generated/TextWhitespaceMutant.ts', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('whitespace-stable-text');
		expect(
			violations.find((entry) => entry.policy === 'whitespace-stable-text')?.message,
		).toContain('" increment');
	});

	test('rejects a newline between an interpolation and text - S2 rendering 1\\n/2', async () => {
		const mutant = mutate(
			s2,
			'>{{ complete }}/{{ todos.length }}<',
			'>\n\t\t\t\t{{ complete }}\n\t\t\t\t/{{ todos.length }}\n\t\t\t<',
		);
		const violations = await violationsFor('generated/InterpolationWhitespaceMutant.ts', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('whitespace-stable-text');
		expect(
			violations.find((entry) => entry.policy === 'whitespace-stable-text')?.message,
		).toContain('interpolation text segment');
	});

	test('rejects a LONE interpolation child on its own line - the arm Vue measured SAFE', async () => {
		// The Vue lane measured this arm safe and recorded its identical inline rule
		// as merely conservative. Re-measured against Angular it is FALSE, so this
		// row is the one that would have shipped silently wrong had the Vue
		// measurement been inherited.
		const mutant = mutate(
			s3,
			'>{{ writes }}</output>',
			'>\n\t\t\t\t{{ writes }}\n\t\t\t</output>',
		);
		expect(await policiesFor('generated/LoneInterpolationMutant.ts', mutant)).toContain(
			'whitespace-stable-text',
		);
	});
});

/**
 * IR-7 - the sleeper. S1's `derived` is trivial and will always pass, which is the
 * definition of a green vacuum, so the policy is calibrated against planted
 * members of the set it claims to catch (instrument rule 4) and against two shapes
 * it must NOT catch.
 *
 * It bites harder in Angular than in Vue: this emitter lowers a `computed` binding
 * to a GETTER, and Angular re-evaluates a getter on EVERY change-detection pass,
 * so an impure getter writes on every tick.
 */
describe('MUTATION: getter-expression-purity (IR-7)', () => {
	test('rejects an update expression inside a getter', async () => {
		const mutant = mutate(s1, 'this.count * this.multiplier', 'this.count++ * this.multiplier');
		const violations = await violationsFor('generated/GetterUpdateMutant.ts', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('getter-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'getter-expression-purity')?.message,
		).toContain('update expression');
	});

	test('rejects an assignment inside a getter', async () => {
		const mutant = mutate(
			s1,
			'this.count * this.multiplier',
			'(this.count = 2) * this.multiplier',
		);
		const violations = await violationsFor('generated/GetterAssignMutant.ts', mutant);
		expect(
			violations.find((entry) => entry.policy === 'getter-expression-purity')?.message,
		).toContain('assignment');
	});

	test('rejects a known-mutating method call inside a getter', async () => {
		const mutant = mutate(
			s2,
			'this.todos.filter((todo) => todo.done)',
			'this.todos.sort()',
		);
		const violations = await violationsFor('generated/GetterSortMutant.ts', mutant);
		expect(
			violations.find((entry) => entry.policy === 'getter-expression-purity')?.message,
		).toContain('.sort()');
	});

	test('rejects a delete expression inside a getter', async () => {
		const mutant = mutate(s1, '${this.prefix}', '${delete globalThis.x}');
		expect(await policiesFor('generated/GetterDeleteMutant.ts', mutant)).toContain(
			'getter-expression-purity',
		);
	});

	test('ANTI-VACUITY: a non-mutating call and a mutation OUTSIDE a getter are accepted', async () => {
		// S2's own getter is `this.todos.filter(...).length`. If this policy were
		// "reject any call" the clean corpus would already be red, and every row
		// above would be measuring nothing.
		expect(s2).toContain('return this.todos.filter((todo) => todo.done).length;');
		expect(await policiesFor('generated/S2.ts', s2)).not.toContain('getter-expression-purity');
		// Every lowered METHOD assigns to `this.todos` and calls `.slice()` /
		// `.concat()`, and ngOnInit assigns to every field. The policy reads getter
		// membership off the class AST, not text.
		expect(s2).toContain('this.todos = this.todos.concat(item);');
		const methodMutant = mutate(s2, "this.draft = '';", "this.draft = ''; this.next++;");
		expect(await policiesFor('generated/MethodMutant.ts', methodMutant)).not.toContain(
			'getter-expression-purity',
		);
	});

	test('states what it cannot see, so a pass is never read as a purity proof', async () => {
		// NOT a policy failure - a DOCUMENTED blind spot, pinned so that closing it
		// later is a deliberate change rather than an accident. A getter that CALLS
		// an impure method is accepted, because the walk never leaves the getter.
		const source = [
			'// @generated by @frameless/angular from Blind; do not edit.',
			"import { Component } from '@angular/core';",
			'',
			'@Component({',
			"\tselector: 'frameless-blind',",
			'\ttemplate: `',
			'\t\t<p>{{ derived }}</p>',
			'\t`,',
			'})',
			'export class Blind {',
			'\tcount: any = 1;',
			'\timpure(): any {',
			'\t\tthis.count += 1;',
			'\t\treturn this.count;',
			'\t}',
			'\tget derived(): any {',
			'\t\treturn this.impure();',
			'\t}',
			'}',
			'',
		].join('\n');
		expect(await policiesFor('generated/Blind.ts', source)).not.toContain(
			'getter-expression-purity',
		);
	});
});

/**
 * THE BASELINE FORM INVENTORY, and the one place this lane's answer DIFFERS from
 * the Vue lane's rather than inheriting it.
 *
 * Vue could claim "safe across the whole Vue 3 line". Angular's line runs from 2
 * to 22 and this emitter's output is NOT safe across it: `@if`/`@for` are 17 and a
 * standalone-by-default component is 19. The honest discharge is an allowlist with
 * a floor per entry and a LANE FLOOR derived as the max over them.
 */
describe('MUTATION: baseline-form-inventory (IR-4)', () => {
	test('ANTI-VACUITY: the observed form set of the shipped corpus is pinned exactly', () => {
		// If the walk stopped descending, or a whole observer silently returned
		// nothing, the inventory would still be green on every mutant below - it
		// would just have stopped looking. This is the row that catches that, and it
		// is also the freshness pin.
		const shared = [
			{ kind: 'class-heritage', form: 'implements' },
			{ kind: 'class-member', form: 'method' },
			{ kind: 'class-member', form: 'property' },
			{ kind: 'component-metadata', form: '(no standalone key)' },
			{ kind: 'component-metadata', form: 'selector' },
			{ kind: 'component-metadata', form: 'template' },
		];
		const module = [
			{ kind: 'decorator', form: 'Component' },
			{ kind: 'decorator', form: 'Input' },
			{ kind: 'import', form: '@angular/core#Component' },
			{ kind: 'import', form: '@angular/core#Input' },
			{ kind: 'import', form: '@angular/core#OnInit' },
		];
		expect(collectEmittedForms(s1)).toEqual([
			shared[0],
			{ kind: 'class-member', form: 'get' },
			shared[1],
			shared[2],
			shared[3],
			shared[4],
			shared[5],
			{ kind: 'control-flow', form: '@else' },
			{ kind: 'control-flow', form: '@if' },
			...module,
			{ kind: 'template-binding', form: 'event' },
			{ kind: 'template-binding', form: 'interpolation' },
			{ kind: 'template-node', form: 'BoundEvent' },
			{ kind: 'template-node', form: 'BoundText' },
			{ kind: 'template-node', form: 'Element' },
			{ kind: 'template-node', form: 'IfBlock' },
			{ kind: 'template-node', form: 'IfBlockBranch' },
			{ kind: 'template-node', form: 'Text' },
			{ kind: 'template-node', form: 'TextAttribute' },
		]);
		// S2 adds the repeat, both binding kinds, and the loop Variable.
		const s2Forms = collectEmittedForms(s2);
		expect(s2Forms).toContainEqual({ kind: 'control-flow', form: '@for' });
		expect(s2Forms).toContainEqual({ kind: 'template-node', form: 'ForLoopBlock' });
		expect(s2Forms).toContainEqual({ kind: 'template-node', form: 'Variable' });
		expect(s2Forms).toContainEqual({ kind: 'template-binding', form: 'Property' });
		expect(s2Forms).toContainEqual({ kind: 'template-binding', form: 'Attribute' });
		// S3 has no derived binding, so no getter - which is what makes the S1 pin
		// above a real observation rather than a constant.
		expect(collectEmittedForms(s3)).not.toContainEqual({ kind: 'class-member', form: 'get' });
		// And every observed form is on the inventory, which is the same claim the
		// clean-corpus row makes from the other side.
		const listed = new Set(BASELINE_FORM_INVENTORY.map((entry) => `${entry.kind}:${entry.form}`));
		for (const source of [s1, s2, s3])
			for (const observed of collectEmittedForms(source))
				expect(listed).toContain(`${observed.kind}:${observed.form}`);
	});

	test('the lane floor is DERIVED from the inventory, not written down twice', () => {
		expect(ANGULAR_BASELINE_FLOOR).toBe('19.0');
		// The entry that sets it, named so that raising or lowering the floor is a
		// visible edit: a component with no `standalone` key is standalone only from
		// Angular 19.
		const highest = BASELINE_FORM_INVENTORY.filter(
			(entry) => entry.floor === ANGULAR_BASELINE_FLOOR,
		);
		expect(highest.map((entry) => entry.form)).toEqual(['(no standalone key)']);
		// The second tier is built-in control flow, which the APPLIED ARBITER itself
		// pushes this lane onto: prefer-control-flow reports *ngIf/*ngFor.
		expect(
			BASELINE_FORM_INVENTORY.filter((entry) => entry.floor === '17.0').map(
				(entry) => entry.form,
			),
		).toEqual(['IfBlock', 'IfBlockBranch', 'ForLoopBlock', '@if', '@else', '@for']);
		expect(ANGULAR_ESLINT_RULES_APPLIED).toContain(
			'@angular-eslint/template/prefer-control-flow',
		);
	});

	test('rejects a class member kind the emitter never decided to emit', async () => {
		const mutant = mutate(s1, '\tget derived(): any {', '\tset derived(v: any) {}\n\tget derived(): any {');
		const violations = await violationsFor('generated/SetterMutant.ts', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('"set"');
	});

	// `NgZone`, NOT `inject`. This row used `inject` until S8, the async scenario,
	// made the emitter spell `inject(ChangeDetectorRef)` in any class with an
	// async handler - at which point `inject` entered BASELINE_FORM_INVENTORY with
	// a recorded 14.0 floor and this mutant silently stopped being a mutant. That
	// is the "an anchor that has stopped biting" failure the harness elsewhere
	// guards with occurrence counts, and it is why the replacement is a form the
	// emitter has no route to at all: `NgZone` is the zone-based answer to exactly
	// the change-detection problem `notifyAfterSuspension` solves zonelessly, so
	// if it ever appears in emitted output this row going red is the correct
	// outcome and not an obstacle.
	test('rejects a runtime import the emitter has no ruling for', async () => {
		const mutant = mutate(
			s1,
			"import { Component, Input, type OnInit } from '@angular/core';",
			"import { Component, Input, NgZone, type OnInit } from '@angular/core';",
		);
		const violations = await violationsFor('generated/ImportMutant.ts', mutant);
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('@angular/core#NgZone');
	});

	test('rejects a component metadata key above the emitted surface', async () => {
		const mutant = mutate(s1, '\tselector:', '\thost: { class: "x" },\n\tselector:');
		const violations = await violationsFor('generated/HostMutant.ts', mutant);
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('"host"');
	});

	/**
	 * `@switch`, NOT `<ng-content>`. THIS ROW WAS INVERTED, NOT DELETED, AND THE
	 * PRECEDENT IS TWO ROWS ABOVE.
	 *
	 * It used `<ng-content>` as its example of a form this lane must reject, while
	 * `generated-composition/M1-panel.ts` and the `Frame` component inside
	 * `C1-slot.ts` HAD BEEN SHIPPING `<ng-content />` since the day composition
	 * landed. A standing test and two committed artifacts were in direct
	 * contradiction, and this package only got away with asserting both because the
	 * gated corpus was `generated/` only. `frameless-app-axes-v1` T017 admitted
	 * `template-node:Content` at floor 2.0, so the mutant stopped being a mutant -
	 * the exact "an anchor that has stopped biting" failure the `inject`/`NgZone`
	 * row above records for itself, arriving a second time.
	 *
	 * The repair is the same one that row took: the retired arm is INVERTED rather
	 * than removed, because "the gate ACCEPTS the form we deliberately added" is
	 * exactly as load-bearing as "it rejects the ones we did not" - and a deleted
	 * arm would leave nothing watching the admission.
	 *
	 * THE REPLACEMENT WAS CHOSEN BY MEASUREMENT, AND CORPUS-WIDE ABSENCE ALONE WAS
	 * NOT THE TEST. Every candidate was parsed through this gate's own observer
	 * against the whole 18-file corpus:
	 *
	 * - `<ng-container>` produces NO new form at all - the parser reports it as
	 *   `Element`, so it would have been an anchor that never bit even once.
	 * - `<b #ref>` produces `template-node:Reference`, which is absent from the
	 *   corpus today AND WOULD HAVE BEEN THE WRONG CHOICE: this emitter DOES have
	 *   a route to it. `classMembers` in ../src/emitter/index.ts prints a `#name`
	 *   template reference variable paired with `@ViewChild`, so the first emitted
	 *   refs scenario would retire this row all over again. Corpus-wide absence is
	 *   NECESSARY and NOT SUFFICIENT; the standard the `NgZone` row states is a
	 *   form the emitter has NO ROUTE TO.
	 * - `@switch` produces `template-node:SwitchBlock`, is absent from the corpus,
	 *   and the string `@switch` occurs ZERO times in the emitter: this lane lowers
	 *   every conditional to `@if`/`@else`. It is the block-structured answer to
	 *   exactly the multi-branch problem the emitter solves the other way, which is
	 *   the same relationship `NgZone` has to `notifyAfterSuspension`. If it ever
	 *   appears in emitted output, this row going red is the correct outcome.
	 */
	test('accepts <ng-content>, the admitted form, and rejects @switch, which the emitter has no route to', async () => {
		// THE INVERTED ARM. `<ng-content />` is what STEP 5 lowers a default-slot
		// projection onto, and it is now an inventory entry with a recorded floor.
		const content = mutate(
			s1,
			'<output data-value="derived">',
			'<ng-content></ng-content><output data-value="derived">',
		);
		expect(await policiesFor('generated/ContentMutant.ts', content)).not.toContain(
			'baseline-form-inventory',
		);
		expect(
			BASELINE_FORM_INVENTORY.find(
				(entry) => entry.kind === 'template-node' && entry.form === 'Content',
			)?.floor,
		).toBe('2.0');
		// THE REJECTING ARM, so the arm above measures the inventory rather than a
		// disabled check: a template node kind that is NOT inventoried still goes red
		// BY NAME through the very same call.
		const switchBlock = mutate(
			s1,
			'<output data-value="derived">',
			'@switch (derived) { @case (1) { <b>one</b> } @default { <i>other</i> } }<output data-value="derived">',
		);
		const violations = await violationsFor('generated/SwitchMutant.ts', switchBlock);
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
			JSON.stringify(violations, null, 2),
		).toContain('SwitchBlock');
	});

	test('rejects a structural directive, which prefer-control-flow ALSO reports', async () => {
		const mutant = mutate(
			mutate(
				s2,
				'@for (todo of todos; track todo.id) {',
				'<ng-container *ngFor="let todo of todos">',
			),
			'\n\t\t\t\t}\n\t\t\t</ul>',
			'\n\t\t\t\t</ng-container>\n\t\t\t</ul>',
		);
		const violations = await violationsFor('generated/NgForMutant.ts', mutant);
		// The mutant is well-formed - the point is that a template Angular ACCEPTS
		// can still be a form this lane never decided to emit.
		expect(violations.map((entry) => entry.policy)).not.toContain('template-parse');
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(violations.map((entry) => entry.policy)).toContain(
			'eslint:@angular-eslint/template/prefer-control-flow',
		);
	});

	test('every recorded floor is a claim with an evidence status attached to it', async () => {
		expect(BASELINE_FORM_INVENTORY.length).toBeGreaterThan(0);
		for (const entry of BASELINE_FORM_INVENTORY) {
			expect(entry.floor, `${entry.kind}:${entry.form}`).toMatch(/^\d+\.\d+/);
			if (entry.evidence.status === 'unverified') {
				// The REASON is the deliverable. "unverified" with no reason is a guess
				// wearing an honest label.
				expect(entry.evidence.reason.length, `${entry.kind}:${entry.form}`).toBeGreaterThan(40);
				continue;
			}
			await expect(
				citationHolds(entry.evidence),
				`${entry.kind}:${entry.form} cites ${entry.evidence.file}`,
			).resolves.toBe(true);
		}
		expect(
			BASELINE_FORM_INVENTORY.every((entry) => entry.evidence.status === 'unverified'),
			'if this fails a floor was verified - good; delete this line and keep the loop above',
		).toBe(true);
	});

	test('CALIBRATION: the citation checker is re-read, and can pass, fail and throw', async () => {
		// EVERY entry is `unverified` today, so the loop above never enters its
		// verified branch and would be vacuous on its own. This plants all three
		// outcomes against the real resolved package.
		await expect(
			citationHolds({
				package: '@angular/compiler',
				file: 'package.json',
				needle: '"name": "@angular/compiler"',
			}),
		).resolves.toBe(true);
		await expect(
			citationHolds({
				package: '@angular/compiler',
				file: 'package.json',
				needle: '"name": "not-the-compiler"',
			}),
		).resolves.toBe(false);
		await expect(
			citationHolds({
				package: '@angular/compiler',
				file: 'there-is-no-such-file.d.ts',
				needle: 'x',
			}),
		).rejects.toThrow();
	});
});

/**
 * THE THIRD-PARTY ARBITER: `@angular-eslint`'s two leaf plugins.
 *
 * Every policy above encodes what THIS REPO decided. These encode what the Angular
 * team decided, and the whole point is that nobody here got a vote.
 *
 * TWO-SIDED BY CONSTRUCTION. The green side is the shipped corpus drawing ZERO
 * messages from all applied rules; the red side is planted violations asserted by
 * RULE ID and by the upstream MESSAGE TEXT rather than by "some violation
 * appeared". A gate that has only ever been green is not evidence, and a gate that
 * cannot be shown to go red is not a gate.
 */
describe('third-party arbiter: @angular-eslint', () => {
	test('GREEN SIDE: the shipped corpus draws no message from any applied rule', async () => {
		// Iterates the DERIVED corpus. This row used to name S1/S2/S3, so a fourth
		// emitted component could join the repo without the Angular team's own rules
		// ever being run over it.
		expect(emittedSources.size).toBe(scenarioCorpus('ts').length);
		for (const [file, source] of emittedSources)
			expect(
				await eslintMessagesFor(file, source),
				`${file} drew an upstream message`,
			).toEqual([]);
		// ANTI-VACUITY for the green side itself: an arbiter wired to nothing is also
		// green. THE ORDERING IS THE ARGUMENT - the set was fixed by upstream's own
		// metadata BEFORE the corpus was measured, and the measurement came back
		// clean. Nothing that fired was removed.
		expect(ANGULAR_ESLINT_RULES_APPLIED).toHaveLength(17);
		expect(ANGULAR_ESLINT_TS_RULES_DERIVED).toHaveLength(12);
		expect(ANGULAR_ESLINT_TEMPLATE_RULES_DERIVED).toHaveLength(4);
	});

	/**
	 * THE DERIVATION, RE-RUN AGAINST THE INSTALLED PLUGINS.
	 *
	 * `frameless-angular-v1` T002 ruling 4 modelled this on Svelte's gate consuming
	 * `configs.recommended`, and T003 REFUTED that premise by measurement: neither
	 * leaf plugin publishes a config at all. T003a's answer is to derive from
	 * `meta.docs.recommended`, which is the same metadata upstream's own generator
	 * reads. This row is the standing check that the derivation still SEES the
	 * metadata - a plugin that dropped the field would otherwise silently yield an
	 * empty applied set and a permanently green arbiter.
	 */
	test('MEASURED: the applied set is DERIVED from upstream metadata, 12 of 50 and 4 of 41', () => {
		expect(Object.keys(ngPlugin.rules)).toHaveLength(50);
		expect(Object.keys(tplPlugin.rules)).toHaveLength(41);
		expect([...ANGULAR_ESLINT_TS_RULES_DERIVED]).toEqual([
			'@angular-eslint/contextual-lifecycle',
			'@angular-eslint/no-empty-lifecycle-method',
			'@angular-eslint/no-input-rename',
			'@angular-eslint/no-inputs-metadata-property',
			'@angular-eslint/no-output-native',
			'@angular-eslint/no-output-on-prefix',
			'@angular-eslint/no-output-rename',
			'@angular-eslint/no-outputs-metadata-property',
			'@angular-eslint/prefer-inject',
			'@angular-eslint/prefer-on-push-component-change-detection',
			'@angular-eslint/prefer-standalone',
			'@angular-eslint/use-pipe-transform-interface',
		]);
		expect([...ANGULAR_ESLINT_TEMPLATE_RULES_DERIVED]).toEqual([
			'@angular-eslint/template/banana-in-box',
			'@angular-eslint/template/eqeqeq',
			'@angular-eslint/template/no-negated-async',
			'@angular-eslint/template/prefer-control-flow',
		]);
		// THE FOUR RULES THAT FIRED DURING THE FIRST T003 ATTEMPT ALL DISSOLVE,
		// because none of them is in upstream's own recommended set. This is pinned
		// so a later plugin PROMOTING one of them is a red test and a finding rather
		// than a silent corpus failure.
		for (const rule of [
			'@angular-eslint/component-class-suffix',
			'@angular-eslint/prefer-signals',
			'@angular-eslint/template/button-has-type',
			'@angular-eslint/template/i18n',
		])
			expect(ANGULAR_ESLINT_RULES_APPLIED, rule).not.toContain(rule);
	});

	/**
	 * THE ONE FRAMELESS-AUTHORED DELTA, AND ITS DIRECTION IS THE ARGUMENT. It is an
	 * ADDITION and there are ZERO omissions, so the delta CANNOT have been used to
	 * make the corpus green.
	 */
	test('records the one addition with its provenance, and omits nothing', async () => {
		expect(ANGULAR_ESLINT_RULES_OMITTED).toEqual([]);
		expect(ANGULAR_ESLINT_RULES_ADDED.map((entry) => entry.rule)).toEqual([
			'@angular-eslint/use-lifecycle-interface',
		]);
		for (const entry of ANGULAR_ESLINT_RULES_ADDED) {
			expect(entry.reason.length, entry.rule).toBeGreaterThan(120);
			// The measured provenance: it IS in upstream's published preset, and its
			// own metadata flag is absent - which is exactly why derivation misses it.
			const bare = entry.rule.replace('@angular-eslint/', '');
			expect(
				(ngPlugin.rules as Record<string, any>)[bare]?.meta?.docs?.recommended,
			).toBeUndefined();
		}
		// And it is load-bearing rather than decorative: dropping `implements OnInit`
		// from a class that declares ngOnInit is a message no other applied rule
		// produces.
		const mutant = mutate(s1, ' implements OnInit', '');
		expect(await eslintMessagesFor('generated/LifecycleMutant.ts', mutant)).toEqual([
			{
				policy: 'eslint:@angular-eslint/use-lifecycle-interface',
				message: expect.stringContaining("Lifecycle interface 'OnInit' should be implemented"),
			},
		]);
	});

	/**
	 * THE ROWS THAT EARN THE ARBITER ITS KEEP, and `frameless-angular-v1` T002's
	 * dissent 2 predicted exactly this: `@for`'s mandatory `track` closes the
	 * require-each-key hole at the COMPILER, so the arbiter's value here is not the
	 * finding Vue and Svelte got. Its keep is earned by the planted-violation
	 * calibration instead - which is why there are six of them across both plugins.
	 */
	test('RED: the arbiter reports across BOTH plugins on planted violations', async () => {
		const rows: ReadonlyArray<readonly [string, string, string, string]> = [
			[
				'aliased input',
				'@Input() seed: any;',
				"@Input('seedAlias') seed: any;",
				'eslint:@angular-eslint/no-input-rename',
			],
			[
				'inputs metadata property',
				'\tselector:',
				"\tinputs: ['seed'],\n\tselector:",
				'eslint:@angular-eslint/no-inputs-metadata-property',
			],
			[
				'standalone opt-out',
				'\tselector:',
				'\tstandalone: false,\n\tselector:',
				'eslint:@angular-eslint/prefer-standalone',
			],
			[
				'constructor injection',
				'\tngOnInit(): void {',
				'\tconstructor(private http: any) {}\n\tngOnInit(): void {',
				'eslint:@angular-eslint/prefer-inject',
			],
			[
				'loose equality in a template',
				'todos.length === 0',
				'todos.length == 0',
				'eslint:@angular-eslint/template/eqeqeq',
			],
		];
		for (const [label, search, replacement, rule] of rows) {
			const mutant = mutate(s2, search, replacement);
			expect(
				(await eslintMessagesFor('generated/ArbiterMutant.ts', mutant)).map(
					(entry) => entry.policy,
				),
				label,
			).toContain(rule);
		}
		// The TEMPLATE rule row above is the load-bearing one: it only reaches an
		// INLINE template through the extract-inline-html processor, so it also
		// proves the processor is wired.
		const emptyLifecycle = mutate(s3, /\tngOnInit\(\): void \{[\s\S]*?\n\t\}\n/, '\tngOnInit(): void {}\n');
		expect(
			(await eslintMessagesFor('generated/EmptyLifecycleMutant.ts', emptyLifecycle)).map(
				(entry) => entry.policy,
			),
		).toContain('eslint:@angular-eslint/no-empty-lifecycle-method');
	});

	test('RED: a parse failure reaches the report rather than silence', async () => {
		const mutant = mutate(s1, 'export class RenderOnce', 'export class class RenderOnce');
		const violations = await violationsFor('generated/TsParseMutant.ts', mutant);
		const parse = violations.find((entry) => entry.policy === 'eslint:parse');
		expect(parse?.message).toMatch(/Parsing error/);
		expect(parse?.dossierRef).toBe('frameless-angular-v1 T003 lint arbiter');
	});

	test('emitted text cannot silence the arbiter that is judging it', async () => {
		// A gate over GENERATED output whose verdict the generator can turn off is
		// not a gate. ESLint's own inline config is off (allowInlineConfig: false),
		// and unlike eslint-plugin-vue and eslint-plugin-svelte, @angular-eslint
		// publishes no markup-level comment-directive rule for it to reach around.
		const mutant = mutate(s2, '@Input() seed: any;', "@Input('seedAlias') seed: any;");
		for (const suppression of [
			'/* eslint-disable @angular-eslint/no-input-rename */',
			'/* eslint-disable */',
		]) {
			const suppressed = mutate(mutant, '@Component({', `${suppression}\n@Component({`);
			expect(
				(await eslintMessagesFor('generated/SuppressedMutant.ts', suppressed)).map(
					(entry) => entry.policy,
				),
				suppression,
			).toContain('eslint:@angular-eslint/no-input-rename');
		}
	});

	/**
	 * AN ASSERTED TOOLCHAIN FACT, required by `frameless-angular-v1` T003a: ASSERT,
	 * DO NOT PIN.
	 *
	 * `tsc -p packages/frameworks/angular` runs the CATALOG TypeScript while
	 * `@typescript-eslint/parser` - the parser under this arbiter - resolves a
	 * different one, supplied INCIDENTALLY by `demos/svelte-official`'s own
	 * off-catalog declaration. It is not catalog-governed, so if that demo drops it
	 * the parser under this arbiter changes with NO FILE IN THIS REPO CHANGING.
	 * That is the exact class ruling 1 invented this mitigation for, and this row is
	 * the mitigation.
	 */
	test('ASSERTED: the TypeScript under the arbiter is not the TypeScript under tsc', () => {
		const underArbiter = createRequire(require.resolve('@typescript-eslint/parser'))(
			'typescript/package.json',
		) as { version: string };
		expect(underArbiter.version).toBe(ANGULAR_ARBITER_TOOLCHAIN.typescriptUnderTheArbiter);
		expect(require('typescript/package.json').version).toBe(
			ANGULAR_ARBITER_TOOLCHAIN.typescriptUnderTsc,
		);
		// The two really are different, which is the fact being asserted rather than
		// an accident of two equal literals.
		expect(ANGULAR_ARBITER_TOOLCHAIN.typescriptUnderTheArbiter).not.toBe(
			ANGULAR_ARBITER_TOOLCHAIN.typescriptUnderTsc,
		);
		expect(ANGULAR_ARBITER_TOOLCHAIN.provenance).toContain('demos/svelte-official');
	});
});
