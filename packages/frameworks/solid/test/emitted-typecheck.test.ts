import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

// Solid twin of the React lane. Emitted output is untyped .tsx and is otherwise
// never type-checked. Running the
// real TypeScript compiler over it is an INDEPENDENT oracle: unlike the gate,
// which encodes rules we wrote ourselves, tsc is a third party that does not
// know what Frameless intended. It catches undefined identifiers, missing or
// wrong imports, misused framework APIs, and invalid JSX that every other lane
// in this repo would happily wave through.
//
// Props arrive destructured and unannotated by design, so `noImplicitAny` is
// off. That is deliberate scope, not laxity - see
// docs/goals/frameless-testing-ci-v1/notes/T005-emitted-typecheck.md.
//
// THE .jsx -> .tsx MIGRATION SHARPENED THIS LANE, AND THAT WAS NOT PREDICTED.
// The emitted BYTES did not move - every checked-in emitted file is
// byte-identical to its `.jsx` predecessor - but the extension decides which
// inference TypeScript uses, and the two are not equivalent even with
// `allowJs`/`checkJs` on and `strict` off: an uninferrable type parameter falls
// back to `any` in a CHECKED JS file and resolves to `unknown` in a TS file.
//
// This lane reported 7 diagnostics over `.jsx` and reports 21 over the same
// bytes as `.tsx`. All fourteen new ones are that one family, and there are
// exactly two producers of it in Solid's emitted output: `createContext()` with
// no default argument (`Context<unknown>`, so every consumer's property read is
// TS2339) and `produce((draft) => ...)` with no contextual type. They are the
// untyped-emitted-value class this phase exists to remove; when prop and context
// types are printed, the EXACT-EQUALITY assertion below turns red and forces
// this list to be shortened deliberately.

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const compilerOptions: ts.CompilerOptions = {
	allowJs: true,
	checkJs: true,
	noEmit: true,
	// Emitted output is untyped JSX. Under `strict`, TypeScript's inference over
	// unannotated JS produces noise that is not evidence of anything: useRef(null)
	// narrows to `never`, event.target is EventTarget without dataset, and so on.
	// Those are properties of type-checking untyped JS, not emitter defects, and a
	// lane that reports 23 of them is as useless as one that cannot fail.
	// Strictness off keeps the class that IS meaningful for generated code -
	// undefined identifiers, missing/misspelled imports, nonexistent framework
	// APIs, invalid JSX - which the calibration cases below pin down.
	strict: false,
	target: ts.ScriptTarget.ES2022,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	jsx: ts.JsxEmit.ReactJSX,
	jsxImportSource: 'solid-js',
	lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
	skipLibCheck: true,
	types: [],
};

function emittedFiles(): string[] {
	return ['generated', 'generated-composition'].flatMap((directory) => {
		const absolute = resolve(PACKAGE_ROOT, directory);
		return readdirSync(absolute)
			.filter((entry) => entry.endsWith('.tsx'))
			.map((entry) => resolve(absolute, entry));
	});
}

/**
 * THE EXPECTED INVENTORY IS DERIVED, NOT A HAND-EDITED COUNT.
 *
 * This precondition used to read `expect(files.length).toBe(11)`, and the day S4
 * landed it failed with `expected 12 to be 11`. Bumping that number would have
 * been the cheapest possible edit and would have measured nothing: a COUNT
 * cannot tell "the fourth scenario was emitted" from "a fifth composition module
 * appeared and a scenario went missing". The assertion is now on the SET, and
 * both halves of it come from sources INDEPENDENT of the directories being
 * listed:
 *
 *   - the scenarios, from the compiler's ratified goldens (`s<n>-*.json`);
 *   - the composition modules, from the fixtures they are emitted from
 *     (`test/composition-fixtures/*.tsrx`).
 *
 * So a missing emitted file, a stray extra one, and a renamed one are each red,
 * and S5..S8 widen it with no edit here.
 */
const COMPILER_GOLDEN_ROOT = resolve(PACKAGE_ROOT, '../../compiler/test/goldens');

