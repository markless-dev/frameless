import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { emitSolid, validateEnrichedIR } from '../src/emitter/index.mjs';

const fixtures = [['S1.jsx', 's1-render-once.json'], ['S2.jsx', 's2-keyed-todo.json'], ['S3.jsx', 's3-event-form.json']];
function findKind(value, kind) {
  if (!value || typeof value !== 'object') return null;
  if (value.kind === kind) return value;
  for (const child of Object.values(value)) {
    const found = Array.isArray(child)
      ? child.map((entry) => findKind(entry, kind)).find(Boolean)
      : findKind(child, kind);
    if (found) return found;
  }
  return null;
}
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
  test('rejects unsupported construct values instead of fixture bytes', async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens/s1-render-once.json'), 'utf8'));
    ir.components[0].evaluation.ordinaryLocals = 'reactive';
    expect(() => validateEnrichedIR(ir)).toThrow(/Unsupported evaluation policy/);
    ir.components[0].evaluation.ordinaryLocals = 'once-per-instance';
    ir.components[0].template[0].children[0].kind = 'future-portal';
    expect(() => validateEnrichedIR(ir)).toThrow(/Unsupported template construct.*future-portal/);
  });
  test('regenerates a documented S1 variant without a fixture signature lock', async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens/s1-render-once.json'), 'utf8'));
    const original = emitSolid(ir);

    // Contract mutation: add one static root attribute and scramble storage order.
    // The semantic `order` field still controls setup order; only the attribute may differ.
    ir.components[0].template[0].staticAttributes.push({ name: 'data-regeneration-variant', value: 'accepted' });
    ir.components[0].locals.reverse();
    const changed = emitSolid(ir);

    expect(changed).not.toBe(original);
    expect(changed).toContain('data-regeneration-variant="accepted"');
    expect(changed.replace(' data-regeneration-variant="accepted"', '')).toBe(original);
  });
  test('accepts a renamed component instead of dispatching on fixture names', async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens/s1-render-once.json'), 'utf8'));
    ir.components[0].name = 'RenderOnceVariant';
    ir.module.exports[0].componentName = 'RenderOnceVariant';
    ir.module.exports[0].exportedName = 'RenderOnceVariant';
    expect(emitSolid(ir)).toContain('export function RenderOnceVariant(props)');
  });
  test('keeps explicit legacy-string and degraded-path rejection', async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens/s1-render-once.json'), 'utf8'));
    ir.records.events[0].handlers[0].handlerSources = ['ignored'];
    expect(() => emitSolid(ir)).toThrow(/Legacy source-string field is forbidden: handlerSources/);
    delete ir.records.events[0].handlers[0].handlerSources;
    ir.records.stateReads[0].path = ['label()'];
    expect(() => emitSolid(ir)).toThrow(/Degraded path is forbidden/);
  });
  test('sync policy records place preventDefault even when the handler AST omits its duplicate', async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens/s3-event-form.json'), 'utf8'));
    const submit = ir.records.events.find((event) => event.syncPolicy?.actions?.includes('preventDefault'));
    submit.handlers[0].expression.body.body.shift();
    const source = emitSolid(ir);
    expect(source).toMatch(/onClick=\{event => \{\s*event\.preventDefault\(\);\s*setWrites\(1\)/);
  });
  test('consumes the keyed-repeat key discipline instead of ignoring the key record', async () => {
    const ir = JSON.parse(await readFile(resolve('../05-enriched-ir/test/goldens/s2-keyed-todo.json'), 'utf8'));
    const repeat = findKind(ir.components[0].template, 'keyed-repeat');
    repeat.key.expression.property.name = 'title';
    repeat.key.reads[0].path = ['title'];
    expect(() => emitSolid(ir)).toThrow(/Unsupported keyed-repeat identity mutation.*todo\.title/);
  });
  test('the emitter boundary contains no author-source parser or TSRX dependency', async () => {
    const source = await readFile(resolve('src/emitter/index.mjs'), 'utf8');
    const regenerate = await readFile(resolve('scripts/regenerate.mjs'), 'utf8');
    expect(source).not.toMatch(/from ['"](?:@babel\/parser|@markless\/|@tsrx\/)/);
    expect(source).not.toMatch(/FIXTURE_DIGESTS|createHash|renderOnce\(|keyedTodo\(|eventForm\(/);
    expect(regenerate).not.toContain('.tsrx');
    expect(regenerate).toContain('../05-enriched-ir/test/goldens');
  });
});
