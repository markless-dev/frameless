/**
 * The corpus mutation harness.
 *
 * `pnpm e2e` ends by printing "N demos x M scenarios, all observations equal".
 * That sentence is only worth reading if a deliberate break of the corpus can
 * make it stop being true. This file is the instrument that establishes it.
 *
 * For one (lane, scenario) pair it:
 *
 *   1. applies ONE byte-verified text mutation to
 *      `packages/frameworks/<lane>/generated/<S>.<ext>`,
 *   2. runs that lane's witness box,
 *   3. REQUIRES a failure, and records whether the red came from the lane's own
 *      in-box assertion or from the cross-lane observation diff,
 *   4. restores the file from git and VERIFIES the restoration.
 *
 * ## Why `generated/` and not the demo copy
 *
 * Every demo's `copy-emitted` script runs first in `dev`/`build`/`build:e2e` and
 * would overwrite a mutation placed in each demo's own `src/emitted/`.
 * `packages/frameworks/<lane>/generated/` is the only mutation point upstream of
 * that copy. Ruled in `docs/goals/frameless-defects-and-targets-v1/notes/T024-corpus-breadth.md` §5.
 *
 * ## The two guards, inherited from T018
 *
 * 1. `mutate()` THROWS when its output is byte-identical to its input, and
 *    `replaceOnce` THROWS unless its anchor occurs exactly once. A no-op mutant
 *    that "passes" is the vacuity this exists to prevent, and this repo has
 *    shipped that exact fault before.
 * 2. Restoration is verified with `git status --porcelain` over the whole
 *    mutation surface — the six `generated/` directories AND the six demo
 *    `emitted/` copies, all of which are tracked. A harness that leaves a mutant
 *    on disk poisons every run after it.
 *
 * ## Two-sided, and the baseline is the positive arm
 *
 * Every lane is run CLEAN first. That run must pass and must record observations
 * for every requested scenario; those observations are the baseline the mutant
 * run is diffed against. An instrument that only ever observes red cannot tell a
 * killed mutant from a broken harness, so both arms are taken on every lane, on
 * every invocation.
 *
 * ## The three verdicts
 *
 * | box run     | observations   | verdict                                   |
 * | ----------- | -------------- | ----------------------------------------- |
 * | failed      | —              | RED at the lane's own in-box assertion    |
 * | passed      | differ         | RED at the cross-lane observation diff    |
 * | passed      | identical      | SURVIVOR — an open FINDING, not a pass    |
 *
 * A survivor is reported with its lane, its scenario, its axis and its mutant
 * verbatim, and the process exits non-zero. It is NOT patched over and no
 * existing assertion is weakened to accommodate it.
 *
 * ## Calibrating the classifier itself
 *
 * `--calibrate-classifier` runs one fixed mutant, chosen so that every in-box
 * assertion still passes and only an observation string moves. It is the known
 * member of the second verdict class, and without it the `cross-lane
 * observation diff` branch would be a verdict nobody had ever seen fire. See
 * `CLASSIFIER_CALIBRATION`.
 *
 * Usage:
 *   pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3
 *   pnpm mutate:corpus --scenario s2 --lane angular
 *   pnpm mutate:corpus --calibrate-classifier
 *   pnpm mutate:corpus --dry-run --scenario s1   # anchors only, no verdict
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const workspace = resolve(import.meta.dirname, '..');

// ---------------------------------------------------------------------------
// The mutation surface
// ---------------------------------------------------------------------------

/**
 * Every path a run of this harness may write to, relative to the workspace.
 *
 * The demo `emitted/` copies are listed because they are TRACKED, not ignored:
 * `copy-emitted` writes a mutated component into the working tree too, so
 * restoring only `generated/` would leave the mutant live for `pnpm e2e`.
 */
