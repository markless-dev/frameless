import { state } from '@markless/core';

// PC - THE SECOND CONTROL, and again there is no async in it. One synchronous
// handler that calls a GLOBAL - `Date.now()`.
//
// PA is refused by Angular with `cannot resolve the identifier "Promise" in a
// transplanted body`, and that reads like an async refusal. It is not. Angular
// refuses this synchronous module for the same reason, naming `Date`, and the
// same guard was measured firing on `setTimeout`, `fetch`, `JSON` and
// `Promise.resolve`. The rule is that the Angular emitter resolves identifiers
// in a transplanted handler body against body-locals, parameters, `@for`
// variables and declared component members ONLY, and throws on anything else
// rather than guessing it is a global.
//
// THIS IS THE FINDING WITH THE WIDEST BLAST RADIUS ON THIS BOARD, because every
// primitive data fetching is made of is a global: `fetch`, `setTimeout`,
// `Promise`, `Date`, `JSON`. In the Angular lane none of them can appear in a
// handler at all, so async work in that lane has to arrive through a prop or a
// declared member - which is exactly what P8 and P9 do, and exactly why they
// emit there while PA does not.
//
// The other five lanes emit it.
export function PCGlobalIdentifierControl({ label }: {
	label: string;
}) @{
	let stamp = state(0);

	<button
		type="button"
		data-probe="pc"
		onClick={(event) => {
			stamp = Date.now();
		}}
	>{label}{stamp}</button>
}
