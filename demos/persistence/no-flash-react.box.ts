import { box } from '@async/witness';
import { activate, buildTarget, visitSeeded } from './src/witness-fixture.ts';

export default box(
	{
		name: 'no-flash — react',
		modes: ['build'],
		tags: ['persistence'],
	},
	async ({ pipeline, expect, receipt }) => {
		const build = await buildTarget(pipeline, expect, 'react');
		const preview = await pipeline.preview(build);
		try {
			const page = await visitSeeded(preview, expect);
			await activate(page, expect, 'react');
			await expect.page.outcome(page, {
				consoleErrors: 0,
				failedRequests: 0,
			});
			receipt.note(
				'React probe observed globalThis.__FRAMELESS_STATE__["markless:draft"] and data-markless-draft as dark before the activation marker existed.',
			);
		} finally {
			await preview.close();
		}
	},
);
