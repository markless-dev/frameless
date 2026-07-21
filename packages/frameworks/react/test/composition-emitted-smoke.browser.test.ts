import {
	compositionScenarios,
	compareRuns,
	evaluateExpectations,
	runScenario,
} from '@frameless/analyzer';
import { createReactAdapter } from '@frameless/react/adapter';
import { createElement, type ComponentType } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { SlotPage } from '../generated-composition/C1-slot.jsx';
import {
	CompositionSharedProvider,
	SharedParticipants,
} from '../generated-composition/C2-shared.jsx';
import { FocusPage } from '../generated-composition/C3-ref.jsx';
import { CleanupPage } from '../generated-composition/C4-attach.jsx';
import { reactCompositionReferences } from './composition-reference.tsx';

const cleanupSelector = '[data-composition-witness]';
const handleSelector = '[data-handle-witness]';

function EmittedSharedPage() {
	return createElement(CompositionSharedProvider, null, createElement(SharedParticipants));
}

const emitted: Record<string, ComponentType> = {
	'C1-slot-rendering': SlotPage,
	'C2-shared-propagation': EmittedSharedPage,
	'C3-ref-driven-focus': FocusPage,
	'C4-attach-cleanup': CleanupPage,
};

function removeWitnesses() {
	document
		.querySelectorAll(`${cleanupSelector}, ${handleSelector}`)
		.forEach((node) => node.remove());
}

function witnessFor(scenarioId: string) {
	if (scenarioId === 'C4-attach-cleanup') return { selector: cleanupSelector };
	if (scenarioId === 'C3-ref-driven-focus') return { selector: handleSelector };
	return undefined;
}

afterEach(removeWitnesses);

describe('emitted React composition against the calibrated handwritten reference', () => {
	for (const scenario of compositionScenarios) {
		test(scenario.id, async () => {
			removeWitnesses();
			const reference = await runScenario(
				createReactAdapter(reactCompositionReferences[scenario.id] as never),
				scenario,
				witnessFor(scenario.id),
			);
			removeWitnesses();
			const generated = await runScenario(
				createReactAdapter(emitted[scenario.id] as never),
				scenario,
				witnessFor(scenario.id),
			);

			expect(evaluateExpectations(reference, scenario.expectations ?? [])).toEqual(
				(scenario.expectations ?? []).map((expectation) => ({
					expectation,
					phase: expectation.phase,
					outcome: 'pass',
				})),
			);
			expect(evaluateExpectations(generated, scenario.expectations ?? [])).toEqual(
				(scenario.expectations ?? []).map((expectation) => ({
					expectation,
					phase: expectation.phase,
					outcome: 'pass',
				})),
			);
			expect(compareRuns(reference, generated)).toEqual({
				equal: true,
				divergences: [],
			});
		});
	}
});
