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
	// S11 (TodoMVC ADVANCED) IS DELIBERATELY ABSENT FROM THIS LIST, AND IT IS THE
	// ONLY LANE THAT OMITS IT. The angular emitter REFUSES the eleventh scenario,
	// verbatim and read off the real module rather than off a probe:
	//
	//   Angular emitter cannot resolve the identifier "Promise" in a transplanted
	//   body: it is neither a body-local binding, a function parameter, a @for
	//   variable, nor a declared component member (...). The emitter throws rather
	//   than guessing whether it is a global
	//
	// The refusal is NOT about async. `probes/async-door` PC reproduces it on a
	// FULLY SYNCHRONOUS module: every Identifier in a transplanted body must
	// resolve to lexical scope or a declared component member, and `Promise`,
	// `setTimeout`, `fetch`, `Date` and `JSON` are all globals. S11's artificial
	// delay - the stand-in for a real remote that this goal's owner accepted - is
	// `new Promise` + `setTimeout`, so it cannot be NAMED in this lane at all.
	//
	// Adding the row would not produce output; it would make this script THROW.
	// The lane is left UNBUILT WITH A RECORDED REFUSAL, which this board's oracle
	// names as a legitimate outcome, and `ANGULAR_UNBUILT_SCENARIOS` in
	// test/emitter.test.ts carries the same subtraction so the omission is
	// asserted rather than merely true.
	//
	// S12 (the CODEX CLONE) IS ABSENT FOR THE SAME REASON, AND THE MESSAGE WAS
	// READ OFF THE REAL S12 MODULE RATHER THAN ASSUMED FROM S11's. Attempted here,
	// once, by adding the row and running this script; it threw with S12's OWN
	// declared-member list, which is what proves the refusal was measured on this
	// module and not inherited:
	//
	//   Angular emitter cannot resolve the identifier "Promise" in a transplanted
	//   body: it is neither a body-local binding, a function parameter, a @for
	//   variable, nor a declared component member (blocked, bottomTab, draft,
	//   messages, nextMessage, nextThread, onTrace, openThread, openTitle,
	//   rightTab, status, streaming, threads, turns, turnsLabel, visible,
	//   visibleLabel). The emitter throws rather than guessing whether it is a
	//   global
	//
	// A streamed answer is three unrolled chunks separated by an artificial delay,
	// and the only delay this authoring surface can express is `new Promise` +
	// `setTimeout` created inside the handler - `computed(async ...)` is closed in
	// all six lanes (frameless-app-suite-v1 T001), and this lane additionally
	// cannot NAME the globals a delay is made of. THE ANGULAR LANE THEREFORE
	// CANNOT HOLD A STREAMING APP AT ALL, on a limit that is not about streaming.
	// It IS built for everything else in the corpus, including S10, so this is a
	// recorded lane limit and not a missing lane.
	['S13.ts', 's13-hn-front.json'],
	// S14 (the HACKER NEWS ITEM PAGE - the RECURSION scenario) IS ABSENT FOR A
	// REASON THAT IS NEW TO THIS LANE AND TO THIS REPO: THE EMITTER TAKES IT AND
	// THE LANE'S OWN GATE REFUSES THE RESULT.
	//
	// `emit()` succeeds. S14's `HnItem` names ITSELF in its own template, and this
	// emitter lowers a same-module component reference without complaint - it is
	// one of only FOUR lanes that do (react, solid, qwik, angular; svelte and vue
	// refuse it outright). The emitted class is a correct recursive Angular
	// component, `<frameless-hn-item>` inside its own template, with
	// `imports: [HnItem]` in the decorator so the selector resolves.
	//
	// THAT `imports` ENTRY IS WHAT THE GATE REFUSES, verbatim:
	//
	//   Emitted Angular source uses the component-metadata form "imports", which
	//   is not in the baseline form inventory. IR-4 is DEFERRED, so this emitter's
	//   only discharge of the version corollary's second conjunct is an explicit
	//   allowlist with a recorded floor per entry; a new form has to be added to
	//   BASELINE_FORM_INVENTORY with a version floor and an honest floor-evidence
	//   status, and it may raise ANGULAR_BASELINE_FLOOR
	//
	// S14 IS THE FIRST SCENARIO IN THE CORPUS WITH A COMPONENT REFERENCE AT ALL,
	// so it is the first emitted module in this lane ever to print `imports`, and
	// `BASELINE_FORM_INVENTORY` in ../src/gate/index.ts has thirteen entries and
	// no component-metadata `imports` among them. Admitting it is not a code edit:
	// it needs a version FLOOR and a floor-EVIDENCE status, and `imports` on
	// `@Component` arrives with standalone components at Angular 14/15, which is
	// ABOVE several inventory entries and would move the DERIVED
	// `ANGULAR_BASELINE_FLOOR`. That is a dossier ruling, and
	// frameless-app-axes-v1 T003 did not have the authority to make it - the gate
	// source is outside that card's write scope by construction.
	//
	// So the lane is left UNBUILT WITH A RECORDED REFUSAL, and the refusal is
	// recorded ON THE RIGHT LAYER: `ANGULAR_UNGATED_SCENARIOS` in
	// test/ungated-scenarios.ts asserts that `emit()` SUCCEEDS and that the gate
	// then reports exactly this diagnostic - which is a strictly stronger claim
	// than the S11/S12 rows next to it, where the emitter itself throws.
] as const;
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), formatEmitted(emit(ir)));
}
