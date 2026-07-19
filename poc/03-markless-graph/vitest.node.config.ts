import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'node',
		environment: 'node',
		include: ['test/**/*.test.ts'],
	},
});
