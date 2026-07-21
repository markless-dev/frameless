import { runScenario } from '@frameless/analyzer';
import { createReactAdapter } from '@frameless/react/adapter';
import { createElement } from 'react';
import { afterEach, describe, test } from 'vitest';
import { DashboardProvider } from '../../dist/react/dashboard.jsx';
import { Page } from '../../dist/react/page.jsx';
import { StatusValueProvider } from '../../dist/react/status.jsx';
import { compositionKitScenarios } from '../../scenarios.ts';
import { assertExpectations, persistTrace } from '../capture.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function CompositionPage() {
	return createElement(
		DashboardProvider,
		null,
		createElement(StatusValueProvider, null, createElement(Page)),
	);
}

afterEach(() =>
	document.querySelectorAll('[data-search-witness]').forEach((node) => node.remove()),
);

describe('composition-kit React capture', () => {
	for (const scenario of compositionKitScenarios) {
		test(scenario.id, async () => {
			const witness = scenario.id.endsWith('search-focus-cleanup')
				? { selector: '[data-search-witness]' }
				: undefined;
			const trace = await runScenario(createReactAdapter(CompositionPage), scenario, witness);
			assertExpectations(trace);
			await persistTrace('react', trace);
		});
	}
});
