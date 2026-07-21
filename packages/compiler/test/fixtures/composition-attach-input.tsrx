import { state } from "@markless/core";

export function StatefulAttach() @{
	let status = state("ready");
	<input attach={(node) => {
		node.dataset.status = status;
		return () => { delete node.dataset.status; };
	}} />
}
