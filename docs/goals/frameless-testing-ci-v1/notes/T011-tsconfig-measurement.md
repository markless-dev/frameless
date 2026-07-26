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
| **+ three local fixes** | **6** | 10 |
| **+ overload return type, getter-union cast, gate narrowing** | **1** | 10 |
| **+ the same four fixes transferred to Solid** | 1 | 5 |
| **+ `attr:*` JSX namespace declaration, ref variance cast** | **1** | **1** |

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

### Round three — the small local ones (react 9 -> 6)

- `composition-calibration.browser.test.ts` — the rejection table's `scenario`
  key is `string | number`; wrapped in `String()` at the call site.
- `composition-reference.tsx` — a ref callback receives `HTMLInputElement | null`
  while the setter models "cleared" as `undefined`. Passed `node ?? undefined`,
  which matches the cleanup path immediately below it that already passes
  `undefined`.
- `emitter.test.ts` — assignment to the readonly `records.persistence`. The
  object being mutated is a `clone()` made precisely to be mutated, so the cast
  states that intent rather than loosening the contract anywhere real.

Suite green at 551 tests after each round.

### Round four — react 6 -> 1

- `composition-reference.tsx` — the overloaded `useCompositionShared` needed an
  explicit return type on its implementation signature; TypeScript cannot
  reconcile an *inferred* union return against three overloads (TS2394).
- Same file — the `useSyncExternalStore` getter ternary yields a union of
  functions, which a single-signature parameter rejects. Cast at the call site;
  the runtime value is untouched.
- `gate.test.ts` — `requiresArtifact` exists on only some members of the policy
  union, so it needs an `in` guard before access (same predicate at runtime); and
  `covered` was inferred as a Set of just the literal ids present in the mutation
  tables, which then rejected both the `add()` and the `has()` against the full
  policy list. Declared `Set<string>`.

### What is left (react 1, solid 10)

**React: one error.** `gate.test.ts(690,3)` — the `test.each` table's callback
signature against a large tuple union. This is the one place where a careless
narrowing could weaken the policy assertions the gate depends on, so it was left
rather than guessed at.

**Solid: five.** The transferable fixes moved it 10 -> 5. What remains splits
into two groups:

- **One `test.each` signature** in `gate.test.ts`, the exact twin of React's last
  one. Same reasoning for leaving it: a careless narrowing here weakens the
  policy assertions the gate depends on.
- **One ref-callback variance** in `composition-reference.solid.tsx(162)`.
- **Three `attr:value` errors in `reference.solid.tsx` — these are FINDING 002**,
  and their appearance here is informative. The *handwritten* Solid references
  use `attr:value` too, not just emitted output. So the emitter is reproducing a
  deliberate house idiom rather than inventing something, and the real question
  is whether solid-js's `InputHTMLAttributes` should admit `attr:*` at all.
  Closing them means either a JSX namespace augmentation or an upstream fix -
  see findings-002-solid-attr-namespace.md. Not a type-annotation problem.

### Round five — solid 5 -> 1

- **`test/solid-attr-namespace.d.ts`** declares `attr:${string}` on solid-js's
  `JSX.CustomAttributes`. This resolved all three finding-002 errors. It is a
  *description of real behavior*, not a suppression: `attr:value` works at
  runtime, which is why the handwritten references use it and why `pnpm e2e` and
  the Solid browser lane are green. It does NOT settle finding 002's actual
  question - whether the emitter should use `attr:` at all, and whether the
  declaration belongs upstream in solid-js.
- A ref-callback contravariance cast in `composition-reference.solid.tsx`.

**A mistake worth recording.** The first version of that cast put the
explanatory comment in JSX *child* position (`{/* ... */}`), which added a second
child where one was expected: Solid errors went 2 -> 7 and `pnpm test:solid`
dropped from 44 tests to 17. The suite caught it immediately and loudly - which
is the third time in this goal that the "the oracle protects itself" argument was
tested in practice rather than asserted. Moved the comment out of child position;
44 restored.

### Final state: 54 -> 2

Of the original 54 errors across both packages, **52 are resolved**. What remains
is **one error per package**, and it is the same one: the `test.each` table
callback signature in `gate.test.ts`. That is the single place where a careless
narrowing would weaken the policy assertions the gate depends on, so it is left
deliberately rather than guessed at - by a session that had just demonstrated it
can get an edit wrong.

Wiring `tsc -p` for both packages into `pnpm check` is now one error away per
package.

### The last error was attempted and the attempt FAILED

Recorded because a failed attempt narrows the search.

Tried: annotating both mutation tables as

```ts
const compositionMutationCases: ReadonlyArray<
	readonly [string, string, string, ({ readonly artifact?: EnrichedIR } | undefined)?]
> = [ ... ] as const;
```

Result: **worse.** React 1 -> 2, Solid 1 -> 10. The naive 4-tuple shape does not
describe every entry in those tables - they are not uniform, and Solid's diverges
further from this shape than React's. Reverted; both back to 1.

Node test count held at 551 throughout, confirming the tables' *runtime* contents
were never affected - only their declared type.

**What the next attempt needs:** read `mutationCases` (from line ~165) and
`compositionMutationCases` (from line ~483) in full - roughly 250 lines each -
and derive the actual element shape, including which entries carry the optional
fourth element and what it contains. This is the one place in this work that
cannot be done by pattern-matching from the error text, which is why two
successive sessions have stopped here rather than guessed.

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
