import {
	compositionScenarios,
	compareRuns,
	evaluateExpectations,
	runScenario,
	type Scenario,
} from '@frameless/analyzer';
import { createSolidAdapter } from '@frameless/solid/adapter';
import { createComponent, type Component } from 'solid-js';
import { afterEach, describe, expect, test } from 'vitest';
import { SlotPage } from '../generated-composition/C1-slot.jsx';
import {
	CompositionSharedProvider,
	SharedParticipants,
} from '../generated-composition/C2-shared.jsx';
import { FocusPage } from '../generated-composition/C3-ref.jsx';
import { CleanupPage } from '../generated-composition/C4-attach.jsx';
import { PropsPage, PropsValueProvider } from '../generated-composition/C5-props.jsx';
import { ScalarFanoutProvider, ScalarPage } from '../generated-composition/C6-scalar-context.jsx';
import { FullPairProvider, ObjectPage } from '../generated-composition/C7-object-context.jsx';
import { PageLedger } from '../generated-composition/C8-page-store.jsx';
import {
	resetSolidPageTierReference,
	SolidObjectContextTierReference,
	SolidPageStoreTierReference,
	SolidPropsTierReference,
	SolidPropsValueProvider,
	SolidScalarContextTierReference,
	solidCompositionReferences,
} from './composition-reference.solid.tsx';

const cleanupSelector = '[data-composition-witness]';
const handleSelector = '[data-handle-witness]';

function withProvider(provider: Component<any>, child: Component): Component {
	return () =>
		createComponent(provider, {
			get children() {
				return createComponent(child, {});
			},
		});
}

const emitted: Record<string, Component> = {
	'C1-slot-rendering': SlotPage,
	'C2-shared-propagation': withProvider(CompositionSharedProvider, SharedParticipants),
	'C3-ref-driven-focus': FocusPage,
	'C4-attach-cleanup': CleanupPage,
};

