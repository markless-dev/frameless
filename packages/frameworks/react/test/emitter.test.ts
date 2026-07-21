import { readFile } from 'node:fs/promises';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { analyze } from 'yuku-analyzer';
import { parse } from 'yuku-parser';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

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
	const parsed = parse(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	expect(parsed.diagnostics).toEqual([]);
	const module = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
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

describe('React structural emitter', () => {
	for (const [output, golden] of fixtures) {
		test(`${output} is fresh from the compiler EnrichedIR golden`, async () => {
			const ir = JSON.parse(
				await readFile(resolve(goldenRoot, golden), 'utf8'),
			) as EnrichedIR;
			validateEnrichedIr(ir);
			expect(await readFile(resolve(root, 'generated', output), 'utf8')).toBe(
				await formatEmitted(emit(ir)),
			);
		});
	}

	test('applies every dossier-required POC delta without source recovery', async () => {
		const [s1, s2, s3] = await Promise.all(
			['S1.jsx', 'S2.jsx', 'S3.jsx'].map((file) =>
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

	describe('metamorphic regeneration from the checked-in golden', () => {
		test.each(['a"b', "a'b", 'a\nb', 'a{b}', '雪☃', '&quot;&amp;'])(
			'static JSX attributes round-trip with value fidelity: %j',
			async (value) => {
				const ir = clone(await golden('s1-render-once.json'));
				const root = ir.components[0]!.template[0];
				if (root?.kind !== 'host') throw new Error('expected host root');
				(root.staticAttributes as any[]).push({ name: 'data-probe', value });
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
				lang: 'jsx',
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

		test('emits every local/exported component, nested JSX, slots, and generated-extension imports', async () => {
			const local = await build(
				'src/composition.tsrx',
				`function Frame({ children }) @{ <section>{children}</section> }
				export function Page() @{ <Frame><strong>projected</strong></Frame> }`,
			);
			const source = emit(local);
			expect(source).toContain('function Frame({ children })');
			expect(source).toContain('export function Page({})');
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
			expect(analyze(source, { lang: 'jsx', sourceType: 'module' }).diagnostics).toEqual([]);
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
				analyze(containerSource, { lang: 'jsx', sourceType: 'module' }).diagnostics,
			).toEqual([]);

			const page = clone(ir) as any;
			page.records.sharedDefinitions[0].scope = 'page';
			const pageSource = emit(page);
			expect(pageSource).toContain('function createLedgerStore2()');
			expect(pageSource).toContain('const ledgerStore2 = createLedgerStore2()');
			expect(pageSource).toContain('const subscribeLedgerToNothing2 =');
			expect(pageSource).toContain('const getLedgerNothing2 =');
			expect(analyze(pageSource, { lang: 'jsx', sourceType: 'module' }).diagnostics).toEqual(
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
