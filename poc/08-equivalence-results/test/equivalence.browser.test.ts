import { describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';
import { mutants } from '../../04-equivalence-oracle/src/mutants/index.ts';
import { marklessAdapter } from '../src/adapters/markless.ts';
import { reactAdapter } from '../src/adapters/react.ts';
import { solidAdapter } from '../src/adapters/solid.solid.ts';
import { compareRuns } from '../src/oracle/compare.ts';
import { runScenario } from '../src/oracle/run.ts';
import type { RunTrace } from '../src/oracle/types.ts';
import { emittedReact, emittedSolid, markless, reactReferences, solidReferences } from '../src/parties.ts';
import { renderResults, type Evidence, type PairResult } from '../src/results.ts';
import { scenarioById, scenarios } from '../src/scenarios.ts';

const pairDefinitions = [
  ['emitted-react__handwritten-react', 'emitted-react', 'handwritten-react'],
  ['emitted-solid__handwritten-solid', 'emitted-solid', 'handwritten-solid'],
  ['emitted-react__handwritten-solid', 'emitted-react', 'handwritten-solid'],
  ['emitted-solid__handwritten-react', 'emitted-solid', 'handwritten-react'],
  ['emitted-react__emitted-solid', 'emitted-react', 'emitted-solid'],
  ['markless__handwritten-react', 'markless', 'handwritten-react'],
  ['markless__emitted-react', 'markless', 'emitted-react'],
  ['markless__emitted-solid', 'markless', 'emitted-solid'],
] as const;

const representativeMutants = new Set(['wrong-text', 'omitted-callback', 'broken-key-identity', 'wrong-cancellation', 'duplicate-handler']);

describe('C9 integrated browser evidence', () => {
  test('all required pairs are equal and every representative mutant is rejected', async () => {
    const scenarioResults: Evidence['scenarios'] = {};
    for (const scenario of scenarios) {
      const traces: Record<string, RunTrace> = {
        markless: await runScenario(marklessAdapter(markless[scenario.id]), scenario),
        'emitted-react': await runScenario(reactAdapter(emittedReact[scenario.id], 'arcade-emitted-react-18.3.1'), scenario),
        'emitted-solid': await runScenario(solidAdapter(emittedSolid[scenario.id], 'arcade-emitted-solid-1.8.22-fallback'), scenario),
        'handwritten-react': await runScenario(reactAdapter(reactReferences[scenario.id], 'handwritten-react-18.3.1'), scenario),
        'handwritten-solid': await runScenario(solidAdapter(solidReferences[scenario.id], 'handwritten-solid-1.8.22'), scenario),
      };
      scenarioResults[scenario.id] = Object.fromEntries(pairDefinitions.map(([id, left, right]) => [id, compareRuns(traces[left], traces[right]) as PairResult]));
    }

    const mutantRejections: Evidence['mutantRejections'] = {};
    for (const mutant of mutants.filter((candidate) => representativeMutants.has(candidate.id))) {
      const scenario = scenarioById[mutant.scenario];
      const clean = await runScenario(reactAdapter(reactReferences[mutant.scenario], 'handwritten-react-18.3.1'), scenario);
      const broken = await runScenario(reactAdapter(mutant.component, `mutant-${mutant.id}`), scenario);
      const verdict = compareRuns(clean, broken);
      mutantRejections[mutant.id] = {
        scenario: mutant.scenario,
        expectedChannel: mutant.channel,
        rejected: !verdict.equal && verdict.divergences.some((divergence) => divergence.channel === mutant.channel),
        observedChannels: [...new Set(verdict.divergences.map((divergence) => divergence.channel))].sort(),
        divergences: verdict.divergences,
      };
    }

    const allPairs = Object.values(scenarioResults).flatMap((pairs) => Object.values(pairs));
    const allMutants = Object.values(mutantRejections);
    const evidence: Evidence = {
      schema: 'arcade-c9-evidence/1',
      generatedBy: 'vitest browser / headless Chromium',
      environment: {
        execution: 'one environment: Vitest browser mode, headless Chromium',
        vitest: '4.1.5',
        browserProvider: '@vitest/browser-playwright 4.1.5',
        playwright: '1.58.2 (locally cached Chromium)',
        vite: '8.0.16',
        markless: '@markless/web + compiler/core/bundler 0.1.1 vendored tarballs',
        react: '18.3.1',
        solid: '1.8.22 fallback',
        oracle: 'arcade-equivalence-oracle/1',
      },
      scenarios: scenarioResults,
      mutantRejections,
      summary: {
        requiredPairs: allPairs.length,
        equalPairs: allPairs.filter((result) => result.equal).length,
        mutants: allMutants.length,
        rejectedMutants: allMutants.filter((result) => result.rejected).length,
        c9: allPairs.every((result) => result.equal) && allMutants.every((result) => result.rejected) ? 'pass' : 'fail',
      },
    };

    // Persist before assertions so a legitimate contract divergence leaves a
    // precise machine-readable finding for adjudication instead of only a log.
    await server.commands.writeEvidence(JSON.stringify(evidence, null, 2), renderResults(evidence));

    for (const [scenario, pairs] of Object.entries(scenarioResults)) for (const [pair, result] of Object.entries(pairs)) {
      expect(result, `${scenario}: ${pair}\n${JSON.stringify(result.divergences, null, 2)}`).toEqual({ equal: true, divergences: [] });
    }
    for (const [id, result] of Object.entries(mutantRejections)) expect(result.rejected, `${id}: ${JSON.stringify(result.divergences, null, 2)}`).toBe(true);
    expect(evidence.summary).toEqual({ requiredPairs: 24, equalPairs: 24, mutants: 5, rejectedMutants: 5, c9: 'pass' });
  }, 30_000);
});
