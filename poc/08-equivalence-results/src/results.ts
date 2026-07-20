import type { Divergence } from './oracle/types.ts';

export const findingIds = ['3', '5', '6', '7', '8'] as const;
export type FindingId = (typeof findingIds)[number];

export type Finding = {
  id: FindingId;
  quote: string;
  evidence: string[];
};

export type EqualPairResult = {
  status: 'equal';
  equal: true;
  divergences: Divergence[];
  findingIds?: FindingId[];
};

export type DivergentPairResult = {
  status: 'divergent';
  equal: false;
  divergences: Divergence[];
  findingIds?: FindingId[];
};

export type BlockedPairResult = {
  status: 'blocked-by-upstream';
  findingIds: FindingId[];
  failure: string;
};

export type PairResult = EqualPairResult | DivergentPairResult | BlockedPairResult;
export type MutantResult = { scenario: string; expectedChannel: string; rejected: boolean; observedChannels: string[]; divergences: Divergence[] };
export type Evidence = {
  schema: 'frameless-c9-evidence/3'; generatedBy: string; environment: Record<string, string>;
  findings: Record<FindingId, Finding>;
  scenarios: Record<string, Record<string, PairResult>>; mutantRejections: Record<string, MutantResult>;
  summary: {
    provablePairs: number; equalPairs: number; divergentPairs: number; blockedPairs: number;
    mutants: number; rejectedMutants: number; c9: 'pass' | 'fail'; marklessNativeLeg: 'pass' | `partial(#${string})` | 'blocked';
  };
};

function pairVerdict(result: PairResult): string {
  const findings = result.findingIds?.length ? `; still-present(#${result.findingIds.join(',#')})` : '';
  if (result.status === 'equal') return `equal${findings}`;
  if (result.status === 'divergent') return `divergent${findings}`;
  return `blocked-by-upstream(#${result.findingIds.join(',#')})`;
}

export function renderResults(evidence: Evidence): string {
  const lines = [
    '# C9 equivalence results', '',
    '> Machine-generated from `verdict.json` by the Chromium comparison suite. Do not edit by hand.', '',
    `C9 verdict: **${evidence.summary.c9.toUpperCase()}** for the sanctioned emitted/handwritten scope.`,
    `Markless-native leg: **${evidence.summary.marklessNativeLeg}**.`, '',
    '## Scenario × pair verdicts', '',
    '| Scenario | Pair | Verdict |', '| --- | --- | --- |',
  ];
  for (const [scenario, pairs] of Object.entries(evidence.scenarios)) {
    for (const [pair, result] of Object.entries(pairs)) lines.push(`| ${scenario} | ${pair} | ${pairVerdict(result)} |`);
  }
  lines.push('', '## Upstream finding registry', '');
  for (const finding of Object.values(evidence.findings)) {
    lines.push(`- **#${finding.id}:** “${finding.quote}” Evidence: ${finding.evidence.join('; ')}.`);
  }
  lines.push('', '## Oracle integrity', '', '| Mutant | Expected channel | Rejected | Observed channels |', '| --- | --- | ---: | --- |');
  for (const [id, result] of Object.entries(evidence.mutantRejections)) lines.push(`| ${id} | ${result.expectedChannel} | ${result.rejected ? 'yes' : 'no'} | ${result.observedChannels.join(', ')} |`);
  lines.push('', '## Environment', '', '| Item | Version/mode |', '| --- | --- |');
  for (const [item, value] of Object.entries(evidence.environment)) lines.push(`| ${item} | ${value} |`);
  return `${lines.join('\n')}\n`;
}
