// HAND-WRITTEN PROBE. Not emitted, not a golden, not read by any test.
//
// What @frameless/qwik WOULD print if IR-8 supplied the prop types. Compare
// packages/frameworks/qwik/generated/S1.jsx, whose signature is
//   export const RenderOnce = component$((props) => {
// with NO annotation. Like Solid, Qwik keeps a single `props` object, so IR-8's
// type lands on the component$ callback parameter.
import { component$, useComputed$, useSignal } from '@qwik.dev/core';

export const RenderOnce = component$((props: { label: string; multiplier: number }) => {
	const count = useSignal(1);
	const derived = useComputed$(() => `${props.label}:${count.value * props.multiplier}`);
	return <output data-value="derived">{derived.value}</output>;
});
