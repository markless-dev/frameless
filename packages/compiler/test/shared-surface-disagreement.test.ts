import { describe, expect, test, vi } from 'vitest';

vi.mock('@markless/compiler', async () => {
	const actual = await vi.importActual<typeof import('@markless/compiler')>('@markless/compiler');
	return {
		...actual,
		buildSemanticGraph: async (input: Parameters<typeof actual.buildSemanticGraph>[0]) => {
			const graph = await actual.buildSemanticGraph(input);
			const instance = graph.sharedInstances[0]!;
			return {
				...graph,
				templateReads: [
					...graph.templateReads,
					{
						hostNodeId: graph.hostNodes[0]!.id,
						source: 'sharedValue.value',
						sourceSpan: instance.sourceSpan,
						target: { kind: 'text' as const },
					},
				],
			};
		},
	};
});

import { buildEnrichedIr } from '../src/build.ts';

describe('shared semantic surface disagreement', () => {
	test('fails closed when a Layer A shared read would be dropped from /2', async () => {
		const source = `import { shared, state } from "@markless/core";
			export const useValue = shared(() => { let value = state(0); return { value }; });
			export function Reader() @{ const sharedValue = useValue(); <output>{sharedValue.value}</output> }`;
		await expect(
			buildEnrichedIr({ filename: 'src/shared-surface-disagreement.tsrx', source }),
		).rejects.toThrow(
			'Shared read sharedValue.value in component:0:Reader is missing 1 frameless-enriched-ir/2 record.',
		);
	});
});
