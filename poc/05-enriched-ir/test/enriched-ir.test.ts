import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildEnrichedIr, collectGraphReads } from '../src/ir/build';
import { dumpEnrichedIr } from '../src/ir/dump';
import type {
	EnrichedIR,
	SerializableAstNode,
	TemplateHost,
	TemplateNode,
} from '../src/ir/schema';

const FIXTURES = [
	's1-render-once.tsrx',
	's2-keyed-todo.tsrx',
	's3-event-form.tsrx',
] as const;

const EXPECTED_HOSTS: Record<(typeof FIXTURES)[number], Array<[string, string]>> = {
	's1-render-once.tsrx': [
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
		['output', 'data-writes'],
		['span', 'data-callback-marker'],
	],
};

async function fixtureIr(file: (typeof FIXTURES)[number]): Promise<EnrichedIR> {
	const source = readFileSync(new URL(`../src/fixtures/${file}`, import.meta.url), 'utf8');
	return buildEnrichedIr({ filename: `src/fixtures/${file}`, source });
}

function walkTemplate(nodes: readonly TemplateNode[]): TemplateNode[] {
	const found: TemplateNode[] = [];
	for (const node of nodes) {
		found.push(node);
		if (node.kind === 'host' || node.kind === 'fragment') found.push(...walkTemplate(node.children));
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
			const sites: Array<{ expression: SerializableAstNode; reads: readonly { graphNodeId: string }[] }> = [];
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

	test('S1 carries ordered locals, a props alias, setup AST, and the guard-return subtree', async () => {
		const ir = await fixtureIr('s1-render-once.tsrx');
		const component = ir.components[0]!;
		expect(component.locals.flatMap((local) => local.names)).toEqual([
			'setup',
			'count',
			'prefix',
			'derived',
		]);
		expect(component.props.entries).toContainEqual(
			expect.objectContaining({ sourceName: 'label', localName: 'displayLabel', alias: true }),
		);
		expect(callbackNames(component.locals[0]!.initializer!)).toEqual(['setup']);
		expect(component.guards).toHaveLength(1);
		expect(component.guards[0]!.whenTrue.kind).toBe('template');
		expect(hosts(ir).map((host) => host.tag)).toEqual(['p', 'section', 'output', 'button']);
	});

	test('S2 carries complete branch and keyed-row subtrees plus structural computed dependencies', async () => {
		const ir = await fixtureIr('s2-keyed-todo.tsrx');
		const nodes = allTemplateNodes(ir);
		const branch = nodes.find((node) => node.kind === 'branch');
		const repeat = nodes.find((node) => node.kind === 'keyed-repeat');
		expect(branch?.kind).toBe('branch');
		if (branch?.kind !== 'branch') throw new Error('missing S2 branch');
		expect(branch.arms).toHaveLength(2);
		expect(walkTemplate(branch.arms[0]!.children).some((node) => node.kind === 'host' && node.tag === 'p')).toBe(true);
		expect(branch.arms[1]).toEqual({ kind: 'else', children: [] });
		expect(repeat?.kind).toBe('keyed-repeat');
		if (repeat?.kind !== 'keyed-repeat') throw new Error('missing S2 repeat');
		expect(repeat.key.expression.type).toBe('MemberExpression');
		expect(walkTemplate(repeat.row).filter((node) => node.kind === 'host').map((node) => (node as TemplateHost).tag)).toEqual([
			'li', 'input', 'input', 'button',
		]);

		const complete = ir.records.bindings.find((binding) => binding.name === 'complete')!;
		expect(complete.computed?.expression.type).toBe('ArrowFunctionExpression');
		const fromSerializedAst = collectGraphReads(complete.computed!.expression, ir.records.bindings);
		expect(fromSerializedAst.map((read) => read.graphNodeId)).toEqual(['state:todos']);
		expect(complete.computed?.reads.map((read) => read.graphNodeId)).toEqual(['state:todos']);
		expect(complete.computed?.reads.some((read) => read.path.some((part) => part.includes('filter(')))).toBe(false);
	});

	test('every scripted callback is present in a setup initializer or real event-handler AST', async () => {
		const expected: Record<(typeof FIXTURES)[number], string[]> = {
			's1-render-once.tsrx': ['setup', 'change'],
			's2-keyed-todo.tsrx': ['add', 'edit', 'toggle', 'reorder', 'remove', 'clear'],
			's3-event-form.tsrx': ['text', 'checked', 'submit', 'bubble'],
		};
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			const names = [
				...ir.components.flatMap((component) =>
					component.locals.flatMap((local) => local.initializer ? callbackNames(local.initializer) : []),
				),
				...ir.records.events.flatMap((event) => event.handlers.flatMap((handler) => callbackNames(handler.expression))),
			];
			expect([...new Set(names)].sort()).toEqual([...expected[file]].sort());
			for (const event of ir.records.events) {
				expect(event.handlers).toHaveLength(1);
				expect(event.handlers[0]!.expression.type).toBe('ArrowFunctionExpression');
				expect(event.handlers[0]!.reads.length + event.handlers[0]!.writes.length).toBeGreaterThan(0);
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
		const submit = ir.records.events.find((event) =>
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

describe('closure and honesty', () => {
	for (const file of FIXTURES) {
		test(`${file}: every graphNodeId resolves and every oracle host shape is present`, async () => {
			const ir = await fixtureIr(file);
			const bindingIds = new Set(ir.records.bindings.map((binding) => binding.id));
			const referenced = new Set<string>();
			const visit = (value: unknown): void => {
				if (!value || typeof value !== 'object') return;
				if (Array.isArray(value)) return void value.forEach(visit);
				for (const [key, child] of Object.entries(value)) {
					if (key === 'graphNodeId' && typeof child === 'string') referenced.add(child);
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
					([actualTag, attributes]) => actualTag === tag && (!attribute || attributes.includes(attribute)),
				);
				expect(index, `missing <${tag} ${attribute}>`).toBeGreaterThanOrEqual(0);
				actual.splice(index, 1);
			}
			expect(actual).toEqual([]);
		});
	}

	test('the serialized contract contains no Markless web/render/resume artifacts or string expressions', async () => {
		const forbidden = new Set([
			'payloadArena', 'publicRenderPlan', 'publicRenderModule', 'symbolResolver',
			'symbolModules', 'protocolState', 'protocolView', 'runtimeDemandMap',
			'locator', 'locators', 'resume', 'handlerSources', 'functionSource',
			'valueSource', 'testSource', 'collectionSource', 'keySource',
		]);
		for (const file of FIXTURES) {
			const ir = await fixtureIr(file);
			const visit = (value: unknown): void => {
				if (!value || typeof value !== 'object') return;
				if (Array.isArray(value)) return void value.forEach(visit);
				for (const [key, child] of Object.entries(value)) {
					expect(forbidden.has(key), `target-coupled key ${key}`).toBe(false);
					visit(child);
				}
			};
			visit(ir);
		}
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
			const first = dumpEnrichedIr(await fixtureIr(file));
			const second = dumpEnrichedIr(await fixtureIr(file));
			expect(second).toBe(first);
			const goldenUrl = new URL(`./goldens/${basename(file, '.tsrx')}.json`, import.meta.url);
			if (process.env.UPDATE_GOLDENS === '1') writeFileSync(goldenUrl, first);
			expect(readFileSync(goldenUrl, 'utf8')).toBe(first);
		});
	}
});
