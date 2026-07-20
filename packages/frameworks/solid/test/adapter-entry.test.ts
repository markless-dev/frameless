import { readFile } from 'node:fs/promises';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('public Solid adapter entry', () => {
	test('is exported for development and publishing', async () => {
		const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
		expect(manifest.exports['./adapter']).toBe('./src/adapter.ts');
		expect(manifest.publishConfig.exports['./adapter']).toEqual({
			default: './dist/adapter.js',
		});
	});

	test('has a browser-safe import graph', async () => {
		const pending = [resolve(root, 'src/adapter.ts')];
		const visited = new Set<string>();
		while (pending.length) {
			const file = pending.pop()!;
			if (visited.has(file)) continue;
			visited.add(file);
			const source = await readFile(file, 'utf8');
			const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
				(match) => match[1]!,
			);
			expect(
				imports.filter((specifier) => specifier.startsWith('node:')),
				file,
			).toEqual([]);
			expect(imports, file).not.toContain('eslint');
			for (const specifier of imports.filter((entry) => entry.startsWith('.')))
				pending.push(resolve(file, '..', specifier));
		}
		expect([...visited]).toEqual([resolve(root, 'src/adapter.ts')]);
	});
});
