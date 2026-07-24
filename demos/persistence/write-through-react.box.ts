import { box } from '@async/witness';
import {
	activate,
	assertWriteThrough,
	buildTarget,
	visitSeeded,
} from './src/witness-fixture.ts';

export default box(
	{
		name: 'write-through — react',
		modes: ['build'],
		tags: ['persistence'],
	},
	async ({ pipeline, expect, receipt }) => {
		const build = await buildTarget(pipeline, expect, 'react');
		const preview = await pipeline.preview(build);
		try {
			const page = await visitSeeded(preview, expect);
			await activate(page, expect, 'react');
			await assertWriteThrough(page, expect);
			await expect.page.outcome(page, { consoleErrors: 0, failedRequests: 0 });
			receipt.note(
				'React add assignment cleared the rendered draft, localStorage["markless:draft"], and data-markless-draft.',
			);
		} finally {
			await preview.close();
		}
	},
);
