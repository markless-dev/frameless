import { shared, state } from "@markless/core";

export const useCompositionShared = shared(() => {
	let count = state(0);
	let history = state("seed");
	let audit = state("pending");
	return {
		count,
		history,
		audit,
		advance() {
			history = `${history}:${count}`;
			count++;
			audit = `${history}|${count}`;
		},
		append() {
			history = `${history}!`;
		},
	};
}, { scope: "container" });

function Incrementer() @{
	const shared = useCompositionShared();
	<>
		<button data-action="advance-shared" onClick={() => shared.advance()}>Advance</button>
		<button data-action="append-shared" onClick={() => shared.append()}>Append</button>
	</>
}

function Reader() @{
	const shared = useCompositionShared();
	<output data-shared-reader>{`${shared.history}|${shared.count}`}</output>
}

function SharedAudit() @{
	const shared = useCompositionShared();
	<output data-shared-audit>{shared.audit}</output>
}

export function SharedParticipants() @{
	<><Incrementer /><Reader /><SharedAudit /></>
}
