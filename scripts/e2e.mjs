import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
	RECEIPT_SCHEMA_VERSION,
	compareRuns,
	createReceiptSummary,
	deserializeRunTrace,
	evaluateExpectations,
	validateReceipt,
} from '@frameless/analyzer';
import { readThreeWayResults } from './corpus-mutation.mjs';
import { compositionKitScenarios } from '../demos/composition-kit/scenarios.ts';
import {
	buildPersistenceEntry,
	getPersistenceLaneVerdict,
} from '../demos/persistence/src/persistence-receipt.ts';
import { buildSsrEntry, getSsrLaneVerdict } from '../demos/ssr/src/ssr-receipt.ts';
import { uiKitScenarios } from '../demos/ui-kit/scenarios.ts';

const workspace = resolve(import.meta.dirname, '..');
const uiDemo = resolve(workspace, 'demos/ui-kit');
const compositionDemo = resolve(workspace, 'demos/composition-kit');
const persistenceDemo = resolve(workspace, 'demos/persistence');
const ssrDemo = resolve(workspace, 'demos/ssr');
const uiComponents = ['PricingCard', 'TaskList', 'NewsletterForm'];
// The official framework scaffolds. One shared IR, six emitters, two
// activation models — React, Solid, Svelte, Vue and Angular hydrate, Qwik
// resumes. Each
// runs the same contract in demos/react-official/three-way-contract.ts, and the
// `three-way` box tag and `three-way-results` note kind are the wire protocol
// between that contract and this file; they keep their names.
const officialDemos = [
	{ framework: 'react', activation: 'hydrate', directory: resolve(workspace, 'demos/react-official') },
	{ framework: 'solid', activation: 'hydrate', directory: resolve(workspace, 'demos/solid-official') },
	{ framework: 'qwik', activation: 'resume', directory: resolve(workspace, 'demos/qwik') },
	{ framework: 'svelte', activation: 'hydrate', directory: resolve(workspace, 'demos/svelte-official') },
	{ framework: 'vue', activation: 'hydrate', directory: resolve(workspace, 'demos/vue-official') },
	// Angular is the one lane whose scaffold owns its build outright: there is no
	// vite.config.ts, `@angular/build` vendors its own Vite, and `ng build` is the
	// only way to produce runnable output. So this row declares a `prepare`
	// script, run immediately before its witness box, and the box serves that
	// build through Angular's own `reqHandler`.
	{
		framework: 'angular',
		activation: 'hydrate',
		directory: resolve(workspace, 'demos/angular-official'),
		prepare: 'build:e2e',
	},
];
const threeWayScenarios = ['s1', 's2', 's3'];
// @async/witness is a dev tool of the workspace, already installed for the ssr
// and persistence demos. The runner aliases '@async/witness' for the box files
// it loads, so the official demos run boxes without depending on it themselves.
const witnessCli = createRequire(resolve(workspace, 'demos/ssr/package.json')).resolve(
	'@async/witness/cli',
);
const componentName = (component) =>
	component.replace(/[A-Z]/g, (letter, index) => `${index ? '-' : ''}${letter.toLowerCase()}`);
const uiScenarioEntries = uiComponents.flatMap((component) =>
	uiKitScenarios
		.filter(({ id }) => id === `ui-kit/${componentName(component)}`)
		.map((scenario) => ({ component, scenario })),
);
if (uiScenarioEntries.length !== uiKitScenarios.length) {
	throw new Error('Every portable ui-kit scenario must map to exactly one demo component.');
}

function run(label, args) {
	console.log(`\n[e2e] ${label}`);
	const result = spawnSync(process.execPath, args, { cwd: workspace, stdio: 'inherit' });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}

function runExecutable(label, command, args, cwd = workspace) {
	console.log(`\n[e2e] ${label}`);
	const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}

// `readThreeWayResults` lives in scripts/corpus-mutation.mjs and is imported
// above. The corpus mutation harness classifies a mutant as caught by the
// "cross-lane observation diff" by comparing the very strings this file
// compares, so the two must not have two readers: a second definition would let
// the harness calibrate a set of observations `pnpm e2e` never looks at.

