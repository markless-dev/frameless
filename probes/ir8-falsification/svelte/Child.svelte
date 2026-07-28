<!-- HAND-WRITTEN PROBE. Not emitted, not a golden, not read by any test.

  What @frameless/svelte WOULD print if IR-8 supplied the prop types. Compare
  the real golden packages/frameworks/svelte/generated/S1.svelte, whose script
  block is
    <script>
      let { label, multiplier, visible, onTrace } = $props();
  with NO annotation. Two deltas here, and they move together: `lang="ts"` and
  the type annotation on the $props() destructuring pattern. -->
<script lang="ts">
	let { label, multiplier }: { label: string; multiplier: number } = $props();
	let count = $state(1);
	const derived = $derived(`${label}:${count * multiplier}`);
</script>

<output data-value="derived">{derived}</output>
