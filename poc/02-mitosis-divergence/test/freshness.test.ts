import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { compileFixture } from '../scripts/compiler.mjs';

describe('generated artifacts are fresh', () => {
  test('committed React/Solid outputs match a fresh mitosis 0.13.2 compile', async () => {
    const source = await readFile(new URL('../src/update-probe.lite.tsx', import.meta.url), 'utf8');
    const outputs = compileFixture(source);
    const react = await readFile(new URL('../generated/update-probe.react.jsx', import.meta.url), 'utf8');
    const solid = await readFile(new URL('../generated/update-probe.solid.jsx', import.meta.url), 'utf8');
    expect(react).toBe(outputs.react);
    expect(solid).toBe(outputs.solid);
  });
});
