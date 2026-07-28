import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { basename } from 'pathe';
import { describe, expect, test } from 'vitest';
import { buildEnrichedIr, collectGraphReads } from '../src/build';
import { dumpEnrichedIr } from '../src/dump';
import type { EnrichedIR, SerializableAstNode, TemplateHost, TemplateNode } from '../src/schema';

const FIXTURES = [
	's1-render-once.tsrx',
	's2-keyed-todo.tsrx',
	's3-event-form.tsrx',
	's4-nested-list.tsrx',
	's5-branch-teardown.tsrx',
	's6-whitespace-text.tsrx',
	's7-form-controls.tsrx',
] as const;

const EXPECTED_HOSTS: Record<(typeof FIXTURES)[number], Array<[string, string]>> = {
	's1-render-once.tsrx': [
		['div', 'data-s1-root'],
		['p', 'data-branch'],
		['section', 'data-scenario'],
		['output', 'data-value'],
		['button', 'data-action'],
	],
	's2-keyed-todo.tsrx': [
		['section', 'data-scenario'],
		['p', 'data-count'],
		['input', 'data-action'],
		['button', 'data-action'],
		['p', 'data-empty'],
		['ul', ''],
		['li', 'data-oracle-row-key'],
		['input', 'data-edit'],
		['input', 'data-toggle'],
		['button', 'data-remove'],
		['button', 'data-action'],
		['button', 'data-action'],
	],
	's3-event-form.tsrx': [
		['form', 'data-scenario'],
		['input', 'data-action'],
		['input', 'data-action'],
		['button', 'data-action'],
		['button', 'data-action'],
		['output', 'data-writes'],
		['span', 'data-callback-marker'],
		['details', 'data-cancel'],
		['summary', 'data-action'],
		['details', 'data-cancel'],
		['summary', 'data-action'],
	],
	// S4's inner rows carry `data-oracle-cell-key`, NOT `data-oracle-row-key`.
	// The three-way contract's `measureRowKeys` matches the latter globally, so a
	// nested list keyed with the same attribute would silently join the outer
	// list's observation string. The two attributes are what keep S4's outer keys
	// and inner keys separately measurable. See T034.
	's4-nested-list.tsrx': [
		['section', 'data-scenario'],
		['output', 'data-selection'],
		['p', 'data-count'],
		['button', 'data-action'],
		['button', 'data-action'],
		['ul', 'data-groups'],
		['li', 'data-oracle-group-key'],
		['ul', 'data-rows'],
		['li', 'data-oracle-cell-key'],
		['button', 'data-select'],
		['span', 'data-cell-on'],
		['span', 'data-cell-off'],
		['details', 'data-cell-open'],
		['summary', 'data-open-cell'],
	],
	// S5's rows carry `data-oracle-branch-key`, a THIRD key attribute, for the
	// same reason S4 introduced `data-oracle-cell-key`: S2's `measureRowKeys`
	// matches `data-oracle-row-key` globally and S4's `measureCellKeys` matches
	// `data-oracle-cell-key`, so a scenario reusing either would silently join
	// that scenario's observation string.
	//
	// The two `div data-arm` hosts are the branch arms, and there are TWO of them
	// on purpose: this is the first scenario in the corpus whose branch has a
	// POPULATED arm on both sides. Each arm re-projects the same `ticks` and
	// `seen` state, which is what makes "the state survived the teardown"
	// observable at all.
	//
	// Each arm projects it through its OWN marker (`data-live-ticks` /
	// `data-idle-ticks`) rather than a shared one, and that is a measured
	// constraint rather than a naming preference: the Solid dossier gate's
	// `show-two-arm` policy (T003 ruling 5) rejects any element subtree that
	// appears verbatim in both arms of a `<Show>`, telling the author to hoist
	// shared content out of the branch. Hoisting is exactly what this scenario
	// must NOT do — the projections have to live inside the subtree that gets
	// destroyed — so the arms differ instead.
	's5-branch-teardown.tsrx': [
		['section', 'data-scenario'],
		['p', 'data-count'],
		['button', 'data-action'],
		['div', 'data-arm'],
		['output', 'data-live-ticks'],
		['p', 'data-live-seen'],
		['button', 'data-action'],
		['ul', 'data-branch-rows'],
		['li', 'data-oracle-branch-key'],
		['button', 'data-pick'],
		['div', 'data-arm'],
		['output', 'data-idle-ticks'],
		['p', 'data-idle-seen'],
		['button', 'data-action'],
	],
	// S6's rows carry `data-oracle-text-key`, a FOURTH key attribute, for the same
	// reason S4 introduced the second and S5 the third: every key reader in
	// `three-way-contract.ts` matches its own attribute, so a scenario reusing one
	// would silently join that scenario's observation string.
	//
	// EVERY text node in this fixture is `trim()`-stable, and that is a MEASURED
	// constraint rather than a style choice. The Angular emitter's `escapeText`
	// throws on any template text whose own edges are whitespace, and the Vue
	// gate's `condense-stable-text` rejects the emitted result for the same shape.
	// So the only whitespace this scenario can put in the TEMPLATE is interior —
	// `one two three` — and every space that has to sit next to an interpolation
	// is carried by the DATA instead (`label`, and the `joiner` state). See the
	// T027 note for the divergence that constraint is guarding against, and for
	// the part of it the two gates do NOT guard.
	's6-whitespace-text.tsrx': [
		['section', 'data-scenario'],
		['p', 'data-ratio'],
		['p', 'data-glue'],
		['p', 'data-wrap'],
		['p', 'data-mixed'],
		['b', 'data-emph'],
		['p', 'data-static'],
		['ul', 'data-lines'],
		['li', 'data-oracle-text-key'],
		['span', 'data-pair'],
		['button', 'data-widen'],
		['button', 'data-action'],
		['button', 'data-action'],
	],
	// S7's rows carry `data-oracle-form-key`, a FIFTH key attribute, for the reason
	// the second, third and fourth exist: every key reader in
	// `three-way-contract.ts` matches its own attribute globally, so a scenario
	// reusing one would silently join that scenario's observation string.
	//
	// THE TWO AXES THIS FIXTURE FOLDS TOGETHER, and why they share a host.
	//
	// FORM CONTROLS. The corpus had exactly two control types before S7 - a text
	// `input` and a checkbox `input`, both in S3 - so `value`/`checked`
	// projection had never been observed on a `select`, a `textarea`, a radio
	// group or a keyed group of checkboxes. All four are here, and all four
	// lower to `kind: 'property'` bindings, which is the half of the divergence
	// that matters: `value` and `checked` are DOM properties, and whether a
	// property binding reaches the SERVED attribute is decided by each lane's own
	// renderer rather than by this IR.
	//
	// BOOLEAN AND DYNAMIC ATTRIBUTES. `data-size`, `data-notes`, `data-tag`,
	// `data-lock`, `disabled` and `aria-disabled` all lower to
	// `kind: 'attribute'`, and `data-lock`/`aria-disabled` are bound to values
	// that are `null` in one state and a string in the other - the
	// present-versus-absent axis, measured live in all six lanes.
	//
	// `disabled` is the third state, `="false"`, and it is deliberately in the
	// fixture rather than left to a comment: Angular lowers an `attribute`-kind
	// binding to `[attr.disabled]`, whose runtime removes the attribute only for
	// `null`/`undefined` and otherwise writes `renderStringify(value)`. See the
	// T030 note for what the six lanes actually did with it.
	's7-form-controls.tsrx': [
		['form', 'data-scenario'],
		['select', 'data-control'],
		['option', 'value'],
		['option', 'value'],
		['option', 'value'],
		['textarea', 'data-control'],
		['input', 'data-pick'],
		['input', 'data-pick'],
		['p', 'data-picked'],
		['p', 'data-chosen'],
		['ul', 'data-tags'],
		['li', 'data-oracle-form-key'],
		['input', 'data-tag'],
		['button', 'data-action'],
		['button', 'data-action'],
		['button', 'data-guard'],
	],
};

