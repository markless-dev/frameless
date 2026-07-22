/**
 * @frameless.md/core — the Frameless authoring surface.
 *
 * Every value exported here is a compile-time construct: the `.tsrx` compiler
 * rewrites recognized calls before runtime, so these functions never execute
 * in compiled output. They are re-exported from `@markless/core` (the canonical
 * authoring package the compiler recognizes), whose markers throw
 * `FrameworkApiRuntimeError` with a pointed diagnostic when called outside a
 * compiled context — deliberately self-documenting rather than silently inert.
 *
 * The export list mirrors the compiler's recognized authoring constructs and is
 * held closed by `./surface-contract.ts` (compile-time) and the package test
 * suite (runtime), in the same fail-closed spirit as the framework gates.
 */
export {
	state,
	computed,
	element,
	shared,
	FrameworkApiRuntimeError,
	type AsyncComputedValue,
	type ElementHandle,
	type FrameworkApiName,
	type FrameworkApiRuntimeDiagnostic,
	type SharedDefinition,
	type SharedOptions,
	type SharedScope,
} from '@markless/core';
