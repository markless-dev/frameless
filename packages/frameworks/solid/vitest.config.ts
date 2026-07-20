import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
	root: import.meta.dirname,
	plugins: [
		solid({
			include: /packages\/frameworks\/solid\/(?:generated\/.*\.jsx|test\/.*\.solid\.tsx)$/,
		}),
	],
	resolve: { conditions: ['development', 'browser'], dedupe: ['solid-js'] },
	test: {
		name: 'solid-browser',
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
