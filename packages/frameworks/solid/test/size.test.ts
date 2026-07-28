import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { parse, walk, type Node } from 'yuku-parser';
import { measureAll } from '../scripts/measure-size.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');

/**
 * THE SCENARIO INVENTORY IS DERIVED, NOT RE-LITERALLED.
 *
 * This file recorded budgets for S1/S2/S3 and said nothing at all about S4, so a
 * new scenario arrived with NO size budget and nothing went red - an EXEMPTION
 * granted by silence. The corpus is now derived from the compiler's ratified
 * goldens, and `every scenario in the derived corpus has a recorded budget`
 * below turns the silence into a failure: S5 will not be measurable-by-omission
 * either.
 */
function scenarioCorpus(goldenRoot = compilerGoldenRoot): string[] {
	const scenarios = readdirSync(goldenRoot)
		.map((entry) => /^s(\d+)-[\w-]+\.json$/.exec(entry)?.[1])
		.filter((digits): digits is string => digits !== undefined)
		.map((digits) => `S${digits}`)
		.sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
	// Fail LOUD rather than returning []. An empty derivation would agree with an
	// empty budget table, which is the one way a derived list could be greener
	// than the literal it replaced.
	if (scenarios.length === 0)
		throw new Error(`no s<n>-*.json scenario goldens found in ${goldenRoot}`);
	return scenarios;
}

/** The golden filename backing a scenario - the derivation's own source. */
function goldenFor(scenario: string, goldenRoot = compilerGoldenRoot): string {
	const found = readdirSync(goldenRoot).find((entry) =>
		new RegExp(`^s${scenario.slice(1)}-[\\w-]+\\.json$`).test(entry),
	);
	if (!found) throw new Error(`no golden backs ${scenario}`);
	return resolve(goldenRoot, found);
}

/**
 * The emitted component's name, read from the IR the emitter was given rather
 * than from the file being measured. Measuring `generated/S4.jsx` for whatever
 * function it happens to contain would find the emitter's output by definition;
 * naming it from the golden means a component the emitter renamed is a MISSING
 * FUNCTION here, not a silently re-measured one.
 */
async function componentName(scenario: string): Promise<string> {
	const ir = JSON.parse(await readFile(goldenFor(scenario), 'utf8')) as {
		components: Array<{ name: string }>;
	};
	return ir.components[0]!.name;
}

function findFunction(program: Node, name: string): Node | null {
	let found: Node | null = null;
	const match = (node: Node, context: { stop(): void }) => {
		if ('id' in node && node.id?.type === 'Identifier' && node.id.name === name) {
			found = node;
			context.stop();
		}
	};
	walk(program, { FunctionDeclaration: match, FunctionExpression: match });
	return found;
}

function structuralNodes(node: Node): number {
	let count = 0;
	walk(node, {
		enter() {
			count += 1;
		},
	});
	return count;
}

/**
 * The emitted half of `scripts/measure-size.ts`'s measurement, re-derived here
 * because that script exports only the PAIRED `measureAll()` and its `pairs`
 * table has no S4 row - there is no handwritten `SolidS4` reference to pair
 * with, and inventing one to obtain a budget would be a different card's work.
 *
 * A measurement duplicated is a measurement that can drift, so it is TIED: the
 * `agrees with the shared measurement` row below asserts these numbers equal
 * `measureAll()`'s emitted numbers for every scenario the script does cover. If
 * the shared method changes, this file goes red rather than quietly grading S4
 * on a retired ruler.
 */
async function measureEmitted(scenario: string): Promise<{
	physicalLoc: number;
	structuralNodes: number;
}> {
	const file = resolve(packageRoot, 'generated', `${scenario}.jsx`);
	const source = await readFile(file, 'utf8');
	const parsed = parse(source, { sourceType: 'module', lang: 'jsx' });
	if (parsed.diagnostics.length)
		throw new Error(parsed.diagnostics.map((entry) => entry.message).join('; '));
	const name = await componentName(scenario);
	const component = findFunction(parsed.program, name);
	if (!component || component.start == null || component.end == null)
		throw new Error(`Expected function ${name} in ${file}`);
	return {
		physicalLoc: source
			.slice(component.start, component.end)
			.split(/\r?\n/)
			.filter((line) => line.trim()).length,
		structuralNodes: structuralNodes(component),
	};
}

/**
 * RECORDED, NOT ROUNDED. Every number here was MEASURED off the emitted output
 * and written down as measured - S4 is a nested keyed repeat and is legitimately
 * the largest thing this repo emits, so its budget says so instead of being
 * trimmed to look tidy beside S1's.
 */
