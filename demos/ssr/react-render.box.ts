import { box } from '@async/witness';

const SERVER_BUNDLE = 'react-app/dist/server/server.js';
const CLIENT_BUNDLE = 'react-app/dist/client/client.js';

export default box(
	{
		name: 'react emitted output prerenders before activation',
		modes: ['build'],
		tags: ['ssr'],
	},
	async ({ pipeline, expect, receipt }) => {
		const build = await pipeline.build({
			config: (config) => ({
				...config,
				configFile: 'react-app/vite.config.ts',
				root: 'react-app',
			}),
		});

		await expect.build.environment(build, 'ssr');
		await expect.build.environment(build, 'client');
		await expect.build.artifact(build, SERVER_BUNDLE);
		await expect.build.artifact(build, CLIENT_BUNDLE);

		const preview = await pipeline.preview(build);
		const html = await preview.request('/pricing-card');
		if (html.trim().length === 0) throw new Error('Expected non-empty prerendered React HTML.');
		await expect.html.contains(html, 'data-component="pricing-card"');
		receipt.note('React preview served build-time renderToString output from the emitted component.');
		await preview.close();
	},
);
