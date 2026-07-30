<script lang="ts">
	import TodoMvc from '$lib/emitted/TodoMvc.svelte';
	import { noTrace } from '$lib/scenario-props';
</script>

<!--
	THE FIRST APPLICATION, and the only route here that is not an ordinal. It is
	deliberately NOT part of the 6 x 9 three-way contract - `scripts/e2e.mjs`
	pins `threeWayScenarios` to the literal ['s1'..'s9'] - so this page is
	browsable only. There is no seed prop in any lane: IR-8 has no lowering for
	an array type, so the list is seeded inside the emitted component and all six
	lanes start from byte-identical data.
-->
<!--
	THE ONLY ROUTE THAT LINKS A STYLESHEET, and deliberately so. The pair is
	rendered HERE rather than in src/app.html because s1-s9 are the 6 x 9 three-way
	contract: todomvc-app-css restyles `body` and every `button` in the document, so
	linking it globally would change the geometry of nine scenarios that exist to be
	compared across six lanes.

	`index.css` is todomvc-app-css@2.4.3 verbatim; the supplement overrides some of
	it at equal specificity and must load second. Both are copied into
	`static/todomvc-app-css/` by `pnpm copy-todomvc-css` - `static`, not `public`,
	because SvelteKit is the one lane of the six that names its asset root that way -
	and all six lanes serve them at these same two URLs. See
	demos/shared/copy-todomvc-css.mjs.
-->
<link rel="stylesheet" href="/todomvc-app-css/index.css" />
<link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
<TodoMvc onTrace={noTrace} />
