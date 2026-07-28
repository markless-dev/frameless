import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { buildEnrichedIr } from '../src/build.ts';

// GENERATIVE TESTING (audit item 5).
//
// This is Csmith's missing half. The repo already has the comparison side of
// differential testing - and does it at the behavioral level, which is the hard
// version - but it only ever points that oracle at three scenarios and eight
// composition fixtures. The IR grammar those are checked against is open.
//
// The grammar is small and closed enough to generate against: roughly ten
// template node kinds and three cell kinds in ../src/schema.ts. Every program
// below is meaning-bearing .tsrx built from that grammar, so the properties
// asserted here hold for the whole language rather than for three examples.
//
// Deliberately NOT asserted here: cross-framework behavioral equivalence. That
// needs a browser and both emitters, and belongs in a browser lane. What this
// lane proves is that the COMPILER is total, deterministic, and stable under
// meaning-preserving edits across the grammar - which is exactly what the fixed
// corpus could never show.

const identifier = fc
	.tuple(
		fc.constantFrom('alpha', 'beta', 'gamma', 'delta', 'epsilon'),
		fc.integer({ min: 0, max: 9 }),
	)
	.map(([name, index]) => `${name}${index}`);

type Local = { readonly name: string; readonly kind: 'state' | 'computed' };

const localArb: fc.Arbitrary<Local> = fc.record({
	name: identifier,
	kind: fc.constantFrom<'state' | 'computed'>('state', 'computed'),
});

type Node =
	| { readonly kind: 'text'; readonly value: string }
	| { readonly kind: 'dynamic-text'; readonly local: string }
	| { readonly kind: 'host'; readonly tag: string; readonly children: readonly Node[] }
	| { readonly kind: 'branch'; readonly children: readonly Node[]; readonly alt: readonly Node[] }
	| { readonly kind: 'repeat'; readonly children: readonly Node[] }
	| { readonly kind: 'event'; readonly tag: string; readonly local: string };

function nodeArb(locals: readonly Local[]): fc.Arbitrary<Node> {
	const localName = fc.constantFrom(...locals.map((local) => local.name));
	const stateName = fc.constantFrom(
		...(locals.filter((local) => local.kind === 'state').map((local) => local.name) as [
			string,
			...string[],
		]),
	);
	const tag = fc.constantFrom('div', 'section', 'p', 'span');
	return fc.letrec<{ node: Node }>((tie) => ({
		node: fc.oneof(
			{ maxDepth: 3, depthSize: 'small' },
			fc.record({ kind: fc.constant('text' as const), value: fc.constantFrom('a', 'b', 'c') }),
			fc.record({ kind: fc.constant('dynamic-text' as const), local: localName }),
			fc.record({
				kind: fc.constant('host' as const),
				tag,
				children: fc.array(tie('node'), { maxLength: 2 }),
			}),
			fc.record({
				kind: fc.constant('branch' as const),
				children: fc.array(tie('node'), { minLength: 1, maxLength: 2 }),
				alt: fc.array(tie('node'), { maxLength: 2 }),
			}),
			fc.record({
				kind: fc.constant('repeat' as const),
				children: fc.array(tie('node'), { minLength: 1, maxLength: 2 }),
			}),
			fc.record({ kind: fc.constant('event' as const), tag, local: stateName }),
		),
	})).node;
}

function renderNode(node: Node, indent: string): string {
	switch (node.kind) {
		case 'text':
			return `${indent}${node.value}\n`;
		case 'dynamic-text':
			return `${indent}{${node.local}}\n`;
		case 'host':
			return `${indent}<${node.tag}>\n${node.children.map((child) => renderNode(child, `${indent}\t`)).join('')}${indent}</${node.tag}>\n`;
		case 'branch':
			return (
				`${indent}@if (flag) {\n${node.children.map((child) => renderNode(child, `${indent}\t`)).join('')}` +
				`${indent}} @else {\n${node.alt.map((child) => renderNode(child, `${indent}\t`)).join('')}${indent}}\n`
			);
		case 'repeat':
			return `${indent}@for (const row of rows; key row.id) {\n${node.children.map((child) => renderNode(child, `${indent}\t`)).join('')}${indent}}\n`;
		case 'event':
			return `${indent}<${node.tag} onClick={() => { ${node.local}++; }}>x</${node.tag}>\n`;
	}
}

