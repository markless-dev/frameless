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
| **+ widened component registries, + typed the strictmode map** | **9** | **10** |

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

## Landed so far

- `reactCompositionReferences` retyped `Record<string, () => ReactNode>` ->
  `Record<string, ComponentType<any>>`. Those pages take optional variant props
  used by the mutant builders, so the old type understated them.
- `solidCompositionReferences` likewise -> `(props?: any) => JSX.Element`.
- `strictmode.browser.test.ts`'s emitted map typed explicitly, because inferring
  it produces a union of three differently-shaped prop signatures. That error was
  introduced by this goal, so it was fixed here rather than left for the
  follow-up.

## The complete error inventory

Captured so the next attempt does not have to rediscover it. Reproduce by
recreating the second-attempt configs described above.

### `packages/frameworks/react` (14)

- `test/composition-calibration.browser.test.ts(173,5)` — Argument of type 'string | number' is not assignable to parameter of type 'string'.
- `test/composition-reference.tsx(107,10)` — This overload signature is not compatible with its implementation signature.
- `test/composition-reference.tsx(118,3)` — Argument of type '(() => number) | (() => string)' is not assignable to parameter of type '() => number'.
- `test/composition-reference.tsx(235,11)` — Argument of type 'HTMLInputElement | null' is not assignable to parameter of type 'HTMLInputElement | undefin
- `test/composition-reference.tsx(342,2)` — Type '({ variant, }: { variant?: "reference" | "omit" | "duplicate" | "wrapper" | undefined; }) => Element' i
- `test/composition-reference.tsx(343,2)` — Type '({ variant }: { variant?: StoreVariant | "desync" | undefined; }) => Element' is not assignable to type
- `test/composition-reference.tsx(344,2)` — Type '({ omitFocus, omitClear, }: { omitFocus?: boolean | undefined; omitClear?: boolean | undefined; }) => E
- `test/composition-reference.tsx(345,2)` — Type '({ variant }: { variant?: CleanupVariant | undefined; }) => Element' is not assignable to type '() => R
- `test/emitter.test.ts(898,26)` — Cannot assign to 'persistence' because it is a read-only property.
- `test/gate.test.ts(135,50)` — Property 'requiresArtifact' does not exist on type '({ readonly id: "persistence-render-lowering"; readonly d
- `test/gate.test.ts(690,3)` — Argument of type '(_name: "incomplete store hook record" | "inline context object" | "per-read snapshot rebui
- `test/gate.test.ts(702,15)` — Argument of type '"persistence-render-lowering"' is not assignable to parameter of type '"eslint-directive" |
- `test/gate.test.ts(704,79)` — Argument of type '"eslint-directive" | "R-SH5" | "R-SH1" | "R-SH3" | "R-RF1" | "R-RF3" | "component-shape" |
- `test/strictmode.browser.test.ts(54,31)` — Argument of type '(({ initial, onTrace }: { initial: any; onTrace: any; }) => Element) | (({ label, multiplie

### `packages/frameworks/solid` (14)

- `test/composition-calibration.browser.test.ts(173,5)` — Argument of type 'string | number' is not assignable to parameter of type 'string'.
- `test/composition-reference.solid.tsx(162,29)` — Type '(node: HTMLOutputElement) => void' is not assignable to type 'HTMLElement | ((el: HTMLElement) => void)
- `test/composition-reference.solid.tsx(310,2)` — Type '(props: { variant?: "reference" | "omit" | "duplicate" | "wrapper" | undefined; }) => Element' is not a
- `test/composition-reference.solid.tsx(311,2)` — Type '(props: { variant?: StoreVariant | "desync" | undefined; }) => Element' is not assignable to type '() =
- `test/composition-reference.solid.tsx(312,2)` — Type '(props: { omitFocus?: boolean | undefined; omitClear?: boolean | undefined; }) => Element' is not assig
- `test/composition-reference.solid.tsx(313,2)` — Type '(props: { variant?: CleanupVariant | undefined; }) => Element' is not assignable to type '() => Element
- `test/emitter.test.ts(868,26)` — Cannot assign to 'persistence' because it is a read-only property.
- `test/gate.test.ts(138,50)` — Property 'requiresArtifact' does not exist on type '({ readonly id: "persistence-render-lowering"; readonly d
- `test/gate.test.ts(609,3)` — Argument of type '(_name: "synthesized children prop" | "wrapped single projection" | "duplicated direct proj
- `test/gate.test.ts(618,15)` — Argument of type '"persistence-render-lowering"' is not assignable to parameter of type '"eslint-directive" |
- `test/gate.test.ts(620,79)` — Argument of type '"eslint-directive" | "component-shape" | "S-CH4" | "S-CH3" | "S-CH2" | "S-CH1" | "S-SH1" |
- `test/reference.solid.tsx(75,6)` — Type '{ "data-edit": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTarg
- `test/reference.solid.tsx(116,6)` — Type '{ "data-action": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTa
- `test/reference.solid.tsx(191,6)` — Type '{ "data-action": string; value: string; "attr:value": string; onInput: (event: InputEvent & { currentTa

### The shape of the work

Most of these fall into three repeating patterns, so the count overstates the
distinct effort:

1. **Component registries typed too narrowly** — a map declared as
   `() => Element` (or `() => ReactNode`) holding components that legitimately
   take optional props. Eight of the errors across both packages are this one
   pattern. Widening the registry type fixes them together.
2. **Union-of-signatures passed to a single-signature parameter** — e.g. the
   emitted-component maps in `strictmode.browser.test.ts` and the `test.each`
   tables in `gate.test.ts`. These need the map's value type stated once rather
   than inferred as a union.
3. **Genuinely loose spots** — `Cannot assign to 'persistence' because it is
   read-only`, `HTMLInputElement | null` vs `| undefined`, `string | number`
   passed where `string` is required. These are small and local.

**Pattern 1 is now fixed and committed** (see below), taking react 14 -> 9 and
solid 14 -> 10. The full suite stayed green at 551 tests through the change,
including every calibration lane - which is the empirical form of the argument
below.

None require changing runtime behavior, and the calibration suites would fail
loudly if an edit did - `mutants.ts` plus the calibration lanes assert that clean
references match and seeded mutants diverge. So this work is safer than it first
appears: the oracle protects itself.
