import { Routes } from '@angular/router';

import { BranchBoard } from '../emitted/BranchBoard';
import { EventForm } from '../emitted/EventForm';
import { FormBoard } from '../emitted/FormBoard';
import { KeyedTodo } from '../emitted/KeyedTodo';
import { NestedBoard } from '../emitted/NestedBoard';
import { RenderOnce } from '../emitted/RenderOnce';
import { WhitespaceBoard } from '../emitted/WhitespaceBoard';
import { noTrace, s2Seed, s4Seed, s5Seed, s6Label, s6Seed, s7Seed } from './scenario-props';

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
];
