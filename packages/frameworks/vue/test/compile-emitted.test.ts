import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { compileTemplate, parse, version as compilerVersion } from '@vue/compiler-sfc';
import { createSSRApp, version as runtimeVersion } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { resolve } from 'pathe';
import { beforeAll, describe, expect, test } from 'vitest';
import { COMPILE_MODES, compileDiagnostics } from '../src/emitter/index.ts';
import { discoverGeneratedFiles } from '../src/gate/index.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');
const require = createRequire(import.meta.url);

/**
 * THE SCENARIO INVENTORY IS DERIVED, NOT RE-LITERALLED - and here it is derived
 * SYNCHRONOUSLY, because `test.each` needs its rows at collection time while
 * `discoverGeneratedFiles()` is async and only resolves in `beforeAll`.
 *
 * That timing is exactly why this lane could be half-blind without looking it:
 * until S4 landed, the `test.each` list was a second hand-maintained literal
 * alongside the inventory assertion, so a new emitted component would have been
 * DISCOVERED and then never compiled. Both now come from the compiler's ratified
 * golden corpus, and the assertion below re-checks the async discovery against
 * the same derivation, so the two sources have to agree.
 */
function scenarioCorpus(extension: string, directory = 'generated'): string[] {
	const files = readdirSync(compilerGoldenRoot)
		.map((entry) => /^s(\d+)-[\w-]+\.json$/.exec(entry)?.[1])
		.filter((digits): digits is string => digits !== undefined)
		.map((digits) => `${directory}/S${digits}.${extension}`)
		.sort();
	// Fail LOUD rather than returning []. An empty derivation would silently
	// produce zero `test.each` rows, which vitest reports as a passing file.
	if (files.length === 0)
		throw new Error(`no s<n>-*.json scenario goldens found in ${compilerGoldenRoot}`);
	return files;
}

const EMITTED_SCENARIOS = scenarioCorpus('vue');

function mutate(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replace(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert against a non-mutant',
	);
}

let files: string[] = [];
const sources = new Map<string, string>();
beforeAll(async () => {
	files = await discoverGeneratedFiles();
	for (const file of files) sources.set(file, await readFile(resolve(packageRoot, file), 'utf8'));
});

describe('emitted Vue compiles clean at the resolved version', () => {
	/**
	 * M4 - VERSION IDENTITY, the node half.
	 *
	 * Gate 1 of `docs/emitter-idiom-policy.md` records FAIL when "the measurement
	 * was taken against a different build than the one this repo ships", and names
	 * "a package resolving to a different version" as a different build. This
	 * oracle is `@vue/compiler-sfc`; the browser lane is `vue`. If they diverge,
	 * the oracle is measuring a build nothing runs - so the identity is asserted
	 * AT TEST TIME rather than trusted from an install that happened once.
	 *
	 * Four independently obtained values: the two packages' runtime `version`
	 * exports and the two `package.json` files they resolve from.
	 */
	test('M4: vue and @vue/compiler-sfc are the same version, four ways', () => {
		const declared = (name: string) =>
			(require(`${name}/package.json`) as { version: string }).version;
		expect({
			runtime: runtimeVersion,
			compiler: compilerVersion,
			vuePackage: declared('vue'),
			compilerPackage: declared('@vue/compiler-sfc'),
		}).toEqual({
			runtime: runtimeVersion,
			compiler: runtimeVersion,
			vuePackage: runtimeVersion,
			compilerPackage: runtimeVersion,
		});
		// T001 recorded the create-vite-extra template at vue@3.5.40; the pin is not
		// asserted to the patch here, because a patch bump should not be a red test.
		expect(runtimeVersion, `resolved vue ${runtimeVersion}`).toMatch(/^3\.5\./);
	});

	test('covers exactly the emitted scenario corpus, and every row below is one of them', () => {
		// The async discovery and the sync `test.each` derivation are separate
		// readings of two different directories. Asserting they agree is what stops
		// this lane compiling a stale list while reporting green.
		expect(files).toEqual(EMITTED_SCENARIOS);
		// THE FLOOR, so a derivation that quietly lost a scenario cannot pass.
		expect(EMITTED_SCENARIOS).toEqual(
			expect.arrayContaining([
				'generated/S1.vue',
				'generated/S2.vue',
				'generated/S3.vue',
				'generated/S4.vue',
			]),
		);
		// Four modes, and the list is pinned so a silently narrowed matrix is a red
		// test: `ssr` selects @vue/compiler-ssr instead of @vue/compiler-dom, which
		// is a different code generator, not a flag.
		expect(COMPILE_MODES).toHaveLength(4);
	});

	test.each(EMITTED_SCENARIOS)(
		'%s compiles with an EXACT EMPTY diagnostic set in every mode',
		(file) => {
			const source = sources.get(file)!;
			expect(compileDiagnostics(source, file)).toEqual([]);
		},
	);
});

