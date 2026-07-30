import { computed } from '@markless/core';

// P1 - THE DOOR ITSELF. The minimal `computed(async ...)`: one async derivation,
// read once in the template. Nothing else. If this refuses, nothing after it
// matters.
//
// THE FIRST MEASUREMENT THIS PROBE MADE, and it corrects the board. Reading the
// async computed bare - `<p>{greeting}</p>` with no wrapper - does not compile.
// The Markless semantic compiler refuses it, VERBATIM:
//
//     MARKLESS_ASYNC_BOUNDARY_REQUIRED: Cannot read async computed "greeting"
//     outside @try/@pending/@catch. Wrap the read in an async boundary.
//
// So the authoring surface is NOT "state, computed, element, shared with zero
// lifecycle hooks". There is a fourth template control-flow construct alongside
// `@if` and `@for` - `@try`/`@pending`/`@catch` - which is the async boundary,
// and it is the answer to "is a pending state observable at all": `@pending` IS
// the spinner arm, declared in the template rather than derived from a nullable
// value.
//
// `load` arrives as a prop rather than a module import so the probe measures the
// async construct and not module resolution; its type is `() => Promise<string>`,
// a bare `TSFunctionType`, which is inside IR-8's accepted type set (s10
// constraint 1 records that a `TSArrayType` prop is refused by three lanes).
export function P1Basic({ load }: {
	load: () => Promise<string>;
}) @{
	const greeting = computed(async () => await load());

	<section data-probe="p1">
		@try {
			<p data-async="resolved">{greeting}</p>
		} @pending {
			<p data-async="pending">loading</p>
		} @catch (error) {
			<p data-async="failed">failed</p>
		}
	</section>
}
