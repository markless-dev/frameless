import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
import {
	checkGeneratedFiles,
	checkSources,
	discoverGeneratedFiles,
	QWIK_ESLINT_RECOMMENDED_RULES,
	QWIK_ESLINT_RULES,
	QWIK_ESLINT_RULES_REQUIRING_TYPES,
	QWIK_GATE_POLICIES,
} from '../src/gate/index.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(
		await readFile(resolve(compilerGoldenRoot, name), 'utf8'),
	) as EnrichedIR;
}

/**
 * THE SCENARIO INVENTORY IS DERIVED, NOT RE-LITERALLED.
 *
 * This list was `['generated/S1.jsx', 'generated/S2.jsx', 'generated/S3.jsx']`
 * until S4 landed, and the hand-edit it then demanded was not free: the
 * inventory is the FIRST statement of the gate test below, so the whole run
 * aborted there and the emitted S4 file never reached `checkGeneratedFiles()`,
 * ESLint, or any policy. A literal that must be edited once per scenario is the
 * same defect one scenario later, and four more scenarios are queued.
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
		.sort();
	// Fail LOUD rather than returning []. An empty derivation would make the
	// inventory assertion agree with an empty `generated/` directory, which is the
	// one way a derived list could be greener than the literal it replaced.
	if (files.length === 0)
		throw new Error(`no s<n>-*.json scenario goldens found in ${compilerGoldenRoot}`);
	return files;
}

/**
 * MUTATION CONSTRUCTOR - every mutant in this file is built with this. Copy this
 * block into a new adapter's gate corpus; do NOT copy a bare `.replace()`.
 *
 * `String.prototype.replace` promises to return a string, NOT to have matched.
 * When the search misses it returns the input unchanged, with no error, and the
 * test then asserts a gate policy against source the gate has every right to
 * accept. It stays green while measuring nothing - a green vacuum. That is
 * exactly what defect 3's cause B was (defects-and-targets T006/T007): on a CRLF
 * checkout one search literal in the Solid corpus became unmatchable, and the row
 * had been asserting against a non-mutant for as long as it had existed. This
 * corpus is the most exposed of the three, because its mutants are built from
 * emitted files read off disk, which the emitter is free to reshape.
 *
 * The assertion is on the OUTPUT, not on the search. `mutated !== source` is the
 * precondition the test actually depends on: a search that matched but changed
 * nothing yields a non-mutant just the same, and is rejected just the same.
 *
 * The React and Solid corpora carry an identical block plus a `mutateAll` twin
 * for `replaceAll`; add it here if a mutation ever needs one. Same pattern as
 * `packages/compiler/test/metamorphic.test.ts:79`. Audited and applied
 * corpus-wide by T018; see
 * `docs/goals/frameless-defects-and-targets-v1/notes/T018-mutation-no-op-audit.md`.
 */
function mutate(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replace(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`gate mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert a policy against a non-mutant',
	);
}

/** The `replaceAll` twin, per the block above. Same assertion, on the output. */
function mutateAll(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replaceAll(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`gate mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert a policy against a non-mutant',
	);
}

/**
 * A conditional-cancellation IR, built from authored `.tsrx` in memory.
 *
 * NOT a corpus fixture and NOT a golden: T011 §7 forbids both here, because
 * goldens ripple through every framework suite plus metamorphic and generative.
 * Building the IR from source inside the test keeps the shape under test honest
 * - it is what Markless actually produces for a guarded cancellation, not a
 * hand-assembled record that could drift from the extractor.
 */
async function conditionalIr(): Promise<EnrichedIR> {
	return buildEnrichedIr({
		filename: 'guarded.tsrx',
		source: `import { state } from '@markless/core';

export function Guarded({ onTrace }) @{
	let seen = state(0);

	<form>
		<input
			data-action="text"
			onKeyDown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					seen = 1;
					onTrace('enter');
				}
			}}
		/>
		<output>{seen}</output>
	</form>
}
`,
	});
}