/**
 * CALIBRATION. An empty diagnostic set is only evidence if the same call is known
 * to produce a non-empty one, and the two channels it reads - `errors` and `tips`
 * - are populated by different mechanisms, so each needs its own planted member.
 */
describe('CALIBRATION: the compile() oracle goes red', () => {
	test('on a template expression Babel cannot parse', () => {
		const mutant = mutate(sources.get('generated/S1.vue')!, '{{ derived }}', '{{ derived( }}');
		expect(compileDiagnostics(mutant, 'S1.vue').join('\n')).toMatch(
			/Error parsing JavaScript expression/,
		);
	});

	test('on a script block Vue cannot compile', () => {
		const mutant = mutate(sources.get('generated/S1.vue')!, 'const count', 'const const count');
		expect(compileDiagnostics(mutant, 'S1.vue').length).toBeGreaterThan(0);
	});

	/**
	 * THE `tips` CHANNEL, which is why tips are collected alongside errors rather
	 * than ignored as advice.
	 *
	 * `validateHtmlNesting` reports through `onWarn`, which `compileTemplate`
	 * surfaces as a tip and NOT as an error - MEASURED at 3.5.40: this mutant
	 * produces zero errors. Its own message says the shape "can cause hydration
	 * errors", which is precisely the property this board's oracle depends on, so a
	 * lane that read only `errors` would let it through.
	 */
	test('on invalid HTML nesting, which arrives as a TIP and not as an error', () => {
		const mutant = mutate(
			sources.get('generated/S1.vue')!,
			'<p v-if="!visible" data-branch="hidden">hidden</p>',
			'<p v-if="!visible" data-branch="hidden"><div>hidden</div></p>',
		);
		const found = compileDiagnostics(mutant, 'S1.vue');
		expect(found.join('\n')).toMatch(/cannot be child of <p>/);
		expect(found.every((entry) => entry.startsWith('tip:'))).toBe(true);
	});

	test('on an SFC with no <script setup> and on one with no <template>', () => {
		const source = sources.get('generated/S3.vue')!;
		expect(
			compileDiagnostics(mutate(source, '<script setup lang="ts">', '<script>'), 'S3.vue'),
		).toEqual([
			'emitted Vue SFC S3.vue has no <script setup> block',
		]);
		expect(
			compileDiagnostics(mutate(source, '<template>', '<div>'), 'S3.vue').join('\n'),
		).toMatch(/no <template> block|Element is missing end tag|Invalid end tag/);
	});
});

/**
 * M1 - WHITESPACE, the two-arm compiler measurement.
 *
 * Vue's SFC compiler defaults to `whitespace: 'condense'`, which is a DIFFERENT
 * rule from Svelte's, so `frameless-svelte-v1` T003 measurement 3 does NOT carry
 * over. Every arm below is rendered through `vue/server-renderer` at the resolved
 * version, so the observable is real output bytes rather than an inspection of an
 * AST.
 *
 * THE HYPOTHESIS UNDER TEST, from `frameless-vue-v1` T002's dissent: "a
 * whitespace-only newline between two ELEMENTS is removed, while one between an
 * INTERPOLATION and text condenses to a single space - which would make S2's
 * `1/2` render as `1 /2`". Both halves hold. Two things it did not name also
 * hold and are recorded here because the emitter's layout rule depends on them:
 * the newline is load-bearing (a space alone is KEPT), and whitespace that shares
 * a text node with content is condensed rather than removed, which is the
 * `increment` -> ` increment ` arm.
 */
