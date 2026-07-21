import { afterEach, describe, expect, test } from 'vitest';
import {
	compositionScenarios,
	evaluateExpectations,
	runScenario,
	type Expectation,
} from '@frameless/analyzer';
import { createSolidAdapter } from '@frameless/solid/adapter';
import {
	makeSolidCompositionMutant,
	resetSolidPageScopeReference,
	SolidContainerScopeReference,
	SolidPageScopeReference,
	solidCompositionReferences,
	type SolidCompositionMutant,
} from './composition-reference.solid.tsx';

const cleanupSelector = '[data-composition-witness]';
const handleSelector = '[data-handle-witness]';
const scenarioById = Object.fromEntries(
	compositionScenarios.map((scenario) => [scenario.id, scenario]),
);

type Rejection = {
	mutant: SolidCompositionMutant;
	scenario: keyof typeof scenarioById;
	expectation: Pick<Expectation, 'kind' | 'phase' | 'selector'>;
};

const rejections: Rejection[] = [
	{
		mutant: 'M-SLOT-OMIT',
		scenario: 'C1-slot-rendering',
		expectation: { kind: 'dom-present', phase: 'mount', selector: '[data-projected-node]' },
	},
	{
		mutant: 'M-SLOT-DUP',
		scenario: 'C1-slot-rendering',
		expectation: { kind: 'dom-present', phase: 'mount', selector: '[data-projected-node]' },
	},
	{
		mutant: 'M-SLOT-WRAPPER',
		scenario: 'C1-slot-rendering',
		expectation: { kind: 'dom-path', phase: 'mount', selector: '[data-projected-node]' },
	},
	{
		mutant: 'M-SHARED-DESYNC',
		scenario: 'C2-shared-propagation',
		expectation: {
			kind: 'dom-text',
			phase: 'action:0:after',
			selector: '[data-shared-reader]',
		},
	},
	{
		mutant: 'M-SHARED-STALE',
		scenario: 'C2-shared-propagation',
		expectation: {
			kind: 'dom-text',
			phase: 'action:1:after',
			selector: '[data-shared-reader]',
		},
	},
	{
		mutant: 'M-REF-FOCUS-OMIT',
		scenario: 'C3-ref-driven-focus',
		expectation: { kind: 'focus', phase: 'action:0:after', selector: '[data-focus-target]' },
	},
	{
		mutant: 'M-ATTACH-CLEANUP-OMIT',
		scenario: 'C4-attach-cleanup',
		expectation: {
			kind: 'dom-text',
			phase: 'unmount',
			selector: '[data-composition-cleanup]',
		},
	},
	{
		mutant: 'M-CLEANUP-EARLY-WRITE',
		scenario: 'C4-attach-cleanup',
		expectation: {
			kind: 'dom-text',
			phase: 'mount',
			selector: '[data-composition-cleanup]',
		},
	},
	{
		mutant: 'M-REINSTALL-OMIT',
		scenario: 'C4-attach-cleanup',
		expectation: {
			kind: 'dom-text',
			phase: 'action:0:after',
			selector: '[data-behavior-log]',
		},
	},
	{
		mutant: 'M-CLEANUP-ORDER',
		scenario: 'C4-attach-cleanup',
		expectation: {
			kind: 'dom-text',
			phase: 'action:0:after',
			selector: '[data-behavior-log]',
		},
	},
	{
		mutant: 'M-HANDLE-CLEAR-OMIT',
		scenario: 'C3-ref-driven-focus',
		expectation: { kind: 'dom-text', phase: 'unmount', selector: '[data-handle-state]' },
	},
	{
		mutant: 'M-METHOD-ORDER',
		scenario: 'C2-shared-propagation',
		expectation: {
			kind: 'dom-text',
			phase: 'action:0:after',
			selector: '[data-shared-reader]',
		},
	},
	{
		mutant: 'M-SHARED-TEAR',
		scenario: 'C2-shared-propagation',
		expectation: {
			kind: 'dom-text',
			phase: 'action:0:after',
			selector: '[data-shared-audit]',
		},
	},
];

