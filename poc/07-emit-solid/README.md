# Arcade Solid emitter

This package is W-C2, the Solid half of the adjudicated C8 proof chain. Its regeneration
script reads the three checked-in `arcade-enriched-ir/1` JSON goldens from
`../05-enriched-ir/test/goldens/`; the emitter itself accepts any component using the
supported construct vocabulary below. It walks that IR, converts its expression and
handler ASTs, builds Babel JSX AST, and prints Solid components. It does not read TSRX,
reparse author source, or import Markless/TSRX at runtime. C8 remains claimable only
when this result is combined with W-C0, the accepted React emitter, and the later
cross-target verdicts.

The emitter was rebuilt after PM review found that its first version selected three
hand-written component builders by component name and SHA-256 of the exact fixture
JSON. That version demonstrated handwritten Solid behavior, not IR sufficiency, and
its C8 evidence is invalid. The replacement has no component-name dispatch or fixture
digest. A test mutates S1 with a new static attribute and reorders its local records;
regeneration succeeds, setup order remains semantic-order driven, and only the new
attribute changes. Unknown fields, unsupported construct shapes, degraded paths, and
legacy source-string fields still fail with construct-level diagnostics.

## Solid mapping

| Enriched-IR construct | Uniform Solid lowering | Why |
|---|---|---|
| Host, text, static attribute | Direct JSX element/text/attribute | Tags, nesting, and authored attributes come only from the template tree. |
| Dynamic text or attribute/property | Binding-aware ESTree conversion in a JSX expression | Free aliases become `props.path`, visible states and computed bindings become accessor calls, and lexical handler/repeat locals remain lexical. |
| `property: value` | `value={...}` plus calibrated `attr:value={...}` | Preserves the live property and the attribute reflection observed by the oracle. |
| Binary `then`/`else` branch | `<Show when={...} fallback={...}>` everywhere | One conditional rule handles rooted and nested sites. For an empty arm immediately before its always-present list, the list is structurally fused into both arms; the known-empty arm uses the repeat's empty row. |
| Keyed repeat | `<For each={...}>` with a recorded row-member key discipline | Solid reconciles row objects by identity. The emitter validates that the IR key is a row member path and is not deep-mutated. Handler ASTs mutate the selected row in place and publish an array refresh, preserving focus and row identity. |
| Render-visible writable state | `createSignal` | Template/computed graph references determine visibility and provide fine-grained DOM updates. |
| Invisible writable cell | Plain setup-local `let` | S2's next-id cell persists for the owner lifetime without unnecessary reactivity. |
| Ordinary once-local | Ordered component-setup declaration or expression | Solid setup runs once per owner; S1's `prefix` captures the first label because the IR marks ordinary locals once-per-instance. |
| Destructured prop binding | `props.path` at each reactive read | No broad destructuring freezes reactive prop getters. First-value capture occurs only while evaluating an ordinary once-local or state initializer; the runtime S1 golden contains no renamed prop alias. |
| Computed binding | Zero-argument derived arrow | Signal and prop reads remain tracked without an effect. |
| Direct handler state write/update | Ordered signal setter call | The handler AST supplies statement order, RHS expressions, and callback placement. Invisible-cell updates remain plain JavaScript updates. |
| Handler-local deep alias write | Preserve alias mutation, then lower the recorded root assignment to a setter | This is the validated in-place-row plus array-refresh strategy, rather than an immutable row replacement that remounts `<For>` children. |
| Event record | Native `onX` JSX handler built from the handler AST | Event names and host attachment come from records, not component-specific code. |
| Constant-truthy `preventDefault` sync policy | Remove the duplicated authored AST call and prepend `event.preventDefault()` from the policy record | Synchronization placement is policy-driven rather than inferred by grepping names. Other policy actions/conditions are rejected descriptively. |

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
| S2 | 36 | 60 | 1.67x | 491 | 544 |
| S3 | 21 | 31 | 1.48x | 229 | 224 |

## Findings

- Stable row-object identity is load-bearing for Solid `<For>`: immutable replacement
  of the edited object remounts the row and fails the S2 focus oracle.
- The original fixture-digest/component-builder implementation was fake generality.
  It is retained as a board finding, not evidence; this rebuild structurally consumes
  template, binding, event, write, evaluation-policy, and expression-AST records.
- A plain conditional before the always-present `<ul>` creates a Solid marker text
  node in the nonempty branch. Uniform `<Show>` lowering fuses that immediately
  following list into both arms and exactly matches the calibrated DOM.
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
pnpm run regenerate && pnpm test
```

Pinned versions: Solid fallback 1.8.22, Solid blocker evidence
2.0.0-experimental.16, Vite 5.4.11, vite-plugin-solid 2.11.0, Vitest 2.1.9,
jsdom 25.0.1, Babel parser/traverse/types/generator 7.29.7, and ESLint 8.57.1.
Authored with Node.js 24.15.0 and pnpm 10.33.2.

## What this does not prove

This package does not by itself prove C8, the subjective label “idiomatic,” Solid 2
runtime compatibility, constructs outside the explicitly rejected IR subset,
arbitrary prop updates, async semantics, cleanup/attach, slots/children/context, styling, custom components,
SVG/MathML, accessibility, performance or bundle size, SSR/hydration/resume, HMR,
type-preserving emission, source maps, generated-code debugging, or behavior outside
the S1/S2/S3 CSR fixture family and calibrated observation phases. It also does not
claim the unavailable Solid recommended ESLint preset was run.
