<script lang="ts">
	import AsyncBoard from '$lib/emitted/AsyncBoard.svelte';
	import { armS8Gate, noTrace, s8Gate, s8ResolvedGate } from '$lib/scenario-props';

	// The /s8 harness. `$state` rather than a module-level mutable: the board
	// reads `ready` as a prop, so the new promise has to arrive through a
	// reactive update. Nothing here is emitted output — see `assertS8` in
	// demos/react-official/three-way-contract.ts.
	let ready = $state(s8ResolvedGate);
</script>

<!-- S8. Same gate protocol as the react, solid, qwik, vue and angular lanes. -->
<button type="button" data-harness="arm" onclick={() => (ready = armS8Gate())}>arm</button>
<button type="button" data-harness="release" onclick={() => s8Gate.release()}>release</button>
<p data-harness="gate">{ready === s8ResolvedGate ? 'open' : 'held'}</p>
<AsyncBoard {ready} onTrace={noTrace} />
