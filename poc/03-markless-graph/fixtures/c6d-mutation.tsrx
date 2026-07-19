import { state } from '@markless/core';

// Ordinary deep assignment/mutation of state: nested property assignment, an
// update expression on a nested path, and an in-place array method call.
export function App() @{
	const profile = state({ user: { name: 'Ada', hits: 0 } });
	let tags = state(['alpha']);

	<main>
		<p data-name>{profile.user.name}</p>
		<output data-hits>{profile.user.hits}</output>
		<output data-tags>{tags.length}</output>
		<button
			type="button"
			data-mutate
			onClick={() => {
				profile.user.name = 'Grace';
				profile.user.hits++;
				tags.push('beta');
			}}
		>
			mutate
		</button>
	</main>
}
