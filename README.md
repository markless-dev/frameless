# Frameless

Write your components once. Compile them to any framework. Get code that looks
hand-written and provably works the same everywhere.

You write `.tsrx` files: HTML-like markup, JavaScript variables, plain reads
and writes. Frameless records what your component does (state, events,
updates) and generates real framework code from that record. No wrapper, no
runtime layer. Solid output uses signals. React output uses hooks and works
with the React ecosystem. When we add a resumable framework, that output will
be resumable.

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

```jsx
// React 19 output
const [count, setCount] = useState(0);
// on click: const nextCount = count + 1; setCount(nextCount);
```

```jsx
// Solid output
const [count, setCount] = createSignal(0);
// on click: setCount(count() + 1); reads stay count()
```

Every output is checked against style rules for its framework, and every rule
has a test proving it can catch a violation. Then both outputs run in a real
headless browser against the same scripted actions, and their behavior is
compared: DOM, callbacks, list identity, focus. Match, and a report file is
written. Mismatch, and the build fails.

```txt
your .tsrx file
  -> what the component means
  -> React 19 output, checked
  -> Solid output, checked
  -> browser report proving both behave the same
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

## Could AI Not Just Do This?

An AI translation often looks right. Looks right is the problem: it is a
guess, it changes every run, it can quietly change behavior, and someone has
to review every file for every framework after every change.

Frameless works from a semantic record of what each component does, so the
generators cannot misread your code. Same input, same output, style-checked,
behavior proven in a browser, rerun in CI on every change.

The two work best together: let AI write your Frameless components (one small
model to be good at, instead of five frameworks to be mediocre at) and let the
compiler carry them everywhere with proof. And if you ever truly need to
maintain a framework by hand, start from the compiled output. It is real,
idiomatic code. Eject when you get there, not before.

## What It Does Not Do

The browser tests cover the scripted scenarios in the demos, not every
possible program, and not yet SSR, accessibility, or performance.

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

- `packages/compiler` compiles `.tsrx` into a record of component meaning.
- `packages/analyzer` runs browser scenarios and compares behavior.
- `packages/frameworks/react` generates and checks React 19 output.
- `packages/frameworks/solid` generates and checks Solid output.
- `packages/cli` builds many files at once and writes build reports.
- `demos/` holds the two demo libraries. `poc/` is early evidence, not
  product.

## Status

Done, each verified from a fresh clone: **v0** (single components: state,
derived values, events, keyed lists, conditionals, inputs) and **Composition**
(multiple components and files: children, shared state, element access with
cleanup).

Planned: shared state across files, named slots, SSR tests, saved state
(localStorage and friends), more frameworks.

## Development

```sh
pnpm install
pnpm test
pnpm check
pnpm lint
pnpm fmt
pnpm build
pnpm e2e
```

Browser tests need the locally cached Playwright Chromium build. Read
[CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md) before
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
