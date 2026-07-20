declare module '@tsrx/core' {
	import type { ParseOptions } from '@tsrx/core/types';
	import type { Program } from '@tsrx/core/types/estree';

	export function parseModule(source: string, filename: string, options?: ParseOptions): Program;
}
