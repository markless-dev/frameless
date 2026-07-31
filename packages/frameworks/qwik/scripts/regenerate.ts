import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');

await mkdir(resolve(root, 'generated'), { recursive: true });
const fixtures = [
	['S1.tsx', 's1-render-once.json'],
	['S2.tsx', 's2-keyed-todo.json'],
	['S3.tsx', 's3-event-form.json'],
	['S4.tsx', 's4-nested-list.json'],
	['S5.tsx', 's5-branch-teardown.json'],
	['S6.tsx', 's6-whitespace-text.json'],
	['S7.tsx', 's7-form-controls.json'],
	['S8.tsx', 's8-async-handlers.json'],
	['S9.tsx', 's9-boolean-attributes.json'],
	// THE FIRST APPLICATION IN THE CORPUS, as opposed to the first scenario, and it
	// takes the next ORDINAL slot rather than a name of its own. That is measured,
	// not stylistic: this package's emitter, gate and size suites all derive their
	// inventory of `generated/` by matching the compiler goldens against
	// /^s(\d+)-[\w-]+\.json$/, and every one of them asserts the inventory EXACTLY.
	// A tenth artifact named anything else is rejected by construction in ten-plus
	// per-lane suites at once. Riding the ordinal makes all of them adopt it with no
	// edit, while `scripts/e2e.mjs` pins threeWayScenarios to the literal
	// ['s1'..'s9'], so the app does NOT join the 6 x 9 three-way contract - browsable
	// first, e2e wiring only once a lane is proven.
	['S10.tsx', 's10-todomvc.json'],
	// THE SECOND APPLICATION IN THE CORPUS - TodoMVC ADVANCED - and it takes the
	// next ORDINAL slot for exactly the reason the row above records: the suites
	// derive their inventory from /^s(\d+)-[\w-]+\.json$/ and assert it EXACTLY.
	// It is the first corpus scenario that does NOT emit in all six lanes - the
	// angular emitter refuses it on its global-identifier ban, recorded verbatim
	// in that lane's regenerate.ts - and, like S10, it stays out of the 6 x 9
	// three-way contract, which scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S11.tsx', 's11-todomvc-advanced.json'],
	// THE THIRD APPLICATION IN THE CORPUS - the CODEX CLONE - and it takes the next
	// ORDINAL slot for exactly the reason the two rows above record: the suites
	// derive their inventory from /^s(\d+)-[\w-]+\.json$/ and assert it EXACTLY.
	// Like S10 and S11 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9']. It is the SECOND scenario
	// the angular emitter refuses, on the same global-identifier ban recorded in
	// that lane's regenerate.ts: its streamed answer separates three unrolled
	// chunks with `new Promise` + `setTimeout`.
	['S12.tsx', 's12-codex-clone.json'],
	['S13.tsx', 's13-hn-front.json'],
	// THE FIFTH APPLICATION IN THE CORPUS - the HACKER NEWS ITEM PAGE - and THE
	// RECURSION SCENARIO. It takes the next ORDINAL slot for the reason every row
	// above records. `HnItem` NAMES ITSELF in its own template, so the emitted
	// module below contains a component that renders itself; the thread on screen
	// is whatever the seeded `parentId` chain describes and no depth is fixed
	// anywhere. MEASURED PER LANE at frameless-app-axes-v1 T003: react, solid,
	// qwik and angular EMIT a same-module self-reference; SVELTE AND VUE REFUSE IT
	// and are left UNBUILT with their verbatim messages, recorded in each of those
	// packages' test/unbuilt-scenarios.ts. Like S10-S13 it stays OUT of the 6 x 9
	// three-way contract, which scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S14.tsx', 's14-hn-item.json'],
	// THE SIXTH APPLICATION IN THE CORPUS - the HABIT TRACKER - and THE SIX-LANE
	// FAN-OUT SCENARIO. It takes the next ORDINAL slot for the reason every row
	// above records. IT IS THE SECOND SCENARIO IN THE CORPUS THAT ALL SIX LANES
	// EMIT, after S13, and the first that was built to be so ON PURPOSE: the
	// whole app is SYNCHRONOUS DERIVED STATE, so there is no `Promise` or
	// `setTimeout` for the angular lane's global-identifier ban to catch, no
	// async door for the vue lane's GLOBALS_ALLOWED gap to open, and no component
	// reference for either of the two emitter defects T003 isolated to reach. Its
	// date is a LITERAL STRING in the seeded data for exactly the reason S13's
	// relative ages are - the angular emitter cannot NAME `Date`. Like S10-S14 it
	// stays OUT of the 6 x 9 three-way contract, which scripts/e2e.mjs pins to
	// the literal ['s1'..'s9'].
	['S15.tsx', 's15-habit-tracker.json'],
	// THE SEVENTH APPLICATION IN THE CORPUS - the TASK BOARD - and THE DRAG CARD.
	// It takes the next ORDINAL slot for the reason every row above records, and
	// it is the THIRD scenario all six lanes emit, after S13 and S15.
	//
	// THE AXIS IT MEASURES IS NOT IN THE FILE, AND THAT IS THE MEASUREMENT. The
	// board predicted `onDragStart`/`onDragOver`/`onDrop` "cannot be produced"
	// because `jsxEventName` does `name.slice(2).toLowerCase()`. Measured on a
	// probe through this very emitter: THEY ARE PRODUCED, as `onDragover$`,
	// `onDragstart$`, `onDragend$` and `onPointerdown$`, with the `sync$` wrapper
	// this lane already applies to any handler calling `preventDefault()`.
	//
	// AND THIS LANE'S COST IS NOT AN EVENT AT ALL, WHICH IS THE FINDING. Its six
	// emitted drag handlers typecheck clean; the ONE `error TS` line the probe
	// added here came from `draggable="true"` - the corpus lowers a static
	// attribute as a STRING and this lane's JSX types declare `draggable?:
	// boolean`. That is T003's `rows="6"` finding in a NON-NUMERIC shape, and it
	// widens the corpus rule from "no static numeric attribute" to "no static
	// attribute whose DOM type is not `string`". The whole `pnpm check` went 267
	// -> 280 and this board's oracle forbids the rise, so cards move with arrow
	// buttons instead and the page SAYS SO. See the fixture header.
	//
	// S16 is a SINGLE component, so this lane keeps its `onTrace$`: a function
	// prop never crosses a component boundary here and the un-forwardable-prop
	// defect T003 isolated is not reachable. Like S10-S15 it stays OUT of the
	// 6 x 9 three-way contract, which scripts/e2e.mjs pins to ['s1'..'s9'].
	['S16.tsx', 's16-task-board.json'],
	// THE EIGHTH APPLICATION IN THE CORPUS - CONTACTS - and THE FORMS CARD, the
	// FOURTH scenario all six lanes emit. THIRTEEN control kinds ship, every one
	// bound and every one observable in a live preview card.
	//
	// MEASURED ON A PROBE THROUGH THIS VERY EMITTER: all sixteen `type=` values
	// emit, and this lane wraps every handler that calls `preventDefault()` in
	// `sync$` - which the `<form>`'s submit handler does. THE COST HERE IS AGAIN
	// AN ATTRIBUTE AND NOT AN EVENT, exactly as T005 found with `draggable="true"`
	// against `draggable?: boolean`: this project's own tsc charges one `error TS`
	// line each for `required`, `multiple`, `disabled`, `readonly`, `autofocus`,
	// `spellcheck`, a static `checked`, `maxlength`, `maxLength`, `minlength`,
	// `size`, `tabindex`, `rows` and `cols` - and, uniquely to this lane, for
	// `list` and `inputmode`. `min`, `max` and `step` are free. The fixture spends
	// none of them.
	//
	// S17 is a SINGLE component, so this lane keeps its `onTrace$`: a function
	// prop never crosses a component boundary here and the un-forwardable-prop
	// defect T003 isolated is not reachable. Like S10-S16 it stays OUT of the
	// 6 x 9 three-way contract.
	['S17.tsx', 's17-contacts.json'],
] as const;
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(
		await readFile(resolve(goldenRoot, golden), 'utf8'),
	) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), await formatEmitted(emit(ir)));
}
