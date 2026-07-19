# Arcade enriched IR — fixture-family emitter input

This package is the W-C0 foundation for claim C8 in the adjudicated Arcade plan. It
proves, for the three `poc/04-equivalence-oracle` scenarios, that a versioned,
serializable artifact can join the TSRX syntax tree with Markless 0.1.1's typed
semantic records and close the graph's template/expression gaps. It does **not**
claim C8 by itself: C8 is claimed only when real React and Solid emitters consume
this artifact, pass their conventionality gates, and pass the calibrated oracle.

## Schema rationale

`arcade-enriched-ir/1` gives an emitter three deliberately separate views:

- `components` contains source-order locals with initializer ASTs, a prop
  destructuring map (including `label: displayLabel`), early guard-return
  descriptions, and complete template trees. Host elements retain Markless host
  ids, tag names, static attributes and text, ordered children, dynamic
  attribute/property/text expression ASTs, event ids, branch arms, and keyed row
  subtrees.
- `records.bindings`, `aliases`, and `events` retain semantic identities.
  State reads/writes retain graph ids and property paths; assignment values and
  call arguments are ASTs. Computed functions and event handlers are function
  ASTs with structurally recovered graph reads. Markless does not assign ids to
  alias records, so Arcade adds deterministic `alias:<component>:<name>` ids while
  retaining their compiler-provided target and span.
- `imports` retains semantic module imports when Markless reports any. Known
  authoring primitives are already identified by state/computed records; an
  emitter does not infer their meaning from import spelling.
- `module.exports` records default/named export shape and component names. Each
  component's `evaluation` policy states that ordinary body locals run once per
  instance and computed bindings remain reactive.

The builder calls `@tsrx/core`'s `parseModule()` and only Markless's
`buildSemanticGraph()`. It never requests or reads state lowering, the
payload arena, public DOM render plan, protocol payloads, symbol modules, locator
plans, or resume planning. AST metadata/path cycles and comments are removed from
serialized expression nodes, while syntax-bearing fields and source offsets stay.
Object keys are recursively sorted in dumps. Template/component arrays retain
authored order; record-table arrays use structural id/path/span sort keys and a
locale-independent comparator.

This is the intended scope boundary. Less structure would force emitters to parse
`functionSource`, `handlerSources`, `valueSource`, or template snippets again.
More structure would copy Markless's web-specific DOM/resume emitter into Arcade's
common IR.

## Fixture coverage and tests

- `s1-render-once.tsrx` covers aliased/destructured props, a once-per-mount setup
  initializer, state, a render-once local captured by a computed function, a
  template-valued guard return, a dynamic text site, and an event callback.
- `s2-keyed-todo.tsrx` covers initial prop-derived state, scalar and collection
  writes, `filter(...).length` computed data, an empty branch, a keyed repeat with
  dynamic row attributes/properties, deep handler-local aliases, add/edit/toggle/
  reorder/remove/clear handlers, and row identity metadata.
- `s3-event-form.tsrx` covers live `value`/`checked` properties, bubbling,
  `preventDefault`, callback ordering/payload expressions, and multiple writes in
  one handler.

The Vitest suite asserts sufficiency, graph-id closure, correspondence with every
host shape in the handwritten oracle references, AST-derived composite computed
dependencies, event-handler coverage, AST operands for writes, deterministic
double builds, checked-in byte goldens, and absence of target-coupled Markless
artifacts. `pnpm test` also runs strict TypeScript checking first.

## Findings

- S1's `change` callback deliberately carries no event argument. The scenario and
  handwritten-reference contract is authoritative; the fixture was fixed on
  2026-07-19 and the checked-in enriched-IR golden was regenerated.
- Markless host records have ids and tags but no parent/child structure, attributes,
  static text, or control-flow subtrees. The builder joins them to TSRX template
  nodes in verified source preorder and fails if tags or record counts diverge.
- Markless records the S2 computed dependency id correctly but degrades its path for
  `todos.filter((todo) => todo.done).length` to string fragments such as
  `filter((todo) => todo`. The enriched record derives exactly `state:todos` with
  path `[]` by walking the call/member AST. No degraded compiler path is copied.
- Read tables are rebuilt solely from expression AST sites, including binding
  initializers and computed functions; neither `records.stateReads` nor per-binding
  `reads` copies Markless's naive-split paths. Writes are also derived from AST
  targets and receiver structure. Thus `todos.slice().reverse()` is a read plus the
  subsequent root assignment, not a `reverse` mutation of `state:todos`.
