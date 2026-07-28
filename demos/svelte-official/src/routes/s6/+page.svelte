<script lang="ts">
	import WhitespaceBoard from '$lib/emitted/WhitespaceBoard.svelte';
	import { noTrace, s6Label, s6Seed } from '$lib/scenario-props';
</script>

<!-- S6. Same whitespace seed and label as the react, solid, qwik, vue and angular lanes. -->
<WhitespaceBoard seed={s6Seed} label={s6Label} onTrace={noTrace} />
