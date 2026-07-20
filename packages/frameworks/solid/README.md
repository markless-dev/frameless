# @frameless/solid

Solid target package for Frameless. It owns the Solid-specific emitter, conventionality gate,
browser-safe analyzer adapter, JSX transform, calibrated handwritten references, and emitted
equivalence smoke. The emitter consumes `frameless-enriched-ir/1`; it never parses TSRX or imports
Markless at runtime.

The normative input is `docs/goals/frameless-product-v0/notes/T003-solid-idioms.md`. This package
points to that dossier rather than restating its research evidence. The browser adapter is exported
from `@frameless/solid/adapter`; that subpath does not import the node-only emitter or ESLint gate.

## Enriched IR mapping

| Enriched IR construct       | T003 ruling | Emitted Solid pattern                                                                                                                                              |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scalar visible state        | 1           | `createSignal`; reads call the accessor and every authored write becomes an ordered setter call.                                                                   |
| Object/array member state   | 1           | `createStore`; keyed-repeat participation also classifies compiler-normalized `unknown` collection initializers as stores.                                         |
| Cheap computed binding      | 2           | Plain zero-argument derived arrow. `createMemo` is never imported or emitted in v0.                                                                                |
| Store row binding           | 3           | Bare `row.member` reads under `<For>`; no whole-collection accessor refresh hack.                                                                                  |
| Member edit                 | 1, 3        | `setStore(produce(draft => ...))`, preserving the reused proxy row and its property-level subscription.                                                            |
| Structural collection write | 1, 4        | `setStore(reconcile(next, { key: "<IR key>" }))`; the literal is derived from the keyed-repeat record.                                                             |
| Keyed repeat                | 4           | `<For each={store}>`; the gate checks keyed reconcile/row consistency and the emitter metamorphic test proves the IR key drives output.                            |
| Structural branch           | 5           | Two-arm `<Show when fallback>`; following siblings are emitted once after the Show rather than copied into both arms.                                              |
| Event handler               | 6           | Delegated camel-case `onX`, `event.currentTarget` for leaf controls, and setter calls in authored order. No SSA collapse or `batch`.                               |
| Text control                | 7           | Identical `value` and `attr:value` expressions plus `onInput`.                                                                                                     |
| Checkbox control            | 7           | `checked` plus `onChange`.                                                                                                                                         |
| Props and once-local        | 8           | Reactive reads stay `props.path`; prop-reading setup initializers and once-captures use `untrack(() => ...)`.                                                      |
| Invisible scalar cell       | 9           | Plain component-local `let`; it is never rendered.                                                                                                                 |
| Component/module            | 10          | One named exported PascalCase function, one props identifier, `.jsx`, `class`/`for`, and only dossier-allowed Solid imports.                                       |
| Forward ledger              | 11          | v0 retains the recorded v2 migration debt: For child accessors, attr namespace removal, store API moves, microtask batching recalibration, and adapter relocation. |

## Fail-closed boundary and binding safety

Validation rejects unknown semantic fields, malformed nodes, dangling graph/event/host ids,
legacy source strings, degraded paths, unsupported write/sync shapes, mutable keys, keyed repeats
whose key cannot be consumed, and arrays without a keyed identity record. The emitter maps free
references through compiler graph bindings while respecting Babel lexical bindings and explicit
repeat-item scope. Generated imports, setters, and draft parameters use collision-safe allocation;
tests cover component, scalar state, store, row, key, ordinary-local, and import-collision renames,
plus nested lexical shadowing.

The store classification deliberately inventories one analyzer/compiler normalization: the S2
`seed.map(...)` initializer is currently reported as `valueKind: "unknown"`, while the keyed-repeat
collection and key graph records prove it is the array store cell. The emitter consumes those graph
records rather than matching the state name or initializer spelling.

## Analyzer normalization inventory

The browser evidence uses `@frameless/analyzer` as follows:

