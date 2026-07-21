# Frameless

Frameless is a compiler that turns one Markless component into idiomatic
packages for existing frameworks — and proves the outputs behave the same.

You write `.tsrx` files once: HTML-like markup, JavaScript variables, plain
reads and writes. The Markless compiler records what that UI means — state,
derived values, events, shared state, element handles. Frameless takes that
recorded meaning and emits real framework code from it:

- React 19 packages that read like a careful React developer wrote them;
- Solid packages that read like a careful Solid developer wrote them;
- future targets.

```tsx
import { state } from '@markless/core';

export function Counter() @{
  let count = state(0);

  <button onClick={() => count++}>
    Clicked {count}
  </button>
}
```

From that one source, Frameless emits per-framework idioms — not a wrapper, not
a runtime adapter, and not a lowest-common-denominator translation:

```jsx
// React 19 output
const [count, setCount] = useState(0);
// click: const nextCount = count + 1; setCount(nextCount);
```

```jsx
// Solid output
const [count, setCount] = createSignal(0);
// click: setCount(count() + 1); reads stay count()
```

Each output goes through that framework's own conventionality gate — rules
derived from the framework's documentation and real-world code, enforced per
construct with tests that prove each rule can fail. Then both outputs run in
headless Chromium against scripted scenarios, and their behavior is compared
channel by channel: DOM, callbacks, keyed identity, focus. The result is a
validated receipt, not a claim.

In short:

```txt
Markless .tsrx source
  -> Markless semantic graph
  -> Frameless enriched IR (frameless-enriched-ir/2)
  -> React 19 emitter + gate
  -> Solid emitter + gate
  -> behavioral equivalence receipts (frameless-receipts/1)
```

## What It Is

- A compiler extension: `@frameless/compiler` extends the Markless semantic
  graph into a versioned, fail-closed enriched IR.
- Per-framework emitters that consume recorded semantics — state, derived
  values, events, keyed lists, conditionals, children/slots, shared state,
  element handles and attach behaviors — and never rediscover meaning from
  source text.
- Conventionality gates per framework: dossier-derived policies with a bypass
  mutation test behind every rule.
- A framework-free behavioral analyzer: scenarios, traces, comparison, mutant
  calibration, and `frameless-receipts/1` results in headless Chromium.
- A CLI that builds multi-file `.tsrx` module sets into both targets at once,
  gates the output at full strength, and writes build receipts.
- One documented command that proves the whole story end to end.

## Demo: one command, two frameworks, receipts

```sh
pnpm install
pnpm e2e
```

The command builds two demo libraries — `demos/ui-kit` (three single-file
components) and `demos/composition-kit` (five modules with cross-file imports,
slot projection, shared state across sibling components, element handles, and
attach cleanup) — into React 19 and Solid packages, runs every scripted
scenario against both outputs in separate headless-Chromium projects, compares
React-emitted and Solid-emitted traces from the same authored sources, and
validates a receipt under each demo's `receipts/` directory.

## What This Does Not Mean

Frameless does not claim proof over arbitrary programs. The receipts cover the
scripted scenario families the demos exercise. They do not cover unsupported
component features, SSR, hydration, accessibility, or performance.

Frameless also does not translate frameworks into each other's idioms. The
cross-target bar is behavioral: the same authored source may lower to a
provider in Solid and a props tier in React when each framework's own evidence
says so, as long as the rendered behavior is equal. The framework owns its
idiom. The receipts own the equality.

## Receipts

Every claim in this repository is backed by something that runs:

- emitter goldens with byte-freshness tests;
- gate policies with per-policy bypass mutations;
- calibration lanes where named mutant classes must be rejected before any
  emitted output is judged;
- cross-framework comparison receipts produced by the one documented command;
- fresh-checkout audits recorded on the goal boards under `docs/goals/`.

If a receipt cannot be produced honestly, the build fails instead.

## Packages

- `packages/compiler` — Markless compiler extension producing
  `frameless-enriched-ir/2`.
- `packages/analyzer` — framework-free scenarios, traces, comparison, mutant
  data, and `frameless-receipts/1` results.
- `packages/frameworks/react` — React 19 emitter, conventionality gate,
  browser-safe adapter, handwritten references, and calibration.
- `packages/frameworks/solid` — Solid emitter, gate, adapter, references, and
  isolated calibration (Solid 1.8.22 runtime fallback; the Solid 2 blocker is
  an executable contract test).
- `packages/cli` — build entry, module-set resolution, and internal framework
  registration.
- `demos/ui-kit` — bounded cross-target product demonstration.
- `demos/composition-kit` — five-module composition, shared-state, handle, and
  cleanup demonstration.

The isolated `poc/**` packages are read-only historical evidence, not
workspace members. Owning package READMEs carry operational contracts and
limits.

## Status

Frameless is under active implementation against the Markless compiler,
consumed as pinned vendored artifacts. Two milestones are complete, each
closed by a fresh-checkout audit:

- **v0** — the proven single-component surface: state, derived values, events,
  keyed lists, conditionals, controlled inputs.
- **Composition** — multi-component and multi-file: children/slots, shared
  state lowered per framework from recorded read/write granularity, element
  handles with attach cleanup, and cross-file module-set builds.

Recorded and gated, not yet built: cross-file shared state, named capture
slots, and cross-module handle forwarding (pending a Markless vendor refresh);
SSR lanes; persistence; additional targets.

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

Browser lanes require the locally cached Playwright Chromium build.

Read these first when changing the repo:

- [CONTRIBUTING.md](./CONTRIBUTING.md) for the package map and workflow.
- [AGENTS.md](./AGENTS.md) for project rules.
- `docs/goals/` for the decision and receipt trail behind the current design.

## Agent Guidance

AI agent rules are sourced from [`.ruler/`](.ruler/) and generated with
[Ruler](https://github.com/intellectronica/ruler) via `pnpm rules`.
`AGENTS.md` is a generated file — edit `.ruler/` instead and rerun
`pnpm rules`.
