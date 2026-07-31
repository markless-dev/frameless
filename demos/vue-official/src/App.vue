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
import CodexClone from './emitted/CodexClone.vue'
import HnFront from './emitted/HnFront.vue'
import HabitTracker from './emitted/HabitTracker.vue'
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
 * The /codex branch, decided HERE for the identical reason `advanced` above is:
 * `scenarioFor` and its `ScenarioId` union live in `./scenario-props`, which is
 * outside the file envelope of the card that added this route
 * (`frameless-app-suite-v1` T006), so the id is not in that union. The path
 * normalisation is character-for-character the one `scenarioFor` applies, and the
 * react and solid lanes spell it inside `scenarioFor`; folding both of these in
 * later is a pure refactor with no behavioural delta.
 *
 * It reads `props.url` - the same value `scenario` reads - and not
 * `window.location`, because both sides must agree or Vue would hydrate a
 * different branch than it rendered.
 */
const codex = computed(
  () =>
    String(props.url ?? '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '') === 'codex',
)

/**
 * The /hn branch, decided HERE for the identical reason `advanced` and `codex`
 * above are: `scenarioFor` and its `ScenarioId` union live in
 * `./scenario-props`, which is outside the file envelope of the card that added
 * this route (`frameless-app-axes-v1` T002), so the id is not in that union.
 * The path normalisation is character-for-character the one `scenarioFor`
 * applies, and the react and solid lanes spell it inside `scenarioFor`; folding
 * all three of these in later is a pure refactor with no behavioural delta.
 *
 * It reads `props.url` - the same value `scenario` reads - and not
 * `window.location`, because both sides must agree or Vue would hydrate a
 * different branch than it rendered.
 */
const hn = computed(
  () =>
    String(props.url ?? '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '') === 'hn',
)

/**
 * The /habits branch, decided HERE for the identical reason `advanced`, `codex`
 * and `hn` above are: `scenarioFor` and its `ScenarioId` union live in
 * `./scenario-props`, which is outside the file envelope of the card that added
 * this route (`frameless-app-axes-v1` T004), so the id is not in that union.
 * The path normalisation is character-for-character the one `scenarioFor`
 * applies. It reads `props.url` - the same value `scenario` reads - and not
 * `window.location`, because both sides must agree or Vue would hydrate a
 * different branch than it rendered.
 */
const habits = computed(
  () =>
    String(props.url ?? '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '') === 'habits',
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
  <!--
    THE THIRD APPLICATION - the CODEX CLONE - and IT MUST SIT BESIDE `advanced` AT
    THE HEAD OF THIS CHAIN FOR THE SAME MEASURED REASON: `scenarioFor` does not know
    this path either, so it falls through to 's1', and the chain's first
    `v-else-if` tests for 's1'. A trailing arm could never fire.

    THIS LANE EMITS S12 AND MISBEHAVES ON EXACTLY ONE AXIS, which is why the route
    is served rather than withheld. The emitter inlines handlers into TEMPLATE
    EXPRESSIONS and Vue's template compiler prefixes any identifier outside
    GLOBALS_ALLOWED with `_ctx.`; that list carries Date and JSON and does NOT carry
    Promise or setTimeout (measured at @vue/shared@3.5.40), so the composer's
    three-chunk stream throws `_ctx.Promise is not a constructor`. Thread
    navigation, both tab pairs and the composer draft all work here. Deleting the
    route would delete a measured finding - it is EMITS-BUT-MISBEHAVES, the third
    verdict T001 established, and a LANE LIMIT inside Vue's own design envelope
    rather than a defect to file upstream.

    ANGULAR has no counterpart page at all: that emitter refuses S12 outright.

    Two stylesheets, and the order is load-bearing: `/shadcn-theme/tokens.css`
    carries the shadcn/ui default theme (MIT, (c) 2023 shadcn) and must load first;
    `/shadcn-theme/codex.css` is this repo's own component sheet written against
    those token names. Both are written into public/shadcn-theme/ by
    `pnpm copy-shadcn-theme`. Like /todomvc and /todomvc-advanced this page is
    OUT of the 6 x 9 three-way contract, which pins ['s1'..'s9'].
  -->
  <template v-else-if="codex">
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/shadcn-theme/codex.css" />
    <CodexClone v-bind:onTrace="noTrace" />
  </template>
  <!--
    THE FOURTH APPLICATION - the HACKER NEWS FRONT PAGE - and IT MUST SIT BESIDE
    `advanced` AND `codex` AT THE HEAD OF THIS CHAIN FOR THE SAME MEASURED
    REASON: `scenarioFor` does not know this path either, so it falls through to
    's1', and the chain's first `v-else-if` tests for 's1'. A trailing arm could
    never fire.

    THIS IS THE FIRST APPLICATION ROUTE IN THIS DEMO WHOSE LANE COUNT IS SIX, and
    the first that this lane serves with NOTHING misbehaving. S11 and S12 both
    throw here on `_ctx.Promise is not a constructor`, because the emitter inlines
    handlers into template expressions and @vue/shared@3.5.40's GLOBALS_ALLOWED
    omits Promise and setTimeout. S13 NAMES NO GLOBAL AT ALL - every relative age
    is a literal string in the seeded data rather than something computed from
    `Date` - so the pincer that costs this lane its two async apps does not reach
    it. That is a constraint of the fixture (constraint 9), not luck.

    IT CANNOT LOAD ON APPEAR AND NOTHING HERE PRETENDS OTHERWISE: fetch-on-render
    is unreachable in every lane, so the twelve stories are seeded inside the
    emitted component exactly as TodoMVC's are. No seed prop - IR-8 has no array
    lowering. `past`, `comments`, `ask`, `show`, `jobs` and `submit` are INERT
    because `.tsrx` has no routing construct, and the footer search FILTERS IN
    PLACE rather than reaching Algolia for the same reason.

    ONE STYLESHEET, AND IT IS THIS REPOSITORY'S OWN WORK - nothing was copied from
    news.ycombinator.com. `demos/shared/hn-css/hn.css` reproduces the measured
    geometry against the class names the emitters print, is written into
    public/hn-css/ by `pnpm copy-hn-css`, and is linked HERE rather than globally
    because it restyles `body`. Like the three application routes above, this page
    is OUT of the 6 x 9 three-way contract, which pins ['s1'..'s9'].
  -->
  <!--
        THE SIXTH APPLICATION - the HABIT TRACKER - and THE SIX-LANE FAN-OUT PAGE.
        It is the SECOND scenario in this corpus that all six lanes emit and ship,
        after S13, and the FIRST designed to be so: the whole app is SYNCHRONOUS
        DERIVED STATE, so there is no `Promise`/`setTimeout` for angular's
        global-identifier ban to catch, no async door for vue's GLOBALS_ALLOWED gap
        to open, and no component reference for either of T003's two emitter
        defects to reach. Its date - "JULY 30, 2026" over "Thursday" - is a LITERAL
        STRING in the seeded data, because the angular emitter cannot NAME `Date`
        and a clock would have cost this app the very lane count it exists to
        measure.

        WHAT ONE CLICK ON A HABIT TOGGLE MOVES, all derived from ONE `habits` cell
        and none of it written by the handler: the toggle's own fill, the row
        title's strikethrough, THE SIDEBAR ROW'S strikethrough (a second repeat in
        a different subtree - which is what makes this fan-out rather than a row
        re-render), the header counter, the sidebar badge, the progress bar's width
        class, the encouragement sentence AND its emoji, and today's dot inside
        that row's nested day strip. EIGHT observables.

        WHAT IS INERT AND NOT FAKED: `Statistics`, `New habit`, the sidebar toggle
        and the theme toggle - `.tsrx` has no routing construct at all. WHAT IS
        ABSENT: the reference's 30-day heat-map and sparkline, roughly two hundred
        decorative cells per habit that would triple the template while measuring
        nothing the eight observables do not already measure.

        TWO STYLESHEETS, ORDER LOAD-BEARING. `/shadcn-theme/tokens.css` is the
        vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load
        FIRST, because every colour in the second file is a `var()` from it.
        `/habit-css/habits.css` is THIS REPOSITORY'S OWN WORK - the Square UI
        reference is licence-restricted to REFERENCE-ONLY, so nothing was copied
        from it and its geometry was MEASURED in a browser instead. Both are linked
        HERE rather than globally because `habits.css` restyles `body`. Like
        S10-S14 this page is OUT of the 6 x 9 three-way contract, which pins
        `threeWayScenarios` to ['s1'..'s9'].

    AND THIS LANE'S OWN HISTORY IS THE REASON THE ABSENCE OF ASYNC MATTERS HERE.
    S11 and S12 EMIT in this lane, pass its gate, pass its typecheck, and THROW IN
    THE BROWSER - `_ctx.Promise is not a constructor` - because this emitter
    inlines handlers into TEMPLATE EXPRESSIONS and Vue's compiler prefixes any
    identifier outside GLOBALS_ALLOWED with `_ctx.`, a list carrying Date and JSON
    but not Promise or setTimeout. S15 names NO global at all, so five static
    gates AND the browser agree. That was checked in a browser, not assumed.
  -->
  <template v-else-if="habits">
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/habit-css/habits.css" />
    <HabitTracker v-bind:onTrace="noTrace" />
  </template>
  <template v-else-if="hn">
    <link rel="stylesheet" href="/hn-css/hn.css" />
    <HnFront v-bind:onTrace="noTrace" />
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
