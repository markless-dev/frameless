import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitSolid } from '../src/emitter/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = [['S1.jsx', 's1-render-once.json'], ['S2.jsx', 's2-keyed-todo.json'], ['S3.jsx', 's3-event-form.json']];
for (const [output, golden] of fixtures) {
  const ir = JSON.parse(await readFile(resolve(root, '../05-enriched-ir/test/goldens', golden), 'utf8'));
  await writeFile(resolve(root, 'generated', output), emitSolid(ir));
}
