import type { Divergence } from './oracle/types.ts';

export type PairResult = { equal: boolean; divergences: Divergence[] };
export type MutantResult = { scenario: string; expectedChannel: string; rejected: boolean; observedChannels: string[]; divergences: Divergence[] };
export type Evidence = {
  schema: 'arcade-c9-evidence/1'; generatedBy: string; environment: Record<string, string>;
  scenarios: Record<string, Record<string, PairResult>>; mutantRejections: Record<string, MutantResult>;
  summary: { requiredPairs: number; equalPairs: number; mutants: number; rejectedMutants: number; c9: 'pass' | 'fail' };
};

export function renderResults(evidence: Evidence): string {
  const lines = ['# C9 equivalence results', '', '> Machine-generated from `verdict.json` by the Chromium comparison suite. Do not edit by hand.', '', `Verdict: **${evidence.summary.c9.toUpperCase()}**`, '', '## Required comparisons', '', '| Scenario | Pair | Equal | Divergences |', '| --- | --- | ---: | ---: |'];
  for (const [scenario, pairs] of Object.entries(evidence.scenarios)) for (const [pair, result] of Object.entries(pairs)) lines.push(`| ${scenario} | ${pair} | ${result.equal ? 'yes' : 'no'} | ${result.divergences.length} |`);
  lines.push('', '## Oracle integrity', '', '| Mutant | Expected channel | Rejected | Observed channels |', '| --- | --- | ---: | --- |');
  for (const [id, result] of Object.entries(evidence.mutantRejections)) lines.push(`| ${id} | ${result.expectedChannel} | ${result.rejected ? 'yes' : 'no'} | ${result.observedChannels.join(', ')} |`);
  lines.push('', '## Environment', '', '| Item | Version/mode |', '| --- | --- |');
  for (const [item, value] of Object.entries(evidence.environment)) lines.push(`| ${item} | ${value} |`);
  return `${lines.join('\n')}\n`;
}
