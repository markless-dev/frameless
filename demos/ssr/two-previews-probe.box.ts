import { box } from '@async/witness';

export default box(
	{
		name: 'two static previews run sequentially in one box',
		modes: ['build'],
		tags: ['ssr'],
	},
	async ({ pipeline, receipt }) => {
		const reactBuild = await pipeline.build({
			config: (config) => ({
				...config,
				configFile: 'react-app/vite.config.ts',
				root: 'react-app',
			}),
		});
		const reactPreview = await pipeline.preview(reactBuild);
		try {
			const html = await reactPreview.request('/pricing-card');
			if (html.trim().length === 0) throw new Error('Expected non-empty React preview HTML.');
		} finally {
			await reactPreview.close();
		}

		const solidBuild = await pipeline.build({
			config: (config) => ({
				...config,
				configFile: 'solid-app/vite.config.ts',
				root: 'solid-app',
			}),
		});
		const solidPreview = await pipeline.preview(solidBuild);
		try {
			const html = await solidPreview.request('/pricing-card');
			if (html.trim().length === 0) throw new Error('Expected non-empty Solid preview HTML.');
		} finally {
			await solidPreview.close();
		}

		receipt.note('React and Solid static previews both served non-empty HTML in one box.');
	},
);
