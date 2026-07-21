import type { Action, Expectation } from './types.ts';

export type ExpectedCallback = { name: string; fields: string[]; count: number };
export type Scenario = {
	id: string;
	purpose: string;
	initialProps: Record<string, unknown>;
	actions: Action[];
	expectedCallbacks: ExpectedCallback[];
	expectations?: Expectation[];
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

/** Framework-neutral composition calibration shared by both browser targets. */
export const compositionScenarios: Scenario[] = [
	{
		id: 'C1-slot-rendering',
		purpose: 'one opaque default-slot projection through a composite Page and Frame root',
		initialProps: {},
		actions: [],
		expectedCallbacks: [],
		expectations: [
			{
				kind: 'dom-present',
				phase: 'mount',
				selector: '[data-projected-node]',
				count: 1,
			},
			{
				kind: 'dom-text',
				phase: 'mount',
				selector: '[data-projected-node]',
				text: 'Projected composition',
			},
		],
	},
	{
		id: 'C2-shared-propagation',
		purpose:
			'two-cell shared method propagation, notification atomicity, stale-cell rejection, and authored method order',
		initialProps: {},
		actions: [
			{ type: 'click', target: '[data-action="advance-shared"]' },
			{ type: 'click', target: '[data-action="append-shared"]' },
		],
		expectedCallbacks: [],
		expectations: [
			{
				kind: 'dom-text',
				phase: 'mount',
				selector: '[data-shared-reader]',
				text: 'seed|0',
			},
			{
				kind: 'dom-text',
				phase: 'action:0:after',
				selector: '[data-shared-reader]',
				text: 'seed:0|1',
			},
			{
				kind: 'dom-text',
				phase: 'action:0:after',
				selector: '[data-shared-audit]',
				text: 'seed:0|1',
			},
			{
				kind: 'dom-text',
				phase: 'action:1:after',
				selector: '[data-shared-reader]',
				text: 'seed:0!|1',
			},
		],
	},
	{
		id: 'C3-ref-driven-focus',
		purpose: 'an imperative handle forwarded to a child host and null-guarded focus dispatch',
		initialProps: {},
		actions: [{ type: 'click', target: '[data-action="focus-composed"]' }],
		expectedCallbacks: [],
		expectations: [
			{
				kind: 'dom-present',
				phase: 'mount',
				selector: '[data-focus-target]',
				count: 1,
			},
			{
				kind: 'focus',
				phase: 'action:0:after',
				selector: '[data-focus-target]',
			},
		],
	},
	{
		id: 'C4-attach-cleanup',
		purpose: 'host-owned attach cleanup observed outside the component host after unmount',
		initialProps: {},
		actions: [],
		expectedCallbacks: [],
		expectations: [
			{
				kind: 'dom-text',
				phase: 'unmount',
				selector: '[data-composition-cleanup]',
				text: 'cleaned',
			},
		],
	},
];
