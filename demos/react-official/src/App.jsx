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
 * @returns {'s1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9' | 'todomvc' | 'todomvc-advanced' | 'codex' | 'hn' | 'hn-item'}
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
      // THE SECOND APPLICATION, and the first route in this demo whose lane count is
      // FOUR rather than six: the angular emitter REFUSES S11 on its global-identifier
      // ban ("Angular emitter cannot resolve the identifier \"Promise\" in a
      // transplanted body"), so demos/angular-official has no counterpart to this page.
      //
      // AND THE SIXTH LANE IS LOST DIFFERENTLY, WHICH IS WHY THE COUNT IS FOUR AND NOT
      // FIVE. VUE emits this scenario, passes its own gate and its typecheck, and then
      // THROWS IN THE BROWSER: `_ctx.Promise is not a constructor`. That emitter inlines
      // handlers into TEMPLATE EXPRESSIONS, and Vue's template compiler prefixes any
      // identifier outside GLOBALS_ALLOWED with `_ctx.` - a list that carries Date and
      // JSON and does NOT carry Promise or setTimeout (measured at @vue/shared@3.5.40).
      // So demos/vue-official DOES serve this route, with add/destroy/filter/local
      // search working and the two ASYNC axes throwing. Both losses are lane limits
      // inside each framework's own design envelope, not defects to file upstream.
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
      // to be REFUSED outright. It is not: FOUR lanes run it, one emits and
      // misbehaves, one refuses at emit.

      // ANGULAR HAS NO COUNTERPART TO THIS PAGE. That emitter refuses S12 with the
      // message read off THIS module - `Angular emitter cannot resolve the
      // identifier "Promise" in a transplanted body` - because a streamed answer is
      // three unrolled chunks separated by `new Promise` + `setTimeout`, and that
      // lane cannot NAME a global inside a transplanted body. Recorded, not chased.

      // VUE SERVES THIS ROUTE AND ITS STREAM THROWS, exactly as on
      // /todomvc-advanced and for the same measured reason: the vue emitter inlines
      // handlers into TEMPLATE EXPRESSIONS and Vue's template compiler prefixes any
      // identifier outside GLOBALS_ALLOWED with `_ctx.` - a list carrying Date and
      // JSON but not Promise or setTimeout. Every SYNCHRONOUS axis of the app -
      // thread navigation, both tab pairs, the composer draft - works there.

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
      // THE FOURTH APPLICATION - the HACKER NEWS FRONT PAGE - and the FIRST in
      // this corpus that all SIX lanes emit. S11 and S12 lose angular to its
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
          <HnFront onTrace={noTrace} />
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
      //       THREE OF SIX LANES SERVE THIS PAGE, and the three absences are the
      //       measurement this page exists for:
      //         svelte and vue REFUSE a same-module component reference outright - a
      //           `.svelte` file and a `.vue` SFC each declare exactly one component, so
      //           the self-reference has nowhere to land. Recorded verbatim in
      //           packages/frameworks/{svelte,vue}/test/unbuilt-scenarios.ts.
      //         angular EMITS a correct recursive component and its OWN GATE REJECTS the
      //           result: the decorator must carry `imports: [HnItem]` for the selector
      //           to resolve, and `imports` is not in that lane's BASELINE_FORM_INVENTORY.
      //           Recorded in packages/frameworks/angular/test/ungated-scenarios.ts.
      //
      //       WHAT WORKS: collapse `[-]` and expand `[+]` on any comment - which take the
      //       whole recursive subtree with them - and the per-comment upvote arrow.
      //       WHAT IS INERT AND NOT FAKED: the story vote arrow, `hide`, `past`,
      //       `favorite`, `reply` and the masthead links. `.tsrx` has no routing
      //       construct, so this page is not reachable from /hn by clicking.
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
    case 's9':
      return <AttrBoard seed={s9Seed} onTrace={noTrace} />
    default:
      return <RenderOnce label="kit" multiplier={2} visible={true} onTrace={noTrace} />
  }
}
