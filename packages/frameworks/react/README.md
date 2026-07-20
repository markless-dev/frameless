# @frameless/react

React 19 target package for Frameless. It owns four framework-specific surfaces:

- `emit(ir)` consumes `frameless-enriched-ir/1` and returns one automatic-runtime `.jsx`
  module built with Babel AST. It does not parse author source.
- `formatEmitted(source)` asynchronously applies the repository's oxfmt configuration when emitted
  source becomes an artifact; `emit(ir)` remains synchronous and byte-stable.
- `checkSources` / `checkGeneratedFiles` run the reusable conventionality gate. Every policy
  and violation carries a `dossierRef` into the normative dossier.
- `createReactAdapter(component)` is available from the browser-safe public
  `@frameless/react/adapter` subpath and provides the asynchronous React 19 analyzer lifecycle.
- the browser project owns React transforms, calibrated handwritten references, and emitted
  equivalence smoke coverage.

The normative idiom input is
`docs/goals/frameless-product-v0/notes/T002-react-idioms.md`; this package points to that dossier
instead of duplicating its evidence. The ownership split keeps emitter, gate, adapter, React
dependencies, JSX transform, and version matrix here rather than in the compiler or analyzer.
The validated primary matrix entry is React/React DOM 19.2.3 with asynchronous `act` and
`IS_REACT_ACT_ENVIRONMENT` enabled by the browser harness.
Analyzer input dispatch uses native input/textarea value setters so React's value tracker observes the synthetic `input` event.

## Enriched IR mapping

| Enriched IR construct | Dossier ruling | Emitted React pattern |
| --- | --- | --- |
| Visible state binding | T002 ruling 1 | Top-level `useState`; primitive literals are direct and prop-reading/non-literals use a lazy arrow. |
| Cheap computed binding | T002 ruling 2 | A render-time `const`; no `useMemo`, `useCallback`, or `memo`. |
| Side-effect-only once local | T002 ruling 3 | `useRef(null)` and `if (setupDone.current === null)` before later hooks/guards. |
| Non-visible mutable binding | T002 ruling 4 | `useRef`; the S2 counter snapshots `.current` into a collision-safe emitter-owned identifier before incrementing it. |
| Event state writes | T002 ruling 5 | Const SSA snapshots, payload reads from the post-write snapshot, and one final setter call per state cell. |
| Keyed repeat | T002 ruling 6 | `.map` with the IR key expression on the returned host root; immutable concat/filter/map/spread updates. |
| Branch / empty arm | T002 ruling 7 | Conditional expressions with an explicit `null` arm; hooks precede early returns. |
| Ref surface | T002 ruling 8 | React 19 ref-as-prop policy; generated files never use `forwardRef` or string refs. |
| Leaf control event | T002 ruling 9 | `value`/`checked` with `onChange`, reading `event.target`; `onInput` is never emitted. |
| Component/module shape | T002 ruling 10 | One named exported PascalCase function, destructured props, `.jsx`, automatic JSX runtime. |
| Analyzer lifecycle | T002 ruling 11 | Awaited async `act` for mount, dispatch, flush, and unmount. |

## Analyzer normalization inventory

| Analyzer behavior | Consequence for this package |
| --- | --- |
| Text nodes with content strictly equal to `''` are omitted; whitespace-only text is retained | Solid conditional-insert placeholders and React's absent-null renders serialize identically, so cross-target Show/null-conditional comparison is possible; authored empty text is unobservable and equally normalized. |

The gate uses ESLint 9 flat configuration, `eslint-plugin-react-hooks` 6 recommended,
`eslint-plugin-react` recommended plus automatic-runtime rules, `jsx-no-leaked-render`, and
`no-array-index-key`. Defense-in-depth AST policies cover the React import allowlist
(`useState`, `useRef`), `no-forwardRef`, controlled inputs, const-only handlers,
one-call-per-setter, ref-guard shape, map keys, hook placement, render-reachable setters/effects,
directive/import bypasses, and authored-event `preventDefault`.

## Checked-in output and freshness

`generated/S1.jsx`, `generated/S2.jsx`, and `generated/S3.jsx` are emitted from the compiler's
checked-in EnrichedIR goldens. `pnpm --dir packages/frameworks/react regenerate` refreshes them;
the node suite compares every byte against a formatted fresh `emit(ir)` result and checks that
neither the emitter nor regeneration reaches `.tsrx`, Markless, or TSRX runtime APIs.

## Conventionality evidence

`pnpm --dir packages/frameworks/react measure:size` measures the actual component bodies in the
calibrated `test/reference.tsx` and the checked-in generated modules. Physical nonblank LOC is
primary; Babel AST node count is secondary structure evidence. The S2/S3 reference bodies include
their calibration-only mutant switches, so the table is conservative and does not pretend they
are mutation-free production baselines.

| Scenario | Reference physical LOC | Emitted physical LOC | LOC ratio | Reference AST nodes | Emitted AST nodes | Node ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| S1 | 39 | 35 | 0.90x | 158 | 150 | 0.95x |
| S2 | 98 | 157 | 1.60x | 573 | 534 | 0.93x |
| S3 | 69 | 77 | 1.12x | 305 | 225 | 0.74x |

## What this does not claim

This package is production code for the proven fixture family, not evidence of production-general
TSRX coverage. It does not by itself claim general composition, cross-TSRX component imports,
prop updates beyond the calibrated scenarios, StrictMode/double-render replay, async component
semantics, cleanup/attach, slots/children/context, styling, custom components, SVG/MathML,
accessibility, performance or bundle size, SSR/hydration/resume, HMR, declarations, sourcemaps, or
generated-code debugging. The gate is a machine-checkable conventionality proxy for this fixture
family; it is not a proof that arbitrary generated React is idiomatic or semantically equivalent.

## Verify

The checked-in suite inventory is 66 node tests and 16 browser tests. These are source counts, not
a claim that a particular environment executed them.

```sh
pnpm check
pnpm build
pnpm test
pnpm --dir packages/frameworks/react test
npx vitest run --project react-browser
git diff --stat -- poc/
```
