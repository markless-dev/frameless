/**
 * Compile-time completeness gate for the @frameless.md/core export surface.
 *
 * The compiler's importable authoring constructs are derived from its own
 * published contract: `GraphBindingKind` minus `'prop'` (props are authored
 * through parameter destructuring, not an importable call), plus `'shared'`
 * (recognized by the compiler through its `@markless/core` import specifier
 * rather than a graph binding kind).
 *
 * If the compiler grows a new importable construct, `AuthoringConstruct`
 * widens and the `Record` below stops type-checking until this package
 * exports it — `pnpm check` fails closed. The runtime twin of this gate
 * lives in `test/authoring-surface.test.ts`.
 */
import type { GraphBindingKind } from '@frameless/compiler';
import { computed, element, shared, state } from './index.ts';

type ImportableGraphConstruct = Exclude<GraphBindingKind, 'prop'>;
export type AuthoringConstruct = ImportableGraphConstruct | 'shared';

export const authoringConstructExports: Record<AuthoringConstruct, (...args: never[]) => unknown> =
	{
		state,
		computed,
		element,
		shared,
	};