const MUTATION_SURFACE = [
	'packages/frameworks/react/generated',
	'packages/frameworks/solid/generated',
	'packages/frameworks/qwik/generated',
	'packages/frameworks/svelte/generated',
	'packages/frameworks/vue/generated',
	'packages/frameworks/angular/generated',
	'demos/react-official/src/emitted',
	'demos/solid-official/src/emitted',
	'demos/qwik/src/emitted',
	'demos/svelte-official/src/lib/emitted',
	'demos/vue-official/src/emitted',
	'demos/angular-official/src/emitted',
];

/**
 * The six official demo lanes, in `scripts/e2e.mjs` order.
 *
 * `prepare` is the script run before the box, and it is the demo's OWN script —
 * the same one `pnpm e2e` runs — so the harness cannot drift from the pipeline
 * it is measuring. Angular's is `build:e2e` because its scaffold owns its build
 * outright and nothing runs until `ng build` has produced `dist/`.
 */
const LANES = [
	{
		framework: 'react',
		activation: 'hydrate',
		directory: 'demos/react-official',
		generated: 'packages/frameworks/react/generated',
		extension: 'jsx',
	},
	{
		framework: 'solid',
		activation: 'hydrate',
		directory: 'demos/solid-official',
		generated: 'packages/frameworks/solid/generated',
		extension: 'jsx',
	},
	{
		framework: 'qwik',
		activation: 'resume',
		directory: 'demos/qwik',
		generated: 'packages/frameworks/qwik/generated',
		extension: 'jsx',
	},
	{
		framework: 'svelte',
		activation: 'hydrate',
		directory: 'demos/svelte-official',
		generated: 'packages/frameworks/svelte/generated',
		extension: 'svelte',
	},
	{
		framework: 'vue',
		activation: 'hydrate',
		directory: 'demos/vue-official',
		generated: 'packages/frameworks/vue/generated',
		extension: 'vue',
	},
	{
		framework: 'angular',
		activation: 'hydrate',
		directory: 'demos/angular-official',
		generated: 'packages/frameworks/angular/generated',
		extension: 'ts',
		prepare: 'build:e2e',
	},
];

const SCENARIO_FILES = { s1: 'S1', s2: 'S2', s3: 'S3', s4: 'S4' };

// ---------------------------------------------------------------------------
// Byte-verified text surgery
// ---------------------------------------------------------------------------

/**
 * Replace `find` with `replacement`, and refuse unless `find` occurs EXACTLY
 * once.
 *
 * The count check is the half that matters. A mutant anchored on a string that
 * has stopped occurring silently becomes a no-op, and a no-op mutant reports the
 * corpus as unkillable when in fact nothing was killed; a mutant anchored on a
 * string that now occurs twice mutates a site nobody chose. Both fail loudly
 * here rather than being discovered as a wrong verdict later.
 */
function replaceOnce(text, find, replacement) {
	const occurrences = text.split(find).length - 1;
	if (occurrences !== 1) {
		throw new Error(
			`Mutation anchor occurs ${occurrences} times, expected exactly 1:\n${JSON.stringify(find)}`,
		);
	}
	return text.replace(find, replacement);
}

/**
 * Applies one mutant and proves it changed the bytes.
 *
 * T018 converted 126 rows to exactly this discipline: a mutant whose output is
 * byte-identical to its input has tested nothing, and a harness that reports it
 * as "not caught" — or worse, as "caught" — is the vacuity the discipline
 * exists to prevent.
 */
function mutate(source, mutant) {
	const mutated = mutant.apply(source);
	if (typeof mutated !== 'string') {
		throw new Error(`Mutant ${mutant.id} did not return a string.`);
	}
	if (mutated === source) {
		throw new Error(
			`Mutant ${mutant.id} is byte-identical to its input. A no-op mutant proves nothing.`,
		);
	}
	return mutated;
}

