import { describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';
import { mutants } from '../../04-equivalence-oracle/src/mutants/index.ts';
import { marklessAdapter, marklessFallbackAdapter, marklessTraceFallbackAdapter } from '../src/adapters/markless.ts';
import { reactAdapter } from '../src/adapters/react.ts';
import { solidAdapter } from '../src/adapters/solid.solid.ts';
import { compareRuns } from '../src/oracle/compare.ts';
import { runScenario } from '../src/oracle/run.ts';
import type { Adapter, RunTrace } from '../src/oracle/types.ts';
import { emittedReact, emittedSolid, markless, marklessFallbacks, marklessFinding6Fallback, reactReferences, solidReferences } from '../src/parties.ts';
import { renderResults, type Evidence, type Finding, type FindingId, type PairResult } from '../src/results.ts';
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
    evidence: ['Markless packages/compiler/src/passes/public-render/shared.ts:218-232 and :49-50', 'direct runtime probe src/fixtures/s1-render-once.tsrx', 'compile-only repro ../05-enriched-ir/src/fixtures/alias-coverage.tsrx'],
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

type MarklessExecution = { trace?: RunTrace; findingIds: FindingId[]; failure?: string; divergent?: boolean };

function failureText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  return String(error);
}

function classifyFailure(scenarioId: string, error: unknown): FindingId[] {
  const message = failureText(error);
  if (message.includes('#5-class') || /rendered no observable DOM|empty render/i.test(message)) return ['5'];
  if (/\b(?:name|payload|event) is not defined\b|onTrace is not defined/i.test(message)) return ['7'];
  if (scenarioId === 'S2-keyed-todo' && /Cannot read properties of null|graph.*null|null.*graph/i.test(message)) return ['8'];
  if (/displayLabel|aliased prop/i.test(message)) return ['6'];
  if (/Cannot read properties of undefined.*(?:map|label|multiplier|initial)|\bundefined\b.*(?:prop|seed)/i.test(message)) return ['3'];
  return [];
}

function callbackNames(trace: RunTrace): Set<string> {
  const final = trace.observations.at(-1);
  return new Set(final?.callbacks.map((record) => record.name) ?? []);
}

function classifyTrace(scenarioId: string, trace: RunTrace): FindingId[] {
  const serialized = JSON.stringify(trace);
  if (scenarioId === 'S1-render-once-locals' && serialized.includes('undefined:3')) return ['6'];
  if (scenarioId === 'S1-render-once-locals' && (!serialized.includes('Frameless:3') || serialized.includes('NaN'))) return ['3'];
  if (scenarioId === 'S2-keyed-todo' && (!serialized.includes('Alpha') || !serialized.includes('Beta'))) return ['3'];
  if (scenarioId === 'S3-event-form' && !serialized.includes('seed')) return ['3'];

  const names = callbackNames(trace);
  const expected = scenarioId === 'S1-render-once-locals'
    ? ['setup', 'change']
    : scenarioId === 'S2-keyed-todo'
      ? ['add', 'edit', 'toggle', 'reorder', 'remove', 'clear']
      : ['text', 'checked', 'submit', 'bubble'];
  return expected.every((name) => names.has(name)) ? [] : ['7'];
}

async function executeMarkless(scenario: (typeof scenarios)[number]): Promise<MarklessExecution> {
  let directTrace: RunTrace;
  let findingIds: FindingId[];
  try {
    directTrace = await runMarkless(marklessAdapter(markless[scenario.id]), scenario);
    findingIds = classifyTrace(scenario.id, directTrace);
    if (findingIds.length === 0) return { trace: directTrace, findingIds: [] };
  } catch (error) {
    findingIds = classifyFailure(scenario.id, error);
    if (findingIds.length === 0) return { findingIds: [], failure: failureText(error), divergent: true };
  }

  const fallback = findingIds.every((id) => id === '7')
    ? marklessTraceFallbackAdapter(markless[scenario.id])
    : findingIds.every((id) => id === '6')
      ? marklessAdapter(marklessFinding6Fallback)
    : findingIds.every((id) => id === '3' || id === '5')
      ? marklessFallbackAdapter(marklessFallbacks[scenario.id])
      : undefined;
  if (!fallback) return {
    findingIds,
    failure: `No behavior-preserving runtime workaround exists for diagnosed finding(s) #${findingIds.join(',#')}`,
  };

  // A diagnostic finding activates only its preserved workaround rung. The
  // verdict carries exactly the finding(s) which caused this fallback.
  try {
    return {
      trace: await runMarkless(fallback, scenario),
      findingIds,
    };
  } catch (error) {
    const fallbackFindings = classifyFailure(scenario.id, error);
    return {
      findingIds: [...new Set([...findingIds, ...fallbackFindings])],
      failure: failureText(error),
      divergent: fallbackFindings.length === 0,
    };
  }
}

