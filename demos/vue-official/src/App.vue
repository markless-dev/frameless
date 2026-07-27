<script setup lang="ts">
import { computed, onMounted } from 'vue'
import EventForm from './emitted/EventForm.vue'
import KeyedTodo from './emitted/KeyedTodo.vue'
import NestedBoard from './emitted/NestedBoard.vue'
import RenderOnce from './emitted/RenderOnce.vue'
import { noTrace, s2Seed, s4Seed, scenarioFor } from './scenario-props'

// DELTA from create-vite-extra@5.0.2 template-ssr-vue-ts/src/App.vue, which
// renders a single fixed `<HelloWorld />`. One shared IR, five emitters: these
// three components are frameless-emitted and copied in by `pnpm copy-emitted`,
// and the props below are the same ones demos/react-official/src/App.jsx,
// demos/solid-official/src/App.jsx, demos/qwik/src/routes/** and
// demos/svelte-official/src/routes/** pass, so the five official demos are
// directly comparable.
const props = defineProps<{ url?: string }>()
const scenario = computed(() => scenarioFor(props.url))

/**
 * The activation marker the shared contract waits for before it clicks.
 *
 * Set imperatively, in Vue's own post-mount hook, in the ROOT component. Three
 * alternatives that would each be wrong:
 *
 * - a template attribute binding would be server-rendered, and the contract's
 *   `forbidInServedPayload` would correctly fail the served payload for carrying
 *   a string only activation can produce;
 * - `src/dev-sink.ts` runs at module scope, before hydration even starts, so a
 *   marker there would be a lie about interactivity;
 * - a statement after `app.mount()` in `entry-client.ts` would run before Vue
 *   flushes its mounted hooks — the shape frameless-svelte-v1 T002 explicitly
 *   ruled out — and a child component's `onMounted` would only prove that child
 *   mounted.
 *
 * The root component's `onMounted` is the last mount in the tree: Vue flushes
 * mounted hooks child-first, and the emitted component below is rendered as this
 * component's child. That ordering is asserted rather than assumed — S1/S2/S3
 * click as soon as the marker appears, and every server-rendered assertion
 * between the marker and the first click passes, across three scenarios, with no
 * settle delay anywhere in the lane.
 */
onMounted(() => {
  document.documentElement.setAttribute('data-frameless-activated', 'vue')
})
</script>

<template>
  <RenderOnce
    v-if="scenario === 's1'"
    label="kit"
    v-bind:multiplier="2"
    v-bind:visible="true"
    v-bind:onTrace="noTrace"
  />
  <KeyedTodo v-else-if="scenario === 's2'" v-bind:seed="s2Seed" v-bind:onTrace="noTrace" />
  <EventForm v-else-if="scenario === 's3'" initial="hello" v-bind:onTrace="noTrace" />
  <NestedBoard v-else v-bind:seed="s4Seed" v-bind:onTrace="noTrace" />
</template>
