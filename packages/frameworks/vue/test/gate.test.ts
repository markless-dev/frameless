import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { babelParse, parse } from '@vue/compiler-sfc';
import { ESLint } from 'eslint';
import vuePlugin from 'eslint-plugin-vue';
import type { EnrichedIR } from '@frameless/compiler';
import { basename, dirname, resolve } from 'pathe';
import { beforeAll, describe, expect, test } from 'vitest';
import { compileDiagnostics, emit } from '../src/emitter/index.ts';
import { isUnbuiltEmitted } from './unbuilt-scenarios.ts';
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
 * THE SCENARIO INVENTORY IS DERIVED, NOT RE-LITERALLED.
 *
 * This list was `['generated/S1.vue', 'generated/S2.vue', 'generated/S3.vue']`
 * until S4 landed, and the hand-edit it then demanded was not free: the
 * inventory is the FIRST statement of the gate test below, so the whole run
 * aborted there and the emitted S4 file never reached `checkGeneratedFiles()`,
 * `eslint-plugin-vue`, or any policy. A literal that must be edited once per
 * scenario is the same defect one scenario later, and four more scenarios are
 * queued.
 *
 * The derivation source is the compiler's ratified golden corpus - `s<n>-*.json`
 * - which is INDEPENDENT of `generated/`: one is the IR this repo agreed to
 * compile, the other is what the emitter actually wrote. Comparing them is a
 * real cross-check rather than a restatement, and it is two-sidedly fail-closed:
 * an emitter that stops writing a scenario goes red, and a stray extra file in
 * `generated/` goes red too. `CALIBRATION: the derived inventory...` below
 * watches both directions happen.
 */
function scenarioGoldens(goldenRoot: string): Array<{ digits: string; file: string }> {
	const found = readdirSync(goldenRoot)
		.map((entry) => ({ entry, digits: /^s(\d+)-[\w-]+\.json$/.exec(entry)?.[1] }))
		.filter((match): match is { entry: string; digits: string } => match.digits !== undefined)
		.map((match) => ({ digits: match.digits, file: match.entry }))
		// THE SUBTRACTION, declared once in ./unbuilt-scenarios.ts, and it belongs
		// HERE rather than only in `scenarioCorpus` because BOTH worked-example
		// censuses below are censuses of what THIS LANE SHIPS. 12a walks the emitted
		// templates and would try to read an `S<n>.vue` this emitter never wrote;
		// 12b counts PRINTED prop entries, and a golden this lane refuses prints
		// none. Subtracting here is why the fourteenth scenario re-argues the census
		// to the SAME figures rather than renumbering them - see the note in
		// src/gate/index.ts worked example 12a.
		.filter((match) => !isUnbuiltEmitted(`S${match.digits}.vue`))
		.sort((left, right) => Number(left.digits) - Number(right.digits));
	// Fail LOUD rather than returning []. An empty derivation would make the
	// inventory assertion agree with an empty `generated/` directory, which is the
	// one way a derived list could be greener than the literal it replaced.
	if (found.length === 0) throw new Error(`no s<n>-*.json scenario goldens found in ${goldenRoot}`);
	return found;
}

function scenarioCorpus(extension: string, directory = 'generated'): string[] {
	return scenarioGoldens(compilerGoldenRoot)
		.map(({ digits }) => `${directory}/S${digits}.${extension}`)
		.sort();
}

/**
 * THE COUNTS THE `no-two-way-binding` MESSAGES SPELL OUT ARE DERIVED TOO - the
 * same doctrine as `scenarioCorpus` above, restated here because the doctrine
 * did not hold the first time it was applied to these two numbers.
 *
 * `frameless-vue-v1` T010 re-enumerated both domains over the then-current
 * corpus, which was the right thing to do, and then folded the results in as
 * STRING LITERALS: `toContain('FIVE shipped instances and the sugar applies to
 * ONE')` and `toContain('FIFTEEN printed entries')`. Those are string
 * containment against a CONSTANT message. They are green whatever the corpus
 * does, so the shipped violation message - read at the exact moment someone
 * decides whether to trust the rule - was free to state a false MEASURED count.
 *
 * S7 (full form controls) landed one commit later and did exactly that. S7 is
 * 12a's domain definition verbatim, and it moved BOTH figures - five to EIGHT
 * shipped instances, fifteen to SEVENTEEN printed entries - while both
 * assertions stayed green. Commit `1bb0552` had removed thirteen literals of
 * this class repo-wide six commits earlier.
 *
 * So both numbers are now DERIVED from the corpus and the shipped message is
 * asserted to SPELL THE DERIVED VALUE. Two properties are deliberate:
 * - the message still STATES its counts. Softening it to "several instances"
 *   would delete the claim instead of checking it, and the claim is the reason
 *   a reader can audit the ruling at all.
 * - the derivations THROW on an empty domain. A derivation that cannot fail is
 *   the defect it replaces, which is why the `CALIBRATION` row below drives the
 *   real shipped message against a planted tenth scenario and asserts it goes
 *   RED.
 */
