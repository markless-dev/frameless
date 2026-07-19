// @vitest-environment node
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
describe('contract: Solid v2 runtime blocker and fallback honesty', () => {
  test('v2 has no web export and the available Vite plugin is a v1 toolchain', async () => {
    const solid2 = require('solid2/package.json');
    const plugin = JSON.parse(await readFile(resolve('node_modules/vite-plugin-solid/package.json'), 'utf8'));
    expect(solid2.version).toBe('2.0.0-experimental.16');
    expect(Object.keys(solid2.exports)).not.toContain('./web');
    expect(() => require.resolve('solid2/web')).toThrow();
    expect(plugin.version).toBe('2.11.0');
    expect(plugin.peerDependencies['solid-js']).toMatch(/\^1\./);
  });
  test('the adapter and README label runtime evidence exactly as fallback', async () => {
    const adapter = await readFile(resolve('../04-equivalence-oracle/src/oracle/adapters.ts'), 'utf8');
    const readme = await readFile(resolve('README.md'), 'utf8');
    expect(adapter).toContain("name: 'solid-1.8.22-fallback'");
    expect(readme).toContain('solid-1.8.22-fallback');
    expect(readme).toContain('not Solid 2 runtime-validated');
  });
});
