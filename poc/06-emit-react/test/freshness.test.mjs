import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { emitReact, validateEnrichedIR } from '../src/emitter/index.mjs';

const fixtures = [
  ['S1.jsx', 's1-render-once.json'],
  ['S2.jsx', 's2-keyed-todo.json'],
  ['S3.jsx', 's3-event-form.json'],
];

describe('checked-in generated output', () => {
  for (const [output, golden] of fixtures) test(`${output} is fresh and consumes only enriched JSON`, async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens', golden), 'utf8'));
    validateEnrichedIR(ir);
    expect(await readFile(resolve('generated', output), 'utf8')).toBe(emitReact(ir));
  });

  test('the emitter boundary has no source parser or author/runtime dependency', async () => {
    const emitter = await readFile(resolve('src/emitter/index.mjs'), 'utf8');
    const converter = await readFile(resolve('src/emitter/estree-to-babel.mjs'), 'utf8');
    const regenerate = await readFile(resolve('scripts/regenerate.mjs'), 'utf8');
    expect(`${emitter}\n${converter}`).not.toMatch(/from ['"](?:@babel\/parser|@markless\/|@tsrx\/)/);
    expect(regenerate).not.toContain('.tsrx');
    expect(regenerate).toContain('../05-enriched-ir/test/goldens');
  });
});
