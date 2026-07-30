<script lang="ts">
	import TodoMvcAdvanced from '$lib/emitted/TodoMvcAdvanced.svelte';
	import { noTrace } from '$lib/scenario-props';
</script>

<!--
	THE SECOND APPLICATION, and the first route in this demo whose lane count is
	FOUR rather than six. The angular emitter REFUSES S11 outright - "Angular
	emitter cannot resolve the identifier "Promise" in a transplanted body: it is
	neither a body-local binding, a function parameter, a @for variable, nor a
	declared component member" - because TodoMVC Advanced creates its own
	artificial delay with `new Promise` + `setTimeout`, and that lane cannot NAME
	a global inside a transplanted body. So demos/angular-official has no
	counterpart to this page, and that is a recorded refusal rather than an
	omission. See packages/frameworks/angular/test/unbuilt-scenarios.ts.

	AND THE SIXTH LANE IS LOST DIFFERENTLY, WHICH IS WHY THE COUNT IS FOUR AND NOT
	FIVE. VUE emits this scenario, passes its own gate and its typecheck, and then
	THROWS IN THE BROWSER: `_ctx.Promise is not a constructor`. That emitter inlines
	handlers into TEMPLATE EXPRESSIONS, and Vue's template compiler prefixes any
	identifier outside GLOBALS_ALLOWED with `_ctx.` - a list that carries Date and
	JSON and does NOT carry Promise or setTimeout (measured at @vue/shared@3.5.40).
	So demos/vue-official DOES serve this route, with add/destroy/filter/local
	search working and the two ASYNC axes throwing. Both losses are lane limits
	inside each framework's own design envelope, not defects to file upstream.

	Like /todomvc it is deliberately NOT part of the 6 x 9 three-way contract -
	`scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'] - so
	this page is browsable only. There is no seed prop in any lane: IR-8 has no
	lowering for an array type, so the list is seeded inside the emitted component
	and all five shipped lanes start from byte-identical data.
-->
<!--
	IT LINKS THREE STYLESHEETS WHERE /todomvc LINKS TWO, and the cascade order is
	load-bearing at both joints. `index.css` is todomvc-app-css@2.4.3 verbatim;
	`frameless-supplement.css` overrides upstream at equal specificity and is
	correct only while it loads second; `frameless-advanced.css` carries the
	controls this app adds and is correct only while it loads third.

	All three are copied into `static/todomvc-app-css/` by `pnpm copy-todomvc-css`
	- `static`, not `public`, because SvelteKit is the one lane of the six that
	names its asset root that way - and every lane serves them at these same three
	URLs. See demos/shared/copy-todomvc-css.mjs.

	They are linked HERE rather than in src/app.html for the reason /todomvc
	records: todomvc-app-css restyles `body` and every `button` in the document,
	so a global link would move the geometry of the nine s1-s9 scenarios that
	`pnpm e2e` compares across six lanes.

	THE PIXEL PASS IS T005'S CARD, NOT T003'S. This route's obligation here is to
	run and be driven; the visual match against the named reference is next.
-->
<link rel="stylesheet" href="/todomvc-app-css/index.css" />
<link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
<link rel="stylesheet" href="/todomvc-app-css/frameless-advanced.css" />
<TodoMvcAdvanced onTrace={noTrace} />
