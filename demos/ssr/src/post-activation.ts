import type { ExpectApi, PageHandle } from '@async/witness';
import type { uiKitScenarios } from '../../ui-kit/scenarios.ts';

type ScenarioAction = (typeof uiKitScenarios)[number]['actions'][number];

type PerformedAction = Extract<ScenarioAction, { type: 'click' | 'check' }>;
type SkippedAction = Extract<ScenarioAction, { type: 'input' | 'focus' }>;

export type PostActivationScenarioResult = {
	scenario: string;
	actionsPerformed: PerformedAction[];
	actionsSkippedInexpressible: SkippedAction[];
	postActivationPass: true;
};

async function assertAfterAction(
	expect: ExpectApi,
	page: PageHandle,
	scenario: string,
	action: PerformedAction,
): Promise<void> {
	if (scenario === 'ui-kit/pricing-card' && action.target === '[data-action="add-seat"]') {
		await expect.page.text(page, '[data-seat-count]', '2');
		await expect.page.text(page, '[data-price-total]', '$48');
		return;
	}

	if (scenario === 'ui-kit/task-list') {
		if (action.target === '[data-action="create-task"]') {
			await expect.page.exists(page, '[data-oracle-row-key="task-3"]');
			await expect.page.text(page, '[data-open-count]', '3 open');
			return;
		}
		if (action.target === '[data-task-toggle="assets"]') {
			await expect.page.exists(page, '[data-task-toggle="assets"]:checked');
			await expect.page.text(page, '[data-open-count]', '2 open');
			return;
		}
		if (action.target === '[data-task-remove="brief"]') {
			await expect.page.exists(
				page,
				'[data-component="task-list"] ul > li:first-child:nth-last-child(2)[data-oracle-row-key="assets"]',
			);
			await expect.page.exists(
				page,
				'[data-component="task-list"] ul > li:last-child:nth-child(2)[data-oracle-row-key="task-3"]',
			);
			await expect.page.text(page, '[data-open-count]', '1 open');
			return;
		}
		if (action.target === '[data-action="clear-tasks"]') {
			await expect.page.exists(page, '[data-component="task-list"] ul:empty');
			await expect.page.text(page, '[data-task-state="empty"]', 'No tasks remain.');
			await expect.page.text(page, '[data-open-count]', '0 open');
			return;
		}
	}

	if (scenario === 'ui-kit/newsletter-form') {
		if (action.target === '[data-field="product-updates"]') {
			await expect.page.exists(page, '[data-field="product-updates"]:checked');
			return;
		}
		if (action.target === '[data-action="subscribe"]') {
			await expect.page.text(page, '[data-submit-status]', 'subscribed');
			return;
		}
	}

	throw new Error(`No post-activation assertion is defined for ${scenario} ${action.type} ${action.target}.`);
}

export async function runPostActivationScenario(options: {
	expect: ExpectApi;
	page: PageHandle;
	scenario: string;
	actions: ScenarioAction[];
}): Promise<Omit<PostActivationScenarioResult, 'scenario' | 'postActivationPass'>> {
	const actionsPerformed: PerformedAction[] = [];
	const actionsSkippedInexpressible: SkippedAction[] = [];

	for (const action of options.actions) {
		if (action.type === 'input' || action.type === 'focus') {
			actionsSkippedInexpressible.push(action);
			continue;
		}

		await options.page.click(action.target);
		actionsPerformed.push(action);
		await assertAfterAction(options.expect, options.page, options.scenario, action);
	}

	return { actionsPerformed, actionsSkippedInexpressible };
}