| Analyzer behavior                                                                               | Consequence for this package                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Scenario ids may carry a `/variant` suffix                                                      | Emitted smoke resolves the component from the base id and includes the non-primary S1 hidden variant.        |
| Input/check actions update live DOM properties before dispatch                                  | Controlled bindings are compared after native `input`/`click` dispatch, not by synthetic framework helpers.  |
| Observations retain element/text nodes and omit framework marker attributes                     | Empty Solid anchors do not become semantic DOM, while authored empty elements still do.                      |
| Input `value` and `checked` are serialized as properties; authored attributes are also retained | `value` and `attr:value` must both match the handwritten reference.                                          |
| Row node ids are normalized out of ordinary DOM comparison                                      | Identity and focus have separate violation channels, so keyed reuse is still enforced.                       |
| Dispatch, microtask, and bounded-quiescence phases are distinct                                 | Solid's synchronous authored writes are visible in order before later observation phases.                    |
| Callback payload objects are key-sorted                                                         | Field order is not treated as a framework divergence; callback invocation and phase order remain observable. |

## Gate

The node-only gate uses ESLint 9 flat configuration, `eslint:recommended`, and
`eslint-plugin-solid`'s flat recommended preset. Binding-aware policies enforce the exact import
allowlist (`solid-js`: `createSignal`, `untrack`, `For`, `Show`; `solid-js/store`: `createStore`,
`produce`, `reconcile`), scalar-vs-store syntax, Show two-arm shape, structural-ternary exclusion,
controlled-input pairing, collection access inside rows, authored-event `preventDefault`,
stop-propagation exclusion, props/untrack discipline, keyed reconcile consistency, component
shape, and `className`/`htmlFor` exclusion. Every published policy has a syntactically valid bypass
mutation, and a temporary generated file exercises discovery through `checkGeneratedFiles`.

## Checked-in output and size

`generated/S1.jsx`, `S2.jsx`, and `S3.jsx` are byte-checked against fresh emission from the compiler
goldens. `pnpm --dir packages/frameworks/solid regenerate` refreshes them. Physical nonblank
component LOC is primary; Babel node count is secondary. S2/S3 reference bodies include
calibration mutant branches, so these comparisons are intentionally conservative.

| Scenario | Reference physical LOC | Emitted physical LOC | LOC ratio | Reference AST nodes | Emitted AST nodes | Node ratio |
| -------- | ---------------------: | -------------------: | --------: | ------------------: | ----------------: | ---------: |
| S1       |                     35 |                   14 |     0.40x |                 165 |               136 |      0.82x |
| S2       |                    114 |                   69 |     0.61x |                 640 |               546 |      0.85x |
| S3       |                     78 |                   31 |     0.40x |                 326 |               227 |      0.70x |

## Framework-version honesty

The executable package lane is named exactly `solid-1.8.22-fallback` and pins Solid 1.8.22 with
`vite-plugin-solid` 2.11.10. The T003 research ledger was refreshed against Solid
`v2.0.0-beta.9`, superseding the POC's older experimental.16 blocker evidence, but this package is
**not Solid 2 runtime-validated**. Its v2 items remain recorded migration work; the fallback browser
lane must not be reported as Solid 2 evidence.

## Generality boundary

This is production package code for the S1/S2/S3 fixture family, not proof of arbitrary Solid or
TSRX coverage. It supports one exported component, the validated host/text/branch/keyed-repeat
vocabulary, scalar signals, keyed collection stores, the observed member-write shape, synchronous
handlers, and CSR mounting. It does not claim cross-TSRX composition, arbitrary object stores,
arbitrary keys or immutable row replacement, prop updates beyond calibration, async/cleanup,
children/context, custom components, SVG/MathML, accessibility, SSR/hydration/resume, HMR,
declarations, sourcemaps, or generated-code debugging. In Solid 1.x `<For>` still keys by object
identity; the IR key is consumed by `reconcile`, not by For itself. The gate is a conventionality
proxy over discovered generated files, not a proof for arbitrary source.

## Verify

The checked-in suite inventory is 47 node tests (16 emitter/freshness, 28 gate, 2 adapter
entry/import-graph, 1 size) and 17 browser tests (12 handwritten calibration including eight
mutants, plus 5 emitted/reference and store-row smoke tests). These are source counts, not a claim
that a particular environment executed them.

```sh
pnpm check
pnpm build
pnpm test
pnpm --dir packages/frameworks/solid test
npx vitest run --project solid-browser
git diff --stat -- poc/
```
