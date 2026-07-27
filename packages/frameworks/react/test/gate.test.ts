import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'pathe';
import { fileURLToPath } from 'node:url';
import { dirname } from 'pathe';
import { afterEach, describe, expect, test } from 'vitest';
import {
	buildEnrichedIr,
	type EnrichedIR,
	type FramelessPersistenceRecord,
} from '@frameless/compiler';

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
import {
	checkGeneratedFiles,
	checkSources,
	discoverGeneratedFiles,
	REACT_GATE_POLICIES,
} from '../src/gate/index.ts';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const temporaryRoots: string[] = [];
afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

/**
 * MUTATION CONSTRUCTOR - every mutant in this file is built with these. Copy this
 * block into a new adapter's gate corpus; do NOT copy a bare `.replace()`.
 *
 * `String.prototype.replace` promises to return a string, NOT to have matched.
 * When the search misses it returns the input unchanged, with no error, and the
 * row then asserts a gate policy against source the gate has every right to
 * accept. The row stays green while measuring nothing - a green vacuum. That is
 * exactly what defect 3's cause B was (defects-and-targets T006/T007): on a CRLF
 * checkout one search literal in the Solid corpus became unmatchable, and the row
 * had been asserting against a non-mutant for as long as it had existed.
 *
 * The assertion is on the OUTPUT, not on the search. `mutated !== source` is the
 * precondition the row actually depends on: a search that matched but changed
 * nothing yields a non-mutant just the same, and is rejected just the same.
 *
 * Same pattern as `packages/compiler/test/metamorphic.test.ts:79`. Audited and
 * applied corpus-wide by T018; see
 * `docs/goals/frameless-defects-and-targets-v1/notes/T018-mutation-no-op-audit.md`.
 */
