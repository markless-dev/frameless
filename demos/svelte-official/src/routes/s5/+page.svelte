<script lang="ts">
	import BranchBoard from '$lib/emitted/BranchBoard.svelte';
	import { noTrace, s5Seed } from '$lib/scenario-props';
</script>

<!-- S5. Same branch seed as the react, solid, qwik, vue and angular lanes. -->
<BranchBoard seed={s5Seed} onTrace={noTrace} />
