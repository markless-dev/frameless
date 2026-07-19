# Arcade Solid emitter

This package is W-C2, the Solid half of the adjudicated C8 proof chain. It consumes
only the three checked-in `arcade-enriched-ir/1` JSON goldens from
`../05-enriched-ir/test/goldens/`, validates their complete fixture signatures, builds
Babel AST, and prints Solid components. It does not read TSRX, reparse author source,
or import Markless/TSRX at runtime. C8 remains claimable only when this result is
combined with W-C0, the accepted React emitter, and the later cross-target verdicts.

## Solid mapping

| Markless / enriched-IR construct | Solid idiom | Why |
|---|---|---|
| Render-visible writable state | `createSignal` | Gives fine-grained live DOM updates without component rerenders. |
| Ordinary once-local | Component-setup `const` | Solid runs component setup once per owner; S1 captures the initial label in `prefix`. |
| Reactive prop read | `props.x` inside an accessor | Avoids broad destructuring, so S1 multiplier changes remain reactive. |
| Cheap computed binding | Zero-argument accessor | Tracks signal and prop reads without an effect. |
| Invisible next-id storage | Plain setup-local `let` | Persists for the owner lifetime without creating render-visible reactive state. |
| Ordered event handler list | One synchronous handler transaction | Every assignment is published in IR order, so callbacks observe preceding writes. |
| Live input state | `value`/`checked`, plus calibrated `attr:value` | Preserves live properties and only the attribute reflection required by the oracle. |
| Checkbox event | Native `onChange` | Preserves native checkbox change behavior. |
| Keyed repeat | `<For>` over stable row objects | Solid keys by object identity; deep edits mutate the matched row then publish a copied array, preserving focus and row identity. |
| Root template branch | Conditional-expression return | Matches Solid's existing S1 convention while preserving both authored DOM arms without an extra wrapper. |
| Empty branch | `<Show>` with `<p>` plus `<ul>` true branch and `<ul>` fallback | Preserves the sibling empty paragraph and an always-present list without marker-text divergence. |
| S1 setup probe | Direct component-setup call | Solid's owner setup is once per instance; no effect or lifecycle hook is needed in the calibrated CSR scope. |
| Submit synchronization | `preventDefault`, two ordered signal writes, then trace | Exposes only final writes value `2`, allows bubbling, and keeps submit before form bubble. |

## Gates and oracle smoke

`src/gate/` discovers every `generated/**/*.jsx` file. The passing gate uses pinned
`eslint:recommended` plus Babel-binding AST policies for unused Solid imports,
render-reachable signal setters/effects, broad prop destructuring, index-based or
`.map` rendering, undisclosed imports, ESLint directives, dead expressions, and
unreachable code. Emitted files import only `solid-js`; `solid-js/web` is allowed only
when mounting is actually needed. Bypass-oriented mutations cover each policy and a
newly discovered generated file.

`eslint-plugin-solid` is not present in the repository's offline package store, so a
Solid recommended preset could not be installed. That unavailable policy family is
not claimed; Solid-specific checks are explicit AST policies instead. The complete
gate passed on all three generated files, and all bypass mutations were rejected.

The smoke suite runs all four calibrated scenario variants through poc/04's Solid
adapter against its handwritten Solid references. All comparisons pass, including S2
node identity/focus preservation, S1 hidden-branch setup, and S3 callback order and
cancellation. Divergences are logged as structured JSON before a failed assertion.

## Size comparison

`pnpm measure:size` compares clean handwritten S2/S3 baselines with generated output.
Physical nonblank component LOC is primary; Babel AST node count is secondary.

| Scenario | Baseline physical LOC | Emitted physical LOC | LOC ratio | Baseline structural nodes | Emitted structural nodes |
|---|---:|---:|---:|---:|---:|
| S2 | 36 | 54 | 1.50x | 491 | 497 |
| S3 | 21 | 31 | 1.48x | 229 | 223 |

## Findings

- Stable row-object identity is load-bearing for Solid `<For>`: immutable replacement
  of the edited object remounts the row and fails the S2 focus oracle.
- A plain conditional before the always-present `<ul>` creates a Solid marker text
  node in the nonempty branch. `<Show>` with list fallback exactly matches the
  calibrated DOM while retaining the empty paragraph branch.
- S1 needs both setup-once capture and reactive props: `prefix` reads `props.label`
  once, while `derived` reads `props.multiplier` through the accessor. Broad prop
  destructuring would freeze the latter.
- The offline install resolves Babel 7.29.7. `vite-plugin-solid@2.11.0` brings
  `babel-preset-solid@1.9.12`, whose peer range expects Solid `^1.9.12`; the requested
  fallback is 1.8.22, so pnpm reports that peer warning even though the oracle passes.

## Framework-version statement

Arcade targets Solid v2, but this package's runtime evidence is labeled exactly
`solid-1.8.22-fallback`. `solid-js@2.0.0-experimental.16` has no `./web` export, while
the available `vite-plugin-solid@2.11.0` is a Solid 1.x toolchain. A contract test
records both blockers. The emitted `createSignal`, accessor, `<For>`, and `<Show>`
idioms are forward-compatible where currently knowable, but this package is **not Solid 2 runtime-validated** and never implies otherwise.

## Verify

```sh
cd poc/07-emit-solid
pnpm install
pnpm test
```

Pinned versions: Solid fallback 1.8.22, Solid blocker evidence
2.0.0-experimental.16, Vite 5.4.11, vite-plugin-solid 2.11.0, Vitest 2.1.9,
jsdom 25.0.1, Babel parser/traverse/types/generator 7.29.7, and ESLint 8.57.1.
Authored with Node.js 24.15.0 and pnpm 10.33.2.

## What this does not prove

This package does not by itself prove C8, the subjective label “idiomatic,” Solid 2
runtime compatibility, general TSRX/IR coverage, arbitrary prop updates, async
semantics, cleanup/attach, slots/children/context, styling, custom components,
SVG/MathML, accessibility, performance or bundle size, SSR/hydration/resume, HMR,
type-preserving emission, source maps, generated-code debugging, or behavior outside
the S1/S2/S3 CSR fixture family and calibrated observation phases. It also does not
claim the unavailable Solid recommended ESLint preset was run.
