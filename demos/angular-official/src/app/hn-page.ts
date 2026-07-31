import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { HnFront } from '../emitted/HnFront';
import { hnDestination } from './scenario-props';

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
 * THIS WAS THE THIRD APPLICATION ROUTE THIS LANE HAD, AND THE FIRST SINCE S10.
 * S11 (TodoMVC Advanced) and S12 (the Codex clone) had no counterpart here at
 * all: the Angular emitter REFUSED both on its global-identifier ban - "Angular
 * emitter cannot resolve the identifier \"Promise\" in a transplanted body" -
 * because their artificial delays are `new Promise` + `setTimeout` and this lane
 * could not NAME a global inside a transplanted body. `frameless-app-fidelity-v1`
 * T003 ruled a TWO-NAME allowlist - `Promise` and `setTimeout`, nothing else -
 * and T007 landed it, so both now serve at /todomvc-advanced and /codex and
 * `ANGULAR_UNBUILT_SCENARIOS` is empty.
 *
 * S13 CLEARED THAT BAN BY CONSTRUCTION RATHER THAN BY LUCK, AND STILL DOES ON
 * THE HALF THAT MATTERS. Every relative age on the page ("3 hours ago") is a
 * LITERAL STRING in the seeded data, so nothing in the module names `Date` - and
 * it could not have been rescued by passing the ages as props either, because
 * they are PER ROW and IR-8 has no lowering for an array type. See the fixture's
 * constraint (9). `Date` IS STILL REFUSED, on determinism rather than on
 * capability, so that constraint stands after the allowlist as it did before.
 *
 * IT CANNOT LOAD ON APPEAR AND NOTHING HERE PRETENDS OTHERWISE. Fetch-on-render
 * is unreachable in every lane - no lifecycle hook in the authoring surface, and
 * `computed(async ...)` closed upstream of every emitter - so the twelve stories
 * are seeded inside the emitted component exactly as TodoMVC's are. This route
 * carries no seed for the same reason /todomvc carries none.
 *
 * NOTHING HERE IS EMITTED OUTPUT and nothing here is app code: this component
 * renders the emitted `<frameless-hn-front>`, one `<link>`, and - since
 * frameless-app-fidelity-v1 T006 - the NAV SINK the page always needed.
 *
 * THE LINKS ON /hn WERE NEVER MISSING A DESTINATION AND THEY DIED HERE. Every
 * stub in the emitted `HnFront` already carries `event.preventDefault()` and
 * then `onTrace('nav', { to: 'home' }, event)`; the intent is named, lowered
 * and typed by the emitter. This component passed `noTrace`, whose body is
 * `{}`, so a correctly emitted navigation arrived at nothing. THAT IS SHARPEST
 * IN THIS LANE OF THE SIX: Angular is the one demo that already had a real
 * `provideRouter` and an `app.routes.ts` with `hn` and `hn-item` in it, so the
 * destination existed, the router existed, and nothing connected them.
 *
 * `router.navigateByUrl` IS THE APPLICATION'S OWN ROUTER, not a document
 * reload, so this lane reaches /hn-item without leaving the SPA. BOTH ARMS OF
 * `hnDestination` ARE LIVE HERE, which is true of only FOUR of the six lanes:
 * svelte and vue emit no `HnItem` at all and have no /hn-item to reach. Any
 * claim that "the comments link works" IS A FOUR-LANE CLAIM.
 *
 * AND THE HOME ARM IS OBSERVABLY INERT IN THIS LANE ALONE - MEASURED, NOT
 * INFERRED, AND NOT A DEFECT. /hn's logo and wordmark target /hn, which is the
 * route already showing, and the Angular Router treats a same-URL navigation as
 * a no-op (`onSameUrlNavigation` defaults to `'ignore'`). Driven in a browser
 * at HEAD: clicking the wordmark produces NO document reload and ZERO
 * history.pushState/replaceState calls here, while react, solid and vue reload
 * the document and qwik and svelte each record one history call. THE SINK IS
 * STILL PROVEN REACHED, BY DIFFERENCE: the comments arm of THIS VERY handler,
 * through THIS VERY router, moves /hn to /hn-item and renders fifteen threads.
 * Same handler, same router, different target - so what differs is the target,
 * not the wiring. Making it move would mean passing `onSameUrlNavigation:
 * 'reload'`, which would be inventing a behaviour the reference does not have:
 * the wordmark on news.ycombinator.com points at /news from /news too.
 *
 * THE OTHER SEVENTEEN STUBS STAY DEAD AND THE PAGE SAYS SO. `new`, `past`, the
 * masthead `comments` (/newcomments, not a story thread), `ask`, `show`,
 * `jobs`, `submit`, `login`, `More` and the eight footer links are EACH A
 * SEPARATE APPLICATION; they are LABELLED in `.hn-note`, not pointed anywhere.
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
  private readonly router = inject(Router);

  readonly trace = (name: string, detail: Record<string, unknown>): void => {
    const to = hnDestination(name, detail);
    if (to) void this.router.navigateByUrl(to);
  };
}
