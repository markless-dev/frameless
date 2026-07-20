import { describe, expect, test } from 'vitest';
import {
	RECEIPT_SCHEMA_VERSION,
	renderResults,
	validateReceipt,
	type Receipt,
} from '../src/index.ts';

const receipt: Receipt = {
	schema: RECEIPT_SCHEMA_VERSION,
	generatedBy: '@frameless/oracle test',
	environment: { oracle: 'frameless-equivalence-oracle/1' },
	findings: { upstream: { id: 'upstream', summary: 'blocked leg', evidence: ['issue'] } },
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
	summary: {
		verdict: 'blocked-by-upstream',
		equalPairs: 1,
		differentPairs: 0,
		blockedPairs: 1,
		mutants: 1,
		rejectedMutants: 1,
	},
};

describe('frameless-receipts/1', () => {
	test('validates its version and preserves blocked-by-upstream', () => {
		expect(validateReceipt(receipt)).toBe(true);
		expect(validateReceipt({ ...receipt, schema: 'old' })).toBe(false);
		expect(renderResults(receipt)).toContain('blocked-by-upstream(#upstream)');
	});

	test('renders RESULTS.md deterministically', () => {
		expect(renderResults(receipt)).toBe(renderResults(structuredClone(receipt)));
	});
});
