// @vitest-environment node
// esbuild's TextEncoder invariant breaks under jsdom; this suite needs no DOM.
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transformWithEsbuild } from 'vite';
import { afterEach, describe, expect, test } from 'vitest';
import { checkGeneratedFiles, checkSources, discoverGeneratedFiles } from '../src/gate/index.mjs';

const temporaryRoots = [];
afterEach(async () => Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const component = (body, imports = 'useState') => `import { ${imports} } from 'react';
export function Mutant({items = []}) {
  ${body}
  return <ul>{items.map((item, index) => <li key={item.id}>{item.id}</li>)}</ul>;
}`;

async function policies(source) {
  const result = await checkSources([{ file: 'generated/Mutant.jsx', source }]);
  return result.violations.map((entry) => entry.policy);
}

describe('C8 reusable conventionality gate', () => {
  test('discovers, compiles, and accepts every generated React component', async () => {
    const files = await discoverGeneratedFiles();
    expect(files).toEqual(['generated/S1.jsx', 'generated/S2.jsx', 'generated/S3.jsx']);
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const result = await transformWithEsbuild(source, file, { loader: 'jsx', jsx: 'automatic', jsxImportSource: 'react' });
      expect(result.code).toContain('react/jsx-runtime');
    }
    const result = await checkGeneratedFiles();
    expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  });

  test.each([
    ['unused import', component('const [value, setValue] = useState(0);', 'useMemo, useState'), 'eslint:no-unused-vars'],
    ['React recommended rule', component('const [value] = useState(0); value;').replace('<ul>', '<ul class="bad">'), 'eslint:react/no-unknown-property'],
    ['Hooks recommended rule', component('useEffect(() => { console.log(items); }, []);', 'useEffect'), 'eslint:react-hooks/exhaustive-deps'],
    ['index key', component('const [value, setValue] = useState(0); setValue;', 'useState').replace('key={item.id}', 'key={index}'), 'index-key'],
    ['aliased setter', component('const [value, setValue] = useState(0); const update = setValue; update(1); value;'), 'render-phase-setter'],
    ['member-wrapped setter', component('const [value, setValue] = useState(0); const updates = { run: setValue }; updates.run(1); value;'), 'render-phase-setter'],
    ['helper-wrapped setter', component('const [value, setValue] = useState(0); const update = () => setValue(1); update(); value;'), 'render-phase-setter'],
    ['disable directive', `/* eslint-disable no-unused-vars */\n${component('const [value] = useState(0); value;')}`, 'eslint-directive'],
    ['enable directive', `/* eslint-enable no-unused-vars */\n${component('const [value] = useState(0); value;')}`, 'eslint-directive'],
    ['inline rule config', `/* eslint no-unused-vars: "off" */\n${component('const [value] = useState(0); value;')}`, 'eslint-directive'],
    ['undisclosed require', component("const fs = require('node:fs'); fs; const [value] = useState(0); value;"), 'undisclosed-import'],
    ['undisclosed dynamic import', component("import('elsewhere'); const [value] = useState(0); value;"), 'undisclosed-import'],
    ['dead expression', component('const [value] = useState(0); value;'), 'eslint:no-unused-expressions'],
    ['unreachable statement', component('const [value] = useState(0); if (items.length) return null; return null; value;'), 'eslint:no-unreachable'],
    ['hook after guard', component('if (!items.length) return null; const [value] = useState(0); value;'), 'hook-after-guard'],
    ['aliased useEffect', component('useSideEffect(() => {});', 'useEffect as useSideEffect'), 'render-phase-effect'],
    ['aliased useLayoutEffect', component('layout(() => {});', 'useLayoutEffect as layout'), 'render-phase-effect'],
    ['aliased useInsertionEffect', component('insert(() => {});', 'useInsertionEffect as insert'), 'render-phase-effect'],
  ])('rejects the %s bypass', async (_name, source, policy) => {
    expect(await policies(source)).toContain(policy);
  });

  test('a newly added generated file is discovered and cannot bypass the gate', async () => {
    const root = await mkdtemp(resolve('.gate-mutation-'));
    temporaryRoots.push(root);
    await mkdir(resolve(root, 'generated'));
    await writeFile(resolve(root, 'generated/New.jsx'), component('const [value] = useState(0); value;'));
    const result = await checkGeneratedFiles({ cwd: root });
    expect(result.files).toEqual(['generated/New.jsx']);
    expect(result.violations.map((entry) => entry.policy)).toContain('eslint:no-unused-expressions');
  });
});
