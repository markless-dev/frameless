// Mirrors Scenario from @frameless/analyzer. Importing that workspace package here would require
// a pnpm-lock.yaml change outside this demo's file contract, so the portable data stays structural.
type Action =
	| { type: 'click'; target: string }
	| { type: 'input'; target: string; value: string; selection?: [number, number] }
	| { type: 'check'; target: string; checked: boolean }
	| { type: 'focus'; target: string; selection?: [number, number] };

type Scenario = {
	id: string;
	purpose: string;
	initialProps: Record<string, unknown>;
	actions: Action[];
	expectedCallbacks: { name: string; fields: string[]; count: number }[];
};

export const uiKitScenarios: Scenario[] = [
	{
		id: 'ui-kit/pricing-card',
		purpose: 'derived pricing, visibility branch, mutable seat count, and callback payload',
		initialProps: { planName: 'Studio', basePrice: 12, multiplier: 2, visible: true },
		actions: [{ type: 'click', target: '[data-action="add-seat"]' }],
		expectedCallbacks: [{ name: 'seat-added', fields: ['seats'], count: 1 }],
	},
	{
		id: 'ui-kit/task-list',
		purpose: 'controlled draft, keyed task identity, add, edit, toggle, remove, and clear behavior',
		initialProps: {
			seedTasks: [
				{ id: 'brief', title: 'Approve launch brief', done: false },
				{ id: 'assets', title: 'Export campaign assets', done: false },
			],
		},
		actions: [
			{ type: 'input', target: '[data-action="draft-task"]', value: 'Schedule announcement' },
			{ type: 'click', target: '[data-action="create-task"]' },
			{ type: 'input', target: '[data-task-title="assets"]', value: 'Export final assets' },
			{ type: 'check', target: '[data-task-toggle="assets"]', checked: true },
			{ type: 'click', target: '[data-task-remove="brief"]' },
			{ type: 'click', target: '[data-action="clear-tasks"]' },
		],
		expectedCallbacks: [
			{ name: 'draft-changed', fields: ['title'], count: 1 },
			{ name: 'task-created', fields: ['id', 'title'], count: 1 },
			{ name: 'task-renamed', fields: ['id', 'title'], count: 1 },
			{ name: 'task-toggled', fields: ['id', 'done'], count: 1 },
			{ name: 'task-removed', fields: ['id'], count: 1 },
			{ name: 'tasks-cleared', fields: ['count'], count: 1 },
		],
	},
	{
		id: 'ui-kit/newsletter-form',
		purpose: 'controlled subscriber fields, opt-in state, ordered submit writes, and callback payloads',
		initialProps: { initialName: '', initialEmail: '' },
		actions: [
			{ type: 'input', target: '[data-field="subscriber-name"]', value: 'Avery Chen' },
			{ type: 'input', target: '[data-field="subscriber-email"]', value: 'avery@example.com' },
			{ type: 'check', target: '[data-field="product-updates"]', checked: true },
			{ type: 'click', target: '[data-action="subscribe"]' },
		],
		expectedCallbacks: [
			{ name: 'name-changed', fields: ['value'], count: 1 },
			{ name: 'email-changed', fields: ['value'], count: 1 },
			{ name: 'preference-changed', fields: ['checked'], count: 1 },
			{
				name: 'newsletter-submitted',
				fields: ['name', 'email', 'productUpdates', 'status'],
				count: 1,
			},
		],
	},
];
