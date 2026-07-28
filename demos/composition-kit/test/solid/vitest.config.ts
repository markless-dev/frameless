import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';
import { requireDemoBuild, traceCommand } from '../vitest.shared.ts';

export default defineConfig({
	root: import.meta.dirname,
	plugins: [
		requireDemoBuild,
		solid({
			include: /demos\/composition-kit\/(?:dist\/solid\/.*\.tsx|test\/solid\/.*\.tsx)$/,
		}),
	],
	resolve: { conditions: ['development', 'browser'], dedupe: ['solid-js'] },
	test: {
		name: 'composition-demo-solid-browser',
		include: ['**/*.browser.test.tsx'],
		api: { host: '127.0.0.1' },
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }],
			commands: { writeCompositionKitTrace: traceCommand('solid') },
		},
	},
});
