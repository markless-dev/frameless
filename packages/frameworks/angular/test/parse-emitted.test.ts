import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { parseTemplate } from '@angular/compiler';
import { resolve } from 'pathe';
import { beforeAll, describe, expect, test } from 'vitest';
import { templateDiagnostics } from '../src/emitter/index.ts';
import { isUnbuiltEmitted } from './unbuilt-scenarios.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');
const generatedRoot = resolve(packageRoot, 'generated');
const require = createRequire(import.meta.url);

/** Numeric, so S10 sorts after S9 rather than between S1 and S2. */
function byScenarioNumber(left: string, right: string): number {
	return Number(/(\d+)/.exec(left)![1]) - Number(/(\d+)/.exec(right)![1]);
}

/**
 * THE SCENARIO INVENTORY IS DERIVED, NOT RE-LITERALLED - and this file is the
 * one where that mattered most.
 *
 * Until S4 landed, ARBITER 1 below ran over a hand-written `['S1','S2','S3']`
 * while its own test name promised `every emitted template`. It did not go red
 * when the corpus grew; it went on reporting SUCCESS over a corpus it had
 * silently stopped covering, which is strictly worse than the dozen literals
 * that announced themselves. And it is this arbiter - `frameless-angular-v1`
 * T002 ruling 4 designated it PRIMARY - that exists to judge exactly the kind of
 * template S4 was the repo's first instance of: a nested `@for` inside a `@for`
 * produced by FORCED LOWERING.
 *
 * The derivation source is the compiler's ratified golden corpus, `s<n>-*.json`,
 * which is INDEPENDENT of `generated/`: one is the IR this repo agreed to
 * compile, the other is what the emitter actually wrote. Comparing them is a
 * real cross-check rather than a restatement, and it is two-sidedly fail-closed
 * - `preconditions` below watches both directions go red.
 */
function scenarioCorpus(goldenRoot = compilerGoldenRoot): string[] {
	const files = readdirSync(goldenRoot)
		.map((entry) => /^s(\d+)-[\w-]+\.json$/.exec(entry)?.[1])
		.filter((digits): digits is string => digits !== undefined)
		.map((digits) => `S${digits}.ts`)
		// The subtraction declared in `unbuilt-scenarios.ts`. `emitter.test.ts`
		// asserts the underlying refusal is live, so this is not a skip list.
		.filter((file) => !isUnbuiltEmitted(file))
		.sort(byScenarioNumber);
	// Fail LOUD rather than returning []. An empty derivation would make the
	// inventory assertion agree with an empty `generated/` directory, which is the
	// one way a derived list could be greener than the literal it replaced.
	if (files.length === 0)
		throw new Error(`no s<n>-*.json scenario goldens found in ${goldenRoot}`);
	return files;
}

/** What the emitter actually wrote - the other side of the cross-check. */
function emittedScenarios(root = generatedRoot): string[] {
	return readdirSync(root)
		.filter((entry) => /^S\d+\.ts$/.test(entry))
		.filter((entry) => !isUnbuiltEmitted(entry))
		.sort(byScenarioNumber);
}

/**
 * Pull the inline template back out of an emitted module the same way the gate
 * does, so these measurements run against EXACTLY the bytes `ng build` would
 * hand Angular's parser rather than against a hand-written approximation.
 */
function inlineTemplate(source: string): string {
	const opened = source.indexOf('\ttemplate: `');
	const closed = source.indexOf('\n\t`,\n', opened);
	if (opened < 0 || closed < 0)
		throw new Error('emitted Angular source carries no inline template literal');
	return source.slice(opened + '\ttemplate: `'.length, closed + 1);
}

/** Every `Text` value and every interpolation literal segment, in source order. */
function renderedText(template: string): string[] {
	const parsed = parseTemplate(template, 'probe.html');
	const found: string[] = [];
	const seen = new Set<unknown>();
	const step = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			value.forEach(step);
			return;
		}
		if (seen.has(value)) return;
		seen.add(value);
		const node = value as Record<string, any>;
		const kind = node.constructor?.name;
		if (kind === 'Text') found.push(String(node.value ?? ''));
		if (kind === 'BoundText')
			for (const segment of (node.value?.ast?.strings ?? []) as string[])
				if (segment.length) found.push(segment);
		for (const key of ['children', 'branches', 'empty'] as const) step(node[key]);
	};
	step(parsed.nodes);
	return found;
}

