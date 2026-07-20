import { access, readFile } from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import { main } from '../src/node.ts';

describe('node bin adapter', () => {
	test('is packaged as an existing source bin and delegates argv to the program', async () => {
		const packageJson = JSON.parse(
			await readFile(new URL('../package.json', import.meta.url), 'utf8'),
		) as {
			bin?: Record<string, string>;
			publishConfig?: { bin?: Record<string, string> };
		};
		expect(packageJson.bin).toEqual({ frameless: './src/node.ts' });
		expect(packageJson.publishConfig?.bin).toEqual({ frameless: './dist/node.js' });
		await expect(
			access(new URL(`..${packageJson.bin!.frameless!.slice(1)}`, import.meta.url)),
		).resolves.toBeUndefined();
		const source = await readFile(new URL('../src/node.ts', import.meta.url), 'utf8');
		expect(source).toMatch(/^#!\/usr\/bin\/env node/);
		expect(source).toContain('process.argv.slice(2)');
		expect(source).toContain('parseProgramArgs');
		expect(source).toContain('createBuildPlan');
	});

	test('prints help to stdout and returns zero', async () => {
		const stdout = vi.fn();
		const stderr = vi.fn();
		await expect(main(['--help'], { stdout, stderr })).resolves.toBe(0);
		expect(stdout).toHaveBeenCalledOnce();
		expect(stderr).not.toHaveBeenCalled();
	});

	test('prints only an error message plus newline to stderr and returns one', async () => {
		const stdout = vi.fn();
		const stderr = vi.fn();
		await expect(main(['build'], { stdout, stderr })).resolves.toBe(1);
		expect(stdout).not.toHaveBeenCalled();
		expect(stderr).toHaveBeenCalledWith('Missing input for build\n');
	});
});
