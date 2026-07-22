import { box } from '@async/witness';
import type { Expectation, ExpectationResult } from '@frameless/analyzer';
import { uiKitScenarios } from '../ui-kit/scenarios.ts';
import { evaluatePreActivation, extractRootInnerMarkup } from './src/pre-activation.ts';

const pathForScenario = (id: string) => `/${id.slice(id.lastIndexOf('/') + 1)}/`;

export default box(
	{
		name: 'ssr initial content — solid',
		modes: ['build'],
		tags: ['ssr'],
	},
	async ({ pipeline, expect, receipt }) => {
		const build = await pipeline.build({
			config: (config) => ({
				...config,
				configFile: 'solid-app/vite.config.ts',
				root: 'solid-app',
			}),
		});

		await expect.build.artifact(build, 'solid-app/dist/server/server.js');
		await expect.build.artifact(build, 'solid-app/dist/client/client.js');

		const preview = await pipeline.preview(build);
		const artifact: { scenario: string; path: string; results: ExpectationResult[] }[] = [];
		try {
			for (const scenario of uiKitScenarios) {
				const path = pathForScenario(scenario.id);
				const html = await preview.request(path);
				const results = evaluatePreActivation({
					html: extractRootInnerMarkup(html),
					scenario: scenario.id,
					framework: 'solid',
					expectations: (scenario.expectations ?? []) as Expectation[],
				});
				artifact.push({ scenario: scenario.id, path, results });
				const failures = results.filter((result) => result.outcome === 'fail');
				if (failures.length > 0) {
					throw new Error(`Solid pre-activation failures for ${scenario.id}: ${JSON.stringify(failures)}`);
				}
			}
		} finally {
			await preview.close();
		}

		const total = artifact.reduce((count, entry) => count + entry.results.length, 0);
		const scenarioCounts = artifact
			.map((entry) => `${entry.scenario} ${entry.results.length}/${entry.results.length}`)
			.join(', ');
		receipt.note(JSON.stringify({ kind: 'claim-a-results', framework: 'solid', scenarios: artifact }));
		receipt.note(`Solid claim (a): ${total}/${total} mount dom-* expectations passed; ${scenarioCounts}.`);
	},
);
