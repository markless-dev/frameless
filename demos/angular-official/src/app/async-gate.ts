import { Component } from '@angular/core';

import { AsyncBoard } from '../emitted/AsyncBoard';
import { armS8Gate, noTrace, s8Gate, s8ResolvedGate } from './scenario-props';

/**
 * The /s8 harness, and the ONE route in this lane that needs a wrapper
 * component at all.
 *
 * Every other scenario hands its emitted component static props through route
 * `data` and `withComponentInputBinding()`, which is what keeps this lane free
 * of wrappers. S8 cannot: `ready` is a promise the SCENARIO decides when to
 * resolve, so it has to change after the route resolved, and route `data` is
 * static by construction.
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
