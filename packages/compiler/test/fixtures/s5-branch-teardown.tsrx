import { computed, state } from '@markless/core';

export function BranchBoard({ seed, onTrace }) @{
	let phase = state('live');
	let entries = state(seed.slice());
	let ticks = state(0);
	let seen = state('none');
	const size = computed(() => entries.length);

	<section data-scenario="s5">
		<p data-count="size">{size}</p>
		<button
			data-action="toggle"
			onClick={(event) => {
				const next = phase === 'live' ? 'idle' : 'live';
				phase = next;
				onTrace('toggle', { phase: next }, event);
			}}
		>toggle</button>
		@if (phase === 'live') {
			<div data-arm="live">
				<output data-live-ticks="true">{ticks}</output>
				<p data-live-seen="true">{seen}</p>
				<button
					data-action="tick"
					onClick={(event) => {
						ticks++;
						onTrace('tick', { ticks }, event);
					}}
				>tick</button>
				<ul data-branch-rows="true">
					@for (const entry of entries; key entry.id) {
						<li data-oracle-branch-key={entry.id}>
							<button
								data-pick={entry.id}
								onClick={(event) => {
									seen = entry.id;
									onTrace('pick', { id: entry.id }, event);
								}}
							>pick</button>
						</li>
					}
				</ul>
			</div>
		} @else {
			<div data-arm="idle">
				<output data-idle-ticks="true">{ticks}</output>
				<p data-idle-seen="true">{seen}</p>
				<button
					data-action="drop"
					onClick={(event) => {
						const remaining = entries.slice(1);
						entries = remaining;
						onTrace('drop', { size: remaining.length }, event);
					}}
				>drop</button>
			</div>
		}
	</section>
}
