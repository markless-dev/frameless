import { computed, shared, state } from "@markless/core";

export const useCounter = shared(() => {
	let count = state(0);
	let status = state("ready");
	const total = computed(() => count * 2);
	return {
		count,
		status,
		total,
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
