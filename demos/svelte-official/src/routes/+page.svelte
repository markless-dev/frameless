<script lang="ts">
	import RenderOnce from '$lib/emitted/RenderOnce.svelte';
	import { noTrace } from '$lib/scenario-props';
</script>

<!-- S1. The props are the ones demos/react-official/src/App.jsx and
     demos/qwik/src/routes/index.tsx pass, so the four lanes are comparable. -->
<RenderOnce label="kit" multiplier={2} visible={true} onTrace={noTrace} />
