import { computed, state } from '@markless/core';

export function NestedBoard({ seed, onTrace }) @{
	let groups = state(seed.map((group) => ({ ...group, rows: group.rows.slice() })));
	let selection = state('none');
	let marked = state('none');
	const cells = computed(() => groups.flatMap((group) => group.rows).length);

	<section data-scenario="s4">
		<output data-selection="true">{selection}</output>
		<p data-count="cells">{cells}/{groups.length}</p>
		<button
			data-action="flip"
			onClick={(event) => {
				const flipped = groups.map((group) => ({
					...group,
					rows: group.rows.slice().reverse(),
				}));
				groups = flipped;
				onTrace('flip', { order: flipped.map((group) => group.id) }, event);
			}}
		>flip</button>
		<button
			data-action="reorder"
			onClick={(event) => {
				const order = groups.slice().reverse();
				groups = order;
				onTrace('reorder', { order: order.map((group) => group.id) }, event);
			}}
		>reorder</button>
		<ul data-groups="true">
			@for (const group of groups; key group.id) {
				<li data-oracle-group-key={group.id}>
					<ul data-rows={group.id}>
						@for (const row of group.rows; key row.id) {
							<li data-oracle-cell-key={row.id}>
								<button
									data-select={row.id}
									onClick={(event) => {
										selection = `${group.id}>${row.id}`;
										marked = row.id;
										onTrace('select', { group: group.id, row: row.id }, event);
									}}
								>select</button>
								@if (marked === row.id) {
									<span data-cell-on={row.id}>on</span>
								} @else {
									<span data-cell-off={row.id}>off</span>
								}
								<details data-cell-open={row.id}>
									<summary data-open-cell={row.id}>open</summary>
								</details>
							</li>
						}
					</ul>
				</li>
			}
		</ul>
	</section>
}
