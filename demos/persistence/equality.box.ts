import { box } from '@async/witness';
import {
	activate,
	assertWriteThrough,
	buildTarget,
	frameworks,
	visitSeeded,
} from './src/witness-fixture.ts';

export default box(
	{
		name: 'persistence equality — react and solid',
		modes: ['build'],
		tags: ['persistence'],
	},
	async ({ pipeline, expect, receipt }) => {
		for (const framework of frameworks) {
			const build = await buildTarget(pipeline, expect, framework);
			const preview = await pipeline.preview(build);
			try {
				const page = await visitSeeded(preview, expect);
				await activate(page, expect, framework);
				await assertWriteThrough(page, expect);
				await expect.page.outcome(page, {
					consoleErrors: 0,
					failedRequests: 0,
				});
			} finally {
				await preview.close();
			}
		}
		receipt.note(
			'React and Solid matched on storage key markless:draft, seed slot globalThis.__FRAMELESS_STATE__["markless:draft"], anti-flash attribute data-markless-draft, cold-to-dark seed, and dark-to-empty write-through.',
		);
	},
);
