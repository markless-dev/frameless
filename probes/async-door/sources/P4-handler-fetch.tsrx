import { state } from '@markless/core';

// P4 - THE OTHER DOOR, and the reason this probe does not stop at "refused".
// S8 already proves the corpus can author an ASYNC EVENT HANDLER - `onClick={async
// (event) => { ... await ready; ... }}` - and all six lanes emit it. So the
// question the apps actually need answered is not "can a component fetch on
// render" (P0/P1: no) but "can a component fetch AT ALL" (here).
//
// This is fetch-on-interaction with an observable pending state built out of the
// constructs that DO exist: a `state` cell flipped before the `await` and back
// after it. That is the spinner the board asked about, hand-rolled, without
// `@pending`.
//
// Every conditional is an EXPRESSION and every write is top-level and
// unconditional - DEFECTS.md 8.1, which records that React lowers only top-level
// handler statements, so a write nested in an `if` is printed against the `const`
// that destructures `useState` and is invalid TypeScript.
export function P4HandlerFetch({ load }: {
	load: () => Promise<string>;
}) @{
	let value = state('idle');
	let pending = state(false);

	<section data-probe="p4">
		<p data-async="value">{value}</p>
		<p data-async="pending">{pending}</p>
		<button
			type="button"
			data-action="fetch"
			disabled={pending}
			onClick={async (event) => {
				pending = true;
				const next = await load();
				value = next;
				pending = false;
			}}
		>fetch</button>
	</section>
}
