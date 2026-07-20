import { describe, expect, test } from 'vitest';
import {
	calibrationScenarios,
	compareRuns,
	mutantClasses,
	runScenario,
	scenarioById,
} from '@frameless/analyzer';
import { createSolidAdapter } from '../src/index.ts';
import { makeSolidS2, makeSolidS3, solidReferences } from './reference.solid.tsx';

// Mutants are COMPONENT VARIANTS (the calibrated mechanism): the mutant component's
// own behavior must produce the divergence. External DOM surgery is forbidden — it
// tests the framework's tolerance of vandalism, not the analyzer's sensitivity.
const mutantComponents: Record<string, unknown> = {
	'wrong-text': makeSolidS2('wrong-text'),
	'wrong-live-property': makeSolidS3('wrong-property'),
	'omitted-callback': makeSolidS3('omit-callback'),
	'reordered-callback': makeSolidS3('reorder-callback'),
	'broken-key-identity': makeSolidS2('index-key'),
	'wrong-cancellation': makeSolidS3('missing-prevent-default'),
	'duplicate-handler': makeSolidS2('duplicate-handler'),
	timing: makeSolidS3('timing'),
};

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
			const clean = await runScenario(createSolidAdapter(solidReferences[mutant.scenario]), scenario);
			const broken = await runScenario(createSolidAdapter(mutantComponents[mutant.id] as never), scenario);
			const verdict = compareRuns(clean, broken);
			if (verdict.equal) {
				const writes = (run: typeof clean) =>
					run.observations
						.map((o) => {
							const find = (n: any): string | null => {
								if (n.tag === 'output') return n.children?.[0]?.text ?? '';
								for (const c of n.children ?? []) { const r = find(c); if (r !== null) return r; }
								return null;
							};
							return `${o.phase}=${o.dom.map(find).find((x) => x !== null)}`;
						})
						.join(' ');
				console.error(`[${mutant.id}] equal! clean: ${writes(clean)} | broken: ${writes(broken)}`);
			}
			expect(verdict.equal).toBe(false);
			if (!verdict.equal) {
				expect(verdict.divergences.some((item) => item.channel === mutant.channel)).toBe(true);
			}
		});
	}
});
