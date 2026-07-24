import type { Receipt } from '@frameless/analyzer';

type Framework = 'react' | 'solid';
type PersistenceEntry = NonNullable<Receipt['persistence']>;

type WitnessBox = {
	name?: unknown;
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

type CalibrationNote = {
	kind: 'persistence-calibration';
	framework: Framework;
	claim: 'no-flash' | 'write-through';
	proven: boolean;
};

const FRAMEWORKS = ['react', 'solid'] as const;
const CALIBRATION_CLAIMS = ['no-flash', 'write-through'] as const;
const EQUALITY_BOX = 'persistence equality — react and solid';
const CALIBRATION_BOXES = {
	'no-flash': 'calibration — wrong pre-paint seed',
	'write-through': 'calibration — write-through setItem no-op',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boxes(receipt: WitnessReceipt): WitnessBox[] {
	if (!Array.isArray(receipt.boxes) || !receipt.boxes.every(isRecord)) {
		throw new TypeError('Witness receipt boxes must be an array of objects.');
	}
	return receipt.boxes;
}

function matchingBox(receiptBoxes: WitnessBox[], name: string): WitnessBox | undefined {
	const matches = receiptBoxes.filter((box) => box.name === name);
	return matches.length === 1 ? matches[0] : undefined;
}

function boxPassed(receiptBoxes: WitnessBox[], name: string): boolean {
	return matchingBox(receiptBoxes, name)?.status === 'passed';
}

function structuredNotes(receiptBoxes: WitnessBox[]): Record<string, unknown>[] {
	const notes: Record<string, unknown>[] = [];
	for (const box of receiptBoxes) {
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

function readCalibrationNotes(notes: Record<string, unknown>[]): CalibrationNote[] {
	const calibrations: CalibrationNote[] = [];
	for (const note of notes) {
		if (note.kind !== 'persistence-calibration' || !frameworkOf(note.framework)) continue;
		if (typeof note.cleanNoFlashWouldDetect === 'boolean') {
			calibrations.push({
				kind: note.kind,
				framework: note.framework,
				claim: 'no-flash',
				proven: note.cleanNoFlashWouldDetect,
			});
		}
		if (typeof note.cleanWriteThroughWouldDetect === 'boolean') {
			calibrations.push({
				kind: note.kind,
				framework: note.framework,
				claim: 'write-through',
				proven: note.cleanWriteThroughWouldDetect,
			});
		}
	}
	return calibrations;
}

function calibrationClaimProven(
	claim: (typeof CALIBRATION_CLAIMS)[number],
	calibrations: CalibrationNote[],
	receiptBoxes: WitnessBox[],
): boolean {
	const claimNotes = calibrations.filter((calibration) => calibration.claim === claim);
	return (
		boxPassed(receiptBoxes, CALIBRATION_BOXES[claim]) &&
		FRAMEWORKS.every((framework) =>
			claimNotes.some(
				(calibration) => calibration.framework === framework && calibration.proven,
			),
		) &&
		claimNotes.every(({ proven }) => proven)
	);
}

export function buildPersistenceEntry(
	witnessReceipt: unknown,
	receiptPath?: string,
): PersistenceEntry {
	if (!isRecord(witnessReceipt)) throw new TypeError('Witness receipt must be an object.');
	if (typeof witnessReceipt.runId !== 'string') {
		throw new TypeError('Witness receipt runId is missing.');
	}
	if (
		typeof witnessReceipt.asyncWitnessReceipt !== 'string' &&
		typeof witnessReceipt.asyncWitnessReceipt !== 'number'
	) {
		throw new TypeError('Witness receipt asyncWitnessReceipt marker is missing.');
	}

	const receiptBoxes = boxes(witnessReceipt);
	const calibrations = readCalibrationNotes(structuredNotes(receiptBoxes));
	const claims = CALIBRATION_CLAIMS.filter((claim) =>
		calibrationClaimProven(claim, calibrations, receiptBoxes),
	);

	return {
		witness: {
			version: '0.7.0',
			runId: witnessReceipt.runId,
			receiptPath:
				receiptPath ??
				`demos/persistence/.witness/receipts/${witnessReceipt.runId}/receipt.json`,
			receiptVersionMarker: String(witnessReceipt.asyncWitnessReceipt),
		},
		frameworks: Object.fromEntries(
			FRAMEWORKS.map((framework) => [
				framework,
				{
					noFlash: boxPassed(receiptBoxes, `no-flash — ${framework}`),
					writeThrough: boxPassed(receiptBoxes, `write-through — ${framework}`),
				},
			]),
		) as PersistenceEntry['frameworks'],
		equality: {
			outcomesEqual: boxPassed(receiptBoxes, EQUALITY_BOX),
		},
		calibration: {
			claims,
			proven: claims.length === CALIBRATION_CLAIMS.length,
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

export function getPersistenceLaneVerdict(
	witnessReceipt: unknown,
	persistence?: PersistenceEntry,
): 'PASS' | 'FAIL' {
	if (!isRecord(witnessReceipt)) return 'FAIL';
	let receiptBoxes: WitnessBox[];
	try {
		receiptBoxes = boxes(witnessReceipt);
	} catch {
		return 'FAIL';
	}
	let entry = persistence;
	try {
		entry ??= buildPersistenceEntry(witnessReceipt);
	} catch {
		return 'FAIL';
	}
	const witnessFailed = receiptBoxes.some((box) => box.status === 'failed');
	const witnessContradiction = receiptBoxes.some(witnessContradicts);
	const frameworkFailed = FRAMEWORKS.some(
		(framework) =>
			entry.frameworks[framework].noFlash !== true ||
			entry.frameworks[framework].writeThrough !== true,
	);
	return witnessFailed ||
		witnessContradiction ||
		frameworkFailed ||
		!entry.equality.outcomesEqual ||
		!entry.calibration.proven
		? 'FAIL'
		: 'PASS';
}
