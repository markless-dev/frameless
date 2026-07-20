#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createBuildPlan, parseProgramArgs } from './program.ts';
import { executeBuildPlan } from './node-runtime.ts';

export interface MainOptions {
	readonly cwd?: string;
	readonly stdout?: (message: string) => void;
	readonly stderr?: (message: string) => void;
}

export async function main(argv: readonly string[], options: MainOptions = {}): Promise<0 | 1> {
	const stdout = options.stdout ?? ((message: string) => process.stdout.write(message));
	const stderr = options.stderr ?? ((message: string) => process.stderr.write(message));
	try {
		const parsed = parseProgramArgs(argv);
		if (parsed.command === 'help') {
			stdout(parsed.usage);
			return 0;
		}
		await executeBuildPlan(createBuildPlan(parsed), options.cwd ?? process.cwd());
		return 0;
	} catch (error) {
		stderr(`${error instanceof Error ? error.message : String(error)}\n`);
		return 1;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
