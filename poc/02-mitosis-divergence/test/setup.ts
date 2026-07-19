import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, expect } from 'vitest';
import { compileFixture } from '../scripts/compiler.mjs';

// Vitest's jsdom environment rewrites import.meta.url to a non-file URL, so
// resolve fixture paths from the package root (vitest root = this package).
const root = process.cwd();

beforeAll(async () => {
  const source = await readFile(path.join(root, 'src/update-probe.lite.tsx'), 'utf8');
  const [recordedReact, recordedSolid] = await Promise.all([
    readFile(path.join(root, 'generated/update-probe.react.jsx'), 'utf8'),
    readFile(path.join(root, 'generated/update-probe.solid.jsx'), 'utf8'),
  ]);
  const compiled = compileFixture(source);

  expect(compiled.react, 'recorded React artifact must match setup-time compilation').toBe(
    recordedReact,
  );
  expect(compiled.solid, 'recorded Solid artifact must match setup-time compilation').toBe(
    recordedSolid,
  );
});
