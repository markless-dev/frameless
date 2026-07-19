import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/fixture-identity.test.ts'],
  },
});
