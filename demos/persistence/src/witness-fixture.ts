import type {
	BuildHandle,
	ExpectApi,
	PageHandle,
	PipelineApi,
	PreviewHandle,
} from '@async/witness';
import type { InlineConfig } from 'vite';

export type Framework = 'react' | 'solid';

export const frameworks = ['react', 'solid'] as const satisfies readonly Framework[];

export function targetConfig(framework: Framework) {
	return (config: InlineConfig): InlineConfig => ({
		...config,
		configFile: `${framework}-app/vite.config.ts`,
		root: `${framework}-app`,
	});
}

export async function buildTarget(
	pipeline: PipelineApi,
	expect: ExpectApi,
	framework: Framework,
): Promise<BuildHandle> {
	const build = await pipeline.build({
		strategy: 'build',
		config: targetConfig(framework),
	});
	await expect.build.artifact(build, `${framework}-app/dist/index.html`);
	await expect.build.artifact(build, `${framework}-app/dist/setup.html`);
	return build;
}

export async function visitSeeded(
	preview: PreviewHandle,
	expect: ExpectApi,
): Promise<PageHandle> {
	const page = await preview.browser.visit('/setup.html');
	await expect.page.attribute(page, 'html', 'data-probe-seed', 'dark');
	await expect.page.attribute(page, 'html', 'data-probe-attribute', 'dark');
	await expect.page.attribute(page, 'html', 'data-markless-draft', 'dark');
	await expect.page.attribute(page, 'html', 'data-framework-activated', null);
	await expect.page.exists(page, '[data-activation-state]');
	return page;
}

export async function activate(
	page: PageHandle,
	expect: ExpectApi,
	framework: Framework,
): Promise<void> {
	await page.click('[data-action="activate"]');
	await expect.page.exists(page, '[data-scenario="s2"]');
	await expect.page.attribute(
		page,
		'html',
		'data-framework-activated',
		framework,
	);
}

export async function assertWriteThrough(
	page: PageHandle,
	expect: ExpectApi,
): Promise<void> {
	await page.click('[data-action="observe-storage"]');
	await expect.page.attribute(page, 'html', 'data-probe-draft-json', '"dark"');
	await expect.page.attribute(page, 'html', 'data-probe-storage-json', '"dark"');
	await page.click('[data-action="add"]');
	await expect.page.attribute(page, 'html', 'data-markless-draft', '');
	await page.click('[data-action="observe-storage"]');
	await expect.page.attribute(page, 'html', 'data-probe-draft-json', '""');
	await expect.page.attribute(page, 'html', 'data-probe-storage-json', '""');
	await expect.page.exists(page, '[data-oracle-row-key="c3"]');
}
