import { computed, state } from '@markless/core';

// P3 - CAN THE RESOLVED VALUE BE READ AT ALL? Board question (a), asked at the
// only site left after P0 and P1 are refused: not in the template, but inside an
// event handler, copying the async computed into a plain state cell that the
// template CAN read.
//
// If this emits, "fetch on click, then display" has a route even though "fetch
// on render, then display" does not. If it refuses, the async computed is
// unreadable from anywhere an app can reach.
export function P3HandlerRead({ load }: {
	load: () => Promise<string>;
}) @{
	const greeting = computed(async () => await load());
	let shown = state('idle');

	<button
		type="button"
		data-probe="p3"
		onClick={() => {
			shown = greeting;
		}}
	>{shown}</button>
}
