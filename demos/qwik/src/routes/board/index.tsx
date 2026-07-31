import { $, component$ } from "@qwik.dev/core";
import { TaskBoard } from "../../emitted/TaskBoard.jsx";

// THE SEVENTH APPLICATION - the TASK BOARD - and THE DRAG CARD. It is the THIRD
// scenario in this corpus that all six lanes emit and ship, after S13 and S15.
//
// THE AXIS THIS PAGE EXISTS TO MEASURE IS NOT ON IT, AND THAT IS THE
// MEASUREMENT. The board predicted `onDragStart`/`onDragOver`/`onDrop` "cannot
// be produced" because the compiler does `name.slice(2).toLowerCase()`.
// Measured on a probe through all six real emitters: THEY ARE PRODUCED. This
// lane prints `onDragover$`, `onDragstart$`, `onDragend$` and `onPointerdown$`,
// with the `sync$` wrapper it already applies to any handler that calls
// `preventDefault()`, and all six typecheck clean.
//
// THIS LANE'S COST IS NOT AN EVENT AT ALL, WHICH IS THE FINDING. The one
// `error TS` line the probe added here came from `draggable="true"`: this corpus
// lowers a static attribute as a STRING and this lane's JSX types declare
// `draggable?: boolean`. That is T003's `rows="6"` finding in a NON-NUMERIC
// shape. Across the three JSX lanes the drag took `pnpm check` from 267 to 280,
// which this board's oracle forbids, so cards move with the `◀`/`▶` ARROWS
// instead - a DIFFERENT INTERACTION - and the page SAYS SO in `.tb-note` rather
// than passing it off as the axis. See
// packages/compiler/test/fixtures/s16-task-board.tsrx.
//
// WHAT ONE ARROW CLICK MOVES, all derived from ONE `columns` cell and none of it
// written twice by the handler: the card leaves one column's <ul> and appears in
// another's - a real SUBTREE MOVE across two repeat instances - plus both column
// counts, the source column's empty placeholder, the header's shipped counter
// and total, the summary sentence AND its emoji, and the moved card's own
// arrows, whose `hidden` is decided by the column it now sits in, so the control
// that was clicked can disappear under the pointer. NINE observables.
//
// S16 IS A SINGLE COMPONENT, so this lane keeps its `onTrace$`: a function prop
// never crosses a component boundary here and the un-forwardable-prop defect
// T003 isolated is not reachable. S14 remains the corpus's only fixture with no
// trace channel.
//
// WHAT IS INERT AND NOT FAKED: the three sidebar links, `Share`, `Filter`,
// `Sort`, `Request task`, the per-column `+` and `Add task`. `.tsrx` has no
// routing construct at all - and the reference's own `Filter` and `Add task` do
// nothing either, measured live.
//
// TWO STYLESHEETS, AND THE ORDER IS LOAD-BEARING. `/shadcn-theme/tokens.css` is
// the vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load
// FIRST, because every colour in the second file is a `var()` from it.
// `/board-css/board.css` is THIS REPOSITORY'S OWN WORK - the Square UI reference
// is licence-restricted to REFERENCE-ONLY, so nothing was copied from it and its
// geometry was MEASURED in a browser instead. Both are written into `public/` by
// `pnpm copy-shadcn-theme` and `pnpm copy-board-css`, and linked HERE rather
// than in src/root.tsx's <head> because `board.css` restyles `body`, so a global
// link would move the geometry of the nine s1-s9 scenarios `pnpm e2e` compares
// across six lanes.
//
// Like S10-S15 this page is deliberately OUT of the 6 x 9 three-way contract -
// `scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'] - so it
// is browsable only. QWIK CITY CANONICALISES TO A TRAILING SLASH: `/board`
// answers 301 with `location: /board/`.
export default component$(() => (
  <>
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/board-css/board.css" />
    <TaskBoard onTrace$={$(() => {})} />
  </>
));
