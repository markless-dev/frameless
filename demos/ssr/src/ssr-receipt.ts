import type { Receipt } from '@frameless/analyzer';

type Framework = 'react' | 'solid';
type SsrEntry = NonNullable<Receipt['ssr']>;
type SsrFrameworkEntry = SsrEntry['frameworks'][string];

type WitnessBox = {
	status?: unknown;
	tags?: unknown;
	notes?: unknown;
	witnesses?: unknown;
	summary?: unknown;
};

type WitnessReceipt = {
	asyncWitnessReceipt?: unknown;
	runId?: unknown;
	boxes?: unknown;
};

type ClaimAResult = {
	expectation: { kind: unknown; selector?: unknown };
	outcome: unknown;
};

type ClaimANote = {
	kind: 'claim-a-results';
	framework: Framework;
	scenarios: { scenario: string; results: ClaimAResult[] }[];
};

type ClaimBNote = {
	kind: 'claim-b-results';
	framework: Framework;
	scenarios: { activationClean: boolean }[];
};

type ClaimCNote = {
	kind: 'claim-c-results';
	framework: Framework;
	scenarios: { scenario: string; actionsPerformed: unknown[]; postActivationPass: boolean }[];
};

type CalibrationNote = {
	kind: 'calibration' | 'activation-calibration';
	framework: Framework;
	claim: 'a' | 'c' | 'b';
	detected: boolean;
};