async function resetDemoArtifacts(demo) {
	await rm(resolve(demo, 'traces'), { recursive: true, force: true });
	await rm(resolve(demo, 'receipts'), { recursive: true, force: true });
}

async function readTrace(demo, target, filename, scenarioId) {
	const path = resolve(demo, 'traces', target, filename);
	let text;
	try {
		text = await readFile(path, 'utf8');
	} catch (error) {
		throw new Error(`Missing ${target} trace after successful capture phase: ${path}`, {
			cause: error,
		});
	}
	const trace = deserializeRunTrace(text);
	if (trace.scenario !== scenarioId) {
		throw new Error(
			`Trace ${path} contains scenario ${trace.scenario}, expected ${scenarioId}.`,
		);
	}
	return trace;
}

function assertExpectations(trace, scenario) {
	const results = evaluateExpectations(trace, scenario.expectations ?? []);
	const failures = results.filter(
		({ outcome }) => outcome === 'fail',
	);
	if (failures.length) {
		throw new Error(
			`${trace.framework} expectation failure for ${scenario.id}: ${JSON.stringify(failures)}`,
		);
	}
	return results;
}

async function writeReceipt(demo, scenarios, expectationResults, label) {
	const receiptResults = { scenarios, mutantRejections: {}, expectationResults };
	const receipt = {
		schema: RECEIPT_SCHEMA_VERSION,
		generatedBy: 'scripts/e2e.mjs',
		environment: {
			node: process.version,
			browser: 'headless Chromium via Vitest browser projects',
			pair: `CLI-emitted React vs CLI-emitted Solid (${label})`,
		},
		findings: {},
		...receiptResults,
		summary: createReceiptSummary(receiptResults),
	};
	if (!validateReceipt(receipt)) {
		throw new Error(`Generated ${label} ${RECEIPT_SCHEMA_VERSION} receipt failed validation.`);
	}
	const receiptDirectory = resolve(demo, 'receipts');
	const receiptPath = resolve(receiptDirectory, 'frameless-receipts.json');
	await mkdir(receiptDirectory, { recursive: true });
	await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
	return { receipt, receiptPath };
}

async function writeSsrReceipt(ssr) {
	const receiptResults = { scenarios: {}, mutantRejections: {} };
	const receipt = {
		schema: RECEIPT_SCHEMA_VERSION,
		generatedBy: 'scripts/e2e.mjs',
		environment: {
			node: process.version,
			browser: 'Chromium via @async/witness',
			pair: 'CLI-emitted React SSR vs CLI-emitted Solid SSR',
		},
		findings: {},
		...receiptResults,
		ssr,
		summary: createReceiptSummary(receiptResults),
	};
	if (!validateReceipt(receipt)) {
		throw new Error(`Generated SSR ${RECEIPT_SCHEMA_VERSION} receipt failed validation.`);
	}
	const receiptDirectory = resolve(ssrDemo, 'receipts');
	const receiptPath = resolve(receiptDirectory, 'frameless-receipts.json');
	await mkdir(receiptDirectory, { recursive: true });
	await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
	return receiptPath;
}

async function writePersistenceReceipt(persistence) {
	const receiptResults = { scenarios: {}, mutantRejections: {} };
	const receipt = {
		schema: RECEIPT_SCHEMA_VERSION,
		generatedBy: 'scripts/e2e.mjs',
		environment: {
			node: process.version,
			browser: 'Chromium via @async/witness',
			pair: 'CLI-emitted React persistence vs CLI-emitted Solid persistence',
		},
		findings: {},
		...receiptResults,
		persistence,
		summary: createReceiptSummary(receiptResults),
	};
	if (!validateReceipt(receipt)) {
		throw new Error(
			`Generated persistence ${RECEIPT_SCHEMA_VERSION} receipt failed validation.`,
		);
	}
	const receiptDirectory = resolve(persistenceDemo, 'receipts');
	const receiptPath = resolve(receiptDirectory, 'frameless-receipts.json');
	await mkdir(receiptDirectory, { recursive: true });
	await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
	return receiptPath;
}

