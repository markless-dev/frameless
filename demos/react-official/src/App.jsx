// THE `.jsx` SPECIFIERS BELOW POINT AT `.tsx` FILES, DELIBERATELY.
// `src/emitted/` holds `.tsx` since the extension migration; `copy-emitted`
// writes it. The specifier stays `.jsx` because that is the portable form: a
// `.tsx` specifier is a hard TypeScript error (TS5097) without
// `allowImportingTsExtensions`, while `.jsx` resolves to the `.tsx` file under
// both TypeScript's and Vite's JS-to-TS extension substitution. It is also what
// the Frameless emitters write inside emitted output, so this file exercises the
// same resolution a real consumer does.
import { useState } from 'react'
import { AsyncBoard } from './emitted/AsyncBoard.jsx'
import { AttrBoard } from './emitted/AttrBoard.jsx'
import { BranchBoard } from './emitted/BranchBoard.jsx'
import { CodexClone } from './emitted/CodexClone.jsx'
import { EventForm } from './emitted/EventForm.jsx'
import { HnFront } from './emitted/HnFront.jsx'
import { HnItem } from './emitted/HnItem.jsx'
import { HabitTracker } from './emitted/HabitTracker.jsx'
import { Contacts } from './emitted/Contacts.jsx'
import { TaskBoard } from './emitted/TaskBoard.jsx'
import { FormBoard } from './emitted/FormBoard.jsx'
import { KeyedTodo } from './emitted/KeyedTodo.jsx'
import { NestedBoard } from './emitted/NestedBoard.jsx'
import { RenderOnce } from './emitted/RenderOnce.jsx'
import { TodoMvc } from './emitted/TodoMvc.jsx'
import { TodoMvcAdvanced } from './emitted/TodoMvcAdvanced.jsx'
import { WhitespaceBoard } from './emitted/WhitespaceBoard.jsx'

// One shared IR, three emitters. These props are the same ones demos/qwik passes
// in src/routes/**, so the three official demos are directly comparable.
const noTrace = () => {}

// ---------------------------------------------------------------------------
// THE /hn NAV SINK, and it is the WHOLE of what frameless-app-fidelity-v1 T006
// had to add in this lane.
//
// THE EMITTED PAGE WAS NEVER MISSING THE DESTINATION. Every stub link in
// `HnFront` already carries `event.preventDefault()` followed by
// `onTrace('nav', { to: 'home' }, event)` - the intent is NAMED, LOWERED AND
// TYPED by the emitter. What was missing was the SINK: this module passed
// `noTrace` on the /hn route, so a correctly emitted navigation intent arrived
// at a function whose body is `{}`. THE LINKS DIED HERE, not in the emitter and
// not in the authoring surface, which is why no compiler in six lanes could see
// it and why every check passed.
//
// `hnDestination` IS PURE AND IS THE PIECE WORTH READING. It maps trace names
// onto the two routes this corpus actually contains and returns `null` for
// everything else, WHICH IS THE POINT: seventeen of the thirty-one stubs are
// each a separate application, so there is nothing to map them to and the page
// says so in `.hn-note` instead. `open` is deliberately absent too - that is a
// story TITLE, whose `href={story.url}` is a real url held on the page by the
// fixture's own `preventDefault` (constraint 11), and navigating on it would
// break a working affordance rather than fix a broken one.
//
// A FULL DOCUMENT NAVIGATION IS THIS LANE'S ROUTER, not a shortcut around one.
// `scenarioFor(url)` above IS the routing here: this demo is the stock
// create-vite SSR scaffold, which threads `req.originalUrl` into `render(url)`
// and ships no client router at all. `window.location.assign` is therefore the
// same door the address bar uses, and the server re-renders the target route -
// which is also why the assertion that this works is a BODY HASH and not an
// HTTP status: this lane answers 200 for any path whatsoever.
// ---------------------------------------------------------------------------
/**
 * The route a trace from `HnFront` should reach, or `null` if none exists.
 *
 * @param {string} name
 * @param {Record<string, unknown>} detail
 * @returns {'/hn' | '/hn-item' | null}
 */
export function hnDestination(name, detail) {
	if (name === 'nav' && detail['to'] === 'home') return '/hn'
	if (name === 'comments') return '/hn-item'
	return null
}

