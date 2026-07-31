import { Match, Switch, createSignal } from 'solid-js'
// THE `.jsx` SPECIFIERS BELOW POINT AT `.tsx` FILES, DELIBERATELY.
// `src/emitted/` holds `.tsx` since the extension migration; `copy-emitted`
// writes it. The specifier stays `.jsx` because that is the portable form: a
// `.tsx` specifier is a hard TypeScript error (TS5097) without
// `allowImportingTsExtensions`, while `.jsx` resolves to the `.tsx` file under
// both TypeScript's and Vite's JS-to-TS extension substitution. It is also what
// the Frameless emitters write inside emitted output, so this file exercises the
// same resolution a real consumer does.
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
// THE /hn NAV SINK, added by frameless-app-fidelity-v1 T006, and IDENTICAL in
// shape to demos/react-official/src/App.jsx's - deliberately, because the two
// lanes have the same router (none) and the same door out of it.
//
// THE EMITTED PAGE WAS NEVER MISSING THE DESTINATION. Every stub link in
// `HnFront` already emits `event.preventDefault()` then
// `onTrace('nav', { to: 'home' }, event)`; the intent is NAMED, LOWERED AND
// TYPED. What was missing was the SINK - this module passed `noTrace`, whose
// body is `{}` - so a correctly emitted navigation arrived nowhere. THE LINKS
// DIED HERE, which is why no compiler in six lanes could see it.
//
// `hnDestination` RETURNS `null` FOR EVERYTHING IT CANNOT REACH, and that is
// the honest half: seventeen of the thirty-one stubs on /hn are each a separate
// application this corpus does not contain, so the page LABELS them in
// `.hn-note` rather than pointing them somewhere false. `open` is absent on
// purpose - that trace belongs to a story TITLE whose `href={story.url}` is a
// REAL url, held on the page by the fixture's own `preventDefault` (constraint
// 11), and navigating on it would break a working affordance.
//
// A FULL DOCUMENT NAVIGATION IS THIS LANE'S ROUTER. `scenarioFor(url)` below is
// the routing here: this is the stock create-vite SSR scaffold, which threads
// `req.originalUrl` into `render(url)` and ships no client router. So
// `location.assign` is the same door the address bar uses - and it is also why
// the proof that this works is a BODY HASH rather than an HTTP status, since
// this lane answers 200 for any path at all.
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
 * The /s8 page: the two harness controls plus the emitted board. Nothing here
 * is emitted output.
 */
