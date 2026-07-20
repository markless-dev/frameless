import { createHash, randomUUID } from 'node:crypto';
import { open, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';
import type { EnrichedIR } from '@frameless/compiler';
import type { BuildPlan } from './program.ts';
import {
	BUILD_EQUIVALENCE_AUTHORITY,
	createBuildReceipt,
	serializeBuildReceipt,
	type GateResult,
	type TargetBuildReceipt,
} from './receipts.ts';

export const BUILD_RECEIPT_FILENAME = 'frameless-build-receipt.json' as const;

export interface FrameworkTargetModule {
	emit(ir: EnrichedIR): string;
	validateEnrichedIr(ir: EnrichedIR): void;
	checkSources(
		entries: ReadonlyArray<{ readonly file: string; readonly source: string }>,
	): Promise<GateResult>;
}

export interface NodeRuntimeOptions {
	readonly loadTarget?: (packageSpecifier: string) => Promise<FrameworkTargetModule>;
}

interface PreparedTarget {
	readonly content: string;
	readonly outputPath: string;
	readonly receipt: TargetBuildReceipt;
}

/** Compile, validate, gate, and atomically write every target in a build plan. */
export async function executeBuildPlan(
	plan: BuildPlan,
	workingDirectory: string,
	options: NodeRuntimeOptions = {},
): Promise<void> {
	const cwd = resolve(workingDirectory);
	const inputPath = resolveFrom(cwd, plan.input);
	const source = await readFile(inputPath, 'utf8');
	const { buildEnrichedIr } = await import('@frameless/compiler');
	const ir = await buildEnrichedIr({ filename: inputPath, source });
	const loadTarget = options.loadTarget ?? importFrameworkTarget;
	const preparedTargets: Array<readonly [string, PreparedTarget]> = [];

	for (const target of plan.targets) {
		const framework = await loadAndAssertTarget(
			loadTarget,
			target.name,
			target.packageSpecifier,
		);
		try {
			framework.validateEnrichedIr(ir);
		} catch (error) {
			throw new Error(`Target ${target.name} validation failed: ${errorMessage(error)}`);
		}

		let content: string;
		try {
			content = framework.emit(ir);
		} catch (error) {
			throw new Error(`Target ${target.name} emission failed: ${errorMessage(error)}`);
		}

		const outputDirectory = resolveFrom(cwd, target.outputDirectory);
		const outputPath = join(outputDirectory, target.emittedFilename);
		const emittedFilePath = relative(cwd, outputPath) || target.emittedFilename;
		const gate = await framework.checkSources([
			{ file: target.emittedFilename, source: content },
		]);
		const violation = gate.violations[0];
		if (violation) {
			throw new Error(
				`Target ${target.name} gate failed (policy ${violation.policy}): ${violation.message}`,
			);
		}

		preparedTargets.push([
			target.name,
			{
				content,
				outputPath,
				receipt: {
					packageSpecifier: target.packageSpecifier,
					emittedFilePath,
					emittedContentSha256: sha256(content),
					validation: { state: 'passed' },
					gate,
				},
			},
		]);
	}

	const receipt = createBuildReceipt({
		generator: {
			toolName: '@frameless/cli',
			toolVersion: await packageVersion('@frameless/cli', import.meta.url),
		},
		input: {
			sourcePath: relative(cwd, inputPath) || plan.input,
			contentSha256: sha256(source),
			compilerPackageVersion: await packageVersion('@frameless/compiler'),
		},
		ir: { version: 'frameless-enriched-ir/1', digestSha256: sha256(JSON.stringify(ir)) },
		targets: Object.fromEntries(
			preparedTargets.map(([name, prepared]) => [name, prepared.receipt]),
		),
		equivalence: {
			state: 'delegated',
			authority: BUILD_EQUIVALENCE_AUTHORITY,
			command: 'pnpm test:browser',
		},
	});
	const serializedReceipt = serializeBuildReceipt(receipt);

	for (const [, prepared] of preparedTargets) {
		await mkdir(dirname(prepared.outputPath), { recursive: true });
		await atomicWriteFile(prepared.outputPath, prepared.content);
	}
	const receiptPath = join(resolveFrom(cwd, plan.outDir), BUILD_RECEIPT_FILENAME);
	await mkdir(dirname(receiptPath), { recursive: true });
	await atomicWriteFile(receiptPath, serializedReceipt);
}

async function importFrameworkTarget(packageSpecifier: string): Promise<FrameworkTargetModule> {
	return (await import(packageSpecifier)) as FrameworkTargetModule;
}

async function loadAndAssertTarget(
	loadTarget: (packageSpecifier: string) => Promise<FrameworkTargetModule>,
	targetName: string,
	packageSpecifier: string,
): Promise<FrameworkTargetModule> {
	let framework: FrameworkTargetModule;
	try {
		framework = await loadTarget(packageSpecifier);
	} catch (error) {
		throw new Error(
			`Target ${targetName} package ${packageSpecifier} failed to load: ${errorMessage(error)}`,
		);
	}
	for (const member of ['emit', 'validateEnrichedIr', 'checkSources'] as const) {
		if (typeof framework[member] !== 'function') {
			throw new Error(
				`Target ${targetName} package ${packageSpecifier} does not export ${member}`,
			);
		}
	}
	return framework;
}

async function atomicWriteFile(path: string, contents: string): Promise<void> {
	const temporaryPath = `${path}.${randomUUID()}.tmp`;
	let handle: Awaited<ReturnType<typeof open>> | undefined;
	try {
		handle = await open(temporaryPath, 'wx');
		await handle.writeFile(contents);
		await handle.close();
		handle = undefined;
		await rename(temporaryPath, path);
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await rm(temporaryPath, { force: true }).catch(() => undefined);
		throw error;
	}
}

function resolveFrom(cwd: string, path: string): string {
	return isAbsolute(path) ? path : resolve(cwd, path);
}

function sha256(contents: string): string {
	return createHash('sha256').update(contents).digest('hex');
}

async function packageVersion(packageName: string, moduleUrl?: string): Promise<string> {
	const start = moduleUrl
		? dirname(fileURLToPath(moduleUrl))
		: dirname(createRequire(import.meta.url).resolve(packageName));
	let directory = start;
	for (;;) {
		try {
			const packageJson = JSON.parse(
				await readFile(join(directory, 'package.json'), 'utf8'),
			) as {
				name?: string;
				version?: string;
			};
			if (packageJson.name === packageName && packageJson.version) return packageJson.version;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		const parent = dirname(directory);
		if (parent === directory)
			throw new Error(`Could not resolve package version for ${packageName}`);
		directory = parent;
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
