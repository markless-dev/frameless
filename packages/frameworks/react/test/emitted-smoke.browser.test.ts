import { compareRuns, runScenario, scenarios } from '@frameless/analyzer';
import { describe, expect, test } from 'vitest';
import { EventForm } from '../generated/S3.jsx';
import { KeyedTodo } from '../generated/S2.jsx';
import { RenderOnce } from '../generated/S1.jsx';
import { createReactAdapter } from '../src/index.ts';
import { reactReferences } from './reference.tsx';

const emitted = {
	'S1-render-once-locals': RenderOnce,
	'S2-keyed-todo': KeyedTodo,
	'S3-event-form': EventForm,
};

describe('emitted React 19 components against calibrated handwritten references', () => {
	for (const scenario of scenarios) {
		test(scenario.id, async () => {
			const reference = await runScenario(
				createReactAdapter(reactReferences[scenario.id]),
				scenario,
			);
			const generated = await runScenario(
				createReactAdapter(emitted[scenario.id as keyof typeof emitted]),
				scenario,
			);
			expect(compareRuns(reference, generated)).toEqual({ equal: true, divergences: [] });
		});
	}
});
