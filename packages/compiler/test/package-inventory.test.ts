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
	test('contains exactly the compiler and four product package stubs', () => {
		const packages = [
			'packages/compiler',
			'packages/oracle',
			'packages/target-react',
			'packages/target-solid',
			'packages/cli',
		];
		expect(packages.map((path) => readJson(`${path}/package.json`).name)).toEqual([
			'@frameless/compiler',
			'@frameless/oracle',
			'@frameless/target-react',
			'@frameless/target-solid',
			'@frameless/cli',
		]);
		expect(readJson('packages/compiler/package.json').files).toEqual(['agent', 'dist']);
		expect(readJson('demos/ui-kit/package.json')).toMatchObject({
			name: '@frameless/demo-ui-kit',
			private: true,
		});
	});

	test('keeps the compiler source free of cross-package and platform imports', () => {
		const sources = ['build.ts', 'dump.ts', 'index.ts', 'schema.ts']
			.map((file) => readFileSync(resolve(root, 'packages/compiler/src', file), 'utf8'))
			.join('\n');
		expect(sources).not.toMatch(
			/from ['"](?:@frameless\/oracle|react|solid-js|vite|node:fs|@frameless\/target-|@frameless\/cli)/,
		);
	});
});
