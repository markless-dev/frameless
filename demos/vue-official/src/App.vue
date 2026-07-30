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
import TodoMvcAdvanced from './emitted/TodoMvcAdvanced.vue'
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
 * The /todomvc-advanced branch, decided HERE rather than inside `scenarioFor`.
 *
 * `scenarioFor` and its `ScenarioId` union live in `./scenario-props`, which is
 * OUTSIDE the file envelope of the card that added this route
 * (`frameless-app-suite-v1` T003), so the id is not in that union and this
 * component derives the branch itself. The path normalisation is character-for-
 * character the one `scenarioFor` applies, so the two agree on every input;
 * folding this into `scenarioFor` later is a pure refactor with no behavioural
 * delta, and the react and solid lanes already spell it that way.
 *
 * Both sides must agree or Vue would hydrate a different branch than it
 * rendered, which is why this reads `props.url` - the same value `scenario`
 * reads - rather than `window.location`.
 */
const advanced = computed(
  () =>
    String(props.url ?? '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '') === 'todomvc-advanced',
)

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
  <!--
    THE SECOND APPLICATION, and the first route in this demo whose lane count is
    FIVE rather than six: the angular emitter REFUSES S11 on its
    global-identifier ban ("Angular emitter cannot resolve the identifier
    Promise in a transplanted body"), so demos/angular-official has no
    counterpart to this page. Like /todomvc it is deliberately OUT of the 6 x 9
    three-way contract - scripts/e2e.mjs pins threeWayScenarios to the literal
    ['s1'..'s9'] - so this page is browsable only. It takes no seed prop: IR-8
    has no lowering for an array type, so the list is seeded inside the emitted
    component.

    THIS LANE EMITS, PASSES ITS OWN GATE, AND THEN THROWS. MEASURED IN A BROWSER
    at this route, verbatim: `_ctx.Promise is not a constructor`.
    The vue emitter inlines handlers into TEMPLATE EXPRESSIONS, and Vue's template
    compiler prefixes every identifier outside its own allowlist with `_ctx.`.
    @vue/shared@3.5.40's GLOBALS_ALLOWED carries Date and JSON and does NOT carry
    Promise or setTimeout, so S11's artificial delay compiles to
    `new _ctx.Promise(...)` and is undefined at runtime. compileScript is happy,
    the vue gate is happy and `pnpm check` is happy; ONLY A BROWSER SEES IT.
    CONSEQUENCE, STATED PLAINLY: on this page add, destroy, filter and LOCAL
    search work, and the REMOTE SEARCH and the OPTIMISTIC TOGGLE do not - each
    throws on its first statement past the boundary. The route is kept rather than
    deleted because it is genuinely emitted and four of its seven axes run, and
    because removing it would delete a measured finding. It is a LANE LIMIT inside
    Vue's own design envelope - template expressions are deliberately scoped to
    the render context - not a defect to file upstream.

    IT MUST BE THE FIRST ARM OF THIS CHAIN, not the last, and that is a real
    constraint rather than a layout choice: `scenarioFor` does not know this
    path, so it falls through to 's1', and the chain used to OPEN with
    `v-if="scenario === 's1'"`. A trailing arm could therefore never fire.

    It links THREE stylesheets where /todomvc links two. index.css is
    todomvc-app-css@2.4.3 verbatim, frameless-supplement.css is the repair layer
    the simple app needs, and frameless-advanced.css carries the controls this
    app adds. Cascade order is load-bearing at both joints and the advanced
    sheet MUST load third. All three are copied into public/todomvc-app-css/ by
    `pnpm copy-todomvc-css`. THE PIXEL PASS IS T005'S CARD, NOT T003'S.
  -->
  <template v-if="advanced">
    <link rel="stylesheet" href="/todomvc-app-css/index.css" />
    <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
    <link rel="stylesheet" href="/todomvc-app-css/frameless-advanced.css" />
    <TodoMvcAdvanced v-bind:onTrace="noTrace" />
  </template>
  <RenderOnce
    v-else-if="scenario === 's1'"
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
