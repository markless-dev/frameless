import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { afterEach, describe, expect, test } from 'vitest';
import {
	TARGET_INVENTORY,
	createBuildPlan,
	parseProgramArgs,
	validateBuildReceipt,
	type BuildPlan,
} from '../src/index.ts';
import {
	executeBuildPlan,
	executeBuildPlanInternal,
	type FrameworkTargetModule,
} from '../src/node-runtime.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
	);
});

async function temporaryDirectory(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), 'frameless-cli-'));
	temporaryDirectories.push(path);
	return path;
}

function sha256(source: string): string {
	return createHash('sha256').update(source).digest('hex');
}

describe('target inventory integration', () => {
	test('contains both adjudicated targets', () => {
		expect(TARGET_INVENTORY).toHaveLength(2);
	});

	test.each(TARGET_INVENTORY)(
		'$name exposes its emitter, formatter, validator, and gate',
		async (target) => {
			const framework = (await import(
				target.packageSpecifier
			)) as Partial<FrameworkTargetModule>;

			expect(framework.emit).toBeTypeOf('function');
			expect(framework.formatEmitted).toBeTypeOf('function');
			expect(framework.validateEnrichedIr).toBeTypeOf('function');
			expect(framework.checkSources).toBeTypeOf('function');
		},
	);
});

test('builds the proven S1 fixture for both targets and records hashes and delegated equivalence', async () => {
	const cwd = await temporaryDirectory();
	const fixture = new URL('./fixtures/s1-render-once.tsrx', import.meta.url);
	const input = await readFile(fixture, 'utf8');
	await writeFile(join(cwd, 's1-render-once.tsrx'), input);
	const parsed = parseProgramArgs([
		'build',
		's1-render-once.tsrx',
		'--target',
		'react',
		'--target',
		'solid',
		'--out-dir',
		'output',
	]);
	if (parsed.command !== 'build') throw new Error('Expected build arguments.');

	await executeBuildPlan(createBuildPlan(parsed), cwd);

	const reactPath = join(cwd, 'output/react/s1-render-once.jsx');
	const solidPath = join(cwd, 'output/solid/s1-render-once.jsx');
	const [react, solid, receiptSource] = await Promise.all([
		readFile(reactPath, 'utf8'),
		readFile(solidPath, 'utf8'),
		readFile(join(cwd, 'output/frameless-build-receipt.json'), 'utf8'),
	]);
	const receipt = validateBuildReceipt(JSON.parse(receiptSource));

	expect(receipt.targets.react?.gate.violations).toEqual([]);
	expect(receipt.targets.solid?.gate.violations).toEqual([]);
	expect(receipt.targets.react?.resolvedPackage).toEqual({
		name: '@frameless/react',
		version: '0.0.0',
	});
	expect(receipt.targets.solid?.resolvedPackage).toEqual({
		name: '@frameless/solid',
		version: '0.0.0',
	});
	expect(receipt.targets.react?.emittedContentSha256).toBe(sha256(react));
	expect(receipt.targets.solid?.emittedContentSha256).toBe(sha256(solid));
	const [{ formatEmitted: formatReact }, { formatEmitted: formatSolid }] = await Promise.all([
		import('@frameless/react'),
		import('@frameless/solid'),
	]);
	expect(await formatReact(react)).toBe(react);
	expect(await formatSolid(solid)).toBe(solid);
	expect(receipt.input.contentSha256).toBe(sha256(input));
	expect(receipt.equivalence).toEqual({
		state: 'delegated',
		authority:
			'vitest browser lanes (react-browser, solid-browser; cross-target lane per T010)',
		command: 'pnpm test:browser',
	});
});

test('rejects a seam-loaded fake that tries to issue a receipt for @frameless/react', async () => {
	const cwd = await temporaryDirectory();
	const source = await readFile(
		new URL('./fixtures/s1-render-once.tsrx', import.meta.url),
		'utf8',
	);
	await writeFile(join(cwd, 'input.tsrx'), source);
	const plan: BuildPlan = {
		command: 'build',
		inputs: [{ sourcePath: 'input.tsrx', emittedFilename: 'input.jsx' }],
		outDir: 'output',
		targets: [
			{
				name: 'react',
				outputDirectory: 'output/react/',
				packageSpecifier: '@frameless/react',
			},
		],
	};

	await expect(
		executeBuildPlanInternal(plan, cwd, async () => ({
			framework: {
				emit: () => 'export function Fake() { return null; }',
				formatEmitted: async (emitted) => emitted,
				validateEnrichedIr: () => undefined,
				checkSources: async ([entry]) => ({
					files: [entry!.file],
					policies: [{ id: 'fake-pass', dossierRef: 'test policy' }],
					violations: [],
					unevaluated: [],
				}),
			},
			resolvedPackage: { name: '@test/fake', version: '0.0.0-test' },
		})),
	).rejects.toThrow(/resolvedPackage name must match packageSpecifier/);
	await expect(access(join(cwd, 'output'))).rejects.toMatchObject({ code: 'ENOENT' });
});

