import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { buildEnrichedIr } from '../src/build.ts';

// METAMORPHIC TESTING (audit item 6).
//
// Differential testing needs two implementations to disagree. Metamorphic
// testing needs neither: it transforms a program into one that MUST compile to
// the same meaning, and requires the compiler to agree with itself. The
// compiler-fuzzing literature (arXiv:2306.06884; Equivalence Modulo Inputs)
// reports this finding bugs faster than differential testing alone, and it
// reaches places the browser lanes cannot - the three scenarios are a fixed
// corpus, but each of these transforms multiplies it.
//
// Every transform below preserves meaning by construction, so any IR difference
// beyond the renamed identifiers themselves is a compiler bug.

const FIXTURES = resolve(dirname(dirname(fileURLToPath(import.meta.url))), 'test/fixtures');

async function ir(filename: string, source: string) {
	return buildEnrichedIr({ filename, source });
}

/**
 * Strip identifier-shaped values so two IRs can be compared for STRUCTURE
 * rather than naming. Only the fields a rename legitimately changes are
 * blanked; everything else - node kinds, order, nesting, cell wiring - must
 * still match exactly, which is what makes the invariant meaningful.
 */
function structural(value: unknown, renamed: ReadonlySet<string>): unknown {
	if (Array.isArray(value)) return value.map((item) => structural(item, renamed));
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, structural(item, renamed)]),
		);
	}
	if (typeof value === 'string') {
		// Replace whole-word occurrences of any renamed identifier.
		let next = value;
		for (const name of renamed) {
			next = next.replace(new RegExp(`\\b${name}\\b`, 'g'), '_id_');
		}
		return next;
	}
	return value;
}

// ORDER-INSENSITIVE VIEW OVER THE CANONICALLY NAME-SORTED COLLECTIONS.
//
// DEFECT 6 (frameless-defects-and-targets, T006 diagnosis / T007 ruling). The
// rename invariant asserted "a rename changes identifier strings and nothing else"
// through the proxy of ARRAY POSITION - and the IR declares several of its arrays
// canonically sorted BY NAME. A state binding's id is `state:<name>`, so an
// alphabetical rename MUST permute them. The invariant contradicted a declared
// property of the artifact it measured; that is an instrument fault, not a
// compiler bug.
//
// The view is applied by CITATION, not by taste. Every collection below names the
// exact `packages/compiler/src/build.ts` SYMBOL whose comparator keys on a
// name-derived field, and every one has been WITNESSED permuting under an
// equal-length rename (the `can permute` cases further down are that witness,
// checked in so it cannot rot):
//
//   records.bindings      `buildEnrichedIrArtifact`'s `records.bindings` initializer,
//                         `compareText(left.id, right.id)`; a binding id is
//                         `state:<name>` or `computed:<name>`.
//   records.aliases       `buildEnrichedIrArtifact`'s `records.aliases` initializer, the
//                         same `compareText(left.id, right.id)`; `resolveAliases` builds
//                         that id as `alias:<Component>:<aliasName>`.
//   records.stateReads    `buildEnrichedIrArtifact`'s `records.stateReads`, produced by
//                         `collectCanonicalReads`, whose trailing `.sort(compareReads)`
//                         keys componentId, then graphNodeId, then path.
//   records.stateWrites   `buildEnrichedIrArtifact`'s `const writes = sortWrites(...)`;
//                         `sortWrites` keys componentId, graphNodeId, path, then more.
//   every `reads` array, any depth
//                         `deriveReads`, which returns `dedupeReads(...)`; `dedupeReads`
//                         keys graphNodeId, path, via. `toStateReads` reaches the same
//                         ordering through `compareReads`.
//   every `writes` array, any depth
//                         `sortWrites` again, reached from `buildEnrichedIrArtifact` and
//                         from `deriveHandlerEffects`.
//   components[].locals[].semanticRecordIds
//                         `enrichComponent`, a bare `.sort()` over `state:<name>` /
//                         `alias:<...>` ids.
//
// DELIBERATELY EXCLUDED - these stay order-SENSITIVE, because no rename can move
// them and a view applied to a collection nobody has seen misbehave is the same
// unexamined assumption defect 6 was:
//
//   records.events        `buildEnrichedIrArtifact`'s `records.events` initializer sorts
//                         by id, but an event id is `event:<allocation index>` or
//                         `event:<hostNodeId>:<eventName>`. A local rename cannot touch
//                         either; probed, order unchanged. Its nested reads/writes DO
//                         permute and are covered above.
//   module.exports        `buildEnrichedIrArtifact`'s returned `module.exports` keys on
//                         `exportedName`, part of the observable contract, which a
//                         meaning-preserving rename never touches.
//   records.sharedWrites  `buildSharedWrites` is SPAN-keyed (`targetSpan.start`).
//   events[].handlers     `buildEnrichedIrArtifact`'s `enrichedHandlers` sort is
//                         SPAN-keyed (`expression.start`, then `expression.end`).
//
// The comparison is a MULTISET OF WHOLE ENTRIES. Whole entries carry their own
// `sourceSpan`, so a genuine authored reorder still changes the multiset and is
// still caught - which the `authored write reorder` calibration below proves
// rather than asserts.
//
// Honest scope of that claim, since it is easy to overstate. The tempting broad
// fix - recursively sort EVERY array on both sides - was probed here too, and it
// also catches the authored write reorder and a template sibling swap, because
// this IR is span-rich enough that positional information is largely redundant.
// So the case against it is not "it silences these calibrations". It is that it
// discards order for the whole artifact in order to fix seven collections, which
// makes every future order-bearing array silently unchecked. This view is minimal
// and cited: order-insensitivity applies exactly where a build.ts symbol justifies
// it, and everywhere else the comparison is still exact.