// ---------------------------------------------------------------------------
// The ratified mutants
//
// One per (lane, scenario). Each names the AXIS it attacks — the thing the
// scenario claims to prove — and is spelled in that lane's own emitted idiom
// rather than being inherited from another lane. `text` is the verbatim mutant,
// reproduced in the receipt and in the note.
// ---------------------------------------------------------------------------

/** S1's axis: the derived value RECOMPUTES after the one state transition. */
const s1DerivedFrozen = (find, replacement) => ({
	axis: 'derived recomputation after a state transition',
	text: `${find}  ->  ${replacement}`,
	expect: 'derived reads kit:2 after the increment click instead of kit:4',
	apply: (source) => replaceOnce(source, find, replacement),
});

/** S2's axis: the KEYED-REPEAT construct renders the whole collection. */
const s2CollectionTruncated = (find, replacement) => ({
	axis: 'the keyed-repeat construct itself — which rows it renders',
	text: `${find}  ->  ${replacement}`,
	expect: 'the first <li> reads data-oracle-row-key="b" instead of "a"',
	apply: (source) => replaceOnce(source, find, replacement),
});

/** S3's axis: cancellation reaches the browser DURING dispatch. */
const s3CancellationDropped = (find, replacement) => ({
	axis: "cancellation of a real default action during dispatch",
	text: `${find}  ->  ${replacement}`,
	expect: 'the cancel-submit click really submits, so a second Document request lands',
	apply: (source) => replaceOnce(source, find, replacement),
});

const MUTANTS = {
	react: {
		s1: s1DerivedFrozen('${count * multiplier}', '${1 * multiplier}'),
		s2: s2CollectionTruncated('{todos.map((todo) => (', '{todos.slice(1).map((todo) => ('),
		s3: s3CancellationDropped(
			'data-action="cancel-submit"\n\t\t\t\tonClick={(event) => {\n\t\t\t\t\tevent.preventDefault();\n\t\t\t\t}}',
			'data-action="cancel-submit"\n\t\t\t\tonClick={(event) => {\n\t\t\t\t\tvoid event;\n\t\t\t\t}}',
		),
	},
	solid: {
		s1: s1DerivedFrozen('${count() * props.multiplier}', '${1 * props.multiplier}'),
		s2: s2CollectionTruncated('<For each={todos}>', '<For each={todos.slice(1)}>'),
		s3: s3CancellationDropped(
			'data-action="cancel-submit"\n\t\t\t\tonClick={(event) => {\n\t\t\t\t\tevent.preventDefault();\n\t\t\t\t}}',
			'data-action="cancel-submit"\n\t\t\t\tonClick={(event) => {\n\t\t\t\t\tvoid event;\n\t\t\t\t}}',
		),
	},
	qwik: {
		s1: s1DerivedFrozen('${count.value * props.multiplier}', '${1 * props.multiplier}'),
		s2: s2CollectionTruncated('{todos.map((todo) => (', '{todos.slice(1).map((todo) => ('),
		s3: s3CancellationDropped(
			'data-action="cancel-submit"\n\t\t\t\tonClick$={[\n\t\t\t\t\tsync$((event) => {\n\t\t\t\t\t\tevent.preventDefault();\n\t\t\t\t\t}),\n\t\t\t\t]}',
			'data-action="cancel-submit"\n\t\t\t\tonClick$={[\n\t\t\t\t\tsync$((event) => {\n\t\t\t\t\t\tvoid event;\n\t\t\t\t\t}),\n\t\t\t\t]}',
		),
	},
	svelte: {
		s1: s1DerivedFrozen('${count * multiplier}', '${1 * multiplier}'),
		s2: s2CollectionTruncated(
			'{#each todos as todo (todo.id)}',
			'{#each todos.slice(1) as todo (todo.id)}',
		),
		s3: s3CancellationDropped(
			'data-action="cancel-submit"\n\t\tonclick={(event) => {\n\t\t\tevent.preventDefault();\n\t\t}}',
			'data-action="cancel-submit"\n\t\tonclick={(event) => {\n\t\t\tvoid event;\n\t\t}}',
		),
	},
	vue: {
		s1: s1DerivedFrozen('${count.value * props.multiplier}', '${1 * props.multiplier}'),
		s2: s2CollectionTruncated('v-for="todo in todos"', 'v-for="todo in todos.slice(1)"'),
		s3: s3CancellationDropped(
			'data-action="cancel-submit"\n\t\t\t@click="(event) => {\n\t\t\t\tevent.preventDefault();\n\t\t\t}"',
			'data-action="cancel-submit"\n\t\t\t@click="(event) => {\n\t\t\t\tvoid event;\n\t\t\t}"',
		),
	},
	angular: {
		s1: s1DerivedFrozen('${this.count * this.multiplier}', '${1 * this.multiplier}'),
		s2: s2CollectionTruncated(
			'@for (todo of todos; track todo.id)',
			'@for (todo of todos.slice(1); track todo.id)',
		),
		s3: s3CancellationDropped(
			'\tonH4Click(event: any): void {\n\t\tevent.preventDefault();\n\t}',
			'\tonH4Click(event: any): void {\n\t\tvoid event;\n\t}',
		),
	},
};

