import { describe, expect, test } from 'vitest';
import { measureAll } from '../scripts/measure-size.ts';

describe('honest emitted structure comparison', () => {
	test('measures calibrated handwritten bodies with physical LOC primary', async () => {
		expect(await measureAll()).toEqual([
			{
				scenario: 'S1',
				reference: { physicalLoc: 35, structuralNodes: 166 },
				emitted: { physicalLoc: 29, structuralNodes: 144 },
			},
			{
				scenario: 'S2',
				reference: { physicalLoc: 114, structuralNodes: 645 },
				emitted: { physicalLoc: 112, structuralNodes: 563 },
			},
			{
				scenario: 'S3',
				reference: { physicalLoc: 87, structuralNodes: 352 },
				emitted: { physicalLoc: 57, structuralNodes: 258 },
			},
		]);
	});
});
