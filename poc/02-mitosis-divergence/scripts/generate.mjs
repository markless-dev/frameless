import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileFixture } from './compiler.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = await readFile(new URL('../src/update-probe.lite.tsx', import.meta.url), 'utf8');
const outputs = compileFixture(source);

await mkdir(new URL('../generated/', import.meta.url), { recursive: true });
await Promise.all([
  writeFile(new URL('../generated/update-probe.react.jsx', import.meta.url), outputs.react),
  writeFile(new URL('../generated/update-probe.solid.jsx', import.meta.url), outputs.solid),
]);

console.log(`Generated React and Solid artifacts in ${root}/generated`);
