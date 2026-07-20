# Frameless

Frameless is a compiler extension and behavioral analysis pipeline for authoring one bounded TSRX
component and checking conventional framework packages. `@frameless/compiler` extends the
Markless semantic graph with a versioned enriched IR; React and Solid own their adapters and
browser calibration independently.

The reserved product flow remains:

```sh
pnpm install
pnpm e2e
```

`pnpm e2e` intentionally fails until the demo build task lands. It must never report a skeleton as
a passing product run.

## Packages

- `packages/compiler` — Markless compiler extension producing `frameless-enriched-ir/1`.
- `packages/analyzer` — framework-free scenarios, traces, comparison, mutant data, and
  `frameless-receipts/1` results.
- `packages/frameworks/react` — React 19 adapter, handwritten reference, and browser calibration.
- `packages/frameworks/solid` — Solid 1.8.22 adapter, handwritten reference, and isolated browser
  calibration.
- `packages/cli` — reserved build entry and internal framework registration.
- `demos/ui-kit` — reserved bounded product demonstration.

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
