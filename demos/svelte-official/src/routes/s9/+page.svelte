<script lang="ts">
	import AttrBoard from '$lib/emitted/AttrBoard.svelte';
	import { noTrace, s9Seed } from '$lib/scenario-props';
</script>

<!-- S9. Same boolean-attribute seed as the react, solid, qwik, vue and angular lanes. -->
<AttrBoard seed={s9Seed} onTrace={noTrace} />
