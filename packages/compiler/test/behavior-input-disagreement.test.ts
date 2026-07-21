import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@markless/compiler', async () => {
	const actual = await vi.importActual<typeof import('@markless/compiler')>(
		'@markless/compiler',
	);
	return {
		...actual,
		buildSemanticGraph: async (input: Parameters<typeof actual.buildSemanticGraph>[0]) => {
			const graph = await actual.buildSemanticGraph(input);
			return {
				...graph,
				behaviors: graph.behaviors.map((behavior) => ({
					...behavior,
					inputSources: ['missingGraphBinding'],
				})),
			};
		},
	};
});

import { buildEnrichedIr } from '../src/build.ts';

describe('behavior Layer A disagreement', () => {
	test('preserves the existing fail-closed diagnostic for a nonzero mismatched input', async () => {
		const source = readFileSync(
			new URL('./fixtures/composition-attach-input.tsrx', import.meta.url),
			'utf8',
		);
		await expect(
			buildEnrichedIr({ filename: 'src/composition-attach-disagreement.tsrx', source }),
		).rejects.toThrow('Behavior 0 on h0 input mapping is incomplete (1/1).');
	});
});
