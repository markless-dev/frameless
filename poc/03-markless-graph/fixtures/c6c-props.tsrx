import { state } from '@markless/core';
import { Badge } from './c6c-badge.tsrx';

// Parent for the props-destructuring proof: passes a live state value into a
// child that destructures its props (with a default for the omitted one).
export function App() @{
	let title = state('First');

	<main>
		<Badge label={title} tone="info" />
		<button type="button" data-next onClick={() => title = 'Second'}>next</button>
	</main>
}
