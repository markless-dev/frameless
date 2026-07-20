import { describe, expect, test } from 'vitest';
import {
	CompilerPassGraphError,
	enrichedIrPassDefinition,
	runCompilerPassPipeline,
	validateCompilerPassGraph,
} from '../src/index.ts';

describe('compiler extension pass graph', () => {
	test('declares the Markless semantic graph to enriched IR edge', () => {
		expect(enrichedIrPassDefinition).toMatchObject({
			consumes: ['tsrx-semantic-graph'],
			produces: ['frameless-enriched-ir'],
		});
	});

	test('topologically orders passes and records dumpable artifacts', async () => {
		const result = await runCompilerPassPipeline({
			initialArtifacts: { source: 'input' },
			passes: [
				{ passId: 'second', description: '', consumes: ['middle'], produces: ['output'], run: ({ middle }) => ({ output: `${middle}!` }) },
				{ passId: 'first', description: '', consumes: ['source'], produces: ['middle'], run: ({ source }) => ({ middle: `${source}?` }) },
			],
			dumpArtifact: ({ artifactKey, value }) => `${artifactKey}:${value}`,
		});
		expect(result.passGraph.orderedPassIds).toEqual(['first', 'second']);
		expect(result.artifacts.output).toBe('input?!');
		expect(result.artifactDumps.map((item) => item.dump)).toEqual(['middle:input?', 'output:input?!']);
	});

	test('fails closed on missing inputs and cycles', () => {
		expect(() => validateCompilerPassGraph([{ passId: 'missing', description: '', consumes: ['absent'], produces: ['value'] }], [])).toThrow(CompilerPassGraphError);
		expect(() => validateCompilerPassGraph([
			{ passId: 'left', description: '', consumes: ['right'], produces: ['left'] },
			{ passId: 'right', description: '', consumes: ['left'], produces: ['right'] },
		], [])).toThrow(/cycle/);
	});
});
