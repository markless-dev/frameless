import { state } from '@markless/core';

// PB - A CONTROL, NOT A DOOR SCENARIO. There is no async here at all: one state
// cell, one synchronous click handler, no props.
//
// It exists because PA's first draft took no props and Solid refused it. Read
// against the door alone that looks like a sixth async refusal. It is not.
// Solid refuses THIS module too, with the identical message:
//
//     ComponentProps has dangling graph record id: prop:props
//
// So the trigger is A COMPONENT WITH NO PROPS, and it is a standing Solid-lane
// defect that has nothing to do with data fetching. It is recorded here rather
// than dropped because it lands on the queued work: a Codex clone is naturally
// many components and prop-less ones are ordinary, and this is a silent
// emit-time refusal, not a runtime one.
//
// The other five lanes emit it.
export function PBZeroPropControl() @{
	let n = state(0);

	<button
		type="button"
		data-probe="pb"
		onClick={(event) => {
			n = n + 1;
		}}
	>{n}</button>
}
