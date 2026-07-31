import { $, component$ } from "@qwik.dev/core";
import { CodexClone } from "../../emitted/CodexClone.jsx";

// THE THIRD APPLICATION - the CODEX CLONE - and this is the lane the streaming
// axis was most likely to lose. It did not lose it.
//
// The T002 ruling records that qwik cannot consume a callback prop's return value
// in ANY statement form: `lowerStatement` accepts a callback-bearing statement on
// exactly one path, an `ExpressionStatement` whose expression IS the
// `CallExpression`, so both `const x = await load()` and `x = await load()` throw.
// That is why S12's delay is a promise the handler MAKES rather than one a callback
// prop hands back, and why the awaited value is never consumed anywhere. `onTrace$`
// is still called LAST in every handler, because this emitter also refuses
// "synchronous actions after an awaited callback" - and S12's send handler suspends
// THREE TIMES before reaching that call, which is the deepest this constraint has
// been exercised in the corpus.
//
// TWO LANES USED NOT TO HAVE THIS PAGE IN THE SAME FORM, AND NOW ALL SIX DO.
// ANGULAR had no /codex route at all - that emitter refused S12 with the message
// read off this module, `Angular emitter cannot resolve the identifier "Promise" in
// a transplanted body`, because it could not NAME a global inside a transplanted
// body and an artificial delay is made of globals. `frameless-app-fidelity-v1` T007
// landed the two-name allowlist (`Promise` and `setTimeout`, nothing else) and the
// route exists. MEASURED AT HEAD BY T014: `ng serve` answers /codex with 5,356
// bytes of SSR body carrying `<app-root>`, "composer" five times and "thread"
// twelve times, against a bogus path that answers 404 with no app-root at all.
// VUE served its route while its stream threw in the browser (`_ctx.Promise is not
// a constructor`) with every synchronous axis working; THE SAME T007 REPAIRED THAT
// TOO, with bound `<script setup>` shim consts rather than any change to upstream's
// GLOBALS_ALLOWED, and the streamed answer was then driven and observed GROWING
// across three distinct readings. Both were lane limits inside each framework's own
// design envelope and NEITHER WAS EVER FILED UPSTREAM.
//
// NO KEYBOARD INTERACTION EXISTS ANYWHERE IN THIS APP, and none is faked. Two-word
// DOM events are unspellable in every lane (DEFECTS.md 15) - `onKeyDown` prints
// `onKeydown` and never fires - so there is no Enter-to-send, no Escape and no Tab
// pane navigation. The composer ships the SEND BUTTON, which is a plain click.
//
// Like /todomvc and /todomvc-advanced it is deliberately NOT part of the 6 x 9
// three-way contract - `scripts/e2e.mjs` pins `threeWayScenarios` to the literal
// ['s1'..'s9'] - so this page is browsable only. It takes no seed prop: IR-8 has no
// lowering for an array type, so threads and messages are seeded inside the emitted
// component and every shipped lane starts from byte-identical data.
//
// IT LINKS TWO STYLESHEETS, from a different family than the TodoMVC routes.
// `/shadcn-theme/tokens.css` is the shadcn/ui default theme (MIT, (c) 2023 shadcn),
// DERIVED at copy time from the verbatim upstream block because that block is
// Tailwind source rather than a browser stylesheet; `/shadcn-theme/codex.css` is
// this repo's own component sheet, hand-written against those token names. The
// tokens must load first. Both are written into `public/shadcn-theme/` by
// `pnpm copy-shadcn-theme`, and every lane serves them at these same two URLs.
// They are linked HERE rather than in src/root.tsx's <head> for the reason the
// TodoMVC routes record: a global link would move the geometry of the nine s1-s9
// scenarios that `pnpm e2e` compares across six lanes.
export default component$(() => (
  <>
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/shadcn-theme/codex.css" />
    <CodexClone onTrace$={$(() => {})} />
  </>
));
