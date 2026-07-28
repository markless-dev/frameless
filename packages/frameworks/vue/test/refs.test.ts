import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { compileScript, compileTemplate, parse, version } from '@vue/compiler-sfc';
import { describe, expect, test } from 'vitest';
import { COMPILE_MODES, compileDiagnostics, emit, validateEnrichedIr } from '../src/emitter/index.ts';

/**
 * STEP 3, REFS - the Vue half.
 *
 * WHAT THIS LANE'S OWN CHECKER CAN AND CANNOT SEE, stated up front, because this
 * step MEASURED the gap rather than inferring it. `compileDiagnostics` runs
 * `@vue/compiler-sfc` parse + `compileScript` + `compileTemplate` across
 * `ssr x isProd` and requires an EXACT EMPTY set of errors AND tips. It is a
 * COMPILER, not a TYPE CHECKER: the first ref lowering this step wrote emitted
 * `ref(null)`, which `compileDiagnostics` passed exact-empty in all four modes and
 * which `demos/vue-official`'s own `vue-tsc` rejected outright -
 * `TS2339: Property 'focus' does not exist on type 'never'`, because `ref(null)`
 * infers `Ref<null>`. The emitted form below is the CORRECTED one and the
 * `vue-tsc` arm is recorded in
 * `docs/goals/frameless-emitter-capability-v1/notes/T005-refs.md`, out of band,
 * because `vue-tsc` lives in the demo's install and not in this package.
 */
async function ir(source: string): Promise<EnrichedIR> {
	return buildEnrichedIr({ filename: 'src/ref-probe.tsrx', source });
}

const REF_SOURCE = `import { element } from "@markless/core";
export function Search() @{
	const input = element<HTMLInputElement>();
	<div data-scenario="ref"><input el={input} data-action="target" /><button data-action="focus" onClick={() => input?.focus()}>focus</button></div>
}`;

function clone(value: EnrichedIR): any {
	return structuredClone(value);
}

