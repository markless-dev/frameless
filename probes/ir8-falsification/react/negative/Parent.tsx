// NEGATIVE ARM: the wrong-typed call site. This MUST go RED.
// `multiplier` is declared `number` on RenderOnce; here it is bound to a string.
import { RenderOnce } from '../Child';

export function Parent() {
	return <RenderOnce label="s1" multiplier="3" />;
}
