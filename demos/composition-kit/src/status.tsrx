import { shared, state } from "@markless/core";

export const useStatusValue = shared(() => {
	let value = state("ready");
	return { value };
}, { scope: "container" });

function StatusReader() @{
	const status = useStatusValue();
	<output data-status-value>{status.value}</output>
}

export function Status() @{
	<section data-status>
		<h2>Status</h2>
		<StatusReader />
	</section>
}