function expectedEmittedFiles(): string[] {
	const scenarios = readdirSync(COMPILER_GOLDEN_ROOT)
		.map((entry) => /^s(\d+)-[\w-]+\.json$/.exec(entry)?.[1])
		.filter((digits): digits is string => digits !== undefined)
		.map((digits) => resolve(PACKAGE_ROOT, `generated/S${digits}.tsx`));
	const composition = readdirSync(resolve(PACKAGE_ROOT, 'test/composition-fixtures'))
		.filter((entry) => entry.endsWith('.tsrx'))
		.map((entry) =>
			resolve(PACKAGE_ROOT, `generated-composition/${entry.slice(0, -'.tsrx'.length)}.tsx`),
		);
	// Fail LOUD rather than returning []. Two empty directories comparing equal is
	// the one way a derived inventory could be greener than the count it replaced.
	if (scenarios.length === 0 || composition.length === 0)
		throw new Error('emitted-inventory derivation found no scenario goldens or no fixtures');
	return [...scenarios, ...composition].sort();
}

/** Type-check `files`, optionally substituting the contents of one of them. */
function diagnose(files: string[], overrides: Record<string, string> = {}): ts.Diagnostic[] {
	const host = ts.createCompilerHost(compilerOptions, true);
	const readFile = host.readFile.bind(host);
	host.readFile = (name) => overrides[name] ?? readFile(name);
	const fileExists = host.fileExists.bind(host);
	host.fileExists = (name) => name in overrides || fileExists(name);

	const program = ts.createProgram(files, compilerOptions, host);
	return [...program.getSemanticDiagnostics(), ...program.getSyntacticDiagnostics()];
}

const format = (diagnostics: ts.Diagnostic[]) =>
	diagnostics.map((diagnostic) => {
		const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
		const file = diagnostic.file?.fileName.replace(`${PACKAGE_ROOT}/`, '') ?? '<none>';
		return `${file}: TS${diagnostic.code} ${message}`;
	});

