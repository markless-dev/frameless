import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.filename ?? path.join(process.cwd(), 'test/x.ts'));

describe('Finding: mitosis Solid output is incompatible with Solid v2', () => {
  test('generated code imports solid-js/web, which Solid 2.0.0-experimental.16 no longer exports', async () => {
    const generated = await readFile(
      path.join(process.cwd(), 'generated/update-probe.solid.jsx'),
      'utf8',
    );
    // Mitosis 0.13.2 emits v1-era imports (mounting relies on solid-js/web).
    expect(generated).toContain("from \"solid-js\"");

    const solid2Manifest = require('solid2/package.json');
    expect(solid2Manifest.version).toBe('2.0.0-experimental.16');
    // The v1 mounting entry point is gone in v2 — resolving it must fail.
    expect(Object.keys(solid2Manifest.exports)).not.toContain('./web');
    expect(() => require.resolve('solid2/web')).toThrow();
  });
});
