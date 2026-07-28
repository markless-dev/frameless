import { readFile } from 'node:fs/promises';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit, templateDiagnostics, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
import {
	COMPOSITION_EXTENSION,
	compositionFixtures,
	emitCompositionFixture,
} from '../scripts/regenerate-composition.ts';

/**
 * STEP 5, COMPOSITION - the Angular half.
 *
 * THE IN-PACKAGE INSTRUMENT IS `parseTemplate`, run inside `emit`, so every
 * successful `emit` below carries an empty template error set with it. That is
 * GRAMMAR, NOT TYPES AND NOT AOT: `imports:` resolution, selector matching and
 * `strictTemplates` are decided by `@angular/compiler-cli`, which lives in
 * `demos/angular-official`'s separate install. NO CLAIM BELOW RESTS ON AOT, and
 * the out-of-band `ng build` arm is recorded in
 * `docs/goals/frameless-emitter-capability-v1/notes/T007-composition.md`.
 */
const PACKAGE_ROOT = resolve(import.meta.dirname, '..');

async function ir(name: string): Promise<EnrichedIR> {
	const filename = `test/composition-fixtures/${name}.tsrx`;
	return buildEnrichedIr({
		filename,
		source: await readFile(resolve(PACKAGE_ROOT, filename), 'utf8'),
	});
}

describe('Angular composition', () => {
	test('projects children with <ng-content /> and imports the sibling module', async () => {
		const panel = emit(await ir('M1-panel'));
		// `children` IS NOT AN @Input(). Angular projects child content through
		// `<ng-content />`, so an `@Input() children` would announce an input no
		// parent binds and leave the member permanently `undefined`.
		expect(panel).toContain('<div data-panel-body><ng-content /></div>');
		expect(panel).toContain('@Input() label: any;');
		expect(panel).not.toContain('children');

		const page = emit(await ir('M2-page'));
		// The extension is DROPPED rather than rewritten to `.jsx`: this lane's
		// artifact is a plain TypeScript module with no JSX in it, so the JSX lanes'
		// specifier convention would name a file that does not exist.
		expect(page).toContain("import { Panel } from './M1-panel';");
		expect(page).toContain('imports: [Panel],');
		expect(page).toContain(`<frameless-panel [label]="'Composed'">`);
	});

	/**
	 * THE MULTI-COMPONENT MODULE, WHICH THE SVELTE AND VUE LANES CANNOT EXPRESS. A
	 * `.ts` file holds as many `@Component` classes as the module has components,
	 * so this lane carries the SAME `C1-slot` fixture react and solid do.
	 */
	test('emits every component class, exporting only the exported one', async () => {
		const source = emit(await ir('C1-slot'));
		expect(source).toContain('class Frame {}');
		expect(source).not.toContain('export class Frame');
		expect(source).toContain('export class SlotPage {}');
		expect(source).toContain('<frameless-frame>');
		expect(source).toContain('imports: [Frame],');
	});

	test('emits imports: only for the classes the template actually referenced', async () => {
		// Angular's own `NG8113 unused import` is what would report a decorator that
		// declares a dependency its template does not use, and that diagnostic lives
		// in AOT - outside this package. The emitter fails closed of it instead.
		expect(emit(await ir('M1-panel'))).not.toContain('imports:');
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

	test('every emitted composition template parses with an empty error set', async () => {
		for (const fixture of compositionFixtures) {
			const source = await emitCompositionFixture(fixture);
			for (const [, template] of source.matchAll(/template: `\n([\s\S]*?)\n\t`,/g))
				expect(templateDiagnostics(template!, `${fixture}.html`)).toEqual([]);
		}
		// CALIBRATION, so the empties above are not vacuous: this instrument goes red.
		// A MISMATCHED CLOSING TAG DOES NOT - measured, and that is why the
		// calibration is an @for with no `track` instead. `parseTemplate` recovers
		// from tag mismatch silently, which is exactly the class of blindness T005
		// found in the Vue lane's own checker.
		expect(
			templateDiagnostics('<frameless-panel><p>x</frameless-panel>', 'probe.html'),
		).toEqual([]);
		expect(
			templateDiagnostics('@for (todo of todos) {\n\t<li>x</li>\n}', 'probe.html').join('\n'),
		).toMatch(/track/);
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

	test('formats to the committed bytes', async () => {
		expect(formatEmitted(emit(await ir('M2-page')))).toBe(
			await readFile(resolve(PACKAGE_ROOT, 'generated-composition/M2-page.ts'), 'utf8'),
		);
	});
});
