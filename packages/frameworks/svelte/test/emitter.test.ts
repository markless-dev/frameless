import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(await readFile(resolve(compilerGoldenRoot, name), 'utf8')) as EnrichedIR;
}

/**
 * MUTATION CONSTRUCTOR - see the doc comment on the copy in
 * `packages/frameworks/qwik/test/gate.test.ts`, which instructs a new adapter to
 * copy this block rather than reach for a bare `.replace()`. `String.prototype
 * .replace` promises to return a string, NOT to have matched; a search that
 * misses returns the input unchanged and the test then asserts against a
 * non-mutant, staying green while measuring nothing.
 */
function mutate(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replace(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert against a non-mutant',
	);
}

const generatedRoot = resolve(packageRoot, 'generated');

/** Numeric, so S10 sorts after S9 rather than between S1 and S2. */
function byScenarioNumber(left: string, right: string): number {
	return Number(/(\d+)/.exec(left)![1]) - Number(/(\d+)/.exec(right)![1]);
}

/**
 * THE FIXTURE TABLE IS DERIVED, NOT RE-LITERALLED.
 *
 * This table stopped at `s3-event-form.json`, which meant that when S4 landed NO
 * standing test asserted its emitted bytes equal `formatEmitted(emit(golden))`.
 * That freshness was proved ONCE, by regenerating and diffing by hand; nothing
 * re-proved it per run, so the emitted S4 could have drifted from the emitter
 * that claims to produce it and every lane would still have been green. Four
 * more scenarios are queued, and a table hand-edited per scenario is that same
 * hole four more times.
 *
 * The derivation source is the compiler's ratified golden corpus - `s<n>-*.json`
 * - which is INDEPENDENT of `generated/`: one is the IR this repo agreed to
 * compile, the other is what the emitter actually wrote. The two preconditions
 * below compare them and watch both directions go red.
 */
function scenarioFixtures(goldenDir = compilerGoldenRoot): Array<readonly [string, string]> {
	const table = readdirSync(goldenDir)
		.filter((entry) => /^s\d+-[\w-]+\.json$/.test(entry))
		.sort(byScenarioNumber)
		.map((entry) => [`S${/^s(\d+)-/.exec(entry)![1]}.svelte`, entry] as const);
	// Fail LOUD rather than returning []. An empty table would emit zero freshness
	// tests and the file would still report green, which is the one way a derived
	// list could be greener than the literal it replaced.
	if (table.length === 0)
		throw new Error(`no s<n>-*.json scenario goldens found in ${goldenDir}`);
	return table;
}

/** What the emitter actually wrote - the other side of the cross-check. */
function emittedScenarios(directory = generatedRoot): string[] {
	return readdirSync(directory)
		.filter((entry) => /^S\d+\.svelte$/.test(entry))
		.sort(byScenarioNumber);
}

const FIXTURES = scenarioFixtures();

