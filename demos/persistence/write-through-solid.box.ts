import { box } from '@async/witness';
import {
	activate,
	assertWriteThrough,
	buildTarget,
	visitSeeded,
} from './src/witness-fixture.ts';

export default box(
	{
		name: 'write-through — solid',
		modes: ['build'],
		tags: ['persistence'],
	},
	async ({ pipeline, expect, receipt }) => {
		const build = await buildTarget(pipeline, expect, 'solid');
		const preview = await pipeline.preview(build);
		try {
			const page = await visitSeeded(preview, expect);
			await activate(page, expect, 'solid');
			await assertWriteThrough(page, expect);
			await expect.page.outcome(page, { consoleErrors: 0, failedRequests: 0 });
			receipt.note(
				'Solid add assignment cleared the rendered draft, localStorage["markless:draft"], and data-markless-draft.',
			);
		} finally {
			await preview.close();
		}
	},
);