describe('Qwik v2 dossier gate', () => {
	test('publishes independent source and artifact-required policies', () => {
		expect(QWIK_GATE_POLICIES.slice(0, 4)).toEqual([
			{ id: 'no-visible-task', dossierRef: 'T002-qwik-architecture D8' },
			{
				id: 'persistence-render-lowering',
				dossierRef: 'T002-qwik-architecture D8',
			},
			// Renamed from frameless/no-handler-prevent-default by T011 §4.1: the
			// old name became a lie once stopPropagation entered scope.
			{
				id: 'frameless/no-handler-sync-action',
				dossierRef: 'frameless-defects-and-targets-v1 T015 ruling 4',
			},
			{
				id: 'frameless/sync-qrl-must-be-closed',
				dossierRef: 'frameless-defects-and-targets-v1 T011 ruling 4',
			},
		]);
		// Qwik's own lint rules, added by T006 to close the gate asymmetry with
		// React and Solid. These are a third-party arbiter: they encode what the
		// Qwik team considers correct, not what we decided.
		expect(QWIK_GATE_POLICIES.slice(4).map((policy) => policy.id)).toEqual([
			'eslint:qwik/use-method-usage',
			'eslint:qwik/no-react-props',
			'eslint:qwik/jsx-key',
			'eslint:qwik/jsx-no-script-url',
			'eslint:qwik/no-use-visible-task',
			'eslint:qwik/scope-use-task',
			'eslint:qwik/no-async-prevent-default',
			'eslint:qwik/prefer-classlist',
			'eslint:qwik/serializer-signal-usage',
			'eslint:qwik/unused-server',
			'eslint:qwik/jsx-img',
			'eslint:qwik/jsx-a',
			// T029: recovered from a silent drop out of configs.recommended.
			'eslint:qwik/loader-location',
			'eslint:qwik/no-await-navigate-in-use-task',
		]);
		expect(
			QWIK_GATE_POLICIES.filter((policy) => policy.requiresArtifact).map(
				(policy) => policy.id,
			),
		).toEqual(['persistence-render-lowering']);
	});

	/**
	 * THE INVENTORY ASSERTION (T029). This is the durable half of that task:
	 * without it, the next `eslint-plugin-qwik` release re-opens the same hole in
	 * silence.
	 *
	 * WHAT WENT WRONG WITHOUT IT. `configs.recommended` carried 16 rules, the gate
	 * applied 12 and recorded 2 as needing type information, and the remaining
	 * TWO - `qwik/loader-location` and `qwik/no-await-navigate-in-use-task` - were
	 * dropped with no comment anywhere accounting for them. Nothing in the suite
	 * could tell that apart from a deliberate decision, because a dropped rule and
	 * a rule that simply never fires look identical from the outside. That is the
	 * arbiter being quietly shaped to fit the thing it judges, and it survived
	 * shipped for as long as it did precisely because no test compared the applied
	 * set to what upstream publishes.
	 *
	 * IT IS A REAL CROSS-CHECK, not a restatement: the left side is a hand-written
	 * literal in `src/gate/index.ts` and the right side is read out of the
	 * installed third-party plugin at runtime. Two-sidedly fail-closed - upstream
	 * adding a rule goes red, and naming a rule upstream has REMOVED goes red too.
	 */
	test('every upstream recommended rule is either applied or omitted with a reason', () => {
		const applied = Object.keys(QWIK_ESLINT_RULES);
		const omitted = [...QWIK_ESLINT_RULES_REQUIRING_TYPES] as string[];
		const accounted = [...applied, ...omitted];
		// Measured at eslint-plugin-qwik 2.0.0-beta.38. Asserted, not assumed: a
		// plugin whose recommended config went empty would otherwise satisfy every
		// assertion below.
		expect(QWIK_ESLINT_RECOMMENDED_RULES.length).toBeGreaterThan(0);
		expect(
			new Set(accounted).size,
			'a rule is named in BOTH the applied set and the omission list',
		).toBe(accounted.length);

		const accountedFor = new Set(accounted);
		expect(
			QWIK_ESLINT_RECOMMENDED_RULES.filter((rule) => !accountedFor.has(rule)),
			'upstream recommends these and this gate neither applies them nor records a reason - ' +
				'measure each on the corpus, then apply it or omit it with its evidence',
		).toEqual([]);

		const upstream = new Set(QWIK_ESLINT_RECOMMENDED_RULES);
		expect(
			accounted.filter((rule) => !upstream.has(rule)),
			'this gate names these but upstream recommended no longer contains them',
		).toEqual([]);

		// THE OMISSION LIST IS ASSERTED AS A LITERAL, DELIBERATELY - the opposite
		// call from the derived scenario inventory above, and for the opposite
		// reason. The scenario corpus is MEANT to grow, so a literal there bought
		// nothing but a hand-edit per scenario. The omission list must never grow
		// without someone deciding it should, so friction is the feature: widening
		// it means editing this line and saying why.
		expect(omitted).toEqual(['qwik/valid-lexical-scope', 'qwik/use-async-top']);
	});

	test('discovers and accepts the clean emitted scenario corpus', async () => {
		const corpus = scenarioCorpus('jsx');
		expect(await discoverGeneratedFiles()).toEqual(corpus);
		const result = await checkGeneratedFiles();
		// The gate's OWN file list, asserted rather than assumed. `discoverGeneratedFiles`
		// and `checkGeneratedFiles` are separate entry points; a gate that discovered
		// four files and checked three would otherwise report [] violations and look
		// identical to a gate that checked all four.
		expect(result.files).toEqual(corpus);
		// The known-failing expectation held here for defect 1 is RELEASED. The
		// emitter now lowers unconditional cancellation into a leading sync$()
		// QRL, so no lazily fetched handler body calls preventDefault() any more.
		//
		// [] IS NOT SELF-EVIDENT EVIDENCE. Unfixed main also produced [], because
		// Qwik's no-async-prevent-default matches $() ancestry and frameless emits
		// raw handlers. What makes this [] meaningful is
		// `frameless/no-handler-sync-action`, which does fire on the pre-fix
		// shape - proved by "MUTATION: the pre-fix emitter shape is rejected"
		// below, which reconstructs that shape from the IR and watches the gate
		// reject it while the upstream rule stays silent.
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
		expect(
			await readFile(resolve(packageRoot, 'generated/S3.jsx'), 'utf8'),
		).toContain('sync$((event) => {');
		expect(result.unevaluated).toEqual([
			{ policy: 'persistence-render-lowering', reason: 'requires-artifact' },
		]);
		expect(Object.keys(result)).toEqual(['files', 'policies', 'violations']);
		for (const file of result.files)
			expect(await readFile(resolve(packageRoot, file), 'utf8')).toContain(
				'@generated by @frameless/qwik',
			);
	});

	/**
	 * CALIBRATION for the DERIVED inventory. A derived list that nobody has
	 * watched go red is not an instrument - and the literal it replaced at least
	 * failed loudly when it drifted. Both directions are driven through the SAME
	 * `discoverGeneratedFiles()` the assertion above calls, against a throwaway
	 * root, so this measures the real comparison and not a lookalike.
	 */
	test('CALIBRATION: the derived inventory goes red on a missing and on an extra file', async () => {
		const corpus = scenarioCorpus('jsx');
		// THE FLOOR. Every scenario ratified so far must still be in the derivation.
		// A lower bound, so S5 and later widen it with no edit here, while a golden
		// that silently disappeared is red.
		expect(corpus).toEqual(
			expect.arrayContaining([
				'generated/S1.jsx',
				'generated/S2.jsx',
				'generated/S3.jsx',
				'generated/S4.jsx',
			]),
		);
		const root = await realpath(await mkdtemp(resolve(tmpdir(), 'frameless-qwik-inventory-')));
		try {
			await mkdir(resolve(root, 'generated'));
			const stub = '// inventory calibration\n';
			for (const file of corpus.slice(0, -1)) await writeFile(resolve(root, file), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).not.toEqual(corpus);
			await writeFile(resolve(root, corpus.at(-1)!), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).toEqual(corpus);
			await writeFile(resolve(root, 'generated/S99.jsx'), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).not.toEqual(corpus);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('MUTATION: rejects an injected useVisibleTask$ in emitted source', async () => {
		const source = await readFile(resolve(packageRoot, 'generated/S1.jsx'), 'utf8');
		const mutant = mutate(
			mutate(source, 'useTask$ }', 'useTask$, useVisibleTask$ }'),
			'export const RenderOnce',
			'useVisibleTask$(() => {});\n\nexport const RenderOnce',
		);
		const result = await checkSources([
			{ file: 'generated/VisibleTaskMutant.jsx', source: mutant },
		]);
		expect(result.violations.map((entry) => entry.policy)).toContain('no-visible-task');
		expect(
			result.violations.filter((entry) => entry.policy === 'no-visible-task'),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dossierRef: 'T002-qwik-architecture D8',
					line: 2,
				}),
			]),
		);
	});

	// CALIBRATION for the mutation constructor itself, not for the gate. A helper
	// nobody has watched fail is not evidence that it can fail - and the failure it
	// guards against is silent by construction, so nothing else would report it.
	test('CALIBRATION: a mutation that leaves the source unchanged is loud', async () => {
		const source = await readFile(resolve(packageRoot, 'generated/S1.jsx'), 'utf8');
		expect(() => mutate(source, 'text that is not in the emitted S1', 'x')).toThrow(
			/did not change the source/,
		);
		// A search that matches but rewrites the text to itself is a non-mutant too:
		// the check is on the output, not on the search. The `toContain` is what stops
		// this case from passing for the wrong reason.
		expect(source).toContain('export const RenderOnce');
		expect(() => mutate(source, 'export const RenderOnce', 'export const RenderOnce')).toThrow(
			/did not change the source/,
		);
	});

	test('MUTATION: persistence-bearing IR fails closed in the gate and emitter', async () => {
		const artifact = structuredClone(await golden('s1-render-once.json')) as EnrichedIR;
		(artifact.records.persistence as unknown[]).push({ graphNodeId: 'state:count' });
		const source = await readFile(resolve(packageRoot, 'generated/S1.jsx'), 'utf8');
		const result = await checkSources([
			{ file: 'generated/PersistenceMutant.jsx', source, artifact },
		]);
		expect(result.unevaluated).toEqual([]);
		expect(result.violations).toEqual([
			expect.objectContaining({
				policy: 'persistence-render-lowering',
				dossierRef: 'T002-qwik-architecture D8',
			}),
		]);
		expect(() => emit(artifact)).toThrow('does not support persistence-bearing IR');
	});

	// GREEN-VACUUM GUARD for the released expectation above.
	//
	// The emitter's trigger is the IR's declared SyncPolicy. Strip it and the
	// emitter falls back to exactly what merged main produced before this change:
	// the authored `event.preventDefault()` left inside a lazily fetched QRL, with
	// no sync$() split. That is the reverted emitter, reconstructed from its own
	// input rather than described.
	//
	// The second half of this test is the point: the upstream rule stays SILENT
	// on that shape. Releasing the expectation to [] without this policy would
	// have shipped a gate that passes identically on broken output.
	//
	// THE COUNT HERE WENT 2 -> 4, AND THAT IS A WIDENING, NOT A CHASED RED.
	// T020 added a two-sided CONDITIONAL cancellation case to the S3 corpus, so
	// S3's four cancellation sites are now two unconditional (`submit`,
	// `cancel-submit`; `constant-truthy`) and two conditional (`cancel-open`,
	// `allow-open`; `event-equals` on `event.detail`). Stripping every declared
	// SyncPolicy therefore reconstructs BOTH pre-fix shapes at once:
	//
	//   unconditional -> onClick$={(event) => { event.preventDefault(); }}
	//   conditional   -> onClick$={(event) => { if (event.detail === 1) { … } }}
	//
	// Before T020 this guard only ever covered the unconditional path. It now
	// also covers the path T011 measured as SILENTLY re-emitting defect 1:
	// `hoistsPreventDefault()` returned false, `emitEvent` handed back a bare
	// lazily fetched QRL carrying the authored guard, and nothing threw.
	//
	// It is the unit-level twin of T020's negative proof, which stripped the two
	// conditional policies from this same golden and watched the `pnpm e2e` Qwik
	// lane fail behaviourally with `[data-action="cancel-open"]` leaving its
	// <details> open. This test proves the GATE rejects that shape; that run
	// proved a BROWSER does. Neither substitutes for the other, which is the
	// whole reason T020 exists — see notes/T020-conditional-behavioural.md.
	test('MUTATION: the pre-fix emitter shape is rejected, and upstream stays silent', async () => {
		const artifact = structuredClone(await golden('s3-event-form.json')) as EnrichedIR;
		// The `when` kind has to be read in the SAME pass, because the strip deletes
		// the policy it is being read from.
		const strippedKinds: string[] = [];
		const stripped = artifact.records.events.filter((event) => {
			const policy = (event as { syncPolicy?: { when: { type: string } } }).syncPolicy;
			if (policy) strippedKinds.push(policy.when.type);
			delete (event as { syncPolicy?: unknown }).syncPolicy;
			return Boolean(policy);
		});
		expect(stripped).toHaveLength(4);
		// Both kinds are present. A corpus change that quietly dropped the
		// conditional members would otherwise leave this test passing at a
		// smaller count with no signal that its coverage had narrowed.
		expect(strippedKinds).toEqual([
			'constant-truthy',
			'constant-truthy',
			'event-equals',
			'event-equals',
		]);

		const source = await formatEmitted(emit(artifact));
		expect(source).not.toContain('sync$');
		expect(source.match(/event\.preventDefault\(\)/g)).toHaveLength(4);
		// One of the unconditional two is SYNCHRONOUS. Defect 1 is misnamed: the
		// emitted cancel-submit handler has no `async` keyword and failed anyway,
		// because the QRL segment was not resident when the event fired.
		expect(source).toMatch(
			/onClick\$=\{\(event\) => \{\s*event\.preventDefault\(\);\s*\}\}/,
		);
		// The conditional two are the shape T011 measured reaching no refusal at
		// all: the authored guard, intact, riding a lazily fetched QRL.
		expect(source).toMatch(
			/onClick\$=\{\(event\) => \{\s*if \(event\.detail === 1\) \{\s*event\.preventDefault\(\);\s*\}\s*\}\}/,
		);

		const result = await checkSources([{ file: 'generated/PreFixMutant.jsx', source }]);
		const policies = result.violations.map((entry) => entry.policy);
		expect(policies, JSON.stringify(result.violations, null, 2)).toEqual([
			'frameless/no-handler-sync-action',
			'frameless/no-handler-sync-action',
			'frameless/no-handler-sync-action',
			'frameless/no-handler-sync-action',
		]);
		expect(policies).not.toContain('eslint:qwik/no-async-prevent-default');
		expect(result.violations[0]).toMatchObject({
			file: 'generated/PreFixMutant.jsx',
			dossierRef: 'frameless-defects-and-targets-v1 T015 ruling 4',
		});
	});

	// GREEN-VACUUM GUARD for the CONDITIONAL lowering, same pattern as the test
	// above and for the same reason: this expectation is being released now, so
	// something has to show it is not a vacuum.
	//
	// T011 measured that conditional cancellation never reached a fail-closed
	// throw. `hoistsPreventDefault()` returned false and `emitEvent` handed back a
	// BARE lazily fetched QRL carrying the authored `preventDefault()` - defect 1,
	// silently re-emitted. Deleting the syncPolicy reconstructs exactly that
	// output from the same IR, and the gate must reject it.
	test('MUTATION: a conditional policy lowers to sync$, and the pre-fix shape is rejected', async () => {
		const artifact = await conditionalIr();
		const fixed = await formatEmitted(emit(artifact));
		// The guard is SYNTHESIZED from the condition tree, never lifted: this is
		// the string measured verbatim in the qFuncs_* table of a production
		// demos/qwik build at @qwik.dev/core 2.0.0-beta.38 (T012 step 1).
		expect(fixed).toMatch(
			/sync\$\(\(event\) => \{\s*if \(event\.key === 'Enter'\) \{\s*event\.preventDefault\(\);\s*\}\s*\}\)/,
		);
		expect(
			(await checkSources([{ file: 'generated/ConditionalClean.jsx', source: fixed }]))
				.violations,
		).toEqual([]);

		const stripped = structuredClone(artifact) as EnrichedIR;
		const removed = stripped.records.events.filter((event) => {
			const policy = (event as { syncPolicy?: unknown }).syncPolicy;
			delete (event as { syncPolicy?: unknown }).syncPolicy;
			return Boolean(policy);
		});
		expect(removed).toHaveLength(1);

		const preFix = await formatEmitted(emit(stripped));
		expect(preFix).not.toContain('sync$');
		expect(preFix).toMatch(/if \(event\.key === 'Enter'\) \{\s*event\.preventDefault\(\);/);
		const result = await checkSources([
			{ file: 'generated/ConditionalPreFixMutant.jsx', source: preFix },
		]);
		const policies = result.violations.map((entry) => entry.policy);
		expect(policies, JSON.stringify(result.violations, null, 2)).toEqual([
			'frameless/no-handler-sync-action',
		]);
		// The vacuum proof, as above: nothing upstream sees this shape either.
		expect(policies).not.toContain('eslint:qwik/no-async-prevent-default');
	});
});

