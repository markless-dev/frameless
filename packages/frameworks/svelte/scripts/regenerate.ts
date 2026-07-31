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
	// It is the first corpus scenario that does NOT emit in all six lanes - the
	// angular emitter refuses it on its global-identifier ban, recorded verbatim
	// in that lane's regenerate.ts - and, like S10, it stays out of the 6 x 9
	// three-way contract, which scripts/e2e.mjs pins to the literal ['s1'..'s9'].
	['S11.svelte', 's11-todomvc-advanced.json'],
	// THE THIRD APPLICATION IN THE CORPUS - the CODEX CLONE - and it takes the next
	// ORDINAL slot for exactly the reason the two rows above record: the suites
	// derive their inventory from /^s(\d+)-[\w-]+\.json$/ and assert it EXACTLY.
	// Like S10 and S11 it stays OUT of the 6 x 9 three-way contract, which
	// scripts/e2e.mjs pins to the literal ['s1'..'s9']. It is the SECOND scenario
	// the angular emitter refuses, on the same global-identifier ban recorded in
	// that lane's regenerate.ts: its streamed answer separates three unrolled
	// chunks with `new Promise` + `setTimeout`.
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
] as const;
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), formatEmitted(emit(ir)));
}
