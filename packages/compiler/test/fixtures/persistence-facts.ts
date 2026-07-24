import type { MarklessStorageSourceFact, PersistenceAccess } from '../../src/persistence.ts';

export const PERSISTENCE_SOURCE_FACTS = [
	{
		graphNodeId: 'state:theme',
		moduleId: 'src/settings.tsrx',
		bindingName: 'theme',
		key: {
			origin: 'derived',
			sourceIdentifier: 'theme',
			literal: 'markless:theme',
			bakedAtCompileTime: true,
		},
		authoredInitial: 'light',
		writable: true,
	},
	{
		graphNodeId: 'state:locale',
		moduleId: 'src/settings.tsrx',
		bindingName: 'locale',
		key: {
			origin: 'explicit',
			literal: 'preferences:locale',
			bakedAtCompileTime: true,
		},
		authoredInitial: 'en',
		writable: true,
	},
] as const satisfies readonly MarklessStorageSourceFact[];

const ACCESS_BY_GRAPH_NODE_ID: Readonly<Record<string, PersistenceAccess>> = {
	'state:theme': { render: true, handler: false },
	'state:locale': { render: false, handler: true },
};

export const PERSISTENCE_FRAMINGS = [
	{ temperature: 'cold', accessByGraphNodeId: ACCESS_BY_GRAPH_NODE_ID },
	{ temperature: 'warm', accessByGraphNodeId: ACCESS_BY_GRAPH_NODE_ID },
] as const;
