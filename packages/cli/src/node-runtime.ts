import { createHash, randomUUID } from 'node:crypto';
import { open, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'pathe';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { EnrichedIR, ModuleSetLinkTable } from '@frameless/compiler';
import type { BuildPlan } from './program.ts';
import { generatePrePaintPersistenceScript } from './persistence.ts';
import {
	BUILD_EQUIVALENCE_AUTHORITY,
	ENRICHED_IR_VERSION,
	createBuildReceipt,
	serializeBuildReceipt,
	type GateResult,
	type ResolvedPackage,
	type TargetBuildReceipt,
} from './receipts.ts';

export const BUILD_RECEIPT_FILENAME = 'frameless-build-receipt.json' as const;
export const PERSISTENCE_SCRIPT_FILENAME = 'frameless-persistence-pre-paint.js' as const;

export interface FrameworkTargetModule {
	emit(ir: EnrichedIR): string;
	formatEmitted(source: string): Promise<string>;
	validateEnrichedIr(ir: EnrichedIR): void;
	checkSources(
		entries: ReadonlyArray<{
			readonly file: string;
			readonly source: string;
			readonly artifact?: EnrichedIR;
		}>,
	): Promise<GateResult>;
}

export interface LoadedFrameworkTarget {
	readonly framework: FrameworkTargetModule;
	readonly resolvedPackage: ResolvedPackage;
}

interface PreparedTarget {
	readonly modules: ReadonlyArray<{
		readonly content: string;
		readonly emittedFilename: string;
	}>;
	readonly finalDirectory: string;
	readonly receipt: TargetBuildReceipt;
}

interface CompiledModule {
	readonly moduleId: string;
	readonly sourcePath: string;
	readonly emittedFilename: string;
	readonly source: string;
	readonly artifact: EnrichedIR;
}

/** Compile, validate, gate, and atomically write every target in a build plan. */
export async function executeBuildPlan(plan: BuildPlan, workingDirectory: string): Promise<void> {
	return executeBuildPlanInternal(plan, workingDirectory, importFrameworkTarget);
}

/** Test-only loader seam; deliberately omitted from the package index public API. */
export async function executeBuildPlanInternal(
	plan: BuildPlan,
	workingDirectory: string,
	loadTarget: (packageSpecifier: string) => Promise<LoadedFrameworkTarget>,
): Promise<void> {
	const cwd = resolve(workingDirectory);
	const { buildEnrichedIr, resolveModuleSet } = await import('@frameless/compiler');
	const compiledModules: CompiledModule[] = await Promise.all(
		plan.inputs.map(async (input) => {
			const inputPath = resolveFrom(cwd, input.sourcePath);
			const source = await readFile(inputPath, 'utf8');
			return {
				moduleId: relative(cwd, inputPath) || input.sourcePath,
				sourcePath: relative(cwd, inputPath) || input.sourcePath,
				emittedFilename: input.emittedFilename,
				source,
				artifact: await buildEnrichedIr({ filename: inputPath, source }),
			};
		}),
	);
	const linkTable = resolveModuleSet(
		compiledModules.map(({ moduleId, artifact }) => ({ moduleId, artifact })),
	);
	const preparedTargets: Array<readonly [string, PreparedTarget]> = [];

	for (const target of plan.targets) {
		const loadedTarget = await loadAndAssertTarget(
			loadTarget,
			target.name,
			target.packageSpecifier,
		);
		const { framework, resolvedPackage } = loadedTarget;
		const outputDirectory = resolveFrom(cwd, target.outputDirectory);
		const preparedModules = [];
		for (const module of compiledModules) {
			try {
				framework.validateEnrichedIr(module.artifact);
			} catch (error) {
				throw new Error(
					`Target ${target.name} validation failed for ${module.moduleId}: ${errorMessage(error)}`,
				);
			}

			let content: string;
			try {
				content = framework.emit(module.artifact);
			} catch (error) {
				throw new Error(
					`Target ${target.name} emission failed for ${module.moduleId}: ${errorMessage(error)}`,
				);
			}
			try {
				content = await framework.formatEmitted(content);
			} catch (error) {
				throw new Error(
					`Target ${target.name} formatting failed for ${module.moduleId}: ${errorMessage(error)}`,
				);
			}

			const outputPath = join(outputDirectory, module.emittedFilename);
			const emittedFilePath = relative(cwd, outputPath) || module.emittedFilename;
			const rawGate = await framework.checkSources([
				{ file: module.emittedFilename, source: content, artifact: module.artifact },
			]);
			const gate = enumerableGate(rawGate);
			const violation = gate.violations[0];
			if (violation) {
				throw new Error(
					`Target ${target.name} gate failed for ${module.moduleId} (policy ${violation.policy}): ${violation.message}`,
				);
			}
			const unevaluated = gate.unevaluated[0];
			if (unevaluated) {
				throw new Error(
					`Target ${target.name} gate failed for ${module.moduleId}: policy ${unevaluated.policy} was unevaluated (${unevaluated.reason})`,
				);
			}
			preparedModules.push({
				moduleId: module.moduleId,
				content,
				emittedFilename: module.emittedFilename,
				emittedFilePath,
				emittedContentSha256: sha256(content),
				validation: { state: 'passed' } as const,
				gate,
				provenance: { artifactSupplied: true, allPoliciesEvaluated: true } as const,
			});
		}
		const firstModule = preparedModules[0]!;

		preparedTargets.push([
			target.name,
			{
				modules: preparedModules.map(({ content, emittedFilename }) => ({
					content,
					emittedFilename,
				})),
				finalDirectory: outputDirectory,
				receipt: {
					packageSpecifier: target.packageSpecifier,
					resolvedPackage,
					emittedFilePath: firstModule.emittedFilePath,
					emittedContentSha256: firstModule.emittedContentSha256,
					validation: { state: 'passed' },
					gate: firstModule.gate,
					modules: preparedModules.map(
						({
							moduleId,
							emittedFilePath,
							emittedContentSha256,
							validation,
							gate,
							provenance,
						}) => ({
							moduleId,
							emittedFilePath,
							emittedContentSha256,
							validation,
							gate,
							provenance,
						}),
					),
				},
			},
		]);
	}

	const firstModule = compiledModules[0]!;
	const outputRoot = resolveFrom(cwd, plan.outDir);
	const persistenceScript = generatePrePaintPersistenceScript(
		compiledModules.flatMap(({ artifact }) => artifact.records.persistence),
	);
	const persistenceScriptPath = join(outputRoot, PERSISTENCE_SCRIPT_FILENAME);
	const receipt = createBuildReceipt({
		generator: {
			toolName: '@frameless/cli',
			toolVersion: await packageVersion('@frameless/cli', import.meta.url),
		},
		input: {
			sourcePath: firstModule.sourcePath,
			contentSha256: sha256(firstModule.source),
			compilerPackageVersion: await packageVersion('@frameless/compiler'),
		},
		ir: {
			version: ENRICHED_IR_VERSION,
			digestSha256: sha256(JSON.stringify(firstModule.artifact)),
		},
		modules: compiledModules.map((module) => ({
			moduleId: module.moduleId,
			sourcePath: module.sourcePath,
			contentSha256: sha256(module.source),
			emittedFilename: module.emittedFilename,
			ir: {
				version: ENRICHED_IR_VERSION,
				digestSha256: sha256(JSON.stringify(module.artifact)),
			},
		})),
		linkTable: summarizeLinkTable(linkTable),
		targets: Object.fromEntries(
			preparedTargets.map(([name, prepared]) => [name, prepared.receipt]),
		),
		equivalence: {
			state: 'delegated',
			authority: BUILD_EQUIVALENCE_AUTHORITY,
			command: 'pnpm test:browser',
		},
		...(persistenceScript
			? {
					persistence: {
						scriptPath:
							relative(cwd, persistenceScriptPath) || PERSISTENCE_SCRIPT_FILENAME,
						contentSha256: persistenceScript.contentSha256,
						cspHash: persistenceScript.cspHash,
						records: persistenceScript.records,
						placement: 'head-before-framework' as const,
					},
				}
			: {}),
	});
	const serializedReceipt = serializeBuildReceipt(receipt);

	const receiptPath = join(outputRoot, BUILD_RECEIPT_FILENAME);
	const createdOutputRoot = await mkdir(outputRoot, { recursive: true });
	const stagedTargets: Array<{
		readonly finalDirectory: string;
		readonly stagedDirectory: string;
	}> = [];
	let stagedPersistencePath: string | undefined;
	try {
		for (const [name, prepared] of preparedTargets) {
			const stagedDirectory = join(outputRoot, `.${name}.${randomUUID()}.tmp`);
			stagedTargets.push({ finalDirectory: prepared.finalDirectory, stagedDirectory });
			for (const module of prepared.modules) {
				const stagedOutputPath = join(stagedDirectory, module.emittedFilename);
				await mkdir(dirname(stagedOutputPath), { recursive: true });
				await atomicWriteFile(stagedOutputPath, module.content);
			}
		}
		if (persistenceScript) {
			stagedPersistencePath = join(
				outputRoot,
				`.${PERSISTENCE_SCRIPT_FILENAME}.${randomUUID()}.tmp`,
			);
			await atomicWriteFile(stagedPersistencePath, persistenceScript.content);
		}
	} catch (error) {
		await cleanupStagedTargets(stagedTargets);
		if (stagedPersistencePath)
			await rm(stagedPersistencePath, { force: true }).catch(() => undefined);
		if (createdOutputRoot) await rm(outputRoot, { force: true, recursive: true });
		throw error;
	}

	try {
		for (const staged of stagedTargets) {
			await rm(staged.finalDirectory, { force: true, recursive: true });
			await rename(staged.stagedDirectory, staged.finalDirectory);
		}
		if (stagedPersistencePath) {
			await rename(stagedPersistencePath, persistenceScriptPath);
			stagedPersistencePath = undefined;
		} else {
			await rm(persistenceScriptPath, { force: true });
		}
	} catch (error) {
		await cleanupStagedTargets(stagedTargets);
		if (stagedPersistencePath)
			await rm(stagedPersistencePath, { force: true }).catch(() => undefined);
		throw error;
	}
	await atomicWriteFile(receiptPath, serializedReceipt);
}

function enumerableGate(gate: GateResult): GateResult {
	return {
		files: [...gate.files],
		policies: [...gate.policies],
		violations: [...gate.violations],
		unevaluated: [...(gate.unevaluated ?? [])],
	};
}

function summarizeLinkTable(linkTable: ModuleSetLinkTable) {
	return {
		moduleCount: linkTable.length,
		referenceCount: linkTable.reduce((count, module) => count + module.references.length, 0),
		modules: linkTable,
	};
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
