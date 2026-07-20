import { defineConfig } from 'vite-plus';
import type { PackUserConfig } from 'vite-plus/pack';

const rootDir = import.meta.dirname;
const packageImport = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/.*)?$`);
const nodeBuiltinImport = /^node:.*$/;

const pack = (
	packagePath: string,
	name: string,
	dependencies: ReadonlyArray<string> = [],
	options: {
		readonly entry?: Record<string, string>;
		readonly platform?: PackUserConfig['platform'];
	} = {},
): PackUserConfig => ({
	name,
	cwd: `${rootDir}/${packagePath}`,
	entry: options.entry ?? { index: './src/index.ts' },
	format: ['esm'],
	outDir: './dist',
	platform: options.platform ?? 'neutral',
	fixedExtension: false,
	dts: false,
	clean: true,
	deps: {
		neverBundle: [nodeBuiltinImport, ...dependencies.map(packageImport)],
		onlyBundle: false,
	},
});

const productConfig = defineConfig({
	staged: { '*': 'vp check --fix' },
	pack: [
		pack('packages/compiler', '@frameless/compiler', ['@markless/compiler', '@tsrx/core']),
		pack('packages/analyzer', '@frameless/analyzer'),
		pack('packages/frameworks/react', '@frameless/react', ['@frameless/analyzer', 'react', 'react-dom']),
		pack('packages/frameworks/solid', '@frameless/solid', ['@frameless/analyzer', 'solid-js']),
		pack(
			'packages/cli',
			'@frameless/cli',
			['@frameless/compiler', '@frameless/react', '@frameless/solid'],
			{
				platform: 'node',
				entry: { index: './src/index.ts', node: './src/node.ts' },
			},
		),
	],
	test: {
		projects: [
			{
				test: {
					name: 'node',
					environment: 'node',
					include: ['packages/*/test/**/*.test.ts', 'packages/frameworks/*/test/**/*.test.ts', 'packages/compiler/test/**/*.test.ts'],
					// frameworks' browser suites run in their own projects; node-lane
					// tests in frameworks packages (emitter/gate) belong here.
					exclude: ['poc/**', '**/*.browser.test.ts', '**/node_modules/**'],
				},
			},
			'packages/frameworks/react/vitest.config.ts',
			'packages/frameworks/solid/vitest.config.ts',
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

const currentDirectory = process.cwd();
const directPocRun = currentDirectory.includes('/poc/');

export default directPocRun
	? defineConfig({ root: currentDirectory, test: { environment: 'node', include: ['test/**/*.test.ts'] } })
	: productConfig;
