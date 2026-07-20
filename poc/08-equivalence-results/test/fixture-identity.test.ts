// @vitest-environment node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

// The markless vite plugin only transforms .tsrx inside its package root, so the
// fixtures are vendored locally. This test proves they are byte-identical to the
// poc/05 originals the EnrichedIR goldens (and thus the emitted React/Solid
// components) were built from — the "same source" claim stays machine-checked.
const names = ['s2-keyed-todo.tsrx', 's3-event-form.tsrx'];

describe('vendored fixtures are byte-identical to poc/05 originals', () => {
  for (const name of names) test(name, async () => {
    const local = await readFile(path.join(process.cwd(), 'src/fixtures', name), 'utf8');
    const original = await readFile(path.join(process.cwd(), '../05-enriched-ir/src/fixtures', name), 'utf8');
    expect(local).toBe(original);
  });

  test('S1 direct fixture differs only by the finding #6 alias probe', async () => {
    const direct = await readFile(path.join(process.cwd(), 'src/fixtures/s1-render-once.tsrx'), 'utf8');
    const plain = await readFile(path.join(process.cwd(), 'src/fixtures/s1-render-once-plain.tsrx'), 'utf8');
    expect(direct
      .replace('{ label: displayLabel,', '{ label,')
      .replace('${displayLabel}:', '${label}:'))
      .toBe(plain);
    const original = await readFile(path.join(process.cwd(), '../05-enriched-ir/src/fixtures/s1-render-once.tsrx'), 'utf8');
    expect(plain).toBe(original);
  });
});
