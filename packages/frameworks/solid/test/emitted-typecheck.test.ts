import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

// Solid twin of the React lane. Emitted output is plain .jsx and is otherwise
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
			.filter((entry) => entry.endsWith('.jsx'))
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
		.map((digits) => resolve(PACKAGE_ROOT, `generated/S${digits}.jsx`));
	const composition = readdirSync(resolve(PACKAGE_ROOT, 'test/composition-fixtures'))
		.filter((entry) => entry.endsWith('.tsrx'))
		.map((entry) =>
			resolve(PACKAGE_ROOT, `generated-composition/${entry.slice(0, -'.tsrx'.length)}.jsx`),
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
				['S1', 'S2', 'S3', 'S4'].map((name) => resolve(PACKAGE_ROOT, `generated/${name}.jsx`)),
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
			"generated-composition/C3-ref.jsx: TS2339 Property 'dataset' does not exist on type 'Element'.",
			'ref.current is typed Element; reading .dataset needs an annotation untyped JS cannot carry. Correct at runtime.',
		],
		[
			"generated-composition/C4-attach.jsx: TS2339 Property 'dataset' does not exist on type 'Element'.",
			'Same as C3-ref: an attach handler reads .dataset off an Element-typed ref. Correct at runtime.',
		],
		[
			"generated-composition/C4-attach.jsx: TS2339 Property 'dataset' does not exist on type 'Element'.",
			'C4-attach reads .dataset at two separate sites, so this diagnostic legitimately appears twice.',
		],
		[
			"generated/S3.jsx: TS2339 Property 'dataset' does not exist on type 'EventTarget & Element'.",
			'event.target is EventTarget & Element; reading .dataset needs a cast untyped JS cannot carry. Correct at runtime.',
		],
		[
			`generated/S2.jsx: TS2322 Type '{ "data-action": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			'OPEN FINDING 002 - not an artifact. See notes/findings-002-solid-attr-namespace.md.',
		],
		[
			`generated/S2.jsx: TS2322 Type '{ "data-edit": any; value: any; "attr:value": any; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			'OPEN FINDING 002 - not an artifact. See notes/findings-002-solid-attr-namespace.md.',
		],
		[
			`generated/S3.jsx: TS2322 Type '{ "data-action": string; value: any; "attr:value": any; onInput: (event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement; }) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.   Property 'attr:value' does not exist on type 'InputHTMLAttributes<HTMLInputElement>'.`,
			'OPEN FINDING 002 - not an artifact. See notes/findings-002-solid-attr-namespace.md.',
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
		const target = resolve(PACKAGE_ROOT, 'generated/S1.jsx');
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
