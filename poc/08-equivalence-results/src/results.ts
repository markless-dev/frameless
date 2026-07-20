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
};

export type BlockedPairResult = {
  status: 'blocked-by-upstream';
  findingIds: FindingId[];
  partialEvidence?: {
    status: 'dom-only-partial';
    channel: 'dom';
    equal: true;
    against: 'handwritten-react' | 'handwritten-solid';
    callbackChannel: 'blocked-by-upstream(#7)';
    source: string;
  };
};

export type PairResult = EqualPairResult | BlockedPairResult;
export type MutantResult = { scenario: string; expectedChannel: string; rejected: boolean; observedChannels: string[]; divergences: Divergence[] };
export type Evidence = {
  schema: 'frameless-c9-evidence/2'; generatedBy: string; environment: Record<string, string>;
  findings: Record<FindingId, Finding>;
  scenarios: Record<string, Record<string, PairResult>>; mutantRejections: Record<string, MutantResult>;
  summary: {
    provablePairs: number; equalPairs: number; blockedPairs: number; domOnlyPartialPairs: number;
    mutants: number; rejectedMutants: number; c9: 'pass' | 'fail'; marklessNativeLeg: 'blocked-by-upstream';
  };
};

function pairVerdict(result: PairResult): string {
  if (result.status === 'equal') return 'equal';
  const blocked = `blocked-by-upstream(#${result.findingIds.join(',#')})`;
  return result.partialEvidence ? `${blocked}; dom-only-partial` : blocked;
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
  lines.push('', '## Upstream findings carried by every blocked Markless pair', '');
  for (const finding of Object.values(evidence.findings)) {
    lines.push(`- **#${finding.id}:** “${finding.quote}” Evidence: ${finding.evidence.join('; ')}.`);
  }
  lines.push('', '## Oracle integrity', '', '| Mutant | Expected channel | Rejected | Observed channels |', '| --- | --- | ---: | --- |');
  for (const [id, result] of Object.entries(evidence.mutantRejections)) lines.push(`| ${id} | ${result.expectedChannel} | ${result.rejected ? 'yes' : 'no'} | ${result.observedChannels.join(', ')} |`);
  lines.push('', '## Environment', '', '| Item | Version/mode |', '| --- | --- |');
  for (const [item, value] of Object.entries(evidence.environment)) lines.push(`| ${item} | ${value} |`);
  return `${lines.join('\n')}\n`;
}
