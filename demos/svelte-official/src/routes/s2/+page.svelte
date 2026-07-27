<script lang="ts">
	import KeyedTodo from '$lib/emitted/KeyedTodo.svelte';
	import { noTrace, s2Seed } from '$lib/scenario-props';
</script>

<!-- S2. Same seed as the react, solid and qwik lanes. -->
<KeyedTodo seed={s2Seed} onTrace={noTrace} />
