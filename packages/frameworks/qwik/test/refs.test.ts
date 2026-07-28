import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import ts from 'typescript';
import { afterAll, describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';

/**
 * STEP 3, REFS - the Qwik half, and the ONE LANE WHERE THE TYPE ARGUMENT IS LOAD-
 * BEARING RATHER THAN DECORATIVE.
 *
 * `frameless-emitter-capability-v1` T001 recorded that Qwik has NO typecheck lane
 * in this repo and structurally could not have one, because an untyped
 * `component$((props) => ...)` rejects every prop by name. THAT REASONING DOES NOT
 * REACH THIS CONSTRUCT: an element handle is a local, not a prop, so a `tsc`
 * program over the emitted module against the RESOLVED `@qwik.dev/core` types is
 * both possible and decisive - and this package HAS `@qwik.dev/core` in its own
 * dependencies, unlike the Angular lane, which is deliberately free of
 * `@angular/core`. So this is the first standing type-level check on emitted Qwik
 * output in this repo, and it is what caught the first lowering this step wrote.
 */
async function ir(source: string): Promise<EnrichedIR> {
	return buildEnrichedIr({ filename: 'src/ref-probe.tsrx', source });
}

const REF_SOURCE = `import { element } from "@markless/core";
export function Search() @{
	const input = element<HTMLInputElement>();
	<div data-scenario="ref"><input el={input} data-action="target" /><button data-action="focus" onClick={() => input?.focus()}>focus</button></div>
}`;

const packageRoot = resolve(import.meta.dirname, '..');
const temporaries: string[] = [];

afterAll(async () => {
	for (const directory of temporaries) await rm(directory, { recursive: true, force: true });
});

/**
 * A real `tsc` over emitted TSX, resolving `@qwik.dev/core` out of THIS package's
 * own `node_modules`, so what is measured is the build this repo ships.
 *
 * `strict: true` deliberately - unlike the react/solid/angular emitted-typecheck
 * lanes, which run at `strict: false` because emitted PROPS arrive untyped and
 * produce a diagnostic per field. Nothing in a ref-bearing module is untyped, so
 * the stricter setting costs nothing and catches more.
 */
async function diagnose(source: string): Promise<string[]> {
	const directory = await mkdtemp(resolve(tmpdir(), 'frameless-qwik-refs-'));
	temporaries.push(directory);
	const file = resolve(directory, 'Emitted.tsx');
	await writeFile(file, source);
	const program = ts.createProgram([file], {
		noEmit: true,
		strict: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		jsx: ts.JsxEmit.ReactJSX,
		jsxImportSource: '@qwik.dev/core',
		lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
		skipLibCheck: true,
		types: [],
		baseUrl: packageRoot,
		paths: { '*': [resolve(packageRoot, 'node_modules/*')] },
	});
	return ts.getPreEmitDiagnostics(program).map(
		(diagnostic) =>
			`TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
	);
}

function clone(value: EnrichedIR): any {
	return structuredClone(value);
}

describe('Qwik element handles', () => {
	test('binds the handle with a typed useSignal and respells the call through .value', async () => {
		const source = emit(await ir(REF_SOURCE));
		expect(source).toContain('const input = useSignal<HTMLElement>();');
		expect(source).toContain('ref={input}');
		// `rewriteExpression` respells the read; the emitter never builds the call.
		expect(source).toContain('input.value?.focus()');
		// The authored `element<T>()` call is GONE.
		expect(source).not.toContain('element(');
		expect(source).not.toContain('element<HTML');
		expect(source).toContain("import { component$, useSignal } from '@qwik.dev/core';");
	});

	/**
	 * THE ROW THAT MADE THE TYPE ARGUMENT NON-NEGOTIABLE, kept two-sided so neither
	 * arm can be read as ceremony.
	 *
	 * `UseSignal` (`@qwik.dev/core` 2.0.0-beta.38 `dist/core-internal.d.ts` :4884)
	 * is `<T>(): Signal<T | undefined>`, so a bare `useSignal()` is
	 * `Signal<unknown>`; the `ref` prop is
	 * `Ref<EL> = Signal<Element | undefined> | RefFnInterface<EL>` (:2971). The bare
	 * form is therefore a hard TS2322 at the prop AND a TS2339 at every `.value`
	 * read. Assignability is not a strictness setting, so `strict: false` does not
	 * rescue it.
	 */
	test('the emitted module typechecks against the resolved Qwik types, and the bare form does not', async () => {
		const source = emit(await ir(REF_SOURCE));
		expect(await diagnose(source)).toEqual([]);
		const bare = source.replace('useSignal<HTMLElement>()', 'useSignal()');
		expect(bare).not.toBe(source);
		const bareDiagnostics = await diagnose(bare);
		expect(bareDiagnostics.some((entry) => entry.startsWith('TS2322:'))).toBe(true);
		expect(bareDiagnostics.some((entry) => entry.startsWith('TS2339:'))).toBe(true);
	});

	/**
	 * THE OUTPUT VERIFIER'S LANGUAGE, PINNED. `emit` runs `analyze(..., { lang })`
	 * over its own output. That verifier was left at `jsx` when the artifact became
	 * `.tsx`, and MEASURED at yuku-analyzer 0.7.0 a `jsx` parse of
	 * `useSignal<HTMLElement>()` beside JSX reports `Empty parentheses are only
	 * valid as arrow function parameters` - it reads `<` as a comparison. So the
	 * first type argument this lane ever printed would have been rejected as invalid
	 * output. This row is what stops that regressing.
	 */
	test('emit() verifies its own type-bearing output rather than rejecting it', async () => {
		const value = clone(await ir(REF_SOURCE));
		expect(() => emit(value)).not.toThrow();
		expect(emit(value)).toContain('useSignal<HTMLElement>()');
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
			id: 'element-handle:h1:second',
		});
		expect(() => emit(twoOnOne)).toThrow(/cannot bind two element handles to one host/);

		const dotted = clone(await ir(REF_SOURCE));
		dotted.records.elementHandleBindings[0].handleName = 'row.input';
		expect(() => emit(dotted)).toThrow(/cannot bind an element handle named "row.input"/);
	});

	test('still refuses handle forwarding and attach behaviors, by name', async () => {
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

		const behaved = clone(await ir(REF_SOURCE));
		behaved.records.behaviors = [
			{
				id: 'behavior:0',
				hostNodeId: 'h1',
				componentId: behaved.components[0].id,
				behavior: { type: 'ArrowFunctionExpression' },
				inputs: [],
				returnsCleanup: false,
				order: 0,
			},
		];
		expect(() => emit(behaved)).toThrow(/does not support element attach behaviors/);
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