/**
 * EVERY emitted scenario source, keyed by its file name, loaded from the derived
 * inventory. The named bindings below are kept because the per-scenario rows
 * cite constructs only one scenario ships; this map is what the WHOLE-CORPUS
 * rows iterate, so a new scenario joins them without an edit here.
 */
const emittedSources = new Map<string, string>();
let s1 = '';
let s2 = '';
let s3 = '';
beforeAll(async () => {
	for (const file of scenarioCorpus())
		emittedSources.set(file, await readFile(resolve(generatedRoot, file), 'utf8'));
	s1 = emittedSources.get('S1.ts')!;
	s2 = emittedSources.get('S2.ts')!;
	s3 = emittedSources.get('S3.ts')!;
});

describe('preconditions', () => {
	test('the derived inventory is the corpus, and the emitter wrote exactly it', () => {
		const corpus = scenarioCorpus();
		// THE FLOOR. Every scenario ratified so far must still be in the derivation.
		// A lower bound, so S5 and later widen it with no edit here, while a golden
		// that silently disappeared is red.
		expect(corpus).toEqual(expect.arrayContaining(['S1.ts', 'S2.ts', 'S3.ts', 'S4.ts']));
		expect(emittedScenarios()).toEqual(corpus);
		// And the sources the arbiter below actually reads are those same files -
		// a map built from a stale list would satisfy the row above and still feed
		// the arbiter three of four.
		expect([...emittedSources.keys()].sort(byScenarioNumber)).toEqual(corpus);
		for (const [file, source] of emittedSources)
			expect(source.length, file).toBeGreaterThan(0);
	});

	/**
	 * CALIBRATION for the DERIVED inventory. A derived list nobody has watched go
	 * red is not an instrument - and the literal it replaced would at least have
	 * gone red on a missing file. Both directions are driven through the SAME
	 * `scenarioCorpus()` and `emittedScenarios()` the row above calls, against
	 * throwaway roots, so this measures the real comparison and not a lookalike.
	 */
	test('CALIBRATION: the derived inventory goes red on a missing and on an extra file', async () => {
		const corpus = scenarioCorpus();
		const root = await realpath(await mkdtemp(resolve(tmpdir(), 'frameless-ng-inventory-')));
		try {
			const goldens = resolve(root, 'goldens');
			const generated = resolve(root, 'generated');
			await mkdir(goldens);
			await mkdir(generated);
			for (const entry of readdirSync(compilerGoldenRoot))
				await writeFile(resolve(goldens, entry), '{}');
			expect(scenarioCorpus(goldens)).toEqual(corpus);

			// MISSING: one emitted file short of the derived corpus.
			for (const file of corpus.slice(0, -1)) await writeFile(resolve(generated, file), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(corpus);
			await writeFile(resolve(generated, corpus.at(-1)!), '//\n');
			expect(emittedScenarios(generated)).toEqual(corpus);
			// EXTRA: a stray emitted scenario no golden declares.
			await writeFile(resolve(generated, 'S99.ts'), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(corpus);

			// And the same two directions on the DERIVATION side, so a golden that
			// vanished or appeared cannot pass unnoticed either.
			await rm(resolve(goldens, 's1-render-once.json'));
			expect(scenarioCorpus(goldens)).not.toEqual(corpus);
			await writeFile(resolve(goldens, 's1-render-once.json'), '{}');
			await writeFile(resolve(goldens, 's99-planted.json'), '{}');
			expect(scenarioCorpus(goldens)).not.toEqual(corpus);
			// The degenerate case the throw exists for: an empty derivation must NOT
			// quietly agree with an empty directory.
			await rm(goldens, { recursive: true, force: true });
			await mkdir(goldens);
			expect(() => scenarioCorpus(goldens)).toThrow(/no s<n>-\*\.json scenario goldens/);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

/**
 * ARBITER 1 - `@angular/compiler`'s own `parseTemplate`, run as an EXACT EMPTY
 * error set over EVERY emitted template in the derived corpus.
 *
 * `frameless-angular-v1` T002 ruling 4 makes it PRIMARY because it interrogates
 * this board's central risk directly: did FORCED LOWERING produce a template
 * Angular's own parser accepts? It also OVERTURNED T001's "largest
 * emitter-test-harness divergence on the board" - that claim was true for TYPE
 * checking (which needs `NgtscProgram`) and false for GRAMMAR checking, which is
 * what the risk actually is.
 */
describe('arbiter 1: @angular/compiler parseTemplate', () => {
	test('GREEN SIDE: every emitted template parses with an exactly empty error set', () => {
		// ANTI-VACUITY, first: a map that failed to load would satisfy the loop
		// below by iterating nothing, which is precisely the shape of failure this
		// row spent three scenarios in.
		expect([...emittedSources.keys()].sort(byScenarioNumber)).toEqual(scenarioCorpus());
		for (const [file, source] of emittedSources) {
			const template = inlineTemplate(source);
			expect(template.length, `${file} has an empty inline template`).toBeGreaterThan(0);
			expect(templateDiagnostics(template, `${file}.html`), file).toEqual([]);
		}
	});

	/**
	 * THE ROW THAT MAKES FORCED LOWERING A MEASUREMENT RATHER THAN A PREMISE.
	 *
	 * `docs/emitter-idiom-policy.md` and this board's charter both assert Angular
	 * template expressions forbid arrow functions, and T002 finding 3 found that
	 * STALE at 22.0.8 - `class ArrowFunction extends AST` is declared. What is NOT
	 * stale is the reason forced lowering exists: there is NO `UpdateExpression`
	 * node in the grammar at all, so S1's `count++` cannot be inlined at any
	 * binding site. Measured in both positions a handler could occupy.
	 */
	test('RED: Angular has no UpdateExpression, which is why lowering is forced', () => {
		expect(templateDiagnostics('<p>{{ count++ }}</p>', 'probe.html')).toEqual([
			expect.stringContaining('Unexpected end of expression'),
		]);
		expect(templateDiagnostics('<button (click)="count++">x</button>', 'probe.html')).toEqual([
			expect.stringContaining('Unexpected end of expression'),
		]);
		// And the two other shapes the grammar refuses, so the arbiter is not being
		// credited for a single accident of tokenisation.
		expect(templateDiagnostics('<p>{{ count = 1 }}</p>', 'probe.html')).toEqual([
			expect.stringContaining('Bindings cannot contain assignments'),
		]);
		expect(templateDiagnostics('<p>{{ new Date() }}</p>', 'probe.html')).toEqual([
			expect.stringContaining("Unexpected token 'Date'"),
		]);
	});

	/**
	 * `frameless-angular-v1` T002's DISSENT 2 PREDICTED THIS AND IT HOLDS: Angular's
	 * `@for` makes `track` SYNTACTICALLY MANDATORY, so the `require-each-key` hole -
	 * the class that earned `eslint-plugin-vue`'s and `eslint-plugin-svelte`'s
	 * arbiters their keep - is closed at the COMPILER here rather than by a lint
	 * rule. Recorded so the arbiter's clean result is not read as the arbiter being
	 * pointless.
	 */
	test('RED: @for without track is a compiler error, not a lint opinion', () => {
		expect(
			templateDiagnostics('@for (todo of todos) {\n\t<li>x</li>\n}', 'probe.html'),
		).toEqual(['@for loop must have a "track" expression']);
		// Two-sided: the shipped S2 carries the track and is clean.
		expect(s2).toContain('@for (todo of todos; track todo.id) {');
	});
});

/**
 * MEASUREMENT M1 - Angular's whitespace behaviour, MEASURED at 22.0.8 rather than
 * carried over from the Vue or Svelte lanes, both of which apply DIFFERENT rules.
 *
 * These rows are the evidence base the emitter's inline-run layout and the gate's
 * `whitespace-stable-text` policy both rest on. They measure Angular's own parser
 * with its production default (`preserveWhitespaces: false`), so a future Angular
 * changing the rule turns these red rather than silently changing the served DOM.
 */
describe('MEASURED: Angular whitespace at 22.0.8 (M1)', () => {
	test('whitespace-only text between BLOCK-level children is REMOVED', () => {
		// This is the arm that makes a multi-line layout safe at all.
		expect(renderedText('<div>\n\t<p>a</p>\n\t<span>b</span>\n</div>')).toEqual(['a', 'b']);
		// Including a SPACE with no newline, which is where Vue's rule differs:
		// Vue keeps it as a single space, Angular drops the whole node.
		expect(renderedText('<div><p>a</p> <span>b</span></div>')).toEqual(['a', 'b']);
		// And at the root, which is where the emitted template's own leading and
		// trailing indentation lives.
		expect(renderedText('\n\t\t<p>a</p>\n\t')).toEqual(['a']);
	});

	test('a text child on its own line KEEPS BOTH EDGES, one condensed and one verbatim', () => {
		// `\n\t` is a run of two, condensed to one space; the trailing `\n` is a run
		// of ONE and survives verbatim. Both would change the served text.
		expect(renderedText('<button>\n\tincrement\n</button>')).toEqual([' increment\n']);
		expect(renderedText('<button>increment</button>')).toEqual(['increment']);
	});

	test('a newline between an interpolation and text survives - S2 rendering 1/2 as 1\\n/2', () => {
		expect(renderedText('<p>{{ a }}\n/{{ b }}</p>')).toEqual(['\n/']);
		expect(renderedText('<p>{{ a }}/{{ b }}</p>')).toEqual(['/']);
	});

	test('a lone interpolation child on its own line is NOT safe - Vue\'s answer does NOT transfer', () => {
		// THE HYPOTHESIS THIS ROW REFUTED. The Vue lane MEASURED a lone interpolation
		// child on its own line as SAFE and recorded its own inline rule as merely
		// conservative. That is FALSE for Angular: the surrounding whitespace becomes
		// LITERAL SEGMENTS of the interpolation's BoundText and both survive, so
		// `<output>{{ writes }}</output>` would render `" 0\n"` if it were broken
		// across lines. The emitter's inline rule is therefore REQUIRED here, not
		// conservative, and this is the arm that would have shipped silently wrong
		// had the Vue measurement been inherited instead of re-run.
		expect(renderedText('<output>\n\t{{ a }}\n</output>')).toEqual([' ', '\n']);
		expect(renderedText('<output>{{ a }}</output>')).toEqual([]);
	});

	test('the SHIPPED corpus renders no text with an untrimmed edge', () => {
		expect([...emittedSources.keys()].sort(byScenarioNumber)).toEqual(scenarioCorpus());
		for (const [file, source] of emittedSources)
			for (const text of renderedText(inlineTemplate(source)))
				expect(text, `${file} rendered ${JSON.stringify(text)}`).toBe(text.trim());
		// ANTI-VACUITY: the walk finds real text. A walk that stopped descending
		// would pass the loop above by observing nothing.
		expect(renderedText(inlineTemplate(s1))).toEqual(['hidden', 'increment']);
		expect(renderedText(inlineTemplate(s2))).toContain('/');
		expect(renderedText(inlineTemplate(s3))).toContain('cancel-submit');
	});
});

/**
 * ASSERTED TOOLCHAIN FACTS, in the sense `frameless-angular-v1` T002 ruling 1
 * invented for the vendored-vite divergence: a version this repo depends on but
 * does not govern becomes a declared entry a test re-reads, so it goes RED on
 * drift instead of drifting silently.
 */
describe('asserted toolchain facts', () => {
	test('the resolved Angular toolchain is at the recorded versions', () => {
		for (const [name, version] of [
			['@angular/compiler', '22.0.8'],
			['@angular-eslint/eslint-plugin', '22.1.0'],
			['@angular-eslint/eslint-plugin-template', '22.1.0'],
			['@angular-eslint/template-parser', '22.1.0'],
		] as const)
			expect(require(`${name}/package.json`).version, name).toBe(version);
	});

	/**
	 * WHY EVERY BASELINE FLOOR IN THE GATE READS `unverified`, asserted rather than
	 * asserted-about - the same measurement the Vue lane owed and for the same
	 * reason. The Svelte lane could at least point at an `@since` tag; the resolved
	 * `@angular/compiler` carries none and ships no changelog, so there is nothing
	 * on disk in this repo that dates any emitted form.
	 */
	test('MEASURED: the resolved @angular/compiler dates nothing', async () => {
		const root = resolve(require.resolve('@angular/compiler/package.json'), '..');
		const types = await readFile(resolve(root, 'types/compiler.d.ts'), 'utf8');
		expect(types, 'compiler.d.ts unexpectedly carries an @since tag').not.toContain('@since');
		await expect(readFile(resolve(root, 'CHANGELOG.md'), 'utf8')).rejects.toThrow();
	});
});
