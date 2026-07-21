import { readFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

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

describe('React structural emitter', () => {
	for (const [output, golden] of fixtures) {
		test(`${output} is fresh from the compiler EnrichedIR golden`, async () => {
			const ir = JSON.parse(
				await readFile(resolve(goldenRoot, golden), 'utf8'),
			) as EnrichedIR;
			validateEnrichedIr(ir);
			expect(await readFile(resolve(root, 'generated', output), 'utf8')).toBe(
				await formatEmitted(emit(ir)),
			);
		});
	}

	test('applies every dossier-required POC delta without source recovery', async () => {
		const [s1, s2, s3] = await Promise.all(
			['S1.jsx', 'S2.jsx', 'S3.jsx'].map((file) =>
				readFile(resolve(root, 'generated', file), 'utf8'),
			),
		);
		expect(s1).toContain('useRef(null)');
		expect(s1).toContain('setupDone.current === null');
		expect(s1).toContain('useState(1)');
		expect(s1).toContain('const nextCount = count + 1');
		expect(s2).toContain('const currentState2 = next.current');
		expect(s2).toContain('next.current = currentState2 + 1');
		expect(s2.match(/onChange=/g)?.length).toBe(3);
		expect(s2).toContain('event.target.value');
		expect(s2).toContain('event.target.checked');
		expect(s3).toContain('useState(false)');
		expect(s3).toContain('useState(0)');
		expect(s3.match(/setWrites\(/g)?.length).toBe(1);
		expect(`${s1}\n${s2}\n${s3}`).not.toMatch(/\blet\b|onInput=|currentTarget/);
	});

	test('has an AST-only target boundary', async () => {
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
		expect(regenerate).not.toContain('.tsrx');
		expect(regenerate).toContain('../../compiler/test/goldens');
	});

	describe('metamorphic regeneration from the checked-in golden', () => {
		// These mutations mirror the poc/07 regeneration stance: mutate the semantic
		// artifact in memory, emit it through the public boundary, and compare only
		// the output dimension that the mutation is allowed to change.
		test('an added static attribute changes only that host attribute', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			const root = ir.components[0]!.template[0];
			expect(root?.kind).toBe('host');
			if (root?.kind !== 'host') return;
			(root.staticAttributes as any[]).push({ name: 'data-metamorphic', value: 'yes' });
			const changed = emit(ir);
			expect(changed).toContain('data-metamorphic="yes"');
			expect(changed.replace(' data-metamorphic="yes"', '')).toBe(
				emit(await golden('s1-render-once.json')),
			);
		});

		test('scrambled local storage order still follows the semantic order field', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			(ir.components[0]!.locals as any[]).reverse();
			expect(emit(ir)).toBe(emit(await golden('s1-render-once.json')));
		});

		test('component, state, and ordinary-local renames are spelling-invariant', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			const renames = new Map([
				['RenderOnce', 'RenamedRender'],
				['count', 'total'],
				['prefix', 'caption'],
			]);
			visit(ir, (record) => {
				if (typeof record.name === 'string' && renames.has(record.name))
					record.name = renames.get(record.name);
				if (record.type === 'Identifier' && renames.has(record.name))
					record.name = renames.get(record.name);
			});
			ir.components[0]!.locals.forEach((local: any) => {
				local.names = local.names.map((name: string) => renames.get(name) ?? name);
			});
			(ir.components[0] as any).name = 'RenamedRender';
			(ir.module.exports[0] as any).componentName = 'RenamedRender';
			(ir.module.exports[0] as any).exportedName = 'RenamedRender';
			const changed = emit(ir);
			expect(changed).toContain('function RenamedRender');
			expect(changed).toContain('const [total, setTotal]');
			expect(changed).toContain('const [caption]');
			const normalized = changed
				.replaceAll('RenamedRender', 'RenderOnce')
				.replaceAll('setTotal', 'setCount')
				.replaceAll('nextTotal', 'nextCount')
				.replaceAll('total', 'count')
				.replaceAll('caption', 'prefix');
			expect(normalized).toBe(emit(await golden('s1-render-once.json')));
		});

		test('a nested callback shadowing a state name is not rewritten', async () => {
			const ir = clone(await golden('s1-render-once.json'));
			const handler = ir.records.events[0]!.handlers[0]!.expression as any;
			handler.body.body.unshift({
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
			const changed = emit(ir);
			expect(changed).toContain('((count) => count)(7)');
			expect(changed).toContain('const nextCount = count + 1');
		});
	});

	describe('fail-closed enriched IR validation', () => {
		test('rejects the same multi-component fixture as Solid with the React composition diagnostic', async () => {
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
				'EnrichedComponent cannot be lowered: multi-component modules land in the React composition package',
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
				/TemplateComponentReference cannot be lowered.*React composition package/,
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
				/SharedDefinition cannot be lowered.*React composition package/,
			);
		});

		test.each([
			[
				'unknown semantic field',
				(ir: any) => {
					ir.records.bindings[0].futureSemantic = true;
				},
				/EnrichedGraphBinding has unknown semantic field/,
			],
			[
				'dangling record id',
				(ir: any) => {
					ir.components[0].locals[1].semanticRecordIds = ['state:missing'];
				},
				/LocalDeclaration has dangling semantic record id/,
			],
			[
				'unsupported write shape',
				(ir: any) => {
					ir.records.events[0].handlers[0].writes[0].operation = 'delete';
				},
				/EventHandlerRecord .* unsupported write shape/,
			],
			[
				'unsupported sync shape',
				(ir: any) => {
					ir.records.events[0].syncPolicy = {
						when: { type: 'future-condition' },
						actions: ['preventDefault'],
					};
				},
				/SyncPolicy .* unsupported sync shape/,
			],
			[
				'malformed template construct',
				(ir: any) => {
					ir.components[0].template[0].kind = 'portal';
				},
				/TemplateNode has malformed construct/,
			],
		])('rejects %s with a construct-named diagnostic', async (_name, mutate, message) => {
			const ir = clone(await golden('s1-render-once.json')) as any;
			mutate(ir);
			expect(() => validateEnrichedIr(ir)).toThrow(message);
		});
	});
});
