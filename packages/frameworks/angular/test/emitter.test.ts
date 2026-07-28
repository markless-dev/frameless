import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { BindingType, parseTemplate } from '@angular/compiler';
import { buildEnrichedIr, type EnrichedIR } from '@frameless/compiler';
import { resolve } from 'pathe';
import { describe, expect, test } from 'vitest';
import { componentSelector, emit, validateEnrichedIr } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const compilerGoldenRoot = resolve(packageRoot, '../../compiler/test/goldens');

async function golden(name: string): Promise<EnrichedIR> {
	return JSON.parse(await readFile(resolve(compilerGoldenRoot, name), 'utf8')) as EnrichedIR;
}

/**
 * MUTATION CONSTRUCTOR - see the doc comment on the copy in
 * `packages/frameworks/qwik/test/gate.test.ts`, which instructs a new adapter to
 * copy this block rather than reach for a bare `.replace()`.
 * `String.prototype.replace` promises to return a string, NOT to have matched; a
 * search that misses returns the input unchanged and the test then asserts
 * against a non-mutant, staying green while measuring nothing.
 */
function mutate(source: string, search: string | RegExp, replacement: string): string {
	const mutated = source.replace(search, replacement);
	if (mutated !== source) return mutated;
	throw new Error(
		`mutation did not change the source: ${String(search)} left it byte-identical, ` +
			'so this test would assert against a non-mutant',
	);
}

const generatedRoot = resolve(packageRoot, 'generated');

/** Numeric, so S10 sorts after S9 rather than between S1 and S2. */
function byScenarioNumber(left: string, right: string): number {
	return Number(/(\d+)/.exec(left)![1]) - Number(/(\d+)/.exec(right)![1]);
}

/**
 * THE FIXTURE TABLE IS DERIVED, NOT RE-LITERALLED.
 *
 * This table stopped at `s3-event-form.json`, which meant that when S4 landed NO
 * standing test asserted its emitted bytes equal `formatEmitted(emit(golden))`.
 * That freshness was proved ONCE, by regenerating and diffing by hand; nothing
 * re-proved it per run, so the emitted S4 could have drifted from the emitter
 * that claims to produce it and every lane would still have been green. Four
 * more scenarios are queued, and a table hand-edited per scenario is that same
 * hole four more times.
 *
 * The derivation source is the compiler's ratified golden corpus - `s<n>-*.json`
 * - which is INDEPENDENT of `generated/`: one is the IR this repo agreed to
 * compile, the other is what the emitter actually wrote. The two preconditions
 * below compare them and watch both directions go red.
 */
function scenarioFixtures(goldenDir = compilerGoldenRoot): Array<readonly [string, string]> {
	const table = readdirSync(goldenDir)
		.filter((entry) => /^s\d+-[\w-]+\.json$/.test(entry))
		.sort(byScenarioNumber)
		.map((entry) => [`S${/^s(\d+)-/.exec(entry)![1]}.ts`, entry] as const);
	// Fail LOUD rather than returning []. An empty table would emit zero freshness
	// tests and the file would still report green, which is the one way a derived
	// list could be greener than the literal it replaced.
	if (table.length === 0)
		throw new Error(`no s<n>-*.json scenario goldens found in ${goldenDir}`);
	return table;
}

/** What the emitter actually wrote - the other side of the cross-check. */
function emittedScenarios(directory = generatedRoot): string[] {
	return readdirSync(directory)
		.filter((entry) => /^S\d+\.ts$/.test(entry))
		.sort(byScenarioNumber);
}

const FIXTURES = scenarioFixtures();

async function emitted(file: string): Promise<string> {
	return readFile(resolve(packageRoot, 'generated', file), 'utf8');
}

/** Locate the first template node satisfying `match`, anywhere in the IR tree. */
function stamp(root: Record<string, any>, apply: (node: Record<string, any>) => boolean): boolean {
	let patched = false;
	const visit = (node: Record<string, any> | null | undefined): void => {
		if (!node || typeof node !== 'object') return;
		if (!Array.isArray(node) && apply(node)) {
			patched = true;
			return;
		}
		for (const value of Object.values(node)) {
			if (!value || typeof value !== 'object') continue;
			if (Array.isArray(value)) value.forEach((entry) => visit(entry as Record<string, any>));
			else visit(value as Record<string, any>);
		}
	};
	visit(root);
	return patched;
}

