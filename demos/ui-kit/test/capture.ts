import { type RunTrace, serializeRunTrace } from '@frameless/analyzer';
import { commands } from 'vitest/browser';
import { expect } from 'vitest';
import { uiKitScenarios } from '../scenarios.ts';

export type DemoTarget = 'react' | 'solid';

export function scenariosFor(component: string) {
	const scenarioName = component.replace(
		/[A-Z]/g,
		(letter, index) => `${index ? '-' : ''}${letter.toLowerCase()}`,
	);
	const scenarios = uiKitScenarios.filter(({ id }) => id === `ui-kit/${scenarioName}`);
	if (!scenarios.length) throw new Error(`No portable scenarios found for ${component}.`);
	return scenarios;
}

export function assertExpectedCallbacks(
	trace: RunTrace,
	expectedCallbacks: (typeof uiKitScenarios)[number]['expectedCallbacks'],
) {
	const callbacks = trace.observations.at(-1)?.callbacks ?? [];
	for (const expected of expectedCallbacks) {
		const observed = callbacks.filter(({ name }) => name === expected.name);
		expect(observed, `${trace.scenario} callback ${expected.name}`).toHaveLength(
			expected.count,
		);
		for (const callback of observed) {
			expect(callback.payload, `${expected.name} callback payload`).toBeTypeOf('object');
			expect(Object.keys(callback.payload as Record<string, unknown>).sort()).toEqual(
				[...expected.fields].sort(),
			);
		}
	}
}

export async function persistTrace(target: DemoTarget, component: string, trace: RunTrace) {
	await commands.writeUiKitTrace(target, component, trace.scenario, serializeRunTrace(trace));
}