/** Deterministic serialisation with key order removed, so entries compare as values. */
function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (value && typeof value === 'object') {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
			.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
			.join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
}

const NAME_SORTED_RECORDS = new Set(['bindings', 'aliases', 'stateReads', 'stateWrites']);

/** True only for the cited collections in the table above. */
function isNameSorted(path: readonly string[]): boolean {
	const key = path.at(-1);
	if (key === 'reads' || key === 'writes' || key === 'semanticRecordIds') return true;
	return path.length === 2 && path[0] === 'records' && NAME_SORTED_RECORDS.has(key);
}

/**
 * Replace each cited collection with a multiset of its whole entries. Everything
 * else - node kinds, nesting, cell wiring, span-keyed arrays, declaration order -
 * stays positional and is still compared exactly.
 */
function orderInsensitive(value: unknown, path: readonly string[] = []): unknown {
	if (Array.isArray(value)) {
		const entries = value.map((item) => orderInsensitive(item, [...path, '*']));
		if (!isNameSorted(path)) return entries;
		const multiset: Record<string, number> = {};
		for (const entry of entries) {
			const key = canonicalJson(entry);
			multiset[key] = (multiset[key] ?? 0) + 1;
		}
		return { '@@multiset': multiset };
	}
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, orderInsensitive(item, [...path, key])]),
		);
	}
	return value;
}

/** The comparison the rename invariant actually asserts. */
const renameView = (value: unknown, renamed: ReadonlySet<string>) =>
	orderInsensitive(structural(value, renamed));

const scenarios = [
	's1-render-once.tsrx',
	's2-keyed-todo.tsrx',
	's3-event-form.tsrx',
] as const;

