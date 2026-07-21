import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildEnrichedIr, resolveModuleSet, type EnrichedIR } from '../src/index.ts';

const build = (filename: string, source: string) => buildEnrichedIr({ filename, source });

const importedParent = () =>
	build(
		'src/parent.tsrx',
		readFileSync(new URL('./fixtures/composition-import.tsrx', import.meta.url), 'utf8'),
	);

const child = (filename = 'src/child.tsrx', name = 'Child') =>
	build(
		filename,
		`export function ${name}({ value, children }) @{ <section>{value}{children}</section> }`,
	);

describe('module-set resolver', () => {
	test('resolves the T001 imported-child probe pair', async () => {
		const [parentArtifact, childArtifact] = await Promise.all([importedParent(), child()]);

		expect(
			resolveModuleSet([
				{ moduleId: 'src/parent.tsrx', artifact: parentArtifact },
				{ moduleId: 'src/child.tsrx', artifact: childArtifact },
			]),
		).toEqual([
			{
				moduleId: 'src/child.tsrx',
				references: [],
			},
			{
				moduleId: 'src/parent.tsrx',
				references: [
					{
						nodeId: 'component-reference:component-edge:0',
						targetModuleId: 'src/child.tsrx',
						exportedName: 'Child',
					},
				],
			},
		]);
	});

	test('resolves self references against the module exported components', async () => {
		const artifact = await build(
			'src/page.tsrx',
			`export function Frame() @{ <section>frame</section> }
			export function Page() @{ <Frame /> }`,
		);

		expect(resolveModuleSet([{ moduleId: 'src/page.tsrx', artifact }])).toEqual([
			{
				moduleId: 'src/page.tsrx',
				references: [
					{
						nodeId: 'component-reference:component-edge:0',
						targetModuleId: 'src/page.tsrx',
						exportedName: 'Frame',
					},
				],
			},
		]);
	});

	test('resolves self references against all artifact components, including a local Child', async () => {
		const artifact = await build(
			'src/page.tsrx',
			`function Child() @{ <section>child</section> }
			export function Parent() @{ <Child /> }`,
		);

		expect(resolveModuleSet([{ moduleId: 'src/page.tsrx', artifact }])).toEqual([
			{
				moduleId: 'src/page.tsrx',
				references: [
					{
						nodeId: 'component-reference:component-edge:0',
						targetModuleId: 'src/page.tsrx',
						exportedName: 'Child',
					},
				],
			},
		]);
	});

	test('resolves sibling specifiers from a root-level module id', async () => {
		const [parentArtifact, childArtifact] = await Promise.all([importedParent(), child()]);
		expect(
			resolveModuleSet([
				{ moduleId: 'parent.tsrx', artifact: parentArtifact },
				{ moduleId: 'child.tsrx', artifact: childArtifact },
			]),
		).toEqual([
			{ moduleId: 'child.tsrx', references: [] },
			{
				moduleId: 'parent.tsrx',
				references: [
					{
						nodeId: 'component-reference:component-edge:0',
						targetModuleId: 'child.tsrx',
						exportedName: 'Child',
					},
				],
			},
		]);
	});

	test('walks component references in children, branch arms, and repeat rows', async () => {
		const [parentArtifact, childArtifact] = await Promise.all([
			build(
				'src/nested.tsrx',
				`import { Child } from "./child.tsrx";
				export function Nested({ items, visible }) @{
					<section>
						<Child><Child /></Child>
						@if (visible) { <Child /> } @else { <Child /> }
						@for (const item of items; key item.id) { <Child value={item.id} /> }
					</section>
				}`,
			),
			child(),
		]);

		const table = resolveModuleSet([
			{ moduleId: 'src/nested.tsrx', artifact: parentArtifact },
			{ moduleId: 'src/child.tsrx', artifact: childArtifact },
		]);
		expect(
			table.find((entry) => entry.moduleId === 'src/nested.tsrx')?.references,
		).toHaveLength(5);
	});

	test('diagnoses a missing target module', async () => {
		const artifact = await importedParent();
		expect(() => resolveModuleSet([{ moduleId: 'src/parent.tsrx', artifact }])).toThrow(
			'TemplateComponentReference component-reference:component-edge:0 in src/parent.tsrx has missing module: src/child.tsrx',
		);
	});

	test('diagnoses an unresolved target export', async () => {
		const [parentArtifact, childArtifact] = await Promise.all([
			importedParent(),
			child('src/child.tsrx', 'Different'),
		]);
		expect(() =>
			resolveModuleSet([
				{ moduleId: 'src/parent.tsrx', artifact: parentArtifact },
				{ moduleId: 'src/child.tsrx', artifact: childArtifact },
			]),
		).toThrow(
			'TemplateComponentReference component-reference:component-edge:0 in src/parent.tsrx has unresolved export "Child" in module src/child.tsrx',
		);
	});

	test('rejects extensionless TSRX import specifiers', async () => {
		const artifact = await build(
			'src/parent.tsrx',
			'import { Child } from "./child"; export function Parent() @{ <Child /> }',
		);
		expect(() => resolveModuleSet([{ moduleId: 'src/parent.tsrx', artifact }])).toThrow(
			'ModuleImport "./child" in src/parent.tsrx must use an explicit .tsrx extension',
		);
	});

	test.each(['/child.tsrx', 'child.tsrx'])(
		'rejects non-relative TSRX import specifier %s',
		async (specifier) => {
			const artifact = await build(
				'src/parent.tsrx',
				`import { Child } from "${specifier}"; export function Parent() @{ <Child /> }`,
			);
			expect(() => resolveModuleSet([{ moduleId: 'src/parent.tsrx', artifact }])).toThrow(
				`ModuleImport "${specifier}" in src/parent.tsrx must use a relative ./ or ../ .tsrx specifier: ${specifier}`,
			);
		},
	);

	test('diagnoses duplicate canonical module ids', async () => {
		const artifact = await child();
		expect(() =>
			resolveModuleSet([
				{ moduleId: 'src/child.tsrx', artifact },
				{ moduleId: 'src/./child.tsrx', artifact },
			]),
		).toThrow('ModuleSet has duplicate moduleId: src/child.tsrx');
	});

	test('reports the exact two-module cycle path', async () => {
		const [a, b] = await Promise.all([
			build('src/a.tsrx', 'import { B } from "./b.tsrx"; export function A() @{ <B /> }'),
			build('src/b.tsrx', 'import { A } from "./a.tsrx"; export function B() @{ <A /> }'),
		]);
		expect(() =>
			resolveModuleSet([
				{ moduleId: 'src/a.tsrx', artifact: a },
				{ moduleId: 'src/b.tsrx', artifact: b },
			]),
		).toThrow('Component-reference cycle: src/a.tsrx -> src/b.tsrx -> src/a.tsrx');
	});

	test('reports the exact three-module cycle path', async () => {
		const [a, b, c] = await Promise.all([
			build('src/a.tsrx', 'import { B } from "./b.tsrx"; export function A() @{ <B /> }'),
			build('src/b.tsrx', 'import { C } from "./c.tsrx"; export function B() @{ <C /> }'),
			build('src/c.tsrx', 'import { A } from "./a.tsrx"; export function C() @{ <A /> }'),
		]);
		expect(() =>
			resolveModuleSet([
				{ moduleId: 'src/c.tsrx', artifact: c },
				{ moduleId: 'src/a.tsrx', artifact: a },
				{ moduleId: 'src/b.tsrx', artifact: b },
			]),
		).toThrow(
			'Component-reference cycle: src/a.tsrx -> src/b.tsrx -> src/c.tsrx -> src/a.tsrx',
		);
	});

	test('sorts modules and references for input-order-independent output', async () => {
		const [parentArtifact, childArtifact] = await Promise.all([importedParent(), child()]);
		const forward = [
			{ moduleId: 'src/parent.tsrx', artifact: parentArtifact },
			{ moduleId: 'src/child.tsrx', artifact: childArtifact },
		] as const;
		expect(resolveModuleSet(forward)).toEqual(resolveModuleSet([...forward].reverse()));
	});

	test('rejects unknown resolver-input fields', async () => {
		const artifact = await child();
		expect(() =>
			resolveModuleSet([{ moduleId: 'src/child.tsrx', artifact, extra: true } as never]),
		).toThrow('ModuleSetInput has unknown semantic field: extra');
	});

	test('diagnoses an invalid artifact version by construct name', async () => {
		const artifact = await child();
		expect(() =>
			resolveModuleSet([
				{
					moduleId: 'src/child.tsrx',
					artifact: { ...artifact, version: 'frameless-enriched-ir/1' } as EnrichedIR,
				},
			]),
		).toThrow(
			'EnrichedIR for module src/child.tsrx has invalid artifact version: expected frameless-enriched-ir/2, received frameless-enriched-ir/1',
		);
	});
});
