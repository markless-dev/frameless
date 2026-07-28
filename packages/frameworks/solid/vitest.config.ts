import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
	root: import.meta.dirname,
	plugins: [
		solid({
			include: /packages\/frameworks\/solid\/(?:generated(?:-composition)?\/.*\.tsx|test\/.*\.solid\.tsx)$/,
		}),
	],
	resolve: { conditions: ['development', 'browser'], dedupe: ['solid-js'] },
	test: {
		name: 'solid-browser',
		// vite-plugin-solid injects `environment: 'jsdom'` when it detects vitest.
		// These lanes run in a real browser, so that environment is never used -
		// but vitest still tries to resolve jsdom and exits 1 when it cannot,
		// even with all 44 tests green. Setting it explicitly wins over the
		// plugin's injection. See notes/T010-browser-lane.md.
		environment: 'node',
		include: ['test/**/*.browser.test.ts'],
		setupFiles: ['./test/setup.ts'],
		api: { host: '127.0.0.1' },
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			// Engine is env-driven so the matrix can widen without editing configs.
			// Chromium is the default everywhere; firefox and webkit run on one
			// ubuntu cell only (T003 Ruling 3). Focus handling, form behaviour and
			// event ordering differ across engines - three of the five channels
			// analyzer/compare.ts diffs - so this is not busywork.
			instances: [{ browser: (process.env.FRAMELESS_BROWSER ?? 'chromium') as 'chromium' }],
		},
	},
});
