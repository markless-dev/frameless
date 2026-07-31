import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

// Emitted output is untyped .tsx and is otherwise never type-checked. Running
// the real TypeScript compiler over it is an INDEPENDENT oracle: unlike the
// gate, which encodes rules we wrote ourselves, tsc is a third party that does
// not know what Frameless intended. It catches undefined identifiers, missing or
// wrong imports, misused framework APIs, and invalid JSX that every other lane
// in this repo would happily wave through.
//
// Props arrive destructured and unannotated by design, so `noImplicitAny` is
// off. That is deliberate scope, not laxity - see
// docs/goals/frameless-testing-ci-v1/notes/T005-emitted-typecheck.md.
//
// THE .jsx -> .tsx MIGRATION SHARPENED THIS LANE, AND THAT WAS NOT PREDICTED.
// Nothing about the emitted BYTES changed - all 42 checked-in emitted files are
// byte-identical to their `.jsx` predecessors - but the extension decides which
// inference TypeScript uses, and the two are not equivalent even with
// `allowJs`/`checkJs` on and `strict` off:
//
//   - in a CHECKED JS file, an empty initialiser (`new Set()`, `[]`) and an
//     uninferrable type parameter fall back to `any`, so every downstream use is
//     silently accepted;
//   - in a TS file the same expressions are `unknown` / `{}`, and every use is
//     reported.
//
// So this lane was reporting 5 diagnostics over `.jsx` and reports 12 over the
// same bytes as `.tsx`. The seven new ones are ALL of that single family and are
// listed in ACCEPTED below with their sites. They are the untyped-emitted-value
// class this phase exists to remove: printing prop types is what deletes them,
// and when it does, the EXACT-EQUALITY assertion turns this file red and forces
// the list to be shortened deliberately.

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

