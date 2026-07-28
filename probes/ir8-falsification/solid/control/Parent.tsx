// CONTROL ARM: same wrong-typed call site, against the UNTYPED child.
import { RenderOnce } from './Child.jsx';

export function Parent() {
	return <RenderOnce label="s1" multiplier="3" />;
}
