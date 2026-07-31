import { $, component$ } from "@qwik.dev/core";
import { HnFront } from "../../emitted/HnFront.jsx";

// THE FOURTH APPLICATION - the HACKER NEWS FRONT PAGE - and the FIRST in this
// corpus that all SIX lanes emit. S11 and S12 lose angular to its
// global-identifier ban; S13 names no global anywhere, because every relative
// age ("3 hours ago") is a literal string in the seeded data rather than
// something computed from `Date`. That is a constraint of the fixture rather
// than luck - see packages/compiler/test/fixtures/s13-hn-front.tsrx (9).
//
// THE AXIS THIS PAGE MEASURES IS "DATA WITHOUT A DOOR", AND THE DOOR IS SHUT.
// Fetch-on-render is unreachable in every lane: there is no lifecycle hook in
// the authoring surface and `computed(async ...)` is closed by a pincer upstream
// of every emitter. So this page CANNOT load its stories on appear, and it does
// not pretend to - the twelve stories are seeded inside the emitted component
// exactly as S10, S11 and S12 seed theirs. There is no seed prop in any lane:
// IR-8 has no lowering for an array type.
//
// WHAT THIS PAGE CANNOT DO, AND WHAT IS NOT FAKED. `past`, `comments`, `ask`,
// `show`, `jobs` and `submit` are INERT: `.tsrx` has no routing construct at
// all, and three host routes would mean three instances with independent state,
// which is the opposite of the six-lane comparison this corpus exists to make.
// The footer search FILTERS IN PLACE rather than handing the query to Algolia,
// for the same reason. What DOES work is upvote (which moves the score, hides
// the arrow and reveals `unvote`), unvote, hide, and the search filter.
//
// ONE STYLESHEET, AND IT IS THIS REPOSITORY'S OWN WORK. Nothing was copied from
// news.ycombinator.com - not a byte of `news.css`. `demos/shared/hn-css/hn.css`
// reproduces the MEASURED geometry (the #ff6600 masthead, the #f6f6ef page, the
// Verdana 10/8/7pt scale, rank / arrow / title / domain over the subtext line)
// against the class names the six emitters print. It is written into
// `public/hn-css/` by `pnpm copy-hn-css`, every lane serves it at the same URL,
// and it is linked HERE rather than in src/root.tsx's <head> for the reason the
// TodoMVC and codex routes record: it restyles `body`, so a global link would
// move the geometry of the nine s1-s9 scenarios `pnpm e2e` compares across six
// lanes.
//
// Like /todomvc, /todomvc-advanced and /codex this page is deliberately NOT part
// of the 6 x 9 three-way contract - `scripts/e2e.mjs` pins `threeWayScenarios`
// to the literal ['s1'..'s9'] - so it is browsable only.
export default component$(() => (
  <>
    <link rel="stylesheet" href="/hn-css/hn.css" />
    <HnFront onTrace$={$(() => {})} />
  </>
));
