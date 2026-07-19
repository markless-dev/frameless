// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { measureAll } from '../scripts/measure-size.mjs';
describe('honest size comparison', () => test('uses clean physical-LOC-primary baselines', async () => {
  for (const file of ['test/baselines/S2.jsx', 'test/baselines/S3.jsx']) expect(await readFile(file, 'utf8')).not.toMatch(/mutation|mutant|factory/);
  const result = await measureAll();
  expect(result).toHaveLength(2);
  for (const row of result) { expect(row.baseline.physicalLoc).toBeGreaterThan(0); expect(row.emitted.physicalLoc).toBeGreaterThan(0); }
}));
