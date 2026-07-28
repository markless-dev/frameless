<script lang="ts">
	import FormBoard from '$lib/emitted/FormBoard.svelte';
	import { noTrace, s7Seed } from '$lib/scenario-props';
</script>

<!-- S7. Same form seed as the react, solid, qwik, vue and angular lanes. -->
<FormBoard seed={s7Seed} onTrace={noTrace} />
