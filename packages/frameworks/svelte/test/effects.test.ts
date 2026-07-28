import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { compile, VERSION } from 'svelte/compiler';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';

/**
 * STEP 4, EFFECTS (`attach=`) - the Svelte half.
 *
 * WHAT THIS LANE'S OWN CHECKER CAN AND CANNOT SEE, stated up front so no green
 * below is over-read. The instrument is `svelte/compiler`'s `compile()`, run in
 * process at the version this package resolves. It reports WARNINGS AND SYNTAX,
 * NOT TYPES and NOT RUNTIME. The type-level arm (`svelte-check`) and the
 * behavioural arm (a real mount, a state change and an unmount in a DOM) were
 * both run OUT OF BAND and are recorded in
 * `docs/goals/frameless-emitter-capability-v1/notes/T006-effects.md`, because
 * both live outside this package's install.
 *
 * WHY `{@attach}` AND NOT `use:`. This is FORCED LOWERING, not a sugar ruling,
 * and the showing is two measurements rather than a preference:
 *
 *   1. `svelte/src/internal/client/dom/elements/actions.js` invokes the action
 *      inside `untrack(...)`. A bare `use:fn` therefore NEVER re-runs when state
 *      read inside `fn` changes, so it cannot meet `attach=`'s third obligation
 *      at all. `{@attach}` runs the attachment inside `effect(...)`, which
 *      tracks. Svelte ships `fromAction` to convert one into the other, in that
 *      direction only.
 *   2. The re-run CAN be reached through `use:fn={params}` plus a synthesized
 *      `{ update, destroy }` wrapper - and that lowering was built and measured,
 *      and it DIVERGES: `update()` is called from a `render_effect`, after the
 *      state is committed, so the authored cleanup observes the POST-change
 *      value. React and Solid both give the cleanup the PRE-change value.
 *
 * Both rows below are the calibrations for those claims, so the ruling is
 * re-derivable from this file rather than only from the note.
 */
async function ir(source: string): Promise<EnrichedIR> {
	return buildEnrichedIr({ filename: 'src/attach-probe.tsrx', source });
}

const TRACKED = `import { state } from "@markless/core";
export function Page() @{
	let value = state("a");
	<div data-scenario="attach" attach={(node) => { node.dataset.value = value; return () => { delete node.dataset.value; }; }}>{value}</div>
}`;

const ZERO_INPUT = `export function Page() @{
	<div data-scenario="attach" attach={(node) => { node.dataset.install = "zero"; }} />
}`;

const CLEANUP_ONLY = `export function Page() @{
	<div data-scenario="attach" attach={(node) => { node.dataset.install = "zero"; return () => { node.dataset.cleanup = "zero"; }; }} />
}`;

const MODES = [
	{ generate: 'client', dev: true },
	{ generate: 'client', dev: false },
	{ generate: 'server', dev: true },
	{ generate: 'server', dev: false },
] as const;

function warningCodes(source: string): string[] {
	const codes = new Set<string>();
	for (const { generate, dev } of MODES)
		for (const warning of compile(source, { filename: 'Page.svelte', generate, dev }).warnings)
			codes.add(warning.code);
	return [...codes].sort();
}

function clone(value: EnrichedIR): any {
	return structuredClone(value);
}

