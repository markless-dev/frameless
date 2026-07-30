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
import { EventForm } from './emitted/EventForm.jsx'
import { FormBoard } from './emitted/FormBoard.jsx'
import { KeyedTodo } from './emitted/KeyedTodo.jsx'
import { NestedBoard } from './emitted/NestedBoard.jsx'
import { RenderOnce } from './emitted/RenderOnce.jsx'
import { TodoMvc } from './emitted/TodoMvc.jsx'
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
 * @returns {'s1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9' | 'todomvc'}
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
    case 's9':
      return <AttrBoard seed={s9Seed} onTrace={noTrace} />
    default:
      return <RenderOnce label="kit" multiplier={2} visible={true} onTrace={noTrace} />
  }
}
