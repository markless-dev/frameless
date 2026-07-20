import type { Divergence } from './types.ts';

export const mutantClasses = [
	{ id: 'wrong-text', scenario: 'S2-keyed-todo', channel: 'dom' },
	{ id: 'wrong-live-property', scenario: 'S3-event-form', channel: 'dom' },
	{ id: 'omitted-callback', scenario: 'S3-event-form', channel: 'callback' },
	{ id: 'reordered-callback', scenario: 'S3-event-form', channel: 'callback' },
	{ id: 'broken-key-identity', scenario: 'S2-keyed-todo', channel: 'identity' },
	{ id: 'wrong-cancellation', scenario: 'S3-event-form', channel: 'callback' },
	{ id: 'duplicate-handler', scenario: 'S2-keyed-todo', channel: 'callback' },
	{ id: 'timing', scenario: 'S3-event-form', channel: 'dom' },
] as const satisfies readonly {
	id: string;
	scenario: string;
	channel: Divergence['channel'];
}[];

export type MutantClass = (typeof mutantClasses)[number];
export const mutants = mutantClasses;