await Promise.all([
	resetDemoArtifacts(uiDemo),
	resetDemoArtifacts(compositionDemo),
	resetDemoArtifacts(ssrDemo),
	resetDemoArtifacts(persistenceDemo),
]);

for (const component of uiComponents) {
	run(`build ui-kit ${component}`, [
		resolve(workspace, 'packages/cli/src/node.ts'),
		'build',
		resolve(uiDemo, `src/${component}.tsrx`),
		'--target',
		'react',
		'--target',
		'solid',
		'--out-dir',
		resolve(uiDemo, `dist/${component}`),
	]);
}

run('build composition-kit module set', [
	resolve(workspace, 'packages/cli/src/node.ts'),
	'build',
	...['frame', 'dashboard', 'status', 'search', 'page'].map((module) =>
		resolve(compositionDemo, `src/${module}.tsrx`),
	),
	'--target',
	'react',
	'--target',
	'solid',
	'--out-dir',
	resolve(compositionDemo, 'dist'),
]);

const vitest = resolve(workspace, 'node_modules/vitest/vitest.mjs');
run('capture ui-kit React traces', [vitest, 'run', '--project', 'demo-react-browser']);
run('capture ui-kit Solid traces', [vitest, 'run', '--project', 'demo-solid-browser']);
run('capture composition-kit React traces', [
	vitest,
	'run',
	'--project',
	'composition-demo-react-browser',
]);
run('capture composition-kit Solid traces', [
	vitest,
	'run',
	'--project',
	'composition-demo-solid-browser',
]);

const uiScenarios = {};
const compositionScenarios = {};
const uiExpectationResults = {};
const compositionExpectationResults = {};
const differences = [];
for (const { component, scenario } of uiScenarioEntries) {
	const scenarioName = scenario.id.split('/').at(-1);
	if (!scenarioName) throw new Error(`Scenario ${scenario.id} has no file-safe name.`);
	const react = await readTrace(
		uiDemo,
		'react',
		`${component}.${scenarioName}.json`,
		scenario.id,
	);
	const solid = await readTrace(
		uiDemo,
		'solid',
		`${component}.${scenarioName}.json`,
		scenario.id,
	);
	uiExpectationResults[scenario.id] = {
		react: assertExpectations(react, scenario),
		solid: assertExpectations(solid, scenario),
	};
	const verdict = compareRuns(react, solid);
	uiScenarios[scenario.id] = {
		'react-vs-solid': verdict.equal
			? { status: 'equal', equal: true, divergences: [] }
			: { status: 'different', equal: false, divergences: verdict.divergences },
	};
	if (!verdict.equal) differences.push({ demo: 'ui-kit', scenario: scenario.id, ...verdict });
}

for (const scenario of compositionKitScenarios) {
	const scenarioName = scenario.id.split('/').at(-1);
	if (!scenarioName) throw new Error(`Scenario ${scenario.id} has no file-safe name.`);
	const react = await readTrace(compositionDemo, 'react', `${scenarioName}.json`, scenario.id);
	const solid = await readTrace(compositionDemo, 'solid', `${scenarioName}.json`, scenario.id);
	compositionExpectationResults[scenario.id] = {
		react: assertExpectations(react, scenario),
		solid: assertExpectations(solid, scenario),
	};
	const verdict = compareRuns(react, solid);
	compositionScenarios[scenario.id] = {
		'react-vs-solid': verdict.equal
			? { status: 'equal', equal: true, divergences: [] }
			: { status: 'different', equal: false, divergences: verdict.divergences },
	};
	if (!verdict.equal)
		differences.push({ demo: 'composition-kit', scenario: scenario.id, ...verdict });
}

