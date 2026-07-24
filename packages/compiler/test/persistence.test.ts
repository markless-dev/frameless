import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
	adaptPersistenceFacts,
	buildEnrichedIr,
	FRAMELESS_STATE_GLOBAL,
	type MarklessStorageSourceFact,
} from '../src/index.ts';
import {
	PERSISTENCE_FRAMINGS,
	PERSISTENCE_SOURCE_FACTS,
} from './fixtures/persistence-facts.ts';

describe('persistence record adapter', () => {
	test('exports the owned seed window property name', () => {
		expect(FRAMELESS_STATE_GLOBAL).toBe('__FRAMELESS_STATE__');
	});

	test.each(PERSISTENCE_FRAMINGS)(
		'normalizes the derived/explicit and render/handler corpus for a $temperature start',
		({ accessByGraphNodeId }) => {
			const records = adaptPersistenceFacts(
				PERSISTENCE_SOURCE_FACTS,
				(graphNodeId) => accessByGraphNodeId[graphNodeId]!,
			);

			expect(records).toEqual([
				{
					version: 'frameless-persistence-record/1',
					graphNodeId: 'state:locale',
					moduleId: 'src/settings.tsrx',
					bindingName: 'locale',
					driver: 'localStorage',
					key: {
						origin: 'explicit',
						literal: 'preferences:locale',
						bakedAtCompileTime: true,
					},
					authoredInitial: 'en',
					antiFlashAttribute: 'data-preferences-locale',
					access: { render: false, handler: true },
					seed: {
						lowering: 'none',
						reason: 'no-render-read',
						landings: [],
					},
					writeThrough: {
						trigger: 'ordinary-assignment',
						value: 'final-committed-string',
						timing: 'commit-before-notify',
						writeFailure: 'swallow',
						crossTabSync: 'off',
					},
				},
				{
					version: 'frameless-persistence-record/1',
					graphNodeId: 'state:theme',
					moduleId: 'src/settings.tsrx',
					bindingName: 'theme',
					driver: 'localStorage',
					key: {
						origin: 'derived',
						sourceIdentifier: 'theme',
						literal: 'markless:theme',
						bakedAtCompileTime: true,
					},
					authoredInitial: 'light',
					antiFlashAttribute: 'data-markless-theme',
					access: { render: true, handler: false },
					seed: {
						lowering: 'pre-paint',
						readFailure: 'authored-initial',
						corruptedValue: 'authored-initial',
						landings: [
							{
								target: 'markless',
								kind: 'payload-scripts',
								slotSymbolKey: 'tsrx.storage/1',
							},
							{
								target: 'react',
								kind: 'sync-read-seed-slot',
								graphNodeId: 'state:theme',
							},
							{
								target: 'solid',
								kind: 'sync-read-seed-slot',
								graphNodeId: 'state:theme',
							},
						],
					},
					writeThrough: {
						trigger: 'ordinary-assignment',
						value: 'final-committed-string',
						timing: 'commit-before-notify',
						writeFailure: 'swallow',
						crossTabSync: 'off',
					},
				},
			]);
		},
	);

	test('fails closed when a required source field is missing', () => {
		const { authoredInitial: _omitted, ...missingAuthoredInitial } =
			PERSISTENCE_SOURCE_FACTS[0];
		expect(() =>
			adaptPersistenceFacts(
				[missingAuthoredInitial as MarklessStorageSourceFact],
				() => ({ render: true, handler: false }),
			),
		).toThrow('missing required field "authoredInitial"');
	});

	test('fails closed when a source field has the wrong type', () => {
		expect(() =>
			adaptPersistenceFacts(
				[
					{
						...PERSISTENCE_SOURCE_FACTS[0],
						writable: 'yes',
					} as unknown as MarklessStorageSourceFact,
				],
				() => ({ render: true, handler: false }),
			),
		).toThrow('writable must be a boolean');
	});

	test('fails closed when a source fact has an unknown field', () => {
		expect(() =>
			adaptPersistenceFacts(
				[
					{
						...PERSISTENCE_SOURCE_FACTS[0],
						futureVendorField: true,
					} as MarklessStorageSourceFact,
				],
				() => ({ render: true, handler: false }),
			),
		).toThrow('unknown field "futureVendorField"');
	});

	test('preserves an explicit markless-prefixed key without reclassifying it', () => {
		const explicit = {
			...PERSISTENCE_SOURCE_FACTS[1],
			key: {
				origin: 'explicit',
				literal: 'markless:author-choice',
				bakedAtCompileTime: true,
			},
		} as const satisfies MarklessStorageSourceFact;
		const [record] = adaptPersistenceFacts([explicit], () => ({
			render: false,
			handler: true,
		}));
		expect(record?.key).toEqual(explicit.key);
		expect(record?.antiFlashAttribute).toBe('data-markless-author-choice');
		expect(record?.key.origin).toBe('explicit');
	});

});

describe('pinned Markless 0.1.1 production path', () => {
	test('emits an additive empty persistence record family', async () => {
		const source = readFileSync(
			new URL('./fixtures/s1-render-once.tsrx', import.meta.url),
			'utf8',
		);
		const ir = await buildEnrichedIr({
			filename: 'src/fixtures/s1-render-once.tsrx',
			source,
		});
		expect(ir.records.persistence).toEqual([]);
	});
});