type Program = { readonly locals: readonly Local[]; readonly body: readonly Node[] };

const programArb: fc.Arbitrary<Program> = fc
	.array(localArb, { minLength: 1, maxLength: 3 })
	// Distinct names, and at least one `state` so event handlers have a target.
	.map((locals) => {
		const seen = new Set<string>();
		const unique = locals.filter((local) => !seen.has(local.name) && seen.add(local.name));
		return unique.length && unique.some((local) => local.kind === 'state')
			? unique
			: [{ name: 'alpha0', kind: 'state' as const }, ...unique.slice(1)];
	})
	.chain((locals) =>
		fc
			.array(nodeArb(locals), { minLength: 1, maxLength: 3 })
			.map((body) => ({ locals, body })),
	);

function render(program: Program): string {
	const declarations = program.locals
		.map((local) =>
			local.kind === 'state'
				? `\tlet ${local.name} = state(0);`
				: `\tconst ${local.name} = computed(() => 1);`,
		)
		.join('\n');
	const body = program.body.map((node) => renderNode(node, '\t\t')).join('');
	return `import { computed, state } from '@markless/core';

export function Generated({ flag, rows }) @{
${declarations}

	<div data-generated="">
${body}	</div>
}
`;
}

const compile = (source: string) => buildEnrichedIr({ filename: 'generated.tsrx', source });

// ORDER-INSENSITIVE VIEW OVER THE CANONICALLY NAME-SORTED COLLECTIONS.
//
// Kept byte-identical to the copy in `metamorphic.test.ts`, which carries the full
// citation table: each collection below names the exact `build.ts` SYMBOL whose
// comparator keys on a name-derived field, and each has been witnessed permuting.
// The two copies are duplicated rather than shared because a common helper would
// need a new module, and importing one test file from another registers its suites
// twice. If you change one, change both.
//
//   records.bindings                        `buildEnrichedIrArtifact`, `records.bindings`
//   records.aliases                         `buildEnrichedIrArtifact`, `records.aliases`
//   records.stateReads                      `collectCanonicalReads` -> `compareReads`
//   records.stateWrites                     `buildEnrichedIrArtifact` -> `sortWrites`
//   every `reads` array, any depth          `deriveReads` -> `dedupeReads`
//   every `writes` array, any depth         `deriveHandlerEffects` -> `sortWrites`
//   components[].locals[].semanticRecordIds `enrichComponent`, a bare `.sort()`
//
// Excluded and still order-sensitive: records.events (`buildEnrichedIrArtifact`'s
// `records.events` - an event id is an allocation index or hostNodeId:eventName,
// which no local rename can move), module.exports (`buildEnrichedIrArtifact`'s
// returned `module.exports`, keyed on the observable exportedName),
// records.sharedWrites (`buildSharedWrites`, span-keyed) and events[].handlers
// (`buildEnrichedIrArtifact`'s `enrichedHandlers`, span-keyed).

/** Blank the renamed identifiers so two IRs compare for structure, not naming. */
function structural(value: unknown, renamed: ReadonlySet<string>): unknown {
	if (Array.isArray(value)) return value.map((item) => structural(item, renamed));
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, structural(item, renamed)]),
		);
	}
	if (typeof value === 'string') {
		let next = value;
		for (const name of renamed) next = next.replace(new RegExp(`\\b${name}\\b`, 'g'), '_id_');
		return next;
	}
	return value;
}

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

