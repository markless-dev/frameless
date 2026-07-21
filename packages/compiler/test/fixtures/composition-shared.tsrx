import { shared, state } from "@markless/core";

export const useCounter = shared(() => {
	let count = state(0);
	let status = state("ready");
	return {
		count,
		status,
		increment() {
			count++;
			status = "updated";
		},
	};
});

export function Counter() @{
	const counter = useCounter();
	<button onClick={() => counter.increment()}>{counter.count}</button>
}
