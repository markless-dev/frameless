<!-- POSITIVE TWIN: same call site, correctly typed. This MUST go GREEN. -->
<script setup lang="ts">
	import Child from '../Child.vue';
</script>

<template>
	<Child label="s1" :multiplier="3" />
</template>