/**
 * The mutant that calibrates the harness's SECOND verdict, and why it exists.
 *
 * Every one of the eighteen ratified mutants above is caught by the lane's own
 * in-box assertion. That is a good result for the corpus and a bad one for this
 * harness: it means the `cross-lane observation diff` branch of the classifier
 * has never issued a verdict, and a verdict path never observed firing is not a
 * verdict path. An instrument that issues a verdict has to be calibrated against
 * a known member of each class it claims to distinguish.
 *
 * So this mutant is chosen to land in the OTHER class. `assertS2`'s last step
 * asserts only that `[data-empty="true"]` EXISTS; the element's text is read by
 * `measureText` into the observation string and asserted nowhere. Renaming it
 * therefore leaves every in-box assertion satisfied and changes exactly one of
 * the observation strings `pnpm e2e` diffs across the six lanes.
 *
 * It is also the sharper half of the T024 question. "Every lane went red" would
 * still be true of a corpus whose eighteen observation strings were decorative,
 * because the in-box assertions would have caught everything on their own. This
 * is the arm that shows the strings themselves carry signal.
 *
 * The anchor is byte-identical in all six emitted files, which is not an
 * assumption: `replaceOnce` refuses unless it occurs exactly once in the file it
 * is handed, per lane, on every run.
 */
const CLASSIFIER_CALIBRATION = {
	scenario: 's2',
	axis: "the harness's own cross-lane-observation-diff verdict",
	text: 'data-empty="true">empty<  ->  data-empty="true">none<',
	expect:
		'every in-box assertion still passes and the s2 observation string changes, so the ' +
		'verdict must be `cross-lane observation diff`',
	requiredSite: 'cross-lane observation diff',
	apply: (source) =>
		replaceOnce(source, 'data-empty="true">empty<', 'data-empty="true">none<'),
};

for (const [framework, byScenario] of Object.entries(MUTANTS)) {
	for (const scenario of Object.keys(byScenario)) {
		byScenario[scenario].id = `${framework}/${scenario}`;
	}
}

// ---------------------------------------------------------------------------
// Running a lane
// ---------------------------------------------------------------------------

const witnessCli = createRequire(resolve(workspace, 'demos/ssr/package.json')).resolve(
	'@async/witness/cli',
);

function git(args) {
	const result = spawnSync('git', args, { cwd: workspace, encoding: 'utf8' });
	if (result.error) throw result.error;
	return result;
}

/**
 * Restores every path this harness may have written and PROVES the restoration.
 *
 * `git status --porcelain` rather than `git diff` because it also reports
 * untracked files: a mutant that renamed a file, or a demo script that emitted a
 * new one, would be invisible to a diff of tracked content.
 */
