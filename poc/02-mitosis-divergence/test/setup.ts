import { readFile } from 'node:fs/promises';
import { beforeAll, expect } from 'vitest';
import { compileFixture } from '../scripts/compiler.mjs';

beforeAll(async () => {
  const source = await readFile(new URL('../src/update-probe.lite.tsx', import.meta.url), 'utf8');
  const [recordedReact, recordedSolid] = await Promise.all([
    readFile(new URL('../generated/update-probe.react.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../generated/update-probe.solid.jsx', import.meta.url), 'utf8'),
  ]);
  const compiled = compileFixture(source);

  expect(compiled.react, 'recorded React artifact must match setup-time compilation').toBe(
    recordedReact,
  );
  expect(compiled.solid, 'recorded Solid artifact must match setup-time compilation').toBe(
    recordedSolid,
  );
});
