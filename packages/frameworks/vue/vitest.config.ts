import { createRequire } from 'node:module';
import vue from '@vitejs/plugin-vue';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const packageVersion = (name: string): string =>
	(require(`${name}/package.json`) as { version: string }).version;

/**
 * M4, VERSION IDENTITY, resolved where the browser bundle can see it.
 *
 * The compile-time oracle (`test/compile-emitted.test.ts`) runs
 * `@vue/compiler-sfc` in node; this lane runs `vue`'s runtime in a real browser.
 * If those two resolve to different builds, the oracle is measuring something the
 * browser never runs, which Gate 1 of `docs/emitter-idiom-policy.md` names as a
 * FAIL outright. Both versions are read here, at config time, and injected so the
 * browser test can assert the identity itself rather than trust a literal someone
 * updated by hand.
 */
const versions = {
	vue: packageVersion('vue'),
	compilerSfc: packageVersion('@vue/compiler-sfc'),
};

export default defineConfig({
	root: import.meta.dirname,
	plugins: [vue()],
	define: { __FRAMELESS_VUE_VERSIONS__: JSON.stringify(versions) },
	test: {
		name: 'vue-browser',
		environment: 'node',
		include: ['test/**/*.browser.test.ts'],
		setupFiles: ['./test/setup.ts'],
		api: { host: '127.0.0.1' },
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			// Engine is env-driven so the matrix can widen without editing configs,
			// matching the React, Solid and Svelte lanes.
			instances: [{ browser: (process.env.FRAMELESS_BROWSER ?? 'chromium') as 'chromium' }],
		},
	},
});