test('leaves no target output behind when a gate rejects emitted source', async () => {
	const cwd = await temporaryDirectory();
	const source = await readFile(
		new URL('./fixtures/s1-render-once.tsrx', import.meta.url),
		'utf8',
	);
	await writeFile(join(cwd, 'input.tsrx'), source);
	const plan: BuildPlan = {
		command: 'build',
		inputs: [{ sourcePath: 'input.tsrx', emittedFilename: 'input.jsx' }],
		outDir: 'output',
		targets: [
			{
				name: 'rejecting',
				outputDirectory: 'output/rejecting/',
				packageSpecifier: '@test/rejecting',
			},
		],
	};

	await expect(
		executeBuildPlanInternal(plan, cwd, async () => ({
			framework: {
				emit: () => 'export function Invalid() { return null; }',
				formatEmitted: async (emitted) => emitted,
				validateEnrichedIr: () => undefined,
				checkSources: async ([entry]) => ({
					files: [entry!.file],
					policies: [{ id: 'fixture-policy', dossierRef: 'test policy' }],
					violations: [
						{
							file: entry!.file,
							policy: 'fixture-policy',
							dossierRef: 'test policy',
							message: 'fixture rejection',
							line: 1,
						},
					],
					unevaluated: [],
				}),
			},
			resolvedPackage: { name: '@test/rejecting', version: '0.0.0-test' },
		})),
	).rejects.toThrow(
		'Target rejecting gate failed for input.tsrx (policy fixture-policy): fixture rejection',
	);
	await expect(access(join(cwd, 'output/rejecting'))).rejects.toMatchObject({ code: 'ENOENT' });
});

