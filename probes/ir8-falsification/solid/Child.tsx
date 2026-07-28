// HAND-WRITTEN PROBE. Not emitted, not a golden, not read by any test.
//
// What @frameless/solid WOULD print if IR-8 supplied the prop types. Compare
// packages/frameworks/solid/generated/S1.jsx, whose signature is
//   export function RenderOnce(props) {
// with NO annotation. Solid does not destructure (that would break reactivity),
// so IR-8's type lands on the single `props` parameter rather than on entries.
import { createSignal } from 'solid-js';

export function RenderOnce(props: { label: string; multiplier: number }) {
	const [count] = createSignal(1);
	const derived = () => `${props.label}:${count() * props.multiplier}`;
	return <output data-value="derived">{derived()}</output>;
}
