import {
	compositionScenarios,
	compareRuns,
	evaluateExpectations,
	runScenario,
	type Scenario,
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
import { PropsPage } from '../generated-composition/C5-props.jsx';
import {
	ScalarFanoutProvider,
	ScalarPage,
} from '../generated-composition/C6-scalar-context.jsx';
import {
	FullPairProvider,
	ObjectPage,
} from '../generated-composition/C7-object-context.jsx';
import { PageLedger } from '../generated-composition/C8-page-store.jsx';
import {
	ReactObjectContextTierReference,
	ReactPageStoreTierReference,
	ReactPropsTierReference,
	ReactScalarContextTierReference,
	reactCompositionReferences,
	resetReactPageTierReference,
} from './composition-reference.tsx';

const cleanupSelector = '[data-composition-witness]';
const handleSelector = '[data-handle-witness]';

function EmittedSharedPage() {
	return createElement(CompositionSharedProvider, null, createElement(SharedParticipants));
}

function EmittedScalarContextPage() {
	return createElement(ScalarFanoutProvider, null, createElement(ScalarPage));
}

function EmittedObjectContextPage() {
	return createElement(FullPairProvider, null, createElement(ObjectPage));
}

const emitted: Record<string, ComponentType> = {
	'C1-slot-rendering': SlotPage,
	'C2-shared-propagation': EmittedSharedPage,
	'C3-ref-driven-focus': FocusPage,
	'C4-attach-cleanup': CleanupPage,
};

const tierScenarios: Scenario[] = [
	{
		id: 'C5-props-tier',
		purpose: 'single scalar prop threading to a direct-root reader',
		initialProps: {},
		actions: [],
		expectedCallbacks: [],
		expectations: [
			{ kind: 'dom-text', phase: 'mount', selector: '[data-tier-props]', text: '5' },
		],
	},
	{
		id: 'C6-scalar-context',
		purpose: 'single scalar context through split deep fan-out branches',
		initialProps: {},
		actions: [],
		expectedCallbacks: [],
		expectations: [
			{
				kind: 'dom-text',
				phase: 'mount',
				selector: '[data-tier-scalar="left"]',
				text: '6',
			},
			{
				kind: 'dom-text',
				phase: 'mount',
				selector: '[data-tier-scalar="right"]',
				text: '6',
			},
		],
	},
	{
		id: 'C7-object-context',
		purpose: 'object context where every consumer reads the complete cell set',
		initialProps: {},
		actions: [],
		expectedCallbacks: [],
		expectations: [
			{
				kind: 'dom-text',
				phase: 'mount',
				selector: '[data-tier-object="first"]',
				text: '7|seven',
			},
			{
				kind: 'dom-text',
				phase: 'mount',
				selector: '[data-tier-object="second"]',
				text: '7|seven',
			},
		],
	},
];

const tierReferences: Record<string, ComponentType> = {
	'C5-props-tier': ReactPropsTierReference,
	'C6-scalar-context': ReactScalarContextTierReference,
	'C7-object-context': ReactObjectContextTierReference,
};

const emittedTiers: Record<string, ComponentType> = {
	'C5-props-tier': PropsPage,
	'C6-scalar-context': EmittedScalarContextPage,
	'C7-object-context': EmittedObjectContextPage,
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
			if (scenario.id === 'C2-shared-propagation') {
				expect(JSON.stringify(reference)).not.toContain('seed:0|0');
				expect(JSON.stringify(generated)).not.toContain('seed:0|0');
			}
		});
	}

	for (const scenario of tierScenarios) {
		test(scenario.id, async () => {
			const reference = await runScenario(
				createReactAdapter(tierReferences[scenario.id] as never),
				scenario,
			);
			const generated = await runScenario(
				createReactAdapter(emittedTiers[scenario.id] as never),
				scenario,
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
			expect(compareRuns(reference, generated)).toEqual({ equal: true, divergences: [] });
		});
	}

	test('C8 page module-store shares one update across two independent mounts', async () => {
		resetReactPageTierReference();
		const referenceAdapter = createReactAdapter(ReactPageStoreTierReference);
		const generatedAdapter = createReactAdapter(PageLedger);
		const hosts = Array.from({ length: 4 }, () => document.createElement('div'));
		document.body.append(...hosts);
		const referenceA = await referenceAdapter.mount(hosts[0]!, {});
		const referenceB = await referenceAdapter.mount(hosts[1]!, {});
		const generatedA = await generatedAdapter.mount(hosts[2]!, {});
		const generatedB = await generatedAdapter.mount(hosts[3]!, {});
		try {
			expect(hosts.map((host) => host.querySelector('[data-tier-page]')?.textContent)).toEqual([
				'0',
				'0',
				'0',
				'0',
			]);
			await referenceAdapter.dispatch(referenceA, {
				type: 'click',
				target: '[data-action="increment-page-tier"]',
			});
			await generatedAdapter.dispatch(generatedA, {
				type: 'click',
				target: '[data-action="increment-page-tier"]',
			});
			expect(hosts.map((host) => host.querySelector('[data-tier-page]')?.textContent)).toEqual([
				'1',
				'1',
				'1',
				'1',
			]);
		} finally {
			await referenceAdapter.unmount(referenceA);
			await referenceAdapter.unmount(referenceB);
			await generatedAdapter.unmount(generatedA);
			await generatedAdapter.unmount(generatedB);
			hosts.forEach((host) => host.remove());
		}
	});
});