async function fixtureIr(file: (typeof FIXTURES)[number]): Promise<EnrichedIR> {
	const source = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
	return buildEnrichedIr({ filename: `src/fixtures/${file}`, source });
}

async function compileOnlyFixtureIr(file: string): Promise<EnrichedIR> {
	const source = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
	return buildEnrichedIr({ filename: `src/fixtures/${file}`, source });
}

/**
 * One `.tsrx` module carrying `text` as the sole child of a host element, so a
 * probe measures template text and nothing else. Shared by the S6 suite and by
 * the interior-whitespace v-limit suite, which are two halves of one finding.
 */
function whitespaceProbeSource(text: string): string {
	return `import { state } from '@markless/core';

export function Probe({ seed }) @{
	let a = state(seed);

	<p data-probe={a}>${text}</p>
}
`;
}

async function probeTexts(text: string): Promise<string[]> {
	const ir = await buildEnrichedIr({
		filename: 'probe.tsrx',
		source: whitespaceProbeSource(text),
	});
	return allTemplateNodes(ir)
		.filter((node) => node.kind === 'text')
		.map((node) => (node.kind === 'text' ? node.value : ''));
}

/**
 * The RED half of the v-limit's two-sided calibration. Returns the refusal
 * message, and fails loudly if the construct compiled - a guard that cannot be
 * shown to fire is theatre, so "it did not throw" must never read as a pass.
 */
async function probeRefusal(text: string): Promise<string> {
	try {
		await buildEnrichedIr({ filename: 'probe.tsrx', source: whitespaceProbeSource(text) });
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	throw new Error(
		`Expected the interior-whitespace v-limit to refuse ${JSON.stringify(text)}, but it compiled.`,
	);
}

function walkTemplate(nodes: readonly TemplateNode[]): TemplateNode[] {
	const found: TemplateNode[] = [];
	for (const node of nodes) {
		found.push(node);
		if (node.kind === 'host' || node.kind === 'fragment' || node.kind === 'component-reference')
			found.push(...walkTemplate(node.children));
		if (node.kind === 'branch') {
			for (const arm of node.arms) found.push(...walkTemplate(arm.children));
		}
		if (node.kind === 'keyed-repeat') {
			found.push(...walkTemplate(node.row), ...walkTemplate(node.empty));
		}
	}
	return found;
}

function allTemplateNodes(ir: EnrichedIR): TemplateNode[] {
	return ir.components.flatMap((component) => [
		...component.guards.flatMap((guard) =>
			guard.whenTrue.kind === 'template' ? walkTemplate(guard.whenTrue.children) : [],
		),
		...walkTemplate(component.template),
	]);
}

function hosts(ir: EnrichedIR): TemplateHost[] {
	return allTemplateNodes(ir).filter((node): node is TemplateHost => node.kind === 'host');
}

function astNodes(root: SerializableAstNode): SerializableAstNode[] {
	const found: SerializableAstNode[] = [];
	const visit = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			for (const child of value) visit(child);
			return;
		}
		const candidate = value as SerializableAstNode;
		if (typeof candidate.type === 'string') found.push(candidate);
		for (const child of Object.values(candidate)) visit(child);
	};
	visit(root);
	return found;
}

function callbackNames(ast: SerializableAstNode): string[] {
	return astNodes(ast)
		.filter(
			(node) =>
				node.type === 'CallExpression' &&
				(node.callee as SerializableAstNode | undefined)?.type === 'Identifier' &&
				(node.callee as { name?: string }).name === 'onTrace',
		)
		.map((node) => {
			const first = (node.arguments as SerializableAstNode[] | undefined)?.[0];
			return first?.type === 'Literal' ? String(first.value) : '';
		})
		.filter(Boolean);
}

