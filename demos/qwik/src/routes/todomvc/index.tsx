import { $, component$ } from "@qwik.dev/core";
import { TodoMvc } from "../../emitted/TodoMvc.jsx";

// THE FIRST APPLICATION, and the only route here that is not an ordinal. It is
// deliberately NOT part of the 6 x 9 three-way contract - `scripts/e2e.mjs`
// pins `threeWayScenarios` to the literal ['s1'..'s9'] - so this page is
// browsable only. It takes no seed prop at all: IR-8 has no lowering for an
// array type, so the list is seeded inside the emitted component and all six
// lanes therefore start from byte-identical data with no host wiring to keep in
// step. See packages/compiler/test/fixtures/s10-todomvc.tsrx.
//
// THE ONLY ROUTE THAT LINKS A STYLESHEET, and deliberately so. The pair is
// rendered HERE rather than in src/root.tsx's <head> because s1-s9 are the 6 x 9
// three-way contract: todomvc-app-css restyles `body` and every `button` in the
// document, so linking it globally would change the geometry of nine scenarios
// that exist to be compared across six lanes.
//
// `index.css` is todomvc-app-css@2.4.3 verbatim; the supplement overrides some of
// it at equal specificity and must load second. Both are copied into
// `public/todomvc-app-css/` by `pnpm copy-todomvc-css`, and all six lanes serve
// them at these same two URLs. See demos/shared/copy-todomvc-css.mjs.
export default component$(() => (
  <>
    <link rel="stylesheet" href="/todomvc-app-css/index.css" />
    <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
    <TodoMvc onTrace$={$(() => {})} />
  </>
));