function restore() {
	git(['checkout', '--', ...MUTATION_SURFACE]);
	const status = git(['status', '--porcelain', '--', ...MUTATION_SURFACE]);
	if (status.status !== 0) {
		throw new Error(`git status failed while verifying restoration:\n${status.stderr}`);
	}
	if (status.stdout.trim() !== '') {
		throw new Error(
			'Restoration is NOT verified — the mutation surface is still dirty after ' +
				`git checkout:\n${status.stdout}`,
		);
	}
}

/**
 * Refuses to start against a dirty mutation surface.
 *
 * Every verdict below is "the box behaved differently once ONE known byte range
 * changed". That sentence is false if something else in the surface had already
 * changed, and `restore()` would silently discard the operator's work on the way
 * out. So the precondition is asserted rather than assumed.
 */
function assertCleanSurface() {
	const status = git(['status', '--porcelain', '--', ...MUTATION_SURFACE]);
	if (status.status !== 0) {
		throw new Error(`git status failed:\n${status.stderr}`);
	}
	if (status.stdout.trim() !== '') {
		throw new Error(
			'The mutation surface is dirty before the first mutation, so no verdict this ' +
				'harness issues would be attributable to its own mutant, and restoring would ' +
				`discard uncommitted work. Commit or stash first:\n${status.stdout}`,
		);
	}
}

function runCommand(label, command, args, cwd) {
	process.stdout.write(`\n[mutate] ${label}\n`);
	const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
	if (result.error) throw result.error;
	return {
		status: result.status ?? 1,
		output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
	};
}

/** The `latest` run id a demo's witness receipts directory points at, or null. */
async function latestRunId(directory) {
	try {
		const runId = (await readFile(resolve(directory, '.witness/receipts/latest'), 'utf8')).trim();
		return runId || null;
	} catch {
		return null;
	}
}

/**
 * The three-way box out of the receipt the demo's LATEST witness run wrote.
 *
 * Split out of `readThreeWayResults` because a mutant run's evidence is the
 * box's own `error.message` — the sentence the assertion raised, verbatim — and
 * scraping it back out of stdout would report a run-summary line ("0 passed, 1
 * failed") as the red site.
 */
async function readThreeWayBox(demo) {
	const receiptsDirectory = resolve(demo.directory, '.witness/receipts');
	const runId = (await readFile(resolve(receiptsDirectory, 'latest'), 'utf8')).trim();
	if (!runId || runId.includes('/') || runId.includes('\\')) {
		throw new Error(`Invalid ${demo.framework} witness latest pointer: ${JSON.stringify(runId)}`);
	}
	const receiptPath = resolve(receiptsDirectory, runId, 'receipt.json');
	const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
	const box = (receipt.boxes ?? []).find(({ tags }) => (tags ?? []).includes('three-way'));
	if (!box) throw new Error(`No three-way box in ${receiptPath}.`);
	return { box, receiptPath, runId };
}

/**
 * Reads the three-way results a demo's witness box recorded.
 *
 * Shared with `scripts/e2e.mjs` on purpose. The harness's "cross-lane
 * observation diff" verdict is only meaningful if it reads the SAME strings the
 * pipeline compares; two readers would be two definitions of the observation,
 * and the harness would be calibrating something `pnpm e2e` never looks at.
 *
 * Throws unless the box actually ran, passed, and wrote its per-scenario
 * observations — an empty or missing receipt must never read as a pass.
 */
