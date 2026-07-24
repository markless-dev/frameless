import { readFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(
		await readFile(resolve(goldenRoot, name), 'utf8'),
	) as EnrichedIR;
}

describe('Qwik v2 structural emitter', () => {
	for (const [output, input] of [
		['S1.jsx', 's1-render-once.json'],
		['S2.jsx', 's2-keyed-todo.json'],
		['S3.jsx', 's3-event-form.json'],
	] as const)
		test(`generated/${output} is fresh from the shared compiler EnrichedIR golden`, async () => {
			const ir = await golden(input);
			validateEnrichedIr(ir);
			expect(await readFile(resolve(root, 'generated', output), 'utf8')).toBe(
				await formatEmitted(emit(ir)),
			);
		});

	test('uses resumable Qwik v2 primitives without a visible task', async () => {
		const source = await formatEmitted(emit(await golden('s1-render-once.json')));
		expect(source).toContain("from '@qwik.dev/core'");
		expect(source).toContain('export const RenderOnce = component$(');
		expect(source).toContain('const count = useSignal(1)');
		expect(source).toContain('const prefix = useSignal(() => `${props.label}:`)');
		expect(source).toContain('const derived = useComputed$');
		expect(source).toContain('count.value += 1');
		expect(source).toContain("await props.onTrace$('setup', { runs: 1 })");
		expect(source).toContain("await props.onTrace$('change', { count: count.value })");
		expect(source).toMatch(/onClick\$=\{\$\(async \(\) =>/);
		expect(source).not.toMatch(/useVisibleTask\$|onQVisible\$|q-e:qvisible/);
	});

	test('lowers S2 keyed state, controlled inputs, and ordered callbacks', async () => {
		const source = await formatEmitted(emit(await golden('s2-keyed-todo.json')));
		expect(source).toContain('const todos = useStore(props.seed.map');
		expect(source).toContain("const draft = useSignal('')");
		expect(source).toContain('const next = useSignal(3)');
		expect(source).toMatch(/todos\.map\(\(todo\) =>\s*\(\s*<li\s+key=\{todo\.id\}/);
		expect(source).toContain('value={draft.value}');
		expect(source).toContain('value={todo.title}');
		expect(source).toContain('checked={todo.done}');
		expect(source).toMatch(/onInput\$=\{\$\(async \(event, element\) =>/);
		expect(source).toMatch(/onChange\$=\{\$\(async \(event, element\) =>/);
		expect(source).toContain('draft.value = element.value');
		expect(source).toContain('const checked = element.checked');
		expect(source).toContain(
			'todos.splice(0, todos.length, ...todos.concat(item))',
		);
		expect(source.match(/todos\.splice\(/g)).toHaveLength(6);
		expect(source).toContain('todos.splice(0, todos.length, ...order)');
		expect(source).toContain("await props.onTrace$('clear', { count }, event)");
		expect(source).not.toMatch(/\bbind:|useVisibleTask\$|onQVisible\$|q-e:qvisible/);
	});

	test('lowers S3 controlled fields and preserves form event delegation', async () => {
		const source = await formatEmitted(emit(await golden('s3-event-form.json')));
		expect(source).toContain('const text = useSignal(props.initial)');
		expect(source).toContain('const checked = useSignal(false)');
		expect(source).toContain('const writes = useSignal(0)');
		expect(source).toContain('value={text.value}');
		expect(source).toContain('checked={checked.value}');
		expect(source).toContain("event.target.dataset.action === 'submit'");
		expect(source).toContain('text.value = element.value');
		expect(source).toContain('checked.value = element.checked');
		expect(source).toMatch(/writes\.value = 1;\s*writes\.value = 2;/);
		expect(source).toContain("await props.onTrace$('bubble', { source: 'form' }, event)");
		expect(source).not.toMatch(/\bbind:|useVisibleTask\$|onQVisible\$|q-e:qvisible/);
	});

	test('fails closed before emitting persistence-bearing IR', async () => {
		const ir = structuredClone(await golden('s1-render-once.json')) as any;
		ir.records.persistence.push({ graphNodeId: 'state:count' });
		expect(() => emit(ir)).toThrow('does not support persistence-bearing IR');
	});
});
