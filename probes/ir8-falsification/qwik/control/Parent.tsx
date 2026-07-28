// CONTROL ARM: same wrong-typed call site, against the UNTYPED child.
import { component$ } from '@qwik.dev/core';
import { RenderOnce } from './Child.jsx';

export const Parent = component$(() => {
	return <RenderOnce label="s1" multiplier="3" />;
});
