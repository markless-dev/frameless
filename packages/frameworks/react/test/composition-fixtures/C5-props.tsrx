import { shared, state } from "@markless/core";

export const usePropsValue = shared(() => {
	let value = state(5);
	return { value };
}, { scope: "container" });

function PropsReader() @{
	const shared = usePropsValue();
	<output data-tier-props>{shared.value}</output>
}

export function PropsPage() @{
	<PropsReader />
}
