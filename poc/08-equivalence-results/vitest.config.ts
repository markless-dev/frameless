import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformAsync } from '@babel/core';
import { markless } from '@markless/core/vite';
import { playwright } from '@vitest/browser-playwright';
import solidPreset from 'babel-preset-solid';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));
const solidFiles = /(?:07-emit-solid\/generated\/.*\.jsx|\.solid\.jsx)$/;

const isolatedSolidTransform = {
  name: 'arcade:isolated-solid-jsx',
  enforce: 'pre' as const,
  async transform(code: string, id: string) {
    if (!solidFiles.test(id.split('?')[0])) return null;
    const result = await transformAsync(code, {
      filename: id,
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      presets: [[solidPreset, { generate: 'dom', hydratable: false }]],
    });
    return result?.code ? { code: result.code, map: result.map } : null;
  },
};

export default defineConfig({
  plugins: [
    markless(),
    isolatedSolidTransform,
  ],
  resolve: {
    conditions: ['development', 'browser'],
    dedupe: ['solid-js', 'react', 'react-dom'],
  },
  test: {
    include: ['test/**/*.browser.test.ts'],
    setupFiles: ['./test/setup.ts'],
    api: { host: '127.0.0.1' },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      commands: {
        async writeEvidence(_context, json: string, markdown: string) {
          await Promise.all([
            writeFile(resolve(root, 'results/verdict.json'), `${json}\n`, 'utf8'),
            writeFile(resolve(root, 'results/RESULTS.md'), markdown, 'utf8'),
          ]);
        },
      },
    },
  },
});