export async function readThreeWayResults(demo, requiredScenarios) {
	const { box, receiptPath } = await readThreeWayBox(demo);
	if (box.status !== 'passed') {
		throw new Error(`Three-way box for ${demo.framework} did not pass: ${box.status}.`);
	}
	const note = (box.notes ?? [])
		.map((text) => {
			try {
				return JSON.parse(text);
			} catch {
				return null;
			}
		})
		.find((parsed) => parsed?.kind === 'three-way-results');
	if (!note) throw new Error(`No three-way-results note in ${receiptPath}.`);
	const observed = {};
	for (const result of note.results) {
		if (result.activation !== demo.activation) {
			throw new Error(
				`${demo.framework} reported activation ${result.activation}, expected ${demo.activation}.`,
			);
		}
		observed[result.scenario] = result.observed;
	}
	for (const scenario of requiredScenarios) {
		if (!observed[scenario]) {
			throw new Error(`${demo.framework} recorded no observations for ${scenario}.`);
		}
	}
	return { observed, receiptPath: receiptPath.slice(workspace.length + 1) };
}

/**
 * Refreshes the lane's emitted output and runs its witness box.
 *
 * Deliberately does NOT exit on a non-zero status: for a mutant run a failure is
 * the expected outcome and is the evidence, so the status is returned and
 * classified by the caller.
 */
async function runLaneBox(lane, label) {
	const directory = resolve(workspace, lane.directory);
	const before = await latestRunId(directory);
	const prepare = runCommand(
		`${label}: ${lane.framework} ${lane.prepare ?? 'copy-emitted'}`,
		'pnpm',
		['--dir', directory, lane.prepare ?? 'copy-emitted'],
		workspace,
	);
	if (prepare.status !== 0) {
		// Neither of the two sanctioned red sites. A mutant that stops the lane's
		// own build is a different fact from a mutant an assertion caught, and
		// reporting it as the latter would overstate what the corpus measured.
		throw new Error(
			`The ${lane.framework} lane's ${lane.prepare ?? 'copy-emitted'} script exited ` +
				`${prepare.status} during "${label}". That is neither of the two red sites the ` +
				`mutation budget recognises, so no verdict is issued:\n${prepare.output.slice(-4000)}`,
		);
	}
	const box = runCommand(
		`${label}: ${lane.framework} witness run`,
		process.execPath,
		[witnessCli, 'run'],
		directory,
	);
	// A stale receipt read as a fresh verdict is exactly the class of fault this
	// project keeps finding, so the run id has to have moved.
	const after = await latestRunId(directory);
	if (!after || after === before) {
		throw new Error(
			`The ${lane.framework} witness run during "${label}" wrote no new receipt (latest is ` +
				`still ${JSON.stringify(before)}), so there is nothing to read a verdict out ` +
				`of:\n${box.output.slice(-4000)}`,
		);
	}
	return { status: box.status, output: box.output };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

function parseArguments(argv) {
	const scenarios = [];
	const lanes = [];
	let wantsDryRun = false;
	let wantsClassifier = false;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--dry-run') {
			wantsDryRun = true;
			continue;
		}
		if (argument === '--calibrate-classifier') {
			wantsClassifier = true;
			continue;
		}
		if (argument === '--scenario' || argument === '--lane') {
			const value = argv[index + 1];
			if (!value || value.startsWith('--')) {
				throw new Error(`${argument} requires a value.`);
			}
			(argument === '--scenario' ? scenarios : lanes).push(value);
			index += 1;
			continue;
		}
		throw new Error(
			`Unrecognised argument ${JSON.stringify(argument)}. ` +
				'Usage: pnpm mutate:corpus --scenario s1 [--scenario s2] [--lane react] ' +
				'[--dry-run] [--calibrate-classifier]',
		);
	}
	if (wantsClassifier) {
		if (scenarios.length) {
			throw new Error(
				'--calibrate-classifier takes no --scenario: it runs one fixed mutant, on s2, ' +
					"whose whole point is that it lands in the harness's other verdict class.",
			);
		}
		return {
			scenarios: [CLASSIFIER_CALIBRATION.scenario],
			lanes: selectLanes(lanes),
			dryRun: wantsDryRun,
			classifier: true,
		};
	}
	if (scenarios.length === 0) {
		throw new Error(
			'At least one --scenario is required. This harness never guesses a scope: a ' +
				'default would make "every lane went red" a claim about an unstated set.',
		);
	}
	for (const scenario of scenarios) {
		if (!SCENARIO_FILES[scenario]) {
			throw new Error(
				`Unknown scenario ${JSON.stringify(scenario)}; known: ${Object.keys(SCENARIO_FILES).join(', ')}.`,
			);
		}
	}
	return {
		scenarios: [...new Set(scenarios)],
		lanes: selectLanes(lanes),
		dryRun: wantsDryRun,
		classifier: false,
	};
}

