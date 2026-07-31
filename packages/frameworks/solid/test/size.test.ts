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
	// prop type on the single `props` parameter costs this lane +5 physical lines
	// and +30 structural nodes. The node delta matches React's exactly - the same
	// type literal - while the line delta is half, because Solid annotates ONE
	// parameter where React annotates a four-binding destructuring pattern.
	S1: { physicalLoc: 34, structuralNodes: 174 },
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
	// S9 likewise has no handwritten reference, so this is a budget. MEASURED off
	// the emitted output. It lands on the SAME `structuralNodes` as react's S9
	// (369) while printing three FEWER physical lines — the only scenario in the
	// corpus where the two lanes' node counts coincide exactly. `<For>` costs
	// fewer printed lines than react's `.map()` arrow, and S9's two `computed`
	// derivations are small enough that solid's per-computed accessor arrows do
	// not overtake the difference the way they do in S7.
	// S8 likewise has no handwritten reference, so this is a budget, MEASURED off
	// the emitted output. Solid prints TWO fewer physical lines and FIVE fewer
	// structural nodes than react on the same scenario, and the reason is the
	// repair rather than the template: react has to spell `setPhase` twice and
	// `setTicks((currentTicks) => currentTicks + 1)` to be correct across the
	// `await`, while solid's signal reads are live already and cost it nothing.
	// The async axis is the one place in this corpus where react pays for
	// correctness in bytes and solid does not.
	S8: { physicalLoc: 40, structuralNodes: 200 },
	S9: { physicalLoc: 69, structuralNodes: 369 },
	// S10 likewise has no handwritten reference, so this is a budget, MEASURED off
	// the emitted output. It is the corpus's first WHOLE APPLICATION rather than an
	// axis probe, and solid prints 29 MORE physical lines and 37 MORE structural
	// nodes than react on it. THAT DIRECTION IS NOT NEW AND THIS COMMENT DOES NOT
	// CLAIM A FIRST: S2 (+10/+26) and S4 (+1/+13) already have solid larger on both
	// axes, and S10's node gap of 37 is actually UNDER their combined 39 - only the
	// line gap of 29 exceeds their combined 11.
	// NO CAUSE IS ASSERTED HERE, AND THE OBVIOUS ONE WAS CHECKED AND REFUTED.
	// S7's row attributes solid's node premium to its per-computed accessor arrows,
	// which would predict S10 - the biggest scenario - carries the most `computed`
	// derivations. IT DOES NOT: S10 declares FOUR against S7's FIVE, measured off
	// the goldens. So whatever produces this gap scales with something other than
	// derivation count, and the row records the measurement rather than inventing
	// the mechanism. A budget is allowed to say "this is what it costs"; it is not
	// allowed to say why on a hypothesis its own corpus contradicts.
	S10: { physicalLoc: 304, structuralNodes: 1299 },
	// S11 (TodoMVC ADVANCED) is the corpus's largest scenario in this lane too, and
	// it RE-TESTS S10's row rather than merely extending it.
	// THE PER-COMPUTED-ACCESSOR HYPOTHESIS IS REFUTED AGAIN, AND HARDER. S7's row
	// attributes solid's structural-node premium over react to its per-`computed`
	// accessor arrows; S10's row already refuted that by declaring FOUR computeds
	// against S7's five while the gap grew. S11 declares EIGHT - double S10's, and
	// the most in the corpus - and the node gap barely moves: +37 nodes at S10,
	// +39 at S11. Two doublings of the derivation count have now failed to move it.
	// THE LINE GAP WENT THE OTHER WAY, WHICH IS THE NEW DATUM. Solid printed 29
	// MORE physical lines than react at S10 and only 16 more at S11, so the line
	// premium NEARLY HALVED on the larger scenario while the node premium held
	// flat. Those two facts are recorded as measured and NO cause is asserted: a
	// budget may say what something costs, and this table has now twice caught
	// itself about to say why on a hypothesis its own corpus contradicts.
	S11: { physicalLoc: 440, structuralNodes: 1930 },
	// S12 (the CODEX CLONE) IS WHERE THE LINE PREMIUM FLIPS SIGN, and this row
	// records that without asserting a cause, exactly as S11's row above declined
	// to.
	// Measured, against the react lane's same-scenario budget: solid printed 29
	// MORE physical lines at S10, 16 more at S11, and TWENTY-FOUR FEWER at S12
	// (362 vs 386). The NODE premium is unchanged in sign and barely moved in size:
	// +37 at S10, +39 at S11, +2 at S12. So the two axes have now been shown to
	// move independently three times, and the one hypothesis this table has twice
	// been tempted by - a per-`computed` accessor tax - is refuted a third time:
	// S12 declares SEVEN computeds, one fewer than S11, while the node gap
	// collapsed by 37.
	// The scenario is also this table's first with NO ANGULAR TWIN besides S11:
	// that lane refuses S12 on the same global-identifier ban, so `S12` exists in
	// five `generated/` directories and not six.
	S12: { physicalLoc: 362, structuralNodes: 1762 },
	// S13 (the HACKER NEWS FRONT PAGE) IS THE CORPUS'S NEW HEAVYWEIGHT ON BOTH
	// AXES, and the FIRST application row here with a twin in all SIX lanes -
	// S11 and S12 exist in five `generated/` directories, S13 in six. Against
	// S11, the previous heaviest in this lane: 599/440 = 1.36x the physical lines
	// and 2171/1930 = 1.12x the structural nodes, so the two ratios are 21% apart
	// where every earlier application row agreed to within 6%. MEASURED CAUSE,
	// not a guess: sixteen of the template's sixty-five hosts are
	// `<span class="hn-bar">|</span>` separators carrying one character and no
	// binding, which cost a LINE each and almost no nodes. The reference
	// separates its links with a literal `" | "` text node that is unauthorable
	// in this corpus, so the separators have to become elements.
	// A CLAIM THIS ROW DECLINES TO MAKE. The obvious reading is that S13 narrows
	// this lane's premium over react, since 599/576 = 1.04x on lines. MEASURED
	// ACROSS THE FOUR APPLICATIONS, THE PREMIUM HAS NO TREND TO NARROW: S10 is
	// 304/275 = 1.11x, S11 is 440/424 = 1.04x, and S12 is 362/386 = 0.94x - this
	// lane is SMALLER than react on the codex clone. So S13's 1.04x is the middle
	// of a scattered series, not a new low, and the row says so instead of
	// describing a trend three data points refute.
	// RE-MEASURED BY frameless-app-fidelity-v1 T006, which added the `.hn-note`
	// disclosure labelling the SEVENTEEN stub links that have no destination in
	// this corpus: +33 structural nodes and +21 physical lines, the SAME DELTA
	// this scenario took in the react lane. The three new hosts are worth about
	// six of those lines; the other fifteen are THE FORMATTER WRAPPING ONE LONG
	// PROSE STRING, which is a third line-expensive node-cheap source shape
	// alongside the separator spans - so the split widened from 19% to 21% rather
	// than closing. THE PREMIUM OVER REACT DID NOT MOVE AT ALL: 1.04x before and
	// 1.04x after, because both lanes wrap the same prose at the same width.
	S13: { physicalLoc: 599, structuralNodes: 2171 },
	// S14 (the HACKER NEWS ITEM PAGE) IS THE FIRST ROW IN THIS TABLE WHOSE NUMBER
	// DOES NOT BOUND WHAT IT RENDERS. Its `HnItem` NAMES ITSELF, so thirty-nine
	// authored hosts render once per comment per level - fifteen instances for the
	// seeded forest - and the emitted size is independent of the tree. A budget on
	// a recursive component measures the source only.
	// AGAINST S13: 340/599 = 0.57x the physical lines and 1261/2171 = 0.58x the
	// structural nodes - the two axes agree to within 2%, which is what S13's
	// row predicted would happen once its sixteen separator spans went away.
	// THE PREMIUM SERIES, RE-DERIVED RATHER THAN CARRIED. S13's row declined to
	// name a trend in this lane's size against react, and S14 is the fifth point
	// and does not create one: 340/329 = 1.03x, against S10 1.11x, S11 1.04x, S12
	// 0.94x and S13 1.04x. Five points, two of them below 1.00x on either side of
	// the middle - still a scatter, still no trend, and the row still declines to
	// describe one.
	S14: { physicalLoc: 340, structuralNodes: 1261 },
	// S15 (THE HABIT TRACKER) IS THE CORPUS'S LARGEST TEMPLATE AND ITS CHEAPEST
	// ONE PER HOST. EIGHTY-ONE hosts - sixteen more than S13, the previous largest
	// - emit 425 physical lines against S13's 599, which is 5.25 lines per host
	// against S13's 9.22: the lowest in this table.
	// THE CAUSE IS DERIVED: emitted size tracks HANDLER BODIES, and this app has
	// SEVEN recorded events and exactly ONE state write, fewer than any other
	// application in the corpus (S13: 27 events, S11: 19, S10: 15), because its
	// whole mechanism is one write fanning out through `computed` values and
	// class/hidden bindings.
	// AGAINST S13: 425/599 = 0.71x the physical lines and 2029/2171 = 0.93x the
	// structural nodes - 32% apart, and DIVERGING THE OPPOSITE WAY from S13's own
	// split. S13's lines run ahead of its nodes because of sixteen one-character
	// separator spans and one wrapped prose note; S15's nodes run ahead of its
	// lines because its seed carries thirty-six nested `{ id: 'h1d1', on: true },`
	// literals that the formatter packs one per line. OPPOSITE DIVERGENCES FROM
	// DIFFERENT SOURCE SHAPES is what confirms the split tracks the SOURCE'S SHAPE
	// rather than a per-element tax - and the magnitudes are NOT similar any more,
	// 32% against 21%, because frameless-app-fidelity-v1 T006 moved S13 further in
	// S13's own direction and left S15 alone. The DIRECTIONS were always the
	// argument; the near-equal magnitudes were a coincidence of two corpora, and
	// this row now says so rather than repeating a number that stopped being true.
	// THE SOLID PREMIUM, re-derived rather than carried: 425/411 = 1.03x react on
	// lines and 2029/2002 = 1.01x on nodes. The series is now 1.11 / 1.04 / 0.94 /
	// 1.04 / 1.03 / 1.03 across S10-S15 and STILL REFUSES TO NAME A TREND - it has
	// now held within 3% of parity for four consecutive applications spanning a
	// stream, a doorless page, a recursive component and a fan-out page, which is a
	// stronger statement of "no trend" than the earlier rows could make.
	// WHAT THE NUMBER CANNOT SEE: S15's claim is that ONE CLICK MOVES EIGHT DERIVED
	// OBSERVABLES, and an emitter that repainted only the clicked row would measure
	// identically here. Only a driven browser separates them.
	S15: { physicalLoc: 425, structuralNodes: 2029 },
	// S16 (THE TASK BOARD) HOLDS EIGHTY-NINE HOSTS, eight more than S15, and now
	// costs 7.20 lines per host against S15's 5.25 and S13's 9.22 - still between
	// them, still in the middle of this table's range.
	// THIS ROW IS NOW A CONTROLLED EXPERIMENT ON THE CLAIM S12 OPENED AND S15
	// SHARPENED, that emitted size tracks HANDLER BODIES rather than host count.
	// `frameless-app-fidelity-v1` T004 shipped the drag axis by adding FOUR EVENTS
	// AND FOUR STATE WRITES TO A TEMPLATE WHOSE HOST COUNT DID NOT MOVE: the drop
	// zone is the `<ul>` and the draggable is the `<li>` the page already had.
	// Events 12 -> 16, writes 2 -> 6, hosts 89 -> 89, lines 558 -> 641 (+14.9%),
	// nodes 2449 -> 2719 (+11.0%). WITH THE HOST TERM PINNED BY CONSTRUCTION, SIZE
	// STILL MOVED - and the react lane, an INDEPENDENT emitter over the same IR,
	// moved +13.0% / +11.2% on the same change.
	// AGAINST S15: 641/425 = 1.51x the lines on 1.10x the hosts and 2719/2029 =
	// 1.34x the nodes - LINES AHEAD, which is S13's direction, not S15's. The
	// cause is in the source and the drag enlarged it: the two arrow handlers are
	// twenty-line object-rebuilding `.map` bodies DIFFERING BY ONE IDENTIFIER
	// (`prevId` against `nextId`) and the drop handler is a THIRD copy of the same
	// idea, so the app now pays three times for one thought. A single handler
	// taking a direction is not authorable - it needs a second argument channel or
	// an `if`, and DEFECTS.md 8.1 closes the second door.
	// THE SOLID PREMIUM, re-derived rather than carried: 641/591 = 1.08x react on
	// lines and 2719/2679 = 1.02x on nodes. The series is now 1.11 / 1.04 / 0.94 /
	// 1.04 / 1.03 / 1.03 / 1.08 across S10-S16 and STILL REFUSES TO NAME A TREND -
	// and this row is the strongest evidence yet that there is none to name, since
	// the premium barely moved while the module it measures grew by a seventh.
	// WHAT THE NUMBER CANNOT SEE: THE DRAG IS ON THE PAGE NOW AND THIS LANE RUNS
	// IT. The two-word drag events emit as `onDragover`, `onDragstart` and
	// `onDragend`; this lane delegates by lowercasing the suffix, so the listeners
	// land on the real DOM event names and a real mouse drag completes. React is
	// the only lane that cannot, which is why the arrow buttons stay. The type
	// cost was STATED IN ADVANCE and landed at FIVE new `error TS` lines in this
	// project (73 -> 78) - a TYPE-SURFACE gap, not a broken binding, and the
	// distinction is argued at the two new rows in `emitted-typecheck.test.ts`.
	S16: { physicalLoc: 641, structuralNodes: 2719 },
	// S17 (CONTACTS) IS THE FORMS CARD, the corpus's largest template at TWO
	// HUNDRED AND TWELVE hosts, and it carries THIRTY-TWO events and THIRTY-FIVE
	// state writes - more of both than anything else here.
	// THE SOLID PREMIUM IS 1401/1373 = 1.02x LINES AND 6519/6279 = 1.04x NODES, and
	// on this row the two disagree IN A DIRECTION THIS FILE HAS AN EXPLANATION FOR
	// RATHER THAN A GUESS. Every earlier row's node premium tracked its line
	// premium within a point or two in either direction; here nodes run ahead by
	// 2%, and the producer is named in this package's own
	// test/emitted-typecheck.test.ts: this emitter mirrors a bound `value` into a
	// second `attr:value` attribute (OPEN FINDING 002), and S17 has FIFTEEN
	// `value`-bound hosts - more than the rest of the corpus put together. Fifteen
	// extra attributes are fifteen extra structural NODES on lines that were being
	// printed anyway, which is exactly a node premium with no line premium behind
	// it. It is the first row in this table whose divergence has a cause visible in
	// another test file rather than in the fixture.
	// THE SERIES IS NOW 1.11 / 1.04 / 0.94 / 1.04 / 1.03 / 1.03 / 1.07 / 1.02 across
	// S10-S17 and still refuses to name a trend - and this is its LOWEST reading
	// since S12's 0.94, arriving on the application with the most bound controls,
	// which is the shape most likely to have widened it.
	S17: { physicalLoc: 1401, structuralNodes: 6519 },
};

describe('honest emitted structure comparison', () => {
	test('measures calibrated handwritten bodies with physical LOC primary', async () => {
		expect(await measureAll()).toEqual([
			{
				scenario: 'S1',
				reference: { physicalLoc: 35, structuralNodes: 166 },
				emitted: { physicalLoc: 34, structuralNodes: 174 },
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
