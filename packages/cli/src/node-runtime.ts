import { createHash, randomUUID } from 'node:crypto';
import { open, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'pathe';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { EnrichedIR } from '@frameless/compiler';
import type { BuildPlan } from './program.ts';
import {
	BUILD_EQUIVALENCE_AUTHORITY,
	createBuildReceipt,
	serializeBuildReceipt,
	type GateResult,
	type ResolvedPackage,
	type TargetBuildReceipt,
} from './receipts.ts';

export const BUILD_RECEIPT_FILENAME = 'frameless-build-receipt.json' as const;

export interface FrameworkTargetModule {
	emit(ir: EnrichedIR): string;
	formatEmitted(source: string): Promise<string>;
	validateEnrichedIr(ir: EnrichedIR): void;
	checkSources(
		entries: ReadonlyArray<{ readonly file: string; readonly source: string }>,
	): Promise<GateResult>;
}

export interface LoadedFrameworkTarget {
	readonly framework: FrameworkTargetModule;
	readonly resolvedPackage: ResolvedPackage;
}

interface PreparedTarget {
	readonly content: string;
	readonly emittedFilename: string;
	readonly finalDirectory: string;
	readonly receipt: TargetBuildReceipt;
}

/** Compile, validate, gate, and atomically write every target in a build plan. */
export async function executeBuildPlan(
	plan: BuildPlan,
	workingDirectory: string,
): Promise<void> {
	return executeBuildPlanInternal(plan, workingDirectory, importFrameworkTarget);
}

/** Test-only loader seam; deliberately omitted from the package index public API. */
export async function executeBuildPlanInternal(
	plan: BuildPlan,
	workingDirectory: string,
	loadTarget: (packageSpecifier: string) => Promise<LoadedFrameworkTarget>,
): Promise<void> {
	const cwd = resolve(workingDirectory);
	const inputPath = resolveFrom(cwd, plan.input);
	const source = await readFile(inputPath, 'utf8');
	const { buildEnrichedIr } = await import('@frameless/compiler');
	const ir = await buildEnrichedIr({ filename: inputPath, source });
	const preparedTargets: Array<readonly [string, PreparedTarget]> = [];

	for (const target of plan.targets) {
		const loadedTarget = await loadAndAssertTarget(
			loadTarget,
			target.name,
			target.packageSpecifier,
		);
		const { framework, resolvedPackage } = loadedTarget;
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
		try {
			content = await framework.formatEmitted(content);
		} catch (error) {
			throw new Error(`Target ${target.name} formatting failed: ${errorMessage(error)}`);
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
				emittedFilename: target.emittedFilename,
				finalDirectory: outputDirectory,
				receipt: {
					packageSpecifier: target.packageSpecifier,
					resolvedPackage,
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

	const outputRoot = resolveFrom(cwd, plan.outDir);
	const receiptPath = join(outputRoot, BUILD_RECEIPT_FILENAME);
	const createdOutputRoot = await mkdir(outputRoot, { recursive: true });
	const stagedTargets: Array<{
		readonly finalDirectory: string;
		readonly stagedDirectory: string;
	}> = [];
	try {
		for (const [name, prepared] of preparedTargets) {
			const stagedDirectory = join(outputRoot, `.${name}.${randomUUID()}.tmp`);
			stagedTargets.push({ finalDirectory: prepared.finalDirectory, stagedDirectory });
			const stagedOutputPath = join(stagedDirectory, prepared.emittedFilename);
			await mkdir(dirname(stagedOutputPath), { recursive: true });
			await atomicWriteFile(stagedOutputPath, prepared.content);
		}
	} catch (error) {
		await cleanupStagedTargets(stagedTargets);
		if (createdOutputRoot) await rm(outputRoot, { force: true, recursive: true });
		throw error;
	}

	try {
		for (const staged of stagedTargets) {
			await rm(staged.finalDirectory, { force: true, recursive: true });
			await rename(staged.stagedDirectory, staged.finalDirectory);
		}
	} catch (error) {
		await cleanupStagedTargets(stagedTargets);
		throw error;
	}
	await atomicWriteFile(receiptPath, serializedReceipt);
}

async function importFrameworkTarget(packageSpecifier: string): Promise<LoadedFrameworkTarget> {
	const resolvedEntry = createRequire(import.meta.url).resolve(packageSpecifier);
	return {
		framework: (await import(pathToFileURL(resolvedEntry).href)) as FrameworkTargetModule,
		resolvedPackage: await packageIdentity(dirname(resolvedEntry)),
	};
}

async function loadAndAssertTarget(
	loadTarget: (packageSpecifier: string) => Promise<LoadedFrameworkTarget>,
	targetName: string,
	packageSpecifier: string,
): Promise<LoadedFrameworkTarget> {
	let loadedTarget: LoadedFrameworkTarget;
	try {
		loadedTarget = await loadTarget(packageSpecifier);
	} catch (error) {
		throw new Error(
			`Target ${targetName} package ${packageSpecifier} failed to load: ${errorMessage(error)}`,
		);
	}
	const { framework } = loadedTarget;
	for (const member of ['emit', 'formatEmitted', 'validateEnrichedIr', 'checkSources'] as const) {
		if (typeof framework[member] !== 'function') {
			throw new Error(
				`Target ${targetName} package ${packageSpecifier} does not export ${member}`,
			);
		}
	}
	return loadedTarget;
}

async function cleanupStagedTargets(
	targets: ReadonlyArray<{ readonly stagedDirectory: string }>,
): Promise<void> {
	await Promise.all(
		targets.map(({ stagedDirectory }) =>
			rm(stagedDirectory, { force: true, recursive: true }).catch(() => undefined),
		),
	);
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
	const identity = await packageIdentity(start, packageName);
	return identity.version;
}

async function packageIdentity(start: string, expectedName?: string): Promise<ResolvedPackage> {
	let directory = start;
	for (;;) {
		try {
			const packageJson = JSON.parse(
				await readFile(join(directory, 'package.json'), 'utf8'),
			) as {
				name?: string;
				version?: string;
			};
			if (
				packageJson.name &&
				packageJson.version &&
				(!expectedName || packageJson.name === expectedName)
			) {
				return { name: packageJson.name, version: packageJson.version };
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		const parent = dirname(directory);
		if (parent === directory)
			throw new Error(`Could not resolve package identity from ${start}`);
		directory = parent;
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