describe('Solid emitted output type-checks', () => {
	const files = emittedFiles();

	test('every committed emitted component is discovered, and tsc is given all of them', () => {
		const expected = expectedEmittedFiles();
		// THE FLOOR, so a derivation that quietly lost a scenario cannot pass.
		expect(expected).toEqual(
			expect.arrayContaining(
				['S1', 'S2', 'S3', 'S4'].map((name) => resolve(PACKAGE_ROOT, `generated/${name}.tsx`)),
			),
		);
		expect([...files].sort()).toEqual(expected);
		// AND the program tsc actually built covers them. `files` is what is handed
		// to `diagnose()`; this is what proves the compiler took the whole set rather
		// than resolving a subset.
		const program = ts.createProgram(files, compilerOptions);
		expect(
			program
				.getSourceFiles()
				.map((source) => source.fileName)
				.filter((name) => name.startsWith(`${PACKAGE_ROOT}/generated`))
				.sort(),
		).toEqual(expected);
	});

	// TypeScript cannot express some correct-at-runtime JS without annotations.
	// Rather than silence those, every surviving diagnostic is listed here with a
	// reason. The assertion is EXACT EQUALITY, so a new diagnostic fails the lane
	// AND a disappearing one fails too - if an emitter change fixes one of these,
	// this list must be updated deliberately rather than drifting.
	const ACCEPTED: ReadonlyArray<readonly [string, string]> = [
		[
			"generated-composition/C3-ref.tsx: TS2339 Property 'dataset' does not exist on type 'Element'.",
			'ref.current is typed Element; reading .dataset needs an annotation untyped JS cannot carry. Correct at runtime.',
		],
		[
			"generated-composition/C4-attach.tsx: TS2339 Property 'dataset' does not exist on type 'Element'.",
			'Same as C3-ref: an attach handler reads .dataset off an Element-typed ref. Correct at runtime.',
		],
		[
			"generated-composition/C4-attach.tsx: TS2339 Property 'dataset' does not exist on type 'Element'.",
			'C4-attach reads .dataset at two separate sites, so this diagnostic legitimately appears twice.',
		],
		[
			"generated/S3.tsx: TS2339 Property 'dataset' does not exist on type 'EventTarget & Element'.",
			'event.target is EventTarget & Element; reading .dataset needs a cast untyped JS cannot carry. Correct at runtime.',
		],
		[
			`generated/S2.tsx: TS2322 Type '{ "data-action": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			'OPEN FINDING 002 - not an artifact. See notes/findings-002-solid-attr-namespace.md.',
		],
		[
			`generated/S2.tsx: TS2322 Type '{ "data-edit": any; value: any; "attr:value": any; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			'OPEN FINDING 002 - not an artifact. See notes/findings-002-solid-attr-namespace.md.',
		],
		[
			`generated/S3.tsx: TS2322 Type '{ "data-action": string; value: any; "attr:value": any; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			'OPEN FINDING 002 - not an artifact. See notes/findings-002-solid-attr-namespace.md.',
		],
		// S10's TWO ROWS ARE THE SAME FINDING 002, NOT NEW DEFECTS, and that is a
		// measurement rather than a family resemblance: both are TS2322 on
		// `attr:value` against `InputHTMLAttributes<HTMLInputElement>`, the identical
		// producer S2 and S3 already carry. What S10 adds is REACH - finding 002 was
		// only ever visible on axis probes, and it now reproduces on a whole
		// application at both of its text inputs. TodoMVC's new-todo field and its
		// edit field are separate hosts, so the diagnostic legitimately appears twice
		// for the same reason C4-attach's `.dataset` does.
		[
			`generated/S10.tsx: TS2322 Type '{ class: string; placeholder: string; "data-action": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			'OPEN FINDING 002 - not an artifact, and not new: the same `attr:value` producer S2 and S3 carry, reaching S10 via TodoMVC\'s new-todo input. See notes/findings-002-solid-attr-namespace.md.',
		],
		[
			`generated/S10.tsx: TS2322 Type '{ class: string; "data-edit": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			'OPEN FINDING 002 - not an artifact. S10\'s SECOND text input, the edit field, is a distinct host, so the same diagnostic legitimately appears twice. See notes/findings-002-solid-attr-namespace.md.',
		],
		// S11'S THREE ROWS ARE THE SAME FINDING 002 AGAIN, and the COUNT is the datum.
		// TodoMVC ADVANCED carries THREE text inputs rather than S10's two - the
		// new-todo field, the edit field, and the SEARCH field the advanced app adds -
		// and finding 002 reaches every one of them, because its producer is any host
		// with a bound `value`. Nothing here is new in kind; what these rows record is
		// that the finding scales one-for-one with bound text inputs, which is the
		// prediction notes/findings-002-solid-attr-namespace.md makes and the first
		// scenario able to test it at three.
		// Two of the three are BYTE-IDENTICAL to each other because the search input
		// and the new-todo input print the same attribute set (`class`, `placeholder`,
		// `data-action`, `value`); they are separate hosts, so the diagnostic
		// legitimately appears twice for the same reason C4-attach's `.dataset` does.
		[
			`generated/S11.tsx: TS2322 Type '{ class: string; "data-edit": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. S11's edit field. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S11.tsx: TS2322 Type '{ class: string; placeholder: string; "data-action": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. S11's new-todo field. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S11.tsx: TS2322 Type '{ class: string; placeholder: string; "data-action": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. S11's SEARCH field, the input TodoMVC Advanced adds; byte-identical to the new-todo row above because the two hosts print the same attribute set. See notes/findings-002-solid-attr-namespace.md.",
		],
		// S12'S SINGLE ROW IS FINDING 002 CROSSING ITS FIRST TAG BOUNDARY, and that
		// is a strictly stronger reading than the count S11's three rows added.
		// Every prior instance - S2, S3, S10 x2, S11 x3 - is an `<input>`, so the
		// finding had only ever been observed on ONE element type and its note's
		// claim that the producer is "any host with a bound `value`" was, so far,
		// untested against that "any". The Codex clone's composer is the corpus's
		// FIRST `value`-bound `<textarea>` (S7 ships a textarea, but binds
		// `data-notes`, not `value`), and the diagnostic reproduces with the tag
		// substituted straight through on BOTH sides: `HTMLTextAreaElement` in the
		// handler's event type and `TextareaHTMLAttributes<HTMLTextAreaElement>` as
		// the target type. The producer is therefore confirmed to be the `value`
		// BINDING and not the `input` tag - which is what the finding predicted and
		// nothing in the corpus could previously distinguish.
		[
			`generated/S12.tsx: TS2322 Type '{ class: string; placeholder: string; "data-action": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLTextAreaElement; target: HTMLTextAreaElement; }) => void; }' is not assignable to type 'TextareaHTMLAttributes<HTMLTextAreaElement>'.   Property 'attr:value' does not exist on type 'TextareaHTMLAttributes<HTMLTextAreaElement>'.`,
			"OPEN FINDING 002 - not an artifact, and the FIRST instance that is not an `<input>`: S12's composer textarea. Same producer, different tag, which is the first evidence that the finding follows the `value` binding rather than the element. See notes/findings-002-solid-attr-namespace.md.",
		],
		// S13'S SINGLE ROW IS FINDING 002 AGAIN, AND WHAT IT ADDS IS AN ATTRIBUTE
		// THE PRODUCER HAS NEVER SEEN BESIDE IT. Every prior instance prints
		// `class` FIRST; S13's footer search field has to carry an `id` (its
		// `<label for>` points at it, which is the whole reason the corpus's other
		// text inputs never needed one), so the printed attribute object opens with
		// `id: string` and the diagnostic's type literal differs from all eight
		// earlier rows at its first member. It is still TS2322 on `attr:value`
		// against `InputHTMLAttributes<HTMLInputElement>`: the producer does not
		// care what else is on the host, which is one more thing the finding
		// predicted and this is the first row able to say so.
		// NINE INSTANCES NOW, ACROSS FOUR APPLICATIONS AND TWO TAGS. The count is
		// the only thing that has moved since S12 established the tag-independence;
		// no new producer has appeared in a whole additional application.
		[
			`generated/S13.tsx: TS2322 Type '{ id: string; class: string; type: string; "data-action": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. S13's footer search field, the corpus's first bound text input that also carries an `id`. See notes/findings-002-solid-attr-namespace.md.",
		],
		// THE FOURTEEN BELOW ARRIVED WITH THE .jsx -> .tsx MIGRATION, ON UNCHANGED
		// BYTES - see the header. Two producers, both removable only by printing a
		// type: an argument-less `createContext()` and an uncontextualised `produce`.
		[
			"generated-composition/C2-shared.tsx: TS2339 Property 'advance' does not exist on type 'unknown'.",
			'C2-shared\'s `advance` button reads it off `useContext(CompositionSharedContext)`. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C2-shared.tsx: TS2339 Property 'append' does not exist on type 'unknown'.",
			'C2-shared\'s `append` button reads it off the same shared context value. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C2-shared.tsx: TS2339 Property 'audit' does not exist on type 'unknown'.",
			'C2-shared renders `.audit` off the same shared context value. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C2-shared.tsx: TS2339 Property 'count' does not exist on type 'unknown'.",
			'C2-shared renders `.count` off the same shared context value. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C2-shared.tsx: TS2339 Property 'history' does not exist on type 'unknown'.",
			'C2-shared renders `.history` off the same shared context value. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C5-props.tsx: TS2339 Property 'value' does not exist on type 'unknown'.",
			'C5-props reads `.value` off its provider context. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C6-scalar-context.tsx: TS2339 Property 'value' does not exist on type 'unknown'.",
			'C6 reads `.value` off the scalar fan-out context at the first of two sites. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C6-scalar-context.tsx: TS2339 Property 'value' does not exist on type 'unknown'.",
			'C6 reads `.value` off the scalar fan-out context at the second site, so this appears twice. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C7-object-context.tsx: TS2339 Property 'left' does not exist on type 'unknown'.",
			'C7 reads `.left` off the object context at the first of two sites. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C7-object-context.tsx: TS2339 Property 'left' does not exist on type 'unknown'.",
			'C7 reads `.left` off the object context at the second site, so this appears twice. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C7-object-context.tsx: TS2339 Property 'right' does not exist on type 'unknown'.",
			'C7 reads `.right` off the object context at the first of two sites. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated-composition/C7-object-context.tsx: TS2339 Property 'right' does not exist on type 'unknown'.",
			'C7 reads `.right` off the object context at the second site, so this appears twice. Emitted `createContext()` takes no default, so it is `Context<unknown>` and every consumer read is TS2339.',
		],
		[
			"generated/S2.tsx: TS2339 Property 'find' does not exist on type 'unknown'.",
			'S2\'s edit handler calls `.find` on the `produce((storeDraft) => ...)` draft; `produce`\'s type parameter has no contextual type here, so the draft is `unknown` in a TS file and `any` in a checked JS one.',
		],
		[
			"generated/S2.tsx: TS2339 Property 'find' does not exist on type 'unknown'.",
			'S2\'s toggle handler calls `.find` on a second `produce` draft, for the same reason, so this appears twice.',
		],
		// S17'S FIFTEEN ROWS ARE FINDING 002 AGAIN, AND THEY SETTLE THE QUESTION S12
		// OPENED RATHER THAN MERELY EXTENDING THE COUNT. S12 was the first instance
		// that was not an `<input>` and was read as the first evidence that the
		// producer follows the `value` BINDING rather than the `input` element.
		// S17 supplies three things that reading could not previously have:
		//
		//   * TWO MORE TAGS. `<select>` (twice) and `<option>` (once) join `<input>`
		//     and `<textarea>`, so the finding now spans FOUR element types and
		//     TWENTY-FOUR instances across six applications. `SelectHTMLAttributes`
		//     and `OptionHTMLAttributes` are substituted straight through on both
		//     sides exactly as `TextareaHTMLAttributes` was.
		//   * A HOST WITH NO HANDLER AT ALL. The `<option>` row prints THREE members
		//     - `children`, `value`, `attr:value` - with no event, no `data-*`, no
		//     `class` and no `id`. Every one of the fourteen earlier instances
		//     carried an event handler, so `attr:value` could still have been read
		//     as something the EVENT lowering emitted alongside the value. It cannot
		//     be: a bound `value` and nothing else produces it.
		//   * A HOST WHOSE OTHER ATTRIBUTES ARE NUMERIC-SHAPED. `min`, `max` and
		//     `step` are static strings on four of these hosts and cost this lane
		//     NOTHING - which is what makes the surviving diagnostic attributable to
		//     the binding rather than to the bounds beside it.
		//
		// WHAT DOES *NOT* PRODUCE IT IS EQUALLY MEASURED AND IS THE NEGATIVE CONTROL
		// THIS ROW ADDS: S17 ships THREE radios and one keyed checkbox group, all
		// bound with `checked`, and NOT ONE of them appears below. The emitter mirrors
		// into `attr:` for `value` and not for `checked`, so the finding's domain is
		// the `value` binding specifically and not "any property binding".
		[
			`generated/S17.tsx: TS2322 Type '{ children: Element; class: string; id: string; name: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLSelectElement; target: HTMLSelectElement; }) => void; }' is not assignable to type 'SelectHTMLAttributes<HTMLSelectElement>'.   Property 'attr:value' does not exist on type 'SelectHTMLAttributes<HTMLSelectElement>'.`,
			"OPEN FINDING 002 - not an artifact. S17's COMPANY select on the new-contact form, the second `<select>` instance; its `children` is a single Element because its options come out of a keyed repeat rather than being written four times. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ children: Element[]; class: string; id: string; name: string; "aria-label": string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLSelectElement; target: HTMLSelectElement; }) => void; }' is not assignable to type 'SelectHTMLAttributes<HTMLSelectElement>'.   Property 'attr:value' does not exist on type 'SelectHTMLAttributes<HTMLSelectElement>'.`,
			"OPEN FINDING 002 - not an artifact, and the THIRD tag it has ever reached: S17's TOP-BAR STATUS FILTER, a `value`-bound `<select>`. `SelectHTMLAttributes<HTMLSelectElement>` on both sides, same producer. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ children: string; value: string; "attr:value": string; }' is not assignable to type 'OptionHTMLAttributes<HTMLOptionElement>'.   Property 'attr:value' does not exist on type 'OptionHTMLAttributes<HTMLOptionElement>'.`,
			"OPEN FINDING 002 - not an artifact, and THE STRONGEST INSTANCE IN THE CORPUS: an `<option value={row.id}>` with NO event handler, NO data-* attribute and no class - three printed members total. Every earlier instance carried a handler, so `attr:value` could still have been read as something the event lowering added. It is not: the `value` BINDING alone produces it. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ class: string; id: string; name: string; placeholder: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLTextAreaElement; target: HTMLTextAreaElement; }) => void; }' is not assignable to type 'TextareaHTMLAttributes<HTMLTextAreaElement>'.   Property 'attr:value' does not exist on type 'TextareaHTMLAttributes<HTMLTextAreaElement>'.`,
			"OPEN FINDING 002 - not an artifact. S17's Notes textarea, the corpus's SECOND `value`-bound `<textarea>` after S12's composer - and the one the reference itself gets wrong, shipping a single-line `<input>` there. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; min: string; max: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. S17's `type=\"date\"` field, which carries `min`/`max` but no `step`, so its attribute object differs from the three step-bearing controls by exactly one member. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; min: string; max: string; step: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. One of S17's THREE bounded numeric controls (number, time, range); `min`/`max`/`step` are static strings and cost this lane nothing, so the only diagnostic on the host is the `attr:value` the finding produces. The three print an identical attribute set and are separate hosts, so this row legitimately appears three times. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; min: string; max: string; step: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. One of S17's THREE bounded numeric controls (number, time, range); `min`/`max`/`step` are static strings and cost this lane nothing, so the only diagnostic on the host is the `attr:value` the finding produces. The three print an identical attribute set and are separate hosts, so this row legitimately appears three times. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; min: string; max: string; step: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. One of S17's THREE bounded numeric controls (number, time, range); `min`/`max`/`step` are static strings and cost this lane nothing, so the only diagnostic on the host is the `attr:value` the finding produces. The three print an identical attribute set and are separate hosts, so this row legitimately appears three times. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; placeholder: string; "aria-label": string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { ...; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. S17's top-bar `type=\"search\"` field; it carries an `aria-label` because it has no visible `<label>`, which is the one member separating it from the six form text inputs below. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; placeholder: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. One of S17's SIX labelled text-shaped inputs on the new-contact form (text, text, email, tel, url, text). All six print the identical attribute set and are separate hosts, so this row legitimately appears six times, for the same reason C4-attach's `.dataset` does. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; placeholder: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. One of S17's SIX labelled text-shaped inputs on the new-contact form (text, text, email, tel, url, text). All six print the identical attribute set and are separate hosts, so this row legitimately appears six times, for the same reason C4-attach's `.dataset` does. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; placeholder: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. One of S17's SIX labelled text-shaped inputs on the new-contact form (text, text, email, tel, url, text). All six print the identical attribute set and are separate hosts, so this row legitimately appears six times, for the same reason C4-attach's `.dataset` does. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; placeholder: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. One of S17's SIX labelled text-shaped inputs on the new-contact form (text, text, email, tel, url, text). All six print the identical attribute set and are separate hosts, so this row legitimately appears six times, for the same reason C4-attach's `.dataset` does. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; placeholder: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. One of S17's SIX labelled text-shaped inputs on the new-contact form (text, text, email, tel, url, text). All six print the identical attribute set and are separate hosts, so this row legitimately appears six times, for the same reason C4-attach's `.dataset` does. See notes/findings-002-solid-attr-namespace.md.",
		],
		[
			`generated/S17.tsx: TS2322 Type '{ type: string; class: string; id: string; name: string; placeholder: string; "data-control": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			"OPEN FINDING 002 - not an artifact. One of S17's SIX labelled text-shaped inputs on the new-contact form (text, text, email, tel, url, text). All six print the identical attribute set and are separate hosts, so this row legitimately appears six times, for the same reason C4-attach's `.dataset` does. See notes/findings-002-solid-attr-namespace.md.",
		],
		// THE TWO BELOW LOOK IDENTICAL TO THE REACT LANE'S TWIN ROWS AND THEY MEAN
		// SOMETHING DIFFERENT. READ THIS BEFORE COPYING EITHER SET.
		//
		// S16 is the DRAG page. The compiler's `jsxEventName` does
		// `name.slice(2).toLowerCase()`, so an authored `onDragOver` reaches every
		// emitter as `dragover` and this lane re-spells it `onDragover`. tsc says
		// the property does not exist and even suggests "Did you mean 'onDragOver'?"
		// - AND THE BINDING WORKS ANYWAY. Solid's `on*` prop is delegated by
		// LOWERCASING the suffix and calling `addEventListener`, and `dragover` IS
		// the real DOM event name, so the listener lands. `frameless-app-fidelity-v1`
		// T004 DROVE A REAL MOUSE DRAG IN THIS LANE and the card moved and stayed.
		//
		// SO THIS IS A TYPE-SURFACE GAP, NOT A BROKEN BINDING: solid's JSX types
		// enumerate `onDragOver` and `ondragover` and do not enumerate the
		// capitalised-flattened middle form the emitter prints. The REACT lane's
		// twin rows are a genuinely dead binding, which is why DEFECTS.md 15 is
		// amended to REACT-ONLY. This lane's own dossier gate says the same thing in
		// its own words - `solid/event-handlers` calls it a READABILITY rename while
		// react's rule calls it an unknown property.
		//
		// Both disappear the day the IR records where the word boundary was, and the
		// exact-equality assertion below will force these rows to be deleted then.
		[
			`generated/S16.tsx: TS2322 Type '{ children: Element; class: string; "data-cards": string; onDragover: (event: any) => void; onDrop: (event: DragEvent & { currentTarget: HTMLUListElement; target: Element; }) => void; }' is not assignable to type 'HTMLAttributes<HTMLUListElement>'.   Property 'onDragover' does not exist on type 'HTMLAttributes<HTMLUListElement>'. Did you mean 'onDragOver'?`,
			"S16's column drop zone. A TYPE-SURFACE gap, not a dead binding - solid delegates by the lowercased suffix so `dragover` lands, and the drag was driven with a real mouse in this lane. `onDrop` in the same object types cleanly because it is one word and round-trips.",
		],
		[
			`generated/S16.tsx: TS2322 Type '{ children: Element[]; class: string; "data-card": string; "data-dragging": string; draggable: boolean; onDragstart: (event: any) => void; onDragend: (event: any) => void; }' is not assignable to type 'LiHTMLAttributes<HTMLLIElement>'.   Property 'onDragstart' does not exist on type 'LiHTMLAttributes<HTMLLIElement>'. Did you mean 'onDragStart'?`,
			"S16's draggable card, same type-surface gap on the source element. `draggable: boolean` types CLEANLY because the fixture BINDS it instead of spelling `draggable=\"true\"`, which is what keeps the qwik lane's `draggable?: boolean` diagnostic off this axis.",
		],
	];

	test('produces exactly the accepted diagnostics and no others', () => {
		expect(format(diagnose(files)).sort()).toEqual(ACCEPTED.map(([message]) => message).sort());
	});

	test('every accepted diagnostic carries a reason', () => {
		for (const [, reason] of ACCEPTED) expect(reason.length).toBeGreaterThan(30);
	});

	// CALIBRATION. A lane nobody has watched fail is not evidence. Each case
	// below breaks one emitted file the way a real emitter bug would, and proves
	// this lane rejects it. If these ever stop failing, the lane has gone blind.
	describe('calibration: rejects emitted output that a real bug would produce', () => {
		const target = resolve(PACKAGE_ROOT, 'generated/S1.tsx');
		const original = readFileSync(target, 'utf8');

		test('a dropped primitive import is caught', () => {
			// An emitter that forgets to declare a hook it uses.
			const broken = original.replace(/^import \{[^}]*\} from 'solid-js';$/m, '');
			expect(broken).not.toBe(original);
			const messages = format(diagnose(files, { [target]: broken }));
			expect(messages.join('\n')).toMatch(/Cannot find name '(createSignal|createMemo|createEffect)'/);
		});

		test('a call to a primitive that does not exist is caught', () => {
			// An emitter that emits an API the framework does not have.
			const broken = `${original}\nconst probe = createSignalX(0);\n`;
			const messages = format(diagnose(files, { [target]: broken }));
			expect(messages.length).toBeGreaterThan(0);
		});

		test('an invalid JSX attribute value is caught', () => {
			// An emitter that binds the wrong shape into a DOM attribute.
			const broken = original.replace('<div data-s1-root="">', '<div data-s1-root="" ref={42}>');
			expect(broken).not.toBe(original);
			const messages = format(diagnose(files, { [target]: broken }));
			expect(messages.length).toBeGreaterThan(0);
		});
	});
});
