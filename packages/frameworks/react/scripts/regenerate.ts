import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');
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
	// THE AXIS IT MEASURES IS IN THE FILE. This row used to say it was not, and
	// that sentence outlived the change that falsified it. The board predicted
	// `onDragStart`/`onDragOver`/`onDrop` "cannot be produced" because
	// `jsxEventName` does `name.slice(2).toLowerCase()`. Measured on a probe
	// through this very emitter: THEY ARE PRODUCED - `onDragover`, `onDragstart`,
	// `onDragend`, `onPointerdown` - exactly as DEFECTS.md 15 says ("there is no
	// refusal in front of it"). THIS LANE IS THE ONE WHERE THE CASING LOSS IS
	// FATAL: react-dom matches by prop name, so `onDragover` never fires, while
	// vue's `@dragover`, angular's `(dragover)` and svelte's `ondragover` are the
	// real DOM event names and DO fire.
	//
	// WHAT KEPT IT OUT WAS THE TYPE BASELINE, AND IT WAS A BUDGET READ AS A WALL.
	// An earlier probe spelled `draggable` as a STATIC string and measured this
	// project 117 -> 123 `error TS` lines and the whole `pnpm check` 267 -> 280.
	// The fixture BINDS `draggable` to an expression instead; the rise was stated
	// in advance, spent and attributed, and `S16.tsx` below is emitted WITH the
	// drop zone and the draggable card. RE-MEASURED AT HEAD BY THIS COMMENT'S OWN
	// CARD: `pnpm check` is 261 WITH the drag shipped, and a REAL NATIVE MOUSE
	// DRAG (mouse down, twenty interpolated moves, mouse up; no synthetic
	// `DragEvent` anywhere) moved card `t1` from `backlog` to `review` AND IT
	// STAYED in solid, qwik, svelte, vue and angular - and NOT in this lane, where
	// chromium logged exactly three errors: "Invalid event handler property
	// `onDragstart` / `onDragend` / `onDragover`". `[draggable="true"]` counts 9
	// IN ALL SIX LANES, so a card here LOOKS draggable and the listener is what
	// never arrives. THE ARROW BUTTONS ARE NOT A SUBSTITUTE AND NOT A LEFTOVER:
	// they move a card in all six lanes, they are how THIS lane moves one, and the
	// page SAYS which lane does which. See the fixture header.
	//
	// Like S10-S15 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S16.tsx', 's16-task-board.json'],
	// THE EIGHTH APPLICATION IN THE CORPUS - CONTACTS - and THE FORMS CARD. It
	// takes the next ORDINAL slot for the reason every row above records, and it
	// is the FOURTH scenario all six lanes emit, after S13, S15 and S16.
	//
	// THE AXIS IS ON THE PAGE. This line used to add "WHICH IS THE DIFFERENCE FROM
	// S16" - S16's axis is on its page now too, in five of six lanes, so the
	// contrast is WITHDRAWN rather than left to read as current. What is true here
	// and not of S16 is that this axis is on the page in ALL SIX: THIRTEEN control
	// kinds ship - text, search, email, tel, url, number, date, time, range,
	// select, radio, checkbox and textarea - every one of them bound and every one
	// of them observable in a live preview card.
	//
	// AND THE BOARD'S PREMISE IS PARTLY REFUTED. It said only `checkbox` and
	// `textarea` were proven and that `select`, `radio` and the multi-field form
	// shape were unmeasured in all six lanes. The `s7-form-controls` fixture IS that
	// shape, has been in this list since the beginning, and is one of the nine
	// scenarios `pnpm e2e` drives in a real browser across six demos.
	//
	// MEASURED ON A PROBE THROUGH THIS VERY EMITTER: ALL SIXTEEN `type=` VALUES
	// EMIT. No emitter reads the value of `type` at all, so the axis has no
	// per-type refusal in it anywhere. WHAT COSTS THIS LANE IS THE ATTRIBUTE
	// BESIDE THE TYPE, and it was measured by dropping a forty-attribute probe
	// into this project's own `generated/` and running its own tsc: `required`,
	// `multiple`, `disabled`, `readonly`, `autofocus`, `spellcheck` and a static
	// `checked` cost one `error TS` line EACH here, and so do `maxlength`,
	// `maxLength`, `minlength`, `size`, `tabindex`, `rows` and `cols` - all of
	// which are FREE in the solid lane. `autocomplete` costs THIS lane and
	// `autoComplete` costs SOLID, so no spelling of it is free in both. `min`,
	// `max` and `step` are FREE in all three JSX lanes, which is what lets the
	// number, date, time and range fields carry real bounds. `for` survives only
	// because THIS EMITTER REWRITES IT to `htmlFor`; authoring `htmlFor` makes the
	// SVELTE lane refuse the module outright.
	//
	// Like S10-S16 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S17.tsx', 's17-contacts.json'],
] as const;

await mkdir(resolve(root, 'generated'), { recursive: true });
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), await formatEmitted(emit(ir)));
}