describe('React emitted output type-checks', () => {
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
			'ref.current is typed Element; .dataset needs an annotation JS cannot carry. Correct at runtime.',
		],
		[
			"generated-composition/C4-attach.tsx: TS2339 Property 'dataset' does not exist on type 'Element'.",
			'Same as C3-ref: an attach handler reads .dataset off an Element-typed ref. Correct at runtime.',
		],
		[
			"generated-composition/C8-page-store.tsx: TS2339 Property 'increment' does not exist on type 'number | { getCount: () => number; subscribeCount: (listener: any) => () => void; increment(): void; }'.   Property 'increment' does not exist on type 'number'.",
			"usePageLedger returns a number for 'count' and the store otherwise - a value-dependent return type needing overloads. The call site passes the literal 'store', so .increment exists at runtime.",
		],
		[
			"generated-composition/C8-page-store.tsx: TS2322 Type 'number | { getCount: () => number; subscribeCount: (listener: any) => () => void; increment(): void; }' is not assignable to type 'ReactNode'.   Type '{ getCount: () => number; subscribeCount: (listener: any) => () => void; increment(): void; }' is not assignable to type 'ReactNode'.",
			'The same value-dependent union as above, this time rendered as a child. The count branch is what actually renders; the store branch is never reached at this site.',
		],
		[
			"generated/S3.tsx: TS2339 Property 'dataset' does not exist on type 'EventTarget'.",
			'event.target is EventTarget; reading .dataset needs a cast JS cannot carry. Correct at runtime.',
		],
		// THE SEVEN BELOW ARRIVED WITH THE .jsx -> .tsx MIGRATION, ON UNCHANGED
		// BYTES. Every one is the same shape: an emitted module-store declares its
		// subscriber set as `new Set()`, which is `Set<any>` under checked-JS
		// inference and `Set<unknown>` under TS inference, so iterating it and
		// calling the element is TS2349 only in a TS file. Correct at runtime - the
		// only values ever added are the callbacks `subscribe` is handed. Removing
		// them means annotating the emitted store, which is this phase's later work.
		[
			"generated-composition/C2-shared.tsx: TS2349 This expression is not callable.   Type '{}' has no call signatures.",
			"C2-shared's `advance()` dispatch loop calls `listener()` off `countListeners`, declared `new Set()`.",
		],
		[
			"generated-composition/C2-shared.tsx: TS2349 This expression is not callable.   Type '{}' has no call signatures.",
			"C2-shared's `advance()` dispatch loop calls `listener2()` off `historyListeners`, declared `new Set()`.",
		],
		[
			"generated-composition/C2-shared.tsx: TS2349 This expression is not callable.   Type '{}' has no call signatures.",
			"C2-shared's `advance()` dispatch loop calls `listener3()` off `auditListeners`, declared `new Set()`.",
		],
		[
			"generated-composition/C2-shared.tsx: TS2349 This expression is not callable.   Type '{}' has no call signatures.",
			"C2-shared's `append()` dispatch loop calls `listener4()` off `countListeners`, declared `new Set()`.",
		],
		[
			"generated-composition/C2-shared.tsx: TS2349 This expression is not callable.   Type '{}' has no call signatures.",
			"C2-shared's `append()` dispatch loop calls `listener5()` off `historyListeners`, declared `new Set()`.",
		],
		[
			"generated-composition/C2-shared.tsx: TS2349 This expression is not callable.   Type '{}' has no call signatures.",
			"C2-shared's `append()` dispatch loop calls `listener6()` off `auditListeners`, declared `new Set()`.",
		],
		[
			"generated-composition/C8-page-store.tsx: TS2349 This expression is not callable.   Type '{}' has no call signatures.",
			"C8-page-store's `increment()` dispatch loop calls `listener()` off `countListeners`, declared `new Set()`.",
		],
		// THE TWO BELOW ARE NOT "CORRECT AT RUNTIME" AND THEY ARE THE ONLY ENTRIES
		// IN THIS TABLE THAT ARE NOT. Every other row above says tsc cannot express
		// something JS does correctly. THESE TWO SAY THE EMITTED OUTPUT IS WRONG,
		// and tsc is right: `onDragover` and `onDragstart` are not react props and
		// react-dom will never fire them. THAT IS DEFECTS.md 15, and this table is
		// the first STATIC instrument in the repo that reports it.
		//
		// `frameless-app-fidelity-v1` T004 shipped the drag axis on S16 knowing this
		// lane cannot run it - the compiler's `jsxEventName` does
		// `name.slice(2).toLowerCase()`, which is LOSSLESS with respect to the DOM
		// (`dragover` IS the event name, and five lanes bind by it and work) and
		// destructive only against react-dom's camelCase prop table. The S16 page
		// keeps its arrow buttons for that reason and says so in words.
		//
		// READ WHAT TSC ADDED UNPROMPTED: "Did you mean 'onDragOver'?" - it named
		// the authored spelling the compiler destroyed. AND READ WHAT IT DID NOT
		// COMPLAIN ABOUT: `onDrop`, in the same failing object literal, is typed
		// `(event: DragEvent<HTMLUListElement>) => void`. `onDrop` is ONE word, so
		// `.toLowerCase()` is a no-op on it and it round-trips to react's own prop
		// name. ONE ELEMENT, TWO HANDLERS, AND ONLY THE TWO-WORD ONES ARE BROKEN -
		// which is the whole mechanism of that defect entry in a single diagnostic.
		//
		// FIXING THIS MEANS RECORDING THE WORD BOUNDARY IN THE IR. It is a compiler
		// change and it is not this table's to make; when it lands, these two rows
		// must be DELETED, and the exact-equality assertion below will force that.
		[
			"generated/S16.tsx: TS2322 Type '{ children: Element[]; className: string; \"data-cards\": string; onDragover: (event: any) => void; onDrop: (event: DragEvent<HTMLUListElement>) => void; }' is not assignable to type 'DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>'.   Property 'onDragover' does not exist on type 'DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>'. Did you mean 'onDragOver'?",
			"S16's column drop zone. DEFECTS.md 15: the compiler flattened `onDragOver` to `dragover` and this lane re-spells it `onDragover`, which react-dom does not know. NOT correct at runtime - it is the defect. `onDrop` beside it is fine because it is one word.",
		],
		[
			"generated/S16.tsx: TS2322 Type '{ children: Element[]; key: string; className: string; \"data-card\": string; \"data-dragging\": string; draggable: boolean; onDragstart: (event: any) => void; onDragend: (event: any) => void; }' is not assignable to type 'DetailedHTMLProps<LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>'.   Property 'onDragstart' does not exist on type 'DetailedHTMLProps<LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>'. Did you mean 'onDragStart'?",
			"S16's draggable card, same defect on the source element. Note `draggable: boolean` types CLEANLY: the fixture BINDS it rather than spelling `draggable=\"true\"`, which is what keeps the qwik lane's `draggable?: boolean` diagnostic off this axis entirely.",
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
