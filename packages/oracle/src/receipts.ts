import type { Divergence } from './types.ts';

export const RECEIPT_SCHEMA_VERSION = 'frameless-receipts/1' as const;

export type Finding = { id: string; summary: string; evidence: string[] };
export type EqualPairResult = { status: 'equal'; equal: true; divergences: [] };
export type DifferentPairResult = {
	status: 'different';
	equal: false;
	divergences: Divergence[];
};
export type BlockedPairResult = {
	status: 'blocked-by-upstream';
	findingIds: string[];
	partialEvidence?: { status: string; summary: string };
};
export type PairResult = EqualPairResult | DifferentPairResult | BlockedPairResult;
export type MutantResult = {
	scenario: string;
	expectedChannel: string;
	rejected: boolean;
	observedChannels: string[];
	divergences: Divergence[];
};

export type Receipt = {
	schema: typeof RECEIPT_SCHEMA_VERSION;
	generatedBy: string;
	environment: Record<string, string>;
	findings: Record<string, Finding>;
	scenarios: Record<string, Record<string, PairResult>>;
	mutantRejections: Record<string, MutantResult>;
	summary: {
		verdict: 'pass' | 'fail' | 'blocked-by-upstream';
		equalPairs: number;
		differentPairs: number;
		blockedPairs: number;
		mutants: number;
		rejectedMutants: number;
	};
};

export function validateReceipt(value: unknown): value is Receipt {
	if (!value || typeof value !== 'object') return false;
	const receipt = value as Partial<Receipt>;
	if (
		receipt.schema !== RECEIPT_SCHEMA_VERSION ||
		typeof receipt.generatedBy !== 'string' ||
		!receipt.environment ||
		!receipt.findings ||
		!receipt.scenarios ||
		!receipt.mutantRejections ||
		!receipt.summary
	) {
		return false;
	}
	const allowed = new Set(['equal', 'different', 'blocked-by-upstream']);
	return Object.values(receipt.scenarios).every((pairs) =>
		Object.values(pairs).every((pair) => allowed.has(pair.status)),
	);
}

function pairVerdict(result: PairResult): string {
	if (result.status === 'equal') return 'equal';
	if (result.status === 'different') return 'different';
	const findingSuffix = result.findingIds.length ? `(#${result.findingIds.join(',#')})` : '';
	return `blocked-by-upstream${findingSuffix}${result.partialEvidence ? '; partial-evidence' : ''}`;
}

export function renderResults(receipt: Receipt): string {
	const lines = [
		'# Frameless equivalence results',
		'',
		'> Machine-generated from the frameless-receipts/1 verdict artifact. Do not edit by hand.',
		'',
		`Overall verdict: **${receipt.summary.verdict.toUpperCase()}**.`,
		'',
		'## Scenario × pair verdicts',
		'',
		'| Scenario | Pair | Verdict |',
		'| --- | --- | --- |',
	];
	for (const [scenario, pairs] of Object.entries(receipt.scenarios)) {
		for (const [pair, result] of Object.entries(pairs)) {
			lines.push(`| ${scenario} | ${pair} | ${pairVerdict(result)} |`);
		}
	}
	lines.push('', '## Findings', '');
	const findings = Object.values(receipt.findings);
	if (!findings.length) lines.push('None.');
	for (const finding of findings) {
		lines.push(
			`- **#${finding.id}:** ${finding.summary} Evidence: ${finding.evidence.join('; ')}.`,
		);
	}
	lines.push(
		'',
		'## Oracle integrity',
		'',
		'| Mutant | Expected channel | Rejected | Observed channels |',
		'| --- | --- | ---: | --- |',
	);
	for (const [id, result] of Object.entries(receipt.mutantRejections)) {
		lines.push(
			`| ${id} | ${result.expectedChannel} | ${result.rejected ? 'yes' : 'no'} | ${result.observedChannels.join(', ')} |`,
		);
	}
	lines.push('', '## Environment', '', '| Item | Version/mode |', '| --- | --- |');
	for (const [item, version] of Object.entries(receipt.environment)) {
		lines.push(`| ${item} | ${version} |`);
	}
	return `${lines.join('\n')}\n`;
}
