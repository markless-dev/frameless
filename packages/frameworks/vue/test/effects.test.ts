import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { version } from '@vue/compiler-sfc';
import { describe, expect, test } from 'vitest';
import { COMPILE_MODES, compileDiagnostics, emit, validateEnrichedIr } from '../src/emitter/index.ts';

/**
 * STEP 4, EFFECTS (`attach=`) - the Vue half.
 *
 * WHAT THIS LANE'S OWN CHECKER CAN AND CANNOT SEE, and this file inherits the
 * warning T005 paid for. `compileDiagnostics` runs `@vue/compiler-sfc` parse +
 * `compileScript` + `compileTemplate` across `ssr x isProd` and requires an EXACT
 * EMPTY set of errors AND tips. It is a COMPILER, NOT A TYPE CHECKER: the first
 * ref lowering written at Step 3 passed it exact-empty in all four modes and was
 * then rejected outright by `demos/vue-official`'s own `vue-tsc`. So the
 * `vue-tsc` arm for THIS step was also run out of band and is recorded in
 * `docs/goals/frameless-emitter-capability-v1/notes/T006-effects.md`.
 *
 * THE SANCTIONED SET FOR THIS CONSTRUCT, and why there are no six gates to run.
 * `attach=` needs a node reference, a mount-time install with a cleanup, and a
 * re-run keyed on a declared input. The emitted form is `onMounted` +
 * `onUnmounted` + `watch(sources, cb, { flush: 'post' })` over the template ref
 * Step 3 already ruled. The two alternatives are outside the set rather than
 * losing a tie: a custom directive's `updated` hook fires on every component
 * update rather than on a declared input change, and a function ref is
 * re-invoked on re-render, so an unrelated re-render would tear the behavior
 * down and reinstall it. Every API emitted here floors at 3.0, so this lane's
 * standing discharge of the version corollary is unchanged.
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

const WITH_HANDLE = `import { element, state } from "@markless/core";
export function Page() @{
	const input = element<HTMLInputElement>();
	let value = state("a");
	<div data-scenario="attach"><input el={input} attach={(node) => { node.dataset.value = value; return () => { delete node.dataset.value; }; }} /><button data-action="focus" onClick={() => input?.focus()}>focus</button></div>
}`;

function clone(value: EnrichedIR): any {
	return structuredClone(value);
}

describe('Vue attach behaviors', () => {
	test('lowers to a template ref plus onMounted/onUnmounted, body transplanted verbatim', async () => {
		const source = emit(await ir(TRACKED));
		expect(source).toContain('const attachHost = ref();');
		expect(source).toContain('ref="attachHost"');
		expect(source).toContain('onMounted(installAttachHost);');
		expect(source).toContain('onUnmounted(disposeAttachHost);');
		expect(source).toContain("import { onMounted, onUnmounted, ref, watch } from 'vue';");
		// The authored body is TRANSPLANTED, not rewritten.
		expect(source).toContain('node.dataset.value = value;');
		expect(source).toContain('delete node.dataset.value;');
		expect(source).not.toContain('attach=');
		expect(source).toContain("if (typeof cleanup === 'function')");
	});

	/**
	 * THE PARAMETER CAPTURE IS THE WHOLE POINT IN THIS LANE, because Vue is the one
	 * that would silently get it wrong. `disposeAttachHost()` runs AFTER the ref has
	 * changed, so a cleanup body qualified to `value.value` would read the NEW value
	 * and diverge from the shipped React and Solid lanes. The appended parameter
	 * shadows the ref, and `rewriteScript` - which is scope-aware - therefore does
	 * NOT respell it.
	 */
	test('captures the declared input as a PARAMETER, so the body never re-reads the ref', async () => {
		const source = emit(await ir(TRACKED));
		expect(source).toContain('const behavior = (node, value) => {');
		expect(source).toContain('cleanup = behavior(attachHost.value, value.value);');
		// Inside the transplanted body there is no `.value` at all: the parameter is
		// the raw value, not the ref.
		const body = source.slice(
			source.indexOf('const behavior = '),
			source.indexOf('let cleanup;'),
		);
		expect(body).not.toContain('value.value');
	});

	test('re-runs on a declared input change, disposing first, with flush post', async () => {
		const source = emit(await ir(TRACKED));
		expect(source).toContain('watch([() => value.value], () => {');
		const watcher = source.slice(source.indexOf('watch(['));
		expect(watcher.indexOf('disposeAttachHost();')).toBeLessThan(
			watcher.indexOf('installAttachHost();'),
		);
		expect(source).toContain("{ flush: 'post' }");
	});

	test('a behavior with no inputs gets no watch, and no cleanup gets no dispose', async () => {
		const source = emit(await ir(ZERO_INPUT));
		expect(source).toContain('const behavior = (node) => {');
		expect(source).toContain('behavior(attachHost.value);');
		expect(source).not.toContain('watch(');
		// No behavior returns a cleanup, so there is nothing to dispose and no empty
		// lifecycle hook is emitted.
		expect(source).not.toContain('onUnmounted');
		expect(source).not.toContain('dispose');
		expect(source).toContain("import { onMounted, ref } from 'vue';");
	});

	test('SHARES the element handle ref when the host already carries one', async () => {
		const source = emit(await ir(WITH_HANDLE));
		expect(source).toContain('ref="input"');
		expect(source).not.toContain('ref="attachHost"');
		expect(source).not.toContain('const attachHost = ref();');
		expect(source).toContain('cleanup = behavior(input.value, value.value);');
		// Exactly one `ref=` attribute on the host: two would not be a Vue form.
		expect(source.match(/ref="/g)).toHaveLength(1);
	});

	test("the lane's own compiler reports an exact-empty diagnostic set, and is calibrated", async () => {
		const source = emit(await ir(TRACKED));
		expect(compileDiagnostics(source, 'Page.vue')).toEqual([]);
		// CALIBRATION. An exact-empty set from an instrument nobody has watched report
		// is not a measurement.
		expect(compileDiagnostics(source.replace('{{ value }}', '{{ value }'), 'Page.vue')).not.toEqual(
			[],
		);
		expect(version).toBe('3.5.40');
		expect(COMPILE_MODES).toHaveLength(4);
	});

	test('preserves authored install order and emits REVERSE cleanup order', async () => {
		const value = clone(await ir(TRACKED));
		const second = structuredClone(value.records.behaviors[0]);
		second.id = 'behavior:1';
		second.order = 1;
		value.records.behaviors = [value.records.behaviors[0], second];
		const source = emit(value);
		const install = source.slice(source.indexOf('const installAttachHost'));
		const installed = [...install.matchAll(/(\w+) = behavior\d*\(/g)].map((match) => match[1]!);
		expect(installed).toHaveLength(2);
		const dispose = source.slice(source.indexOf('const disposeAttachHost'));
		// The teardown order is read as a SEQUENCE of names rather than by comparing
		// two `indexOf` results: `cleanup` is a prefix of `cleanup1`, so an index
		// comparison would have matched the wrong occurrence and passed by accident.
		const torn = [...dispose.matchAll(/typeof (\w+) === 'function'/g)].map(
			(match) => match[1]!,
		);
		expect(torn).toEqual([...installed].reverse());
	});

	test('refuses a behavior input the lowering cannot capture, by name', async () => {
		const path = clone(await ir(TRACKED));
		path.records.behaviors[0].inputs[0].path = ['nested'];
		expect(() => emit(path)).toThrow(
			/no lowering for a behavior input with a member path \(behavior:0: state:value\.nested\)/,
		);

		const via = clone(await ir(TRACKED));
		via.records.behaviors[0].inputs[0].via = 'alias';
		expect(() => emit(via)).toThrow(/no lowering for a alias behavior input/);

		const dangling = clone(await ir(TRACKED));
		dangling.records.behaviors[0].inputs[0].graphNodeId = 'state:nope';
		expect(() => emit(dangling)).toThrow(/BehaviorRecord input has no binding: state:nope/);
	});

	test('refuses a behavior whose host this component does not render', async () => {
		const value = clone(await ir(TRACKED));
		value.records.behaviors[0].hostNodeId = 'h99';
		expect(() => emit(value)).toThrow(/names a host this component does not render: h99/);
	});

	/**
	 * THE T003/T010 DEFECT CLASS AT THE RECORD THIS STEP MADE LIVE. See the Svelte
	 * twin for the finding this row's existence rests on: at `BehaviorRecord` the
	 * split was ONE versus five, not the two versus four the board carried.
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

		const lawful = clone(await ir(TRACKED));
		expect(() => validateEnrichedIr(lawful)).not.toThrow();
	});
});
