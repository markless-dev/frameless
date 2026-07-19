import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { emitSolid, validateEnrichedIR } from '../src/emitter/index.mjs';

const fixtures = [['S1.jsx', 's1-render-once.json'], ['S2.jsx', 's2-keyed-todo.json'], ['S3.jsx', 's3-event-form.json']];
describe('checked-in generated output', () => {
  for (const [output, golden] of fixtures) test(`${output} is fresh from enriched JSON`, async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens', golden), 'utf8'));
    expect(await readFile(resolve('generated', output), 'utf8')).toBe(emitSolid(ir));
  });
  test('rejects unsupported fields instead of ignoring them', async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens/s1-render-once.json'), 'utf8'));
    ir.components[0].template[0].futureSemantic = true;
    expect(() => validateEnrichedIR(ir)).toThrow(/Unsupported IR field/);
  });
  test('rejects changed values in otherwise known fields', async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens/s1-render-once.json'), 'utf8'));
    ir.components[0].evaluation.ordinaryLocals = 'reactive';
    expect(() => validateEnrichedIR(ir)).toThrow(/Unsupported evaluation policy/);
    ir.components[0].evaluation.ordinaryLocals = 'once-per-instance';
    ir.components[0].template[0].arms[0].children[0].staticAttributes[0].value = 'silently-changed';
    expect(() => validateEnrichedIR(ir)).toThrow(/fixture contract changed/);
  });
  test('the emitter boundary contains no author-source parser or TSRX dependency', async () => {
    const source = await readFile(resolve('src/emitter/index.mjs'), 'utf8');
    const regenerate = await readFile(resolve('scripts/regenerate.mjs'), 'utf8');
    expect(source).not.toMatch(/from ['"](?:@babel\/parser|@markless\/|@tsrx\/)/);
    expect(regenerate).not.toContain('.tsrx');
    expect(regenerate).toContain('../05-enriched-ir/test/goldens');
  });
});