- A handler local selected from state rows (for example
  `alias = todos.find(...)`) carries row provenance. `alias.title = title` is encoded
  as a `handler-local-alias` write to `state:todos / * / title`. Rows selected from a
  shallow copied container retain row provenance, while mutations of the copied
  container itself are not state writes.
- Markless's alias records make destructured props target `prop:props` paths. The IR
  resolves `displayLabel` to `prop:props / label`, including through the render-once
  `prefix` local captured by S1's computed function. Emitters therefore do not need
  the public-render path to accept an alias spelling.
- The original S2 empty/non-empty wrapper used by the handwritten references cannot be
  expressed through Markless 0.1.1's public render plan without a gap. Nesting the
  keyed repeat in the `@else` arm reports that the repeat/branch is unsupported and
  drops the rows. The closest zero-diagnostic spelling keeps `@for` directly under
  `<ul>` and uses a sibling `@if`/empty `@else` for the empty paragraph. The oracle's
  React and Solid references now intentionally use that same always-present `<ul>`
  plus sibling empty paragraph, so this constraint is calibrated rather than left
  as an emitter delta.
- The public `schema.ts` contract owns its source-span, import, graph-kind,
  value-kind, declaration-kind, and sync-policy structures. It has no public
  `@markless/compiler` type import; only the private builder imports Markless types.
- `@tsrx/core@0.1.32` exposes `parseModule` from JavaScript but its published main
  export is not discovered as a declaration by TypeScript 5.9.3. The package-local
  declaration in `src/tsrx-core.d.ts` describes only that real public function and
  imports its `ParseOptions`/`Program` types from the package's shipped type exports.
- The sandbox's pnpm store lacked several tarballs and registry DNS was blocked.
  The lockfile was resolved offline, and implementation verification reused the
  same exact installed dependency tree from the repo-local `poc/03-markless-graph`.
  A clean-machine frozen install remains a PM reproduction step.

## Vendored Markless receipts

All `@markless/*` resolutions are forced to the repository's existing v0.1.1
tarballs through `pnpm.overrides`; no reference checkout path is committed.

```text
c8058867e5814bf4912033cdd7bdeab79f66e187319e923c78e54e19a8b25253  markless-bundler-0.1.1.tgz
bc0f573b765e2cd3c2e5d546314acd347938ddc99fc05c276f30bf4fe0c800ad  markless-compiler-0.1.1.tgz
9b7a627ec8367dc2f2591564ff441a66173dbc96cee1a2200616eaa8002bd3cc  markless-core-0.1.1.tgz
afc0369273952d6fe05c9d7c2fbdb0ff0a6bf4032fd87d1313369b656c8f61cd  markless-router-0.1.1.tgz
6a4644113cd8bbbfcb56a7d8e82bb687b2625c09d38fbc5744f79198ce076117  markless-runtime-0.1.1.tgz
0fd0cab793da0b520d49fc1b9e8f187c92fbb66f4b851e8fef143056374bb5db  markless-serializer-0.1.1.tgz
3b399e06577b184f08517c12594fd766fadca16a9664770a6e8efee67cfee37a  markless-web-0.1.1.tgz
```

## Verification

```sh
cd poc/05-enriched-ir
pnpm install --frozen-lockfile --prefer-offline
pnpm test
```

The requested single verify entry point is `pnpm test`; it performs no network
access. On the authoring sandbox, that command passed 17 tests after strict
typechecking. PM-side clean reproduction needs registry access only for the frozen
install; all Markless packages come from `../vendor/`.

Recorded versions: Node.js 24.15.0, pnpm 10.33.2, `@markless/compiler` and
`@markless/serializer` 0.1.1 (vendored), `@tsrx/core` 0.1.32, TypeScript 5.9.3,
`@types/node` 24.12.2, Vitest 4.1.5, and transitive Vite 8.1.5.

## What this does not prove

This package proves fixture-family IR sufficiency, not generated framework code,
C8's conventionality gate, or C9 behavioral equivalence. In particular it does not
prove React/Solid/Qwik emission, Solid v2 toolchain viability, general TSRX coverage,
multi-component or multi-module composition, type-preserving output, async semantics,
cleanup/attach, slots/children/context, styling, custom components, SVG/MathML,
accessibility, performance or bundle size, SSR/hydration/resume, HMR, source maps, or
generated-code debugging. Markless's payload and DOM output remain one target, not
the Arcade IR contract.
