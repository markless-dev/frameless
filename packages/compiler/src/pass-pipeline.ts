import type {
	CompilerArtifactDump,
	CompilerArtifactDumper,
	CompilerArtifactMap,
	CompilerPassGraph,
	RunnableCompilerPassDefinition,
} from './artifacts.ts';
import { CompilerPassGraphError, validateCompilerPassGraph } from './pass-graph.ts';

export async function runCompilerPassPipeline(input: {
	readonly passes: ReadonlyArray<RunnableCompilerPassDefinition>;
	readonly initialArtifacts: CompilerArtifactMap;
	readonly dumpArtifact?: CompilerArtifactDumper;
}): Promise<{
	readonly passGraph: CompilerPassGraph;
	readonly artifacts: CompilerArtifactMap;
	readonly artifactDumps: ReadonlyArray<CompilerArtifactDump>;
}> {
	const passGraph = validateCompilerPassGraph(input.passes, Object.keys(input.initialArtifacts));
	const byId = new Map(input.passes.map((pass) => [pass.passId, pass]));
	const artifacts: Record<string, unknown> = { ...input.initialArtifacts };
	const artifactDumps: CompilerArtifactDump[] = [];
	for (const passId of passGraph.orderedPassIds) {
		const pass = byId.get(passId)!;
		const inputs = Object.fromEntries(pass.consumes.map((key) => [key, artifacts[key]]));
		const outputs = await pass.run(inputs);
		const declared = new Set(pass.produces);
		for (const key of Object.keys(outputs)) {
			if (!declared.has(key)) throw new CompilerPassGraphError(`Compiler pass "${passId}" produced undeclared artifact "${key}".`, 'undeclared-pass-output', passId, [key]);
		}
		for (const key of pass.produces) {
			if (!Object.prototype.hasOwnProperty.call(outputs, key)) throw new CompilerPassGraphError(`Compiler pass "${passId}" did not produce declared artifact "${key}".`, 'missing-pass-output', passId, [key]);
			artifacts[key] = outputs[key];
			if (input.dumpArtifact) artifactDumps.push({ passId, artifactKey: key, dump: input.dumpArtifact({ passId, artifactKey: key, value: outputs[key] }) });
		}
	}
	return { passGraph, artifacts, artifactDumps };
}

export const formatCompilerArtifactDump: CompilerArtifactDumper = ({ passId, artifactKey, value }) =>
	[`# ${passId} -> ${artifactKey}`, '', '```json', JSON.stringify(value, null, 2) ?? 'null', '```'].join('\n');
