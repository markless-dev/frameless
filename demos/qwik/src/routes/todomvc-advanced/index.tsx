import { $, component$ } from "@qwik.dev/core";
import { TodoMvcAdvanced } from "../../emitted/TodoMvcAdvanced.jsx";

// THE SECOND APPLICATION. SIX LANES SERVE IT. This comment used to say the lane
// count here was FOUR rather than six, and both absences it named are closed.
//
// THE ANGULAR EMITTER USED TO REFUSE S11 OUTRIGHT - `Angular emitter cannot
// resolve the identifier "Promise" in a transplanted body: it is neither a
// body-local binding, a function parameter, a @for variable, nor a declared
// component member` - because TodoMVC Advanced creates its own artificial delay
// with `new Promise` + `setTimeout`, and that lane could not NAME a global inside
// a transplanted body. `frameless-app-fidelity-v1` T003 ruled a TWO-NAME
// ALLOWLIST - `Promise` and `setTimeout`, nothing else - and T007 landed it, so
// demos/angular-official HAS a counterpart to this page.
// THE CITATION THIS PARAGRAPH USED TO CARRY WAS DANGLING BY THE TIME YOU READ IT:
// it pointed at packages/frameworks/angular/test/unbuilt-scenarios.ts "as the
// record of the refusal", and `ANGULAR_UNBUILT_SCENARIOS` there is `[]`. That file
// is still worth reading - its header records the refusal as HISTORY and explains
// why an empty list is a hazard rather than a clean slate - but the LIVE record of
// which globals are admitted is `TRANSPLANTED_GLOBALS` in
// packages/frameworks/angular/src/emitter/index.ts. MEASURED AT HEAD BY T014:
// `ng serve` answers /todomvc-advanced with 5,049 bytes of SSR body carrying
// `<app-root>`, "What needs to be done", "todoapp" and a LINKED
// /todomvc-app-css/frameless-advanced.css, against a bogus path that answers 404
// with no app-root at all.
//
// AND THE SIXTH LANE WAS LOST DIFFERENTLY, WHICH IS WHY THE COUNT USED TO BE FOUR
// AND NOT FIVE. VUE emitted this scenario, passed its own gate and its typecheck,
// and then THREW IN THE BROWSER: `_ctx.Promise is not a constructor`. That emitter
// inlines handlers into TEMPLATE EXPRESSIONS, and Vue's template compiler prefixes
// any identifier outside GLOBALS_ALLOWED with `_ctx.` - a list that carries Date
// and JSON and does NOT carry Promise or setTimeout (measured at
// @vue/shared@3.5.40). THE SAME T007 REPAIRED IT, without touching that upstream
// list, by emitting a bound `<script setup>` shim const per allowlisted free
// identifier - see demos/vue-official/src/App.vue for that lane's own account. So
// demos/vue-official serves this route with EVERY axis running, the two ASYNC ones
// included. Both losses were lane limits inside each framework's own design
// envelope and NEITHER WAS EVER FILED UPSTREAM.
//
// THIS LANE IS THE ONE THE ASYNC AXIS WAS MOST LIKELY TO LOSE, and it did not.
// The T002 ruling records that qwik cannot consume a callback prop's return
// value in ANY statement form, so `const x = await load()` and `x = await
// load()` both throw; that is why S11's delay is a promise the handler MAKES
// rather than one a callback prop hands back. `onTrace$` is still called LAST in
// every handler, because this emitter also refuses "synchronous actions after an
// awaited callback".
//
// Like /todomvc it is deliberately NOT part of the 6 x 9 three-way contract -
// `scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'] - so
// this page is browsable only. It takes no seed prop: IR-8 has no lowering for
// an array type, so the list is seeded inside the emitted component.
//
// IT LINKS THREE STYLESHEETS WHERE /todomvc LINKS TWO, and the cascade order is
// load-bearing at both joints: `index.css` is todomvc-app-css@2.4.3 verbatim,
// `frameless-supplement.css` must load second, `frameless-advanced.css` third.
// All three are copied into `public/todomvc-app-css/` by `pnpm copy-todomvc-css`
// and every lane serves them at these same three URLs. They are linked HERE
// rather than in src/root.tsx's <head> because todomvc-app-css restyles `body`
// and every `button` in the document, which would move the geometry of the nine
// s1-s9 scenarios that pnpm e2e compares.
//
// THE PIXEL PASS IS T005'S CARD, NOT T003'S.
export default component$(() => (
  <>
    <link rel="stylesheet" href="/todomvc-app-css/index.css" />
    <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
    <link rel="stylesheet" href="/todomvc-app-css/frameless-advanced.css" />
    <TodoMvcAdvanced onTrace$={$(() => {})} />
  </>
));