const SPELLED_NUMBERS = [
	'ZERO',
	'ONE',
	'TWO',
	'THREE',
	'FOUR',
	'FIVE',
	'SIX',
	'SEVEN',
	'EIGHT',
	'NINE',
	'TEN',
	'ELEVEN',
	'TWELVE',
	'THIRTEEN',
	'FOURTEEN',
	'FIFTEEN',
	'SIXTEEN',
	'SEVENTEEN',
	'EIGHTEEN',
	'NINETEEN',
	'TWENTY',
	'TWENTY-ONE',
	'TWENTY-TWO',
	'TWENTY-THREE',
	'TWENTY-FOUR',
	'TWENTY-FIVE',
	'TWENTY-SIX',
	'TWENTY-SEVEN',
] as const;

/**
 * The shipped messages spell their counts as words, so the derivation has to
 * spell too. Out of range THROWS rather than falling back to digits: a silent
 * `String(count)` would make the assertion unsatisfiable against a message that
 * spells, which reads as "the gate message is wrong" when the truth is "this
 * table is short". Extend the table; do not soften the message.
 */
function spelled(count: number): string {
	const word = SPELLED_NUMBERS[count];
	if (word === undefined)
		throw new Error(
			`no spelled form for ${count}: SPELLED_NUMBERS stops at ${SPELLED_NUMBERS.length - 1}. ` +
				'The shipped no-two-way-binding messages spell their counts, so extend this table ' +
				'rather than softening the message.',
		);
	return word;
}

type CorpusRoots = {
	/** Directory holding `s<n>-*.json` compiler goldens. */
	readonly goldenRoot: string;
	/** Directory holding the emitted `S<n>.vue` files. */
	readonly generatedRoot: string;
};

const SHIPPED_CORPUS: CorpusRoots = {
	goldenRoot: compilerGoldenRoot,
	generatedRoot: resolve(packageRoot, 'generated'),
};

/** Vue's own AST nodes, read the way `src/gate/index.ts` reads them. */
type VueNode = Record<string, any>;

function walkTemplate(node: VueNode | null | undefined, visit: (node: VueNode) => void): void {
	if (!node) return;
	visit(node);
	for (const child of (node.children ?? []) as VueNode[]) walkTemplate(child, visit);
}

/**
 * "The sugar applies to ONE" is a claim about HANDLER SHAPE, so it is decided on
 * the handler's AST and not by a substring. `v-model` generates
 * `$event => ((x) = $event)` and nothing else; a handler is inside the sugar's
 * reach only when it is exactly an arrow whose whole body is an assignment of
 * its own event parameter's `currentTarget.value` / `.checked`. Anything that
 * destructures, re-slices, or calls `props.onTrace(...)` does strictly more, and
 * `onTrace` is the e2e oracle's observation channel.
 */
function isVModelShapedHandler(expression: string): boolean {
	const program = babelParse(`(${expression})`, { sourceType: 'module' }).program as VueNode;
	const arrow = (program.body as VueNode[])[0]?.expression as VueNode | undefined;
	if (arrow?.type !== 'ArrowFunctionExpression') return false;
	const params = arrow.params as VueNode[];
	if (params.length !== 1 || params[0]?.type !== 'Identifier') return false;
	const body = arrow.body as VueNode;
	if (body.type !== 'AssignmentExpression' || body.operator !== '=') return false;
	const right = body.right as VueNode;
	return (
		right.type === 'MemberExpression' &&
		right.object?.type === 'MemberExpression' &&
		right.object.object?.type === 'Identifier' &&
		right.object.object.name === params[0].name &&
		right.object.property?.name === 'currentTarget' &&
		(right.property?.name === 'value' || right.property?.name === 'checked')
	);
}

type TwoWayHost = {
	readonly file: string;
	readonly line: number;
	readonly binding: string;
	readonly handler: string;
};

/**
 * WORKED EXAMPLE 12a'S DOMAIN, derived from the emitted templates rather than
 * restated: every host the emitter prints that carries a `value` / `checked`
 * bind directive together with a same-host `on` directive. That is the policy
 * entry's own definition, walked with Vue's own parser.
 */
