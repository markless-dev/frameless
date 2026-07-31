import { Component } from '@angular/core';

import { TodoMvcAdvanced } from '../emitted/TodoMvcAdvanced';
import { noTrace } from './scenario-props';

/**
 * The /todomvc-advanced route, and THE FIRST PAGE THIS LANE HAS EVER SERVED FOR
 * S11.
 *
 * S11 was the corpus's ELEVENTH scenario and this lane's ONLY permanent absence.
 * The Angular emitter refused it, verbatim, for its whole life:
 *
 *   Angular emitter cannot resolve the identifier "Promise" in a transplanted
 *   body: it is neither a body-local binding, a function parameter, a @for
 *   variable, nor a declared component member (...). The emitter throws rather
 *   than guessing whether it is a global
 *
 * The refusal was never about async - it was reproduced on a fully synchronous
 * control module - and never about TodoMVC. It was that the artificial delay
 * standing in for a real remote is `new Promise` + `setTimeout`, and neither name
 * could be spelled inside a transplanted body.
 *
 * `frameless-app-fidelity-v1` T003 ruled a TWO-NAME ALLOWLIST - `Promise` and
 * `setTimeout`, nothing else - and T007 landed it, so this route exists.
 * `Date`, `JSON`, `Math`, `console`, `fetch`, `localStorage` and `document` are
 * still refused, each with a recorded reason; see `TRANSPLANTED_GLOBALS` in
 * packages/frameworks/angular/src/emitter/index.ts.
 *
 * NOTHING HERE IS EMITTED OUTPUT, and nothing here is app code: this component
 * renders the emitted `<frameless-todo-mvc-advanced>` and three `<link>`
 * elements, exactly as `./todomvc-page.ts` does and for the reason recorded
 * there - `todomvc-app-css` restyles `body` and every `button` in the document,
 * so a global link would move the geometry of the nine s1-s9 scenarios `pnpm e2e`
 * compares byte for byte across six lanes.
 *
 * THREE SHEETS, AND THE CASCADE ORDER IS LOAD-BEARING AT BOTH JOINTS.
 * `index.css` is todomvc-app-css@2.4.3 verbatim; `frameless-supplement.css` is
 * the repair layer the simple app needs and overrides it at equal specificity;
 * `frameless-advanced.css` carries the controls this app adds and MUST load
 * third. All three are copied into `public/todomvc-app-css/` by
 * `pnpm copy-todomvc-css`, so this lane serves them at the same three URLs the
 * other five do.
 *
 * Like /todomvc it is deliberately OUT of the 6 x 9 three-way contract, which
 * `scripts/e2e.mjs` pins to the literal ['s1'..'s9'], so this route is browsable
 * only. It carries no seed: IR-8 has no lowering for an array type, so the todos
 * are seeded INSIDE the emitted component and all six lanes now start from
 * byte-identical data.
 */
@Component({
  selector: 'app-todomvc-advanced-page',
  imports: [TodoMvcAdvanced],
  template: `
    <link rel="stylesheet" href="/todomvc-app-css/index.css" />
    <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
    <link rel="stylesheet" href="/todomvc-app-css/frameless-advanced.css" />
    <frameless-todo-mvc-advanced [onTrace]="trace" />
  `,
})
export class TodomvcAdvancedPage {
  readonly trace = noTrace;
}
