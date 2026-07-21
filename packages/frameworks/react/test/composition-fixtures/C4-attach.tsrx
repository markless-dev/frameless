import { state } from "@markless/core";

export function CleanupPage() @{
	let behaviorInput = state("one");
	<section
		data-composition-witness
		attach={(node) => {
				let witness = document.querySelector("body > [data-composition-witness]");
				if (witness === null) {
					witness = document.createElement("section");
					witness.dataset.compositionWitness = "";
					witness.innerHTML = "<output data-composition-cleanup></output><output data-behavior-log></output>";
					document.body.append(witness);
				}
				const localState = node.querySelector("[data-composition-cleanup]");
				const externalState = witness.querySelector("[data-composition-cleanup]");
				const localLog = node.querySelector("[data-behavior-log]");
				const externalLog = witness.querySelector("[data-behavior-log]");
				const append = (entries) => {
					const prior = externalLog?.textContent ?? "";
					const next = prior === "" ? entries.join("|") : `${prior}|${entries.join("|")}`;
					if (localLog !== null) localLog.textContent = next;
					if (externalLog !== null) externalLog.textContent = next;
				};
				if (localState !== null) localState.textContent = "attached";
				if (externalState !== null) externalState.textContent = "attached";
				append([`install:A:${behaviorInput}`, `install:B:${behaviorInput}`]);
				return () => {
					append([`cleanup:B:${behaviorInput}`, `cleanup:A:${behaviorInput}`]);
					if (localState !== null) localState.textContent = "cleaned";
					if (externalState !== null) externalState.textContent = "cleaned";
				};
			}}
	>
		<output data-composition-cleanup />
		<output data-behavior-log />
		<button data-action="change-behavior-input" onClick={() => behaviorInput = "two"}>Change behavior input</button>
	</section>
}
