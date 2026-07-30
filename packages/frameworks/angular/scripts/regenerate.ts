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
] as const;
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), formatEmitted(emit(ir)));
}