describe('fixture-family sufficiency', () => {
	for (const file of FIXTURES) {
		test(`${file}: every dynamic DOM site has an AST and closed graph reads`, async () => {
			const ir = await fixtureIr(file);
			const graphIds = new Set(ir.records.bindings.map((binding) => binding.id));
			const nodes = allTemplateNodes(ir);
			const sites: Array<{
				expression: SerializableAstNode;
				reads: readonly { graphNodeId: string }[];
			}> = [];
			for (const node of nodes) {
				if (node.kind === 'dynamic-text') sites.push(node);
				if (node.kind === 'host') sites.push(...node.dynamicBindings);
				if (node.kind === 'branch') sites.push(node);
				if (node.kind === 'keyed-repeat') sites.push(node.collection, node.key);
			}
			expect(sites.length).toBeGreaterThan(0);
			for (const site of sites) {
				expect(typeof site.expression.type).toBe('string');
				expect(site.reads.length).toBeGreaterThan(0);
				for (const read of site.reads) expect(graphIds.has(read.graphNodeId)).toBe(true);
			}
		});
	}

	test('S1 carries ordered locals, setup AST, and the root branch site', async () => {
		const ir = await fixtureIr('s1-render-once.tsrx');
		const component = ir.components[0]!;
		expect(component.locals.flatMap((local) => local.names)).toEqual([
			'setup',
			'count',
			'prefix',
			'derived',
		]);
		expect(
			component.locals.find((local) => local.names.includes('prefix'))?.reads,
		).toContainEqual({ graphNodeId: 'prop:props', path: ['label'], via: 'alias' });
		const derived = ir.records.bindings.find((binding) => binding.id === 'computed:derived')!;
		expect(derived.computed?.reads).toContainEqual({
			graphNodeId: 'prop:props',
			path: ['label'],
			via: 'local',
		});
		expect(derived.reads).toContainEqual({
			componentId: component.id,
			graphNodeId: 'prop:props',
			path: ['label'],
		});
		expect(component.evaluation).toEqual({
			ordinaryLocals: 'once-per-instance',
			computedBindings: 'reactive',
		});
		expect(ir.module.exports).toEqual([
			{ kind: 'named', componentName: 'RenderOnce', exportedName: 'RenderOnce' },
		]);
		expect(callbackNames(component.locals[0]!.initializer!)).toEqual(['setup']);
		expect(component.guards).toHaveLength(0);
		// Root-level branches silently compile to an empty CSR artifact in
		// markless 0.1.1 (recorded finding), so S1 wraps the branch in a stable
		// root element; the branch is the root's only child.
		const rootHost = component.template.find((node) => node.kind === 'host');
		expect(rootHost?.kind).toBe('host');
		if (rootHost?.kind !== 'host') throw new Error('missing S1 root host');
		expect(rootHost.tag).toBe('div');
		const branch = rootHost.children.find((node) => node.kind === 'branch');
		expect(branch?.kind).toBe('branch');
		if (branch?.kind !== 'branch') throw new Error('missing S1 root branch');
		expect(branch.id).toBe('branch-site:0');
		expect(branch.arms.map((arm) => arm.kind)).toEqual(['then', 'else']);
		expect(
			branch.arms.map((arm) =>
				walkTemplate(arm.children)
					.filter((node) => node.kind === 'host')
					.map((node) => node.tag),
			),
		).toEqual([['p'], ['section', 'output', 'button']]);
		expect(hosts(ir).map((host) => host.tag)).toEqual([
			'div',
			'p',
			'section',
			'output',
			'button',
		]);
	});

	test('compile-only alias fixture preserves aliased prop destructuring and alias-record reads', async () => {
		const ir = await compileOnlyFixtureIr('alias-coverage.tsrx');
		const component = ir.components[0]!;
		expect(component.props.entries).toContainEqual(
			expect.objectContaining({
				sourceName: 'label',
				localName: 'displayLabel',
				alias: true,
				graphNodeId: 'prop:props',
				path: ['label'],
			}),
		);
		expect(ir.records.aliases.find((alias) => alias.name === 'displayLabel')).toEqual(
			expect.objectContaining({
				target: 'props.label',
				graphNodeId: 'prop:props',
				path: ['label'],
			}),
		);
		expect(
			component.locals.find((local) => local.names.includes('prefix'))?.reads,
		).toContainEqual({ graphNodeId: 'prop:props', path: ['label'], via: 'alias' });
		const derived = ir.records.bindings.find((binding) => binding.id === 'computed:derived')!;
		expect(derived.computed?.reads).toContainEqual({
			graphNodeId: 'prop:props',
			path: ['label'],
			via: 'local',
		});
		expect(derived.reads).toContainEqual({
			componentId: component.id,
			graphNodeId: 'prop:props',
			path: ['label'],
		});
	});

	test('S2 carries complete branch and keyed-row subtrees plus structural computed dependencies', async () => {
		const ir = await fixtureIr('s2-keyed-todo.tsrx');
		const nodes = allTemplateNodes(ir);
		const branch = nodes.find((node) => node.kind === 'branch');
		const repeat = nodes.find((node) => node.kind === 'keyed-repeat');
		expect(branch?.kind).toBe('branch');
		if (branch?.kind !== 'branch') throw new Error('missing S2 branch');
		expect(branch.arms).toHaveLength(2);
		expect(
			walkTemplate(branch.arms[0]!.children).some(
				(node) => node.kind === 'host' && node.tag === 'p',
			),
		).toBe(true);
		expect(branch.arms[1]).toEqual({ kind: 'else', children: [] });
		expect(repeat?.kind).toBe('keyed-repeat');
		if (repeat?.kind !== 'keyed-repeat') throw new Error('missing S2 repeat');
		expect(repeat.key.expression.type).toBe('MemberExpression');
		expect(
			walkTemplate(repeat.row)
				.filter((node) => node.kind === 'host')
				.map((node) => (node as TemplateHost).tag),
		).toEqual(['li', 'input', 'input', 'button']);
		const summarize = (node: TemplateNode): unknown =>
			node.kind === 'host'
				? {
						tag: node.tag,
						staticAttributes: node.staticAttributes,
						dynamicBindings: node.dynamicBindings.map(({ kind, name, reads }) => ({
							kind,
							name,
							valuePath: reads.map(
								(read) => `${read.graphNodeId}/${read.path.join('/')}/${read.via}`,
							),
						})),
						children: node.children.map(summarize),
					}
				: node.kind === 'text'
					? { kind: 'text', value: node.value }
					: { kind: node.kind };
		expect(repeat.row.map(summarize)).toEqual([
			{
				tag: 'li',
				staticAttributes: [],
				dynamicBindings: [
					{
						kind: 'attribute',
						name: 'data-oracle-row-key',
						valuePath: ['state:todos/id/repeat-item'],
					},
				],
				children: [
					{
						tag: 'input',
						staticAttributes: [],
						dynamicBindings: [
							{
								kind: 'attribute',
								name: 'data-edit',
								valuePath: ['state:todos/id/repeat-item'],
							},
							{
								kind: 'property',
								name: 'value',
								valuePath: ['state:todos/title/repeat-item'],
							},
						],
						children: [],
					},
					{
						tag: 'input',
						staticAttributes: [{ name: 'type', value: 'checkbox' }],
						dynamicBindings: [
							{
								kind: 'attribute',
								name: 'data-toggle',
								valuePath: ['state:todos/id/repeat-item'],
							},
							{
								kind: 'property',
								name: 'checked',
								valuePath: ['state:todos/done/repeat-item'],
							},
						],
						children: [],
					},
					{
						tag: 'button',
						staticAttributes: [],
						dynamicBindings: [
							{
								kind: 'attribute',
								name: 'data-remove',
								valuePath: ['state:todos/id/repeat-item'],
							},
						],
						children: [{ kind: 'text', value: 'remove' }],
					},
				],
			},
		]);

		const complete = ir.records.bindings.find((binding) => binding.name === 'complete')!;
		expect(complete.computed?.expression.type).toBe('ArrowFunctionExpression');
		const fromSerializedAst = collectGraphReads(
			complete.computed!.expression,
			ir.records.bindings,
		);
		expect(fromSerializedAst.map((read) => read.graphNodeId)).toEqual(['state:todos']);
		expect(complete.computed?.reads.map((read) => read.graphNodeId)).toEqual(['state:todos']);
		expect(
			complete.computed?.reads.some((read) =>
				read.path.some((part) => part.includes('filter(')),
			),
		).toBe(false);
	});

	test('collectGraphReads fails closed when alpha-count and beta-count share the name count', () => {
		expect(() =>
			collectGraphReads({ type: 'Identifier', name: 'count' }, [
				{ id: 'alpha-count', name: 'count' },
				{ id: 'beta-count', name: 'count' },
			]),
		).toThrow(
			'GraphRead binding name collision for "count" between "alpha-count" and "beta-count"; component ownership is required.',
		);
	});

	test('S2 event effects are exact and temporary receiver mutation is not a graph write', async () => {
		const ir = await fixtureIr('s2-keyed-todo.tsrx');
		const effects = ir.records.events.map((event) => ({
			id: event.id,
			eventName: event.eventName,
			reads: event.handlers[0]!.reads.map(
				(read) => `${read.graphNodeId}/${read.path.join('/')}/${read.via}`,
			),
			writes: event.handlers[0]!.writes.map(
				(write) =>
					`${write.graphNodeId}/${write.path.join('/')}/${write.operation}/${write.via}`,
			),
		}));
		expect(effects).toEqual([
			{
				id: 'event:0',
				eventName: 'input',
				reads: [],
				writes: ['state:draft//assign/direct'],
			},
			{
				id: 'event:1',
				eventName: 'click',
				reads: [
					'prop:props/onTrace/alias',
					'state:draft//direct',
					'state:next//direct',
					'state:todos//direct',
				],
				writes: [
					'state:draft//assign/direct',
					'state:next//update/direct',
					'state:todos//assign/direct',
				],
			},
			{
				id: 'event:2',
				eventName: 'input',
				reads: [
					'prop:props/onTrace/alias',
					'state:todos//direct',
					'state:todos/id/repeat-item',
				],
				writes: [
					'state:todos//assign/direct',
					'state:todos/*/title/assign/handler-local-alias',
				],
			},
			{
				id: 'event:3',
				eventName: 'change',
				reads: [
					'prop:props/onTrace/alias',
					'state:todos//direct',
					'state:todos/id/repeat-item',
				],
				writes: [
					'state:todos//assign/direct',
					'state:todos/*/done/assign/handler-local-alias',
				],
			},
			{
				id: 'event:4',
				eventName: 'click',
				reads: [
					'prop:props/onTrace/alias',
					'state:todos//direct',
					'state:todos/id/repeat-item',
				],
				writes: ['state:todos//assign/direct'],
			},
			{
				id: 'event:5',
				eventName: 'click',
				reads: ['prop:props/onTrace/alias', 'state:todos//direct'],
				writes: ['state:todos//assign/direct'],
			},
			{
				id: 'event:6',
				eventName: 'click',
				reads: ['prop:props/onTrace/alias', 'state:todos/length/direct'],
				writes: ['state:todos//assign/direct'],
			},
		]);
		expect(ir.records.stateWrites.some((write) => write.method === 'reverse')).toBe(false);
	});

	test('every scripted callback is present in a setup initializer or real event-handler AST', async () => {
		const expected: Record<(typeof FIXTURES)[number], string[]> = {
			's1-render-once.tsrx': ['setup', 'change'],
			's2-keyed-todo.tsrx': ['add', 'edit', 'toggle', 'reorder', 'remove', 'clear'],
			's3-event-form.tsrx': ['text', 'checked', 'submit', 'bubble'],
			's4-nested-list.tsrx': ['flip', 'reorder', 'select'],
			's5-branch-teardown.tsrx': ['toggle', 'tick', 'pick', 'drop'],
			's6-whitespace-text.tsrx': ['widen', 'tick', 'pad'],
			's7-form-controls.tsrx': ['size', 'notes', 'pick', 'tag', 'resize', 'lock'],
		};
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			const names = [
				...ir.components.flatMap((component) =>
					component.locals.flatMap((local) =>
						local.initializer ? callbackNames(local.initializer) : [],
					),
				),
				...ir.records.events.flatMap((event) =>
					event.handlers.flatMap((handler) => callbackNames(handler.expression)),
				),
			];
			expect([...new Set(names)].sort()).toEqual([...expected[file]].sort());
			for (const event of ir.records.events) {
				expect(event.handlers).toHaveLength(1);
				expect(event.handlers[0]!.expression.type).toBe('ArrowFunctionExpression');
				// A handler must do something the IR records. Usually that is a graph read
				// or write; S3's cancel-submit handler does neither — its whole body is
				// `event.preventDefault()`, so its only recorded effect is the syncPolicy.
				// Cancellation is an observable effect, so it satisfies the same intent.
				const handler = event.handlers[0]!;
				expect(
					handler.reads.length + handler.writes.length > 0 ||
						(event.syncPolicy?.actions.length ?? 0) > 0,
				).toBe(true);
			}
		}
	});

	test('S3 exposes live property sites, cancellation, bubbling, and both submit writes', async () => {
		const ir = await fixtureIr('s3-event-form.tsrx');
		const properties = hosts(ir).flatMap((host) =>
			host.dynamicBindings
				.filter((binding) => binding.kind === 'property')
				.map((binding) => binding.name),
		);
		expect(properties.sort()).toEqual(['checked', 'value']);
		const submit = ir.records.events.find(
			(event) =>
				event.syncPolicy && callbackNames(event.handlers[0]!.expression).includes('submit'),
		)!;
		expect(submit.syncPolicy).toEqual({
			when: { type: 'constant-truthy', value: true },
			actions: ['preventDefault'],
		});
		expect(submit.handlers[0]!.writes.map((write) => write.graphNodeId)).toEqual([
			'state:writes',
			'state:writes',
		]);
		const formBubble = ir.records.events.find((event) => event.hostNodeId === 'h0')!;
		expect(callbackNames(formBubble.handlers[0]!.expression)).toEqual(['bubble']);
	});
});

