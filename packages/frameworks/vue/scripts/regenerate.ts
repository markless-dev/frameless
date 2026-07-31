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
	// It is the first corpus scenario that does NOT emit in all six lanes - the
	// angular emitter refuses it on its global-identifier ban, recorded verbatim
	// in that lane's regenerate.ts - and, like S10, it stays out of the 6 x 9
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
	// scripts/e2e.mjs pins to the literal ['s1'..'s9']. It is the SECOND scenario
	// the angular emitter refuses, on the same global-identifier ban recorded in
	// that lane's regenerate.ts: its streamed answer separates three unrolled
	// chunks with `new Promise` + `setTimeout`.
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
	['S15.vue', 's15-habit-tracker.json'],
	// THE SEVENTH APPLICATION IN THE CORPUS - the TASK BOARD - and THE DRAG CARD.
	// It takes the next ORDINAL slot for the reason every row above records, and
	// it is the THIRD scenario all six lanes emit, after S13 and S15.
	//
	// THE AXIS IT MEASURES IS NOT IN THE FILE, AND THAT IS THE MEASUREMENT. The
	// board predicted the two-word drag events "cannot be produced" because
	// `jsxEventName` does `name.slice(2).toLowerCase()`. Measured on a probe
	// through this very emitter: THEY ARE PRODUCED, as `@dragover`,
	// `@dragstart`, `@dragend` and `@pointerdown` - and `dragover` IS the real DOM
	// event name, so this lane is CORRECT BY ACCIDENT of the same casing loss that
	// makes react's `onDragover` inert. It costs this lane no type errors at all.
	// WHAT KEPT THEM OUT is the type baseline in the three JSX lanes - `pnpm
	// check` 267 -> 280, which this board's oracle forbids - so the axis was
	// RECORDED rather than shipped. Cards move with arrow buttons instead and the
	// page SAYS SO. See the fixture header.
	//
	// This page has NO FORM CONTROL AT ALL, so like S15 it contributes zero hosts
	// to worked example 12a's domain in src/gate/index.ts; that census is
	// re-argued rather than renumbered when this row lands.
	//
	// Like S10-S15 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S16.vue', 's16-task-board.json'],
	// THE EIGHTH APPLICATION IN THE CORPUS - CONTACTS - and THE FORMS CARD, the
	// FOURTH scenario all six lanes emit. THIRTEEN control kinds ship, every one
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
