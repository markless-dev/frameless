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
| Side-effect-only once-local | Ref-guarded first-render execution | S1 `setup` stays in authored order and fires once for each calibrated mount without putting an observable side effect in a `useState` initializer. |
| Root assignment in an event | Event-local next value, then setter | Callback payloads in the same handler observe post-write values despite React batching. |
| `* / field` handler-alias write | Immutable keyed `map` plus object spread | Avoids mutating prior React state; the selector predicate and field value come from AST/write records. |
| Keyed repeat | `.map` with the IR key expression as React `key` | Preserves row identity through reorder/remove and never substitutes the map index. |
| Root template branch | Conditional-expression return | Produces the conventional single React return while preserving both authored DOM arms. |
| Guard return | Early return after every hook | Keeps the authored guard shape while satisfying hook ordering. |
| Event handler list / sync policy | Ordered inline handlers; IR-authored `preventDefault` | Preserves callback order and cancellation observed by the oracle. |

## Gates and oracle smoke

`src/gate/` exposes the reusable checker used by `pnpm test`. It discovers
`generated/**/*.jsx` by glob, compiles every match, and applies `eslint:recommended`,
React recommended, and React Hooks recommended. It rejects every ESLint directive
comment (disable, enable, and inline configuration), undisclosed static/dynamic/CommonJS
imports, unused bindings, dead expressions, unreachable statements, index keys, hooks
after early returns, and render-reachable state setters/effect hooks. Setter/effect
checks follow Babel bindings through aliases, helper functions, and object members;
they do not guess from names. Mutation tests exercise each bypass, including a newly
created generated file that is found without changing a file list.

The smoke suite then runs every emitted component (including S1's hidden branch
calibration) through the sibling oracle against the handwritten React reference and
requires exact verdicts. Independent S1 assertions require setup exactly once per
mount, exact `Arcade:3`/`Arcade:6` derived strings, and a real React-root rerender in
which the initial `Arcade:` prefix remains captured while the multiplier update is
reactive (`Arcade:10`).

The React recommended preset's `prop-types` rule remains enabled with its documented
`skipUndeclared` option because `arcade-enriched-ir/1` deliberately carries no prop
types and type-preserving emission is out of scope. No generated-file lint rule is
disabled or suppressed.

S1's `change` callback deliberately receives **no event argument**. The scenario and
handwritten-reference contract is authoritative; the TSRX fixture was corrected on
2026-07-19 and its enriched-IR golden regenerated. Setup and change payload assertions
preserve that adjudication.

The calibrated contract excludes React StrictMode and speculative/double-render
replay. The oracle adapter mounts with `createRoot` but no `<StrictMode>`, so the
ref-guarded first-render strategy is claimed only for that scope. No StrictMode result
is implied.

Callback event records intentionally project framework events down to
`defaultPrevented`. Native-versus-synthetic identity, class, pooling, and other event
surface differences are normalized away and are not part of this equivalence claim.

## Size comparison

`pnpm measure:size` runs the checked-in `scripts/measure-size.mjs` against clean,
mutation-free handwritten S2/S3 components in `test/baselines/`. Those files contain
no mutant factories or type-only scaffolding. Physical nonblank LOC is the primary
number; Babel AST node count is the secondary structural measure.

| Scenario | Baseline physical LOC | Emitted physical LOC | LOC ratio | Baseline structural nodes | Emitted structural nodes |
|---|---:|---:|---:|---:|---:|
| S2 | 41 | 86 | 2.10x | 500 | 554 |
| S3 | 26 | 47 | 1.81x | 225 | 245 |

The emitted S2 component is 2.10x the handwritten physical LOC, so it narrowly misses
a hypothetical 2x ceiling; S3 is 1.81x. Structurally the outputs are 1.11x and 1.09x
their baselines. Size remains a reported comparison, not a gate.

## Findings

- No degraded read tables or legacy source-string fields were present in the three
  post-amendment goldens. Validation rejects either form rather than guessing.
- The deep-write records were sufficient: alias provenance plus the handler's `find`
  predicate and `* / field` path produce immutable updates without source strings.
- Physical LOC is the honest primary result: emitted S2 is 2.10x its clean baseline,
  while S3 is 1.81x. Structural counts are close but do not override that S2 result.
- The repository locks resolve Babel 7.29.7 rather than the packet's suggested 7.28.4
  set.

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
or other target emission, general TSRX coverage, prop updates beyond the documented
S1 React-root rerender, StrictMode/double-render replay,
async semantics, cleanup/attach, slots/children/context, styling, custom components,
SVG/MathML, accessibility, performance or bundle size, SSR/hydration/resume, HMR,
type-preserving emission, source maps, or generated-code debugging. The conventionality
gate is a machine-checkable proxy scoped to this fixture family.