function executionDivergence(failure: string) {
  return [{ channel: 'trace' as const, phase: 'execution', path: '$.markless', left: failure, right: 'completed scenario run' }];
}

async function runMarkless(adapter: Adapter<any>, scenario: (typeof scenarios)[number]): Promise<RunTrace> {
  const browserErrors: unknown[] = [];
  const onError = (event: ErrorEvent) => { browserErrors.push(event.error ?? event.message); event.preventDefault(); event.stopImmediatePropagation(); };
  const onRejection = (event: PromiseRejectionEvent) => { browserErrors.push(event.reason); event.preventDefault(); event.stopImmediatePropagation(); };
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection, true);
  let trace: RunTrace | undefined;
  let thrown: unknown;
  try {
    trace = await runScenario(adapter, scenario);
  } catch (error) {
    thrown = error;
  } finally {
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection, true);
  }
  const failures = [...(thrown === undefined ? [] : [thrown]), ...browserErrors];
  if (failures.length) throw new Error(failures.map(failureText).join('\n--- browser error ---\n'));
  return trace as RunTrace;
}

describe('C9 integrated browser evidence', () => {
  test('all required pairs are equal and every representative mutant is rejected', async () => {
    const scenarioResults: Evidence['scenarios'] = {};
    for (const scenario of scenarios) {
      const traces: Record<string, RunTrace> = {
        'emitted-react': await runScenario(reactAdapter(emittedReact[scenario.id], 'frameless-emitted-react-18.3.1'), scenario),
        'emitted-solid': await runScenario(solidAdapter(emittedSolid[scenario.id], 'frameless-emitted-solid-1.8.22-fallback'), scenario),
        'handwritten-react': await runScenario(reactAdapter(reactReferences[scenario.id], 'handwritten-react-18.3.1'), scenario),
        'handwritten-solid': await runScenario(solidAdapter(solidReferences[scenario.id], 'handwritten-solid-1.8.22'), scenario),
      };
      const marklessExecution = await executeMarkless(scenario);
      const executablePairs = Object.fromEntries(pairDefinitions.map(([id, left, right]) => {
        const comparison = compareRuns(traces[left], traces[right]);
        return [id, { status: 'equal', ...comparison } as PairResult];
      }));
      const marklessPairs = Object.fromEntries(marklessCounterparts.map((counterpart) => {
        if (!marklessExecution.trace) {
          if (marklessExecution.divergent) return [`markless__${counterpart}`, {
            status: 'divergent', equal: false, divergences: executionDivergence(marklessExecution.failure ?? 'unknown Markless execution failure'),
            ...(marklessExecution.findingIds.length ? { findingIds: marklessExecution.findingIds } : {}),
          } satisfies PairResult];
          if (marklessExecution.findingIds.length > 0) return [`markless__${counterpart}`, {
            status: 'blocked-by-upstream', findingIds: marklessExecution.findingIds, failure: marklessExecution.failure ?? 'attributed Markless execution failure',
          } satisfies PairResult];
          return [`markless__${counterpart}`, {
            status: 'divergent', equal: false, divergences: executionDivergence(marklessExecution.failure ?? 'unknown Markless execution failure'),
          } satisfies PairResult];
        }
        const comparison = compareRuns(marklessExecution.trace, traces[counterpart]);
        return [`markless__${counterpart}`, comparison.equal
          ? { status: 'equal', ...comparison, ...(marklessExecution.findingIds.length ? { findingIds: marklessExecution.findingIds } : {}) }
          : { status: 'divergent', ...comparison, ...(marklessExecution.findingIds.length ? { findingIds: marklessExecution.findingIds } : {}) }] as const;
      }));
      scenarioResults[scenario.id] = { ...executablePairs, ...marklessPairs };
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
    const sanctionedPairs = Object.values(scenarioResults).flatMap((pairs) => pairDefinitions.map(([id]) => pairs[id]));
    const equalPairs = allPairs.filter((result) => result.status === 'equal');
    const divergentPairs = allPairs.filter((result) => result.status === 'divergent');
    const blockedPairs = allPairs.filter((result) => result.status === 'blocked-by-upstream');
    const marklessPairs = Object.values(scenarioResults).flatMap((pairs) => Object.entries(pairs).filter(([id]) => id.startsWith('markless__')).map(([, result]) => result));
    const stillPresent = [...new Set(marklessPairs.flatMap((result) => result.findingIds ?? []))].sort();
    const marklessNativeLeg = marklessPairs.every((result) => result.status === 'equal')
      ? stillPresent.length === 0 ? 'pass' as const : `partial(#${stillPresent.join(',#')})` as const
      : 'blocked' as const;
    const allMutants = Object.values(mutantRejections);
    const evidence: Evidence = {
      schema: 'frameless-c9-evidence/3',
      generatedBy: 'vitest browser / headless Chromium',
      environment: {
        execution: 'Vitest browser mode, headless Chromium; all 12 Markless pairs are live direct-first comparisons with attributed fallbacks only',
        vitest: '4.1.5',
        browserProvider: '@vitest/browser-playwright 4.1.5',
        playwright: '1.58.2 (locally cached Chromium)',
        vite: '8.0.16',
        markless: '@markless/web + compiler/core/bundler 0.1.1 vendored tarballs; built from local markless-frameless-fixes worktree @ 5e5a100',
        'marklessTarballSha256.bundler': '301b5d6bcf2bd30b527b3836c0a6949681c7a60ccb83be5abb75569548a3e93d',
        'marklessTarballSha256.compiler': '59e4fb0bf6b7f4edd9312f0355535e22b1b1ceeb071da9617628d55df6dc5848',
        'marklessTarballSha256.core': '2e957f84d54d8bb2383455be7250ea71b6d9436ff455a657a2376cf9ccf99c97',
        'marklessTarballSha256.router': '841739095013d31da3ec4adfeb3a84e9876b35116e6c05ff8c784985fc7ae573',
        'marklessTarballSha256.runtime': '3c1c5ba9e1e024391539ca9d9325ad631882a9d2817f09f77019e268fe9e4ed8',
        'marklessTarballSha256.serializer': '274d12df07964fc6821b71694ace652dee157d15fae4ff573e0cb78762a9a893',
        'marklessTarballSha256.web': '5fdb1817dffcabad3690102b6d202e696c307060d9cd17f4ac6d134194258c8c',
        react: '18.3.1',
        solid: '1.8.22 fallback',
        oracle: 'frameless-equivalence-oracle/1',
      },
      findings,
      scenarios: scenarioResults,
      mutantRejections,
      summary: {
        provablePairs: sanctionedPairs.length,
        equalPairs: equalPairs.length,
        divergentPairs: divergentPairs.length,
        blockedPairs: blockedPairs.length,
        mutants: allMutants.length,
        rejectedMutants: allMutants.filter((result) => result.rejected).length,
        c9: sanctionedPairs.every((result) => result.status === 'equal' && result.equal) && allMutants.every((result) => result.rejected) ? 'pass' : 'fail',
        marklessNativeLeg,
      },
    };

    // Persist before assertions so a legitimate contract divergence leaves a
    // precise machine-readable finding for adjudication instead of only a log.
    await server.commands.writeEvidence(JSON.stringify(evidence, null, 2), renderResults(evidence));

    for (const [scenario, pairs] of Object.entries(scenarioResults)) for (const [pair, result] of Object.entries(pairs)) {
      if (!pair.startsWith('markless__')) expect(result, `${scenario}: ${pair}\n${JSON.stringify('divergences' in result ? result.divergences : result, null, 2)}`).toEqual({ status: 'equal', equal: true, divergences: [] });
      else {
        expect(result.status === 'equal' || (result.findingIds?.length ?? 0) > 0, `${scenario}: ${pair} is an unattributed failure\n${JSON.stringify(result, null, 2)}`).toBe(true);
        expect(result.status, `${scenario}: ${pair}\n${JSON.stringify(result, null, 2)}`).not.toBe('divergent');
      }
    }
    for (const [id, result] of Object.entries(mutantRejections)) expect(result.rejected, `${id}: ${JSON.stringify(result.divergences, null, 2)}`).toBe(true);
    expect(evidence.summary.provablePairs).toBe(15);
    expect(evidence.summary.mutants).toBe(5);
    expect(evidence.summary.rejectedMutants).toBe(5);
    expect(evidence.summary.c9).toBe('pass');
  }, 30_000);
});
