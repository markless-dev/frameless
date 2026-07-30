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
<TodoMvc onTrace={noTrace} />
