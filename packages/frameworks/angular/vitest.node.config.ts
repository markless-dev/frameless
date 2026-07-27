import { defineConfig } from 'vitest/config';

/**
 * NODE ONLY. `frameless-angular-v1` T002's sequencing ruling keeps the Angular
 * BUILD entirely out of this package: `@angular/build` lists `vite: 7.3.6` as an
 * EXACT dependency while this workspace is pinned to vite 8, so a browser lane
 * here would drag two vites into one package. Keeping the build out is what
 * discharges that structurally rather than by policy - and it is why there is no
 * `vitest.config.ts`, no playwright and no `test:browser` entry.
 */
export default defineConfig({
	root: import.meta.dirname,
	test: {
		name: 'angular-node',
		environment: 'node',
		include: ['test/**/*.test.ts'],
	},
});
