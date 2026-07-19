import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [solid({ include: /(?:generated|baselines)\/.*\.jsx$|oracle-smoke\.test\.jsx$|\.solid\.tsx$/ })],
  resolve: {
    conditions: ['development', 'browser'], dedupe: ['solid-js', 'react', 'react-dom'],
    alias: [
      { find: /^react-dom\/(.*)$/, replacement: `${resolve(root, 'node_modules/react-dom')}/$1` },
      { find: 'react-dom', replacement: resolve(root, 'node_modules/react-dom') },
      { find: 'react', replacement: resolve(root, 'node_modules/react') },
    ],
  },
  test: {
    environment: 'jsdom', setupFiles: ['./test/setup.mjs'], include: ['test/**/*.test.{mjs,jsx}'],
    server: { deps: { inline: [/solid-js/] } },
  },
});
