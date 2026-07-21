import type { Scenario } from '@frameless/analyzer';

export const compositionKitScenarios: Scenario[] = [
	{
		id: 'composition-kit/slot-rendering',
		purpose: 'cross-file Frame composition projects the authored page subtree exactly once',
		initialProps: {},
		actions: [],
		expectedCallbacks: [],
		expectations: [
			{ kind: 'dom-present', phase: 'mount', selector: '[data-projected-copy]', count: 1 },
			{
				kind: 'dom-path',
				phase: 'mount',
				selector: '[data-projected-copy]',
				parentTags: ['main', 'section', 'div'],
			},
			{
				kind: 'dom-text',
				phase: 'mount',
				selector: '[data-projected-copy]',
				text: 'Projected across the Frame module boundary',
			},
		],
	},
	{
		id: 'composition-kit/shared-dashboard',
		purpose: 'container-scoped multi-cell method propagation across sibling components',
		initialProps: {},
		actions: [{ type: 'click', target: '[data-action="increment-dashboard"]' }],
		expectedCallbacks: [],
		expectations: [
			{
				kind: 'dom-text',
				phase: 'mount',
				selector: '[data-dashboard-reader]',
				text: 'seed|0',
			},
			{
				kind: 'dom-text',
				phase: 'action:0:after',
				selector: '[data-dashboard-reader]',
				text: 'seed:0|1',
			},
		],
	},
	{
		id: 'composition-kit/status-tier',
		purpose: 'single-scalar shared state exercises the light target-specific lowering tier',
		initialProps: {},
		actions: [],
		expectedCallbacks: [],
		expectations: [
			{ kind: 'dom-text', phase: 'mount', selector: '[data-status-value]', text: 'ready' },
		],
	},
	{
		id: 'composition-kit/search-focus-cleanup',
		purpose: 'direct element handle focus plus literal attach installation and unmount cleanup',
		initialProps: {},
		actions: [{ type: 'click', target: '[data-action="focus-search"]' }],
		expectedCallbacks: [],
		expectations: [
			{ kind: 'focus', phase: 'action:0:after', selector: '[data-search-input]' },
			{
				kind: 'dom-text',
				phase: 'unmount',
				selector: '[data-search-cleanup]',
				text: 'cleaned',
			},
		],
	},
];
