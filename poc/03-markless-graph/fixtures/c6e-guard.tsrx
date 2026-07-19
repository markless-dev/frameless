import { state } from '@markless/core';

// Guard clause before the template root: `if (hidden) return null;`.
// Mitosis bans early returns outright; markless compiles them.
// (No destructuring default here: markless 0.1.1 rejects graph destructuring
// defaults with MARKLESS_STATE_DESTRUCTURE_DEFAULT_UNSUPPORTED — recorded as a
// finding in the README.)
export function Panel({ hidden }: { hidden?: boolean }) @{
	let notes = state(0);
	if (hidden) return null;

	<section data-panel>
		<output data-notes>{notes}</output>
		<button type="button" data-add onClick={() => notes++}>add</button>
	</section>
}
