import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
	root: import.meta.dirname,
	plugins: [
		solid({
			include: /packages\/frameworks\/solid\/(?:generated(?:-composition)?\/.*\.jsx|test\/.*\.solid\.tsx)$/,
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
			instances: [{ browser: 'chromium' }],
		},
	},
});
