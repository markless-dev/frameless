import { Component } from '@angular/core';

import { TodoMvc } from '../emitted/TodoMvc';
import { noTrace } from './scenario-props';

/**
 * The /todomvc route, and one of this lane's wrapper components.
 *
 * It exists for exactly one reason: to link the TodoMVC stylesheet on this route
 * and no other. Every other route in `app.routes.ts` mounts its emitted component
 * directly, and until now /todomvc did too — `{ path: 'todomvc', component:
 * TodoMvc }` — which left nowhere to put a `<link>` short of `src/index.html` or
 * the `styles` array in angular.json, both of which are GLOBAL.
 *
 * Global is the thing to avoid. s1-s9 are the 6 x 9 three-way contract, and
 * todomvc-app-css restyles `body` and every `button` in the document, so a global
 * link would change the geometry of nine scenarios that exist to be compared
 * across six lanes. The same reasoning put the link in the route wiring rather
 * than the shell in all five other lanes, so the six pages stay like for like.
 *
 * NOTHING HERE IS EMITTED OUTPUT, and nothing here is app code: this component
 * renders the emitted `<frameless-todo-mvc>` and two `<link>` elements, exactly as
 * `demos/react-official/src/App.jsx` and the other four route wirings do. The
 * precedent for a wrapper in this lane is `./async-gate.ts`.
 *
 * `index.css` is todomvc-app-css@2.4.3 verbatim; `frameless-supplement.css`
 * overrides some of it at equal specificity and must load second. Both are copied
 * into `public/todomvc-app-css/` by `pnpm copy-todomvc-css` and picked up by the
 * `public` asset glob in angular.json, so this lane serves them at the same two
 * URLs as the other five. See demos/shared/copy-todomvc-css.mjs.
 */
@Component({
  selector: 'app-todomvc-page',
  imports: [TodoMvc],
  template: `
    <link rel="stylesheet" href="/todomvc-app-css/index.css" />
    <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
    <frameless-todo-mvc [onTrace]="trace" />
  `,
})
export class TodomvcPage {
  readonly trace = noTrace;
}