const hnTrace = (name, detail) => {
	const to = hnDestination(name, detail)
	if (to) window.location.assign(to)
}
const s2Seed = [
  { id: 'a', title: 'one', done: false },
  { id: 'b', title: 'two', done: true },
]
// S4's nested seed. Group ids and row ids are drawn from DISJOINT alphabets on
// purpose: the emitted Angular call site passes both enclosing loop variables
// positionally, so a swapped argument list has to produce a visibly different
// selection string rather than one that could be read either way.
const s4Seed = [
  { id: 'g1', rows: [{ id: 'r1' }, { id: 'r2' }] },
  { id: 'g2', rows: [{ id: 'r3' }] },
]
// S5's branch seed. Three rows, because the scenario drops the first one while
// the subtree that renders them is torn down and then requires the rebuilt arm
// to hold exactly the remaining two — a count that is neither the original nor
// zero, so a rebuild from a stale snapshot and a rebuild from nothing are
// distinguishable from each other and from a correct one.
const s5Seed = [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }]
// S6's whitespace seed. TWO rows, each with two single-character values, because
// the scenario's observable is what sits BETWEEN them: `pairs` reads
// `{row.left}{joiner}{row.right}` per row, and one row could not distinguish "the
// separator changed" from "the clicked row was rebuilt".
//
// `s6Label` is the whole reason the scenario can measure interpolated whitespace
// at all. Its leading space, its interior DOUBLE space and its trailing space are
// significant and must survive verbatim in all six lanes; a template text node
// could not carry them, because the Angular emitter refuses template text whose
// own edges are whitespace and the Vue gate rejects the emitted result.
const s6Seed = [
  { id: 'w1', left: 'a', right: 'b' },
  { id: 'w2', left: 'c', right: 'd' },
]
const s6Label = ' wide  load '

// S7's form seed. TWO rows whose `on` flags DIFFER: `t1` starts unchecked and
// `t2` starts checked, so one keyed repeat carries a `checked` binding that is
// false and one that is true. One row, or two rows in the same state, could not
// distinguish "the checkbox reflects its own row" from "every checkbox reflects
// the same value".
const s7Seed = [
  { id: 't1', on: false },
  { id: 't2', on: true },
]

// S9's boolean-attribute seed. TWO rows, and BOTH start `off: false`, which is a
// measured constraint rather than a tidiness preference: S9's whole claim is
// that a boolean content attribute is ABSENT until state says otherwise, so a
// row seeded `true` would serve `disabled=""` before any click and could not
// distinguish "the lowering works" from "the attribute is always there". Two
// rows rather than one because the scenario seals only `f2` — exactly one button
// grows the attribute, which is what separates "the boolean reached its own row"
// from "every button in the repeat reflects the same value".
const s9Seed = [
  { id: 'f1', off: false },
  { id: 'f2', off: false },
]


// ---------------------------------------------------------------------------
// S8's ASYNC GATE. Harness, not emitted output, and deliberately outside the
// emitted component: the `ready` prop is what the emitted handlers `await`, and
// the scenario needs it PENDING at a moment the driver chooses.
//
// The initial gate is ALREADY RESOLVED and the pending one is created by a
// click. That order is a MEASURED constraint from the Qwik lane, and it is
// uniform here so that all six lanes run the identical sequence: Qwik's SSR
// serializer awaits every promise it reaches, so a gate that was pending when
// the server rendered would hang that lane's render outright. See
// `assertS8` in three-way-contract.ts.
// ---------------------------------------------------------------------------
const s8ResolvedGate = Promise.resolve('go')
/** The live resolver of the promise `arm` most recently created. */
const s8Gate = { release: () => {} }
const armS8Gate = () => new Promise((resolve) => { s8Gate.release = () => resolve('go') })

/**
 * The /s8 page: the two harness controls plus the emitted board.
 *
 * `useState` rather than a module-level mutable: the board reads `ready` off
 * the props of the render that created its handler, so the new promise has to
 * arrive through a re-render. Nothing here is emitted output.
 */
function AsyncGate() {
  const [ready, setReady] = useState(s8ResolvedGate)
  return (
    <>
      <button type="button" data-harness="arm" onClick={() => setReady(armS8Gate())}>
        arm
      </button>
      <button type="button" data-harness="release" onClick={() => s8Gate.release()}>
        release
      </button>
      <p data-harness="gate">{ready === s8ResolvedGate ? 'open' : 'held'}</p>
      <AsyncBoard ready={ready} onTrace={noTrace} />
    </>
  )
}

/**
 * Maps a request URL onto a scenario id. The stock create-vite SSR scaffold
 * already threads `req.originalUrl` into `render(url)`, so branching on it here
 * mirrors the Qwik demo's `/`, `/s2`, `/s3` routes without adding a router.
 *
 * @param {string} url
 * @returns {'s1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9' | 'todomvc' | 'todomvc-advanced' | 'codex' | 'hn' | 'hn-item' | 'habits' | 'board' | 'contacts'}
 */