// CALIBRATION for frameless/no-handler-sync-action. Each case is a shape the
// emitter could regress into; the last two tests are the anti-vacuity cases,
// proving the policy is neither a substring search nor keyed on `async` or `$()`.
//
// Shapes B through E were MEASURED SILENT before T012 - the rule matched only the
// property name `preventDefault`, and its ancestor walk asked merely "is there a
// sync$ between the call and the prop". A rule nobody watched reject these is not
// evidence it can.
describe('MUTATION: frameless/no-handler-sync-action', () => {
	const caught = [
		{
			shape: 'a SYNCHRONOUS raw handler - the shape T002 witnessed failing',
			source: `export const C = () => <button type="submit" onClick$={(event) => { event.preventDefault(); }}>x</button>;`,
		},
		{
			shape: 'an async raw handler - the shape upstream cannot see',
			source: `export const C = () => <button type="submit" onClick$={async (event) => { event.preventDefault(); }}>x</button>;`,
		},
		{
			shape: 'an explicitly $()-wrapped handler - the shape upstream can see',
			source: `import { $ } from '@qwik.dev/core';\nexport const C = () => <button type="submit" onClick$={$((event) => { event.preventDefault(); })}>x</button>;`,
		},
		{
			// A - caught before T012, and it must STAY caught.
			shape: 'A: a CONDITIONAL preventDefault in a bare lazy QRL',
			source: `export const C = () => <form onSubmit$={(event) => { if (event.key === 'Enter') { event.preventDefault(); } }} />;`,
		},
		{
			// B - SILENT before T012. The rule matched only `preventDefault`.
			shape: 'B: an UNCONDITIONAL stopPropagation in a bare lazy QRL',
			source: `export const C = () => <button onClick$={(event) => { event.stopPropagation(); }}>x</button>;`,
		},
		{
			// C - SILENT before T012, same cause.
			shape: 'C: a CONDITIONAL stopPropagation in a bare lazy QRL',
			source: `export const C = () => <button onClick$={(event) => { if (event.key === 'Enter') { event.stopPropagation(); } }}>x</button>;`,
		},
		{
			// D - SILENT before T012. T005's carried hardening item: the sync$ is
			// CONSTRUCTED inside a lazily fetched QRL, long after dispatch.
			shape: 'D: a sync$() nested inside the lazy $() element',
			source: `import { $, sync$ } from '@qwik.dev/core';\nexport const C = () => <button onClick$={[$(async (event) => { sync$((e) => { e.preventDefault(); }); await go(); })]}>x</button>;`,
		},
		{
			// E - SILENT before T012, and upstream is silent on it too: there is no
			// $() ancestry for qwik/no-async-prevent-default to match.
			shape: 'E: a sync$() nested inside a bare lazy handler',
			source: `import { sync$ } from '@qwik.dev/core';\nexport const C = () => <button onClick$={(event) => { sync$((e) => { e.preventDefault(); }); }}>x</button>;`,
		},
		{
			shape: 'a call in the LAZY element of a sync$()-led QRL array',
			source: `import { $, sync$ } from '@qwik.dev/core';\nexport const C = () => <button onClick$={[sync$(() => {}), $(async (event) => { event.preventDefault(); })]}>x</button>;`,
		},
	];

	for (const { shape, source } of caught)
		test(`rejects ${shape}`, async () => {
			const result = await checkSources([{ file: 'generated/Mutant.jsx', source }]);
			expect(
				result.violations.map((entry) => entry.policy),
				JSON.stringify(result.violations, null, 2),
			).toContain('frameless/no-handler-sync-action');
		});

	test('the `async` keyword is not what the policy keys on', async () => {
		const [sync, async] = await Promise.all(
			[caught[0]!.source, caught[1]!.source].map(async (source) =>
				(
					await checkSources([{ file: 'generated/Mutant.jsx', source }])
				).violations.filter(
					(entry) => entry.policy === 'frameless/no-handler-sync-action',
				),
			),
		);
		expect(sync).toHaveLength(1);
		expect(async).toHaveLength(1);
	});

	// E is the one shape NOTHING saw before T012 - not us, not upstream. D at
	// least tripped qwik/no-async-prevent-default by accident of its $(async)
	// ancestry, which is not a property we rely on.
	test('E is invisible to upstream, so only our rule can be what caught it', async () => {
		const result = await checkSources([
			{ file: 'generated/Mutant.jsx', source: caught[7]!.source },
		]);
		const policies = result.violations.map((entry) => entry.policy);
		expect(policies, JSON.stringify(result.violations, null, 2)).toContain(
			'frameless/no-handler-sync-action',
		);
		expect(policies).not.toContain('eslint:qwik/no-async-prevent-default');
	});

	test('ANTI-VACUITY: both sync$() lowerings and a non-handler call are accepted', async () => {
		const result = await checkSources([
			{
				file: 'generated/Clean.jsx',
				source: [
					`import { $, sync$ } from '@qwik.dev/core';`,
					// The shipped unconditional lowering this policy exists to permit.
					`export const C = () => <button type="submit" onClick$={[sync$((event) => { event.preventDefault(); }), $(async () => {})]}>x</button>;`,
					// The NEW conditional lowering, with both actions in one guard.
					`export const D = () => <input onKeydown$={[sync$((event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); } })]} />;`,
					// A sync$() as the DIRECT value of the prop, not an array element.
					`export const E = () => <input onKeydown$={sync$((event) => { event.preventDefault(); })} />;`,
					// Not a JSX event prop: the policy reads ancestry, not text.
					`export function guard(event) { event.preventDefault(); event.stopPropagation(); }`,
				].join('\n'),
			},
		]);
		expect(
			result.violations.map((entry) => entry.policy),
			JSON.stringify(result.violations, null, 2),
		).not.toContain('frameless/no-handler-sync-action');
	});
});

