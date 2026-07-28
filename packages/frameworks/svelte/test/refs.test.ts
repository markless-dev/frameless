import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { compile } from 'svelte/compiler';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';

/**
 * STEP 3, REFS - the Svelte half.
 *
 * WHAT THIS LANE'S OWN CHECKER CAN AND CANNOT SEE, stated up front so no green
 * below is over-read. The instrument is `svelte/compiler`'s `compile()`, run in
 * process at the version this package resolves - the same oracle
 * `compile-emitted.test.ts` uses and for the same admissibility reason. It reports
 * WARNINGS AND SYNTAX, NOT TYPES: this lane has no type-level instrument at all,
 * because `svelte-check` is coupled to `demos/svelte-official`'s separate install.
 *
 * The type-level arm was therefore run OUT OF BAND against that demo's own
 * `svelte-check`, and it is recorded in
 * `docs/goals/frameless-emitter-capability-v1/notes/T005-refs.md` rather than
 * asserted here: the emitted ref component is 0 errors / 0 warnings at
 * `strict: false` - the setting this repo's emitted-typecheck lanes deliberately
 * use - and 2 implicit-any errors at `strict: true`, against 22 of the identical
 * class from the EIGHT already-shipped emitted components. So the ref declaration
 * is exactly as typed as the corpus it joins, and it is NOT typed here, because
 * typing emitted output is Step 2's construct and not this one's.
 */
async function ir(source: string): Promise<EnrichedIR> {
	return buildEnrichedIr({ filename: 'src/ref-probe.tsrx', source });
}

const REF_SOURCE = `import { element } from "@markless/core";
export function Search() @{
	const input = element<HTMLInputElement>();
	<div data-scenario="ref"><input el={input} data-action="target" /><button data-action="focus" onClick={() => input?.focus()}>focus</button></div>
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
		for (const warning of compile(source, { filename: 'Search.svelte', generate, dev })
			.warnings)
			codes.add(warning.code);
	return [...codes].sort();
}

function clone(value: EnrichedIR): any {
	return structuredClone(value);
}

describe('Svelte element handles', () => {
	test('binds the handle with bind:this and prints the authored call verbatim', async () => {
		const source = emit(await ir(REF_SOURCE));
		// `bind:this` is the ONLY sanctioned Svelte 5 form for this construct - `use:`
		// actions and `{@attach}` hand the node to a FUNCTION, not to a variable - so
		// there is one member in the sanctioned set and no baseline-versus-sugar
		// question to run the six gates over. See notes/T005-refs.md.
		expect(source).toContain('bind:this={input}');
		// A BARE `let`, NOT `$state()`. `bind:this` writes the variable during mount;
		// a rune would make that write a reactive update.
		expect(source).toContain('let input;');
		expect(source).not.toContain('$state');
		// The authored `element<T>()` call is GONE - it is a markless primitive with
		// no Svelte counterpart, and leaving it would emit an unresolvable identifier.
		expect(source).not.toContain('element(');
		expect(source).not.toContain('element<');
		// No rewriting: `bind:this` puts the node in the author's own variable.
		expect(source).toContain('input?.focus()');
	});

	test("the lane's own compiler reports nothing, and the instrument is calibrated", async () => {
		const source = emit(await ir(REF_SOURCE));
		expect(warningCodes(source)).toEqual([]);
		// CALIBRATION. An empty warning set from an instrument nobody has watched
		// report is not a measurement.
		const noisy = source.replace('<div data-scenario="ref"', '<div onclick={() => {}}');
		expect(warningCodes(noisy)).toContain('a11y_click_events_have_key_events');
	});

	/**
	 * THE CALIBRATION THIS FILE FIRST REACHED FOR DOES NOT EXIST, AND FINDING THAT
	 * OUT IS WHY THE EMITTER CARRIES A REFUSAL INSTEAD OF A RUNE.
	 *
	 * The emitter comment used to assert that a plain `let` read from the template
	 * would raise `non_reactive_update`, which would have made
	 * `assertCompilesClean` two-sided over `let` versus `$state()`. Measured at
	 * 5.56.8 across `client x server` and `dev x prod`, ALL of these are CLEAN:
	 * `bind:this` into a plain `let` with a template read, the same into
	 * `$state()`, and even a plain `let n = 0` reassigned in a handler and read in
	 * the template. The reactivity difference between the two forms is therefore
	 * INVISIBLE to this lane's only instrument, so the shape that would expose it is
	 * refused.
	 */
	test('refuses a template expression that reads a handle name', async () => {
		const value = await ir(`import { element } from "@markless/core";
export function Search() @{
	const input = element<HTMLInputElement>();
	<div data-scenario="ref"><input el={input} data-action="target" /><span data-tag>{input?.tagName}</span></div>
}`);
		expect(() => emit(value)).toThrow(
			/refuses the template expression read of the element handle input/,
		);
	});

	test('CALIBRATION: neither let nor $state warns on a template read at 5.56.8', () => {
		const plain =
			'<script lang="ts">\n\tlet input;\n</script>\n\n<div><input bind:this={input}><span>{input}</span></div>\n';
		const runed =
			'<script lang="ts">\n\tlet input = $state();\n</script>\n\n<div><input bind:this={input}><span>{input}</span></div>\n';
		expect(warningCodes(plain)).toEqual([]);
		expect(warningCodes(runed)).toEqual([]);
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
	 * THE T003/T010 DEFECT CLASS, AT THE TWO RECORDS THIS STEP MADE LIVE.
	 *
	 * T010 closed the gap for `PropDestructuringEntry` and T016 re-confirmed all six
	 * lanes reject a field planted there. `ElementHandleBinding` and
	 * `HandleCallRecord` were NEVER in that survey, because four lanes refused any
	 * IR carrying them - which is exactly the condition Step 3 removes. Measured
	 * before `validateHandleRecords` existed: react and solid threw and this lane
	 * accepted silently, the same 2-versus-4 split T002 found one level up.
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

		// And the lawful IR still passes, so the rows above are not green by accident.
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
