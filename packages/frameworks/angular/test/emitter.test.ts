import { readFile } from 'node:fs/promises';
import type { EnrichedIR } from '@frameless/compiler';
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

const FIXTURES = [
	['S1.ts', 's1-render-once.json'],
	['S2.ts', 's2-keyed-todo.json'],
	['S3.ts', 's3-event-form.json'],
] as const;

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
	test('every emitted declaration is `: any`, which is IR-8 recorded not closed', async () => {
		for (const [file] of FIXTURES) {
			const source = await emitted(file);
			// Positive: every field and every method parameter carries the annotation.
			expect([...source.matchAll(/^\t(?:@Input\(\) )?\w+: any;$/gm)].length).toBeGreaterThan(2);
			for (const [, parameters] of source.matchAll(/^\t\w+\(([^)]*)\): void \{$/gm))
				for (const parameter of parameters.split(', ').filter(Boolean))
					expect(parameter, `${file} ${parameter}`).toMatch(/^\w+: any$/);
			// ANTI-VACUITY for the two rows above: neither an unannotated field nor an
			// unannotated parameter exists anywhere, so the positives are not just
			// matching the subset that happens to be annotated. A bare `count;` is
			// TS7008 and a bare `event` parameter TS7006 under the scaffold's `strict`,
			// so an unannotated member would not survive T004's `ng build` at all.
			expect(source).not.toMatch(/^\t(?:@Input\(\) )?\w+;$/m);
			expect(source).not.toMatch(/^\t\w+\(\w+(?:[,)])/m);
			// `event: Event` is refused for the opposite reason to `: any`: the real
			// DOM type makes `event.currentTarget.value` a type error, so emitting it
			// would be the emitter inventing a type to look better typed than it is.
			expect(source).not.toContain('event: Event');
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
