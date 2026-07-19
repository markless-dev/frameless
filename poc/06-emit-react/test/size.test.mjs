// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { measureAll } from '../scripts/measure-size.mjs';

describe('honest emitted-size comparison', () => {
  test('measures clean handwritten S2/S3 baselines by physical LOC and AST nodes', async () => {
    for (const file of ['test/baselines/S2.jsx', 'test/baselines/S3.jsx']) {
      const source = await readFile(file, 'utf8');
      expect(source).not.toMatch(/mutation|mutant|makeReact|\btype\s/);
    }
    expect(await measureAll()).toMatchInlineSnapshot(`
      [
        {
          "baseline": {
            "physicalLoc": 41,
            "structuralNodes": 500,
          },
          "emitted": {
            "physicalLoc": 86,
            "structuralNodes": 554,
          },
          "scenario": "S2",
        },
        {
          "baseline": {
            "physicalLoc": 26,
            "structuralNodes": 225,
          },
          "emitted": {
            "physicalLoc": 47,
            "structuralNodes": 245,
          },
          "scenario": "S3",
        },
      ]
    `);
  });
});
