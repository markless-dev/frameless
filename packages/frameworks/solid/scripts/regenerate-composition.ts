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
	// STEP 5 ADDED THE TWO-MODULE SET, and it is the first composition fixture
	// EVERY ONE OF THE SIX LANES CAN EMIT. C1-C8 all pack several components
	// into ONE module, which a `.svelte` file and a `.vue` SFC cannot express at
	// all - so before this pair there was no composition fixture the six emitters
	// could be compared on. `M1-panel` is the slot receiver with a prop;
	// `M2-page` imports it across a real `ModuleImport` and projects children
	// into it.
	'M1-panel',
	'M2-page',
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
