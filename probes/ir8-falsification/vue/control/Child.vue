<!-- CONTROL ARM. TODAY's emitted shape: no lang="ts", array-form defineProps.
  Compare packages/frameworks/vue/generated/S1.vue. -->
<script setup>
	import { computed, ref } from 'vue';
	const props = defineProps(['label', 'multiplier']);
	const count = ref(1);
	const derived = computed(() => `${props.label}:${count.value * props.multiplier}`);
</script>

<template>
	<output data-value="derived">{{ derived }}</output>
</template>
