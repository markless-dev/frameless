export interface TargetInventoryEntry {
	readonly name: string;
	readonly packageSpecifier: string;
}

export const TARGET_INVENTORY = [
	{ name: 'react', packageSpecifier: '@frameless/react' },
	{ name: 'solid', packageSpecifier: '@frameless/solid' },
] as const satisfies readonly TargetInventoryEntry[];

export const PROGRAM_USAGE = [
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
].join('\n');

export interface ParsedBuildArgs {
	readonly command: 'build';
	readonly input: string;
	readonly outDir: string;
	readonly targets: readonly string[];
}

export interface ParsedHelpArgs {
	readonly command: 'help';
	readonly usage: string;
}

export type ParsedProgramArgs = ParsedBuildArgs | ParsedHelpArgs;

export interface BuildPlanTarget {
	readonly emittedFilename: string;
	readonly name: string;
	readonly outputDirectory: string;
	readonly packageSpecifier: string;
}

export interface BuildPlan {
	readonly command: 'build';
	readonly input: string;
	readonly outDir: string;
	readonly targets: readonly BuildPlanTarget[];
}

export function parseProgramArgs(
	args: readonly string[],
	inventory: readonly TargetInventoryEntry[] = TARGET_INVENTORY,
): ParsedProgramArgs {
	if (args[0] === 'help' || args.includes('--help')) {
		return { command: 'help', usage: PROGRAM_USAGE };
	}

	if (args[0] !== 'build') {
		throw new Error(args[0] ? `Unexpected argument ${args[0]}` : 'Unexpected argument');
	}

	let input: string | undefined;
	let outDir: string | undefined;
	const targets: string[] = [];

	for (let index = 1; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg) continue;

		if (arg === '--target' || arg.startsWith('--target=')) {
			const value = readOptionValue('target', arg, args, index);
			if (!arg.includes('=')) index += 1;
			assertKnownTarget(value, inventory);
			if (!targets.includes(value)) targets.push(value);
			continue;
		}

		if (arg === '--out-dir' || arg.startsWith('--out-dir=')) {
			const value = readOptionValue('out-dir', arg, args, index);
			if (!arg.includes('=')) index += 1;
			if (outDir !== undefined) throw new Error('Unexpected argument --out-dir');
			outDir = value;
			continue;
		}

		if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
		if (input !== undefined) throw new Error(`Unexpected argument ${arg}`);
		input = arg;
	}

	if (!input) throw new Error('Missing input for build');
	if (targets.length === 0) throw new Error('At least one --target is required');
	if (!outDir) throw new Error('Missing value for --out-dir');

	return { command: 'build', input, outDir, targets };
}

export function createBuildPlan(
	args: ParsedBuildArgs,
	inventory: readonly TargetInventoryEntry[] = TARGET_INVENTORY,
): BuildPlan {
	const emittedFilename = emittedFilenameFor(args.input);
	const targets = args.targets.map((name) => {
		const target = inventory.find((entry) => entry.name === name);
		if (!target) {
			throw new Error(`Unknown target ${name} (known: ${knownTargetNames(inventory)})`);
		}

		return {
			emittedFilename,
			name,
			outputDirectory: targetOutputDirectory(args.outDir, name),
			packageSpecifier: target.packageSpecifier,
		};
	});

	return {
		command: 'build',
		input: args.input,
		outDir: args.outDir,
		targets,
	};
}

function readOptionValue(
	name: string,
	arg: string,
	args: readonly string[],
	index: number,
): string {
	const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[index + 1];
	if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
	return value;
}

function assertKnownTarget(
	name: string,
	inventory: readonly TargetInventoryEntry[],
): void {
	if (!inventory.some((entry) => entry.name === name)) {
		throw new Error(`Unknown target ${name} (known: ${knownTargetNames(inventory)})`);
	}
}

function knownTargetNames(inventory: readonly TargetInventoryEntry[]): string {
	return inventory.map((target) => target.name).join(', ');
}

function emittedFilenameFor(input: string): string {
	const basename = input.split(/[\\/]/).at(-1) ?? input;
	return basename.endsWith('.tsrx') ? `${basename.slice(0, -'.tsrx'.length)}.jsx` : basename;
}

function targetOutputDirectory(outDir: string, target: string): string {
	const base = outDir.replace(/[\\/]+$/, '');
	return `${base || '/'}${base ? '/' : ''}${target}/`;
}
