# Arcade React emitter

This package is the W-C1 React half of the adjudicated C8 proof chain. It consumes
only the three checked-in `arcade-enriched-ir/1` JSON goldens from
`../05-enriched-ir/test/goldens/`, constructs Babel AST, and prints React function
components. It never reads TSRX, reparses author source, or imports Markless/TSRX at
runtime. C8 remains claimable only after W-C2 and W-D1 combine both target emitters,
the conventionality gates, and cross-framework verdicts.

## React mapping

| Markless / enriched-IR construct | React idiom | Reason |
|---|---|---|
| Visible writable state | Lazy `useState` | Preserves once-per-instance initialization while giving React explicit rerender ownership. |
| Invisible mutable S2 next-id cell | `useRef` plus an event-local sequenced value | The counter must persist without rendering; synchronizing the ref immediately after `++` makes later reads observe the write. |
| Cheap reactive computed | Derived `const` during render | `derived` and `complete` are pure and inexpensive; `useMemo` would add cache machinery without a semantic need. |
| Referenced ordinary once-local | One-value lazy `useState` | S1 `prefix` is fixed at instance creation even if props later change. |
| Side-effect-only once-local | Fold into the next lazy state initializer | S1 `setup` stays in authored order, fires exactly once per mount, and creates no unused/dead binding. |
| Root assignment in an event | Event-local next value, then setter | Callback payloads in the same handler observe post-write values despite React batching. |
| `* / field` handler-alias write | Immutable keyed `map` plus object spread | Avoids mutating prior React state; the selector predicate and field value come from AST/write records. |
| Keyed repeat | `.map` with the IR key expression as React `key` | Preserves row identity through reorder/remove and never substitutes the map index. |
| Guard return | Early return after every hook | Keeps the authored guard shape while satisfying hook ordering. |
| Event handler list / sync policy | Ordered inline handlers; IR-authored `preventDefault` | Preserves callback order and cancellation observed by the oracle. |

## Gates and oracle smoke

`pnpm test` checks byte freshness, React JSX compilation with Vite/esbuild, React and
Hooks recommended ESLint rules with zero errors, no disable comments, and AST policies
for imports, live bindings, keys, render-phase setters/effects, and hook placement. It
then runs every emitted component (including S1's hidden guard calibration) through
the sibling oracle against the handwritten React reference and requires exact verdicts.

The React recommended preset's `prop-types` rule remains enabled with its documented
`skipUndeclared` option because `arcade-enriched-ir/1` deliberately carries no prop
types and type-preserving emission is out of scope. No generated-file lint rule is
disabled or suppressed.

| Gate | Implementation-run result |
|---|---|
| JSON validation + AST generation | Passed for S1/S2/S3; generated files parse as JSX. |
| Byte freshness | Passed by regenerate-and-compare inspection. |
| Vite/esbuild build | Environment-blocked: cached optional package omitted the native esbuild binary. |
| React + Hooks recommended lint | Environment-blocked: both plugin tarballs and mirror metadata are absent. |
| AST policies | Implemented; parser-level inspection passed, full Vitest gate awaits dependency install. |
| Oracle smoke | Implemented; full run awaits the same Vite/esbuild dependency install. |

## Size comparison

The checked-in measurements come from the regenerated output and parsed handwritten
component declarations.

| Scenario | Handwritten physical LOC | Generated physical LOC | Handwritten normalized LOC | Generated normalized LOC | Handwritten structural nodes | Generated structural nodes |
|---|---:|---:|---:|---:|---:|---:|
| S1 | 6 | 24 | 27 | 24 | 135 | 124 |
| S2 | 14 | 86 | 70 | 86 | 568 | 554 |
| S3 | 15 | 47 | 51 | 47 | 312 | 245 |

Physical LOC counts nonblank lines in each component's checked-in source span.
Normalized LOC prints both component ASTs through the same default Babel printer; its
ratios are 0.89x, 1.23x, and 0.92x. The structural metric is the Babel AST node count
for the component declaration, at 0.92x, 0.98x, and 0.79x. The comparable-printer and
structural measurements meet the 2x target. Raw physical LOC misses it (4.0x, 6.1x,
and 3.1x) because the handwritten baseline packs whole components and multiple
statements onto single lines. This report is not a gate, and the emitter intentionally
does not use Babel's two-line `concise` output to manufacture a better raw ratio.

## Findings

- No degraded read tables or legacy source-string fields were present in the three
  post-amendment goldens. Validation rejects either form rather than guessing.
- The deep-write records were sufficient: alias provenance plus the handler's `find`
  predicate and `* / field` path produce immutable updates without source strings.
- Physical LOC exceeds the requested 2x target because the handwritten baseline is
  densely packed. Structural complexity is slightly lower for every scenario. This is
  reported as a negative result; size comparison is non-gating per adjudication.
- The repository locks currently resolve Babel 7.29.7 rather than the packet's suggested
  7.28.4 set. The pnpm content store also lacks payloads needed for a clean offline
  install. Registry DNS failed with `ENOTFOUND`, so Vite/oracle/lint verification is a
  PM-side reproduction step rather than a claimed pass.

## Verify

```sh
cd poc/06-emit-react
pnpm install
pnpm test
```

Pinned versions: React/React DOM 18.3.1, Vite 5.4.11, Vitest 2.1.9, jsdom
25.0.1, Babel parser/traverse/types/generator 7.29.7, ESLint
8.57.1, eslint-plugin-react 7.37.5, and eslint-plugin-react-hooks 5.2.0.
Authored with Node.js 24.15.0 and pnpm 10.33.2.

## What this does not prove

This package does not by itself prove C8, the subjective label “idiomatic,” C9, Solid
or other target emission, general TSRX coverage, prop updates beyond these scenarios,
async semantics, cleanup/attach, slots/children/context, styling, custom components,
SVG/MathML, accessibility, performance or bundle size, SSR/hydration/resume, HMR,
type-preserving emission, source maps, or generated-code debugging. The conventionality
gate is a machine-checkable proxy scoped to this fixture family.
