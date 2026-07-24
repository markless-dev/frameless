<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
  <img alt="Frameless. Write components once. Compile to any framework. Prove it." src="assets/banner-light.svg" width="720">
</picture>

Write your components once. Compile them to any framework. Get code that looks
hand-written and provably works the same everywhere.

You write `.tsrx` files: HTML-like markup, JavaScript variables, plain reads
and writes. Frameless records what your component does (state, events,
updates) and generates real framework code from that record. No wrapper, no
runtime layer. Solid output uses signals. React output uses hooks and works
with the React ecosystem. Qwik output is resumable — no hydration pass, and
handlers fetched on demand.

```tsx
import { state } from '@frameless.md/core';

export function Counter() @{
  let count = state(0);

  <button onClick={() => count++}>
    Clicked {count}
  </button>
}
```

From that one file:

<table>
<tr>
<th>React 19 output</th>
<th>Solid output</th>
</tr>
<tr>
<td>

```jsx
const [count, setCount] = useState(0);
// on click:
// const nextCount = count + 1;
// setCount(nextCount);
```

</td>
<td>

```jsx
const [count, setCount] = createSignal(0);
// on click:
// setCount(count() + 1);
// reads stay count()
```

</td>
</tr>
</table>

Every output is checked against style rules for its framework, and every rule
has a test proving it can catch a violation. Then both outputs run in a real
headless browser against the same scripted actions, and their behavior is
compared: DOM, callbacks, list identity, focus. Match, and a report file is
written. Mismatch, and the build fails.

```mermaid
flowchart LR
    A["your .tsrx file"] --> B["semantic record:<br/>what the component means"]
    B --> C["React 19 output"]
    B --> D["Solid output"]
    C --> SC["style rules"]
    D --> SD["style rules"]
    SC --> E{"same behavior<br/>in a real browser?"}
    SD --> E
    E -- yes --> F["report written"]
    E -- no --> G["build fails"]
```

## Try It

```sh
pnpm install
pnpm e2e
```

Builds both demo libraries (`demos/ui-kit` and `demos/composition-kit`, which
has cross-file imports, children, shared state, and element access with
cleanup) into React 19 and Solid, runs them in a headless browser, and writes
a report under each demo's `receipts/` folder.

## See It Yourself: Hydrate, Hydrate, Resume

One source. Three frameworks. Two activation models. The same behavior.

```sh
pnpm install
pnpm demo
```

That boots all three official demo apps — each through its own untouched
framework scaffold, none of them a hand-rolled harness — and prints their URLs
once all three answer. Ctrl-C stops all three.

| Demo  | URL                      | Activation | S1  | S2     | S3     |
| ----- | ------------------------ | ---------- | --- | ------ | ------ |
| React | <http://localhost:5173/> | hydrates   | `/` | `/s2`  | `/s3`  |
| Solid | <http://localhost:5174/> | hydrates   | `/` | `/s2`  | `/s3`  |
| Qwik  | <http://localhost:5175/> | resumes    | `/` | `/s2/` | `/s3/` |

Qwik's nested routes keep their trailing slash — its router normalises `/s2`
to `/s2/`.

The three scenarios: **S1** a counter that renders once (`kit:2`, click, `kit:4`),
**S2** a keyed to-do list (add, remove, reorder, clear), **S3** a form with
events and inputs.

### One source, all the way down

Nothing in those three apps is hand-written per framework. Each column is
generated from the column to its left.

