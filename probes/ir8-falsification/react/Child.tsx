// HAND-WRITTEN PROBE. Not emitted, not a golden, not read by any test.
//
// This is what @frameless/react WOULD print if IR-8 supplied
// PropDestructuringEntry.type. Compare the real golden
// packages/frameworks/react/generated/S1.jsx, whose signature is
//   export function RenderOnce({ label, multiplier, visible, onTrace }) {
// with NO type annotation anywhere. The only delta below is the annotation.
import { useState } from 'react';

export function RenderOnce({
	label,
	multiplier,
}: {
	label: string;
	multiplier: number;
}) {
	const [count] = useState(1);
	const derived = `${label}:${count * multiplier}`;
	return <output data-value="derived">{derived}</output>;
}
