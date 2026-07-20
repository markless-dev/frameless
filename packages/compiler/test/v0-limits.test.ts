import { describe, expect, test } from 'vitest';
import { buildEnrichedIr } from '../src/build';

describe('v0 module limits', () => {
	test('fails closed when a module exports more than one component', async () => {
		const source = `
			export function First() @{ <div>first</div> }
			export function Second() @{ <div>second</div> }
		`;
		await expect(buildEnrichedIr({ filename: 'two.tsrx', source })).rejects.toThrow(
			'exactly one exported component',
		);
	});

	test('fails closed for cross-module relative imports', async () => {
		const source = `
			import { Child } from './child.tsrx';
			export function Parent() @{ <div>parent</div> }
		`;
		await expect(buildEnrichedIr({ filename: 'parent.tsrx', source })).rejects.toThrow(
			'cross-TSRX component imports are unsupported',
		);
	});

	test('fails closed when the component is not exported', async () => {
		const source = `function Private() @{ <div>private</div> }`;
		await expect(buildEnrichedIr({ filename: 'private.tsrx', source })).rejects.toThrow(
			'requires the component to be exported',
		);
	});
});
