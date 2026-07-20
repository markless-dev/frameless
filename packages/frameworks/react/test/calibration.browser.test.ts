import { describe, expect, test } from 'vitest';
import {
	calibrationScenarios,
	compareRuns,
	mutantClasses,
	runScenario,
	scenarioById,
} from '@frameless/analyzer';
import { createReactAdapter } from '../src/index.ts';
import { reactReferences } from './reference.tsx';
import { withMutant } from './mutant-adapter.ts';

describe('React handwritten reference calibration', () => {
	for (const scenario of calibrationScenarios) {
		test(`${scenario.id}: reference traces are equal`, async () => {
			const reference = reactReferences[scenario.id.split('/')[0]];
			const first = await runScenario(createReactAdapter(reference), scenario);
			const second = await runScenario(createReactAdapter(reference), scenario);
			expect(compareRuns(first, second)).toEqual({ equal: true, divergences: [] });
		});
	}

	for (const mutant of mutantClasses) {
		test(`${mutant.id} is rejected in ${mutant.channel}`, async () => {
			const scenario = scenarioById[mutant.scenario];
			const adapter = createReactAdapter(reactReferences[mutant.scenario]);
			const clean = await runScenario(adapter, scenario);
			const broken = await runScenario(withMutant(adapter, mutant), scenario);
			const verdict = compareRuns(clean, broken);
			expect(verdict.equal).toBe(false);
			if (!verdict.equal) {
				expect(verdict.divergences.some((item) => item.channel === mutant.channel)).toBe(true);
			}
		});
	}
});
