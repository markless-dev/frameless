import { describe, expect, test } from 'vitest';
import {
	calibrationScenarios,
	compareRuns,
	mutantClasses,
	runScenario,
	scenarioById,
} from '@frameless/analyzer';
import { createSolidAdapter } from '../src/index.ts';
import { solidReferences } from './reference.solid.tsx';
import { withMutant } from './mutant-adapter.ts';

describe('Solid handwritten reference calibration', () => {
	for (const scenario of calibrationScenarios) {
		test(`${scenario.id}: reference traces are equal`, async () => {
			const reference = solidReferences[scenario.id.split('/')[0]];
			const first = await runScenario(createSolidAdapter(reference), scenario);
			const second = await runScenario(createSolidAdapter(reference), scenario);
			expect(compareRuns(first, second)).toEqual({ equal: true, divergences: [] });
		});
	}

	for (const mutant of mutantClasses) {
		test(`${mutant.id} is rejected in ${mutant.channel}`, async () => {
			const scenario = scenarioById[mutant.scenario];
			const adapter = createSolidAdapter(solidReferences[mutant.scenario]);
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
