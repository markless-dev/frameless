import { state } from '@markless/core';

// C1 mirror: ordinary component-body locals with real computation, read by the
// template. Mitosis 0.13.2 silently drops this shape (poc/01 c1-local fixture).
// Markless documents render-once body semantics: the locals compute exactly
// once at mount and their rendered values must survive later state changes.
export function App() @{
	let count = state(1);
	const greeting = `Hello, ${'markless'.toUpperCase()}!`;
	const initial = `start:${count}`;

	<main>
		<p data-greeting>{greeting}</p>
		<p data-initial>{initial}</p>
		<output data-count>{count}</output>
		<button type="button" data-inc onClick={() => count++}>+1</button>
	</main>
}
