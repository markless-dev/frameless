import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parse } from '@babel/parser';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const nodeRequire = createRequire(import.meta.url);

interface BabelCore {
	transformAsync(
		source: string,
		options: Record<string, unknown>,
	): Promise<{ code?: string | null } | null>;
}

interface PackageManifest {
	version: string;
	exports: Record<string, unknown>;
}

function importSources(source: string): string[] {
	const program = parse(source, { sourceType: 'module', plugins: ['jsx'] }).program;
	return program.body.flatMap((statement) =>
		statement.type === 'ImportDeclaration' ? [statement.source.value] : [],
	);
}

function resolutionErrorCode(specifier: string): string | undefined {
	try {
		nodeRequire.resolve(specifier);
		return undefined;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code;
	}
}

async function betaManifest(): Promise<PackageManifest> {
	return JSON.parse(
		await readFile(nodeRequire.resolve('solid-beta9/package.json'), 'utf8'),
	) as PackageManifest;
}

describe('Solid 2 toolchain blocker contract', () => {
	test('pins the T003 evidence runtime and its JSX-runtime migration path', async () => {
		// T003 uses Solid 2.0.0-beta.9 as its evidence base.
		const manifest = await betaManifest();
		expect(manifest.version).toBe('2.0.0-beta.9');

		// Solid 2's toolchain moves to the JSX runtime model.
		expect(Object.keys(manifest.exports)).toContain('./jsx-runtime');
	});

	test('emitted S2 output links to the Solid 1 store subpath', async () => {
		const source = await readFile(resolve(root, 'generated/S2.jsx'), 'utf8');
		expect(importSources(source)).toContain('solid-js/store');
	});

	test('the installed Solid 1 JSX toolchain links DOM output to the web subpath', async () => {
		const presetPath = nodeRequire.resolve('babel-preset-solid');
		const presetRequire = createRequire(presetPath);
		const { transformAsync } = presetRequire('@babel/core') as BabelCore;
		const solidPreset = nodeRequire('babel-preset-solid');
		const result = await transformAsync(
			'export function BlockerProbe() { return <div />; }',
			{
				babelrc: false,
				configFile: false,
				filename: 'solid2-blocker-probe.jsx',
				presets: [[solidPreset, { generate: 'dom' }]],
			},
		);

		expect(result?.code).toBeTypeOf('string');
		expect(importSources(result?.code ?? '')).toContain('solid-js/web');
	});

	test('beta.9 cannot link the v1 web or store dependencies', () => {
		expect(nodeRequire.resolve('solid-js/web')).toBeTypeOf('string');
		expect(nodeRequire.resolve('solid-js/store')).toBeTypeOf('string');

		// OVERTURN TRIGGER: revisit the v1 fallback when a future Solid 2 pin exports
		// these paths or its replacement toolchain no longer emits them.
		expect(resolutionErrorCode('solid-beta9/web')).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
		expect(resolutionErrorCode('solid-beta9/store')).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
	});
});
