import { computed, state } from '@markless/core';

export function RenderOnce({ label: displayLabel, multiplier, visible, onTrace }) @{
	const setup = onTrace('setup', { runs: 1 });
	let count = state(1);
	const prefix = `${displayLabel}:`;
	const derived = computed(() => `${prefix}${count * multiplier}`);

	if (!visible) return <p data-branch="hidden">hidden</p>;

	<section data-scenario="s1">
		<output data-value="derived">{derived}</output>
		<button
			data-action="increment"
			onClick={() => {
				count++;
				onTrace('change', { count });
			}}
		>
			increment
		</button>
	</section>
}