describe('M1: what Vue\'s whitespace:condense actually does, measured', () => {
	async function render(template: string): Promise<string> {
		const app = createSSRApp({ template, data: () => ({ a: 1, b: 2 }) });
		return renderToString(app);
	}

	test('ARM 1: a newline between two ELEMENTS is REMOVED', async () => {
		await expect(render('<div><p>a</p>\n<span>b</span></div>')).resolves.toBe(
			'<div><p>a</p><span>b</span></div>',
		);
		await expect(render('<div>\n\t<p>a</p>\n\t<span>b</span>\n</div>')).resolves.toBe(
			'<div><p>a</p><span>b</span></div>',
		);
	});

	test('ARM 2: the same whitespace WITHOUT a newline is KEPT as one space', async () => {
		// The negative control for arm 1, and the reason the emitter never puts two
		// elements on one line separated by a space.
		await expect(render('<div><p>a</p> <span>b</span></div>')).resolves.toBe(
			'<div><p>a</p> <span>b</span></div>',
		);
	});

	test('ARM 3: a newline between an INTERPOLATION and text CONDENSES to a space', async () => {
		// THE OBSERVABLE AT RISK: S2's `1/2` silently becoming `1 /2` against the
		// react, solid, qwik and svelte lanes, which the e2e contract asserts equal.
		await expect(render('<p>{{ a }}\n/{{ b }}</p>')).resolves.toBe('<p>1 /2</p>');
		// ...and the layout the emitter actually produces does not.
		await expect(render('<p>{{ a }}/{{ b }}</p>')).resolves.toBe('<p>1/2</p>');
	});

	test('ARM 4: whitespace sharing a text node with content is CONDENSED, not removed', async () => {
		// Not in T002's hypothesis, and it is the arm that decides the emitter's
		// rule: an element with a text child renders that child INLINE.
		await expect(render('<button>\n\tincrement\n</button>')).resolves.toBe(
			'<button> increment </button>',
		);
		await expect(render('<button\n\tdata-x="1"\n>increment</button>')).resolves.toBe(
			'<button data-x="1">increment</button>',
		);
	});

	test('ARM 5: a lone INTERPOLATION child on its own line IS safe', async () => {
		// The refinement the hypothesis missed in the other direction: the flanking
		// whitespace nodes are first and last children, which condense removes. The
		// emitter is conservative here anyway - it inlines any run containing a
		// non-element - and this arm records that the conservatism is a choice
		// rather than a necessity.
		await expect(render('<output>\n\t{{ a }}\n</output>')).resolves.toBe('<output>1</output>');
	});

	/**
	 * THE MEASUREMENT TIED BACK TO THE REAL ARTIFACT. The arms above are minimal
	 * templates; this reads the condensed text nodes of the SHIPPED emitted
	 * corpus, which is where a layout regression would actually land.
	 */
	test('the shipped corpus condenses to exactly the text the other lanes observe', () => {
		const texts = (file: string): string[] => {
			const { descriptor } = parse(sources.get(file)!, { filename: file });
			const found: string[] = [];
			const visit = (node: Record<string, any>): void => {
				for (const child of (node.children ?? []) as Array<Record<string, any>>) {
					if (child.type === 2) found.push(String(child.content));
					visit(child);
				}
			};
			visit(descriptor.template!.ast as unknown as Record<string, any>);
			return found;
		};
		expect(texts('generated/S1.vue')).toEqual(['hidden', 'increment']);
		expect(texts('generated/S2.vue')).toEqual(['/', 'add', 'empty', 'remove', 'reorder', 'clear']);
		expect(texts('generated/S3.vue')).toEqual([
			'submit',
			'cancel-submit',
			'cancel-open',
			'allow-open',
		]);
	});

	test('CALIBRATION: the same reader sees the damaged text when the layout is naive', () => {
		// Instrument rule 4 - the row above is a list of clean strings, which looks
		// identical whether the reader works or returns whatever it was given. This
		// plants the naive layout into the real S2 and watches ` /` come back.
		const mutant = mutate(
			sources.get('generated/S2.vue')!,
			'>{{ complete }}/{{ todos.length }}<',
			'>\n\t\t\t{{ complete }}\n\t\t\t/{{ todos.length }}\n\t\t<',
		);
		const { descriptor } = parse(mutant, { filename: 'S2.vue' });
		const compiled = compileTemplate({
			source: descriptor.template!.content,
			filename: 'S2.vue',
			id: 'S2',
		});
		expect(compiled.code).toContain('" /"');
	});
});
