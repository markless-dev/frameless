import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { renderResults, type Evidence } from '../src/results.ts';

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
  test('records every sanctioned pair and never silently skips a Markless pair', async () => {
    const evidence = JSON.parse(await readFile(path.join(process.cwd(), 'results/verdict.json'), 'utf8')) as Evidence | { schema: 'frameless-c9-evidence/2'; scenarios: Evidence['scenarios'] };
    expect(['frameless-c9-evidence/2', 'frameless-c9-evidence/3']).toContain(evidence.schema);
    expect(Object.keys(evidence.scenarios).sort()).toEqual([...scenarios].sort());
    for (const scenario of scenarios) {
      expect(Object.keys(evidence.scenarios[scenario]).sort()).toEqual([...provablePairs, ...marklessPairs].sort());
      for (const pair of provablePairs) expect(evidence.scenarios[scenario][pair]).toEqual({ status: 'equal', equal: true, divergences: [] });
      for (const pair of marklessPairs) {
        const result = evidence.scenarios[scenario][pair];
        expect(['equal', 'divergent', 'blocked-by-upstream'], `${scenario}: ${pair} must not be silently skipped`).toContain(result.status);
        if (result.status !== 'equal') expect(result.findingIds?.length ?? 0, `${scenario}: ${pair} must attribute every failure`).toBeGreaterThan(0);
      }
    }
  });

  test('contains no pending Markless record', async () => {
    const raw = await readFile(path.join(process.cwd(), 'results/verdict.json'), 'utf8');
    expect(raw).not.toContain('pending');
  });

  test('RESULTS.md is exactly generated from verdict.json', async () => {
    const evidence = JSON.parse(await readFile(path.join(process.cwd(), 'results/verdict.json'), 'utf8')) as Evidence;
    if (evidence.schema !== 'frameless-c9-evidence/3') return;
    const markdown = await readFile(path.join(process.cwd(), 'results/RESULTS.md'), 'utf8');
    expect(markdown).toBe(renderResults(evidence));
  });
});
