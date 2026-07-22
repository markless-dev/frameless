import { box } from '@async/witness';
import type { Expectation } from '@frameless/analyzer';
import { uiKitScenarios } from '../ui-kit/scenarios.ts';
import { evaluatePreActivation, extractRootInnerMarkup } from './src/pre-activation.ts';

const PRICING_PATH = '/pricing-card/';
const CORRECT_PRICE = '>$24</output>';
const BROKEN_PRICE = '>$2400</output>';

const pricingScenario = uiKitScenarios.find(({ id }) => id === 'ui-kit/pricing-card');
if (!pricingScenario) throw new Error('Content calibration requires the pricing-card scenario.');

const frameworks = [
	{
		framework: 'react',
		configFile: 'react-app/vite.config.ts',
		root: 'react-app',
		prerenderedRoute: 'react-app/dist/client/pricing-card/index.html',
	},
	{
		framework: 'solid',
		configFile: 'solid-app/vite.config.ts',
		root: 'solid-app',
		prerenderedRoute: 'solid-app/dist/client/pricing-card/index.html',
	},
] as const;

export default box(
	{
		name: 'content calibration — prerendered price text',
		modes: ['build'],
		tags: ['ssr', 'calibration'],
	},
	async ({ pipeline, project, receipt }) => {
		for (const target of frameworks) {
			const build = await pipeline.build({
				config: (config) => ({
					...config,
					configFile: target.configFile,
					root: target.root,
				}),
			});

			await project.edit(target.prerenderedRoute, {
				replace: [CORRECT_PRICE, BROKEN_PRICE],
			});

			const preview = await pipeline.preview(build);
			try {
				const html = await preview.request(PRICING_PATH);
				const results = evaluatePreActivation({
					html: extractRootInnerMarkup(html),
					scenario: pricingScenario.id,
					framework: target.framework,
					expectations: (pricingScenario.expectations ?? []) as Expectation[],
				});
				const priceFailure = results.find(
					(result) =>
						result.outcome === 'fail' &&
						result.expectation.kind === 'dom-text' &&
						result.expectation.selector === '[data-price-total]' &&
						result.observed === '$2400',
				);
				if (!priceFailure) {
					throw new Error(
						`${target.framework} content calibration did not detect the deliberately broken $2400 price: ${JSON.stringify(results)}`,
					);
				}

				receipt.note(
					JSON.stringify({
						kind: 'calibration',
						claim: 'a',
						framework: target.framework,
						mechanism: 'prerendered pricing-card total changed from $24 to $2400',
						brokenSignalDetected: true,
					}),
				);
			} finally {
				await preview.close();
			}
		}
	},
);
