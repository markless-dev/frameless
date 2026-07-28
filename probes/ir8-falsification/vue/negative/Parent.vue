<!-- NEGATIVE ARM: the wrong-typed call site. This MUST go RED. -->
<script setup lang="ts">
	import Child from '../Child.vue';
</script>

<template>
	<Child label="s1" :multiplier="'3'" />
</template>