| Scenario | You write                                             | Compiler records (IR)                                | Frameless emits                                           | Demo imports                                                            |
| -------- | ----------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| S1       | `packages/compiler/test/fixtures/s1-render-once.tsrx` | `packages/compiler/test/goldens/s1-render-once.json` | `packages/frameworks/{react,solid,qwik}/generated/S1.jsx` | `demos/{react-official,solid-official,qwik}/src/emitted/RenderOnce.jsx` |
| S2       | `packages/compiler/test/fixtures/s2-keyed-todo.tsrx`  | `packages/compiler/test/goldens/s2-keyed-todo.json`  | `packages/frameworks/{react,solid,qwik}/generated/S2.jsx` | `demos/{react-official,solid-official,qwik}/src/emitted/KeyedTodo.jsx`  |
| S3       | `packages/compiler/test/fixtures/s3-event-form.tsrx`  | `packages/compiler/test/goldens/s3-event-form.json`  | `packages/frameworks/{react,solid,qwik}/generated/S3.jsx` | `demos/{react-official,solid-official,qwik}/src/emitted/EventForm.jsx`  |

The emitted files are committed, so you can read them before you run anything.
Each demo's `copy-emitted` script copies them into `src/emitted/`; the demo
itself only imports them.

### Watch the difference yourself

**1. View source.** On <http://localhost:5173/> and <http://localhost:5174/> you
get server-rendered markup plus `<script type="module" src="/src/entry-client.jsx">`.
That module has to download and run before the page reacts to anything — that
is hydration. On <http://localhost:5175/> you get `<html q:container="paused">`
and handlers already named in the markup as `q-e:click` QRL attributes. There
is no hydration pass to wait for. (In dev the attribute's value is an
indirection, `q-e:click="/@qwik-handlers#_run#4"` — the real per-handler
segment URL shows up in step 3.)

**2. Ask the server, not the browser.** Same markup, straight off the wire:

```sh
curl -s localhost:5175/ | grep -o 'q:container="[^"]*"'   # q:container="paused"
curl -s localhost:5173/ | grep -o 'q:container="[^"]*"'   # nothing
curl -s localhost:5174/ | grep -o 'q:container="[^"]*"'   # nothing
```

**3. Open DevTools → Network, filter to JS, then click increment.** On :5173 and
:5174, nothing new is fetched — the component's code arrived with the client
entry before you clicked. On :5175, Qwik fetches exactly one file, a URL
containing `_component_div_section_button_q_e_click_`. That is that button's own
click handler, pulled on demand, at click time, because you clicked it.

Same component. Same behavior. Two entirely different ways of getting there.

### This is machine-checked, not eyeballed

`pnpm e2e` drives all three demos through one shared contract,
[`demos/react-official/three-way-contract.ts`](./demos/react-official/three-way-contract.ts),
in a real browser: same scenarios, same expected values, same scripted actions.
Each lane records what it actually measured out of the live DOM, and
`scripts/e2e.mjs` diffs the three sets of measurements — nine cells (3
frameworks × 3 scenarios), all equal, or the command exits non-zero.

The Qwik lane additionally asserts the handler QRLs its clicks pulled on demand
and the `paused` → `resumed` container transition; the React and Solid lanes
assert the matching negatives — their served payloads carry no Qwik container
and no activation marker until their client entry runs.

## Why Not the Alternatives?

| Alternative                | How it works                                                                              | The catch                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mitosis**                | Translates a restricted JSX dialect, syntax to syntax. More targets than Frameless today. | Every framework gets the same lowest-common-denominator component. Verified by string snapshots, not behavior. Unsupported patterns can quietly produce wrong code. |
| **AI ports per framework** | An AI rewrites your component for each framework.                                         | It is a guess. It changes every run, it can quietly change behavior, and someone has to review every file for every framework after every change.                   |
| **Hand-written ports**     | You maintain one codebase per framework.                                                  | N times the work, N times the bugs, and drift the moment one port gets a fix the others do not.                                                                     |
| **Web components**         | One runtime shared by every framework.                                                    | Native to none of them. Friction around props, events, and SSR.                                                                                                     |

Frameless takes the other road: compile a semantic record of what your
component means, emit what each framework's own best practice calls for,
reject what it cannot prove, and verify behavior in a real browser.

> [!TIP]
> AI and Frameless work best together. Let AI write your Frameless components
> (one small model to be good at, instead of five frameworks to be mediocre
> at) and let the compiler carry them everywhere with proof.

