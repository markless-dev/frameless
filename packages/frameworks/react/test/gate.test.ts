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
			REACT_GATE_POLICIES.filter((policy) => policy.requiresArtifact).map(
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
			valid.replace('useState }', 'useMemo, useState }'),
			'react-import-allowlist',
		],
		[
			'React recommended rule',
			valid.replace('<section>', '<section class="bad">'),
			'eslint:react/no-unknown-property',
		],
		[
			'bare static attribute',
			valid.replace('<section>', '<section data-probe>'),
			'explicit-static-attribute-value',
		],
		[
			'Hooks recommended rule',
			valid
				.replace('import { useState }', 'import { useEffect, useState }')
				.replace(
					'const [value',
					'useEffect(() => { console.log(items); }, []);\n  const [value',
				),
			'eslint:react-hooks/exhaustive-deps',
		],
		[
			'index key AST',
			valid.replace('key={item.id}', 'key={index}').replace('(item) =>', '(item, index) =>'),
			'index-key',
		],
		[
			'index key plugin',
			valid.replace('key={item.id}', 'key={index}').replace('(item) =>', '(item, index) =>'),
			'eslint:react/no-array-index-key',
		],
		[
			'render aliased setter',
			valid.replace(
				'return <section>',
				'const update = setValue;\n  update(1);\n  return <section>',
			),
			'render-phase-setter',
		],
		[
			'render member-wrapped setter',
			valid.replace(
				'return <section>',
				'const updates = { run: setValue };\n  updates.run(1);\n  return <section>',
			),
			'render-phase-setter',
		],
		[
			'computed-member setter',
			valid.replace(
				'return <section>',
				"const key = 'run'; ({ [key]: setValue })[key](1);\n  return <section>",
			),
			'render-phase-setter',
		],
		[
			'dynamic computed-member setter',
			valid.replace(
				'return <section>',
				'const key = items[0]; ({ [key]: setValue })[key](1);\n  return <section>',
			),
			'render-phase-setter',
		],
		[
			'computed-member setter',
			valid.replace(
				'return <section>',
				"const key = 'run'; ({ [key]: setValue })[key](1);\n  return <section>",
			),
			'render-phase-setter',
		],
		[
			'dynamic computed-member setter',
			valid.replace(
				'return <section>',
				'const key = items[0]; ({ run: setValue })[key](1);\n  return <section>',
			),
			'render-phase-setter',
		],
		[
			'aliased setter',
			valid.replace(
				'const nextValue = value + 1;\n    setValue(nextValue);',
				'const update = setValue;\n    update(value + 1);\n    update(value + 2);',
			),
			'one-call-per-setter',
		],
		[
			'member-wrapped setter',
			valid.replace(
				'const nextValue = value + 1;\n    setValue(nextValue);',
				'const updates = { run: setValue };\n    updates.run(value + 1);\n    updates.run(value + 2);',
			),
			'one-call-per-setter',
		],
		[
			'helper-wrapped render setter',
			valid.replace(
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
			valid.replace('const [value', "const fs = require('node:fs'); fs;\n  const [value"),
			'undisclosed-import',
		],
		[
			'undisclosed dynamic import',
			valid.replace('const [value', "import('elsewhere');\n  const [value"),
			'undisclosed-import',
		],
		[
			'dead expression',
			valid.replace('return <section>', 'value;\n  return <section>'),
			'eslint:no-unused-expressions',
		],
		[
			'unreachable statement',
			valid.replace(
				'return <section>',
				'if (items.length) return null;\n  return null;\n  value;\n  return <section>',
			),
			'eslint:no-unreachable',
		],
		[
			'hook after guard',
			valid.replace('const [value', 'if (!items.length) return null;\n  const [value'),
			'hook-after-guard',
		],
		[
			'aliased useEffect',
			valid
				.replace('import { useState }', 'import { useEffect as useSideEffect, useState }')
				.replace('const [value', 'useSideEffect(() => {});\n  const [value'),
			'render-phase-effect',
		],
		[
			'aliased useLayoutEffect',
			valid
				.replace('import { useState }', 'import { useLayoutEffect as layout, useState }')
				.replace('const [value', 'layout(() => {});\n  const [value'),
			'render-phase-effect',
		],
		[
			'aliased useInsertionEffect',
			valid
				.replace('import { useState }', 'import { useInsertionEffect as insert, useState }')
				.replace('const [value', 'insert(() => {});\n  const [value'),
			'render-phase-effect',
		],
		[
			'react import allowlist',
			valid.replace('useState }', 'useMemo, useState }'),
			'react-import-allowlist',
		],
		[
			'forwardRef import',
			valid.replace('useState }', 'forwardRef, useState }'),
			'no-forwardRef',
		],
		[
			'forwardRef member',
			`import { useState } from 'react'; import React from 'react';\n${valid.split('\n').slice(1).join('\n')}\nReact.forwardRef(() => null);`,
			'no-forwardRef',
		],
		[
			'string ref',
			valid.replace('<section>', '<section><div ref="legacy" />'),
			'no-forwardRef',
		],
		[
			'controlled input',
			valid.replace('<section>', '<section><input value={value} />'),
			'controlled-input',
		],
		[
			'onInput',
			valid.replace('<section>', '<section><input value={value} onInput={() => {}} />'),
			'on-input',
		],
		[
			'let in handler',
			valid.replace('const nextValue = value + 1;', 'let nextValue = value + 1;'),
			'const-only-handlers',
		],
		[
			'two setter calls',
			valid.replace(
				'setValue(nextValue);',
				'setValue(nextValue);\n    setValue(nextValue + 1);',
			),
			'one-call-per-setter',
		],
		[
			'helper-mediated two setter calls',
			valid
				.replace(
					'const [value, setValue] = useState(0);',
					'const [value, setValue] = useState(0);\n  const updateTwice = () => { setValue(value + 1); setValue(value + 2); };',
				)
				.replace(
					'const nextValue = value + 1;\n    setValue(nextValue);',
					'updateTwice();',
				),
			'one-call-per-setter',
		],
		[
			'nonliteral direct state initial',
			valid.replace('useState(0)', 'useState(items.length)'),
			'use-state-initializer',
		],
		[
			'lazy-wrapped literal initial',
			valid.replace('useState(0)', 'useState(() => 0)'),
			'use-state-initializer',
		],
		[
			'leaked render',
			valid.replace('{items.map', '{items.length && items.map'),
			'eslint:react/jsx-no-leaked-render',
		],
		['missing map key', valid.replace(' key={item.id}', ''), 'key-required'],
		[
			'wrong component shape',
			valid.replace('function Mutant({ items = [] })', 'const Mutant = ({ items = [] }) =>'),
			'component-shape',
		],
		[
			'visible ref',
			valid
				.replace('useState }', 'useRef, useState }')
				.replace(
					'const [value, setValue] = useState(0);',
					'const visible = useRef(0);\n  const [value, setValue] = useState(0);',
				)
				.replace('<section>', '<section>{visible.current}'),
			'ref-visibility',
		],
		[
			'render-read setup ref',
			valid
				.replace('useState }', 'useRef, useState }')
				.replace(
					'const [value, setValue] = useState(0);',
					'const setupDone = useRef(null);\n  if (setupDone.current === null) setupDone.current = true;\n  const leaked = setupDone.current;\n  leaked;\n  const [value, setValue] = useState(0);',
				),
			'ref-visibility',
		],
		[
			'boolean setup guard',
			valid
				.replace('useState }', 'useRef, useState }')
				.replace(
					'const [value, setValue] = useState(0);',
					'const setupDone = useRef(null);\n  if (!setupDone.current) setupDone.current = true;\n  const [value, setValue] = useState(0);',
				),
			'ref-guard-shape',
		],
		[
			'null guard that never flips',
			valid
				.replace('useState }', 'useRef, useState }')
				.replace(
					'const [value, setValue] = useState(0);',
					'const setupDone = useRef(null);\n  if (setupDone.current === null) { console.log("setup"); }\n  const [value, setValue] = useState(0);',
				),
			'ref-guard-shape',
		],
		[
			'leaf currentTarget',
			valid.replace(
				'<section>',
				'<section><input value={value} onChange={(event) => { const nextValue = event.currentTarget.value; setValue(nextValue); }} />',
			),
			'leaf-event-target',
		],
		[
			'wrong-object preventDefault',
			valid.replace(
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
	const pageArtifact = await buildEnrichedIr({
		filename: 'test/composition-fixtures/C2-page-mutation.tsrx',
		source: (
			await readFile(
				resolve(PACKAGE_ROOT, 'test/composition-fixtures/C2-shared.tsrx'),
				'utf8',
			)
		).replace('scope: "container"', 'scope: "page"'),
	});
	const projectionArtifact = await buildEnrichedIr({
		filename: 'test/composition-fixtures/C1-projection-mutation.tsrx',
		source: (
			await readFile(resolve(PACKAGE_ROOT, 'test/composition-fixtures/C1-slot.tsrx'), 'utf8')
		).replace(
			'<strong data-projected-node>Projected composition</strong>',
			'<strong data-projected-node>Projected composition</strong><em>absent</em>',
		),
	});
	const compositionMutationCases = [
		[
			'incomplete store hook record',
			store.replace(
				/(useSyncExternalStore\([\s\S]*?,[\s\S]*?),\n\s*cell === 'count'[\s\S]*?getCompositionSharedNothing,\n\s*\);/,
				'$1\n\t);',
			),
			'R-SH1',
		],
		['inline context object', store.replace('value={store}', 'value={{ store }}'), 'R-SH2'],
		[
			'per-read snapshot rebuild',
			store.replace('return countSnapshot;', 'return { value: countSnapshot };'),
			'R-SH3',
		],
		[
			'notify-per-write shared tear',
			store.replace(
				"changed.add('count');",
				"for (const listener of countListeners) listener();\n\t\tchanged.add('count');",
			),
			'R-SH3',
		],
		[
			'helper-hidden notify-per-write shared tear',
			store
				.replace(
					'const writeCount = (nextCount, changed) => {',
					'const notify = (listeners) => { for (const listener of listeners) listener(); };\n\tconst writeCount = (nextCount, changed) => {',
				)
				.replace("changed.add('count');", "notify(countListeners);\n\t\tchanged.add('count');"),
			'R-SH3',
		],
		[
			'member-helper-hidden notify-per-write shared tear',
			store
				.replace(
					'const writeCount = (nextCount, changed) => {',
					'const notifier = { run(listeners) { for (const listener of listeners) listener(); } };\n\tconst writeCount = (nextCount, changed) => {',
				)
				.replace(
					"changed.add('count');",
					"notifier.run(countListeners);\n\t\tchanged.add('count');",
				),
			'R-SH3',
		],
		[
			'direct listener iteration notify-per-write shared tear',
			store.replace(
				"changed.add('count');",
				"for (const listener of countListeners) listener();\n\t\tchanged.add('count');",
			),
			'R-SH3',
		],
		[
			'per-render store identity',
			store.replace(
				'const [store] = useState(createCompositionSharedStore);',
				'const store = createCompositionSharedStore();',
			),
			'R-SH3',
		],
		[
			'aliased per-render store identity',
			store.replace(
				'const [store] = useState(createCompositionSharedStore);',
				'const indirectCreate = createCompositionSharedStore;\n\tconst store = indirectCreate();',
			),
			'R-SH3',
		],
		[
			'wrapper-function store identity',
			store.replace(
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
			store.replaceAll('useCompositionShared', 'readCompositionShared'),
			'R-SH5',
		],
		['render-prop child synthesis', slot.replace('{children}', '{children()}'), 'R-CH1'],
		['dropped authored projection', slot, 'R-CH2', { artifact: projectionArtifact }],
		[
			'unrecorded useRef binding',
			refsSource.replace(
				'const input = useRef(null);',
				'const input = useRef(null);\n\tconst unusedHandle = useRef(null);',
			),
			'R-RF1',
		],
		[
			'unresolved ref projection',
			refsSource.replace('ref={input}', 'ref={input.current}'),
			'R-RF2',
		],
		[
			'unguarded imperative access',
			refsSource.replace(
				/if \(input\.current !== null\) \{\s*input\.current\.focus\(\);\s*\}/,
				'input.current.focus();',
			),
			'R-RF3',
		],
		[
			'useImperativeHandle bypass',
			refsSource.replace(
				'{ useCallback, useRef }',
				'{ useCallback, useImperativeHandle, useRef }',
			),
			'R-RF4',
		],
		[
			'compiler directive',
			slot.replace('export function SlotPage', "'use memo';\nexport function SlotPage"),
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
				source: recordedRelativeImport.replace(
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
		async (_name, source, policy, options) => {
			const result = await checkSources([
				{ file: 'generated-composition/Mutant.jsx', source, artifact: options?.artifact },
			]);
			expect(result.violations.map((entry) => entry.policy)).toContain(policy);
		},
	);

	test('has a mutation that exercises every published policy', () => {
		const covered = new Set(
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
			valid.replace(
				'setValue(nextValue);',
				'setValue(nextValue);\n    setValue(nextValue + 1);',
			),
		);
		const result = await checkGeneratedFiles({ cwd: root });
		expect(result.files).toEqual(['generated/TwoSetter.jsx']);
		expect(result.violations.map((entry) => entry.policy)).toContain('one-call-per-setter');
	});
});
