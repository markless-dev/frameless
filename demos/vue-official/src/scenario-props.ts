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
export type ScenarioId = 's1' | 's2' | 's3' | 's4'

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
  return 's1'
}
