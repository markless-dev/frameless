import type { CompilerPassDefinition } from './artifacts.ts';

export const enrichedIrPassDefinition = {
	passId: 'enriched-ir',
	description: 'Join the TSRX AST to Markless semantic records.',
	consumes: ['tsrx-semantic-graph'],
	produces: ['frameless-enriched-ir'],
} as const satisfies CompilerPassDefinition;

export const defaultCompilerPasses: ReadonlyArray<CompilerPassDefinition> = [
	enrichedIrPassDefinition,
];
