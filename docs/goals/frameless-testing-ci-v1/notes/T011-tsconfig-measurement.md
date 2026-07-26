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

| Attempt | react | solid |
| --- | ---: | ---: |
| naive config | 28 | 26 |
| **+ `allowJs`, + ambient `tsrx-core.d.ts` in `include`** | **14** | **14** |

The second attempt resolved both *config* categories. Everything that remains is
a genuine type defect in test or reference code:

```
composition-calibration.browser.test.ts(173,5)  'string | number' not assignable to 'string'
composition-reference.tsx(107,10)               overload signature incompatible with implementation
composition-reference.tsx(118,3)                '(() => number) | (() => string)' not assignable to '() => number'
composition-reference.tsx(235,11)               'HTMLInputElement | null' not assignable to '... | undefined'
composition-reference.tsx(342,2)                component signature not assignable to '() => ReactNode'
```

Fourteen per package, identical in both. These are exactly what widening `check`
exists to surface - and exactly what this card's `stop_if` reserves for a
follow-up: "type errors that need PRODUCT changes rather than config changes -
record them and escalate; do not edit product code from this task."

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

The config half is now a solved, known recipe - reproduce the second attempt
above. The remaining work is fixing 14 real type errors per package in test and
reference code, then wiring `tsc -p` for both into the `check` script and
watching CI go red when a type error is reintroduced.

That is a bounded slice with a known cost, which is the point of this note.
