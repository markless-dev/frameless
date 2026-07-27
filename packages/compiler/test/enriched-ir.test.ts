import { readFileSync, writeFileSync } from 'node:fs';
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
};

async function fixtureIr(file: (typeof FIXTURES)[number]): Promise<EnrichedIR> {
	const source = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
	return buildEnrichedIr({ filename: `src/fixtures/${file}`, source });
}

async function compileOnlyFixtureIr(file: string): Promise<EnrichedIR> {
	const source = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
	return buildEnrichedIr({ filename: `src/fixtures/${file}`, source });
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
