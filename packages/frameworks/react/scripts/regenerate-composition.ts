import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildEnrichedIr } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const fixtureRoot = resolve(root, 'test/composition-fixtures');
const outputRoot = resolve(root, 'generated-composition');
const fixtures = ['C1-slot', 'C2-shared', 'C3-ref', 'C4-attach'] as const;

await mkdir(outputRoot, { recursive: true });
for (const fixture of fixtures) {
	const filename = `test/composition-fixtures/${fixture}.tsrx`;
	const source = await readFile(resolve(fixtureRoot, `${fixture}.tsrx`), 'utf8');
	const artifact = await buildEnrichedIr({ filename, source });
	await writeFile(resolve(outputRoot, `${fixture}.jsx`), await formatEmitted(emit(artifact)));
}
