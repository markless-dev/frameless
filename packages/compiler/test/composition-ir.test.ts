import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildEnrichedIr } from '../src/build.ts';

const fixture = async (name: string) =>
	buildEnrichedIr({
		filename: `src/${name}.tsrx`,
		source: readFileSync(new URL(`./fixtures/${name}.tsrx`, import.meta.url), 'utf8'),
	});

describe('frameless-enriched-ir/2 composition contracts', () => {
	test('attributes distinct component records and retains an unexported local child', async () => {
		const ir = await buildEnrichedIr({
			filename: 'src/ownership.tsrx',
			source: `import { state } from "@markless/core";
			export function Parent({ label }) @{ let left = state(0); <><Child /><span>{label}</span><button onClick={() => left++}>{left}</button></> }
			function Child() @{ let right = state(0); <button onClick={() => right++}>{right}</button> }
		`,
		});
		expect(ir.version).toBe('frameless-enriched-ir/2');
		expect(ir.components.map(({ id, name }) => ({ id, name }))).toEqual([
			{ id: 'component:0:Parent', name: 'Parent' },
			{ id: 'component:1:Child', name: 'Child' },
		]);
		expect(ir.module.exports.map((item) => item.componentName)).toEqual(['Parent']);
		const componentIds = new Set(ir.components.map((component) => component.id));
		for (const records of [
			ir.records.bindings,
			ir.records.aliases,
			ir.records.events,
			ir.records.stateReads,
			ir.records.stateWrites,
		]) {
			expect(records.length).toBeGreaterThan(0);
			expect(records.every((record) => componentIds.has(record.componentId))).toBe(true);
		}
		expect(new Set(ir.records.events.map((event) => event.componentId))).toEqual(componentIds);
	});

	test('rejects duplicate component-local graph binding names with the vendor gate diagnostic', async () => {
		const source = `import { state } from "@markless/core";
			export function Alpha() @{ let count = state(0); <button onClick={() => count++}>{count}</button> }
			export function Beta() @{ let count = state(0); <button onClick={() => count++}>{count}</button> }`;
		await expect(buildEnrichedIr({ filename: 'src/collision.tsrx', source })).rejects.toThrow(
			'Graph binding ownership collision for "count" between components "Alpha" and "Beta"; this construct is blocked by the vendor identity refresh gate.',
		);
	});

	test('preserves every shared semantic record from the pinned probe', async () => {
		const ir = await buildEnrichedIr({
			filename: 'src/shared-probe.tsrx',
			source: `import { shared, state } from "@markless/core";
				export const useCounter = shared(() => {
					let count = state(0);
					return { count, increment() { count++; } };
				});
				export function Counter() @{
					const counter = useCounter();
					<button onClick={() => counter.increment()}>{counter.count}</button>
				}`,
		});
		expect(ir.records.sharedDefinitions).toHaveLength(1);
		expect(ir.records.sharedInstances).toHaveLength(1);
		expect(ir.records.sharedReads).toHaveLength(1);
		expect(ir.records.sharedCalls).toHaveLength(1);
		expect(ir.records.sharedWrites).toHaveLength(1);
		expect(ir.records.sharedDefinitions[0]).toMatchObject({
			name: 'useCounter',
			scope: 'request',
			cells: [{ name: 'count', valueKind: 'scalar' }],
			methods: [{ name: 'increment' }],
		});
	});

	test('fails closed when a shared factory has no declarator binding', async () => {
		const source = `import { shared, state } from "@markless/core";
			export default shared(() => { let count = state(0); return { count }; });
			export function Reader() @{ <output>reader</output> }`;
		await expect(
			buildEnrichedIr({ filename: 'src/shared-anonymous.tsrx', source }),
		).rejects.toThrow(
			'Shared factory in src/shared-anonymous.tsrx has no identifier declarator binding.',
		);
	});

	test.each(['request', 'container', 'page'] as const)(
		'preserves the authored %s shared scope',
		async (scope) => {
			const source = `import { shared, state } from "@markless/core";
				export const useValue = shared(() => { let value = state(0); return { value }; }, { scope: "${scope}" });
				export function Reader() @{ const sharedValue = useValue(); <output>{sharedValue.value}</output> }`;
			const ir = await buildEnrichedIr({ filename: `src/scope-${scope}.tsrx`, source });
			expect(ir.records.sharedDefinitions[0]?.scope).toBe(scope);
		},
	);

	test('lowers el, attach, and imperative calls to records rather than attributes', async () => {
		const ir = await fixture('composition-handles');
		expect(ir.records.elementHandleBindings).toHaveLength(1);
		expect(ir.records.behaviors).toHaveLength(1);
		expect(ir.records.handleCalls).toHaveLength(1);
		expect(ir.records.handleCalls[0]).toMatchObject({
			method: 'focus',
			optional: true,
			eventId: 'event:0',
		});
		expect(
			ir.components.flatMap((component) => JSON.stringify(component.template)),
		).not.toContain('"name":"el"');
		expect(
			ir.components.flatMap((component) => JSON.stringify(component.template)),
		).not.toContain('"name":"attach"');
	});

	test('lowers component references with preserved children and default projections', async () => {
		const ir = await fixture('composition-children');
		const frame = ir.components.find((component) => component.name === 'Frame')!;
		const page = ir.components.find((component) => component.name === 'Page')!;
		expect(JSON.stringify(frame.template)).toContain('default-slot-projection');
		const reference = page.template[0];
		expect(reference).toMatchObject({
			kind: 'component-reference',
			edgeId: 'component-edge:0',
			target: { module: 'self', localName: 'Frame' },
		});
		expect(JSON.stringify(reference)).toContain('projected');
	});

	test('lowers props.children member access to a default-slot-projection', async () => {
		const ir = await buildEnrichedIr({
			filename: 'src/member-children.tsrx',
			source: 'export function Frame(props) @{ <section>{props.children}</section> }',
		});
		const template = JSON.stringify(ir.components[0]!.template);
		expect(template).toContain('default-slot-projection');
		expect(template).not.toContain('dynamic-text');
		await expect(
			buildEnrichedIr({
				filename: 'src/unmappable-member-children.tsrx',
				source: 'export function Frame(props) @{ <section>{props.children.value}</section> }',
			}),
		).rejects.toThrow(/DefaultSlotProjection children read/);
	});

	test('fails closed for the counter.missing shared-read probe', async () => {
		const missingProperty = `import { shared, state } from "@markless/core";
			export const useCounter = shared(() => { let count = state(0); return { count }; });
			export function Reader() @{ const counter = useCounter(); <output>{counter.missing}</output> }`;
		await expect(
			buildEnrichedIr({ filename: 'src/shared-missing.tsrx', source: missingProperty }),
		).rejects.toThrow(
			'Shared read counter.missing for definition shared:src/shared-missing.tsrx#useCounter has unmapped property missing.',
		);
	});

	test('fails closed when a shared factory is called inline in a template expression', async () => {
		const inlineSharedRead = `import { shared, state } from "@markless/core";
			export const useC = shared(() => { let count = state(0); return { count, increment() { count++; } }; });
			export function A() @{\n\t<output>{useC().missing}</output>\n}`;
		await expect(
			buildEnrichedIr({ filename: 'src/shared-inline.tsrx', source: inlineSharedRead }),
		).rejects.toThrow(
			'Shared factory useC is called inline in a template expression; bind the instance to a local first, or the property missing is unmapped.',
		);
	});

	test('fails closed when a shared factory is called inline in an event handler', async () => {
		const inlineSharedCall = `import { shared, state } from "@markless/core";
			export const useC = shared(() => { let count = state(0); return { count, increment() { count++; } }; });
			export function A() @{ <button onClick={() => useC().increment()}>go</button> }`;
		await expect(
			buildEnrichedIr({ filename: 'src/shared-inline-handler.tsrx', source: inlineSharedCall }),
		).rejects.toThrow(
			'Shared factory useC is called inline in a handler expression; bind the instance to a local first, or the property increment is unmapped.',
		);
	});

	test('fails closed for the returned-function counter.increment shared-call probe', async () => {
		const returnedFunction = `import { shared, state } from "@markless/core";
			export const useCounter = shared(() => {
				let count = state(0);
				const increment = () => count++;
				return { count, increment };
			});
			export function Incrementer() @{
				const counter = useCounter();
				<button onClick={() => counter.increment()}>increment</button>
			}`;
		await expect(
			buildEnrichedIr({
				filename: 'src/shared-returned-function.tsrx',
				source: returnedFunction,
			}),
		).rejects.toThrow(
			'Shared call counter.increment for definition shared:src/shared-returned-function.tsrx#useCounter has unmapped property increment.',
		);
	});

	test('marks relative TSRX imports and preserves structured component props', async () => {
		const ir = await fixture('composition-import');
		expect(ir.imports).toEqual([
			expect.objectContaining({ source: './child.tsrx', resolvesTo: 'tsrx-module' }),
		]);
		expect(ir.components[0]!.template[0]).toMatchObject({
			kind: 'component-reference',
			target: { module: './child.tsrx', exportedName: 'Child', localName: 'Child' },
			props: [{ name: 'value', value: { expression: { type: 'Literal' }, reads: [] } }],
		});
	});
});
