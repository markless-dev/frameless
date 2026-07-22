import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	RECEIPT_SCHEMA_VERSION,
	createReceiptSummary,
	validateReceipt,
} from '@frameless/analyzer';

import { buildSsrEntry, getSsrLaneVerdict } from '../src/ssr-receipt.ts';

const fixturePath = new URL('./fixtures/witness-receipt.json', import.meta.url);
const receiptPath = 'demos/ssr/test/fixtures/witness-receipt.json';

async function readFixture(): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, unknown>;
}

test('folds the real witness receipt into a valid passing SSR entry', async () => {
	const witnessReceipt = await readFixture();
	const ssr = buildSsrEntry(witnessReceipt, receiptPath);
	const receiptResults = { scenarios: {}, mutantRejections: {} };
	const receipt = {
		schema: RECEIPT_SCHEMA_VERSION,
		generatedBy: 'demos/ssr/test/ssr-receipt.test.ts',
		environment: { node: process.version },
		findings: {},
		...receiptResults,
		ssr,
		summary: createReceiptSummary(receiptResults),
	};

	assert.equal(validateReceipt(receipt), true);
	assert.deepEqual(ssr.witness, {
		version: '0.7.0',
		runId: '2026-07-22T04-59-37.113Z',
		receiptPath,
		receiptVersionMarker: '1',
	});
	assert.equal(ssr.frameworks.react?.activation, 'hydrate');
	assert.equal(ssr.frameworks.solid?.activation, 'hydrate');
	assert.equal(ssr.frameworks.react?.activationClean, true);
	assert.equal(ssr.frameworks.solid?.activationClean, true);
	assert.deepEqual(ssr.frameworks.react?.preActivation, { expectations: 12, failures: 0 });
	assert.deepEqual(ssr.frameworks.solid?.preActivation, { expectations: 12, failures: 0 });
	assert.deepEqual(ssr.frameworks.react?.postActivation, { expectations: 7, failures: 0 });
	assert.deepEqual(ssr.frameworks.solid?.postActivation, { expectations: 7, failures: 0 });
	assert.deepEqual(ssr.equality, { corpusIdentical: true, outcomesEqual: true });
	assert.equal(ssr.frameworks.react?.calibration.proven, true);
	assert.equal(ssr.frameworks.solid?.calibration.proven, true);
	assert.equal(getSsrLaneVerdict(witnessReceipt, ssr), 'PASS');
});

test('fails the lane when a claim-a expectation fails', async () => {
	const witnessReceipt = await readFixture();
	const boxes = witnessReceipt.boxes as { notes: string[] }[];
	const claimABox = boxes.find(({ notes }) =>
		notes.some((note) => note.includes('"kind":"claim-a-results"')),
	);
	assert.ok(claimABox);
	const noteIndex = claimABox.notes.findIndex((note) => note.includes('"kind":"claim-a-results"'));
	const note = JSON.parse(claimABox.notes[noteIndex] ?? '') as {
		scenarios: { results: { outcome: 'pass' | 'fail' }[] }[];
	};
	note.scenarios[0]!.results[0]!.outcome = 'fail';
	claimABox.notes[noteIndex] = JSON.stringify(note);

	const ssr = buildSsrEntry(witnessReceipt, receiptPath);
	assert.equal(ssr.equality.outcomesEqual, false);
	assert.equal(getSsrLaneVerdict(witnessReceipt, ssr), 'FAIL');
});
