import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');

await mkdir(resolve(root, 'generated'), { recursive: true });
const fixtures = [
	['S1.vue', 's1-render-once.json'],
	['S2.vue', 's2-keyed-todo.json'],
	['S3.vue', 's3-event-form.json'],
	['S4.vue', 's4-nested-list.json'],
	['S5.vue', 's5-branch-teardown.json'],
	['S6.vue', 's6-whitespace-text.json'],
	['S7.vue', 's7-form-controls.json'],
	['S8.vue', 's8-async-handlers.json'],
	['S9.vue', 's9-boolean-attributes.json'],
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
	['S10.vue', 's10-todomvc.json'],
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
	//
	// THIS LANE EMITS IT AND THE EMITTED OUTPUT THROWS IN A BROWSER, WHICH NOTHING
	// IN THIS PACKAGE CAN SEE. `emit()` succeeds, the dossier gate passes, and
	// `compileScript` reports an empty diagnostic set - and then the served page
	// reports `_ctx.Promise is not a constructor` on every optimistic toggle and
	// every remote search. The cause is this emitter's own shape: handlers are
	// inlined into TEMPLATE EXPRESSIONS, and Vue's template compiler prefixes any
	// identifier outside GLOBALS_ALLOWED with `_ctx.`. Measured at
	// @vue/shared@3.5.40, that list carries Date and JSON and carries NEITHER
	// Promise NOR setTimeout.
	//
	// THE ROW STAYS. The artifact is genuinely emitted, four of the app's seven
	// axes run on it, and deleting the row would delete the evidence. This is a
	// LANE LIMIT inside Vue's own design envelope - template expressions are
	// deliberately scoped to the render context - and it is recorded rather than
	// worked around, because working around it would mean changing this emitter,
	// which frameless-app-suite-v1 T003 was explicitly forbidden to do.
	['S11.vue', 's11-todomvc-advanced.json'],
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
	['S12.vue', 's12-codex-clone.json'],
	['S13.vue', 's13-hn-front.json'],
	// S14 (the HACKER NEWS ITEM PAGE - the RECURSION scenario) IS DELIBERATELY
	// ABSENT FROM THIS LIST. The vue emitter REFUSES it, verbatim and read off the
	// real module rather than off a probe:
	//
	//   Vue emitter has no lowering for a same-module component reference
	//   (HnItem): a .vue SFC declares exactly one component
	//
	// S14's `HnItem` names ITSELF in its own template, which is a component
	// reference whose target module is `self`, and an SFC has room for exactly one
	// component.
	//
	// THE REFUSAL IS NOT A VERDICT ON RECURSION IN THIS LANE, and T003 measured
	// the difference rather than assuming it. Spelled the way Vue spells recursion
	// NATIVELY - the module importing ITSELF under an alias - THIS EMITTER TAKES
	// IT. That spelling is refused one layer up instead: `resolveModuleSet` throws
	// "Component-reference cycle: src/comment.tsrx -> src/comment.tsrx", and the
	// emitted import specifier is derived from the `.tsrx` specifier, so a module
	// built from `s14-hn-item.tsrx` would import `./s14-hn-item.vue` while the
	// artifact on disk is `generated/S14.vue`. Two-module mutual reference
	// (A -> B -> A) is refused by the same linker.
	//
	// Adding the row would not produce output; it would make this script THROW.
	// `VUE_UNBUILT_SCENARIOS` in test/unbuilt-scenarios.ts carries the same
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
	['S15.vue', 's15-habit-tracker.json'],
	// THE SEVENTH APPLICATION IN THE CORPUS - the TASK BOARD - and THE DRAG CARD.
	// It takes the next ORDINAL slot for the reason every row above records, and
	// it is a SIX-LANE APPLICATION for the same reason S15 is: THE FIXTURE NAMES
	// NO GLOBAL. It used to claim a POSITION in that sequence - "the THIRD ...
	// after S13 and S15" - and the whole family of those claims counted from S13,
	// which was never first. Naming the reason is durable; the position was not,
	// and nothing on disk can recompute arrival order. See the S15 row above.
	//
	// THE AXIS IT MEASURES IS IN THE FILE, AND THIS LANE DRAGS. This row used to
	// say the axis was not in the file and that it had been "RECORDED rather than
	// shipped"; both sentences outlived the change that falsified them. The
	// board predicted the two-word drag events "cannot be produced" because
	// `jsxEventName` does `name.slice(2).toLowerCase()`. Measured on a probe
	// through this very emitter: THEY ARE PRODUCED, as `@dragover`,
	// `@dragstart`, `@dragend` and `@pointerdown` - and `dragover` IS the real DOM
	// event name, so this lane is CORRECT BY ACCIDENT of the same casing loss that
	// makes react's `onDragover` inert. It costs this lane no type errors at all.
	//
	// WHAT KEPT THEM OUT WAS THE TYPE BASELINE IN THE THREE JSX LANES, AND IT WAS
	// A BUDGET READ AS A WALL: an earlier probe measured `pnpm check` 267 -> 280
	// with `draggable` spelled as a STATIC string. The fixture BINDS it instead;
	// the rise was stated in advance, spent and attributed. RE-MEASURED AT HEAD BY
	// THIS COMMENT'S OWN CARD: `pnpm check` is 261 WITH the drag shipped, and a
	// REAL NATIVE MOUSE DRAG (mouse down, twenty interpolated moves, mouse up; no
	// synthetic `DragEvent` anywhere) moved card `t1` from `backlog` to `review`
	// AND IT STAYED in THIS LANE, with `data-dragging="yes"` on `t1` mid-gesture -
	// and in solid, qwik, svelte and angular. REACT IS THE ONLY LANE THAT DOES NOT
	// MOVE THE CARD. The arrow buttons stay in all six lanes for that reason and
	// the page SAYS which lane does which. See the fixture header.
	//
	// This page has NO FORM CONTROL AT ALL, so like S15 it contributes zero hosts
	// to worked example 12a's domain in src/gate/index.ts; that census is
	// re-argued rather than renumbered when this row lands.
	//
	// Like S10-S15 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S16.vue', 's16-task-board.json'],
	// THE EIGHTH APPLICATION IN THE CORPUS - CONTACTS - and THE FORMS CARD. It is
	// a SIX-LANE APPLICATION for the same reason S15 and S16 are: THE FIXTURE
	// NAMES NO GLOBAL, which mattered most here because a `date` input's obvious
	// default is today and `Date` stays refused. It used to claim a POSITION in
	// that sequence - "the FOURTH scenario all six lanes emit" - counting from
	// S13, which was never first. See the S15 row above. THIRTEEN control kinds
	// ship, every one
	// bound and every one observable in a live preview card.
	//
	// THIS ROW MOVES worked example 12a IN src/gate/index.ts MORE THAN ANY
	// SCENARIO SINCE S7, AND THAT IS THE POINT OF IT. S13 moved the count by one,
	// S15 and S16 moved nothing at all, and three consecutive negatives had been
	// read as evidence that the domain had stopped growing. S17 adds EIGHTEEN
	// instances at once and, more importantly, a THIRD TAG - `<select>` - which no
	// scenario in this corpus had ever bound `value` on (S7 ships two selects and
	// binds `data-size` on one of them, never `value`). `v-model` on a `<select>`
	// is `vModelSelect`, a different directive from `vModelText` with different
	// behaviour, so the G5 difference list grows rather than merely repeating.
	// THAT CENSUS IS RE-ARGUED, NOT RENUMBERED, when this row lands.
	//
	// This emitter takes every one of the thirteen types without complaint; no
	// emitter in any lane reads the VALUE of a `type` attribute at all.
	//
	// Like S10-S16 it stays OUT of the 6 x 9 three-way contract.
	['S17.vue', 's17-contacts.json'],
] as const;
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), formatEmitted(emit(ir)));
}
