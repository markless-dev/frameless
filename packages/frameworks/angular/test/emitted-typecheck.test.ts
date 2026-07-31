import { readdirSync } from 'node:fs';
import { buildEnrichedIr } from '@frameless/compiler';
import { resolve } from 'pathe';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { emit } from '../src/emitter/index.ts';
import { formatEmitted } from '../src/format-emitted.ts';
import { isUnbuiltEmitted } from './unbuilt-scenarios.ts';
import { isUngatedEmitted } from './ungated-scenarios.ts';

/**
 * THE MISSING ORACLE. `frameless-defects-and-targets-v1` T043 §1.3 measured that
 * ANGULAR WAS THE ONLY LANE IN THIS REPO THAT EMITS TYPESCRIPT AND TYPECHECKS
 * NONE OF IT. React and Solid each run a real `tsc` over their emitted `.jsx`;
 * Svelte and Vue each run their framework's own compiler over their emitted SFC.
 * This lane had `parse-emitted.test.ts`, which checks the TEMPLATE grammar via
 * `parseTemplate` - it never looks at the class body. So every construct that is
 * grammar-valid TypeScript-shaped text but type-invalid shipped silently, and
 * the dropped `async` (DEFECTS.md entry 9) is one instance of that hole, not the
 * hole itself. THE INSTRUMENT IS THE REPAIR.
 *
 * Angular is the acute case precisely because it is the only lane emitting
 * TypeScript-SPECIFIC syntax - class methods, return annotations, decorators -
 * where a string that parses can still be type-invalid.
 *
 * WHY THIS IS A VITEST FILE AND NOT `include: ["generated/**"]` IN
 * `tsconfig.json`. Routing emitted output into `pnpm check` would make the lane
 * PERMANENTLY RED: `packages/frameworks/angular` is deliberately free of
 * `@angular/core` (see `test/toolchain.test.ts` - that ABSENCE is the structural
 * guarantee that Vite 7 and Vite 8 never meet in one package,
 * `frameless-angular-v1` T002 ruling 1), so the import cannot resolve here by
 * construction and never will. Adding the dependency to satisfy a typechecker
 * would trade a real toolchain guarantee for a convenience.
 *
 * THE ORACLE THEREFORE ASSERTS "NO DIAGNOSTIC OTHER THAN TS2307 FOR
 * '@angular/*'". That is not a blanket suppression: exactly one unresolved
 * module is expected, per file, by name, and `calibration` below watches the
 * lane reject output that a real emitter bug would produce - including a SECOND
 * TS2307 for a module that is not Angular's.
 *
 * Props and members arrive annotated `: any` by design (`MEMBER_TYPE`), so
 * `strict` is off: under `strict` the emitted class fields would report
 * TS2564 `has no initializer` for every state local, which is a property of
 * checking deliberately-untyped generated code, not evidence of an emitter
 * defect. A lane that reports a diagnostic per field is as useless as one that
 * cannot fail. What survives is the class that IS meaningful for generated code
 * - undefined identifiers, missing imports, nonexistent APIs, and the
 * ILLEGAL-CONSTRUCT grammar errors like TS1308 that this file was built for.
 */

const PACKAGE_ROOT = resolve(import.meta.dirname, '..');
const GENERATED_ROOT = resolve(PACKAGE_ROOT, 'generated');
const COMPILER_GOLDEN_ROOT = resolve(PACKAGE_ROOT, '../../compiler/test/goldens');

/**
 * T043 §10's measured recipe, which is what makes this oracle reproducible
 * outside vitest: `tsc --noEmit --skipLibCheck --target es2022 --module esnext
 * --moduleResolution bundler --experimentalDecorators`.
 */
const compilerOptions: ts.CompilerOptions = {
	noEmit: true,
	strict: false,
	target: ts.ScriptTarget.ES2022,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	experimentalDecorators: true,
	lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
	skipLibCheck: true,
	types: [],
};

/** Numeric, so S10 sorts after S9 rather than between S1 and S2. */
function byScenarioNumber(left: string, right: string): number {
	return Number(/(\d+)/.exec(left)![1]) - Number(/(\d+)/.exec(right)![1]);
}

/**
 * THE EXPECTED INVENTORY IS DERIVED, NOT A HAND-EDITED COUNT - the pattern this
 * repo's other emitted-output lanes converged on after a literal `['S1','S2','S3']`
 * in `parse-emitted.test.ts` went on reporting SUCCESS over a corpus it had
 * silently stopped covering. The derivation source is the compiler's ratified
 * goldens, which are INDEPENDENT of `generated/`: one is the IR this repo agreed
 * to compile, the other is what the emitter actually wrote.
 */
