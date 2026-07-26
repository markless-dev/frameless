// Solid supports `attr:*` namespaced props, which force a value to be set as an
// HTML ATTRIBUTE rather than a DOM property. Its shipped `InputHTMLAttributes`
// does not declare them, so both the emitted output and the handwritten
// references in this package fail to type-check against solid-js's own types.
//
// This declares what Solid actually accepts. It is a description of real
// behavior, not a suppression: `attr:value` works at runtime, which is why the
// references use it and why `pnpm e2e` and the Solid browser lane are green.
//
// See docs/goals/frameless-testing-ci-v1/notes/findings-002-solid-attr-namespace.md
// for the open question this does NOT settle - whether the emitter should be
// using `attr:` at all, and whether this belongs upstream in solid-js.
import 'solid-js';

declare module 'solid-js' {
	namespace JSX {
		interface CustomAttributes<T> {
			[key: `attr:${string}`]: string | number | boolean | undefined;
		}
	}
}
