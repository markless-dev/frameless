import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');
const generatedRoot = resolve(root, 'generated');

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
function scenarioFixtures(goldenDir = goldenRoot): Array<readonly [string, string]> {
	const table = readdirSync(goldenDir)
		.filter((entry) => /^s\d+-[\w-]+\.json$/.test(entry))
		.sort(byScenarioNumber)
		.map((entry) => [`S${/^s(\d+)-/.exec(entry)![1]}.jsx`, entry] as const);
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
		.filter((entry) => /^S\d+\.jsx$/.test(entry))
		.sort(byScenarioNumber);
}

const FIXTURES = scenarioFixtures();

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(
		await readFile(resolve(goldenRoot, name), 'utf8'),
	) as EnrichedIR;
}

describe('Qwik v2 structural emitter', () => {
	test('the derived fixture table is the corpus, and the emitter wrote exactly it', () => {
		// THE FLOOR. Every scenario ratified so far must still be in the derivation.
		// A lower bound, so S5 and later widen it with no edit here, while a golden
		// that silently disappeared is red.
		expect(FIXTURES.map(([file]) => file)).toEqual(
			expect.arrayContaining(['S1.jsx', 'S2.jsx', 'S3.jsx', 'S4.jsx']),
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
		const temporary = await mkdtemp(resolve(tmpdir(), 'frameless-qwik-fixtures-'));
		try {
			const goldens = resolve(temporary, 'goldens');
			const generated = resolve(temporary, 'generated');
			await mkdir(goldens);
			await mkdir(generated);
			for (const entry of readdirSync(goldenRoot))
				await writeFile(resolve(goldens, entry), '{}');
			expect(scenarioFixtures(goldens)).toEqual(FIXTURES);
			// MISSING, on the emitted side: one file short of the derived table.
			for (const file of files.slice(0, -1)) await writeFile(resolve(generated, file), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(files);
			await writeFile(resolve(generated, files.at(-1)!), '//\n');
			expect(emittedScenarios(generated)).toEqual(files);
			// EXTRA, on the emitted side: a stray scenario no golden declares.
			await writeFile(resolve(generated, 'S99.jsx'), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(files);
			// And both directions on the DERIVATION side, so a golden that vanished
			// or appeared cannot pass unnoticed either.
			await rm(resolve(goldens, FIXTURES[0]![1]));
			expect(scenarioFixtures(goldens)).not.toEqual(FIXTURES);
			await writeFile(resolve(goldens, 's99-planted.json'), '{}');
			expect(scenarioFixtures(goldens).map(([file]) => file)).toContain('S99.jsx');
			// The degenerate case the throw exists for: an empty derivation must NOT
			// quietly agree with an empty directory.
			await rm(goldens, { recursive: true, force: true });
			await mkdir(goldens);
			expect(() => scenarioFixtures(goldens)).toThrow(/no s<n>-\*\.json scenario goldens/);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	for (const [output, input] of FIXTURES)
		test(`generated/${output} is fresh from the shared compiler EnrichedIR golden`, async () => {
			const ir = await golden(input);
			validateEnrichedIr(ir);
			expect(await readFile(resolve(root, 'generated', output), 'utf8')).toBe(
				await formatEmitted(emit(ir)),
			);
		});

	test('uses resumable Qwik v2 primitives without a visible task', async () => {
		const source = await formatEmitted(emit(await golden('s1-render-once.json')));
		expect(source).toContain("from '@qwik.dev/core'");
		expect(source).toContain('export const RenderOnce = component$(');
		expect(source).toContain('const count = useSignal(1)');
		expect(source).toContain('const prefix = useSignal(() => `${props.label}:`)');
		expect(source).toContain('const derived = useComputed$');
		expect(source).toContain('count.value += 1');
		expect(source).toContain("await props.onTrace$('setup', { runs: 1 })");
		expect(source).toContain("await props.onTrace$('change', { count: count.value })");
		expect(source).toMatch(/onClick\$=\{async \(\) =>/);
		expect(source).not.toMatch(/useVisibleTask\$|onQVisible\$|q-e:qvisible/);
	});

	test('lowers S2 keyed state, controlled inputs, and ordered callbacks', async () => {
		const source = await formatEmitted(emit(await golden('s2-keyed-todo.json')));
		expect(source).toContain('const todos = useStore(props.seed.map');
		expect(source).toContain("const draft = useSignal('')");
		expect(source).toContain('const next = useSignal(3)');
		expect(source).toMatch(/todos\.map\(\(todo\) =>\s*\(\s*<li\s+key=\{todo\.id\}/);
		expect(source).toContain('value={draft.value}');
		expect(source).toContain('value={todo.title}');
		expect(source).toContain('checked={todo.done}');
		expect(source).toMatch(/onInput\$=\{async \(event, element\) =>/);
		expect(source).toMatch(/onChange\$=\{async \(event, element\) =>/);
		expect(source).toContain('draft.value = element.value');
		expect(source).toContain('const checked = element.checked');
		expect(source).toContain(
			'todos.splice(0, todos.length, ...todos.concat(item))',
		);
		expect(source.match(/todos\.splice\(/g)).toHaveLength(6);
		expect(source).toContain('todos.splice(0, todos.length, ...order)');
		expect(source).toContain("await props.onTrace$('clear', { count }, event)");
		expect(source).not.toMatch(/\bbind:|useVisibleTask\$|onQVisible\$|q-e:qvisible/);
	});

	test('lowers S3 controlled fields and preserves form event delegation', async () => {
		const source = await formatEmitted(emit(await golden('s3-event-form.json')));
		expect(source).toContain('const text = useSignal(props.initial)');
		expect(source).toContain('const checked = useSignal(false)');
		expect(source).toContain('const writes = useSignal(0)');
		expect(source).toContain('value={text.value}');
		expect(source).toContain('checked={checked.value}');
		expect(source).toContain("event.target.dataset.action === 'submit'");
		expect(source).toContain('text.value = element.value');
		expect(source).toContain('checked.value = element.checked');
		expect(source).toMatch(/writes\.value = 1;\s*writes\.value = 2;/);
		expect(source).toContain("await props.onTrace$('bubble', { source: 'form' }, event)");
		expect(source).not.toMatch(/\bbind:|useVisibleTask\$|onQVisible\$|q-e:qvisible/);
	});

	test('splits unconditional cancellation into a leading sync$() QRL', async () => {
		const source = await formatEmitted(emit(await golden('s3-event-form.json')));
		expect(source).toContain(
			"import { $, component$, sync$, useSignal } from '@qwik.dev/core'",
		);
		// Both S3 sites: the type=button submit handler, whose remainder stays in
		// a lazily fetched QRL behind the cancellation, and the cancel-submit
		// handler whose entire body WAS the cancellation.
		expect(
			source.match(/sync\$\(\(event\) => \{\s*event\.preventDefault\(\);\s*\}\)/g),
		).toHaveLength(2);
		// The lazily fetched remainder no longer cancels anything: the authored
		// `event.preventDefault(); writes.value = 1;` adjacency is gone.
		expect(source).not.toMatch(/preventDefault\(\);\s*writes\.value/);
		expect(source).toMatch(/sync\$[\s\S]*?\}\),\s*\$\(async \(event\) => \{\s*writes\.value = 1;/);
		// The remainder MUST be $()-wrapped: measured against @qwik.dev/core
		// 2.0.0-beta.38, the optimizer does not extract array ELEMENTS, so a raw
		// arrow here never becomes a QRL and is dropped from `q-e:click`.
		expect(source).toContain('$(async (event) => {');
		// The cancel-submit handler had nothing else in it, so no lazy element.
		expect(source).toMatch(
			/data-action="cancel-submit"\s*onClick\$=\{\[\s*sync\$\(\(event\) => \{\s*event\.preventDefault\(\);\s*\}\),\s*\]\}/,
		);
	});

	test('fails closed before emitting persistence-bearing IR', async () => {
		const ir = structuredClone(await golden('s1-render-once.json')) as any;
		ir.records.persistence.push({ graphNodeId: 'state:count' });
		expect(() => emit(ir)).toThrow('does not support persistence-bearing IR');
	});
});
