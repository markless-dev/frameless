import {
	createVerdictReport,
	type AnalyzerInvariantResult,
	type AnalyzerVerdictReportV2,
} from '@markless/analyzer';
import type { Divergence } from './types.ts';

export const RECEIPT_SCHEMA_VERSION = 'frameless-receipts/1' as const;
export const EQUIVALENCE_INVARIANT_ID = 'MLA-EXT-FRAMELESS-EQUIVALENCE' as const;
export const MUTANT_INVARIANT_ID = 'MLA-EXT-FRAMELESS-MUTANT' as const;

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

export type ReceiptSummary = {
	verdict: 'pass' | 'fail' | 'blocked-by-upstream';
	equalPairs: number;
	differentPairs: number;
	blockedPairs: number;
	mutants: number;
	rejectedMutants: number;
};

export type Receipt = {
	schema: typeof RECEIPT_SCHEMA_VERSION;
	generatedBy: string;
	environment: Record<string, string>;
	findings: Record<string, Finding>;
	scenarios: Record<string, Record<string, PairResult>>;
	mutantRejections: Record<string, MutantResult>;
	summary: ReceiptSummary;
};

type ReceiptResults = Pick<Receipt, 'scenarios' | 'mutantRejections'>;

export function createEquivalenceInvariantResult(
	scenario: string,
	pair: string,
	result: PairResult,
): AnalyzerInvariantResult {
	const details = [`scenario: ${scenario}`, `pair: ${pair}`, `verdict: ${pairVerdict(result)}`];
	if (result.status === 'different') {
		details.push(
			...result.divergences.map(
				(divergence) => `${divergence.channel}:${divergence.phase}:${divergence.path}`,
			),
		);
	}
	return {
		id: EQUIVALENCE_INVARIANT_ID,
		status:
			result.status === 'equal' ? 'pass' : result.status === 'different' ? 'fail' : 'not-run',
		details,
	};
}

function createMutantInvariantResult(id: string, result: MutantResult): AnalyzerInvariantResult {
	return {
		id: MUTANT_INVARIANT_ID,
		status: result.rejected ? 'pass' : 'fail',
		details: [
			`mutant: ${id}`,
			`scenario: ${result.scenario}`,
			`expected channel: ${result.expectedChannel}`,
			`observed channels: ${result.observedChannels.join(', ')}`,
		],
	};
}

function invariantResults(receipt: ReceiptResults): AnalyzerInvariantResult[] {
	const results: AnalyzerInvariantResult[] = [];
	for (const [scenario, pairs] of Object.entries(receipt.scenarios)) {
		for (const [pair, result] of Object.entries(pairs)) {
			results.push(createEquivalenceInvariantResult(scenario, pair, result));
		}
	}
	for (const [id, result] of Object.entries(receipt.mutantRejections)) {
		results.push(createMutantInvariantResult(id, result));
	}
	return results;
}

export function createReceiptVerdictReport(
	receipt: ReceiptResults & Pick<Receipt, 'schema' | 'generatedBy' | 'environment'>,
): AnalyzerVerdictReportV2 {
	return createVerdictReport({
		source: receipt.generatedBy,
		lane: 'frameless-equivalence',
		results: invariantResults(receipt),
		metadata: { receiptSchema: receipt.schema, environment: receipt.environment },
	});
}

export function createReceiptSummary(receipt: ReceiptResults): ReceiptSummary {
	const pairs = Object.values(receipt.scenarios).flatMap((scenario) => Object.values(scenario));
	const results = invariantResults(receipt);
	const report = createVerdictReport({
		source: '@frameless/analyzer',
		lane: 'frameless-equivalence',
		results,
	});
	const blockedPairs = pairs.filter((pair) => pair.status === 'blocked-by-upstream').length;
	return {
		verdict: !report.passed ? 'fail' : blockedPairs ? 'blocked-by-upstream' : 'pass',
		equalPairs: pairs.filter((pair) => pair.status === 'equal').length,
		differentPairs: pairs.filter((pair) => pair.status === 'different').length,
		blockedPairs,
		mutants: Object.keys(receipt.mutantRejections).length,
		rejectedMutants: Object.values(receipt.mutantRejections).filter((result) => result.rejected)
			.length,
	};
}

