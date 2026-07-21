import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
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
import { compositionKitScenarios } from '../demos/composition-kit/scenarios.ts';
import { uiKitScenarios } from '../demos/ui-kit/scenarios.ts';

const workspace = resolve(import.meta.dirname, '..');
const uiDemo = resolve(workspace, 'demos/ui-kit');
const compositionDemo = resolve(workspace, 'demos/composition-kit');
const uiComponents = ['PricingCard', 'TaskList', 'NewsletterForm'];
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
	const failures = evaluateExpectations(trace, scenario.expectations ?? []).filter(
		({ outcome }) => outcome === 'fail',
	);
	if (failures.length) {
		throw new Error(
			`${trace.framework} expectation failure for ${scenario.id}: ${JSON.stringify(failures)}`,
		);
	}
}

async function writeReceipt(demo, scenarios, label) {
	const receiptResults = { scenarios, mutantRejections: {} };
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
		throw new Error(`Generated ${label} frameless-receipts/1 receipt failed validation.`);
	}
	const receiptDirectory = resolve(demo, 'receipts');
	const receiptPath = resolve(receiptDirectory, 'frameless-receipts.json');
	await mkdir(receiptDirectory, { recursive: true });
	await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
	return { receipt, receiptPath };
}

await Promise.all([resetDemoArtifacts(uiDemo), resetDemoArtifacts(compositionDemo)]);

for (const component of uiComponents) {
	run(`build ui-kit ${component}`, [
		'--experimental-transform-types',
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
	'--experimental-transform-types',
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
	assertExpectations(react, scenario);
	assertExpectations(solid, scenario);
	const verdict = compareRuns(react, solid);
	compositionScenarios[scenario.id] = {
		'react-vs-solid': verdict.equal
			? { status: 'equal', equal: true, divergences: [] }
			: { status: 'different', equal: false, divergences: verdict.divergences },
	};
	if (!verdict.equal)
		differences.push({ demo: 'composition-kit', scenario: scenario.id, ...verdict });
}

const uiReceipt = await writeReceipt(uiDemo, uiScenarios, 'ui-kit');
const compositionReceipt = await writeReceipt(
	compositionDemo,
	compositionScenarios,
	'composition-kit',
);

if (differences.length) {
	console.error('\n[e2e] Cross-target divergence:');
	console.error(JSON.stringify(differences, null, 2));
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
