import type { Action } from './types.ts';

export type ExpectedCallback = { name: string; fields: string[]; count: number };
export type Scenario = {
	id: string;
	purpose: string;
	initialProps: Record<string, unknown>;
	actions: Action[];
	expectedCallbacks: ExpectedCallback[];
};

export const scenarios: Scenario[] = [
	{
		id: 'S1-render-once-locals',
		purpose: 'destructuring, derived local, closure, guard matrix, state, once-per-mount setup',
		initialProps: { label: 'Frameless', multiplier: 3, visible: true },
		actions: [{ type: 'click', target: '[data-action="increment"]' }],
		expectedCallbacks: [
			{ name: 'setup', fields: ['runs'], count: 1 },
			{ name: 'change', fields: ['count'], count: 1 },
		],
	},
	{
		id: 'S2-keyed-todo',
		purpose: 'add/edit/toggle/reorder/remove/empty/computed/deep alias plus identity and focus',
		initialProps: {
			seed: [
				{ id: 'a', title: 'Alpha', done: false },
				{ id: 'b', title: 'Beta', done: false },
			],
		},
		actions: [
			{ type: 'input', target: '[data-action="new"]', value: 'Gamma' },
			{ type: 'click', target: '[data-action="add"]' },
			{ type: 'focus', target: '[data-edit="b"]', selection: [1, 3] },
			{ type: 'input', target: '[data-edit="b"]', value: 'Beta!' },
			{ type: 'check', target: '[data-toggle="b"]', checked: true },
			{ type: 'click', target: '[data-action="reorder"]' },
			{ type: 'click', target: '[data-remove="a"]' },
			{ type: 'click', target: '[data-action="clear"]' },
		],
		expectedCallbacks: [
			{ name: 'add', fields: ['id', 'title'], count: 1 },
			{ name: 'edit', fields: ['id', 'title'], count: 1 },
			{ name: 'toggle', fields: ['id', 'checked'], count: 1 },
			{ name: 'reorder', fields: ['order'], count: 1 },
			{ name: 'remove', fields: ['id'], count: 1 },
			{ name: 'clear', fields: ['count'], count: 1 },
		],
	},
	{
		id: 'S3-event-form',
		purpose: 'live text/checkbox, callback payload/order, bubbling, cancellation, batched writes',
		initialProps: { initial: 'seed' },
		actions: [
			{ type: 'input', target: '[data-action="text"]', value: 'hello', selection: [2, 4] },
			{ type: 'check', target: '[data-action="checked"]', checked: true },
			{ type: 'click', target: '[data-action="submit"]' },
		],
		expectedCallbacks: [
			{ name: 'text', fields: ['value'], count: 1 },
			{ name: 'checked', fields: ['checked'], count: 1 },
			{ name: 'submit', fields: ['text', 'checked', 'writes'], count: 1 },
			{ name: 'bubble', fields: ['source'], count: 1 },
		],
	},
];

export const scenarioById: Record<string, Scenario> = Object.fromEntries(
	scenarios.map((scenario) => [scenario.id, scenario]),
);

export const calibrationScenarios: Scenario[] = [
	...scenarios,
	{
		...scenarios[0],
		id: 'S1-render-once-locals/guard-hidden',
		initialProps: { ...scenarios[0].initialProps, visible: false },
		actions: [],
		expectedCallbacks: [{ name: 'setup', fields: ['runs'], count: 1 }],
	},
];
