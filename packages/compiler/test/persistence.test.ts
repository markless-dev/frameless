import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
	adaptPersistenceFacts,
	buildEnrichedIr,
	extractPersistenceSourceFacts,
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

// THERE IS NO AUTHORING SURFACE FOR PERSISTENCE, AND THAT IS THE WHOLE REASON NO
// APPLICATION IN THIS REPOSITORY SURVIVES A REFRESH.
//
// Measured at `frameless-app-axes-v1` T007. `@markless/core` declares
// `state<T>(initial: T): T` - ONE parameter, no options object - and pinned
// Markless 0.1.1's `SemanticGraphBinding` carries no `storage` field at all, so
// `extractPersistenceSourceFacts` can never see one no matter what a `.tsrx`
// says. The refusal is therefore UPSTREAM OF EVERY EMITTER: it is not a lane
// property and no lane can be narrowed around it.
//
// The census below would ALSO pass if the extractor were simply dead, which is
// the vacuous-proof trap this project keeps buying. The POSITIVE CONTROL is what
// makes it mean something: feed the extractor a binding that DOES carry
// `storage` and it produces the fact, so a zero over the corpus is a statement
// about the CORPUS AND THE VENDOR, not about the extractor.
describe('the persistence authoring surface, and why the corpus reports zero', () => {
	const fixtureRoot = new URL('./fixtures/', import.meta.url);

	test('NO .tsrx IN THE CORPUS CAN AUTHOR A PERSISTENCE RECORD', async () => {
		const names = readdirSync(fixtureRoot)
			.filter((name) => name.endsWith('.tsrx'))
			.sort();
		expect(names.length).toBeGreaterThan(20);

		const authored: string[] = [];
		let built = 0;
		for (const name of names) {
			const source = readFileSync(new URL(name, fixtureRoot), 'utf8');
			let ir;
			try {
				ir = await buildEnrichedIr({ filename: `test/fixtures/${name}`, source });
			} catch {
				// A handful of fixtures exist only to be REFUSED, or only resolve
				// inside a module set. They cannot report a persistence record
				// either, and skipping them is recorded rather than hidden by the
				// `built` floor asserted below.
				continue;
			}
			built += 1;
			if (ir.records.persistence.length > 0)
				authored.push(`${name}: ${ir.records.persistence.length}`);
		}

		expect(built).toBeGreaterThanOrEqual(names.length - 1);
		expect(authored).toEqual([]);
	});

	test('POSITIVE CONTROL: the extractor is alive - a binding WITH storage yields a fact', () => {
		const facts = extractPersistenceSourceFacts({
			filename: 'src/settings.tsrx',
			graphBindings: [
				{
					id: 'state:theme',
					name: 'theme',
					kind: 'state',
					writable: true,
					initialValue: 'light',
					storage: {
						key: {
							origin: 'derived',
							sourceIdentifier: 'theme',
							literal: 'markless:theme',
							bakedAtCompileTime: true,
						},
					},
				},
			],
		} as never);

		expect(facts).toHaveLength(1);
		expect(facts[0]).toMatchObject({
			graphNodeId: 'state:theme',
			moduleId: 'src/settings.tsrx',
			bindingName: 'theme',
			authoredInitial: 'light',
			writable: true,
		});
	});

	// PERSISTENCE IS SCALAR-STRING-ONLY, AND ONLY THIS BOUNDARY SAYS SO. The
	// emitters do NOT re-check it, so a record for an array- or number-valued
	// binding reaches React and Solid lowering intact when it is injected into
	// `ir.records.persistence` directly - which is how every persistence test in
	// this repository reaches the feature, the vendor path being inert.
	test.each([
		['a number', 4],
		['an array', [{ id: 't1', done: true }]],
		['a boolean', false],
		['an object', { done: true }],
	])('the vendor boundary refuses %s authored initial', (_label, authoredInitial) => {
		expect(() =>
			adaptPersistenceFacts(
				[
					{
						...PERSISTENCE_SOURCE_FACTS[1],
						authoredInitial,
					} as unknown as MarklessStorageSourceFact,
				],
				() => ({ render: true, handler: false }),
			),
		).toThrow('authoredInitial must be a string');
	});
});
