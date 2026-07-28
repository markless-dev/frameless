import { computed, state } from '@markless/core';

export function WhitespaceBoard({ seed, label, onTrace }) @{
	let done = state(1);
	let unit = state('px');
	let note = state(label);
	let joiner = state('|');
	let rows = state(seed.slice());
	const total = computed(() => rows.length);

	<section data-scenario="s6">
		<p data-ratio="true">{done}/{total}</p>
		<p data-glue="true">start{done}{unit}end</p>
		<p data-wrap="true">[{note}]</p>
		<p data-mixed="true">a<b data-emph="true">{unit}</b>z</p>
		<p data-static="true">one two three</p>
		<ul data-lines="true">
			@for (const row of rows; key row.id) {
				<li data-oracle-text-key={row.id}>
					<span data-pair={row.id}>{row.left}{joiner}{row.right}</span>
					<button
						data-widen={row.id}
						onClick={(event) => {
							const next = ` ${row.id} `;
							joiner = next;
							onTrace('widen', { id: row.id, joiner: next }, event);
						}}
					>widen</button>
				</li>
			}
		</ul>
		<button
			data-action="tick"
			onClick={(event) => {
				done++;
				unit = 'em';
				onTrace('tick', { done, unit }, event);
			}}
		>tick</button>
		<button
			data-action="pad"
			onClick={(event) => {
				const padded = ` ${note} `;
				note = padded;
				onTrace('pad', { note: padded }, event);
			}}
		>pad</button>
	</section>
}
