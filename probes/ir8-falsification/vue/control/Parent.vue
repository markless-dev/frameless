<!-- CONTROL ARM: same wrong-typed call site, against the UNTYPED child. -->
<script setup lang="ts">
	import Child from './Child.vue';
</script>

<template>
	<Child label="s1" :multiplier="'3'" />
</template>