const FRAMEWORKS = ['react', 'solid'] as const;
const REQUIRED_CALIBRATION_CLAIMS = ['a', 'b', 'c'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boxes(receipt: WitnessReceipt): WitnessBox[] {
	if (!Array.isArray(receipt.boxes) || !receipt.boxes.every(isRecord)) {
		throw new TypeError('Witness receipt boxes must be an array of objects.');
	}
	return receipt.boxes;
}

function structuredNotes(receipt: WitnessReceipt): Record<string, unknown>[] {
	const notes: Record<string, unknown>[] = [];
	for (const box of boxes(receipt)) {
		if (!Array.isArray(box.notes)) continue;
		for (const note of box.notes) {
			if (typeof note !== 'string') continue;
			try {
				const parsed: unknown = JSON.parse(note);
				if (isRecord(parsed)) notes.push(parsed);
			} catch {
				// Human-readable witness notes are intentionally not JSON.
			}
		}
	}
	return notes;
}

function frameworkOf(value: unknown): value is Framework {
	return value === 'react' || value === 'solid';
}

function readClaimANotes(notes: Record<string, unknown>[]): ClaimANote[] {
	return notes.filter((note): note is ClaimANote => {
		if (note.kind !== 'claim-a-results' || !frameworkOf(note.framework) || !Array.isArray(note.scenarios)) {
			return false;
		}
		return note.scenarios.every(
			(scenario) =>
				isRecord(scenario) &&
				typeof scenario.scenario === 'string' &&
				Array.isArray(scenario.results) &&
				scenario.results.every(
					(result) =>
						isRecord(result) &&
						isRecord(result.expectation) &&
						typeof result.expectation.kind === 'string' &&
						(result.outcome === 'pass' || result.outcome === 'fail'),
				),
		);
	});
}

function readClaimBNotes(notes: Record<string, unknown>[]): ClaimBNote[] {
	return notes.filter((note): note is ClaimBNote => {
		if (note.kind !== 'claim-b-results' || !frameworkOf(note.framework) || !Array.isArray(note.scenarios)) {
			return false;
		}
		return note.scenarios.every(
			(scenario) => isRecord(scenario) && typeof scenario.activationClean === 'boolean',
		);
	});
}

function readClaimCNotes(notes: Record<string, unknown>[]): ClaimCNote[] {
	return notes.filter((note): note is ClaimCNote => {
		if (note.kind !== 'claim-c-results' || !frameworkOf(note.framework) || !Array.isArray(note.scenarios)) {
			return false;
		}
		return note.scenarios.every(
			(scenario) =>
				isRecord(scenario) &&
				typeof scenario.scenario === 'string' &&
				Array.isArray(scenario.actionsPerformed) &&
				typeof scenario.postActivationPass === 'boolean',
		);
	});
}

function readCalibrationNotes(notes: Record<string, unknown>[]): CalibrationNote[] {
	const calibrations: CalibrationNote[] = [];
	for (const note of notes) {
		if (!frameworkOf(note.framework)) continue;
		if (note.kind === 'activation-calibration' && typeof note.detected === 'boolean') {
			calibrations.push({
				kind: note.kind,
				framework: note.framework,
				claim: 'b',
				detected: note.detected,
			});
		}
		if (
			note.kind === 'calibration' &&
			(note.claim === 'a' || note.claim === 'c') &&
			typeof note.brokenSignalDetected === 'boolean'
		) {
			calibrations.push({
				kind: note.kind,
				framework: note.framework,
				claim: note.claim,
				detected: note.brokenSignalDetected,
			});
		}
	}
	return calibrations;
}

function claimACorpus(notes: ClaimANote[], framework: Framework): string[] {
	return notes
		.filter((note) => note.framework === framework)
		.flatMap((note) =>
			note.scenarios.flatMap(({ scenario, results }) =>
				results.map(({ expectation }) =>
					JSON.stringify([scenario, expectation.kind, expectation.selector ?? null]),
				),
			),
		)
		.sort();
}

function frameworkEntry(
	framework: Framework,
	claimA: ClaimANote[],
	claimB: ClaimBNote[],
	claimC: ClaimCNote[],
	calibrations: CalibrationNote[],
): SsrFrameworkEntry {
	const preActivationResults = claimA
		.filter((note) => note.framework === framework)
		.flatMap((note) => note.scenarios.flatMap(({ results }) => results));
	const activationScenarios = claimB
		.filter((note) => note.framework === framework)
		.flatMap(({ scenarios }) => scenarios);
	const postActivationScenarios = claimC
		.filter((note) => note.framework === framework)
		.flatMap(({ scenarios }) => scenarios);
	const frameworkCalibrations = calibrations.filter((note) => note.framework === framework);
	const provenClaims = REQUIRED_CALIBRATION_CLAIMS.filter((claim) =>
		frameworkCalibrations.some((calibration) => calibration.claim === claim && calibration.detected),
	);

	return {
		activation: 'hydrate',
		preActivation: {
			expectations: preActivationResults.length,
			failures: preActivationResults.filter(({ outcome }) => outcome === 'fail').length,
		},
		activationClean:
			activationScenarios.length > 0 &&
			activationScenarios.every(({ activationClean }) => activationClean),
		// Witness 0.7.0 emits one pass bit per scenario rather than raw assertion results. Each
		// performed action is therefore counted as one observable post-action assertion checkpoint.
		postActivation: {
			expectations: postActivationScenarios.reduce(
				(total, { actionsPerformed }) => total + actionsPerformed.length,
				0,
			),
			failures: postActivationScenarios.filter(({ postActivationPass }) => !postActivationPass)
				.length,
		},
		calibration: {
			claims: provenClaims,
			proven:
				provenClaims.length === REQUIRED_CALIBRATION_CLAIMS.length &&
				frameworkCalibrations.every(({ detected }) => detected),
		},
	};
}

export function buildSsrEntry(witnessReceipt: unknown, receiptPath?: string): SsrEntry {
	if (!isRecord(witnessReceipt)) throw new TypeError('Witness receipt must be an object.');
	if (typeof witnessReceipt.runId !== 'string') throw new TypeError('Witness receipt runId is missing.');
	if (
		typeof witnessReceipt.asyncWitnessReceipt !== 'string' &&
		typeof witnessReceipt.asyncWitnessReceipt !== 'number'
	) {
		throw new TypeError('Witness receipt asyncWitnessReceipt marker is missing.');
	}

	const notes = structuredNotes(witnessReceipt);
	const claimA = readClaimANotes(notes);
	const claimB = readClaimBNotes(notes);
	const claimC = readClaimCNotes(notes);
	const calibrations = readCalibrationNotes(notes);
	const reactCorpus = claimACorpus(claimA, 'react');
	const solidCorpus = claimACorpus(claimA, 'solid');
	const claimAOutcomes = claimA.flatMap(({ scenarios }) =>
		scenarios.flatMap(({ results }) => results.map(({ outcome }) => outcome)),
	);
	const claimCOutcomes = claimC.flatMap(({ scenarios }) =>
		scenarios.map(({ postActivationPass }) => postActivationPass),
	);
	const bothFrameworksHaveOutcomes = FRAMEWORKS.every(
		(framework) =>
			claimA.some((note) => note.framework === framework && note.scenarios.length > 0) &&
			claimC.some((note) => note.framework === framework && note.scenarios.length > 0),
	);

	return {
		witness: {
			version: '0.7.0',
			runId: witnessReceipt.runId,
			receiptPath:
				receiptPath ??
				`demos/ssr/.witness/receipts/${witnessReceipt.runId}/receipt.json`,
			receiptVersionMarker: String(witnessReceipt.asyncWitnessReceipt),
		},
		frameworks: Object.fromEntries(
			FRAMEWORKS.map((framework) => [
				framework,
				frameworkEntry(framework, claimA, claimB, claimC, calibrations),
			]),
		),
		equality: {
			corpusIdentical:
				reactCorpus.length > 0 &&
				reactCorpus.length === solidCorpus.length &&
				reactCorpus.every((expectation, index) => expectation === solidCorpus[index]),
			outcomesEqual:
				bothFrameworksHaveOutcomes &&
				claimAOutcomes.every((outcome) => outcome === 'pass') &&
				claimCOutcomes.every(Boolean),
		},
	};
}

function witnessContradicts(box: WitnessBox): boolean {
	if (isRecord(box.witnesses)) {
		for (const witness of Object.values(box.witnesses)) {
			if (isRecord(witness) && witness.verdict === 'contradicts') return true;
		}
	}
	if (isRecord(box.summary) && isRecord(box.summary.witnesses)) {
		return Object.values(box.summary.witnesses).includes('contradicts');
	}
	return false;
}

export function getSsrLaneVerdict(witnessReceipt: unknown, ssr: SsrEntry): 'PASS' | 'FAIL' {
	if (!isRecord(witnessReceipt)) return 'FAIL';
	let witnessBoxes: WitnessBox[];
	try {
		witnessBoxes = boxes(witnessReceipt);
	} catch {
		return 'FAIL';
	}
	const witnessFailed = witnessBoxes.some((box) => box.status === 'failed');
	const unexpectedContradiction = witnessBoxes.some((box) => {
		const calibration = Array.isArray(box.tags) && box.tags.includes('calibration');
		return !calibration && witnessContradicts(box);
	});
	const equalityFailed = !ssr.equality.corpusIdentical || !ssr.equality.outcomesEqual;
	const frameworkOutcomeFailed = FRAMEWORKS.some(
		(framework) => ssr.frameworks[framework]?.activationClean !== true,
	);
	const calibrationFailed = FRAMEWORKS.some(
		(framework) => ssr.frameworks[framework]?.calibration.proven !== true,
	);
	return witnessFailed ||
		unexpectedContradiction ||
		equalityFailed ||
		frameworkOutcomeFailed ||
		calibrationFailed
		? 'FAIL'
		: 'PASS';
}
