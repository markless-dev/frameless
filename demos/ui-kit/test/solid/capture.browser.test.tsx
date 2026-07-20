import { runScenario } from '@frameless/analyzer';
import { createSolidAdapter } from '@frameless/solid/adapter';
import { describe, test } from 'vitest';
import { NewsletterForm } from '../../dist/NewsletterForm/solid/NewsletterForm.jsx';
import { PricingCard } from '../../dist/PricingCard/solid/PricingCard.jsx';
import { TaskList } from '../../dist/TaskList/solid/TaskList.jsx';
import { assertExpectedCallbacks, persistTrace, scenariosFor } from '../capture.ts';

const components = { PricingCard, TaskList, NewsletterForm };

describe.each(Object.entries(components))('%s Solid capture', (component, implementation) => {
	for (const scenario of scenariosFor(component)) {
		test(scenario.id, async () => {
			const trace = await runScenario(createSolidAdapter(implementation), scenario);
			assertExpectedCallbacks(trace, scenario.expectedCallbacks);
			await persistTrace('solid', component, trace);
		});
	}
});
