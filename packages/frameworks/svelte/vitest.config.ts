import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	root: import.meta.dirname,
	// `configFile: false` because this package deliberately has no
	// svelte.config.js: nothing here is preprocessed, and letting the plugin
	// search would let a config from somewhere else change what the emitted
	// corpus compiles to without anything in this lane saying so.
	plugins: [svelte({ configFile: false })],
	test: {
		name: 'svelte-browser',
		// The Solid lane sets this because vite-plugin-solid injects
		// `environment: 'jsdom'`; plugin-svelte injects nothing, but the lane runs
		// in a real browser either way and stating it keeps the two configs
		// readable side by side.
		environment: 'node',
		include: ['test/**/*.browser.test.ts'],
		setupFiles: ['./test/setup.ts'],
		api: { host: '127.0.0.1' },
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			// Engine is env-driven so the matrix can widen without editing configs,
			// matching the React and Solid lanes.
			instances: [{ browser: (process.env.FRAMELESS_BROWSER ?? 'chromium') as 'chromium' }],
		},
	},
});
