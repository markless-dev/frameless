import { describe, expect, test } from 'vitest';
import { compareRuns, reactAdapter, runScenario } from '../../04-equivalence-oracle/src/oracle/index.ts';
import { reactReferences } from '../../04-equivalence-oracle/src/references/index.ts';
import { calibrationScenarios } from '../../04-equivalence-oracle/src/scenarios/index.ts';
import { RenderOnce } from '../generated/S1.jsx';
import { KeyedTodo } from '../generated/S2.jsx';
import { EventForm } from '../generated/S3.jsx';

const emitted = {
  'S1-render-once-locals': RenderOnce,
  'S2-keyed-todo': KeyedTodo,
  'S3-event-form': EventForm,
};

describe('oracle viability against handwritten React references', () => {
  for (const scenario of calibrationScenarios) test(scenario.id, async () => {
    const id = scenario.id.split('/')[0];
    const reference = await runScenario(reactAdapter(reactReferences[id]), scenario);
    const generated = await runScenario(reactAdapter(emitted[id]), scenario);
    const verdict = compareRuns(reference, generated);
    if (!verdict.equal) console.error(`[${scenario.id}] divergences:`, JSON.stringify(verdict.divergences, null, 2));
    expect(verdict).toEqual({ equal: true, divergences: [] });
  });
});
