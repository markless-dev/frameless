import { Component } from '@angular/core';

import { TaskBoard } from '../emitted/TaskBoard';
import { noTrace } from './scenario-props';

/**
 * The /board route, and one of this lane's wrapper components.
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
 * THIS IS ONE OF THE SIX-LANE APPLICATIONS THIS LANE SHIPS ALONGSIDE THE OTHER
 * FIVE, and it survives for the same reason S15 does: THE FIXTURE
 * NAMES NO GLOBAL. That is not luck. The natural spelling of "move one column to
 * the right" is `columns.indexOf(...)` clamped with `Math.min`, and `Math` is a
 * global this emitter cannot resolve in a transplanted body - so each column
 * CARRIES its own `prevId`/`nextId` in the seed instead and the whole ordering
 * of the board is data rather than arithmetic. See the fixture's constraint
 * (10). There is no component reference either, so the `imports` inventory
 * rejection that leaves S14 ungated in this lane is not reachable.
 *
 * THE AXIS THIS PAGE EXISTS TO MEASURE IS ON IT, AND THIS COMMENT USED TO SAY IT
 * WAS NOT. The board predicted the two-word drag events "cannot be produced"
 * because the compiler does `name.slice(2).toLowerCase()`. Measured on a probe
 * through this very emitter, THEY ARE PRODUCED - `(dragover)`, `(dragstart)`,
 * `(dragend)`, `(pointerdown)`, each bound to a generated `onH1Dragover($event)`
 * member - and those ARE the real DOM event names, so THIS LANE FIRES THEM and it
 * costs this lane no type error at all.
 *
 * WHAT KEPT THEM OFF THE PAGE WAS THE TYPE BASELINE IN THE THREE JSX LANES, AND
 * IT WAS A BUDGET READ AS A WALL: an earlier probe spelled `draggable` as a
 * STATIC string and measured `pnpm check` 267 -> 280. The fixture BINDS it
 * instead, and the rise was stated in advance, spent and attributed.
 * RE-MEASURED AT HEAD BY THIS COMMENT'S OWN CARD, in a chromium driven with a
 * REAL NATIVE MOUSE (mouse down, twenty interpolated moves, mouse up; no
 * synthetic `DragEvent` anywhere): DRAGGING CARD `t1` FROM `backlog` ONTO
 * `review` MOVED IT AND IT STAYED, with `data-dragging="yes"` on `t1` during the
 * gesture and no console error. `[draggable="true"]` counts 9 here, the same 9 as
 * the other five lanes. `pnpm check` is 261 with the drag shipped.
 *
 * THE `◀`/`▶` ARROWS ARE NOT A SUBSTITUTE AND NOT A LEFTOVER. They move a card in
 * ALL SIX lanes and they are how REACT moves one - the one lane where the drag is
 * inert, because react-dom matches by prop name. `.tb-note` on the page names
 * which lane does which rather than passing the drag off as universal.
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
