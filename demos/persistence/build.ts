import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import {
	FRAMELESS_STATE_GLOBAL,
	type EnrichedIR,
	type FramelessPersistenceRecord,
} from '@frameless/compiler';
import { generatePrePaintPersistenceScript } from '@frameless/cli';
import {
	emit as emitReact,
	formatEmitted as formatReact,
} from '@frameless/react';
import {
	emit as emitSolid,
	formatEmitted as formatSolid,
} from '@frameless/solid';

const STORAGE_KEY = 'markless:draft';
const GRAPH_NODE_ID = 'state:draft';
const AUTHORED_INITIAL = 'light';
const ANTI_FLASH_ATTRIBUTE = 'data-markless-draft';
const SCRIPT_FILENAME = 'frameless-persistence-pre-paint.js';

const demoRoot = new URL('./', import.meta.url);
const compilerGolden = new URL(
	'../../packages/compiler/test/goldens/s2-keyed-todo.json',
	import.meta.url,
);
const fixtureDirectory = new URL('./fixtures/', demoRoot);
const fixtureFile = new URL('./s2-keyed-todo.json', fixtureDirectory);

function persistenceRecord(
	graphNodeId: string,
	moduleId: string,
): FramelessPersistenceRecord {
	return {
		version: 'frameless-persistence-record/1',
		graphNodeId,
		moduleId,
		bindingName: 'draft',
		driver: 'localStorage',
		key: {
			origin: 'derived',
			literal: STORAGE_KEY,
			sourceIdentifier: 'draft',
			bakedAtCompileTime: true,
		},
		authoredInitial: AUTHORED_INITIAL,
		antiFlashAttribute: ANTI_FLASH_ATTRIBUTE,
		access: { render: true, handler: true },
		seed: {
			lowering: 'pre-paint',
			readFailure: 'authored-initial',
			corruptedValue: 'authored-initial',
			landings: [
				{
					target: 'react',
					kind: 'sync-read-seed-slot',
					graphNodeId,
				},
				{
					target: 'solid',
					kind: 'sync-read-seed-slot',
					graphNodeId,
				},
			],
		},
		writeThrough: {
			trigger: 'ordinary-assignment',
			value: 'final-committed-string',
			timing: 'commit-before-notify',
			writeFailure: 'swallow',
			crossTabSync: 'off',
		},
	};
}

function indexHtml(framework: 'React' | 'Solid', prePaintScript: string): string {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Frameless persistence — ${framework}</title>
		<script data-frameless-pre-paint>
${prePaintScript.trimEnd()}
		</script>
		<script data-frameless-pre-activation-probe>
			(() => {
				const root = document.documentElement;
				root.setAttribute(
					'data-probe-seed',
					globalThis.${FRAMELESS_STATE_GLOBAL}?.[${JSON.stringify(STORAGE_KEY)}] ?? 'missing',
				);
				root.setAttribute(
					'data-probe-attribute',
					root.getAttribute(${JSON.stringify(ANTI_FLASH_ATTRIBUTE)}) ?? 'missing',
				);
			})();
		</script>
		<script type="module" data-frameless-deferred-entry>
			window.__FRAMELESS_RELEASE_ACTIVATION__ = async () => {
				if (document.documentElement.hasAttribute('data-framework-activated')) return;
				await import('/src/client-entry.tsx');
			};
		</script>
	</head>
	<body>
		<div id="root">
			<p data-activation-state>Framework not activated</p>
			<button type="button" data-action="activate">Activate ${framework}</button>
		</div>
		<button type="button" data-action="observe-storage">Observe storage</button>
		<script>
			document.querySelector('[data-action="activate"]').addEventListener('click', () => {
				window.__FRAMELESS_RELEASE_ACTIVATION__();
			});
			document.querySelector('[data-action="observe-storage"]').addEventListener('click', () => {
				const draft = document.querySelector('[data-action="new"]');
				document.documentElement.setAttribute(
					'data-probe-storage-json',
					JSON.stringify(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})),
				);
				document.documentElement.setAttribute(
					'data-probe-draft-json',
					JSON.stringify(draft instanceof HTMLInputElement ? draft.value : null),
				);
			});
		</script>
	</body>
