import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

// Emitted output is plain .jsx and is otherwise never type-checked. Running the
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

describe('React emitted output type-checks', () => {
	const files = emittedFiles();

	test('every committed emitted component is discovered', () => {
		expect(files.length).toBe(11);
	});

	// TypeScript cannot express some correct-at-runtime JS without annotations.
	// Rather than silence those, every surviving diagnostic is listed here with a
	// reason. The assertion is EXACT EQUALITY, so a new diagnostic fails the lane
	// AND a disappearing one fails too - if an emitter change fixes one of these,
	// this list must be updated deliberately rather than drifting.
	const ACCEPTED: ReadonlyArray<readonly [string, string]> = [
		[
			"generated-composition/C3-ref.jsx: TS2339 Property 'dataset' does not exist on type 'Element'.",
			'ref.current is typed Element; .dataset needs an annotation JS cannot carry. Correct at runtime.',
		],
		[
			"generated-composition/C4-attach.jsx: TS2339 Property 'dataset' does not exist on type 'Element'.",
			'Same as C3-ref: an attach handler reads .dataset off an Element-typed ref. Correct at runtime.',
		],
		[
			"generated-composition/C8-page-store.jsx: TS2339 Property 'increment' does not exist on type 'number | { getCount: () => number; subscribeCount: (listener: any) => () => void; increment(): void; }'.   Property 'increment' does not exist on type 'number'.",
			"usePageLedger returns a number for 'count' and the store otherwise - a value-dependent return type needing overloads. The call site passes the literal 'store', so .increment exists at runtime.",
		],
		[
			"generated-composition/C8-page-store.jsx: TS2322 Type 'number | { getCount: () => number; subscribeCount: (listener: any) => () => void; increment(): void; }' is not assignable to type 'ReactNode'.   Type '{ getCount: () => number; subscribeCount: (listener: any) => () => void; increment(): void; }' is not assignable to type 'ReactNode'.",
			'The same value-dependent union as above, this time rendered as a child. The count branch is what actually renders; the store branch is never reached at this site.',
		],
		[
			"generated/S3.jsx: TS2339 Property 'dataset' does not exist on type 'EventTarget'.",
			'event.target is EventTarget; reading .dataset needs a cast JS cannot carry. Correct at runtime.',
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

		test('a dropped hook import is caught', () => {
			// An emitter that forgets to declare a hook it uses.
			const broken = original.replace(/^import \{[^}]*\} from 'react';$/m, '');
			expect(broken).not.toBe(original);
			const messages = format(diagnose(files, { [target]: broken }));
			expect(messages.join('\n')).toMatch(/Cannot find name '(useState|useRef)'/);
		});

		test('a call to a hook that does not exist is caught', () => {
			// An emitter that emits an API the framework does not have.
			const broken = original.replace("import { useRef, useState } from 'react';", "import { useRef, useState, useStateX } from 'react';") + '\nconst probe = useStateX(0);\n';
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
