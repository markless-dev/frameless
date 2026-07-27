import { describe, expect, test } from 'vitest';
import { buildEnrichedIr } from '../src/build';

describe('enriched-ir/2 module composition', () => {
	test('accepts and exports more than one component', async () => {
		const source = `
			export function First() @{ <div>first</div> }
			export function Second() @{ <div>second</div> }
		`;
		const ir = await buildEnrichedIr({ filename: 'two.tsrx', source });
		expect(ir.components.map((component) => component.name)).toEqual(['First', 'Second']);
		expect(ir.module.exports.map((entry) => entry.componentName)).toEqual(['First', 'Second']);
	});

	test('retains relative TSRX imports as module records', async () => {
		const source = `
			import { Child } from './child.tsrx';
			export function Parent() @{ <div>parent</div> }
		`;
		const ir = await buildEnrichedIr({ filename: 'parent.tsrx', source });
		expect(ir.imports).toEqual([
			expect.objectContaining({ source: './child.tsrx', resolvesTo: 'tsrx-module' }),
		]);
	});

	test('retains an unexported local component without adding a module export', async () => {
		const source = `function Private() @{ <div>private</div> }`;
		const ir = await buildEnrichedIr({ filename: 'private.tsrx', source });
		expect(ir.components.map((component) => component.name)).toEqual(['Private']);
		expect(ir.module.exports).toEqual([]);
	});

	test('uses the AST export table without changing the component id', async () => {
		const source = `function LocalChild() @{ <div>child</div> } export { LocalChild as PublicChild };`;
		const ir = await buildEnrichedIr({ filename: 'renamed.tsrx', source });
		expect(ir.components[0]).toMatchObject({
			id: 'component:0:LocalChild',
			name: 'LocalChild',
		});
		expect(ir.module.exports).toEqual([
			{ kind: 'named', componentName: 'LocalChild', exportedName: 'PublicChild' },
		]);
	});
});

/**
 * THE SyncPolicy CONDITION VOCABULARY, pinned end to end.
 *
 * Every adapter's conditional-cancellation design rests on this set being CLOSED
 * and on where its edges are. T011 §1.2 established it by measurement; nothing
 * asserted it, so it was a fact about one afternoon rather than a contract.
 *
 * WHAT DEPENDS ON THIS FILE:
 *
 *   - Qwik SYNTHESIZES its `sync$()` guard from these condition types. Closure
 *     freedom is a property of that generator precisely because the vocabulary
 *     cannot reach anything but a flat event field and a JSON literal. Widen the
 *     set and that argument stops holding.
 *   - Qwik's V5 self-assertion and Solid's branches refusal are both unreachable
 *     TODAY. The tests below are what make "unreachable" a measurement.
 *   - Every emitter must emit `===`, because the IR records strict equality even
 *     where the author wrote `==`.
 *
 * These are compiler-boundary facts, not emitter choices; nothing here encodes
 * any adapter's limit.
 */
