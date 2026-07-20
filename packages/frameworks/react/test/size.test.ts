import { describe, expect, test } from 'vitest';
import { measureAll } from '../scripts/measure-size.ts';

describe('honest emitted structure comparison', () => {
	test('measures the actual calibrated handwritten component bodies', async () => {
		expect(await measureAll()).toEqual([
			{
				scenario: 'S1',
				reference: { physicalLoc: 39, structuralNodes: 158 },
				emitted: { physicalLoc: 35, structuralNodes: 150 },
			},
			{
				scenario: 'S2',
				reference: { physicalLoc: 98, structuralNodes: 573 },
				emitted: { physicalLoc: 157, structuralNodes: 534 },
			},
			{
				scenario: 'S3',
				reference: { physicalLoc: 69, structuralNodes: 305 },
				emitted: { physicalLoc: 77, structuralNodes: 225 },
			},
		]);
	});
});
