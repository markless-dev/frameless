import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildEnrichedIr } from '@frameless/compiler';
import { resolve } from 'pathe';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

/**
 * STEP 5, COMPOSITION - the Svelte half of the third regeneration tier.
 *
 * `generated-composition/` existed for react and solid only until this step,
 * because four lanes could not emit a `component-reference` at all: the emitters
 * contained ZERO occurrences of the construct against six in react and four in
 * solid. This script is the Svelte lane joining that tier.
 *
 * THE CORPUS IS NOT IDENTICAL ACROSS THE SIX LANES, AND THAT IS THE MEASUREMENT
 * RATHER THAN AN OMISSION. `M1-panel` / `M2-page` are a two-module set - one
 * component per module, linked by a real `ModuleImport` - and every one of the
 * six lanes emits them.
 *
 * THIS LANE CARRIES NO `C1-slot`. That fixture packs two components into ONE
 * module, and a `.svelte` file declares exactly one component - the lane limit
 * `emit` refuses by name. Recorded here so its absence is read as a measurement
 * rather than as an unfinished corpus.
 */
const root = resolve(import.meta.dirname, '..');
const fixtureRoot = resolve(root, 'test/composition-fixtures');
const outputRoot = resolve(root, 'generated-composition');
export const compositionFixtures = [
	'M1-panel',
	'M2-page',
] as const;

export const COMPOSITION_EXTENSION = '.svelte';

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
