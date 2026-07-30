import { Routes } from '@angular/router';

import { AttrBoard } from '../emitted/AttrBoard';
import { AsyncGate } from './async-gate';
import { BranchBoard } from '../emitted/BranchBoard';
import { EventForm } from '../emitted/EventForm';
import { FormBoard } from '../emitted/FormBoard';
import { KeyedTodo } from '../emitted/KeyedTodo';
import { NestedBoard } from '../emitted/NestedBoard';
import { RenderOnce } from '../emitted/RenderOnce';
import { TodoMvc } from '../emitted/TodoMvc';
import { WhitespaceBoard } from '../emitted/WhitespaceBoard';
import { noTrace, s2Seed, s4Seed, s5Seed, s6Label, s6Seed, s7Seed, s9Seed } from './scenario-props';

/**
 * DELTA from the `ng new --ssr` scaffold's `app.routes.ts`, which ships
 * `export const routes: Routes = []` and nothing else. One shared IR, six
 * emitters: the five components below are frameless-emitted and copied in by
 * `pnpm copy-emitted`.
 *
 * The props travel as static route `data`, bound to the components' `@Input()`s
 * by `withComponentInputBinding()` in `app.config.ts`. That is Angular's own
 * sanctioned way to hand a routed component its inputs, and it is what keeps
 * this lane free of three wrapper components that exist only to spell
 * `[label]="'kit'"`. The values themselves are shared with the other five lanes
 * through `./scenario-props`.
 *
 * The emitted components are standalone (the Angular 19+ default), so they are
 * routable directly with no NgModule and no `imports` array.
 */
export const routes: Routes = [
  {
    path: '',
    component: RenderOnce,
    data: { label: 'kit', multiplier: 2, visible: true, onTrace: noTrace },
  },
  {
    path: 's2',
    component: KeyedTodo,
    data: { seed: s2Seed, onTrace: noTrace },
  },
  {
    path: 's3',
    component: EventForm,
    data: { initial: 'hello', onTrace: noTrace },
  },
  {
    path: 's4',
    component: NestedBoard,
    data: { seed: s4Seed, onTrace: noTrace },
  },
  {
    path: 's5',
    component: BranchBoard,
    data: { seed: s5Seed, onTrace: noTrace },
  },
  {
    path: 's6',
    component: WhitespaceBoard,
    data: { seed: s6Seed, label: s6Label, onTrace: noTrace },
  },
  {
    path: 's7',
    component: FormBoard,
    data: { seed: s7Seed, onTrace: noTrace },
  },
  // S8 is the one route with a WRAPPER component. Its `ready` prop is a promise
  // the scenario decides when to resolve, so it changes after the route
  // resolved, and route `data` is static by construction. See `./async-gate`.
  {
    path: 's8',
    component: AsyncGate,
  },
  {
    path: 's9',
    component: AttrBoard,
    data: { seed: s9Seed, onTrace: noTrace },
  },
  // THE FIRST APPLICATION, and the only path here that is not an ordinal. It is
  // deliberately NOT part of the 6 x 9 three-way contract - `scripts/e2e.mjs`
  // pins `threeWayScenarios` to the literal ['s1'..'s9'] - so this route is
  // browsable only, which is the sequencing the goal asked for.
  //
  // It is also the ONLY route whose `data` carries no seed. IR-8 has no lowering
  // for an array type in any lane, so the list is seeded INSIDE the emitted
  // component and all six lanes start from byte-identical data with no host
  // wiring to keep in step. See packages/compiler/test/fixtures/s10-todomvc.tsrx.
  {
    path: 'todomvc',
    component: TodoMvc,
    data: { onTrace: noTrace },
  },
];
