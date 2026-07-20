import { computed } from '@markless/core';

export function AliasCoverage({ label: displayLabel, multiplier }) @{
	const prefix = `${displayLabel}:`;
	const derived = computed(() => `${prefix}${multiplier}`);

	<output data-alias-coverage="">{derived}</output>
}
