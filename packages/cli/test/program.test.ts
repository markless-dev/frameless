import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import {
	PROGRAM_USAGE,
	TARGET_INVENTORY,
	createBuildPlan,
	parseProgramArgs,
} from '../src/index.ts';

describe('target inventory', () => {
	test('registers exactly the React and Solid framework packages', () => {
		expect(TARGET_INVENTORY).toEqual([
			{ name: 'react', packageSpecifier: '@frameless/react' },
			{ name: 'solid', packageSpecifier: '@frameless/solid' },
		]);
	});
});

describe('program argument parsing', () => {
	test('accepts one target', () => {
		expect(
			parseProgramArgs(['build', 'components/button.tsrx', '--target', 'react', '--out-dir', 'dist']),
		).toEqual({
			command: 'build',
			input: 'components/button.tsrx',
			outDir: 'dist',
			targets: ['react'],
		});
	});

	test('accepts repeated targets and --name=value options', () => {
		expect(
			parseProgramArgs([
				'build',
				'components/button.tsrx',
				'--target=react',
				'--target',
				'solid',
				'--out-dir=generated',
			]),
		).toEqual({
			command: 'build',
			input: 'components/button.tsrx',
			outDir: 'generated',
			targets: ['react', 'solid'],
		});
	});

	test('deduplicates repeated target values in first-seen order', () => {
		const parsed = parseProgramArgs([
			'build',
			'button.tsrx',
			'--target',
			'solid',
			'--target=solid',
			'--target=react',
			'--out-dir',
			'dist',
		]);

		expect(parsed).toMatchObject({ targets: ['solid', 'react'] });
		expect(PROGRAM_USAGE).toContain('Duplicate targets are ignored.');
	});

	test.each([['help'], ['--help'], ['build', '--help']])(
		'returns deterministic help for %j',
		(...args) => {
			expect(parseProgramArgs(args)).toEqual({ command: 'help', usage: PROGRAM_USAGE });
			expect(PROGRAM_USAGE).toBe(
				[
					'Frameless CLI',
					'',
					'Usage:',
					'  frameless build <input.tsrx> --target <name> [--target <name>] --out-dir <dir>',
					'',
					'Options:',
					'  --target <name>  Build react or solid. Repeat to build both.',
					'                   Duplicate targets are ignored.',
					'  --out-dir <dir>  Write each target beneath <dir>/<target>/.',
					'  --help           Show this help.',
					'',
				].join('\n'),
			);
		},
	);

	test.each([
		[['build', 'button.tsrx', '--wat'], 'Unknown option --wat'],
		[['build', 'button.tsrx', '--target'], 'Missing value for --target'],
		[['build', 'button.tsrx', '--target='], 'Missing value for --target'],
		[
			['build', 'button.tsrx', '--target', '--out-dir', 'dist'],
			'Missing value for --target',
		],
		[['build', 'button.tsrx', '--target', 'react', '--out-dir'], 'Missing value for --out-dir'],
		[['build', 'button.tsrx', '--target', 'react', '--out-dir='], 'Missing value for --out-dir'],
		[
			['build', 'button.tsrx', 'y', '--target', 'react', '--out-dir', 'dist'],
			'Unexpected argument y',
		],
		[
			['build', 'button.tsrx', '--target', 'vue', '--out-dir', 'dist'],
			'Unknown target vue (known: react, solid)',
		],
		[['build', 'button.tsrx', '--out-dir', 'dist'], 'At least one --target is required'],
	] as const)('reports %s as a one-line error', (args, message) => {
		expect(() => parseProgramArgs(args)).toThrow(new Error(message));
		expect(message).not.toContain('\n');
	});
});

describe('build plan', () => {
	test('is deterministic and separates each target output directory', () => {
		const parsed = parseProgramArgs([
			'build',
			'src/widgets/button.tsrx',
			'--target',
			'react',
			'--target',
			'solid',
			'--out-dir',
			'generated',
		]);

		if (parsed.command !== 'build') throw new Error('Expected build arguments.');

		const first = createBuildPlan(parsed, TARGET_INVENTORY);
		const second = createBuildPlan(parsed, TARGET_INVENTORY);

		expect(first).toEqual(second);
		expect(first).toEqual({
			command: 'build',
			input: 'src/widgets/button.tsrx',
			outDir: 'generated',
			targets: [
				{
					emittedFilename: 'button.jsx',
					name: 'react',
					outputDirectory: 'generated/react/',
					packageSpecifier: '@frameless/react',
				},
				{
					emittedFilename: 'button.jsx',
					name: 'solid',
					outputDirectory: 'generated/solid/',
					packageSpecifier: '@frameless/solid',
				},
			],
		});
	});
});

test('keeps the reusable program surface free of Node and process imports', async () => {
	const sources = await Promise.all([
		readFile(new URL('../src/program.ts', import.meta.url), 'utf-8'),
		readFile(new URL('../src/index.ts', import.meta.url), 'utf-8'),
	]);

	for (const source of sources) {
		expect(source).not.toMatch(/from ['"]node:/);
		expect(source).not.toMatch(/from ['"](?:fs|fs\/promises|process)['"]/);
		expect(source).not.toMatch(/\bprocess\./);
	}
});
