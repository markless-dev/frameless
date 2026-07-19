// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transformWithEsbuild } from 'vite';
import { afterEach, describe, expect, test } from 'vitest';
import { checkGeneratedFiles, checkSources, discoverGeneratedFiles } from '../src/gate/index.mjs';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));
const component = (body, imports = 'createSignal, For') => `import { ${imports} } from 'solid-js';
export function Mutant(props) {
  ${body}
  return <ul><For each={props.items}>{(item) => <li>{item.id}</li>}</For></ul>;
}`;
async function policies(source) { return (await checkSources([{ file: 'generated/Mutant.jsx', source }])).violations.map((entry) => entry.policy); }

describe('Solid conventionality gate', () => {
  test('discovers, compiles, and accepts every generated component', async () => {
    const files = await discoverGeneratedFiles();
    expect(files).toEqual(['generated/S1.jsx', 'generated/S2.jsx', 'generated/S3.jsx']);
    for (const file of files) expect((await transformWithEsbuild(await readFile(file, 'utf8'), file, { loader: 'jsx' })).code).toBeTruthy();
    const result = await checkGeneratedFiles();
    expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  });
  test.each([
    ['unused import', component('', 'createSignal, For, Show'), 'eslint:no-unused-vars'],
    ['dead expression', component('props.items;'), 'eslint:no-unused-expressions'],
    ['unreachable', component('return null; props.items;'), 'eslint:no-unreachable'],
    ['index accessor', component('').replace('(item) =>', '(item, index) =>').replace('{item.id}', '{index()}'), 'index-key'],
    ['jsx map repeat', component('').replace('<For each={props.items}>{(item) => <li>{item.id}</li>}</For>', '{props.items.map((item) => <li>{item.id}</li>)}'), 'index-key'],
    ['prop destructuring', component('').replace('(props)', '({ items })').replace('props.items', 'items'), 'reactivity-freezing-props'],
    ['setup setter', component('const [value, setValue] = createSignal(0); setValue(1); value();'), 'render-phase-setter'],
    ['effect alias', component('side(() => props.items);', 'For, createEffect as side'), 'render-phase-effect'],
    ['disable directive', `/* eslint-disable */\n${component('')}`, 'eslint-directive'],
    ['enable directive', `/* eslint-enable */\n${component('')}`, 'eslint-directive'],
    ['inline directive', `/* eslint no-unused-vars: off */\n${component('')}`, 'eslint-directive'],
    ['undisclosed import', `import x from 'elsewhere';\n${component('x;')}`, 'undisclosed-import'],
    ['require', component("const x = require('elsewhere'); x;"), 'undisclosed-import'],
    ['dynamic import', component("import('elsewhere');"), 'undisclosed-import'],
  ])('rejects the %s bypass', async (_name, source, policy) => expect(await policies(source)).toContain(policy));
  test('new generated files are discovered and gated', async () => {
    const root = await mkdtemp(resolve('.gate-mutation-')); roots.push(root); await mkdir(resolve(root, 'generated'));
    await writeFile(resolve(root, 'generated/New.jsx'), component('props.items;'));
    const result = await checkGeneratedFiles({ cwd: root });
    expect(result.files).toEqual(['generated/New.jsx']);
    expect(result.violations.map((entry) => entry.policy)).toContain('eslint:no-unused-expressions');
  });
});
