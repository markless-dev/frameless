import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { parseTemplate } from '@angular/compiler';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';

/**
 * STEP 4, EFFECTS (`attach=`) - the Angular half.
 *
 * WHAT THIS LANE'S OWN CHECKER CAN AND CANNOT SEE. In-package there is
 * `parseTemplate` from `@angular/compiler` - a TEMPLATE GRAMMAR check, which sees
 * the `#attachHost` reference variable and nothing about the class - plus the
 * package's own `tsc` rig. Neither is `ngc`, and neither runs `strictTemplates`.
 * The AOT arm was run OUT OF BAND against `demos/angular-official`'s own
 * `@angular/compiler-cli` and is recorded in
 * `docs/goals/frameless-emitter-capability-v1/notes/T006-effects.md`.
 *
 * WHY THIS SHAPE. `attach=` needs a node reference, a mount-time install with a
 * cleanup, and a re-run keyed on a declared input. `@ViewChild` +
 * `ngAfterViewInit` + `ngOnDestroy` is not a spelling choice - `ngAfterViewInit`
 * is the first hook at which an element query is resolved, which is the same
 * fact Step 3 recorded when it refused a handle call outside an event handler.
 * The RE-RUN is the one place there was a choice, and `ngDoCheck` with an
 * explicit previous-value comparison wins it by elimination: `ngOnChanges` sees
 * only `@Input()` props and a behavior input is whatever graph node the author
 * read, and `effect()` requires the inputs to be signals, which this
 * all-decorator class does not use (worked example 11).
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

function clone(value: EnrichedIR): any {
	return structuredClone(value);
}

function templateOf(source: string): string {
	const start = source.indexOf('template: `') + 'template: `'.length;
	return source.slice(start, source.indexOf('`,\n})', start));
}

describe('Angular attach behaviors', () => {
	test('lowers to @ViewChild plus ngAfterViewInit/ngOnDestroy, body transplanted to a method', async () => {
		const source = emit(await ir(TRACKED));
		expect(source).toContain("@ViewChild('attachHost') elementRefH0?: ElementRef;");
		expect(source).toContain('#attachHost');
		expect(source).toContain('ngAfterViewInit(): void {');
		expect(source).toContain('ngOnDestroy(): void {');
		expect(source).toContain(
			'export class Page implements OnInit, AfterViewInit, DoCheck, OnDestroy {',
		);
		// FORCED LOWERING: a frameless behavior body cannot be an inline template
		// expression, so it becomes a class method - the same lowering every handler
		// in this lane already takes.
		expect(source).toContain('private behavior(node: any, value: any): any {');
		expect(source).toContain('node.dataset.value = value;');
		expect(source).toContain("if (typeof this.cleanup === 'function')");
	});

	/**
	 * THE PARAMETER CAPTURE, and Angular is the lane where its absence would be
	 * silently wrong: `ngDoCheck` fires AFTER the field has changed, so a cleanup
	 * body qualified to `this.value` would read the NEW value and diverge from both
	 * shipped lanes. `qualify()` is scope-aware and treats a parameter as in-scope,
	 * so the appended parameter suppresses exactly that qualification - and
	 * `qualify()` stays TOTAL, which is the property Step 3 declined to spend.
	 */
	test('captures the declared input as a PARAMETER, so the body never re-reads the field', async () => {
		const source = emit(await ir(TRACKED));
		expect(source).toContain('this.cleanup = this.behavior(this.elementRefH0?.nativeElement, this.value);');
		const method = source.slice(
			source.indexOf('private behavior('),
			source.indexOf('private installAttachHost'),
		);
		// Inside the transplanted method the input is the bare parameter, never
		// `this.value`.
		expect(method).toContain('node.dataset.value = value;');
		expect(method).not.toContain('this.value');
	});

	test('re-runs from ngDoCheck on a declared input change, guarded by the installed flag', async () => {
		const source = emit(await ir(TRACKED));
		expect(source).toContain('ngDoCheck(): void {');
		expect(source).toContain(
			'if (this.attachHostInstalled && (this.valueInput !== this.value)) {',
		);
		const check = source.slice(source.indexOf('ngDoCheck(): void {'));
		expect(check.indexOf('this.disposeAttachHost();')).toBeLessThan(
			check.indexOf('this.installAttachHost();'),
		);
		// The guard is load-bearing: `ngDoCheck` runs BEFORE `ngAfterViewInit` on the
		// first cycle, when the element query is still unresolved.
		expect(source).toContain('private attachHostInstalled = false;');
		expect(source).toContain('this.attachHostInstalled = true;');
	});

	test('a behavior with no inputs gets no ngDoCheck, no flag and no ngOnDestroy', async () => {
		const source = emit(await ir(ZERO_INPUT));
		expect(source).toContain('private behavior(node: any): any {');
		expect(source).toContain('this.behavior(this.elementRefH0?.nativeElement);');
		expect(source).not.toContain('ngDoCheck');
		expect(source).not.toContain('ngOnDestroy');
		// An always-true private field nothing reads is what
		// `no-unused-private-class-members` is for, so it is not emitted either.
		expect(source).not.toContain('Installed');
		expect(source).toContain('export class Page implements AfterViewInit {');
	});

	test('imports exactly the lifecycle interfaces the class implements', async () => {
		const tracked = emit(await ir(TRACKED));
		// `Input` IS CONDITIONAL ON AN `@Input()` MEMBER BEING PRINTED, and it was
		// `pnpm lint` that settled that - see the note in test/refs.test.ts. Neither
		// probe here declares a prop.
		expect(tracked).toContain(
			"import { type AfterViewInit, Component, type DoCheck, ElementRef, type OnDestroy, type OnInit, ViewChild } from '@angular/core';",
		);
		const zero = emit(await ir(ZERO_INPUT));
		expect(zero).toContain(
			"import { type AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';",
		);
	});

	test("the lane's own template grammar accepts the reference variable, and is calibrated", async () => {
		const source = emit(await ir(TRACKED));
		const template = templateOf(source);
		expect(parseTemplate(template, 'Page.html').errors).toBeNull();
		// CALIBRATION. A null error list from a parser nobody has watched report is
		// not a measurement.
		expect(parseTemplate(`${template}<div [x]="(">`, 'Page.html').errors).not.toBeNull();
	});

	test('preserves authored install order and emits REVERSE cleanup order', async () => {
		const value = clone(await ir(TRACKED));
		const second = structuredClone(value.records.behaviors[0]);
		second.id = 'behavior:1';
		second.order = 1;
		value.records.behaviors = [value.records.behaviors[0], second];
		const source = emit(value);
		const install = source.slice(source.indexOf('private installAttachHost'));
		const installed = [...install.matchAll(/this\.(\w+) = this\.behavior\d*\(/g)].map(
			(match) => match[1]!,
		);
		expect(installed).toHaveLength(2);
		const dispose = source.slice(source.indexOf('private disposeAttachHost'));
		// Read as a SEQUENCE of names: one claimed name can be a PREFIX of another, so
		// comparing two `indexOf` results would match the wrong occurrence.
		const torn = [...dispose.matchAll(/typeof this\.(\w+) === 'function'/g)].map(
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
		via.records.behaviors[0].inputs[0].via = 'local';
		expect(() => emit(via)).toThrow(/no lowering for a local behavior input/);

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
