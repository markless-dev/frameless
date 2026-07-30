#!/usr/bin/env node
/**
 * T001 SUPPORTING ARM - IS "EMITS" THE SAME AS "EMITS SOMETHING VALID"?
 *
 *   node probes/async-door/typecheck.mjs
 *
 * `run.mjs` records EMITS whenever `emit(ir)` returns without throwing. For five
 * of the six lanes that is already a strong claim, because those emitters verify
 * their own output before returning - react and qwik re-analyze the emitted
 * module (`failed collision verification` / `failed output verification`), vue
 * runs `compileScript` in all four ssr/prod modes, svelte runs the svelte
 * compiler. Their refusals in `run.mjs` are those verifiers firing.
 *
 * THE ANGULAR EMITTER HAS NO SUCH STEP, so its EMITS is only "the emitter did not
 * throw". This arm closes that asymmetry the only way that settles it: write the
 * emitted bytes out and hand them to `tsc`.
 *
 * The emitted output is written under `emitted/`, which is gitignored - it is
 * derived, and regenerating it is one command.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SOURCES = resolve(HERE, 'sources');
const OUT = resolve(HERE, 'emitted');

const { buildEnrichedIr } = await import(`${ROOT}/packages/compiler/src/index.ts`);
const { emit: emitAngular } = await import(
	`${ROOT}/packages/frameworks/angular/src/emitter/index.ts`
);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const written = [];
for (const file of readdirSync(SOURCES).sort()) {
	if (!file.endsWith('.tsrx')) continue;
	const source = readFileSync(resolve(SOURCES, file), 'utf8');
	let ir;
	try {
		ir = await buildEnrichedIr({ filename: `src/${file}`, source });
	} catch {
		continue; // refused before the emitters; nothing to type-check
	}
	let bytes;
	try {
		bytes = emitAngular(ir);
	} catch {
		continue; // the angular emitter refused; `run.mjs` already recorded why
	}
	const name = `${file.replace(/\.tsrx$/, '')}.ts`;
	writeFileSync(resolve(OUT, name), bytes);
	written.push(name);
}

console.log(`angular lane: emitted ${written.length} module(s) -> probes/async-door/emitted/`);
for (const name of written) console.log(`  ${name}`);
console.log();

/**
 * `--noResolve` with no lib and no @angular types on purpose: this arm is asking
 * whether the emitted bytes are WELL-FORMED TypeScript, not whether Angular's
 * decorators type-check.
 *
 * IT DOES NOT SILENCE THE MISSING MODULE - measured, `--noResolve` still reports
 * one TS2792 for `@angular/core` per file. That noise is left in rather than
 * suppressed because it is UNIFORM: every emitted file gets exactly one, so it
 * cannot be mistaken for the signal. The signal is TS1308, and the whole value
 * of this arm is that TS1308 appears on the async-computed scenarios and on
 * NONE of the async-handler ones - a difference the constant noise cannot fake.
 */
const tsc = resolve(ROOT, 'node_modules/.bin/tsc');
let output = '';
let code = 0;
try {
	output = execFileSync(
		tsc,
		[
			'--noEmit',
			'--noResolve',
			'--target',
			'es2022',
			'--module',
			'esnext',
			'--experimentalDecorators',
			'--pretty',
			'false',
			...written.map((name) => resolve(OUT, name)),
		],
		{ encoding: 'utf8', cwd: ROOT },
	);
} catch (error) {
	output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
	code = error.status ?? 1;
}

console.log(output.trim() || '(tsc reported nothing)');
console.log(`\ntsc exit=${code}`);
