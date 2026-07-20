import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite-plus';
import type { PackUserConfig } from 'vite-plus/pack';

type Manifest = { dependencies?: Record<string, string> };
const rootDir = import.meta.dirname;
const packageDir = (name: string) => resolve(rootDir, 'packages', name);
const packageImport = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(/.*)?$`);
const pack = (name: string): PackUserConfig => {
	const manifest = JSON.parse(readFileSync(resolve(packageDir(name), 'package.json'), 'utf8')) as Manifest;
	return {
		name: `@frameless/${name}`,
		cwd: packageDir(name),
		entry: { index: './src/index.ts' },
		format: ['esm'],
		outDir: './dist',
		platform: 'neutral',
		fixedExtension: false,
		// v0 intentionally emits JavaScript only: declarations and sourcemaps reopen /1.
		dts: false,
		clean: true,
		deps: {
			neverBundle: [
				/^node:.*$/,
				...Object.keys(manifest.dependencies ?? {}).map(packageImport),
			],
			onlyBundle: false,
		},
	};
};

const productConfig = defineConfig({
	staged: { '*': 'vp check --fix' },
	pack: ['compiler', 'oracle', 'target-react', 'target-solid', 'cli'].map(pack),
	test: {
		projects: [
			{
				test: {
					name: 'node',
					environment: 'node',
					include: ['packages/*/test/**/*.test.ts'],
					exclude: ['poc/**'],
				},
			},
			{
				test: {
					name: 'browser-stub',
					include: ['packages/*/test/**/*.browser.test.ts'],
					exclude: ['poc/**', 'packages/**'],
				},
			},
		],
	},
	lint: { ignorePatterns: ['dist/**', 'node_modules/**', 'poc/**'] },
	fmt: {
		useTabs: true,
		tabWidth: 4,
		printWidth: 100,
		endOfLine: 'lf',
		singleQuote: true,
		ignorePatterns: ['dist/**', 'node_modules/**', 'poc/**'],
	},
});

// An isolated POC still discovers ancestor Vite config files. Give direct POC
// invocations a package-local root without making poc/** part of a product lane.
const pocRoot = resolve(rootDir, 'poc');
const currentDirectory = process.cwd();
const isDirectPocRun = currentDirectory === pocRoot || currentDirectory.startsWith(`${pocRoot}/`);

export default isDirectPocRun
	? defineConfig({
				root: currentDirectory,
				test: { environment: 'node', include: ['test/**/*.test.ts'] },
			})
	: productConfig;
