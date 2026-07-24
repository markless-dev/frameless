import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	RECEIPT_SCHEMA_VERSION,
	createReceiptSummary,
	validateReceipt,
} from '@frameless/analyzer';

import {
	buildPersistenceEntry,
	getPersistenceLaneVerdict,
} from '../src/persistence-receipt.ts';

const fixturePath = new URL('./fixtures/witness-receipt.json', import.meta.url);
const receiptPath = 'demos/persistence/test/fixtures/witness-receipt.json';

async function readFixture(): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, unknown>;
}

test('folds the real witness receipt into a valid passing persistence entry', async () => {
	const witnessReceipt = await readFixture();
	const persistence = buildPersistenceEntry(witnessReceipt, receiptPath);
	const receiptResults = { scenarios: {}, mutantRejections: {} };
	const receipt = {
		schema: RECEIPT_SCHEMA_VERSION,
		generatedBy: 'demos/persistence/test/persistence-receipt.test.ts',
		environment: { node: process.version },
		findings: {},
		...receiptResults,
		persistence,
		summary: createReceiptSummary(receiptResults),
	};

	assert.equal(RECEIPT_SCHEMA_VERSION, 'frameless-receipts/3');
	assert.equal(validateReceipt(receipt), true);
	assert.deepEqual(persistence.witness, {
		version: '0.7.0',
		runId: '2026-07-23T13-04-45.943Z',
		receiptPath,
		receiptVersionMarker: '1',
	});
	assert.deepEqual(persistence.frameworks, {
		react: { noFlash: true, writeThrough: true },
		solid: { noFlash: true, writeThrough: true },
	});
	assert.deepEqual(persistence.equality, { outcomesEqual: true });
	assert.deepEqual(persistence.calibration, {
		claims: ['no-flash', 'write-through'],
		proven: true,
	});
	assert.equal(getPersistenceLaneVerdict(witnessReceipt, persistence), 'PASS');
});

test('fails the lane when a no-flash box fails', async () => {
	const witnessReceipt = await readFixture();
	const boxes = witnessReceipt.boxes as { name: string; status: string }[];
	const noFlashBox = boxes.find(({ name }) => name === 'no-flash — react');
	assert.ok(noFlashBox);
	noFlashBox.status = 'failed';

	const persistence = buildPersistenceEntry(witnessReceipt, receiptPath);
	assert.equal(persistence.frameworks.react.noFlash, false);
	assert.equal(getPersistenceLaneVerdict(witnessReceipt, persistence), 'FAIL');
});
