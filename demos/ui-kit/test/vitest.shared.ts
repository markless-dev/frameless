import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineBrowserCommand } from '@vitest/browser-playwright';

export const workspaceRoot = resolve(import.meta.dirname, '../../..');
const demoRoot = resolve(workspaceRoot, 'demos/ui-kit');

export const requireDemoBuild = {
	name: 'frameless-demo-requires-cli-build',
	resolveId(source: string, importer: string | undefined) {
		if (!importer?.includes('/demos/ui-kit/test/') || !source.includes('/dist/')) return null;
		const emittedPath = resolve(importer.slice(0, importer.lastIndexOf('/')), source);
		if (!existsSync(emittedPath)) {
			throw new Error(
				`Missing CLI-emitted demo module ${emittedPath}; run the CLI build first.`,
			);
		}
		return null;
	},
};

export function traceCommand(target: 'react' | 'solid') {
	return defineBrowserCommand(
		async (
			_context,
			traceTarget: string,
			component: string,
			scenario: string,
			content: string,
		) => {
			if (traceTarget !== target || !/^[A-Za-z][A-Za-z0-9]*$/.test(component)) {
				throw new Error('Invalid ui-kit trace target or component name.');
			}
			const scenarioName = scenario.split('/').at(-1);
			if (!scenarioName || !/^[a-z0-9-]+$/.test(scenarioName)) {
				throw new Error('Invalid ui-kit trace scenario id.');
			}
			const traceDirectory = resolve(demoRoot, `traces/${target}`);
			await mkdir(traceDirectory, { recursive: true });
			await writeFile(
				resolve(traceDirectory, `${component}.${scenarioName}.json`),
				content,
				'utf8',
			);
		},
	);
}