describe('nested repeats sourced from the enclosing repeat item', () => {
	/**
	 * T033. `@markless/compiler` 0.1.1 leaves `collectionGraphNodeId` unset when a
	 * nested repeat's collection is a member of the ENCLOSING repeat item
	 * (`group.rows`). `build.ts` used to guard on that field and skip registering
	 * the inner loop variable, so every read off `row` silently lowered to
	 * `reads: []` — and FIVE of six emitters printed correct-LOOKING output over
	 * that IR because they walk the template rather than the reads.
	 *
	 * This test is the instrument. Before the repair it reported seven zero-read
	 * sites: `repeat:1 key` plus every dynamic binding inside the nested row.
	 */
	function dynamicSites(ir: EnrichedIR): Array<{
		readonly label: string;
		readonly reads: readonly { graphNodeId: string }[];
	}> {
		const sites: Array<{ label: string; reads: readonly { graphNodeId: string }[] }> = [];
		for (const node of allTemplateNodes(ir)) {
			if (node.kind === 'dynamic-text') sites.push({ label: `${node.id} text`, ...node });
			if (node.kind === 'host')
				for (const binding of node.dynamicBindings)
					sites.push({ label: `host ${node.id} ${binding.name}`, reads: binding.reads });
			if (node.kind === 'branch') sites.push({ label: `${node.id} branch`, ...node });
			if (node.kind === 'keyed-repeat') {
				sites.push({ label: `${node.id} collection`, reads: node.collection.reads });
				sites.push({ label: `${node.id} key`, reads: node.key.reads });
			}
		}
		return sites;
	}

	test('S4: no dynamic site inside the nested row lowers to reads: []', async () => {
		const ir = await compileOnlyFixtureIr('s4-nested-list.tsrx');
		const sites = dynamicSites(ir);
		expect(sites.length).toBe(16);
		expect(sites.filter((site) => site.reads.length === 0).map((site) => site.label)).toEqual(
			[],
		);
		const graphIds = new Set(ir.records.bindings.map((binding) => binding.id));
		for (const site of sites)
			for (const read of site.reads) expect(graphIds.has(read.graphNodeId)).toBe(true);
	});

	test('S4: the inner repeat resolves against the outer item, key included', async () => {
		const ir = await compileOnlyFixtureIr('s4-nested-list.tsrx');
		const repeats = allTemplateNodes(ir).filter((node) => node.kind === 'keyed-repeat');
		expect(repeats.map((node) => (node.kind === 'keyed-repeat' ? node.item : ''))).toEqual([
			'group',
			'row',
		]);
		const inner = repeats[1]!;
		if (inner.kind !== 'keyed-repeat') throw new Error('missing S4 inner repeat');
		expect(inner.collection.reads).toEqual([
			{ graphNodeId: 'state:groups', path: ['rows'], via: 'repeat-item' },
		]);
		expect(inner.key.reads).toEqual([
			{ graphNodeId: 'state:groups', path: ['rows', 'id'], via: 'repeat-item' },
		]);
		// The handler inside the inner row reads BOTH loop variables.
		const select = ir.records.events.find((event) => event.hostNodeId === 'h9')!;
		expect(
			select.handlers[0]!.reads.map(
				(read) => `${read.graphNodeId}/${read.path.join('/')}/${read.via}`,
			),
		).toEqual([
			'prop:props/onTrace/alias',
			'state:groups/id/repeat-item',
			'state:groups/rows/id/repeat-item',
		]);
	});

	test('an unresolvable nested collection fails closed LOUDLY, never into reads: []', async () => {
		const source = `import { state } from '@markless/core';

export function Indexed({ seed }) @{
	let groups = state(seed);
	let rowsByGroup = state({});

	<ul data-indexed="true">
		@for (const group of groups; key group.id) {
			<li data-group={group.id}>
				@for (const row of rowsByGroup[group.id]; key row.id) {
					<span data-row={row.id}>x</span>
				}
			</li>
		}
	</ul>
}
`;
		await expect(buildEnrichedIr({ filename: 'indexed.tsrx', source })).rejects.toThrow(
			/Keyed repeat repeat:1 collection cannot be resolved to a single graph location/,
		);
	});
});

