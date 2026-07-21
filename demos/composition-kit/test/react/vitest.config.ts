import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { requireDemoBuild, traceCommand } from '../vitest.shared.ts';

export default defineConfig({
	root: import.meta.dirname,
	plugins: [requireDemoBuild],
	oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
	test: {
		name: 'composition-demo-react-browser',
		include: ['**/*.browser.test.tsx'],
		api: { host: '127.0.0.1' },
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }],
			commands: { writeCompositionKitTrace: traceCommand('react') },
		},
	},
});
