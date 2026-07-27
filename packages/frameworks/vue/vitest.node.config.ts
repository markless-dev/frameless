import { defineConfig } from 'vitest/config';

export default defineConfig({
	root: import.meta.dirname,
	test: {
		name: 'vue-node',
		environment: 'node',
		include: ['test/**/*.test.ts'],
		exclude: ['test/**/*.browser.test.ts'],
	},
});
