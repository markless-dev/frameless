import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const readJson = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as {
	name?: string;
	private?: boolean;
	files?: string[];
};

describe('T004 package inventory', () => {
	test('contains the compiler, analyzer, framework packages, and CLI', () => {
		const packages = [
			'packages/compiler',
			'packages/analyzer',
			'packages/frameworks/react',
			'packages/frameworks/solid',
			'packages/cli',
		];
		expect(packages.map((path) => readJson(`${path}/package.json`).name)).toEqual([
			'@frameless/compiler',
			'@frameless/analyzer',
			'@frameless/react',
			'@frameless/solid',
			'@frameless/cli',
		]);
		expect(readJson('packages/compiler/package.json').files).toEqual(['agent', 'dist']);
		expect(readJson('demos/ui-kit/package.json')).toMatchObject({
			name: '@frameless/demo-ui-kit',
			private: true,
		});
	});

	test('keeps the compiler source free of cross-package and platform imports', () => {
		const sources = [
			'artifacts.ts',
			'build.ts',
			'dump.ts',
			'index.ts',
			'pass-graph.ts',
			'pass-pipeline.ts',
			'pass-registry.ts',
			'schema.ts',
		]
			.map((file) => readFileSync(resolve(root, 'packages/compiler/src', file), 'utf8'))
			.join('\n');
		expect(sources).not.toMatch(
			/from ['"](?:@frameless\/analyzer|react|solid-js|vite|node:fs|@frameless\/(?:react|solid|cli))/,
		);
	});
});
