<script lang="ts">
	import CodexClone from '$lib/emitted/CodexClone.svelte';
	import { noTrace } from '$lib/scenario-props';
</script>

<!--
	THE THIRD APPLICATION - the CODEX CLONE - and the one this board expected to be
	refused outright. It is not. Four lanes run it, one emits and misbehaves, one
	refuses at emit.

	ANGULAR HAS NO COUNTERPART TO THIS PAGE. That emitter refuses S12 with the
	message read off THIS module and carrying THIS module's declared members:
	"Angular emitter cannot resolve the identifier "Promise" in a transplanted body:
	it is neither a body-local binding, a function parameter, a @for variable, nor a
	declared component member". A streamed answer is three unrolled chunks separated
	by an artificial delay, the only delay this authoring surface can express is
	`new Promise` + `setTimeout`, and that lane cannot NAME a global inside a
	transplanted body. A recorded refusal rather than an omission - see
	packages/frameworks/angular/test/unbuilt-scenarios.ts, which drives the real
	emit() and asserts it throws with that message.

	VUE SERVES ITS ROUTE AND ITS STREAM THROWS. The vue emitter inlines handlers into
	TEMPLATE EXPRESSIONS and Vue's template compiler prefixes any identifier outside
	GLOBALS_ALLOWED with `_ctx.` - a list carrying Date and JSON and NOT Promise or
	setTimeout (measured at @vue/shared@3.5.40) - so the browser reports
	`_ctx.Promise is not a constructor`. Its synchronous axes all work. Both losses
	are lane limits inside each framework's own design envelope, not defects to file
	upstream.

	WHAT THE APP CANNOT DO, AND WHAT IS NOT FAKED. There is no Enter-to-send, no
	Escape, no shortcut and no Tab pane navigation, because two-word DOM events are
	unspellable in every lane (DEFECTS.md 15): every emitter lowercases the whole
	event name, so `onKeyDown` prints `onKeydown` and never fires. The composer ships
	the SEND BUTTON instead, which is the reference's other affordance and a plain
	click. The stream is also a FIXED count of three chunks rather than a
	variable-length one, because a write inside a loop body around an await is
	DEFECTS.md 8.1 in every lane.

	Like /todomvc and /todomvc-advanced it is deliberately NOT part of the 6 x 9
	three-way contract - `scripts/e2e.mjs` pins `threeWayScenarios` to the literal
	['s1'..'s9'] - so this page is browsable only. There is no seed prop in any lane:
	IR-8 has no lowering for an array type, so threads and messages are seeded inside
	the emitted component and all shipped lanes start from byte-identical data.
-->
<!--
	IT LINKS TWO STYLESHEETS, from a different family than the TodoMVC routes, and
	the order is load-bearing. `/shadcn-theme/tokens.css` carries the shadcn/ui
	default theme (MIT, "Copyright (c) 2023 shadcn") and must load first;
	`/shadcn-theme/codex.css` is this repo's own component sheet, hand-written
	against those token names, and is correct only while it loads second.

	`tokens.css` is DERIVED rather than copied, which is the one place this differs
	from the TodoMVC vendoring: upstream's published block opens with
	`@import "tailwindcss"`, declares its radius scale inside `@theme inline` and
	ends in `@layer base { @apply ... }`. A browser DROPS an unknown at-rule and
	everything in it, so linking those bytes would define none of --radius-sm/md/lg/xl
	- silently. `demos/shared/copy-shadcn-theme.mjs` lifts the honourable parts out
	and throws rather than emitting a partial theme.

	Both are written into `static/shadcn-theme/` by `pnpm copy-shadcn-theme` -
	`static`, not `public`, because SvelteKit is the one lane of the six that names
	its asset root that way - and every lane serves them at these same two URLs.

	They are linked HERE rather than in src/app.html for the reason the TodoMVC
	routes record: codex.css restyles `body`, so a global link would move the
	geometry of the nine s1-s9 scenarios that `pnpm e2e` compares across six lanes.
-->
<link rel="stylesheet" href="/shadcn-theme/tokens.css" />
<link rel="stylesheet" href="/shadcn-theme/codex.css" />
<CodexClone onTrace={noTrace} />
