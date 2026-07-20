import { calibrationScenarios, compareRuns, runScenario } from '@frameless/analyzer';
import { createReactAdapter } from '@frameless/react/adapter';
import { describe, expect, test } from 'vitest';
import { EventForm } from '../generated/S3.jsx';
import { KeyedTodo } from '../generated/S2.jsx';
import { RenderOnce } from '../generated/S1.jsx';
import { reactReferences } from './reference.tsx';

const emitted = {
	'S1-render-once-locals': RenderOnce,
	'S2-keyed-todo': KeyedTodo,
	'S3-event-form': EventForm,
};

describe('emitted React 19 components against calibrated handwritten references', () => {
	for (const scenario of calibrationScenarios) {
		test(scenario.id, async () => {
			const componentId = scenario.id.split('/')[0]! as keyof typeof emitted;
			const reference = await runScenario(
				createReactAdapter(reactReferences[componentId]),
				scenario,
			);
			const generated = await runScenario(
				createReactAdapter(emitted[componentId]),
				scenario,
			);
			expect(compareRuns(reference, generated)).toEqual({ equal: true, divergences: [] });
		});
	}
});
