import { box } from '@async/witness';
import { uiKitScenarios } from '../ui-kit/scenarios.ts';

const scenarioName = (id: string) => id.slice(id.lastIndexOf('/') + 1);
const pathForScenario = (id: string) => `/${scenarioName(id)}/`;

export default box(
	{
		name: 'clean activation — react',
		modes: ['build'],
		tags: ['ssr'],
	},
	async ({ pipeline, expect, receipt }) => {
		const build = await pipeline.build({
			config: (config) => ({
				...config,
				configFile: 'react-app/vite.config.ts',
				root: 'react-app',
			}),
		});

		const preview = await pipeline.preview(build);
		const scenarios: { scenario: string; activationClean: true }[] = [];
		try {
			for (const scenario of uiKitScenarios) {
				const component = scenarioName(scenario.id);
				const page = await preview.browser.visit(pathForScenario(scenario.id));
				await expect.page.exists(page, `[data-component="${component}"]`);
				await expect.page.outcome(page, { consoleErrors: 0, failedRequests: 0 });
				scenarios.push({ scenario: scenario.id, activationClean: true });
			}
		} finally {
			await preview.close();
		}

		receipt.note(JSON.stringify({ kind: 'claim-b-results', framework: 'react', scenarios }));
	},
);
