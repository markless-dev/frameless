# Frameless

Write your components once. Compile them to any framework. Get code that looks
hand-written and works the same everywhere.

You write `.tsrx` files. They look like normal components: HTML-like markup,
JavaScript variables, plain reads and writes. Frameless understands what your
component does (its state, its events, its updates) and generates real
framework code from that understanding:

- React 19 packages that look like a careful React developer wrote them;
- Solid packages that look like a careful Solid developer wrote them;
- more frameworks over time.

There is no wrapper and no runtime layer. Each output is real code for that
framework. Solid output uses signals. React output uses hooks and works with
the React ecosystem. When we add a resumable framework, that output will be
resumable. You write the component once, and each framework's strengths come
free with the compile.

```tsx
import { state } from '@frameless.md/core';

export function Counter() @{
  let count = state(0);

  <button onClick={() => count++}>
    Clicked {count}
  </button>
}
```

From that one file, Frameless generates code the way each framework wants it
written:

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

Then Frameless checks its own work, twice:

1. Every output is checked against style rules for that framework. The rules
   come from the framework's docs and from real-world code, and every rule has
   a test proving it can catch a violation.
2. Both outputs run in a real headless browser against the same scripted user
   actions. Frameless compares what each one did: the DOM, the callbacks, list
   item identity, focus. If they match, it writes a report file. If they do
   not match, the build fails.

The short version:

```txt
your .tsrx file
  -> what the component means (state, events, shared state, element access)
  -> React 19 output, checked
  -> Solid output, checked
  -> browser test report proving both behave the same
```

## What You Get

- One authoring model. Components, state, derived values, events, lists,
  conditionals, children, shared state, and element access.
- Generated code that follows each framework's best practices, not a
  one-size-fits-all translation.
- Style checks for every output, with tests behind every rule.
- Real browser tests that compare the outputs' behavior action by action.
- A command line tool that builds a whole folder of components into every
  framework at once.
- One command that runs the entire story end to end.

## Try It

```sh
pnpm install
pnpm e2e
```

This builds the two demo libraries in this repo. `demos/ui-kit` has three
simple components. `demos/composition-kit` has five files that import each
other, pass children around, share state between components, and use element
access with cleanup. Both demos compile to React 19 and Solid, run in a
headless browser, and produce a report file under each demo's `receipts/`
folder showing the outputs behaved the same.

## What It Does Not Do

Frameless does not promise that any possible program works. The browser tests
cover the scripted scenarios in the demos. They do not cover features we have
not built yet, server-side rendering, accessibility, or performance.

Frameless also does not force frameworks to copy each other. The bar is
behavior. The same component may compile to different shapes in React and
Solid when that is what each framework's own best practice says. Each
framework owns its style. The tests own the proof that behavior matches.

## Could AI Not Just Do This?

It is fair to ask. An AI can translate a component from one framework to
another, and the result often looks right. Looks right is the problem.

A translation is a guess. It can quietly change behavior, it comes out
different every time you run it, and someone has to review every file, for
every framework, after every change. That does not scale past a handful of
components.

Frameless works from a semantic graph instead. The compiler records exactly
what each component does: which events write which state, which text depends
on which value, what runs on cleanup. The generators work from that record, so
they cannot misread your code. The same input produces the same output every
time, the output is checked against each framework's rules, and the behavior
is proven in a real browser. Change a component and the whole pipeline reruns
in CI with a fresh report.

The two work best together. Let AI write your Frameless components: it is one
small, simple model to be good at, instead of five frameworks to be mediocre
at. Then let the compiler carry them to every framework, because the compiler
can prove what it produced. AI writes once. Frameless multiplies it with
receipts.

## How We Test

Every claim in this repo is backed by something that runs:

- generated output is saved in the repo and tests fail if it drifts;
- every style rule has a test that proves it catches a bad output;
- the browser tests are checked against intentionally broken components first,
  so we know they can fail;
- the demo command writes a report file, and the build fails if the report
  cannot be produced honestly;
- each finished milestone was verified from a fresh clone of the repo, and the
  full decision trail lives under `docs/goals/`.

## Packages

- `packages/compiler` compiles `.tsrx` files into a record of what each
  component means.
- `packages/analyzer` runs the scripted browser scenarios and compares
  behavior between outputs.
- `packages/frameworks/react` generates and checks the React 19 output.
- `packages/frameworks/solid` generates and checks the Solid output.
- `packages/cli` is the build command. It compiles many files at once and
  writes build reports.
- `demos/ui-kit` and `demos/composition-kit` are the demo libraries.

The `poc/` folder is early proof work. It is kept as evidence and is not part
of the product.

## Status

Two milestones are done. Each one was verified from a fresh clone before we
called it done:

- **v0**: single components with state, derived values, events, keyed lists,
  conditionals, and controlled inputs.
- **Composition**: multiple components and multiple files, with children,
  shared state, and element access with cleanup.

Planned next, in the open: shared state across files, named slots, passing
element access between files, server-side rendering tests, saved state
(localStorage and friends), and more frameworks.

## Development

```sh
pnpm install
pnpm test
pnpm check
pnpm lint
pnpm fmt
pnpm build
pnpm e2e
pnpm test:browser
pnpm test:poc
```

The browser tests need the locally cached Playwright Chromium build.

Read these first when changing the repo:

- [CONTRIBUTING.md](./CONTRIBUTING.md) for the package map and workflow.
- [AGENTS.md](./AGENTS.md) for project rules.
- `docs/goals/` for the decisions and evidence behind the current design.

## Markless

The components you write for Frameless are API-compatible with
[Markless](https://github.com/markless-dev/markless), a resumable UI framework
that renders the same component model to the web and to native apps (UIKit on
iOS, AppKit on macOS) with no hydration and no virtual DOM. Frameless is built
on the Markless compiler.

Same components, two ways to ship: run them on Markless itself, or compile
them with Frameless into the framework your team already uses.

## Agent Guidance

AI agent rules come from [`.ruler/`](.ruler/) and are generated with
[Ruler](https://github.com/intellectronica/ruler) via `pnpm rules`.
`AGENTS.md` is a generated file. Edit `.ruler/` and rerun `pnpm rules`.