> [!NOTE]
> Need hand-maintained framework code someday? Start from the compiled
> output. It is real, idiomatic code. Eject when you get there, not before.

## What It Does Not Do

The browser tests cover the scripted scenarios in the demos, not every
possible program. SSR behavior is proven for CLI-emitted React, Solid, and Qwik
output; accessibility and performance are not yet proven.

`pnpm demo` and the three-way `pnpm e2e` lanes exercise the **dev-mode SSR
path** — which is the path a newcomer actually runs. The express production
build of the React and Solid demos is verified by `curl` only, not by a browser
lane.

Frameworks are not forced to copy each other. The same component may compile
to different shapes in React and Solid when that is each framework's own best
practice. Each framework owns its style. The tests own the proof that behavior
matches.

## How We Test

- Generated output is committed, and tests fail if it drifts.
- Every style rule has a test proving it catches a bad output.
- The browser tests are calibrated against intentionally broken components
  first, so we know they can fail.
- The demo command's report cannot be produced dishonestly; the build fails
  instead.
- Every finished milestone was verified from a fresh clone. The decision trail
  lives under `docs/goals/`.

## Packages

| Package                     | What it does                                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/compiler`         | Compiles `.tsrx` into a record of component meaning.                                                                                                                                                                  |
| `packages/analyzer`         | Runs browser scenarios and compares behavior.                                                                                                                                                                         |
| `packages/frameworks/react` | Generates and checks React 19 output.                                                                                                                                                                                 |
| `packages/frameworks/solid` | Generates and checks Solid output.                                                                                                                                                                                    |
| `packages/frameworks/qwik`  | Generates and checks Qwik output (resumable, not hydrated).                                                                                                                                                           |
| `packages/cli`              | Builds many files at once and writes build reports.                                                                                                                                                                   |
| `demos/`                    | Seven demos: the two compiled libraries (`ui-kit`, `composition-kit`), the SSR and saved-state witness lanes, and the three official React/Solid/Qwik apps behind `pnpm demo`. `poc/` is early evidence, not product. |

## Status

| Milestone                                                                                    | Status                                                                  |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **v0**: single components (state, derived values, events, keyed lists, conditionals, inputs) | ✅ Shipped, verified from a fresh clone                                 |
| **Composition**: children, shared state, element access with cleanup                         | ✅ Shipped, verified from a fresh clone                                 |
| Shared state across files, named slots                                                       | Planned                                                                 |
| SSR tests                                                                                    | Proven (behavioral, via witness — `pnpm e2e`)                           |
| Saved state (localStorage): render-time reads → pre-paint seed + write-through               | Proven (behavioral, React/Solid, via witness — `pnpm e2e`)              |
| **Qwik**: resumable output, activation-neutrality across three frameworks                    | ✅ Shipped (React hydrates, Solid hydrates, Qwik resumes — `pnpm demo`) |
| More frameworks (Angular, Vue, Svelte)                                                       | Planned                                                                 |

## Development

```sh
pnpm install
pnpm test
pnpm check
pnpm lint
pnpm fmt
pnpm build
pnpm e2e
pnpm demo
```

Browser tests need the locally cached Playwright Chromium build. The SSR witness lane can also use
a system Chromium-family browser; see [demos/ssr/README.md](./demos/ssr/README.md) for provisioning
and receipt details. Read [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md) before
changing the repo.

## Markless

Frameless components are API-compatible with
[Markless](https://github.com/markless-dev/markless), a resumable UI framework
that renders the same component model to web and native (UIKit, AppKit) with
no hydration and no virtual DOM. Frameless is built on the Markless compiler.
Same components, two ways to ship: run them on Markless, or compile them into
the framework your team already uses.

## Agent Guidance

AI agent rules come from [`.ruler/`](.ruler/), generated with
[Ruler](https://github.com/intellectronica/ruler) via `pnpm rules`.
`AGENTS.md` is generated. Edit `.ruler/` and rerun `pnpm rules`.
