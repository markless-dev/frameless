import { describe, expect, test } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { compareRuns, reactAdapter, runScenario } from '../../04-equivalence-oracle/src/oracle/index.ts';
import { reactReferences } from '../../04-equivalence-oracle/src/references/index.ts';
import { calibrationScenarios } from '../../04-equivalence-oracle/src/scenarios/index.ts';
import { RenderOnce } from '../generated/S1.jsx';
import { KeyedTodo } from '../generated/S2.jsx';
import { EventForm } from '../generated/S3.jsx';
import { BaselineS2 } from './baselines/S2.jsx';
import { BaselineS3 } from './baselines/S3.jsx';

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

describe('clean size baselines implement their scenarios', () => {
  for (const [id, component] of [['S2-keyed-todo', BaselineS2], ['S3-event-form', BaselineS3]]) test(id, async () => {
    const scenario = calibrationScenarios.find((candidate) => candidate.id === id);
    const reference = await runScenario(reactAdapter(reactReferences[id]), scenario);
    const baseline = await runScenario(reactAdapter(component), scenario);
    expect(compareRuns(reference, baseline)).toEqual({ equal: true, divergences: [] });
  });
});

describe('direct S1 scenario invariants', () => {
  test('setup runs once per mount and derived strings are exact', () => {
    for (let mount = 0; mount < 2; mount += 1) {
      const host = document.createElement('div');
      document.body.append(host);
      const root = createRoot(host);
      const calls = [];
      act(() => root.render(<RenderOnce label="Arcade" multiplier={3} visible onTrace={(...args) => calls.push(args)} />));
      expect(host.querySelector('[data-value="derived"]')?.textContent).toBe('Arcade:3');
      expect(calls.filter(([name]) => name === 'setup')).toHaveLength(1);
      act(() => host.querySelector('[data-action="increment"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      expect(host.querySelector('[data-value="derived"]')?.textContent).toBe('Arcade:6');
      expect(calls.filter(([name]) => name === 'setup')).toHaveLength(1);
      expect(calls.find(([name]) => name === 'change')?.[2]).toBeUndefined();
      act(() => root.unmount());
      host.remove();
    }
  });

  test('React root rerender keeps the initial prefix and reacts to multiplier updates', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const calls = [];
    act(() => root.render(<RenderOnce label="Arcade" multiplier={3} visible onTrace={(...args) => calls.push(args)} />));
    act(() => host.querySelector('[data-action="increment"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => root.render(<RenderOnce label="Changed" multiplier={5} visible onTrace={(...args) => calls.push(args)} />));
    expect(host.querySelector('[data-value="derived"]')?.textContent).toBe('Arcade:10');
    expect(calls.filter(([name]) => name === 'setup')).toHaveLength(1);
    act(() => root.unmount());
    host.remove();
  });
});