</html>
`;
}

async function writeTarget(
	target: 'react' | 'solid',
	source: string,
	prePaintScript: string,
): Promise<void> {
	const appRoot = new URL(`./${target}-app/`, demoRoot);
	const sourceRoot = new URL('./src/', appRoot);
	const publicRoot = new URL('./public/', appRoot);
	await Promise.all([
		mkdir(sourceRoot, { recursive: true }),
		mkdir(publicRoot, { recursive: true }),
	]);
	// DELETE A PRE-MIGRATION `PersistedApp.jsx` BEFORE WRITING THE `.tsx`, AND
	// THIS IS NOT TIDYING - IT CLOSES A SILENT SHADOWING HOLE.
	//
	// Unlike the CLI-driven demos, which emit into a `dist/` this build owns
	// outright, this one writes into a `src/` that persists across builds. So a
	// checkout that ever ran the pre-migration build keeps a stale
	// `PersistedApp.jsx` sitting next to the fresh `PersistedApp.tsx`, and
	// `client-entry.tsx` imports `./PersistedApp.jsx`. MEASURED at vite 8.0.16:
	// `tryCleanFsResolve` tries the LITERAL path first and only falls back to the
	// JS-to-TS substitution when it misses - so the stale file WINS, and the demo
	// would build, run and pass against emitted output nobody regenerated.
	// Deleting it here makes the fresh artifact the only one on disk.
	await rm(new URL('./PersistedApp.jsx', sourceRoot), { force: true });
	await Promise.all([
		writeFile(new URL('./PersistedApp.tsx', sourceRoot), source),
		writeFile(new URL(`./${SCRIPT_FILENAME}`, publicRoot), prePaintScript),
		writeFile(
			new URL('./index.html', appRoot),
			indexHtml(target === 'react' ? 'React' : 'Solid', prePaintScript),
		),
	]);
}

export async function buildPersistenceDemo(): Promise<void> {
	await mkdir(fixtureDirectory, { recursive: true });
	await copyFile(compilerGolden, fixtureFile);

	const baseIr = JSON.parse(await readFile(fixtureFile, 'utf8')) as EnrichedIR;
	const draft = baseIr.records.bindings.find(
		(binding) => binding.id === GRAPH_NODE_ID && binding.name === 'draft',
	);
	if (!draft) {
		throw new Error(`Copied compiler fixture is missing ${GRAPH_NODE_ID} (draft).`);
	}
	const record = persistenceRecord(draft.id, baseIr.filename);
	const ir: EnrichedIR = {
		...baseIr,
		records: {
			...baseIr.records,
			bindings: baseIr.records.bindings.map((binding) =>
				binding.id === draft.id
					? {
							...binding,
							initialValue: AUTHORED_INITIAL,
							initializer: {
								type: 'Literal',
								value: AUTHORED_INITIAL,
								raw: JSON.stringify(AUTHORED_INITIAL),
							},
						}
					: binding,
			),
			persistence: [record],
		},
	};
	const generatedScript = generatePrePaintPersistenceScript([record]);
	if (!generatedScript) {
		throw new Error(
			'generatePrePaintPersistenceScript([record]) returned no pre-paint artifact.',
		);
	}

	const [reactSource, solidSource] = await Promise.all([
		formatReact(emitReact(ir)),
		formatSolid(emitSolid(ir)),
	]);
	const reactSeed = `globalThis.${FRAMELESS_STATE_GLOBAL}?.['${STORAGE_KEY}'] ?? '${AUTHORED_INITIAL}'`;
	const solidSeed = reactSeed;
	if (!reactSource.includes(reactSeed) || !solidSource.includes(solidSeed)) {
		throw new Error('An emitted target did not read the storage-keyed pre-paint seed.');
	}

	await Promise.all([
		writeTarget('react', reactSource, generatedScript.content),
		writeTarget('solid', solidSource, generatedScript.content),
	]);
	await mkdir(new URL('./dist/', demoRoot), { recursive: true });
	await writeFile(
		new URL('./dist/fixture-build-receipt.json', demoRoot),
		`${JSON.stringify(
			{
				fixtureDriven: true,
				fixture: 'fixtures/s2-keyed-todo.json',
				graphNodeId: GRAPH_NODE_ID,
				storageKey: STORAGE_KEY,
				stateGlobal: FRAMELESS_STATE_GLOBAL,
				persistence: {
					scriptCopies: [
						`react-app/public/${SCRIPT_FILENAME}`,
						`solid-app/public/${SCRIPT_FILENAME}`,
					],
					contentSha256: generatedScript.contentSha256,
					cspHash: generatedScript.cspHash,
					records: generatedScript.records,
					placement: 'inline-head-before-probe-before-deferred-entry',
				},
				emitted: {
					react: 'react-app/src/PersistedApp.tsx',
					solid: 'solid-app/src/PersistedApp.tsx',
				},
			},
			null,
			2,
		)}\n`,
	);
}

await buildPersistenceDemo();
