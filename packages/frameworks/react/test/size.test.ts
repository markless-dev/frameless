import { describe, expect, test } from 'vitest';
import { measureAll } from '../scripts/measure-size.ts';

describe('honest emitted structure comparison', () => {
	test('measures the actual calibrated handwritten component bodies', async () => {
		expect(await measureAll()).toEqual([
			{
				scenario: 'S1',
				reference: { physicalLoc: 39, structuralNodes: 161 },
				emitted: { physicalLoc: 31, structuralNodes: 153 },
			},
			{
				scenario: 'S2',
				reference: { physicalLoc: 98, structuralNodes: 576 },
				emitted: { physicalLoc: 102, structuralNodes: 537 },
			},
			{
				scenario: 'S3',
				reference: { physicalLoc: 69, structuralNodes: 307 },
				emitted: { physicalLoc: 51, structuralNodes: 226 },
			},
		]);
	});
});
