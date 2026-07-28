// CONTROL ARM. This is TODAY's emitted shape, verbatim in form: no types at all.
// Compare packages/frameworks/react/generated/S1.jsx.
import { useState } from 'react';

export function RenderOnce({ label, multiplier }) {
	const [count] = useState(1);
	return <output data-value="derived">{`${label}:${count * multiplier}`}</output>;
}
