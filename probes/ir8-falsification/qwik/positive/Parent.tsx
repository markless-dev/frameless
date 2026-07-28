// POSITIVE TWIN: same call site, correctly typed. This MUST go GREEN.
import { component$ } from '@qwik.dev/core';
import { RenderOnce } from '../Child';

export const Parent = component$(() => {
	return <RenderOnce label="s1" multiplier={3} />;
});
