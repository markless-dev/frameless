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
			// Engine is env-driven so the matrix can widen without editing configs.
			// Chromium is the default everywhere; firefox and webkit run on one
			// ubuntu cell only (T003 Ruling 3). Focus handling, form behaviour and
			// event ordering differ across engines - three of the five channels
			// analyzer/compare.ts diffs - so this is not busywork.
			instances: [{ browser: (process.env.FRAMELESS_BROWSER ?? 'chromium') as 'chromium' }],
		},
	},
});
