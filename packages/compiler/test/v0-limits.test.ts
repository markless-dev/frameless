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
