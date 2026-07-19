import { markless } from '@markless/core/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineProject } from 'vitest/config';

// Mirrors markless's own browser test project (packages/vitest-browser
// vitest.config.ts): the markless() vite plugin compiles .tsrx fixtures and
// tests run in headless Chromium via the playwright provider.
export default defineProject({
	plugins: [markless()],
	test: {
		name: 'browser',
		include: ['browser/**/*.test.ts'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }],
		},
	},
});
