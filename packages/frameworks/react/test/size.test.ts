import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { parse, walk, type Node } from 'yuku-parser';
import { measureAll } from '../scripts/measure-size.ts';

// `tsx`, NOT `jsx`, AT EVERY SITE IN THIS FILE THAT PARSES EMITTED OUTPUT.
// The artifact became `.tsx` at `frameless-emitter-capability-v1` T009/T011 and
// carries an IR-8 props type from T014. MEASURED at yuku-parser/yuku-analyzer
// 0.7.0: `jsx` reports "Expected ')' to close parameter list, but found ':'" on a
// typed props parameter, so a stale `jsx` here fails on VALID output.

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
 * than from the file being measured. Measuring `generated/S4.tsx` for whatever
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
 * table has no S4 row - there is no handwritten `ReactS4` reference to pair
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
	const file = resolve(packageRoot, 'generated', `${scenario}.tsx`);
	const source = await readFile(file, 'utf8');
	const parsed = parse(source, { sourceType: 'module', lang: 'tsx' });
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
	// S1 IS THE ONLY ROW `frameless-emitter-capability-v1` T014 MOVED, and it moved
	// because it is the corpus's ONLY ANNOTATED SCENARIO: printing the authored
	// prop type costs this lane +10 physical lines and +30 structural nodes.
	// RECORD THE CONSEQUENCE RATHER THAN THE NUMBER ALONE - it FLIPS S1's headline
	// comparison. Emitted S1 was 31 lines against a 39-line handwritten reference
	// and is now 41, so emitted output is LARGER than the hand-written twin for the
	// first time in this corpus. That is the honest price of a typed prop surface
	// the reference does not declare, and the row exists to say so out loud.
	S1: { physicalLoc: 41, structuralNodes: 183 },
	S2: { physicalLoc: 102, structuralNodes: 537 },
	S3: { physicalLoc: 84, structuralNodes: 326 },
	// S4 has NO handwritten reference to be compared against, so this row is a
	// budget rather than a comparison. It is also the corpus's structural
	// heavyweight - more `structuralNodes` than any other scenario despite fewer
	// physical lines than S3 - which is what a repeat nested inside a repeat costs
	// and exactly why it was recorded as measured.
	S4: { physicalLoc: 77, structuralNodes: 425 },
	// S5 likewise has no handwritten reference, so this is a budget. It records what
	// a populated two-arm branch costs: both arms carry their own subtree, and
	// the Solid gate forbids sharing one between them, so the cost is paid twice by
	// construction rather than by choice.
	S5: { physicalLoc: 73, structuralNodes: 343 },
	// S6 likewise has no handwritten reference, so this is a budget. It is the
	// corpus's cheapest scenario per DOM site: whitespace-sensitive text costs
	// nothing structural at all - the observable is which characters end up
	// between the nodes, not how many nodes there are.
	S6: { physicalLoc: 73, structuralNodes: 353 },
	// S7 likewise has no handwritten reference, so this is a budget. It is the
	// corpus's most EXPENSIVE scenario on physical lines and the second most on
	// structural nodes: four control types, three `checked` bindings, six
	// `attribute`-kind bindings and four computed derivations on one host. The
	// two numbers pull apart here - more lines than S2 for fewer nodes - because
	// most of S7's cost is per-attribute rather than per-element, and the
	// formatter gives every attribute its own line once a tag carries three.
	S7: { physicalLoc: 118, structuralNodes: 573 },
	// S9 likewise has no handwritten reference, so this is a budget. MEASURED off
	// the emitted output, not predicted from S7's. It carries SEVEN dynamic
	// bindings across five hosts plus two dynamic texts and still costs FEWER
	// physical lines than S6, which is the reading that matters for the axis it
	// exists to prove: a boolean content attribute lowered to `kind: 'property'`
	// costs the React emitter exactly what any other prop costs — `disabled={locked}`
	// is the same shape as the `data-stage={stage}` printed beside it in the same
	// start tag — so the repair T049 shipped is FREE in this lane, and the number
	// is what says so rather than a comment claiming it.
	// S8 likewise has no handwritten reference, so this is a budget, MEASURED off
	// the emitted output. It is the CHEAPEST scenario in the corpus on both axes -
	// fewer lines than S1 - and that is the reading the async axis needs: an
	// authored `async` handler with an `await` inside it costs this lane the same
	// shape a synchronous one costs. What the number does NOT show, and this is
	// the point of recording it, is the 12.2 repair: `setPhase` is called TWICE
	// here, once either side of the boundary, and `setTicks` is a functional
	// updater rather than a closure read. Both are structural changes at the same
	// size, which is exactly why a budget could never have caught 12.2 and a
	// served payload has to.
	S8: { physicalLoc: 45, structuralNodes: 205 },
	S9: { physicalLoc: 72, structuralNodes: 369 },
	// S10 likewise has no handwritten reference, so this is a budget, MEASURED off
	// the emitted output. IT IS THE COMPARISON THIS TABLE HAS NEVER BEEN ABLE TO
	// MAKE: S1-S9 are axis probes, each authored to isolate one construct, and S10
	// is a whole application (TodoMVC) authored as an application. The number says
	// what that costs against S7, the previous heavyweight on BOTH axes: 275/118 =
	// 2.33x the physical lines and 1262/573 = 2.20x the structural nodes. The two
	// ratios agreeing to within 6% is the reading worth recording - an emitter that
	// paid a per-element tax the probes were too small to expose would grow nodes
	// FASTER than lines, and this one does not. Stated as the two ratios rather
	// than as "flat", because 2.33 and 2.20 are not equal and rounding them into
	// agreement is how a budget starts describing a claim instead of a measurement.
	S10: { physicalLoc: 275, structuralNodes: 1262 },
};

describe('honest emitted structure comparison', () => {
	test('measures the actual calibrated handwritten component bodies', async () => {
		expect(await measureAll()).toEqual([
			{
				scenario: 'S1',
				reference: { physicalLoc: 39, structuralNodes: 161 },
				emitted: { physicalLoc: 41, structuralNodes: 183 },
			},
			{
				scenario: 'S2',
				reference: { physicalLoc: 98, structuralNodes: 576 },
				emitted: { physicalLoc: 102, structuralNodes: 537 },
			},
			{
				scenario: 'S3',
				reference: { physicalLoc: 102, structuralNodes: 407 },
				emitted: { physicalLoc: 84, structuralNodes: 326 },
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
		const root = await mkdtemp(resolve(tmpdir(), 'frameless-react-size-'));
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
