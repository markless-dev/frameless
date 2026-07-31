import { $, component$ } from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";
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
// WHAT THIS PAGE CANNOT DO, AND WHAT IS NOT FAKED - REWRITTEN BY
// frameless-app-fidelity-v1 T006, BECAUSE THE OLD VERSION DREW A FALSE
// INFERENCE FROM A TRUE PREMISE. It said `past`, `comments`, `ask`, `show`,
// `jobs` and `submit` are inert BECAUSE `.tsrx` has no routing construct. The
// premise is true - packages/compiler/src/schema.ts declares no route node kind
// - but it never implied the conclusion: every stub in `HnFront` already emits
// `event.preventDefault()` and then `props.onTrace$('nav', { to: ... }, event)`,
// so the destination was NAMED, LOWERED AND TYPED all along. What was missing
// was the SINK. THIS ROUTE USED TO PASS `$(() => {})` and that empty body is
// where the links actually died.
//
// SO THE HANDLER BELOW DISPATCHES THROUGH THIS LANE'S REAL ROUTER. `useNavigate`
// is @qwik.dev/router's own client navigation - the same one a `<Link>` uses -
// which makes qwik the one lane of the six that reaches /hn-item WITHOUT a
// document reload. The logo and the wordmark reach /hn; a story's comments link
// reaches /hn-item, which THIS LANE SHIPS and svelte and vue do not.
//
// WHAT IS STILL INERT, AND IT IS SEVENTEEN OF THIRTY-ONE STUBS RATHER THAN SIX:
// `new`, `past`, the MASTHEAD `comments` (which is /newcomments, not a story's
// thread), `ask`, `show`, `jobs`, `submit`, `login`, `More` and the eight footer
// links. Each is A SEPARATE APPLICATION this corpus does not contain, so no
// routing construct in any authoring surface would reach them, and the page
// LABELS them in `.hn-note` rather than pointing them somewhere false. `open`
// is left alone on purpose too: it belongs to a story TITLE carrying a REAL
// `href`, held on the page by the fixture's own `preventDefault`.
// The footer search FILTERS IN PLACE rather than handing the query to Algolia.
// What else works is upvote (which moves the score, hides the arrow and reveals
// `unvote`), unvote, hide, and the search filter.
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
/**
 * The route a trace from `HnFront` should reach, or `null` if none exists.
 *
 * PURE, AND EXPORTED SO THE `null` ARM IS READABLE RATHER THAN IMPLIED. Two
 * names map onto the two routes this corpus actually contains; everything else
 * returns `null`, because there is nothing honest to map it to.
 */
export function hnDestination(
  name: string,
  detail: Record<string, unknown>,
): "/hn" | "/hn-item" | null {
  if (name === "nav" && detail["to"] === "home") return "/hn";
  if (name === "comments") return "/hn-item";
  return null;
}

export default component$(() => {
  const navigate = useNavigate();
  return (
    <>
      <link rel="stylesheet" href="/hn-css/hn.css" />
      <HnFront
        onTrace$={$((name: string, detail: Record<string, unknown>) => {
          const to = hnDestination(name, detail);
          if (to) return navigate(to);
          return undefined;
        })}
      />
    </>
  );
});