describe('Angular 22 emitter', () => {
	test('the derived fixture table is the corpus, and the emitter wrote exactly it', () => {
		// THE FLOOR. Every scenario ratified so far must still be in the derivation.
		// A lower bound, so S5 and later widen it with no edit here, while a golden
		// that silently disappeared is red.
		expect(FIXTURES.map(([file]) => file)).toEqual(
			expect.arrayContaining(['S1.ts', 'S2.ts', 'S3.ts', 'S4.ts']),
		);
		// Two independent readings compared: the goldens this repo agreed to
		// compile, and the files the emitter actually wrote.
		expect(emittedScenarios()).toEqual(FIXTURES.map(([file]) => file));
	});

	/**
	 * CALIBRATION for the DERIVED table. A derived list nobody has watched go red
	 * is not an instrument - and the literal it replaced at least went red when a
	 * golden it named disappeared. Both directions run through the SAME
	 * `scenarioFixtures()` and `emittedScenarios()` the row above calls, against
	 * throwaway roots.
	 */
	test('CALIBRATION: the derived table goes red on a missing and on an extra file', async () => {
		const files = FIXTURES.map(([file]) => file);
		const temporary = await mkdtemp(resolve(tmpdir(), 'frameless-angular-fixtures-'));
		try {
			const goldens = resolve(temporary, 'goldens');
			const generated = resolve(temporary, 'generated');
			await mkdir(goldens);
			await mkdir(generated);
			for (const entry of readdirSync(compilerGoldenRoot))
				await writeFile(resolve(goldens, entry), '{}');
			expect(scenarioFixtures(goldens)).toEqual(FIXTURES);
			// MISSING, on the emitted side: one file short of the derived table.
			for (const file of files.slice(0, -1)) await writeFile(resolve(generated, file), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(files);
			await writeFile(resolve(generated, files.at(-1)!), '//\n');
			expect(emittedScenarios(generated)).toEqual(files);
			// EXTRA, on the emitted side: a stray scenario no golden declares.
			await writeFile(resolve(generated, 'S99.ts'), '//\n');
			expect(emittedScenarios(generated)).not.toEqual(files);
			// And both directions on the DERIVATION side, so a golden that vanished
			// or appeared cannot pass unnoticed either.
			await rm(resolve(goldens, FIXTURES[0]![1]));
			expect(scenarioFixtures(goldens)).not.toEqual(FIXTURES);
			await writeFile(resolve(goldens, 's99-planted.json'), '{}');
			expect(scenarioFixtures(goldens).map(([file]) => file)).toContain('S99.ts');
			// The degenerate case the throw exists for: an empty derivation must NOT
			// quietly agree with an empty directory.
			await rm(goldens, { recursive: true, force: true });
			await mkdir(goldens);
			expect(() => scenarioFixtures(goldens)).toThrow(/no s<n>-\*\.json scenario goldens/);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	test('CALIBRATION: the mutation constructor is loud on a non-mutant', async () => {
		const source = await emitted('S1.ts');
		expect(() => mutate(source, 'text that is not in the emitted S1', 'x')).toThrow(
			/did not change the source/,
		);
		expect(source).toContain('@Component({');
		expect(() => mutate(source, '@Component({', '@Component({')).toThrow(
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

	/**
	 * Unlike a `.vue` or `.svelte` module, a `.ts` module CAN honour the IR's named
	 * `ComponentExport` by spelling, so the class name is the export contract the
	 * other five lanes carry in a header comment.
	 */
	test('emits a standalone single-file component exported under the IR name', async () => {
		for (const [file] of FIXTURES) {
			const source = await emitted(file);
			expect(source).toContain('@Component({');
			expect(source).toMatch(/\nexport class [A-Z]/);
			// No `standalone`, no `imports`, and - see the T003a ruling below - no
			// `changeDetection`.
			expect(source).not.toContain('standalone');
			expect(source).not.toContain('imports:');
		}
		expect(await emitted('S1.ts')).toContain('export class RenderOnce implements OnInit {');
		expect(await emitted('S2.ts')).toContain('export class KeyedTodo implements OnInit {');
		expect(await emitted('S3.ts')).toContain('export class EventForm implements OnInit {');
		expect(await emitted('S1.ts')).toContain("selector: 'frameless-render-once'");
		expect(componentSelector('KeyedTodo')).toBe('frameless-keyed-todo');
	});

	/**
	 * `frameless-angular-v1` T003a: at Angular 22 OnPush IS THE DEFAULT, and
	 * `@angular-eslint/prefer-on-push-component-change-detection` - which IS in this
	 * lane's applied set - reports only an explicit opt-out. Recorded here rather
	 * than only in prose because the consequence belongs to T004: EMITTED
	 * COMPONENTS ARE OnPush-CHECKED, so a downstream lane must not assume eager
	 * change detection.
	 */
	test('emits no changeDetection, so emitted components are OnPush-checked', async () => {
		for (const [file] of FIXTURES) {
			expect(await emitted(file)).not.toContain('changeDetection');
			expect(await emitted(file)).not.toContain('ChangeDetectionStrategy');
		}
	});

	/**
	 * RULING 3a - EVERY event record is lowered, unconditionally. T001 counted 2 of
	 * its 14 inlinable and the Judge counted 6 of the real 15, which IS the ruling:
	 * a judgement call about a grammar boundary inside an emitter is drift.
	 */
	test('lowers all fifteen event records to class methods, with no inlined handler', async () => {
		const s1 = await emitted('S1.ts');
		const s2 = await emitted('S2.ts');
		const s3 = await emitted('S3.ts');
		const methods = [s1, s2, s3].flatMap((source) => [
			...source.matchAll(/^\ton([A-Z]\w*)\(/gm),
		]);
		expect(methods).toHaveLength(15);
		// RULING 3b - the name is keyed on (hostNodeId, eventName), never on an
		// index and never on contents, so inserting a record upstream cannot rename
		// anything downstream.
		expect(s2).toContain('\tonH7Input(todo: any, event: any): void {');
		expect(s2).toContain('\tonH11Click(event: any): void {');
		expect(s3).toContain('\tonH10Click(event: any): void {');
		// Every binding call site is a bare method call. A handler body inlined into
		// a template binding would put a `;` or a `=>` inside the quotes.
		for (const source of [s1, s2, s3])
			for (const [, binding] of source.matchAll(/\((?:click|input|change)\)="([^"]*)"/g))
				expect(binding).toMatch(/^on[A-Z]\w*\((?:\w+, )*\$event\)$/);
	});

	/**
	 * RULING 3d - both parameter kinds are passed ALWAYS. S1's increment never reads
	 * its event and still receives `$event`; deciding otherwise requires inspecting
	 * the body, the same content trigger 3a refuses.
	 */
	test('passes every @for variable and $event whether or not the body reads them', async () => {
		const s1 = await emitted('S1.ts');
		expect(s1).toContain('(click)="onH4Click($event)"');
		expect(s1).not.toContain('event.');
		const s2 = await emitted('S2.ts');
		expect(s2).toContain('(input)="onH7Input(todo, $event)"');
		expect(s2).toContain('(click)="onH9Click(todo, $event)"');
		// S1's handler arrow declares NO parameter, so there is no IR name to keep
		// and the emitter invents `_event` - which keeps this repository's own
		// no-unused-vars pass quiet on generated output. NOT a content trigger:
		// `params.length === 0` is the handler's DECLARED SIGNATURE, the same field
		// ruling 3e already reads to find the name, and it selects a NAME rather than
		// an emission SHAPE. The call site is `$event` either way.
		expect(s1).toContain('\tonH4Click(_event: any): void {');
		// Two-sided: a handler that DOES declare one keeps the IR's own spelling.
		expect(s2).toContain('\tonH2Input(event: any): void {');
		expect(s2).not.toContain('_event');
	});

	/**
	 * RULING 3e AS RESTATED BY T003a, and this is the row the restatement exists
	 * for. The corpus has near-zero natural instances of the interesting cases, so
	 * every arm is named explicitly against the SHIPPED corpus and the two arms the
	 * corpus does not contain are planted below.
	 */
	test('this.-qualification is TOTAL and SCOPE-AWARE over the shipped corpus', async () => {
		const s1 = await emitted('S1.ts');
		const s2 = await emitted('S2.ts');
		// Members qualify, including through an operator - the operator itself is
		// untouched - and a shorthand property loses its shorthand because
		// `{ count }` and `{ count: this.count }` are different objects.
		expect(s1).toContain('this.count++;');
		expect(s1).toContain("this.onTrace('change', { count: this.count });");
		expect(s1).toContain('return `${this.prefix}${this.count * this.multiplier}`;');
		// BODY-LOCAL: S2's add handler declares `const item` and it stays BARE while
		// `this.next` and `this.todos` beside it qualify.
		expect(s2).toContain('const item = { id: `c${this.next}`, title: this.draft, done: false };');
		expect(s2).toContain('this.todos = this.todos.concat(item);');
		expect(s2).toContain("this.onTrace('add', { id: item.id, title: item.title }, event);");
		// LAMBDA PARAMETER: `item` inside .find() stays bare while `this.todos`
		// beside it qualifies, and the @for variable `todo` stays bare too.
		expect(s2).toContain('const alias = this.todos.find((item) => item.id === todo.id);');
		// A BODY-LOCAL WHOSE NAME IS ALSO A SHORTHAND KEY: S2's clear handler.
		expect(s2).toContain('const count = this.todos.length;');
		expect(s2).toContain("this.onTrace('clear', { count }, event);");
		// The event parameter is NEVER moved - ruling 3e's surviving property.
		expect(s2).toContain('this.draft = event.currentTarget.value;');
		// A member property access is not a reference position.
		expect(s2).not.toContain('this.title');
		expect(s2).not.toContain('this.item');
	});

	test('CALIBRATION: a body-local SHADOWING a declared state name stays bare', async () => {
		// The corpus has no natural instance: S1 owns the only `count` state and its
		// handler declares no local of that name. Planted, because an uncalibrated
		// green on a scope-aware transform is a green vacuum - a pure name
		// substitution would pass every row above and fail this one.
		const artifact = structuredClone(await golden('s1-render-once.json'));
		const handler = artifact.records.events[0]!.handlers[0]! as { expression: Record<string, any> };
		handler.expression.body.body.unshift({
			type: 'VariableDeclaration',
			kind: 'const',
			declarations: [
				{
					type: 'VariableDeclarator',
					id: { type: 'Identifier', name: 'count' },
					init: { type: 'Literal', value: 7, raw: '7' },
				},
			],
		});
		const source = emit(artifact);
		expect(source).toContain('const count = 7;');
		// The shadow is respected for the WHOLE block, including the update
		// expression that used to read the member.
		expect(source).toContain('count++;');
		expect(source).not.toContain('this.count++;');
		expect(source).toContain("this.onTrace('change', { count });");
	});

	test('CALIBRATION: an unresolvable identifier THROWS rather than being guessed at', async () => {
		// There is NO globals allowlist, deliberately: the corpus references zero
		// globals, so an allowlist would be untested dead code. This is the row that
		// proves the fail-closed arm actually fires.
		const artifact = structuredClone(await golden('s1-render-once.json'));
		const handler = artifact.records.events[0]!.handlers[0]! as { expression: Record<string, any> };
		handler.expression.body.body.unshift({
			type: 'ExpressionStatement',
			expression: {
				type: 'CallExpression',
				optional: false,
				callee: {
					type: 'MemberExpression',
					computed: false,
					optional: false,
					object: { type: 'Identifier', name: 'Math' },
					property: { type: 'Identifier', name: 'random' },
				},
				arguments: [],
			},
		});
		expect(() => emit(artifact)).toThrow(/cannot resolve the identifier "Math"/);
	});

	test('ordinary locals and state are initialised in ngOnInit, never as field initialisers', async () => {
		// A field initialiser runs at CONSTRUCTION, before Angular has written a
		// single @Input, so `prefix = `${this.label}:`` would read undefined and
		// `this.onTrace('setup', …)` would call it. Every local goes to ngOnInit
		// UNIFORMLY - including `count = 1`, which would have been safe - because
		// splitting on "does this initialiser read a prop?" is ruling 3a's refusal.
		const s1 = await emitted('S1.ts');
		expect(s1).toContain('\tsetup: any;\n\tcount: any;\n\tprefix: any;');
		expect(s1).toContain(
			"\tngOnInit(): void {\n\t\tthis.setup = this.onTrace('setup', { runs: 1 });\n\t\tthis.count = 1;\n\t\tthis.prefix = `${this.label}:`;\n\t}",
		);
		expect(await emitted('S2.ts')).toContain(
			'this.todos = this.seed.map((todo) => ({ ...todo }));',
		);
		expect(await emitted('S3.ts')).toContain('this.text = this.initial;');
	});

	test('a computed binding becomes a GETTER, and no state primitive survives', async () => {
		expect(await emitted('S1.ts')).toContain('\tget derived(): any {');
		expect(await emitted('S2.ts')).toContain(
			'\tget complete(): any {\n\t\treturn this.todos.filter((todo) => todo.done).length;\n\t}',
		);
		// A STATE local's own initializer is the authored `state(1)` CALL, whose
		// callee is a markless primitive with no Angular counterpart. The binding
		// record carries the unwrapped value, and that is what a class field holds.
		for (const [file] of FIXTURES) {
			expect(await emitted(file)).not.toContain('state(');
			expect(await emitted(file)).not.toContain('computed(');
		}
	});

	/**
	 * IR-8 recorded, not closed. `frameless-angular-v1` T002 ruling 5 puts prop
	 * types out of scope for T003 and requires the limitation be written down so a
	 * green is not over-read.
	 */
	/**
	 * THIS TEST WENT VACUOUS THE MOMENT IR-8 LANDED, AND IT PASSED WHILE DOING SO.
	 *
	 * It used to be called "every emitted declaration is `: any`, which is IR-8
	 * recorded not closed", and it asserted `matchAll(/…: any;/gm).length > 2`
	 * plus two anti-vacuity rows aimed at UNANNOTATED members. When
	 * `frameless-emitter-capability-v1` T004 made S1's four `@Input()`s print
	 * their authored types, the count arm still saw `setup`/`count`/`prefix` and
	 * stayed above 2, and neither anti-vacuity row matches `label!: string;` - so
	 * THE FILE'S OWN TITLE BECAME FALSE AND THE ASSERTION STAYED GREEN. The arms
	 * were aimed at "is anything unannotated?" when the question that mattered
	 * was "is anything TYPED?", one axis over.
	 *
	 * The expectation is now DERIVED FROM THE GOLDEN rather than counted, so a
	 * fixture that gains or loses an annotation moves this test instead of
	 * sliding under it.
	 */
	test('a member is `: any` EXACTLY WHERE IR-8 supplies nothing, and typed exactly where it does', async () => {
		let typedInputsSeen = 0;
		let untypedInputsSeen = 0;
		for (const [file, goldenName] of FIXTURES) {
			const source = await emitted(file);
			const artifact = await golden(goldenName);
			for (const component of artifact.components)
				for (const entry of component.props.entries) {
					const declaration = new RegExp(`^\\t@Input\\(\\) ${entry.localName}(.*);$`, 'm');
					const [, suffix] = declaration.exec(source) ?? [];
					expect(suffix, `${file} @Input() ${entry.localName}`).toBeDefined();
					if (entry.type === undefined) {
						// THE CONTROL ARM, and it is why this loop keys off the golden.
						// Seven of the eight scenarios carry no authored prop type, so
						// they must still print `: any` - which is what proves a printed
						// type came from SOURCE rather than being synthesized here.
						expect(suffix, `${file} ${entry.localName}`).toBe(': any');
						untypedInputsSeen += 1;
					} else {
						expect(suffix, `${file} ${entry.localName}`).toMatch(/^!: /);
						expect(suffix, `${file} ${entry.localName}`).not.toContain('any');
						typedInputsSeen += 1;
					}
				}
			// EVERY NON-INPUT MEMBER AND EVERY HANDLER PARAMETER IS STILL `: any`,
			// and that is the honest limit of this step: IR-8 supplies PROP types
			// only, so locals, getters and `$event` have no type channel at all.
			// Scoped to the CLASS BODY: the `@Component({ selector: '…' })` decorator
			// above it is object-literal syntax that the same shape would match.
			const classBody = source.slice(source.indexOf('\nexport class '));
			expect(classBody, file).not.toBe('');
			for (const [, name, suffix] of classBody.matchAll(/^\t(\w+)(: [^;]+);$/gm))
				if (!source.includes(`@Input() ${name}`)) expect(suffix, `${file} ${name}`).toBe(': any');
			for (const [, parameters] of source.matchAll(/^\t\w+\(([^)]*)\): void \{$/gm))
				for (const parameter of parameters.split(', ').filter(Boolean))
					expect(parameter, `${file} ${parameter}`).toMatch(/^\w+: any$/);
			// ANTI-VACUITY: neither an unannotated field nor an unannotated parameter
			// exists anywhere, so the rows above are not just matching the subset that
			// happens to be annotated. A bare `count;` is TS7008 and a bare `event`
			// parameter TS7006 under the scaffold's `strict`, so an unannotated member
			// would not survive `ng build` at all.
			expect(source).not.toMatch(/^\t(?:@Input\(\) )?\w+;$/m);
			expect(source).not.toMatch(/^\t\w+\(\w+(?:[,)])/m);
			// `event: Event` is refused for the opposite reason to `: any`: the real
			// DOM type makes `event.currentTarget.value` a type error, so emitting it
			// would be the emitter inventing a type to look better typed than it is.
			expect(source).not.toContain('event: Event');
		}
		// BOTH BRANCHES MUST BE EXERCISED. A corpus that lost its one annotated
		// fixture, or that annotated all of them, would make one arm above vacuous
		// and this row is what refuses that rather than reporting a green.
		expect({ typedInputsSeen, untypedInputsSeen }).toEqual({
			typedInputsSeen: 4,
			untypedInputsSeen: 15,
		});
	});

	/**
	 * IR-8's type nodes arrive in the dialect `@tsrx/core` (oxc) produces, and
	 * `yuku-codegen` prints the ESTree/typescript-eslint one. THIS ROW IS THE
	 * REASON THE EMITTER CONVERTS FIELD-BY-FIELD INSTEAD OF CLONING.
	 *
	 * It drives the printer through the emitter's real entry point, so it fails
	 * if the conversion is removed, and it names the exact text a permissive
	 * converter produces: `onTrace: () => ;` - MALFORMED, and emitted with
	 * `errors: []` from the codegen. A whole class of broken output would have
	 * shipped green, because no instrument in this lane reads a type it did not
	 * itself print.
	 */
	test('the oxc -> ESTree dialect conversion is load-bearing on the corpus function type', async () => {
		const source = await emitted('S1.ts');
		expect(source).toContain(
			'@Input() onTrace!: (name: string, detail: Record<string, unknown>) => void;',
		);
		// The silent-garbage shape, spelled out so a reader can recognise it.
		expect(source).not.toContain('=> ;');
		// CALIBRATION: yuku-codegen really does accept the unconverted node and
		// really does report no error, measured here rather than asserted.
		const { generate } = await import('yuku-codegen');
		const artifact = await golden('s1-render-once.json');
		const raw = artifact.components[0]!.props.entries.find(
			(entry) => entry.localName === 'onTrace',
		)!.type as unknown as Record<string, unknown>;
		expect(raw.type).toBe('TSFunctionType');
		const printed = generate(
			{
				type: 'Program',
				sourceType: 'module',
				body: [
					{
						type: 'VariableDeclaration',
						kind: 'const',
						declarations: [
							{
								type: 'VariableDeclarator',
								id: {
									type: 'Identifier',
									name: 'x',
									typeAnnotation: { type: 'TSTypeAnnotation', typeAnnotation: raw },
								},
								init: null,
							},
						],
					},
				],
			} as never,
			{ quotes: 'single' },
		);
		expect(printed.errors).toEqual([]);
		expect(printed.code).toBe('const x: () => ;');
	});

	describe('IR-8 printing fails closed rather than guessing', () => {
		async function withPropType(node: unknown): Promise<() => string> {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const entry = artifact.components[0]!.props.entries.find(
				(candidate) => candidate.localName === 'label',
			)!;
			(entry as { type?: unknown }).type = node;
			return () => emit(artifact);
		}

		test('on a type node kind the emitter has no lowering for', async () => {
			const run = await withPropType({ type: 'TSUnionType', types: [] });
			expect(run).toThrow(/no IR-8 lowering for the type node TSUnionType/);
		});

		test('on a qualified type name it cannot prove is imported', async () => {
			const run = await withPropType({
				type: 'TSTypeReference',
				typeName: {
					type: 'TSQualifiedName',
					left: { type: 'Identifier', name: 'A' },
					right: { type: 'Identifier', name: 'B' },
				},
			});
			expect(run).toThrow(/refuses a qualified type name/);
		});

		test('on a function-type parameter that is not an annotated plain identifier', async () => {
			const run = await withPropType({
				type: 'TSFunctionType',
				parameters: [{ type: 'RestElement', argument: { type: 'Identifier', name: 'rest' } }],
				typeAnnotation: {
					type: 'TSTypeAnnotation',
					typeAnnotation: { type: 'TSVoidKeyword' },
				},
			});
			expect(run).toThrow(/no IR-8 lowering for the function-type parameter RestElement/);
		});

		/**
		 * CALIBRATION for the three rows above: the SAME constructor with a node the
		 * emitter DOES accept must emit, or all three would pass on any throw at all.
		 */
		test('CALIBRATION: an accepted node kind emits instead of throwing', async () => {
			const run = await withPropType({ type: 'TSUnknownKeyword' });
			expect(run()).toContain('@Input() label!: unknown;');
		});
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

		/**
		 * RULING 3b's collision arm. The corpus has ZERO natural instances - all
		 * fifteen (hostNodeId, eventName) pairs are unique - so an uncalibrated green
		 * is vacuous and this plants the duplicate the schema permits.
		 */
		test('on two records colliding on (hostNodeId, eventName)', async () => {
			const artifact = structuredClone(await golden('s2-keyed-todo.json'));
			const events = artifact.records.events as unknown as Array<Record<string, any>>;
			const clone = structuredClone(events[0]!);
			clone.id = 'event:planted';
			events.push(clone);
			// The planted record must also be REACHABLE, or the emitter would refuse
			// it for the other reason and this row would measure the wrong throw.
			expect(
				stamp(artifact.components[0]! as unknown as Record<string, any>, (node) => {
					if (node.kind !== 'host' || node.id !== String(events[0]!.hostNodeId)) return false;
					node.eventIds = [...node.eventIds, 'event:planted'];
					return true;
				}),
			).toBe(true);
			expect(() => emit(artifact)).toThrow(/refuses the lowered method name onH2Input/);
		});

		test('on a lowered method name a component member already owns', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact.components[0]!.locals[0]! as unknown as Record<string, any>).names = [
				'onH4Click',
			];
			(artifact.components[0]!.locals[0]! as unknown as Record<string, any>).pattern = {
				type: 'Identifier',
				name: 'onH4Click',
			};
			expect(() => emit(artifact)).toThrow(/refuses the lowered method name onH4Click/);
		});

		test('on a component member colliding with one the emitted class introduces', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const local = artifact.components[0]!.locals[0]! as unknown as Record<string, any>;
			local.names = ['ngOnInit'];
			local.pattern = { type: 'Identifier', name: 'ngOnInit' };
			expect(() => emit(artifact)).toThrow(/collides with a member the emitted class introduces/);
		});

		test('on an event record no host node references', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			expect(
				stamp(artifact.components[0]! as unknown as Record<string, any>, (node) => {
					if (node.kind !== 'host' || node.eventIds?.length !== 1) return false;
					node.eventIds = [];
					return true;
				}),
			).toBe(true);
			expect(() => emit(artifact)).toThrow(/on no host node/);
		});

		test('on an aliased prop, which only @Input(alias) could express', async () => {
			// The refusal is upstream's: `@angular-eslint/no-input-rename` is IN this
			// lane's applied set, so the only Angular spelling for an alias is one the
			// arbiter reports. Failing closed here beats emitting output the gate
			// would then reject.
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const entry = artifact.components[0]!.props.entries[0]! as unknown as Record<string, any>;
			entry.alias = true;
			entry.sourceName = 'labelAlias';
			expect(() => emit(artifact)).toThrow(/refuses the aliased prop labelAlias -> label/);
		});

		test('on a declared prop default and a multi-segment prop path', async () => {
			const withDefault = structuredClone(await golden('s1-render-once.json'));
			(withDefault.components[0]!.props.entries[0]! as unknown as Record<string, any>)
				.defaultValue = { type: 'Literal', value: 'x', raw: "'x'" };
			expect(() => emit(withDefault)).toThrow(/no lowering for a prop default value/);
			const deepPath = structuredClone(await golden('s1-render-once.json'));
			(deepPath.components[0]!.props.entries[0]! as unknown as Record<string, any>).path = [
				'a',
				'b',
			];
			expect(() => emit(deepPath)).toThrow(/single-segment prop path/);
		});

		test('on persistence-bearing IR', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			(artifact.records.persistence as unknown[]).push({ graphNodeId: 'state:count' });
			expect(() => emit(artifact)).toThrow(/does not support persistence-bearing IR/);
		});

		test('on an early component guard, which a component class cannot express', async () => {
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
			expect(
				stamp(artifact.components[0]! as unknown as Record<string, any>, (node) => {
					if (node.kind !== 'keyed-repeat') return false;
					node.index = 'position';
					return true;
				}),
			).toBe(true);
			expect(() => emit(artifact)).toThrow(/no lowering for an index binding/);
		});

		test('on a control-flow block whose children are not all block level', async () => {
			// The block braces sit on their own lines, so a text child would gain the
			// whitespace edges measurement M1 rejects. Refused rather than inlined,
			// because the corpus has no instance to test an inline block against.
			const artifact = structuredClone(await golden('s1-render-once.json'));
			expect(
				stamp(artifact.components[0]! as unknown as Record<string, any>, (node) => {
					if (node.kind !== 'branch') return false;
					node.arms[0].children = [
						...node.arms[0].children,
						{ kind: 'text', id: 'planted', value: 'x' },
					];
					return true;
				}),
			).toBe(true);
			expect(() => emit(artifact)).toThrow(/children are not all block level/);
		});

		test('on template text that would break out of the TypeScript template literal', async () => {
			for (const [value, message] of [
				['a `backtick` b', /would terminate or interpolate/],
				['a ${x} b', /would terminate or interpolate/],
				['a {{ x }} b', /interpolation delimiters/],
				['  padded  ', /condenses a run of whitespace/],
			] as const) {
				const artifact = structuredClone(await golden('s1-render-once.json'));
				expect(
					stamp(artifact.components[0]! as unknown as Record<string, any>, (node) => {
						if (node.kind !== 'text') return false;
						node.value = value;
						return true;
					}),
				).toBe(true);
				expect(() => emit(artifact), value).toThrow(message);
			}
		});

		test('on an expression node the qualifier has never been taught', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const local = artifact.components[0]!.locals.find((entry) => entry.names[0] === 'prefix')!;
			(local as unknown as { initializer: unknown }).initializer = {
				type: 'ClassExpression',
				id: null,
				superClass: null,
				body: { type: 'ClassBody', body: [] },
			};
			expect(() => emit(artifact)).toThrow(/no lowering for the expression node/);
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
		 * THE PROBE ABOVE IS AIMED ONE LEVEL TOO HIGH, AND THIS IS THE ARM THAT
		 * SAYS SO.
		 *
		 * `newField` on `EnrichedIR` was caught by all six lanes from the day it
		 * was written; a key on a NESTED `PropDestructuringEntry` was caught by
		 * exactly two. MEASURED at 127a75b, before T010 tightened this validator:
		 * qwik, svelte, vue AND angular all ACCEPTED the nested key and emitted
		 * BYTE-IDENTICAL output across all eight goldens, while react and solid
		 * threw. That is why the IR-8 plan believed the six validators were
		 * symmetric - the test that would have shown otherwise never looked below
		 * the top level, so "a schema addition cannot pass silently" was true of
		 * one shape of addition and false of the shape actually being added.
		 *
		 * THE CALIBRATION IS THE SECOND ASSERTION, not the first: it pins that the
		 * nested plant is INVISIBLE to the top-level allowlist, because the message
		 * names `PropDestructuringEntry` and never `EnrichedIR`. Delete the nested
		 * check and this test goes red; delete the top-level one and the test above
		 * goes red instead. The two are not substitutes and neither replaced the
		 * other.
		 */
		test('on an unknown field NESTED on a PropDestructuringEntry, which the top-level probe cannot see', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const entries = artifact.components[0]!.props.entries as unknown as Array<
				Record<string, unknown>
			>;
			expect(entries.length).toBeGreaterThan(0);
			entries[0]!.newNestedField = 'planted';
			expect(() => emit(artifact)).toThrow(
				/PropDestructuringEntry has unknown semantic field: newNestedField/,
			);
			expect(() => emit(artifact)).not.toThrow(/EnrichedIR has unknown semantic field/);
		});

		/**
		 * IR-8's `type` is ADMITTED, not banned - so the allowlist above must not be
		 * read as "this lane refuses a typed prop". It refuses an UNCHECKED one: a
		 * `type` that is not an AST node is named as loudly as an unknown key, which
		 * is what stops admitting the field from trading one blind spot for another.
		 *
		 * The positive arm is not decoration. `s1-render-once` is the ONLY annotated
		 * fixture in the corpus - four typed entries against fifteen untyped ones
		 * across the other seven goldens - so without it the allowlist entry would
		 * be indistinguishable from a dead one that nothing ever exercises.
		 */
		test('on a malformed IR-8 type annotation, while a well-formed one is admitted', async () => {
			const admitted = structuredClone(await golden('s1-render-once.json'));
			expect(
				admitted.components[0]!.props.entries.filter((entry) => entry.type !== undefined),
			).not.toHaveLength(0);
			expect(() => emit(admitted)).not.toThrow();
			const artifact = structuredClone(await golden('s1-render-once.json'));
			const entries = artifact.components[0]!.props.entries as unknown as Array<
				Record<string, unknown>
			>;
			entries[0]!.type = 'string';
			expect(() => emit(artifact)).toThrow(
				/PropDestructuringEntry has malformed type annotation AST/,
			);
		});

		/**
		 * IR-8 REQUIREDNESS, GUARDED THE SAME WAY AS ITS TYPE - see the fuller doc
		 * comment on the copy in `packages/frameworks/qwik/test/emitter.test.ts`.
		 * MEASURED: `optional` planted on every `PropDestructuringEntry` of all
		 * eight goldens was rejected BY NAME by all six lanes before the field
		 * landed. The ORPHAN arm is the one with teeth - `type` and `optional` are
		 * read from ONE `TSPropertySignature`, so an `optional` with no `type` is
		 * requiredness invented downstream rather than reported from source.
		 */
		test('on a malformed or ORPHANED IR-8 requiredness flag, while a well-formed one is admitted', async () => {
			const admitted = structuredClone(await golden('s1-render-once.json'));
			expect(
				admitted.components[0]!.props.entries.filter(
					(entry) => entry.optional !== undefined,
				),
			).not.toHaveLength(0);
			expect(() => emit(admitted)).not.toThrow();

			const malformed = structuredClone(await golden('s1-render-once.json'));
			(
				malformed.components[0]!.props.entries as unknown as Array<Record<string, unknown>>
			)[0]!.optional = 'yes';
			expect(() => emit(malformed)).toThrow(
				/PropDestructuringEntry has malformed optional flag: label/,
			);

			const orphaned = structuredClone(await golden('s1-render-once.json'));
			delete (
				orphaned.components[0]!.props.entries as unknown as Array<Record<string, unknown>>
			)[0]!.type;
			expect(() => emit(orphaned)).toThrow(
				/PropDestructuringEntry declares optionality without a type annotation: label/,
			);
		});

		/**
		 * `emit()` runs ARBITER 1 - `@angular/compiler`'s own `parseTemplate` - over
		 * its output, so a template Angular's parser rejects never reaches disk. This
		 * plants a diagnostic upstream of the emitter's own check by giving a host an
		 * unclosed shape Angular's HTML parser refuses.
		 */
		test('when its own template would not parse with an empty error set', async () => {
			const artifact = structuredClone(await golden('s1-render-once.json'));
			expect(
				stamp(artifact.components[0]! as unknown as Record<string, any>, (node) => {
					if (node.kind !== 'host' || node.tag !== 'output') return false;
					node.tag = 'input';
					return true;
				}),
			).toBe(true);
			expect(() => emit(artifact)).toThrow(/cannot have children/);
			// AND THE ROW THAT IS THIS BOARD'S WHOLE POINT. Angular's template
			// expression grammar has NO UpdateExpression node at all, which is why
			// S1's `count++` is unexpressible in a binding and why forced lowering
			// exists. Planted into an interpolation, `parseTemplate` says so directly.
			const update = structuredClone(await golden('s1-render-once.json'));
			expect(
				stamp(update.components[0]! as unknown as Record<string, any>, (node) => {
					if (node.kind !== 'dynamic-text') return false;
					node.expression = {
						type: 'UpdateExpression',
						operator: '++',
						prefix: false,
						argument: { type: 'Identifier', name: 'count' },
					};
					return true;
				}),
			).toBe(true);
			expect(() => emit(update)).toThrow(/did not parse with an empty error set/);
			expect(() => emit(update)).toThrow(/Unexpected end of expression/);
		});
	});
});

/**
 * T049, implementing the T041 ruling. `docs/DEFECTS.md` entry 10.
 *
 * ANGULAR IS THE ONLY LANE THIS REPAIR IS VISIBLE IN, because it is the only
 * lane that distinguishes a property binding from an attribute binding at all.
 * Before the lowering, a dynamic `disabled` reached here as `kind: 'attribute'`
 * and was emitted `[attr.disabled]`; Angular's attribute path stringifies its
 * value and removes only on nullish, so `false` served `disabled="false"` - and
 * `disabled="false"` DISABLES the control - where the other five lanes served
 * nothing at all.
 *
 * WHERE THE FIX IS NOT. Not here. `attributesOf` above carries a standing ruling
 * that `DynamicBinding.kind` is the IR's own answer and the emitter puts no
 * judgement between it and the emitted form. A boolean-name check in this file
 * would have reintroduced exactly that judgement and left the IR asserting
 * `attribute` while one consumer quietly disagreed. So this suite asserts the
 * CONSEQUENCE of the compiler's lowering, and would go red if someone re-fixed
 * it locally instead.
 *
 * ARBITER. The second assertion does not read our own emitted bytes; it hands
 * them to `@angular/compiler`'s `parseTemplate` and reads the `BindingType`
 * Angular itself assigns. That is the tripwire the ruling asks for: if Angular
 * ever stops distinguishing the two forms - or makes `[attr.x]` boolean-aware -
 * this reports it instead of memory doing so.
 */
describe('the boolean-attribute lowering, seen from the one lane it moves', () => {
	/**
	 * `disabled` is the reported defect. `inert` is the control: a REAL browser
	 * property that the admission rule in `build.ts` refuses, because Angular's
	 * own server DOM (domino) does not implement it and SSR would drop what the
	 * client sets. One admitted name and one refused one, so a set that swallowed
	 * everything would fail here just as loudly as one that swallowed nothing.
	 */
	const probeSource = `import { state } from '@markless/core';

export function Probe({ seed }) @{
	let a = state(seed);

	<div data-probe>
		<span disabled={a}></span>
		<span inert={a}></span>
	</div>
}
`;

	async function probeTemplate(): Promise<string> {
		const ir = await buildEnrichedIr({ filename: 'probe.tsrx', source: probeSource });
		const source = emit(ir);
		const template = /template: `\n([\s\S]*?)\n\t`,/.exec(source)?.[1];
		if (!template) throw new Error(`No template found in the emitted probe:\n${source}`);
		return template;
	}

	test('a boolean content attribute emits [disabled], and a refused name still emits [attr.inert]', async () => {
		const template = await probeTemplate();
		expect(template).toContain('[disabled]="a"');
		// The defect's own byte sequence. Explicitly absent, not merely unmentioned.
		expect(template).not.toContain('[attr.disabled]');
		expect(template).toContain('[attr.inert]="a"');
	});

	test("ARBITER: @angular/compiler classifies the emitted forms as Angular's own Property and Attribute", async () => {
		const parsed = parseTemplate(await probeTemplate(), 'probe.html');
		expect(parsed.errors ?? []).toEqual([]);
		const classified: Record<string, string> = {};
		const visit = (nodes: readonly unknown[]): void => {
			for (const node of nodes) {
				const element = node as { inputs?: Array<{ name: string; type: number }>; children?: unknown[] };
				for (const input of element.inputs ?? []) classified[input.name] = BindingType[input.type]!;
				if (element.children) visit(element.children);
			}
		};
		visit(parsed.nodes);
		expect(classified).toEqual({ disabled: 'Property', inert: 'Attribute' });
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
	// normalised away. `oxfmt` - which the react, solid and qwik lanes DO run - is
	// not resolvable from this package, and adding it would move pnpm-lock.yaml.
	const rejected = [
		['CRLF line endings', (source: string) => source.replaceAll('\n', '\r\n'), /LF line/],
		['a missing final newline', (source: string) => source.trimEnd(), /exactly one newline/],
		['a doubled final newline', (source: string) => `${source}\n`, /exactly one newline/],
		[
			'trailing whitespace',
			(source: string) => source.replace('@Component({', '@Component({ '),
			/trailing whitespace/,
		],
		[
			'space indentation',
			(source: string) => source.replace('\n\tselector', '\n\t  selector'),
			/indents with spaces/,
		],
	] as const;

	for (const [shape, apply, message] of rejected)
		test(`CALIBRATION: rejects ${shape}`, async () => {
			const source = await emitted('S1.ts');
			const mutant = apply(source);
			expect(mutant, `${shape} produced a non-mutant`).not.toBe(source);
			expect(() => formatEmitted(mutant)).toThrow(message);
		});
});

/**
 * THE SECOND INSTRUMENT, and the reason there has to be one.
 *
 * `frameless-defects-and-targets-v1` T043 §1.2 separated TWO failure modes behind
 * the dropped `async`, and only ONE of them is catchable by any oracle:
 *
 *   - `async` WITH `await` emits `await` inside a non-async method. That is
 *     INVALID TypeScript - TS1308 - and `emitted-typecheck.test.ts` catches it.
 *     That file records the verbatim RED.
 *   - `async` WITHOUT `await` drops the keyword and emits PERFECTLY VALID
 *     TypeScript. The method returns `void` instead of `Promise<void>`, every
 *     caller that awaited it silently awaits a non-promise, and NO TYPECHECK
 *     ORACLE ANYWHERE - not this repo's, not a perfect one - can see it, because
 *     nothing about it is a type error.
 *
 * SO ONE INSTRUMENT IS INSUFFICIENT BY CONSTRUCTION, and the second cannot be
 * another derived check over the same output: it has to assert THE EMITTED
 * KEYWORD DIRECTLY. That is what this block does. `emitted-typecheck.test.ts`
 * carries the complementary proof - a test that pins the oracle's BLINDNESS here,
 * green both before and after the repair, so the gap is a standing statement
 * rather than a thing a reader has to infer.
 *
 * DEFECTS.md entry 9.
 */
describe('an authored async handler keeps its async on the lowered class method', () => {
	/**
	 * The awaited value is a PROMISE-VALUED PROP, per T043 §6. Not a free global
	 * (`await Promise.resolve()`) because Angular's globals v-limit refuses
	 * `Promise` and THAT REFUSAL IS CORRECT and is not weakened here; not a
	 * callback-prop call (`await settle()`) because Qwik's callback-statement rule
	 * refuses that and is also correct. Authoring AROUND a designed v-limit is what
	 * T030 did for S7 with `aria-disabled`.
	 *
	 * Nothing here is registered - no golden, no fixture, no `generated/` byte. The
	 * shipped corpus contains no async handler at all, which is exactly why a
	 * correct repair is INVISIBLE to it and why this planted probe is the proof.
	 */
	async function emitHandler(handlerSource: string): Promise<string> {
		const ir = await buildEnrichedIr({
			filename: 'async-probe.tsrx',
			source: `import { state } from '@markless/core';

export function HandlerProbe({ ready, onTrace }) @{
	let phase = state('idle');
	let ticks = state(0);

	<div data-probe-root="">
		<button data-action="run" onClick={${handlerSource}}></button>
		<output data-value="phase">{phase}</output>
		<output data-value="ticks">{ticks}</output>
	</div>
}
`,
		});
		return formatEmitted(emit(ir));
	}

	test('async WITH await: the keyword is carried and the return type widens', async () => {
		const source = await emitHandler(`async (event) => {
				phase = 'pending';
				await ready;
				ticks = ticks + 1;
				phase = 'done';
			}`);
		expect(source).toMatch(/\basync onH\d+Click\(event: any\): Promise<void> \{/);
		// The lowering still ran: reads and writes are qualified ACROSS the await,
		// so this cannot pass by emitting an async method with a stale body.
		expect(source).toMatch(/await this\.ready;/);
		expect(source).toMatch(/this\.ticks = this\.ticks \+ 1;/);
		expect(source).toMatch(/this\.phase = 'done';/);
	});

	/**
	 * THE CASE NO ORACLE CAN CATCH. Before the repair this emitted
	 * `onH2Click(event: any): void` - valid TypeScript, silently no longer a
	 * promise. This assertion is the ONLY thing in the repo that sees it.
	 */
	test('async WITHOUT await: the keyword is carried even though the output would typecheck either way', async () => {
		const source = await emitHandler(`async (event) => {
				phase = 'pending';
				ticks = ticks + 1;
				onTrace('run', { phase: 'done' });
			}`);
		expect(source).toMatch(/\basync onH\d+Click\(event: any\): Promise<void> \{/);
		expect(source).not.toMatch(/onH\d+Click\(event: any\): void \{/);
	});

	/**
	 * THE CONTROL, so "async is carried" is not vacuously true of every handler.
	 * Without this row an emitter that stamped `async` on EVERYTHING would pass
	 * both tests above.
	 */
	test('a synchronous handler stays synchronous', async () => {
		const source = await emitHandler(`(event) => {
				phase = 'pending';
				ticks = ticks + 1;
			}`);
		expect(source).toMatch(/\bonH\d+Click\(event: any\): void \{/);
		expect(source).not.toMatch(/\basync\b/);
	});

	/**
	 * AND THE WHOLE SHIPPED CORPUS IS SYNCHRONOUS, asserted rather than assumed.
	 * This is what licenses the `git diff --exit-code -- generated` check that the
	 * repair had to pass: no emitted byte may move, because there is no async
	 * handler in the corpus for the repair to change.
	 */
	test('no emitted scenario contains an async member, so the repair moves no committed byte', async () => {
		for (const file of emittedScenarios()) expect(await emitted(file)).not.toMatch(/\basync\b/);
	});
});
