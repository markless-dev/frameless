import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');

await mkdir(resolve(root, 'generated'), { recursive: true });
const fixtures = [
	['S1.ts', 's1-render-once.json'],
	['S2.ts', 's2-keyed-todo.json'],
	['S3.ts', 's3-event-form.json'],
	['S4.ts', 's4-nested-list.json'],
] as const;
for (const [output, golden] of fixtures) {
	const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
	await writeFile(resolve(root, 'generated', output), formatEmitted(emit(ir)));
}
