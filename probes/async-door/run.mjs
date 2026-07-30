#!/usr/bin/env node
/**
 * T001 - THE DATA-FETCHING DOOR. Re-runnable driver.
 *
 *   node probes/async-door/run.mjs            # table + per-lane verdicts
 *   node probes/async-door/run.mjs --shapes   # also print the emitted bytes
 *
 * WHAT THIS MEASURES, AND WHY IT IS TWO STAGES RATHER THAN ONE. The board's
 * question is "does `computed(async ...)` emit, refuse, or misbehave, per lane".
 * A single-stage probe cannot answer it, because there are TWO gates in front of
 * the six emitters and they refuse for different reasons:
 *
 *   stage 1  the Markless semantic compiler (`@markless/compiler`, vendored)
 *   stage 2  the Frameless IR builder (`buildEnrichedIr`, this repo)
 *   stage 3  the six emitters (`emit(ir)`, this repo)
 *
 * A probe that only ran stage 3 would report six identical "unreachable"s and
 * learn nothing about WHICH gate is shut. Every scenario below is therefore
 * driven all the way through and its verdict recorded at the stage it stopped.
 *
 * NOTHING HERE IS INSTALLED AND NOTHING IS A WORKSPACE MEMBER. The imports are
 * relative paths into `packages/`, so Node resolves each package's own
 * dependencies from its own directory. Disposable evidence: delete this
 * directory and nothing in the product tree changes.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SOURCES = resolve(HERE, 'sources');

const { buildEnrichedIr } = await import(`${ROOT}/packages/compiler/src/index.ts`);

/**
 * THE LANE ORDER IS THE REPO'S, not alphabetical: it is the order `pnpm check`
 * runs the six projects in, so a reader comparing this table against a check
 * log reads them off in the same sequence.
 */
const LANES = ['react', 'solid', 'qwik', 'svelte', 'vue', 'angular'];

const emitters = {};
for (const lane of LANES) {
	const mod = await import(`${ROOT}/packages/frameworks/${lane}/src/emitter/index.ts`);
	emitters[lane] = mod.emit;
}

const wantShapes = process.argv.includes('--shapes');

/** Verbatim-first: never paraphrase a thrown message, never truncate it. */
function attempt(run) {
	try {
		return { ok: true, value: run() };
	} catch (error) {
		return { ok: false, message: error instanceof Error ? error.message : String(error) };
	}
}

async function attemptAsync(run) {
	try {
		return { ok: true, value: await run() };
	} catch (error) {
		return { ok: false, message: error instanceof Error ? error.message : String(error) };
	}
}

const results = [];

for (const file of readdirSync(SOURCES).sort()) {
	if (!file.endsWith('.tsrx')) continue;
	const source = readFileSync(resolve(SOURCES, file), 'utf8');
	const name = file.replace(/\.tsrx$/, '');

	const compiled = await attemptAsync(() =>
		buildEnrichedIr({ filename: `src/${file}`, source }),
	);

	if (!compiled.ok) {
		// Which gate refused is legible from the message: the Markless compiler
		// prefixes its own diagnostics with `Markless semantic compilation failed`.
		const stage = compiled.message.startsWith('Markless semantic compilation failed')
			? 'markless-compiler'
			: 'frameless-ir';
		results.push({ name, stage, refusal: compiled.message, lanes: null });
		continue;
	}

	const ir = compiled.value;
	const asyncBindings = ir.records.bindings
		.filter((binding) => binding.async || binding.asyncCapable)
		.map((binding) => `${binding.kind}:${binding.name}`);

	const lanes = {};
	for (const lane of LANES) {
		const emitted = attempt(() => emitters[lane](ir));
		lanes[lane] = emitted.ok
			? { verdict: 'EMITS', bytes: emitted.value }
			: { verdict: 'REFUSES', message: emitted.message };
	}
	results.push({ name, stage: 'emitters', asyncBindings, lanes });
}

// ---------------------------------------------------------------- report

const width = Math.max(...results.map((r) => r.name.length));

console.log('\n=========== THE DATA-FETCHING DOOR: SIX LANES ===========\n');

for (const result of results) {
	console.log(`----- ${result.name} -----`);
	if (result.lanes === null) {
		console.log(`  REFUSED AT: ${result.stage}   (ALL SIX LANES - never reaches an emitter)`);
		console.log(`  VERBATIM:   ${result.refusal}`);
		console.log();
		continue;
	}
	console.log(
		`  reached the emitters. async bindings in the IR: ${
			result.asyncBindings.length ? result.asyncBindings.join(', ') : '(none)'
		}`,
	);
	for (const lane of LANES) {
		const entry = result.lanes[lane];
		if (entry.verdict === 'EMITS') {
			console.log(`  ${lane.padEnd(8)} EMITS    (${entry.bytes.length} bytes)`);
		} else {
			console.log(`  ${lane.padEnd(8)} REFUSES  ${entry.message}`);
		}
	}
	console.log();
}

console.log('=========== MATRIX ===========\n');
console.log(`${'scenario'.padEnd(width)}  ${LANES.map((l) => l.padEnd(8)).join('')}`);
for (const result of results) {
	const cells = LANES.map((lane) => {
		if (result.lanes === null) return 'n/a'.padEnd(8);
		return (result.lanes[lane].verdict === 'EMITS' ? 'EMITS' : 'REFUSES').padEnd(8);
	});
	console.log(`${result.name.padEnd(width)}  ${cells.join('')}`);
}
console.log();

if (wantShapes) {
	console.log('=========== EMITTED SHAPES ===========\n');
	for (const result of results) {
		if (result.lanes === null) continue;
		for (const lane of LANES) {
			const entry = result.lanes[lane];
			if (entry.verdict !== 'EMITS') continue;
			console.log(`########## ${result.name} / ${lane} ##########`);
			console.log(entry.bytes);
			console.log();
		}
	}
}
