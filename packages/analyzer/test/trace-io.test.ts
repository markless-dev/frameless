import { describe, expect, test } from 'vitest';
import {
	ANALYZER_CONTRACT_VERSION,
	compareRuns,
	deserializeRunTrace,
	serializeRunTrace,
	type RunTrace,
} from '../src/index.ts';

function representativeTrace(): RunTrace {
	return {
		contract: ANALYZER_CONTRACT_VERSION,
		scenario: 'editable-list',
		framework: 'fixture',
		observations: [
			{
				phase: 'action:0:after',
				dom: [
					{
						nodeType: 'element',
						namespace: 'http://www.w3.org/1999/xhtml',
						tag: 'label',
						attributes: [['class', 'item']],
						properties: { disabled: false },
						nodeId: 1,
						children: [
							{ nodeType: 'text', text: 'Name', nodeId: 2 },
							{
								nodeType: 'element',
								tag: 'input',
								properties: { checked: false, value: 'Ada' },
								nodeId: 3,
								children: [],
							},
						],
					},
				],
				focus: { nodeId: 3, path: '0.1', selection: [1, 3] },
				callbacks: [
					{
						name: 'change',
						payload: { current: { label: 'Ada' }, prior: null, tags: ['edited', 1] },
						phase: 'action:0:after',
						defaultPrevented: false,
						invocation: 1,
					},
				],
				rows: { ada: 1 },
				identityViolations: ['row:grace:remounted'],
				focusViolations: ['row:grace:focus-lost'],
			},
		],
	};
}

describe('RunTrace transport', () => {
	test('round-trips the complete trace with deep equality', () => {
		const trace = representativeTrace();
		expect(deserializeRunTrace(serializeRunTrace(trace))).toEqual(trace);
	});

	test('serializes deterministically independent of object key insertion order', () => {
		const trace = representativeTrace();
		const reordered = {
			observations: trace.observations,
			framework: trace.framework,
			scenario: trace.scenario,
			contract: trace.contract,
		} as RunTrace;

		expect(serializeRunTrace(reordered)).toBe(serializeRunTrace(trace));
		expect(serializeRunTrace(trace)).toMatch(/\n$/);
	});

	test('rejects the wrong analyzer contract', () => {
		const value = { ...representativeTrace(), contract: 'frameless-analyzer/99' };
		expect(() => deserializeRunTrace(JSON.stringify(value))).toThrow(/RunTrace contract/);
	});

	test('rejects a missing observation field', () => {
		const value = representativeTrace() as unknown as {
			observations: Array<Record<string, unknown>>;
		};
		delete value.observations[0].focusViolations;
		expect(() => deserializeRunTrace(JSON.stringify(value))).toThrow(
			/RunTrace observations\[0\] is missing field: focusViolations/,
		);
	});

	test('rejects unknown record keys', () => {
		const value = { ...representativeTrace(), capturedAt: 'now' };
		expect(() => deserializeRunTrace(JSON.stringify(value))).toThrow(
			/RunTrace has unknown field: capturedAt/,
		);
	});

	test('rejects malformed JSON text with a RunTrace diagnostic', () => {
		expect(() => deserializeRunTrace('{')).toThrow(/RunTrace JSON is malformed/);
	});

	test.each([
		['function payload', () => undefined],
		['undefined array entry', [undefined]],
		['non-finite payload number', Number.POSITIVE_INFINITY],
	])('rejects a non-JSON callback %s during serialization', (_name, payload) => {
		const trace = representativeTrace();
		trace.observations[0].callbacks[0].payload = payload;
		expect(() => serializeRunTrace(trace)).toThrow(
			/RunTrace observations\[0\] callbacks\[0\] payload/,
		);
	});

	test('rejects a cyclic callback payload during serialization', () => {
		const payload: Record<string, unknown> = {};
		payload.self = payload;
		const trace = representativeTrace();
		trace.observations[0].callbacks[0].payload = payload;
		expect(() => serializeRunTrace(trace)).toThrow(
			/RunTrace observations\[0\] callbacks\[0\] payload.*cycle/,
		);
	});

	test('rejects a non-JSON node property during serialization', () => {
		const trace = representativeTrace();
		trace.observations[0].dom[0].properties = { value: Number.NaN };
		expect(() => serializeRunTrace(trace)).toThrow(
			/RunTrace observations\[0\] dom\[0\] properties value/,
		);
	});

	test('rejects a malformed nested SerializedNode', () => {
		const value = representativeTrace() as unknown as {
			observations: Array<{ dom: Array<{ children: Array<Record<string, unknown>> }> }>;
		};
		value.observations[0].dom[0].children[1].attributes = [['checked', true]];
		expect(() => deserializeRunTrace(JSON.stringify(value))).toThrow(
			/RunTrace observations\[0\] dom\[0\] children\[1\] attributes\[0\]\[1\]/,
		);
	});

	test('preserves equality when a trace crosses the text transport', () => {
		const trace = representativeTrace();
		expect(compareRuns(trace, deserializeRunTrace(serializeRunTrace(trace)))).toEqual({
			equal: true,
			divergences: [],
		});
	});
});
