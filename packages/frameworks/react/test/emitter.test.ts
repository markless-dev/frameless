import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import {
	adaptPersistenceFacts,
	buildEnrichedIr,
	FRAMELESS_STATE_GLOBAL,
	type EnrichedIR,
	type FramelessPersistenceRecord,
	type MarklessStorageSourceFact,
} from '@frameless/compiler';
import { resolve } from 'pathe';
// Type-only: erased at runtime, so it does not hoist a `react` load above the
// minimal-DOM install below.
import type { ReactElement } from 'react';
import ts from 'typescript';
import { analyze } from 'yuku-analyzer';
import { generate } from 'yuku-codegen';
import { parse } from 'yuku-parser';
import { describe, expect, test } from 'vitest';
import {
	compositionFixtures,
	emitCompositionFixture,
} from '../scripts/regenerate-composition.ts';
import { emit, reactPropSpellings, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
import { checkSources } from '../src/gate/index.ts';

// `tsx`, NOT `jsx`, AT EVERY SITE IN THIS FILE THAT PARSES EMITTED OUTPUT.
// The artifact became `.tsx` at `frameless-emitter-capability-v1` T009/T011 and
// carries an IR-8 props type from T014. MEASURED at yuku-parser/yuku-analyzer
// 0.7.0: `jsx` reports "Expected ')' to close parameter list, but found ':'" on a
// typed props parameter, so a stale `jsx` here fails on VALID output.

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');
const generatedRoot = resolve(root, 'generated');

/** Numeric, so S10 sorts after S9 rather than between S1 and S2. */
function byScenarioNumber(left: string, right: string): number {
	return Number(/(\d+)/.exec(left)![1]) - Number(/(\d+)/.exec(right)![1]);
}

/**
 * THE FIXTURE TABLE IS DERIVED, NOT RE-LITERALLED.
 *
 * This table stopped at `s3-event-form.json`, which meant that when S4 landed NO
 * standing test asserted its emitted bytes equal `formatEmitted(emit(golden))`.
 * That freshness was proved ONCE, by regenerating and diffing by hand; nothing
 * re-proved it per run, so the emitted S4 could have drifted from the emitter
 * that claims to produce it and every lane would still have been green. Four
 * more scenarios are queued, and a table hand-edited per scenario is that same
 * hole four more times.
 *
 * The derivation source is the compiler's ratified golden corpus - `s<n>-*.json`
 * - which is INDEPENDENT of `generated/`: one is the IR this repo agreed to
 * compile, the other is what the emitter actually wrote. `preconditions` below
 * compares the two and watches both directions go red.
 */
function scenarioFixtures(goldenDir = goldenRoot): Array<readonly [string, string]> {
	const table = readdirSync(goldenDir)
		.filter((entry) => /^s\d+-[\w-]+\.json$/.test(entry))
		.sort(byScenarioNumber)
		.map((entry) => [`S${/^s(\d+)-/.exec(entry)![1]}.tsx`, entry] as const);
	// Fail LOUD rather than returning []. An empty table would emit zero freshness
	// tests and the file would still report green, which is the one way a derived
	// list could be greener than the literal it replaced.
	if (table.length === 0)
		throw new Error(`no s<n>-*.json scenario goldens found in ${goldenDir}`);
	return table;
}

/** What the emitter actually wrote - the other side of the cross-check. */
function emittedScenarios(directory = generatedRoot): string[] {
	return readdirSync(directory)
		.filter((entry) => /^S\d+\.tsx$/.test(entry))
		.sort(byScenarioNumber);
}

const fixtures = scenarioFixtures();

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(await readFile(resolve(goldenRoot, name), 'utf8')) as EnrichedIR;
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

function persistenceRecord(
	graphNodeId: string,
	bindingName: string,
	authoredInitial: string,
	moduleId: string,
): FramelessPersistenceRecord {
	return {
		version: 'frameless-persistence-record/1',
		graphNodeId,
		moduleId,
		bindingName,
		driver: 'localStorage',
		key: {
			origin: 'derived',
			sourceIdentifier: bindingName,
			literal: `markless:${bindingName}`,
			bakedAtCompileTime: true,
		},
		authoredInitial,
		antiFlashAttribute: `data-markless-${bindingName}`,
		access: { render: true, handler: true },
		seed: {
			lowering: 'pre-paint',
			readFailure: 'authored-initial',
			corruptedValue: 'authored-initial',
			landings: [
				{
					target: 'react',
					kind: 'sync-read-seed-slot',
					graphNodeId,
				},
			],
		},
		writeThrough: {
			trigger: 'ordinary-assignment',
			value: 'final-committed-string',
			timing: 'commit-before-notify',
			writeFailure: 'swallow',
			crossTabSync: 'off',
		},
	};
}

function visit(value: unknown, callback: (record: Record<string, any>) => void): void {
	if (!value || typeof value !== 'object') return;
	callback(value as Record<string, any>);
	for (const child of Object.values(value)) {
		if (Array.isArray(child)) child.forEach((entry) => visit(entry, callback));
		else visit(child, callback);
	}
}

function renameIdentifier(ir: EnrichedIR, from: string, to: string): void {
	visit(ir, (record) => {
		if (record.type === 'Identifier' && record.name === from) record.name = to;
		if (record.name === from) record.name = to;
	});
	ir.components[0]!.locals.forEach((local: any) => {
		local.names = local.names.map((name: string) => (name === from ? to : name));
	});
}

function staticAttributeValue(source: string, name: string): string {
	const parsed = parse(source, { lang: 'tsx', sourceType: 'module', preserveParens: false });
	expect(parsed.diagnostics).toEqual([]);
	const module = analyze(source, { lang: 'tsx', sourceType: 'module', preserveParens: false });
	let result: string | undefined;
	visit(module.ast, (record) => {
		if (record.type === 'JSXAttribute' && record.name?.name === name && result === undefined) {
			const value =
				record.value?.type === 'JSXExpressionContainer'
					? record.value.expression
					: record.value;
			if (value?.type === 'Literal' && typeof value.value === 'string') result = value.value;
		}
	});
	if (result === undefined) throw new Error(`missing ${name}`);
	return result;
}

function expectTopLevelSpacing(source: string): void {
	const parsed = parse(source, { lang: 'tsx', sourceType: 'module', preserveParens: false });
	expect(parsed.diagnostics).toEqual([]);
	for (let index = 1; index < parsed.program.body.length; index += 1) {
		const previous = parsed.program.body[index - 1]!;
		const current = parsed.program.body[index]!;
		const bothImports =
			previous.type === 'ImportDeclaration' && current.type === 'ImportDeclaration';
		expect(source.slice(previous.end, current.start)).toBe(bothImports ? '\n' : '\n\n');
	}
}

/**
 * THE REACT RUNTIME, FOR REAL, IN A NODE ENVIRONMENT - T047.
 *
 * The across-await measurement below is about what the emitted handler DOES on a
 * second dispatch, and that is only observable through a renderer that actually
 * re-renders and re-creates the handler closure. Structural assertions on emitted
 * text cannot see it, and `react-dom/server` never re-renders.
 *
 * This suite runs under `environment: 'node'` and no DOM implementation is a
 * declared dependency anywhere in the workspace, so the container is a minimal
 * hand-rolled DOM. It exists ONLY to let `react-dom/client` reconcile and commit;
 * nothing here re-implements React, and the event system is never used - handlers
 * are lifted out of the emitted JSX and called directly, exactly as the Solid
 * lane's proof does.
 *
 * `react-dom/client` is imported DYNAMICALLY, after the globals exist, because
 * static imports are hoisted above every statement in this module.
 */
function installMinimalDom(): void {
	class DomNode {
		childNodes: any[] = [];
		parentNode: any = null;
		attributes: Record<string, string> = {};
		style: Record<string, string> = {};
		nodeValue = '';
		tagName?: string;
		namespaceURI?: string;
		constructor(
			readonly ownerDocument: any,
			readonly nodeType: number,
			readonly nodeName: string,
		) {}
		get firstChild(): any {
			return this.childNodes[0] ?? null;
		}
		get lastChild(): any {
			return this.childNodes[this.childNodes.length - 1] ?? null;
		}
		get nextSibling(): any {
			const parent = this.parentNode;
			return parent ? (parent.childNodes[parent.childNodes.indexOf(this) + 1] ?? null) : null;
		}
		appendChild(child: any): any {
			child.parentNode?.removeChild(child);
			child.parentNode = this;
			this.childNodes.push(child);
			return child;
		}
		insertBefore(child: any, reference: any): any {
			child.parentNode?.removeChild(child);
			child.parentNode = this;
			const at = reference ? this.childNodes.indexOf(reference) : this.childNodes.length;
			this.childNodes.splice(at < 0 ? this.childNodes.length : at, 0, child);
			return child;
		}
		removeChild(child: any): any {
			const at = this.childNodes.indexOf(child);
			if (at >= 0) this.childNodes.splice(at, 1);
			child.parentNode = null;
			return child;
		}
		setAttribute(name: string, value: unknown): void {
			this.attributes[name] = String(value);
		}
		getAttribute(name: string): string | null {
			return this.attributes[name] ?? null;
		}
		removeAttribute(name: string): void {
			delete this.attributes[name];
		}
		hasAttribute(name: string): boolean {
			return name in this.attributes;
		}
		addEventListener(): void {}
		removeEventListener(): void {}
		get textContent(): string {
			return this.nodeType === 3
				? this.nodeValue
				: this.childNodes.map((child: any) => child.textContent).join('');
		}
		set textContent(value: string) {
			this.childNodes = [];
			if (value !== '') this.appendChild(this.ownerDocument.createTextNode(String(value)));
		}
		contains(): boolean {
			return true;
		}
	}
	const document: any = {
		nodeType: 9,
		createElement(name: string) {
			const element: any = new DomNode(document, 1, name.toUpperCase());
			element.tagName = name.toUpperCase();
			element.namespaceURI = 'http://www.w3.org/1999/xhtml';
			return element;
		},
		createElementNS: (_namespace: string, name: string) => document.createElement(name),
		createTextNode(text: string) {
			const node: any = new DomNode(document, 3, '#text');
			node.nodeValue = String(text);
			return node;
		},
		createComment(text: string) {
			const node: any = new DomNode(document, 8, '#comment');
			node.nodeValue = String(text);
			return node;
		},
		addEventListener() {},
		removeEventListener() {},
		getSelection: () => null,
		activeElement: null,
	};
	document.ownerDocument = document;
	document.documentElement = document.createElement('html');
	document.body = document.createElement('body');
	document.documentElement.appendChild(document.body);
	document.defaultView = globalThis;
	const scope = globalThis as any;
	scope.document = document;
	scope.window = globalThis;
	scope.navigator ??= { userAgent: 'node' };
	scope.Node = DomNode;
	scope.Element = DomNode;
	scope.HTMLElement = DomNode;
	scope.Text = DomNode;
	scope.Comment = DomNode;
	scope.HTMLIFrameElement = class HTMLIFrameElement {};
	scope.IS_REACT_ACT_ENVIRONMENT = true;
}
installMinimalDom();
const React = await import('react');
const ReactDOMClient = await import('react-dom/client');
const { act, createElement, useState } = React;

/**
 * AND PROVE THE RUNTIME COMMITS, rather than asserting it.
 *
 * If the shim above ever stopped driving real reconciliation - a swallowed
 * `appendChild`, a `textContent` that never updates - every measurement below
 * would report the initial state forever and a stale-vs-live proof would be a
 * GREEN VACUUM on a runtime that cannot fail. The discriminator is the exact
 * mechanism under test: a captured closure must NOT advance the count a second
 * time, while a closure taken from the newest render must. Measured 0, 1, 1, 2.
 */
const commitCalibration = await (async (): Promise<string> => {
	let latest: (() => void) | null = null;
	function Counter(): ReactElement {
		const [count, setCount] = useState(0);
		latest = () => setCount(count + 1);
		return createElement('output', null, String(count));
	}
	const container = (globalThis as any).document.createElement('div');
	const root = ReactDOMClient.createRoot(container);
	const observed: string[] = [];
	await act(async () => {
		root.render(createElement(Counter));
	});
	observed.push(container.textContent);
	const captured = latest!;
	await act(async () => captured());
	observed.push(container.textContent);
	await act(async () => captured());
	observed.push(container.textContent);
	await act(async () => latest!());
	observed.push(container.textContent);
	await act(async () => {
		root.unmount();
	});
	return observed.join(',');
})();
if (commitCalibration !== '0,1,1,2')
	throw new Error(
		`react-dom did not commit through the minimal DOM (got ${commitCalibration}); the across-await measurement would be running blind`,
	);

describe('React structural emitter', () => {
	test('the derived fixture table is the corpus, and the emitter wrote exactly it', () => {
		// THE FLOOR. Every scenario ratified so far must still be in the derivation.
		// A lower bound, so S5 and later widen it with no edit here, while a golden
		// that silently disappeared is red.
		expect(fixtures.map(([file]) => file)).toEqual(
			expect.arrayContaining(['S1.tsx', 'S2.tsx', 'S3.tsx', 'S4.tsx']),
		);
		// Two independent readings compared: the goldens this repo agreed to
		// compile, and the files the emitter actually wrote.
		expect(emittedScenarios()).toEqual(fixtures.map(([file]) => file));
	});

	/**
	 * CALIBRATION for the DERIVED table. A derived list nobody has watched go red
	 * is not an instrument - and the literal it replaced at least went red when a
	 * golden it named disappeared. Both directions run through the SAME
	 * `scenarioFixtures()` and `emittedScenarios()` the row above calls, against
	 * throwaway roots.
	 */
	test('CALIBRATION: the derived table goes red on a missing and on an extra file', async () => {
		const files = fixtures.map(([file]) => file);
		const temporary = await mkdtemp(resolve(tmpdir(), 'frameless-react-fixtures-'));
		try {
			const goldens = resolve(temporary, 'goldens');
			const generated = resolve(temporary, 'generated');
			await mkdir(goldens);
			await mkdir(generated);
			for (const entry of readdirSync(goldenRoot))
				await writeFile(resolve(goldens, entry), '{}');
			expect(scenarioFixtures(goldens)).toEqual(fixtures);
			// MISSING, on the emitted side: one file short of the derived table.
			for (const file of files.slice(0, -1)) await writeFile(resolve(generated, file), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(files);
			await writeFile(resolve(generated, files.at(-1)!), '//\n');
			expect(emittedScenarios(generated)).toEqual(files);
			// EXTRA, on the emitted side: a stray scenario no golden declares.
			await writeFile(resolve(generated, 'S99.tsx'), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(files);
			// And both directions on the DERIVATION side, so a golden that vanished
			// or appeared cannot pass unnoticed either.
			await rm(resolve(goldens, fixtures[0]![1]));
			expect(scenarioFixtures(goldens)).not.toEqual(fixtures);
			await writeFile(resolve(goldens, 's99-planted.json'), '{}');
			expect(scenarioFixtures(goldens).map(([file]) => file)).toContain('S99.tsx');
			// The degenerate case the throw exists for: an empty derivation must NOT
			// quietly agree with an empty directory.
			await rm(goldens, { recursive: true, force: true });
			await mkdir(goldens);
			expect(() => scenarioFixtures(goldens)).toThrow(/no s<n>-\*\.json scenario goldens/);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	for (const fixture of compositionFixtures) {
		test(`generated-composition/${fixture}.tsx is fresh from its composition fixture`, async () => {
			expect(
				await readFile(resolve(root, 'generated-composition', `${fixture}.tsx`), 'utf8'),
			).toBe(await emitCompositionFixture(fixture));
		});
	}

	for (const [output, golden] of fixtures) {
		test(`${output} is fresh from the compiler EnrichedIR golden`, async () => {
			const ir = JSON.parse(
				await readFile(resolve(goldenRoot, golden), 'utf8'),
			) as EnrichedIR;
			visit(ir.components, (record) => {
				if (record.kind === 'host')
					expect(record.staticAttributes).not.toContainEqual(
						expect.objectContaining({ value: true }),
					);
			});
			validateEnrichedIr(ir);
			expect(await readFile(resolve(root, 'generated', output), 'utf8')).toBe(
				await formatEmitted(emit(ir)),
			);
		});
	}

	test('formats a multi-declaration module with one blank line between top-level declarations', async () => {
		expectTopLevelSpacing(await emitCompositionFixture('C2-shared'));
		const withImportedComponent = await buildEnrichedIr({
			filename: 'test/spacing-parent.tsrx',
			source: `import { state } from "@markless/core";
				import { Child } from "./spacing-child.tsrx";
				export function Parent() @{ let count = state(0); <Child>{count}</Child> }`,
		});
		expectTopLevelSpacing(await formatEmitted(emit(withImportedComponent)));
	});

	test('formats the single-component v0 shape with a blank line after its import block', async () => {
		expectTopLevelSpacing(await formatEmitted(emit(await golden('s1-render-once.json'))));
	});

	test('applies every dossier-required POC delta without source recovery', async () => {
		const [s1, s2, s3] = await Promise.all(
			['S1.tsx', 'S2.tsx', 'S3.tsx'].map((file) =>
				readFile(resolve(root, 'generated', file), 'utf8'),
			),
		);
		expect(s1).toContain('useRef(null)');
		expect(s1).toContain('setupDone.current === null');
		expect(s1).toContain('useState(1)');
		expect(s1).toContain('const nextCount = count + 1');
		expect(s2).toContain('const currentState2 = next.current');
		expect(s2).toContain('next.current = currentState2 + 1');
		expect(s2.match(/onChange=/g)?.length).toBe(3);
		expect(s2).toContain('event.target.value');
		expect(s2).toContain('event.target.checked');
		expect(s3).toContain('useState(false)');
		expect(s3).toContain('useState(0)');
		expect(s3.match(/setWrites\(/g)?.length).toBe(1);
		expect(`${s1}\n${s2}\n${s3}`).not.toMatch(/\blet\b|onInput=|currentTarget/);
	});

	test('has an AST-only target boundary', async () => {
		const emitter = await Promise.all(
			['index.ts', 'estree.ts'].map((file) =>
				readFile(resolve(root, 'src/emitter', file), 'utf8'),
			),
		).then((files) => files.join('\n'));
		const gate = await Promise.all(
			['index.ts', 'custom-policies.ts'].map((file) =>
				readFile(resolve(root, 'src/gate', file), 'utf8'),
			),
		).then((files) => files.join('\n'));
		const regenerate = await readFile(resolve(root, 'scripts/regenerate.ts'), 'utf8');
		expect(`${emitter}\n${gate}`).not.toMatch(/from ['"](?:@babel\/|@markless\/|@tsrx\/)/);
		expect(emitter).toContain("from 'yuku-codegen'");
		expect(`${emitter}\n${gate}`).toContain("from 'yuku-analyzer'");
		expect(regenerate).not.toContain('.tsrx');
		expect(regenerate).toContain('../../compiler/test/goldens');
	});

	/**
	 * CONDITIONAL CANCELLATION - PINNING behaviour that was already correct.
	 *
	 * T011 §3.2 measured that React needs no change here: its handlers are
	 * synchronous and resident, so the authored guard is emitted verbatim and the
	 * declared `SyncPolicy` is used only as a cross-check - `emitEvent`'s
	 * `requiredActions` loop in `packages/frameworks/react/src/emitter/index.ts`,
	 * which throws when a declared action is absent from the handler AST rather
	 * than synthesising anything. But NO TEST ASSERTED IT, which made "React
	 * needs no change" an assumption rather than a fact - and the Qwik lowering
	 * and the Solid repair both lean on React being the reference behaviour.
	 *
	 * Anything below going red means the three-way contract has lost its baseline,
	 * not that React has a new feature.
	 */
	describe('conditional cancellation is preserved verbatim', () => {
		const guarded = (guard: string, extra = '') => `import { state } from '@markless/core';

export function Guarded({ onTrace }) @{
	let seen = state(0);${extra}

	<form>
		<button
			type="submit"
			data-action="go"
			onClick={(event) => {
				if (${guard}) {
					event.preventDefault();
					seen = 1;
					onTrace('go');
				}
			}}
		/>
		<output>{seen}</output>
	</form>
}
`;

		test('an event-field guard survives with the cancellation inside it', async () => {
			const ir = await buildEnrichedIr({
				filename: 'guarded.tsrx',
				source: guarded(`event.key === 'Enter'`),
			});
			expect(ir.records.events[0]!.syncPolicy).toEqual({
				when: { type: 'event-equals', field: 'key', value: 'Enter' },
				actions: ['preventDefault'],
			});
			const source = await formatEmitted(emit(ir));
			expect(source).toMatch(
				/if \(event\.key === 'Enter'\) \{\s*event\.preventDefault\(\);/,
			);
			// Exactly one, and it is the authored one: React must never hoist a
			// second, unconditional call the way Solid's normalizeHandler did.
			expect(source.match(/event\.preventDefault\(\)/g)).toHaveLength(1);
		});

		test('a graph-state guard survives - the case Qwik refuses under V1', async () => {
			const ir = await buildEnrichedIr({
				filename: 'locked.tsrx',
				source: `import { state } from '@markless/core';

export function Locked({ onTrace }) @{
	let locked = state(true);

	<form>
		<button
			type="submit"
			onClick={(event) => {
				if (locked) {
					event.preventDefault();
					onTrace('blocked');
				}
			}}
		/>
		<output>{locked}</output>
	</form>
}
`,
			});
			expect(ir.records.events[0]!.syncPolicy).toEqual({
				when: { type: 'graph-truthy', graphNodeId: 'state:locked', path: [] },
				actions: ['preventDefault'],
			});
			const source = await formatEmitted(emit(ir));
			expect(source).toMatch(/if \(locked\) \{\s*event\.preventDefault\(\);/);
			expect(source.match(/event\.preventDefault\(\)/g)).toHaveLength(1);
		});

		test('an unconditional stopPropagation survives without a conjured preventDefault', async () => {
			const ir = await buildEnrichedIr({
				filename: 'stopper.tsrx',
				source: `import { state } from '@markless/core';

export function Stopper({ onTrace }) @{
	let seen = state(0);

	<form>
		<button
			type="button"
			onClick={(event) => {
				event.stopPropagation();
				seen = 1;
				onTrace('stop');
			}}
		/>
		<output>{seen}</output>
	</form>
}
`,
			});
			expect(ir.records.events[0]!.syncPolicy).toEqual({
				when: { type: 'constant-truthy', value: true },
				actions: ['stopPropagation'],
			});
			const source = await formatEmitted(emit(ir));
			expect(source).toContain('event.stopPropagation();');
			expect(source).not.toContain('preventDefault');
		});

		test('the declared-action cross-check refuses a policy the body does not spell', async () => {
			const ir = clone(
				await buildEnrichedIr({
					filename: 'guarded.tsrx',
					source: guarded(`event.key === 'Enter'`),
				}),
			) as any;
			ir.records.events[0].syncPolicy.actions = ['preventDefault', 'stopPropagation'];
			expect(() => emit(ir)).toThrow(
				"Sync policy stopPropagation is absent from event:0's handler AST",
			);
		});
	});

	/**
	 * T044. A state write inside ANY nested function - a `.then` continuation, a
	 * callback prop, a side-effecting array method - was emitted VERBATIM, as an
	 * assignment to the `const` that `useState` destructured. Write-lowering walks
	 * only the TOP-LEVEL statements of the handler body, so nothing rewrote it and
	 * nothing refused it either. The corpus has never contained a nested write, and
	 * that is the ONLY reason this was invisible: every emitted-output instrument in
	 * this repo, `emitted-typecheck.test.ts` included, only ever sees `generated/`.
	 *
	 * NOTHING HERE IS ABOUT ASYNC. `.then` is one spelling; the plain callback prop
	 * below reproduces it with no promise anywhere.
	 *
	 * The oracle is tsc, not us. `tscDiagnostics` runs the real TypeScript compiler
	 * over the emitted string exactly as the emitted-typecheck lane runs it over
	 * `generated/`, so the assertion below cannot pass by agreeing with an emitter
	 * rule we wrote ourselves.
	 */
	describe('a state write it cannot lower is refused, not miscompiled', () => {
		const nested = (body: string) => `import { state } from '@markless/core';

export function Deferred({ settle, defer, onTrace }) @{
	let ticks = state(0);
	let phase = state('idle');

	<div data-deferred-root="">
		<button
			type="button"
			data-action="run"
			onClick={(event) => {
${body}
				onTrace('run', event);
			}}
		/>
		<output data-cell="ticks">{ticks}</output>
		<output data-cell="phase">{phase}</output>
	</div>
}
`;

		const THEN_CONTINUATION = nested(`				phase = 'pending';
				settle().then(() => {
					ticks = ticks + 1;
					phase = 'done';
				});`);

		/** No promise, no `.then`, no async: the defect is about NESTING. */
		const CALLBACK_PROP = nested(`				defer(() => {
					ticks = ticks + 1;
				});`);

		/** The negative control: the same write, at the top level, must still lower. */
		const TOP_LEVEL = nested(`				ticks = ticks + 1;
				phase = 'done';`);

		const tscOptions: ts.CompilerOptions = {
			allowJs: true,
			checkJs: true,
			noEmit: true,
			strict: false,
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			jsx: ts.JsxEmit.ReactJSX,
			lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
			skipLibCheck: true,
			types: [],
		};

		/** Type-check an emitted string in place of a file inside `generated/`. */
		function tscDiagnostics(name: string, emitted: string): string[] {
			const file = resolve(generatedRoot, name);
			const host = ts.createCompilerHost(tscOptions, true);
			const read = host.readFile.bind(host);
			host.readFile = (candidate) => (candidate === file ? emitted : read(candidate));
			const exists = host.fileExists.bind(host);
			host.fileExists = (candidate) => candidate === file || exists(candidate);
			const program = ts.createProgram([file], tscOptions, host);
			return [...program.getSemanticDiagnostics(), ...program.getSyntacticDiagnostics()].map(
				(diagnostic) => {
					const at = diagnostic.file
						? ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start ?? 0)
						: { line: -1, character: -1 };
					const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
					return `${name}(${at.line + 1},${at.character + 1}): error TS${diagnostic.code}: ${text}`;
				},
			);
		}

		/** Emit, or capture the refusal. Never both. */
		async function emitOrRefuse(
			filename: string,
			source: string,
		): Promise<{ emitted: string; refusal: null } | { emitted: null; refusal: string }> {
			const ir = await buildEnrichedIr({ filename, source });
			try {
				return { emitted: await formatEmitted(emit(ir)), refusal: null };
			} catch (error) {
				return { emitted: null, refusal: (error as Error).message };
			}
		}

		/**
		 * THE WITNESS. Before the repair this failed with tsc's own words, which is
		 * the whole point of proof-before-fix:
		 *
		 *   nested-then.tsx(16,7): error TS2588: Cannot assign to 'ticks' because it
		 *   is a constant.
		 *   nested-then.tsx(17,7): error TS2588: Cannot assign to 'nextPhase' because
		 *   it is a constant.
		 *
		 * The invariant asserted is the honest one, and it is what survives the
		 * repair: the emitter may REFUSE a construct, and it may EMIT a construct,
		 * but it may never emit a construct tsc rejects. A refusal satisfies it; a
		 * silent miscompile does not.
		 */
		test.each([
			['nested-then', THEN_CONTINUATION],
			['nested-callback', CALLBACK_PROP],
			['top-level-control', TOP_LEVEL],
		])('%s: the emitter either refuses it or emits output tsc accepts', async (name, source) => {
			const result = await emitOrRefuse(`${name}.tsrx`, source);
			if (result.emitted === null) {
				// Refused. The control must NEVER take this branch.
				expect(name).not.toBe('top-level-control');
				return;
			}
			expect(tscDiagnostics(`${name}.tsx`, result.emitted)).toEqual([]);
		});

		test('the refusal names the write, the enclosing function, and the consequence', async () => {
			const result = await emitOrRefuse('nested-then.tsrx', THEN_CONTINUATION);
			expect(result.refusal).not.toBeNull();
			const message = result.refusal!;
			// The WRITE.
			expect(message).toContain('ticks');
			// The ENCLOSING FUNCTION - a bare "somewhere nested" teaches nothing when
			// a handler has several callbacks.
			expect(message).toContain('settle().then');
			// WHAT WOULD OTHERWISE HAVE HAPPENED. The failure mode was silent, so the
			// message has to carry the miscompile it prevented, by its tsc code.
			expect(message).toContain('TS2588');
			expect(message).toContain('useState');
			// The way out, and where the defect is recorded.
			expect(message).toMatch(/top level/);
			expect(message).toContain('docs/DEFECTS.md');
		});

		test('the plain callback prop is refused too - the defect is nesting, not promises', async () => {
			const result = await emitOrRefuse('nested-callback.tsrx', CALLBACK_PROP);
			expect(result.refusal).toContain('ticks');
			expect(result.refusal).toContain('defer');
			expect(result.emitted).toBeNull();
		});

		/**
		 * CALIBRATION, the other direction. An instrument that fires on everything is
		 * as useless as one that fires on nothing: this guard must be invisible to
		 * every handler the corpus actually contains. `preconditions` above proves the
		 * derived fixture table is the whole ratified corpus, so re-emitting all of it
		 * here is a real sweep rather than a spot check.
		 */
		test('the guard fires on NOTHING in the shipped corpus', async () => {
			for (const [, goldenName] of fixtures) {
				const ir = await golden(goldenName);
				expect(() => emit(ir)).not.toThrow();
			}
			for (const fixture of compositionFixtures) {
				await expect(emitCompositionFixture(fixture)).resolves.toBeTypeOf('string');
			}
		});

		/** And the control still lowers to the setter, unchanged by the guard. */
		test('a top-level write still lowers to the useState setter', async () => {
			const result = await emitOrRefuse('top-level-control.tsrx', TOP_LEVEL);
			expect(result.refusal).toBeNull();
			expect(result.emitted).toContain('setTicks(');
			expect(result.emitted).not.toMatch(/^\s*ticks = /m);
		});
	});

	/**
	 * ASYNC EVENT HANDLERS - T047 of frameless-defects-and-targets-v1.
	 *
	 * Until this card the React emitter could not emit ANY handler containing
	 * `await`. THE WITNESSED RED, verbatim, on the source below before the repair:
	 *
	 *   yuku-analyzer rejected emitted handler: 'await' is reserved in an
	 *   async/module context and cannot be used as an identifier; Expected a
	 *   semicolon or an implicit semicolon after a statement, but found 'ready'
	 *
	 * The frames are given BY SYMBOL rather than by line, which is also how they
	 * were already abbreviated here - the raw trace carries absolute paths and
	 * columns, so no ordinal in this block was ever a transcript byte. Innermost
	 * first, all four in `packages/frameworks/react/src/emitter/index.ts`:
	 * `reanalyzeFunction` <- `replaceFreeNames` <- `replaceVersionReads` <-
	 * `toConstSsa`. `reanalyzeFunction`'s own doc comment records the same chain.
	 *
	 * `buildEnrichedIr` and `validateEnrichedIr` BOTH succeeded - unlike the Solid
	 * lane, React's refusal was not a validator rule but a scratch wrapper in the
	 * lowering, so it fired at `emit` only. See docs/DEFECTS.md entry 12.
	 *
	 * NO FIXTURE AND NO GOLDEN ARE REGISTERED. The scenario inventories are derived
	 * from `goldens/s<n>-*.json`, so a golden alone would enlist this probe into
	 * every lane's gates. It is a probe source, per the T039/T046 pattern.
	 */
	describe('async event handlers', () => {
		const asyncProbeSource = (opening: string): string => `import { state } from '@markless/core';

export function AsyncProbe({ ready, onTrace }) @{
	let ticks = state(0);
	let phase = state('idle');

	<form>
		<button
			type="button"
			data-action="run"
			onClick={async (event) => {${opening}
				phase = 'pending';
				await ready;
				ticks = ticks + 1;
				phase = 'done';
				onTrace('run', { phase: 'done' }, event);
			}}
		/>
		<output data-role="ticks">{ticks}</output>
		<output data-role="phase">{phase}</output>
	</form>
}
`;
		/** The re-specified S8 authoring: `await` on a promise-VALUED prop. */
		const plain = asyncProbeSource('');
		/** Same, opening with Defect 1's shape inside an async body. */
		const cancelling = asyncProbeSource('\n\t\t\t\tevent.preventDefault();');

		async function emitProbe(source: string): Promise<string> {
			const ir = await buildEnrichedIr({ filename: 'async-probe.tsrx', source });
			expect(() => validateEnrichedIr(ir)).not.toThrow();
			return await formatEmitted(emit(ir));
		}

		/** Lift the emitted `onClick` arrow back out of the emitted JSX, by AST. */
		function emittedHandler(emitted: string): string {
			const module = analyze(emitted, {
				lang: 'tsx',
				sourceType: 'module',
				preserveParens: false,
			});
			expect(module.diagnostics).toEqual([]);
			let handler: any = null;
			const walk = (node: any): void => {
				if (!node || typeof node !== 'object') return;
				if (Array.isArray(node)) {
					node.forEach(walk);
					return;
				}
				if (node.type === 'JSXAttribute' && node.name?.name === 'onClick')
					handler = node.value?.expression ?? node.value;
				for (const key of Object.keys(node))
					if (key !== 'loc' && key !== 'range') walk(node[key]);
			};
			walk(module.ast);
			expect(handler, 'no onClick attribute in the emitted source').not.toBeNull();
			// The direct detector for a reverted `fn.async = true`: without it nothing
			// above this line even gets to run, because `emit` throws.
			expect(handler.async, 'the emitted arrow lost its `async` modifier').toBe(true);
			return generate(handler).code;
		}

		type Dispatched = {
			readonly rendered: readonly string[];
			readonly duringSuspension: string;
			readonly afterOverlap: string;
			readonly afterSequential: string;
			readonly prevented: number;
			readonly trace: readonly string[];
		};

		/**
		 * Rebuild the emitted component body EXACTLY - the same prop destructuring
		 * and the same two `useState` calls - and drive it with the real renderer.
		 * Dispatches TWICE while the first call is still suspended at the `await`,
		 * which is the case that separates a live read from one captured before the
		 * boundary, then a third time from the NEWEST render's closure, which is what
		 * a real user's third click would get after React re-rendered and reattached.
		 */
		async function dispatchAcrossAwait(handlerSource: string): Promise<Dispatched> {
			const build = new Function(
				'useState',
				'props',
				`const { ready, onTrace } = props;
				const [ticks, setTicks] = useState(0);
				const [phase, setPhase] = useState('idle');
				return { ticks, phase, handler: (${handlerSource}) };`,
			) as (
				hook: typeof useState,
				props: unknown,
			) => { ticks: number; phase: string; handler: (event: unknown) => unknown };
			const trace: string[] = [];
			const rendered: string[] = [];
			let prevented = 0;
			let release!: () => void;
			const ready = new Promise<void>((resolve) => {
				release = resolve;
			});
			const props = {
				ready,
				onTrace: (name: string, payload: unknown) =>
					trace.push(`${name}:${JSON.stringify(payload)}`),
			};
			let latest: ReturnType<typeof build> | null = null;
			function Probe(): ReactElement {
				// The component body IS the emitted one: the same destructuring, the
				// same hooks, in the same order. The render reads the very cells the
				// lifted handler writes, so nothing can pass by observing a different
				// pair of `useState`s from the ones under test.
				const view = build(useState, props);
				latest = view;
				return createElement('output', null, `${String(view.ticks)}|${String(view.phase)}`);
			}
			const container = (globalThis as any).document.createElement('div');
			const root = ReactDOMClient.createRoot(container);
			const event = { preventDefault: () => (prevented += 1) };
			await act(async () => {
				root.render(createElement(Probe));
			});
			rendered.push(container.textContent);
			const captured = latest!.handler;
			let first: unknown;
			let second: unknown;
			await act(async () => {
				first = captured(event);
				second = captured(event);
			});
			const duringSuspension = container.textContent;
			rendered.push(duringSuspension);
			await act(async () => {
				release();
				await first;
				await second;
			});
			const afterOverlap = container.textContent;
			rendered.push(afterOverlap);
			await act(async () => {
				await latest!.handler(event);
			});
			const afterSequential = container.textContent;
			rendered.push(afterSequential);
			await act(async () => {
				root.unmount();
			});
			return { rendered, duringSuspension, afterOverlap, afterSequential, prevented, trace };
		}

		test('accepts an async handler and keeps `async` and `await` in the output', async () => {
			const emitted = await emitProbe(plain);
			expect(emitted).toContain('onClick={async (event) => {');
			expect(emitted).toContain('await ready;');
			// T003: the two 12.2 repairs, read STRUCTURALLY. The pre-await write
			// survives the sync retention, and the post-await read of the cell being
			// written is a functional updater rather than a closure read.
			expect(emitted).toContain('setTicks((currentTicks) => currentTicks + 1);');
			expect(emitted).toContain('setPhase(nextPhase);');
			expect(emitted).toContain("const nextPhase = 'pending';");
			expect(emitted).not.toContain('const nextTicks =');
			// ORDER, not just presence: the pending sync is BEFORE the boundary and the
			// increment and the done sync are after it. A body that emitted all six
			// lines in the wrong order would satisfy every `toContain` above.
			const positions = [
				"const nextPhase = 'pending';",
				'setPhase(nextPhase);',
				'await ready;',
				'setTicks((currentTicks) => currentTicks + 1);',
				"const nextPhase2 = 'done';",
				'setPhase(nextPhase2);',
			].map((line) => emitted.indexOf(line));
			expect(positions).not.toContain(-1);
			expect(positions).toEqual([...positions].sort((left, right) => left - right));
		});

		/**
		 * DEFECTS.md 12.2 CLOSED - THE WITNESSED BEFORE AND AFTER, T003.
		 *
		 * T043 predicted from the shape of `toConstSsa` that React reads the RENDER
		 * CLOSURE where Solid reads the live signal. Measured against real `react-dom`
		 * 19.2.3 with the identical three-dispatch sequence the Solid lane uses, the
		 * prediction held, and a second independent defect rode with it. This arm
		 * PINNED THAT DEFECT until T003, and DEFECTS.md 12.2 instructed in writing
		 * that it be rewritten to the calibration's numbers on repair. It is:
		 *
		 *                RED (before T003)   GREEN (after)   calibration / solid
		 *   suspended         0|idle            0|pending         0|pending
		 *   overlap 2         1|done            2|done            2|done
		 *   sequential        2|done            3|done            3|done
		 *   renders             3                 4                 4
		 *
		 * The RED, verbatim, was the emitted handler below - `setPhase('pending')`
		 * ABSENT and `ticks` read from the render closure:
		 *
		 *   async (event) => {
		 *     await ready;
		 *     const nextTicks = ticks + 1;
		 *     setTicks(nextTicks);
		 *     const nextPhase = 'done';
		 *     setPhase(nextPhase);
		 *     onTrace('run', { phase: 'done' }, event);
		 *   }
		 *
		 * The two causes and the two repairs, both in `toConstSsa`:
		 *
		 *   (a) STALE CLOSURE. `const nextTicks = ticks + 1` read the `useState`
		 *       binding of the render that created the handler, so two dispatches
		 *       overlapping at the `await` both computed 0 + 1 and two clicks produced
		 *       ONE increment. `liftPostAwaitReadsToUpdaters` folds that version and
		 *       its sync into `setTicks((currentTicks) => currentTicks + 1)`.
		 *   (b) DROPPED PRE-AWAIT WRITE. The authored `phase = 'pending'` never
		 *       reached the output: the final-sync retention keeps one sync per cell,
		 *       which is sound only while nothing can render in between. The retention
		 *       is now SEGMENTED at every suspending statement.
		 *
		 * THE CALIBRATION ARM BELOW IS THE CONTROL AND IT DID NOT MOVE. Both arms now
		 * report the same row, over two different handlers - one emitted, one
		 * hand-written - so the row is a property of the lowering and not of the
		 * instrument.
		 */
		test('REPAIRED: dispatches across the await read LIVE and the pending write survives', async () => {
			const outcome = await dispatchAcrossAwait(emittedHandler(await emitProbe(plain)));
			// (b) the pre-await write reaches the output and IS rendered.
			expect(outcome.duringSuspension).toBe('0|pending');
			expect(outcome.rendered).toContain('0|pending');
			// (a) two overlapping dispatches now produce TWO increments, as Solid does.
			expect(outcome.afterOverlap).toBe('2|done');
			// A third dispatch from the newest closure adds one more. Solid gives 3.
			expect(outcome.afterSequential).toBe('3|done');
			// FOUR observations where the defect produced three: the extra one is the
			// `pending` render that (b) used to delete.
			expect(outcome.rendered).toEqual(['0|idle', '0|pending', '2|done', '3|done']);
			// The handler still ran three times end to end.
			expect(outcome.trace).toEqual([
				'run:{"phase":"done"}',
				'run:{"phase":"done"}',
				'run:{"phase":"done"}',
			]);
		});

		/**
		 * CALIBRATION: the harness CAN report the clean numbers.
		 *
		 * The same harness, the same dispatch sequence, over a hand-written handler
		 * that reads live - React's own idiomatic answer, the functional updater,
		 * plus the un-collapsed pre-await write. It reports exactly what Solid
		 * measured: `0|pending` while suspended, 2 after the overlap, 3 after the
		 * third dispatch. So the numbers above are a property of the EMITTED code and
		 * not of the instrument, and an instrument that cannot fail is not one.
		 */
		test('CALIBRATION: a live-reading handler reports Solid’s numbers on the same harness', async () => {
			const live = `async (event) => {
				setPhase('pending');
				await ready;
				setTicks((current) => current + 1);
				setPhase('done');
				onTrace('run', { phase: 'done' }, event);
			}`;
			const outcome = await dispatchAcrossAwait(live);
			expect(outcome.duringSuspension).toBe('0|pending');
			expect(outcome.afterOverlap).toBe('2|done');
			expect(outcome.afterSequential).toBe('3|done');
		});

		/**
		 * THE V-LIMIT T003 RECORDED RATHER THAN ENGINEERED AROUND, MEASURED.
		 *
		 * A functional updater receives ONE cell's value. Where a post-`await` write
		 * reads a DIFFERENT cell, no shape of `setX((current) => ...)` can read that
		 * second cell live, so `liftPostAwaitReadsToUpdaters` declines and the closure
		 * read stands. Closing it needs a ref mirror or a reducer over a record - a
		 * design change, not a bigger updater - so it is pinned here as an OPEN limit
		 * with its triggering authoring, exactly as docs/DEFECTS.md 12.2 now records
		 * it. This arm goes red the day someone closes it, which is the point.
		 */
		test('V-LIMIT, MEASURED: a post-await read of ANOTHER cell still reads the closure', async () => {
			const emitted = await emitProbe(`import { state } from '@markless/core';

export function CrossCellProbe({ ready, onTrace }) @{
	let ticks = state(0);
	let mirror = state(0);

	<form>
		<button
			type="button"
			data-action="run"
			onClick={async (event) => {
				await ready;
				ticks = ticks + 1;
				mirror = ticks + 1;
				onTrace('run', event);
			}}
		>Run</button>
		<output data-role="ticks">{ticks}</output>
		<output data-role="mirror">{mirror}</output>
	</form>
}
`);
			// `ticks` writes itself, so IT is repaired - but its version is then read
			// again by `mirror`, so the fold declines on BOTH and the pair stays in the
			// const-SSA form. Neither line is the repair; both are the limit.
			expect(emitted).toContain('const nextTicks = ticks + 1;');
			expect(emitted).toContain('const nextMirror = nextTicks + 1;');
			expect(emitted).not.toContain('setTicks((');
			expect(emitted).not.toContain('setMirror((');
		});

		test('preserves the authored preventDefault at the top of an async body', async () => {
			const emitted = await emitProbe(cancelling);
			expect(emitted).toMatch(/onClick=\{async \(event\) => \{\s*event\.preventDefault\(\);/);
			expect(emitted.match(/event\.preventDefault\(\)/g)).toHaveLength(1);
			const outcome = await dispatchAcrossAwait(emittedHandler(emitted));
			// It runs on every dispatch, including the two that overlap at the await.
			expect(outcome.prevented).toBe(3);
		});

		/**
		 * The wrapper is a SCRATCH arrow that never reaches output, so the async flag
		 * must not leak into anything emitted. A synchronous handler still emits a
		 * synchronous arrow - the `generated/` diff in this card's verify is the
		 * corpus-wide version of this claim; this is the direct one.
		 */
		test('the async scratch wrapper does not leak into a synchronous handler', async () => {
			const emitted = await emitProbe(`import { state } from '@markless/core';

export function SyncProbe({ onTrace }) @{
	let ticks = state(0);

	<form>
		<button
			type="button"
			data-action="run"
			onClick={(event) => {
				ticks = ticks + 1;
				onTrace('run', event);
			}}
		/>
		<output data-role="ticks">{ticks}</output>
	</form>
}
`);
			expect(emitted).toContain('onClick={(event) => {');
			expect(emitted).not.toContain('async');
			expect(emitted).toContain('setTicks(nextTicks);');
		});
	});

	describe('metamorphic regeneration from the checked-in golden', () => {
		test.each(['a"b', "a'b", 'a\nb', 'a{b}', '雪☃', '&quot;&amp;'])(
			'static JSX attributes round-trip with value fidelity: %j',
			async (value) => {
				const ir = clone(await golden('s1-render-once.json'));
				const root = ir.components[0]!.template[0];
				if (root?.kind !== 'host') throw new Error('expected host root');
				(root.staticAttributes as any[]).push({ name: 'data-probe', value });
				const source = emit(ir);
				const module = analyze(source, { lang: 'tsx', sourceType: 'module' });
				expect(module.diagnostics).toEqual([]);
				let actual: unknown;
				module.walk({
					JSXAttribute(node: any) {
						if (node.name.name !== 'data-probe') return;
						actual =
							node.value.type === 'Literal'
								? node.value.value
								: node.value.expression.value;
					},
				});
				expect(actual).toBe(value);
			},
		);

		test.each([
			[
				'hook import',
				'count',
				'useState',
				/useState as useState2/,
				/const \[useState, setUseState\] = useState2\(1\)/,
			],
			[
				'ref hook import',
				'count',
				'useRef',
				/useRef as useRef2/,
				/const setupDone = useRef2\(/,
			],
			[
				'setter',
				'prefix',
				'setCount',
				/const \[count, setCount2\]/,
				/setCount2\(nextCount\)/,
			],
			[
				'next snapshot',
				'prefix',
				'nextCount',
				/const nextCount2 = count \+ 1/,
				/setCount\(nextCount2\)/,
			],
			[
				'ref snapshot',
				'complete',
				'currentState2',
				/const currentState2_2 = next\.current/,
				/next\.current = currentState2_2 \+ 1/,
			],
			[
				'once guard',
				'prefix',
				'setupDone',
				/const setupDone2 = useRef\(null\)/,
				/setupDone2\.current/,
			],
		] as const)(
			'allocates the generated %s family around authored identifiers',
			async (_family, from, to, declaration, use) => {
				const fixture =
					to === 'currentState2' ? 's2-keyed-todo.json' : 's1-render-once.json';
				const ir = clone(await golden(fixture)) as any;
				visit(ir, (record) => {
					if (record.type === 'Identifier' && record.name === from) record.name = to;
					if (record.name === from) record.name = to;
				});
				ir.components[0].locals.forEach((local: any) => {
					local.names = local.names.map((name: string) => (name === from ? to : name));
				});
				const source = emit(ir);
				expect(source).toMatch(declaration);
				expect(source).toMatch(use);
			},
		);
		// These mutations mirror the poc/07 regeneration stance: mutate the semantic
		// artifact in memory, emit it through the public boundary, and compare only
		// the output dimension that the mutation is allowed to change.
		test('an added static attribute changes only that host attribute', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			const root = ir.components[0]!.template[0];
			expect(root?.kind).toBe('host');
			if (root?.kind !== 'host') return;
			(root.staticAttributes as any[]).push({ name: 'data-metamorphic', value: 'yes' });
			const changed = emit(ir);
			expect(changed).toContain('data-metamorphic="yes"');
			expect(changed.replace(' data-metamorphic="yes"', '')).toBe(
				emit(await golden('s1-render-once.json')),
			);
		});

		test('scrambled local storage order still follows the semantic order field', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			(ir.components[0]!.locals as any[]).reverse();
			expect(emit(ir)).toBe(emit(await golden('s1-render-once.json')));
		});

		test('component, state, and ordinary-local renames are spelling-invariant', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			const renames = new Map([
				['RenderOnce', 'RenamedRender'],
				['count', 'total'],
				['prefix', 'caption'],
			]);
			visit(ir, (record) => {
				if (typeof record.name === 'string' && renames.has(record.name))
					record.name = renames.get(record.name);
				if (record.type === 'Identifier' && renames.has(record.name))
					record.name = renames.get(record.name);
			});
			ir.components[0]!.locals.forEach((local: any) => {
				local.names = local.names.map((name: string) => renames.get(name) ?? name);
			});
			(ir.components[0] as any).name = 'RenamedRender';
			(ir.module.exports[0] as any).componentName = 'RenamedRender';
			(ir.module.exports[0] as any).exportedName = 'RenamedRender';
			const changed = emit(ir);
			expect(changed).toContain('function RenamedRender');
			expect(changed).toContain('const [total, setTotal]');
			expect(changed).toContain('const [caption]');
			const normalized = changed
				.replaceAll('RenamedRender', 'RenderOnce')
				.replaceAll('setTotal', 'setCount')
				.replaceAll('nextTotal', 'nextCount')
				.replaceAll('total', 'count')
				.replaceAll('caption', 'prefix');
			expect(normalized).toBe(emit(await golden('s1-render-once.json')));
		});

		test('a nested callback shadowing a state name is not rewritten', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			const handler = ir.records.events[0]!.handlers[0]!.expression as any;
			handler.body.body.unshift({
				type: 'ExpressionStatement',
				expression: {
					type: 'CallExpression',
					optional: false,
					callee: {
						type: 'ArrowFunctionExpression',
						async: false,
						expression: true,
						params: [{ type: 'Identifier', name: 'count' }],
						body: { type: 'Identifier', name: 'count' },
					},
					arguments: [{ type: 'Literal', value: 7, raw: '7' }],
				},
			});
			const changed = emit(ir);
			expect(changed).toContain('((count) => count)(7)');
			expect(changed).toContain('const nextCount = count + 1');
		});

		test('allocates every generated identifier family around authored names', async () => {
			const hook = clone(await golden('s1-render-once.json'));
			renameIdentifier(hook, 'count', 'useState');
			const hookSource = emit(hook);
			expect(hookSource).toContain('useState as useState2');
			expect(hookSource).toContain('const [useState, setUseState] = useState2(1)');
			const hookModule = analyze(hookSource, {
				lang: 'tsx',
				sourceType: 'module',
				preserveParens: false,
			});
			const hookImport = hookModule.symbols.find((symbol) =>
				symbol.declarations.some(
					(node: any) => node.type === 'Identifier' && node.name === 'useState2',
				),
			);
			expect(hookImport?.references.length).toBeGreaterThan(0);
			expect(
				hookImport?.references.every((reference) => reference.symbol === hookImport),
			).toBe(true);

			const setter = clone(await golden('s1-render-once.json')) as any;
			setter.records.events[0].handlers[0].expression.body.body.unshift({
				type: 'VariableDeclaration',
				kind: 'const',
				declarations: [
					{
						type: 'VariableDeclarator',
						id: { type: 'Identifier', name: 'setCount' },
						init: { type: 'Literal', value: 0, raw: '0' },
					},
				],
			});
			expect(emit(setter)).toContain('const [count, setCount2] = useState(1)');

			const next = clone(await golden('s1-render-once.json')) as any;
			next.records.events[0].handlers[0].expression.body.body.unshift({
				type: 'VariableDeclaration',
				kind: 'const',
				declarations: [
					{
						type: 'VariableDeclarator',
						id: { type: 'Identifier', name: 'nextCount' },
						init: { type: 'Literal', value: 0, raw: '0' },
					},
				],
			});
			expect(emit(next)).toContain('const nextCount2 = count + 1');

			const setup = clone(await golden('s1-render-once.json'));
			renameIdentifier(setup, 'prefix', 'setupDone');
			expect(emit(setup)).toContain('const setupDone2 = useRef(null)');

			const snapshot = clone(await golden('s2-keyed-todo.json')) as any;
			snapshot.records.events[1].handlers[0].expression.body.body.unshift({
				type: 'VariableDeclaration',
				kind: 'const',
				declarations: [
					{
						type: 'VariableDeclarator',
						id: { type: 'Identifier', name: 'currentState2' },
						init: { type: 'Literal', value: 0, raw: '0' },
					},
				],
			});
			expect(emit(snapshot)).toContain('const currentState2_2 = next.current');
		});

		test('keeps duplicate authored setCount declarations fail-closed', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.records.events[0].handlers[0].expression.body.body.unshift({
				type: 'VariableDeclaration',
				kind: 'const',
				declarations: [
					{
						type: 'VariableDeclarator',
						id: { type: 'Identifier', name: 'setCount' },
						init: { type: 'Literal', value: 0, raw: '0' },
					},
					{
						type: 'VariableDeclarator',
						id: { type: 'Identifier', name: 'setCount' },
						init: { type: 'Literal', value: 1, raw: '1' },
					},
				],
			});
			expect(() => emit(ir)).toThrow(
				/yuku-analyzer rejected emitted handler|collision verification/,
			);
		});

		test.each(['a"b', "a'b", 'a\nb', 'a{b}', '雪❄', 'a&amp;b'])(
			'round-trips the static JSX attribute value %j',
			async (value) => {
				const ir = clone(await golden('s1-render-once.json'));
				const root = ir.components[0]!.template[0];
				if (root?.kind !== 'host') throw new Error('expected host root');
				(root.staticAttributes as any[]).push({ name: 'data-probe', value });
				const source = emit(ir);
				expect(staticAttributeValue(source, 'data-probe')).toBe(value);
			},
		);
	});

	describe('frameless-enriched-ir/2 composition emission', () => {
		const build = (filename: string, source: string) => buildEnrichedIr({ filename, source });

		test('allocates generated locals per component scope while preserving authored props', async () => {
			const ir = await build(
				'src/component-scopes.tsrx',
				`import { state } from "@markless/core";
				function Colliding({ first }) @{ let collision = state(1); let node = state(2); <output attach={(host) => { host.dataset.value = String(first + collision); }}>{node}</output> }
				function Clean() @{ <output attach={(host) => { host.dataset.value = "clean"; }}>clean</output> }
				export function Page() @{ <><Colliding first={1} /><Clean /></> }`,
			);
			renameIdentifier(ir, 'collision', 'props');
			const source = emit(ir);
			expect(source).toContain('function Colliding({ first })');
			expect(source).toContain('function Clean()');
			expect(source).toMatch(/const attachHost\d* = useCallback\(\(node2\) =>/);
			expect(source).toMatch(/const attachHost\d* = useCallback\(\(node\) =>/);
			expect(source).not.toContain('(node3) =>');
		});

		test('emits bare-authored static attributes as explicit empty strings', async () => {
			const ir = await build(
				'src/static-attributes.tsrx',
				`export function StaticAttributes() @{ <main data-bare data-explicit="" /> }`,
			);
			const root = ir.components[0]!.template[0];
			if (root?.kind !== 'host') throw new Error('expected host root');
			expect(root.staticAttributes).toEqual([
				{ name: 'data-bare', value: true },
				{ name: 'data-explicit', value: '' },
			]);
			expect(emit(ir)).toContain('<main data-bare="" data-explicit="" />');
		});

		test('emits every local/exported component, nested JSX, slots, and generated-extension imports', async () => {
			const local = await build(
				'src/composition.tsrx',
				`function Frame({ children }) @{ <section>{children}</section> }
				export function Page() @{ <Frame><strong>projected</strong></Frame> }`,
			);
			const source = emit(local);
			expect(source).toContain('function Frame({ children })');
			expect(source).toContain('export function Page()');
			expect(source).toContain('<Frame><strong>projected</strong></Frame>');
			expect(source).toContain('<section>{children}</section>');

			const external = await build(
				'src/parent.tsrx',
				`import { Child } from "./child.tsrx";
				export function Parent() @{ <Child value={1}><span>nested</span></Child> }`,
			);
			expect(emit(external)).toContain("import { Child } from './child.jsx'");
		});

		test('emits the authored hook and notification-atomic per-cell store tier', async () => {
			const ir = await build(
				'src/shared.tsrx',
				`import { shared, state } from "@markless/core";
				export const useCounter = shared(() => { let count = state(0); let status = state("ready"); return { count, status, increment() { count++; status = "updated"; } }; }, { scope: "container" });
				export function Counter() @{ const counter = useCounter(); <button onClick={() => counter.increment()}>{counter.count}</button> }`,
			);
			const source = emit(ir);
			expect(source).toContain('function createCounterStore()');
			expect(source).toContain('function useCounter(cell)');
			expect(source).toContain('export function CounterProvider({ children })');
			expect(source).toContain('Object.is(count, nextCount)');
			expect(source).toContain("changed.add('count')");
			expect(source.indexOf('writeCount(count + 1, changed)')).toBeLessThan(
				source.indexOf("writeStatus('updated', changed)"),
			);
			expect(source.indexOf("writeStatus('updated', changed)")).toBeLessThan(
				source.indexOf('for (const changedCell of changed)'),
			);
			expect(source).toContain('countVersion++');
			expect(source).toContain('countSnapshot = count');
			expect(source).toContain('countSnapshotVersion !== countVersion');
			expect(source).toContain("count: useCounter('count')");
		});

		test('deduplicates generated shared-family suffixes without changing authored or non-overlapping names', async () => {
			const store = await build(
				'src/store-suffix.tsrx',
				`import { shared, state } from "@markless/core"; export const useCompositionStore = shared(() => { let value = state(0); return { value, increment() { value++; } }; }); export function Reader() @{ const sharedValue = useCompositionStore(); <button onClick={() => sharedValue.increment()}>{sharedValue.value}</button> }`,
			);
			const storeSource = emit(store);
			expect(storeSource).toContain('function createCompositionStore()');
			expect(storeSource).not.toContain('createCompositionStoreStore');
			expect(storeSource).toContain('function useCompositionStore(cell)');
			const pageStore = clone(store) as any;
			pageStore.records.sharedDefinitions[0].scope = 'page';
			expect(emit(pageStore)).toContain(
				'const compositionStore = createCompositionStore()',
			);

			const context = await build(
				'src/context-suffix.tsrx',
				`import { shared, state } from "@markless/core"; export const useCompositionContext = shared(() => { let value = state(0); return { value }; }); export function Reader() @{ const sharedValue = useCompositionContext(); <output>{sharedValue.value}</output> }`,
			);
			expect(emit(context)).toContain('const CompositionContext = createContext(null)');

			const provider = await build(
				'src/provider-suffix.tsrx',
				`import { shared, state } from "@markless/core"; export const useCompositionProvider = shared(() => { let value = state(0); return { value }; }); export function Reader() @{ const sharedValue = useCompositionProvider(); <output>{sharedValue.value}</output> }`,
			);
			expect(emit(provider)).toContain('export function CompositionProvider({ children })');

			const fallback = await build(
				'src/fallback-suffix.tsrx',
				`import { shared, state } from "@markless/core"; export const useCompositionToNothing = shared(() => { let value = state(0); return { value, increment() { value++; } }; }); export function Reader() @{ const sharedValue = useCompositionToNothing(); <button onClick={() => sharedValue.increment()}>{sharedValue.value}</button> }`,
			);
			const fallbackSource = emit(fallback);
			expect(fallbackSource).toContain('const subscribeCompositionToNothing =');
			expect(fallbackSource).toContain('const getCompositionToNothing =');
			expect(fallbackSource).not.toContain('ToNothingToNothing');

			const ledger = await build(
				'src/ledger-suffix.tsrx',
				`import { shared, state } from "@markless/core"; export const useLedger = shared(() => { let value = state(0); return { value, increment() { value++; } }; }); export function Reader() @{ const ledger = useLedger(); <button onClick={() => ledger.increment()}>{ledger.value}</button> }`,
			);
			const ledgerSource = emit(ledger);
			expect(ledgerSource).toContain('function createLedgerStore()');
			expect(ledgerSource).toContain('const LedgerContext = createContext(null)');
			expect(ledgerSource).toContain('export function LedgerProvider({ children })');
		});

		test('selects scalar context and page module-store tiers from SharedDefinition records', async () => {
			const props = await build(
				'src/props-tier.tsrx',
				`import { shared, state } from "@markless/core";
				export const useValue = shared(() => { let value = state(1); return { value }; }, { scope: "container" });
				function Reader() @{ const sharedValue = useValue(); <output>{sharedValue.value}</output> }
				export function Page() @{ <Reader /> }`,
			);
			const propsSource = emit(props);
			expect(propsSource).toContain('const [valueSharedValue] = useState(1)');
			expect(propsSource).toContain('function Reader({ valueSharedValue })');
			expect(propsSource).toContain('export function Page()');
			expect(propsSource).toContain('<Reader valueSharedValue={valueSharedValue} />');
			expect(propsSource).not.toContain('ValueContext');

			const scalar = await build(
				'src/scalar.tsrx',
				`import { shared, state } from "@markless/core";
				export const useValue = shared(() => { let value = state(1); return { value }; }, { scope: "container" });
				export function Reader() @{ const sharedValue = useValue(); <output>{sharedValue.value}</output> }`,
			);
			const scalarSource = emit(scalar);
			expect(scalarSource).toContain('const ValueContext = createContext(null)');
			expect(scalarSource).toContain('function useValue()');
			expect(scalarSource).not.toContain('useSyncExternalStore');

			const object = await build(
				'src/object-context.tsrx',
				`import { shared, state } from "@markless/core";
				export const usePair = shared(() => { let left = state(1); let right = state(2); return { left, right }; }, { scope: "container" });
				export function Pair() @{ const pair = usePair(); <output>{pair.left}:{pair.right}</output> }`,
			);
			const objectSource = emit(object);
			expect(objectSource).toContain('const PairContext = createContext(null)');
			expect(objectSource).toContain('const [value] = useState(');
			expect(objectSource).toContain('const pair = usePair()');
			expect(objectSource).not.toContain('useSyncExternalStore');

			const page = clone(scalar) as any;
			page.records.sharedDefinitions[0].scope = 'page';
			page.records.sharedDefinitions[0].methods = [
				{
					name: 'set',
					site: {
						type: 'Property',
						value: {
							type: 'FunctionExpression',
							params: [],
							body: { type: 'BlockStatement', body: [] },
						},
					},
					writes: [],
				},
			];
			page.records.sharedDefinitions[0].returnProperties.push({
				kind: 'method',
				name: 'set',
			});
			const pageSource = emit(page);
			expect(pageSource).toContain('const valueStore = createValueStore()');
			expect(pageSource).not.toContain('ValueProvider');
		});

		test('emits direct handles and one memoized callback ref with reverse cleanup', async () => {
			const ir = await build(
				'src/handles.tsrx',
				`import { element } from "@markless/core";
				export function Search() @{ const input = element<HTMLInputElement>(); <><input el={input} attach={(node) => { node.dataset.ready = "yes"; return () => { delete node.dataset.ready; }; }} /><button onClick={() => input?.focus()}>focus</button></> }`,
			);
			const source = emit(ir);
			expect(source).toContain('const input = useRef(null)');
			expect(source).toContain('const attachInput = useCallback(');
			expect(source).toContain('input.current = node');
			expect(source).toContain("if (typeof cleanup === 'function')");
			expect(source.indexOf('cleanup();')).toBeLessThan(
				source.indexOf('input.current = null'),
			);
			expect(source).toContain('if (input.current !== null)');
			expect(source).not.toMatch(/forwardRef|useImperativeHandle|Children\.|cloneElement/);
		});

		test('forwards a parent-owned handle through a same-module component edge', async () => {
			const ir = await build(
				'src/forward.tsrx',
				`import { element } from "@markless/core";
				function Field(props) @{ <input el={props.input} /> }
				export function Page() @{ const input = element<HTMLInputElement>(); <Field input={input} /> }`,
			);
			const source = emit(ir);
			expect(source).toContain('function Field({ ref })');
			expect(source).toContain('<input ref={ref} />');
			expect(source).toContain('<Field ref={input} />');
			expect(source).not.toMatch(/forwardRef|useImperativeHandle/);
		});

		test('renames the authored shared hook and cell coherently', async () => {
			const ir = (await build(
				'src/rename-shared.tsrx',
				`import { shared, state } from "@markless/core";
				export const useCounter = shared(() => { let count = state(0); return { count, increment() { count++; } }; });
				export function Counter() @{ const counter = useCounter(); <button onClick={() => counter.increment()}>{counter.count}</button> }`,
			)) as any;
			visit(ir, (record) => {
				if (record.type === 'Identifier' && record.name === 'count') record.name = 'total';
				if (record.type === 'Identifier' && record.name === 'useCounter')
					record.name = 'useMeter';
			});
			ir.records.sharedDefinitions[0].name = 'useMeter';
			ir.records.sharedDefinitions[0].cells[0].name = 'total';
			ir.records.sharedDefinitions[0].returnProperties[0].name = 'total';
			ir.records.sharedReads[0].propertyName = 'total';
			const source = emit(ir);
			expect(source).toContain('function useMeter(cell)');
			expect(source).toContain('let total = 0');
			expect(source).toContain("total: useMeter('total')");
			expect(source).not.toContain('function useCounter');
		});

		test('allocates provider and store-internal generated families around authored names', async () => {
			const ir = await build(
				'src/collisions.tsrx',
				`import { shared, state } from "@markless/core";
				export const useCounter = shared(() => { let count = state(0); let countVersion = state(1); let countSnapshot = state(2); let countListeners = state(3); let writeCount = state(4); let nextCount = state(5); return { count, countVersion, countSnapshot, countListeners, writeCount, nextCount, increment() { count++; } }; });
				export function CounterProvider() @{ <aside>authored</aside> }
				export function Counter() @{ const counter = useCounter(); <button onClick={() => counter.increment()}>{counter.count}</button> }`,
			);
			const source = emit(ir);
			expect(source).toContain('export function CounterProvider2({ children })');
			expect(source).toContain('let countVersion2 = 0');
			expect(source).toContain('let countSnapshot2 = count');
			expect(source).toContain('const countListeners2 = new Set()');
			expect(source).toContain('const writeCount2 =');
			expect(analyze(source, { lang: 'tsx', sourceType: 'module' }).diagnostics).toEqual([]);
		});

		test('durably allocates every shared generated name family around authored collisions', async () => {
			const ir = await build(
				'src/shared-family-collisions.tsrx',
				`import { shared, state } from "@markless/core";
				export const useLedger = shared(() => { let balance = state(0); return { balance, increment() { balance++; } }; }, { scope: "container" });
				function LedgerContext() @{ <i>context</i> }
				function createLedgerStore() @{ <i>creator</i> }
				function subscribeLedgerToNothing() @{ <i>subscribe</i> }
				function getLedgerNothing() @{ <i>get</i> }
				function ledgerStore() @{ <i>module store</i> }
				export function Ledger() @{ const ledger = useLedger(); <button onClick={() => ledger.increment()}>{ledger.balance}</button> }`,
			);
			const containerSource = emit(ir);
			expect(containerSource).toContain('const LedgerContext2 = createContext(null)');
			expect(containerSource).toContain('function createLedgerStore2()');
			expect(containerSource).toContain('const subscribeLedgerToNothing2 =');
			expect(containerSource).toContain('const getLedgerNothing2 =');
			expect(
				analyze(containerSource, { lang: 'tsx', sourceType: 'module' }).diagnostics,
			).toEqual([]);

			const page = clone(ir) as any;
			page.records.sharedDefinitions[0].scope = 'page';
			const pageSource = emit(page);
			expect(pageSource).toContain('function createLedgerStore2()');
			expect(pageSource).toContain('const ledgerStore2 = createLedgerStore2()');
			expect(pageSource).toContain('const subscribeLedgerToNothing2 =');
			expect(pageSource).toContain('const getLedgerNothing2 =');
			expect(analyze(pageSource, { lang: 'tsx', sourceType: 'module' }).diagnostics).toEqual(
				[],
			);
		});

		test('fails closed with construct-named diagnostics when composition records are missing', async () => {
			const shared = clone(
				await build(
					'src/missing-shared.tsrx',
					`import { shared, state } from "@markless/core";
					export const useCounter = shared(() => { let count = state(0); return { count, increment() { count++; } }; });
					export function Counter() @{ const counter = useCounter(); <button onClick={() => counter.increment()}>{counter.count}</button> }`,
				),
			) as any;
			shared.records.sharedWrites = [];
			expect(() => emit(shared)).toThrow(
				/SharedWrite records are incomplete for SharedDefinition useCounter/,
			);

			const handles = clone(
				await build(
					'src/missing-handle.tsrx',
					`import { element } from "@markless/core"; export function Search() @{ const input = element<HTMLInputElement>(); <><input el={input} /><button onClick={() => input?.focus()}>focus</button></> }`,
				),
			) as any;
			handles.records.elementHandleBindings = [];
			expect(() => emit(handles)).toThrow(
				/HandleCallRecord has dangling ElementHandleBinding/,
			);
		});
	});

	describe('fail-closed enriched IR validation', () => {
		test('emits a persisted useState fixture that passes the artifact gate', async () => {
			const ir = clone(await golden('s2-keyed-todo.json')) as any;
			const state = ir.records.bindings.find((binding: any) => binding.id === 'state:draft');
			state.initializer = { type: 'Literal', value: 'light', raw: "'light'" };
			ir.records.persistence = [
				persistenceRecord(state.id, state.name, 'light', ir.filename),
			];

			const source = emit(ir);
			const formatted = await formatEmitted(source);
			expect(source).toContain(
				`useState(() => globalThis.${FRAMELESS_STATE_GLOBAL}?.['markless:draft'] ?? 'light')`,
			);
			expect(source).not.toContain(`window.${FRAMELESS_STATE_GLOBAL}`);
			expect(source).not.toMatch(
				new RegExp(`use(?:Effect|LayoutEffect)[\\s\\S]*${FRAMELESS_STATE_GLOBAL}`),
			);
			const setter = source.indexOf('setDraft(nextDraft)');
			const write = source.indexOf(
				"__framelessWrite('markless:draft', 'data-markless-draft', nextDraft)",
				setter,
			);
			expect(setter).toBeGreaterThan(-1);
			expect(write).toBeGreaterThan(setter);
			expect(source).toMatch(
				/function __framelessWrite\(key, attr, value\) \{\s*try \{\s*localStorage\.setItem\(key, value\);\s*\} catch \{\s*void 0;\s*\}\s*document\.documentElement\.setAttribute\(attr, value\);\s*\}/,
			);
			expect(source.match(/^import .* from 'react';$/gm)).toHaveLength(1);
			if (process.env.UPDATE_GOLDENS === '1')
				await writeFile(resolve(root, 'generated-persistence/P1.tsx'), formatted);
			expect(await readFile(resolve(root, 'generated-persistence/P1.tsx'), 'utf8')).toBe(
				formatted,
			);
			const gate = await checkSources([
				{ file: 'generated-persistence/P1.tsx', source: formatted, artifact: ir },
			]);
			expect(gate.violations, JSON.stringify(gate.violations, null, 2)).toEqual([]);
		});

		test('reads the persisted fallback without throwing during no-window SSR', async () => {
			const sandbox = Object.create(null);
			expect(runInNewContext('typeof window', sandbox)).toBe('undefined');
			expect(
				runInNewContext(
					`globalThis.${FRAMELESS_STATE_GLOBAL}?.['markless:draft'] ?? 'light'`,
					sandbox,
				),
			).toBe('light');

			const persistedGolden = await readFile(
				resolve(root, 'generated-persistence/P1.tsx'),
				'utf8',
			);
			expect(persistedGolden).toContain(`globalThis.${FRAMELESS_STATE_GLOBAL}`);
			expect(persistedGolden).not.toContain(`window.${FRAMELESS_STATE_GLOBAL}`);
		});

		test('emits separate persisted external-store client/server snapshots and persists before notify', async () => {
			const filename = 'test/composition-fixtures/C2-shared.tsrx';
			const ir = clone(
				await buildEnrichedIr({
					filename,
					source: await readFile(resolve(root, filename), 'utf8'),
				}),
			) as any;
			const definition = ir.records.sharedDefinitions[0];
			const cell = definition.cells.find((candidate: any) => candidate.name === 'history');
			ir.records.persistence = [
				persistenceRecord(cell.graphNodeId, cell.name, 'seed', ir.filename),
			];

			const source = emit(ir);
			expect(source).toContain(
				`let history = globalThis.${FRAMELESS_STATE_GLOBAL}?.['markless:history'] ?? 'seed'`,
			);
			expect(source).toContain("getServerHistory: () => 'seed'");
			expect(source).toMatch(
				/useSyncExternalStore\([\s\S]*?store\.getHistory[\s\S]*?store\.getServerHistory/,
			);
			const allWrites = source.indexOf('advance()');
			const write = source.indexOf(
				"__framelessWrite('markless:history', 'data-markless-history', history)",
				allWrites,
			);
			const notify = source.indexOf('for (const listener', write);
			expect(allWrites).toBeGreaterThan(-1);
			expect(write).toBeGreaterThan(allWrites);
			expect(notify).toBeGreaterThan(write);
			expect(
				source.match(
					/__framelessWrite\('markless:history', 'data-markless-history', history\)/g,
				),
			).toHaveLength(definition.methods.length);
		});

		// THE HANDLER-ONLY HALF OF THE PERSISTENCE CONTRACT, WHICH `P1` CANNOT SEE.
		// `P1` persists `draft`, a binding read in render, so it exercises only the
		// pre-paint seed plus the write-through of a `useState` cell. `next` in the
		// same golden is read ONLY inside handlers, so React lowers it to `useRef`
		// and the record's seed lowering is `none`. React still honours
		// `writeThrough.trigger: 'ordinary-assignment'` and emits the write.
		//
		// THIS TEST IS ONE HALF OF A CROSS-LANE PAIR. Its Solid twin
		// ("SOLID DROPS THE WRITE-THROUGH ...") runs the SAME canonical record
		// through the Solid emitter and measures ZERO writes. Measured at
		// `frameless-app-axes-v1` T007. If this file and that one ever agree, one
		// of the two lanes has changed and the split must be re-recorded.
		test('honours write-through for a HANDLER-ONLY persisted binding', async () => {
			const ir = clone(await golden('s2-keyed-todo.json')) as any;
			const state = ir.records.bindings.find((binding: any) => binding.id === 'state:next');
			expect(state).toBeDefined();

			// Built through the REAL vendor adapter rather than hand-shaped, so the
			// record cannot be an artifact of the test's own opinion about seeds.
			const [record] = adaptPersistenceFacts(
				[
					{
						graphNodeId: state.id,
						moduleId: ir.filename,
						bindingName: state.name,
						key: {
							origin: 'derived',
							sourceIdentifier: state.name,
							literal: `markless:${state.name}`,
							bakedAtCompileTime: true,
						},
						authoredInitial: '3',
						writable: state.writable,
					} as MarklessStorageSourceFact,
				],
				() => ({ render: false, handler: true }),
			);
			expect(record!.seed.lowering).toBe('none');
			expect(record!.writeThrough.trigger).toBe('ordinary-assignment');
			ir.records.persistence = [record];

			const source = emit(ir);
			// No render read, so no seed slot - the contract's own `no-render-read`.
			expect(source).not.toContain(`${FRAMELESS_STATE_GLOBAL}?.['markless:next']`);
			// AND THE INITIALIZER IS REPLACED BY THE RECORD'S STRING ANYWAY. The
			// golden authors `next = state(3)`; a persistence record turns that into
			// `useRef('3')` even with seed lowering `none`, because `persistenceSeed`
			// falls back to `authoredInitial`, which the record type declares as a
			// STRING. This is exactly why the vendor boundary refuses a non-string
			// authored initial upstream - persistence is scalar-string-only, and the
			// emitter does not re-check it.
			expect(source).toContain("useRef('3')");
			expect(
				source.match(/__framelessWrite\('markless:next', 'data-markless-next', /g),
			).toHaveLength(1);
		});

		test('keeps an artifact with no persistence records byte-identical', async () => {
			const ir = await golden('s1-render-once.json');
			const before = emit(ir);
			const explicitEmpty = clone(ir);
			// The IR type is readonly by design; this is a clone made precisely to
			// be mutated, so the cast states that intent rather than loosening the
			// contract anywhere real.
			(explicitEmpty.records as { persistence?: unknown }).persistence = [];
			expect(emit(explicitEmpty)).toBe(before);
			expect(before).not.toContain('__framelessWrite');
		});

		test('accepts behavior-input provenance structurally', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.records.behaviors = [
				{
					id: 'behavior:0',
					hostNodeId: 'h0',
					componentId: ir.components[0].id,
					behavior: {
						type: 'ArrowFunctionExpression',
						params: [],
						body: { type: 'Literal', value: null },
					},
					inputs: [
						{
							graphNodeId: ir.records.bindings[0].id,
							path: [],
							via: 'direct',
							provenance: 'derived-from-ast',
						},
					],
					returnsCleanup: false,
					order: 0,
				},
			];
			expect(() => validateEnrichedIr(ir)).not.toThrow();
		});

		test('rejects malformed cloned multi-component ownership records', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.components.push({
				...clone(ir.components[0]),
				id: 'component:1:Additional',
				name: 'Additional',
			});
			ir.module.exports.push({
				kind: 'named',
				componentName: 'Additional',
				exportedName: 'Additional',
			});
			expect(() => validateEnrichedIr(ir)).toThrow(/Prop alias map does not resolve/);
		});

		test('rejects an exact /1 artifact with the version diagnostic', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.version = 'frameless-enriched-ir/1';
			expect(() => validateEnrichedIr(ir)).toThrow(
				'Expected frameless-enriched-ir/2, received frameless-enriched-ir/1',
			);
		});

		test('rejects a component-reference with its construct diagnostic', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.components[0].template = [
				{
					kind: 'component-reference',
					id: 'component-reference:child',
					edgeId: 'edge:child',
					target: { localName: 'Child', module: 'self' },
					props: [],
					children: [],
				},
			];
			expect(() => validateEnrichedIr(ir)).toThrow(/dangling host record id/);
		});

		test('rejects a non-empty SharedDefinition family with its construct diagnostic', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.records.sharedDefinitions = [
				{
					id: 'shared:counter',
					name: 'useCounter',
					scope: 'container',
					cells: [],
					methods: [],
					graphBindings: [],
					returnProperties: [],
					dependencies: [],
				},
			];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/SharedDefinition useCounter has no SharedInstance/,
			);
		});

		test('requires a non-empty authored name before rejecting the shared family', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			const definition = {
				id: 'shared:counter',
				name: 'useCounter',
				scope: 'container',
				cells: [],
				methods: [],
				graphBindings: [],
				returnProperties: [],
				dependencies: [],
			};
			const { name: _missingName, ...missingName } = definition;
			ir.records.sharedDefinitions = [missingName];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/SharedDefinition has malformed construct/,
			);
			ir.records.sharedDefinitions = [{ ...definition, name: '' }];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/SharedDefinition has malformed construct/,
			);
			ir.records.sharedDefinitions = [definition];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/SharedDefinition useCounter has no SharedInstance/,
			);
		});

		test('enforces exact per-kind shared cell shapes', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			const cell = {
				kind: 'state',
				name: 'count',
				graphNodeId: 'shared:counter/state:count',
				valueKind: 'scalar',
				initializer: { type: 'Literal', value: 0 },
			};
			ir.records.sharedDefinitions = [
				{
					id: 'shared:counter',
					name: 'useCounter',
					scope: 'container',
					cells: [cell],
					methods: [],
					graphBindings: [cell.graphNodeId],
					returnProperties: [
						{ kind: 'graph', name: 'count', graphNodeId: cell.graphNodeId, path: [] },
					],
					dependencies: [],
				},
			];
			const { initializer: _initializer, ...missingInitializer } = cell;
			ir.records.sharedDefinitions[0].cells = [missingInitializer];
			expect(() => validateEnrichedIr(ir)).toThrow(/SharedDefinitionCell/);
			ir.records.sharedDefinitions[0].cells = [{ ...cell, initializer: { value: 0 } }];
			expect(() => validateEnrichedIr(ir)).toThrow(/SharedDefinitionCell initializer/);
			const computed = {
				kind: 'computed',
				name: 'double',
				graphNodeId: 'shared:counter/computed:double',
				expression: {
					type: 'ArrowFunctionExpression',
					params: [],
					body: { type: 'Identifier', name: 'count' },
				},
				dependencies: [cell.graphNodeId],
			};
			ir.records.sharedDefinitions[0].graphBindings.push(computed.graphNodeId);
			ir.records.sharedDefinitions[0].cells = [cell, computed];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/SharedDefinition useCounter has no SharedInstance/,
			);
			ir.records.sharedDefinitions[0].cells = [
				{ ...computed, dependencies: ['shared:counter/state:missing'] },
			];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/SharedDefinitionCell has malformed construct/,
			);
			ir.records.sharedDefinitions[0].cells = [{ ...computed, valueKind: 'scalar' }];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/SharedDefinitionCell has unknown semantic field/,
			);
			ir.records.sharedDefinitions[0].cells = [cell];
			ir.records.sharedDefinitions[0].methods = [
				{ name: 'increment', site: { type: 'Property' } },
			];
			expect(() => validateEnrichedIr(ir)).toThrow(/SharedDefinitionMethod/);
		});

		test('requires structurally valid and resolving handle-forward records', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			const componentId = ir.components[0].id;
			const binding = {
				id: 'element-handle:h0:input',
				handleName: 'input',
				componentId,
				hostNodeId: 'h0',
			};
			const forward = {
				handleBindingId: binding.id,
				edgeId: 'component-edge:0',
				childComponentId: componentId,
				childHostNodeId: 'h0',
			};
			ir.records.elementHandleBindings = [binding];
			ir.records.handleForwards = [forward];
			expect(() => validateEnrichedIr(ir)).not.toThrow();
			ir.records.handleForwards = [{ ...forward, handleBindingId: 'element-handle:missing' }];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/HandleForwardRecord has dangling handleBindingId/,
			);
			ir.records.handleForwards = [{ ...forward, childComponentId: 'component:missing' }];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/HandleForwardRecord has dangling componentId/,
			);
		});

		// IR-8. THIS EMITTER IS ONE OF EXACTLY TWO THAT EVER REJECTED THIS FIELD.
		// Measured across all eight goldens against every lane's real `emit()`:
		// react and solid threw `PropDestructuringEntry has unknown semantic
		// field: type`; qwik, svelte, vue, angular and `resolveModuleSet` accepted
		// it SILENTLY with byte-identical output. So this pair of tests is not
		// ceremony - without the allowlist entry below, S1 would not emit at all.
		//
		// The react emitter's checker is an inline closure named `keys`, NOT
		// `exactKeys`, which is why every grep-derived survey of this phase missed
		// the one file that actually broke.
		test('CONSUMES the authored prop type, and prints NOTHING when it is absent', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			expect(ir.components[0]!.props.entries.some((entry) => entry.type)).toBe(true);
			expect(() => validateEnrichedIr(ir)).not.toThrow();
			const stripped = clone(ir) as any;
			// BOTH IR-8 FIELDS COME OFF TOGETHER. `type` and `optional` are read
			// from one `TSPropertySignature` and the validator rejects one without
			// the other, so stripping only `type` no longer produces a lawful IR -
			// it produces requiredness with nothing to attach to.
			for (const entry of stripped.components[0].props.entries) {
				delete entry.type;
				delete entry.optional;
			}
			// REWRITTEN AT `frameless-emitter-capability-v1` T014, NOT EXTENDED. Until
			// this step the row asserted `emit(ir) === emit(stripped)` - "admitted but
			// not printed" - and that assertion is now FALSE BY DESIGN, because Step 2
			// is the step that prints. A row that kept passing here would have been
			// pinning the hole the phase exists to close.
			//
			// The pair is what makes it a measurement rather than a text check: the
			// SAME IR with the annotation prints the authored type, and WITHOUT it
			// prints no annotation at all. So an emitter that synthesized a type from
			// how the corpus uses the prop fails the second arm, and an emitter that
			// dropped IR-8 on the floor fails the first.
			const typed = emit(ir);
			const untyped = emit(stripped);
			expect(typed).not.toBe(untyped);
			expect(typed).toContain('label: string');
			expect(typed).toContain('multiplier: number');
			expect(typed).toContain('visible: boolean');
			expect(typed).toContain('onTrace: (name: string, detail: Record<string, unknown>) => void');
			expect(untyped).not.toContain('string');
			expect(untyped).toContain('{ label, multiplier, visible, onTrace }');
			// ALL-OR-NOTHING. One prop losing its annotation suppresses the whole
			// literal rather than printing `any` for the one that lost it.
			const partial = clone(ir) as any;
			delete partial.components[0].props.entries[0].type;
			delete partial.components[0].props.entries[0].optional;
			expect(emit(partial)).toBe(untyped);
		});

		test('rejects a malformed prop type that is not an AST node', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.components[0].props.entries[0].type = 'string';
			expect(() => validateEnrichedIr(ir)).toThrow(
				/PropDestructuringEntry has malformed type annotation AST: label/,
			);
			ir.components[0].props.entries[0].type = { notAType: true };
			expect(() => validateEnrichedIr(ir)).toThrow(
				/PropDestructuringEntry has malformed type annotation AST: label/,
			);
		});

		/**
		 * IR-8 REQUIREDNESS, GUARDED THE SAME WAY AS ITS TYPE - see the fuller doc
		 * comment on the copy in `packages/frameworks/qwik/test/emitter.test.ts`.
		 * MEASURED: `optional` planted on every `PropDestructuringEntry` of all
		 * eight goldens was rejected BY NAME by all six lanes before the field
		 * landed - this lane among them, through the inline `keys` closure that
		 * every grep-derived survey of this phase has missed.
		 */
		test('rejects a malformed or ORPHANED IR-8 requiredness flag', async () => {
			const admitted = clone(await golden('s1-render-once.json'));
			expect(
				admitted.components[0]!.props.entries.some((entry) => entry.optional !== undefined),
			).toBe(true);
			expect(() => validateEnrichedIr(admitted)).not.toThrow();

			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.components[0].props.entries[0].optional = 'yes';
			expect(() => validateEnrichedIr(ir)).toThrow(
				/PropDestructuringEntry has malformed optional flag: label/,
			);

			// ORPHANED: requiredness with no type did not come from the compiler's
			// only supply site, where both are read from one member.
			const orphaned = clone(await golden('s1-render-once.json')) as any;
			delete orphaned.components[0].props.entries[0].type;
			expect(() => validateEnrichedIr(orphaned)).toThrow(
				/PropDestructuringEntry declares optionality without a type annotation: label/,
			);
		});

		test.each([
			[
				'unknown semantic field',
				(ir: any) => {
					ir.records.bindings[0].futureSemantic = true;
				},
				/EnrichedGraphBinding has unknown semantic field/,
			],
			[
				'dangling record id',
				(ir: any) => {
					ir.components[0].locals[1].semanticRecordIds = ['state:missing'];
				},
				/LocalDeclaration has dangling semantic record id/,
			],
			[
				'unsupported write shape',
				(ir: any) => {
					ir.records.events[0].handlers[0].writes[0].operation = 'delete';
				},
				/EventHandlerRecord .* unsupported write shape/,
			],
			[
				'unsupported sync shape',
				(ir: any) => {
					ir.records.events[0].syncPolicy = {
						when: { type: 'future-condition' },
						actions: ['preventDefault'],
					};
				},
				/SyncPolicy .* unsupported sync shape/,
			],
			[
				'malformed template construct',
				(ir: any) => {
					ir.components[0].template[0].kind = 'portal';
				},
				/TemplateNode has malformed construct/,
			],
		])('rejects %s with a construct-named diagnostic', async (_name, mutate, message) => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			mutate(ir);
			expect(() => validateEnrichedIr(ir)).toThrow(message);
		});
	});
});

