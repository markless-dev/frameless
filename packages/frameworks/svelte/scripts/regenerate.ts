import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');

await mkdir(resolve(root, 'generated'), { recursive: true });
const fixtures = [
	['S1.svelte', 's1-render-once.json'],
	['S2.svelte', 's2-keyed-todo.json'],
	['S3.svelte', 's3-event-form.json'],
	['S4.svelte', 's4-nested-list.json'],
	['S5.svelte', 's5-branch-teardown.json'],
	['S6.svelte', 's6-whitespace-text.json'],
	['S7.svelte', 's7-form-controls.json'],
	['S8.svelte', 's8-async-handlers.json'],
	['S9.svelte', 's9-boolean-attributes.json'],
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
	['S10.svelte', 's10-todomvc.json'],
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
	['S11.svelte', 's11-todomvc-advanced.json'],
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
	['S12.svelte', 's12-codex-clone.json'],
	['S13.svelte', 's13-hn-front.json'],
	// S14 (the HACKER NEWS ITEM PAGE - the RECURSION scenario) IS DELIBERATELY
	// ABSENT FROM THIS LIST. The svelte emitter REFUSES it, verbatim and read off
	// the real module rather than off a probe:
	//
	//   Svelte emitter has no lowering for a same-module component reference
	//   (HnItem): a .svelte file declares exactly one component, and a snippet
	//   cannot own state or a lifecycle
	//
	// S14's `HnItem` names ITSELF in its own template, which is a component
	// reference whose target module is `self`. This lane's file format has room
	// for exactly one component, and the only same-file alternative - a snippet -
	// cannot own the `state()` cells every instance of a recursive thread needs.
	//
	// THE REFUSAL IS NOT A VERDICT ON RECURSION IN THIS LANE, and T003 measured
	// the difference rather than assuming it. Spelled the way Svelte spells
	// recursion NATIVELY - the module importing ITSELF under an alias - THIS
	// EMITTER TAKES IT, and prints `import Self from './comment.svelte'` inside
	// `comment.svelte`. That spelling is refused one layer up instead:
	// `resolveModuleSet` throws "Component-reference cycle: src/comment.tsrx ->
	// src/comment.tsrx", and the emitted import specifier is derived from the
	// `.tsrx` specifier, so a module built from `s14-hn-item.tsrx` would import
	// `./s14-hn-item.svelte` while the artifact on disk is `generated/S14.svelte`.
	// Two-module mutual reference (A -> B -> A) is refused by the same linker.
	//
	// Adding the row would not produce output; it would make this script THROW.
	// `SVELTE_UNBUILT_SCENARIOS` in test/unbuilt-scenarios.ts carries the same
	// subtraction so the omission is ASSERTED rather than merely true.
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
	['S15.svelte', 's15-habit-tracker.json'],
	// THE SEVENTH APPLICATION IN THE CORPUS - the TASK BOARD - and THE DRAG CARD.
	// It takes the next ORDINAL slot for the reason every row above records, and
	// it is a SIX-LANE APPLICATION for the same reason S15 is: THE FIXTURE NAMES
	// NO GLOBAL. It used to claim a POSITION in that sequence - "the THIRD ...
	// after S13 and S15" - and the whole family of those claims counted from S13,
	// which was never first. Naming the reason is durable; the position was not,
	// and nothing on disk can recompute arrival order. See the S15 row above.
	//
	// THE AXIS IT MEASURES IS IN THE FILE, AND THIS LANE DRAGS. This row used to
	// say the axis was not in the file and that this lane "refused any part of
	// it"; the second half was always about an ELEMENT and never about the drag,
	// and the first half is now simply false.
	// The board predicted the two-word drag events
	// "cannot be produced"; measured on a probe through this very emitter, they
	// ARE produced - `ondragover`, `ondragstart`, `ondragend`, `onpointerdown`,
	// which are the REAL DOM EVENT NAMES, so this lane would have been CORRECT BY
	// ACCIDENT of the same casing loss that makes react's `onDragover` inert.
	// WHAT THIS LANE REFUSED IS THE ELEMENT, NOT THE EVENT, verbatim:
	//   "Emitted Svelte module Probe.svelte did not compile warning-free:
	//    a11y_no_static_element_interactions."
	// on a `<div>` or a `<span>` carrying ANY drag handler, and
	//   "... a11y_consider_explicit_label."
	// on a `<button>` with no accessible name. The identical handlers on `<ul>`
	// and `<li>` emit clean, which is why this fixture's one `<ul>`/`<li>` pair is
	// where the drop zone and the draggable card ACTUALLY WENT - the refusal
	// SHAPED the markup rather than removing the axis.
	//
	// WHAT KEPT THEM OUT WAS THE TYPE BASELINE IN THE THREE JSX LANES, AND IT WAS
	// A BUDGET READ AS A WALL: an earlier probe measured `pnpm check` 267 -> 280
	// with `draggable` spelled as a STATIC string. The fixture BINDS it instead;
	// the rise was stated in advance, spent and attributed. RE-MEASURED AT HEAD BY
	// THIS COMMENT'S OWN CARD: `pnpm check` is 261 WITH the drag shipped, and a
	// REAL NATIVE MOUSE DRAG (mouse down, twenty interpolated moves, mouse up; no
	// synthetic `DragEvent` anywhere) moved card `t1` from `backlog` to `review`
	// AND IT STAYED in THIS LANE, with `data-dragging="yes"` on `t1` mid-gesture -
	// and in solid, qwik, vue and angular. REACT IS THE ONLY LANE THAT DOES NOT
	// MOVE THE CARD. The arrow buttons stay in all six lanes for that reason and
	// the page SAYS which lane does which. See the fixture header.
	//
	// There is no `<form>` and no component reference here, so neither the a11y
	// refusal S13 hit in this lane nor the same-module self-reference refusal that
	// leaves S14 unbuilt is reachable. Like S10-S15 it stays OUT of the 6 x 9
	// three-way contract, which scripts/e2e.mjs pins to ['s1'..'s9'].
	['S16.svelte', 's16-task-board.json'],
	// THE EIGHTH APPLICATION IN THE CORPUS - CONTACTS - and THE FORMS CARD. It is
	// a SIX-LANE APPLICATION for the same reason S15 and S16 are: THE FIXTURE
	// NAMES NO GLOBAL, which mattered most here because a `date` input's obvious
	// default is today and `Date` stays refused. It used to claim a POSITION in
	// that sequence - "the FOURTH scenario all six lanes emit" - counting from
	// S13, which was never first. See the S15 row above. THIRTEEN control kinds
	// ship, every one
	// bound and every one observable in a live preview card.
	//
	// THIS LANE IS THE ONLY ONE THAT REFUSED ANYTHING ON THIS AXIS, and neither
	// refusal is about an input TYPE. Both were reproduced on probes through this
	// very emitter and both shaped the fixture:
	//
	//   * `htmlFor` on a `<label>`, verbatim: "Emitted Svelte module Probe.svelte
	//     did not compile warning-free: a11y_label_has_associated_control,
	//     attribute_invalid_property_name." The portable spelling is `for`, which
	//     the REACT emitter rewrites to `htmlFor` on its own.
	//   * a `<form>` with a submit handler and no click handler, verbatim:
	//     "Emitted Svelte module ZProbe.svelte suppresses
	//     [a11y_click_events_have_key_events,
	//     a11y_no_noninteractive_element_interactions] but without those
	//     annotations Svelte reports []. A suppression that changes nothing is a
	//     silent over-fire." S13 constraint 13 and S14 constraint 11 recorded it;
	//     it is RE-MEASURED here rather than inherited, and the fixture's form
	//     carries a `press` trace beside its `add` trace for exactly this reason.
	//
	// A third probe refusal is recorded because it did NOT shape the fixture:
	// `autofocus` and a redundant `role` are both a11y warnings here, on top of
	// being type errors in the three JSX lanes.
	//
	// Like S10-S16 it stays OUT of the 6 x 9 three-way contract.
	['S17.svelte', 's17-contacts.json'],
] as const;
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), formatEmitted(emit(ir)));
}