const uiReceipt = await writeReceipt(
	uiDemo,
	uiScenarios,
	uiExpectationResults,
	'ui-kit',
);
const compositionReceipt = await writeReceipt(
	compositionDemo,
	compositionScenarios,
	compositionExpectationResults,
	'composition-kit',
);

if (differences.length) {
	console.error('\n[e2e] Cross-target divergence:');
	console.error(JSON.stringify(differences, null, 2));
	process.exit(1);
}

// Build the SSR demo's emitted output (dist/ is gitignored — regenerate on every clone) so the
// witness apps have CLI-emitted components to import before `witness run`.
for (const component of ['PricingCard', 'TaskList', 'NewsletterForm']) {
	run(`build ssr ${component}`, [
		resolve(workspace, 'packages/cli/src/node.ts'),
		'build',
		resolve(ssrDemo, `src/${component}.tsrx`),
		'--target',
		'react',
		'--target',
		'solid',
		'--out-dir',
		resolve(ssrDemo, `dist/${component}`),
	]);
}

runExecutable('run SSR witness', 'pnpm', ['exec', 'witness', 'run'], ssrDemo);
const witnessReceipts = resolve(ssrDemo, '.witness/receipts');
const witnessRunId = (await readFile(resolve(witnessReceipts, 'latest'), 'utf8')).trim();
if (!witnessRunId || witnessRunId.includes('/') || witnessRunId.includes('\\')) {
	throw new Error(`Invalid SSR witness latest pointer: ${JSON.stringify(witnessRunId)}`);
}
const witnessReceiptPath = resolve(witnessReceipts, witnessRunId, 'receipt.json');
const witnessReceipt = JSON.parse(await readFile(witnessReceiptPath, 'utf8'));
const storedWitnessReceiptPath = `demos/ssr/.witness/receipts/${witnessRunId}/receipt.json`;
const ssr = buildSsrEntry(witnessReceipt, storedWitnessReceiptPath);
const ssrVerdict = getSsrLaneVerdict(witnessReceipt, ssr);
const ssrReceiptPath = await writeSsrReceipt(ssr);
console.log(
	`[e2e] SSR ${ssrVerdict}: pre react=${ssr.frameworks.react.preActivation.expectations - ssr.frameworks.react.preActivation.failures}/${ssr.frameworks.react.preActivation.expectations}, solid=${ssr.frameworks.solid.preActivation.expectations - ssr.frameworks.solid.preActivation.failures}/${ssr.frameworks.solid.preActivation.expectations}; equality corpus=${ssr.equality.corpusIdentical}, outcomes=${ssr.equality.outcomesEqual}`,
);
if (ssrVerdict === 'FAIL') process.exit(1);

run('build persistence witness fixture', [resolve(persistenceDemo, 'build.ts')]);
runExecutable('run persistence witness', 'pnpm', ['exec', 'witness', 'run'], persistenceDemo);
const persistenceWitnessReceipts = resolve(persistenceDemo, '.witness/receipts');
const persistenceWitnessRunId = (
	await readFile(resolve(persistenceWitnessReceipts, 'latest'), 'utf8')
).trim();
if (
	!persistenceWitnessRunId ||
	persistenceWitnessRunId.includes('/') ||
	persistenceWitnessRunId.includes('\\')
) {
	throw new Error(
		`Invalid persistence witness latest pointer: ${JSON.stringify(persistenceWitnessRunId)}`,
	);
}
const persistenceWitnessReceiptPath = resolve(
	persistenceWitnessReceipts,
	persistenceWitnessRunId,
	'receipt.json',
);
const persistenceWitnessReceipt = JSON.parse(
	await readFile(persistenceWitnessReceiptPath, 'utf8'),
);
const storedPersistenceWitnessReceiptPath =
	`demos/persistence/.witness/receipts/${persistenceWitnessRunId}/receipt.json`;
