import { element } from "@markless/core";

function FocusField(props) @{
	<input
		data-focus-target
		el={props.input}
		attach={(node) => {
			const localState = node.parentElement?.querySelector("[data-handle-state]");
			let witness = document.querySelector("body > [data-handle-witness]");
			if (witness === null) {
				witness = document.createElement("section");
				witness.dataset.handleWitness = "";
				witness.innerHTML = "<output data-handle-state></output>";
				document.body.append(witness);
			}
			if (localState !== null) localState.textContent = "set";
			const externalState = witness.querySelector("[data-handle-state]");
			if (externalState !== null) externalState.textContent = "set";
			return () => {
				if (localState !== null) localState.textContent = "cleared";
				if (externalState !== null) externalState.textContent = "cleared";
			};
		}}
	/>
}

export function FocusPage() @{
	const input = element<HTMLInputElement>();
	<section data-handle-witness>
		<output data-handle-state />
		<FocusField input={input} />
		<button data-action="focus-composed" onClick={() => input?.focus()}>Focus</button>
	</section>
}