function assertMutated(source: string, mutated: string, search: string | RegExp): string {
	if (mutated !== source) return mutated;
	throw new Error(
		`gate mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this row would assert a policy against a non-mutant',
	);
}

function mutate(source: string, search: string | RegExp, replacement: string): string {
	return assertMutated(source, source.replace(search, replacement), search);
}

function mutateAll(source: string, search: string, replacement: string): string {
	return assertMutated(source, source.replaceAll(search, replacement), search);
}

const valid = `import { useState } from 'react';
export function Mutant({ items = [] }) {
  const [value, setValue] = useState(0);
  return <section><button onClick={() => {
    const nextValue = value + 1;
    setValue(nextValue);
  }}>change</button><ul>{items.map((item) => <li key={item.id}>{item.id}</li>)}</ul></section>;
}`;

const dossierRef =
	/^(?:T002 ruling \d+|T004 §3\.1 R-[A-Z]+\d+|T002-persistence-architecture Decision 6)$/;
const compositionNames = [
	'C1-slot',
	'C2-shared',
	'C3-ref',
	'C4-attach',
	'C5-props',
	'C6-scalar-context',
	'C7-object-context',
	'C8-page-store',
] as const;
const compositionArtifacts = new Map<string, EnrichedIR>();
const compositionSources = new Map<string, string>();
for (const name of compositionNames) {
	const filename = `test/composition-fixtures/${name}.tsrx`;
	const source = await readFile(resolve(PACKAGE_ROOT, filename), 'utf8');
	compositionArtifacts.set(name, await buildEnrichedIr({ filename, source }));
	compositionSources.set(
		name,
		await readFile(resolve(PACKAGE_ROOT, `generated-composition/${name}.jsx`), 'utf8'),
	);
}

type MutationCase = readonly [
	string,
	string,
	string,
	({ readonly artifact?: EnrichedIR } | undefined)?,
];

async function policies(source: string): Promise<string[]> {
	const result = await checkSources([{ file: 'generated/Mutant.jsx', source }]);
	expect(result.violations.every((entry) => dossierRef.test(entry.dossierRef))).toBe(true);
	return result.violations.map((entry) => entry.policy);
}

function withRenderPersistence(
	artifact: EnrichedIR,
	target: 'react' | 'solid',
): EnrichedIR {
	const binding = artifact.records.bindings.find((candidate) => candidate.kind === 'state');
	if (!binding) throw new Error('Persistence gate fixture has no state binding');
	const persistence: FramelessPersistenceRecord = {
		version: 'frameless-persistence-record/1',
		graphNodeId: binding.id,
		moduleId: 'gate-fixture',
		bindingName: binding.name,
		driver: 'localStorage',
		key: {
			origin: 'derived',
			sourceIdentifier: 'theme',
			literal: 'markless:theme',
			bakedAtCompileTime: true,
		},
		authoredInitial: 'light',
		antiFlashAttribute: 'data-markless-theme',
		access: { render: true, handler: true },
		seed: {
			lowering: 'pre-paint',
			readFailure: 'authored-initial',
			corruptedValue: 'authored-initial',
			landings: [
				{
					target,
					kind: 'sync-read-seed-slot',
					graphNodeId: binding.id,
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
	};
	return { ...artifact, records: { ...artifact.records, persistence: [persistence] } };
}

describe('React dossier gate', async () => {
	const relativeImportArtifact = await buildEnrichedIr({
		filename: 'test/relative-import-parent.tsrx',
		source: `import { state } from "@markless/core";
			import { Child } from "./relative-import-child.tsrx";
			export function Parent() @{ let theme = state("light"); <><span>{theme}</span><Child /></> }`,
	});
	const recordedRelativeImport = await formatEmitted(emit(relativeImportArtifact));

	test('publishes a dossier reference on every policy object', () => {
		expect(REACT_GATE_POLICIES.length).toBeGreaterThan(0);
		expect(REACT_GATE_POLICIES.every((policy) => dossierRef.test(policy.dossierRef))).toBe(
			true,
		);
		expect(
			// requiresArtifact is present on only some members of the policy union,
			// so it needs an `in` guard before access. Same predicate at runtime.
			REACT_GATE_POLICIES.filter(
				(policy) => 'requiresArtifact' in policy && policy.requiresArtifact,
			).map(
				(policy) => policy.id,
			),
		).toEqual(['persistence-render-lowering', 'R-SH4', 'R-CH2']);
	});

	test('discovers, parses, and accepts every checked-in generated component', async () => {
		expect(await discoverGeneratedFiles()).toEqual([
			'generated/S1.jsx',
			'generated/S2.jsx',
			'generated/S3.jsx',
		]);
		const result = await checkGeneratedFiles();
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
		expect(result.unevaluated).toHaveLength(3);
		expect(Object.keys(result)).toEqual(['files', 'policies', 'violations']);
		expect(new Set(result.unevaluated.map((entry) => entry.policy))).toEqual(
			new Set(['persistence-render-lowering', 'R-SH4', 'R-CH2']),
		);
		for (const file of result.files) {
			expect(await readFile(resolve(PACKAGE_ROOT, file), 'utf8')).toContain(
				'@generated by @frameless/react',
			);
		}
	});

	const mutationCases = [
		[
			'unused import',
			mutate(valid, 'useState }', 'useMemo, useState }'),
			'react-import-allowlist',
		],
		[
			'React recommended rule',
			mutate(valid, '<section>', '<section class="bad">'),
			'eslint:react/no-unknown-property',
		],
		[
			'bare static attribute',
			mutate(valid, '<section>', '<section data-probe>'),
			'explicit-static-attribute-value',
		],
		[
			'Hooks recommended rule',
			mutate(
				mutate(valid, 'import { useState }', 'import { useEffect, useState }'),
				'const [value',
				'useEffect(() => { console.log(items); }, []);\n  const [value',
			),
			'eslint:react-hooks/exhaustive-deps',
		],
		[
			'index key AST',
			mutate(mutate(valid, 'key={item.id}', 'key={index}'), '(item) =>', '(item, index) =>'),
			'index-key',
		],
		[
			'index key plugin',
			mutate(mutate(valid, 'key={item.id}', 'key={index}'), '(item) =>', '(item, index) =>'),
			'eslint:react/no-array-index-key',
		],
		[
			'render aliased setter',
			mutate(
				valid,
				'return <section>',
				'const update = setValue;\n  update(1);\n  return <section>',
			),
			'render-phase-setter',
		],
		[
			'render member-wrapped setter',
			mutate(
				valid,
				'return <section>',
				'const updates = { run: setValue };\n  updates.run(1);\n  return <section>',
			),
			'render-phase-setter',
		],
		[
			'computed-member setter',
			mutate(
				valid,
				'return <section>',
				"const key = 'run'; ({ [key]: setValue })[key](1);\n  return <section>",
			),
			'render-phase-setter',
		],
		[
			'dynamic computed-member setter',
			mutate(
				valid,
				'return <section>',
				'const key = items[0]; ({ [key]: setValue })[key](1);\n  return <section>',
			),
			'render-phase-setter',
		],
		// Was a byte-identical copy of the 'computed-member setter' row above, name
		// and policy included (T018 F3, adjudicated by T021). Rewritten rather than
		// deleted, because the rewrite buys a branch no other row reaches: this is
		// the first row to combine identifier-object resolution
		// (custom-policies.ts:199-204) with a `constantString`-folded computed
		// access (:154-171). Its twin above resolves its object from an inline
		// ObjectExpression, so it never takes the identifier path; 'render
		// member-wrapped setter' takes the identifier path but with a static
		// property name, so it never folds a key.
		[
			'identifier-object computed-member setter',
			mutate(
				valid,
				'return <section>',
				"const updates = { run: setValue };\n  const key = 'run';\n  updates[key](1);\n  return <section>",
			),
			'render-phase-setter',
		],
		[
			'dynamic computed-member setter',
			mutate(
				valid,
				'return <section>',
				'const key = items[0]; ({ run: setValue })[key](1);\n  return <section>',
			),
			'render-phase-setter',
		],
		[
			'aliased setter',
			mutate(
				valid,
				'const nextValue = value + 1;\n    setValue(nextValue);',
				'const update = setValue;\n    update(value + 1);\n    update(value + 2);',
			),
			'one-call-per-setter',
		],
		[
			'member-wrapped setter',
			mutate(
				valid,
				'const nextValue = value + 1;\n    setValue(nextValue);',
				'const updates = { run: setValue };\n    updates.run(value + 1);\n    updates.run(value + 2);',
			),
			'one-call-per-setter',
		],
		[
			'helper-wrapped render setter',
			mutate(
				valid,
				'return <section>',
				'const update = () => setValue(1);\n  update();\n  return <section>',
			),
			'render-phase-setter',
		],
		['disable directive', `/* eslint-disable no-unused-vars */\n${valid}`, 'eslint-directive'],
		['enable directive', `/* eslint-enable no-unused-vars */\n${valid}`, 'eslint-directive'],
		['inline rule config', `/* eslint no-unused-vars: "off" */\n${valid}`, 'eslint-directive'],
		[
			'undisclosed require',
			mutate(valid, 'const [value', "const fs = require('node:fs'); fs;\n  const [value"),
			'undisclosed-import',
		],
		[
			'undisclosed dynamic import',
			mutate(valid, 'const [value', "import('elsewhere');\n  const [value"),
			'undisclosed-import',
		],
		[
			'dead expression',
			mutate(valid, 'return <section>', 'value;\n  return <section>'),
			'eslint:no-unused-expressions',
		],
		[
			'unreachable statement',
			mutate(
				valid,
				'return <section>',
				'if (items.length) return null;\n  return null;\n  value;\n  return <section>',
			),
			'eslint:no-unreachable',
		],
		[
			'hook after guard',
			mutate(valid, 'const [value', 'if (!items.length) return null;\n  const [value'),
			'hook-after-guard',
		],
		[
			'aliased useEffect',
			mutate(
				mutate(
					valid,
					'import { useState }',
					'import { useEffect as useSideEffect, useState }',
				),
				'const [value',
				'useSideEffect(() => {});\n  const [value',
			),
			'render-phase-effect',
		],
		[
			'aliased useLayoutEffect',
			mutate(
				mutate(
					valid,
					'import { useState }',
					'import { useLayoutEffect as layout, useState }',
				),
				'const [value',
				'layout(() => {});\n  const [value',
			),
			'render-phase-effect',
		],
		[
			'aliased useInsertionEffect',
			mutate(
				mutate(
					valid,
					'import { useState }',
					'import { useInsertionEffect as insert, useState }',
				),
				'const [value',
				'insert(() => {});\n  const [value',
			),
			'render-phase-effect',
		],
		// Was a byte-identical mutant and policy to the 'unused import' row at the top
		// of this table, under a second name (T018, adjudicated by T021). Rewritten
		// to the `!imported` branch of the react import allowlist
		// (custom-policies.ts:284-294): a default import produces an
		// ImportDefaultSpecifier, which has no `imported` name at all, so it takes a
		// different arm from every named-specifier row. 'forwardRef member' is the
		// only other row that reaches it, incidentally and while asserting
		// no-forwardRef instead.
		[
			'default React import',
			mutate(valid, 'import { useState }', 'import React, { useState }'),
			'react-import-allowlist',
		],
		[
			'forwardRef import',
			mutate(valid, 'useState }', 'forwardRef, useState }'),
			'no-forwardRef',
		],
		[
			'forwardRef member',
			`import { useState } from 'react'; import React from 'react';\n${valid.split('\n').slice(1).join('\n')}\nReact.forwardRef(() => null);`,
			'no-forwardRef',
		],
		[
			'string ref',
			mutate(valid, '<section>', '<section><div ref="legacy" />'),
			'no-forwardRef',
		],
		[
			'controlled input',
			mutate(valid, '<section>', '<section><input value={value} />'),
			'controlled-input',
		],
		[
			'onInput',
			mutate(valid, '<section>', '<section><input value={value} onInput={() => {}} />'),
			'on-input',
		],
		[
			'let in handler',
			mutate(valid, 'const nextValue = value + 1;', 'let nextValue = value + 1;'),
			'const-only-handlers',
		],
		[
			'two setter calls',
			mutate(
				valid,
				'setValue(nextValue);',
				'setValue(nextValue);\n    setValue(nextValue + 1);',
			),
			'one-call-per-setter',
		],
		[
			'helper-mediated two setter calls',
			mutate(
				mutate(
					valid,
					'const [value, setValue] = useState(0);',
					'const [value, setValue] = useState(0);\n  const updateTwice = () => { setValue(value + 1); setValue(value + 2); };',
				),
				'const nextValue = value + 1;\n    setValue(nextValue);',
				'updateTwice();',
			),
			'one-call-per-setter',
		],
		[
			'nonliteral direct state initial',
			mutate(valid, 'useState(0)', 'useState(items.length)'),
			'use-state-initializer',
		],
		[
			'lazy-wrapped literal initial',
			mutate(valid, 'useState(0)', 'useState(() => 0)'),
			'use-state-initializer',
		],
		[
			'leaked render',
			mutate(valid, '{items.map', '{items.length && items.map'),
			'eslint:react/jsx-no-leaked-render',
		],
		['missing map key', mutate(valid, ' key={item.id}', ''), 'key-required'],
		[
			'wrong component shape',
			mutate(valid, 'function Mutant({ items = [] })', 'const Mutant = ({ items = [] }) =>'),
			'component-shape',
		],
		[
			'visible ref',
			mutate(
				mutate(
					mutate(valid, 'useState }', 'useRef, useState }'),
					'const [value, setValue] = useState(0);',
					'const visible = useRef(0);\n  const [value, setValue] = useState(0);',
				),
				'<section>',
				'<section>{visible.current}',
			),
			'ref-visibility',
		],
		[
			'render-read setup ref',
			mutate(
				mutate(valid, 'useState }', 'useRef, useState }'),
				'const [value, setValue] = useState(0);',
				'const setupDone = useRef(null);\n  if (setupDone.current === null) setupDone.current = true;\n  const leaked = setupDone.current;\n  leaked;\n  const [value, setValue] = useState(0);',
			),
			'ref-visibility',
		],
		[
			'boolean setup guard',
			mutate(
				mutate(valid, 'useState }', 'useRef, useState }'),
				'const [value, setValue] = useState(0);',
				'const setupDone = useRef(null);\n  if (!setupDone.current) setupDone.current = true;\n  const [value, setValue] = useState(0);',
			),
			'ref-guard-shape',
		],
		[
			'null guard that never flips',
			mutate(
				mutate(valid, 'useState }', 'useRef, useState }'),
				'const [value, setValue] = useState(0);',
				'const setupDone = useRef(null);\n  if (setupDone.current === null) { console.log("setup"); }\n  const [value, setValue] = useState(0);',
			),
			'ref-guard-shape',
		],
		[
			'leaf currentTarget',
			mutate(
				valid,
				'<section>',
				'<section><input value={value} onChange={(event) => { const nextValue = event.currentTarget.value; setValue(nextValue); }} />',
			),
			'leaf-event-target',
		],
		[
			'wrong-object preventDefault',
			mutate(
				valid,
				'const nextValue = value + 1;',
				'const other = { preventDefault() {} };\n    other.preventDefault();\n    const nextValue = value + 1;',
			),
			'prevent-default-event',
		],
		['foreign import', `import value from 'elsewhere';\n${valid}`, 'undisclosed-import'],
	] as const satisfies readonly MutationCase[];

	const store = compositionSources.get('C2-shared')!;
	const slot = compositionSources.get('C1-slot')!;
	const refsSource = compositionSources.get('C3-ref')!;

	// The only search in this file that spans a line break over DISK-READ source,
	// and therefore the only one a CRLF checkout could defeat. T018 found it by
	// probing every disk-read search against a CRLF-ised copy; T007's repo-wide scan
	// had missed it because that scan looked for string literals and this is a regex.
	// `\r?\n` matches either checkout style and `$2` puts the file's own separator
	// back, so the mutant stays byte-faithful to whatever was read from disk - the
	// same repair T008 applied to Solid's S-SH7 row.
	//
	// Searches over `valid` need none of this: `valid` is an in-file template
	// literal, and ECMAScript normalises CRLF to LF inside template literals, so a
	// `\n` in a search over it matches on any checkout. That safety is a property of
	// the language, not of the search - it does not transfer to disk-read source.
	const STORE_HOOK_RECORD =
		/(useSyncExternalStore\([\s\S]*?,[\s\S]*?),(\r?\n)\s*cell === 'count'[\s\S]*?getCompositionSharedNothing,\r?\n\s*\);/;
	const STORE_HOOK_RECORD_TRUNCATED = '$1$2\t);';
	const pageArtifact = await buildEnrichedIr({
		filename: 'test/composition-fixtures/C2-page-mutation.tsrx',
		// Disk-read fixture source, mutated before it is compiled: the same silent-no-op
		// exposure as the emitted-source rows, so it takes the same constructor.
		source: mutate(
			await readFile(
				resolve(PACKAGE_ROOT, 'test/composition-fixtures/C2-shared.tsrx'),
				'utf8',
			),
			'scope: "container"',
			'scope: "page"',
		),
	});
	const projectionArtifact = await buildEnrichedIr({
		filename: 'test/composition-fixtures/C1-projection-mutation.tsrx',
		source: mutate(
			await readFile(resolve(PACKAGE_ROOT, 'test/composition-fixtures/C1-slot.tsrx'), 'utf8'),
			'<strong data-projected-node>Projected composition</strong>',
			'<strong data-projected-node>Projected composition</strong><em>absent</em>',
		),
	});
	const compositionMutationCases = [
		[
			'incomplete store hook record',
			mutate(store, STORE_HOOK_RECORD, STORE_HOOK_RECORD_TRUNCATED),
			'R-SH1',
		],
		['inline context object', mutate(store, 'value={store}', 'value={{ store }}'), 'R-SH2'],
		[
			'per-read snapshot rebuild',
			mutate(store, 'return countSnapshot;', 'return { value: countSnapshot };'),
			'R-SH3',
		],
		[
			'notify-per-write shared tear',
			mutate(
				store,
				"changed.add('count');",
				"for (const listener of countListeners) listener();\n\t\tchanged.add('count');",
			),
			'R-SH3',
		],
		[
			'helper-hidden notify-per-write shared tear',
			mutate(
				mutate(
					store,
					'const writeCount = (nextCount, changed) => {',
					'const notify = (listeners) => { for (const listener of listeners) listener(); };\n\tconst writeCount = (nextCount, changed) => {',
				),
				"changed.add('count');",
				"notify(countListeners);\n\t\tchanged.add('count');",
			),
			'R-SH3',
		],
		[
			'member-helper-hidden notify-per-write shared tear',
			mutate(
				mutate(
					store,
					'const writeCount = (nextCount, changed) => {',
					'const notifier = { run(listeners) { for (const listener of listeners) listener(); } };\n\tconst writeCount = (nextCount, changed) => {',
				),
				"changed.add('count');",
				"notifier.run(countListeners);\n\t\tchanged.add('count');",
			),
			'R-SH3',
		],
		// Was a byte-identical copy of the 'notify-per-write shared tear' row above,
		// under a name promising a shape that row ALREADY has - it iterates the
		// listener set directly. T018 read the name as a promise of something
		// unwritten; T021 corrected that, because writing 'direct listener
		// iteration' would have produced a third near-duplicate.
		//
		// Rewritten instead to the one notify shape nothing in either corpus
		// reached: the `.forEach(cb)` branch of invokesListenerSet
		// (custom-policies.ts:1133-1152), including its recursion into the callback.
		// With this row the R-SH3 notify family maps 1:1 onto the detector's four
		// branches - for-of, forEach, helper-forwarding, member-method helper -
		// which is the mapping a new corpus should inherit rather than a name list.
		[
			'forEach-hidden notify-per-write shared tear',
			mutate(
				store,
				"changed.add('count');",
				"countListeners.forEach((listener) => listener());\n\t\tchanged.add('count');",
			),
			'R-SH3',
		],
		[
			'per-render store identity',
			mutate(
				store,
				'const [store] = useState(createCompositionSharedStore);',
				'const store = createCompositionSharedStore();',
			),
			'R-SH3',
		],
		[
			'aliased per-render store identity',
			mutate(
				store,
				'const [store] = useState(createCompositionSharedStore);',
				'const indirectCreate = createCompositionSharedStore;\n\tconst store = indirectCreate();',
			),
			'R-SH3',
		],
		[
			'wrapper-function store identity',
			mutate(
				store,
				'const [store] = useState(createCompositionSharedStore);',
				'const indirectCreate = () => createCompositionSharedStore();\n\tconst [store] = useState(indirectCreate);',
			),
			'R-SH3',
		],
		[
			'container artifact with module store output',
			emit(pageArtifact),
			'R-SH4',
			{ artifact: compositionArtifacts.get('C2-shared')! },
		],
		[
			'shared hook naming leak',
			mutateAll(store, 'useCompositionShared', 'readCompositionShared'),
			'R-SH5',
		],
		['render-prop child synthesis', mutate(slot, '{children}', '{children()}'), 'R-CH1'],
		['dropped authored projection', slot, 'R-CH2', { artifact: projectionArtifact }],
		[
			'unrecorded useRef binding',
			mutate(
				refsSource,
				'const input = useRef(null);',
				'const input = useRef(null);\n\tconst unusedHandle = useRef(null);',
			),
			'R-RF1',
		],
		[
			'unresolved ref projection',
			mutate(refsSource, 'ref={input}', 'ref={input.current}'),
			'R-RF2',
		],
		[
			'unguarded imperative access',
			mutate(
				refsSource,
				/if \(input\.current !== null\) \{\s*input\.current\.focus\(\);\s*\}/,
				'input.current.focus();',
			),
			'R-RF3',
		],
		[
			'useImperativeHandle bypass',
			mutate(
				refsSource,
				'{ useCallback, useRef }',
				'{ useCallback, useImperativeHandle, useRef }',
			),
			'R-RF4',
		],
		[
			'compiler directive',
			mutate(slot, 'export function SlotPage', "'use memo';\nexport function SlotPage"),
			'R-CP1',
		],
	] as const satisfies readonly MutationCase[];

	test.each(mutationCases)('rejects the %s bypass mutation', async (_name, source, policy) => {
		expect(await policies(source)).toContain(policy);
	});

	test('unrecorded-with-artifact -> violation', async () => {
		const result = await checkSources([
			{
				file: 'generated/relative-import-parent.jsx',
				source: mutate(
					recordedRelativeImport,
					'./relative-import-child.jsx',
					'./unrecorded-child.jsx',
				),
				artifact: relativeImportArtifact,
			},
		]);
		expect(result.violations.map((entry) => entry.policy)).toContain('undisclosed-import');
	});

	test('recorded-without-artifact -> violation', async () => {
		const result = await checkSources([
			{ file: 'generated/relative-import-parent.jsx', source: recordedRelativeImport },
		]);
		expect(result.violations.map((entry) => entry.policy)).toContain('undisclosed-import');
		expect(result.unevaluated.map((entry) => entry.policy)).not.toContain('undisclosed-import');
	});

	test('recorded-with-artifact -> clean', async () => {
		const result = await checkSources([
			{
				file: 'generated/relative-import-parent.jsx',
				source: recordedRelativeImport,
				artifact: relativeImportArtifact,
			},
		]);
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
	});

	test('requires a pre-paint React landing for render-access persistence', async () => {
		const persistenceArtifact = withRenderPersistence(relativeImportArtifact, 'react');
		const validResult = await checkSources([
			{
				file: 'generated/relative-import-parent.jsx',
				source: recordedRelativeImport,
				artifact: persistenceArtifact,
			},
		]);
		expect(validResult.violations.map((entry) => entry.policy)).not.toContain(
			'persistence-render-lowering',
		);

		const [record] = persistenceArtifact.records.persistence;
		const mutantArtifact = {
			...persistenceArtifact,
			records: {
				...persistenceArtifact.records,
				persistence: [
					{
						...record,
						seed: { ...record.seed, lowering: 'eager-visible-task' },
					},
				],
			},
		} as unknown as EnrichedIR;
		const mutantResult = await checkSources([
			{
				file: 'generated/relative-import-parent.jsx',
				source: recordedRelativeImport,
				artifact: mutantArtifact,
			},
		]);
		expect(mutantResult.violations.map((entry) => entry.policy)).toContain(
			'persistence-render-lowering',
		);

		const absentResult = await checkSources([
			{ file: 'generated/relative-import-parent.jsx', source: recordedRelativeImport },
		]);
		expect(absentResult.unevaluated.map((entry) => entry.policy)).toContain(
			'persistence-render-lowering',
		);
	});

	test.each(compositionMutationCases)(
		'rejects the %s composition bypass mutation',
		// Parameters annotated explicitly. `as const` on the table makes each row a
		// distinct tuple type, so inferring these gives unions that vitest's
		// ExtractEachCallbackArgs cannot reconcile into one signature. The values
		// are assignable to these broader types, so nothing is loosened at runtime.
		async (
			_name: string,
			source: string,
			policy: string,
			options?: { readonly artifact?: EnrichedIR },
		) => {
			const result = await checkSources([
				{ file: 'generated-composition/Mutant.jsx', source, artifact: options?.artifact },
			]);
			expect(result.violations.map((entry) => entry.policy)).toContain(policy);
		},
	);

	// CALIBRATION for the mutation constructors themselves, not for the gate. A
	// helper nobody has watched fail is not evidence that it can fail - and the
	// failure it guards against is silent by construction, so nothing else in this
	// file would report it. Both the in-file fixture and a disk-read emitted source
	// are exercised, because only the second can drift without this file changing.
	// The other half of the mutation table's calibration, and it was missing: every
	// row asserts `toContain(policy)` on a MUTANT, which proves nothing unless the
	// unmutated fixture is clean. Solid asserts this (`policies(valid)` -> []); this
	// corpus never did, so a fixture that had drifted into violating a policy would
	// have made every row for that policy pass without mutating anything meaningful.
	// The checked-in generated corpus is already covered this way above; `valid` is
	// the in-file fixture and needs its own.
	test('CALIBRATION: the unmutated fixture violates nothing', async () => {
		expect(await policies(valid)).toEqual([]);
	});

	test('CALIBRATION: a mutation that leaves the source unchanged is loud', () => {
		expect(() => mutate(valid, 'text that is not in the Mutant fixture', 'x')).toThrow(
			/did not change the source/,
		);
		// The R-SH1 row is the one search here that spans a line break over disk-read
		// source. Prove it survives the line endings that broke Solid's S-SH7 row:
		// reverting `STORE_HOOK_RECORD` to plain `\n` turns this red.
		const crlf = store.replace(/\r?\n/g, '\r\n');
		expect(crlf).not.toBe(store);
		expect(mutate(crlf, STORE_HOOK_RECORD, STORE_HOOK_RECORD_TRUNCATED)).not.toBe(crlf);
		// And the mutant keeps the checkout's own separator rather than smuggling in LF.
		expect(mutate(crlf, STORE_HOOK_RECORD, STORE_HOOK_RECORD_TRUNCATED)).toContain('\r\n\t);');
		expect(() => mutateAll(store, 'text that is not in the C2-shared output', 'x')).toThrow(
			/did not change the source/,
		);
		// A search that matches but rewrites the text to itself is a non-mutant too:
		// the check is on the output, not on the search. The `toContain` is what stops
		// this case from passing for the wrong reason.
		expect(store).toContain('useSyncExternalStore');
		expect(() => mutate(store, 'useSyncExternalStore', 'useSyncExternalStore')).toThrow(
			/did not change the source/,
		);
	});

	test('has a mutation that exercises every published policy', () => {
		// Set<string>: inferring this narrows to the literal ids present in the
		// mutation tables, which then rejects both the add() below and the
		// has() check against the full policy list.
		const covered = new Set<string>(
			[...mutationCases, ...compositionMutationCases].map((entry) => entry[2]),
		);
		covered.add('persistence-render-lowering');
		expect(
			REACT_GATE_POLICIES.map((policy) => policy.id).filter((id) => !covered.has(id)),
		).toEqual([]);
	});

	test('discovers and gates every generated composition module with its fixture artifact', async () => {
		const files = await discoverGeneratedFiles({ directory: 'generated-composition' });
		expect(files).toEqual(compositionNames.map((name) => `generated-composition/${name}.jsx`));
		const result = await checkSources(
			files.map((file) => {
				const name = file.slice('generated-composition/'.length, -'.jsx'.length);
				return {
					file,
					source: compositionSources.get(name)!,
					artifact: compositionArtifacts.get(name)!,
				};
			}),
		);
		for (const name of compositionNames)
			expect(compositionSources.get(name)).toBe(
				await formatEmitted(emit(compositionArtifacts.get(name)!)),
			);
		expect(result.unevaluated).toEqual([]);
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
	});

	test('accepts every complete P3a shared lowering tier', async () => {
		const tierSources = [
			`import { shared, state } from "@markless/core";
			export const useValue = shared(() => { let value = state(1); return { value }; }, { scope: "container" });
			function Reader() @{ const sharedValue = useValue(); <output>{sharedValue.value}</output> }
			export function Page() @{ <Reader /> }`,
			`import { shared, state } from "@markless/core";
			export const useValue = shared(() => { let value = state(1); return { value }; }, { scope: "container" });
			export function Reader() @{ const sharedValue = useValue(); <output>{sharedValue.value}</output> }`,
			`import { shared, state } from "@markless/core";
			export const usePair = shared(() => { let left = state(1); let right = state(2); return { left, right }; }, { scope: "container" });
			export function Pair() @{ const pair = usePair(); <output>{pair.left}:{pair.right}</output> }`,
			`import { shared, state } from "@markless/core";
			export const usePageValue = shared(() => { let value = state(1); return { value, increment() { value++; } }; }, { scope: "page" });
			export function Reader() @{ const sharedValue = usePageValue(); <button onClick={() => sharedValue.increment()}>{sharedValue.value}</button> }`,
		] as const;
		const entries = await Promise.all(
			tierSources.map(async (source, index) => {
				const filename = `test/shared-tier-${index}.tsrx`;
				const artifact = await buildEnrichedIr({ filename, source });
				return {
					file: `generated-composition/shared-tier-${index}.jsx`,
					source: await formatEmitted(emit(artifact)),
					artifact,
				};
			}),
		);
		const result = await checkSources(entries);
		expect(result.unevaluated).toEqual([]);
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
	});

	test('a newly added generated file is discovered and cannot bypass the gate', async () => {
		// macOS tmpdir is a symlink (/var -> /private/var); ESLint compares realpaths
		// against cwd and silently ignores files that appear outside it.
		const root = await realpath(await mkdtemp(resolve(tmpdir(), 'frameless-react-gate-')));
		temporaryRoots.push(root);
		await mkdir(resolve(root, 'generated'));
		// Base no-unused-expressions does not flag `void` expressions; use a bare
		// literal expression, which it unambiguously reports.
		await writeFile(resolve(root, 'generated/New.jsx'), `${valid}\n0;\n`);
		const result = await checkGeneratedFiles({ cwd: root });
		expect(result.files).toEqual(['generated/New.jsx']);
		expect(result.violations.map((entry) => entry.policy)).toContain(
			'eslint:no-unused-expressions',
		);
	});

	test('checkGeneratedFiles rejects two setter calls in a temporary generated directory', async () => {
		const root = await realpath(
			await mkdtemp(resolve(tmpdir(), 'frameless-react-two-setter-')),
		);
		temporaryRoots.push(root);
		await mkdir(resolve(root, 'generated'));
		await writeFile(
			resolve(root, 'generated/TwoSetter.jsx'),
			mutate(
				valid,
				'setValue(nextValue);',
				'setValue(nextValue);\n    setValue(nextValue + 1);',
			),
		);
		const result = await checkGeneratedFiles({ cwd: root });
		expect(result.files).toEqual(['generated/TwoSetter.jsx']);
		expect(result.violations.map((entry) => entry.policy)).toContain('one-call-per-setter');
	});
});
