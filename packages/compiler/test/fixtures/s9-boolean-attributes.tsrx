import { computed, state } from '@markless/core';

export function AttrBoard({ seed, onTrace }) @{
	let locked = state(false);
	let steps = state(0);
	let rows = state(seed.map((row) => ({ ...row })));
	const stage = computed(() => (locked ? 'locked' : 'open'));
	const sealed = computed(
		() =>
			rows
				.filter((row) => row.off)
				.map((row) => row.id)
				.join('+') || 'none',
	);

	<section data-scenario="s9">
		<button type="button" data-gate="true" disabled={locked} data-stage={stage}>gate</button>
		<input type="text" data-note="true" required={locked} />
		<p data-sealed="true">{sealed}</p>
		<p data-steps="true">{steps}</p>
		<ul data-fields="true">
			@for (const row of rows; key row.id) {
				<li data-oracle-attr-key={row.id}>
					<button type="button" data-field={row.id} disabled={row.off}>field</button>
					<button
						type="button"
						data-seal={row.id}
						onClick={(event) => {
							const next = rows.map((entry) =>
								entry.id === row.id ? { id: entry.id, off: !entry.off } : entry,
							);
							rows = next;
							onTrace('seal', { id: row.id }, event);
						}}
					>seal</button>
				</li>
			}
		</ul>
		<button
			type="button"
			data-action="lock"
			onClick={(event) => {
				locked = true;
				steps = steps + 1;
				onTrace('lock', { locked: true }, event);
			}}
		>lock</button>
		<button
			type="button"
			data-action="unlock"
			onClick={(event) => {
				locked = false;
				steps = steps + 1;
				onTrace('unlock', { locked: false }, event);
			}}
		>unlock</button>
	</section>
}