// CALIBRATION for frameless/sync-qrl-must-be-closed.
//
// This rule PROVES closure freedom by scope analysis; it does not sniff for
// signals. Every case below is a DIFFERENT KIND of captured binding, and the
// point of the set is that the rule never had to recognise any of them - it only
// had to fail to resolve them inside the function. Case 9 was measured drawing
// ZERO frameless violations before T012.
describe('MUTATION: frameless/sync-qrl-must-be-closed', () => {
	const preamble = `import { $, component$, sync$, useSignal, useStore } from '@qwik.dev/core';\n`;
	const caught = [
		{
			shape: '9: the body reads a signal',
			captured: 'locked',
			source: `${preamble}export const C = component$(() => {
	const locked = useSignal(false);
	return <button onClick$={[sync$((event) => { if (locked.value) { event.preventDefault(); } })]}>x</button>;
});`,
		},
		{
			shape: '10: the body reads a store member',
			captured: 'form',
			source: `${preamble}export const C = component$(() => {
	const form = useStore({ locked: false });
	return <button onClick$={[sync$((event) => { if (form.locked) { event.preventDefault(); } })]}>x</button>;
});`,
		},
		{
			shape: '11: the body calls a module-scope function',
			captured: 'isLocked',
			source: `${preamble}function isLocked() { return true; }
export const C = () => <button onClick$={[sync$((event) => { if (isLocked()) { event.preventDefault(); } })]}>x</button>;`,
		},
		{
			shape: '12: the body reads a component-scope const',
			captured: 'limit',
			source: `${preamble}export const C = component$(() => {
	const limit = 3;
	return <button onClick$={[sync$((event) => { if (event.detail === limit) { event.preventDefault(); } })]}>x</button>;
});`,
		},
		{
			// Refused under the strict allowlist. `window` is a perfectly real
			// binding at runtime - but the rule accepts ONLY what resolves inside
			// the function, so an unforeseen construct fails closed.
			shape: '13: the body references a global',
			captured: 'window',
			source: `${preamble}export const C = () => <button onClick$={[sync$((event) => { if (window.innerWidth > 0) { event.preventDefault(); } })]}>x</button>;`,
		},
	];

	for (const { shape, captured, source } of caught)
		test(`rejects ${shape}`, async () => {
			const result = await checkSources([{ file: 'generated/Mutant.jsx', source }]);
			const reported = result.violations.filter(
				(entry) => entry.policy === 'frameless/sync-qrl-must-be-closed',
			);
			expect(reported, JSON.stringify(result.violations, null, 2)).not.toHaveLength(0);
			expect(reported.map((entry) => entry.message).join('\n')).toContain(
				`\`${captured}\``,
			);
			expect(reported[0]).toMatchObject({
				dossierRef: 'frameless-defects-and-targets-v1 T011 ruling 4',
			});
		});

	test('an argument that is not a function literal cannot be proved, so it is refused', async () => {
		const result = await checkSources([
			{
				file: 'generated/Mutant.jsx',
				source: `import { sync$ } from '@qwik.dev/core';\nconst body = (event) => { event.preventDefault(); };\nexport const C = () => <button onClick$={[sync$(body)]}>x</button>;`,
			},
		]);
		expect(
			result.violations
				.filter((entry) => entry.policy === 'frameless/sync-qrl-must-be-closed')
				.map((entry) => entry.message)
				.join('\n'),
			JSON.stringify(result.violations, null, 2),
		).toContain('must receive a function literal');
	});

	test('ANTI-VACUITY: the shipped and conditional bodies, and a second parameter, are accepted', async () => {
		const result = await checkSources([
			{
				file: 'generated/Clean.jsx',
				source: [
					`import { $, sync$ } from '@qwik.dev/core';`,
					`export const C = () => <button onClick$={[sync$((event) => { event.preventDefault(); }), $(async () => {})]}>x</button>;`,
					`export const D = () => <input onKeydown$={[sync$((event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); } })]} />;`,
					// A sync$ QRL receives the element as its second argument; using it
					// is not a capture, and a body that declares its own locals is fine.
					`export const E = () => <input onInput$={[sync$((event, element) => { const wanted = element.dataset.action; if (event.data === wanted) { event.preventDefault(); } })]} />;`,
				].join('\n'),
			},
		]);
		expect(
			result.violations.map((entry) => entry.policy),
			JSON.stringify(result.violations, null, 2),
		).not.toContain('frameless/sync-qrl-must-be-closed');
	});

	test('the clean emitted corpus is closed', async () => {
		const result = await checkGeneratedFiles();
		expect(result.violations.map((entry) => entry.policy)).not.toContain(
			'frameless/sync-qrl-must-be-closed',
		);
		// Anti-vacuity for the line above: mutating a real emitted sync$ body to
		// read a signal makes it RED, so the clean [] is a measurement.
		const mutant = mutateAll(
			await readFile(resolve(packageRoot, 'generated/S3.jsx'), 'utf8'),
			'sync$((event) => {',
			'sync$((event) => {\n\t\t\t\t\t\tif (!writes.value) return;',
		);
		const mutated = await checkSources([
			{ file: 'generated/ClosureMutant.jsx', source: mutant },
		]);
		expect(
			mutated.violations.map((entry) => entry.policy),
			JSON.stringify(mutated.violations, null, 2),
		).toContain('frameless/sync-qrl-must-be-closed');
	});
});