export function scenarioFor(url) {
  const path = String(url ?? '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (path === 's2') return 's2'
  if (path === 's3') return 's3'
  if (path === 's4') return 's4'
  if (path === 's5') return 's5'
  if (path === 's6') return 's6'
  if (path === 's7') return 's7'
  if (path === 's8') return 's8'
  if (path === 's9') return 's9'
  // THE FIRST APPLICATION, and the only path here that is not an ordinal. It is
  // NOT part of the 6 x 9 three-way contract - `scripts/e2e.mjs` pins
  // `threeWayScenarios` to the literal ['s1'..'s9'] - so this route is browsable
  // only, which is exactly the sequencing the goal asked for.
  if (path === 'todomvc') return 'todomvc'
  // THE SECOND APPLICATION. SIX LANES - this used to read "five lanes, not six -
  // angular refuses S11". That refusal was real and IS CLOSED: T007 of
  // `frameless-app-fidelity-v1` landed a TWO-NAME allowlist (Promise,
  // setTimeout) and demos/angular-official now serves /todomvc-advanced.
  if (path === 'todomvc-advanced') return 'todomvc-advanced'
  // THE THIRD APPLICATION - the Codex clone. SIX lanes emit it and six run its
  // stream; this used to read "five lanes emit it, four run its stream; angular
  // has no route at all", and the same T007 closed both halves - angular's
  // /codex exists and vue's stream no longer throws. Browsable only, like the
  // two above.
  if (path === 'codex') return 'codex'
  // THE FOURTH APPLICATION - the HACKER NEWS FRONT PAGE - and one of the
  // SIX-LANE APPLICATIONS, the corpus rows every lane emits. This line used to
  // call it "the first one in this corpus that SIX lanes emit"; it never was -
  // S10 has carried no `unbuilt` entry in scripts/demo.mjs in any revision - and
  // the whole family of position claims counted from here. Browsable only,
  // like the three above: `scripts/e2e.mjs` pins `threeWayScenarios` to the
  // literal ['s1'..'s9'].
  if (path === 'hn') return 'hn'
  if (path === 'hn-item') return 'hn-item'
  // THE SIXTH APPLICATION - the HABIT TRACKER - and a SIX-LANE APPLICATION by
  // design rather than by luck: its whole mechanism is synchronous derived
  // state, so it names no global and references no component. Browsable only.
  if (path === 'habits') return 'habits'
  // THE SEVENTH APPLICATION - the TASK BOARD - and a SIX-LANE APPLICATION for
  // the same reason S15 is: THE FIXTURE NAMES NO GLOBAL. Browsable only.
  if (path === 'board') return 'board'
  // THE EIGHTH APPLICATION - CONTACTS - and a SIX-LANE APPLICATION for the same
  // reason S15 and S16 are: THE FIXTURE NAMES NO GLOBAL. Browsable only.
  if (path === 'contacts') return 'contacts'
  return 's1'
}

/**
 * @param {{ url?: string }} props
 */
export default function App({ url }) {
  switch (scenarioFor(url)) {
    case 's2':
      return <KeyedTodo seed={s2Seed} onTrace={noTrace} />
    case 's3':
      return <EventForm initial="hello" onTrace={noTrace} />
    case 's4':
      return <NestedBoard seed={s4Seed} onTrace={noTrace} />
    case 's5':
      return <BranchBoard seed={s5Seed} onTrace={noTrace} />
    case 's6':
      return <WhitespaceBoard seed={s6Seed} label={s6Label} onTrace={noTrace} />
    case 's7':
      return <FormBoard seed={s7Seed} onTrace={noTrace} />
    case 's8':
      return <AsyncGate />
    case 'todomvc':
      // THE ONLY ROUTE THAT LINKS A STYLESHEET, and deliberately so. The pair is
      // rendered HERE rather than in index.html because s1-s9 are the 6 x 9
      // three-way contract: todomvc-app-css restyles `body` and every `button` in
      // the document, so linking it globally would change the geometry of nine
      // scenarios that exist to be compared byte for byte across six lanes.
      //
      // Order matters. `index.css` is todomvc-app-css@2.4.3 verbatim and the
      // supplement overrides some of it at equal specificity, so the supplement
      // must come second. Both files are copied into `public/todomvc-app-css/` by
      // `pnpm copy-todomvc-css`; all six lanes serve them at these same two URLs.
      // See demos/shared/copy-todomvc-css.mjs.
      return (
        <>
          <link rel="stylesheet" href="/todomvc-app-css/index.css" />
          <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
          <TodoMvc onTrace={noTrace} />
        </>
      )
    case 'todomvc-advanced':
      // THE SECOND APPLICATION, and the route whose lane count moved the furthest.
      // IT IS SIX NOW. THIS COMMENT USED TO SAY FOUR, and both absences it named are
      // closed, each by a measurement rather than by an argument.
      //
      // ANGULAR USED TO REFUSE S11 at emit on its global-identifier ban ("Angular
      // emitter cannot resolve the identifier \"Promise\" in a transplanted body"), so
      // demos/angular-official had no counterpart to this page. T003 of
      // `frameless-app-fidelity-v1` ruled a TWO-NAME allowlist - Promise and
      // setTimeout, nothing else - and T007 landed it. packages/frameworks/angular/
      // generated/S11.ts exists and THE ANGULAR LANE SERVES /todomvc-advanced: measured
      // at HEAD by T014 on a booted `ng serve`, 5,049 bytes of SSR body carrying
      // `<app-root>`, "What needs to be done", "todoapp" and a LINKED
      // /todomvc-app-css/frameless-advanced.css, against a bogus path that answers 404
      // with no app-root at all. Date, JSON, Math, console, fetch, localStorage and
      // document are STILL refused, each with a recorded reason.
      //
      // AND THE SIXTH LANE WAS LOST DIFFERENTLY, WHICH IS WHY THE COUNT USED TO BE FOUR
      // AND NOT FIVE. VUE emitted this scenario, passed its own gate and its typecheck,
      // and then THREW IN THE BROWSER: `_ctx.Promise is not a constructor`. That emitter
      // inlines handlers into TEMPLATE EXPRESSIONS, and Vue's template compiler prefixes
      // any identifier outside GLOBALS_ALLOWED with `_ctx.` - a list that carries Date
      // and JSON and does NOT carry Promise or setTimeout (measured at
      // @vue/shared@3.5.40). THE SAME T007 REPAIRED IT, without touching that upstream
      // list, by emitting a bound `<script setup>` shim const per allowlisted free
      // identifier; the binding is load-bearing and an unbound shim merely traded the
      // throw for `Illegal invocation`. See demos/vue-official/src/App.vue, which
      // carries that lane's own account. Both losses were lane limits inside each
      // framework's own design envelope and NEITHER WAS EVER FILED UPSTREAM.
      // Like /todomvc it is deliberately OUT of the 6 x 9 three-way contract -
      // `scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'] - so this
      // page is browsable only. It takes no seed prop: IR-8 has no lowering for an array
      // type, so the list is seeded inside the emitted component.
      //
      // It links THREE stylesheets where /todomvc links two. `index.css` is
      // todomvc-app-css@2.4.3 verbatim, `frameless-supplement.css` is the repair layer
      // the simple app needs, and `frameless-advanced.css` carries the controls this app
      // adds. Cascade order is load-bearing at both joints and the advanced sheet MUST
      // load third. All three are copied into this lane's asset root by
      // `pnpm copy-todomvc-css`. THE PIXEL PASS IS T005'S CARD, NOT T003'S.
      return (
        <>
          <link rel="stylesheet" href="/todomvc-app-css/index.css" />
          <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
          <link rel="stylesheet" href="/todomvc-app-css/frameless-advanced.css" />
          <TodoMvcAdvanced onTrace={noTrace} />
        </>
      )
    case 'codex':
      // THE THIRD APPLICATION - the CODEX CLONE - and the route this board expected
      // to be REFUSED outright. It is not, and it is no longer even partial: SIX
      // lanes run it. This comment used to read "FOUR lanes run it, one emits and
      // misbehaves, one refuses at emit", and BOTH of those exceptions are closed.

      // ANGULAR SERVES /codex. It used to have no counterpart to this page: that
      // emitter refused S12 with the message read off THIS module - `Angular emitter
      // cannot resolve the identifier "Promise" in a transplanted body` - because a
      // streamed answer is three unrolled chunks separated by `new Promise` +
      // `setTimeout`, and that lane could not NAME a global inside a transplanted
      // body. `frameless-app-fidelity-v1` T007 landed the two-name allowlist and the
      // route exists. MEASURED AT HEAD BY T014 on a booted `ng serve`: /codex answers
      // with 5,356 bytes of SSR body carrying `<app-root>`, "composer" five times and
      // "thread" twelve times, against a bogus path that answers 404 with no app-root.

      // VUE SERVES THIS ROUTE AND ITS STREAM USED TO THROW - `_ctx.Promise is not a
      // constructor` - exactly as on /todomvc-advanced and for the same measured
      // reason: the vue emitter inlines handlers into TEMPLATE EXPRESSIONS and Vue's
      // template compiler prefixes any identifier outside GLOBALS_ALLOWED with `_ctx.`
      // - a list carrying Date and JSON but not Promise or setTimeout. Every
      // SYNCHRONOUS axis of the app - thread navigation, both tab pairs, the composer
      // draft - worked throughout, and THE STREAM NOW RUNS TOO: the same T007 replaced
      // the `_ctx.` path with bound `<script setup>` shim consts and drove the answer
      // GROWING across three distinct readings in a real browser. Zero `_ctx` remains
      // in any emitted vue SFC, which is now a permanent assertion in that lane's
      // tests rather than a claim in a comment.

      // WHAT THIS APP CANNOT DO, AND IT IS NOT FAKED ANYWHERE: there is no
      // Enter-to-send and no keyboard interaction of any kind. Two-word DOM events
      // are unspellable in every lane (DEFECTS.md 15) - `onKeyDown` prints
      // `onKeydown` and never fires - so the composer ships the SEND BUTTON, which
      // is the reference's other affordance and a plain click.

      // Like /todomvc and /todomvc-advanced it is deliberately OUT of the 6 x 9
      // three-way contract: `scripts/e2e.mjs` pins `threeWayScenarios` to the
      // literal ['s1'..'s9']. It takes no seed prop - IR-8 has no lowering for an
      // array type - so threads and messages are seeded inside the emitted
      // component and every shipped lane starts from byte-identical data.

      // IT LINKS TWO STYLESHEETS, BOTH FROM A DIFFERENT FAMILY THAN THE TODOMVC
      // ROUTES. `/shadcn-theme/tokens.css` is the shadcn/ui default theme (MIT,
      // (c) 2023 shadcn), DERIVED at copy time from the verbatim upstream block
      // because that block is Tailwind source and not a browser stylesheet;
      // `/shadcn-theme/codex.css` is this repo's own component sheet, hand-written
      // against those token names. Order is load-bearing: the tokens must load
      // first. Both are written into this lane's asset root by
      // `pnpm copy-shadcn-theme`. See demos/shared/copy-shadcn-theme.mjs.
      return (
        <>
          <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
          <link rel="stylesheet" href="/shadcn-theme/codex.css" />
          <CodexClone onTrace={noTrace} />
        </>
      )
    case 'hn':
      // THE FOURTH APPLICATION - the HACKER NEWS FRONT PAGE - and one of the
      // SIX-LANE APPLICATIONS. This block used to call it "the FIRST in this
      // corpus that all SIX lanes emit" and it never was: S10 has carried no
      // `unbuilt` entry in scripts/demo.mjs in any revision, and every stale
      // position in this family counted from this sentence.
      // S11 and S12 lose angular to its
      // global-identifier ban; S13 names no global at all, because every age is
      // a literal string in the seeded data rather than something computed from
      // `Date`. That is a constraint of the fixture, not a happy accident - see
      // packages/compiler/test/fixtures/s13-hn-front.tsrx constraint (9).
      //
      // IT CANNOT LOAD ON APPEAR AND NOTHING HERE PRETENDS OTHERWISE. There is
      // no lifecycle hook in the authoring surface and `computed(async ...)` is
      // closed upstream of every emitter, so the twelve stories are seeded in
      // the emitted component exactly as TodoMVC's are. This route takes no
      // seed prop for the same reason the three above do not: IR-8 has no
      // lowering for an array type.
      //
      // ONE STYLESHEET, and it is this repository's own work - NOTHING was
      // copied from news.ycombinator.com. `demos/shared/hn-css/hn.css`
      // reproduces the measured geometry (the #ff6600 masthead, the #f6f6ef
      // page, the Verdana 10/8/7pt scale) against the class names the emitters
      // print. It is written into this lane's asset root by `pnpm copy-hn-css`
      // and linked HERE rather than globally, for the reason the TodoMVC and
      // shadcn routes record: it restyles `body`, and a global link would move
      // the geometry of the nine s1-s9 scenarios `pnpm e2e` compares.
      return (
        <>
          <link rel="stylesheet" href="/hn-css/hn.css" />
          <HnFront onTrace={hnTrace} />
        </>
      )
    case 'hn-item':
      // THE FIFTH APPLICATION - the HACKER NEWS ITEM PAGE - and THE RECURSION PAGE.
      //       `HnItem` NAMES ITSELF: the emitted component renders `<HnItem>` inside its
      //       own template, so the thread on screen is whatever the seeded `parentId`
      //       chain describes and NO DEPTH IS FIXED ANYWHERE. The indentation you see is
      //       real DOM nesting, not a computed margin - each level's `<ul>` is a
      //       descendant of the previous level's `.hn-cnest`.
      //
      //       FOUR OF SIX LANES SERVE THIS PAGE, and the two absences are the
      //       measurement this page exists for:
      //         svelte and vue REFUSE a same-module component reference outright - a
      //           `.svelte` file and a `.vue` SFC each declare exactly one component, so
      //           the self-reference has nowhere to land. Recorded verbatim in
      //           packages/frameworks/{svelte,vue}/test/unbuilt-scenarios.ts. That is a
      //           FILE-FORMAT limit rather than a recursion verdict.
      //         angular WAS A THIRD KIND OF ABSENCE AND NOW SHIPS. Its emitter always
      //           EMITTED a correct recursive component; the LANE'S OWN GATE rejected the
      //           result, because the decorator carries `imports: [HnItem]` and `imports`
      //           was not in that lane's BASELINE_FORM_INVENTORY. frameless-app-axes-v1
      //           T009 ruled ADMIT at floor 14.0 and T014 landed it; ANGULAR_BASELINE_FLOOR
      //           did not move (19.0 before, 19.0 after) and ungated-scenarios.ts is gone.
      //           NOTE WHAT NO COMPILER THERE COULD SEE: Angular 22.0.8 reports 0 AOT
      //           diagnostics WITH that `imports` entry and 0 WITHOUT, so the lane was
      //           proven in a browser, not on a green build.
      //
      //       WHAT WORKS: collapse `[-]` and expand `[+]` on any comment - which take the
      //       whole recursive subtree with them - and the per-comment upvote arrow.
      //       WHAT IS INERT AND NOT FAKED: the story vote arrow, `hide`, `past`,
      //       `favorite`, `reply` and the masthead links.
      //       AND THE SENTENCE THAT USED TO FOLLOW THAT LIST WAS A NON-SEQUITUR,
      //       CORRECTED BY frameless-app-fidelity-v1 T002. It read "`.tsrx` has no
      //       routing construct, SO this page is not reachable from /hn by
      //       clicking." THE PREMISE IS TRUE - verified at
      //       packages/compiler/src/schema.ts, which declares no route node kind -
      //       AND THE "SO" IS FALSE. Every stub on /hn already emitted
      //       `preventDefault()` + `onTrace('comments', { id }, event)`, so the
      //       destination was named and typed all along; what was missing was a
      //       SINK, and `noTrace` above was it. THIS PAGE IS NOW REACHED BY
      //       CLICKING a story's comments link on /hn - see `hnDestination`.
      //       THAT IS A FOUR-LANE CLAIM AND IS LABELLED AS ONE: svelte and vue
      //       emit no `HnItem` at all, so those two lanes have no /hn-item to
      //       reach and their comments links stay inert. The /hn page says so
      //       itself in `.hn-note`.
      //       WHAT IS ABSENT: the reference's reply BOX. A controlled `<textarea>` needs
      //       a scalar cell, and the Solid emitter mis-lowers every scalar read inside a
      //       handler once a module carries a same-module component reference - see
      //       packages/compiler/test/fixtures/s14-hn-item.tsrx constraint (16), which
      //       isolates it on a two-source probe.
      //
      //       IT LINKS THE SAME `hn-css/hn.css` /hn does - one sheet, this repository's
      //       own work, nothing copied from news.ycombinator.com - and links it HERE
      //       rather than globally because it restyles `body`, which would move the
      //       geometry of the nine s1-s9 scenarios `pnpm e2e` compares across six lanes.
      // NO TRACE CHANNEL, AND THAT IS ALSO A MEASUREMENT. S14 is the only module in
      // the corpus with no `onTrace` prop: a recursive component must forward every
      // required prop to itself, and the qwik emitter cannot forward a FUNCTION
      // prop across a component boundary in any spelling - it declares and reads
      // `onTrace$` and prints `onTrace` at the call site. The oracle for this page
      // is the RENDERED DOM instead, which is stronger anyway: collapse, expand and
      // the comment upvote each change what is on screen. See constraint (18).
      return (
        <>
          <link rel="stylesheet" href="/hn-css/hn.css" />
          <HnItem parent="root" depth={0} />
        </>
      )
    case 'habits':
      // THE SIXTH APPLICATION - the HABIT TRACKER - and THE SIX-LANE FAN-OUT
      // PAGE. It is a SIX-LANE APPLICATION, and the FIRST that was designed to
      // be so rather than turning out that way - the position this line used to
      // state instead ("the SECOND ... after S13") counted from S13, which was
      // never first: the whole
      // app is SYNCHRONOUS DERIVED STATE, so there is no `Promise`/`setTimeout`
      // for angular's global-identifier ban to catch, no async door for vue's
      // GLOBALS_ALLOWED gap to open, and no component reference for either of
      // T003's two emitter defects to reach. Its date - "JULY 30, 2026" over
      // "Thursday" - is a LITERAL STRING in the seeded data, because the angular
      // emitter cannot NAME `Date` and a clock would have cost this app the very
      // lane count it exists to measure.
      //
      // WHAT ONE CLICK ON A HABIT TOGGLE MOVES, all derived from ONE `habits`
      // cell and none of it written by the handler: the toggle's own fill, the
      // row title's strikethrough, THE SIDEBAR ROW'S strikethrough (a second
      // repeat in a different subtree - which is what makes this fan-out rather
      // than a row re-render), the header counter, the sidebar badge, the
      // progress bar's width class, the encouragement sentence AND its emoji,
      // and today's dot inside that row's nested day strip. EIGHT observables.
      //
      // WHAT IS INERT AND NOT FAKED: `Statistics`, `New habit`, the sidebar
      // toggle and the theme toggle. `.tsrx` has no routing construct at all.
      // WHAT IS ABSENT: the reference's 30-day heat-map and sparkline - roughly
      // two hundred decorative cells per habit that would triple the template
      // while measuring nothing the eight observables do not already measure.
      //
      // TWO STYLESHEETS, ORDER LOAD-BEARING. `/shadcn-theme/tokens.css` is the
      // vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load
      // FIRST, because every colour in the second file is a `var()` from it.
      // `/habit-css/habits.css` is THIS REPOSITORY'S OWN WORK - the Square UI
      // reference is licence-restricted to REFERENCE-ONLY, so nothing was copied
      // from it and its geometry was MEASURED in a browser instead. Both are
      // linked HERE rather than globally because `habits.css` restyles `body`,
      // and a global link would move the geometry of the nine s1-s9 scenarios
      // `pnpm e2e` compares. Like S10-S14 this page is OUT of the 6 x 9
      // three-way contract, which pins `threeWayScenarios` to ['s1'..'s9'].
      return (
        <>
          <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
          <link rel="stylesheet" href="/habit-css/habits.css" />
          <HabitTracker onTrace={noTrace} />
        </>
      )
    case 'board':
      // THE SEVENTH APPLICATION - the TASK BOARD - and THE DRAG CARD. It is a
      // SIX-LANE APPLICATION for the same reason S15 is: THE FIXTURE NAMES NO
      // GLOBAL. The position this line used to state instead counted from S13,
      // which was never first - see the /hn block above.
      //
      // THE AXIS THIS PAGE EXISTS TO MEASURE IS ON IT IN FIVE LANES AND NOT IN
      // THIS ONE. This comment used to read "THE AXIS THIS PAGE EXISTS TO
      // MEASURE IS NOT ON IT", and it stayed that way after the drag shipped.
      // RE-MEASURED AT HEAD with a REAL NATIVE MOUSE DRAG - mouse down, twenty
      // interpolated moves, mouse up, no synthetic DragEvent - at 1600x1000,
      // twice through all six lanes: card `t1` moves out of `backlog`, lands in
      // `todo` AND IS STILL THERE 1.4s LATER in solid, qwik, svelte, vue and
      // angular. FIVE. In THIS lane it does not move at all.
      //
      // THE BOARD PREDICTED `onDragStart`/`onDragOver`/`onDrop` "cannot be
      // produced" because the compiler does `name.slice(2).toLowerCase()`.
      // Measured through all six real emitters: THEY ARE PRODUCED. They are
      // inert only where the lane binds by a FRAMEWORK PROP NAME - THIS LANE
      // prints `onDragover` and react-dom never fires it, while vue's
      // `@dragover`, angular's `(dragover)` and svelte's `ondragover` are the
      // real DOM event names and DO fire.
      //
      // REACT IS NOT MISSING THE ATTRIBUTE, IT IS MISSING THE LISTENER.
      // `document.querySelectorAll('[draggable="true"]')` returns 9 HERE TOO -
      // the same 9 as the other five - so a card in this lane LOOKS draggable
      // and the browser starts a native drag on it. What never arrives is the
      // `dragover` listener, so no column accepts the drop and no card ever
      // reaches `data-dragging="yes"`. react-dom logs it while the gesture
      // runs: "Invalid event handler property `onDragstart` / `onDragend` /
      // `onDragover`". That is DEFECTS.md 15, measured rather than quoted.
      //
      // WHAT KEPT THE DRAG OFF THE PAGE FOR SO LONG WAS THE TYPE BASELINE, and
      // it was a budget read as a wall. An earlier probe measured one drop zone
      // plus one STATIC `draggable="true"` at `pnpm check` 267 -> 280 and the
      // board of the day forbade the rise. The fixture now binds `draggable` to
      // an EXPRESSION instead, and the rise was stated in advance, spent and
      // attributed. Re-measured at HEAD by this comment's own card: `pnpm check`
      // is 261, well inside the 267 ceiling, WITH the drag shipped.
      //
      // THE `◀`/`▶` ARROWS STAY, AND THEY ARE NOT A LEFTOVER: they move a card
      // in ALL SIX LANES and they are how THIS lane moves one. `.tb-note` on
      // the page names which lane does which rather than passing the drag off
      // as universal.
      //
      // WHAT ONE ARROW CLICK MOVES, all derived from ONE `columns` cell: the
      // card leaves one column's <ul> and appears in another's (a real subtree
      // move across two repeat instances), both column counts, the source
      // column's empty placeholder, the header's shipped counter and total, the
      // summary sentence AND its emoji, and the moved card's own arrows, whose
      // `hidden` is decided by the column it now sits in - so the control that
      // was clicked can disappear under the pointer. NINE observables.
      //
      // WHAT IS INERT AND NOT FAKED: the three sidebar links, `Share`, `Filter`,
      // `Sort`, `Request task`, the per-column `+` and `Add task`. `.tsrx` has
      // no routing construct at all - and the reference's own `Filter` and
      // `Add task` do nothing either, measured live.
      //
      // TWO STYLESHEETS, ORDER LOAD-BEARING. `/shadcn-theme/tokens.css` is the
      // vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load
      // FIRST, because every colour in the second file is a `var()` from it.
      // `/board-css/board.css` is THIS REPOSITORY'S OWN WORK - the Square UI
      // reference is licence-restricted to REFERENCE-ONLY, so nothing was copied
      // from it and its geometry was MEASURED in a browser instead. Both are
      // linked HERE rather than globally because `board.css` restyles `body`,
      // and a global link would move the geometry of the nine s1-s9 scenarios
      // `pnpm e2e` compares. Like S10-S15 this page is OUT of the 6 x 9
      // three-way contract, which pins `threeWayScenarios` to ['s1'..'s9'].
      return (
        <>
          <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
          <link rel="stylesheet" href="/board-css/board.css" />
          <TaskBoard onTrace={noTrace} />
        </>
      )
    case 'contacts':
      // THE EIGHTH APPLICATION - CONTACTS - and THE FORMS CARD. It is a SIX-LANE
      // APPLICATION for the same reason S15 and S16 are: THE FIXTURE NAMES NO
      // GLOBAL, which mattered most here because a `date` input's obvious default
      // is today and `Date` stays refused. The position this line used to state
      // instead counted from S13, which was never first - see the /hn block
      // above. This comment used to add "UNLIKE S16 THE AXIS IT MEASURES IS ACTUALLY
      // ON THE PAGE" - S16'S AXIS IS ON ITS PAGE NOW, in five of six lanes, so the
      // contrast is withdrawn rather than left to read as current. What is true of
      // THIS page, and unlike S16, is that its axis is on it in ALL SIX: THIRTEEN
      // control kinds - text, search, email, tel, url, number, date, time, range,
      // select, radio, checkbox and textarea - every one of them bound and every one
      // of them observable in the live preview card beneath the form.
      //
      // THE BOARD'S PREMISE IS PARTLY REFUTED AND THE REFUTATION IS ALREADY IN THIS
      // DEMO. It said only `checkbox` and `textarea` were proven and that `select`,
      // `radio` and the multi-field form shape were unmeasured in all six lanes. The
      // /s7 route above IS that shape - a `<form>` with a `<select>`, a `<textarea>`,
      // a radio group and a keyed checkbox group - it emits in all six lanes, and
      // `pnpm e2e` drives it in a real browser across six demos.
      //
      // MEASURED ON A PROBE THROUGH ALL SIX REAL EMITTERS: every one of the sixteen
      // `type=` values emits everywhere. No emitter reads the VALUE of a `type`
      // attribute, so the axis has no per-type refusal in it at all. WHAT COSTS
      // SOMETHING IS THE ATTRIBUTE BESIDE THE TYPE: `required`, `multiple`,
      // `disabled`, `readonly`, `autofocus`, `spellcheck` and a static `checked` each
      // add an `error TS` line to all three JSX lanes, and `maxlength`, `size`,
      // `rows` and `cols` add one to react and qwik. `min`, `max` and `step` are
      // FREE in all three - which the card predicted would fail and is why the
      // number, date, time and range fields here carry real bounds. The required
      // markers are literal `*` characters and the submit guard is `aria-disabled`.
      //
      // TWO REFERENCE DEFECTS, MEASURED LIVE AND NOT COPIED: with its New Contact
      // dialog open the reference holds SEVEN inputs, TWO selects and ZERO
      // textareas - its Notes field is a single-line input - and
      // `document.querySelectorAll('h1,h2,h3,h4')` returns ZERO on the whole
      // document. This page ships a real textarea, an h1 and three h2s.
      //
      // TWO STYLESHEETS, ORDER LOAD-BEARING. `/shadcn-theme/tokens.css` is the
      // vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load FIRST,
      // because every colour in the second file is a `var()` from it.
      // `/contact-css/contacts.css` is THIS REPOSITORY'S OWN WORK - the Square UI
      // reference is licence-restricted to REFERENCE-ONLY, so nothing was copied and
      // its geometry was MEASURED in a browser instead, dialog included. Both are
      // linked HERE rather than globally because `contacts.css` restyles `body`.
      // Like S10-S16 this page is OUT of the 6 x 9 three-way contract, which pins
      // `threeWayScenarios` to ['s1'..'s9'].
      return (
        <>
          <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
          <link rel="stylesheet" href="/contact-css/contacts.css" />
          <Contacts onTrace={noTrace} />
        </>
      )
    case 's9':
      return <AttrBoard seed={s9Seed} onTrace={noTrace} />
    default:
      return <RenderOnce label="kit" multiplier={2} visible={true} onTrace={noTrace} />
  }
}
