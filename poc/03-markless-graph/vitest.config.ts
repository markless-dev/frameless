import { defineConfig } from 'vitest/config';

// Two projects: C7 + C11 run against @markless/compiler in plain Node; C6
// mounts compiled .tsrx output in a real headless Chromium (the same pattern
// markless's own packages/vitest-browser project uses).
export default defineConfig({
	test: {
		projects: ['./vitest.node.config.ts', './vitest.browser.config.ts'],
	},
});
