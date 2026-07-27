import { readFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(await readFile(resolve(compilerGoldenRoot, name), 'utf8')) as EnrichedIR;
}

/**
 * MUTATION CONSTRUCTOR - see the doc comment on the copy in
 * `packages/frameworks/qwik/test/gate.test.ts`, which instructs a new adapter to
 * copy this block rather than reach for a bare `.replace()`. `String.prototype
 * .replace` promises to return a string, NOT to have matched; a search that
 * misses returns the input unchanged and the test then asserts against a
 * non-mutant, staying green while measuring nothing.
 */
function mutate(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replace(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert against a non-mutant',
	);
}

const FIXTURES = [
	['S1.svelte', 's1-render-once.json'],
	['S2.svelte', 's2-keyed-todo.json'],
	['S3.svelte', 's3-event-form.json'],
] as const;

describe('Svelte 5 emitter', () => {
	test('CALIBRATION: the mutation constructor is loud on a non-mutant', async () => {
		const source = await readFile(resolve(packageRoot, 'generated/S1.svelte'), 'utf8');
		expect(() => mutate(source, 'text that is not in the emitted S1', 'x')).toThrow(
			/did not change the source/,
		);
		expect(source).toContain('$derived(');
		expect(() => mutate(source, '$derived(', '$derived(')).toThrow(
			/did not change the source/,
		);
	});

	// GOLDEN FRESHNESS. Byte equality against what the emitter produces right now,
	// so a checked-in artifact can never drift from the emitter that claims to
	// produce it.
	for (const [file, artifact] of FIXTURES)
		test(`${file} is byte-identical to a fresh emission`, async () => {
			const emitted = formatEmitted(emit(await golden(artifact)));
			const checkedIn = await readFile(resolve(packageRoot, 'generated', file), 'utf8');
			expect(emitted).toBe(checkedIn);
			// CALIBRATION for the comparison itself: a byte-equality assertion that
			// has only ever been shown to pass is not evidence it can fail.
			expect(mutate(emitted, 'do not edit.', 'do not edit!')).not.toBe(checkedIn);
		});

	test('lowers the runes surface S1/S2/S3 need, and nothing above the 5.0 baseline', async () => {
		const sources = await Promise.all(
			FIXTURES.map(([file]) =>
				readFile(resolve(packageRoot, 'generated', file), 'utf8'),
			),
		);
		const [s1, s2, s3] = sources as [string, string, string];
		expect(s1).toContain('let { label, multiplier, visible, onTrace } = $props();');
		expect(s1).toContain('let count = $state(1);');
		expect(s1).toContain('const derived = $derived(`${prefix}${count * multiplier}`);');
		expect(s1).toContain('{#if !visible}');
		expect(s1).toContain('{:else}');
		expect(s2).toContain('{#each todos as todo (todo.id)}');
		expect(s3).toContain('onclick={(event) => {');
		// IR-4 is DEFERRED and the version corollary is not amended, so every
		// emitted construct must be Svelte 5.0 baseline. These four are the ones
		// with a version floor above it.
		for (const source of sources) {
			expect(source).not.toContain('$props.id(');
			expect(source).not.toContain('{@attach');
			expect(source).not.toContain('<svelte:boundary');
			expect(source).not.toMatch(/\$derived\.by\(/);
		}
	});

	test('emits the once-per-instance policy as untrack, matching the Solid lowering', async () => {
		const s1 = await readFile(resolve(packageRoot, 'generated/S1.svelte'), 'utf8');
		// Reads a prop at component top level: wrapped.
		expect(s1).toContain("untrack(() => onTrace('setup', { runs: 1 }));");
		expect(s1).toContain('const prefix = untrack(() => `${label}:`);');
		// Reads nothing reactive: NOT wrapped. Without this the assertion above
		// would pass for an emitter that wrapped everything unconditionally.
		expect(s1).toContain('let count = $state(1);');
		const s3 = await readFile(resolve(packageRoot, 'generated/S3.svelte'), 'utf8');
		expect(s3).toContain('let text = $state(untrack(() => initial));');
		expect(s3).toContain('let checked = $state(false);');
	});

	test('emits the delegated attribute form for every event, never on() and never a mix', async () => {
		// The form chosen after MEASUREMENT, not documents: at 5.56.8 a delegated
		// onclick calling preventDefault() on a <button type="submit"> left the
		// Document-request count unchanged, and the same page with the call removed
		// issued the form's GET. A mix of mechanisms would change ordering between
		// the button handler and the form's own handler, which S3 depends on.
		for (const [file] of FIXTURES) {
			const source = await readFile(resolve(packageRoot, 'generated', file), 'utf8');
			expect(source).not.toContain("from 'svelte/events'");
			expect(source).not.toContain('on(');
			expect(source).not.toMatch(/\son:[a-z]/);
		}
	});

	describe('fails closed', () => {
		test('on a declared stopPropagation', async () => {
			const artifact = structuredClone(await golden('s3-event-form.json'));
			const event = artifact.records.events.find((entry) => entry.syncPolicy);
			expect(event).toBeDefined();
			(event as unknown as { syncPolicy: { actions: string[] } }).syncPolicy.actions.push(
				'stopPropagation',
			);
			expect(() => emit(artifact)).toThrow(/fails closed on a declared stopPropagation/);
		});

		test('when a declared unconditional preventDefault is not spelled in the body', async () => {
			const artifact = structuredClone(await golden('s3-event-form.json'));
			const event = artifact.records.events.find((entry) => entry.syncPolicy)!;
			const handler = event.handlers[0]! as { expression: Record<string, any> };
			const body = handler.expression.body as Record<string, any>;
			const before = body.body.length;
			body.body = body.body.filter(
				(statement: Record<string, any>) =>
					statement.expression?.callee?.property?.name !== 'preventDefault',
			);
			expect(body.body.length).toBeLessThan(before);
			expect(() => emit(artifact)).toThrow(/does not spell as a top-level preventDefault/);
		});

		test('on persistence-bearing IR', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact.records.persistence as unknown[]).push({ graphNodeId: 'state:count' });
			expect(() => emit(artifact)).toThrow(/does not support persistence-bearing IR/);
		});

		test('on an early component guard, which a .svelte module cannot express', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact.components[0]!.guards as unknown[]).push({
				id: 'guard:0',
				test: { expression: { type: 'Identifier', name: 'visible' }, reads: [] },
				whenTrue: { kind: 'null' },
			});
			expect(() => emit(artifact)).toThrow(/no lowering for an early component guard/);
		});

		test('on a keyed repeat construct with no corpus instance', async () => {
			const artifact = structuredClone(await golden('s2-keyed-todo.json'));
			let patched = false;
			const stamp = (node: Record<string, any>): void => {
				if (node?.kind === 'keyed-repeat') {
					node.index = 'position';
					patched = true;
				}
				for (const value of Object.values(node ?? {})) {
					if (!value || typeof value !== 'object') continue;
					if (Array.isArray(value)) value.forEach((entry) => stamp(entry));
					else stamp(value as Record<string, any>);
				}
			};
			stamp(artifact.components[0]! as unknown as Record<string, any>);
			expect(patched).toBe(true);
			expect(() => emit(artifact)).toThrow(/no lowering for an index binding/);
		});

		test('on an IR whose version discriminator moved', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact as { version: string }).version = 'frameless-enriched-ir/3';
			expect(() => validateEnrichedIr(artifact)).toThrow(/frameless-enriched-ir\/2/);
			expect(() => emit(artifact)).toThrow(/frameless-enriched-ir\/2/);
		});

		test('on an unknown semantic field, so a schema addition cannot pass silently', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact as unknown as Record<string, unknown>).newField = [];
			expect(() => emit(artifact)).toThrow(/unknown semantic field: newField/);
		});
	});
});