describe('a branch that tears a POPULATED arm down at runtime', () => {
	/**
	 * T026. Deliberately its own walker rather than a reuse of the nested-repeat
	 * describe's `dynamicSites`: S5's claim is about branch ARMS, and a shared
	 * helper would make S5's measurement depend on a function S4 also drives. The
	 * same reason `measureCellKeys` is not a refactor of `measureRowKeys`.
	 */
	function armSites(ir: EnrichedIR): Array<{ label: string; reads: readonly unknown[] }> {
		const sites: Array<{ label: string; reads: readonly unknown[] }> = [];
		for (const node of allTemplateNodes(ir)) {
			if (node.kind === 'dynamic-text') sites.push({ label: `${node.id} text`, reads: node.reads });
			if (node.kind === 'host')
				for (const binding of node.dynamicBindings)
					sites.push({ label: `host ${node.id} ${binding.name}`, reads: binding.reads });
			if (node.kind === 'branch') sites.push({ label: `${node.id} branch`, reads: node.reads });
			if (node.kind === 'keyed-repeat') {
				sites.push({ label: `${node.id} collection`, reads: node.collection.reads });
				sites.push({ label: `${node.id} key`, reads: node.key.reads });
			}
		}
		return sites;
	}

	test('S5: no dynamic site in either arm lowers to reads: []', async () => {
		const ir = await compileOnlyFixtureIr('s5-branch-teardown.tsrx');
		const sites = armSites(ir);
		expect(sites.length).toBe(10);
		expect(sites.filter((site) => site.reads.length === 0).map((site) => site.label)).toEqual([]);
	});

	test('S5: the branch is guarded by STATE and both arms are populated', async () => {
		const ir = await compileOnlyFixtureIr('s5-branch-teardown.tsrx');
		const branches = allTemplateNodes(ir).filter((node) => node.kind === 'branch');
		expect(branches).toHaveLength(1);
		const branch = branches[0]!;
		if (branch.kind !== 'branch') throw new Error('missing S5 branch');
		// The whole point of the scenario. s1's branch is selected by a STATIC
		// prop and s2's `@else` arm is EMPTY, so before S5 no branch in the corpus
		// could tear a populated subtree down at runtime.
		expect(branch.reads.map((read) => read.graphNodeId)).toEqual(['state:phase']);
		expect(branch.arms).toHaveLength(2);
		for (const arm of branch.arms) expect(arm.children.length).toBeGreaterThan(0);
	});

	test('S5: a handler and a keyed list live INSIDE the arm that gets torn down', async () => {
		const ir = await compileOnlyFixtureIr('s5-branch-teardown.tsrx');
		const branch = allTemplateNodes(ir).find((node) => node.kind === 'branch');
		if (branch?.kind !== 'branch') throw new Error('missing S5 branch');
		const inArm = (index: number): TemplateNode[] => walkTemplate(branch.arms[index]!.children);
		const repeats = inArm(0).filter((node) => node.kind === 'keyed-repeat');
		expect(repeats).toHaveLength(1);
		const hostIdsInLiveArm = new Set(inArm(0).map((node) => node.id));
		const hostIdsInIdleArm = new Set(inArm(1).map((node) => node.id));
		const handlersIn = (ids: Set<string>) =>
			ir.records.events.filter((event) => ids.has(event.hostNodeId)).length;
		// Two in the live arm (`tick` on the arm itself, `pick` inside the keyed
		// list) and one in the idle arm (`drop`). Every one of them is destroyed
		// and rebuilt by the flip.
		expect(handlersIn(hostIdsInLiveArm)).toBe(2);
		expect(handlersIn(hostIdsInIdleArm)).toBe(1);
	});
});

describe('text nodes whose exact characters are the observable', () => {
	/**
	 * T027. Its own walker again, for the reason `armSites` gives: S6's claim is
	 * about the CHARACTERS of static text and about what sits either side of it,
	 * and a shared helper would make S6's measurement depend on a function S4 and
	 * S5 also drive.
	 */
	function textSites(ir: EnrichedIR): Array<{ label: string; reads: readonly unknown[] }> {
		const sites: Array<{ label: string; reads: readonly unknown[] }> = [];
		for (const node of allTemplateNodes(ir)) {
			if (node.kind === 'dynamic-text') sites.push({ label: `${node.id} text`, reads: node.reads });
			if (node.kind === 'host')
				for (const binding of node.dynamicBindings)
					sites.push({ label: `host ${node.id} ${binding.name}`, reads: binding.reads });
			if (node.kind === 'branch') sites.push({ label: `${node.id} branch`, reads: node.reads });
			if (node.kind === 'keyed-repeat') {
				sites.push({ label: `${node.id} collection`, reads: node.collection.reads });
				sites.push({ label: `${node.id} key`, reads: node.key.reads });
			}
		}
		return sites;
	}

	function staticTexts(ir: EnrichedIR): string[] {
		return allTemplateNodes(ir)
			.filter((node) => node.kind === 'text')
			.map((node) => (node.kind === 'text' ? node.value : ''));
	}

	test('S6: no dynamic site lowers to reads: []', async () => {
		const ir = await compileOnlyFixtureIr('s6-whitespace-text.tsrx');
		const sites = textSites(ir);
		expect(sites.length).toBe(14);
		expect(sites.filter((site) => site.reads.length === 0).map((site) => site.label)).toEqual([]);
	});

	/**
	 * THE CONSTRAINT THE FIXTURE IS AUTHORED UNDER, asserted rather than left as a
	 * comment. `escapeText` in the Angular emitter throws on any template text
	 * whose own edges are whitespace, and the Vue gate rejects the same shape after
	 * condense. A future edit that adds `<p>{a} of {b}</p>` to this fixture would
	 * otherwise be discovered as a THROW three lanes downstream.
	 */
	test('S6: every static text node is trim-stable and non-empty', async () => {
		const ir = await compileOnlyFixtureIr('s6-whitespace-text.tsrx');
		const texts = staticTexts(ir);
		expect(texts.length).toBeGreaterThan(0);
		expect(texts.filter((value) => value !== value.trim() || value.length === 0)).toEqual([]);
	});

	/**
	 * THE INPUT SIDE OF THE WHITESPACE FINDING. MEASURED at `@markless/compiler`
	 * 0.1.1, not assumed:
	 *
	 *   `tab\there`    -> `tab here`      a TAB becomes exactly one space
	 *   `x\ny`         -> `x y`           a NEWLINE becomes exactly one space
	 *   `tab\t\there`  -> `tab  here`     one space PER tab, NOT condensed
	 *
	 * So an emitter can never be handed a tab or a newline inside template text
	 * from a `.tsrx` source, and the lanes' divergent treatment of those two
	 * characters is unreachable from this toolchain.
	 *
	 * AMENDED BY T039. This test used to assert that `two  spaces` and `a   b`
	 * survive into the IR verbatim - which they still do, mechanically, inside
	 * `normalizeJsxText`. They no longer survive into an IR anyone can obtain: the
	 * interior-whitespace v-limit refuses them one line later. The third row above
	 * is the reason the limit had to sit at the compiler rather than in a gate -
	 * the tab mapping is a 1:1 character map, so `normalizeJsxText` MANUFACTURES a
	 * space run out of a tab run. That half of the measurement is asserted in the
	 * v-limit's own suite below, read out of the refusal message, which is now the
	 * only place the produced value is observable.
	 */
	test('S6: the IR maps tabs and newlines to one space each', async () => {
		const ir = await compileOnlyFixtureIr('s6-whitespace-text.tsrx');
		expect(staticTexts(ir)).toContain('one two three');
		expect(await probeTexts('tab\there')).toEqual(['tab here']);
		expect(await probeTexts('x\ny')).toEqual(['x y']);
		expect(await probeTexts('one two three')).toEqual(['one two three']);
	});

	/**
	 * The three adjacencies the scenario exists to measure, each of which a
	 * pretty-printer could break across lines and silently widen:
	 * interpolation/text/interpolation, text/interpolation/interpolation/text and
	 * three interpolations with nothing at all between them.
	 */
	test('S6: the corpus gains runs of adjacent dynamic text with no whitespace', async () => {
		const ir = await compileOnlyFixtureIr('s6-whitespace-text.tsrx');
		const runs = allTemplateNodes(ir)
			.filter((node) => node.kind === 'host')
			.map((node) =>
				node.kind === 'host'
					? node.children
							.map((child) =>
								child.kind === 'text'
									? JSON.stringify(child.value)
									: child.kind === 'dynamic-text'
										? '{}'
										: `<${child.kind}>`,
							)
							.join('')
					: '',
			);
		expect(runs).toContain('{}"/"{}');
		expect(runs).toContain('"start"{}{}"end"');
		expect(runs).toContain('{}{}{}');
	});
});

