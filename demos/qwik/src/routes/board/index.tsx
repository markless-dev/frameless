import { $, component$ } from "@qwik.dev/core";
import { TaskBoard } from "../../emitted/TaskBoard.jsx";

// THE SEVENTH APPLICATION - the TASK BOARD - and THE DRAG CARD. It is a SIX-LANE
// APPLICATION for the same reason S15 is: THE FIXTURE NAMES NO GLOBAL. The
// position this header used to state instead counted from S13, which was never
// first - the /hn header records why.
//
// THE AXIS THIS PAGE EXISTS TO MEASURE IS ON IT, AND THIS COMMENT USED TO SAY IT
// WAS NOT. The board predicted `onDragStart`/`onDragOver`/`onDrop` "cannot
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
// shape. AND IT IS THE ONE COST THIS PAGE AVOIDS RATHER THAN PAYS: across the
// three JSX lanes that probe took `pnpm check` from 267 to 280 and the board of
// the day read the rise as a wall, but the fixture BINDS `draggable` to an
// expression rather than spelling it as a static string, so this lane's single
// line never appears. RE-MEASURED AT HEAD BY THIS COMMENT'S OWN CARD: `pnpm
// check` is 261 WITH the drag shipped, and a chromium driven with a REAL NATIVE
// MOUSE (mouse down, twenty interpolated moves, mouse up; no synthetic
// `DragEvent` anywhere) dragged card `t1` from `backlog` onto `review` AND IT
// STAYED in this lane. `[draggable="true"]` counts 9 here, the same 9 as the
// other five.
//
// THE `◀`/`▶` ARROWS ARE NOT A SUBSTITUTE AND NOT A LEFTOVER: they move a card in
// ALL SIX lanes and they are how REACT moves one - the one lane where the drag is
// inert, because react-dom matches by prop name. `.tb-note` on the page names
// which lane does which. The fixture header records ONE MEASURED INTERMITTENCY IN
// THIS LANE AND ONLY THIS LANE - a first drop after a cancelled drag is lost -
// and it is left standing rather than smoothed over. See
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
