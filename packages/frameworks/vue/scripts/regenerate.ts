import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');

await mkdir(resolve(root, 'generated'), { recursive: true });
const fixtures = [
	['S1.vue', 's1-render-once.json'],
	['S2.vue', 's2-keyed-todo.json'],
	['S3.vue', 's3-event-form.json'],
	['S4.vue', 's4-nested-list.json'],
	['S5.vue', 's5-branch-teardown.json'],
	['S6.vue', 's6-whitespace-text.json'],
	['S7.vue', 's7-form-controls.json'],
	['S8.vue', 's8-async-handlers.json'],
	['S9.vue', 's9-boolean-attributes.json'],
] as const;
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), formatEmitted(emit(ir)));
}
