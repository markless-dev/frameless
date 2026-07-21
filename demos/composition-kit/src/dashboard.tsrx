import { shared, state } from "@markless/core";

export const useDashboard = shared(() => {
	let count = state(0);
	let history = state("seed");
	return {
		count,
		history,
		increment() {
			history = `${history}:${count}`;
			count++;
		},
	};
}, { scope: "container" });

function Incrementer() @{
	const dashboard = useDashboard();
	<button data-action="increment-dashboard" onClick={() => dashboard.increment()}>Increment</button>
}

function Reader() @{
	const dashboard = useDashboard();
	<output data-dashboard-reader>{`${dashboard.history}|${dashboard.count}`}</output>
}

export function Dashboard() @{
	<section data-dashboard>
		<h2>Dashboard</h2>
		<Incrementer />
		<Reader />
	</section>
}
