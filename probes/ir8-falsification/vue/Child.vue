<!-- HAND-WRITTEN PROBE. Not emitted, not a golden, not read by any test.

  What @frameless/vue WOULD print if IR-8 supplied the prop types. Compare the
  real golden packages/frameworks/vue/generated/S1.vue, whose script block is
    <script setup>
      const props = defineProps(['label', 'multiplier', 'visible', 'onTrace']);
  The array form types every prop `any` - that is the exact reason
  demos/vue-official/tsconfig.app.json records "wrong-typed prop on an emitted
  component  GREEN (at BOTH checkJs settings)". Two deltas here, and they move
  together: `lang="ts"` and the type-argument form of defineProps. -->
<script setup lang="ts">
	import { computed, ref } from 'vue';
	const props = defineProps<{ label: string; multiplier: number }>();
	const count = ref(1);
	const derived = computed(() => `${props.label}:${count.value * props.multiplier}`);
</script>

<template>
	<output data-value="derived">{{ derived }}</output>
</template>
