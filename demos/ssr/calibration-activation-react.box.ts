import { box } from '@async/witness';

const PRERENDERED_ROUTE = 'react-app/dist/client/pricing-card/index.html';
const SERVER_PRICE = '<output data-price-total="">$24</output>';
const SKEWED_SERVER_PRICE = '<output data-price-total="">$2400</output>';

export default box(
	{
		name: 'activation calibration — react',
		modes: ['build'],
		tags: ['ssr', 'calibration'],
	},
	async ({ pipeline, project, expect, receipt }) => {
		const build = await pipeline.build({
			config: (config) => ({
				...config,
				configFile: 'react-app/vite.config.ts',
				root: 'react-app',
			}),
		});

		await project.edit(PRERENDERED_ROUTE, {
			replace: [SERVER_PRICE, SKEWED_SERVER_PRICE],
		});

		const preview = await pipeline.preview(build);
		try {
			const page = await preview.browser.visit('/pricing-card/');
			await expect.page.exists(page, '[data-component="pricing-card"]');

			// Calibration: the deliberate server/client skew MUST surface as exactly one
			// console error (React 19 hydration mismatch, error #418). Asserting the BROKEN
			// count (1, not 0) proves claim (b)'s clean-activation assertion can DETECT a dirty
			// activation, while keeping this box's own assertion green.
			await expect.page.outcome(page, { consoleErrors: 1, failedRequests: 0 });
			await receipt.capture('react activation calibration console evidence');
			receipt.note(
				JSON.stringify({
					kind: 'activation-calibration',
					framework: 'react',
					mechanism: 'prerendered server price text skewed from $24 to $2400',
					detected: true,
					expectedConsoleErrors: 1,
				}),
			);
		} finally {
			await preview.close();
		}
	},
);
