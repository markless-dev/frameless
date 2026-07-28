// NEGATIVE ARM: the wrong-typed call site. This MUST go RED.
import { RenderOnce } from '../Child';

export function Parent() {
	return <RenderOnce label="s1" multiplier="3" />;
}
