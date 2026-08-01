import { Component } from '@angular/core';

import { HabitTracker } from '../emitted/HabitTracker';
import { noTrace } from './scenario-props';

/**
 * The /habits route, and one of this lane's wrapper components.
 *
 * THIS LINE CARRIED A POSITION AND A DENOMINATOR, AND EVERY VERSION OF BOTH WAS
 * WRONG - which is why the position is not written here any more and the count is
 * no longer trusted to a human. It first read "the FOURTH of four", true only
 * while this lane was missing S11, S12 and S14, and it is missing none of them
 * now. It was then corrected to "the SIXTH of EIGHT", which CONTRADICTED
 * `./contacts-page.ts` in the same directory and was also wrong: there are NINE
 * wrapper components in this lane, because `./async-gate.ts` is one and this
 * lane's own route table is what says so.
 *
 * THE POSITION IS GONE BECAUSE NOTHING CAN RECOMPUTE IT. Those ordinals were
 * written in ARRIVAL order, which lives in git history rather than on disk, and
 * route order disagrees with all of them. The COUNT survives, in this one place,
 * because it is now RECOMPILED from the directory at check time - ruling 11 in
 * `scripts/check-citations.mjs` - so the day a tenth wrapper lands, this
 * paragraph goes red instead of going quietly stale.
 *
 * It exists for the reason `./todomvc-page.ts` and `./hn-page.ts` record: to link
 * stylesheets on this route and no other. Putting the `<link>`s in
 * `src/index.html` or in angular.json's `styles` array would make them GLOBAL,
 * and `habits.css` restyles `body`, `:root`, `#root` and `#app`, so it would
 * change the geometry of the nine s1-s9 scenarios that `pnpm e2e` compares byte
 * for byte across six lanes. All five other lanes put the links in their route
 * wiring for the same reason, so the six pages stay like for like.
 *
 * THIS IS ONE OF THIS LANE'S EIGHT APPLICATION ROUTES, AND THIS LANE HAS NO
 * ABSENCES LEFT. This paragraph used to say S15 was "the SECOND corpus application
 * it ships alongside the other five lanes" and then listed "its three absences" IN
 * THE PRESENT TENSE. All three are closed, each by a different card, and none of
 * them was ever reachable from this module:
 *   S11 and S12 WERE refused AT EMIT on the global-identifier ban - "Angular
 *     emitter cannot resolve the identifier \"Promise\" in a transplanted body" -
 *     because their artificial delays are `new Promise` + `setTimeout`.
 *     `frameless-app-fidelity-v1` T003 ruled a TWO-NAME allowlist (`Promise` and
 *     `setTimeout`, nothing else) and T007 landed it. `TRANSPLANTED_GLOBALS` in
 *     packages/frameworks/angular/src/emitter/index.ts is that set, and it is
 *     literally `new Set(['Promise', 'setTimeout'])`: the ban did not become an
 *     allowlist of the usual suspects, it acquired two exceptions. EVERY other
 *     free name - `Date`, `JSON`, `Math`, `console`, `fetch`, `localStorage`,
 *     `document` and anything not yet imagined - IS STILL A LOUD THROW. A third
 *     name is a new ruling.
 *   S14 EMITTED CORRECTLY and this lane's own dossier gate rejected the result: a
 *     same-module component reference needs `imports: [HnItem]` on the decorator
 *     and `imports` was not in BASELINE_FORM_INVENTORY. `frameless-app-axes-v1`
 *     T009 ruled ADMIT and T014 landed it; ANGULAR_BASELINE_FLOOR did not move.
 * MEASURED AT HEAD BY `frameless-app-fidelity-v1` T014, on a booted `ng serve`
 * rather than from this table: all EIGHT application routes - /todomvc,
 * /todomvc-advanced, /codex, /hn, /hn-item, /habits, /board, /contacts - answer
 * with `<app-root>` in EIGHT DISTINCT SSR bodies, against a bogus path that
 * answers 404 with no app-root at all. `ANGULAR_UNBUILT_SCENARIOS` in
 * packages/frameworks/angular/test/unbuilt-scenarios.ts is `[]` to match.
 * S15 NAMES NO GLOBAL AND REFERENCES NO COMPONENT. It is a single component whose
 * entire mechanism is synchronous derived state, so there was nothing for the ban
 * to catch and no `imports` for the inventory to reject. That is a constraint of
 * the fixture rather than luck - see its constraint (10) - and it is why S15 kept
 * six lanes BEFORE the two doors above were shut rather than because of it.
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