const persistence = buildPersistenceEntry(
	persistenceWitnessReceipt,
	storedPersistenceWitnessReceiptPath,
);
const persistenceVerdict = getPersistenceLaneVerdict(
	persistenceWitnessReceipt,
	persistence,
);
const persistenceReceiptPath = await writePersistenceReceipt(persistence);
console.log(
	`[e2e] persistence ${persistenceVerdict}: no-flash react=${persistence.frameworks.react.noFlash}, solid=${persistence.frameworks.solid.noFlash}; write-through react=${persistence.frameworks.react.writeThrough}, solid=${persistence.frameworks.solid.writeThrough}; equality=${persistence.equality.outcomesEqual}; calibration=${persistence.calibration.proven}`,
);
if (persistenceVerdict === 'FAIL') process.exit(1);

// The three-way lanes. Each official demo is served by its own scaffold — the
// react/solid/vue vite SSR servers, the qwik router, the SvelteKit dev server
// and the Angular CLI's own built request handler — and driven through the same
// scenario contract, so "identical behavior" is compared, not asserted.
//
// Five of the six only need their emitted components refreshed; Angular
// additionally needs `ng build`, because its scaffold has no vite.config.ts and
// nothing runs until the CLI has produced `dist/`. `prepare` names the script
// that does both, and the angular box asserts the output it serves is newer than
// the source it was built from.
const threeWay = {};
for (const demo of officialDemos) {
	runExecutable(
		`refresh ${demo.framework} emitted output`,
		'pnpm',
		['--dir', demo.directory, demo.prepare ?? 'copy-emitted'],
	);
	runExecutable(
		`run ${demo.framework} official-demo witness`,
		process.execPath,
		[witnessCli, 'run'],
		demo.directory,
	);
	threeWay[demo.framework] = await readThreeWayResults(demo, threeWayScenarios);
}

const [reference, ...others] = officialDemos;
const threeWayDivergences = [];
for (const scenario of threeWayScenarios) {
	const expected = JSON.stringify(threeWay[reference.framework].observed[scenario]);
	for (const demo of others) {
		const actual = JSON.stringify(threeWay[demo.framework].observed[scenario]);
		if (actual !== expected) {
			threeWayDivergences.push({
				scenario,
				reference: reference.framework,
				framework: demo.framework,
				expected: threeWay[reference.framework].observed[scenario],
				observed: threeWay[demo.framework].observed[scenario],
			});
		}
	}
}
console.log(`\n[e2e] three-way matrix (one IR -> ${officialDemos.length} emitters):`);
for (const scenario of threeWayScenarios) {
	for (const demo of officialDemos) {
		console.log(
			`  ${scenario} ${demo.framework.padEnd(6)} ${demo.activation.padEnd(7)} ${threeWay[demo.framework].observed[scenario].join(' | ')}`,
		);
	}
}
if (threeWayDivergences.length) {
	console.error('\n[e2e] Three-way divergence:');
	console.error(JSON.stringify(threeWayDivergences, null, 2));
	process.exit(1);
}

console.log('\n[e2e] PASS');
console.log(`Modules built: ui-kit=${uiComponents.length}, composition-kit=5`);
console.log(
	`Scenarios captured: ui-kit react=${uiScenarioEntries.length}, solid=${uiScenarioEntries.length}; composition-kit react=${compositionKitScenarios.length}, solid=${compositionKitScenarios.length}`,
);
console.log(
	`Trace pairs: ui-kit equal=${uiReceipt.receipt.summary.equalPairs}; composition-kit equal=${compositionReceipt.receipt.summary.equalPairs}`,
);
console.log(`UI receipt: ${uiReceipt.receiptPath}`);
console.log(`Composition receipt: ${compositionReceipt.receiptPath}`);
console.log(`SSR receipt: ${ssrReceiptPath}`);
console.log(`Persistence receipt: ${persistenceReceiptPath}`);
console.log(
	`Three-way: ${officialDemos.length} demos x ${threeWayScenarios.length} scenarios, all observations equal`,
);
for (const demo of officialDemos) {
	console.log(`${demo.framework} official-demo receipt: ${threeWay[demo.framework].receiptPath}`);
}
