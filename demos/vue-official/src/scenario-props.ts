/**
 * The props the three scenarios hand the emitted components, and the URL→scenario
 * map the root component branches on.
 *
 * Byte-for-byte the same values `demos/react-official/src/App.jsx`,
 * `demos/solid-official/src/App.jsx`, `demos/qwik/src/routes/**` and
 * `demos/svelte-official/src/lib/scenario-props.ts` pass, which is what makes
 * `scripts/e2e.mjs`'s cross-lane observation diff a comparison rather than five
 * unrelated tests.
 *
 * `onTrace` is the emitted components' trace callback. The official demos are
 * activation lanes, not analyzer lanes, so every lane passes a no-op.
 */
export type ScenarioId =
  | 's1'
  | 's2'
  | 's3'
  | 's4'
  | 's5'
  | 's6'
  | 's7'
  | 's8'
  | 's9'
  | 'todomvc'

export const noTrace = () => {}

export const s2Seed = [
  { id: 'a', title: 'one', done: false },
  { id: 'b', title: 'two', done: true },
]

/**
 * S4's nested seed. Group ids and row ids come from DISJOINT alphabets on
 * purpose: the emitted Angular call site passes both enclosing loop variables
 * positionally, so a swapped argument list has to produce a visibly different
 * selection string rather than one that could be read either way.
 */
export const s4Seed = [
  { id: 'g1', rows: [{ id: 'r1' }, { id: 'r2' }] },
  { id: 'g2', rows: [{ id: 'r3' }] },
]

/**
 * S5's branch seed. Three rows, because the scenario drops the first one while
 * the subtree that renders them is torn down and then requires the rebuilt arm
 * to hold exactly the remaining two — a count that is neither the original nor
 * zero, so a rebuild from a stale snapshot and a rebuild from nothing are
 * distinguishable from each other and from a correct one.
 */
export const s5Seed = [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }]

/**
 * S6's whitespace seed. TWO rows, each with two single-character values, because
 * the scenario's observable is what sits BETWEEN them: `pairs` reads
 * `{row.left}{joiner}{row.right}` per row, and one row could not distinguish
 * "the separator changed" from "the clicked row was rebuilt".
 */
export const s6Seed = [
  { id: 'w1', left: 'a', right: 'b' },
  { id: 'w2', left: 'c', right: 'd' },
]

/**
 * S6's whitespace-bearing label, and the reason the scenario can measure
 * interpolated whitespace at all. Its leading space, its interior DOUBLE space
 * and its trailing space are significant and must survive verbatim in all six
 * lanes. A template text node could not carry them: this lane's own gate
 * (`condense-stable-text`) rejects an emitted text node with a whitespace edge
 * and the Angular emitter throws on one, so the whitespace travels as DATA.
 */
export const s6Label = ' wide  load '

/**
 * S7's form seed. TWO rows whose `on` flags DIFFER: `t1` starts unchecked and
 * `t2` starts checked, so one keyed repeat carries a `checked` binding that is
 * false and one that is true. One row, or two rows in the same state, could not
 * distinguish "the checkbox reflects its own row" from "every checkbox reflects
 * the same value".
 */
export const s7Seed = [
  { id: 't1', on: false },
  { id: 't2', on: true },
]

/**
 * S9's boolean-attribute seed. TWO rows, and BOTH start `off: false`, which is a
 * MEASURED constraint rather than a tidiness preference: S9's whole claim is that
 * a boolean content attribute is ABSENT until state says otherwise, so a row
 * seeded `true` would serve `disabled=""` before any click and could not
 * distinguish "the lowering works" from "the attribute is always there". Two
 * rows rather than one because the scenario seals only `f2` — exactly one button
 * grows the attribute, which is what separates "the boolean reached its own row"
 * from "every button in the repeat reflects the same value".
 */
export const s9Seed = [
  { id: 'f1', off: false },
  { id: 'f2', off: false },
]

/**
 * Maps a request URL onto a scenario id. Character-for-character the same
 * function `demos/react-official/src/App.jsx` and `demos/solid-official/src/App.jsx`
 * carry, so all three `template-ssr-*` lanes route identically.
 *
 * This runs on BOTH sides — `render(url)` on the server and
 * `window.location.pathname` on the client — and both sides must agree or Vue
 * would hydrate a different branch than it rendered. That disagreement is
 * exactly the class `src/dev-sink.ts` exists to catch, since Vue patches the DOM
 * to match the client and the page would otherwise look correct.
 */
export function scenarioFor(url: string | undefined): ScenarioId {
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
  // THE FIRST APPLICATION, and the only id here that is not an ordinal. It is
  // deliberately NOT part of the 6 x 9 three-way contract - `scripts/e2e.mjs`
  // pins `threeWayScenarios` to the literal ['s1'..'s9'] - so this route is
  // browsable only.
  if (path === 'todomvc') return 'todomvc'
  return 's1'
}

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
export const s8ResolvedGate: Promise<string> = Promise.resolve('go')
/** The live resolver of the promise `armS8Gate` most recently created. */
export const s8Gate: { release: () => void } = { release: () => {} }
export const armS8Gate = (): Promise<string> =>
  new Promise<string>((resolve) => {
    s8Gate.release = () => resolve('go')
  })
