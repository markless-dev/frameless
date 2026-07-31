import { Component } from '@angular/core';

import { TaskBoard } from '../emitted/TaskBoard';
import { noTrace } from './scenario-props';

/**
 * The /board route, and the FIFTH of five wrapper components in this lane.
 *
 * It exists for the reason `./todomvc-page.ts`, `./hn-page.ts` and
 * `./habits-page.ts` record: to link stylesheets on this route and no other.
 * Putting the `<link>`s in `src/index.html` or in angular.json's `styles` array
 * would make them GLOBAL, and `board.css` restyles `body`, `:root`, `#root` and
 * `#app`, so it would change the geometry of the nine s1-s9 scenarios that
 * `pnpm e2e` compares byte for byte across six lanes. All five other lanes put
 * the links in their route wiring for the same reason, so the six pages stay
 * like for like.
 *
 * THIS IS THE THIRD CORPUS APPLICATION THIS LANE SHIPS ALONGSIDE THE OTHER FIVE,
 * after S13 and S15, and it survives for the same reason S15 does: THE FIXTURE
 * NAMES NO GLOBAL. That is not luck. The natural spelling of "move one column to
 * the right" is `columns.indexOf(...)` clamped with `Math.min`, and `Math` is a
 * global this emitter cannot resolve in a transplanted body - so each column
 * CARRIES its own `prevId`/`nextId` in the seed instead and the whole ordering
 * of the board is data rather than arithmetic. See the fixture's constraint
 * (10). There is no component reference either, so the `imports` inventory
 * rejection that leaves S14 ungated in this lane is not reachable.
 *
 * THE AXIS THIS PAGE EXISTS TO MEASURE IS NOT ON IT, AND THAT IS THE
 * MEASUREMENT. The board predicted the two-word drag events "cannot be produced"
 * because the compiler does `name.slice(2).toLowerCase()`. Measured on a probe
 * through this very emitter, THEY ARE PRODUCED - `(dragover)`, `(dragstart)`,
 * `(dragend)`, `(pointerdown)`, each bound to a generated `onH1Dragover($event)`
 * member - and those ARE the real DOM event names, so THIS LANE WOULD HAVE FIRED
 * THEM and it costs this lane no type error at all. What kept them off the page
 * is the type baseline in the three JSX lanes: one drop zone and one draggable
 * card take `pnpm check` from 267 to 280, which this board's oracle forbids.
 * Cards move with the `◀`/`▶` ARROWS instead - a DIFFERENT INTERACTION - and the
 * page SAYS SO in `.tb-note` rather than passing it off as the axis.
 *
 * WHAT ONE ARROW CLICK MOVES, all derived from ONE `columns` cell: the card
 * leaves one column's `<ul>` and appears in another's - a real subtree move
 * across two repeat instances - plus both column counts, the source column's
 * empty placeholder, the header's shipped counter and total, the summary
 * sentence AND its emoji, and the moved card's own arrows, whose `hidden` is
 * decided by the column it now sits in. NINE observables, every one of them a
 * `computed` getter or a class/`hidden` binding, and none of them written by the
 * handler.
 *
 * NOTHING HERE IS EMITTED OUTPUT and nothing here is app code: this component
 * renders the emitted `<frameless-task-board>` and two `<link>`s.
 *
 * `board.css` IS THIS REPOSITORY'S OWN WORK - the Square UI reference is
 * licence-restricted to REFERENCE-ONLY, so nothing was copied from it and its
 * geometry was MEASURED in a browser instead. It is copied into
 * `public/board-css/` by `pnpm copy-board-css` and picked up by the `public`
 * asset glob in angular.json. `/shadcn-theme/tokens.css` is the vendored
 * shadcn/ui default theme (MIT, (c) 2023 shadcn) and MUST LOAD FIRST, because
 * every colour in `board.css` is a `var()` from it.
 *
 * Like /todomvc, /hn and /habits this route is deliberately NOT part of the
 * 6 x 9 three-way contract - `scripts/e2e.mjs` pins `threeWayScenarios` to the
 * literal ['s1'..'s9'] - so it is browsable only. It carries no seed: IR-8 has
 * no lowering for an array type, so the four columns are seeded INSIDE the
 * emitted component and all six lanes start from byte-identical data.
 */
@Component({
  selector: 'app-board-page',
  imports: [TaskBoard],
  template: `
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/board-css/board.css" />
    <frameless-task-board [onTrace]="trace" />
  `,
})
export class BoardPage {
  readonly trace = noTrace;
}
