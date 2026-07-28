<!-- CONTROL ARM: same wrong-typed call site, against the UNTYPED child. -->
<script lang="ts">
	import Child from './Child.svelte';
</script>

<Child label="s1" multiplier={'3'} />