function isNameSorted(path: readonly string[]): boolean {
	const key = path.at(-1);
	if (key === 'reads' || key === 'writes' || key === 'semanticRecordIds') return true;
	return path.length === 2 && path[0] === 'records' && NAME_SORTED_RECORDS.has(key);
}

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

const renameView = (value: unknown, renamed: ReadonlySet<string>) =>
	canonicalJson(orderInsensitive(structural(value, renamed)));

/** Collect every template node kind the IR actually contains. */
function kinds(value: unknown, into: Set<string> = new Set()): Set<string> {
	if (Array.isArray(value)) {
		for (const item of value) kinds(item, into);
	} else if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		if (typeof record.kind === 'string') into.add(record.kind);
		for (const item of Object.values(record)) kinds(item, into);
	}
	return into;
}

describe('generative corpus over the IR grammar', () => {
	// PROPERTY 1 - TOTALITY. The compiler must be total over the grammar: either
	// it produces IR, or it fails closed with its own explicit message. What it
	// must never do is crash in an unplanned way. This is the machine-checked
	// form of "reject what it cannot prove".
	test('is total: every generated program compiles or fails closed', async () => {
		await fc.assert(
			fc.asyncProperty(programArb, async (program) => {
				const source = render(program);
				try {
					const ir = await compile(source);
					expect(ir.components).toHaveLength(1);
				} catch (error) {
					// Failing closed is an acceptable outcome - the compiler is
					// allowed to reject. What it must NOT do is crash in an
					// unplanned way, so the discriminator is the error TYPE, not
					// its wording: an authored diagnostic is a plain Error with a
					// message, whereas a TypeError/RangeError means the compiler
					// fell over a case it never considered.
					expect(error).toBeInstanceOf(Error);
					expect((error as Error).constructor.name).toBe('Error');
					expect(String((error as Error).message).length).toBeGreaterThan(0);
				}
			}),
			{ numRuns: 120, seed: 20260726 },
		);
	});

	// PROPERTY 2 - DETERMINISM, across the grammar rather than three fixtures.
	// enriched-ir.test.ts already asserts this for the checked-in goldens; this
	// asserts it for programs nobody wrote by hand.
	test('is deterministic: the same source always yields byte-identical IR', async () => {
		await fc.assert(
			fc.asyncProperty(programArb, async (program) => {
				const source = render(program);
				const first = await compile(source).catch(() => null);
				if (first === null) return;
				const second = await compile(source);
				expect(JSON.stringify(second)).toBe(JSON.stringify(first));
			}),
			{ numRuns: 80, seed: 20260726 },
		);
	});

	// PROPERTY 3 - METAMORPHIC, applied generatively. metamorphic.test.ts proves
	// rename-all on the fixtures; this applies the same invariant across the
	// grammar, which is where the two techniques compose and the yield multiplies.
	//
	// THIS PROPERTY WAS NARROWED, AND IS NOW RESTORED. It used to compare only the
	// multiset of template node KINDS, because the whole-IR comparison failed here
	// on programs with several locals and nobody had separated "legitimate
	// name-sorted representation" from "declaration order is genuinely unstable".
	// That was defect 6 (findings-006). It is now settled: T006 diffed the
	// counterexample field by field and found every difference to be a permutation
	// of name-sorted collections; T007 ruled it an instrument fault and required
	// each collection to be cited and witnessed before the view is applied to it.
	// So the lane goes back to comparing the WHOLE IR - a far stronger property
	// than template kinds - under the order-insensitive view above.
	//
	// A narrowed expectation must never be released alone. The witness counter is
	// that release's evidence: it proves this lane still reaches the programs that
	// made the positional comparison fail, so a green run means the property holds
	// rather than that the corpus stopped exercising it.
	test('is stable under equal-length local renames (whole IR)', async () => {
		let renamesExercised = 0;
		let positionalWitnesses = 0;
		await fc.assert(
			fc.asyncProperty(programArb, async (program) => {
				const source = render(program);
				const original = await compile(source).catch(() => null);
				if (original === null) return;
				// 'alpha0' -> 'zlpha0' etc: same length, so source offsets are
				// unchanged and the comparison stays exact.
				const from = program.locals[0]!.name;
				const to = `z${from.slice(1)}`;
				if (source.includes(to)) return;
				const renamed = source.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
				const after = await compile(renamed);
				// Whole-word, not just quoted JSON keys: the identifier also appears
				// inside expression source text carried on the IR.
				const words = new Set([from, to]);
				renamesExercised++;
				if (
					canonicalJson(structural(after, words)) !==
					canonicalJson(structural(original, words))
				) {
					positionalWitnesses++;
				}
				expect(renameView(after, words)).toBe(renameView(original, words));
			}),
			{ numRuns: 80, seed: 20260726 },
		);
		expect(renamesExercised).toBeGreaterThan(0);
		// Anti-vacuity. If this ever reads 0, the corpus has stopped generating the
		// multi-local programs defect 6 lives in, and the property above is passing
		// for the same reason the single-fixture invariant used to: it cannot fail.
		expect(
			positionalWitnesses,
			'the corpus no longer reaches a rename that permutes a name-sorted collection',
		).toBeGreaterThan(0);
	});

	// COVERAGE. A generator whose arbitraries only ever emit the shapes already
	// in the fixed corpus would pass everything above and prove nothing new.
	// This pins down what the corpus actually reaches.
	test('the generated corpus reaches the template node kinds it claims to', async () => {
		const reached = new Set<string>();
		await fc.assert(
			fc.asyncProperty(programArb, async (program) => {
				const ir = await compile(render(program)).catch(() => null);
				if (ir) kinds(ir, reached);
			}),
			{ numRuns: 150, seed: 20260726 },
		);
		for (const kind of ['host', 'text', 'dynamic-text', 'branch', 'keyed-repeat', 'state']) {
			expect([...reached], `missing ${kind}`).toContain(kind);
		}
	});

	// CALIBRATION. The properties must be able to fail. A generator that only
	// emits well-formed programs can never demonstrate that, so these feed the
	// same machinery input that violates each property.
	describe('CALIBRATION: the properties reject what they should', () => {
		test('totality rejects an unrecognised construct', async () => {
			await expect(
				compile(`export function Broken() @{ <div>{{{</div> }`),
			).rejects.toThrow();
		});

		test('the rename comparison detects a non-rename edit', async () => {
			const base = render({
				locals: [{ name: 'alpha0', kind: 'state' }],
				body: [{ kind: 'dynamic-text', local: 'alpha0' }],
			});
			const changed = base.replace('state(0)', 'state(7)');
			expect(changed).not.toBe(base);
			// Through renameView, the comparison property 3 actually makes. The old
			// form calibrated raw JSON.stringify, which no property used.
			const words = new Set(['alpha0', 'zlpha0']);
			expect(renameView(await compile(changed), words)).not.toBe(
				renameView(await compile(base), words),
			);
		});

		test('the order-insensitive view still detects an authored write reorder', async () => {
			// The specific thing the view could have silenced. Two writes to two
			// differently-named state locals, swapped: the multiset of whole
			// stateWrites entries changes because each entry carries its own
			// sourceSpan, even though the set of names written does not.
			const program = (body: string) => `import { state } from '@markless/core';

export function Generated() @{
	let alpha0 = state(0);
	let delta0 = state(0);

	<div data-generated="">
		<span>{alpha0}</span>
		<span>{delta0}</span>
		<button onClick={() => { ${body} }}>x</button>
	</div>
}
`;
			const words = new Set(['alpha0', 'zlpha0']);
			expect(renameView(await compile(program('delta0++; alpha0++;')), words)).not.toBe(
				renameView(await compile(program('alpha0++; delta0++;')), words),
			);
		});
	});
});
