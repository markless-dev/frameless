import { box } from '@async/witness';

const frameworks = [
	{
		framework: 'react',
		configFile: 'react-app/vite.config.ts',
		root: 'react-app',
	},
	{
		framework: 'solid',
		configFile: 'solid-app/vite.config.ts',
		root: 'solid-app',
	},
] as const;

export default box(
	{
		name: 'handler calibration — no-op add seat',
		modes: ['build'],
		tags: ['ssr', 'calibration'],
	},
	async ({ pipeline, project, expect, receipt }) => {
		await project.edit('make emitted pricing-card add-seat handlers no-ops', {
			'dist/PricingCard/react/PricingCard.tsx': {
				replace: ['const nextSeats = seats + 1;', 'const nextSeats = seats;'],
			},
			'dist/PricingCard/solid/PricingCard.tsx': {
				replace: ['setSeats(seats() + 1);', 'setSeats(seats());'],
			},
		});

		for (const target of frameworks) {
			const build = await pipeline.build({
				config: (config) => ({
					...config,
					configFile: target.configFile,
					root: target.root,
				}),
			});

			const preview = await pipeline.preview(build);
			try {
				const page = await preview.browser.visit('/pricing-card/');
				await page.click('[data-action="add-seat"]');

				// Assert the deliberately broken state. The clean claim-(c) box expects 2 / $48.
				await expect.page.text(page, '[data-seat-count]', '1');
				await expect.page.text(page, '[data-price-total]', '$24');
				await expect.page.outcome(page, { consoleErrors: 0, failedRequests: 0 });

				receipt.note(
					JSON.stringify({
						kind: 'calibration',
						claim: 'c',
						framework: target.framework,
						mechanism: 'emitted pricing-card add-seat state update changed to a no-op',
						brokenSignalDetected: true,
					}),
				);
			} finally {
				await preview.close();
			}
		}
	},
);