function deriveTwoWayHostDomain(roots: CorpusRoots = SHIPPED_CORPUS): {
	readonly instances: readonly TwoWayHost[];
	readonly applicable: readonly TwoWayHost[];
} {
	const instances: TwoWayHost[] = [];
	const applicable: TwoWayHost[] = [];
	for (const { digits } of scenarioGoldens(roots.goldenRoot)) {
		const file = `S${digits}.vue`;
		const { descriptor, errors } = parse(readFileSync(resolve(roots.generatedRoot, file), 'utf8'), {
			filename: file,
		});
		if (errors.length > 0)
			throw new Error(
				`@vue/compiler-sfc reported ${errors.length} parse error(s) in ${file}; worked ` +
					'example 12a’s domain cannot be derived from a template that does not parse',
			);
		walkTemplate((descriptor.template?.ast ?? null) as VueNode | null, (node) => {
			if (node.type !== 1) return;
			const props = (node.props ?? []) as VueNode[];
			const bind = props.find(
				(prop) =>
					prop.type === 7 &&
					prop.name === 'bind' &&
					(prop.arg?.content === 'value' || prop.arg?.content === 'checked'),
			);
			const on = props.find((prop) => prop.type === 7 && prop.name === 'on');
			if (!bind || !on) return;
			const host: TwoWayHost = {
				file,
				line: Number(node.loc?.start?.line ?? 0),
				binding: String(bind.arg.content),
				handler: String(on.exp?.content ?? ''),
			};
			instances.push(host);
			if (isVModelShapedHandler(host.handler)) applicable.push(host);
		});
	}
	// Fail LOUD rather than returning []. An empty domain would agree with every
	// spelled count at once and is exactly the shape the literal it replaced had.
	if (instances.length === 0)
		throw new Error(
			`worked example 12a’s domain derived EMPTY over ${roots.generatedRoot}: no emitted ` +
				'host carries a value/checked bind plus a same-host event directive',
		);
	return { instances, applicable };
}

/**
 * WORKED EXAMPLE 12b'S DOMAIN: every `PropDestructuringEntry` in
 * `component.props.entries` that `propsDeclaration()` prints as a string literal
 * into `defineProps([...])`. Read off the COMPILER goldens, which is the same
 * cross-check `scenarioCorpus` makes - the IR this repo agreed to compile, not
 * the file the emitter happened to write.
 */
function derivePrintedPropEntries(roots: CorpusRoots = SHIPPED_CORPUS): {
	readonly entries: number;
	readonly distinctNames: number;
} {
	let entries = 0;
	const names = new Set<string>();
	for (const { file } of scenarioGoldens(roots.goldenRoot)) {
		const ir = JSON.parse(readFileSync(resolve(roots.goldenRoot, file), 'utf8')) as {
			components: ReadonlyArray<{ props: { entries: ReadonlyArray<{ path: string[] }> } }>;
		};
		for (const component of ir.components)
			for (const entry of component.props.entries) {
				entries += 1;
				// `propsDeclaration()` prints `entry.path[0]` and throws on a longer
				// path, so the printed identity is the first segment.
				names.add(entry.path[0]!);
			}
	}
	if (entries === 0)
		throw new Error(
			`worked example 12b’s domain derived EMPTY over ${roots.goldenRoot}: no golden ` +
				'component declares a prop entry',
		);
	return { entries, distinctNames: names.size };
}

/**
 * The 12a figures the SHIPPED template message states, checked against the
 * derivation. Ordered headline-first so a corpus change reports as "the instance
 * count moved" rather than as "the scenario count moved", which is the fact a
 * reader of the failure needs.
 */
function expectTemplateDomainFigures(message: string, roots: CorpusRoots = SHIPPED_CORPUS): void {
	const { instances, applicable } = deriveTwoWayHostDomain(roots);
	expect(message).toContain(
		`${spelled(instances.length)} shipped instances and the sugar applies to ` +
			`${spelled(applicable.length)}`,
	);
	expect(message).toContain(
		`the other ${spelled(instances.length - applicable.length).toLowerCase()} handlers`,
	);
	// The message says WHY the others are outside the sugar's reach. That reason
	// is a corpus fact too, and it goes stale the same way the count does.
	const outside = instances.filter((host) => !applicable.includes(host));
	expect(outside.filter((host) => host.handler.includes('onTrace('))).toHaveLength(outside.length);
	expect(message).toContain(`${spelled(scenarioGoldens(roots.goldenRoot).length).toLowerCase()}-scenario corpus`);
}

