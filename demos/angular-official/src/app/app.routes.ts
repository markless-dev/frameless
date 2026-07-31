import { Routes } from '@angular/router';

import { AttrBoard } from '../emitted/AttrBoard';
import { AsyncGate } from './async-gate';
import { BranchBoard } from '../emitted/BranchBoard';
import { EventForm } from '../emitted/EventForm';
import { BoardPage } from './board-page';
import { CodexPage } from './codex-page';
import { ContactsPage } from './contacts-page';
import { HabitsPage } from './habits-page';
import { HnPage } from './hn-page';
import { HnItemPage } from './hn-item-page';
import { FormBoard } from '../emitted/FormBoard';
import { KeyedTodo } from '../emitted/KeyedTodo';
import { NestedBoard } from '../emitted/NestedBoard';
import { RenderOnce } from '../emitted/RenderOnce';
import { TodomvcAdvancedPage } from './todomvc-advanced-page';
import { TodomvcPage } from './todomvc-page';
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
  // It is also the ONLY route that carries no seed. IR-8 has no lowering for an
  // array type in any lane, so the list is seeded INSIDE the emitted component and
  // all six lanes start from byte-identical data with no host wiring to keep in
  // step. See packages/compiler/test/fixtures/s10-todomvc.tsrx.
  //
  // AND IT IS THE SECOND OF TWO ROUTES HERE THAT GO THROUGH A WRAPPER. It mounted
  // the emitted `TodoMvc` directly until the stylesheet landed; a `<link>` has to
  // be rendered by SOMETHING, and putting it in src/index.html or angular.json's
  // `styles` array would apply todomvc-app-css to all nine three-way scenarios.
  // `./todomvc-page` renders the emitted component and the two links and nothing
  // else, which is the same shape the five other lanes' route wirings take.
  {
    path: 'todomvc',
    component: TodomvcPage,
  },
  // THE SECOND AND THIRD APPLICATIONS - TodoMVC ADVANCED and the CODEX CLONE -
  // AND THE TWO ROUTES THIS LANE WAITED LONGEST FOR. They are the only two
  // scenarios this lane ever refused: the emitter could not NAME `Promise` or
  // `setTimeout` inside a transplanted body, and the artificial delay both apps
  // use is made of exactly those two. `frameless-app-fidelity-v1` T003 ruled a
  // TWO-NAME allowlist and T007 landed it, so /todomvc-advanced and /codex are
  // the FIFTH AND SIXTH LANES for S11 and S12 - the corpus now has no scenario
  // this lane omits.
  //
  // The ban was NEVER about async, and the correction is worth keeping next to
  // the routes it unblocked: it was reproduced on a fully synchronous control
  // module. `Date`, `JSON`, `Math`, `console`, `fetch`, `localStorage` and
  // `document` are STILL refused, each with a recorded reason - `Date` on
  // determinism, the rest on having zero instances in the corpus.
  //
  // Both go through WRAPPERS, like /todomvc and for the same reason: their
  // stylesheets restyle `body`, so a global link would move the geometry of the
  // nine three-way scenarios. /todomvc-advanced links THREE sheets and /codex
  // TWO, cascade order load-bearing in both. See `./todomvc-advanced-page` and
  // `./codex-page`. Like /todomvc they are OUT of the 6 x 9 three-way contract,
  // which `scripts/e2e.mjs` pins to the literal ['s1'..'s9'], and they carry no
  // seed: IR-8 has no lowering for an array type, so the data is seeded INSIDE
  // the emitted components and all six lanes start from byte-identical state.
  {
    path: 'todomvc-advanced',
    component: TodomvcAdvancedPage,
  },
  {
    path: 'codex',
    component: CodexPage,
  },
  // THE FOURTH APPLICATION - the HACKER NEWS FRONT PAGE - and THE FIRST
  // APPLICATION ROUTE THIS LANE GAINED AFTER /todomvc. S11 and S12 were absent
  // from this file for as long as the emitter REFUSED them on its
  // global-identifier ban - they are the two routes directly above now - while
  // S13 named no global at all, because every relative age is a literal string
  // in the seeded data. So this was the route that put this lane back at parity
  // with the other five, and S13 is the first corpus application that all SIX
  // lanes serve.
  //
  // It goes through a WRAPPER, like /todomvc and for the same reason: a `<link>`
  // has to be rendered by something, and putting it in src/index.html or
  // angular.json's `styles` array would apply hn.css to all nine three-way
  // scenarios. See `./hn-page`.
  //
  // Like /todomvc it is deliberately NOT part of the 6 x 9 three-way contract -
  // `scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'] - so
  // this route is browsable only. It carries no seed: IR-8 has no lowering for
  // an array type, so the stories are seeded INSIDE the emitted component and
  // all six lanes start from byte-identical data.
  {
    path: 'hn',
    component: HnPage,
  },
  // THE FIFTH APPLICATION - the HACKER NEWS ITEM PAGE - and THE RECURSION
  // ROUTE. It is the FOURTH of the six lanes to serve this page, and the LAST to
  // arrive, on an absence that was never an emitter refusal.
  //
  // The emitted `HnItem` NAMES ITSELF - `<frameless-hn-item>` inside its own
  // template - so the thread is whatever the seeded `parentId` chain describes
  // and no depth is fixed anywhere. svelte and vue have no counterpart here at
  // all: a `.svelte` file and a `.vue` SFC each declare exactly one component,
  // so a same-module self-reference has nowhere to land, and both REFUSE it
  // outright. THIS lane always EMITTED it; its own dossier gate rejected the
  // result over the decorator's `imports: [HnItem]`, which was not in
  // BASELINE_FORM_INVENTORY. frameless-app-axes-v1 T009 ruled ADMIT at floor
  // 14.0 and the derived ANGULAR_BASELINE_FLOOR did not move - 19.0 before, 19.0
  // after.
  //
  // AND ANGULAR IGNORES THAT ENTRY AT THE PIN: 0 AOT diagnostics with it and 0
  // without, `dependencies: [HnItem]` in both arms, because the compiler seeds a
  // component's own scope and skips a self-entry. The verdict on this route is
  // therefore the RENDERED DOM, not any compile. See `./hn-item-page`.
  //
  // It goes through a WRAPPER, like /todomvc, /hn, /habits, /board and /contacts
  // and for the same reason: `hn.css` restyles `body`, so a global link would
  // move the geometry of the nine three-way scenarios. Like them it is
  // deliberately NOT part of the 6 x 9 contract - `scripts/e2e.mjs` pins
  // `threeWayScenarios` to the literal ['s1'..'s9'] - so this route is browsable
  // only. It carries no seed: the comment tree is seeded INSIDE the emitted
  // component, so all four serving lanes start from byte-identical data.
  {
    path: 'hn-item',
    component: HnItemPage,
  },
  // THE SIXTH APPLICATION - the HABIT TRACKER - and THE SECOND CORPUS
  // APPLICATION THIS LANE SHIPS ALONGSIDE THE OTHER FIVE. It was built to clear
  // the two absences that used to define this file: S11 and S12 were refused on
  // the global-identifier ban, and S14 was emitted but rejected by the lane's own
  // gate over `imports`. S15 names no global and references no component, so
  // neither absence could reach it: it is a single component whose entire
  // mechanism is synchronous derived state, and its date is a LITERAL STRING in
  // the seeded data rather than anything computed from `Date`. See its fixture's
  // constraint (10) - that is the constraint the whole six-lane claim rests on,
  // and it rests on THIS LANE.
  //
  // BOTH OF THOSE ABSENCES ARE NOW CLOSED - `imports` by frameless-app-axes-v1
  // T009/T014, and the globals ban by frameless-app-fidelity-v1 T003/T007 - so
  // this comment records why S15 was safe rather than what is still missing.
  // `Date` IS STILL REFUSED, which is why the literal date stands.
  //
  // It goes through a WRAPPER, like /todomvc and /hn and for the same reason: a
  // `<link>` has to be rendered by something, and putting it in src/index.html or
  // angular.json's `styles` array would apply habits.css - which restyles `body`,
  // `:root`, `#root` and `#app` - to all nine three-way scenarios. It links TWO
  // sheets where /hn links one, tokens first. See `./habits-page`.
  //
  // Like /todomvc and /hn it is deliberately NOT part of the 6 x 9 three-way
  // contract - `scripts/e2e.mjs` pins `threeWayScenarios` to the literal
  // ['s1'..'s9'] - so this route is browsable only. It carries no seed: IR-8 has
  // no lowering for an array type, so the six habits are seeded INSIDE the
  // emitted component and all six lanes start from byte-identical data.
  {
    path: 'habits',
    component: HabitsPage,
  },
  // THE SEVENTH APPLICATION - the TASK BOARD - and THE DRAG CARD. It is the THIRD
  // scenario this lane ships alongside the other five, after S13 and S15, and it
  // survives here for the same reason S15 does: THE FIXTURE NAMES NO GLOBAL. The
  // natural spelling of "move one column right" is `columns.indexOf(...)` clamped
  // with `Math.min`, and `Math` is a global this emitter cannot resolve in a
  // transplanted body, so each column carries its own `prevId`/`nextId` in the
  // seed and the board's ordering is DATA rather than arithmetic. See the
  // fixture's constraint (10).
  //
  // THE AXIS IT MEASURES IS ON THE PAGE, AND THIS COMMENT USED TO SAY IT WAS NOT.
  // This emitter PRINTS the two-word drag events - `(dragover)`, `(dragstart)`,
  // `(dragend)`, `(pointerdown)` - and those are the real DOM event names, so
  // this lane fires them at no type cost. What kept them out was the three JSX
  // lanes' type baseline, an earlier `pnpm check` 267 -> 280 read as a wall when
  // it was a budget. DRIVEN AT HEAD BY THIS COMMENT'S OWN CARD with a real native
  // mouse: card `t1` dragged from `backlog` onto `review` MOVED AND STAYED in
  // this lane, and `pnpm check` is 261 with the drag shipped. The `◀`/`▶` arrows
  // stay in all six lanes and are how REACT - the one inert lane - moves a card.
  // The page says which lane does which. See `./board-page`.
  //
  // It goes through a WRAPPER, like /todomvc, /hn and /habits and for the same
  // reason: a `<link>` has to be rendered by something, and putting it in
  // src/index.html or angular.json's `styles` array would apply board.css - which
  // restyles `body`, `:root`, `#root` and `#app` - to all nine three-way
  // scenarios. It links TWO sheets, tokens first. See `./board-page`.
  //
  // Like the four routes above it is deliberately NOT part of the 6 x 9 three-way
  // contract, so this route is browsable only. It carries no seed: IR-8 has no
  // lowering for an array type, so the four columns are seeded INSIDE the emitted
  // component and all six lanes start from byte-identical data.
  {
    path: 'board',
    component: BoardPage,
  },
  // THE EIGHTH APPLICATION - CONTACTS - and THE FORMS CARD. It is the FOURTH
  // scenario this lane ships alongside the other five, after S13, S15 and S16,
  // and it survives here for the same reason S15 and S16 do: THE FIXTURE NAMES
  // NO GLOBAL. That mattered more on this card than on either of those, because
  // a `date` input's obvious default is today and `Date` is a global this
  // emitter cannot resolve in a transplanted body; `since` and `slot` are
  // literal seeded strings instead. See the fixture's constraint (10).
  //
  // IT ALSO ALMOST DIED ON SOMETHING THE OTHER FIVE LANES TOOK: this emitter
  // refuses a TEMPLATE LITERAL inside a template expression, because a backtick
  // or a ${ would terminate the TypeScript template literal the inline template
  // lives in. The six that the first spelling used are seeded row fields and
  // `computed` getters now. See `./contacts-page`.
  //
  // It goes through a WRAPPER, like /todomvc, /hn, /habits and /board and for
  // the same reason: `contacts.css` restyles `body`, `:root`, `#root` and
  // `#app`, so a global link would move the geometry of the nine three-way
  // scenarios. It links TWO sheets, tokens first.
  {
    path: 'contacts',
    component: ContactsPage,
  },
];
