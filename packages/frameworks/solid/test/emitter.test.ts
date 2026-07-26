import { readFile, writeFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import {
	buildEnrichedIr,
	FRAMELESS_STATE_GLOBAL,
	type EnrichedIR,
	type FramelessPersistenceRecord,
} from '@frameless/compiler';
import { resolve } from 'pathe';
import { parse } from 'yuku-parser';
import { analyze } from 'yuku-analyzer';
import { describe, expect, test } from 'vitest';
import {
	compositionFixtures,
	emitCompositionFixture,
} from '../scripts/regenerate-composition.ts';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
import { checkSources } from '../src/gate/index.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');
const fixtures = [
	['S1.jsx', 's1-render-once.json'],
	['S2.jsx', 's2-keyed-todo.json'],
	['S3.jsx', 's3-event-form.json'],
] as const;

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
					target: 'solid',
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
	for (const component of ir.components)
		component.locals.forEach((local: any) => {
			local.names = local.names.map((name: string) => (name === from ? to : name));
		});
}
function staticAttributeValue(source: string, name: string): string {
	const parsed = parse(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	expect(parsed.diagnostics).toEqual([]);
	const module = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	let result: string | undefined;
	visit(module.ast, (record) => {
		if (record.type !== 'JSXAttribute' || record.name?.name !== name || result !== undefined)
			return;
		const value =
			record.value?.type === 'JSXExpressionContainer'
				? record.value.expression
				: record.value;
		if (value?.type === 'Literal' && typeof value.value === 'string') result = value.value;
	});
	if (result === undefined) throw new Error(`missing ${name}`);
	return result;
}
function expectTopLevelSpacing(source: string): void {
	const parsed = parse(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	expect(parsed.diagnostics).toEqual([]);
	for (let index = 1; index < parsed.program.body.length; index += 1) {
		const previous = parsed.program.body[index - 1]!;
		const current = parsed.program.body[index]!;
		const bothImports =
			previous.type === 'ImportDeclaration' && current.type === 'ImportDeclaration';
		expect(source.slice(previous.end, current.start)).toBe(bothImports ? '\n' : '\n\n');
	}
}
function findKind(value: unknown, kind: string): Record<string, any> | null {
	let found: Record<string, any> | null = null;
	visit(value, (record) => {
		if (!found && record.kind === kind) found = record;
	});
	return found;
}
function addElementsToEmptyBranchArms(value: unknown): void {
	visit(value, (record) => {
		if (record.kind !== 'branch') return;
		for (const [index, arm] of record.arms.entries()) {
			if (arm.children.length) continue;
			arm.children.push({
				kind: 'host',
				id: `${record.id}:metamorphic-arm:${index}`,
				tag: 'span',
				staticAttributes: [],
				dynamicBindings: [],
				eventIds: [],
				children: [],
			});
		}
	});
}

describe('Solid structural emitter', () => {
	for (const fixture of compositionFixtures) {
		test(`generated-composition/${fixture}.jsx is fresh from its composition fixture`, async () => {
			expect(
				await readFile(resolve(root, 'generated-composition', `${fixture}.jsx`), 'utf8'),
			).toBe(await emitCompositionFixture(fixture));
		});
	}

	for (const [output, goldenName] of fixtures) {
		test(`${output} is fresh from the compiler EnrichedIR golden`, async () => {
			const ir = await golden(goldenName);
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

	test('audits every T003 lowering delta in the actual generated files', async () => {
		const [s1, s2, s3] = await Promise.all(
			['S1.jsx', 'S2.jsx', 'S3.jsx'].map((file) =>
				readFile(resolve(root, 'generated', file), 'utf8'),
			),
		);
		expect(s1).toMatch(/untrack\(\(\) =>\s*props\.onTrace/);
		expect(s1).toContain('const derived = () =>');
		expect(s1).toMatch(/<Show\s+when=/);
		expect(s2).toMatch(/createStore\(\s*untrack\(\(\) =>\s*props\.seed\.map/);
		expect(s2.match(/setTodos\(\s*produce\(/g)).toHaveLength(2);
		expect(s2.match(/setTodos\(\s*reconcile\(/g)).toHaveLength(4);
		expect(s2).toContain("key: 'id'");
		expect(s2).toMatch(/value=\{todo\.title\}\s+attr:value=\{todo\.title\}/);
		expect(s2).not.toContain('todos() &&');
		expect(s3).toMatch(/value=\{text\(\)\}\s+attr:value=\{text\(\)\}\s+onInput=/);
		expect(s3).toMatch(/setWrites\(1\);\s*setWrites\(2\);/);
		expect(`${s1}\n${s2}\n${s3}`).not.toMatch(/createMemo|className=|htmlFor=/);
	});

	test('preserves authored multi-write order instead of applying React SSA collapse', async () => {
		const source = emit(await golden('s3-event-form.json'));
		const first = source.indexOf('setWrites(1)');
		const second = source.indexOf('setWrites(2)');
		const callback = source.indexOf("props.onTrace('submit'");
		expect(first).toBeGreaterThan(-1);
		expect(second).toBeGreaterThan(first);
		expect(callback).toBeGreaterThan(second);
	});

	describe('frameless-enriched-ir/2 composition emission', () => {
		const build = (filename: string, source: string) => buildEnrichedIr({ filename, source });

		test('allocates props and generated locals per component scope', async () => {
			const ir = await build(
				'src/component-scopes.tsrx',
				`import { shared, state } from "@markless/core";
				export const useLedger = shared(() => { let value = state(1); return { value }; });
				export function Colliding({ first }) @{ const collision = 1; const ledger = useLedger(); <output>{first + collision + ledger.value}</output> }`,
			);
			renameIdentifier(ir, 'collision', 'props');
			const source = emit(ir);
			expect(source).toContain('export function LedgerProvider(props)');
			expect(source).toContain('function Colliding(props2)');
			expect(source).not.toContain('function LedgerProvider(props2)');
		});

		test('emits every component, nested children, projection, and generated imports', async () => {
			const local = await build(
				'src/composition.tsrx',
				`function Frame({ children }) @{ <section>{children}</section> } export function Page() @{ <Frame><strong>projected</strong></Frame> }`,
			);
			const source = emit(local);
			expect(source).toMatch(/function Frame\(props\d*\)/);
			expect(source).toContain('export function Page()');
			expect(source).toContain('<Frame><strong>projected</strong></Frame>');
			expect(source).toMatch(/<section>\{props\d*\.children\}<\/section>/);
			const external = await build(
				'src/parent.tsrx',
				`import { Child } from "./child.tsrx"; export function Parent() @{ <Child value={1}><span>nested</span></Child> }`,
			);
			expect(emit(external)).toContain("import { Child } from './child.jsx'");
		});

		test('scope-switches shared cells, emits derived arrows, stable actions, and providers', async () => {
			const ir = await build(
				'src/shared.tsrx',
				`import { computed, shared, state } from "@markless/core"; export const useCounter = shared(() => { let count = state(0); let pair = state({ value: 1 }); const double = computed(() => count * 2); return { count, pair, double, increment() { count++; } }; }, { scope: "container" }); export function Counter() @{ const counter = useCounter(); <button onClick={() => counter.increment()}>{counter.double}</button> }`,
			);
			const source = emit(ir);
			expect(source).toContain('const CounterContext = createContext()');
			expect(source).toContain('function createCounterShared()');
			expect(source).toContain('const double = () =>');
			expect(source).toMatch(/const \[count, setCount\d*\] = createSignal\(0\)/);
			expect(source).toMatch(/const \[pair\] = createStore\(\{ value: 1 \}\)/);
			expect(source).toMatch(/export function CounterProvider\(props\d*\)/);
			expect(source).toContain('function useCounter()');
			expect(source).not.toContain('createMemo');
			const page = structuredClone(ir) as any;
			page.records.sharedDefinitions[0].scope = 'page';
			const pageSource = emit(page);
			expect(pageSource).toContain('const counterShared = createCounterShared()');
			expect(pageSource).not.toContain('CounterProvider');
		});

		test('deduplicates generated shared suffixes without changing authored or non-overlapping names', async () => {
			const overlapping = await build(
				'src/shared-suffix.tsrx',
				`import { shared, state } from "@markless/core"; export const useCompositionShared = shared(() => { let value = state(0); return { value, increment() { value++; } }; }); export function Reader() @{ const sharedValue = useCompositionShared(); <button onClick={() => sharedValue.increment()}>{sharedValue.value}</button> }`,
			);
			const overlappingSource = emit(overlapping);
			expect(overlappingSource).toContain('function createCompositionShared()');
			expect(overlappingSource).not.toContain('createCompositionSharedShared');
			expect(overlappingSource).toContain('function useCompositionShared()');
			const pageShared = clone(overlapping) as any;
			pageShared.records.sharedDefinitions[0].scope = 'page';
			expect(emit(pageShared)).toContain(
				'const compositionShared = createCompositionShared()',
			);

			const context = await build(
				'src/context-suffix.tsrx',
				`import { shared, state } from "@markless/core"; export const useCompositionContext = shared(() => { let value = state(0); return { value }; }); export function Reader() @{ const sharedValue = useCompositionContext(); <output>{sharedValue.value}</output> }`,
			);
			expect(emit(context)).toContain('const CompositionContext = createContext()');

			const provider = await build(
				'src/provider-suffix.tsrx',
				`import { shared, state } from "@markless/core"; export const useCompositionProvider = shared(() => { let value = state(0); return { value }; }); export function Reader() @{ const sharedValue = useCompositionProvider(); <output>{sharedValue.value}</output> }`,
			);
			expect(emit(provider)).toMatch(/export function CompositionProvider\(props\d*\)/);

			const nonOverlapping = await build(
				'src/ledger-suffix.tsrx',
				`import { shared, state } from "@markless/core"; export const useLedger = shared(() => { let value = state(0); return { value, increment() { value++; } }; }); export function Reader() @{ const ledger = useLedger(); <button onClick={() => ledger.increment()}>{ledger.value}</button> }`,
			);
			const nonOverlappingSource = emit(nonOverlapping);
			expect(nonOverlappingSource).toContain('function createLedgerShared()');
			expect(nonOverlappingSource).toContain('const LedgerContext = createContext()');
			expect(nonOverlappingSource).toMatch(/export function LedgerProvider\(props\d*\)/);
		});

		test('emits direct and forwarded refs, null guards, and named tracked directives', async () => {
			const forwarded = await build(
				'src/forward.tsrx',
				`import { element } from "@markless/core"; function Field(props) @{ <input el={props.input} /> } export function Page() @{ const input = element<HTMLInputElement>(); <><Field input={input} /><button onClick={() => input?.focus()}>focus</button></> }`,
			);
			const refSource = emit(forwarded);
			expect(refSource).toContain('let input;');
			expect(refSource).toMatch(/props\d*\.input\(node\)/);
			expect(refSource).toMatch(/onCleanup\(\(\) => props\d*\.input\(undefined\)\)/);
			expect(refSource).toContain('input?.focus()');
			const attach = await build(
				'src/attach.tsrx',
				`import { state } from "@markless/core"; export function Page() @{ let value = state("a"); <div attach={(node) => { node.dataset.value = value; return () => { delete node.dataset.value; }; }} /> }`,
			);
			const attachSource = emit(attach);
			expect(attachSource).toMatch(/ref=\{attachHost\d*\}/);
			expect(attachSource).toMatch(/import \{[^}]*onMount[^}]*\} from 'solid-js'/);
			expect(attachSource).toMatch(
				/const attachHost\d* = \(node\) => \{\s*onMount\(\(\) => \{/,
			);
			expect(attachSource).toContain('createEffect(() =>');
			expect(attachSource).toContain('onCleanup(() =>');
			expect(attachSource).toMatch(
				/let valueInput = value\(\);[\s\S]*dataset\.value = valueInput/,
			);
		});

		test('installs zero-input behaviors bare and tracks only behaviors with inputs', async () => {
			const zeroInput = await build(
				'src/zero-input-attach.tsrx',
				`export function Page() @{ <div attach={(node) => { node.dataset.install = "zero"; return () => { node.dataset.cleanup = "zero"; }; }} /> }`,
			);
			const zeroInputSource = emit(zeroInput);
			expect(zeroInputSource).not.toContain('createEffect');
			expect(zeroInputSource).toMatch(
				/onMount\(\(\) => \{[\s\S]*let cleanup\d* = undefined;[\s\S]*cleanup\d* = \(\(node\) => \{[\s\S]*dataset\.install = 'zero'[\s\S]*\}\)\(node\);[\s\S]*onCleanup\(\(\) =>/,
			);

			const tracked = await build(
				'src/tracked-attach.tsrx',
				`import { state } from "@markless/core"; export function Page() @{ let value = state("tracked"); <div attach={(node) => { node.dataset.install = value; return () => { node.dataset.cleanup = value; }; }} /> }`,
			);
			const trackedSource = emit(tracked);
			expect(trackedSource).toMatch(
				/onMount\(\(\) => \{[\s\S]*let valueInput = value\(\);[\s\S]*dataset\.install = valueInput[\s\S]*createEffect\(\(\) => \{[\s\S]*const valueInputNext = value\(\)/,
			);
		});

		test('preserves authored behavior install order and emits reverse cleanup order', async () => {
			const zeroInput = await build(
				'src/first-attach.tsrx',
				`export function Page() @{ <div attach={(node) => { node.dataset.install = "first"; return () => { node.dataset.cleanup = "first"; }; }} /> }`,
			);
			const mixed = clone(
				await build(
					'src/mixed-attach.tsrx',
					`import { state } from "@markless/core"; export function Page() @{ let value = state("second"); <div attach={(node) => { node.dataset.install = value; return () => { node.dataset.cleanup = value; }; }} /> }`,
				),
			) as any;
			const first = clone(zeroInput.records.behaviors[0]) as any;
			const second = mixed.records.behaviors[0];
			first.id = 'behavior:first';
			first.componentId = second.componentId;
			first.hostNodeId = second.hostNodeId;
			first.order = 0;
			second.order = 1;
			mixed.records.behaviors = [first, second];

			const source = emit(mixed);
			const firstInstall = source.indexOf("dataset.install = 'first'");
			const secondInstall = source.indexOf('dataset.install = valueInput');
			expect(firstInstall).toBeGreaterThan(-1);
			expect(secondInstall).toBeGreaterThan(firstInstall);
			expect(source).toMatch(
				/onCleanup\(\(\) => \{[\s\S]*typeof cleanup3[\s\S]*cleanup3\(\);[\s\S]*typeof cleanup2[\s\S]*cleanup2\(\);/,
			);
		});

		test('installs a tracked behavior before a later zero-input behavior in authored order', async () => {
			const tracked = clone(
				await build(
					'src/tracked-first.tsrx',
					`import { state } from "@markless/core"; export function Page() @{ let value = state("tracked"); <div attach={(node) => { node.dataset.tracked = value; return () => { node.dataset.trackedCleanup = value; }; }} /> }`,
				),
			) as any;
			const zeroInput = await build(
				'src/zero-second.tsrx',
				`export function Page() @{ <div attach={(node) => { node.dataset.zero = "zero"; return () => { node.dataset.zeroCleanup = "zero"; }; }} /> }`,
			);
			const first = tracked.records.behaviors[0];
			const second = clone(zeroInput.records.behaviors[0]) as any;
			first.order = 0;
			second.id = 'behavior:zero-second';
			second.componentId = first.componentId;
			second.hostNodeId = first.hostNodeId;
			second.order = 1;
			tracked.records.behaviors = [first, second];

			const source = emit(tracked);
			const mount =
				source.match(/onMount\(\(\) => \{([\s\S]*?)createEffect\(\(\) => \{/)?.[1] ?? '';
			expect(mount.indexOf('dataset.tracked = valueInput')).toBeGreaterThan(-1);
			expect(mount.indexOf("dataset.zero = 'zero'")).toBeGreaterThan(
				mount.indexOf('dataset.tracked = valueInput'),
			);
		});

		test('reinstalls every affected behavior as one authored group with duplicate-safe cleanup', async () => {
			const first = clone(
				await build(
					'src/group-a.tsrx',
					`import { state } from "@markless/core"; export function Page() @{ let value = state("one"); <div attach={(node) => { node.dataset.log += "install:A:" + value; return () => { node.dataset.log += "cleanup:A:" + value; }; }} /> }`,
				),
			) as any;
			const secondIr = await build(
				'src/group-b.tsrx',
				`import { state } from "@markless/core"; export function Page() @{ let value = state("one"); <div attach={(node) => { node.dataset.log += "install:B:" + value; return () => { node.dataset.log += "cleanup:B:" + value; }; }} /> }`,
			);
			const behaviorA = first.records.behaviors[0];
			const behaviorB = clone(secondIr.records.behaviors[0]) as any;
			behaviorA.order = 0;
			behaviorB.id = 'behavior:group-b';
			behaviorB.componentId = behaviorA.componentId;
			behaviorB.hostNodeId = behaviorA.hostNodeId;
			behaviorB.inputs[0].graphNodeId = behaviorA.inputs[0].graphNodeId;
			behaviorB.order = 1;
			first.records.behaviors = [behaviorA, behaviorB];

			const source = emit(first);
			expect(source.match(/createEffect\(\(\) =>/g)).toHaveLength(1);
			const effect = source.slice(source.indexOf('createEffect(() =>'));
			const cleanupB = effect.indexOf('cleanup2()');
			const cleanupA = effect.indexOf('cleanup()');
			const installA = effect.indexOf("'install:A:' + valueInput");
			const installB = effect.indexOf("'install:B:' + valueInput2");
			expect(cleanupB).toBeGreaterThan(-1);
			expect(cleanupA).toBeGreaterThan(cleanupB);
			expect(installA).toBeGreaterThan(cleanupA);
			expect(installB).toBeGreaterThan(installA);
			expect(effect).toMatch(/cleanup2\(\);\s*cleanup2 = undefined;/);
			expect(effect).toMatch(/cleanup\(\);\s*cleanup = undefined;/);
		});

		test('allocates generated composition families around authored collisions', async () => {
			const ir = await build(
				'src/collisions.tsrx',
				`import { shared, state } from "@markless/core"; export const useLedger = shared(() => { let balance = state(0); let setBalance = state(1); let createLedgerShared = state(2); return { balance, setBalance, createLedgerShared, increment() { balance++; } }; }); function LedgerContext() @{ <i /> } export function LedgerProvider() @{ <i /> } export function Ledger() @{ const ledger = useLedger(); <button onClick={() => ledger.increment()}>{ledger.balance}</button> }`,
			);
			const source = emit(ir);
			expect(source).toContain('const LedgerContext2 = createContext()');
			expect(source).toContain('function createLedgerShared2()');
			expect(source).toContain('export function LedgerProvider2(');
			expect(source).toContain('const [balance, setBalance2] = createSignal(0)');

			const directive = await build(
				'src/directive-collision.tsrx',
				`export function DirectiveCollision() @{ const attachHost = 1; <div attach={(node) => { node.dataset.ready = "yes"; }} /> }`,
			);
			expect(emit(directive)).toContain('ref={attachHost2}');
		});

		test('allocates every shared, behavior-capture, cleanup, and lifecycle collision family', async () => {
			const page = await build(
				'src/page-singleton-collision.tsrx',
				`import { shared, state } from "@markless/core"; export const useLedger = shared(() => { let ledgerShared = state(0); return { ledgerShared }; }, { scope: "page" }); export function Ledger() @{ const ledger = useLedger(); <output>{ledger.ledgerShared}</output> }`,
			);
			expect(emit(page)).toContain('const ledgerShared2 = createLedgerShared()');

			const method = await build(
				'src/action-import-collision.tsrx',
				`import { shared, state } from "@markless/core"; export const useActions = shared(() => { let value = state(0); return { value, createSignal() { value++; }, onMount() { value++; } }; }); export function Actions() @{ const actions = useActions(); <button onClick={() => { actions.createSignal(); actions.onMount(); }}>{actions.value}</button> }`,
			);
			const methodSource = emit(method);
			expect(methodSource).toMatch(/import \{ createSignal as createSignal2/);
			expect(methodSource).toContain('const createSignal = () =>');

			const behavior = await build(
				'src/behavior-local-collisions.tsrx',
				`import { state } from "@markless/core"; export function Page() @{ let value = state("one"); const cleanup = 1; const valueInput = 2; const onMount = 3; <div data-values={String(cleanup) + ":" + valueInput + ":" + onMount} attach={(node) => { node.dataset.value = value; return () => { delete node.dataset.value; }; }} /> }`,
			);
			const behaviorSource = emit(behavior);
			expect(behaviorSource).toMatch(/import \{[^}]*onMount as onMount2[^}]*\}/);
			expect(behaviorSource).toContain('let cleanup2 = undefined');
			expect(behaviorSource).toContain('let valueInput2 = value()');
			expect(behaviorSource).toContain('onMount2(() =>');
		});

		test('rejects unknown semantic fields in composition records', async () => {
			const ir = structuredClone(
				await build(
					'src/unknown.tsrx',
					`import { shared, state } from "@markless/core"; export const useValue = shared(() => { let value = state(1); return { value }; }); export function Value() @{ const shared = useValue(); <output>{shared.value}</output> }`,
				),
			) as any;
			ir.records.sharedDefinitions[0].futureSemantic = true;
			expect(() => validateEnrichedIr(ir)).toThrow(
				/SharedDefinition has unknown semantic field/,
			);
		});

		test('fails closed when shared writes or handle linkage are incomplete', async () => {
			const shared = structuredClone(
				await build(
					'src/missing.tsrx',
					`import { shared, state } from "@markless/core"; export const useCounter = shared(() => { let count = state(0); return { count, increment() { count++; } }; }); export function Counter() @{ const counter = useCounter(); <button onClick={() => counter.increment()}>{counter.count}</button> }`,
				),
			) as any;
			shared.records.sharedWrites = [];
			expect(() => emit(shared)).toThrow(
				/SharedWrite records are incomplete for SharedDefinition useCounter/,
			);
			const handle = structuredClone(
				await build(
					'src/handle.tsrx',
					`import { element } from "@markless/core"; export function Search() @{ const input = element<HTMLInputElement>(); <><input el={input} /><button onClick={() => input?.focus()}>focus</button></> }`,
				),
			) as any;
			handle.records.elementHandleBindings = [];
			expect(() => emit(handle)).toThrow(
				/HandleCallRecord has dangling ElementHandleBinding/,
			);
		});

		test('fails closed on unchecked composition event and shared-return linkage', async () => {
			const event = structuredClone(
				await build(
					'src/event-link.tsrx',
					`import { state } from "@markless/core"; function Child() @{ <i /> } export function EventLink() @{ let count = state(0); <><Child /><button onClick={() => count++}>{count}</button></> }`,
				),
			) as any;
			const host = findKind(event.components[0].template, 'host')!;
			host.eventIds = ['event:missing'];
			expect(() => emit(event)).toThrow(/TemplateHost has dangling event id/);

			const shared = structuredClone(
				await build(
					'src/return-link.tsrx',
					`import { shared, state } from "@markless/core"; export const useValue = shared(() => { let value = state(1); return { value }; }); export function Value() @{ const sharedValue = useValue(); <output>{sharedValue.value}</output> }`,
				),
			) as any;
			shared.records.sharedDefinitions[0].returnProperties[0].graphNodeId = 'shared:missing';
			expect(() => emit(shared)).toThrow(
				/SharedReturnProperty value does not resolve to its shared cell/,
			);
		});
	});

	test('has an AST-only boundary without fixture signatures or source recovery', async () => {
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
		expect(emitter).not.toMatch(
			/RenderOnce|KeyedTodo|EventForm|S1|S2|S3|FIXTURE_DIGEST|createHash/,
		);
		expect(regenerate).not.toContain('.tsrx');
		expect(regenerate).toContain('../../compiler/test/goldens');
	});

	describe('metamorphic regeneration', () => {
		test.each(['a"b', "a'b", 'a\nb', 'a{b}', '雪☃', '&quot;&amp;'])(
			'static JSX attributes round-trip with value fidelity: %j',
			async (value) => {
				const ir = clone(await golden('s1-render-once.json'));
				const host = ir.components[0]!.template[0];
				if (host?.kind !== 'host') throw new Error('expected host root');
				(host.staticAttributes as any[]).push({ name: 'data-probe', value });
				const source = emit(ir);
				const module = analyze(source, { lang: 'jsx', sourceType: 'module' });
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
		test('an added static attribute changes only that host attribute', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			const host = ir.components[0]!.template[0];
			if (host?.kind !== 'host') throw new Error('expected host root');
			(host.staticAttributes as any[]).push({ name: 'data-metamorphic', value: 'yes' });
			const changed = emit(ir);
			expect(changed.replace(' data-metamorphic="yes"', '')).toBe(
				emit(await golden('s1-render-once.json')),
			);
		});

		test.each(['a"b', "a'b", 'a\nb', 'a{b}', '雪❄', 'a&amp;b'])(
			'round-trips the static JSX attribute value %j',
			async (value) => {
				const ir = clone(await golden('s1-render-once.json'));
				const host = ir.components[0]!.template[0];
				if (host?.kind !== 'host') throw new Error('expected host root');
				(host.staticAttributes as any[]).push({ name: 'data-probe', value });
				const source = emit(ir);
				expect(staticAttributeValue(source, 'data-probe')).toBe(value);
			},
		);

		test('scrambled local storage order follows semantic order', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			(ir.components[0]!.locals as any[]).reverse();
			expect(emit(ir)).toBe(emit(await golden('s1-render-once.json')));
		});

		test('component, signal, store, row, and ordinary-local renames are data-driven', async () => {
			const s1 = clone(await golden('s1-render-once.json')) as any;
			const s1Renames = new Map([
				['RenderOnce', 'ChangedView'],
				['count', 'total'],
				['prefix', 'caption'],
			]);
			visit(s1, (record) => {
				if (typeof record.name === 'string' && s1Renames.has(record.name))
					record.name = s1Renames.get(record.name);
				if (record.type === 'Identifier' && s1Renames.has(record.name))
					record.name = s1Renames.get(record.name);
			});
			s1.components[0].locals.forEach((local: any) => {
				local.names = local.names.map((name: string) => s1Renames.get(name) ?? name);
			});
			s1.components[0].name = 'ChangedView';
			s1.module.exports[0].componentName = 'ChangedView';
			s1.module.exports[0].exportedName = 'ChangedView';
			const changedS1 = emit(s1);
			expect(changedS1).toContain('function ChangedView');
			expect(changedS1).toContain('const [total, setTotal]');
			expect(changedS1).toContain('const caption = untrack');

			const s2 = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(s2.components[0].template);
			visit(s2, (record) => {
				if (record.type === 'Identifier' && record.name === 'todos')
					record.name = 'records';
				if (record.type === 'Identifier' && record.name === 'todo') record.name = 'entry';
				if (record.name === 'todos') record.name = 'records';
			});
			s2.components[0].locals.find((local: any) => local.names.includes('todos')).names = [
				'records',
			];
			const repeat = findKind(s2.components[0].template, 'keyed-repeat')!;
			repeat.item = 'entry';
			const changedS2 = emit(s2);
			expect(changedS2).toContain('const [records, setRecords] = createStore');
			expect(changedS2).toContain('<For each={records}>{(entry) =>');
		});

		test('a coherent row identity rename drives every keyed store use', async () => {
			const ir = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(ir.components[0].template);
			visit(ir, (record) => {
				if (
					record.type === 'MemberExpression' &&
					record.computed === false &&
					record.property?.type === 'Identifier' &&
					record.property.name === 'id'
				)
					record.property.name = 'identity';
				if (
					record.type === 'Property' &&
					record.computed === false &&
					record.key?.type === 'Identifier' &&
					record.key.name === 'id'
				)
					record.key.name = 'identity';
				if (Array.isArray(record.path))
					record.path = record.path.map((part: string) =>
						part === 'id' ? 'identity' : part,
					);
			});
			validateEnrichedIr(ir);
			const source = emit(ir);
			expect(source).toContain("key: 'identity'");
			expect(source).toContain('identity: `c${next}`');
			expect(source).toContain('item.identity === todo.identity');
			expect(source).toContain('data-oracle-row-key={todo.identity}');
			expect(source).not.toMatch(/\.id\b/);
			expect(
				(await checkSources([{ file: 'generated/CoherentKeyRename.jsx', source }]))
					.violations,
			).toEqual([]);
		});

		test('lexical shadowing and generated import collisions remain binding-safe', async () => {
			const shadowed = clone(await golden('s1-render-once.json')) as any;
			shadowed.records.events[0].handlers[0].expression.body.body.unshift({
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
			expect(emit(shadowed)).toContain('((count) => count)(7)');

			const collided = clone(await golden('s1-render-once.json')) as any;
			visit(collided, (record) => {
				if (record.type === 'Identifier' && record.name === 'count')
					record.name = 'createSignal';
				if (record.name === 'count') record.name = 'createSignal';
			});
			collided.components[0].locals.find((local: any) =>
				local.names.includes('count'),
			).names = ['createSignal'];
			const source = emit(collided);
			expect(source).toContain('createSignal as createSignal2');
			expect(source).toContain('const [createSignal, setCreateSignal] = createSignal2(1)');
		});

		test('opaque graph ids leave binding-kind-driven output unchanged', async () => {
			const baselineIr = await golden('s1-render-once.json');
			const baseline = emit(baselineIr);
			const ir = clone(baselineIr) as any;
			const graphIds = new Map(
				ir.records.bindings.map((binding: any, index: number) => [binding.id, `g${index}`]),
			);
			visit(ir, (record) => {
				for (const [field, value] of Object.entries(record)) {
					if (typeof value === 'string' && graphIds.has(value))
						record[field] = graphIds.get(value);
					else if (Array.isArray(value))
						record[field] = value.map((entry) =>
							typeof entry === 'string' && graphIds.has(entry)
								? graphIds.get(entry)
								: entry,
						);
				}
			});
			validateEnrichedIr(ir);
			expect(ir.records.bindings.map((binding: any) => binding.id)).toEqual([
				'g0',
				'g1',
				'g2',
			]);
			expect(emit(ir)).toBe(baseline);
		});

		test('store-member lowering uses write structure without statement adjacency', async () => {
			const ir = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(ir.components[0].template);
			const handler = ir.records.events
				.flatMap((event: any) => event.handlers)
				.find((entry: any) =>
					entry.writes.some((write: any) => write.path.join('/') === '*/title'),
				);
			handler.expression.body.body.splice(2, 0, {
				type: 'ExpressionStatement',
				expression: { type: 'Literal', value: 0, raw: '0' },
			});
			const source = emit(ir);
			expect(source).toContain('setTodos(produce(');
			expect(source).toMatch(/0;\s*props\.onTrace\('edit'/);
		});

		test('store-member lowering targets the recorded alias across predicate shadowing', async () => {
			const ir = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(ir.components[0].template);
			const handler = ir.records.events
				.flatMap((event: any) => event.handlers)
				.find((entry: any) =>
					entry.writes.some((write: any) => write.path.join('/') === '*/title'),
				);
			visit(handler.expression, (record) => {
				if (record.type === 'Identifier' && record.name === 'alias') record.name = 'item';
			});
			validateEnrichedIr(ir);
			const source = emit(ir);
			expect(source).toMatch(
				/setTodos\(produce\(\(storeDraft\) => \{\s*const item = storeDraft\.find\(\(item\) => item\.id === todo\.id\);\s*item\.title = title;/,
			);
			expect(source).not.toContain('const item = todos.find');
			expect(
				(await checkSources([{ file: 'generated/StoreShadow.jsx', source }])).violations,
			).toEqual([]);
		});
	});

	describe('fail-closed validation', () => {
		test('emits a persisted createSignal fixture that passes the artifact gate', async () => {
			const ir = clone(await golden('s2-keyed-todo.json')) as any;
			const state = ir.records.bindings.find((binding: any) => binding.id === 'state:draft');
			state.initializer = { type: 'Literal', value: 'light', raw: "'light'" };
			ir.records.persistence = [
				persistenceRecord(state.id, state.name, 'light', ir.filename),
			];

			const source = emit(ir);
			const formatted = await formatEmitted(source);
			expect(source).toContain(
				`createSignal(globalThis.${FRAMELESS_STATE_GLOBAL}?.['markless:draft'] ?? 'light')`,
			);
			expect(source).not.toContain(`window.${FRAMELESS_STATE_GLOBAL}`);
			expect(source).not.toMatch(
				new RegExp(`(?:createEffect|onMount)[\\s\\S]*${FRAMELESS_STATE_GLOBAL}`),
			);
			const setter = source.indexOf('setDraft(event.currentTarget.value)');
			const write = source.indexOf(
				"__framelessWrite('markless:draft', 'data-markless-draft', event.currentTarget.value)",
				setter,
			);
			expect(setter).toBeGreaterThan(-1);
			expect(write).toBeGreaterThan(setter);
			expect(source).toMatch(
				/function __framelessWrite\(key, attr, value\) \{\s*try \{\s*localStorage\.setItem\(key, value\);\s*\} catch \{\s*void 0;\s*\}\s*document\.documentElement\.setAttribute\(attr, value\);\s*\}/,
			);
			expect(source.match(/^import .* from 'solid-js';$/gm)).toHaveLength(1);
			if (process.env.UPDATE_GOLDENS === '1')
				await writeFile(resolve(root, 'generated-persistence/P1.jsx'), formatted);
			expect(await readFile(resolve(root, 'generated-persistence/P1.jsx'), 'utf8')).toBe(
				formatted,
			);
			const gate = await checkSources([
				{ file: 'generated-persistence/P1.jsx', source: formatted, artifact: ir },
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
				resolve(root, 'generated-persistence/P1.jsx'),
				'utf8',
			);
			expect(persistedGolden).toContain(`globalThis.${FRAMELESS_STATE_GLOBAL}`);
			expect(persistedGolden).not.toContain(`window.${FRAMELESS_STATE_GLOBAL}`);
		});

		test('keeps an artifact with no persistence records byte-identical', async () => {
			const ir = await golden('s1-render-once.json');
			const before = emit(ir);
			const explicitEmpty = clone(ir);
			// Readonly by design; this is a clone made precisely to be mutated.
			(explicitEmpty.records as { persistence?: unknown }).persistence = [];
			expect(emit(explicitEmpty)).toBe(before);
			expect(before).not.toContain('__framelessWrite');
		});

		test('accepts behavior-input provenance structurally for directive lowering', async () => {
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
							provenance: 'layer-a',
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
			expect(() => validateEnrichedIr(ir)).toThrow(
				/ComponentProps has dangling graph record id/,
			);
		});

		test('rejects an exact /1 artifact with the version diagnostic', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.version = 'frameless-enriched-ir/1';
			expect(() => validateEnrichedIr(ir)).toThrow(
				'Expected frameless-enriched-ir/2, received frameless-enriched-ir/1',
			);
		});

		test('rejects a dangling local component-reference with its construct diagnostic', async () => {
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
			expect(() => validateEnrichedIr(ir)).toThrow(
				/TemplateComponentReference has dangling local component/,
			);
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
			expect(() => validateEnrichedIr(ir)).toThrow(/HandleForwardRecord has dangling edge/);
			ir.records.handleForwards = [{ ...forward, handleBindingId: 'element-handle:missing' }];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/HandleForwardRecord has dangling handleBindingId/,
			);
			ir.records.handleForwards = [{ ...forward, childComponentId: 'component:missing' }];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/HandleForwardRecord has unknown component id/,
			);
		});

		test.each([
			[
				'unknown field',
				(ir: any) => {
					ir.records.bindings[0].futureSemantic = true;
				},
				/EnrichedGraphBinding has unknown semantic field/,
			],
			[
				'dangling id',
				(ir: any) => {
					ir.components[0].locals[1].semanticRecordIds = ['state:missing'];
				},
				/LocalDeclaration has dangling semantic record id/,
			],
			[
				'malformed node',
				(ir: any) => {
					ir.components[0].template[0].kind = 'portal';
				},
				/TemplateNode has malformed construct/,
			],
			[
				'unsupported write',
				(ir: any) => {
					ir.records.events[0].handlers[0].writes[0].operation = 'delete';
				},
				/unsupported write shape/,
			],
			[
				'legacy string',
				(ir: any) => {
					ir.records.events[0].handlers[0].handlerSources = ['ignored'];
				},
				/Legacy source-string field is forbidden/,
			],
		])('rejects %s', async (_name, mutate, message) => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			mutate(ir);
			expect(() => validateEnrichedIr(ir)).toThrow(message);
		});

		test('rejects dangling and mutated keyed semantics', async () => {
			const dangling = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(dangling.components[0].template);
			findKind(dangling.components[0].template, 'keyed-repeat')!.key.reads = [];
			expect(() => validateEnrichedIr(dangling)).toThrow(/unconsumed key semantics/);
			const mutated = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(mutated.components[0].template);
			const write = mutated.records.events
				.flatMap((event: any) => event.handlers)
				.flatMap((handler: any) => handler.writes)
				.find((entry: any) => entry.via === 'handler-local-alias');
			write.path = ['*', 'id'];
			expect(() => validateEnrichedIr(mutated)).toThrow(/unsupported identity mutation/);
		});

		test('sanctions empty branch arms but rejects non-empty element-less arms', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			const branch = findKind(ir.components[0].template, 'branch')!;
			const text = clone(findKind(ir.components[0].template, 'text')!);
			branch.arms[0].children = [];
			expect(() => validateEnrichedIr(ir)).not.toThrow();
			branch.arms[0].children = [text];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/TemplateBranchArm then .* is element-less/,
			);
		});

		test('rejects handler AST reads absent from read records', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.records.events[0].handlers[0].expression.body.body.unshift({
				type: 'ExpressionStatement',
				expression: { type: 'Identifier', name: 'label' },
			});
			expect(() => validateEnrichedIr(ir)).toThrow(/handler AST read absent from records/);
		});

		test('rejects branch AST reads absent from read records', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			const branch = findKind(ir.components[0].template, 'branch')!;
			branch.expression = { type: 'Identifier', name: 'count' };
			branch.reads = [];
			expect(() => validateEnrichedIr(ir)).toThrow(/branch AST read absent from records/);
		});

		test('rejects branch read records absent from the AST', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			const branch = findKind(ir.components[0].template, 'branch')!;
			branch.expression = { type: 'Literal', value: true, raw: 'true' };
			expect(() => validateEnrichedIr(ir)).toThrow(/branch read record absent from AST/);
		});

		test('reconciles computed binding reads in both directions', async () => {
			const absentRecord = clone(await golden('s1-render-once.json')) as any;
			const computed = absentRecord.records.bindings.find(
				(binding: any) => binding.kind === 'computed',
			);
			computed.computed.expression.body = { type: 'Identifier', name: 'count' };
			computed.computed.reads = [];
			expect(() => validateEnrichedIr(absentRecord)).toThrow(
				/computed binding AST read absent from records/,
			);

			const absentAst = clone(await golden('s1-render-once.json')) as any;
			const reverseComputed = absentAst.records.bindings.find(
				(binding: any) => binding.kind === 'computed',
			);
			reverseComputed.computed.expression.body = { type: 'Literal', value: 1, raw: '1' };
			expect(() => validateEnrichedIr(absentAst)).toThrow(
				/computed binding read record absent from AST/,
			);
		});

		test('rejects handler AST writes absent from write records', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.records.events[0].handlers[0].expression.body.body.unshift({
				type: 'ExpressionStatement',
				expression: {
					type: 'AssignmentExpression',
					operator: '=',
					left: { type: 'Identifier', name: 'count' },
					right: { type: 'Literal', value: 7, raw: '7' },
				},
			});
			expect(() => validateEnrichedIr(ir)).toThrow(/handler AST write absent from records/);
		});
	});
});
