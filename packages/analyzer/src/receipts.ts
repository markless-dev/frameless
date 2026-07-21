import {
	createVerdictReport,
	type AnalyzerInvariantResult,
	type AnalyzerVerdictReportV2,
} from '@markless/analyzer';
import { assertValidExpectation } from './expectations.ts';
import type { Divergence, ExpectationResult } from './types.ts';

export const RECEIPT_SCHEMA_VERSION = 'frameless-receipts/1' as const;
export const EQUIVALENCE_INVARIANT_ID = 'MLA-EXT-FRAMELESS-EQUIVALENCE' as const;
export const MUTANT_INVARIANT_ID = 'MLA-EXT-FRAMELESS-MUTANT' as const;
export const EXPECTATION_INVARIANT_ID = 'MLA-EXT-FRAMELESS-EXPECTATION' as const;

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
	expectationResults?: Record<string, Record<string, ExpectationResult[]>>;
	summary: ReceiptSummary;
};

type ReceiptResults = Pick<Receipt, 'scenarios' | 'mutantRejections' | 'expectationResults'>;

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

function createExpectationInvariantResult(
	scenario: string,
	framework: string,
	result: ExpectationResult,
): AnalyzerInvariantResult {
	return {
		id: EXPECTATION_INVARIANT_ID,
		status: result.outcome === 'pass' ? 'pass' : 'fail',
		details: [
			`scenario: ${scenario}`,
			`framework: ${framework}`,
			`expectation: ${result.expectation.kind}`,
			`phase: ${result.phase}`,
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
	for (const [scenario, frameworks] of Object.entries(receipt.expectationResults ?? {})) {
		for (const [framework, expectationResults] of Object.entries(frameworks)) {
			for (const result of expectationResults) {
				results.push(createExpectationInvariantResult(scenario, framework, result));
			}
		}
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
	if (!isRecord(value)) return false;
	if (
		!hasExactKeys(
			value,
			[
				'schema',
				'generatedBy',
				'environment',
				'findings',
				'scenarios',
				'mutantRejections',
				'summary',
			],
			[
				'schema',
				'generatedBy',
				'environment',
				'findings',
				'scenarios',
				'mutantRejections',
				'expectationResults',
				'summary',
			],
		)
	)
		return false;
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
	if (
		Object.hasOwn(receipt, 'expectationResults') &&
		!validateExpectationResults(receipt.expectationResults)
	)
		return false;
	try {
		createReceiptVerdictReport(receipt as Receipt);
		return summariesEqual(receipt.summary, createReceiptSummary(receipt as Receipt));
	} catch {
		return false;
	}
}

function validateExpectationResults(value: unknown): boolean {
	return (
		isRecord(value) &&
		Object.values(value).every(
			(frameworks) =>
				isRecord(frameworks) &&
				Object.values(frameworks).every(
					(results) => Array.isArray(results) && results.every(validateExpectationResult),
				),
		)
	);
}

function validateExpectationResult(value: unknown): value is ExpectationResult {
	if (!isRecord(value) || !isRecord(value.expectation)) return false;
	try {
		assertValidExpectation(value.expectation);
	} catch {
		return false;
	}
	if (value.phase !== value.expectation.phase) return false;
	if (value.outcome === 'pass') {
		return hasExactKeys(value, ['expectation', 'phase', 'outcome']);
	}
	if (
		value.outcome !== 'fail' ||
		!hasExactKeys(value, ['expectation', 'phase', 'outcome', 'observed'])
	)
		return false;
	if (value.expectation.kind === 'dom-text') {
		return value.observed === null || typeof value.observed === 'string';
	}
	if (value.expectation.kind === 'dom-present') {
		return Number.isInteger(value.observed) && (value.observed as number) >= 0;
	}
	if (value.expectation.kind === 'dom-path') {
		return (
			value.observed === null ||
			(Array.isArray(value.observed) &&
				value.observed.every(
					(tag) => typeof tag === 'string' && /^[a-z][a-z0-9-]*$/.test(tag),
				))
		);
	}
	return (
		isRecord(value.observed) &&
		hasExactKeys(value.observed, ['focused', 'selection']) &&
		typeof value.observed.focused === 'boolean' &&
		(value.observed.selection === null ||
			(Array.isArray(value.observed.selection) &&
				value.observed.selection.length === 2 &&
				value.observed.selection.every((item) => Number.isInteger(item) && item >= 0)))
	);
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
	if (receipt.expectationResults) {
		lines.push(
			'',
			'## Scenario expectations',
			'',
			'| Scenario | Framework | Expectation | Phase | Outcome |',
			'| --- | --- | --- | --- | --- |',
		);
		for (const [scenario, frameworks] of Object.entries(receipt.expectationResults)) {
			for (const [framework, results] of Object.entries(frameworks)) {
				for (const result of results) {
					lines.push(
						`| ${scenario} | ${framework} | ${result.expectation.kind} | ${result.phase} | ${result.outcome} |`,
					);
				}
			}
		}
	}
	lines.push('', '## Environment', '', '| Item | Version/mode |', '| --- | --- |');
	for (const [item, version] of Object.entries(receipt.environment)) {
		lines.push(`| ${item} | ${version} |`);
	}
	return `${lines.join('\n')}\n`;
}
