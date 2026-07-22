import { box } from '@async/witness';

const SOLID_CONFIG = 'solid-app/vite.config.ts';
const SOLID_SERVER_ENTRY = 'solid-app/src/server-entry.tsx';

export default box(
	{
		name: 'activation calibration — solid',
		modes: ['build'],
		tags: ['ssr', 'calibration'],
	},
	async ({ pipeline, project, expect, receipt }) => {
		await project.edit('disable Solid hydration for activation calibration', {
			[SOLID_CONFIG]: (config) => {
				const edited = config.replaceAll('hydratable: true', 'hydratable: false');
				if (edited === config) {
					throw new Error('Solid activation calibration could not disable the hydratable build.');
				}
				return edited;
			},
			[SOLID_SERVER_ENTRY]: {
				replace: ['hydrationScript: generateHydrationScript(),', "hydrationScript: '',"],
			},
		});

		const build = await pipeline.build({
			config: (config) => ({
				...config,
				configFile: SOLID_CONFIG,
				root: 'solid-app',
			}),
		});

		const preview = await pipeline.preview(build);
		try {
			const page = await preview.browser.visit('/pricing-card/');
			await expect.page.exists(page, '[data-component="pricing-card"]');

			// Calibration: disabling hydratable MUST surface as exactly one console error at
			// activation. Asserting the BROKEN count (1, not 0) proves claim (b)'s clean-activation
			// assertion can DETECT a dirty activation, while keeping this box's own assertion green.
			await expect.page.outcome(page, { consoleErrors: 1, failedRequests: 0 });
			await receipt.capture('solid activation calibration console evidence');
			receipt.note(
				JSON.stringify({
					kind: 'activation-calibration',
					framework: 'solid',
					mechanism: 'hydratable compilation disabled and hydration script omitted',
					detected: true,
					expectedConsoleErrors: 1,
				}),
			);
		} finally {
			await preview.close();
		}
	},
);
