import { computed } from '@markless/core';

// P2 - THE ONE SHAPE THAT REACHES THE EMITTERS. An async computed that is
// DECLARED but never read in the template compiles, and the Frameless IR carries
// it with `async: true, asyncCapable: true`.
//
// It is useless as an app - a fetch whose result cannot be displayed - but it is
// the only way to ask the six emitters the board's actual question, because P0
// and P1 are both stopped by a gate in front of them. Without this scenario the
// per-lane column would be six identical "unreachable"s and the lane-by-lane
// difference would be invisible.
export function P2Unread({ load }: {
	load: () => Promise<string>;
}) @{
	const greeting = computed(async () => await load());

	<p data-probe="p2">static</p>
}
