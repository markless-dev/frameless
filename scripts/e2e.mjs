import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
	RECEIPT_SCHEMA_VERSION,
	compareRuns,
	createReceiptSummary,
	deserializeRunTrace,
	validateReceipt,
} from '@frameless/analyzer';
import { uiKitScenarios } from '../demos/ui-kit/scenarios.ts';

const workspace = resolve(import.meta.dirname, '..');
const demo = resolve(workspace, 'demos/ui-kit');
const components = ['PricingCard', 'TaskList', 'NewsletterForm'];
const targets = ['react', 'solid'];
const traceRoot = resolve(demo, 'traces');
const receiptDirectory = resolve(demo, 'receipts');
const receiptPath = resolve(receiptDirectory, 'frameless-receipts.json');
const componentName = (component) =>
	component.replace(/[A-Z]/g, (letter, index) => `${index ? '-' : ''}${letter.toLowerCase()}`);
const scenarioEntries = components.flatMap((component) =>
	uiKitScenarios
		.filter(({ id }) => id === `ui-kit/${componentName(component)}`)
		.map((scenario) => ({ component, scenario })),
);
if (scenarioEntries.length !== uiKitScenarios.length) {
	throw new Error('Every portable ui-kit scenario must map to exactly one demo component.');
}

function run(label, args) {
	console.log(`\n[e2e] ${label}`);
	const result = spawnSync(process.execPath, args, { cwd: workspace, stdio: 'inherit' });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm(traceRoot, { recursive: true, force: true });
await rm(receiptDirectory, { recursive: true, force: true });

for (const component of components) {
	run(`build ${component}`, [
		'--experimental-transform-types',
		resolve(workspace, 'packages/cli/src/node.ts'),
		'build',
		resolve(demo, `src/${component}.tsrx`),
		'--target',
		'react',
		'--target',
		'solid',
		'--out-dir',
		resolve(demo, `dist/${component}`),
	]);
}

const vitest = resolve(workspace, 'node_modules/vitest/vitest.mjs');
run('capture React traces', [vitest, 'run', '--project', 'demo-react-browser']);
run('capture Solid traces', [vitest, 'run', '--project', 'demo-solid-browser']);

const scenarios = {};
const differences = [];
for (const { component, scenario } of scenarioEntries) {
	const scenarioName = scenario.id.split('/').at(-1);
	if (!scenarioName) throw new Error(`Scenario ${scenario.id} has no file-safe name.`);
	const traces = {};
	for (const target of targets) {
		const path = resolve(traceRoot, target, `${component}.${scenarioName}.json`);
		let text;
		try {
			text = await readFile(path, 'utf8');
		} catch (error) {
			throw new Error(`Missing ${target} trace after successful capture phase: ${path}`, {
				cause: error,
			});
		}
		traces[target] = deserializeRunTrace(text);
		if (traces[target].scenario !== scenario.id) {
			throw new Error(
				`Trace ${path} contains scenario ${traces[target].scenario}, expected ${scenario.id}.`,
			);
		}
	}
	const verdict = compareRuns(traces.react, traces.solid);
	const pair = verdict.equal
		? { status: 'equal', equal: true, divergences: [] }
		: { status: 'different', equal: false, divergences: verdict.divergences };
	scenarios[scenario.id] = { 'react-vs-solid': pair };
	if (!verdict.equal) {
		differences.push({ component, scenario: scenario.id, divergences: verdict.divergences });
	}
}

const receiptResults = { scenarios, mutantRejections: {} };
const receipt = {
	schema: RECEIPT_SCHEMA_VERSION,
	generatedBy: 'scripts/e2e.mjs',
	environment: {
		node: process.version,
		browser: 'headless Chromium via Vitest browser projects',
		pair: 'CLI-emitted React vs CLI-emitted Solid',
	},
	findings: {},
	...receiptResults,
	summary: createReceiptSummary(receiptResults),
};
if (!validateReceipt(receipt))
	throw new Error('Generated frameless-receipts/1 receipt failed validation.');
await mkdir(receiptDirectory, { recursive: true });
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

if (differences.length) {
	console.error('\n[e2e] Cross-target divergence:');
	console.error(JSON.stringify(differences, null, 2));
	process.exit(1);
}

console.log('\n[e2e] PASS');
console.log(`Components built: ${components.length}`);
console.log(`Scenarios captured: react=${scenarioEntries.length}, solid=${scenarioEntries.length}`);
console.log(
	`Trace pairs: equal=${receipt.summary.equalPairs}, different=${receipt.summary.differentPairs}`,
);
console.log(`Receipt: ${receiptPath}`);
