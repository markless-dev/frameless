import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildEnrichedIr } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

/**
 * STEP 5, COMPOSITION - the Angular half of the third regeneration tier.
 *
 * `generated-composition/` existed for react and solid only until this step,
 * because four lanes could not emit a `component-reference` at all: the emitters
 * contained ZERO occurrences of the construct against six in react and four in
 * solid. This script is the Angular lane joining that tier.
 *
 * THE CORPUS IS NOT IDENTICAL ACROSS THE SIX LANES, AND THAT IS THE MEASUREMENT
 * RATHER THAN AN OMISSION. `M1-panel` / `M2-page` are a two-module set - one
 * component per module, linked by a real `ModuleImport` - and every one of the
 * six lanes emits them.
 *
 * `C1-slot` is the SAME fixture react and solid already carry - two components in
 * ONE module - and this lane can express it because a `.ts` file holds as many
 * component declarations as the module has components. THE SVELTE AND VUE LANES
 * CANNOT, and they carry no `C1-slot` for that reason: it is a recorded lane
 * limit, not a gap in this corpus.
 */
const root = resolve(import.meta.dirname, '..');
const fixtureRoot = resolve(root, 'test/composition-fixtures');
const outputRoot = resolve(root, 'generated-composition');
export const compositionFixtures = [
	'C1-slot',
	'M1-panel',
	'M2-page',
] as const;

export const COMPOSITION_EXTENSION = '.ts';

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
		await writeFile(
			resolve(outputRoot, `${fixture}${COMPOSITION_EXTENSION}`),
			await emitCompositionFixture(fixture),
		);
	}
}

if (import.meta.main) {
	await regenerateComposition();
}