/**
 * T039, implementing the T038 ruling. `docs/DEFECTS.md` entry 7.
 *
 * The compiler refuses a static text node whose value contains two adjacent
 * whitespace characters, or any whitespace character that is not U+0020. This
 * suite is the instrument that makes that refusal real, and it has to do two
 * separate jobs, because the rule fires on NOTHING that exists:
 *
 *   1. CALIBRATION. Planted violations must go RED, and the legal neighbours of
 *      each one must stay GREEN. A guard measured at zero violations across the
 *      whole live corpus is unfalsifiable until it is shown failing on purpose.
 *   2. THE LIFT TRIGGER. The cross-lane matrix records what each lane's own
 *      compiler does to a space run and to a single U+00A0. If ANY single lane
 *      moves in EITHER direction, that test goes red and the ruling is re-opened
 *      on evidence rather than on memory - including the good direction, because
 *      a lane that STARTS preserving is what would let the v-limit be lifted.
 */
describe('the interior-whitespace v-limit', () => {
	const SPACE = String.fromCharCode(0x20);
	const NBSP = String.fromCharCode(0x00a0);
	const THIN = String.fromCharCode(0x2009);
	const IDEOGRAPHIC = String.fromCharCode(0x3000);
	const ZWSP = String.fromCharCode(0x200b);

	/**
	 * RED, half one: a run of ordinary spaces. This is the 3-3 row - react, qwik
	 * and svelte serve it verbatim; solid, vue and angular each condense it.
	 */
	test('a planted run of U+0020 is REFUSED, at any length', async () => {
		expect(await probeRefusal('two' + SPACE + SPACE + 'spaces')).toContain(
			JSON.stringify('two  spaces'),
		);
		expect(await probeRefusal('a' + SPACE.repeat(3) + 'b')).toContain(JSON.stringify('a   b'));
	});

	/**
	 * RED, half two, and the half that disqualifies normalisation. On a whitespace
	 * character that is not U+0020 the matrix is 5-1, not 3-3: solid alone rewrites
	 * the character's IDENTITY. Refusing a SINGLE such character - no run at all -
	 * is therefore not over-reach, it is the tighter of the two halves.
	 */
	test('a single non-U+0020 whitespace character is REFUSED, with no run at all', async () => {
		for (const character of [NBSP, THIN, IDEOGRAPHIC]) {
			const message = await probeRefusal('one' + character + 'two');
			expect(message).toContain(
				`U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`,
			);
		}
	});

	/**
	 * The compiler is the right layer because it is one of the two things PRODUCING
	 * the construct. `normalizeJsxText` maps `\t` to one space PER TAB - a 1:1
	 * character map, not a condense - so a tab run becomes a space run that the
	 * author never typed. The produced value is no longer observable in any IR, so
	 * it is read back out of the refusal message; this is the surviving half of the
	 * measurement the S6 suite above used to make directly.
	 */
	test('a TAB RUN is manufactured by normalizeJsxText and then caught by the v-limit', async () => {
		expect(await probeRefusal('tab\t\there')).toContain(JSON.stringify('tab  here'));
		expect(await probeRefusal('one\t\t\ttwo')).toContain(JSON.stringify('one   two'));
	});

	/**
	 * GREEN, and the reason the refusal is a reduction in SPELLING rather than in
	 * capability. Whitespace carried as a VALUE is preserved by all six lanes, and
	 * `demos/react-official/three-way-contract.ts` already asserts it equal across
	 * six as `[ wide  load ]`. S6's own fixture is spelled `<p data-wrap>[{note}]</p>`
	 * for exactly this reason.
	 */
	test('the portable spelling - whitespace carried as an interpolated VALUE - still compiles', async () => {
		expect(await probeTexts('[{a}]')).toEqual(['[', ']']);
		expect(await probeTexts('one two three')).toEqual(['one two three']);
		expect(await probeTexts('single spaces are fine')).toEqual(['single spaces are fine']);
	});

	/**
	 * TEXT-NODE EDGES ARE OUT OF SCOPE, asserted rather than left to a comment,
	 * because the edge form of this same predicate is the tempting widening and it
	 * would break four live demo texts (`" open"` in the two `TaskList.tsrx`,
	 * `" seats"` in the two `PricingCard.tsrx`). Those shapes are guarded downstream
	 * in the two lanes that cannot express them; they are not the compiler's to
	 * refuse, and this test is what stops a later reader "completing" the rule.
	 */
	test('a whitespace EDGE is deliberately NOT refused', async () => {
		expect(await probeTexts('{a} open')).toEqual([' open']);
		expect(await probeTexts('{a} seats')).toEqual([' seats']);
	});

	/**
	 * ZWSP is not whitespace under `\s`, and every lane passes it through. It is in
	 * the suite as the negative control for the `[^\S ]` half: that half must select
	 * whitespace, not "unusual character".
	 */
	test('U+200B is not whitespace and is NOT refused', async () => {
		expect(await probeTexts('one' + ZWSP + 'two')).toEqual(['one' + ZWSP + 'two']);
	});

	/**
	 * The message is load-bearing - it is the permanent record of the finding at the
	 * point of use, and the ONLY thing an author who trips this will read. Two of
	 * its claims are asserted because getting either wrong makes the refusal worse
	 * than useless: it must point at the interpolated spelling, and it must NOT
	 * point at a non-breaking space, which is the advice a reader would otherwise
	 * reach for and which is WRONG in solid - the one lane it would be meant for.
	 */
	test('the refusal names the value, the split, and the portable spelling - and never suggests NBSP', async () => {
		const message = await probeRefusal('two' + SPACE + SPACE + 'spaces');
		expect(message).toContain(JSON.stringify('two  spaces'));
		expect(message).toContain('probe.tsrx');
		expect(message).toContain('THREE OF SIX LANES REWRITE IT');
		expect(message).toContain('INTERPOLATED VALUE');
		expect(message).toContain('[ wide  load ]');
		expect(message).not.toMatch(/&nbsp;|&#160;|&#xa0;/i);
		expect(message).not.toMatch(/[^\S ]| /);
	});

	/**
	 * THE GUARD'S MEASURED ZERO, locked in. Every shipped compiler fixture satisfies
	 * the predicate today; the wider scan over every live `.tsrx` in `demos/`,
	 * `packages/` and `poc/` found 0 interior violations in 108 static text nodes,
	 * re-derived by T039. This asserts the half of that scan this package owns, so
	 * that a fixture edit which trips the limit is reported HERE as a fixture
	 * problem rather than as six mysterious downstream failures.
	 */
	test('every shipped fixture is already free of interior whitespace', async () => {
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			const offenders = allTemplateNodes(ir)
				.filter((node) => node.kind === 'text')
				.map((node) => (node.kind === 'text' ? node.value : ''))
				.filter((value) => /\s\s/.test(value) || /[^\S ]/.test(value));
			expect({ file, offenders }).toEqual({ file, offenders: [] });
		}
	});
});

/**
 * THE LIFT TRIGGER, and the only test in this repo that runs all six lanes' own
 * template compilers side by side.
 *
 * WHAT IS ASSERTED AND WHAT IS MERELY RECORDED, stated deliberately. The
 * BEHAVIOUR is asserted strictly: if any single lane's answer moves in either
 * direction this goes red. The VERSIONS are recorded and attached to the failure
 * output rather than asserted, because three of the six lanes are pinned with a
 * caret (`svelte ^5.56.1`, `@vue/compiler-sfc ^3.5.40`, `@angular/compiler
 * ^22.0.8`) and asserting exact versions would produce a red on every unrelated
 * patch bump - a red that is expected is a red nobody reads. The ruling's trigger
 * is "a version bump that MOVES a lane", which is exactly the behaviour assertion.
 *
 * MEASURED BY T039 on 2026-07-27, at: react-dom 19.2.3, @qwik.dev/optimizer
 * 2.1.0-beta.5 (loaded by @qwik.dev/core 2.0.0-beta.38), svelte 5.56.8,
 * babel-preset-solid 1.9.12, @vue/compiler-sfc 3.5.40, @angular/compiler 22.0.8.
 *
 * THE QWIK CELL WAS THE HOLE THIS TEST EXISTS TO CLOSE. T038 could not measure
 * Qwik on non-ASCII whitespace: `@qwik.dev/core`'s `./optimizer` subpath exports
 * only `qwikVite` and `qwikRollup`, no callable transform. The callable one is
 * `createOptimizer()` in `@qwik.dev/optimizer`, which core loads internally and
 * which resolves from core's OWN node_modules - reached below without hard-coding
 * a store path. MEASURED: Qwik PRESERVES the space run AND the U+00A0, putting it
 * on the preserving side of the 5-1 split and confirming that solid is alone.
 */