/**
 * T051. `docs/DEFECTS.md` entry 11, and the react half of a two-lane finding.
 *
 * THE DEFECT. `DOM_BOOLEAN_CONTENT_ATTRIBUTES` admits fourteen names on an
 * admission rule that asked what the BROWSER DOM accepts. Three of them are not
 * react props under their lowercase spelling, so this emitter produced JSX that
 * react-dom SILENTLY DROPPED in both states while raising `console.error:
 * Invalid DOM property`. They passed every clause, lowered to `kind: 'property'`
 * correctly, and emitted valid-LOOKING JSX. Nobody had asked what each LANE does.
 *
 * WHY THE MAP IS NOT A HAND LIST. A hand-written casing map is exactly the shape
 * that rotted here in the first place - it would be right on the day it is
 * written and unfalsifiable afterwards. So the registration below EXECUTES
 * react-dom over every admitted name and asserts the map is EQUAL to the set
 * react-dom actually rejects. Adding a name to the map that react accepts goes
 * red; dropping one react rejects goes red; a react release that renames a prop
 * goes red. That is the two-sidedness the card asked for, and it is why this is
 * an instrument rather than a comment.
 */
describe('react prop spellings for the admitted boolean content attributes', () => {
	const HOST: Readonly<Record<string, string>> = {
		async: 'script',
		autofocus: 'input',
		autoplay: 'video',
		controls: 'video',
		default: 'track',
		defer: 'script',
		disabled: 'button',
		hidden: 'div',
		loop: 'video',
		multiple: 'select',
		open: 'details',
		readonly: 'input',
		required: 'input',
		reversed: 'ol',
	};

	interface Reading {
		readonly bytes: string;
		readonly live: string | null;
		readonly warned: boolean;
	}

	/**
	 * EVERY REACT READING IN THIS SUITE COMES FROM ONE PASS, AND THAT IS FORCED.
	 *
	 * react-dom DEDUPLICATES `Invalid DOM property` per prop name per process, so
	 * the SECOND render of `readonly={...}` is silent no matter what the first one
	 * did. A suite that re-rendered per assertion would therefore "measure" the
	 * warning as absent and quietly lose the loudest half of the finding. So the
	 * whole table is taken once, memoised, and asserted against afterwards.
	 *
	 * The FALSE state is rendered BEFORE the true one for each name, deliberately:
	 * it is the only ordering under which "react does not warn about a falsy
	 * unknown prop" is observable rather than an artifact of the dedup.
	 */
	let table: Promise<Record<string, Record<'true' | 'false', Reading>>> | undefined;

	function readings(): Promise<Record<string, Record<'true' | 'false', Reading>>> {
		table ??= (async () => {
			const [{ createElement }, server] = await Promise.all([
				import('react'),
				import('react-dom/server.node'),
			]);
			const renderToStaticMarkup = (
				server as unknown as { renderToStaticMarkup: (element: unknown) => string }
			).renderToStaticMarkup;
			const measured: Record<string, Record<'true' | 'false', Reading>> = {};
			const probe = (prop: string, host: string, value: boolean, read: string): Reading => {
				const captured: string[] = [];
				const original = console.error;
				console.error = (...args: unknown[]) => void captured.push(args.map(String).join(' '));
				let html: string;
				try {
					html = renderToStaticMarkup(createElement(host, { [prop]: value }));
				} finally {
					console.error = original;
				}
				const startTag = /<[A-Za-z][^>]*>/.exec(html)?.[0] ?? '';
				const tokens = [
					...startTag.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)(?:="([^"]*)")?/g),
				].slice(1);
				const hit = tokens.find((token) => token[1]!.toLowerCase() === read.toLowerCase());
				return { bytes: startTag, live: hit ? (hit[2] ?? '') : null, warned: captured.length > 0 };
			};
			for (const [name, host] of Object.entries(HOST)) {
				const canonical = reactPropSpellings().get(name) ?? name;
				measured[name] = {
					false: probe(name, host, false, name),
					true: probe(name, host, true, name),
				};
				measured[`canonical:${name}`] = {
					false: probe(canonical, host, false, name),
					true: probe(canonical, host, true, name),
				};
			}
			return measured;
		})();
		return table;
	}

	test('CALIBRATION: the map is EXACTLY the admitted names react-dom rejects', async () => {
		const measured = await readings();
		// Rejected means BOTH arms: react warned AND served nothing in EITHER state.
		// A name that warned but still served, or served nothing silently, is a
		// third thing and must not be quietly folded into this map. The warning is
		// read off the FALSE row because that is the FIRST render of each name and
		// react dedups every one after it - see the memo above.
		const rejected = Object.keys(HOST).filter(
			(name) =>
				measured[name]!.false.warned &&
				measured[name]!.true.live === null &&
				measured[name]!.false.live === null,
		);
		const mapped = [...reactPropSpellings().keys()].filter((name) => name in HOST);
		const sorted = (names: readonly string[]): string[] => [...names].sort();
		expect(sorted(mapped)).toEqual(sorted(rejected));
		expect(sorted(rejected)).toEqual(['autofocus', 'autoplay', 'readonly']);
	});

	test('RED, WITNESSED: the lowercase spellings serve NOTHING in either state', async () => {
		const measured = await readings();
		for (const name of ['autofocus', 'autoplay', 'readonly']) {
			expect(measured[name]!.true.live, `${name}={true} lowercase`).toBeNull();
			expect(measured[name]!.false.live, `${name}={false} lowercase`).toBeNull();
		}
		// WHEN THE WARNING FIRES, MEASURED RATHER THAN ASSUMED - and the first
		// answer was wrong. It looked like "the true state only", which would have
		// meant `consoleErrors: 0` could catch this ONLY in a scenario that set the
		// boolean. It is not: re-measured in fresh processes rendering each state
		// FIRST, react warns on whichever render comes first and dedups the rest.
		// So the budget catches it in EITHER state - and the "true only" reading
		// was itself an artifact of the dedup this suite is memoised to avoid.
		expect(
			Object.fromEntries(
				['autofocus', 'autoplay', 'readonly'].map((name) => [
					name,
					{ first: measured[name]!.false.warned, deduped: measured[name]!.true.warned },
				]),
			),
		).toEqual({
			autofocus: { first: true, deduped: false },
			autoplay: { first: true, deduped: false },
			readonly: { first: true, deduped: false },
		});
	});

	test('GREEN: the mapped spellings serve the attribute, silently, in both states', async () => {
		const measured = await readings();
		for (const name of reactPropSpellings().keys()) {
			if (!(name in HOST)) continue;
			const row = measured[`canonical:${name}`]!;
			expect(row.true.warned || row.false.warned, `${name} warned`).toBe(false);
			expect(row.true.live, `canonical ${name}={true}`).toBe('');
			expect(row.false.live, `canonical ${name}={false}`).toBeNull();
		}
	});

	/**
	 * The COST, asserted rather than promised. React lowercases `autoFocus` on the
	 * way out but writes `autoPlay` and `readOnly` to the payload CAMELCASE. The
	 * live reading above is unaffected - HTML attribute names are case-insensitive
	 * to a parser - but `startTagCarriesAttribute` in the three-way contract reads
	 * served BYTES case-sensitively. Pinning it here means that the day a scenario
	 * reads served bytes in the TRUE state, this test is the explanation waiting
	 * for it instead of a fresh investigation.
	 */
	test('COST: two of the three canonical spellings reach the payload CAMELCASE', async () => {
		const measured = await readings();
		expect(
			Object.fromEntries(
				['autofocus', 'autoplay', 'readonly'].map((name) => [
					name,
					/[A-Za-z][-A-Za-z0-9]*=""/.exec(measured[`canonical:${name}`]!.true.bytes)![0],
				]),
			),
		).toEqual({
			autofocus: 'autofocus=""',
			autoplay: 'autoPlay=""',
			readonly: 'readOnly=""',
		});
	});

	test('the emitted JSX carries the canonical spellings and NOT the lowercase ones', async () => {
		const source = emit(
			await buildEnrichedIr({
				filename: 'probe.tsrx',
				source: `import { state } from '@markless/core';

export function Probe({ seed }) @{
	let a = state(seed);

	<div data-probe>
		<input readonly={a} autofocus={a} />
		<video autoplay={a}></video>
		<button disabled={a}></button>
	</div>
}
`,
			}),
		);
		expect(source).toContain('readOnly={a}');
		expect(source).toContain('autoFocus={a}');
		expect(source).toContain('autoPlay={a}');
		// The defect's own byte sequences, named absent rather than merely unmentioned.
		expect(source).not.toContain('readonly={a}');
		expect(source).not.toContain('autofocus={a}');
		expect(source).not.toContain('autoplay={a}');
		// The control: an admitted name react already spells lowercase must NOT move.
		expect(source).toContain('disabled={a}');
	});
});
