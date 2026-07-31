import { readdirSync, readFileSync } from 'node:fs';
import { buildSemanticGraph } from '@markless/compiler';
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

// THE PERSISTENCE AUTHORING SURFACE, AND WHY THE REST OF THE CORPUS STILL
// REPORTS ZERO.
//
// T007 measured that there was NO authoring surface at all: `@markless/core`
// declares `state<T>(initial: T): T` - ONE parameter - and pinned Markless
// 0.1.1's `SemanticGraphBinding` carries no `storage` field, so
// `extractPersistenceSourceFacts` returns `[]` for every `.tsrx` ever written
// against this vendor. THAT VENDOR HALF IS UNCHANGED and still returns `[]`.
//
// T016 opened a SECOND, FRAMELESS-OWNED half: `state(initial, { storage: … })`,
// read off the author's own AST by `collectAuthoredStorageOptions` in
// `build.ts`. So the census below is no longer "zero everywhere" - it is
// "zero everywhere EXCEPT the one file that asks", and it asserts BOTH halves.
// A census that only counted zeros would pass identically if the channel were
// dead, which is the vacuous-proof trap this project keeps buying; the
// POSITIVE CONTROL on the vendor extractor and the AUTHORED count below are
// what make the zeros mean something.
describe('the persistence authoring surface, and why the corpus reports zero', () => {
	const fixtureRoot = new URL('./fixtures/', import.meta.url);

	/** The one fixture that ASKS for persistence. Everything else must report zero. */
	const AUTHORED = 'persistence-authored.tsrx';

	test('EXACTLY ONE .tsrx IN THE CORPUS AUTHORS A PERSISTENCE RECORD', async () => {
		const names = readdirSync(fixtureRoot)
			.filter((name) => name.endsWith('.tsrx'))
			.sort();
		expect(names).toContain(AUTHORED);
		// The 24 fixtures that predate the channel, plus the one that uses it.
		expect(names.length).toBe(25);

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
		// THE CORPUS IS UNMOVED. Every pre-existing fixture still reports zero -
		// opening the channel changed no existing application - and the single
		// non-zero is the file that asked for it, with all three of its records.
		expect(authored).toEqual([`${AUTHORED}: 3`]);
	});

	test('THE FACT CAME FROM THE AUTHOR OWN BYTES, NOT FROM ANY TEST', async () => {
		const source = readFileSync(new URL(AUTHORED, fixtureRoot), 'utf8');
		// The authoring construct, quoted from the file being compiled.
		expect(source).toContain("state('all', { storage: 'markless:filter' })");

		const ir = await buildEnrichedIr({ filename: `test/fixtures/${AUTHORED}`, source });
		expect(ir.records.persistence).toHaveLength(3);
		expect(
			ir.records.persistence.map((record) => [record.bindingName, record.key.literal]),
		).toEqual([
			['draft', 'markless:draft'],
			['filter', 'markless:filter'],
			['touches', 'markless:touches'],
		]);
		// The key is the AUTHOR's literal, so its origin is `explicit`; `derived`
		// stays reserved for a key the compiler itself invented.
		for (const record of ir.records.persistence) {
			expect(record.key.bakedAtCompileTime).toBe(true);
			expect(record.key.origin).toBe('explicit');
			expect(typeof record.authoredInitial).toBe('string');
		}
		// DELETING THE OPTION DELETES THE RECORD - the differential that proves
		// the channel reads the construct and not the filename.
		const stripped = source.replaceAll(/, \{ storage: '[^']*' \}/g, '');
		expect(stripped).not.toBe(source);
		const bare = await buildEnrichedIr({
			filename: `test/fixtures/${AUTHORED}`,
			source: stripped,
		});
		expect(bare.records.persistence).toEqual([]);
	});

	// THE PIN DOES NOT BIND, AND THAT IS WHY THE CHANNEL IS FRAMELESS-OWNED.
	// Measured against pinned Markless 0.1.1: the second argument builds cleanly
	// with the binding IDENTICAL to baseline and no diagnostic, so nothing in the
	// vendor half sees it. If Markless ever adopts `storage`, this expectation
	// flips and the frameless half can be DELETED rather than rewritten.
	test('the vendor extractor still sees nothing on the authored fixture', async () => {
		const semanticGraph = await buildSemanticGraph({
			filename: `test/fixtures/${AUTHORED}`,
			source: readFileSync(new URL(AUTHORED, fixtureRoot), 'utf8'),
		});
		expect(semanticGraph.diagnostics).toEqual([]);
		expect(extractPersistenceSourceFacts(semanticGraph)).toEqual([]);
		const filter = semanticGraph.graphBindings.find((binding) => binding.name === 'filter')!;
		expect(filter.valueKind).toBe('scalar');
		expect(filter.initialValue).toBe('all');
		expect(Object.hasOwn(filter, 'storage')).toBe(false);
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

// THE SCALAR-STRING REFUSAL, AT MINT TIME, WITH THE MESSAGE RECORDED VERBATIM.
//
// `authoredInitial` is a `string` and the emitted `__framelessWrite` calls
// `localStorage.setItem(key, value)` WITH NO ENCODER, so the channel must be
// REFUSABLE PER BINDING - which is exactly what putting the option ON THE CALL
// buys, because the binding and its `valueKind` are right there.
//
// `valueKind` ALONE IS NOT THE GUARD, AND THAT IS MEASURED. Pinned Markless
// 0.1.1 reports `valueKind: 'scalar'` for `state(3)` AND for `state(false)`, so
// a `valueKind === 'scalar'` test would admit every number and boolean in the
// corpus. The initial value's own runtime type is the second half.
describe('the scalar-string refusal', () => {
	async function build(declaration: string, template = '{value}') {
		return buildEnrichedIr({
			filename: 'test/fixtures/refusal.tsrx',
			source: `import { state } from '@markless/core';

export function Refused({ onTrace }) @{
	let value = ${declaration};
	<section data-scenario="refusal">
		<p data-value>${template}</p>
		<button data-action="go" onClick={(event) => onTrace('go', { value }, event)}>go</button>
	</section>
}
`,
		});
	}

	// THE ARM THAT MATTERS: THE OWNER'S OWN BUG. `s11-todomvc-advanced.tsrx`
	// authors `todos = state([...])` - AN ARRAY OF OBJECTS - and that is the
	// binding `/todomvc-advanced` forgets on a refresh. This channel REFUSES it
	// rather than persisting `"[object Object],[object Object]"`.
	test('REFUSES an array binding shaped like s11 todos', async () => {
		const s11 = readFileSync(
			new URL('./fixtures/s11-todomvc-advanced.tsrx', import.meta.url),
			'utf8',
		);
		// The shape is quoted from S11 itself, so this cannot drift away from the
		// construct it claims to be about.
		const shape = "{ id: 't1', title: 'Taste JavaScript', done: true, pending: false }";
		expect(s11).toContain(shape);

		await expect(
			build(`state([${shape}], { storage: 'markless:todos' })`, '{value.length}'),
		).rejects.toThrow(
			'Persistence refuses state binding "value" (state:value): storage is scalar-string-only and this binding has valueKind "array".',
		);
	});

	test.each([
		[
			'a number',
			'state(3, { storage: "markless:n" })',
			`storage is scalar-string-only and this binding's initial value is number, not a string.`,
		],
		[
			'a boolean',
			'state(false, { storage: "markless:b" })',
			`storage is scalar-string-only and this binding's initial value is boolean, not a string.`,
		],
		[
			'an object',
			'state({ done: true }, { storage: "markless:o" })',
			'storage is scalar-string-only and this binding has valueKind "object".',
		],
		[
			'a non-literal initializer',
			'state(props.seed.slice(), { storage: "markless:u" })',
			'storage is scalar-string-only and this binding has valueKind "unknown".',
		],
	])('REFUSES %s', async (_label, declaration, message) => {
		await expect(build(declaration)).rejects.toThrow(message);
	});

	test('ACCEPTS the empty string, which is a legitimate scalar initial', async () => {
		const ir = await build(`state('', { storage: 'markless:empty' })`);
		expect(ir.records.persistence).toHaveLength(1);
		expect(ir.records.persistence[0]!.authoredInitial).toBe('');
	});

	test.each([
		['a non-object option', `state('a', 'markless:a')`, 'must be an object literal'],
		[
			'an unknown field',
			`state('a', { store: 'markless:a' })`,
			'has unknown field "store"; only "storage" is supported',
		],
		[
			'a missing storage field',
			`state('a', {})`,
			'is missing required field "storage"',
		],
		[
			'a non-literal key',
			`state('a', { storage: props.key })`,
			'field "storage" must be a non-empty string literal',
		],
		[
			'an empty key',
			`state('a', { storage: '' })`,
			'field "storage" must be a non-empty string literal',
		],
		[
			'a spread',
			`state('a', { ...props })`,
			'must contain only plain "storage" properties',
		],
	])('REFUSES %s in the options object', async (_label, declaration, message) => {
		await expect(build(declaration)).rejects.toThrow(message);
	});
});
