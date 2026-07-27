import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'pathe';
import { afterEach, describe, expect, test } from 'vitest';
import {
	buildEnrichedIr,
	type EnrichedIR,
	type FramelessPersistenceRecord,
} from '@frameless/compiler';
import {
	checkGeneratedFiles,
	checkSources,
	discoverGeneratedFiles,
	SOLID_GATE_POLICIES,
} from '../src/gate/index.ts';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const temporaryRoots: string[] = [];
const packageRoot = resolve(import.meta.dirname, '..');
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
	compositionArtifacts.set(
		name,
		await buildEnrichedIr({
			filename,
			source: await readFile(resolve(packageRoot, filename), 'utf8'),
		}),
	);
	compositionSources.set(
		name,
		await readFile(resolve(packageRoot, `generated-composition/${name}.jsx`), 'utf8'),
	);
}
afterEach(async () =>
	Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

const valid = `import { createSignal, untrack, For, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
export function Mutant(props) {
  const [items, setItems] = createStore(untrack(() => props.items));
  const [value, setValue] = createSignal(0);
  const label = () => props.label;
  return <section><Show when={props.visible}><span>{label()}</span></Show><input value={value()} attr:value={value()} onInput={(event) => setValue(Number(event.currentTarget.value))} /><ul><For each={items}>{(item) => <li>{item.id}<button onClick={() => setItems(reconcile([], { key: 'id' }))}>clear</button></li>}</For></ul></section>;
}`;

async function policies(source: string, artifact?: EnrichedIR): Promise<string[]> {
	const result = await checkSources([{ file: 'generated/Mutant.jsx', source, artifact }]);
	expect(
		result.violations.every((entry) =>
			/^(?:T003 ruling \d+|T004 §3\.2 S-[A-Z]+\d+|T002-persistence-architecture Decision 6)$/.test(
				entry.dossierRef,
			),
		),
	).toBe(true);
	return result.violations.map((entry) => entry.policy);
}

function withRenderPersistence(
	artifact: EnrichedIR,
	target: 'react' | 'solid',
): EnrichedIR {
	const binding =
		artifact.records.bindings.find((candidate) => candidate.kind === 'state') ??
		artifact.records.sharedDefinitions
			.flatMap((definition) => definition.cells)
			.find((candidate) => candidate.kind === 'state');
	if (!binding) throw new Error('Persistence gate fixture requires a state binding');
	const graphNodeId = 'id' in binding ? binding.id : binding.graphNodeId;
	const persistence: FramelessPersistenceRecord = {
		version: 'frameless-persistence-record/1',
		graphNodeId,
		moduleId: artifact.filename,
		bindingName: binding.name,
		driver: 'localStorage',
		key: {
			origin: 'derived',
			sourceIdentifier: binding.name,
			literal: `markless:${binding.name}`,
			bakedAtCompileTime: true,
		},
		authoredInitial: 'light',
		antiFlashAttribute: `data-markless-${binding.name}`,
		access: { render: true, handler: true },
		seed: {
			lowering: 'pre-paint',
			readFailure: 'authored-initial',
			corruptedValue: 'authored-initial',
			landings: [
				{
					target,
					kind: 'sync-read-seed-slot',
					graphNodeId,
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

describe('Solid dossier gate', async () => {
	const relativeImportArtifact = await buildEnrichedIr({
		filename: 'test/relative-import-parent.tsrx',
		source: `import { Child } from "./relative-import-child.tsrx";
			export function Parent() @{ <Child /> }`,
	});
	const recordedRelativeImport = await formatEmitted(emit(relativeImportArtifact));

	test('publishes a dossier reference on every policy', () => {
		expect(
			SOLID_GATE_POLICIES.every((policy) =>
				/^(?:T003 ruling \d+|T004 §3\.2 S-[A-Z]+\d+|T002-persistence-architecture Decision 6)$/.test(
					policy.dossierRef,
				),
			),
		).toBe(true);
		expect(
			// requiresArtifact is present on only some members of the policy union.
			SOLID_GATE_POLICIES.filter(
				(policy) => 'requiresArtifact' in policy && policy.requiresArtifact,
			).map(
				(policy) => policy.id,
			),
		).toEqual([
			'persistence-render-lowering',
			'S-CH5',
			'S-SH3',
			'S-SH4',
			'S-SH7',
			'S-RF5',
			'S-RF7',
		]);
	});

	test('discovers and accepts every checked-in generated component', async () => {
		expect(await discoverGeneratedFiles()).toEqual([
			'generated/S1.jsx',
			'generated/S2.jsx',
			'generated/S3.jsx',
		]);
		const result = await checkGeneratedFiles();
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
		for (const file of result.files)
			expect(await readFile(resolve(import.meta.dirname, '..', file), 'utf8')).toContain(
				'@generated by @frameless/solid',
			);
	});

	const mutationCases = [
		['disable directive', `/* eslint-disable */\n${valid}`, 'eslint-directive'],
		['foreign import', `import value from 'elsewhere';\n${valid}`, 'undisclosed-import'],
		[
			'require',
			valid.replace('const label', "require('elsewhere');\n  const label"),
			'undisclosed-import',
		],
		[
			'dynamic import',
			valid.replace('const label', "import('elsewhere');\n  const label"),
			'undisclosed-import',
		],
		[
			'createMemo import',
			valid.replace('createSignal,', 'createMemo, createSignal,'),
			'solid-import-allowlist',
		],
		[
			'object signal',
			valid.replace('createSignal(0)', 'createSignal({ value: 0 })'),
			'cell-type',
		],
		[
			'lazy object signal',
			valid.replace('createSignal(0)', 'createSignal(() => ({ value: 0 }))'),
			'cell-type',
		],
		[
			'untrack-wrapped array signal',
			valid.replace('createSignal(0)', 'createSignal(untrack(() => []))'),
			'cell-type',
		],
		[
			'nested helper with malformed signal write',
			valid.replace(
				'onInput={(event) => setValue(Number(event.currentTarget.value))}',
				'onInput={() => { const write = () => setValue(); write(); }}',
			),
			'signal-write-shape',
		],
		[
			'nested helper with raw store write',
			valid.replace(
				"onClick={() => setItems(reconcile([], { key: 'id' }))}",
				'onClick={() => { const actions = { write: () => setItems([]) }; actions.write(); }}',
			),
			'store-write-shape',
		],
		[
			'structural ternary',
			valid.replace('<section>', '<section>{props.visible ? <i /> : <b />}'),
			'structural-ternary',
		],
		['Show without when', valid.replace(' when={props.visible}', ''), 'show-two-arm'],
		[
			'Show with empty-fragment fallback',
			valid.replace(' when={props.visible}', ' when={props.visible} fallback={<></>}'),
			'show-two-arm',
		],
		[
			'duplicated Show arms',
			valid.replace(
				'<Show when={props.visible}><span>{label()}</span></Show>',
				'<Show when={props.visible} fallback={<ul><For each={items}>{(item) => <li>{item.id}</li>}</For></ul>}><span>{label()}</span><ul><For each={items}>{(item) => <li>{item.id}</li>}</For></ul></Show>',
			),
			'show-two-arm',
		],
		['missing attr value', valid.replace(' attr:value={value()}', ''), 'controlled-input'],
		[
			'React text event',
			valid.replace('onInput={(event)', 'onChange={(event)'),
			'controlled-input',
		],
		[
			'collection accessor in row',
			valid.replace('{item.id}<button', '{items() && item.id}<button'),
			'collection-accessor-in-row',
		],
		[
			'stop propagation',
			valid.replace(
				'onInput={(event) => setValue(Number(event.currentTarget.value))}',
				'onInput={(event) => { event.stopPropagation(); setValue(Number(event.currentTarget.value)); }}',
			),
			'stop-propagation',
		],
		[
			'props destructure',
			valid.replace(
				'const [items',
				'const { items: frozen } = props; frozen;\n  const [items',
			),
			'props-destructure',
		],
		[
			'raw prop initializer',
			valid.replace('untrack(() => props.items)', 'props.items'),
			'untrack-once-capture',
		],
		[
			'untrack capture with a parameter',
			valid.replace('untrack(() => props.items)', 'untrack((tracked) => props.items)'),
			'untrack-capture-shape',
		],
		['wrong reconcile key', valid.replace("key: 'id'", "key: 'missingKey'"), 'reconcile-key'],
		[
			'React className',
			valid.replace('<section>', '<section className="bad">'),
			'react-specific-props',
		],
		[
			'destructured component param',
			valid.replace('function Mutant(props)', 'function Mutant({ items })'),
			'component-shape',
		],
		[
			'For index accessor',
			valid.replace('(item) =>', '(item, index) =>').replace('{item.id}', '{index()}'),
			'index-accessor',
		],
		[
			'map render',
			valid.replace(
				"<For each={items}>{(item) => <li>{item.id}<button onClick={() => setItems(reconcile([], { key: 'id' }))}>clear</button></li>}</For>",
				'{items.map((item) => <li>{item.id}</li>)}',
			),
			'map-render',
		],
		[
			'setup setter',
			valid.replace('const label', 'setValue(1);\n  const label'),
			'render-phase-setter',
		],
		[
			'setup helper setter',
			valid.replace(
				'const label',
				'const update = () => setValue(1); update();\n  const label',
			),
			'render-phase-setter',
		],
		[
			'inline-object setter call',
			valid.replace('const label', '({ run: setValue }).run(1);\n  const label'),
			'render-phase-setter',
		],
		[
			'computed-member setter',
			valid.replace(
				'const label',
				"const key = 'run'; ({ [key]: setValue })[key](1);\n  const label",
			),
			'render-phase-setter',
		],
		[
			'dynamic computed-member setter',
			valid.replace(
				'const label',
				'const key = props.label; ({ [key]: setValue })[key](1);\n  const label',
			),
			'render-phase-setter',
		],
		[
			'dynamic-access static-member setter',
			valid.replace(
				'const label',
				'const key = props.action; ({ run: setValue })[key](1);\n  const label',
			),
			'render-phase-setter',
		],
		[
			'effect alias',
			valid
				.replace('createSignal,', 'createEffect as side, createSignal,')
				.replace('const label', 'side(() => props.label);\n  const label'),
			'render-phase-effect',
		],
		[
			'wrong preventDefault object',
			valid.replace(
				'onInput={(event) => setValue(Number(event.currentTarget.value))}',
				'onInput={(event) => { props.preventDefault(); setValue(Number(event.currentTarget.value)); }}',
			),
			'prevent-default-event',
		],
		[
			'leaf event target',
			valid.replace('event.currentTarget.value', 'event.target.value'),
			'leaf-event-target',
		],
		[
			'unused binding',
			valid.replace('const label', 'const unused = 1;\n  const label'),
			'eslint:no-unused-vars',
		],
		[
			'dead expression',
			valid.replace('const label', 'props.label;\n  const label'),
			'eslint:no-unused-expressions',
		],
		[
			'unreachable statement',
			valid.replace('const label', 'return null;\n  props.label;\n  const label'),
			'eslint:no-unreachable',
		],
	] as const;

	/**
	 * Mutation constructor that refuses to silently produce a non-mutant.
	 *
	 * `String.prototype.replace` promises to return a string, NOT to have matched.
	 * When the search literal misses, it returns the input unchanged with no error,
	 * and the row below then asserts a gate policy against source the gate has every
	 * right to accept. That is a green vacuum, not a passing test - it was defect 3's
	 * cause B on Windows (defects-and-targets T006/T007), where the CRLF checkout made
	 * the S-SH7 search literal unmatchable and the assertion measured nothing.
	 *
	 * The pattern is the one already used at
	 * `packages/compiler/test/metamorphic.test.ts:79` - `not.toBe(original)`. Applied
	 * here to the one row whose search literal spans a line break; the corpus-wide
	 * conversion of all three gate suites is its own package (T018), because every
	 * mutation it turns up as already-vacuous needs individual adjudication.
	 */
	function mutate(source: string, search: string | RegExp, replacement: string): string {
		const mutated = source.replace(search, replacement);
		if (mutated === source) {
			throw new Error(
				`gate mutation did not match ${String(search)} - the source is unchanged, ` +
					'so this row would assert a policy against a non-mutant',
			);
		}
		return mutated;
	}

	// The only search pattern in this file that spans a line break, and therefore the
	// only one a CRLF checkout could silently defeat. `\r?\n` matches either checkout
	// style and `$1` puts the file's own separator back, so the mutant stays
	// byte-faithful to whatever was read from disk.
	const SHARED_METHOD_ORDER =
		/setHistory\(`\$\{history\(\)\}:\$\{count\(\)\}`\);(\r?\n\t*)setCount\(count\(\) \+ 1\);/;
	const SHARED_METHOD_ORDER_SWAPPED =
		'setCount(count() + 1);$1setHistory(`${history()}:${count()}`);';

	const slot = compositionSources.get('C1-slot')!;
	const shared = compositionSources.get('C2-shared')!;
	const refs = compositionSources.get('C3-ref')!;
	const attach = compositionSources.get('C4-attach')!;
	const props = compositionSources.get('C5-props')!;
	const page = compositionSources.get('C8-page-store')!;
	const compositionMutationCases = [
		['synthesized children prop', slot.replace('<Frame>', '<Frame children={<i />}>'), 'S-CH1'],
		[
			'wrapped single projection',
			slot.replace('{props.children}', 'String(props.children)'),
			'S-CH2',
		],
		[
			'duplicated direct projection',
			slot.replace('{props.children}', '{props.children}{props.children}'),
			'S-CH3',
		],
		['called default slot', slot.replace('{props.children}', '{props.children()}'), 'S-CH4'],
		[
			'artifact projection drift',
			slot.replace('Projected composition', 'Changed projection'),
			'S-CH5',
			compositionArtifacts.get('C1-slot'),
		],
		[
			'missing context read',
			shared.replace('useContext(CompositionSharedContext)', 'useContext()'),
			'S-SH1',
		],
		[
			'aggregate primitive for scalar',
			shared.replace('createSignal(0)', 'createStore(0)'),
			'S-SH2',
		],
		[
			'missing page singleton',
			page.replace(
				'const pageLedgerShared = createPageLedgerShared();',
				'const pageLedgerShared = {};',
			),
			'S-SH3',
			compositionArtifacts.get('C8-page-store'),
		],
		[
			'missing provider',
			shared.replaceAll('CompositionSharedContext.Provider', 'section'),
			'S-SH4',
			compositionArtifacts.get('C2-shared'),
		],
		[
			'container creator alias at module scope',
			shared.replace(
				'const CompositionSharedContext',
				'const createAlias = createCompositionShared;\nconst illicitShared = createAlias();\nconst CompositionSharedContext',
			),
			'S-SH4',
			compositionArtifacts.get('C2-shared'),
		],
		[
			'member-extracted container creator at module scope',
			props
				.replace('value={value}', 'value={leaked}')
				.replace(
					'const PropsValueContext',
					'const leaked = ({ make: createPropsValueShared }).make();\nconst PropsValueContext',
				),
			'S-SH4',
			compositionArtifacts.get('C5-props'),
		],
		[
			'wrapped member-extracted container creator at module scope',
			props
				.replace('value={value}', 'value={leaked}')
				.replace(
					'const PropsValueContext',
					'const wrap = (factory) => ({ make: factory });\nconst leaked = wrap(createPropsValueShared).make();\nconst PropsValueContext',
				),
			'S-SH4',
			compositionArtifacts.get('C5-props'),
		],
		[
			'rebuilt provider value',
			shared.replace('value={value}', 'value={createCompositionShared()}'),
			'S-SH5',
		],
		[
			'owner primitive in page creator',
			page.replace(
				'function createPageLedgerShared() {',
				'function createPageLedgerShared() {\n\tcreateEffect(() => {});',
			),
			'S-SH6',
		],
		[
			'shared method order drift',
			// `mutate` is what makes the row honest on every platform: a miss now
			// throws instead of asserting S-SH7 against unmutated source.
			mutate(shared, SHARED_METHOD_ORDER, SHARED_METHOD_ORDER_SWAPPED),
			'S-SH7',
			compositionArtifacts.get('C2-shared'),
		],
		[
			'unbound handle declaration',
			refs.replace('let input;', 'let input;\n\tlet spare;'),
			'S-RF1',
		],
		[
			'authored attach attribute leak',
			refs.replace('ref={(node)', 'attach={(node)'),
			'S-RF2',
		],
		[
			'setter callback ref',
			refs.replace('(node) => (input = node)', '(node) => setInput(node)'),
			'S-RF3',
		],
		['unguarded handle call', refs.replace('input?.focus()', 'input.focus()'), 'S-RF4'],
		[
			'dropped directive consumption',
			attach.replace(' ref={attachHost}', ''),
			'S-RF5',
			compositionArtifacts.get('C4-attach'),
		],
		[
			'directive reinstall omitted',
			attach.replace('createEffect(() => {', 'runEffect(() => {'),
			'S-RF6',
		],
		[
			'cleanup order drift',
			attach.replace(
				/`cleanup:B:\$\{behaviorInputInput\}`,\s*`cleanup:A:\$\{behaviorInputInput\}`/,
				'`cleanup:A:${behaviorInputInput}`, `cleanup:B:${behaviorInputInput}`',
			),
			'S-RF7',
			compositionArtifacts.get('C4-attach'),
		],
	] as const;

	test.each(mutationCases)('rejects the %s bypass mutation', async (_name, source, policy) => {
		expect(await policies(source)).toContain(policy);
	});

	test('accepts identifier props parameters uniformly and rejects destructured shapes', async () => {
		expect(await policies(valid)).toEqual([]);
		expect(await policies(valid.replaceAll('props', 'props2'))).toEqual([]);
		expect(
			await policies(valid.replace('function Mutant(props)', 'function Mutant({ items })')),
		).toContain('component-shape');
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

	test('requires a pre-paint Solid landing for render-access persistence', async () => {
		const artifact = compositionArtifacts.get('C2-shared')!;
		const source = compositionSources.get('C2-shared')!;
		const persistenceArtifact = withRenderPersistence(artifact, 'solid');
		const validResult = await checkSources([
			{
				file: 'generated-composition/C2-shared.jsx',
				source,
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
				file: 'generated-composition/C2-shared.jsx',
				source,
				artifact: mutantArtifact,
			},
		]);
		expect(mutantResult.violations.map((entry) => entry.policy)).toContain(
			'persistence-render-lowering',
		);

		const absentResult = await checkSources([
			{ file: 'generated-composition/C2-shared.jsx', source },
		]);
		expect(absentResult.unevaluated.map((entry) => entry.policy)).toContain(
			'persistence-render-lowering',
		);
	});

	test.each(compositionMutationCases)(
		'rejects the %s composition bypass mutation',
		// Parameters annotated explicitly: `as const` on the table makes each row a
		// distinct tuple type, so inferring these yields unions that vitest's
		// ExtractEachCallbackArgs cannot reconcile into one signature. The values
		// are assignable to these broader types, so nothing loosens at runtime.
		async (
			_name: string,
			source: string,
			policy: string,
			artifact?: EnrichedIR,
		) => {
			expect(await policies(source, artifact)).toContain(policy);
		},
	);

	// CALIBRATION for the mutation constructor itself, not for the gate. Defect 3's
	// cause B was a harness that could not report its own failure: on a CRLF checkout
	// the S-SH7 search literal missed, `replace` returned the fixture unchanged, and
	// the row asserted a policy against a non-mutant while staying green. Both halves
	// of the repair are witnessed here - a miss is now loud, and the pattern survives
	// the line endings that broke it. Reproduce the original failure by reverting
	// `SHARED_METHOD_ORDER` to the `\n\t\t` literal: the second expectation goes red.
	test('CALIBRATION: a mutation that fails to match is loud, and S-SH7 survives CRLF', () => {
		expect(() => mutate(shared, 'text that is not in the C2-shared fixture', 'x')).toThrow(
			/did not match/,
		);
		const crlf = shared.replace(/\r?\n/g, '\r\n');
		expect(crlf).not.toBe(shared);
		expect(mutate(crlf, SHARED_METHOD_ORDER, SHARED_METHOD_ORDER_SWAPPED)).not.toBe(crlf);
		// The mutant keeps the checkout's own separator rather than smuggling in LF.
		expect(mutate(crlf, SHARED_METHOD_ORDER, SHARED_METHOD_ORDER_SWAPPED)).toContain(
			'setCount(count() + 1);\r\n\t\tsetHistory(',
		);
	});

	test('has a syntactically valid mutation for every published policy', () => {
		const covered = new Set<string>(
			[...mutationCases, ...compositionMutationCases].map((entry) => entry[2]),
		);
		covered.add('persistence-render-lowering');
		expect(
			SOLID_GATE_POLICIES.map((policy) => policy.id).filter((id) => !covered.has(id)),
		).toEqual([]);
	});

	test('discovers and gates every generated composition module with artifact provenance', async () => {
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
		expect(result.unevaluated).toEqual([]);
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
	});

	test('Show duplication is judged at any depth, not by outer-wrapper identity', async () => {
		// PM adjudication (2026-07-20, confirm-critique follow-up): arms must share NO
		// identical element subtree at any depth — an identical keyed list duplicated
		// under differing wrappers is still the T003 ruling-5 duplication. A leaf that
		// differs breaks the match, so distinct-content arms stay clean.
		const arms = (fallback: string, children: string) =>
			valid.replace(
				'<Show when={props.visible}><span>{label()}</span></Show>',
				`<Show when={props.visible} fallback={${fallback}}><span>{label()}</span>${children}</Show>`,
			);
		const list = '<ul><For each={items}>{(item) => <li>{item.id}</li>}</For></ul>';
		const wrapped =
			'<ul data-arm="else"><For each={items}>{(item) => <li>{item.id}</li>}</For></ul>';
		const distinct =
			'<ul><For each={items}>{(item) => <li data-arm="else">{item.id}</li>}</For></ul>';
		expect(await policies(arms(wrapped, list))).toContain('show-two-arm');
		expect(await policies(arms(distinct, list))).not.toContain('show-two-arm');
	});

	test('eslint-plugin-solid recommended is active', async () => {
		expect(await policies(valid.replace('<section>', '<section className="bad">'))).toContain(
			'eslint:solid/no-react-specific-props',
		);
	});

	test('a newly generated file is discovered and rejected end to end', async () => {
		const root = await realpath(await mkdtemp(resolve(tmpdir(), 'frameless-solid-gate-')));
		temporaryRoots.push(root);
		await mkdir(resolve(root, 'generated'));
		await writeFile(
			resolve(root, 'generated/New.jsx'),
			valid.replace('const label', 'setValue(1);\n  const label'),
		);
		const result = await checkGeneratedFiles({ cwd: root });
		expect(result.files).toEqual(['generated/New.jsx']);
		expect(result.violations.map((entry) => entry.policy)).toContain('render-phase-setter');
	});
});
