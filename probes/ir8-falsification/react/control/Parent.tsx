// CONTROL ARM: the SAME wrong-typed call site as negative/, but against the
// UNTYPED child. If this is GREEN, the RED in negative/ is caused by the type.
import { RenderOnce } from './Child.jsx';

export function Parent() {
	return <RenderOnce label="s1" multiplier="3" />;
}
