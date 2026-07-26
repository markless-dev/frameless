# T011 — measured, not landed

`pnpm check` still does not cover test files. This note records what the work
actually costs, so the next attempt starts from evidence instead of the guess
T004 made.

## What was tried

Per-package `tsconfig.json` for `packages/frameworks/{react,solid}`, each
extending the root config and overriding JSX — `react-jsx` for React,
`jsxImportSource: "solid-js"` for Solid — with `include` covering `src`, `test`
and `scripts`.

This is the right shape: it resolves the structural problem T004 hit, where a
single root config cannot type-check both framework test trees because Solid's
`.tsx` gets React's JSX types.

## What it costs

| Package | `error TS` count |
| --- | ---: |
| react | 28 |
| solid | 26 |

Three categories, in rough order of volume:

1. **`@tsrx/core` has no declarations** (TS7016). An ambient declaration exists
   at `packages/compiler/src/tsrx-core.d.ts` but the per-package configs do not
   pull it in. Fixable by including it or moving it somewhere shared.
2. **Emitted `.jsx` imports are implicitly `any`** (TS7016) — e.g.
   `../generated-composition/C1-slot.jsx`. Needs `allowJs`, and interacts with
   T005's emitted-output type-checking, which already type-checks those files
   with a deliberately tuned config. The two should share settings rather than
   drift.
3. **At least one genuine type error in test code**:
   `composition-calibration.browser.test.ts(173,5)` — `Argument of type
   'string | number' is not assignable to parameter of type 'string'`. Identical
   line in both packages. This is the kind of thing widening `check` exists to
   find, and it is real rather than a config artifact.

## Why it was not landed

Category 3 means this is not a configuration change — it requires editing test
code, and category 2 requires reconciling with T005's config. That is a coherent
slice of work, and half-landing it (adding configs that are not wired into
`pnpm check` because they are red) would leave the repo worse: two unused files
implying a guarantee that does not hold.

The configs were written, measured, and **reverted to a clean tree**.

## Next step

One task that, in order: pulls the `@tsrx/core` declaration into scope, enables
`allowJs` consistently with T005, fixes the `string | number` error, then wires
`tsc -p` for both packages into the `check` script and watches CI go red if a
type error is reintroduced.
