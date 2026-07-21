import { shared, state } from "@markless/core";

export const usePageLedger = shared(() => {
	let count = state(0);
	return {
		count,
		increment() {
			count++;
		},
	};
}, { scope: "page" });

export function PageLedger() @{
	const ledger = usePageLedger();
	<>
		<button data-action="increment-page-tier" onClick={() => ledger.increment()}>Increment</button>
		<output data-tier-page>{ledger.count}</output>
	</>
}
