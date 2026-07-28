// NEGATIVE ARM: the wrong-typed call site. This MUST go RED.
import { component$ } from '@qwik.dev/core';
import { RenderOnce } from '../Child';

export const Parent = component$(() => {
	return <RenderOnce label="s1" multiplier="3" />;
});