const EMITTED_BUDGETS: Record<string, { physicalLoc: number; structuralNodes: number }> = {
	S1: { physicalLoc: 29, structuralNodes: 144 },
	S2: { physicalLoc: 112, structuralNodes: 563 },
	S3: { physicalLoc: 81, structuralNodes: 334 },
	// S4 has NO handwritten reference to be compared against, so this row is a
	// budget rather than a comparison, and it is the corpus's structural
	// heavyweight - what a repeat nested inside a repeat costs, recorded as
	// measured.
	S4: { physicalLoc: 78, structuralNodes: 438 },
	// S5 likewise has no handwritten reference, so this is a budget. It records what
	// a populated two-arm branch costs. Solid pays MORE structural nodes than react
	// for FEWER physical lines here, which is the <Show> wrapper plus two distinct
	// arm subtrees the show-two-arm ruling requires be kept distinct.
	S5: { physicalLoc: 72, structuralNodes: 357 },
	// S6 likewise has no handwritten reference, so this is a budget. Solid records
	// FEWER structural nodes than react for the same IR here, the reverse of S5:
	// S6 has no branch, and `<For>` over a flat list costs less than react's
	// `.map()` arrow once no `<Show>` wrapper is in the way.
	S6: { physicalLoc: 67, structuralNodes: 351 },
	// S7 likewise has no handwritten reference, so this is a budget. Solid records
	// FEWER physical lines than react and MORE structural nodes, which is the
	// same crossover S5 showed and the reverse of S6: `<For>` is cheaper to print
	// than react's `.map()` arrow, while every computed here becomes its own
	// arrow-function accessor rather than a bare `const`.
	S7: { physicalLoc: 112, structuralNodes: 578 },
};

describe('honest emitted structure comparison', () => {
	test('measures calibrated handwritten bodies with physical LOC primary', async () => {
		expect(await measureAll()).toEqual([
			{
				scenario: 'S1',
				reference: { physicalLoc: 35, structuralNodes: 166 },
				emitted: { physicalLoc: 29, structuralNodes: 144 },
			},
			{
				scenario: 'S2',
				reference: { physicalLoc: 114, structuralNodes: 645 },
				emitted: { physicalLoc: 112, structuralNodes: 563 },
			},
			{
				scenario: 'S3',
				reference: { physicalLoc: 111, structuralNodes: 428 },
				emitted: { physicalLoc: 81, structuralNodes: 334 },
			},
		]);
	});

	test('every scenario in the derived corpus has a recorded emitted budget', () => {
		const corpus = scenarioCorpus();
		// THE FLOOR. A lower bound, so S5 widens it with no edit here, while a
		// golden that silently disappeared is red.
		expect(corpus).toEqual(expect.arrayContaining(['S1', 'S2', 'S3', 'S4']));
		// EXACT, in both directions: a scenario with no budget is red (the hole S4
		// fell through), and a budget for a scenario that no longer exists is red
		// too (a stale row grading nothing).
		expect(Object.keys(EMITTED_BUDGETS).sort()).toEqual([...corpus].sort());
	});

	test('the emitted corpus measures exactly its recorded budget', async () => {
		const measured = Object.fromEntries(
			await Promise.all(
				scenarioCorpus().map(async (scenario) => [scenario, await measureEmitted(scenario)]),
			),
		);
		expect(measured).toEqual(EMITTED_BUDGETS);
	});

	test('the local measurement agrees with the shared measureAll() ruler', async () => {
		const shared = await measureAll();
		// ANTI-VACUITY: the shared script must actually cover something, or the
		// loop below ties this file's method to nothing.
		expect(shared.length).toBeGreaterThan(0);
		for (const { scenario, emitted } of shared)
			expect(await measureEmitted(scenario), scenario).toEqual(emitted);
		// And every scenario the shared script covers is one this file budgets, so
		// the two tables cannot describe disjoint corpora.
		expect(Object.keys(EMITTED_BUDGETS)).toEqual(
			expect.arrayContaining(shared.map((entry) => entry.scenario)),
		);
	});

	/**
	 * CALIBRATION for the DERIVED inventory. A derived list nobody has watched go
	 * red is not an instrument. Both directions run through the SAME
	 * `scenarioCorpus()` the rows above call, against a throwaway golden root.
	 */
	test('CALIBRATION: the derived corpus goes red on a missing and on an extra golden', async () => {
		const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises');
		const { tmpdir } = await import('node:os');
		const corpus = scenarioCorpus();
		const root = await mkdtemp(resolve(tmpdir(), 'frameless-solid-size-'));
		try {
			const goldens = resolve(root, 'goldens');
			await mkdir(goldens);
			for (const entry of readdirSync(compilerGoldenRoot))
				await writeFile(resolve(goldens, entry), '{}');
			expect(scenarioCorpus(goldens)).toEqual(corpus);
			await rm(goldenFor('S4', goldens));
			expect(scenarioCorpus(goldens)).not.toEqual(corpus);
			await writeFile(resolve(goldens, 's4-nested-list.json'), '{}');
			expect(scenarioCorpus(goldens)).toEqual(corpus);
			await writeFile(resolve(goldens, 's99-planted.json'), '{}');
			expect(scenarioCorpus(goldens)).not.toEqual(corpus);
			// The degenerate case the throw exists for.
			await rm(goldens, { recursive: true, force: true });
			await mkdir(goldens);
			expect(() => scenarioCorpus(goldens)).toThrow(/no s<n>-\*\.json scenario goldens/);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
