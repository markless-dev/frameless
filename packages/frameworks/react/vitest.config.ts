import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	root: import.meta.dirname,
	// The calibration reference/adapter are .tsx; this project owns its JSX transform
	// (framework transforms never live at root, per the isolation directive).
	// Vite 8 is rolldown-based: JSX is configured through oxc, not esbuild.
	oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
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
