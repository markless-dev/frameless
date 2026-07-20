import type { CompilerPassDefinition, CompilerPassGraph } from './artifacts.ts';

export type CompilerPassGraphErrorReason =
	| 'duplicate-pass-id'
	| 'duplicate-artifact-producer'
	| 'missing-artifact'
	| 'dependency-cycle'
	| 'missing-pass-output'
	| 'undeclared-pass-output';

export class CompilerPassGraphError extends Error {
	constructor(
		message: string,
		readonly reason: CompilerPassGraphErrorReason,
		readonly passId: string,
		readonly artifactKeys: ReadonlyArray<string>,
	) {
		super(message);
		this.name = 'CompilerPassGraphError';
	}
}

export function validateCompilerPassGraph(
	passes: ReadonlyArray<CompilerPassDefinition>,
	initialArtifacts: ReadonlyArray<string>,
): CompilerPassGraph {
	const producers = new Map<string, string>();
	const passIds = new Set<string>();
	for (const pass of passes) {
		if (passIds.has(pass.passId)) {
			throw new CompilerPassGraphError(`Compiler pass "${pass.passId}" is declared more than once.`, 'duplicate-pass-id', pass.passId, []);
		}
		passIds.add(pass.passId);
		for (const artifact of pass.produces) {
			const owner = producers.get(artifact);
			if (owner) {
				throw new CompilerPassGraphError(`Compiler artifact "${artifact}" is produced by both "${owner}" and "${pass.passId}".`, 'duplicate-artifact-producer', pass.passId, [artifact]);
			}
			producers.set(artifact, pass.passId);
		}
	}

	const known = new Set(initialArtifacts);
	const remaining = [...passes];
	const orderedPassIds: string[] = [];
	while (remaining.length > 0) {
		const next = remaining.findIndex((pass) => pass.consumes.every((key) => known.has(key)));
		if (next < 0) {
			for (const pass of remaining) {
				const missing = pass.consumes.find((key) => !known.has(key) && !producers.has(key));
				if (missing) throw new CompilerPassGraphError(`Missing compiler artifact "${missing}" consumed by pass "${pass.passId}".`, 'missing-artifact', pass.passId, [missing]);
			}
			throw new CompilerPassGraphError('Compiler pass graph has a dependency cycle.', 'dependency-cycle', remaining.map((pass) => pass.passId).join(','), remaining.flatMap((pass) => pass.produces));
		}
		const [pass] = remaining.splice(next, 1);
		orderedPassIds.push(pass.passId);
		for (const artifact of pass.produces) known.add(artifact);
	}
	return { orderedPassIds, artifacts: [...known] };
}
