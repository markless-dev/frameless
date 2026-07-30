<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AsyncBoard from './emitted/AsyncBoard.vue'
import AttrBoard from './emitted/AttrBoard.vue'
import BranchBoard from './emitted/BranchBoard.vue'
import EventForm from './emitted/EventForm.vue'
import FormBoard from './emitted/FormBoard.vue'
import KeyedTodo from './emitted/KeyedTodo.vue'
import NestedBoard from './emitted/NestedBoard.vue'
import RenderOnce from './emitted/RenderOnce.vue'
import TodoMvc from './emitted/TodoMvc.vue'
import WhitespaceBoard from './emitted/WhitespaceBoard.vue'
import {
  armS8Gate,
  noTrace,
  s8Gate,
  s8ResolvedGate,
  s2Seed,
  s4Seed,
  s5Seed,
  s6Label,
  s6Seed,
  s7Seed,
  s9Seed,
  scenarioFor,
} from './scenario-props'

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

// The /s8 harness. A `ref` rather than a module-level mutable: the board reads
// `ready` as a prop, so the new promise has to arrive through a reactive
// update. Nothing here is emitted output — see `assertS8` in
// demos/react-official/three-way-contract.ts.
const s8Ready = ref<Promise<string>>(s8ResolvedGate)
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
  <NestedBoard v-else-if="scenario === 's4'" v-bind:seed="s4Seed" v-bind:onTrace="noTrace" />
  <BranchBoard v-else-if="scenario === 's5'" v-bind:seed="s5Seed" v-bind:onTrace="noTrace" />
  <WhitespaceBoard
    v-else-if="scenario === 's6'"
    v-bind:seed="s6Seed"
    v-bind:label="s6Label"
    v-bind:onTrace="noTrace"
  />
  <FormBoard v-else-if="scenario === 's7'" v-bind:seed="s7Seed" v-bind:onTrace="noTrace" />
  <template v-else-if="scenario === 's8'">
    <button type="button" data-harness="arm" v-on:click="s8Ready = armS8Gate()">arm</button>
    <button type="button" data-harness="release" v-on:click="s8Gate.release()">release</button>
    <p data-harness="gate">{{ s8Ready === s8ResolvedGate ? 'open' : 'held' }}</p>
    <AsyncBoard v-bind:ready="s8Ready" v-bind:onTrace="noTrace" />
  </template>
  <AttrBoard v-else-if="scenario === 's9'" v-bind:seed="s9Seed" v-bind:onTrace="noTrace" />
  <!--
    THE FIRST APPLICATION, and the only branch here that is not an ordinal. It is
    deliberately NOT part of the 6 x 9 three-way contract - `scripts/e2e.mjs` pins
    `threeWayScenarios` to the literal ['s1'..'s9'] - so this page is browsable
    only. It takes no seed prop in any lane: IR-8 has no lowering for an array
    type, so the list is seeded inside the emitted component.
  -->
  <!--
    IT IS ALSO THE ONLY BRANCH THAT LINKS A STYLESHEET, and deliberately so. The
    pair is rendered HERE rather than in index.html because s1-s9 are the 6 x 9
    three-way contract: todomvc-app-css restyles `body` and every `button` in the
    document, so linking it globally would change the geometry of nine scenarios
    that exist to be compared across six lanes. The `<template>` wrapper is what
    lets one `v-else-if` arm carry three nodes, the same shape the s8 arm above
    already uses.

    `index.css` is todomvc-app-css@2.4.3 verbatim; the supplement overrides some of
    it at equal specificity and must load second. Both are copied into
    `public/todomvc-app-css/` by `pnpm copy-todomvc-css`, and all six lanes serve
    them at these same two URLs. See demos/shared/copy-todomvc-css.mjs.
  -->
  <template v-else-if="scenario === 'todomvc'">
    <link rel="stylesheet" href="/todomvc-app-css/index.css" />
    <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
    <TodoMvc v-bind:onTrace="noTrace" />
  </template>
</template>
