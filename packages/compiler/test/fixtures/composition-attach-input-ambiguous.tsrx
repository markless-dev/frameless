import { state } from "@markless/core";

export function AmbiguousAttach() @{
	let mode = state("outer");
	{
		let mode = state("inner");
	}
	<input attach={(node) => {
		node.dataset.mode = mode;
		return () => { delete node.dataset.mode; };
	}} />
}
