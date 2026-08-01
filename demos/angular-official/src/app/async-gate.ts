import { Component } from '@angular/core';

import { AsyncBoard } from '../emitted/AsyncBoard';
import { armS8Gate, noTrace, s8Gate, s8ResolvedGate } from './scenario-props';

/**
 * The /s8 harness, and one of this lane's wrapper components - the only one that
 * exists for a PROP that changes rather than for a stylesheet `<link>`.
 *
 * THIS FILE IS THE ONE THE DENOMINATORS FORGOT, AND ITS OWN HEADER IS WHY. It
 * used to open "the ONE route in this lane that needs a wrapper component at
 * all" and to say route `data` "is what keeps this lane free of wrappers". Both
 * were true while /s8 was the only route here that needed one, and neither
 * survived the first stylesheet - `./todomvc-page.ts`, `./hn-page.ts`,
 * `./hn-item-page.ts`, `./habits-page.ts`, `./board-page.ts`,
 * `./contacts-page.ts`, `./todomvc-advanced-page.ts` and `./codex-page.ts` are
 * wrapper components too, and so is this one. Every stale denominator in this
 * lane counted `*-page.ts` files and dropped the wrapper that started the
 * pattern. The count now lives in ONE place, `./habits-page.ts`, and ruling 11
 * of `scripts/check-citations.mjs` recompiles it from this directory at check
 * time.
 *
 * Where a scenario's props are static, route `data` and
 * `withComponentInputBinding()` deliver them and no wrapper is needed. S8's
 * cannot be static: `ready` is a promise the SCENARIO decides when to resolve,
 * so it has to change after the route resolved, and route `data` is static by
 * construction.
 *
 * Nothing here is emitted output. See `assertS8` in
 * demos/react-official/three-way-contract.ts for why the gate is held open
 * rather than timed, and for the Qwik measurement that decided the protocol.
 */
@Component({
  selector: 'app-async-gate',
  imports: [AsyncBoard],
  template: `
    <button type="button" data-harness="arm" (click)="arm()">arm</button>
    <button type="button" data-harness="release" (click)="release()">release</button>
    <p data-harness="gate">{{ ready === resolvedGate ? 'open' : 'held' }}</p>
    <frameless-async-board [ready]="ready" [onTrace]="trace" />
  `,
})
export class AsyncGate {
  readonly resolvedGate = s8ResolvedGate;
  ready: Promise<string> = s8ResolvedGate;
  readonly trace = noTrace;

  arm(): void {
    this.ready = armS8Gate();
  }

  release(): void {
    s8Gate.release();
  }
}