describe('metamorphic invariants: meaning-preserving edits must not change the IR', () => {
	describe('rename-all: renaming locals changes names and nothing else', () => {
		// Locals only. Component names, props and DOM attributes are part of the
		// observable contract, so renaming those would NOT be meaning-preserving.
		const renames: Record<string, ReadonlyArray<readonly [string, string]>> = {
			's1-render-once.tsrx': [
				['count', 'tally'],
				['prefix', 'banner'],
				['derived', 'display'],
			],
			's2-keyed-todo.tsrx': [],
			's3-event-form.tsrx': [],
		};

		for (const fixture of scenarios) {
			const pairs = renames[fixture]!;
			if (pairs.length === 0) continue;
			test(fixture, async () => {
				const original = await readFile(resolve(FIXTURES, fixture), 'utf8');
				let renamedSource = original;
				for (const [from, to] of pairs) {
					renamedSource = renamedSource.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
				}
				expect(renamedSource).not.toBe(original);

				const words = new Set(pairs.flatMap(([from, to]) => [from, to]));
				const before = renameView(await ir(fixture, original), words);
				const after = renameView(await ir(fixture, renamedSource), words);
				expect(after).toEqual(before);
			});
		}

		// THE THIRD VACUOUS GREEN (T007 §5.1), and the reason the fixture loop
		// above cannot stand alone. It runs on exactly ONE fixture - `renames`
		// gives s2 and s3 empty lists, which hit `continue` - and s1's IR has a
		// single state binding, so `computed:derived < prop:props < state:count`
		// holds before and after every rename it performs. The invariant passed
		// there because it was structurally INCAPABLE of failing, not because the
		// property held; it was never evidence either way about defect 6.
		//
		// These cases restore the calibration. Each is an equal-length rename that
		// provably flips an alphabetical ordering, and each asserts BOTH halves:
		// the order-insensitive view holds, AND the positional comparison the
		// invariant used to make would have failed. The second assertion is what
		// stops these decaying into another vacuous green - if a future change
		// makes a case stop permuting, it fails here instead of quietly proving
		// nothing.
		const permuting = [
			{
				name: 'records.bindings, stateReads, stateWrites and the nested reads/writes',
				from: 'beta',
				to: 'zeta',
				source: (local: string) => `import { computed, state } from '@markless/core';

export function Probe({ first, second }) @{
	let ${local} = state(0);
	let delta = state(0);
	const total = computed(() => ${local} + delta);

	<div>
		<span>{${local}}</span>
		<span>{delta}</span>
		<em>{total}</em>
		<i>{first}{second}</i>
		<button onClick={() => { ${local}++; delta++; }}>go</button>
	</div>
}
`,
			},
			{
				name: 'records.aliases',
				from: 'beta',
				to: 'zeta',
				source: (local: string) => `import { state } from '@markless/core';

export function Probe({ first: ${local}, second: delta }) @{
	let count = state(0);

	<div>
		<span>{${local}}</span>
		<span>{delta}</span>
		<em>{count}</em>
	</div>
}
`,
			},
			{
				name: 'components[].locals[].semanticRecordIds',
				from: 'beta',
				to: 'zeta',
				source: (local: string) => `import { state } from '@markless/core';

export function Probe({ pack }) @{
	const [${local}, delta] = pack;
	let count = state(0);

	<div>
		<span>{${local}}</span>
		<span>{delta}</span>
		<em>{count}</em>
	</div>
}
`,
			},
		] as const;

		for (const permutingCase of permuting) {
			test(`can permute: ${permutingCase.name}`, async () => {
				const { from, to } = permutingCase;
				// Equal length keeps every source offset identical, so the only
				// thing that can differ is what the rename legitimately changes.
				expect(to).toHaveLength(from.length);
				const words = new Set<string>([from, to]);
				const beforeIr = await ir('probe.tsrx', permutingCase.source(from));
				const afterIr = await ir('probe.tsrx', permutingCase.source(to));

				// WITNESS. This case really does reach the shape defect 6 was filed
				// for: the positional comparison reports a difference here.
				expect(canonicalJson(structural(afterIr, words))).not.toBe(
					canonicalJson(structural(beforeIr, words)),
				);

				// THE INVARIANT, over the cited name-sorted collections only.
				expect(renameView(afterIr, words)).toEqual(renameView(beforeIr, words));
			});
		}
	});

	describe('wrap-in-always-true-branch: a tautological guard adds a branch and preserves the body', () => {
		// Weaker than an exact-equality invariant on purpose: wrapping legitimately
		// introduces a branch node. What must survive is everything the body
		// contributes - the cells, the callbacks, the component surface.
		for (const fixture of scenarios) {
			test(fixture, async () => {
				const original = await readFile(resolve(FIXTURES, fixture), 'utf8');
				const before = await ir(fixture, original);

				// Wrap the outermost template element in `@if (true) { ... }`.
				const openIndex = original.indexOf('\t<');
				expect(openIndex).toBeGreaterThan(-1);
				const head = original.slice(0, openIndex);
				const body = original.slice(openIndex, original.lastIndexOf('}'));
				const tail = original.slice(original.lastIndexOf('}'));
				const wrapped = `${head}\t@if (true) {\n${body}\t}\n${tail}`;

				const after = await ir(fixture, wrapped);

				// The component surface is unchanged by a tautological guard.
				expect(after.components.map((component) => component.name)).toEqual(
					before.components.map((component) => component.name),
				);
				expect(after.module.exports).toEqual(before.module.exports);
				// Every cell the body declares still exists, with the same kinds.
				const cells = (value: typeof before) =>
					JSON.stringify(value.components.map((component) => component.locals));
				expect(cells(after)).toEqual(cells(before));
			});
		}
	});

	describe('reorder-siblings: swapping independent siblings permutes the template and nothing else', () => {
		// Two sibling elements with no data dependence on each other must produce
		// the same IR with their subtrees swapped - same kinds, same count, same
		// cells. If reordering changed anything else, template lowering would be
		// position-sensitive in a way authors could not predict.
		const source = `import { state } from '@markless/core';

export function Pair() @{
	let count = state(0);

	<div data-pair="">
		<p data-first="">first</p>
		<span data-second="">second</span>
	</div>
}
`;
		const swapped = `import { state } from '@markless/core';

export function Pair() @{
	let count = state(0);

	<div data-pair="">
		<span data-second="">second</span>
		<p data-first="">first</p>
	</div>
}
`;

		test('the multiset of template node kinds is preserved', async () => {
			const before = await ir('pair.tsrx', source);
			const after = await ir('pair.tsrx', swapped);
			const kinds = (value: typeof before) => {
				const found: string[] = [];
				const walk = (node: unknown): void => {
					if (Array.isArray(node)) return node.forEach(walk);
					if (node && typeof node === 'object') {
						const record = node as Record<string, unknown>;
						if (typeof record.kind === 'string') found.push(record.kind);
						Object.values(record).forEach(walk);
					}
				};
				walk(value.components.map((component) => component.template));
				return found.sort();
			};
			expect(kinds(after)).toEqual(kinds(before));
		});

		test('the cells and component surface are untouched', async () => {
			const before = await ir('pair.tsrx', source);
			const after = await ir('pair.tsrx', swapped);
			expect(JSON.stringify(after.components.map((c) => c.locals))).toEqual(
				JSON.stringify(before.components.map((c) => c.locals)),
			);
			expect(after.module.exports).toEqual(before.module.exports);
		});

		test('CALIBRATION: the comparison still sees the reorder', async () => {
			// The invariants above are order-INSENSITIVE by construction, so they
			// must be paired with proof that the reorder actually happened -
			// otherwise they would pass on two identical inputs.
			const before = JSON.stringify(await ir('pair.tsrx', source));
			const after = JSON.stringify(await ir('pair.tsrx', swapped));
			expect(after).not.toBe(before);
		});
	});

	// CALIBRATION. An invariant that cannot fail proves nothing. These feed the
	// same comparison a transform that is NOT meaning-preserving and require it
	// to be rejected - so a green run above means the transforms held, not that
	// the comparison is blind.
	describe('CALIBRATION: meaning-CHANGING edits must be rejected', () => {
		test('changing a literal is caught by rename-all comparison', async () => {
			const original = await readFile(resolve(FIXTURES, 's1-render-once.tsrx'), 'utf8');
			const mutated = original.replace('state(1)', 'state(2)');
			expect(mutated).not.toBe(original);
			const words = new Set(['count', 'tally', 'prefix', 'banner', 'derived', 'display']);
			// Runs through renameView, not through structural() alone: the point of
			// a calibration is to exercise the comparison the invariant ACTUALLY
			// makes. Calibrating a comparison nobody uses is how an instrument gets
			// silenced without anyone noticing.
			const before = renameView(await ir('s1-render-once.tsrx', original), words);
			const after = renameView(await ir('s1-render-once.tsrx', mutated), words);
			expect(after).not.toEqual(before);
		});

		test('a genuine authored reorder of two writes is still caught', async () => {
			// THE GUARD ON THE ORDER-INSENSITIVE VIEW (T007 §1). This is the change
			// the view could plausibly have silenced: the rename invariant now
			// ignores the position of `records.stateWrites`, so something has to
			// prove it still notices when an author genuinely swaps two writes.
			// It does, because the view compares a MULTISET OF WHOLE ENTRIES and a
			// whole stateWrites entry carries its own `sourceSpan` - the names
			// written are unchanged, the spans they sit at are not.
			const program = (body: string) => `import { state } from '@markless/core';

export function Probe() @{
	let beta = state(0);
	let delta = state(0);

	<div>
		<span>{beta}</span>
		<span>{delta}</span>
		<button onClick={() => { ${body} }}>go</button>
	</div>
}
`;
			const words = new Set(['beta', 'zeta']);
			const before = renameView(await ir('probe.tsrx', program('beta++; delta++;')), words);
			const after = renameView(await ir('probe.tsrx', program('delta++; beta++;')), words);
			expect(after).not.toEqual(before);
		});

		test('dropping a cell is caught by the wrap comparison', async () => {
			const original = await readFile(resolve(FIXTURES, 's1-render-once.tsrx'), 'utf8');
			const mutated = original.replace(
				'const derived = computed(() => `${prefix}${count * multiplier}`);',
				'',
			);
			expect(mutated).not.toBe(original);
			const before = await ir('s1-render-once.tsrx', original);
			const after = await ir('s1-render-once.tsrx', mutated);
			const cells = (value: typeof before) =>
				JSON.stringify(value.components.map((component) => component.locals));
			expect(cells(after)).not.toEqual(cells(before));
		});
	});
});
