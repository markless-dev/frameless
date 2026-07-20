// Local config: stops the product-root vite.config.ts leaking into this
// config-less POC (its include cannot see .test.js). Recorded T009 fix B1;
// evidence files untouched.
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['test/**/*.test.js'] } });
