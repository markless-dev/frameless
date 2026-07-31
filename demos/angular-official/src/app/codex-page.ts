import { Component } from '@angular/core';

import { CodexClone } from '../emitted/CodexClone';
import { noTrace } from './scenario-props';

/**
 * The /codex route, and THE FIRST PAGE THIS LANE HAS EVER SERVED FOR S12.
 *
 * S12 is the corpus's STREAMING application, and it was absent here for exactly
 * the same reason S11 was - not because it streams. A streamed answer is three
 * unrolled chunks separated by an artificial delay, the only delay this authoring
 * surface can express is `new Promise` + `setTimeout` inside the handler
 * (`computed(async ...)` is closed in all six lanes), and this emitter could not
 * NAME either global in a transplanted body. Every SYNCHRONOUS axis of the app -
 * thread navigation, both tab pairs, the composer draft - was always inside this
 * lane's envelope; only the delay was unreachable.
 *
 * `frameless-app-fidelity-v1` T003 ruled the two-name allowlist and T007 landed
 * it. See `./todomvc-advanced-page.ts` for the full record, and
 * `TRANSPLANTED_GLOBALS` in packages/frameworks/angular/src/emitter/index.ts for
 * the names that are still refused and why.
 *
 * NOTHING HERE IS EMITTED OUTPUT, and nothing here is app code: this component
 * renders the emitted `<frameless-codex-clone>` and two `<link>` elements,
 * exactly as `./todomvc-page.ts` and `./hn-page.ts` do and for the reason
 * recorded there.
 *
 * TWO SHEETS, AND THE ORDER IS LOAD-BEARING. `/shadcn-theme/tokens.css` carries
 * the shadcn/ui default theme (MIT, (c) 2023 shadcn) and must load FIRST;
 * `/shadcn-theme/codex.css` is this repo's own component sheet, written against
 * those token names. Both are written into `public/shadcn-theme/` by
 * `pnpm copy-shadcn-theme`, so this lane serves them at the same two URLs the
 * other five do.
 *
 * Like /todomvc, /todomvc-advanced and /hn it is deliberately OUT of the 6 x 9
 * three-way contract, which `scripts/e2e.mjs` pins to the literal ['s1'..'s9'],
 * so this route is browsable only. It carries no seed: IR-8 has no lowering for
 * an array type, so the threads and messages are seeded INSIDE the emitted
 * component and all six lanes start from byte-identical data.
 */
@Component({
  selector: 'app-codex-page',
  imports: [CodexClone],
  template: `
    <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
    <link rel="stylesheet" href="/shadcn-theme/codex.css" />
    <frameless-codex-clone [onTrace]="trace" />
  `,
})
export class CodexPage {
  readonly trace = noTrace;
}
