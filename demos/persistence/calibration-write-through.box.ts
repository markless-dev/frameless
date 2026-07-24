import { box } from '@async/witness';
import { activate, buildTarget, frameworks, visitSeeded } from './src/witness-fixture.ts';

const STORAGE_CALL = /localStorage\.setItem\(([$\w]+),([$\w]+)\)/g;
const STORAGE_NOOP = 'void ($1,$2)';

export default box(
	{
		name: 'calibration — write-through setItem no-op',
		modes: ['build'],
		tags: ['persistence', 'calibration'],
	},
	async ({ pipeline, project, expect, receipt }) => {
		for (const framework of frameworks) {
			const build = await buildTarget(pipeline, expect, framework);
			const clientArtifact = build.artifacts.find(
				(artifact) =>
					artifact.path.startsWith(`${framework}-app/dist/assets/client-entry-`) &&
					artifact.path.endsWith('.js'),
			);
			if (!clientArtifact) {
				throw new Error(`${framework} persistence client artifact was not found.`);
			}
			await project.edit(clientArtifact.path, (source) => {
				const matches = [...source.matchAll(STORAGE_CALL)];
				if (matches.length !== 1) {
					throw new Error(
						`${framework} client artifact contained ${matches.length} persistence helper setItem calls; expected exactly one.`,
					);
				}
				return source.replaceAll(STORAGE_CALL, STORAGE_NOOP);
			});

			const preview = await pipeline.preview(build);
			try {
				const page = await visitSeeded(preview, expect);
				await activate(page, expect, framework);
				await page.click('[data-action="add"]');
				await expect.page.attribute(page, 'html', 'data-markless-draft', '');
				await page.click('[data-action="observe-storage"]');
				await expect.page.attribute(page, 'html', 'data-probe-draft-json', '""');
				await expect.page.attribute(page, 'html', 'data-probe-storage-json', '"dark"');
				await expect.page.outcome(page, {
					consoleErrors: 0,
					failedRequests: 0,
				});
				receipt.note(
					JSON.stringify({
						kind: 'persistence-calibration',
						framework,
						mechanism: 'emitted localStorage.setItem changed to a no-op',
						cleanWriteThroughWouldDetect: true,
					}),
				);
			} finally {
				await preview.close();
			}
		}
	},
);
