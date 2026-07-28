<!-- CONTROL ARM. TODAY's emitted shape: plain <script>, untyped $props().
  Compare packages/frameworks/svelte/generated/S1.svelte. -->
<script>
	let { label, multiplier } = $props();
	let count = $state(1);
	const derived = $derived(`${label}:${count * multiplier}`);
</script>

<output data-value="derived">{derived}</output>
