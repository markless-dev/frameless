import { readFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { parse } from 'yuku-parser';
import { analyze } from 'yuku-analyzer';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
import { checkSources } from '../src/gate/index.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');
const fixtures = [
	['S1.jsx', 's1-render-once.json'],
	['S2.jsx', 's2-keyed-todo.json'],
	['S3.jsx', 's3-event-form.json'],
] as const;

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(await readFile(resolve(goldenRoot, name), 'utf8')) as EnrichedIR;
}

function clone<T>(value: T): T {
	return structuredClone(value);
}
function visit(value: unknown, callback: (record: Record<string, any>) => void): void {
	if (!value || typeof value !== 'object') return;
	callback(value as Record<string, any>);
	for (const child of Object.values(value)) {
		if (Array.isArray(child)) child.forEach((entry) => visit(entry, callback));
		else visit(child, callback);
	}
}
function staticAttributeValue(source: string, name: string): string {
	const parsed = parse(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	expect(parsed.diagnostics).toEqual([]);
	const module = analyze(source, { lang: 'jsx', sourceType: 'module', preserveParens: false });
	let result: string | undefined;
	visit(module.ast, (record) => {
		if (record.type !== 'JSXAttribute' || record.name?.name !== name || result !== undefined)
			return;
		const value =
			record.value?.type === 'JSXExpressionContainer'
				? record.value.expression
				: record.value;
		if (value?.type === 'Literal' && typeof value.value === 'string') result = value.value;
	});
	if (result === undefined) throw new Error(`missing ${name}`);
	return result;
}
function findKind(value: unknown, kind: string): Record<string, any> | null {
	let found: Record<string, any> | null = null;
	visit(value, (record) => {
		if (!found && record.kind === kind) found = record;
	});
	return found;
}
function addElementsToEmptyBranchArms(value: unknown): void {
	visit(value, (record) => {
		if (record.kind !== 'branch') return;
		for (const [index, arm] of record.arms.entries()) {
			if (arm.children.length) continue;
			arm.children.push({
				kind: 'host',
				id: `${record.id}:metamorphic-arm:${index}`,
				tag: 'span',
				staticAttributes: [],
				dynamicBindings: [],
				eventIds: [],
				children: [],
			});
		}
	});
}

describe('Solid structural emitter', () => {
	for (const [output, goldenName] of fixtures) {
		test(`${output} is fresh from the compiler EnrichedIR golden`, async () => {
			const ir = await golden(goldenName);
			validateEnrichedIr(ir);
			expect(await readFile(resolve(root, 'generated', output), 'utf8')).toBe(
				await formatEmitted(emit(ir)),
			);
		});
	}

	test('audits every T003 lowering delta in the actual generated files', async () => {
		const [s1, s2, s3] = await Promise.all(
			['S1.jsx', 'S2.jsx', 'S3.jsx'].map((file) =>
				readFile(resolve(root, 'generated', file), 'utf8'),
			),
		);
		expect(s1).toMatch(/untrack\(\(\) =>\s*props\.onTrace/);
		expect(s1).toContain('const derived = () =>');
		expect(s1).toMatch(/<Show\s+when=/);
		expect(s2).toMatch(/createStore\(\s*untrack\(\(\) =>\s*props\.seed\.map/);
		expect(s2.match(/setTodos\(\s*produce\(/g)).toHaveLength(2);
		expect(s2.match(/setTodos\(\s*reconcile\(/g)).toHaveLength(4);
		expect(s2).toContain("key: 'id'");
		expect(s2).toMatch(/value=\{todo\.title\}\s+attr:value=\{todo\.title\}/);
		expect(s2).not.toContain('todos() &&');
		expect(s3).toMatch(/value=\{text\(\)\}\s+attr:value=\{text\(\)\}\s+onInput=/);
		expect(s3).toMatch(/setWrites\(1\);\s*setWrites\(2\);/);
		expect(`${s1}\n${s2}\n${s3}`).not.toMatch(/createMemo|className=|htmlFor=/);
	});

	test('preserves authored multi-write order instead of applying React SSA collapse', async () => {
		const source = emit(await golden('s3-event-form.json'));
		const first = source.indexOf('setWrites(1)');
		const second = source.indexOf('setWrites(2)');
		const callback = source.indexOf("props.onTrace('submit'");
		expect(first).toBeGreaterThan(-1);
		expect(second).toBeGreaterThan(first);
		expect(callback).toBeGreaterThan(second);
	});

	test('has an AST-only boundary without fixture signatures or source recovery', async () => {
		const emitter = await Promise.all(
			['index.ts', 'estree.ts'].map((file) =>
				readFile(resolve(root, 'src/emitter', file), 'utf8'),
			),
		).then((files) => files.join('\n'));
		const gate = await Promise.all(
			['index.ts', 'custom-policies.ts'].map((file) =>
				readFile(resolve(root, 'src/gate', file), 'utf8'),
			),
		).then((files) => files.join('\n'));
		const regenerate = await readFile(resolve(root, 'scripts/regenerate.ts'), 'utf8');
		expect(`${emitter}\n${gate}`).not.toMatch(/from ['"](?:@babel\/|@markless\/|@tsrx\/)/);
		expect(emitter).toContain("from 'yuku-codegen'");
		expect(`${emitter}\n${gate}`).toContain("from 'yuku-analyzer'");
		expect(emitter).not.toMatch(
			/RenderOnce|KeyedTodo|EventForm|S1|S2|S3|FIXTURE_DIGEST|createHash/,
		);
		expect(regenerate).not.toContain('.tsrx');
		expect(regenerate).toContain('../../compiler/test/goldens');
	});

	describe('metamorphic regeneration', () => {
		test.each(['a"b', "a'b", 'a\nb', 'a{b}', '雪☃', '&quot;&amp;'])(
			'static JSX attributes round-trip with value fidelity: %j',
			async (value) => {
				const ir = clone(await golden('s1-render-once.json'));
				const host = ir.components[0]!.template[0];
				if (host?.kind !== 'host') throw new Error('expected host root');
				(host.staticAttributes as any[]).push({ name: 'data-probe', value });
				const source = emit(ir);
				const module = analyze(source, { lang: 'jsx', sourceType: 'module' });
				expect(module.diagnostics).toEqual([]);
				let actual: unknown;
				module.walk({
					JSXAttribute(node: any) {
						if (node.name.name !== 'data-probe') return;
						actual =
							node.value.type === 'Literal'
								? node.value.value
								: node.value.expression.value;
					},
				});
				expect(actual).toBe(value);
			},
		);
		test('an added static attribute changes only that host attribute', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			const host = ir.components[0]!.template[0];
			if (host?.kind !== 'host') throw new Error('expected host root');
			(host.staticAttributes as any[]).push({ name: 'data-metamorphic', value: 'yes' });
			const changed = emit(ir);
			expect(changed.replace(' data-metamorphic="yes"', '')).toBe(
				emit(await golden('s1-render-once.json')),
			);
		});

		test.each(['a"b', "a'b", 'a\nb', 'a{b}', '雪❄', 'a&amp;b'])(
			'round-trips the static JSX attribute value %j',
			async (value) => {
				const ir = clone(await golden('s1-render-once.json'));
				const host = ir.components[0]!.template[0];
				if (host?.kind !== 'host') throw new Error('expected host root');
				(host.staticAttributes as any[]).push({ name: 'data-probe', value });
				const source = emit(ir);
				expect(staticAttributeValue(source, 'data-probe')).toBe(value);
			},
		);

		test('scrambled local storage order follows semantic order', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			(ir.components[0]!.locals as any[]).reverse();
			expect(emit(ir)).toBe(emit(await golden('s1-render-once.json')));
		});

		test('component, signal, store, row, and ordinary-local renames are data-driven', async () => {
			const s1 = clone(await golden('s1-render-once.json')) as any;
			const s1Renames = new Map([
				['RenderOnce', 'ChangedView'],
				['count', 'total'],
				['prefix', 'caption'],
			]);
			visit(s1, (record) => {
				if (typeof record.name === 'string' && s1Renames.has(record.name))
					record.name = s1Renames.get(record.name);
				if (record.type === 'Identifier' && s1Renames.has(record.name))
					record.name = s1Renames.get(record.name);
			});
			s1.components[0].locals.forEach((local: any) => {
				local.names = local.names.map((name: string) => s1Renames.get(name) ?? name);
			});
			s1.components[0].name = 'ChangedView';
			s1.module.exports[0].componentName = 'ChangedView';
			s1.module.exports[0].exportedName = 'ChangedView';
			const changedS1 = emit(s1);
			expect(changedS1).toContain('function ChangedView');
			expect(changedS1).toContain('const [total, setTotal]');
			expect(changedS1).toContain('const caption = untrack');

			const s2 = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(s2.components[0].template);
			visit(s2, (record) => {
				if (record.type === 'Identifier' && record.name === 'todos')
					record.name = 'records';
				if (record.type === 'Identifier' && record.name === 'todo') record.name = 'entry';
				if (record.name === 'todos') record.name = 'records';
			});
			s2.components[0].locals.find((local: any) => local.names.includes('todos')).names = [
				'records',
			];
			const repeat = findKind(s2.components[0].template, 'keyed-repeat')!;
			repeat.item = 'entry';
			const changedS2 = emit(s2);
			expect(changedS2).toContain('const [records, setRecords] = createStore');
			expect(changedS2).toContain('<For each={records}>{(entry) =>');
		});

		test('a coherent row identity rename drives every keyed store use', async () => {
			const ir = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(ir.components[0].template);
			visit(ir, (record) => {
				if (
					record.type === 'MemberExpression' &&
					record.computed === false &&
					record.property?.type === 'Identifier' &&
					record.property.name === 'id'
				)
					record.property.name = 'identity';
				if (
					record.type === 'Property' &&
					record.computed === false &&
					record.key?.type === 'Identifier' &&
					record.key.name === 'id'
				)
					record.key.name = 'identity';
				if (Array.isArray(record.path))
					record.path = record.path.map((part: string) =>
						part === 'id' ? 'identity' : part,
					);
			});
			validateEnrichedIr(ir);
			const source = emit(ir);
			expect(source).toContain("key: 'identity'");
			expect(source).toContain('identity: `c${next}`');
			expect(source).toContain('item.identity === todo.identity');
			expect(source).toContain('data-oracle-row-key={todo.identity}');
			expect(source).not.toMatch(/\.id\b/);
			expect(
				(await checkSources([{ file: 'generated/CoherentKeyRename.jsx', source }]))
					.violations,
			).toEqual([]);
		});

		test('lexical shadowing and generated import collisions remain binding-safe', async () => {
			const shadowed = clone(await golden('s1-render-once.json')) as any;
			shadowed.records.events[0].handlers[0].expression.body.body.unshift({
				type: 'ExpressionStatement',
				expression: {
					type: 'CallExpression',
					optional: false,
					callee: {
						type: 'ArrowFunctionExpression',
						async: false,
						expression: true,
						params: [{ type: 'Identifier', name: 'count' }],
						body: { type: 'Identifier', name: 'count' },
					},
					arguments: [{ type: 'Literal', value: 7, raw: '7' }],
				},
			});
			expect(emit(shadowed)).toContain('((count) => count)(7)');

			const collided = clone(await golden('s1-render-once.json')) as any;
			visit(collided, (record) => {
				if (record.type === 'Identifier' && record.name === 'count')
					record.name = 'createSignal';
				if (record.name === 'count') record.name = 'createSignal';
			});
			collided.components[0].locals.find((local: any) =>
				local.names.includes('count'),
			).names = ['createSignal'];
			const source = emit(collided);
			expect(source).toContain('createSignal as createSignal2');
			expect(source).toContain('const [createSignal, setCreateSignal] = createSignal2(1)');
		});

		test('opaque graph ids leave binding-kind-driven output unchanged', async () => {
			const baselineIr = await golden('s1-render-once.json');
			const baseline = emit(baselineIr);
			const ir = clone(baselineIr) as any;
			const graphIds = new Map(
				ir.records.bindings.map((binding: any, index: number) => [binding.id, `g${index}`]),
			);
			visit(ir, (record) => {
				for (const [field, value] of Object.entries(record)) {
					if (typeof value === 'string' && graphIds.has(value))
						record[field] = graphIds.get(value);
					else if (Array.isArray(value))
						record[field] = value.map((entry) =>
							typeof entry === 'string' && graphIds.has(entry)
								? graphIds.get(entry)
								: entry,
						);
				}
			});
			validateEnrichedIr(ir);
			expect(ir.records.bindings.map((binding: any) => binding.id)).toEqual([
				'g0',
				'g1',
				'g2',
			]);
			expect(emit(ir)).toBe(baseline);
		});

		test('store-member lowering uses write structure without statement adjacency', async () => {
			const ir = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(ir.components[0].template);
			const handler = ir.records.events
				.flatMap((event: any) => event.handlers)
				.find((entry: any) =>
					entry.writes.some((write: any) => write.path.join('/') === '*/title'),
				);
			handler.expression.body.body.splice(2, 0, {
				type: 'ExpressionStatement',
				expression: { type: 'Literal', value: 0, raw: '0' },
			});
			const source = emit(ir);
			expect(source).toContain('setTodos(produce(');
			expect(source).toMatch(/0;\s*props\.onTrace\('edit'/);
		});

		test('store-member lowering targets the recorded alias across predicate shadowing', async () => {
			const ir = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(ir.components[0].template);
			const handler = ir.records.events
				.flatMap((event: any) => event.handlers)
				.find((entry: any) =>
					entry.writes.some((write: any) => write.path.join('/') === '*/title'),
				);
			visit(handler.expression, (record) => {
				if (record.type === 'Identifier' && record.name === 'alias') record.name = 'item';
			});
			validateEnrichedIr(ir);
			const source = emit(ir);
			expect(source).toMatch(
				/setTodos\(produce\(\(storeDraft\) => \{\s*const item = storeDraft\.find\(\(item\) => item\.id === todo\.id\);\s*item\.title = title;/,
			);
			expect(source).not.toContain('const item = todos.find');
			expect(
				(await checkSources([{ file: 'generated/StoreShadow.jsx', source }])).violations,
			).toEqual([]);
		});
	});

	describe('fail-closed validation', () => {
		test('rejects the same multi-component fixture as React with the Solid composition diagnostic', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.components.push({
				...clone(ir.components[0]),
				id: 'component:1:Additional',
				name: 'Additional',
			});
			ir.module.exports.push({
				kind: 'named',
				componentName: 'Additional',
				exportedName: 'Additional',
			});
			expect(() => validateEnrichedIr(ir)).toThrow(
				'EnrichedComponent cannot be lowered: multi-component modules land in the Solid composition package',
			);
		});

		test('rejects an exact /1 artifact with the version diagnostic', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.version = 'frameless-enriched-ir/1';
			expect(() => validateEnrichedIr(ir)).toThrow(
				'Expected frameless-enriched-ir/2, received frameless-enriched-ir/1',
			);
		});

		test('rejects a component-reference with its construct diagnostic', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.components[0].template = [
				{
					kind: 'component-reference',
					id: 'component-reference:child',
					edgeId: 'edge:child',
					target: { localName: 'Child', module: 'self' },
					props: [],
					children: [],
				},
			];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/TemplateComponentReference cannot be lowered.*Solid composition package/,
			);
		});

		test('rejects a non-empty SharedDefinition family with its construct diagnostic', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.records.sharedDefinitions = [
				{
					id: 'shared:counter',
					scope: 'container',
					cells: [],
					methods: [],
					graphBindings: [],
					returnProperties: [],
					dependencies: [],
				},
			];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/SharedDefinition cannot be lowered.*Solid composition package/,
			);
		});

		test.each([
			[
				'unknown field',
				(ir: any) => {
					ir.records.bindings[0].futureSemantic = true;
				},
				/EnrichedGraphBinding has unknown semantic field/,
			],
			[
				'dangling id',
				(ir: any) => {
					ir.components[0].locals[1].semanticRecordIds = ['state:missing'];
				},
				/LocalDeclaration has dangling semantic record id/,
			],
			[
				'malformed node',
				(ir: any) => {
					ir.components[0].template[0].kind = 'portal';
				},
				/TemplateNode has malformed construct/,
			],
			[
				'unsupported write',
				(ir: any) => {
					ir.records.events[0].handlers[0].writes[0].operation = 'delete';
				},
				/unsupported write shape/,
			],
			[
				'legacy string',
				(ir: any) => {
					ir.records.events[0].handlers[0].handlerSources = ['ignored'];
				},
				/Legacy source-string field is forbidden/,
			],
		])('rejects %s', async (_name, mutate, message) => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			mutate(ir);
			expect(() => validateEnrichedIr(ir)).toThrow(message);
		});

		test('rejects dangling and mutated keyed semantics', async () => {
			const dangling = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(dangling.components[0].template);
			findKind(dangling.components[0].template, 'keyed-repeat')!.key.reads = [];
			expect(() => validateEnrichedIr(dangling)).toThrow(/unconsumed key semantics/);
			const mutated = clone(await golden('s2-keyed-todo.json')) as any;
			addElementsToEmptyBranchArms(mutated.components[0].template);
			const write = mutated.records.events
				.flatMap((event: any) => event.handlers)
				.flatMap((handler: any) => handler.writes)
				.find((entry: any) => entry.via === 'handler-local-alias');
			write.path = ['*', 'id'];
			expect(() => validateEnrichedIr(mutated)).toThrow(/unsupported identity mutation/);
		});

		test('sanctions empty branch arms but rejects non-empty element-less arms', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			const branch = findKind(ir.components[0].template, 'branch')!;
			const text = clone(findKind(ir.components[0].template, 'text')!);
			branch.arms[0].children = [];
			expect(() => validateEnrichedIr(ir)).not.toThrow();
			branch.arms[0].children = [text];
			expect(() => validateEnrichedIr(ir)).toThrow(
				/TemplateBranchArm then .* is element-less/,
			);
		});

		test('rejects handler AST reads absent from read records', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.records.events[0].handlers[0].expression.body.body.unshift({
				type: 'ExpressionStatement',
				expression: { type: 'Identifier', name: 'label' },
			});
			expect(() => validateEnrichedIr(ir)).toThrow(/handler AST read absent from records/);
		});

		test('rejects branch AST reads absent from read records', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			const branch = findKind(ir.components[0].template, 'branch')!;
			branch.expression = { type: 'Identifier', name: 'count' };
			branch.reads = [];
			expect(() => validateEnrichedIr(ir)).toThrow(/branch AST read absent from records/);
		});

		test('rejects branch read records absent from the AST', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			const branch = findKind(ir.components[0].template, 'branch')!;
			branch.expression = { type: 'Literal', value: true, raw: 'true' };
			expect(() => validateEnrichedIr(ir)).toThrow(/branch read record absent from AST/);
		});

		test('reconciles computed binding reads in both directions', async () => {
			const absentRecord = clone(await golden('s1-render-once.json')) as any;
			const computed = absentRecord.records.bindings.find(
				(binding: any) => binding.kind === 'computed',
			);
			computed.computed.expression.body = { type: 'Identifier', name: 'count' };
			computed.computed.reads = [];
			expect(() => validateEnrichedIr(absentRecord)).toThrow(
				/computed binding AST read absent from records/,
			);

			const absentAst = clone(await golden('s1-render-once.json')) as any;
			const reverseComputed = absentAst.records.bindings.find(
				(binding: any) => binding.kind === 'computed',
			);
			reverseComputed.computed.expression.body = { type: 'Literal', value: 1, raw: '1' };
			expect(() => validateEnrichedIr(absentAst)).toThrow(
				/computed binding read record absent from AST/,
			);
		});

		test('rejects handler AST writes absent from write records', async () => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			ir.records.events[0].handlers[0].expression.body.body.unshift({
				type: 'ExpressionStatement',
				expression: {
					type: 'AssignmentExpression',
					operator: '=',
					left: { type: 'Identifier', name: 'count' },
					right: { type: 'Literal', value: 7, raw: '7' },
				},
			});
			expect(() => validateEnrichedIr(ir)).toThrow(/handler AST write absent from records/);
		});
	});
});