describe('Vue element handles', () => {
	test('binds the handle with a string template ref and prints the authored call verbatim', async () => {
		const source = emit(await ir(REF_SOURCE));
		expect(source).toContain('ref="input"');
		// `ref()`, NOT `ref(null)` - see the header - and NOT `useTemplateRef`, which
		// floors at 3.5 while every form in this lane's BASELINE_FORM_INVENTORY floors
		// at 3.0/3.2.
		expect(source).toContain('const input = ref();');
		expect(source).not.toContain('ref(null)');
		expect(source).not.toContain('useTemplateRef');
		// The authored `element<T>()` call is GONE.
		expect(source).not.toContain('element(');
		expect(source).not.toContain('element<');
		// TEMPLATE EXPRESSIONS ARE EMITTED VERBATIM and Vue unwraps setup refs there
		// itself, so the handle read needs no `.value` - which is exactly why
		// `ScriptRewrite` is script-scoped.
		expect(source).toContain('@click="() => input?.focus()"');
		expect(source).not.toContain('input.value');
	});

	test("the lane's own compiler reports an exact-empty diagnostic set, and is calibrated", async () => {
		const source = emit(await ir(REF_SOURCE));
		expect(compileDiagnostics(source, 'Search.vue')).toEqual([]);
		// CALIBRATION. An exact-empty set from an instrument nobody has watched report
		// is not a measurement.
		expect(
			compileDiagnostics(source.replace('@click="() =>', '@click="() =>>'), 'Search.vue'),
		).not.toEqual([]);
	});

	/**
	 * WHY THE STRING FORM AND NOT `:ref="(el) => (input = el)"`, MEASURED ON THE
	 * COMPILER'S OWN OUTPUT.
	 *
	 * Both are sanctioned at 3.5.40 and both floor at 3.0, so the tie breaks on the
	 * mechanism the compiler itself supplies: with `<script setup>` and a setup
	 * binding of the same name, the STRING form is rewritten into a `ref_key`/`ref`
	 * pair in inline mode - dedicated `<script setup>` machinery that exists BECAUSE
	 * this is the form - and resolved against `setupState` in non-inline mode. The
	 * function form asks Vue to run an assignment it does not need to run.
	 */
	test('the string ref is compiled through the ref_key path the compiler reserves for it', async () => {
		const source = emit(await ir(REF_SOURCE));
		const { descriptor, errors } = parse(source, { filename: 'Search.vue' });
		expect(errors).toEqual([]);
		const bindings = compileScript(descriptor, {
			id: 'Search.vue',
			inlineTemplate: false,
		}).bindings;
		// The setup binding the string is resolved against.
		expect(bindings?.input).toBe('setup-ref');
		const nonInline = compileTemplate({
			source: descriptor.template!.content,
			filename: 'Search.vue',
			id: 'Search.vue',
			ssr: false,
			ssrCssVars: [],
			compilerOptions: { bindingMetadata: bindings, inline: false },
		});
		expect(nonInline.errors).toEqual([]);
		expect(nonInline.code).toContain('ref: "input"');
		const inline = compileTemplate({
			source: descriptor.template!.content,
			filename: 'Search.vue',
			id: 'Search.vue',
			ssr: false,
			ssrCssVars: [],
			compilerOptions: { bindingMetadata: bindings, inline: true },
		});
		expect(inline.errors).toEqual([]);
		expect(inline.code).toContain('ref_key: "input"');
		// The measurement is only about the build this repo ships.
		expect(version).toBe('3.5.40');
		expect(COMPILE_MODES).toHaveLength(4);
	});

	test('refuses a handle call the handler AST does not spell', async () => {
		const value = clone(await ir(REF_SOURCE));
		value.records.handleCalls[0].method = 'blur';
		expect(() => emit(value)).toThrow(
			/declares a handle call input\.blur\(\) its handler AST does not spell/,
		);
	});

	test('refuses a handle call outside an event handler', async () => {
		const value = clone(await ir(REF_SOURCE));
		delete value.records.handleCalls[0].eventId;
		expect(() => emit(value)).toThrow(
			/no lowering for a handle call outside an event handler \(input\.focus\)/,
		);
	});

	test('refuses a handle whose host this component does not render', async () => {
		const value = clone(await ir(REF_SOURCE));
		value.records.elementHandleBindings[0].hostNodeId = 'h99';
		expect(() => emit(value)).toThrow(/names a host this component does not render: h99/);
	});

	test('refuses two handles on one host, and a non-identifier handle name', async () => {
		const twoOnOne = clone(await ir(REF_SOURCE));
		twoOnOne.records.elementHandleBindings.push({
			...twoOnOne.records.elementHandleBindings[0],
			id: 'element-handle:h1:other',
			handleName: 'other',
		});
		expect(() => emit(twoOnOne)).toThrow(/cannot bind two element handles to one host/);

		const dotted = clone(await ir(REF_SOURCE));
		dotted.records.elementHandleBindings[0].handleName = 'row.input';
		expect(() => emit(dotted)).toThrow(/cannot bind an element handle named "row.input"/);
	});

	// STEP 4 OPENED `behaviors` IN THIS LANE, so the second half of this row -
	// which required `emit` to throw `does not support element attach behaviors` -
	// is gone rather than weakened, and the construct is covered by
	// `test/effects.test.ts`. `handleForwards` is still Step 5's and still refused.
	test('still refuses handle forwarding, by name', async () => {
		const forwarded = clone(await ir(REF_SOURCE));
		forwarded.records.handleForwards = [
			{
				handleBindingId: forwarded.records.elementHandleBindings[0].id,
				edgeId: 'component-edge:0',
				childComponentId: forwarded.components[0].id,
				childHostNodeId: 'h1',
			},
		];
		expect(() => emit(forwarded)).toThrow(/does not support forwarding a handle to a parent/);
	});

	/**
	 * THE T003/T010 DEFECT CLASS, AT THE TWO RECORDS THIS STEP MADE LIVE. See the
	 * twin in the Svelte lane for the full statement; measured before
	 * `validateHandleRecords` existed, this lane accepted both plants silently while
	 * react and solid threw - the same 2-versus-4 split T002 found one level up.
	 */
	test('rejects an unknown field on either handle record, BY NAME', async () => {
		const onBinding = clone(await ir(REF_SOURCE));
		onBinding.records.elementHandleBindings[0].elementType = 'HTMLInputElement';
		expect(() => validateEnrichedIr(onBinding)).toThrow(
			/ElementHandleBinding has unknown semantic field: elementType/,
		);

		const onCall = clone(await ir(REF_SOURCE));
		onCall.records.handleCalls[0].awaited = true;
		expect(() => validateEnrichedIr(onCall)).toThrow(
			/HandleCallRecord has unknown semantic field: awaited/,
		);

		const lawful = clone(await ir(REF_SOURCE));
		expect(() => validateEnrichedIr(lawful)).not.toThrow();
	});

	test('rejects a dangling handle binding and a dangling event on a call', async () => {
		const dangling = clone(await ir(REF_SOURCE));
		dangling.records.handleCalls[0].handleBindingId = 'element-handle:missing';
		expect(() => validateEnrichedIr(dangling)).toThrow(
			/HandleCallRecord has dangling ElementHandleBinding: element-handle:missing/,
		);

		const badEvent = clone(await ir(REF_SOURCE));
		badEvent.records.handleCalls[0].eventId = 'event:missing';
		expect(() => validateEnrichedIr(badEvent)).toThrow(
			/HandleCallRecord has dangling event: event:missing/,
		);
	});
});