const tierScenarios: Scenario[] = [
	{
		id: 'C5-props-tier',
		purpose: 'single scalar prop-threading tier',
		initialProps: {},
		actions: [],
		expectedCallbacks: [],
		expectations: [
			{ kind: 'dom-text', phase: 'mount', selector: '[data-tier-props]', text: '5' },
		],
	},
	{
		id: 'C6-scalar-context',
		purpose: 'scalar context fan-out tier',
		initialProps: {},
		actions: [],
		expectedCallbacks: [],
		expectations: [
			{ kind: 'dom-text', phase: 'mount', selector: '[data-tier-scalar="left"]', text: '6' },
			{ kind: 'dom-text', phase: 'mount', selector: '[data-tier-scalar="right"]', text: '6' },
		],
	},
	{
		id: 'C7-object-context',
		purpose: 'complete-read object context tier',
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

const tierReferences: Record<string, Component> = {
	'C5-props-tier': withProvider(SolidPropsValueProvider, SolidPropsTierReference),
	'C6-scalar-context': SolidScalarContextTierReference,
	'C7-object-context': SolidObjectContextTierReference,
};
const emittedTiers: Record<string, Component> = {
	'C5-props-tier': withProvider(PropsValueProvider, PropsPage),
	'C6-scalar-context': withProvider(ScalarFanoutProvider, ScalarPage),
	'C7-object-context': withProvider(FullPairProvider, ObjectPage),
};

function removeWitnesses() {
	document
		.querySelectorAll(`${cleanupSelector}, ${handleSelector}`)
		.forEach((node) => node.remove());
}
function witnessFor(id: string) {
	if (id === 'C4-attach-cleanup') return { selector: cleanupSelector };
	if (id === 'C3-ref-driven-focus') return { selector: handleSelector };
	return undefined;
}
afterEach(removeWitnesses);

describe('emitted Solid composition against the calibrated handwritten reference', () => {
	for (const scenario of compositionScenarios) {
		test(scenario.id, async () => {
			removeWitnesses();
			const reference = await runScenario(
				createSolidAdapter(solidCompositionReferences[scenario.id] as never),
				scenario,
				witnessFor(scenario.id),
			);
			removeWitnesses();
			const generated = await runScenario(
				createSolidAdapter(emitted[scenario.id] as never),
				scenario,
				witnessFor(scenario.id),
			);
			const passing = (scenario.expectations ?? []).map((expectation) => ({
				expectation,
				phase: expectation.phase,
				outcome: 'pass' as const,
			}));
			expect(evaluateExpectations(reference, scenario.expectations ?? [])).toEqual(passing);
			expect(evaluateExpectations(generated, scenario.expectations ?? [])).toEqual(passing);
			expect(compareRuns(reference, generated)).toEqual({ equal: true, divergences: [] });
			if (scenario.id === 'C2-shared-propagation') {
				expect(JSON.stringify(reference)).not.toContain('seed:0|0');
				expect(JSON.stringify(generated)).not.toContain('seed:0|0');
			}
		});
	}

	for (const scenario of tierScenarios) {
		test(scenario.id, async () => {
			const reference = await runScenario(
				createSolidAdapter(tierReferences[scenario.id] as never),
				scenario,
			);
			const generated = await runScenario(
				createSolidAdapter(emittedTiers[scenario.id] as never),
				scenario,
			);
			expect(
				evaluateExpectations(generated, scenario.expectations ?? []).every(
					(result) => result.outcome === 'pass',
				),
			).toBe(true);
			expect(compareRuns(reference, generated)).toEqual({ equal: true, divergences: [] });
		});
	}

	test('C8 page module singleton shares one update across two independent mounts', async () => {
		resetSolidPageTierReference();
		const referenceAdapter = createSolidAdapter(SolidPageStoreTierReference);
		const generatedAdapter = createSolidAdapter(PageLedger);
		const hosts = Array.from({ length: 4 }, () => document.createElement('div'));
		document.body.append(...hosts);
		const mounts = await Promise.all([
			referenceAdapter.mount(hosts[0]!, {}),
			referenceAdapter.mount(hosts[1]!, {}),
			generatedAdapter.mount(hosts[2]!, {}),
			generatedAdapter.mount(hosts[3]!, {}),
		]);
		try {
			expect(
				hosts.map((host) => host.querySelector('[data-tier-page]')?.textContent),
			).toEqual(['0', '0', '0', '0']);
			await referenceAdapter.dispatch(mounts[0], {
				type: 'click',
				target: '[data-action="increment-page-tier"]',
			});
			await generatedAdapter.dispatch(mounts[2], {
				type: 'click',
				target: '[data-action="increment-page-tier"]',
			});
			expect(
				hosts.map((host) => host.querySelector('[data-tier-page]')?.textContent),
			).toEqual(['1', '1', '1', '1']);
		} finally {
			await referenceAdapter.unmount(mounts[0]);
			await referenceAdapter.unmount(mounts[1]);
			await generatedAdapter.unmount(mounts[2]);
			await generatedAdapter.unmount(mounts[3]);
			hosts.forEach((host) => host.remove());
		}
	});

	test('C2 emitted container provider isolates two independent mounts', async () => {
		const adapter = createSolidAdapter(
			withProvider(CompositionSharedProvider, SharedParticipants) as never,
		);
		const hosts = Array.from({ length: 2 }, () => document.createElement('div'));
		document.body.append(...hosts);
		const mounts = await Promise.all(hosts.map((host) => adapter.mount(host, {})));
		try {
			expect(
				hosts.map((host) => host.querySelector('[data-shared-reader]')?.textContent),
			).toEqual(['seed|0', 'seed|0']);
			await adapter.dispatch(mounts[0], {
				type: 'click',
				target: '[data-action="advance-shared"]',
			});
			expect(
				hosts.map((host) => host.querySelector('[data-shared-reader]')?.textContent),
			).toEqual(['seed:0|1', 'seed|0']);
		} finally {
			await adapter.unmount(mounts[0]);
			await adapter.unmount(mounts[1]);
			hosts.forEach((host) => host.remove());
		}
	});
});
