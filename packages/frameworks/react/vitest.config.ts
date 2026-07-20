import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	root: import.meta.dirname,
	test: {
		name: 'react-browser',
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
