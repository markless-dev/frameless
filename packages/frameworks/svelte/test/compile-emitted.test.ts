import { readFile } from 'node:fs/promises';
import { compile, VERSION } from 'svelte/compiler';
import { resolve } from 'pathe';
import { beforeAll, describe, expect, test } from 'vitest';
import { SANCTIONED_SVELTE_IGNORE_CODES } from '../src/emitter/index.ts';
import { discoverGeneratedFiles } from '../src/gate/index.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const MODES = [
	{ generate: 'client', dev: true },
	{ generate: 'client', dev: false },
	{ generate: 'server', dev: true },
	{ generate: 'server', dev: false },
] as const;

/**
 * The oracle. `svelte/compiler`'s own `compile()` runs IN PROCESS against the
 * exact version this package resolves, which is what makes it admissible under
 * Gate 1 where `svelte-check` - coupled to the demo's separate SvelteKit
 * install - would not be.
 *
 * It returns the SET of warning codes, so it is calibrated against a known
 * member below before any empty result from it is believed (instrument rule 4).
 */
function warningCodes(source: string, filename: string): string[] {
	const codes = new Set<string>();
	for (const { generate, dev } of MODES)
		for (const warning of compile(source, { filename, generate, dev }).warnings)
			codes.add(warning.code);
	return [...codes].sort();
}

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

describe('emitted Svelte compiles clean at the resolved version', () => {
	// PRECONDITION, asserted rather than assumed. Gate 1 records FAIL when the
	// evidence is documentary and a build of the framework is in the lockfile;
	// this package is what puts Svelte there, so the version this oracle actually
	// ran against is pinned here. T001 recorded the ^5.56.1 line; the PM measured
	// 5.56.8.
	test('runs against the ^5.56 line T001 recorded', () => {
		const [major, minor] = VERSION.split('.').map(Number) as [number, number];
		expect({ major, atLeastMinor: minor >= 56 }, `resolved svelte ${VERSION}`).toEqual({
			major: 5,
			atLeastMinor: true,
		});
	});

	test('covers exactly the three scenario components', () => {
		expect(files).toEqual([
			'generated/S1.svelte',
			'generated/S2.svelte',
			'generated/S3.svelte',
		]);
	});

	test.each(['generated/S1.svelte', 'generated/S2.svelte', 'generated/S3.svelte'])(
		'%s compiles with an EXACT EMPTY warning set in every mode',
		(file) => {
			const source = sources.get(file)!;
			expect(warningCodes(source, file)).toEqual([]);
			for (const { generate, dev } of MODES)
				expect(compile(source, { filename: file, generate, dev }).js.code.length)
					.toBeGreaterThan(0);
		},
	);
});

/**
 * CALIBRATION. An empty warning set is only evidence if the same call is known
 * to produce a non-empty one, and each row below is a shape the emitter had to
 * choose a lowering to avoid - so each is also the reason that lowering exists.
 */
describe('CALIBRATION: the compile() oracle goes red', () => {
	test('on a known member of the set it establishes', () => {
		// The most basic two-sided check: this instrument reports codes at all.
		const source = [
			'<script>',
			'\tlet { initial } = $props();',
			'\tlet text = $state(initial);',
			'</script>',
			'',
			'<p>{text}</p>',
		].join('\n');
		expect(warningCodes(source, 'Known.svelte')).toEqual(['state_referenced_locally']);
	});

	test('when the once-per-instance untrack lowering is removed', () => {
		const mutant = mutate(
			sources.get('generated/S3.svelte')!,
			'$state(untrack(() => initial))',
			'$state(initial)',
		);
		expect(warningCodes(mutant, 'S3.svelte')).toEqual(['state_referenced_locally']);
	});

	test('when the sanctioned a11y suppression is removed', () => {
		const mutant = mutate(
			sources.get('generated/S3.svelte')!,
			/<!-- svelte-ignore [^>]*-->/,
			'',
		);
		expect(warningCodes(mutant, 'S3.svelte')).toEqual([...SANCTIONED_SVELTE_IGNORE_CODES].sort());
	});

	test('when a non-void element is self-closed', () => {
		const source = [
			'<script>',
			'\tlet { x } = $props();',
			'</script>',
			'',
			'<div data-x={x}><span data-callback-marker="present" /></div>',
		].join('\n');
		expect(warningCodes(source, 'SelfClosing.svelte')).toEqual([
			'element_invalid_self_closing_tag',
		]);
	});

	// Why void elements are emitted as `<input>` and never `<input />`: the
	// template printer moves a line break to just before an element's final `>`,
	// and a `/` separated from its `>` is not a self-closing start tag. This is a
	// parse ERROR rather than a warning, so the shape can never reach production
	// silently - but it is the constraint the layout is built around, pinned here.
	test('and a self-closing slash separated from its `>` does not even parse', () => {
		const mutant = mutate(
			sources.get('generated/S3.svelte')!,
			'<span data-callback-marker="present"></span',
			'<span data-callback-marker="present" /',
		);
		expect(() => warningCodes(mutant, 'S3.svelte')).toThrow(/Expected token >/);
	});

	test('and throws outright on source it cannot parse', () => {
		const mutant = mutate(sources.get('generated/S1.svelte')!, '</script>', '');
		expect(() => warningCodes(mutant, 'S1.svelte')).toThrow();
	});
});

/**
 * The MEASURED blind spot that the emitter's second-half check exists for.
 *
 * Svelte does NOT report a redundant `svelte-ignore`, so "the emitted source has
 * zero warnings" cannot by itself tell an exactly-calibrated suppression apart
 * from an over-firing one. `emit()` therefore also compiles its output with the
 * annotations stripped and requires the resulting code set to equal exactly the
 * set it suppressed. This test pins the upstream behaviour that makes that
 * second half necessary, so if Svelte ever starts reporting it, the check can be
 * simplified deliberately rather than discovered by accident.
 */
test('a redundant svelte-ignore is INVISIBLE to compile(), which is why emit() checks both sides', () => {
	const source = [
		'<script>',
		'\tlet { onTrace } = $props();',
		'</script>',
		'',
		`<!-- svelte-ignore ${SANCTIONED_SVELTE_IGNORE_CODES.join(', ')} --><button onclick={() => onTrace()}>x</button>`,
	].join('\n');
	expect(warningCodes(source, 'Redundant.svelte')).toEqual([]);
});
