import { box } from '@async/witness';

const SERVER_BUNDLE = 'solid-app/dist/server/server.js';
const CLIENT_BUNDLE = 'solid-app/dist/client/client.js';

export default box(
	{
		name: 'solid emitted output prerenders before activation',
		modes: ['build'],
		tags: ['ssr'],
	},
	async ({ pipeline, expect, receipt }) => {
		const build = await pipeline.build({
			config: (config) => ({
				...config,
				configFile: 'solid-app/vite.config.ts',
				root: 'solid-app',
			}),
		});

		await expect.build.environment(build, 'ssr');
		await expect.build.environment(build, 'client');
		await expect.build.artifact(build, SERVER_BUNDLE);
		await expect.build.artifact(build, CLIENT_BUNDLE);

		const preview = await pipeline.preview(build);
		try {
			const html = await preview.request('/pricing-card');
			if (html.trim().length === 0) throw new Error('Expected non-empty prerendered Solid HTML.');
			await expect.html.contains(html, 'data-component="pricing-card"');
			receipt.note('Solid preview served build-time renderToString output from the emitted component.');
		} finally {
			await preview.close();
		}
	},
);
