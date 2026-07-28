<!-- COUPLING PROBE: type-argument defineProps WITHOUT lang="ts". -->
<script setup>
	const props = defineProps<{ label: string; multiplier: number }>();
</script>

<template>
	<output>{{ props.label }}</output>
</template>
