<!-- COUPLING PROBE: a $props() type annotation WITHOUT lang="ts". -->
<script>
	let { label, multiplier }: { label: string; multiplier: number } = $props();
</script>

<output>{label}{multiplier}</output>
