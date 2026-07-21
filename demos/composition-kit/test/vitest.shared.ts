import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineBrowserCommand } from '@vitest/browser-playwright';

export const workspaceRoot = resolve(import.meta.dirname, '../../..');
const demoRoot = resolve(workspaceRoot, 'demos/composition-kit');

export const requireDemoBuild = {
	name: 'frameless-composition-demo-requires-cli-build',
	resolveId(source: string, importer: string | undefined) {
		if (!importer?.includes('/demos/composition-kit/test/') || !source.includes('/dist/'))
			return null;
		const emittedPath = resolve(importer.slice(0, importer.lastIndexOf('/')), source);
		if (!existsSync(emittedPath)) {
			throw new Error(
				`Missing CLI-emitted composition demo module ${emittedPath}; run the CLI build first.`,
			);
		}
		return null;
	},
};

export function traceCommand(target: 'react' | 'solid') {
	return defineBrowserCommand(
		async (_context, traceTarget: string, scenario: string, content: string) => {
			if (traceTarget !== target) throw new Error('Invalid composition-kit trace target.');
			const scenarioName = scenario.split('/').at(-1);
			if (!scenarioName || !/^[a-z0-9-]+$/.test(scenarioName)) {
				throw new Error('Invalid composition-kit trace scenario id.');
			}
			const traceDirectory = resolve(demoRoot, `traces/${target}`);
			await mkdir(traceDirectory, { recursive: true });
			await writeFile(resolve(traceDirectory, `${scenarioName}.json`), content, 'utf8');
		},
	);
}
