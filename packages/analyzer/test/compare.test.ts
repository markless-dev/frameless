import { describe, expect, test } from 'vitest';
import { compareRuns, ANALYZER_CONTRACT_VERSION, type RunTrace } from '../src/index.ts';

function trace(text: string): RunTrace {
	return {
		contract: ANALYZER_CONTRACT_VERSION,
		scenario: 'scenario',
		framework: 'fixture',
		observations: [
			{
				phase: 'mount',
				dom: [{ nodeType: 'text', text, nodeId: 1 }],
				focus: null,
				callbacks: [],
				rows: {},
				identityViolations: [],
				focusViolations: [],
			},
		],
	};
}

describe('compareRuns', () => {
	test('normalizes per-run node ids', () => {
		const right = trace('same');
		right.observations[0].dom[0].nodeId = 99;
		expect(compareRuns(trace('same'), right)).toEqual({ equal: true, divergences: [] });
	});

	test('reports the first exact channel, phase, and path', () => {
		const verdict = compareRuns(trace('left'), trace('right'));
		expect(verdict.equal).toBe(false);
		if (!verdict.equal) {
			expect(verdict.divergences[0]).toMatchObject({
				channel: 'dom',
				phase: 'mount',
				path: '$[0].text',
			});
		}
	});
});
