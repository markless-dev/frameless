import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { describe, expect, test } from 'vitest';
import { emit, templateDiagnostics, validateEnrichedIr } from '../src/emitter/index.ts';

/**
 * STEP 3, REFS - the Angular half, and the lane where the handle is NOT the node.
 *
 * WHAT THIS PACKAGE'S OWN CHECKERS CAN AND CANNOT SEE. `templateDiagnostics` runs
 * `@angular/compiler`'s `parseTemplate`, which checks template GRAMMAR;
 * `emitted-typecheck.test.ts` runs a `tsc` program that tolerates exactly one
 * TS2307 per file because THIS PACKAGE IS DELIBERATELY FREE OF `@angular/core`
 * (`test/toolchain.test.ts`, `frameless-angular-v1` T002 ruling 1). Neither can
 * type-check `@ViewChild`, `ElementRef` or a template binding against the class.
 *
 * The real arm was therefore run OUT OF BAND against `demos/angular-official`'s
 * own `@angular/compiler-cli@22.0.8` - a real `ngc` AOT compile with
 * `strictTemplates: true` - and it is recorded in
 * `docs/goals/frameless-emitter-capability-v1/notes/T005-refs.md`: the emitted ref
 * class compiles CLEAN, with the instrument calibrated red two ways. THAT run is
 * also where the shadowing refused below was measured rather than hypothesised.
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

describe('Angular element handles', () => {
	test('emits the @ViewChild pair, the template reference variable, and an unwrapping getter', async () => {
		const source = emit(await ir(REF_SOURCE));
		expect(source).toContain("@ViewChild('input') elementRefH1?: ElementRef;");
		expect(source).toContain('<input data-action="target" #input>');
		expect(source).toContain('return this.elementRefH1?.nativeElement;');
		// The handler is transplanted by `qualify()` with NO handle-specific rewriting:
		// the member `input` IS the node, which is what keeps `qualify` total.
		expect(source).toContain('this.input?.focus()');
		expect(source).not.toContain('nativeElement.focus');
		// `ElementRef` and `ViewChild` join the emitted module's OWN import list -
		// self-scoped, which the idiom policy's Gate 2 scoping paragraph settles.
		expect(source).toContain(
			"import { Component, ElementRef, ViewChild } from '@angular/core';",
		);
		// The decorator family, not the signal query: `viewChild()` floors at 17.2 and
		// `@angular-eslint/prefer-signals` lives upstream in `all`, NOT `recommended`,
		// so this lane's derived applied set is silent on the choice - worked example
		// 11's measurement.
		expect(source).not.toContain('viewChild(');
		// The inline template, sliced out of the TypeScript module it lives in, run
		// back through `@angular/compiler`'s own `parseTemplate`. `#input` is template
		// GRAMMAR, so this is the check that says the reference variable parses.
		const template = source.slice(source.indexOf('template: `') + 11, source.indexOf('`,\n})'));
		expect(templateDiagnostics(template, 'Search.html')).toEqual([]);
		expect(template).toContain('#input');
	});

	test('a component with no handle emits neither import nor query', async () => {
		const source = emit(
			await ir(`import { state } from "@markless/core";
export function Plain() @{
	let count = state(1);
	<button data-action="go" onClick={() => { count++; }}>{count}</button>
}`),
		);
		expect(source).not.toContain('ViewChild');
		expect(source).not.toContain('ElementRef');
		// `Input` IS ABSENT, AND `pnpm lint` IS WHY. This assertion listed `Input`
		// unconditionally until `frameless-emitter-capability-v1` T007, which emitted
		// the first modules with NO props at all and took `pnpm lint` from 0 warnings
		// to 2 - `eslint(no-unused-vars): Identifier 'Input' is imported but never
		// used`. Every one of the eight committed `generated/` scenarios declares an
		// `@Input()`, so the propless case had only ever existed inside a test's
		// source string and the unconditional import had never been observed on disk.
		expect(source).toContain("import { Component, type OnInit } from '@angular/core';");
	});

	/**
	 * MEASURED at `@angular/compiler-cli` 22.0.8 with `strictTemplates: true`, not
	 * argued: with `#input` on the element, `{{ input.notOnAnyElement }}` reports
	 * `TS2339: Property 'notOnAnyElement' does not exist on type 'HTMLInputElement'`;
	 * with `#input` removed it is CLEAN, because it then resolves to the `any`
	 * getter. So the template reference variable really does shadow the class member,
	 * and the two are not the same value at the same time - the ref var is the
	 * element from the first render, the getter is `undefined` until
	 * `ngAfterViewInit`. No other lane has this problem.
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

	test('refuses two handles on one host, a non-identifier name, and a name no local declares', async () => {
		const twoOnOne = clone(await ir(REF_SOURCE));
		twoOnOne.records.elementHandleBindings.push({
			...twoOnOne.records.elementHandleBindings[0],
			id: 'element-handle:h1:second',
		});
		expect(() => emit(twoOnOne)).toThrow(/cannot bind two element handles to one host/);

		const dotted = clone(await ir(REF_SOURCE));
		dotted.records.elementHandleBindings[0].handleName = 'row.input';
		expect(() => emit(dotted)).toThrow(/cannot bind an element handle named "row.input"/);

		const unknown = clone(await ir(REF_SOURCE));
		unknown.records.elementHandleBindings[0].handleName = 'notALocal';
		expect(() => emit(unknown)).toThrow(/names no component local: notALocal/);
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
	 * twin in the Svelte lane; measured before `validateHandleRecords` existed, this
	 * lane accepted both plants silently while react and solid threw.
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
