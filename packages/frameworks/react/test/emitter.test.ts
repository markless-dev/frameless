import { readFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';

const root = resolve(import.meta.dirname, '..');
const goldenRoot = resolve(root, '../../compiler/test/goldens');
const fixtures = [
	['S1.jsx', 's1-render-once.json'],
	['S2.jsx', 's2-keyed-todo.json'],
	['S3.jsx', 's3-event-form.json'],
] as const;

describe('React structural emitter', () => {
	for (const [output, golden] of fixtures) {
		test(`${output} is fresh from the compiler EnrichedIR golden`, async () => {
			const ir = JSON.parse(await readFile(resolve(goldenRoot, golden), 'utf8')) as EnrichedIR;
			validateEnrichedIr(ir);
			expect(await readFile(resolve(root, 'generated', output), 'utf8')).toBe(emit(ir));
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
		expect(s2).toContain('const id = next.current');
		expect(s2).toContain('next.current = id + 1');
		expect(s2.match(/onChange=/g)?.length).toBe(3);
		expect(s2).toContain('event.target.value');
		expect(s2).toContain('event.target.checked');
		expect(s3).toContain('useState(false)');
		expect(s3).toContain('useState(0)');
		expect(s3.match(/setWrites\(/g)?.length).toBe(1);
		expect(`${s1}\n${s2}\n${s3}`).not.toMatch(/\blet\b|onInput=|currentTarget/);
	});

	test('has an AST-only target boundary', async () => {
		const emitter = await readFile(resolve(root, 'src/emitter/index.ts'), 'utf8');
		const converter = await readFile(resolve(root, 'src/emitter/estree-to-babel.ts'), 'utf8');
		const regenerate = await readFile(resolve(root, 'scripts/regenerate.ts'), 'utf8');
		expect(`${emitter}\n${converter}`).not.toMatch(/from ['"](?:@babel\/parser|@markless\/|@tsrx\/)/);
		expect(`${emitter}\n${converter}`).toContain("from '@babel/types'");
		expect(emitter).toContain("from '@babel/generator'");
		expect(regenerate).not.toContain('.tsrx');
		expect(regenerate).toContain('../../compiler/test/goldens');
	});
});
