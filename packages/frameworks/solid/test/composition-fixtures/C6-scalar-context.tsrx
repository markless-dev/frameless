import { shared, state } from "@markless/core";

export const useScalarFanout = shared(() => {
	let value = state(6);
	return { value };
}, { scope: "container" });

function ScalarLeft() @{
	const shared = useScalarFanout();
	<output data-tier-scalar="left">{shared.value}</output>
}

function ScalarRight() @{
	const shared = useScalarFanout();
	<output data-tier-scalar="right">{shared.value}</output>
}

function ScalarLeftBranch() @{
	<ScalarLeft />
}

function ScalarRightBranch() @{
	<ScalarRight />
}

export function ScalarPage() @{
	<><ScalarLeftBranch /><ScalarRightBranch /></>
}