describe('Svelte 5 emitter', () => {
	/**
	 * THE SCRIPT OPEN TAG, PINNED - AND THIS ROW EXISTS BECAUSE ITS ABSENCE WAS
	 * MEASURED.
	 *
	 * When the vue and svelte emitters were flipped to `lang="ts"`, the flip was
	 * REVERTED in both lanes and the suite re-run to watch the guards fire.
	 * Vue turned FOURTEEN tests red. Svelte turned ZERO: its
	 * `BASELINE_FORM_INVENTORY` has no script-block kind, so `checkSources` never
	 * observes a script attribute at all, and the four svelte tests that mention
	 * `<script>` all use it to CONSTRUCT synthetic sources rather than to assert
	 * on emitted ones. The lane was not clean, it was BLIND - an emitter that
	 * silently stopped emitting `lang="ts"` would have shipped green.
	 *
	 * This closes the cheap half of that gap. It reads the SHIPPED emitted files
	 * rather than a fresh `emit()` call, so it also catches a checked-in artifact
	 * that drifted from the emitter, and it is derived from `FIXTURES` so a new
	 * scenario is covered with no edit here. The expensive half - giving the
	 * svelte gate a script-block inventory kind, which needs a version-floor
	 * ruling of the sort vue's `script[setup,lang=ts]` row got - is NOT done here.
	 */
	test('every emitted scenario opens its script block with exactly lang="ts"', async () => {
		const files = FIXTURES.map(([file]) => file);
		// NON-VACUITY: an empty derivation must not pass by having nothing to check.
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			const source = await readFile(resolve(generatedRoot, file), 'utf8');
			const openTags = source.match(/<script\b[^>]*>/g) ?? [];
			expect(openTags, `${file} emitted no script block`).toHaveLength(1);
			expect(openTags[0], `${file} script open tag`).toBe('<script lang="ts">');
		}
	});

	test('the derived fixture table is the corpus, and the emitter wrote exactly it', () => {
		// THE FLOOR. Every scenario ratified so far must still be in the derivation.
		// A lower bound, so S5 and later widen it with no edit here, while a golden
		// that silently disappeared is red.
		expect(FIXTURES.map(([file]) => file)).toEqual(
			expect.arrayContaining(['S1.svelte', 'S2.svelte', 'S3.svelte', 'S4.svelte']),
		);
		// Two independent readings compared: the goldens this repo agreed to
		// compile, and the files the emitter actually wrote.
		expect(emittedScenarios()).toEqual(FIXTURES.map(([file]) => file));
	});

	/**
	 * CALIBRATION for the DERIVED table. A derived list nobody has watched go red
	 * is not an instrument - and the literal it replaced at least went red when a
	 * golden it named disappeared. Both directions run through the SAME
	 * `scenarioFixtures()` and `emittedScenarios()` the row above calls, against
	 * throwaway roots.
	 */
	test('CALIBRATION: the derived table goes red on a missing and on an extra file', async () => {
		const files = FIXTURES.map(([file]) => file);
		const temporary = await mkdtemp(resolve(tmpdir(), 'frameless-svelte-fixtures-'));
		try {
			const goldens = resolve(temporary, 'goldens');
			const generated = resolve(temporary, 'generated');
			await mkdir(goldens);
			await mkdir(generated);
			for (const entry of readdirSync(compilerGoldenRoot))
				await writeFile(resolve(goldens, entry), '{}');
			expect(scenarioFixtures(goldens)).toEqual(FIXTURES);
			// MISSING, on the emitted side: one file short of the derived table.
			for (const file of files.slice(0, -1)) await writeFile(resolve(generated, file), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(files);
			await writeFile(resolve(generated, files.at(-1)!), '//\n');
			expect(emittedScenarios(generated)).toEqual(files);
			// EXTRA, on the emitted side: a stray scenario no golden declares.
			await writeFile(resolve(generated, 'S99.svelte'), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(files);
			// And both directions on the DERIVATION side, so a golden that vanished
			// or appeared cannot pass unnoticed either.
			await rm(resolve(goldens, FIXTURES[0]![1]));
			expect(scenarioFixtures(goldens)).not.toEqual(FIXTURES);
			await writeFile(resolve(goldens, 's99-planted.json'), '{}');
			expect(scenarioFixtures(goldens).map(([file]) => file)).toContain('S99.svelte');
			// The degenerate case the throw exists for: an empty derivation must NOT
			// quietly agree with an empty directory.
			await rm(goldens, { recursive: true, force: true });
			await mkdir(goldens);
			expect(() => scenarioFixtures(goldens)).toThrow(/no s<n>-\*\.json scenario goldens/);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	test('CALIBRATION: the mutation constructor is loud on a non-mutant', async () => {
		const source = await readFile(resolve(packageRoot, 'generated/S1.svelte'), 'utf8');
		expect(() => mutate(source, 'text that is not in the emitted S1', 'x')).toThrow(
			/did not change the source/,
		);
		expect(source).toContain('$derived(');
		expect(() => mutate(source, '$derived(', '$derived(')).toThrow(
			/did not change the source/,
		);
	});

	// GOLDEN FRESHNESS. Byte equality against what the emitter produces right now,
	// so a checked-in artifact can never drift from the emitter that claims to
	// produce it.
	for (const [file, artifact] of FIXTURES)
		test(`${file} is byte-identical to a fresh emission`, async () => {
			const emitted = formatEmitted(emit(await golden(artifact)));
			const checkedIn = await readFile(resolve(packageRoot, 'generated', file), 'utf8');
			expect(emitted).toBe(checkedIn);
			// CALIBRATION for the comparison itself: a byte-equality assertion that
			// has only ever been shown to pass is not evidence it can fail.
			expect(mutate(emitted, 'do not edit.', 'do not edit!')).not.toBe(checkedIn);
		});

	test('lowers the runes surface S1/S2/S3 need, and nothing above the 5.0 baseline', async () => {
		const sources = await Promise.all(
			FIXTURES.map(([file]) =>
				readFile(resolve(packageRoot, 'generated', file), 'utf8'),
			),
		);
		const [s1, s2, s3] = sources as [string, string, string];
		// IR-8. S1 is THE ONLY ANNOTATED SCENARIO IN THE CORPUS, so this pins the
		// TYPED form here and the BARE form on S2 below. Pinning only one of the two
		// would pass for an emitter that annotated everything, or nothing.
		expect(s1).toContain('let { label, multiplier, visible, onTrace }: {');
		expect(s1).toContain('} = $props();');
		expect(s2).toContain('let { seed, onTrace } = $props();');
		expect(s2).not.toMatch(/\}: \{[\s\S]*?\} = \$props\(\);/);
		expect(s1).toContain('let count = $state(1);');
		expect(s1).toContain('const derived = $derived(`${prefix}${count * multiplier}`);');
		expect(s1).toContain('{#if !visible}');
		expect(s1).toContain('{:else}');
		expect(s2).toContain('{#each todos as todo (todo.id)}');
		expect(s3).toContain('onclick={(event) => {');
		// IR-4 is DEFERRED and the version corollary is not amended, so every
		// emitted construct must be Svelte 5.0 baseline. These four are the ones
		// with a version floor above it.
		for (const source of sources) {
			expect(source).not.toContain('$props.id(');
			expect(source).not.toContain('{@attach');
			expect(source).not.toContain('<svelte:boundary');
			expect(source).not.toMatch(/\$derived\.by\(/);
		}
	});

	test('emits the once-per-instance policy as untrack, matching the Solid lowering', async () => {
		const s1 = await readFile(resolve(packageRoot, 'generated/S1.svelte'), 'utf8');
		// Reads a prop at component top level: wrapped.
		expect(s1).toContain("untrack(() => onTrace('setup', { runs: 1 }));");
		expect(s1).toContain('const prefix = untrack(() => `${label}:`);');
		// Reads nothing reactive: NOT wrapped. Without this the assertion above
		// would pass for an emitter that wrapped everything unconditionally.
		expect(s1).toContain('let count = $state(1);');
		const s3 = await readFile(resolve(packageRoot, 'generated/S3.svelte'), 'utf8');
		expect(s3).toContain('let text = $state(untrack(() => initial));');
		expect(s3).toContain('let checked = $state(false);');
	});

	test('emits the delegated attribute form for every event, never on() and never a mix', async () => {
		// The form chosen after MEASUREMENT, not documents: at 5.56.8 a delegated
		// onclick calling preventDefault() on a <button type="submit"> left the
		// Document-request count unchanged, and the same page with the call removed
		// issued the form's GET. A mix of mechanisms would change ordering between
		// the button handler and the form's own handler, which S3 depends on.
		for (const [file] of FIXTURES) {
			const source = await readFile(resolve(packageRoot, 'generated', file), 'utf8');
			expect(source).not.toContain("from 'svelte/events'");
			expect(source).not.toContain('on(');
			expect(source).not.toMatch(/\son:[a-z]/);
		}
	});

	describe('fails closed', () => {
		test('on a declared stopPropagation', async () => {
			const artifact = structuredClone(await golden('s3-event-form.json'));
			const event = artifact.records.events.find((entry) => entry.syncPolicy);
			expect(event).toBeDefined();
			(event as unknown as { syncPolicy: { actions: string[] } }).syncPolicy.actions.push(
				'stopPropagation',
			);
			expect(() => emit(artifact)).toThrow(/fails closed on a declared stopPropagation/);
		});

		test('when a declared unconditional preventDefault is not spelled in the body', async () => {
			const artifact = structuredClone(await golden('s3-event-form.json'));
			const event = artifact.records.events.find((entry) => entry.syncPolicy)!;
			const handler = event.handlers[0]! as { expression: Record<string, any> };
			const body = handler.expression.body as Record<string, any>;
			const before = body.body.length;
			body.body = body.body.filter(
				(statement: Record<string, any>) =>
					statement.expression?.callee?.property?.name !== 'preventDefault',
			);
			expect(body.body.length).toBeLessThan(before);
			expect(() => emit(artifact)).toThrow(/does not spell as a top-level preventDefault/);
		});

		test('on persistence-bearing IR', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact.records.persistence as unknown[]).push({ graphNodeId: 'state:count' });
			expect(() => emit(artifact)).toThrow(/does not support persistence-bearing IR/);
		});

		test('on an early component guard, which a .svelte module cannot express', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact.components[0]!.guards as unknown[]).push({
				id: 'guard:0',
				test: { expression: { type: 'Identifier', name: 'visible' }, reads: [] },
				whenTrue: { kind: 'null' },
			});
			expect(() => emit(artifact)).toThrow(/no lowering for an early component guard/);
		});

		test('on a keyed repeat construct with no corpus instance', async () => {
			const artifact = structuredClone(await golden('s2-keyed-todo.json'));
			let patched = false;
			const stamp = (node: Record<string, any>): void => {
				if (node?.kind === 'keyed-repeat') {
					node.index = 'position';
					patched = true;
				}
				for (const value of Object.values(node ?? {})) {
					if (!value || typeof value !== 'object') continue;
					if (Array.isArray(value)) value.forEach((entry) => stamp(entry));
					else stamp(value as Record<string, any>);
				}
			};
			stamp(artifact.components[0]! as unknown as Record<string, any>);
			expect(patched).toBe(true);
			expect(() => emit(artifact)).toThrow(/no lowering for an index binding/);
		});

		test('on an IR whose version discriminator moved', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact as { version: string }).version = 'frameless-enriched-ir/3';
			expect(() => validateEnrichedIr(artifact)).toThrow(/frameless-enriched-ir\/2/);
			expect(() => emit(artifact)).toThrow(/frameless-enriched-ir\/2/);
		});

		test('on an unknown semantic field, so a schema addition cannot pass silently', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact as unknown as Record<string, unknown>).newField = [];
			expect(() => emit(artifact)).toThrow(/unknown semantic field: newField/);
		});
		/**
		 * THE PROBE ABOVE IS AIMED ONE LEVEL TOO HIGH, AND THIS IS THE ARM THAT
		 * SAYS SO.
		 *
		 * `newField` on `EnrichedIR` was caught by all six lanes from the day it
		 * was written; a key on a NESTED `PropDestructuringEntry` was caught by
		 * exactly two. MEASURED at 127a75b, before T010 tightened this validator:
		 * qwik, svelte, vue AND angular all ACCEPTED the nested key and emitted
		 * BYTE-IDENTICAL output across all eight goldens, while react and solid
		 * threw. That is why the IR-8 plan believed the six validators were
		 * symmetric - the test that would have shown otherwise never looked below
		 * the top level, so "a schema addition cannot pass silently" was true of
		 * one shape of addition and false of the shape actually being added.
		 *
		 * THE CALIBRATION IS THE SECOND ASSERTION, not the first: it pins that the
		 * nested plant is INVISIBLE to the top-level allowlist, because the message
		 * names `PropDestructuringEntry` and never `EnrichedIR`. Delete the nested
		 * check and this test goes red; delete the top-level one and the test above
		 * goes red instead. The two are not substitutes and neither replaced the
		 * other.
		 */
		test('on an unknown field NESTED on a PropDestructuringEntry, which the top-level probe cannot see', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const entries = artifact.components[0]!.props.entries as unknown as Array<
				Record<string, unknown>
			>;
			expect(entries.length).toBeGreaterThan(0);
			entries[0]!.newNestedField = 'planted';
			expect(() => emit(artifact)).toThrow(
				/PropDestructuringEntry has unknown semantic field: newNestedField/,
			);
			expect(() => emit(artifact)).not.toThrow(/EnrichedIR has unknown semantic field/);
		});

		/**
		 * IR-8's `type` is ADMITTED, not banned - so the allowlist above must not be
		 * read as "this lane refuses a typed prop". It refuses an UNCHECKED one: a
		 * `type` that is not an AST node is named as loudly as an unknown key, which
		 * is what stops admitting the field from trading one blind spot for another.
		 *
		 * The positive arm is not decoration. `s1-render-once` is the ONLY annotated
		 * fixture in the corpus - four typed entries against fifteen untyped ones
		 * across the other seven goldens - so without it the allowlist entry would
		 * be indistinguishable from a dead one that nothing ever exercises.
		 */
		test('on a malformed IR-8 type annotation, while a well-formed one is admitted', async () => {
			const admitted = structuredClone(await golden('s1-render-once.json'));
			expect(
				admitted.components[0]!.props.entries.filter((entry) => entry.type !== undefined),
			).not.toHaveLength(0);
			expect(() => emit(admitted)).not.toThrow();
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const entries = artifact.components[0]!.props.entries as unknown as Array<
				Record<string, unknown>
			>;
			entries[0]!.type = 'string';
			expect(() => emit(artifact)).toThrow(
				/PropDestructuringEntry has malformed type annotation AST/,
			);
		});

		/**
		 * IR-8 REQUIREDNESS, GUARDED THE SAME WAY AS ITS TYPE - see the fuller doc
		 * comment on the copy in `packages/frameworks/qwik/test/emitter.test.ts`.
		 * MEASURED: `optional` planted on every `PropDestructuringEntry` of all
		 * eight goldens was rejected BY NAME by all six lanes before the field
		 * landed. The ORPHAN arm is the one with teeth - `type` and `optional` are
		 * read from ONE `TSPropertySignature`, so an `optional` with no `type` is
		 * requiredness invented downstream rather than reported from source.
		 */
		test('on a malformed or ORPHANED IR-8 requiredness flag, while a well-formed one is admitted', async () => {
			const admitted = structuredClone(await golden('s1-render-once.json'));
			expect(
				admitted.components[0]!.props.entries.filter(
					(entry) => entry.optional !== undefined,
				),
			).not.toHaveLength(0);
			expect(() => emit(admitted)).not.toThrow();

			const malformed = structuredClone(await golden('s1-render-once.json'));
			(
				malformed.components[0]!.props.entries as unknown as Array<Record<string, unknown>>
			)[0]!.optional = 'yes';
			expect(() => emit(malformed)).toThrow(
				/PropDestructuringEntry has malformed optional flag: label/,
			);

			const orphaned = structuredClone(await golden('s1-render-once.json'));
			delete (
				orphaned.components[0]!.props.entries as unknown as Array<Record<string, unknown>>
			)[0]!.type;
			expect(() => emit(orphaned)).toThrow(
				/PropDestructuringEntry declares optionality without a type annotation: label/,
			);
		});
	});
});