describe('the six-lane whitespace matrix', () => {
	const REPO_ROOT = new URL('../../../', import.meta.url);
	const laneRequire = (lane: string) =>
		createRequire(fileURLToPath(new URL(`packages/frameworks/${lane}/package.json`, REPO_ROOT)));
	const laneImport = async (lane: string, specifier: string): Promise<Record<string, unknown>> => {
		const resolved = pathToFileURL(laneRequire(lane).resolve(specifier)).href;
		return (await import(/* @vite-ignore */ resolved)) as Record<string, unknown>;
	};
	// Several of these resolve to CJS under the `require` condition, so the callable
	// surface arrives on `default` rather than as a named export.
	const interop = <T>(module: Record<string, unknown>, key: string): T => {
		const direct = module[key];
		if (direct !== undefined) return direct as T;
		const fallback = (module.default as Record<string, unknown> | undefined)?.[key];
		if (fallback === undefined) throw new Error(`No export ${key} on the resolved module.`);
		return fallback as T;
	};
	const laneVersion = (lane: string, name: string): string =>
		(laneRequire(lane)(`${name}/package.json`) as { version: string }).version;

	const SPACE_RUN = 'one' + String.fromCharCode(0x20, 0x20) + 'two';
	const NBSP_ONE = 'one' + String.fromCharCode(0x00a0) + 'two';

	// Every lane below emits the probe text between the two anchors `one` and
	// `two`, so one extractor reads all of them. Deliberately non-greedy: it takes
	// the FIRST such span, which is the template text and not a later re-emission.
	const between = (haystack: string): string => haystack.match(/one[\s\S]*?two/)?.[0] ?? '(absent)';

	async function measureLanes(text: string): Promise<Record<string, string>> {
		const react = await laneImport('react', 'react');
		const reactServer = await laneImport('react', 'react-dom/server.node');
		const createElement = interop<(tag: string, props: null, child: string) => unknown>(
			react,
			'createElement',
		);
		const renderToStaticMarkup = interop<(element: unknown) => string>(
			reactServer,
			'renderToStaticMarkup',
		);

		const svelte = await laneImport('svelte', 'svelte/compiler');
		const compileSvelte = interop<
			(source: string, options: { generate: string }) => { js: { code: string } }
		>(svelte, 'compile');

		const babel = await laneImport('solid', '@babel/core');
		const transformSync = interop<(source: string, options: unknown) => { code: string }>(
			babel,
			'transformSync',
		);
		const solidPreset = laneRequire('solid').resolve('babel-preset-solid');

		const vue = await laneImport('vue', '@vue/compiler-sfc');
		const parseSfc = interop<
			(source: string, options: { filename: string }) => { descriptor: { template: SfcTemplate } }
		>(vue, 'parse');

		const angular = await laneImport('angular', '@angular/compiler');
		const parseTemplate = interop<
			(template: string, url: string) => { nodes: readonly AngularNode[] }
		>(angular, 'parseTemplate');

		// `@qwik.dev/core`'s ./optimizer subpath exposes only bundler plugins. The
		// callable transform lives in `@qwik.dev/optimizer`, which core loads itself
		// and which is linked into core's own node_modules - so it is resolved THROUGH
		// core rather than as a bare specifier or a hard-coded store path.
		const coreRequire = createRequire(laneRequire('qwik').resolve('@qwik.dev/core/package.json'));
		const optimizerManifest = coreRequire('@qwik.dev/optimizer/package.json') as {
			exports: { '.': { import: string } };
		};
		const optimizerEntry = new URL(
			optimizerManifest.exports['.'].import,
			pathToFileURL(coreRequire.resolve('@qwik.dev/optimizer/package.json')),
		).href;
		const { createOptimizer } = (await import(/* @vite-ignore */ optimizerEntry)) as {
			createOptimizer: () => Promise<QwikOptimizer>;
		};
		const optimizer = await createOptimizer();
		const qwikModules = await optimizer.transformModules({
			srcDir: '/src',
			input: [{ path: 'probe.tsx', code: `export const C = () => <p>${text}</p>;\n` }],
			sourceMaps: false,
			minify: 'none',
			transpileTs: true,
			transpileJsx: true,
			mode: 'lib',
		});

		const vueText = parseSfc(`<template><p>${text}</p></template>`, {
			filename: 'probe.vue',
		}).descriptor.template.ast.children.find((child) => child.tag === 'p')?.children[0]?.content;

		const angularText = parseTemplate(`<p>${text}</p>`, 'probe.html')
			.nodes.find((node) => node.name === 'p')
			?.children.find((child) => typeof child.value === 'string')?.value;

		return {
			react: renderToStaticMarkup(createElement('p', null, text))
				.replace(/^<p>/, '')
				.replace(/<\/p>$/, ''),
			qwik: between(qwikModules.modules.map((module) => module.code).join('\n')),
			svelte: between(compileSvelte(`<p>${text}</p>`, { generate: 'server' }).js.code),
			solid: between(
				transformSync(`const C = () => <p>${text}</p>;`, {
					presets: [[solidPreset, { generate: 'ssr', hydratable: false }]],
					filename: 'probe.jsx',
					babelrc: false,
					configFile: false,
				}).code,
			),
			vue: vueText ?? '(absent)',
			angular: angularText ?? '(absent)',
		};
	}

	const codePoints = (value: string): string =>
		[...value]
			.map((character) => character.codePointAt(0)!.toString(16).padStart(4, '0'))
			.join(' ');

	const versions = (): Record<string, string> => ({
		react: laneVersion('react', 'react-dom'),
		qwik: laneVersion('qwik', '@qwik.dev/core'),
		svelte: laneVersion('svelte', 'svelte'),
		solid: laneVersion('solid', 'babel-preset-solid'),
		vue: laneVersion('vue', '@vue/compiler-sfc'),
		angular: laneVersion('angular', '@angular/compiler'),
	});

	/**
	 * A RUN OF U+0020 SPLITS THE SIX 3-3. This is the row the whole finding started
	 * from, and the row that makes the construct non-neutral.
	 */
	test('a run of U+0020: react, qwik and svelte PRESERVE; solid, vue and angular CONDENSE', async () => {
		const measured = await measureLanes(SPACE_RUN);
		expect(mapValues(measured, codePoints), `measured at ${JSON.stringify(versions())}`).toEqual({
			react: '006f 006e 0065 0020 0020 0074 0077 006f',
			qwik: '006f 006e 0065 0020 0020 0074 0077 006f',
			svelte: '006f 006e 0065 0020 0020 0074 0077 006f',
			solid: '006f 006e 0065 0020 0074 0077 006f',
			vue: '006f 006e 0065 0020 0074 0077 006f',
			angular: '006f 006e 0065 0020 0074 0077 006f',
		});
	});

	/**
	 * A SINGLE U+00A0 SPLITS THE SIX 5-1, AND SOLID IS ALONE. This is the row T027
	 * did not have and the row that disqualifies normalisation: the two lanes that
	 * DO condense space runs, vue and angular, both preserve U+00A0 byte-for-byte.
	 * Making all six agree would therefore mean normalising FIVE lanes down to
	 * solid's floor and deleting non-breaking-space semantics product-wide.
	 *
	 * The qwik cell here is the one T038 recorded as unmeasured. It is PRESERVE.
	 */
	test('a single U+00A0: only solid rewrites it, and it rewrites it to U+0020', async () => {
		const measured = await measureLanes(NBSP_ONE);
		expect(mapValues(measured, codePoints), `measured at ${JSON.stringify(versions())}`).toEqual({
			react: '006f 006e 0065 00a0 0074 0077 006f',
			qwik: '006f 006e 0065 00a0 0074 0077 006f',
			svelte: '006f 006e 0065 00a0 0074 0077 006f',
			solid: '006f 006e 0065 0020 0074 0077 006f',
			vue: '006f 006e 0065 00a0 0074 0077 006f',
			angular: '006f 006e 0065 00a0 0074 0077 006f',
		});
	});
});

