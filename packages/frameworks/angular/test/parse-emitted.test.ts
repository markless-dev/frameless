import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseTemplate } from '@angular/compiler';
import { resolve } from 'pathe';
import { beforeAll, describe, expect, test } from 'vitest';
import { templateDiagnostics } from '../src/emitter/index.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

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

let s1 = '';
let s2 = '';
let s3 = '';
beforeAll(async () => {
	[s1, s2, s3] = await Promise.all(
		['S1', 'S2', 'S3'].map((name) =>
			readFile(resolve(packageRoot, `generated/${name}.ts`), 'utf8'),
		),
	);
});

/**
 * ARBITER 1 - `@angular/compiler`'s own `parseTemplate`, run as an EXACT EMPTY
 * error set over all three emitted templates.
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
		for (const [name, source] of [
			['S1', s1],
			['S2', s2],
			['S3', s3],
		] as const)
			expect(templateDiagnostics(inlineTemplate(source), `${name}.html`), name).toEqual([]);
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
		for (const [name, source] of [
			['S1', s1],
			['S2', s2],
			['S3', s3],
		] as const)
			for (const text of renderedText(inlineTemplate(source)))
				expect(text, `${name} rendered ${JSON.stringify(text)}`).toBe(text.trim());
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