test('builds and links multiple TSRX modules for both targets with artifact-evaluated gates', async () => {
	const cwd = await temporaryDirectory();
	await mkdir(join(cwd, 'src'));
	await writeFile(
		join(cwd, 'src/frame.tsrx'),
		'export function Frame({ children }) @{ <section data-frame>{children}</section> }',
	);
	await writeFile(
		join(cwd, 'src/page.tsrx'),
		'import { Frame } from "./frame.tsrx"; export function Page() @{ <Frame><strong data-child>linked</strong></Frame> }',
	);
	const parsed = parseProgramArgs([
		'build',
		'src/frame.tsrx',
		'src/page.tsrx',
		'--target',
		'react',
		'--target',
		'solid',
		'--out-dir',
		'output',
	]);
	if (parsed.command !== 'build') throw new Error('Expected build arguments.');

	await executeBuildPlan(createBuildPlan(parsed), cwd);

	const [reactPage, solidPage, receiptSource] = await Promise.all([
		readFile(join(cwd, 'output/react/page.jsx'), 'utf8'),
		readFile(join(cwd, 'output/solid/page.jsx'), 'utf8'),
		readFile(join(cwd, 'output/frameless-build-receipt.json'), 'utf8'),
	]);
	const receipt = validateBuildReceipt(JSON.parse(receiptSource));
	expect(reactPage).toMatch(/from ['"]\.\/frame\.jsx['"]/);
	expect(solidPage).toMatch(/from ['"]\.\/frame\.jsx['"]/);
	expect(receipt.modules.map(({ moduleId }) => moduleId)).toEqual([
		'src/frame.tsrx',
		'src/page.tsrx',
	]);
	expect(receipt.linkTable).toMatchObject({ moduleCount: 2, referenceCount: 1 });
	for (const target of Object.values(receipt.targets)) {
		expect(target.modules).toHaveLength(2);
		for (const module of target.modules) {
			expect(module.gate.violations).toEqual([]);
			expect(module.gate.unevaluated).toEqual([]);
			expect(module.provenance).toEqual({
				artifactSupplied: true,
				allPoliciesEvaluated: true,
			});
		}
	}
});

test('surfaces module-set resolver diagnostics verbatim before target loading', async () => {
	const cwd = await temporaryDirectory();
	await mkdir(join(cwd, 'src'));
	await writeFile(
		join(cwd, 'src/page.tsrx'),
		'import { Frame } from "./frame.tsrx"; export function Page() @{ <Frame /> }',
	);
	const parsed = parseProgramArgs([
		'build',
		'src/page.tsrx',
		'--target',
		'react',
		'--out-dir',
		'output',
	]);
	if (parsed.command !== 'build') throw new Error('Expected build arguments.');
	await expect(executeBuildPlan(createBuildPlan(parsed), cwd)).rejects.toThrow(
		'TemplateComponentReference component-reference:component-edge:0 in src/page.tsrx has missing module: src/frame.tsrx',
	);
});

test('fails a CLI gate when any artifact-dependent policy remains unevaluated', async () => {
	const cwd = await temporaryDirectory();
	const source = await readFile(
		new URL('./fixtures/s1-render-once.tsrx', import.meta.url),
		'utf8',
	);
	await writeFile(join(cwd, 'input.tsrx'), source);
	const plan: BuildPlan = {
		command: 'build',
		inputs: [{ sourcePath: 'input.tsrx', emittedFilename: 'input.jsx' }],
		outDir: 'output',
		targets: [
			{
				name: 'unevaluated',
				outputDirectory: 'output/unevaluated/',
				packageSpecifier: '@test/unevaluated',
			},
		],
	};
	await expect(
		executeBuildPlanInternal(plan, cwd, async (packageSpecifier) => ({
			framework: {
				emit: () => 'export function Output() { return null; }',
				formatEmitted: async (emitted) => emitted,
				validateEnrichedIr: () => undefined,
				checkSources: async ([entry]) => ({
					files: [entry!.file],
					policies: [{ id: 'requires-provenance', dossierRef: 'test policy' }],
					violations: [],
					unevaluated: [{ policy: 'requires-provenance', reason: 'requires-artifact' }],
				}),
			},
			resolvedPackage: { name: packageSpecifier, version: '0.0.0-test' },
		})),
	).rejects.toThrow(
		'Target unevaluated gate failed for input.tsrx: policy requires-provenance was unevaluated (requires-artifact)',
	);
});

test('leaves prior targets and receipts untouched when a later target cannot be staged', async () => {
	const cwd = await temporaryDirectory();
	const source = await readFile(
		new URL('./fixtures/s1-render-once.tsrx', import.meta.url),
		'utf8',
	);
	await writeFile(join(cwd, 'input.tsrx'), source);
	await writeFile(join(cwd, 'second.tsrx'), source);
	await mkdir(join(cwd, 'output/first'), { recursive: true });
	await writeFile(join(cwd, 'output/first/prior.jsx'), 'prior output');
	const plan: BuildPlan = {
		command: 'build',
		inputs: [
			{ sourcePath: 'input.tsrx', emittedFilename: 'input.jsx' },
			{ sourcePath: 'second.tsrx', emittedFilename: 'blocked\0input.jsx' },
		],
		outDir: 'output',
		targets: [
			{
				name: 'first',
				outputDirectory: 'output/first/',
				packageSpecifier: '@test/first',
			},
			{
				name: 'second',
				outputDirectory: 'output/second/',
				packageSpecifier: '@test/second',
			},
		],
	};

	await expect(
		executeBuildPlanInternal(plan, cwd, async (packageSpecifier) => ({
			framework: {
				emit: () => 'export function Output() { return null; }',
				formatEmitted: async (emitted) => emitted,
				validateEnrichedIr: () => undefined,
				checkSources: async ([entry]) => ({
					files: [entry!.file],
					policies: [{ id: 'fake-pass', dossierRef: 'test policy' }],
					violations: [],
					unevaluated: [],
				}),
			},
			resolvedPackage: { name: packageSpecifier, version: '0.0.0-test' },
		})),
	).rejects.toThrow();

	await expect(readFile(join(cwd, 'output/first/prior.jsx'), 'utf8')).resolves.toBe(
		'prior output',
	);
	await expect(access(join(cwd, 'output/first/input.jsx'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
	await expect(access(join(cwd, 'output/second'))).rejects.toMatchObject({ code: 'ENOENT' });
	await expect(access(join(cwd, 'output/frameless-build-receipt.json'))).rejects.toMatchObject({
		code: 'ENOENT',
	});
});
