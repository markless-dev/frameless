import { Match, Switch } from 'solid-js'
import { EventForm } from './emitted/EventForm.jsx'
import { KeyedTodo } from './emitted/KeyedTodo.jsx'
import { NestedBoard } from './emitted/NestedBoard.jsx'
import { RenderOnce } from './emitted/RenderOnce.jsx'

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

/**
 * Maps a request URL onto a scenario id. The stock create-vite SSR scaffold
 * already threads `req.originalUrl` into `render(url)`, so branching on it here
 * mirrors the Qwik demo's `/`, `/s2`, `/s3` routes without adding a router.
 *
 * @param {string} url
 * @returns {'s1' | 's2' | 's3' | 's4'}
 */
export function scenarioFor(url) {
  const path = String(url ?? '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (path === 's2') return 's2'
  if (path === 's3') return 's3'
  if (path === 's4') return 's4'
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
    </Switch>
  )
}
