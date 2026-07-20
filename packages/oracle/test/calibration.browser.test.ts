import { describe, expect, test } from 'vitest';
import {
	calibrationScenarios,
	compareRuns,
	mutantClasses,
	runScenario,
	scenarioById,
} from '../src/index.ts';
import { reactFixtureAdapter, solidFixtureAdapter } from './fixtures/adapters.ts';
import {
	makeReactS2,
	makeReactS3,
	reactReferences,
} from './fixtures/react.tsx';
import { solidReferences } from './fixtures/solid.solid.tsx';

const mutantComponents = {
	'wrong-text': makeReactS2('wrong-text'),
	'wrong-live-property': makeReactS3('wrong-property'),
	'omitted-callback': makeReactS3('omit-callback'),
	'reordered-callback': makeReactS3('reorder-callback'),
	'broken-key-identity': makeReactS2('index-key'),
	'wrong-cancellation': makeReactS3('missing-prevent-default'),
	'duplicate-handler': makeReactS2('duplicate-handler'),
	timing: makeReactS3('timing'),
} as const;

describe('React 19 / Solid fallback handwritten calibration fixtures', () => {
	for (const scenario of calibrationScenarios) {
		test(`${scenario.id}: references are equivalent`, async () => {
			const referenceId = scenario.id.split('/')[0];
			const react = await runScenario(
				reactFixtureAdapter(reactReferences[referenceId]),
				scenario,
			);
			const solid = await runScenario(
				solidFixtureAdapter(solidReferences[referenceId]),
				scenario,
			);
			expect(compareRuns(react, solid)).toEqual({ equal: true, divergences: [] });
			expect(react.observations.map((item) => item.phase)).toEqual(
				solid.observations.map((item) => item.phase),
			);
			const records = react.observations.at(-1)!.callbacks;
			for (const shape of scenario.expectedCallbacks) {
				const matching = records.filter((item) => item.name === shape.name);
				expect(matching, shape.name).toHaveLength(shape.count);
				expect(Object.keys(matching[0].payload as object).sort()).toEqual(
					[...shape.fields].sort(),
				);
			}
			if (referenceId === 'S2-keyed-todo') {
				for (const trace of [react, solid]) {
					expect(trace.observations.flatMap((item) => item.identityViolations)).toEqual([]);
					expect(trace.observations.flatMap((item) => item.focusViolations)).toEqual([]);
				}
			}
		});
	}
});

describe('React 19 async-act mutant recalibration', () => {
	for (const mutant of mutantClasses) {
		test(`${mutant.id} -> ${mutant.channel}`, async () => {
			const scenario = scenarioById[mutant.scenario];
			const clean = await runScenario(
				reactFixtureAdapter(reactReferences[mutant.scenario]),
				scenario,
			);
			const broken = await runScenario(
				reactFixtureAdapter(mutantComponents[mutant.id]),
				scenario,
			);
			const verdict = compareRuns(clean, broken);
			expect(verdict.equal).toBe(false);
			if (!verdict.equal) {
				expect(
					verdict.divergences.some((divergence) => divergence.channel === mutant.channel),
					JSON.stringify(verdict.divergences, null, 2),
				).toBe(true);
			}
		});
	}
});