function selectLanes(frameworks) {
	if (!frameworks.length) return LANES;
	return frameworks.map((framework) => {
		const lane = LANES.find((candidate) => candidate.framework === framework);
		if (!lane) throw new Error(`Unknown lane ${JSON.stringify(framework)}.`);
		return lane;
	});
}

/** The mutant this run applies to one (lane, scenario) pair. */
function mutantFor(lane, scenario, classifier) {
	return classifier ? CLASSIFIER_CALIBRATION : MUTANTS[lane.framework]?.[scenario];
}

/**
 * Applies every selected mutant to the pristine file and immediately discards
 * the result, so the anchors and the byte-difference guard are checked without
 * spawning six dev servers.
 *
 * This is a precondition check on the INSTRUMENT, not a measurement of the
 * corpus: it can only report that the mutants still bite the emitted text. It
 * never issues a RED verdict and is not a substitute for a run.
 */
async function dryRun(lanes, scenarios, classifier) {
	for (const lane of lanes) {
		for (const scenario of scenarios) {
			const mutant = mutantFor(lane, scenario, classifier);
			const file = resolve(
				workspace,
				lane.generated,
				`${SCENARIO_FILES[scenario]}.${lane.extension}`,
			);
			const pristine = await readFile(file, 'utf8');
			mutate(pristine, mutant);
			console.log(`[mutate] anchor OK  ${lane.framework} ${scenario}`);
		}
	}
	console.log(
		`\n[mutate] dry run: ${lanes.length * scenarios.length} mutants anchor uniquely and ` +
			'every one changes the bytes. NO verdict was issued.',
	);
}

