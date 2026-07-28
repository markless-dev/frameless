// POSITIVE TWIN: identical to the negative arm except the prop is correctly
// typed. This MUST go GREEN, or the probe itself is broken and the negative
// arm's RED proves nothing.
import { RenderOnce } from '../Child';

export function Parent() {
	return <RenderOnce label="s1" multiplier={3} />;
}
