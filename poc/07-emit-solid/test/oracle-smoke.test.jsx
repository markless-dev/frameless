import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { describe, expect, test } from 'vitest';
import { compareRuns, runScenario, solidAdapter } from '../../04-equivalence-oracle/src/oracle/index.ts';
import { solidReferences } from '../../04-equivalence-oracle/src/references/index.ts';
import { calibrationScenarios } from '../../04-equivalence-oracle/src/scenarios/index.ts';
import { RenderOnce } from '../generated/S1.jsx';
import { KeyedTodo } from '../generated/S2.jsx';
import { EventForm } from '../generated/S3.jsx';

const emitted = { 'S1-render-once-locals': RenderOnce, 'S2-keyed-todo': KeyedTodo, 'S3-event-form': EventForm };
describe('oracle smoke on solid-1.8.22-fallback', () => {
  for (const scenario of calibrationScenarios) test(scenario.id, async () => {
    const id = scenario.id.split('/')[0];
    const reference = await runScenario(solidAdapter(solidReferences[id]), scenario);
    const generated = await runScenario(solidAdapter(emitted[id]), scenario);
    const verdict = compareRuns(reference, generated);
    if (!verdict.equal) console.error(`[${scenario.id}] divergences:`, JSON.stringify(verdict.divergences, null, 2));
    expect(verdict).toEqual({ equal: true, divergences: [] });
  });
  test('setup is once per instance, change has no event, and only multiplier remains reactive', () => {
    const host = document.createElement('div'); document.body.append(host); const calls = [];
    let setLabel; let setMultiplier;
    function Harness() {
      const [label, updateLabel] = createSignal('Frameless'); const [multiplier, updateMultiplier] = createSignal(3);
      setLabel = updateLabel; setMultiplier = updateMultiplier;
      return <RenderOnce label={label()} multiplier={multiplier()} visible onTrace={(...args) => calls.push(args)} />;
    }
    const dispose = render(() => <Harness />, host);
    expect(host.querySelector('[data-value="derived"]')?.textContent).toBe('Frameless:3');
    host.querySelector('[data-action="increment"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    setLabel('Changed'); setMultiplier(5);
    expect(host.querySelector('[data-value="derived"]')?.textContent).toBe('Frameless:10');
    expect(calls.filter(([name]) => name === 'setup')).toHaveLength(1);
    expect(calls.find(([name]) => name === 'change')?.[2]).toBeUndefined();
    dispose();
  });
});