describe('formatEmitted asserts what no formatter is available to enforce', () => {
	test('accepts every emitted golden', async () => {
		for (const [file] of FIXTURES) {
			const source = await readFile(resolve(packageRoot, 'generated', file), 'utf8');
			expect(formatEmitted(source)).toBe(source);
		}
	});

	// CALIBRATION. Each row is a shape the missing formatter would otherwise have
	// normalised away.
	const rejected = [
		['CRLF line endings', (source: string) => source.replaceAll('\n', '\r\n'), /LF line/],
		['a missing final newline', (source: string) => source.trimEnd(), /exactly one newline/],
		['a doubled final newline', (source: string) => `${source}\n`, /exactly one newline/],
		[
			'trailing whitespace',
			(source: string) => source.replace('</script>', '</script> '),
			/trailing whitespace/,
		],
		[
			'space indentation',
			(source: string) => source.replace('\n\tlet ', '\n\t  let '),
			/indents with spaces/,
		],
	] as const;

	for (const [shape, apply, message] of rejected)
		test(`CALIBRATION: rejects ${shape}`, async () => {
			const source = await readFile(resolve(packageRoot, 'generated/S1.svelte'), 'utf8');
			const mutant = apply(source);
			expect(mutant, `${shape} produced a non-mutant`).not.toBe(source);
			expect(() => formatEmitted(mutant)).toThrow(message);
		});
});
