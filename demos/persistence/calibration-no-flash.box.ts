import { box } from '@async/witness';
import { buildTarget, frameworks } from './src/witness-fixture.ts';

const CORRECT_SEED =
	'globalThis.__FRAMELESS_STATE__["markless:draft"]=v;';
const BROKEN_SEED =
	'globalThis.__FRAMELESS_STATE__["markless:draft"]="calibration-wrong";';

export default box(
	{
		name: 'calibration — wrong pre-paint seed',
		modes: ['build'],
		tags: ['persistence', 'calibration'],
	},
	async ({ pipeline, project, expect, receipt }) => {
		for (const framework of frameworks) {
			const build = await buildTarget(pipeline, expect, framework);
			await project.edit(`${framework}-app/dist/index.html`, {
				replace: [CORRECT_SEED, BROKEN_SEED],
			});

			const preview = await pipeline.preview(build);
			try {
				const page = await preview.browser.visit('/setup.html');
				await expect.page.attribute(
					page,
					'html',
					'data-probe-seed',
					'calibration-wrong',
				);
				await expect.page.attribute(
					page,
					'html',
					'data-probe-attribute',
					'dark',
				);
				await expect.page.attribute(
					page,
					'html',
					'data-framework-activated',
					null,
				);
				await expect.page.outcome(page, {
					consoleErrors: 0,
					failedRequests: 0,
				});
				receipt.note(
					JSON.stringify({
						kind: 'persistence-calibration',
						framework,
						mechanism: 'pre-paint state-slot assignment changed to calibration-wrong',
						cleanNoFlashWouldDetect: true,
					}),
				);
			} finally {
				await preview.close();
			}
		}
	},
);
