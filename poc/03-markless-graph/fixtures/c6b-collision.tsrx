import { state } from '@markless/core';

// C2 mirror: handler locals named after the state properties they read
// (`const open = menu.open`). This is the legal .tsrx spelling of the shape
// whose Mitosis rewrite emits the `const foo = foo` TDZ self-reference
// (poc/01 c2-collision fixture).
export function App() @{
	const menu = state({ open: false, title: 'menu' });

	<main>
		<output data-open>{menu.open ? 'open' : 'closed'}</output>
		<p data-title>{menu.title}</p>
		<button
			type="button"
			data-toggle
			onClick={() => {
				const open = menu.open;
				const title = menu.title;
				menu.open = !open;
				menu.title = title.toUpperCase();
			}}
		>
			toggle
		</button>
	</main>
}