/** The 12b figures the SHIPPED `defineModel` message states. */
function expectPrintedPropFigures(message: string, roots: CorpusRoots = SHIPPED_CORPUS): void {
	const { entries, distinctNames } = derivePrintedPropEntries(roots);
	expect(message).toContain(
		`${spelled(entries)} printed entries spanning ${spelled(distinctNames).toLowerCase()} ` +
			'distinct prop names',
	);
	expect(message).toContain(`${spelled(scenarioGoldens(roots.goldenRoot).length).toLowerCase()}-scenario corpus`);
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

/**
 * EVERY emitted scenario source, keyed by its `generated/…` path, loaded from
 * the derived inventory. The three named bindings below are kept because the
 * mutation rows are per-scenario by design and cite constructs only one
 * scenario ships; this map is what the WHOLE-CORPUS rows iterate, so a new
 * scenario joins them without an edit.
 */
const emittedSources = new Map<string, string>();
let s1 = '';
let s2 = '';
let s3 = '';
beforeAll(async () => {
	for (const file of scenarioCorpus('vue'))
		emittedSources.set(file, await readFile(resolve(packageRoot, file), 'utf8'));
	s1 = emittedSources.get('generated/S1.vue')!;
	s2 = emittedSources.get('generated/S2.vue')!;
	s3 = emittedSources.get('generated/S3.vue')!;
});

async function policiesFor(file: string, source: string): Promise<string[]> {
	return (await checkSources([{ file, source }])).violations.map((entry) => entry.policy);
}

async function violationsFor(file: string, source: string) {
	return (await checkSources([{ file, source }])).violations;
}

/**
 * The single `no-two-way-binding` message a mutant drew.
 *
 * The count is ASSERTED rather than assumed. `find()` over a list of two would
 * silently read the first and every row below would stop measuring the limb it
 * names - and this policy now has three limbs firing from two different files
 * (template directive, `defineModel`, `defineEmits`), so "which one answered"
 * is exactly the question these rows exist to settle.
 */
async function twoWayMessage(file: string, source: string): Promise<string> {
	const messages = (await violationsFor(file, source))
		.filter((entry) => entry.policy === 'no-two-way-binding')
		.map((entry) => entry.message);
	expect(messages, `expected exactly one no-two-way-binding violation in ${file}`).toHaveLength(
		1,
	);
	return messages[0]!;
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

	test('discovers and accepts the clean emitted scenario corpus', async () => {
		const corpus = scenarioCorpus('vue');
		expect(await discoverGeneratedFiles()).toEqual(corpus);
		const result = await checkGeneratedFiles();
		// The gate's OWN file list, asserted rather than assumed. `discoverGeneratedFiles`
		// and `checkGeneratedFiles` are separate entry points; a gate that discovered
		// four files and checked three would otherwise report [] violations and look
		// identical to a gate that checked all four.
		expect(result.files).toEqual(corpus);
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

	/**
	 * CALIBRATION for the DERIVED inventory. A derived list that nobody has
	 * watched go red is not an instrument - and the literal it replaced at least
	 * failed loudly when it drifted. Both directions are driven through the SAME
	 * `discoverGeneratedFiles()` the assertion above calls, against a throwaway
	 * root, so this measures the real comparison and not a lookalike.
	 */
	test('CALIBRATION: the derived inventory goes red on a missing and on an extra file', async () => {
		const corpus = scenarioCorpus('vue');
		// THE FLOOR. Every scenario ratified so far must still be in the derivation.
		// A lower bound, so S5 and later widen it with no edit here, while a golden
		// that silently disappeared is red.
		expect(corpus).toEqual(
			expect.arrayContaining([
				'generated/S1.vue',
				'generated/S2.vue',
				'generated/S3.vue',
				'generated/S4.vue',
			]),
		);
		const root = await realpath(await mkdtemp(resolve(tmpdir(), 'frameless-vue-inventory-')));
		try {
			await mkdir(resolve(root, 'generated'));
			const stub = '<!-- inventory calibration -->\n';
			for (const file of corpus.slice(0, -1)) await writeFile(resolve(root, file), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).not.toEqual(corpus);
			await writeFile(resolve(root, corpus.at(-1)!), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).toEqual(corpus);
			await writeFile(resolve(root, 'generated/S99.vue'), stub);
			expect(await discoverGeneratedFiles({ cwd: root })).not.toEqual(corpus);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
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

	test("MUTATION: rejects v-model on a host, on worked example 12a's OWN grounds", async () => {
		const model = mutate(s3, ':value="text"', 'v-model="text"');
		expect(await policiesFor('generated/ModelMutant.vue', model)).toContain(
			'no-two-way-binding',
		);
		// THE MESSAGE IS PINNED, not just the policy id - and until T010 it was NOT.
		// This row asserted the policy id alone while the defineEmits row below
		// pinned its message four ways, and the limb with no calibration was also
		// the limb whose message justified itself by citing worked example 3, WHICH
		// RULES A DIFFERENT MACRO. That is not a coincidence: an unpinned message is
		// one nobody has to justify. `frameless-vue-v1` T009 ran all six gates on
		// this form against vue@3.5.40; the four measured grounds are pinned here.
		const message = await twoWayMessage('generated/ModelMutant.vue', model);
		expect(message).toContain('Worked example 12a');
		// G5's four differences, one anchor each.
		expect(message).toContain('NEED_HYDRATION');
		expect(message).toContain('el.composing');
		expect(message).toContain('ssrLooseContain');
		// G4's re-enumerated domain, DERIVED. T009 counted over four goldens, T010
		// re-counted over six and then wrote the result back as a string literal,
		// and S7 - three more `:checked` + `@change` hosts - falsified it while that
		// literal stayed green. The figures the message spells are now read out of
		// the emitted templates; see `expectTemplateDomainFigures` and the
		// CALIBRATION row that drives this same message RED.
		expectTemplateDomainFigures(message);
		// THE BORROWED REASON, in the exact spelling it shipped in, must not return.
		expect(message).not.toMatch(/worked example 3 is already ruled DENIED at Gate 5/);
		// Nor may Gate 2 come back as the denier: the T002 dissent's Gate 2 mechanism
		// was imported from worked example 4, which is ANGULAR, and G2 PASSES here.
		expect(message).toContain('denied at Gate 2, which it PASSES');
	});

	test("MUTATION: rejects defineModel, on worked example 12b's OWN grounds", async () => {
		// THERE WAS NO defineModel ROW IN THIS FILE BEFORE T010. `defineModel` and
		// `defineEmits` shared one gate branch and one message, and that message was
		// entirely about `defineEmits`, so the macro this board's tranche actually
		// names was refused on another macro's reasoning and nothing measured it.
		const model = mutate(
			s3,
			"const props = defineProps(['initial', 'onTrace']);",
			"const props = defineProps(['initial', 'onTrace']);\n\tconst initial = defineModel('initial');",
		);
		expect(await policiesFor('generated/DefineModelMutant.vue', model)).toContain(
			'no-two-way-binding',
		);
		const message = await twoWayMessage('generated/DefineModelMutant.vue', model);
		expect(message).toContain('Worked example 12b');
		// G5's deciding measurement: the synthesized `<name>Modifiers` prop overwrites
		// a legal frameless prop of that name, with zero diagnostics.
		expect(message).toContain('mergeModels');
		expect(message).toContain('Modifiers');
		// G4's: the repair narrowing is not statable, because per-prop write-back has
		// no channel in the IR - one shared graph node, no writes. This is IR-1, and
		// the message has to say which gap it is or it is back to inherited prose.
		expect(message).toContain('prop:props');
		expect(message).toContain('writable=false');
		// The printed-entry count is DERIVED from the goldens, not literalled. S7
		// moved it fifteen -> seventeen while the literal this replaced stayed green.
		expectPrintedPropFigures(message);
		// DENIED, not DEFERRED, and IR-4 is not why.
		expect(message).toContain('FAIL outranks DEFERRED');
	});

	test('MUTATION: rejects defineEmits, which IR-1 and IR-2 do not support', async () => {
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

	/**
	 * CALIBRATION for the two DERIVED domain figures, and it is the whole reason
	 * the derivation is worth having.
	 *
	 * The literals it replaces were green against a corpus that had already
	 * falsified them, so "derived" is not self-evidently better - a derivation
	 * nobody has watched go red is the same instrument wearing a better name.
	 * This row plants a TENTH scenario into a throwaway corpus, drives the REAL
	 * shipped gate messages (not a lookalike) through the SAME assertion helpers
	 * the two rows above call, and asserts they fail.
	 *
	 * THE PLANT'S ORDINAL IS DERIVED, AND IT IS DERIVED BECAUSE HARDCODING IT
	 * FAILED TWICE. This row first planted an EIGHTH scenario; S8 landed and the
	 * comment was moved to S10 with the hazard written out - "a plant that reused
	 * its number would be COPIED OVER by the faithful-copy loop and counted twice,
	 * once per golden mapping to the same emitted file". Then `frameless-real-apps-v1`
	 * shipped a real S10 and the row hit THE EXACT HAZARD ITS OWN COMMENT NAMED:
	 * `s10-planted-calibration.json` joined the real `s10-todomvc.json`, both
	 * mapping to `generated/S10.vue`, whose bytes the plant had just overwritten -
	 * so the derivation counted 10 where it should have counted 13, and the row
	 * failed on its own scaffolding rather than on the thing it measures.
	 *
	 * Naming the next free number is the same defect with a bigger literal. The
	 * ordinal is now taken as one past the highest scenario the corpus actually
	 * holds, so the plant is UNOCCUPIED BY CONSTRUCTION and an eleventh scenario
	 * moves it without touching this file.
	 *
	 * The planted scenario is deliberately inside BOTH domains at once: a host
	 * with a `:value` bind and a same-host `@input` (12a) whose IR declares one
	 * more prop entry under a name no golden uses (12b).
	 */
	test('CALIBRATION: the derived domain figures go RED against a planted scenario', async () => {
		const shippedHosts = deriveTwoWayHostDomain();
		const shippedProps = derivePrintedPropEntries();
		const root = await realpath(await mkdtemp(resolve(tmpdir(), 'frameless-vue-domain-')));
		try {
			const goldenRoot = resolve(root, 'goldens');
			const generatedRoot = resolve(root, 'generated');
			await mkdir(goldenRoot);
			await mkdir(generatedRoot);
			for (const { file } of scenarioGoldens(compilerGoldenRoot))
				await copyFile(resolve(compilerGoldenRoot, file), resolve(goldenRoot, file));
			for (const file of scenarioCorpus('vue'))
				await copyFile(resolve(packageRoot, file), resolve(generatedRoot, basename(file)));
			const planted: CorpusRoots = { goldenRoot, generatedRoot };
			// PRECONDITION: the copy is a faithful one. Without this the row could
			// "go red" because the temp corpus was empty rather than because it grew.
			expect(deriveTwoWayHostDomain(planted).instances).toEqual(shippedHosts.instances);
			expect(derivePrintedPropEntries(planted)).toEqual(shippedProps);

			// ONE PAST THE HIGHEST SHIPPED ORDINAL, derived from the same
			// `scenarioGoldens` the assertions use. A literal here is what collided
			// with the real S10; see the header. The plant must occupy a slot the
			// corpus does not, or it overwrites a real emitted file and the row
			// measures its own scaffolding.
			// AND PAST ANY SUBTRACTED ORDINAL. `scenarioGoldens` now filters out the
			// scenarios this lane refuses, so "one past the highest it returns" can
			// land ON a subtracted slot - and the plant would then be filtered
			// straight back out, leaving the derivation unmoved and this calibration
			// asserting against its own scaffolding. Advance until the slot is one
			// the subtraction does not claim.
			let plantedDigits =
				Math.max(...scenarioGoldens(goldenRoot).map(({ digits }) => Number(digits))) + 1;
			while (isUnbuiltEmitted(`S${plantedDigits}.vue`)) plantedDigits += 1;
			// ANTI-COLLISION, ASSERTED RATHER THAN ASSUMED: neither the golden slot
			// nor the emitted file the plant is about to write may already exist.
			expect(scenarioGoldens(goldenRoot).map(({ digits }) => digits)).not.toContain(
				String(plantedDigits),
			);
			expect(existsSync(resolve(generatedRoot, `S${plantedDigits}.vue`))).toBe(false);
			await writeFile(
				resolve(goldenRoot, `s${plantedDigits}-planted-calibration.json`),
				JSON.stringify({
					components: [{ props: { entries: [{ path: ['plantedCalibrationProp'] }] } }],
				}),
			);
			await writeFile(
				resolve(generatedRoot, `S${plantedDigits}.vue`),
				'<template>\n' +
					'\t<input\n' +
					'\t\t:value="planted"\n' +
					'\t\t@input="(event) => {\n' +
					'\t\t\tplanted = event.currentTarget.value;\n' +
					"\t\t\tonTrace('planted', { planted }, event);\n" +
					'\t\t}"\n' +
					'\t>\n' +
					'</template>\n',
			);

			// The derivation MOVED - both domains, in the direction planted.
			expect(deriveTwoWayHostDomain(planted).instances).toHaveLength(
				shippedHosts.instances.length + 1,
			);
			expect(deriveTwoWayHostDomain(planted).applicable).toHaveLength(
				shippedHosts.applicable.length,
			);
			expect(derivePrintedPropEntries(planted)).toEqual({
				entries: shippedProps.entries + 1,
				distinctNames: shippedProps.distinctNames + 1,
			});

			// AND THE SHIPPED MESSAGES NOW FAIL. This is the assertion the literals
			// could not make: the message text is unchanged, the corpus moved, and
			// the check goes red.
			const templateMessage = await twoWayMessage(
				'generated/ModelMutant.vue',
				mutate(s3, ':value="text"', 'v-model="text"'),
			);
			// The regexes below are the DERIVED word plus its noun, and no longer:
			// vitest elides the middle of both operands in an assertion message, so a
			// longer pattern would fail to match the very failure it is asserting.
			expect(() => {
				expectTemplateDomainFigures(templateMessage, planted);
			}).toThrow(new RegExp(`${spelled(shippedHosts.instances.length + 1)} shipped instances`));
			const modelMessage = await twoWayMessage(
				'generated/DefineModelMutant.vue',
				mutate(
					s3,
					"const props = defineProps(['initial', 'onTrace']);",
					"const props = defineProps(['initial', 'onTrace']);\n\tconst initial = defineModel('initial');",
				),
			);
			expect(() => {
				expectPrintedPropFigures(modelMessage, planted);
			}).toThrow(new RegExp(`${spelled(shippedProps.entries + 1)} printed entries`));

			// AND THE DERIVATION ITSELF FAILS LOUD ON AN EMPTY DOMAIN, rather than
			// agreeing with every spelled count at once.
			const barren = resolve(root, 'barren');
			await mkdir(resolve(barren, 'generated'), { recursive: true });
			await copyFile(
				resolve(compilerGoldenRoot, scenarioGoldens(compilerGoldenRoot)[0]!.file),
				resolve(barren, basename(scenarioGoldens(compilerGoldenRoot)[0]!.file)),
			);
			await writeFile(
				resolve(barren, 'generated/S1.vue'),
				'<template>\n\t<p>no binding here</p>\n</template>\n',
			);
			expect(() =>
				deriveTwoWayHostDomain({
					goldenRoot: barren,
					generatedRoot: resolve(barren, 'generated'),
				}),
			).toThrow(/domain derived EMPTY/);
			expect(() => scenarioGoldens(resolve(root, 'generated'))).toThrow(
				/no s<n>-\*\.json scenario goldens found/,
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	/**
	 * TWO MACROS, TWO BRANCHES, TWO MESSAGES - asserted as EXCLUSIVITY rather than
	 * as one-sided negatives, and the difference is the whole calibration.
	 *
	 * A bare `expect(emitsMessage).not.toContain('mergeModels')` passes against the
	 * PRE-SPLIT strings too, because the shared message never mentioned
	 * `mergeModels` either - it is green before and after, which is the green
	 * vacuum this repo keeps paying for. Phrased as "`mergeModels` appears in
	 * EXACTLY the defineModel message", the same guard goes RED against the shared
	 * branch (it appeared in neither) and RED again if it ever leaks into the
	 * defineEmits message. Every assertion below was run against the pre-split gate
	 * and every one of them failed there.
	 */
	test('THE SPLIT: each no-two-way-binding limb carries its own grounds', async () => {
		const templateMessage = await twoWayMessage(
			'generated/ModelMutant.vue',
			mutate(s3, ':value="text"', 'v-model="text"'),
		);
		const modelMessage = await twoWayMessage(
			'generated/DefineModelMutant.vue',
			mutate(
				s3,
				"const props = defineProps(['initial', 'onTrace']);",
				"const props = defineProps(['initial', 'onTrace']);\n\tconst initial = defineModel('initial');",
			),
		);
		const emitsMessage = await twoWayMessage(
			'generated/EmitsMutant.vue',
			mutate(
				s3,
				"const props = defineProps(['initial', 'onTrace']);",
				"const props = defineProps(['initial', 'onTrace']);\n\tconst emit = defineEmits(['go']);",
			),
		);
		const all = [templateMessage, modelMessage, emitsMessage];
		// 12b's grounds reach the defineModel limb and NOTHING else.
		expect(all.filter((entry) => entry.includes('mergeModels'))).toEqual([modelMessage]);
		// Worked example 3's grounds reach the defineEmits limb and NOTHING else.
		// Pre-split BOTH macros received these, which is exactly the defect.
		expect(all.filter((entry) => entry.includes('onTraceOnce'))).toEqual([emitsMessage]);
		expect(all.filter((entry) => entry.includes('silent no-op'))).toEqual([emitsMessage]);
		// 12a's grounds reach the template limb and NOTHING else.
		expect(all.filter((entry) => entry.includes('NEED_HYDRATION'))).toEqual([templateMessage]);
		// And the GROUNDS themselves are three distinct texts, not one text wearing
		// three macro names. Pre-split this set had two members: strip the leading
		// `Emitted Vue source calls defineX();` and the model and emits limbs were
		// byte-identical. That is the assertion the other four exist to make legible.
		const groundsOf = (entry: string): string =>
			entry.replace(/^Emitted Vue source calls define\w+\(\)[.;] ?/, '');
		expect(new Set(all.map(groundsOf)).size).toBe(3);

		// CALIBRATION of `twoWayMessage`'s OWN precondition (instrument rule 4). Its
		// `toHaveLength(1)` is the only assertion in this fold that is green against
		// both the pre-split and post-split gate, so it is shown to be REACHABLE
		// rather than asserted to be sound: a source calling both macros draws TWO
		// violations and the helper refuses it instead of silently reading the first.
		const both = mutate(
			s3,
			"const props = defineProps(['initial', 'onTrace']);",
			"const props = defineProps(['initial', 'onTrace']);\n\tconst initial = defineModel('initial');\n\tconst emit = defineEmits(['go']);",
		);
		const bothViolations = (await violationsFor('generated/BothMacrosMutant.vue', both)).filter(
			(entry) => entry.policy === 'no-two-way-binding',
		);
		expect(bothViolations).toHaveLength(2);
		await expect(twoWayMessage('generated/BothMacrosMutant.vue', both)).rejects.toThrow(
			/expected exactly one no-two-way-binding violation/,
		);
	});

	/**
	 * RE-AIMED BY T010, AND THE RE-AIM IS THE POINT.
	 *
	 * This row read `rejects lang="ts", which is how a typed defineProps would
	 * arrive` and asserted `no-typed-props`. Both halves were wrong. `lang="ts"`
	 * is NOT how a typed `defineProps` arrives - MEASURED at 3.5.40, `lang="ts"`
	 * over untyped source compiles to the IDENTICAL `props: ['label', ...]`
	 * option as the no-lang baseline - and the policy that actually refuses the
	 * form is `baseline-form-inventory`, on IR-4 grounds that have nothing to do
	 * with prop types.
	 *
	 * So the mutant is kept and the ASSERTION is inverted: the lang form is still
	 * refused, by the policy that has a reason for it, and `no-typed-props` is
	 * pinned as SILENT on a file that contains no type. That negative is what
	 * makes the row a measurement rather than a restatement - it goes red the day
	 * anyone reinstates a lang-shaped trigger under this id.
	 *
	 * T009 (STEP 1.5) THEN FLIPPED WHICH SPELLING IS THE MUTANT, and left T010's
	 * finding standing underneath it. `lang="ts"` is now what the emitter SHIPS, so
	 * it can no longer be the mutant; `script[setup,lang=ts]` REPLACED the bare
	 * `script[setup]` row in the inventory, on the same "an allowlist must not
	 * permit a form nothing emits" reasoning worked example 2a used for the
	 * directive longhands. That replacement is precisely what gives a REVERT of the
	 * emitter its second independent detector, and this row is that detector: strip
	 * the attribute and `baseline-form-inventory` refuses the bare form.
	 *
	 * BOTH OF T010'S CLAIMS SURVIVE THE FLIP UNCHANGED - the policy with
	 * jurisdiction over the script-block form is the inventory, and `no-typed-props`
	 * stays SILENT on a file that contains no type. Only the direction moved.
	 */
	test('MUTATION: the script-block form is policed by baseline-form-inventory, NOT by no-typed-props', async () => {
		// The SHIPPED spelling carries the attribute, so the mutant is its ABSENCE.
		const mutant = mutate(s3, '<script setup lang="ts">', '<script setup>');
		const policies = await policiesFor('generated/NoLangMutant.vue', mutant);
		expect(policies).toContain('baseline-form-inventory');
		expect(policies).not.toContain('no-typed-props');
		// And the refusal names the form it actually saw, so a future reader is not
		// left inferring which of the two spellings was rejected.
		const violations = await violationsFor('generated/NoLangMutant.vue', mutant);
		expect(
			violations.find((entry) => entry.policy === 'baseline-form-inventory')?.message,
		).toContain('script[setup]');
	});

	/**
	 * THE ARM THAT CARRIES THE DENIAL NOW. `defineProps<{...}>()` is the form
	 * whose Gate 5 failure T010 measured, and it is refused on its own terms -
	 * with `lang="ts"` present, so the refusal cannot be mistaken for the lang
	 * trigger this file just retired.
	 *
	 * THE MESSAGE'S GROUNDS ARE ASSERTED, NOT JUST ITS ID. The withdrawn IR-8
	 * rationale is pinned ABSENT and the three measured runtime deltas pinned
	 * PRESENT, because "a correct verdict resting on a borrowed reason" is the
	 * exact defect this gate has now been repaired for three times, and an id-only
	 * assertion is blind to it.
	 */
	test('MUTATION: rejects defineProps<{...}>() on its MEASURED Gate 5 grounds, not on IR-8', async () => {
		// `lang="ts"` USED TO BE APPLIED HERE AS A SECOND MUTATION. Since Step 1.5 it
		// is what the emitter ships, so `s3` already carries it and only the type
		// argument is the mutant - which sharpens the row rather than weakening it:
		// the refusal is now measured against output that differs from the shipped
		// corpus in the TYPE ALONE.
		const mutant = mutate(
			s3,
			"const props = defineProps(['initial', 'onTrace']);",
			'const props = defineProps<{ initial: number; onTrace: (phase: string) => void }>();',
		);
		const typed = (await violationsFor('generated/TypeArgMutant.vue', mutant)).filter(
			(entry) => entry.policy === 'no-typed-props',
		);
		expect(typed).toHaveLength(1);
		const message = typed[0]!.message;
		expect(message).toContain('defineProps() in its type-argument form');
		// The dead reason must not have survived the repair anywhere in the string.
		expect(message).not.toMatch(/the IR carries no prop type field/);
		// The three measurements that replaced it.
		expect(message).toContain('type: Boolean, required: true');
		expect(message).toContain('undefined to false');
		expect(message).toContain('Missing required prop');
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
			// Step 1.5: the shipped script block carries `lang="ts"` and prints no
			// type. If this row ever reads `script[setup]` again, the emitter lost the
			// attribute - which is the freshness pin working, not a stale expectation.
			{ kind: 'sfc-block', form: 'script[setup,lang=ts]' },
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
		// Iterates the DERIVED corpus. This row used to name S1/S2/S3, so a fourth
		// emitted component could join the repo without the Vue team's own rules
		// ever being run over it.
		expect(emittedSources.size).toBe(scenarioCorpus('vue').length);
		for (const [file, source] of emittedSources)
			expect(
				await eslintMessagesFor(file, source),
				`${file} drew an upstream message`,
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
			// The DERIVED corpus, so a new scenario is measured by the excluded tiers
			// the day it lands rather than the day someone remembers this list.
			for (const [file, source] of emittedSources) {
				const [result] = await eslint.lintText(source, {
					filePath: resolve(packageRoot, file),
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
