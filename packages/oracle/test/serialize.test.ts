import { describe, expect, test } from 'vitest';
import { FRAMEWORK_ATTRIBUTE_ALLOWLIST, ORACLE_CONTRACT_VERSION } from '../src/index.ts';

describe('serialization contract', () => {
	test('is versioned and normalization is allowlist-only', () => {
		expect(ORACLE_CONTRACT_VERSION).toBe('frameless-equivalence-oracle/1');
		expect([...FRAMEWORK_ATTRIBUTE_ALLOWLIST]).toEqual([
			'data-reactroot',
			'data-solid-render-id',
		]);
		expect(FRAMEWORK_ATTRIBUTE_ALLOWLIST.has('class')).toBe(false);
		expect(FRAMEWORK_ATTRIBUTE_ALLOWLIST.has('style')).toBe(false);
		expect(FRAMEWORK_ATTRIBUTE_ALLOWLIST.has('data-anything')).toBe(false);
	});
});
