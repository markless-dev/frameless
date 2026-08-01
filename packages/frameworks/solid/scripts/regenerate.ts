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
	// IT IS ONE OF THE SEVEN SIX-LANE APPLICATIONS, and this row used to say the
	// opposite: "the first corpus scenario that does NOT emit in all six lanes -
	// the angular emitter refuses it on its global-identifier ban". THAT WAS TRUE
	// WHEN IT WAS WRITTEN AND IT IS FALSE NOW. `frameless-app-fidelity-v1` T003
	// ruled a TWO-NAME allowlist - `Promise` and `setTimeout`, nothing else - and
	// T007 landed it, so `ANGULAR_UNBUILT_SCENARIOS` in
	// packages/frameworks/angular/test/unbuilt-scenarios.ts is the empty array and
	// all SIX CORPUS LANES carry this scenario in their `generated/` directory.
	// THE BAN ITSELF IS STILL REAL and still refuses every other global - `Date`,
	// `JSON`, `Math`, `console`, `fetch`, `localStorage` and `document` have zero
	// instances in authored executable code and stay out - which is argued at
	// `TRANSPLANTED_GLOBALS` in packages/frameworks/angular/src/emitter/index.ts.
	// Both counts above are recompiled from scripts/demo.mjs at check time by
	// ruling 11 in scripts/check-citations.mjs, so neither can rot here the way
	// the sentence they replaced did. Like S10, it stays out of the 6 x 9
	// three-way contract, which scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S11.tsx', 's11-todomvc-advanced.json'],
	// THE THIRD APPLICATION IN THE CORPUS - the CODEX CLONE - and it takes the next
	// ORDINAL slot for exactly the reason the two rows above record: the suites
	// derive their inventory from /^s(\d+)-[\w-]+\.json$/ and assert it EXACTLY.
	// Like S10 and S11 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9']. IT IS ALSO ONE OF THE
	// SEVEN SIX-LANE APPLICATIONS, and this row used to say the opposite: "the
	// SECOND scenario the angular emitter refuses, on the same global-identifier
	// ban". Its streamed answer does separate three unrolled chunks with
	// `new Promise` + `setTimeout`, and that lane genuinely could not NAME a
	// global inside a transplanted body - but the same T007 that admitted S11
	// admitted this one, so all SIX CORPUS LANES carry it and
	// `ANGULAR_UNBUILT_SCENARIOS` is the empty array. See the S11 row above for
	// the allowlist and for what that lane still refuses.
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
	// above records. IT IS ONE OF THE SEVEN SIX-LANE APPLICATIONS - the corpus
	// rows every lane emits - and the first that was built to be so ON PURPOSE. A
	// POSITION IN THAT SEQUENCE USED TO BE WRITTEN HERE AND IT WAS WRONG IN EVERY
	// LANE: this row read "the SECOND ... after S13", counting from S13 because
	// S13's own comment once claimed to be the first. S13 never was - S10 has
	// carried no `unbuilt` entry in any revision of scripts/demo.mjs - and S11 and
	// S12 joined when T007 closed the angular global-identifier hole, so the tail
	// was short by three names as well. THE COUNT SURVIVES AND THE POSITION DOES
	// NOT: seven is recompiled from that table at check time by ruling 11 in
	// scripts/check-citations.mjs, while arrival order lives in git history and
	// nothing on disk can recover it. WHAT THE POSITION WAS STANDING IN FOR IS
	// THIS: the whole app is SYNCHRONOUS DERIVED STATE, so there is no `Promise`
	// or `setTimeout` for the angular lane's global-identifier ban to catch, no
	// async door for the vue lane's GLOBALS_ALLOWED gap to open, and no component
	// reference for either of the two emitter defects T003 isolated to reach. Its
	// date is a LITERAL STRING in the seeded data for exactly the reason S13's
	// relative ages are - the angular emitter cannot NAME `Date`. Like S10-S14 it
	// stays OUT of the 6 x 9 three-way contract, which scripts/e2e.mjs pins to
	// the literal ['s1'..'s9'].
	['S15.tsx', 's15-habit-tracker.json'],
	// THE SEVENTH APPLICATION IN THE CORPUS - the TASK BOARD - and THE DRAG CARD.
	// It takes the next ORDINAL slot for the reason every row above records, and
	// it is a SIX-LANE APPLICATION for the same reason S15 is: THE FIXTURE NAMES
	// NO GLOBAL. It used to claim a POSITION in that sequence - "the THIRD ...
	// after S13 and S15" - and the whole family of those claims counted from S13,
	// which was never first. Naming the reason is durable; the position was not,
	// and nothing on disk can recompute arrival order. See the S15 row above.
	//
	// THE AXIS IT MEASURES IS IN THE FILE. This row used to say it was not. The
	// board predicted `onDragStart`/`onDragOver`/`onDrop` "cannot be produced"
	// because `jsxEventName` does `name.slice(2).toLowerCase()`. Measured on a
	// probe through this very emitter: THEY ARE PRODUCED - `onDragover`,
	// `onDragstart`, `onDragend`, `onPointerdown` - exactly as DEFECTS.md 15 says
	// ("there is no refusal in front of it"), and THIS LANE FIRES THEM: it
	// delegates by lowercasing the suffix, so the listeners land on the real DOM
	// event names.
	//
	// WHAT KEPT THEM OUT WAS THE TYPE BASELINE, AND IT WAS A BUDGET READ AS A
	// WALL. An earlier probe spelled `draggable` as a STATIC string and measured
	// this project 80 -> 86 `error TS` lines and the whole `pnpm check` 267 -> 280.
	// The fixture BINDS `draggable` to an expression instead; the rise was stated
	// in advance, spent and attributed, and `S16.tsx` below is emitted WITH the
	// drop zone and the draggable card. RE-MEASURED AT HEAD BY THIS COMMENT'S OWN
	// CARD: `pnpm check` is 261 WITH the drag shipped, and a REAL NATIVE MOUSE
	// DRAG (mouse down, twenty interpolated moves, mouse up; no synthetic
	// `DragEvent` anywhere) moved card `t1` from `backlog` to `review` AND IT
	// STAYED in THIS LANE, with `data-dragging="yes"` on `t1` mid-gesture - and in
	// qwik, svelte, vue and angular. REACT IS THE ONLY LANE THAT DOES NOT MOVE THE
	// CARD, because react-dom matches by prop name. The arrow buttons stay in all
	// six lanes for that reason, and the page SAYS which lane does which. See the
	// fixture header.
	//
	// This lane has no component reference here and neither of the two emitter
	// defects T003 isolated is reachable: S16 is a SINGLE component, so the
	// double-called signal read cannot occur. Its three nested repeats -
	// columns -> tasks -> tags, the corpus's FIRST three-level nesting - are all
	// over a state cell or a field of a loop variable, never over a `computed`,
	// which is this lane's own "unconsumed keyed identity semantics" refusal.
	//
	// Like S10-S15 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S16.tsx', 's16-task-board.json'],
	// THE EIGHTH APPLICATION IN THE CORPUS - CONTACTS - and THE FORMS CARD. It is
	// a SIX-LANE APPLICATION for the same reason S15 and S16 are: THE FIXTURE
	// NAMES NO GLOBAL, which mattered most here because a `date` input's obvious
	// default is today and `Date` stays refused. It used to claim a POSITION in
	// that sequence - "the FOURTH scenario all six lanes emit" - counting from
	// S13, which was never first. See the S15 row above. THIRTEEN control kinds
	// ship, every one
	// bound and every one observable in a live preview card.
	//
	// THIS LANE IS THE CHEAPEST OF THE THREE JSX LANES ON STATIC FORM ATTRIBUTES,
	// and that is a measurement rather than a note. Dropping a forty-attribute
	// probe into this project's own `generated/` and running its own tsc:
	// `maxlength`, `maxLength`, `minlength`, `size`, `tabindex`, `rows`, `cols`
	// and `list` are ALL FREE here and every one of them costs the react lane, the
	// qwik lane or both - this lane's JSX types take lowercase DOM attribute names
	// with string values. What still costs it is the BOOLEAN-typed set, the same
	// one that costs everybody: `required`, `multiple`, `disabled`, `readonly`,
	// `autofocus`, `spellcheck`, a static `checked`. AND IT HAS ITS OWN CASING
	// COST IN THE OPPOSITE DIRECTION FROM REACT: `autoComplete` costs THIS lane
	// while `autocomplete` costs react, so no spelling of it is free in both and
	// it is simply absent from the fixture.
	//
	// This lane has no component reference here and neither of the two emitter
	// defects T003 isolated is reachable: S17 is a SINGLE component. Its repeats
	// are all over a state cell or a field of a loop variable, never over a
	// `computed` - which is why the contact filter is a per-card `hidden` binding
	// rather than a filtered view, this lane's own "unconsumed keyed identity
	// semantics" refusal being the reason.
	//
	// Like S10-S16 it stays OUT of the 6 x 9 three-way contract.
	['S17.tsx', 's17-contacts.json'],
] as const;

await mkdir(resolve(root, 'generated'), { recursive: true });
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), await formatEmitted(emit(ir)));
}
