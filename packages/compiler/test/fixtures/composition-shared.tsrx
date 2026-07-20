import { shared, state } from "@markless/core";

export const useCounter = shared(() => {
	let count = state(0);
	return {
		count,
		increment() { count++; },
	};
});

export function Counter() @{
	const counter = useCounter();
	<button onClick={() => counter.increment()}>{counter.count}</button>
}
