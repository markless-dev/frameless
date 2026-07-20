import { describe, expect, test } from 'vitest';
import { measureAll } from '../scripts/measure-size.ts';

describe('honest emitted structure comparison', () => {
	test('measures calibrated handwritten bodies with physical LOC primary', async () => {
		expect(await measureAll()).toEqual([
			{
				scenario: 'S1',
				reference: { physicalLoc: 35, structuralNodes: 165 },
				emitted: { physicalLoc: 35, structuralNodes: 143 },
			},
			{
				scenario: 'S2',
				reference: { physicalLoc: 114, structuralNodes: 640 },
				emitted: { physicalLoc: 175, structuralNodes: 560 },
			},
			{
				scenario: 'S3',
				reference: { physicalLoc: 78, structuralNodes: 326 },
				emitted: { physicalLoc: 74, structuralNodes: 233 },
			},
		]);
	});
});
