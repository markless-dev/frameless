import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    solid({
      include: /generated\/update-probe\.solid\.jsx$/,
    }),
  ],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  // Without browser conditions, solid-js/web resolves to its server build in
  // Node and render() is a no-op — the divergence assertion would be vacuous.
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        inline: [/solid-js/],
      },
    },
  },
});
