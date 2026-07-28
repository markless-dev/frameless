// POSITIVE TWIN: same call site, correctly typed. This MUST go GREEN.
import { RenderOnce } from '../Child';

export function Parent() {
	return <RenderOnce label="s1" multiplier={3} />;
}
