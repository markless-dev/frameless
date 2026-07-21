import { runScenario } from '@frameless/analyzer';
import { createSolidAdapter } from '@frameless/solid/adapter';
import { createComponent } from 'solid-js';
import { afterEach, describe, test } from 'vitest';
import { DashboardProvider } from '../../dist/solid/dashboard.jsx';
import { Page } from '../../dist/solid/page.jsx';
import { StatusValueProvider } from '../../dist/solid/status.jsx';
import { compositionKitScenarios } from '../../scenarios.ts';
import { assertExpectations, persistTrace } from '../capture.ts';

function CompositionPage() {
	return createComponent(DashboardProvider, {
		get children() {
			return createComponent(StatusValueProvider, {
				get children() {
					return createComponent(Page, {});
				},
			});
		},
	});
}

afterEach(() =>
	document.querySelectorAll('[data-search-witness]').forEach((node) => node.remove()),
);

describe('composition-kit Solid capture', () => {
	for (const scenario of compositionKitScenarios) {
		test(scenario.id, async () => {
			const witness = scenario.id.endsWith('search-focus-cleanup')
				? { selector: '[data-search-witness]' }
				: undefined;
			const trace = await runScenario(createSolidAdapter(CompositionPage), scenario, witness);
			assertExpectations(trace);
			await persistTrace('solid', trace);
		});
	}
});
