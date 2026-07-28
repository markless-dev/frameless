import { readFile } from 'node:fs/promises';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { compileDiagnostics, emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
import {
	COMPOSITION_EXTENSION,
	compositionFixtures,
	emitCompositionFixture,
} from '../scripts/regenerate-composition.ts';

/**
 * STEP 5, COMPOSITION - the Vue half.
 *
 * THE INSTRUMENT IS `compileDiagnostics`, RUN INSIDE `emit`, and T005 measured
 * that it can be BLIND: a `ref(null)` lowering came back exact-empty in all four
 * `ssr x isProd` modes and `demos/vue-official`'s `vue-tsc` rejected the same
 * file outright. So an `emit` that returns is evidence the SFC compiler accepts
 * the output, NOT evidence that it type-checks. No claim below rests on types.
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

const MULTI_COMPONENT = `function Frame({ children }) @{
	<section data-frame>{children}</section>
}

export function SlotPage() @{
	<Frame><strong data-projected-node>Projected composition</strong></Frame>
}`;

describe('Vue composition', () => {
	test('projects children with <slot /> and imports the sibling .vue SFC', async () => {
		const panel = emit(await ir('M1-panel'));
		expect(panel).toContain('<div data-panel-body><slot /></div>');
		// `children` IS NOT DECLARED AS A PROP. Vue delivers child content through the
		// default slot, so a `children` entry in `defineProps` would announce an
		// interface no caller can satisfy and leave the emitted `props` binding
		// unread. React and Solid are the other way round, and that is a genuine
		// per-lane difference in where the same authored parameter lands.
		expect(panel).toContain("const props = defineProps(['label']);");
		expect(panel).not.toContain('children');

		const page = emit(await ir('M2-page'));
		expect(page).toContain("import Panel from './M1-panel.vue';");
		expect(page).toContain(`<Panel :label="'Composed'">`);
	});

	/**
	 * A TEMPLATE-ONLY SFC, WHICH STEP 5 MADE REACHABLE FOR THE FIRST TIME. A purely
	 * presentational component has no state, no events and no Vue-declared props
	 * once its only prop is the slot-projected one - and `parse` DROPS a
	 * `<script setup>` block whose content is only whitespace, so emitting an empty
	 * one would claim a setup block the descriptor does not carry. Measured: the
	 * previous unconditional `descriptor.scriptSetup` check rejected the emitter's
	 * own correct output.
	 */
	test('emits no <script setup> block when there is nothing to put in it', async () => {
		const source = emit(
			await irFrom(`export function Frame({ children }) @{
	<section data-frame>{children}</section>
}`),
		);
		expect(source).not.toContain('<script');
		expect(source).toContain('<section data-frame><slot /></section>');
		expect(compileDiagnostics(source, 'Frame.vue')).toEqual([]);
	});

	test('a script block that is NOT setup is still an error', async () => {
		// The calibration that keeps the arm above from weakening the check: Options
		// API leaking into this lane's output stays red.
		const source = emit(await ir('M1-panel')).replace('<script setup lang="ts">', '<script>');
		expect(compileDiagnostics(source, 'M1-panel.vue')).toEqual([
			'emitted Vue SFC M1-panel.vue has no <script setup> block',
		]);
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
	 * THE LANE LIMIT, PINNED - and the escape hatch is excluded on MEMBERSHIP, not
	 * on preference. The construct that would declare a second component in one
	 * `.vue` file is `defineComponent({ setup, render })`, which abandons the
	 * `<template>` block entirely and puts the output on a render-function path
	 * none of this lane's instruments cover: `compileDiagnostics`, the SSR
	 * whitespace contract and the `ref_key` machinery T005 chose the string ref for
	 * all assume the SFC template compiler.
	 */
	test('refuses a multi-component module by name', async () => {
		await expect(irFrom(MULTI_COMPONENT).then(emit)).rejects.toThrow(
			/multi-component module \(Frame, SlotPage\).*a \.vue SFC declares exactly one component/s,
		);
	});

	test('refuses reading a slot-projected prop as a value', async () => {
		// A slot's content is not a value in this lane, so a second read of the same
		// name has no spelling at all - refused by name rather than lowered to a
		// `props.x` that would be `undefined` at runtime.
		await expect(
			irFrom(`export function Frame({ children }) @{
	<section data-frame data-copy={children}>{children}</section>
}`).then(emit),
		).rejects.toThrow(/reading the slot-projected prop children as a value/);
	});

	test('refuses a shared construct by its own name, not as "composition"', async () => {
		const shared = structuredClone(await ir('M2-page')) as any;
		shared.records.sharedInstances = [
			{ definitionId: 'shared:0', componentId: shared.components[0].id, localName: 'x' },
		];
		expect(() => emit(shared)).toThrow(/does not support shared constructs/);
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

	/**
	 * THE BEHAVIOURAL ARM, and this lane needs one more than most: `pnpm e2e`
	 * compares composition across TWO lanes only (react and solid), so NOTHING in
	 * this repo renders a composed Vue module. `compileDiagnostics` returning empty
	 * is not evidence that `<slot />` receives anything - T005 measured this lane's
	 * own checker green on output `vue-tsc` then rejected.
	 *
	 * Both emitted `<template>` blocks are rendered through `vue/server-renderer`
	 * at the resolved version, so the observable is real output bytes.
	 */
	test('the emitted pair really projects children through <slot />', async () => {
		const templateOf = (source: string) =>
			source.slice(source.indexOf('<template>') + 10, source.lastIndexOf('</template>'));
		const panel = templateOf(emit(await ir('M1-panel')));
		const page = templateOf(emit(await ir('M2-page')));
		const html = await renderToString(
			createSSRApp({
				template: page,
				components: { Panel: { template: panel, props: ['label'] } },
			}),
		);
		expect(html).toContain('<h2 data-panel-label>Composed</h2>');
		// THE BYTES ARE ASSERTED EXACTLY, ANCHOR COMMENTS AND ALL, because the arm
		// FOUND ONE. Vue server-renders projected slot content wrapped in FRAGMENT
		// ANCHOR COMMENTS - `<!--[-->` / `<!--]-->` - which React, Solid and Angular
		// do not emit at the same site. That is the same family this emitter's
		// `renderBranch` already refuses `<template v-if>` over, and it is recorded
		// rather than hidden behind a `toContain` that would have passed either way.
		//
		// IT DOES NOT BREAK THE ORACLE: `pnpm e2e`'s three-way matrix compares
		// OBSERVATIONS - text content, attributes, request counts - not raw HTML, and
		// an HTML comment is invisible to every one of them. It is a served-payload
		// difference, and it is named here so a future step that starts comparing
		// payload bytes finds it already measured instead of discovering it late.
		expect(html).toContain(
			'<div data-panel-body><!--[--><p data-panel-copy>Projected across the module boundary</p><!--]--></div>',
		);
		// NEGATIVE CONTROL: an unfilled slot renders NOTHING, which is React's and
		// Solid's `{children}` behaviour and the reason this lane needs no optional
		// guard where the Svelte lane needs `?.()`.
		const empty = await renderToString(
			createSSRApp({
				template: '<Panel label="Bare" />',
				components: { Panel: { template: panel, props: ['label'] } },
			}),
		);
		// Empty means EMPTY OF CONTENT, not empty of anchors: the fragment markers
		// stay and nothing renders between them, which is the `{children}` behaviour
		// of the other lanes and the reason this lane needs no optional guard.
		expect(empty).toContain('<div data-panel-body><!--[--><!--]--></div>');
	});

	test('formats to the committed bytes', async () => {
		expect(formatEmitted(emit(await ir('M2-page')))).toBe(
			await readFile(resolve(PACKAGE_ROOT, 'generated-composition/M2-page.vue'), 'utf8'),
		);
	});
});
