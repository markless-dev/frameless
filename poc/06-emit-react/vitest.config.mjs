import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.mjs'],
    include: ['test/**/*.test.{mjs,jsx}'],
  },
});
