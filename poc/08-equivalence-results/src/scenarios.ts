import type { Action } from './oracle/types.ts';

export type Scenario = { id: string; purpose: string; initialProps: Record<string, unknown>; actions: Action[] };
export const scenarios: Scenario[] = [
  { id: 'S1-render-once-locals', purpose: 'render-once locals, state, derived output and callback', initialProps: { label: 'Frameless', multiplier: 3, visible: true }, actions: [{ type: 'click', target: '[data-action="increment"]' }] },
  { id: 'S2-keyed-todo', purpose: 'add/edit/toggle/reorder/remove/clear with identity and focus', initialProps: { seed: [{ id: 'a', title: 'Alpha', done: false }, { id: 'b', title: 'Beta', done: false }] }, actions: [
    { type: 'input', target: '[data-action="new"]', value: 'Gamma' }, { type: 'click', target: '[data-action="add"]' },
    { type: 'focus', target: '[data-edit="b"]', selection: [1, 3] }, { type: 'input', target: '[data-edit="b"]', value: 'Beta!' },
    { type: 'check', target: '[data-toggle="b"]', checked: true }, { type: 'click', target: '[data-action="reorder"]' },
    { type: 'click', target: '[data-remove="a"]' }, { type: 'click', target: '[data-action="clear"]' },
  ] },
  { id: 'S3-event-form', purpose: 'live properties, callbacks, bubbling, cancellation and batched writes', initialProps: { initial: 'seed' }, actions: [
    { type: 'input', target: '[data-action="text"]', value: 'hello', selection: [2, 4] },
    { type: 'check', target: '[data-action="checked"]', checked: true }, { type: 'click', target: '[data-action="submit"]' },
  ] },
];
export const scenarioById = Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario]));
