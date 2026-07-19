import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  // The oracle adapter lives in poc/04; without dedupe its react-dom and this
  // package's react are two instances and hooks crash at mount.
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.mjs'],
    include: ['test/**/*.test.{mjs,jsx}'],
  },
});
