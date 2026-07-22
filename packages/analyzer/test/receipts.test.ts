import { describe, expect, test } from 'vitest';
import {
	RECEIPT_SCHEMA_VERSION,
	createReceiptSummary,
	createReceiptVerdictReport,
	renderResults,
	validateReceipt,
	type Receipt,
} from '../src/index.ts';

const results: Pick<Receipt, 'scenarios' | 'mutantRejections'> = {
	scenarios: {
		scenario: {
			reference: { status: 'equal', equal: true, divergences: [] },
			upstream: { status: 'blocked-by-upstream', findingIds: ['upstream'] },
		},
	},
	mutantRejections: {
		mutant: {
			scenario: 'scenario',
			expectedChannel: 'dom',
			rejected: true,
			observedChannels: ['dom'],
			divergences: [],
		},
	},
};

const receipt: Receipt = {
	schema: RECEIPT_SCHEMA_VERSION,
	generatedBy: '@frameless/analyzer test',
	environment: { analyzer: 'frameless-analyzer/1' },
	findings: { upstream: { id: 'upstream', summary: 'blocked leg', evidence: ['issue'] } },
	...results,
	summary: createReceiptSummary(results),
};

describe('frameless-receipts/2', () => {
	test('validates without the optional ssr entry and preserves blocked-by-upstream', () => {
		expect(validateReceipt(receipt)).toBe(true);
		expect(validateReceipt({ ...receipt, schema: 'old' })).toBe(false);
		expect(
			validateReceipt({ ...receipt, summary: { ...receipt.summary, equalPairs: 2 } }),
		).toBe(false);
		expect(renderResults(receipt)).toContain('blocked-by-upstream(#upstream)');
	});

	test('validates a well-formed ssr entry for both hydrating frameworks', () => {
		const withSsr: Receipt = {
			...receipt,
			ssr: {
				witness: {
					version: '0.7.0',
					runId: 'run-123',
					receiptPath: '.witness/receipts/run-123/receipt.json',
					receiptVersionMarker: 'async-witness-receipt/1',
				},
				frameworks: {
					react: {
						activation: 'hydrate',
						preActivation: { expectations: 4, failures: 0 },
						activationClean: true,
						postActivation: { expectations: 8, failures: 0 },
						calibration: { claims: ['pre-activation', 'activation'], proven: true },
					},
					solid: {
						activation: 'hydrate',
						preActivation: { expectations: 4, failures: 0 },
						activationClean: true,
						postActivation: { expectations: 8, failures: 0 },
						calibration: { claims: ['pre-activation', 'activation'], proven: true },
					},
				},
				equality: { corpusIdentical: true, outcomesEqual: true },
			},
		};

		expect(validateReceipt(withSsr)).toBe(true);
	});

	test('rejects an invalid ssr activation discriminant', () => {
		const dishonest = structuredClone(receipt) as unknown as Record<string, unknown>;
		dishonest.ssr = createSsrEntry();
		(dishonest.ssr as SsrEntry).frameworks.react.activation = 'mount';
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test('rejects a hydration-only extra field in an ssr framework entry', () => {
		const dishonest = structuredClone(receipt) as unknown as Record<string, unknown>;
		dishonest.ssr = createSsrEntry();
		(dishonest.ssr as SsrEntry).frameworks.react.hydrationMismatches = 0;
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test('rejects an ssr entry missing a required sub-field', () => {
		const dishonest = structuredClone(receipt) as unknown as Record<string, unknown>;
		dishonest.ssr = createSsrEntry();
		delete (dishonest.ssr as SsrEntry).frameworks.react.activationClean;
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test('rejects dishonest equal pair variants', () => {
		const dishonest = structuredClone(receipt) as unknown as {
			scenarios: Record<string, Record<string, Record<string, unknown>>>;
		};
		dishonest.scenarios.scenario.reference = {
			status: 'equal',
			equal: false,
			divergences: [{ channel: 'dom', phase: 'mount', path: 'dom.0', left: 'a', right: 'b' }],
		};
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test.each([
		{ status: 'different', equal: true, divergences: [] },
		{ status: 'different', equal: false, divergences: [] },
	])('rejects dishonest different pair variant %#', (variant) => {
		const dishonest = structuredClone(receipt) as unknown as {
			scenarios: Record<string, Record<string, Record<string, unknown>>>;
			summary: Receipt['summary'];
		};
		dishonest.scenarios.scenario.reference = variant;
		dishonest.summary = createReceiptSummary(dishonest as unknown as Receipt);
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test.each([
		{ status: 'blocked-by-upstream', findingIds: [] },
		{ status: 'blocked-by-upstream', findingIds: ['missing'] },
	])('rejects dishonest blocked pair variant %#', (variant) => {
		const dishonest = structuredClone(receipt) as unknown as {
			scenarios: Record<string, Record<string, Record<string, unknown>>>;
		};
		dishonest.scenarios.scenario.upstream = variant;
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test('validates optional per-framework expectation results', () => {
		const expectation = {
			kind: 'dom-present' as const,
			phase: 'mount',
			selector: '[data-slot]',
			count: 1,
		};
		const withExpectations: Receipt = {
			...receipt,
			expectationResults: {
				scenario: {
					react: [{ expectation, phase: 'mount', outcome: 'pass' }],
					solid: [{ expectation, phase: 'mount', outcome: 'fail', observed: 0 }],
				},
			},
		};
		withExpectations.summary = createReceiptSummary(withExpectations);
		expect(validateReceipt(withExpectations)).toBe(true);
		expect(withExpectations.summary.verdict).toBe('fail');
		expect(renderResults(withExpectations)).toContain(
			'| scenario | solid | dom-present | mount | fail |',
		);
	});

	test.each([
		{
			expectation: {
				kind: 'dom-present',
				phase: 'mount',
				selector: '[data-slot]',
				count: 1,
			},
			phase: 'mount',
			outcome: 'pass',
			observed: 1,
		},
		{
			expectation: {
				kind: 'dom-present',
				phase: 'mount',
				selector: '[data-slot]',
				count: 1,
			},
			phase: 'mount',
			outcome: 'fail',
		},
		{
			expectation: {
				kind: 'dom-present',
				phase: 'mount',
				selector: '[data-slot]',
				count: 1,
			},
			phase: 'mount',
			outcome: 'fail',
			observed: 'one',
		},
		{
			expectation: {
				kind: 'dom-present',
				phase: 'mount',
				selector: '[data-slot]',
				count: 1,
				present: true,
			},
			phase: 'mount',
			outcome: 'pass',
		},
	])('rejects dishonest expectation result variant %#', (variant) => {
		const dishonest = structuredClone(receipt) as unknown as Record<string, unknown>;
		dishonest.expectationResults = { scenario: { react: [variant] } };
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test.each([
		{
			expectation: { kind: 'dom-text', phase: 'mount', selector: 'output', text: 'ready' },
			observed: null,
		},
		{
			expectation: {
				kind: 'dom-present',
				phase: 'mount',
				selector: 'output',
				count: 1,
			},
			observed: 0,
		},
		{
			expectation: {
				kind: 'dom-path',
				phase: 'mount',
				selector: 'output',
				parentTags: ['section'],
			},
			observed: ['main', 'section'],
		},
		{
			expectation: { kind: 'focus', phase: 'mount', selector: 'input' },
			observed: { focused: false, selection: null },
		},
	])(
		'accepts the kind-specific failed expectation observation for $expectation.kind',
		(result) => {
			const withFailure = structuredClone(receipt) as Receipt;
			withFailure.expectationResults = {
				scenario: {
					react: [
						{
							...result,
							phase: result.expectation.phase,
							outcome: 'fail',
						} as never,
					],
				},
			};
			withFailure.summary = createReceiptSummary(withFailure);
			expect(validateReceipt(withFailure)).toBe(true);
		},
	);

	test.each([
		{
			expectation: { kind: 'dom-text', phase: 'mount', selector: 'output', text: 'ready' },
			observed: 0,
		},
		{
			expectation: {
				kind: 'dom-present',
				phase: 'mount',
				selector: 'output',
				count: 1,
			},
			observed: 'zero',
		},
		{
			expectation: {
				kind: 'dom-path',
				phase: 'mount',
				selector: 'output',
				parentTags: ['section'],
			},
			observed: { parent: 'section' },
		},
		{
			expectation: { kind: 'focus', phase: 'mount', selector: 'input' },
			observed: false,
		},
	])('rejects an observed value from the wrong $expectation.kind variant', (result) => {
		const dishonest = structuredClone(receipt) as unknown as Record<string, unknown>;
		dishonest.expectationResults = {
			scenario: {
				react: [{ ...result, phase: result.expectation.phase, outcome: 'fail' }],
			},
		};
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test.each([
		{ kind: 'dom-text', phase: 'mount', selector: 'output', text: 'ready' },
		{ kind: 'dom-present', phase: 'mount', selector: 'output', count: 1 },
		{ kind: 'dom-path', phase: 'mount', selector: 'output', parentTags: ['section'] },
		{ kind: 'focus', phase: 'mount', selector: 'input' },
	])('requires the exact pass result shape for $kind', (expectation) => {
		const honest = structuredClone(receipt) as unknown as Record<string, unknown>;
		honest.expectationResults = {
			scenario: { react: [{ expectation, phase: expectation.phase, outcome: 'pass' }] },
		};
		expect(validateReceipt(honest)).toBe(true);

		const dishonest = structuredClone(honest) as {
			expectationResults: { scenario: { react: Record<string, unknown>[] } };
		};
		dishonest.expectationResults.scenario.react[0].observed = null;
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test.each([
		{ kind: 'dom-text', phase: 'mount', selector: 'output', text: 'ready' },
		{ kind: 'dom-present', phase: 'mount', selector: 'output', count: 1 },
		{ kind: 'dom-path', phase: 'mount', selector: 'output', parentTags: ['section'] },
		{ kind: 'focus', phase: 'mount', selector: 'input' },
	])('requires an observed value in the exact fail result shape for $kind', (expectation) => {
		const dishonest = structuredClone(receipt) as unknown as Record<string, unknown>;
		dishonest.expectationResults = {
			scenario: { react: [{ expectation, phase: expectation.phase, outcome: 'fail' }] },
		};
		expect(validateReceipt(dishonest)).toBe(false);
	});

	test('renders RESULTS.md deterministically', () => {
		expect(renderResults(receipt)).toBe(renderResults(structuredClone(receipt)));
	});

	test('composes equivalence and mutant results into a Markless verdict report', () => {
		const report = createReceiptVerdictReport(receipt);
		expect(report).toMatchObject({
			version: 2,
			source: '@frameless/analyzer test',
			lane: 'frameless-equivalence',
			passed: true,
		});
		expect(report.results.map(({ id, status }) => ({ id, status }))).toEqual([
			{ id: 'MLA-EXT-FRAMELESS-EQUIVALENCE', status: 'pass' },
			{ id: 'MLA-EXT-FRAMELESS-EQUIVALENCE', status: 'not-run' },
			{ id: 'MLA-EXT-FRAMELESS-MUTANT', status: 'pass' },
		]);
	});
});

type SsrEntry = Record<string, unknown> & {
	frameworks: Record<string, Record<string, unknown>>;
};

function createSsrEntry(): SsrEntry {
	return {
		witness: {
			version: '0.7.0',
			runId: 'run-123',
			receiptPath: '.witness/receipts/run-123/receipt.json',
			receiptVersionMarker: 'async-witness-receipt/1',
		},
		frameworks: {
			react: {
				activation: 'hydrate',
				preActivation: { expectations: 4, failures: 0 },
				activationClean: true,
				postActivation: { expectations: 8, failures: 0 },
				calibration: { claims: ['pre-activation', 'activation'], proven: true },
			},
		},
		equality: { corpusIdentical: true, outcomesEqual: true },
	};
}
