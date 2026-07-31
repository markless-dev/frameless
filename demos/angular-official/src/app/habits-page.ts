import { Component } from '@angular/core';

import { HabitTracker } from '../emitted/HabitTracker';
import { noTrace } from './scenario-props';

/**
 * The /habits route, and the FOURTH of four wrapper components in this lane.
 *
 * It exists for the reason `./todomvc-page.ts` and `./hn-page.ts` record: to link
 * stylesheets on this route and no other. Putting the `<link>`s in
 * `src/index.html` or in angular.json's `styles` array would make them GLOBAL,
 * and `habits.css` restyles `body`, `:root`, `#root` and `#app`, so it would
 * change the geometry of the nine s1-s9 scenarios that `pnpm e2e` compares byte
 * for byte across six lanes. All five other lanes put the links in their route
 * wiring for the same reason, so the six pages stay like for like.
 *
 * THIS IS THE FOURTH APPLICATION ROUTE THIS LANE HAS, AND S15 IS THE SECOND
 * CORPUS APPLICATION IT SHIPS ALONGSIDE THE OTHER FIVE LANES. Its three absences
 * have three different causes and none of them is reachable from this module:
 *   S11 and S12 are refused AT EMIT on the global-identifier ban - "Angular
 *     emitter cannot resolve the identifier \"Promise\" in a transplanted body" -
 *     because their artificial delays are `new Promise` + `setTimeout`.
 *   S14 EMITS CORRECTLY and this lane's own dossier gate rejects the result: a
 *     same-module component reference needs `imports: [HnItem]` on the decorator
 *     and `imports` is not in BASELINE_FORM_INVENTORY.
 * S15 NAMES NO GLOBAL AND REFERENCES NO COMPONENT. It is a single component whose
 * entire mechanism is synchronous derived state, so there is nothing for the ban
 * to catch and no `imports` for the inventory to reject. That is a constraint of
 * the fixture rather than luck - see its constraint (10).
 *
 * THE DATE IS THE WHOLE SIX-LANE CLAIM, AND IT IS THIS LANE THAT PUTS IT AT RISK.
 * The live reference renders a REAL date. `Date` is a global, so a computed
 * "JULY 30, 2026" would lose THIS LANE for a reason with nothing to do with the
 * fan-out axis the scenario exists to measure. It is a literal string in the
 * seeded data instead, exactly as S13's relative ages are.
 *
 * WHAT ONE CLICK MOVES: the toggle's fill, the row title's strikethrough, the
 * SIDEBAR row's strikethrough, the header counter, the sidebar badge, the
 * progress bar's width class, the encouragement sentence AND its emoji, and
 * today's dot in that row's nested day strip - EIGHT observables, every one of
 * them a `computed` getter or a class/hidden binding off ONE `habits` cell, and
 * none of them written by the handler.
 *
 * NOTHING HERE IS EMITTED OUTPUT and nothing here is app code: this component
 * renders the emitted `<frameless-habit-tracker>` and two `<link>`s.
 *
 * `habits.css` IS THIS REPOSITORY'S OWN WORK - the Square UI reference is
 * licence-restricted to REFERENCE-ONLY, so nothing was copied from it and its
 * geometry was MEASURED in a browser instead. It is copied into
 * `public/habit-css/` by `pnpm copy-habit-css` and picked up by the `public`
 * asset glob in angular.json. `/shadcn-theme/tokens.css` is the vendored
 * shadcn/ui default theme (MIT, (c) 2023 shadcn) and MUST LOAD FIRST, because
 * every colour in `habits.css` is a `var()` from it.
 *
 * Like /todomvc and /hn this route is deliberately NOT part of the 6 x 9
 * three-way contract - `scripts/e2e.mjs` pins `threeWayScenarios` to the literal
 * ['s1'..'s9'] - so it is browsable only. It carries no seed: IR-8 has no
 * lowering for an array type, so the six habits are seeded INSIDE the emitted
 * component and all six lanes start from byte-identical data.
 */
@Component({
  selector: 'app-habits-page',
  imports: [HabitTracker],
  template: `
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/habit-css/habits.css" />
    <frameless-habit-tracker [onTrace]="trace" />
  `,
})
export class HabitsPage {
  readonly trace = noTrace;
}
