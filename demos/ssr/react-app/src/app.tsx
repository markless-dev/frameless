import type { ComponentType } from 'react';
import { uiKitScenarios } from '../../../ui-kit/scenarios.ts';
import { NewsletterForm } from '../../dist/NewsletterForm/react/NewsletterForm.jsx';
import { PricingCard } from '../../dist/PricingCard/react/PricingCard.jsx';
import { TaskList } from '../../dist/TaskList/react/TaskList.jsx';

type EmittedComponent = ComponentType<Record<string, unknown>>;

const components = {
	'ui-kit/pricing-card': PricingCard as unknown as EmittedComponent,
	'ui-kit/task-list': TaskList as unknown as EmittedComponent,
	'ui-kit/newsletter-form': NewsletterForm as unknown as EmittedComponent,
};

const paths = {
	'ui-kit/pricing-card': '/pricing-card',
	'ui-kit/task-list': '/task-list',
	'ui-kit/newsletter-form': '/newsletter-form',
} as const;

export const routes = uiKitScenarios.map((scenario) => {
	const id = scenario.id as keyof typeof components;
	const component = components[id];
	const path = paths[id];
	if (!component || !path) throw new Error(`Unknown React SSR scenario: ${scenario.id}`);
	return { component, initialProps: scenario.initialProps, path, scenario };
});

export function routeForPath(path: string) {
	const normalizedPath = path === '/' ? '/pricing-card' : path.replace(/\/$/, '');
	const route = routes.find((candidate) => candidate.path === normalizedPath);
	if (!route) throw new Error(`Unknown React SSR route: ${path}`);
	return route;
}

export function App({ path }: { path: string }) {
	const route = routeForPath(path);
	const Component = route.component;
	return <Component {...route.initialProps} onTrace={() => {}} />;
}
