import { evaluateExpectations, serializeRunTrace, type RunTrace } from '@frameless/analyzer';
import { commands } from 'vitest/browser';
import { expect } from 'vitest';
import { compositionKitScenarios } from '../scenarios.ts';

export function assertExpectations(trace: RunTrace) {
	const scenario = compositionKitScenarios.find(({ id }) => id === trace.scenario);
	if (!scenario) throw new Error(`Unknown composition-kit scenario ${trace.scenario}.`);
	const results = evaluateExpectations(trace, scenario.expectations ?? []);
	expect(results, `${trace.scenario} expectations`).toEqual(
		(scenario.expectations ?? []).map((expectation) => ({
			expectation,
			phase: expectation.phase,
			outcome: 'pass',
		})),
	);
}

export async function persistTrace(target: 'react' | 'solid', trace: RunTrace) {
	await commands.writeCompositionKitTrace(target, trace.scenario, serializeRunTrace(trace));
}
