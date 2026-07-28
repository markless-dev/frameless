import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildEnrichedIr } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const root = resolve(import.meta.dirname, '..');
const fixtureRoot = resolve(root, 'test/composition-fixtures');
const outputRoot = resolve(root, 'generated-composition');
export const compositionFixtures = [
	'C1-slot',
	'C2-shared',
	'C3-ref',
	'C4-attach',
	'C5-props',
	'C6-scalar-context',
	'C7-object-context',
	'C8-page-store',
] as const;

export async function emitCompositionFixture(
	fixture: (typeof compositionFixtures)[number],
): Promise<string> {
	const filename = `test/composition-fixtures/${fixture}.tsrx`;
	const source = await readFile(resolve(fixtureRoot, `${fixture}.tsrx`), 'utf8');
	const artifact = await buildEnrichedIr({ filename, source });
	return formatEmitted(emit(artifact));
}

export async function regenerateComposition(): Promise<void> {
	await mkdir(outputRoot, { recursive: true });
	for (const fixture of compositionFixtures) {
		await writeFile(resolve(outputRoot, `${fixture}.tsx`), await emitCompositionFixture(fixture));
	}
}

if (import.meta.main) {
	await regenerateComposition();
}
