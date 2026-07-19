import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from '@babel/parser';

const pairs = [
  { scenario: 'S2', baseline: 'test/baselines/S2.jsx', emitted: 'generated/S2.jsx' },
  { scenario: 'S3', baseline: 'test/baselines/S3.jsx', emitted: 'generated/S3.jsx' },
];

function findComponent(ast) {
  for (const statement of ast.program.body) {
    if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'FunctionDeclaration') return statement.declaration;
  }
  throw new Error('Expected one exported function declaration');
}

function structuralNodes(value) {
  if (!value || typeof value !== 'object') return 0;
  const own = typeof value.type === 'string' ? 1 : 0;
  return own + Object.entries(value).reduce((count, [key, child]) => {
    if (['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) return count;
    if (Array.isArray(child)) return count + child.reduce((sum, entry) => sum + structuralNodes(entry), 0);
    return count + structuralNodes(child);
  }, 0);
}

async function measure(file) {
  const source = await readFile(resolve(file), 'utf8');
  const component = findComponent(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  const physicalLoc = source.slice(component.start, component.end).split(/\r?\n/).filter((line) => line.trim()).length;
  return { physicalLoc, structuralNodes: structuralNodes(component) };
}

export async function measureAll() {
  return Promise.all(pairs.map(async ({ scenario, baseline, emitted }) => ({
    scenario,
    baseline: await measure(baseline),
    emitted: await measure(emitted),
  })));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  process.stdout.write(`${JSON.stringify(await measureAll(), null, 2)}\n`);
}
