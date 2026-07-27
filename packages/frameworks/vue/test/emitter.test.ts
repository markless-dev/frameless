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
	['S1.vue', 's1-render-once.json'],
	['S2.vue', 's2-keyed-todo.json'],
	['S3.vue', 's3-event-form.json'],
] as const;

async function emitted(file: string): Promise<string> {
	return readFile(resolve(packageRoot, 'generated', file), 'utf8');
}

describe('Vue 3 emitter', () => {
	test('CALIBRATION: the mutation constructor is loud on a non-mutant', async () => {
		const source = await emitted('S1.vue');
		expect(() => mutate(source, 'text that is not in the emitted S1', 'x')).toThrow(
			/did not change the source/,
		);
		expect(source).toContain('computed(');
		expect(() => mutate(source, 'computed(', 'computed(')).toThrow(
			/did not change the source/,
		);
	});

	// GOLDEN FRESHNESS. Byte equality against what the emitter produces right now,
	// so a checked-in artifact can never drift from the emitter that claims to
	// produce it.
	for (const [file, artifact] of FIXTURES)
		test(`${file} is byte-identical to a fresh emission`, async () => {
			const fresh = formatEmitted(emit(await golden(artifact)));
			const checkedIn = await emitted(file);
			expect(fresh).toBe(checkedIn);
			// CALIBRATION for the comparison itself: a byte-equality assertion that
			// has only ever been shown to pass is not evidence it can fail.
			expect(mutate(fresh, 'do not edit.', 'do not edit!')).not.toBe(checkedIn);
		});

	test('emits an SFC with <script setup>, no lang, and a default-exported component', async () => {
		for (const [file] of FIXTURES) {
			const source = await emitted(file);
			expect(source).toContain('<script setup>\n');
			expect(source).not.toContain('lang=');
			expect(source).toContain('<template>\n');
			// A .vue module is one component exported as the module DEFAULT, so the
			// IR's named ComponentExport cannot be honoured by spelling. The name is
			// carried in the generated header instead - the same divergence the
			// Svelte lane records, and the reason this row exists rather than an
			// `export function <Name>` one.
			expect(source).not.toContain('export ');
		}
		expect(await emitted('S1.vue')).toContain('@frameless/vue from RenderOnce');
		expect(await emitted('S2.vue')).toContain('@frameless/vue from KeyedTodo');
		expect(await emitted('S3.vue')).toContain('@frameless/vue from EventForm');
	});

	/**
	 * THE DECISION THIS BOARD'S T005 OWNS, asserted here so it cannot be taken by
	 * reflex.
	 *
	 * `docs/emitter-idiom-policy.md` worked example 2 rules the v-bind/v-on/v-slot
	 * shorthands DEFERRED and T005 re-runs its six gates. Emitting `@click` would
	 * hand that ruling a shipped fact to ratify, which is exactly the failure
	 * `frameless-svelte-v1` T002 named.
	 */
	test('emits LONGHAND directives only, with no modifier and no shorthand', async () => {
		for (const [file] of FIXTURES) {
			const source = await emitted(file);
			expect(source).not.toMatch(/\s@[a-z]+=/);
			expect(source).not.toMatch(/\s:[a-z-]+=/);
			expect(source).not.toMatch(/\s#[a-z-]+[=>\s]/);
			expect(source).not.toMatch(/v-(?:on|bind|slot):[a-zA-Z-]+\./);
			expect(source).not.toContain('v-model');
			expect(source).not.toContain('defineModel');
			expect(source).not.toContain('defineEmits');
			expect(source).not.toContain('withDefaults');
		}
		expect(await emitted('S1.vue')).toContain('v-on:click="');
		expect(await emitted('S2.vue')).toContain('v-bind:key="todo.id"');
		expect(await emitted('S2.vue')).toContain('v-for="todo in todos"');
		expect(await emitted('S3.vue')).toContain('v-bind:checked="checked"');
	});

	/**
	 * THE SCRIPT/TEMPLATE SPLIT, which is the one thing this emitter does that the
	 * React, Solid and Svelte emitters do not need at all.
	 *
	 * In the TEMPLATE, Vue's own compiler resolves identifiers against
	 * `bindingMetadata` - a ref is unwrapped and a prop is reached - so expressions
	 * are emitted VERBATIM from the IR. In `<script setup>` there is no such
	 * resolution, so a prop becomes `props.x` and a ref becomes `x.value`.
	 */
	test('respells SCRIPT expressions and leaves TEMPLATE expressions verbatim', async () => {
		const s1 = await emitted('S1.vue');
		// Script: prop through the defineProps object, ref through .value.
		expect(s1).toContain("const props = defineProps(['label', 'multiplier', 'visible', 'onTrace']);");
		expect(s1).toContain("props.onTrace('setup', { runs: 1 });");
		expect(s1).toContain('const prefix = `${props.label}:`;');
		expect(s1).toContain(
			'const derived = computed(() => `${prefix}${count.value * props.multiplier}`);',
		);
		// `prefix` is an ordinary local, NOT a ref, so it is NOT respelled. Without
		// this row the assertion above would pass for an emitter that suffixed
		// `.value` onto everything.
		expect(s1).not.toContain('prefix.value');
		// Template: the authored spelling, unchanged.
		expect(s1).toContain('v-if="!visible"');
		expect(s1).toContain('{{ derived }}');
		expect(s1).toContain("onTrace('change', { count });");
		expect(s1).not.toContain('props.visible');
	});

	test('the script respelling is SCOPE-AWARE, not a name substitution', async () => {
		const s2 = await emitted('S2.vue');
		// `todos` is a ref and is respelled; the arrow parameter `todo` shadows
		// nothing and must not be touched, and `todo.done` is a member property.
		expect(s2).toContain(
			'const complete = computed(() => todos.value.filter((todo) => todo.done).length);',
		);
		expect(s2).toContain('const todos = ref(props.seed.map((todo) => ({ ...todo })));');
		expect(s2).not.toContain('todo.value');
	});

	/**
	 * `ComponentEvaluationPolicy.ordinaryLocals` is `once-per-instance`, and Vue is
	 * the target where that needs NO lowering: `<script setup>` IS the setup body
	 * and runs once per instance. Solid and Svelte both need `untrack` here, so
	 * this row records the absence deliberately rather than leaving it to look like
	 * an oversight.
	 */
	test('emits the once-per-instance policy as plain setup statements, with no untrack', async () => {
		for (const [file] of FIXTURES) {
			const source = await emitted(file);
			expect(source).not.toContain('untrack');
			expect(source).not.toContain('watchEffect');
			expect(source).not.toContain('onMounted');
		}
		expect(await emitted('S3.vue')).toContain('const text = ref(props.initial);');
	});

	test('emits only baseline-safe Vue 3 forms, with no 3.3+ or 3.5+ construct', async () => {
		// IR-4 is DEFERRED and the version corollary is not amended, so every
		// emitted construct must be safe across the Vue 3 line. These are the ones
		// with a version floor above 3.2 that an author would reach for first.
		for (const [file] of FIXTURES) {
			const source = await emitted(file);
			expect(source).not.toContain('defineOptions');
			expect(source).not.toContain('defineSlots');
			expect(source).not.toContain('defineExpose');
			expect(source).not.toContain('useTemplateRef');
			// Reactive props destructure is only non-experimental from 3.5; before
			// that it reads the prop once, and S1's computed reads `multiplier` on
			// every recomputation.
			expect(source).not.toMatch(/const\s*\{[^}]*\}\s*=\s*defineProps/);
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

		test('on an early component guard, which a .vue module cannot express', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact.components[0]!.guards as unknown[]).push({
				id: 'guard:0',
				test: { expression: { type: 'Identifier', name: 'visible' }, reads: [] },
				whenTrue: { kind: 'null' },
			});
			expect(() => emit(artifact)).toThrow(/no lowering for an early component guard/);
		});

		test('on more than one root template node, which would become an SSR fragment', async () => {
			// NOT a stylistic refusal. A multi-root <template> compiles to a Fragment,
			// and a Fragment is server-rendered with `<!--[-->` / `<!--]-->` anchor
			// comments that the e2e lane reads out of the served payload.
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const component = artifact.components[0]! as unknown as Record<string, unknown[]>;
			component.template = [...component.template, structuredClone(component.template[0])];
			expect(() => emit(artifact)).toThrow(/exactly one root template node/);
		});

		test('on a branch arm that is not exactly one host element', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			let patched = false;
			const stamp = (node: Record<string, any>): void => {
				if (node?.kind === 'branch') {
					node.arms[0].children = [...node.arms[0].children, { kind: 'text', value: 'x' }];
					patched = true;
					return;
				}
				for (const value of Object.values(node ?? {})) {
					if (!value || typeof value !== 'object') continue;
					if (Array.isArray(value)) value.forEach((entry) => stamp(entry));
					else stamp(value as Record<string, any>);
				}
			};
			stamp(artifact.components[0]! as unknown as Record<string, any>);
			expect(patched).toBe(true);
			expect(() => emit(artifact)).toThrow(/branch arm that is not exactly one host element/);
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

		test('on a component local that would shadow a binding the emitter introduces', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const local = artifact.components[0]!.locals[0]! as unknown as Record<string, any>;
			local.names = ['props'];
			expect(() => emit(artifact)).toThrow(/would shadow a binding <script setup>/);
		});

		test('on a declared prop default, which needs the type-argument defineProps form', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact.components[0]!.props.entries[0]! as unknown as Record<string, any>)
				.defaultValue = { type: 'Literal', value: 'x', raw: "'x'" };
			expect(() => emit(artifact)).toThrow(/no lowering for a prop default value/);
		});

		test('on a script expression node the rewriter has never been taught', async () => {
			// The rewriter REFUSES rather than guessing. An unknown node type reaching
			// `props.` / `.value` respelling unhandled would produce plausible-looking
			// Vue with a silently unresolved identifier in it.
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const local = artifact.components[0]!.locals.find((entry) => entry.names[0] === 'prefix')!;
			(local as unknown as { initializer: unknown }).initializer = {
				type: 'ClassExpression',
				id: null,
				superClass: null,
				body: { type: 'ClassBody', body: [] },
			};
			expect(() => emit(artifact)).toThrow(/no script lowering for the expression node/);
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

		/**
		 * `emit()` runs its own copy of the compile oracle, so a lowering that
		 * produces uncompilable Vue never reaches disk. This plants a diagnostic
		 * upstream of the emitter's own check by corrupting a handler body into a
		 * shape Vue's template expression parser refuses.
		 */
		test('when its own output would not compile with an empty diagnostic set', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const text = artifact.components[0]!.template[0]!;
			const stamp = (node: Record<string, any>): void => {
				if (node?.kind === 'host' && node.tag === 'p')
					node.children = [
						...node.children,
						{
							kind: 'host',
							id: 'planted',
							tag: 'div',
							staticAttributes: [],
							dynamicBindings: [],
							eventIds: [],
							children: [],
						},
					];
				for (const value of Object.values(node ?? {})) {
					if (!value || typeof value !== 'object') continue;
					if (Array.isArray(value)) value.forEach((entry) => stamp(entry));
					else stamp(value as Record<string, any>);
				}
			};
			stamp(text as unknown as Record<string, any>);
			expect(() => emit(artifact)).toThrow(/did not compile with an empty diagnostic set/);
		});
	});
});

describe('formatEmitted asserts what no formatter is available to enforce', () => {
	test('accepts every emitted golden', async () => {
		for (const [file] of FIXTURES) {
			const source = await emitted(file);
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
			(source: string) => source.replace('\n\tconst ', '\n\t  const '),
			/indents with spaces/,
		],
	] as const;

	for (const [shape, apply, message] of rejected)
		test(`CALIBRATION: rejects ${shape}`, async () => {
			const source = await emitted('S1.vue');
			const mutant = apply(source);
			expect(mutant, `${shape} produced a non-mutant`).not.toBe(source);
			expect(() => formatEmitted(mutant)).toThrow(message);
		});
});
