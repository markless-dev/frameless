import { readFile } from 'node:fs/promises';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { compile } from 'svelte/compiler';
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
 * STEP 5, COMPOSITION - the Svelte half.
 *
 * WHAT THIS LANE'S OWN CHECKER CAN AND CANNOT SEE, stated up front so no green
 * below is over-read: `svelte/compiler`'s `compile()` reports WARNINGS AND
 * SYNTAX, NOT TYPES, and it runs inside `emit` already, so every successful
 * `emit` below carries a four-mode clean compile with it. There is no type-level
 * instrument in this package at all - `svelte-check` is coupled to
 * `demos/svelte-official`'s separate install - and NO CLAIM BELOW RESTS ON ONE.
 */
const PACKAGE_ROOT = resolve(import.meta.dirname, '..');

async function ir(name: string): Promise<EnrichedIR> {
	const filename = `test/composition-fixtures/${name}.tsrx`;
	return buildEnrichedIr({
		filename,
		source: await readFile(resolve(PACKAGE_ROOT, filename), 'utf8'),
	});
}

async function irFrom(source: string): Promise<EnrichedIR> {
	return buildEnrichedIr({ filename: 'test/composition-fixtures/probe.tsrx', source });
}

const MODES = [
	{ generate: 'client', dev: true },
	{ generate: 'client', dev: false },
	{ generate: 'server', dev: true },
	{ generate: 'server', dev: false },
] as const;

function warningCodes(source: string): string[] {
	const codes = new Set<string>();
	for (const { generate, dev } of MODES)
		for (const warning of compile(source, { filename: 'Probe.svelte', generate, dev }).warnings)
			codes.add(warning.code);
	return [...codes].sort();
}

/** Two components in ONE module - the shape this lane cannot express. */
const MULTI_COMPONENT = `function Frame({ children }) @{
	<section data-frame>{children}</section>
}

export function SlotPage() @{
	<Frame><strong data-projected-node>Projected composition</strong></Frame>
}`;

describe('Svelte composition', () => {
	test('projects children with {@render} and imports the sibling .svelte module', async () => {
		const panel = emit(await ir('M1-panel'));
		// `{@render}` is the ONLY Svelte 5 construct that invokes a snippet, and the
		// implicit `children` prop is the only place a component's child content
		// arrives - a singleton sanctioned set, so the six-gate procedure has nothing
		// to decide, exactly as T005 recorded for `bind:this`.
		expect(panel).toContain('let { label, children } = $props();');
		expect(panel).toContain('{@render children?.()}');

		const page = emit(await ir('M2-page'));
		// A `.svelte` module's component is its DEFAULT export, so the IR's NAMED
		// `ComponentExport` is honoured by the DEFAULT import here. That is a property
		// of the target format, and it is the same divergence this lane's `emit`
		// header already records for the export side.
		expect(page).toContain("import Panel from './M1-panel.svelte';");
		expect(page).toContain("<Panel label={'Composed'}");
		expect(page).toContain('</Panel>');
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

	/**
	 * THE LANE LIMIT, PINNED. A `.svelte` file declares exactly ONE component, and
	 * the corpus's own composition fixtures pack several into one module - C1-slot
	 * here, and `demos/composition-kit/src/dashboard.tsrx` packs three - so this
	 * refusal is load-bearing rather than theoretical. It is RECORDED, not forced:
	 * the nearest construct is a snippet, and a snippet body is template-only,
	 * cannot declare `$state`, cannot receive `$props()` and has no lifecycle, so a
	 * component with its own state has no snippet spelling at all.
	 */
	test('refuses a multi-component module by name', async () => {
		await expect(irFrom(MULTI_COMPONENT).then(emit)).rejects.toThrow(
			/multi-component module \(Frame, SlotPage\).*a \.svelte file declares exactly one component/s,
		);
	});

	test('refuses a same-module component reference at the printer too', async () => {
		// The front gate and the template printer refuse the same thing, so a
		// self-reference cannot reach the printer even if the front gate is widened.
		const artifact = await irFrom(MULTI_COMPONENT);
		const single = structuredClone(artifact) as any;
		single.components = [single.components[1]];
		expect(() => emit(single)).toThrow(/same-module component reference \(Frame\)/);
	});

	test('refuses a shared construct by its own name, not as "composition"', async () => {
		const artifact = (await ir('M2-page')) as any;
		const shared = structuredClone(artifact);
		shared.records.sharedInstances = [
			{ definitionId: 'shared:0', componentId: shared.components[0].id, localName: 'x' },
		];
		expect(() => emit(shared)).toThrow(/does not support shared constructs/);
	});

	/**
	 * `{@render children()}` versus `{@render children?.()}` - and the ruling came
	 * from the RUNTIME SEMANTICS, because no diagnostic distinguishes them.
	 * MEASURED here on every run: both forms compile with an EMPTY warning set in
	 * all four client x server, dev x prod modes. The optional call is emitted
	 * because the unguarded form THROWS when a parent passes no children, while
	 * React's `{children}` and Solid's `{props.children}` render nothing - so the
	 * unguarded form would make this lane diverge from the oracle on exactly the
	 * case the other five treat as empty.
	 */
	test('neither {@render} form warns, so the ruling is not a diagnostic', () => {
		const guarded =
			'<script lang="ts">\n\tlet { children } = $props();\n</script>\n\n<div>{@render children?.()}</div>\n';
		const unguarded = guarded.replace('children?.()', 'children()');
		expect(warningCodes(guarded)).toEqual([]);
		expect(warningCodes(unguarded)).toEqual([]);
		// Calibration: this instrument CAN go red, so the two empties above are not vacuous.
		expect(warningCodes('<div onclick={() => {}}>x</div>\n')).toContain(
			'a11y_click_events_have_key_events',
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

		// LAWFUL IR IS GREEN, so the three rejections above are not green by accident.
		expect(() => validateEnrichedIr(page)).not.toThrow();
		expect(() => validateEnrichedIr(panel)).not.toThrow();
	});

	test('refuses an import that does not resolve to a .tsrx module', async () => {
		const artifact = structuredClone(await ir('M2-page')) as any;
		artifact.imports[0].resolvesTo = undefined;
		expect(() => emit(artifact)).toThrow(/ModuleImport cannot be lowered/);
	});

	test('formats to the committed bytes', async () => {
		expect(formatEmitted(emit(await ir('M1-panel')))).toBe(
			await readFile(
				resolve(PACKAGE_ROOT, 'generated-composition/M1-panel.svelte'),
				'utf8',
			),
		);
	});
});
