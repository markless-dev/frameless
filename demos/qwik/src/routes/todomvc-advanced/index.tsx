import { $, component$ } from "@qwik.dev/core";
import { TodoMvcAdvanced } from "../../emitted/TodoMvcAdvanced.jsx";

// THE SECOND APPLICATION, and the first route in this demo whose lane count is
// FOUR rather than six. The angular emitter REFUSES S11 outright - `Angular
// emitter cannot resolve the identifier "Promise" in a transplanted body: it is
// neither a body-local binding, a function parameter, a @for variable, nor a
// declared component member` - because TodoMVC Advanced creates its own
// artificial delay with `new Promise` + `setTimeout`, and that lane cannot NAME
// a global inside a transplanted body. So demos/angular-official has no
// counterpart to this page, and that is a RECORDED REFUSAL rather than an
// omission. See packages/frameworks/angular/test/unbuilt-scenarios.ts.
//
// AND THE SIXTH LANE IS LOST DIFFERENTLY, WHICH IS WHY THE COUNT IS FOUR AND NOT
// FIVE. VUE emits this scenario, passes its own gate and its typecheck, and then
// THROWS IN THE BROWSER: `_ctx.Promise is not a constructor`. That emitter inlines
// handlers into TEMPLATE EXPRESSIONS, and Vue's template compiler prefixes any
// identifier outside GLOBALS_ALLOWED with `_ctx.` - a list that carries Date and
// JSON and does NOT carry Promise or setTimeout (measured at @vue/shared@3.5.40).
// So demos/vue-official DOES serve this route, with add/destroy/filter/local
// search working and the two ASYNC axes throwing. Both losses are lane limits
// inside each framework's own design envelope, not defects to file upstream.
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
