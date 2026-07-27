<script lang="ts">
	import NestedBoard from '$lib/emitted/NestedBoard.svelte';
	import { noTrace, s4Seed } from '$lib/scenario-props';
</script>

<!-- S4. Same nested seed as the react, solid, qwik, vue and angular lanes. -->
<NestedBoard seed={s4Seed} onTrace={noTrace} />
