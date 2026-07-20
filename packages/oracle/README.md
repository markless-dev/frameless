# @frameless/oracle

Reusable, framework-neutral behavioral verification infrastructure for Frameless. The public
package owns the versioned adapter lifecycle, scenario/action data, DOM and callback traces,
exact comparison, mutant-class inventory, verdicts, and `frameless-receipts/1` rendering.

The implementation is a content-preserving product-lane migration of the oracle core from
`poc/04-equivalence-oracle` and the browser/quiescence and results patterns from
`poc/08-equivalence-results`. It deliberately exports no React, Solid, compiler, IR, Vite,
filesystem, gate, or dossier types.

## Contracts

- Oracle trace contract: `frameless-equivalence-oracle/1`.
- Receipt artifact contract: `frameless-receipts/1`.
- Adapter dispatch: `dispatch(handle, action): void | Promise<void>`.
- Phases: mount; immediately before dispatch; after the dispatch promise resolves; after one
  additional microtask; after bounded quiescence. Sleeps are forbidden.
- Normalization removes only `data-reactroot` and `data-solid-render-id`. Classes, styles,
  `data-*`, unknown attributes, live form properties, focus, selection, keyed identity, and
  callbacks remain observable.
- Receipt pair states include `equal`, `different`, and `blocked-by-upstream`; blocked legs
  require finding ids and never count as passes.

`renderResults(receipt)` deterministically generates `RESULTS.md` from the machine-readable
verdict artifact. Artifact placement under a build's `receipts/` directory is owned by the
calling CLI; the oracle remains filesystem-free.

## Test lanes

```sh
pnpm test
pnpm test:browser
```

The node project covers compare, normalization/version, and receipt validation/rendering. The
`oracle-browser` project runs in locally cached headless Playwright Chromium under Vitest 4 and
Vite 8. Calibration-only fixtures live under `test/`: React is pinned to 19.2.3 and uses
`await act(async () => ...)`; Solid is pinned to the disclosed 1.8.22 fallback and transformed
only for `*.solid.tsx`. These fixtures and adapters are not exports. The production React and
Solid adapters belong to their target packages.

The browser suite compares handwritten React and Solid for every calibration scenario and
requires every one of the eight migrated mutant classes to be rejected in its declared
channel. It fails closed on mutant drift.

## Findings and current evidence

- Async dispatch changes the meaning of `action:n:after`: it is now observed after the
  framework event transaction promise resolves. The existing `microtask` phase remains one
  additional microtask later. Callback phase labels during dispatch remain `action:n:after`.
- React 19 calibration has not been claimed in this worker sandbox. The worktree had no
  `node_modules`, and `pnpm install --offline` stopped on the already-existing root dependency
  `@types/node@24.12.2` missing from the local store. No receipt was fabricated.
- The migrated timing mutant still uses its original `queueMicrotask` defect. Async React 19
  `act` may drain that microtask before the after-dispatch observation. If the browser suite no
  longer rejects it, that is an oracle-integrity failure requiring adjudication, not permission
  to silently alter the mutant or phase contract.

## Scope boundary

This package proves only the fixture- and phase-scoped CSR behavior exercised by its receipts.
It does not claim general framework equivalence, SSR/hydration, async application semantics,
composition, performance, accessibility, or production target-adapter support.
