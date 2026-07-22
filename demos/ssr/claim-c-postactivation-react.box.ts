import { box } from '@async/witness';
import { uiKitScenarios } from '../ui-kit/scenarios.ts';
import {
	runPostActivationScenario,
	type PostActivationScenarioResult,
} from './src/post-activation.ts';

const pathForScenario = (id: string) => `/${id.slice(id.lastIndexOf('/') + 1)}/`;

export default box(
	{
		name: 'post-activation scenarios — react',
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
		const scenarios: PostActivationScenarioResult[] = [];
		try {
			for (const scenario of uiKitScenarios) {
				const page = await preview.browser.visit(pathForScenario(scenario.id));
				const actions = await runPostActivationScenario({
					expect,
					page,
					scenario: scenario.id,
					actions: scenario.actions,
				});
				await expect.page.outcome(page, { consoleErrors: 0, failedRequests: 0 });
				scenarios.push({ scenario: scenario.id, ...actions, postActivationPass: true });
			}
		} finally {
			await preview.close();
		}

		receipt.note(JSON.stringify({ kind: 'claim-c-results', framework: 'react', scenarios }));
		receipt.note(
			'witness 0.7.0 PageHandle has no text-input primitive; full scenario replay of input actions is not expressible',
		);
	},
);
