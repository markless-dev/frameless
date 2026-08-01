import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';

/**
 * DELTA from the `ng new --ssr` scaffold: `withComponentInputBinding()` is added
 * to `provideRouter(routes)`. Nothing else moves.
 *
 * That single feature is what lets `app.routes.ts` hand the emitted components
 * their props as route `data` instead of through wrapper components written only
 * to pass them on. It is the only provider this demo adds.
 *
 * That sentence used to say "instead of through three wrapper components", one of
 * the stale denominators `frameless-app-fidelity-v1` T017 and T018 closed. The
 * count is gone rather than corrected: the wrappers it counted are the ones this
 * provider means NOBODY WROTE, and an absent file cannot be recompiled. The count
 * of the wrappers that DO exist is stated once, in
 * `demos/angular-official/src/app/habits-page.ts`, and ruling 11 of
 * `scripts/check-citations.mjs` re-derives it on every run.
 *
 * `provideClientHydration()` is the scaffold's own, unchanged, and it is
 * deliberately NOT given `withIncrementalHydration()`: incremental hydration
 * makes an Angular app partly resumable, which fits neither arm of the shared
 * contract's `Activation` union and would make cross-lane equality untestable.
 * Ruled off by frameless-angular-v1 T002.
 *
 * `provideBrowserGlobalErrorListeners()` is the scaffold's own and is kept. It
 * is NOT a substitute for `src/dev-sink.ts`: it reports uncaught errors, and the
 * hydration diagnostic this lane has to watch (NG0505) is a `console.warn`.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()), provideClientHydration()
  ]
};
