import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid({ include: /\.solid\.tsx$/ })],
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  resolve: { conditions: ['development', 'browser'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    server: { deps: { inline: [/solid-js/] } },
  },
});
