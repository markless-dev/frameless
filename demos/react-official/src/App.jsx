import { EventForm } from './emitted/EventForm.jsx'
import { KeyedTodo } from './emitted/KeyedTodo.jsx'
import { RenderOnce } from './emitted/RenderOnce.jsx'

// One shared IR, three emitters. These props are the same ones demos/qwik passes
// in src/routes/**, so the three official demos are directly comparable.
const noTrace = () => {}
const s2Seed = [
  { id: 'a', title: 'one', done: false },
  { id: 'b', title: 'two', done: true },
]

/**
 * Maps a request URL onto a scenario id. The stock create-vite SSR scaffold
 * already threads `req.originalUrl` into `render(url)`, so branching on it here
 * mirrors the Qwik demo's `/`, `/s2`, `/s3` routes without adding a router.
 *
 * @param {string} url
 * @returns {'s1' | 's2' | 's3'}
 */
export function scenarioFor(url) {
  const path = String(url ?? '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (path === 's2') return 's2'
  if (path === 's3') return 's3'
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
    default:
      return <RenderOnce label="kit" multiplier={2} visible={true} onTrace={noTrace} />
  }
}
