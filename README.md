# Frameless

Frameless is a compiler extension and behavioral analysis pipeline for authoring bounded TSRX
module sets and checking conventional framework packages. `@frameless/compiler` extends the
Markless semantic graph with a versioned enriched IR; React and Solid own their adapters and
browser calibration independently.

## Demo: one command, two frameworks, receipts

After restoring the workspace dependencies from a fresh checkout, the one product command is:

```sh
pnpm e2e
```

The command keeps the three independent ui-kit lanes unchanged, then builds composition-kit's five
TSRX modules with one multi-input CLI invocation. It runs both demos' portable scenarios against
React and Solid in separate headless-Chromium projects, evaluates the composition expectations in
each framework, compares React-emitted and Solid-emitted traces from the same authored sources, and
validates a `frameless-receipts/1` receipt under each demo's `receipts/` directory.

Composition-kit adds cross-file imports and default-slot projection, container-scoped shared state
read and updated by sibling components, a single-scalar shared tier, direct focus through an element
handle, and a literal attach cleanup witnessed after unmount. Its DOM-path assertion pins the
projected subtree beneath the emitted Frame structure rather than accepting text alone.

This is not proof over arbitrary user interaction, unsupported component features, SSR, hydration,
accessibility, or performance. Equivalence authority remains the two browser capture lanes and the
analyzer comparison; generated source shape or a node-only test is not a substitute.

## Packages

- `packages/compiler` — Markless compiler extension producing `frameless-enriched-ir/2`.
- `packages/analyzer` — framework-free scenarios, traces, comparison, mutant data, and
  `frameless-receipts/1` results.
- `packages/frameworks/react` — React 19 adapter, handwritten reference, and browser calibration.
- `packages/frameworks/solid` — Solid 1.8.22 adapter, handwritten reference, and isolated browser
  calibration.
- `packages/cli` — build entry and internal framework registration.
- `demos/ui-kit` — bounded cross-target product demonstration.
- `demos/composition-kit` — five-module composition, shared-state, handle, and cleanup demonstration.

The isolated `poc/**` packages remain read-only historical evidence and are not workspace members.
Owning package READMEs carry operational contracts and limits.

## Verification

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm test:browser
```

Browser calibration requires the locally cached Playwright Chromium build.