interface SfcTemplate {
	readonly ast: { readonly children: ReadonlyArray<{ tag?: string; children: Array<{ content?: string }> }> };
}

interface AngularNode {
	readonly name?: string;
	readonly value?: unknown;
	readonly children?: readonly AngularNode[];
}

interface QwikOptimizer {
	transformModules(options: {
		srcDir: string;
		input: ReadonlyArray<{ path: string; code: string }>;
		sourceMaps: boolean;
		minify: string;
		transpileTs: boolean;
		transpileJsx: boolean;
		mode: string;
	}): Promise<{ modules: ReadonlyArray<{ code: string }> }>;
}

function mapValues(
	record: Record<string, string>,
	transform: (value: string) => string,
): Record<string, string> {
	return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, transform(value)]));
}

describe('closure and honesty', () => {
	for (const file of FIXTURES) {
		test(`${file}: every graphNodeId resolves and every analyzer host shape is present`, async () => {
			const ir = await fixtureIr(file);
			const bindingIds = new Set(ir.records.bindings.map((binding) => binding.id));
			const referenced = new Set<string>();
			const visit = (value: unknown): void => {
				if (!value || typeof value !== 'object') return;
				if (Array.isArray(value)) return void value.forEach(visit);
				for (const [key, child] of Object.entries(value)) {
					if (key === 'graphNodeId' && typeof child === 'string') referenced.add(child);
					if (key === 'path' && Array.isArray(child)) {
						expect(
							child.every((part) => typeof part === 'string' && !/[()]/.test(part)),
							`degraded path ${String(child)}`,
						).toBe(true);
					}
					visit(child);
				}
			};
			visit(ir);
			for (const id of referenced) expect(bindingIds.has(id), `dangling ${id}`).toBe(true);

			const actual = hosts(ir).map((host): [string, string[]] => [
				host.tag,
				[
					...host.staticAttributes.map((attribute) => attribute.name),
					...host.dynamicBindings.map((binding) => binding.name),
				],
			]);
			for (const [tag, attribute] of EXPECTED_HOSTS[file]) {
				const index = actual.findIndex(
					([actualTag, attributes]) =>
						actualTag === tag && (!attribute || attributes.includes(attribute)),
				);
				expect(index, `missing <${tag} ${attribute}>`).toBeGreaterThanOrEqual(0);
				actual.splice(index, 1);
			}
			expect(actual).toEqual([]);
		});
	}

	test('the public contract has an allowlisted top-level shape and no public Markless type dependency', async () => {
		const allowed = new Set([
			'version',
			'filename',
			'imports',
			'module',
			'components',
			'records',
		]);
		const hasOnlyKnownTopLevelKeys = (value: object): boolean =>
			Object.keys(value).every((key) => allowed.has(key));
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			expect(hasOnlyKnownTopLevelKeys(ir)).toBe(true);
			expect(hasOnlyKnownTopLevelKeys({ ...ir, unknownArtifact: {} })).toBe(false);
		}
		const schemaSource = readFileSync(new URL('../src/schema.ts', import.meta.url), 'utf8');
		expect(schemaSource).not.toContain('@markless/');
	});

	test('record tables use defined locale-independent sort keys and filenames are normalized', async () => {
		const compare = (left: string, right: string): number =>
			left < right ? -1 : left > right ? 1 : 0;
		const sorted = <T>(values: readonly T[], key: (value: T) => string): T[] =>
			[...values].sort((a, b) => compare(key(a), key(b)));
		const sortedWrites = <
			T extends {
				componentId: string;
				graphNodeId: string;
				path: readonly string[];
				operation: string;
				method?: string;
				sourceSpan?: { start: number; end: number };
			},
		>(
			values: readonly T[],
		): T[] =>
			[...values].sort(
				(a, b) =>
					compare(a.componentId, b.componentId) ||
					compare(a.graphNodeId, b.graphNodeId) ||
					compare(a.path.join('\0'), b.path.join('\0')) ||
					compare(a.operation, b.operation) ||
					compare(a.method ?? '', b.method ?? '') ||
					(a.sourceSpan?.start ?? -1) - (b.sourceSpan?.start ?? -1) ||
					(a.sourceSpan?.end ?? -1) - (b.sourceSpan?.end ?? -1),
			);
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			expect(ir.records.bindings).toEqual(
				sorted(ir.records.bindings, (binding) => binding.id),
			);
			expect(ir.records.aliases).toEqual(sorted(ir.records.aliases, (alias) => alias.id));
			expect(ir.records.events).toEqual(sorted(ir.records.events, (event) => event.id));
			expect(ir.records.stateReads).toEqual(
				sorted(
					ir.records.stateReads,
					(read) => `${read.componentId}\0${read.graphNodeId}\0${read.path.join('\0')}`,
				),
			);
			expect(ir.records.stateWrites).toEqual(sortedWrites(ir.records.stateWrites));
			for (const binding of ir.records.bindings) {
				expect(binding.reads).toEqual(
					sorted(
						binding.reads,
						(read) =>
							`${read.componentId}\0${read.graphNodeId}\0${read.path.join('\0')}`,
					),
				);
				expect(binding.writes).toEqual(sortedWrites(binding.writes));
			}
			for (const event of ir.records.events) {
				expect(event.handlers).toEqual(
					sorted(
						event.handlers,
						(handler) =>
							`${String(handler.expression.start).padStart(12, '0')}\0${String(handler.expression.end).padStart(12, '0')}`,
					),
				);
				for (const handler of event.handlers)
					expect(handler.writes).toEqual(sortedWrites(handler.writes));
			}
		}
		const source = readFileSync(
			new URL('./fixtures/s1-render-once.tsrx', import.meta.url),
			'utf8',
		);
		const ir = await buildEnrichedIr({
			filename: '/machine/private/project/src/fixtures/s1-render-once.tsrx',
			source,
		});
		expect(ir.filename).toBe('src/fixtures/s1-render-once.tsrx');
		expect(dumpEnrichedIr(ir)).not.toContain('/machine/private/project');
	});

	test('lowered assignment and call writes carry AST operands instead of source fragments', async () => {
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			for (const write of ir.records.stateWrites) {
				if (write.operation === 'assign') expect(typeof write.value?.type).toBe('string');
				if (write.operation === 'call') expect(write.arguments).toBeDefined();
			}
		}
	});
});

describe('golden dumps', () => {
	for (const file of FIXTURES) {
		test(`${file}: deterministic across builds and byte-equal to its checked-in golden`, async () => {
			const firstIr = await fixtureIr(file);
			expect(firstIr.records.behaviors).toEqual([]);
			const first = dumpEnrichedIr(firstIr);
			const second = dumpEnrichedIr(await fixtureIr(file));
			expect(second).toBe(first);
			const goldenUrl = new URL(`./goldens/${basename(file, '.tsrx')}.json`, import.meta.url);
			if (process.env.UPDATE_GOLDENS === '1') writeFileSync(goldenUrl, first);
			expect(readFileSync(goldenUrl, 'utf8')).toBe(first);
		});
	}
});
