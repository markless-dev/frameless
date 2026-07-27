import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';
import vuePlugin from 'eslint-plugin-vue';
import type { EnrichedIR } from '@frameless/compiler';
import { dirname, resolve } from 'pathe';
import { beforeAll, describe, expect, test } from 'vitest';
import { compileDiagnostics, emit } from '../src/emitter/index.ts';
import type { GatePolicy } from '../src/gate/index.ts';
import {
	BASELINE_FORM_INVENTORY,
	checkGeneratedFiles,
	checkSources,
	collectEmittedForms,
	discoverGeneratedFiles,
	VUE_ESLINT_RULES_APPLIED,
	VUE_ESLINT_RULES_OMITTED,
	VUE_ESLINT_TIERS_EXCLUDED,
	VUE_GATE_POLICIES,
} from '../src/gate/index.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');
const require = createRequire(import.meta.url);
const vuePackageRoot = dirname(require.resolve('vue/package.json'));

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(await readFile(resolve(compilerGoldenRoot, name), 'utf8')) as EnrichedIR;
}

/**
 * MUTATION CONSTRUCTOR - every mutant in this file is built with this. Copied
 * verbatim in intent from `packages/frameworks/qwik/test/gate.test.ts`, whose own
 * doc comment instructs a new adapter to do exactly this and NOT to reach for a
 * bare `.replace()`.
 *
 * `String.prototype.replace` promises to return a string, NOT to have matched.
 * When the search misses it returns the input unchanged, with no error, and the
 * test then asserts a gate policy against source the gate has every right to
 * accept - green while measuring nothing. That is defect 3 cause B
 * (defects-and-targets T006/T007), where a CRLF checkout made one Solid search
 * literal unmatchable and the row had been asserting against a non-mutant for as
 * long as it had existed. This corpus is exposed the same way: its mutants are
 * built from emitted files read off disk, which the emitter is free to reshape.
 *
 * The assertion is on the OUTPUT, not on the search: a search that matched but
 * changed nothing yields a non-mutant just the same, and is rejected the same.
 */
function mutate(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replace(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`gate mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert a policy against a non-mutant',
	);
}

/** `replaceAll` twin of `mutate`, with the same output-side precondition. */
function mutateAll(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replaceAll(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`gate mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert a policy against a non-mutant',
	);
}

let s1 = '';
let s2 = '';
let s3 = '';
beforeAll(async () => {
	[s1, s2, s3] = await Promise.all(
		['S1', 'S2', 'S3'].map((name) =>
			readFile(resolve(packageRoot, `generated/${name}.vue`), 'utf8'),
		),
	);
});

async function policiesFor(file: string, source: string): Promise<string[]> {
	return (await checkSources([{ file, source }])).violations.map((entry) => entry.policy);
}

async function violationsFor(file: string, source: string) {
	return (await checkSources([{ file, source }])).violations;
}

/** The messages the THIRD-PARTY arbiter produced, keyed by its `eslint:` prefix. */
async function eslintMessagesFor(
	file: string,
	source: string,
): Promise<Array<{ policy: string; message: string }>> {
	return (await checkSources([{ file, source }])).violations
		.filter((entry) => entry.policy.startsWith('eslint:'))
		.map((entry) => ({ policy: entry.policy, message: entry.message }));
}

/**
 * A floor recorded as `verified` has to cite an artifact that can be re-read, in
 * the RESOLVED vue package rather than in a document. A missing file throws
 * rather than returning false: "the citation is gone" and "the citation is wrong"
 * are different failures and must not collapse into one another.
 */
async function citationHolds(citation: {
	readonly file: string;
	readonly needle: string;
}): Promise<boolean> {
	const text = await readFile(resolve(vuePackageRoot, citation.file), 'utf8');
	return text.includes(citation.needle);
}

