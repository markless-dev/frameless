import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { findingIds, renderResults, type Evidence } from '../src/results.ts';

const scenarios = ['S1-render-once-locals', 'S2-keyed-todo', 'S3-event-form'];
const provablePairs = [
  'emitted-react__handwritten-react',
  'emitted-solid__handwritten-solid',
  'emitted-react__handwritten-solid',
  'emitted-solid__handwritten-react',
  'emitted-react__emitted-solid',
];
const marklessPairs = ['markless__handwritten-react', 'markless__handwritten-solid', 'markless__emitted-react', 'markless__emitted-solid'];

describe('checked-in C9 verdict artifact', () => {
  test('records every provable pair as equal and every Markless pair as blocked with finding ids', async () => {
    const evidence = JSON.parse(await readFile(path.join(process.cwd(), 'results/verdict.json'), 'utf8')) as Evidence;
    expect(evidence.schema).toBe('arcade-c9-evidence/2');
    expect(Object.keys(evidence.scenarios).sort()).toEqual([...scenarios].sort());
    for (const scenario of scenarios) {
      expect(Object.keys(evidence.scenarios[scenario]).sort()).toEqual([...provablePairs, ...marklessPairs].sort());
      for (const pair of provablePairs) expect(evidence.scenarios[scenario][pair]).toEqual({ status: 'equal', equal: true, divergences: [] });
      for (const pair of marklessPairs) {
        const result = evidence.scenarios[scenario][pair];
        expect(result.status, `${scenario}: ${pair} must not be silently skipped`).toBe('blocked-by-upstream');
        if (result.status === 'blocked-by-upstream') expect(result.findingIds).toEqual(findingIds);
      }
    }
  });

  test('records S1 DOM-only partial evidence against both handwritten references and callback block #7', async () => {
    const evidence = JSON.parse(await readFile(path.join(process.cwd(), 'results/verdict.json'), 'utf8')) as Evidence;
    for (const target of ['handwritten-react', 'handwritten-solid'] as const) {
      const result = evidence.scenarios['S1-render-once-locals'][`markless__${target}`];
      expect(result.status).toBe('blocked-by-upstream');
      if (result.status === 'blocked-by-upstream') expect(result.partialEvidence).toMatchObject({
        status: 'dom-only-partial', channel: 'dom', equal: true, against: target, callbackChannel: 'blocked-by-upstream(#7)',
      });
    }
  });

  test('contains no pending or passing Markless claim', async () => {
    const raw = await readFile(path.join(process.cwd(), 'results/verdict.json'), 'utf8');
    expect(raw).not.toContain('pending');
    expect(raw).not.toContain('markless-native-pass');
  });

  test('RESULTS.md is exactly generated from verdict.json', async () => {
    const evidence = JSON.parse(await readFile(path.join(process.cwd(), 'results/verdict.json'), 'utf8')) as Evidence;
    const markdown = await readFile(path.join(process.cwd(), 'results/RESULTS.md'), 'utf8');
    expect(markdown).toBe(renderResults(evidence));
  });
});
