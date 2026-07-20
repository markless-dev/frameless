# Frameless

Frameless is a compiler extension and behavioral analysis pipeline for authoring one bounded TSRX
component and checking conventional framework packages. `@frameless/compiler` extends the
Markless semantic graph with a versioned enriched IR; React and Solid own their adapters and
browser calibration independently.

## Demo: one command, two frameworks, receipts

From a fresh checkout:

```sh
pnpm install && pnpm e2e
```

The command compiles all three ui-kit TSRX components to React and Solid JSX, runs every portable
scenario against each target in its own headless-Chromium project, compares the serialized analyzer
traces, and validates `demos/ui-kit/receipts/frameless-receipts.json`. A passing receipt proves that
the two emitted targets behaved equally for those scripted scenarios under the analyzer.

This is not proof over arbitrary user interaction, unsupported component features, SSR, hydration,
accessibility, or performance. Equivalence authority remains the two browser capture lanes and the
analyzer comparison; generated source shape or a node-only test is not a substitute.

## Packages

- `packages/compiler` — Markless compiler extension producing `frameless-enriched-ir/1`.
- `packages/analyzer` — framework-free scenarios, traces, comparison, mutant data, and
  `frameless-receipts/1` results.
- `packages/frameworks/react` — React 19 adapter, handwritten reference, and browser calibration.
- `packages/frameworks/solid` — Solid 1.8.22 adapter, handwritten reference, and isolated browser
  calibration.
- `packages/cli` — build entry and internal framework registration.
- `demos/ui-kit` — bounded cross-target product demonstration.

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
