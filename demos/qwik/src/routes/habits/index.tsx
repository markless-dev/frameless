import { $, component$ } from "@qwik.dev/core";
import { HabitTracker } from "../../emitted/HabitTracker.jsx";

// THE SIXTH APPLICATION - the HABIT TRACKER - and THE SIX-LANE FAN-OUT PAGE. It
// is the SECOND scenario in this corpus that all six lanes emit and ship, after
// S13, and the FIRST that was designed to be so rather than turning out that
// way: the whole app is SYNCHRONOUS DERIVED STATE, so there is no `Promise` or
// `setTimeout` for the angular lane's global-identifier ban to catch, no async
// door for the vue lane's GLOBALS_ALLOWED gap to open, and NO COMPONENT
// REFERENCE for either of the two emitter defects T003 isolated to reach.
//
// THAT SECOND ABSENCE IS THIS LANE'S IN PARTICULAR. S14 could not ship a trace
// channel here at all: a recursive component must forward every required prop to
// itself, and this emitter cannot forward a FUNCTION prop across a component
// boundary in any spelling - it declares and reads `onTrace$` and prints
// `onTrace` at the call site. S15 is a SINGLE component, so `onTrace$` is
// declared and read in one module and never crosses a boundary, and the prop is
// back. See packages/compiler/test/fixtures/s14-hn-item.tsrx constraint (18).
//
// Its date - "JULY 30, 2026" over "Thursday" - is a LITERAL STRING in the seeded
// data, because the angular emitter cannot NAME `Date` and a clock would have
// cost this app the very lane count it exists to measure. See
// packages/compiler/test/fixtures/s15-habit-tracker.tsrx constraint (10).
//
// WHAT ONE CLICK ON A HABIT TOGGLE MOVES, all of it derived from ONE `habits`
// cell and none of it written by the handler: the toggle's own fill, the row
// title's strikethrough, THE SIDEBAR ROW'S strikethrough (a second repeat in a
// different subtree - which is what makes this fan-out rather than a row
// re-render), the header counter, the sidebar badge, the progress bar's width
// class, the encouragement sentence AND its emoji, and today's dot inside that
// row's nested day strip. EIGHT observables.
//
// WHAT IS INERT AND NOT FAKED: `Statistics`, `New habit`, the sidebar toggle and
// the theme toggle. `.tsrx` has no routing construct at all. WHAT IS ABSENT: the
// reference's 30-day heat-map and sparkline - roughly two hundred decorative
// cells per habit that would triple the template while measuring nothing the
// eight observables do not already measure.
//
// TWO STYLESHEETS, AND THE ORDER IS LOAD-BEARING. `/shadcn-theme/tokens.css` is
// the vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load
// FIRST, because every colour in the second file is a `var()` from it.
// `/habit-css/habits.css` is THIS REPOSITORY'S OWN WORK - the Square UI
// reference is licence-restricted to REFERENCE-ONLY, so nothing was copied from
// it and its geometry was MEASURED in a browser instead. Both are written into
// `public/` by `pnpm copy-shadcn-theme` and `pnpm copy-habit-css`, and linked
// HERE rather than in src/root.tsx's <head> because `habits.css` restyles
// `body`, so a global link would move the geometry of the nine s1-s9 scenarios
// `pnpm e2e` compares across six lanes.
//
// Like S10-S14 this page is deliberately OUT of the 6 x 9 three-way contract -
// `scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'] - so it
// is browsable only. QWIK CITY CANONICALISES TO A TRAILING SLASH: `/habits`
// answers 301 with `location: /habits/`.
export default component$(() => (
  <>
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/habit-css/habits.css" />
    <HabitTracker onTrace$={$(() => {})} />
  </>
));
