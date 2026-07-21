import { describe, expect, test } from 'vitest';
import {
	ANALYZER_CONTRACT_VERSION,
	evaluateExpectations,
	type Expectation,
	type RunTrace,
} from '../src/index.ts';

function trace(): RunTrace {
	return {
		contract: ANALYZER_CONTRACT_VERSION,
		scenario: 'composition',
		framework: 'fixture',
		observations: [
			{
				phase: 'mount',
				dom: [
					{
						nodeType: 'element',
						tag: 'main',
						attributes: [['data-shell', '']],
						properties: {},
						nodeId: 1,
						children: [
							{
								nodeType: 'element',
								tag: 'output',
								attributes: [['data-cell', 'count']],
								properties: {},
								nodeId: 2,
								children: [{ nodeType: 'text', text: '2', nodeId: 3 }],
							},
							{
								nodeType: 'element',
								tag: 'input',
								attributes: [['data-search', 'active']],
								properties: { value: 'term' },
								nodeId: 4,
								children: [],
							},
						],
					},
				],
				focus: { nodeId: 4, path: '0.1', selection: [1, 3] },
				callbacks: [],
				rows: {},
				identityViolations: [],
				focusViolations: [],
			},
		],
	};
}

function evaluate(expectation: Expectation) {
	return evaluateExpectations(trace(), [expectation])[0];
}

describe('scenario expectation evaluation', () => {
	test.each([
		{
			kind: 'dom-text' as const,
			passing: {
				kind: 'dom-text' as const,
				phase: 'mount',
				selector: 'output[data-cell=count]',
				text: '2',
			},
			failing: {
				kind: 'dom-text' as const,
				phase: 'mount',
				selector: '[data-cell="count"]',
				text: '3',
			},
			observed: '2',
		},
		{
			kind: 'dom-present' as const,
			passing: {
				kind: 'dom-present' as const,
				phase: 'mount',
				selector: '[data-shell]',
				count: 1,
			},
			failing: {
				kind: 'dom-present' as const,
				phase: 'mount',
				selector: 'output',
				count: 0,
			},
			observed: 1,
		},
		{
			kind: 'focus' as const,
			passing: {
				kind: 'focus' as const,
				phase: 'mount',
				selector: 'input[data-search="active"]',
				selection: [1, 3] as [number, number],
			},
			failing: { kind: 'focus' as const, phase: 'mount', selector: 'main' },
			observed: { focused: false, selection: [1, 3] },
		},
	])('reports pass and fail results for $kind', ({ passing, failing, observed }) => {
		expect(evaluate(passing)).toEqual({
			expectation: passing,
			phase: 'mount',
			outcome: 'pass',
		});
		expect(evaluate(failing)).toEqual({
			expectation: failing,
			phase: 'mount',
			outcome: 'fail',
			observed,
		});
	});

	test('fails a zero-cardinality expectation when the named phase is absent', () => {
		const expectation = {
			kind: 'dom-present' as const,
			phase: 'action:99:after',
			selector: '[data-does-not-exist]',
			count: 0,
		};
		expect(evaluate(expectation)).toEqual({
			expectation,
			phase: 'action:99:after',
			outcome: 'fail',
			observed: 0,
		});
	});

	test('pins an element to its exact serialized parent chain', () => {
		const expectation = {
			kind: 'dom-path' as const,
			phase: 'mount',
			selector: '[data-cell=count]',
			parentTags: ['main'],
		};
		expect(evaluate(expectation)).toEqual({ expectation, phase: 'mount', outcome: 'pass' });
		expect(evaluate({ ...expectation, parentTags: ['main', 'section'] })).toMatchObject({
			outcome: 'fail',
			observed: ['main'],
		});
	});

	test.each([['Main'], ['main output'], ['']])(
		'fails closed on malformed parent tag %j',
		(parentTag) => {
			expect(() =>
				evaluate({
					kind: 'dom-path',
					phase: 'mount',
					selector: '[data-cell]',
					parentTags: [parentTag],
				}),
			).toThrow(/dom-path expectation is malformed/);
		},
	);

	test.each(['.cell', 'main output', '[data-cell][title]', '[data-cell^="c"]'])(
		'fails closed on unsupported selector syntax %s',
		(selector) => {
			expect(() =>
				evaluate({ kind: 'dom-present', phase: 'mount', selector, count: 1 }),
			).toThrow(/Unsupported expectation selector/);
		},
	);
});
