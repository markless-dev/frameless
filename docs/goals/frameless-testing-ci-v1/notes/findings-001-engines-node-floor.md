# Finding 001 — `engines.node: ">=20"` is not true

**Status:** open, recorded not fixed
**Found by:** CI run 1 on `goal/frameless-testing-ci-v1`
([run 30216328175](https://github.com/markless-dev/frameless/actions/runs/30216328175))
**Severity:** medium — affects contributors and any consumer trusting `engines`
**Owner of the fix:** T007 (Node axis), per the rationale below

## What happened

The first CI run set `node-version: 20`, matching the root `package.json`
`engines.node: ">=20"`. Three of four jobs failed, and the two that were not
about Playwright shared one root cause:

```
Failed to load configuration file.
/home/runner/work/frameless/frameless/vite.config.ts
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
TypeScript config files require Node.js ^20.19.0 || >=22.12.0.
Detected Node.js v20.20.2.
```

Consequences observed:

- `pnpm lint` — failed outright (`vp lint` cannot load `vite.config.ts`).
- `pnpm test` — 2 failed / 517 passed. Both failures were
  `packages/frameworks/{react,solid}/test/format-emitted.test.ts > matches the
  repository vp fmt configuration`, which shells out to
  `npx vp fmt --stdin-filepath ...` and inherits the same config-load failure.
- `pnpm check` passed (plain `tsc`, no vite config involved).

Local development runs **Node v24.15.0**, which is why this has never been seen.

## Why it is not fixed here

The obvious patch is to bump `engines.node`. I did not, for a specific reason:
**I do not know the correct floor, and inventing one would be worse than leaving
it wrong.**

The error text itself is self-contradictory against the observation. It claims
`^20.19.0 || >=22.12.0` is acceptable, and reports detecting `v20.20.2` —
which *satisfies* `^20.19.0` — then fails anyway. So the real constraint is not
what the message says it is. Possible explanations (native TS type-stripping
landed well after 20.19; a `require(esm)` interaction; a transitive tool with a
stricter check) are all speculation until tested.

Writing `">=22.12.0"` on that basis would be substituting one unverified claim
for another in a file that consumers read as a promise.

## How it gets resolved

T007 builds the Node axis (`ubuntu × Node 20, 22, 24`). That matrix will
establish the true floor **empirically** — the lowest Node on which the full
suite is green. T007's `expected_output` now includes setting `engines.node`
to that measured value.

Until then CI pins Node 24, which is known-good because it matches the
environment all existing work was verified in.

## Why this finding matters beyond itself

This is the first thing CI caught, on its first run, and nobody planted it. It
is direct evidence for T003 Ruling 1 — that landing CI before fixing known
defects produces better calibration than the reverse order. The goal predicted
CI would go red on the browser lane; it went red on the browser lane *and* on a
defect nobody knew existed.

It also sharpens the audit's original point. `frameless-testing-strategy-v1`
argued the danger of "it works on my laptop". This is precisely that: a
supported-version claim in `package.json` that was false on every machine except
the author's.
