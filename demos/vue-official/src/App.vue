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
import Contacts from './emitted/Contacts.vue'
import TaskBoard from './emitted/TaskBoard.vue'
import WhitespaceBoard from './emitted/WhitespaceBoard.vue'
import {
  armS8Gate,
  hnDestination,
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
 * The /hn nav sink, added by frameless-app-fidelity-v1 T006.
 *
 * `location.assign` IS THIS LANE'S ROUTER RATHER THAN A WAY AROUND ONE. This
 * demo is the create-vite SSR-Vue scaffold: `scenarioFor(props.url)` above IS
 * the routing, the url arrives as a PROP so that server and client branch
 * identically, and there is no client router to call. A document navigation is
 * therefore the same door the address bar uses. It is also why the proof that
 * this works is a BODY HASH and not an HTTP status - this lane answers 200 for
 * any path at all.
 *
 * ONLY '/hn' IS ACTED ON. `hnDestination` also names '/hn-item', and this lane
 * has no such route because it emits no `HnItem`; the guard is explicit so that
 * a future lane gaining the page is a ONE-LINE change here and not a silent
 * behaviour difference nobody wrote down.
 */
const hnTrace = (name: string, detail: Record<string, unknown>): void => {
  const to = hnDestination(name, detail)
  if (to === '/hn') window.location.assign(to)
}

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
 * The /board branch, decided HERE for the identical reason `habits` above is:
 * `scenarioFor` and its `ScenarioId` union live in `./scenario-props`, which is
 * outside the file envelope of the card that added this route
 * (`frameless-app-axes-v1` T005), so the id is not in that union. The path
 * normalisation is character-for-character the one `scenarioFor` applies.
 */
const board = computed(
  () =>
    String(props.url ?? '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '') === 'board',
)

/**
 * The /contacts branch, decided HERE for the identical reason `habits` and
 * `board` above are: `scenarioFor` and its `ScenarioId` union live in
 * `./scenario-props`, which is outside the file envelope of the card that added
 * this route (`frameless-app-axes-v1` T006), so the id is not in that union. The
 * path normalisation is character-for-character the one `scenarioFor` applies.
 */
const contacts = computed(
  () =>
    String(props.url ?? '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '') === 'contacts',
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
    THE SECOND APPLICATION, and a route whose lane count USED TO BE FIVE and is
    now SIX. The angular emitter refused S11 on its global-identifier ban
    ("Angular emitter cannot resolve the identifier Promise in a transplanted
    body"); `frameless-app-fidelity-v1` T007 closed that with a TWO-NAME
    allowlist - Promise and setTimeout, nothing else - so
    demos/angular-official now serves /todomvc-advanced. Like /todomvc it is
    deliberately OUT of the 6 x 9 three-way contract - scripts/e2e.mjs pins
    threeWayScenarios to the literal ['s1'..'s9'] - so this page is browsable
    only. It takes no seed prop: IR-8 has no lowering for an array type, so the
    list is seeded inside the emitted component.

    THIS LANE USED TO EMIT, PASS ITS OWN GATE, AND THEN THROW, AND THAT IS FIXED.
    The historical failure, measured in a browser at this route, was verbatim
    `_ctx.Promise is not a constructor`: the vue emitter inlines handlers into
    TEMPLATE EXPRESSIONS, and Vue's template compiler prefixes every identifier
    outside its own allowlist with `_ctx.`. @vue/shared@3.5.40's GLOBALS_ALLOWED
    carries Date and JSON and does NOT carry Promise or setTimeout, so S11's
    artificial delay compiled to `new _ctx.Promise(...)` and was undefined at
    runtime. compileScript was happy, the vue gate was happy, vue-tsc was happy
    and `pnpm check` was happy; ONLY A BROWSER EVER SAW IT.
    THE REPAIR DID NOT TOUCH THAT UPSTREAM LIST, WHICH IS NOT OURS AND HAS NO
    HOOK. The emitter now writes a `<script setup>` SHIM CONST for each
    allowlisted free identifier, bound with `.bind(globalThis)` - binding
    matters, because @vitejs/plugin-vue compiles a setup binding to a
    `$setup.setTimeout(...)` METHOD CALL whose receiver Web IDL rejects, and an
    unbound shim merely traded one runtime throw for `Illegal invocation` while
    every compile-level instrument stayed green. A setup binding is not
    `_ctx.`-prefixed at all, so the defect has no path left.
    STATED PLAINLY: every axis on this page runs - add, destroy, filter, LOCAL
    search, the REMOTE SEARCH and the OPTIMISTIC TOGGLE. Driven in a browser at
    the commit that repaired it, not inferred from a mount: a page that MOUNTS
    proved nothing here, because both broken arms HUNG at "saving" rather than
    crashing on load.

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

    THIS LANE USED TO EMIT S12 AND MISBEHAVE ON EXACTLY ONE AXIS, AND THAT AXIS
    NOW RUNS. The emitter inlines handlers into TEMPLATE EXPRESSIONS and Vue's
    template compiler prefixes any identifier outside GLOBALS_ALLOWED with
    `_ctx.`; that list carries Date and JSON and does NOT carry Promise or
    setTimeout (measured at @vue/shared@3.5.40), so the composer's three-chunk
    stream threw `_ctx.Promise is not a constructor`. `frameless-app-fidelity-v1`
    T007 repaired it with bound `<script setup>` shim consts - see the
    /todomvc-advanced comment above for why the binding is load-bearing - and the
    streamed answer was then DRIVEN in a browser and observed GROWING across
    three distinct readings. Thread navigation, both tab pairs and the composer
    draft worked throughout. The route was kept rather than deleted while it was
    broken because it was genuinely emitted and the failure was a measured
    finding; it is now simply correct.

    ANGULAR SERVES /codex TOO, since the same card. It refused S12 outright until
    the two-name allowlist landed.

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

    THIS WAS THE FIRST APPLICATION ROUTE IN THIS DEMO WHOSE LANE COUNT WAS SIX,
    and the first that this lane served with NOTHING misbehaving. S11 and S12
    USED TO throw on `_ctx.Promise is not a constructor` - the emitter inlines
    handlers into template expressions and @vue/shared@3.5.40's GLOBALS_ALLOWED
    omits Promise and setTimeout - and `frameless-app-fidelity-v1` T007 closed
    that with bound `<script setup>` shim consts, so all three routes are now
    six-lane and none misbehaves. S13's own reason is UNCHANGED AND DIFFERENT: it
    NAMES NO GLOBAL AT ALL - every relative age is a literal string in the seeded
    data rather than something computed from `Date`, which is still a refused
    name on determinism grounds - so the pincer never reached it in the first
    place. That is a constraint of the fixture (constraint 9), not luck.

    IT CANNOT LOAD ON APPEAR AND NOTHING HERE PRETENDS OTHERWISE: fetch-on-render
    is unreachable in every lane, so the twelve stories are seeded inside the
    emitted component exactly as TodoMVC's are. No seed prop - IR-8 has no array
    lowering.

    THE LINKS, CORRECTED BY frameless-app-fidelity-v1 T006. The old wording said
    `past`, `comments`, `ask`, `show`, `jobs` and `submit` are inert BECAUSE
    `.tsrx` has no routing construct. TRUE PREMISE, FALSE INFERENCE: every stub
    already emitted `preventDefault()` plus an `onTrace('nav', ...)` naming its
    destination, and the `noTrace` this route used to pass was where they died.
    The logo and the wordmark now reach /hn through `hnTrace`. SEVENTEEN OF THE
    THIRTY-ONE STUBS STAY INERT BY DESIGN - `new`, `past`, the masthead
    `comments` (/newcomments, not a story thread), `ask`, `show`, `jobs`,
    `submit`, `login`, `More` and the eight footer links are EACH A SEPARATE
    APPLICATION, which no routing construct anywhere would reach - and the page
    LABELS them in `.hn-note` rather than pointing them somewhere false.
    AND IN THIS LANE THE PER-STORY COMMENTS LINK IS INERT TOO, which is the one
    thing this route may not fake: THIS LANE EMITS NO `HnItem` AT ALL. The
    emitter's refusal, verbatim - "Vue emitter has no lowering for a same-module
    component reference (HnItem)" - is why there is no /hn-item branch below to
    navigate to. "The comments link works" IS A FOUR-LANE CLAIM.
    The footer search FILTERS IN PLACE rather than reaching Algolia.

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
    S11 and S12 EMITTED in this lane, passed its gate, passed its typecheck, and
    THREW IN THE BROWSER - `_ctx.Promise is not a constructor` - because this
    emitter inlines handlers into TEMPLATE EXPRESSIONS and Vue's compiler
    prefixes any identifier outside GLOBALS_ALLOWED with `_ctx.`, a list carrying
    Date and JSON but not Promise or setTimeout. THAT IS REPAIRED - see the
    /todomvc-advanced comment - so this page is no longer the only async-free
    refuge. WHAT DOES NOT CHANGE IS THE POINT THIS ROUTE MAKES: S15 names NO
    global at all, so five static gates AND the browser agree, and it would have
    been correct even if the repair had never landed. That was checked in a
    browser, not assumed.
  -->
  <template v-else-if="habits">
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/habit-css/habits.css" />
    <HabitTracker v-bind:onTrace="noTrace" />
  </template>
  <!--
    THE SEVENTH APPLICATION - the TASK BOARD - and THE DRAG CARD. It is the THIRD
    scenario in this corpus that all six lanes emit and ship, after S13 and S15.

    THE AXIS THIS PAGE EXISTS TO MEASURE IS NOW ON IT. The board predicted the
    two-word drag events "cannot be produced" because the compiler does
    `name.slice(2).toLowerCase()`. Measured on a probe through all six real
    emitters, THEY ARE PRODUCED - and THIS LANE prints `@dragover`, `@dragstart`
    and `@dragend`, which ARE the real DOM event names, so THIS LANE FIRES THEM
    and it costs this lane no type error at all. What kept them off the page was
    the type baseline in the three JSX lanes, `pnpm check` 267 -> 280, read as a
    wall when it was a budget; `frameless-app-fidelity-v1` T004 stated the rise in
    advance and landed 251 -> 261, attributing every new line.
    DRAG A CARD ONTO ANOTHER COLUMN HERE AND IT STAYS. Five lanes do this; REACT
    DOES NOT, because react-dom binds by its own prop name and never sees the
    compiler's `onDragover`. The arrow buttons remain in ALL SIX lanes and are how
    react moves a card, and the page SAYS which is which in `.tb-note`.

    WHAT ONE MOVE MOVES - AND A DROP AND AN ARROW CLICK ARE THE SAME MOVE - all
    derived from ONE `columns` cell: the card leaves one column's list and appears
    in another's, both column counts, the source column's empty placeholder, the
    header's shipped counter and total, the summary sentence AND its emoji, and the
    moved card's own arrows. NINE observables. The drag adds ONE more state cell,
    `dragId`, and it is a `''`-sentinel string that no part of the template reads.

    TWO STYLESHEETS, ORDER LOAD-BEARING. `/shadcn-theme/tokens.css` is the vendored
    shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load FIRST.
    `/board-css/board.css` is THIS REPOSITORY'S OWN WORK - the Square UI reference is
    licence-restricted to REFERENCE-ONLY, so nothing was copied from it and its
    geometry was MEASURED in a browser instead. Both are linked HERE rather than
    globally because `board.css` restyles `body`.
  -->
  <template v-else-if="board">
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/board-css/board.css" />
    <TaskBoard v-bind:onTrace="noTrace" />
  </template>
  <!--
    THE EIGHTH APPLICATION - CONTACTS - and THE FORMS CARD. It is the FOURTH scenario
    in this corpus that all six lanes emit and ship, after S13, S15 and S16, and
    UNLIKE S16 THE AXIS IT MEASURES IS ACTUALLY ON THE PAGE: THIRTEEN control kinds -
    text, search, email, tel, url, number, date, time, range, select, radio, checkbox
    and textarea - every one bound and every one observable in the live preview card.

    THE BOARD'S PREMISE IS PARTLY REFUTED AND THE REFUTATION IS ALREADY IN THIS DEMO.
    It said only `checkbox` and `textarea` were proven and that `select`, `radio` and
    the multi-field form shape were unmeasured in all six lanes. The /s7 route IS that
    shape, emits in all six lanes, and `pnpm e2e` drives it in a real browser.

    MEASURED ON A PROBE THROUGH ALL SIX REAL EMITTERS: every one of the sixteen
    `type=` values emits everywhere; no emitter reads the VALUE of a `type` attribute
    at all. What costs something is the attribute BESIDE the type, and it costs the
    three JSX lanes rather than this one: `required`, `multiple`, `disabled`,
    `readonly`, `autofocus`, `spellcheck` and a static `checked` each add an
    `error TS` line there. `min`, `max` and `step` are free, which is why the number,
    date, time and range fields here carry real bounds.

    THIS PAGE MOVES worked example 12a IN src/gate/index.ts MORE THAN ANY SCENARIO
    SINCE S7 - eighteen new instances and a THIRD tag, `<select>`, which no scenario
    in this corpus had ever bound `value` on. That census is re-argued rather than
    renumbered, and it now also carries its first NEGATIVE CONTROL: five
    `<option value={row.id}>` hosts bind a value with no on-directive and are
    correctly outside the domain.

    TWO REFERENCE DEFECTS, MEASURED LIVE AND NOT COPIED: with its New Contact dialog
    open the reference holds SEVEN inputs, TWO selects and ZERO textareas - its Notes
    field is a single-line input - and `document.querySelectorAll('h1,h2,h3,h4')`
    returns ZERO on the whole document.

    TWO STYLESHEETS, ORDER LOAD-BEARING. `/shadcn-theme/tokens.css` is the vendored
    shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load FIRST.
    `/contact-css/contacts.css` is THIS REPOSITORY'S OWN WORK - the Square UI
    reference is licence-restricted to REFERENCE-ONLY, so nothing was copied and its
    geometry was MEASURED in a browser instead, dialog included. Both are linked HERE
    rather than globally because `contacts.css` restyles `body`.
  -->
  <template v-else-if="contacts">
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/contact-css/contacts.css" />
    <Contacts v-bind:onTrace="noTrace" />
  </template>
  <template v-else-if="hn">
    <link rel="stylesheet" href="/hn-css/hn.css" />
    <HnFront v-bind:onTrace="hnTrace" />
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
