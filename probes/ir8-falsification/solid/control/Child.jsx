// CONTROL ARM. TODAY's emitted shape: no types at all.
// Compare packages/frameworks/solid/generated/S1.jsx.
import { createSignal } from 'solid-js';

export function RenderOnce(props) {
	const [count] = createSignal(1);
	return <output data-value="derived">{`${props.label}:${count() * props.multiplier}`}</output>;
}