function expectedEmittedFiles(goldenRoot = COMPILER_GOLDEN_ROOT): string[] {
	const files = readdirSync(goldenRoot)
		.map((entry) => /^s(\d+)-[\w-]+\.json$/.exec(entry)?.[1])
		.filter((digits): digits is string => digits !== undefined)
		.map((digits) => resolve(GENERATED_ROOT, `S${digits}.ts`))
		// The subtraction declared in `unbuilt-scenarios.ts`. `emitter.test.ts`
		// asserts the underlying refusal is live, so this is not a skip list.
		.filter((file) => !isUnbuiltEmitted(file) && !isUngatedEmitted(file))
		.sort(byScenarioNumber);
	// Fail LOUD rather than returning []. Two empty lists comparing equal is the
	// one way a derived inventory could be greener than the count it replaced.
	if (files.length === 0) throw new Error(`no s<n>-*.json scenario goldens found in ${goldenRoot}`);
	return files;
}

/** What the emitter actually wrote - the other side of the cross-check. */
function emittedFiles(root = GENERATED_ROOT): string[] {
	return readdirSync(root)
		.filter((entry) => /^S\d+\.ts$/.test(entry))
		.filter((entry) => !isUnbuiltEmitted(entry) && !isUngatedEmitted(entry))
		.map((entry) => resolve(root, entry))
		.sort(byScenarioNumber);
}

/** Type-check `files`, optionally substituting or inventing file contents. */
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
	diagnostics
		.map((diagnostic) => {
			const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
			const file = diagnostic.file?.fileName.replace(`${PACKAGE_ROOT}/`, '') ?? '<none>';
			return `${file}: TS${diagnostic.code} ${message}`;
		})
		.sort();

/**
 * The ONE expected diagnostic per emitted file, matched by CODE AND MODULE NAME.
 * A TS2307 for any other module - a mis-emitted relative import, say - is not
 * covered by this and fails the lane.
 */
const EXPECTED_UNRESOLVED_ANGULAR =
	/^.*: TS2307 Cannot find module '@angular\/[\w-]+' or its corresponding type declarations\.$/;

const unexpected = (diagnostics: ts.Diagnostic[]) =>
	format(diagnostics).filter((message) => !EXPECTED_UNRESOLVED_ANGULAR.test(message));

/** Type-check one emitted-source string under a virtual filename. */
function diagnoseSource(source: string, filename = 'probe.ts'): string[] {
	const virtual = resolve(GENERATED_ROOT, filename);
	return unexpected(diagnose([virtual], { [virtual]: source }));
}

/**
 * A planted authoring, emitted through the REAL pipeline - `buildEnrichedIr` then
 * `emit` then `formatEmitted`, the exact three calls `scripts/regenerate.ts`
 * makes. Nothing here is registered: no golden, no fixture, no `generated/` byte.
 * S8 is blocked on T046 and T047, and a golden alone would enlist a scenario into
 * every lane's derived gates at once.
 *
 * The awaited value is a PROMISE-VALUED PROP, per T043 §6. It must not be a free
 * global (`await Promise.resolve()`) because Angular's globals v-limit refuses
 * `Promise` and THAT REFUSAL IS CORRECT, and it must not be a callback-prop call
 * (`await settle()`) because Qwik's callback-statement rule refuses it and that
 * refusal is correct too. Authoring AROUND a designed v-limit is what T030 did
 * for S7 with `aria-disabled`; widening a gate to admit a probe is what this
 * board's charter forbids.
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

/** T043 §6's re-specified S8 body: `async` WITH an `await`. */
const ASYNC_WITH_AWAIT = `async (event) => {
				phase = 'pending';
				await ready;
				ticks = ticks + 1;
				phase = 'done';
			}`;

/** T043 §1.1's A3: `async` with NO `await`. The one no oracle can catch. */
const ASYNC_WITHOUT_AWAIT = `async (event) => {
				phase = 'pending';
				ticks = ticks + 1;
				onTrace('run', { phase: 'done' });
			}`;

/** The synchronous control, so "async is carried" is not vacuously true. */
const PLAIN_SYNC = `(event) => {
				phase = 'pending';
				ticks = ticks + 1;
			}`;