function AsyncGate() {
  const [ready, setReady] = createSignal(s8ResolvedGate)
  return (
    <>
      <button type="button" data-harness="arm" onClick={() => setReady(armS8Gate())}>
        arm
      </button>
      <button type="button" data-harness="release" onClick={() => s8Gate.release()}>
        release
      </button>
      <p data-harness="gate">{ready() === s8ResolvedGate ? 'open' : 'held'}</p>
      <AsyncBoard ready={ready()} onTrace={noTrace} />
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
  // THE SECOND APPLICATION. Five lanes, not six - angular refuses S11.
  if (path === 'todomvc-advanced') return 'todomvc-advanced'
  // THE THIRD APPLICATION - the Codex clone. Five lanes emit it, four run its
  // stream; angular has no route at all. Browsable only, like the two above.
  if (path === 'codex') return 'codex'
  // THE FOURTH APPLICATION - the HACKER NEWS FRONT PAGE - and the first one in
  // this corpus that SIX lanes emit rather than five or four. Browsable only,
  // like the three above: `scripts/e2e.mjs` pins `threeWayScenarios` to the
  // literal ['s1'..'s9'].
  if (path === 'hn') return 'hn'
  if (path === 'hn-item') return 'hn-item'
  // THE SIXTH APPLICATION - the HABIT TRACKER - and the second scenario in
  // this corpus that all SIX lanes emit and ship. Browsable only.
  if (path === 'habits') return 'habits'
  // THE SEVENTH APPLICATION - the TASK BOARD - and the third scenario all SIX
  // lanes emit and ship, after S13 and S15. Browsable only.
  if (path === 'board') return 'board'
  // THE EIGHTH APPLICATION - CONTACTS - and the fourth scenario all SIX lanes
  // emit and ship, after S13, S15 and S16. Browsable only.
  if (path === 'contacts') return 'contacts'
  return 's1'
}

/**
 * @param {{ url?: string }} props
 */
export default function App(props) {
  const scenario = () => scenarioFor(props.url)
  return (
    <Switch fallback={<RenderOnce label="kit" multiplier={2} visible={true} onTrace={noTrace} />}>
      <Match when={scenario() === 's2'}>
        <KeyedTodo seed={s2Seed} onTrace={noTrace} />
      </Match>
      <Match when={scenario() === 's3'}>
        <EventForm initial="hello" onTrace={noTrace} />
      </Match>
      <Match when={scenario() === 's4'}>
        <NestedBoard seed={s4Seed} onTrace={noTrace} />
      </Match>
      <Match when={scenario() === 's5'}>
        <BranchBoard seed={s5Seed} onTrace={noTrace} />
      </Match>
      <Match when={scenario() === 's6'}>
        <WhitespaceBoard seed={s6Seed} label={s6Label} onTrace={noTrace} />
      </Match>
      <Match when={scenario() === 's7'}>
        <FormBoard seed={s7Seed} onTrace={noTrace} />
      </Match>
      <Match when={scenario() === 's8'}>
        <AsyncGate />
      </Match>
      <Match when={scenario() === 's9'}>
        <AttrBoard seed={s9Seed} onTrace={noTrace} />
      </Match>
      {/*
        THE FOURTH APPLICATION - the HACKER NEWS FRONT PAGE - and the FIRST route
        in this demo whose lane count is SIX. S11 and S12 lose angular to its
        global-identifier ban; S13 names no global at all, because every relative
        age is a literal string in the seeded data rather than something computed
        from `Date`. That is a constraint of the fixture, not luck - see
        packages/compiler/test/fixtures/s13-hn-front.tsrx constraint (9).

        IT CANNOT LOAD ON APPEAR AND NOTHING HERE PRETENDS OTHERWISE. There is no
        lifecycle hook in the authoring surface and `computed(async ...)` is
        closed upstream of every emitter, so the twelve stories are seeded inside
        the emitted component exactly as TodoMVC's are. No seed prop, for the same
        reason the three routes above take none: IR-8 has no array lowering.

        ONE STYLESHEET, and it is this repository's own work - NOTHING was copied
        from news.ycombinator.com. `demos/shared/hn-css/hn.css` reproduces the
        measured geometry against the class names the emitters print, is written
        into `public/hn-css/` by `pnpm copy-hn-css`, and is linked HERE rather
        than globally because it restyles `body`.
      */}
      {/*
        THE FIFTH APPLICATION - the HACKER NEWS ITEM PAGE - and THE RECURSION PAGE.
        `HnItem` NAMES ITSELF: the emitted component renders `<HnItem>` inside its
        own template, so the thread on screen is whatever the seeded `parentId`
        chain describes and NO DEPTH IS FIXED ANYWHERE. The indentation you see is
        real DOM nesting, not a computed margin - each level's `<ul>` is a
        descendant of the previous level's `.hn-cnest`.

        FOUR OF SIX LANES SERVE THIS PAGE, and the two absences are the
        measurement this page exists for:
          svelte and vue REFUSE a same-module component reference outright - a
            `.svelte` file and a `.vue` SFC each declare exactly one component, so
            the self-reference has nowhere to land. Recorded verbatim in
            packages/frameworks/{svelte,vue}/test/unbuilt-scenarios.ts. That is a
            FILE-FORMAT limit rather than a recursion verdict.
          angular WAS A THIRD KIND OF ABSENCE AND NOW SHIPS. Its emitter always
            EMITTED a correct recursive component; the LANE'S OWN GATE rejected the
            result, because the decorator carries `imports: [HnItem]` and `imports`
            was not in that lane's BASELINE_FORM_INVENTORY. frameless-app-axes-v1
            T009 ruled ADMIT at floor 14.0 and T014 landed it; ANGULAR_BASELINE_FLOOR
            did not move (19.0 before, 19.0 after) and ungated-scenarios.ts is gone.
            NOTE WHAT NO COMPILER THERE COULD SEE: Angular 22.0.8 reports 0 AOT
            diagnostics WITH that `imports` entry and 0 WITHOUT, so the lane was
            proven in a browser, not on a green build.

        WHAT WORKS: collapse `[-]` and expand `[+]` on any comment - which take the
        whole recursive subtree with them - and the per-comment upvote arrow.
        WHAT IS INERT AND NOT FAKED: the story vote arrow, `hide`, `past`,
        `favorite`, `reply` and the masthead links. `.tsrx` has no routing
        construct, so this page is not reachable from /hn by clicking.
        WHAT IS ABSENT: the reference's reply BOX. A controlled `<textarea>` needs
        a scalar cell, and the Solid emitter mis-lowers every scalar read inside a
        handler once a module carries a same-module component reference - see
        packages/compiler/test/fixtures/s14-hn-item.tsrx constraint (16), which
        isolates it on a two-source probe.

        IT LINKS THE SAME `hn-css/hn.css` /hn does - one sheet, this repository's
        own work, nothing copied from news.ycombinator.com - and links it HERE
        rather than globally because it restyles `body`, which would move the
        geometry of the nine s1-s9 scenarios `pnpm e2e` compares across six lanes.
        NO TRACE CHANNEL, AND THAT IS ALSO A MEASUREMENT. S14 is the only module in
        the corpus with no `onTrace` prop: a recursive component must forward every
        required prop to itself, and the qwik emitter cannot forward a FUNCTION
        prop across a component boundary in any spelling - it declares and reads
        `onTrace$` and prints `onTrace` at the call site. The oracle for this page
        is the RENDERED DOM instead, which is stronger anyway: collapse, expand and
        the comment upvote each change what is on screen. See constraint (18).
      */}
      <Match when={scenario() === 'hn-item'}>
        <link rel="stylesheet" href="/hn-css/hn.css" />
        <HnItem parent="root" depth={0} />
      </Match>
      {/*
        THE SIXTH APPLICATION - the HABIT TRACKER - and THE SIX-LANE FAN-OUT PAGE.
        It is the SECOND scenario in this corpus that all six lanes emit and ship,
        after S13, and the FIRST designed to be so: the whole app is SYNCHRONOUS
        DERIVED STATE, so there is no `Promise`/`setTimeout` for angular's
        global-identifier ban to catch, no async door for vue's GLOBALS_ALLOWED gap
        to open, and no component reference for either of T003's two emitter
        defects to reach. Its date - "JULY 30, 2026" over "Thursday" - is a LITERAL
        STRING in the seeded data, because the angular emitter cannot NAME `Date`
        and a clock would have cost this app the very lane count it exists to
        measure.

        WHAT ONE CLICK ON A HABIT TOGGLE MOVES, all derived from ONE `habits` cell
        and none of it written by the handler: the toggle's own fill, the row
        title's strikethrough, THE SIDEBAR ROW'S strikethrough (a second repeat in
        a different subtree - which is what makes this fan-out rather than a row
        re-render), the header counter, the sidebar badge, the progress bar's width
        class, the encouragement sentence AND its emoji, and today's dot inside
        that row's nested day strip. EIGHT observables.

        WHAT IS INERT AND NOT FAKED: `Statistics`, `New habit`, the sidebar toggle
        and the theme toggle - `.tsrx` has no routing construct at all. WHAT IS
        ABSENT: the reference's 30-day heat-map and sparkline, roughly two hundred
        decorative cells per habit that would triple the template while measuring
        nothing the eight observables do not already measure.

        TWO STYLESHEETS, ORDER LOAD-BEARING. `/shadcn-theme/tokens.css` is the
        vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load
        FIRST, because every colour in the second file is a `var()` from it.
        `/habit-css/habits.css` is THIS REPOSITORY'S OWN WORK - the Square UI
        reference is licence-restricted to REFERENCE-ONLY, so nothing was copied
        from it and its geometry was MEASURED in a browser instead. Both are linked
        HERE rather than globally because `habits.css` restyles `body`. Like
        S10-S14 this page is OUT of the 6 x 9 three-way contract, which pins
        `threeWayScenarios` to ['s1'..'s9'].
      */}
      <Match when={scenario() === 'habits'}>
        <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
        <link rel="stylesheet" href="/habit-css/habits.css" />
        <HabitTracker onTrace={noTrace} />
      </Match>
      {/*
        THE SEVENTH APPLICATION - the TASK BOARD - and THE DRAG CARD. It is the
        THIRD scenario in this corpus that all six lanes emit and ship, after S13
        and S15.

        THE AXIS THIS PAGE EXISTS TO MEASURE IS ON IT, AND THIS COMMENT USED TO SAY
        IT WAS NOT. The board predicted `onDragStart`/`onDragOver`/`onDrop`
        "cannot be produced" because the compiler does `name.slice(2).toLowerCase()`.
        Measured on a probe through all six real emitters: THEY ARE PRODUCED. Five
        lanes take them; svelte refuses the ELEMENT ("a11y_no_static_element_interactions"
        on a <div> or <span>) and not the event, which is why the drop zone is a
        <ul> and the draggable card an <li>.

        WHAT KEPT THEM OFF THE PAGE WAS THE TYPE BASELINE, AND IT WAS A BUDGET READ
        AS A WALL: an earlier probe spelled `draggable` as a STATIC string and took
        THIS LANE from 80 to 86 `error TS` lines and `pnpm check` from 267 to 280.
        The fixture BINDS `draggable` instead, and the rise was stated in advance,
        spent and attributed. RE-MEASURED AT HEAD BY THIS COMMENT'S OWN CARD, in a
        chromium driven with a REAL NATIVE MOUSE (mouse down, twenty interpolated
        moves, mouse up; no synthetic DragEvent anywhere): DRAGGING CARD `t1` FROM
        `backlog` ONTO `review` MOVED IT AND IT STAYED IN THIS LANE, with
        `data-dragging="yes"` on `t1` during the gesture. `[draggable="true"]`
        counts 9 here, the same 9 as the other five, and `pnpm check` is 261 with
        the drag shipped.

        THE ARROW BUTTONS ARE NOT A SUBSTITUTE AND NOT A LEFTOVER: they move a card
        in ALL SIX lanes and they are how REACT moves one - the one lane where the
        drag is inert, because react-dom matches by prop name. `.tb-note` on the
        page names which lane does which.

        WHAT ONE ARROW CLICK MOVES, all derived from ONE `columns` cell: the card
        leaves one column's list and appears in another's - a real subtree move
        across two repeat instances - plus both column counts, the source column's
        empty placeholder, the header's shipped counter and total, the summary
        sentence AND its emoji, and the moved card's own arrows, whose `hidden` is
        decided by the column it now sits in. NINE observables.

        TWO STYLESHEETS, ORDER LOAD-BEARING. `/shadcn-theme/tokens.css` is the
        vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load FIRST.
        `/board-css/board.css` is THIS REPOSITORY'S OWN WORK - the Square UI
        reference is licence-restricted to REFERENCE-ONLY, so nothing was copied
        from it and its geometry was MEASURED in a browser instead. Both are linked
        HERE rather than globally because `board.css` restyles `body`. Like S10-S15
        this page is OUT of the 6 x 9 three-way contract.
      */}
      <Match when={scenario() === 'board'}>
        <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
        <link rel="stylesheet" href="/board-css/board.css" />
        <TaskBoard onTrace={noTrace} />
      </Match>
      {/*
        THE EIGHTH APPLICATION - CONTACTS - and THE FORMS CARD. It is the FOURTH
      scenario in this corpus that all six lanes emit and ship, after S13, S15 and
      S16. This comment used to add "UNLIKE S16 THE AXIS IT MEASURES IS ACTUALLY ON
      THE PAGE" - S16's axis is on its page now, in five of six lanes, so the
      contrast is WITHDRAWN rather than left to read as current. What is true of
      THIS page, and unlike S16, is that its axis is on it in ALL SIX: THIRTEEN
      control kinds - text, search, email, tel, url, number, date, time, range,
      select, radio, checkbox and textarea - every one of them bound and every one
      of them observable in the live preview card beneath the form.

      THE BOARD'S PREMISE IS PARTLY REFUTED AND THE REFUTATION IS ALREADY IN THIS
      DEMO. It said only `checkbox` and `textarea` were proven and that `select`,
      `radio` and the multi-field form shape were unmeasured in all six lanes. The
      /s7 route above IS that shape - a `<form>` with a `<select>`, a `<textarea>`,
      a radio group and a keyed checkbox group - it emits in all six lanes, and
      `pnpm e2e` drives it in a real browser across six demos.

      MEASURED ON A PROBE THROUGH ALL SIX REAL EMITTERS: every one of the sixteen
      `type=` values emits everywhere. No emitter reads the VALUE of a `type`
      attribute, so the axis has no per-type refusal in it at all. WHAT COSTS
      SOMETHING IS THE ATTRIBUTE BESIDE THE TYPE: `required`, `multiple`,
      `disabled`, `readonly`, `autofocus`, `spellcheck` and a static `checked` each
      add an `error TS` line to all three JSX lanes, and `maxlength`, `size`,
      `rows` and `cols` add one to react and qwik. `min`, `max` and `step` are
      FREE in all three - which the card predicted would fail and is why the
      number, date, time and range fields here carry real bounds. The required
      markers are literal `*` characters and the submit guard is `aria-disabled`.

      TWO REFERENCE DEFECTS, MEASURED LIVE AND NOT COPIED: with its New Contact
      dialog open the reference holds SEVEN inputs, TWO selects and ZERO
      textareas - its Notes field is a single-line input - and
      `document.querySelectorAll('h1,h2,h3,h4')` returns ZERO on the whole
      document. This page ships a real textarea, an h1 and three h2s.

      TWO STYLESHEETS, ORDER LOAD-BEARING. `/shadcn-theme/tokens.css` is the
      vendored shadcn/ui DEFAULT theme (MIT, (c) 2023 shadcn) and must load FIRST,
      because every colour in the second file is a `var()` from it.
      `/contact-css/contacts.css` is THIS REPOSITORY'S OWN WORK - the Square UI
      reference is licence-restricted to REFERENCE-ONLY, so nothing was copied and
      its geometry was MEASURED in a browser instead, dialog included. Both are
      linked HERE rather than globally because `contacts.css` restyles `body`.
      Like S10-S16 this page is OUT of the 6 x 9 three-way contract, which pins
      `threeWayScenarios` to ['s1'..'s9'].
      */}
      <Match when={scenario() === 'contacts'}>
        <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
        <link rel="stylesheet" href="/contact-css/contacts.css" />
        <Contacts onTrace={noTrace} />
      </Match>
      <Match when={scenario() === 'hn'}>
        <link rel="stylesheet" href="/hn-css/hn.css" />
        <HnFront onTrace={hnTrace} />
      </Match>
      {/*
        THE ONLY ROUTE THAT LINKS A STYLESHEET, and deliberately so. The pair is
        rendered HERE rather than in index.html because s1-s9 are the 6 x 9
        three-way contract: todomvc-app-css restyles `body` and every `button` in
        the document, so linking it globally would change the geometry of nine
        scenarios that exist to be compared across six lanes.

        `index.css` is todomvc-app-css@2.4.3 verbatim; the supplement overrides
        some of it at equal specificity and must load second. Both are copied into
        `public/todomvc-app-css/` by `pnpm copy-todomvc-css`, and all six lanes
        serve them at these same two URLs. See demos/shared/copy-todomvc-css.mjs.
      */}
      <Match when={scenario() === 'todomvc'}>
        <link rel="stylesheet" href="/todomvc-app-css/index.css" />
        <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
        <TodoMvc onTrace={noTrace} />
      </Match>
      {/*
        THE SECOND APPLICATION, and the first route in this demo whose lane count is
        FOUR rather than six: the angular emitter REFUSES S11 on its global-identifier
        ban ("Angular emitter cannot resolve the identifier \"Promise\" in a
        transplanted body"), so demos/angular-official has no counterpart to this page.

        AND THE SIXTH LANE IS LOST DIFFERENTLY, WHICH IS WHY THE COUNT IS FOUR AND NOT
        FIVE. VUE emits this scenario, passes its own gate and its typecheck, and then
        THROWS IN THE BROWSER: `_ctx.Promise is not a constructor`. That emitter inlines
        handlers into TEMPLATE EXPRESSIONS, and Vue's template compiler prefixes any
        identifier outside GLOBALS_ALLOWED with `_ctx.` - a list that carries Date and
        JSON and does NOT carry Promise or setTimeout (measured at @vue/shared@3.5.40).
        So demos/vue-official DOES serve this route, with add/destroy/filter/local
        search working and the two ASYNC axes throwing. Both losses are lane limits
        inside each framework's own design envelope, not defects to file upstream.
        Like /todomvc it is deliberately OUT of the 6 x 9 three-way contract -
        `scripts/e2e.mjs` pins `threeWayScenarios` to the literal ['s1'..'s9'] - so this
        page is browsable only. It takes no seed prop: IR-8 has no lowering for an array
        type, so the list is seeded inside the emitted component.

        It links THREE stylesheets where /todomvc links two. `index.css` is
        todomvc-app-css@2.4.3 verbatim, `frameless-supplement.css` is the repair layer
        the simple app needs, and `frameless-advanced.css` carries the controls this app
        adds. Cascade order is load-bearing at both joints and the advanced sheet MUST
        load third. All three are copied into this lane's asset root by
        `pnpm copy-todomvc-css`. THE PIXEL PASS IS T005'S CARD, NOT T003'S.
      */}
      <Match when={scenario() === 'todomvc-advanced'}>
        <link rel="stylesheet" href="/todomvc-app-css/index.css" />
        <link rel="stylesheet" href="/todomvc-app-css/frameless-supplement.css" />
        <link rel="stylesheet" href="/todomvc-app-css/frameless-advanced.css" />
        <TodoMvcAdvanced onTrace={noTrace} />
      </Match>
      {/*
        THE THIRD APPLICATION - the CODEX CLONE - and the route this board expected
        to be REFUSED outright. It is not: FOUR lanes run it, one emits and
        misbehaves, one refuses at emit.

        ANGULAR HAS NO COUNTERPART TO THIS PAGE. That emitter refuses S12 with the
        message read off THIS module - `Angular emitter cannot resolve the
        identifier "Promise" in a transplanted body` - because a streamed answer is
        three unrolled chunks separated by `new Promise` + `setTimeout`, and that
        lane cannot NAME a global inside a transplanted body. Recorded, not chased.

        VUE SERVES THIS ROUTE AND ITS STREAM THROWS, exactly as on
        /todomvc-advanced and for the same measured reason: the vue emitter inlines
        handlers into TEMPLATE EXPRESSIONS and Vue's template compiler prefixes any
        identifier outside GLOBALS_ALLOWED with `_ctx.` - a list carrying Date and
        JSON but not Promise or setTimeout. Every SYNCHRONOUS axis of the app -
        thread navigation, both tab pairs, the composer draft - works there.

        WHAT THIS APP CANNOT DO, AND IT IS NOT FAKED ANYWHERE: there is no
        Enter-to-send and no keyboard interaction of any kind. Two-word DOM events
        are unspellable in every lane (DEFECTS.md 15) - `onKeyDown` prints
        `onKeydown` and never fires - so the composer ships the SEND BUTTON, which
        is the reference's other affordance and a plain click.

        Like /todomvc and /todomvc-advanced it is deliberately OUT of the 6 x 9
        three-way contract: `scripts/e2e.mjs` pins `threeWayScenarios` to the
        literal ['s1'..'s9']. It takes no seed prop - IR-8 has no lowering for an
        array type - so threads and messages are seeded inside the emitted
        component and every shipped lane starts from byte-identical data.

        IT LINKS TWO STYLESHEETS, BOTH FROM A DIFFERENT FAMILY THAN THE TODOMVC
        ROUTES. `/shadcn-theme/tokens.css` is the shadcn/ui default theme (MIT,
        (c) 2023 shadcn), DERIVED at copy time from the verbatim upstream block
        because that block is Tailwind source and not a browser stylesheet;
        `/shadcn-theme/codex.css` is this repo's own component sheet, hand-written
        against those token names. Order is load-bearing: the tokens must load
        first. Both are written into this lane's asset root by
        `pnpm copy-shadcn-theme`. See demos/shared/copy-shadcn-theme.mjs.
      */}
      <Match when={scenario() === 'codex'}>
        <link rel="stylesheet" href="/shadcn-theme/tokens.css" />
        <link rel="stylesheet" href="/shadcn-theme/codex.css" />
        <CodexClone onTrace={noTrace} />
      </Match>
    </Switch>
  )
}