async function main(argv) {
	const { scenarios, lanes, dryRun: isDryRun, classifier } = parseArguments(argv);

	// Every requested (lane, scenario) must have a ratified mutant BEFORE any
	// process is spawned. A missing mutant silently skipped would let a run
	// report "all lanes red" over a set smaller than the one asked for.
	const missing = [];
	for (const lane of lanes) {
		for (const scenario of scenarios) {
			if (!mutantFor(lane, scenario, classifier)) {
				missing.push(`${lane.framework}/${scenario}`);
			}
		}
	}
	if (missing.length) {
		throw new Error(
			`No ratified mutant for ${missing.join(', ')}. Every (lane, scenario) pair in the ` +
				"requested scope needs one spelled in that lane's own emitted idiom; the " +
				'harness refuses to report a verdict over a set it did not cover.',
		);
	}

	assertCleanSurface();
	if (isDryRun) {
		await dryRun(lanes, scenarios, classifier);
		return;
	}
	let restoreOnExit = true;
	const cleanUp = () => {
		if (!restoreOnExit) return;
		restoreOnExit = false;
		try {
			restore();
		} catch (error) {
			console.error(`[mutate] restoration failed on exit: ${error.message}`);
		}
	};
	process.on('SIGINT', () => {
		cleanUp();
		process.exit(130);
	});

	const rows = [];
	try {
		for (const lane of lanes) {
			// Positive arm. A harness that only ever observes red cannot tell a
			// killed mutant from a broken lane, so the clean run is taken here,
			// on this lane, on this invocation — never inherited from `pnpm e2e`.
			const baselineRun = await runLaneBox(lane, 'baseline');
			if (baselineRun.status !== 0) {
				throw new Error(
					`The ${lane.framework} lane is not green BEFORE any mutation (witness run ` +
						`exited ${baselineRun.status}), so nothing below would be attributable to a ` +
						`mutant:\n${baselineRun.output.slice(-4000)}`,
				);
			}
			const baseline = await readThreeWayResults(
				{ ...lane, directory: resolve(workspace, lane.directory) },
				scenarios,
			);

			for (const scenario of scenarios) {
				const mutant = mutantFor(lane, scenario, classifier);
				const file = resolve(
					workspace,
					lane.generated,
					`${SCENARIO_FILES[scenario]}.${lane.extension}`,
				);
				const pristine = await readFile(file, 'utf8');
				await writeFile(file, mutate(pristine, mutant));

				await runLaneBox(lane, `${lane.framework} ${scenario} mutant`);
				const demo = { ...lane, directory: resolve(workspace, lane.directory) };
				const { box } = await readThreeWayBox(demo);
				let verdict;
				let site;
				let detail;
				if (box.status !== 'passed') {
					// Site (i): the lane's own in-box assertion. The evidence is the
					// sentence that assertion raised, read out of the receipt rather
					// than scraped from stdout, where the run-summary line would win.
					verdict = 'RED';
					site = 'in-box assertion';
					detail = box.error?.message ?? `three-way box status ${box.status}`;
				} else {
					// Site (ii): the box passed, so only the observations it recorded
					// can carry the mutant — the same strings `pnpm e2e` diffs.
					const mutated = await readThreeWayResults(demo, scenarios);
					const before = JSON.stringify(baseline.observed[scenario]);
					const after = JSON.stringify(mutated.observed[scenario]);
					if (before === after) {
						verdict = 'SURVIVOR';
						site = 'neither';
						detail = `observations unchanged: ${before}`;
					} else {
						verdict = 'RED';
						site = 'cross-lane observation diff';
						detail = `baseline ${before}\n                mutant   ${after}`;
					}
				}

				restore();
				// The classifier calibration is the one arm that ASSERTS its site:
				// its entire purpose is to prove the other verdict class can be
				// reached, so reaching a different one is a failure of the harness,
				// not a result about the corpus.
				if (mutant.requiredSite && site !== mutant.requiredSite) {
					throw new Error(
						`The classifier calibration on ${lane.framework} ${scenario} was caught at ` +
							`"${site}", not at "${mutant.requiredSite}". It is chosen to satisfy every ` +
							'in-box assertion and change only an observation string, so this means the ' +
							`harness cannot be shown to reach its second verdict:\n${detail}`,
					);
				}
				rows.push({
					lane: lane.framework,
					scenario,
					axis: mutant.axis,
					mutant: mutant.text,
					expected: mutant.expect,
					verdict,
					site,
					detail,
				});
				process.stdout.write(
					`\n[mutate] ${lane.framework} ${scenario}: ${verdict} at ${site}\n`,
				);
			}
		}
	} finally {
		cleanUp();
	}

	report(rows);
	const survivors = rows.filter((row) => row.verdict === 'SURVIVOR');
	if (survivors.length) {
		console.error(
			'\n[mutate] FAIL: the mutants above are not load-bearing in their lane. Each one is ' +
				'an OPEN FINDING naming the lane and the axis. Do not patch it over and do not ' +
				'weaken an assertion to accommodate it.',
		);
		process.exitCode = 1;
		return;
	}
	console.log(`\n[mutate] PASS: ${rows.length} mutants, every one RED, every one restored.`);
}

function report(rows) {
	console.log('\n[mutate] corpus mutation budget');
	for (const row of rows) {
		console.log(`  ${row.lane} ${row.scenario} — ${row.verdict} at ${row.site}`);
		console.log(`      axis:    ${row.axis}`);
		console.log(`      mutant:  ${row.mutant.replace(/\n/g, '\\n')}`);
		console.log(`      expect:  ${row.expected}`);
		console.log(`      evidence: ${row.detail}`);
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main(process.argv.slice(2));
}