describe('Angular emitted output type-checks', () => {
	test('every committed emitted component is discovered, and tsc is given all of them', () => {
		const expected = expectedEmittedFiles();
		// THE FLOOR, so a derivation that quietly lost a scenario cannot pass.
		expect(expected).toEqual(
			expect.arrayContaining(
				['S1', 'S2', 'S3', 'S4'].map((name) => resolve(GENERATED_ROOT, `${name}.ts`)),
			),
		);
		const files = emittedFiles();
		expect(files).toEqual(expected);
		// AND the program tsc actually built covers them. `files` is what is handed
		// to `diagnose()`; this proves the compiler took the whole set rather than
		// resolving a subset of it.
		const program = ts.createProgram(files, compilerOptions);
		expect(
			program
				.getSourceFiles()
				.map((source) => source.fileName)
				.filter((name) => name.startsWith(GENERATED_ROOT))
				.sort(byScenarioNumber),
		).toEqual(expected);
	});

	test('the shipped corpus reports NOTHING but the expected unresolved @angular/* import', () => {
		const files = emittedFiles();
		const diagnostics = diagnose(files);
		expect(unexpected(diagnostics)).toEqual([]);
		// AND the expected diagnostic really is there, once per file. Without this
		// half, an options change that stopped resolving anything at all would look
		// identical to a clean corpus.
		expect(format(diagnostics)).toHaveLength(files.length);
	});

	/**
	 * CALIBRATION. A lane nobody has watched fail is not evidence. Each case below
	 * breaks one emitted file the way a real emitter bug would and proves this lane
	 * rejects it. If these ever stop failing, the oracle has gone blind.
	 */
	describe('calibration: rejects emitted output that a real emitter bug would produce', () => {
		const target = resolve(GENERATED_ROOT, 'S1.ts');
		const files = emittedFiles();
		const original = () => diagnose(files);

		test('the unmutated corpus is the baseline', () => {
			expect(unexpected(original())).toEqual([]);
		});

		test('an undeclared member read is caught', () => {
			// An emitter that qualifies a name it never promoted to a class member.
			const broken = ts.sys.readFile(target)!.replace('this.count', 'this.notAMember');
			expect(broken).not.toBe(ts.sys.readFile(target));
			expect(unexpected(diagnose(files, { [target]: broken })).join('\n')).toMatch(
				/Property 'notAMember' does not exist/,
			);
		});

		test('a second unresolved import is caught, so the @angular/* allowance is narrow', () => {
			// The allowance is by MODULE NAME, not by diagnostic code: a mis-emitted
			// relative import must still fail even though it is also a TS2307.
			const broken = `import { helper } from './nowhere.ts';\n${ts.sys.readFile(target)!}\nhelper();\n`;
			expect(unexpected(diagnose(files, { [target]: broken })).join('\n')).toMatch(
				/TS2307 Cannot find module '\.\/nowhere\.ts'/,
			);
		});

		test('an illegal construct in the class body is caught', () => {
			// THE CLASS OF BUG THIS FILE EXISTS FOR, and the one `parse-emitted.test.ts`
			// is structurally unable to see: the TEMPLATE is untouched and still parses.
			const broken = ts.sys.readFile(target)!.replace('this.count++;', 'await this.count;');
			expect(broken).not.toBe(ts.sys.readFile(target));
			expect(unexpected(diagnose(files, { [target]: broken })).join('\n')).toMatch(/TS1308/);
		});
	});

	/**
	 * RED CALIBRATION 1 - the planted async authoring.
	 *
	 * BEFORE the entry-9 repair this test FAILED, and its failure is the whole
	 * proof that the oracle is an instrument rather than decoration:
	 *
	 *   generated/async-with-await.ts: TS1308 'await' expressions are only allowed
	 *   within async functions and at the top levels of modules.
	 *
	 * `qualify()` transplanted the arrow's BODY into the class-method template at
	 * `src/emitter/index.ts` and the arrow's `async` modifier had nowhere to go -
	 * the string `async` occurred ZERO times in that file. The `await` survived
	 * into a method that was not async, which is invalid TypeScript that no
	 * instrument in this package was looking at.
	 */
	test('RED CALIBRATION 1: an authored async handler with await emits type-valid TypeScript', async () => {
		const source = await emitHandler(ASYNC_WITH_AWAIT);
		// The construct really is present, so a compiler change that silently
		// dropped the `await` could not make this pass by emitting nothing.
		expect(source).toMatch(/await this\.ready;/);
		expect(diagnoseSource(source, 'async-with-await.ts')).toEqual([]);
	});

	/**
	 * RED CALIBRATION 2 - THE CASE THIS ORACLE CANNOT CATCH, asserted as a
	 * standing statement of the instrument's LIMIT rather than left implicit.
	 *
	 * When the authored arrow is `async` and contains no `await`, dropping the
	 * keyword yields PERFECTLY VALID TypeScript: the method just returns `void`
	 * instead of `Promise<void>` and every caller that awaited it silently awaits a
	 * non-promise. No typecheck oracle anywhere - not this one, not a perfect one -
	 * can see that, because nothing about it is a type error.
	 *
	 * ONE INSTRUMENT IS INSUFFICIENT BY CONSTRUCTION. The keyword itself is
	 * asserted directly in `emitter.test.ts`. This test proves the oracle is blind
	 * here, and it stays green both before and after the repair - which is exactly
	 * the point.
	 */
	test('RED CALIBRATION 2: the oracle is BLIND to async-without-await, before and after the repair', async () => {
		const source = await emitHandler(ASYNC_WITHOUT_AWAIT);
		expect(diagnoseSource(source, 'async-without-await.ts')).toEqual([]);
		// And the blindness is not an artifact of the probe emitting nothing: the
		// handler is really there, and after the repair it really is async. Only
		// `emitter.test.ts` can tell those two apart.
		expect(source).toMatch(/onH\d+Click\(event: any\)/);
	});

	test('the synchronous control emits type-valid TypeScript too', async () => {
		const source = await emitHandler(PLAIN_SYNC);
		expect(diagnoseSource(source, 'plain-sync.ts')).toEqual([]);
	});
});
