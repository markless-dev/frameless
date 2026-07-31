import { computed, state } from '@markless/core';

export function PersistedFilter({ onTrace }) @{
	let filter = state('all', { storage: 'markless:filter' });
	let draft = state('', { storage: 'markless:draft' });
	let touches = state('0', { storage: 'markless:touches' });
	const label = computed(() => `${filter}:${draft}`);

	<section data-scenario="p1">
		<p data-filter="value">{filter}</p>
		<p data-label="value">{label}</p>
		<input
			data-action="draft"
			value={draft}
			onInput={(event) => draft = event.currentTarget.value}
		/>
		<button
			data-action="cycle"
			onClick={(event) => {
				filter = filter === 'all' ? 'done' : 'all';
				touches = `${Number(touches) + 1}`;
				onTrace('cycle', { filter }, event);
			}}
		>cycle</button>
	</section>
}
