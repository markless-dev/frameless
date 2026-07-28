import { readFile } from 'node:fs/promises';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
import {
	COMPOSITION_EXTENSION,
	compositionFixtures,
	emitCompositionFixture,
} from '../scripts/regenerate-composition.ts';

/**
 * STEP 5, COMPOSITION - the Qwik half.
 *
 * `emit` verifies its own output with `yuku-analyzer` at `lang: 'tsx'` before
 * returning, so every successful `emit` below carries a zero-diagnostic parse of
 * the emitted module with it. That is SYNTAX, NOT TYPES. This lane's type-level
 * arm is the standing `tsc`-against-resolved-`@qwik.dev/core` rig in
 * `test/refs.test.ts`, and it is deliberately not extended here: nothing this
 * step emits prints a type.
 */
const PACKAGE_ROOT = resolve(import.meta.dirname, '..');

async function ir(name: string): Promise<EnrichedIR> {
	const filename = `test/composition-fixtures/${name}.tsrx`;
	return buildEnrichedIr({
		filename,
		source: await readFile(resolve(PACKAGE_ROOT, filename), 'utf8'),
	});
}

describe('Qwik composition', () => {
	test('projects children with <Slot /> and imports the sibling module', async () => {
		const panel = emit(await ir('M1-panel'));
		// `<Slot />` IS THE ONLY MEMBER OF THE SANCTIONED SET FOR THIS CONSTRUCT.
		// `props.children` exists in Qwik v2 but is not the same construct: projected
		// content must survive RESUMPTION without the child serialising it, which is
		// what `Slot` models and what reading `children` as a value does not. This
		// lane's whole doctrine is activation-neutrality, so that is a constraint
		// rather than a preference.
		expect(panel).toContain("import { Slot, component$ } from '@qwik.dev/core';");
		expect(panel).toContain('<Slot />');
		expect(panel).toContain('{props.label}');

		const page = emit(await ir('M2-page'));
		// `.jsx`, NOT `.tsx`, and byte-for-byte the substitution the React and Solid
		// lanes already make: the artifact on disk is `.tsx` and TypeScript's bundler
		// resolution maps a `.jsx` specifier onto it. Three JSX lanes emitting three
		// different specifiers for one IR record is the opposite of what a shared IR
		// is for.
		expect(page).toContain("import { Panel } from './M1-panel.jsx';");
		expect(page).toContain("<Panel label={'Composed'}>");
	});

	/**
	 * THE MULTI-COMPONENT MODULE, WHICH THE SVELTE AND VUE LANES CANNOT EXPRESS. A
	 * `.tsx` file holds as many `component$` declarations as the module has
	 * components, so this lane carries the SAME `C1-slot` fixture react and solid
	 * do. Only the components the IR's `ModuleRecord` exports get an `export`.
	 */
	test('emits every component in a multi-component module, exporting only the exported one', async () => {
		const source = emit(await ir('C1-slot'));
		expect(source).toContain('const Frame = component$(');
		expect(source).not.toContain('export const Frame');
		expect(source).toContain('export const SlotPage = component$(');
		expect(source).toContain('<Frame>');
	});

	test('generated-composition is fresh from its fixtures', async () => {
		for (const fixture of compositionFixtures)
			expect(
				await readFile(
					resolve(PACKAGE_ROOT, 'generated-composition', `${fixture}${COMPOSITION_EXTENSION}`),
					'utf8',
				),
			).toBe(await emitCompositionFixture(fixture));
	});

	test('refuses a shared construct by its own name, not as "composition"', async () => {
		const shared = structuredClone(await ir('M2-page')) as any;
		shared.records.sharedInstances = [
			{ definitionId: 'shared:0', componentId: shared.components[0].id, localName: 'x' },
		];
		expect(() => emit(shared)).toThrow(/does not support shared constructs/);
	});

	test('refuses a component reference that names no import and no local component', async () => {
		const artifact = structuredClone(await ir('M2-page')) as any;
		artifact.imports = [];
		expect(() => emit(artifact)).toThrow(
			/TemplateComponentReference has no matching ModuleImport record|names no import or component in this module: Panel/,
		);
	});

	test('names an unknown field on every composition record this step made reachable', async () => {
		const page = await ir('M2-page');
		const panel = await ir('M1-panel');

		const reference = structuredClone(page) as any;
		reference.components[0].template[0].slotted = true;
		expect(() => validateEnrichedIr(reference)).toThrow(
			/TemplateComponentReference has unknown semantic field: slotted/,
		);
		expect(() => emit(reference)).toThrow(/unknown semantic field: slotted/);

		const prop = structuredClone(page) as any;
		prop.components[0].template[0].props[0].reactive = true;
		expect(() => validateEnrichedIr(prop)).toThrow(
			/ComponentPropExpression has unknown semantic field: reactive/,
		);

		const projection = structuredClone(panel) as any;
		projection.components[0].template[0].children[1].children[0].fallback = [];
		expect(projection.components[0].template[0].children[1].children[0].kind).toBe(
			'default-slot-projection',
		);
		expect(() => validateEnrichedIr(projection)).toThrow(
			/TemplateDefaultSlotProjection has unknown semantic field: fallback/,
		);

		expect(() => validateEnrichedIr(page)).not.toThrow();
		expect(() => validateEnrichedIr(panel)).not.toThrow();
	});

	test('emitted composition modules carry no visible task', async () => {
		// The lane's activation-neutrality ban re-checked over the NEW output surface:
		// composition must not introduce eager client work by another spelling.
		for (const fixture of compositionFixtures) {
			const source = await emitCompositionFixture(fixture);
			expect(source).not.toMatch(/useVisibleTask\$|onQVisible\$|qvisible/);
		}
	});

	test('formats to the committed bytes', async () => {
		expect(await formatEmitted(emit(await ir('C1-slot')))).toBe(
			await readFile(resolve(PACKAGE_ROOT, 'generated-composition/C1-slot.tsx'), 'utf8'),
		);
	});
});
