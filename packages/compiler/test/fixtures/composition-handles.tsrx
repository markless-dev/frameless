import { element } from "@markless/core";

export function RefFocus() @{
	const input = element<HTMLInputElement>();
	<>
		<input el={input} attach={(node) => {
			node.dataset.ready = "yes";
			return () => { delete node.dataset.ready; };
		}} />
		<button onClick={() => input?.focus()}>focus</button>
	</>
}
