import { ApplicationRef, Component, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';

/** The attribute the shared contract waits for before it clicks. */
const ACTIVATION_MARKER = 'data-frameless-activated';

/**
 * What the DOM looked like at the instant the marker was set. Read back by
 * `scenarios.box.ts`; see the class comment for why it is not decoration.
 */
const ACTIVATION_WITNESS = 'data-frameless-activated-with';

/**
 * DELTA from the `ng new --ssr` scaffold's `app.ts`, which renders a fixed
 * welcome page and holds a `title` signal. The template is now
 * `<router-outlet />` and the class sets the activation marker.
 *
 * ## Which post-activation signal, and why — MEASURED, not reasoned
 *
 * Angular 22 scaffolds are zoneless, so `afterNextRender` and
 * `ApplicationRef.isStable` are genuinely different events and the choice
 * between them cannot be argued from documentation. Both were instrumented in
 * this component at once, each stamping the time it fired and whether the routed
 * scenario existed in the DOM yet, and the lane was run:
 *
 *   page                          afterNextRender          isStable
 *   / (hydrating)                 t=51 scenario present    t=62 scenario present
 *   / with ng-state deleted       t=55 scenario ABSENT     t=62 scenario present
 *
 * The second row is the answer. When Angular cannot hydrate and has to render on
 * the client, the ROOT component's `afterNextRender` runs after the first render
 * pass — which is the pass that renders `<router-outlet>` and nothing inside it,
 * because the router's initial navigation has not resolved yet. `isStable` is
 * driven by `PendingTasks`, which the router's navigation registers, so it
 * cannot go true until the routed component has rendered. A marker on
 * `afterNextRender` would therefore be a claim about interactivity that is not
 * yet true, on exactly the page where it matters.
 *
 * Three alternatives that would each be wrong, for the record:
 *
 * - a template attribute binding would be server-rendered, and the contract's
 *   `forbidInServedPayload` would correctly fail the served payload for carrying
 *   a string only activation can produce;
 * - `src/dev-sink.ts` runs at module scope, before bootstrap even starts;
 * - a statement after `bootstrapApplication(...)` resolves is the shape
 *   frameless-svelte-v1 T002 ruled out, and here it is also strictly earlier
 *   than the router.
 *
 * ## Why the second attribute exists
 *
 * "Measured once, on one machine" is not a property a lane can rely on for the
 * rest of its life. So the ordering is not merely chosen, it is ASSERTED: the
 * marker records whether the routed scenario was in the DOM at the moment it was
 * written, and `scenarios.box.ts` requires `scenario-present` on every page it
 * visits. If a future Angular moves `isStable` earlier — or if someone swaps the
 * signal back — the lane goes red naming the ordering, instead of going green on
 * a marker that arrived too soon.
 *
 * RAISING A TIMEOUT IS NOT AN AVAILABLE REPAIR HERE and is forbidden on this
 * board. There is no timeout in this file to raise: the marker is set by an
 * Angular signal, and if that signal is wrong the fix is a stronger signal.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const applicationRef = inject(ApplicationRef);
    const subscription = applicationRef.isStable.subscribe((stable) => {
      if (!stable) return;
      const scenario = document.querySelector('[data-scenario]');
      // The witness is written FIRST, so anything that can see the marker can
      // also see what the marker is claiming.
      document.documentElement.setAttribute(
        ACTIVATION_WITNESS,
        scenario ? 'scenario-present' : 'scenario-absent',
      );
      document.documentElement.setAttribute(ACTIVATION_MARKER, 'angular');
      subscription.unsubscribe();
    });
  }
}
