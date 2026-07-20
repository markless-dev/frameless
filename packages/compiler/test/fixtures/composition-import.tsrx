import { Child } from "./child.tsrx";

export function Parent() @{
	<Child value={1}><span>nested</span></Child>
}
