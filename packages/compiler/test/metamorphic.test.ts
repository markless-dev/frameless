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
				const before = structural(await ir(fixture, original), words);
				const after = structural(await ir(fixture, renamedSource), words);
				expect(after).toEqual(before);
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
			const before = structural(await ir('s1-render-once.tsrx', original), words);
			const after = structural(await ir('s1-render-once.tsrx', mutated), words);
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
