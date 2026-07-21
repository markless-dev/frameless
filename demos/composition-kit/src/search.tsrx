import { element } from "@markless/core";

function SearchField(props) @{
	<input
		data-search-input
		el={props.input}
		attach={(node) => {
			node.dataset.searchAttach = "installed";
			let witness = document.querySelector("body > [data-search-witness]");
			if (witness === null) {
				witness = document.createElement("aside");
				witness.dataset.searchWitness = "";
				witness.innerHTML = "<output data-search-cleanup></output>";
				document.body.append(witness);
			}
			const cleanup = witness.querySelector("[data-search-cleanup]");
			if (cleanup !== null) cleanup.textContent = "installed";
			return () => {
				delete node.dataset.searchAttach;
				if (cleanup !== null) cleanup.textContent = "cleaned";
			};
		}}
	/>
}

export function Search() @{
	const input = element<HTMLInputElement>();
	<section data-search>
		<h2>Search</h2>
		<SearchField input={input} />
		<button data-action="focus-search" onClick={() => input?.focus()}>Focus search</button>
	</section>
}