describe('Vue dossier gate', () => {
	test('publishes independent source and artifact-required policies', () => {
		// The frameless-owned policies keep BARE ids; every third-party verdict is
		// prefixed `eslint:`. That prefix is the whole record of who decided a rule,
		// so it is pinned from both sides.
		expect(
			VUE_GATE_POLICIES.map((policy) => policy.id).filter((id) => !id.startsWith('eslint:')),
		).toEqual([
			'generated-header',
			'require-directive-shorthand',
			'directive-carries-value',
			'no-directive-modifier',
			'no-two-way-binding',
			'no-typed-props',
			'no-stop-propagation',
			'computed-expression-purity',
			'condense-stable-text',
			'baseline-form-inventory',
			'persistence-render-lowering',
		]);
		expect(
			VUE_GATE_POLICIES.map((policy) => policy.id).filter((id) => id.startsWith('eslint:')),
		).toEqual(VUE_ESLINT_RULES_APPLIED.map((rule) => `eslint:${rule}`));
		expect(
			(VUE_GATE_POLICIES as readonly GatePolicy[])
				.filter((policy) => policy.requiresArtifact)
				.map((policy) => policy.id),
		).toEqual(['persistence-render-lowering']);
	});

	test('discovers and accepts the clean S1/S2/S3 emitted corpus', async () => {
		expect(await discoverGeneratedFiles()).toEqual([
			'generated/S1.vue',
			'generated/S2.vue',
			'generated/S3.vue',
		]);
		const result = await checkGeneratedFiles();
		// [] IS NOT SELF-EVIDENT EVIDENCE - every policy below carries a mutation
		// row proving it can reject, and the anti-vacuity rows prove the two
		// policies most at risk of degenerating into "reject everything" do not.
		expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
		expect(result.unevaluated).toEqual([
			{ policy: 'persistence-render-lowering', reason: 'requires-artifact' },
		]);
		expect(Object.keys(result)).toEqual(['files', 'policies', 'violations']);
		for (const file of result.files)
			expect(await readFile(resolve(packageRoot, file), 'utf8')).toContain(
				'@generated by @frameless/vue',
			);
	});

	// CALIBRATION for the mutation constructor itself. A helper nobody has watched
	// fail is not evidence that it can fail, and the failure it guards against is
	// silent by construction.
	test('CALIBRATION: a mutation that leaves the source unchanged is loud', () => {
		expect(() => mutate(s1, 'text that is not in the emitted S1', 'x')).toThrow(
			/did not change the source/,
		);
		expect(s1).toContain('ref(');
		expect(() => mutate(s1, 'ref(', 'ref(')).toThrow(/did not change the source/);
		expect(() => mutateAll(s1, 'text that is not in the emitted S1', 'x')).toThrow(
			/did not change the source/,
		);
	});

	test('MUTATION: rejects emitted source without the generated header', async () => {
		const mutant = mutate(s1, '<!-- @generated by @frameless/vue', '<!-- hand written');
		expect(await policiesFor('generated/HeaderMutant.vue', mutant)).toContain(
			'generated-header',
		);
	});

	/**
	 * THE ROW THAT HOLDS T005'S RULING IN PLACE, and it is the ONLY instrument in
	 * this repo that can.
	 *
	 * `docs/emitter-idiom-policy.md` worked example 2a rules the valued shorthands
	 * **sugar** and T006 adopted them. T005 also MEASURED that the two spellings are
	 * behaviourally identical - empty diagnostics both ways, byte-identical template
	 * codegen and production `compileScript` output in all four `ssr x isProd`
	 * modes, byte-identical SSR HTML - so a silent revert to `v-on:click` would draw
	 * no complaint from `@vue/compiler-sfc`, from the applied eslint tier, or from
	 * the six-lane e2e. Reverting the polarity of this policy rather than deleting
	 * it is what keeps the ruling enforced instead of merely recorded.
	 */
	test('MUTATION: rejects the v-on and v-bind LONGHAND, which compiles clean', async () => {
		const on = mutate(s1, '@click="', 'v-on:click="');
		expect(await policiesFor('generated/OnLonghandMutant.vue', on)).toContain(
			'require-directive-shorthand',
		);
		const bind = mutate(s2, ':key="todo.id"', 'v-bind:key="todo.id"');
		expect(await policiesFor('generated/BindLonghandMutant.vue', bind)).toContain(
			'require-directive-shorthand',
		);
		// Neither draws a single diagnostic from Vue's own compiler, which is the
		// whole reason a frameless-owned policy has to exist for it.
		expect(compileDiagnostics(on, 'S1.vue')).toEqual([]);
		expect(compileDiagnostics(bind, 'S2.vue')).toEqual([]);
		// TWO INDEPENDENT LINES on each mutant: the inventory reaches the same
		// spelling as an un-inventoried FORM, from a different authority. This is the
		// half that would have been lost if `v-bind`/`v-on` had been left on the
		// inventory alongside `:`/`@`.
		expect(await policiesFor('generated/OnLonghandMutant.vue', on)).toContain(
			'baseline-form-inventory',
		);
		expect(await policiesFor('generated/BindLonghandMutant.vue', bind)).toContain(
			'baseline-form-inventory',
		);
	});

	/**
	 * THE OTHER DIRECTION. A gate that only fires one way is half a gate: a policy
	 * that rejects the longhand while accepting ANY shorthand would let through the
	 * two forms worked example 2a explicitly does not cover - `#header`, which 2b
	 * ruled DENIED, and `.foo="x"`, which pre-seeds a `prop` modifier inside
	 * `ondirname` and was never named by any entry.
	 */
	test('MUTATION: rejects a shorthand OUTSIDE the adopted pair - # and .', async () => {
		const slot = mutate(
			s2,
			'<li v-for="todo in todos"',
			'<li v-for="todo in todos" #row="row"',
		);
		const slotViolations = await violationsFor('generated/SlotShorthandMutant.vue', slot);
		expect(slotViolations.map((entry) => entry.policy)).toContain(
			'require-directive-shorthand',
		);
		expect(
			slotViolations.find((entry) => entry.policy === 'require-directive-shorthand')?.message,
		).toContain('worked example 2b');
		const prop = mutate(s3, ':checked="checked"', '.checked="checked"');
		const propViolations = await violationsFor('generated/PropShorthandMutant.vue', prop);
		expect(propViolations.map((entry) => entry.policy)).toContain(
			'require-directive-shorthand',
		);
		// Vue's own compiler is silent on the `.prop` shorthand, so nothing upstream
		// separates it from the adopted `:`.
		expect(compileDiagnostics(prop, 'S3.vue')).toEqual([]);
	});

	/**
	 * THE CONJUNCT NEITHER SPELLING POLICY CAN SEE, because both read the directive
	 * FORM and not whether it carries a value.
	 *
	 * MEASURED at 3.5.40 by T005 (M-G, a hypothesis that Judge held and refuted):
	 * a value-less `:count` and a value-less `v-bind:count` BOTH compile as Vue
	 * 3.4's same-name shorthand, and a value-less `v-on` errors in both spellings.
	 * The hazard is SYMMETRIC and pre-existing - the adoption neither created nor
	 * enlarged it - so this policy asserts the emitter cannot produce one rather
	 * than repairing anything.
	 */
	test('MUTATION: rejects a VALUE-LESS shorthand, the 3.4-gated same-name form', async () => {
		const mutant = mutate(s2, ':key="todo.id"', ':key');
		const violations = await violationsFor('generated/ValuelessBindMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('directive-carries-value');
		expect(
			violations.find((entry) => entry.policy === 'directive-carries-value')?.message,
		).toContain('same-name shorthand');
		// THE POINT OF THE ROW: every OTHER policy is happy. The form is `:`, which
		// is inventoried; the spelling is the adopted shorthand; and Vue's own
		// compiler emits an exact empty diagnostic set, because 3.4 made this legal.
		expect(compileDiagnostics(mutant, 'S2.vue')).toEqual([]);
		expect(violations.map((entry) => entry.policy)).not.toContain('baseline-form-inventory');
		expect(violations.map((entry) => entry.policy)).not.toContain(
			'require-directive-shorthand',
		);
		// The longhand twin of the same hazard, recorded so the symmetry T005
		// measured is asserted rather than described.
		const longhand = mutate(s2, ':key="todo.id"', 'v-bind:key');
		expect(await policiesFor('generated/ValuelessLonghandMutant.vue', longhand)).toContain(
			'directive-carries-value',
		);
	});

	test('ANTI-VACUITY: directive-carries-value accepts the value-less v-else it must', async () => {
		// If this policy were "every directive needs an expression" the clean corpus
		// would already be red - S1 ships `v-else`, which takes no value at all - and
		// the rows above would be measuring the mutant rather than the policy. The
		// allowlist is fail-closed: `v-else` is its only member, so a value-less
		// directive it does not name is still a violation.
		expect(s1).toContain('<section v-else data-scenario="s1">');
		expect(await policiesFor('generated/S1.vue', s1)).not.toContain('directive-carries-value');
		const once = mutate(s1, '<section v-else', '<section v-else v-once');
		expect(await policiesFor('generated/OnceMutant.vue', once)).toContain(
			'directive-carries-value',
		);
	});

	test('MUTATION: rejects a v-on modifier, and upstream agrees on an unknown one', async () => {
		const mutant = mutate(s3, '@click="(event) => {\n\t\t\tif', '@click.badmod="(event) => {\n\t\t\tif');
		const violations = await violationsFor('generated/ModifierMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('no-directive-modifier');
		// THE "COMPILES CLEAN AND IS WRONG" CLASS, measured: `@vue/compiler-sfc`
		// accepts an unknown v-on modifier with an EMPTY diagnostic set, and the
		// handler then silently never runs the modifier's behaviour. Only the
		// third-party arbiter sees it.
		expect(compileDiagnostics(mutant, 'S3.vue')).toEqual([]);
		expect(violations.map((entry) => entry.policy)).toContain('eslint:vue/valid-v-on');
	});

	test('MUTATION: rejects v-model and defineEmits, which IR-1 and IR-2 do not support', async () => {
		const model = mutate(s3, ':value="text"', 'v-model="text"');
		expect(await policiesFor('generated/ModelMutant.vue', model)).toContain(
			'no-two-way-binding',
		);
		const emits = mutate(
			s3,
			"const props = defineProps(['initial', 'onTrace']);",
			"const props = defineProps(['initial', 'onTrace']);\n\tconst emit = defineEmits(['go']);",
		);
		const emitsViolations = await violationsFor('generated/EmitsMutant.vue', emits);
		expect(emitsViolations.map((entry) => entry.policy)).toContain('no-two-way-binding');
		// THE MESSAGE IS PINNED, not just the policy id. T007 re-ran worked example 3
		// against vue@3.5.40 and MEASURED the rationale this message used to carry to
		// be false: it described the delta between an UNDECLARED prop and a declared
		// emit, and frameless declares the prop. The rule survived; its explanation
		// did not. So the three grounds that DO hold are asserted here, because a
		// violation message is read at the exact moment someone is deciding whether
		// to trust the rule - a silently reverted explanation is the failure mode.
		const emitsMessage = emitsViolations.find(
			(entry) => entry.policy === 'no-two-way-binding',
		)?.message;
		expect(emitsMessage).toContain('silent no-op');
		expect(emitsMessage).toContain('returns undefined');
		expect(emitsMessage).toContain('onTraceOnce');
		// The refuted claim must not creep back in any spelling of "native events".
		expect(emitsMessage).not.toMatch(/receiving native|no longer to native/);
	});

	test('MUTATION: rejects lang="ts", which is how a typed defineProps would arrive', async () => {
		const mutant = mutate(s3, '<script setup>', '<script setup lang="ts">');
		expect(await policiesFor('generated/LangMutant.vue', mutant)).toContain('no-typed-props');
	});

	test('MUTATION: rejects stopPropagation, and the emitter refuses to produce it', async () => {
		const mutant = mutate(s3, 'event.preventDefault();', 'event.stopPropagation();');
		expect(await policiesFor('generated/StopPropagationMutant.vue', mutant)).toContain(
			'no-stop-propagation',
		);
		// The gate is the second line. The first is the emitter: a declared
		// stopPropagation throws rather than growing a path the corpus has no
		// instance to test.
		const artifact = structuredClone(await golden('s3-event-form.json'));
		const event = artifact.records.events.find((entry) => entry.syncPolicy)!;
		(event as unknown as { syncPolicy: { actions: string[] } }).syncPolicy.actions.push(
			'stopPropagation',
		);
		expect(() => emit(artifact)).toThrow(/fails closed on a declared stopPropagation/);
	});

	test('MUTATION: persistence-bearing IR fails closed in the gate and the emitter', async () => {
		const artifact = structuredClone(await golden('s1-render-once.json'));
		(artifact.records.persistence as unknown[]).push({ graphNodeId: 'state:count' });
		const result = await checkSources([
			{ file: 'generated/PersistenceMutant.vue', source: s1, artifact },
		]);
		expect(result.unevaluated).toEqual([]);
		expect(result.violations).toEqual([
			expect.objectContaining({ policy: 'persistence-render-lowering' }),
		]);
		expect(() => emit(artifact)).toThrow(/does not support persistence-bearing IR/);
	});
});

/**
 * M1 - the measured whitespace rule, as a STANDING POLICY rather than a one-off
 * probe.
 *
 * `test/compile-emitted.test.ts` measures what Vue's `whitespace: 'condense'`
 * does; this is the check that the emitter never produces a layout it damages.
 * All three arms of the measurement have a row.
 */
describe('MUTATION: condense-stable-text (M1)', () => {
	test('ANTI-VACUITY: the shipped corpus is accepted, newlines between elements and all', async () => {
		// If this policy were "reject any whitespace" the clean corpus would already
		// be red, and every row below would be measuring the mutant rather than the
		// policy. The emitted templates are full of newline-separated siblings.
		expect(s1).toContain('</output>\n\t\t\t<button');
		expect(await policiesFor('generated/S1.vue', s1)).not.toContain('condense-stable-text');
		expect(await policiesFor('generated/S2.vue', s2)).not.toContain('condense-stable-text');
	});

	test('rejects a newline between an interpolation and text - S2 rendering 1 /2', async () => {
		const mutant = mutate(
			s2,
			'>{{ complete }}/{{ todos.length }}<',
			'>\n\t\t\t{{ complete }}\n\t\t\t/{{ todos.length }}\n\t\t<',
		);
		const violations = await violationsFor('generated/InterpolationWhitespaceMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('condense-stable-text');
		expect(
			violations.find((entry) => entry.policy === 'condense-stable-text')?.message,
		).toContain('" /"');
	});

	test('rejects a text child on its own line - <button> increment </button>', async () => {
		const mutant = mutate(s1, '>increment</button>', '>\n\t\t\t\tincrement\n\t\t\t</button>');
		const violations = await violationsFor('generated/TextWhitespaceMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('condense-stable-text');
		expect(
			violations.find((entry) => entry.policy === 'condense-stable-text')?.message,
		).toContain('" increment "');
	});

	test('rejects two elements separated by a space and no newline', async () => {
		// The arm the hypothesis did not name: the NEWLINE is what condense keys on,
		// so a space alone survives as a text node.
		const mutant = mutate(s1, '</output>\n\t\t\t<button', '</output> <button');
		expect(await policiesFor('generated/SpaceWhitespaceMutant.vue', mutant)).toContain(
			'condense-stable-text',
		);
	});
});

/**
 * IR-7 - the sleeper. S1's `computed` is trivial and will always pass, which is
 * the definition of a green vacuum, so the policy is calibrated against planted
 * members of the set it claims to catch (instrument rule 4) and against two
 * shapes it must NOT catch.
 */
describe('MUTATION: computed-expression-purity (IR-7)', () => {
	test('rejects an update expression, and upstream independently agrees', async () => {
		const mutant = mutate(s1, 'count.value * props.multiplier', 'count.value++ * props.multiplier');
		const violations = await violationsFor('generated/ComputedUpdateMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('computed-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'computed-expression-purity')?.message,
		).toContain('update expression');
		// TWO AUTHORITIES on one mutant. `vue/no-side-effects-in-computed-properties`
		// is the Vue team's own rule and reaches the same verdict by a mechanism this
		// repo did not write - which is what makes the frameless-owned guard
		// something other than the emitter agreeing with itself.
		expect(violations.map((entry) => entry.policy)).toContain(
			'eslint:vue/no-side-effects-in-computed-properties',
		);
	});

	test('rejects an assignment inside computed()', async () => {
		const mutant = mutate(
			s1,
			'count.value * props.multiplier',
			'(count.value = 2) * props.multiplier',
		);
		const violations = await violationsFor('generated/ComputedAssignMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('computed-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'computed-expression-purity')?.message,
		).toContain('assignment');
	});

	test('rejects a known-mutating method call inside computed()', async () => {
		const mutant = mutate(
			s2,
			'todos.value.filter((todo) => todo.done)',
			'todos.value.sort()',
		);
		const violations = await violationsFor('generated/ComputedSortMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('computed-expression-purity');
		expect(
			violations.find((entry) => entry.policy === 'computed-expression-purity')?.message,
		).toContain('.sort()');
	});

	test('rejects a delete expression inside computed()', async () => {
		const mutant = mutate(s1, '${prefix}${count', '${delete globalThis.x}${count');
		expect(await policiesFor('generated/ComputedDeleteMutant.vue', mutant)).toContain(
			'computed-expression-purity',
		);
	});

	test('ANTI-VACUITY: a non-mutating call and a mutation OUTSIDE computed() are accepted', async () => {
		// S2's own computed is `todos.value.filter(...).length`. If this policy were
		// "reject any call" the clean corpus would already be red, and every row
		// above would be measuring nothing.
		expect(s2).toContain('computed(() => todos.value.filter((todo) => todo.done).length)');
		expect(await policiesFor('generated/S2.vue', s2)).not.toContain(
			'computed-expression-purity',
		);
		// S2's TEMPLATE handlers assign to `todos` and call `.slice()`/`.concat()`
		// all over, and the policy reads computed() ancestry in the SCRIPT, not text.
		expect(s2).toContain('todos = todos.concat(item);');
		const handlerMutant = mutateAll(s2, "draft = '';", "draft = ''; next = next + 1;");
		expect(await policiesFor('generated/HandlerMutant.vue', handlerMutant)).not.toContain(
			'computed-expression-purity',
		);
	});

	test('states what it cannot see, so a pass is never read as a purity proof', async () => {
		// NOT a policy failure - a DOCUMENTED blind spot, pinned so that closing it
		// later is a deliberate change rather than an accident. `computed(() => f())`
		// is accepted no matter what `f` does, because the walk never leaves the
		// getter.
		const source = [
			'<!-- @generated by @frameless/vue from Blind; do not edit. -->',
			'<script setup>',
			"\timport { computed, ref } from 'vue';",
			'\tconst count = ref(1);',
			'\tfunction impure() {',
			'\t\tcount.value += 1;',
			'\t\treturn count.value;',
			'\t}',
			'\tconst derived = computed(() => impure());',
			'</script>',
			'',
			'<template>',
			'\t<p>{{ derived }}</p>',
			'</template>',
		].join('\n');
		expect(await policiesFor('generated/Blind.vue', source)).not.toContain(
			'computed-expression-purity',
		);
	});
});

/**
 * THE BASELINE FORM INVENTORY.
 *
 * `frameless-vue-v1` T002 ruling 5 deferred IR-4 and left the emitter idiom
 * policy's version corollary intact, and this emitter discharges the corollary's
 * second conjunct the OTHER way: by emitting only baseline-version-safe forms.
 * The policy's own baseline-form-inventory section names Vue as inheriting that
 * obligation, and records that the Svelte lane's version of this claim was
 * already false-by-drift once before anything asserted it.
 *
 * The order of the rows below is deliberate: the anti-vacuity row comes first,
 * because an allowlist whose walk observes nothing accepts everything and every
 * red row after it would be measuring the mutant rather than the policy.
 */
describe('MUTATION: baseline-form-inventory (IR-4)', () => {
	test('ANTI-VACUITY: the observed form set of the shipped corpus is pinned exactly', () => {
		// If the walk stopped descending, or a whole observer silently returned
		// nothing, the inventory would still be green on every mutant below - it
		// would just have stopped looking. This is the row that catches that, and it
		// is also the freshness pin: a new form appearing in emitted output is a red
		// test here before it is anything else.
		const blocks = [
			{ kind: 'sfc-block', form: 'script[setup]' },
			{ kind: 'sfc-block', form: 'template' },
		];
		const nodes = [
			'ATTRIBUTE',
			'DIRECTIVE',
			'ELEMENT',
			'INTERPOLATION',
			'ROOT',
			'SIMPLE_EXPRESSION',
			'TEXT',
		].map((form) => ({ kind: 'template-node', form }));
		expect(collectEmittedForms(s1)).toEqual([
			{ kind: 'directive', form: '@' },
			{ kind: 'directive', form: 'v-else' },
			{ kind: 'directive', form: 'v-if' },
			{ kind: 'import', form: 'vue#computed' },
			{ kind: 'import', form: 'vue#ref' },
			{ kind: 'macro', form: 'defineProps' },
			...blocks,
			...nodes,
		]);
		expect(collectEmittedForms(s2)).toEqual([
			{ kind: 'directive', form: ':' },
			{ kind: 'directive', form: '@' },
			{ kind: 'directive', form: 'v-for' },
			{ kind: 'directive', form: 'v-if' },
			{ kind: 'import', form: 'vue#computed' },
			{ kind: 'import', form: 'vue#ref' },
			{ kind: 'macro', form: 'defineProps' },
			...blocks,
			...nodes,
		]);
		expect(collectEmittedForms(s3)).toEqual([
			{ kind: 'directive', form: ':' },
			{ kind: 'directive', form: '@' },
			{ kind: 'import', form: 'vue#ref' },
			{ kind: 'macro', form: 'defineProps' },
			...blocks,
			...nodes,
		]);
		// And every observed form is on the inventory, which is the same claim the
		// clean-corpus row makes from the other side.
		const listed = new Set(
			BASELINE_FORM_INVENTORY.map((entry) => `${entry.kind}:${entry.form}`),
		);
		for (const source of [s1, s2, s3])
			for (const observed of collectEmittedForms(source))
				expect(listed).toContain(`${observed.kind}:${observed.form}`);
	});

	test('rejects a directive above the baseline surface: v-html', async () => {
		const mutant = mutate(s1, '>{{ derived }}<', ' v-html="derived"><');
		const violations = await violationsFor('generated/VHtmlMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('v-html');
	});

	test('rejects a runtime import the emitter has no ruling for', async () => {
		const mutant = mutate(
			s1,
			"import { computed, ref } from 'vue';",
			"import { computed, ref, watchEffect } from 'vue';",
		);
		const violations = await violationsFor('generated/ImportMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('vue#watchEffect');
	});

	test('rejects a compiler macro above the 3.2 baseline: defineOptions is 3.3', async () => {
		const mutant = mutate(
			s1,
			"const props = defineProps(",
			"defineOptions({ name: 'RenderOnce' });\n\tconst props = defineProps(",
		);
		const violations = await violationsFor('generated/MacroMutant.vue', mutant);
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('defineOptions');
	});

	test('rejects an SFC block the emitter never decided to emit', async () => {
		const style = `${s1}\n<style>\np { color: red; }\n</style>\n`;
		expect(style).not.toBe(s1);
		const violations = await violationsFor('generated/StyleMutant.vue', style);
		expect(violations.map((entry) => entry.policy)).toContain('baseline-form-inventory');
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('style');
	});

	test('rejects a spelling as a distinct FORM, not as the directive it resolves to', async () => {
		// `:key` and `v-bind:key` are the SAME directive to Vue's parser - `name` is
		// `bind` for both, normalised inside `ondirname` at parse time. They are not
		// the same form here, because choosing between them is exactly the
		// emission-site decision worked example 2a rules, and `rawName` is what keeps
		// them apart. Since T006 adopted the shorthand it is the LONGHAND that is
		// off-inventory.
		const reverted = mutate(s2, ':key="todo.id"', 'v-bind:key="todo.id"');
		expect(
			(await violationsFor('generated/LonghandFormMutant.vue', reverted)).find(
				(entry) => entry.policy === 'baseline-form-inventory',
			)?.message,
		).toContain('"v-bind"');
		// And the `.prop` shorthand, which resolves to `bind` just as `:` does, is a
		// third form again - so the inventory is keyed on the spelling and not on
		// what the spelling means.
		const prop = mutate(s3, ':checked="checked"', '.checked="checked"');
		expect(
			(await violationsFor('generated/PropFormMutant.vue', prop)).find(
				(entry) => entry.policy === 'baseline-form-inventory',
			)?.message,
		).toContain('"."');
	});

	test('every recorded floor is a claim with an evidence status attached to it', async () => {
		expect(BASELINE_FORM_INVENTORY.length).toBeGreaterThan(0);
		for (const entry of BASELINE_FORM_INVENTORY) {
			expect(entry.floor, `${entry.kind}:${entry.form}`).toMatch(/^\d+\.\d+/);
			if (entry.evidence.status === 'unverified') {
				// The REASON is the deliverable. "unverified" with no reason is a guess
				// wearing an honest label.
				expect(entry.evidence.reason.length, `${entry.kind}:${entry.form}`).toBeGreaterThan(
					40,
				);
				continue;
			}
			await expect(
				citationHolds(entry.evidence),
				`${entry.kind}:${entry.form} cites ${entry.evidence.file}`,
			).resolves.toBe(true);
		}
	});

	/**
	 * WHY EVERY VUE FLOOR READS `unverified`, asserted rather than asserted-about.
	 *
	 * The Svelte lane could at least point at `@since 5.20.0` on `$props.id` to
	 * show what a verified floor would look like. The resolved `vue` package
	 * carries no such tag anywhere and ships no changelog, so there is nothing on
	 * disk in this repo that dates any of these forms. That is a measurable claim,
	 * and this measures it.
	 */
	test('MEASURED: the resolved vue package dates nothing, which is why no floor is verified', async () => {
		for (const file of ['dist/vue.d.ts', 'dist/vue.d.mts']) {
			const text = await readFile(resolve(vuePackageRoot, file), 'utf8');
			expect(text, `${file} unexpectedly carries an @since tag`).not.toContain('@since');
		}
		await expect(readFile(resolve(vuePackageRoot, 'CHANGELOG.md'), 'utf8')).rejects.toThrow();
		expect(
			BASELINE_FORM_INVENTORY.every((entry) => entry.evidence.status === 'unverified'),
			'if this fails a floor was verified - good; delete this line and keep the loop above',
		).toBe(true);
	});

	test('CALIBRATION: the citation checker is re-read, and can pass, fail and throw', async () => {
		// EVERY entry is `unverified` today, so the loop above never enters its
		// verified branch and would be vacuous on its own. This plants all three
		// outcomes against the real resolved package.
		await expect(citationHolds({ file: 'package.json', needle: '"name": "vue"' })).resolves.toBe(
			true,
		);
		await expect(
			citationHolds({ file: 'package.json', needle: '"name": "not-vue-at-all"' }),
		).resolves.toBe(false);
		await expect(
			citationHolds({ file: 'dist/there-is-no-such-file.d.ts', needle: 'x' }),
		).rejects.toThrow();
	});
});

/**
 * THE THIRD-PARTY ARBITER: eslint-plugin-vue via vue-eslint-parser.
 *
 * Every policy above encodes what THIS REPO decided. These encode what the Vue
 * team decided, and the whole point is that nobody here got a vote.
 *
 * TWO-SIDED BY CONSTRUCTION. The green side is the shipped corpus drawing ZERO
 * messages from all applied rules; the red side is planted violations asserted by
 * RULE ID and by the upstream MESSAGE TEXT rather than by "some violation
 * appeared". A gate that has only ever been green is not evidence, and a gate
 * that cannot be shown to go red is not a gate.
 */
describe('third-party arbiter: eslint-plugin-vue', () => {
	test('GREEN SIDE: the shipped corpus draws no message from any applied rule', async () => {
		for (const [name, source] of [
			['S1', s1],
			['S2', s2],
			['S3', s3],
		] as const)
			expect(
				await eslintMessagesFor(`generated/${name}.vue`, source),
				`${name} drew an upstream message`,
			).toEqual([]);
		// ANTI-VACUITY for the green side itself: an arbiter wired to nothing is
		// also green. The applied set is non-trivial and the omissions are named.
		expect(VUE_ESLINT_RULES_APPLIED.length).toBeGreaterThan(70);
		expect(VUE_ESLINT_RULES_APPLIED).toContain('vue/require-v-for-key');
		expect(VUE_ESLINT_RULES_APPLIED).toContain('vue/no-side-effects-in-computed-properties');
	});

	/**
	 * THE ROW THAT EARNS THE ARBITER ITS KEEP.
	 *
	 * An unkeyed `v-for` compiles with an EMPTY diagnostic set, so
	 * `compileDiagnostics()` - the Gate 1 oracle this lane already had - cannot see
	 * it. No frameless policy sees it either: nothing above reads directive
	 * arguments. And it is WRONG, not stylistic - Vue reconciles an unkeyed list by
	 * index, so removing or reordering a todo re-associates the surviving DOM with
	 * the wrong item. S2's IR carries `todo.id` the entire time.
	 *
	 * That is exactly the "compiles clean and is WRONG" class, the Vue twin of
	 * `svelte/require-each-key` and of defect 1's `no-async-prevent-default`.
	 */
	test('RED: vue/require-v-for-key catches an unkeyed v-for that compiles clean', async () => {
		const mutant = mutate(s2, ' :key="todo.id"', '');
		expect(compileDiagnostics(mutant, 'S2.vue')).toEqual([]);
		expect(await eslintMessagesFor('generated/VForKeyMutant.vue', mutant)).toEqual([
			{
				policy: 'eslint:vue/require-v-for-key',
				message: "Elements in iteration expect to have 'v-bind:key' directives.",
			},
		]);
		// The other side of the claim: NOTHING ELSE in this gate objects. Without the
		// arbiter this mutant ships.
		expect(await policiesFor('generated/VForKeyMutant.vue', mutant)).toEqual([
			'eslint:vue/require-v-for-key',
		]);
	});

	test('RED: vue/no-parsing-error reaches the report rather than silence', async () => {
		const mutant = mutate(s1, '{{ derived }}', '{{ derived( }}');
		const violations = await violationsFor('generated/ParseMutant.vue', mutant);
		const parse = violations.find((entry) => entry.policy === 'eslint:vue/no-parsing-error');
		expect(parse?.message).toMatch(/Parsing error/);
		expect(parse?.dossierRef).toBe('frameless-vue-v1 T003 lint arbiter');
	});

	test('emitted text cannot silence the arbiter that is judging it', async () => {
		// Two vehicles, both refused. ESLint's own inline config is off
		// (allowInlineConfig: false), and vue/comment-directive - the plugin's
		// separate markup implementation of the same thing, which allowInlineConfig
		// does NOT reach - is in the omission list. A gate over GENERATED output
		// whose verdict the generator can turn off is not a gate.
		const mutant = mutate(s2, ' :key="todo.id"', '');
		for (const suppression of [
			'<!-- eslint-disable vue/require-v-for-key -->',
			'<!-- eslint-disable -->',
		]) {
			const suppressed = mutate(mutant, '<template>\n', `<template>\n\t${suppression}\n`);
			expect(
				(await eslintMessagesFor('generated/SuppressedMutant.vue', suppressed)).map(
					(entry) => entry.policy,
				),
				suppression,
			).toContain('eslint:vue/require-v-for-key');
		}
	});

	test('records every omitted rule explicitly, with a reason', () => {
		expect(VUE_ESLINT_RULES_OMITTED.map((entry) => entry.rule)).toEqual([
			'vue/comment-directive',
			'vue/multi-word-component-names',
		]);
		for (const entry of VUE_ESLINT_RULES_OMITTED) {
			expect(entry.reason.length, entry.rule).toBeGreaterThan(80);
			expect(VUE_ESLINT_RULES_APPLIED, entry.rule).not.toContain(entry.rule);
		}
		// The applied set is READ OFF the tier config rather than transcribed, so a
		// rule upstream adds arrives here automatically - and a rule that vanishes
		// turns this red rather than passing unnoticed.
		expect([
			...VUE_ESLINT_RULES_APPLIED,
			...VUE_ESLINT_RULES_OMITTED.map((entry) => entry.rule),
		]).toHaveLength(85);
	});

	/**
	 * THE TIER EXCLUSION, RE-MEASURED rather than asserted.
	 *
	 * eslint-plugin-vue's upper tiers are substantially a FORMATTER, which is the
	 * sharpest difference between this gate and eslint-plugin-svelte's. That is a
	 * real judgement and it deserves a standing check, not a paragraph: this row
	 * lints the shipped corpus with each excluded tier and pins the exact rule ids
	 * that fire. If a later eslint-plugin-vue moves a CORRECTNESS rule into one of
	 * them, the set changes and this goes red instead of the rule disappearing.
	 */
	test('MEASURED: the excluded tiers report exactly the recorded rule ids', async () => {
		for (const tier of VUE_ESLINT_TIERS_EXCLUDED) {
			const eslint = new ESLint({
				cwd: packageRoot,
				overrideConfigFile: true,
				allowInlineConfig: false,
				overrideConfig: [
					...((vuePlugin as unknown as { configs: Record<string, unknown[]> }).configs[
						tier.tier
					] as never[]),
					{
						files: ['**/*.vue'],
						// The applied tier's own omissions, so this measures what the
						// EXCLUDED tier adds rather than re-reporting a decision already
						// recorded one list up.
						rules: Object.fromEntries(
							VUE_ESLINT_RULES_OMITTED.map((entry) => [entry.rule, 'off']),
						),
					} as never,
				],
			});
			const fired = new Set<string>();
			for (const [name, source] of [
				['S1', s1],
				['S2', s2],
				['S3', s3],
			] as const) {
				const [result] = await eslint.lintText(source, {
					filePath: resolve(packageRoot, `generated/${name}.vue`),
				});
				for (const message of result?.messages ?? []) fired.add(message.ruleId ?? 'parse');
			}
			expect([...fired].sort(), tier.tier).toEqual([...tier.firesOnCorpus]);
			expect(tier.reason.length, tier.tier).toBeGreaterThan(200);
		}
		// The two that decide the exclusion, named so the reason cannot quietly
		// become "we did not like the noise". BOTH would break the observable: under
		// whitespace:'condense' they turn <button>increment</button> into
		// <button> increment </button>, which is the text the e2e lane asserts equal
		// across six frameworks.
		const strongly = VUE_ESLINT_TIERS_EXCLUDED[0]!;
		expect(strongly.firesOnCorpus).toContain('vue/singleline-html-element-content-newline');
		expect(strongly.firesOnCorpus).toContain('vue/multiline-html-element-content-newline');
		// AND THE TWO THAT NO LONGER FIRE, asserted as an absence rather than left to
		// be inferred from a list. vue/v-on-style and vue/v-bind-style demand the @
		// and : shorthands and reported against the shipped LONGHAND until worked
		// example 2a ruled them sugar and T006 adopted them. The exclusion stands on
		// the six rules above; these two passing is not a reason to adopt the tier,
		// and this row is what stops that inference from being made silently.
		for (const tier of VUE_ESLINT_TIERS_EXCLUDED) {
			expect(tier.firesOnCorpus, tier.tier).not.toContain('vue/v-on-style');
			expect(tier.firesOnCorpus, tier.tier).not.toContain('vue/v-bind-style');
		}
		// CALIBRATION for that absence: both rules are still SHIPPED by the tier and
		// are still capable of firing - they are satisfied, not missing. A reverted
		// spelling brings them straight back, which is what makes the absence a
		// measurement rather than an upstream removal nobody noticed.
		const reverted = mutate(s2, ':key="todo.id"', 'v-bind:key="todo.id"');
		const stronglyEslint = new ESLint({
			cwd: packageRoot,
			overrideConfigFile: true,
			allowInlineConfig: false,
			overrideConfig: [
				...((vuePlugin as unknown as { configs: Record<string, unknown[]> }).configs[
					'flat/strongly-recommended'
				] as never[]),
			],
		});
		const [result] = await stronglyEslint.lintText(reverted, {
			filePath: resolve(packageRoot, 'generated/S2.vue'),
		});
		expect((result?.messages ?? []).map((message) => message.ruleId)).toContain(
			'vue/v-bind-style',
		);
	});
});
