import type { SemanticGraphArtifact } from '@markless/compiler';
import type { MarklessStorageSourceFact } from './persistence.ts';
import type { EnrichedIR } from './schema.ts';

export type TsrxSemanticGraphArtifact = {
	readonly filename: string;
	readonly source: string;
	readonly semanticGraph: SemanticGraphArtifact;
	readonly persistenceSourceFacts: ReadonlyArray<MarklessStorageSourceFact>;
};

export type FramelessCompilerArtifactMap = {
	readonly 'tsrx-semantic-graph': TsrxSemanticGraphArtifact;
	readonly 'frameless-enriched-ir': EnrichedIR;
};

export type CompilerPassDefinition = {
	readonly passId: string;
	readonly description: string;
	readonly consumes: ReadonlyArray<string>;
	readonly produces: ReadonlyArray<string>;
};

export type CompilerArtifactMap = Readonly<Record<string, unknown>>;
export type RunnableCompilerPassDefinition = CompilerPassDefinition & {
	readonly run: (inputs: CompilerArtifactMap) => CompilerArtifactMap | Promise<CompilerArtifactMap>;
};
export type CompilerPassGraph = {
	readonly orderedPassIds: ReadonlyArray<string>;
	readonly artifacts: ReadonlyArray<string>;
};
export type CompilerArtifactDump = {
	readonly passId: string;
	readonly artifactKey: string;
	readonly dump: string;
};
export type CompilerArtifactDumper = (input: {
	readonly passId: string;
	readonly artifactKey: string;
	readonly value: unknown;
}) => string;
