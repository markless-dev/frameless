import { computed } from '@markless/core';

// P0 - THE OBVIOUS AUTHORING, and the one an app author would reach for first:
// declare an async computed and read it in the template like any other computed.
// It is here so the refusal is on the record with its own scenario rather than
// as a footnote to P1, because THIS is the shape the four queued apps would have
// been written in.
export function P0BareRead({ load }: {
	load: () => Promise<string>;
}) @{
	const greeting = computed(async () => await load());

	<p data-probe="p0">{greeting}</p>
}
