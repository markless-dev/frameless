import { shared, state } from "@markless/core";

export const useFullPair = shared(() => {
	let left = state(7);
	let right = state("seven");
	return { left, right };
}, { scope: "container" });

function FullPairFirst() @{
	const pair = useFullPair();
	<output data-tier-object="first">{`${pair.left}|${pair.right}`}</output>
}

function FullPairSecond() @{
	const pair = useFullPair();
	<output data-tier-object="second">{`${pair.left}|${pair.right}`}</output>
}

export function ObjectPage() @{
	<><FullPairFirst /><FullPairSecond /></>
}
