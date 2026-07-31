import { Component } from '@angular/core';

import { HnFront } from '../emitted/HnFront';
import { noTrace } from './scenario-props';

/**
 * The /hn route, and the THIRD of three wrapper components in this lane.
 *
 * It exists for the reason `./todomvc-page.ts` records: to link a stylesheet on
 * this route and no other. Putting the `<link>` in `src/index.html` or in
 * angular.json's `styles` array would make it GLOBAL, and `hn.css` restyles
 * `body`, so it would change the geometry of the nine s1-s9 scenarios that
 * `pnpm e2e` compares byte for byte across six lanes. All five other lanes put
 * the link in their route wiring for the same reason, so the six pages stay like
 * for like.
 *
 * THIS IS THE THIRD APPLICATION ROUTE THIS LANE HAS, AND THE FIRST SINCE S10.
 * S11 (TodoMVC Advanced) and S12 (the Codex clone) have no counterpart here at
 * all: the Angular emitter REFUSES both on its global-identifier ban - "Angular
 * emitter cannot resolve the identifier \"Promise\" in a transplanted body" -
 * because their artificial delays are `new Promise` + `setTimeout` and this lane
 * cannot NAME a global inside a transplanted body. See
 * `packages/frameworks/angular/test/unbuilt-scenarios.ts`, which drives the real
 * `emit()` and asserts the recorded message.
 *
 * S13 CLEARS THAT BAN BY CONSTRUCTION RATHER THAN BY LUCK. Every relative age on
 * the page ("3 hours ago") is a LITERAL STRING in the seeded data, so nothing in
 * the module names `Date` - and it could not have been rescued by passing the
 * ages as props either, because they are PER ROW and IR-8 has no lowering for an
 * array type. See the fixture's constraint (9).
 *
 * IT CANNOT LOAD ON APPEAR AND NOTHING HERE PRETENDS OTHERWISE. Fetch-on-render
 * is unreachable in every lane - no lifecycle hook in the authoring surface, and
 * `computed(async ...)` closed upstream of every emitter - so the twelve stories
 * are seeded inside the emitted component exactly as TodoMVC's are. This route
 * carries no seed for the same reason /todomvc carries none.
 *
 * NOTHING HERE IS EMITTED OUTPUT and nothing here is app code: this component
 * renders the emitted `<frameless-hn-front>` and one `<link>`.
 *
 * `hn.css` IS THIS REPOSITORY'S OWN WORK - nothing was copied from
 * news.ycombinator.com. It is copied into `public/hn-css/` by `pnpm copy-hn-css`
 * and picked up by the `public` asset glob in angular.json, so this lane serves
 * it at the same URL as the other five. See demos/shared/copy-hn-css.mjs.
 */
@Component({
  selector: 'app-hn-page',
  imports: [HnFront],
  template: `
    <link rel="stylesheet" href="/hn-css/hn.css" />
    <frameless-hn-front [onTrace]="trace" />
  `,
})
export class HnPage {
  readonly trace = noTrace;
}