function summariesEqual(left: ReceiptSummary, right: ReceiptSummary): boolean {
	return (
		left.verdict === right.verdict &&
		left.equalPairs === right.equalPairs &&
		left.differentPairs === right.differentPairs &&
		left.blockedPairs === right.blockedPairs &&
		left.mutants === right.mutants &&
		left.rejectedMutants === right.rejectedMutants
	);
}

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
	if (
		!isRecord(receipt.findings) ||
		!isRecord(receipt.scenarios) ||
		!Object.values(receipt.scenarios).every(
			(pairs) =>
				isRecord(pairs) &&
				Object.values(pairs).every((pair) => validatePairResult(pair, receipt.findings!)),
		)
	)
		return false;
	try {
		createReceiptVerdictReport(receipt as Receipt);
		return summariesEqual(receipt.summary, createReceiptSummary(receipt as Receipt));
	} catch {
		return false;
	}
}

function validatePairResult(value: unknown, findings: Record<string, unknown>): boolean {
	if (!isRecord(value)) return false;
	if (value.status === 'equal') {
		return (
			hasExactKeys(value, ['status', 'equal', 'divergences']) &&
			value.equal === true &&
			Array.isArray(value.divergences) &&
			value.divergences.length === 0
		);
	}
	if (value.status === 'different') {
		return (
			hasExactKeys(value, ['status', 'equal', 'divergences']) &&
			value.equal === false &&
			Array.isArray(value.divergences) &&
			value.divergences.length > 0
		);
	}
	if (value.status === 'blocked-by-upstream') {
		if (
			!hasExactKeys(
				value,
				['status', 'findingIds'],
				['status', 'findingIds', 'partialEvidence'],
			) ||
			!Array.isArray(value.findingIds) ||
			value.findingIds.length === 0 ||
			!value.findingIds.every(
				(id) => typeof id === 'string' && id.length > 0 && Object.hasOwn(findings, id),
			)
		) {
			return false;
		}
		if (!Object.hasOwn(value, 'partialEvidence')) return true;
		return (
			isRecord(value.partialEvidence) &&
			hasExactKeys(value.partialEvidence, ['status', 'summary']) &&
			typeof value.partialEvidence.status === 'string' &&
			typeof value.partialEvidence.summary === 'string'
		);
	}
	return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(
	value: Record<string, unknown>,
	required: readonly string[],
	allowed: readonly string[] = required,
): boolean {
	return (
		required.every((key) => Object.hasOwn(value, key)) &&
		Object.getOwnPropertyNames(value).every((key) => allowed.includes(key)) &&
		Object.getOwnPropertySymbols(value).length === 0
	);
}

function pairVerdict(result: PairResult): string {
	if (result.status === 'equal') return 'equal';
	if (result.status === 'different') return 'different';
	const findingSuffix = result.findingIds.length ? `(#${result.findingIds.join(',#')})` : '';
	return `blocked-by-upstream${findingSuffix}${result.partialEvidence ? '; partial-evidence' : ''}`;
}

export function renderResults(receipt: Receipt): string {
	const report = createReceiptVerdictReport(receipt);
	const blocked = report.results.some((result) => result.status === 'not-run');
	const verdict = !report.passed ? 'fail' : blocked ? 'blocked-by-upstream' : 'pass';
	const lines = [
		'# Frameless equivalence results',
		'',
		'> Machine-generated from the frameless-receipts/1 verdict artifact. Do not edit by hand.',
		'',
		`Overall verdict: **${verdict.toUpperCase()}**.`,
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
		'## Analyzer integrity',
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
