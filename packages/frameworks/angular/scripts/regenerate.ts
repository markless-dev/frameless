import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');

await mkdir(resolve(root, 'generated'), { recursive: true });
const fixtures = [
	['S1.ts', 's1-render-once.json'],
	['S2.ts', 's2-keyed-todo.json'],
	['S3.ts', 's3-event-form.json'],
	['S4.ts', 's4-nested-list.json'],
	['S5.ts', 's5-branch-teardown.json'],
	['S6.ts', 's6-whitespace-text.json'],
	['S7.ts', 's7-form-controls.json'],
	['S8.ts', 's8-async-handlers.json'],
	['S9.ts', 's9-boolean-attributes.json'],
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
	['S10.ts', 's10-todomvc.json'],
	// S11 (TodoMVC ADVANCED) AND S12 (the CODEX CLONE) WERE THE ONLY TWO ROWS THIS
	// LANE EVER OMITTED, AND `frameless-app-fidelity-v1` T007 ADDED THEM.
	//
	// They were absent because the emitter refused them, verbatim and read off the
	// real modules rather than off a probe:
	//
	//   Angular emitter cannot resolve the identifier "Promise" in a transplanted
	//   body: it is neither a body-local binding, a function parameter, a @for
	//   variable, nor a declared component member (...). The emitter throws rather
	//   than guessing whether it is a global
	//
	// The refusal was NOT about async, and that correction is worth keeping.
	// `probes/async-door` PC reproduced it on a FULLY SYNCHRONOUS module: every
	// Identifier in a transplanted body had to resolve to lexical scope or a
	// declared component member, and the artificial delay both apps use - the
	// stand-in for a real remote that this goal's owner accepted - is `new Promise`
	// + `setTimeout`, which could not be NAMED in this lane at all.
	//
	// T003 RULED THE HOLE CLOSED WITH A TWO-NAME ALLOWLIST - `Promise` and
	// `setTimeout`, nothing else - and the deciding argument was this lane's OWN
	// recorded standard rather than a taxonomy of globals. Censused comment-stripped
	// across all 17 fixtures, the only globals in authored executable code are those
	// two, at ten call sites in S11 and S12 alone; `Date`, `JSON`, `Math`, `console`,
	// `fetch`, `localStorage` and `document` score ZERO and are still refused,
	// because an allowlist entry with no instance is the untested dead code this
	// emitter's own comment warns against. `Date` additionally stays banned on
	// DETERMINISM: it is a clock, and this repo proves by byte-equality. See
	// `TRANSPLANTED_GLOBALS` in src/emitter/index.ts.
	//
	// AND THE FIX WAS INVERTED FROM WHAT THE BOARD ASSUMED. The vue lane had a
	// permissive allowlist (upstream's `GLOBALS_ALLOWED`, which carries `Date` and
	// `JSON` but not these two) and SHIPPED A DEAD PAGE; this lane threw. Loud and
	// early won: vue gained THIS lane's fail-closed throw rather than the other way
	// round.
	['S11.ts', 's11-todomvc-advanced.json'],
	// A streamed answer is three unrolled chunks separated by an artificial delay,
	// and the only delay this authoring surface can express is `new Promise` +
	// `setTimeout` created inside the handler - `computed(async ...)` is closed in
	// all six lanes (frameless-app-suite-v1 T001). So S12 was unreachable here for
	// exactly as long as the two names were, and it is the scenario that proves the
	// ban was never about streaming: every SYNCHRONOUS axis of this app - thread
	// navigation, both tab pairs, the composer draft - was always inside this lane's
	// envelope.
	//
	// Like S10 and S11 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S12.ts', 's12-codex-clone.json'],
	['S13.ts', 's13-hn-front.json'],
	// S14 (the HACKER NEWS ITEM PAGE - the RECURSION scenario) IS THE FIFTH
	// APPLICATION THIS LANE SHIPS, AND IT ARRIVED HERE BY A ROUTE NO OTHER ROW ON
	// THIS LIST TOOK: THE EMITTER ALWAYS TOOK IT AND THE LANE'S OWN GATE USED TO
	// REFUSE THE RESULT.
	//
	// `emit()` has always succeeded. S14's `HnItem` names ITSELF in its own
	// template, and this emitter lowers a same-module component reference without
	// complaint - it is one of only FOUR lanes that do (react, solid, qwik,
	// angular; svelte and vue refuse it outright, because a `.svelte` file and a
	// `.vue` SFC each hold exactly one component). The emitted class is a
	// recursive standalone Angular component: `<frameless-hn-item>` inside its own
	// template, with `imports: [HnItem]` in the decorator.
	//
	// THAT `imports` ENTRY IS WHAT THE GATE USED TO REFUSE, verbatim:
	//
	//   Emitted Angular source uses the component-metadata form "imports", which
	//   is not in the baseline form inventory. IR-4 is DEFERRED, so this emitter's
	//   only discharge of the version corollary's second conjunct is an explicit
	//   allowlist with a recorded floor per entry; a new form has to be added to
	//   BASELINE_FORM_INVENTORY with a version floor and an honest floor-evidence
	//   status, and it may raise ANGULAR_BASELINE_FLOOR
	//
	// S14 IS THE FIRST SCENARIO IN THE CORPUS WITH A COMPONENT REFERENCE AT ALL,
	// so it was the first emitted module in this lane ever to print `imports`.
	// Admitting the form was NOT a code edit but a dossier ruling, and
	// frameless-app-axes-v1 T003 correctly stopped short of making it - the gate
	// source was outside that card's write scope by construction. T009 ruled ADMIT
	// at floor 14.0, evidence `unverified`, and T014 landed it.
	//
	// THE FEAR THAT DELAYED IT WAS FALSE TWICE OVER, and the correction is worth
	// keeping next to the row. T003 and the T009 card both recorded that admitting
	// `imports` "would move the DERIVED ANGULAR_BASELINE_FLOOR for every scenario
	// at once". MEASURED: the floor is a MAX reduce, `imports` floors at 14.0
	// BELOW the sole 19.0 entry, and there is NO PER-SCENARIO FLOOR IN THIS REPO
	// AT ALL - `ANGULAR_BASELINE_FLOOR` is one lane-wide constant. It reads 19.0
	// before the admission and 19.0 after. `ChangeDetectorRef` and `inject`
	// entered the same inventory the same way for S8 with the same non-effect.
	//
	// AND THE STATIC LAYERS CANNOT SEE WHAT THIS ROW SHIPS. `imports: [HnItem]` is
	// a SELF-entry, and @angular/compiler-cli@22.0.8 compiles the module
	// identically with and without it - 0 AOT diagnostics either way,
	// `dependencies: [HnItem]` in both arms - because
	// `StandaloneComponentScopeReader` seeds the component's own scope and then
	// skips a self-entry. The gate, `tsc` and AOT are all green AND ALL BLIND
	// here. The evidence that the recursion RENDERS is the chromium drive of
	// demos/angular-official at /hn-item, recorded in
	// docs/goals/frameless-app-axes-v1/notes/T014-angular-s14.md.
	//
	// Like S10-S13 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S14.ts', 's14-hn-item.json'],
	// THE SIXTH APPLICATION IN THE CORPUS - the HABIT TRACKER - and THE SIX-LANE
	// FAN-OUT SCENARIO. It takes the next ORDINAL slot for the reason every row
	// above records. IT IS THE SECOND SCENARIO IN THE CORPUS THAT ALL SIX LANES
	// EMIT, after S13, and the first that was built to be so ON PURPOSE: the
	// whole app is SYNCHRONOUS DERIVED STATE, so it named no global at all and no
	// component reference, and neither of the two emitter defects T003 isolated
	// could reach it. AT THE TIME THAT MATTERED FOR A REASON THAT NO LONGER
	// APPLIES - `Promise` and `setTimeout` were unnameable in this lane and blew a
	// hole in the vue lane's runtime, and `frameless-app-fidelity-v1` T007 closed
	// both with the two-name allowlist. What it does NOT change is the clock: its
	// date is a LITERAL STRING in the seeded data for exactly the reason S13's
	// relative ages are - `Date` IS STILL REFUSED, on determinism. Like S10-S14 it
	// stays OUT of the 6 x 9 three-way contract, which scripts/e2e.mjs pins to
	// the literal ['s1'..'s9'].
	['S15.ts', 's15-habit-tracker.json'],
	// THE SEVENTH APPLICATION IN THE CORPUS - the TASK BOARD - and THE DRAG CARD.
	// It takes the next ORDINAL slot for the reason every row above records, and
	// it is the THIRD scenario all six lanes emit, after S13 and S15 - and the
	// THIRD this lane ships alongside the other five.
	//
	// THE AXIS IT MEASURES IS NOT IN THE FILE, AND THAT IS THE MEASUREMENT. The
	// board predicted the two-word drag events "cannot be produced" because
	// `jsxEventName` does `name.slice(2).toLowerCase()`. Measured on a probe
	// through this very emitter: THEY ARE PRODUCED, as `(dragover)`,
	// `(dragstart)`, `(dragend)` and `(pointerdown)` bound to generated
	// `onH1Dragover($event)` members - and `dragover` IS the real DOM event name,
	// so this lane is CORRECT BY ACCIDENT of the same casing loss that makes
	// react's `onDragover` inert. It costs this lane no type errors at all.
	// WHAT KEPT THEM OUT is the type baseline in the three JSX lanes - `pnpm
	// check` 267 -> 280, which this board's oracle forbids. Cards move with arrow
	// buttons instead and the page SAYS SO. See the fixture header.
	//
	// THIS LANE SURVIVES S16 FOR THE SAME REASON IT SURVIVES S15: the fixture
	// NAMES NO GLOBAL. That is not luck - the natural spelling of "move one column
	// to the right" is `columns.indexOf(...)` clamped with `Math.min`, and `Math`
	// is a global this emitter cannot resolve in a transplanted body, so each
	// column CARRIES its own `prevId`/`nextId` in the seed instead. See the
	// fixture's constraint (10). There is no component reference either, so this
	// module never prints the `imports` form S14 introduced.
	//
	// Like S10-S15 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S16.ts', 's16-task-board.json'],
	// THE EIGHTH APPLICATION IN THE CORPUS - CONTACTS - and THE FORMS CARD, the
	// FOURTH scenario all six lanes emit. THIRTEEN control kinds ship, every one
	// bound and every one observable in a live preview card.
	//
	// THIS LANE ALMOST LOST THE CARD, AND NOT ON THE AXIS. The first spelling of
	// the fixture used TEMPLATE LITERALS inside template expressions - a company
	// link `href`, a per-status avatar class, a joined first/last name and the tag
	// checkboxes' `id`/`for` pair - and this emitter refused it, verbatim:
	//   "Angular emitter refuses the template expression \"`#/company/${row.id}`\":
	//    a backtick, a ${ or a backslash would terminate or interpolate the
	//    TypeScript template literal the inline template lives in"
	// The other five lanes took every one of them. The narrowing is the same one
	// constraint (10) makes for globals: the strings are SEEDED FIELDS on the
	// rows (`href`, `avatarClass`, `full`, `initial`, `domId`, `controlId`) or
	// `computed` getters, both of which live in the CLASS rather than in the
	// inline template. A template literal in a computed body or a handler body is
	// fine here; only the template is closed.
	//
	// AND THE CONSTRAINT THIS LANE IS FAMOUS FOR HELD WITHOUT COSTING THE AXIS: a
	// `date` input is not a clock. `since` and `slot` are LITERAL seeded strings,
	// so `Date` is never named and this lane is not lost for a reason unrelated to
	// forms. See the fixture's constraint (10).
	//
	// Like S10-S16 it stays OUT of the 6 x 9 three-way contract.
	['S17.ts', 's17-contacts.json'],
] as const;
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), formatEmitted(emit(ir)));
}
