import { describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';
import { mutants } from '../../04-equivalence-oracle/src/mutants/index.ts';
import { reactAdapter } from '../src/adapters/react.ts';
import { solidAdapter } from '../src/adapters/solid.solid.ts';
import { compareRuns } from '../src/oracle/compare.ts';
import { runScenario } from '../src/oracle/run.ts';
import type { RunTrace } from '../src/oracle/types.ts';
import { emittedReact, emittedSolid, reactReferences, solidReferences } from '../src/parties.ts';
import { findingIds, renderResults, type Evidence, type Finding, type FindingId, type PairResult } from '../src/results.ts';
import { scenarioById, scenarios } from '../src/scenarios.ts';

const pairDefinitions = [
  ['emitted-react__handwritten-react', 'emitted-react', 'handwritten-react'],
  ['emitted-solid__handwritten-solid', 'emitted-solid', 'handwritten-solid'],
  ['emitted-react__handwritten-solid', 'emitted-react', 'handwritten-solid'],
  ['emitted-solid__handwritten-react', 'emitted-solid', 'handwritten-react'],
  ['emitted-react__emitted-solid', 'emitted-react', 'emitted-solid'],
] as const;

const marklessCounterparts = ['handwritten-react', 'handwritten-solid', 'emitted-react', 'emitted-solid'] as const;
const findings: Record<FindingId, Finding> = {
  '3': {
    id: '3',
    quote: 'root props',
    evidence: ['@markless/web packages/web/src/render.ts:71 calls component.renderCsr() with no props', 'CsrRenderArtifact advertises renderCsr(props?: unknown) at packages/web/src/render.ts:25'],
  },
  '5': {
    id: '5',
    quote: 'bare component at template root CSR-renders empty, silently',
    evidence: ['Markless packages/compiler/src/passes/public-render/template.ts:164-170', 'local minimal repro wrappers/s1-visible.app.tsrx (host-element workaround at lines 5-12)'],
  },
  '6': {
    id: '6',
    quote: 'aliased prop destructuring — `{ label: displayLabel }` — arrives undefined in child-component composition; plain destructuring works, c6c',
    evidence: ['Markless packages/compiler/src/passes/public-render/shared.ts:218-232 and :49-50', 'compile-only repro ../05-enriched-ir/src/fixtures/alias-coverage.tsrx'],
  },
  '7': {
    id: '7',
    quote: "multi-parameter callback props: lazy-symbol codegen references unbound parameters — 'payload is not defined' in wrapper callback symbol",
    evidence: ['src/wrappers/s1-visible.app.tsrx:10', 'src/wrappers/s2.app.tsrx:11', 'src/wrappers/s3.app.tsrx:8'],
  },
  '8': {
    id: '8',
    quote: 'prop-derived state in child components never wires into the runtime graph: S2 child handlers crash on null graph reads while mount DOM renders',
    evidence: ['src/fixtures/s2-keyed-todo.tsrx:4 (prop-derived state)', 'runtime repro dispatches in test/equivalence.browser.test.ts'],
  },
};

const representativeMutants = new Set(['wrong-text', 'omitted-callback', 'broken-key-identity', 'wrong-cancellation', 'duplicate-handler']);

describe('C9 integrated browser evidence', () => {
  test('all required pairs are equal and every representative mutant is rejected', async () => {
    const scenarioResults: Evidence['scenarios'] = {};
    for (const scenario of scenarios) {
      const traces: Record<string, RunTrace> = {
        'emitted-react': await runScenario(reactAdapter(emittedReact[scenario.id], 'arcade-emitted-react-18.3.1'), scenario),
        'emitted-solid': await runScenario(solidAdapter(emittedSolid[scenario.id], 'arcade-emitted-solid-1.8.22-fallback'), scenario),
        'handwritten-react': await runScenario(reactAdapter(reactReferences[scenario.id], 'handwritten-react-18.3.1'), scenario),
        'handwritten-solid': await runScenario(solidAdapter(solidReferences[scenario.id], 'handwritten-solid-1.8.22'), scenario),
      };
      const executablePairs = Object.fromEntries(pairDefinitions.map(([id, left, right]) => {
        const comparison = compareRuns(traces[left], traces[right]);
        return [id, { status: 'equal', ...comparison } as PairResult];
      }));
      const blockedPairs = Object.fromEntries(marklessCounterparts.map((counterpart) => {
        const partialEvidence = scenario.id === 'S1-render-once-locals' && counterpart.startsWith('handwritten-')
          ? {
              status: 'dom-only-partial' as const,
              channel: 'dom' as const,
              equal: true as const,
              against: counterpart as 'handwritten-react' | 'handwritten-solid',
              callbackChannel: 'blocked-by-upstream(#7)' as const,
              source: 'W-D1 adjudication 3: full DOM-channel pass observed before the callback-channel block',
            }
          : undefined;
        return [`markless__${counterpart}`, { status: 'blocked-by-upstream', findingIds: [...findingIds], ...(partialEvidence ? { partialEvidence } : {}) } as PairResult];
      }));
      scenarioResults[scenario.id] = { ...executablePairs, ...blockedPairs };
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
    const provablePairs = allPairs.filter((result) => result.status === 'equal');
    const blockedPairs = allPairs.filter((result) => result.status === 'blocked-by-upstream');
    const allMutants = Object.values(mutantRejections);
    const evidence: Evidence = {
      schema: 'arcade-c9-evidence/2',
      generatedBy: 'vitest browser / headless Chromium',
      environment: {
        execution: 'Vitest browser mode, headless Chromium; blocked Markless records are adjudicated upstream findings, not executed passes',
        vitest: '4.1.5',
        browserProvider: '@vitest/browser-playwright 4.1.5',
        playwright: '1.58.2 (locally cached Chromium)',
        vite: '8.0.16',
        markless: '@markless/web + compiler/core/bundler 0.1.1 vendored tarballs',
        react: '18.3.1',
        solid: '1.8.22 fallback',
        oracle: 'arcade-equivalence-oracle/1',
      },
      findings,
      scenarios: scenarioResults,
      mutantRejections,
      summary: {
        provablePairs: provablePairs.length,
        equalPairs: provablePairs.filter((result) => result.equal).length,
        blockedPairs: blockedPairs.length,
        domOnlyPartialPairs: blockedPairs.filter((result) => result.status === 'blocked-by-upstream' && result.partialEvidence).length,
        mutants: allMutants.length,
        rejectedMutants: allMutants.filter((result) => result.rejected).length,
        c9: provablePairs.every((result) => result.equal) && allMutants.every((result) => result.rejected) ? 'pass' : 'fail',
        marklessNativeLeg: 'blocked-by-upstream',
      },
    };

    // Persist before assertions so a legitimate contract divergence leaves a
    // precise machine-readable finding for adjudication instead of only a log.
    await server.commands.writeEvidence(JSON.stringify(evidence, null, 2), renderResults(evidence));

    for (const [scenario, pairs] of Object.entries(scenarioResults)) for (const [pair, result] of Object.entries(pairs)) {
      if (result.status === 'equal') expect(result, `${scenario}: ${pair}\n${JSON.stringify(result.divergences, null, 2)}`).toEqual({ status: 'equal', equal: true, divergences: [] });
    }
    for (const [id, result] of Object.entries(mutantRejections)) expect(result.rejected, `${id}: ${JSON.stringify(result.divergences, null, 2)}`).toBe(true);
    expect(evidence.summary).toEqual({ provablePairs: 15, equalPairs: 15, blockedPairs: 12, domOnlyPartialPairs: 2, mutants: 5, rejectedMutants: 5, c9: 'pass', marklessNativeLeg: 'blocked-by-upstream' });
  }, 30_000);
});
