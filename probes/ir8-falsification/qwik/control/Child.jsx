// CONTROL ARM. TODAY's emitted shape: no types at all.
// Compare packages/frameworks/qwik/generated/S1.jsx.
import { component$, useComputed$, useSignal } from '@qwik.dev/core';

export const RenderOnce = component$((props) => {
	const count = useSignal(1);
	const derived = useComputed$(() => `${props.label}:${count.value * props.multiplier}`);
	return <output data-value="derived">{derived.value}</output>;
});
