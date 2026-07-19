import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from '@babel/parser';

const pairs = [{ scenario: 'S2', baseline: 'test/baselines/S2.jsx', emitted: 'generated/S2.jsx' }, { scenario: 'S3', baseline: 'test/baselines/S3.jsx', emitted: 'generated/S3.jsx' }];
function component(ast) { return ast.program.body.find((node) => node.type === 'ExportNamedDeclaration')?.declaration; }
function nodes(value) {
  if (!value || typeof value !== 'object') return 0;
  return (typeof value.type === 'string' ? 1 : 0) + Object.entries(value).reduce((sum, [key, child]) => ['loc','start','end','leadingComments'].includes(key) ? sum : sum + (Array.isArray(child) ? child.reduce((n, item) => n + nodes(item), 0) : nodes(child)), 0);
}
async function measure(file) { const source = await readFile(resolve(file), 'utf8'); const fn = component(parse(source, { sourceType: 'module', plugins: ['jsx'] })); return { physicalLoc: source.slice(fn.start, fn.end).split(/\r?\n/).filter((line) => line.trim()).length, structuralNodes: nodes(fn) }; }
export async function measureAll() { return Promise.all(pairs.map(async ({ scenario, baseline, emitted }) => ({ scenario, baseline: await measure(baseline), emitted: await measure(emitted) }))); }
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) process.stdout.write(`${JSON.stringify(await measureAll(), null, 2)}\n`);