describe('formatEmitted asserts what no formatter is available to enforce', () => {
	test('accepts every emitted golden', async () => {
		for (const [file] of FIXTURES) {
			const source = await readFile(resolve(packageRoot, 'generated', file), 'utf8');
			expect(formatEmitted(source)).toBe(source);
		}
	});

	// CALIBRATION. Each row is a shape the missing formatter would otherwise have
	// normalised away.
	const rejected = [
		['CRLF line endings', (source: string) => source.replaceAll('\n', '\r\n'), /LF line/],
		['a missing final newline', (source: string) => source.trimEnd(), /exactly one newline/],
		['a doubled final newline', (source: string) => `${source}\n`, /exactly one newline/],
		[
			'trailing whitespace',
			(source: string) => source.replace('</script>', '</script> '),
			/trailing whitespace/,
		],
		[
			'space indentation',
			(source: string) => source.replace('\n\tlet ', '\n\t  let '),
			/indents with spaces/,
		],
	] as const;

	for (const [shape, apply, message] of rejected)
		test(`CALIBRATION: rejects ${shape}`, async () => {
			const source = await readFile(resolve(packageRoot, 'generated/S1.svelte'), 'utf8');
			const mutant = apply(source);
			expect(mutant, `${shape} produced a non-mutant`).not.toBe(source);
			expect(() => formatEmitted(mutant)).toThrow(message);
		});
});
