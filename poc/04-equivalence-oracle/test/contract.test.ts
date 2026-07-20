import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import { FRAMEWORK_ATTRIBUTE_ALLOWLIST, ORACLE_CONTRACT_VERSION } from '../src/oracle';

const require=createRequire(import.meta.url);
describe('oracle and framework-version contract',()=>{
  test('normalization is versioned and allowlist-only',()=>{
    expect(ORACLE_CONTRACT_VERSION).toBe('frameless-equivalence-oracle/1');
    expect([...FRAMEWORK_ATTRIBUTE_ALLOWLIST]).toEqual(['data-reactroot','data-solid-render-id']);
    expect(FRAMEWORK_ATTRIBUTE_ALLOWLIST.has('class')).toBe(false);
    expect(FRAMEWORK_ATTRIBUTE_ALLOWLIST.has('style')).toBe(false);
    expect(FRAMEWORK_ATTRIBUTE_ALLOWLIST.has('data-anything')).toBe(false);
  });
  test('Solid v2 package is pinned but has no v1 browser mounting export',()=>{
    const manifest=require('solid2/package.json');
    expect(manifest.version).toBe('2.0.0-experimental.16');
    expect(Object.keys(manifest.exports)).not.toContain('./web');
    expect(()=>require.resolve('solid2/web')).toThrow();
  });
});