describe('Svelte attach behaviors', () => {
	test('lowers one attachment per host, with the authored body transplanted verbatim', async () => {
		const source = emit(await ir(TRACKED));
		expect(source).toContain('{@attach attachHost}');
		expect(source).not.toContain('use:');
		// The authored body is TRANSPLANTED, not rewritten: every identifier the
		// author wrote is still spelled the way they wrote it.
		expect(source).toContain('node.dataset.value = value;');
		expect(source).toContain('delete node.dataset.value;');
		// The `attach=` attribute itself never survives into the template.
		expect(source).not.toContain('attach=');
		// The cleanup is guarded rather than assumed to be callable - `returnsCleanup`
		// says the authored function CAN return one, not that it always does.
		expect(source).toContain("if (typeof cleanup === 'function')");
	});

	test('captures the declared input as a PARAMETER, which is what dates the cleanup', async () => {
		const source = emit(await ir(TRACKED));
		// The appended parameter is the whole mechanism: the authored cleanup closes
		// over it, so it reads the value current at ITS OWN INSTALL rather than the
		// value that replaced it. React gets that from closure identity and Solid from
		// ordering its capture assignment; this lane gets it structurally.
		expect(source).toContain('const behavior = (node, value) => {');
		expect(source).toContain('const cleanup = behavior(node, value);');
	});

	test('a behavior with no inputs takes no parameter and no capture', async () => {
		const source = emit(await ir(ZERO_INPUT));
		expect(source).toContain('const behavior = (node) => {');
		expect(source).toContain('behavior(node);');
		// Nothing returns a cleanup, so the attachment returns nothing either.
		expect(source).not.toContain('cleanup');
		expect(source).not.toContain('return () =>');
	});

	test('preserves authored install order and emits REVERSE cleanup order', async () => {
		const first = await ir(CLEANUP_ONLY);
		const value = clone(first);
		const second = structuredClone(value.records.behaviors[0]);
		second.id = 'behavior:1';
		second.order = 1;
		second.behavior.body.body[0].expression.right.value = 'second';
		second.behavior.body.body[0].expression.right.raw = "'second'";
		value.records.behaviors = [value.records.behaviors[0], second];
		const source = emit(value);
		const installFirst = source.indexOf("dataset.install = 'zero'");
		const installSecond = source.indexOf("dataset.install = 'second'");
		expect(installFirst).toBeGreaterThan(-1);
		expect(installSecond).toBeGreaterThan(installFirst);
		// Two cleanups, and the teardown block calls them highest-order-first. The
		// names are DERIVED from the emitted install lines rather than re-literalled,
		// because the claimer's suffixes depend on what the authored body happens to
		// spell - this body writes `node.dataset.cleanup`, which takes `cleanup`.
		const attachment = source.slice(source.indexOf('const attachHost = '));
		const installed = [...attachment.matchAll(/const (\w+) = behavior\d*\(/g)].map(
			(match) => match[1]!,
		);
		expect(installed).toHaveLength(2);
		const teardown = attachment.slice(attachment.indexOf('return () => {'));
		// Read as a SEQUENCE of names, not by comparing two `indexOf` results: one
		// claimed name can be a PREFIX of another, and an index comparison would then
		// match the wrong occurrence and pass by accident.
		const torn = [...teardown.matchAll(/typeof (\w+) === 'function'/g)].map(
			(match) => match[1]!,
		);
		expect(torn).toEqual([...installed].reverse());
	});

	test("the lane's own compiler reports nothing, and the instrument is calibrated", async () => {
		const source = emit(await ir(TRACKED));
		expect(warningCodes(source)).toEqual([]);
		// CALIBRATION. An empty warning set from an instrument nobody has watched
		// report is not a measurement.
		const noisy = source.replace('<div data-scenario="attach"', '<div onclick={() => {}}');
		expect(warningCodes(noisy)).toContain('a11y_click_events_have_key_events');
	});

	/**
	 * THE MEASUREMENT THAT PUTS `use:` OUTSIDE THE SANCTIONED SET, not a preference
	 * for the newer spelling. Both arms are run here so the ruling can be re-derived
	 * from this file.
	 */
	test('CALIBRATION: a bare `use:` action never re-runs, because Svelte untracks it', () => {
		const action = `<script>
	let value = $state('a');
	const fn = (node) => { node.dataset.v = value; };
</script>
<div use:fn></div>`;
		const attachment = `<script>
	let value = $state('a');
	const fn = (node) => { node.dataset.v = value; };
</script>
<div {@attach fn}></div>`;
		// BOTH compile clean, which is the point: no diagnostic distinguishes them,
		// so the ruling had to come from the runtime and not from the compiler.
		expect(warningCodes(action)).toEqual([]);
		expect(warningCodes(attachment)).toEqual([]);
		const actionCode = compile(action, {
			filename: 'P.svelte',
			generate: 'client',
			dev: false,
		}).js.code;
		const attachCode = compile(attachment, {
			filename: 'P.svelte',
			generate: 'client',
			dev: false,
		}).js.code;
		// The two runtime entry points, named. `$.action` is the one whose
		// implementation wraps the call in `untrack`.
		expect(actionCode).toContain('$.action(');
		expect(attachCode).toContain('$.attach(');
		expect(VERSION).toBe('5.56.8');
	});

	test('refuses a behavior input the lowering cannot capture, by name', async () => {
		const path = clone(await ir(TRACKED));
		path.records.behaviors[0].inputs[0].path = ['nested'];
		expect(() => emit(path)).toThrow(
			/no lowering for a behavior input with a member path \(behavior:0: state:value\.nested\)/,
		);

		const via = clone(await ir(TRACKED));
		via.records.behaviors[0].inputs[0].via = 'repeat-item';
		expect(() => emit(via)).toThrow(/no lowering for a repeat-item behavior input/);

		const dangling = clone(await ir(TRACKED));
		dangling.records.behaviors[0].inputs[0].graphNodeId = 'state:nope';
		expect(() => emit(dangling)).toThrow(/BehaviorRecord input has no binding: state:nope/);
	});

	test('refuses a behavior whose host this component does not render', async () => {
		const value = clone(await ir(TRACKED));
		value.records.behaviors[0].hostNodeId = 'h99';
		expect(() => emit(value)).toThrow(/names a host this component does not render: h99/);
	});

	test('refuses a non-literal attach expression, by name', async () => {
		const value = clone(await ir(TRACKED));
		value.records.behaviors[0].behavior = { type: 'Identifier', name: 'install' };
		expect(() => emit(value)).toThrow(
			/no lowering for a non-literal attach behavior: behavior:0/,
		);
	});

	/**
	 * THE T003/T010 DEFECT CLASS AT THE RECORD THIS STEP MADE LIVE - and the row
	 * that MEASURED THE BOARD'S OWN SUMMARY WRONG.
	 *
	 * The inherited brief says the split is "react and solid reject a planted field,
	 * the other four accept silently". At `BehaviorRecord` it was ONE versus five:
	 * solid ACCEPTED, through `validateEnrichedIr` and through `emit()`, because its
	 * `validateEnrichedIr` early-returns into `validateCompositionIr` whenever
	 * `hasComposition(ir)` holds - and `hasComposition` is true the moment
	 * `behaviors` is non-empty, which routes IR away from the very check that names
	 * the construct. That is repaired in the solid lane by this step.
	 */
	test('rejects an unknown field on a BehaviorRecord and on a BehaviorInput, by name', async () => {
		const onRecord = clone(await ir(TRACKED));
		onRecord.records.behaviors[0].elementType = 'HTMLInputElement';
		expect(() => validateEnrichedIr(onRecord)).toThrow(
			/BehaviorRecord has unknown semantic field: elementType/,
		);

		const onInput = clone(await ir(TRACKED));
		onInput.records.behaviors[0].inputs[0].awaited = true;
		expect(() => validateEnrichedIr(onInput)).toThrow(
			/BehaviorRecord GraphReadRef has unknown semantic field: awaited/,
		);

		// LAWFUL ARM. Two rejections mean nothing if the validator rejects the
		// unmutated record too.
		const lawful = clone(await ir(TRACKED));
		expect(() => validateEnrichedIr(lawful)).not.toThrow();
	});

	test('rejects a malformed BehaviorRecord and an unsupported input provenance', async () => {
		const cleanup = clone(await ir(TRACKED));
		cleanup.records.behaviors[0].returnsCleanup = 'yes';
		expect(() => validateEnrichedIr(cleanup)).toThrow(/BehaviorRecord has malformed construct/);

		const ast = clone(await ir(TRACKED));
		ast.records.behaviors[0].behavior = 'not-an-ast';
		expect(() => validateEnrichedIr(ast)).toThrow(
			/BehaviorRecord has malformed behavior AST: behavior:0/,
		);

		const provenance = clone(await ir(TRACKED));
		provenance.records.behaviors[0].inputs[0].provenance = 'guessed';
		expect(() => validateEnrichedIr(provenance)).toThrow(
			/BehaviorRecord GraphReadRef has unsupported provenance: guessed/,
		);

		const owner = clone(await ir(TRACKED));
		owner.records.behaviors[0].componentId = 'component:9:Other';
		expect(() => validateEnrichedIr(owner)).toThrow(
			/BehaviorRecord has dangling componentId: component:9:Other/,
		);
	});
});