describe('SyncPolicy extraction vocabulary', () => {
	const guarded = (handler: string) => `import { state } from '@markless/core';

export function Guarded({ onTrace }) @{
	let locked = state(true);

	<form>
		<button type="submit" onClick={${handler}} />
		<output>{locked}</output>
	</form>
}
`;

	async function policyFor(handler: string) {
		const ir = await buildEnrichedIr({
			filename: 'guarded.tsrx',
			source: guarded(handler),
		});
		return ir.records.events[0]?.syncPolicy;
	}

	test('an event field compared to a literal becomes event-equals', async () => {
		expect(
			await policyFor(
				`(event) => { if (event.key === 'Enter') { event.preventDefault(); } }`,
			),
		).toEqual({
			when: { type: 'event-equals', field: 'key', value: 'Enter' },
			actions: ['preventDefault'],
		});
	});

	test('`==` is recorded as the SAME strict event-equals as `===`', async () => {
		// The IR keeps no trace of the authored operator, and Markless's own
		// evaluator compares with `===`. An emitter must therefore emit `===` even
		// where the author wrote `==`: THE IR, NOT THE SOURCE TEXT, IS THE CONTRACT.
		expect(
			await policyFor(`(event) => { if (event.detail == 1) { event.preventDefault(); } }`),
		).toEqual({
			when: { type: 'event-equals', field: 'detail', value: 1 },
			actions: ['preventDefault'],
		});
	});

	test('a state read becomes graph-truthy, naming the graph node', async () => {
		expect(
			await policyFor(`(event) => { if (locked) { event.preventDefault(); } }`),
		).toEqual({
			when: { type: 'graph-truthy', graphNodeId: 'state:locked', path: [] },
			actions: ['preventDefault'],
		});
	});

	test('an unguarded call becomes constant-truthy true', async () => {
		expect(await policyFor(`(event) => { event.stopPropagation(); }`)).toEqual({
			when: { type: 'constant-truthy', value: true },
			actions: ['stopPropagation'],
		});
	});

	test('negation, conjunction and disjunction are all reachable', async () => {
		expect(
			await policyFor(
				`(event) => { if (!(event.key === 'Escape')) { event.preventDefault(); } }`,
			),
		).toMatchObject({
			when: {
				type: 'not',
				condition: { type: 'event-equals', field: 'key', value: 'Escape' },
			},
		});
		expect(
			await policyFor(
				`(event) => { if (event.key === 'Enter' && locked) { event.preventDefault(); } }`,
			),
		).toMatchObject({
			when: {
				type: 'and',
				conditions: [
					{ type: 'event-equals', field: 'key', value: 'Enter' },
					{ type: 'graph-truthy', graphNodeId: 'state:locked', path: [] },
				],
			},
		});
		expect(
			await policyFor(
				`(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); } }`,
			),
		).toMatchObject({
			when: {
				type: 'or',
				conditions: [
					{ type: 'event-equals', field: 'key', value: 'Enter' },
					{ type: 'event-equals', field: 'key', value: ' ' },
				],
			},
		});
	});

	test('both declared action names reach the policy, in authored order', async () => {
		expect(
			await policyFor(
				`(event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); } }`,
			),
		).toEqual({
			when: { type: 'event-equals', field: 'key', value: 'Enter' },
			actions: ['preventDefault', 'stopPropagation'],
		});
	});

	test('THE CLOSING EDGE: a guard reaching past a flat event field is REFUSED upstream', async () => {
		// This is what makes the vocabulary closed rather than merely small.
		// `eventFieldName()` requires the object to BE the event parameter and the
		// property to be static, so `event.target.<attr>` - the shape a naive
		// design would assume is available - never reaches an emitter at all.
		// Markless fails the compile instead of silently dropping the policy.
		await expect(
			policyFor(
				`(event) => { if (event.target.tagName === 'INPUT') { event.preventDefault(); } }`,
			),
		).rejects.toThrow('MARKLESS_SYNC_POLICY_UNEXTRACTABLE');
	});

	test('THE OTHER EDGE: an else-branch action is NOT extracted', async () => {
		// A known extraction gap, recorded here rather than worked around. The
		// consequent's action is declared; the alternate's is not, so to an emitter
		// it is an ordinary statement. The Qwik emitter refuses to lower a handler
		// in this shape for exactly that reason - see
		// packages/frameworks/qwik/test/v-limits.test.ts.
		expect(
			await policyFor(
				`(event) => { if (event.key === 'Enter') { event.preventDefault(); } else { event.stopPropagation(); } }`,
			),
		).toEqual({
			when: { type: 'event-equals', field: 'key', value: 'Enter' },
			actions: ['preventDefault'],
		});
	});

	test('the branches form is UNREACHABLE from authored source today', async () => {
		// T011 §1.3 ruled that `{branches}` arises iff one event prop carries two or
		// more handler functions. Measured: authoring that shape fails EARLIER, in
		// handler reconciliation, so no adapter can currently receive the form at
		// all. Qwik's V2 and Solid's branches refusal are therefore self-assertions
		// in V5's family - which is precisely why they need this test rather than a
		// reachable mutant.
		await expect(
			policyFor(
				`[(event) => { event.preventDefault(); }, (event) => { event.stopPropagation(); }]`,
			),
		).rejects.toThrow(/expected 2 handler AST\(s\), found 1/);
	});
});
