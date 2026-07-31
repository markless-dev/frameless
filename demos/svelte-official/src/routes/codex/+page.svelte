<script lang="ts">
	import CodexClone from '$lib/emitted/CodexClone.svelte';
	import { noTrace } from '$lib/scenario-props';
</script>

<!--
	THE THIRD APPLICATION - the CODEX CLONE - and the one this board expected to be
	refused outright. It is not, and it is no longer even partial: SIX LANES RUN IT.
	This comment used to read "Four lanes run it, one emits and misbehaves, one
	refuses at emit", and BOTH of those exceptions are closed.

	ANGULAR SERVES /codex. It used to have no counterpart to this page: that emitter
	refused S12 with the message read off THIS module and carrying THIS module's
	declared members: "Angular emitter cannot resolve the identifier "Promise" in a
	transplanted body: it is neither a body-local binding, a function parameter, a
	@for variable, nor a declared component member". A streamed answer is three
	unrolled chunks separated by an artificial delay, the only delay this authoring
	surface can express is `new Promise` + `setTimeout`, and that lane could not NAME
	a global inside a transplanted body. `frameless-app-fidelity-v1` T003 ruled a
	TWO-NAME ALLOWLIST - `Promise` and `setTimeout`, nothing else - and T007 landed
	it.
	THE CITATION THIS PARAGRAPH USED TO CARRY WAS NOT MERELY STALE, IT WAS INVERTED.
	It said packages/frameworks/angular/test/unbuilt-scenarios.ts "drives the real
	emit() and asserts it throws with that message". At HEAD the exported
	`ANGULAR_UNBUILT_SCENARIOS` there is `[]`, and that lane's emitter.test.ts drives
	BOTH formerly-refused
	goldens through the real emit() and REQUIRES THEM TO SUCCEED, keeping a separate
	`Math` row as the live negative control that proves the fail-closed arm still
	fires. Read the file's header for the history; read `TRANSPLANTED_GLOBALS` in
	packages/frameworks/angular/src/emitter/index.ts for which two names are
	admitted today. MEASURED AT HEAD BY T014: `ng serve` answers /codex with 5,356
	bytes of SSR body carrying `<app-root>`, "composer" five times and "thread"
	twelve times, against a bogus path that answers 404 with no app-root at all.

	VUE SERVES ITS ROUTE AND ITS STREAM USED TO THROW. The vue emitter inlines
	handlers into TEMPLATE EXPRESSIONS and Vue's template compiler prefixes any
	identifier outside GLOBALS_ALLOWED with `_ctx.` - a list carrying Date and JSON
	and NOT Promise or setTimeout (measured at @vue/shared@3.5.40) - so the browser
	reported `_ctx.Promise is not a constructor` while its synchronous axes all
	worked. THE SAME T007 REPAIRED THAT TOO, with bound `<script setup>` shim consts
	rather than any change to upstream's list, and the streamed answer was then
	driven and observed GROWING across three distinct readings. Both were lane limits
	inside each framework's own design envelope and NEITHER WAS EVER FILED UPSTREAM.

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
