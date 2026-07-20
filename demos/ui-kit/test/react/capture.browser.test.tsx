import { runScenario } from '@frameless/analyzer';
import { createReactAdapter } from '@frameless/react/adapter';
import { describe, test } from 'vitest';
import { NewsletterForm } from '../../dist/NewsletterForm/react/NewsletterForm.jsx';
import { PricingCard } from '../../dist/PricingCard/react/PricingCard.jsx';
import { TaskList } from '../../dist/TaskList/react/TaskList.jsx';
import { assertExpectedCallbacks, persistTrace, scenariosFor } from '../capture.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const components = { PricingCard, TaskList, NewsletterForm };

describe.each(Object.entries(components))('%s React capture', (component, implementation) => {
	for (const scenario of scenariosFor(component)) {
		test(scenario.id, async () => {
			const trace = await runScenario(createReactAdapter(implementation), scenario);
			assertExpectedCallbacks(trace, scenario.expectedCallbacks);
			await persistTrace('react', component, trace);
		});
	}
});
