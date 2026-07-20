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

describe('frameless-receipts/1', () => {
	test('validates its version and preserves blocked-by-upstream', () => {
		expect(validateReceipt(receipt)).toBe(true);
		expect(validateReceipt({ ...receipt, schema: 'old' })).toBe(false);
		expect(validateReceipt({ ...receipt, summary: { ...receipt.summary, equalPairs: 2 } })).toBe(
			false,
		);
		expect(renderResults(receipt)).toContain('blocked-by-upstream(#upstream)');
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