function removeCleanupWitnesses() {
	document
		.querySelectorAll(`${cleanupSelector}, ${handleSelector}`)
		.forEach((node) => node.remove());
}

async function runComposition(component: unknown, scenarioId: string) {
	const scenario = scenarioById[scenarioId];
	const witness =
		scenarioId === 'C4-attach-cleanup'
			? { selector: cleanupSelector }
			: scenarioId === 'C3-ref-driven-focus'
				? { selector: handleSelector }
				: undefined;
	return runScenario(createSolidAdapter(component as never), scenario, witness);
}

afterEach(removeCleanupWitnesses);

describe('Solid composition oracle calibration', () => {
	for (const scenario of compositionScenarios) {
		test(`${scenario.id}: handwritten reference satisfies every expectation`, async () => {
			removeCleanupWitnesses();
			const trace = await runComposition(
				solidCompositionReferences[scenario.id],
				scenario.id,
			);
			expect(evaluateExpectations(trace, scenario.expectations ?? [])).toEqual(
				(scenario.expectations ?? []).map((expectation) => ({
					expectation,
					phase: expectation.phase,
					outcome: 'pass',
				})),
			);
		});
	}

	for (const rejection of rejections) {
		test(`${rejection.mutant} is rejected by its calibrated expectation`, async () => {
			removeCleanupWitnesses();
			const scenario = scenarioById[rejection.scenario];
			const trace = await runComposition(
				makeSolidCompositionMutant(rejection.mutant),
				rejection.scenario,
			);
			const results = evaluateExpectations(trace, scenario.expectations ?? []);
			expect(
				results.some(
					(result) =>
						result.outcome === 'fail' &&
						result.expectation.kind === rejection.expectation.kind &&
						result.expectation.phase === rejection.expectation.phase &&
						result.expectation.selector === rejection.expectation.selector,
				),
			).toBe(true);
		});
	}

	test('F5: container scope isolates mounts and page scope shares them', async () => {
		const containerAdapter = createSolidAdapter(SolidContainerScopeReference);
		const containerHostA = document.createElement('div');
		const containerHostB = document.createElement('div');
		document.body.append(containerHostA, containerHostB);
		const containerA = await containerAdapter.mount(containerHostA, {});
		const containerB = await containerAdapter.mount(containerHostB, {});
		try {
			await containerAdapter.dispatch(containerA, {
				type: 'click',
				target: '[data-scope-increment="container"]',
			});
			expect(
				containerHostA.querySelector('[data-scope-value="container"]')?.textContent,
			).toBe('1');
			expect(
				containerHostB.querySelector('[data-scope-value="container"]')?.textContent,
			).toBe('0');
		} finally {
			await containerAdapter.unmount(containerA);
			await containerAdapter.unmount(containerB);
			containerHostA.remove();
			containerHostB.remove();
		}

		resetSolidPageScopeReference();
		const pageAdapter = createSolidAdapter(SolidPageScopeReference);
		const pageHostA = document.createElement('div');
		const pageHostB = document.createElement('div');
		document.body.append(pageHostA, pageHostB);
		const pageA = await pageAdapter.mount(pageHostA, {});
		const pageB = await pageAdapter.mount(pageHostB, {});
		try {
			await pageAdapter.dispatch(pageA, {
				type: 'click',
				target: '[data-scope-increment="page"]',
			});
			expect(pageHostA.querySelector('[data-scope-value="page"]')?.textContent).toBe('1');
			expect(pageHostB.querySelector('[data-scope-value="page"]')?.textContent).toBe('1');
		} finally {
			await pageAdapter.unmount(pageA);
			await pageAdapter.unmount(pageB);
			pageHostA.remove();
			pageHostB.remove();
		}
	});
});