// CALIBRATION for the eslint policies added by T006. A gate rule nobody has
// watched reject something is not evidence it works. Each case feeds the gate
// source that violates one Qwik rule and proves the violation is reported under
// that rule's policy id.
describe('MUTATION: Qwik lint policies reject violating emitted source', () => {
	const cases = [
		{
			rule: 'qwik/jsx-key',
			source: `export const C = () => <ul>{[1, 2].map((n) => <li>{n}</li>)}</ul>;`,
		},
		{
			rule: 'qwik/no-react-props',
			source: `export const C = () => <div className="x" />;`,
		},
		{
			rule: 'qwik/jsx-no-script-url',
			source: `export const C = () => <a href="javascript:void(0)">x</a>;`,
		},
		{
			rule: 'qwik/jsx-img',
			source: `export const C = () => <img src="/a.png" />;`,
		},
		// T029. These two are the reason this describe block matters more than the
		// four above it: they were dropped from the applied set with no recorded
		// reason, and the ONLY thing that justifies adding them back rather than
		// writing down an excuse is watching each one go red. A rule that cannot
		// fail is not an arbiter.
		//
		// Both planted sources are imported-and-used so that no core rule
		// (`no-undef`, `no-unused-vars`) accounts for the message instead.
		{
			rule: 'qwik/loader-location',
			source: `import { component$ } from '@qwik.dev/core';
import { routeLoader$ } from '@qwik.dev/router';
export const useThing = routeLoader$(() => ({ a: 1 }));
export const C = component$(() => <div>{useThing().value.a}</div>);`,
		},
		{
			rule: 'qwik/no-await-navigate-in-use-task',
			source: `import { component$, useTask$ } from '@qwik.dev/core';
import { useNavigate } from '@qwik.dev/router';
export const C = component$(() => {
	const nav = useNavigate();
	useTask$(async () => {
		await nav('/next');
	});
	return <div />;
});`,
		},
	];

	for (const { rule, source } of cases) {
		test(`${rule} is caught`, async () => {
			const result = await checkSources([{ file: 'generated/Mutant.jsx', source }]);
			const policies = result.violations.map((violation) => violation.policy);
			expect(policies, JSON.stringify(result.violations, null, 2)).toContain(
				`eslint:${rule}`,
			);
		});
	}

	test('the clean corpus does not trip these same rules', async () => {
		const result = await checkGeneratedFiles();
		const tripped = new Set(result.violations.map((violation) => violation.policy));
		for (const { rule } of cases) expect(tripped).not.toContain(`eslint:${rule}`);
	});
});
