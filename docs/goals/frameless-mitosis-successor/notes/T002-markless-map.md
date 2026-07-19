# T002 — Markless map & reuse-vs-gap (Scout receipt note)

Provenance: two read-only crew units (gpt-5.6-sol, effort medium) run 2026-07-19,
run id `2026-07-19T19-08-37-605Z`. PM synthesized; full unit reports appended below.
Repo analyzed: `/Users/jacksm5pro/dev/open-source/markless` (read-only, v0.1.1,
748 commits June 12 → July 19 2026 — very active).

## PM synthesis

**What markless already proves (reuse):**

1. **Semantic graph IR beats Mitosis's string IR.** `SemanticGraphArtifact` captures
   bindings (state/computed/element/prop), path-level reads/writes, aliases/destructuring,
   component edges, events with sync-policy IR, branch sites, keyed repeats, async
   boundaries, shared lifetimes. First-class identities and edges — exactly what Mitosis
   lacked (it stored code as strings).
2. **Validated pass/artifact pipeline.** `defaultCompilerPasses` declares
   consumes/produces; the pass graph is topologically validated; artifacts are dumpable.
   Natural fork point for a multi-target backend: after semantic-graph/state-lowering,
   before markless-specific payload/render planning.
3. **Structural template control flow.** `@if/@for/@switch/@try` are parser-level nodes
   (`JSXIfExpression` etc. via `@tsrx/core` parser) — can drive React ternaries/map,
   Vue `v-if/v-for`, Svelte blocks, Solid `Show/For`. Keys are mandatory on interactive
   repeats.
4. **Authoring is materially broader than Mitosis.** Locals, loops, helper calls,
   closures, destructuring, ordinary assignment/mutation (path-lowered), guard returns,
   generics/type annotations, async computed with cancellation. No naming blacklists,
   no forced imported Show/For.
5. **Reusable tooling:** typescript-plugin (Volar-mapped virtual TSX — editor types work),
   vscode grammar, CLI shell, analyzer verdict/receipt schemas, Playwright evidence
   collectors, rich `.tsrx` fixture corpus.

**What the successor still needs (gaps — these become claims/POC targets):**

1. **No retargetable emitter.** Emission is ~9K lines of markless-specific string
   building (DOM/SSR/resume/payload modules). No target interface, no output AST/printer.
   New per-framework AST-based emitters are new work.
2. **Expression-level semantics still strings.** `functionSource`, handler sources,
   expression slices survive as text; capture analysis is textual scanning. Types don't
   flow into the graph (no TypeChecker in the pipeline; emitted modules are JS).
3. **No cross-framework equivalence oracle yet.** Analyzer/Witness validates *markless*
   runtime protocols (payload wiring, locators, debug channel) + generic browser health.
   The verdict/receipt/matrix substrate is portable but a paired-run DOM/event-trace
   comparator across frameworks doesn't exist.
4. **Semantic mismatches to solve per target (hardest-5, from unit B):**
   render-once graph vs React rerender; path-level mutation vs immutable updates /
   proxies / stores; async computed (cancellation, version gates, prior-value retention)
   vs Suspense/resources; scheduling/commit/cleanup timing differences; composition
   (opaque children vs slots/inspectable children, shared scopes vs context, native vs
   synthetic events).
5. **Language contract broader than implemented emitter** — several template shapes
   fail closed; docs lag implementation (specs are the real contract; 14 framework specs,
   some draft).

**Defensible successor architecture (unit B bottom line, PM-endorsed for T004):**
reuse TSRX parser, diagnostics discipline, pass runner, graph/path analysis, type-service
mappings, fixtures, browser harness; add a typed expression IR before payload planning;
define normative target-neutral reactivity/lifecycle semantics; build AST-based
per-framework emitters; build a paired behavioral equivalence harness with per-target
adapters. Treat today's DOM/resume emitter as *one* target, not the common backend.

---

## Unit A — compiler/graph/analyzer internals (full report)

## 1. Repository layout

The production package map is declared in [CONTRIBUTING.md](/Users/jacksm5pro/dev/open-source/markless/CONTRIBUTING.md:22); `poc/` is explicitly design/proof evidence rather than the public surface ([README.md](/Users/jacksm5pro/dev/open-source/markless/README.md:90)).

| Package | Role | Classification |
|---|---|---|
| `packages/compiler` | Parses `.tsrx`, builds the semantic graph, lowers state access, plans payloads/symbols, and emits CSR/SSR modules. | Core |
| `packages/runtime` | Host-neutral reactive graph: cells, computed/async invalidation, path subscriptions, shared graph planes, scheduler, journal. | Core |
| `packages/serializer` | Value serialization plus `markless/state` and `markless/view` protocol types/validation. There is intentionally no separate protocol package. | Core |
| `packages/web` | DOM/HTML implementation: CSR render, SSR/string/stream render, payload resume, event delegation, locators, behaviors, async arms, DOM journal application. | Core web target |
| `packages/bundler` | Rolldown-first transform/build integration, Vite adapter, virtual payload/resolver/resume/symbol/style modules, preload planning. | Core delivery |
| `packages/core` | Public facade: compiler-only `state`, `computed`, `element`, `shared` stubs and curated render/resume/build re-exports. | Public core |
| `packages/analyzer` | Portable invariant/verdict evaluators plus optional Playwright evidence collector. | Validation infrastructure; not required at runtime |
| `packages/router` | Typed routing, client navigation, SSR streaming integration, preload maps, Vite and TypeScript plugins. | Optional product subsystem |
| `packages/cli` | `create-markless` application scaffolder. | Peripheral tooling |
| `packages/typescript-plugin` | Converts TSRX structure to mapped TSX for TypeScript completions, diagnostics, hover, and navigation. | Developer tooling |
| `packages/vscode-plugin` | `.tsrx` language registration, TextMate grammar, and loading the TypeScript/router plugins. | Developer tooling |
| `packages/vitest-browser` | Markless browser-mode render/page helpers and real-browser runtime tests. | Test infrastructure |

`specs/` is the normative design contract: an index plus 14 framework documents covering host syntax, pipeline, graph, resumability, runtime, diagnostics, platforms, arms, and cache. `specs/state.md` is a progress ledger, not the contract. `docs/` is currently a small Markless Router application/scaffold—one page and a counter—not complete user documentation ([docs/pages/index.tsrx](/Users/jacksm5pro/dev/open-source/markless/docs/pages/index.tsrx:1)).

## 2. Compiler pipeline end to end

### Parsing

Production parsing is neither Babel nor Oxc. `buildSemanticGraph()` calls `parseModule` from external `@tsrx/core` ([semantic-graph/index.ts](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/index.ts:39)). Lockfile evidence identifies `@tsrx/core@0.1.32`, backed by Acorn 8.17 and `@sveltejs/acorn-typescript`; it also depends on `esrap`, MagicString, and source-map tooling ([pnpm-lock.yaml](/Users/jacksm5pro/dev/open-source/markless/pnpm-lock.yaml:4773)). Thus the input is a custom TSRX parser producing an ESTree-like AST with TSRX node extensions such as `JSXIfExpression`, `JSXForExpression`, and `JSXTryExpression`.

Oxc appears only later in `packages/bundler/src/transform.ts` as Rolldown’s optional type-stripper for already-emitted TypeScript. It is not the TSRX parser.

The separate type-service path also invokes `@tsrx/core`, then renders mapped TSX plus source mappings for TypeScript ([type-service.ts](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/type-service.ts:70)). The main compiler does not consume a TypeScript `TypeChecker`.

### Pass pipeline

`compileTsrxModule()` runs a validated artifact DAG ([compile-module.ts](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/compile-module.ts:39), [pass-registry.ts](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/pass-registry.ts:3)):

```text
tsrx-semantic-graph
  -> state-lowering
  -> payload-arena
  -> symbol-resolver
  -> public-render-plan
  -> protocol-state / protocol-view
  -> public-render-module
  -> capture-analysis
  -> payload-scripts / symbol-modules
  -> runtime-demand-map
  -> symbol-resolver-module
```

Passes declare `consumes` and `produces`; `pass-pipeline.ts` topologically validates them, rejects missing/duplicate producers and cycles, and supports JSON artifact dumps.

### IR / graph

The central IR is a collection of typed semantic records, not one universal node-and-edge class. Key definitions from [artifacts.ts](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:61):

```ts
export type SemanticGraphBinding = {
  readonly id: string;
  readonly name: string;
  readonly kind: 'state' | 'computed' | 'element' | 'prop';
  readonly sharedDefinitionId?: string;
  readonly declarationKind?: 'const' | 'let' | 'var';
  readonly writable: boolean;
  readonly valueKind?: 'scalar' | 'object' | 'array' | 'unknown';
  readonly initialValue?: unknown;
  readonly async?: boolean;
  readonly asyncCapable?: boolean;
  readonly dependencies?: ReadonlyArray<SemanticGraphDependency>;
  readonly functionSource?: string;
};

export type SemanticGraphDependency = {
  readonly source: string;
  readonly graphNodeId: string;
  readonly path: ReadonlyArray<string>;
};
```

The aggregate ([artifacts.ts](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:402)) contains:

```ts
export type SemanticGraphArtifact = {
  readonly components: ReadonlyArray<SemanticComponent>;
  readonly componentEdges: ReadonlyArray<SemanticComponentEdge>;
  readonly moduleImports: ReadonlyArray<SemanticModuleImport>;
  readonly graphBindings: ReadonlyArray<SemanticGraphBinding>;
  readonly sharedDefinitions: ReadonlyArray<SemanticSharedDefinition>;
  readonly hostNodes: ReadonlyArray<SemanticHostNode>;
  readonly keyedRepeats: ReadonlyArray<SemanticKeyedRepeat>;
  readonly events: ReadonlyArray<SemanticEvent>;
  readonly behaviors: ReadonlyArray<SemanticBehavior>;
  readonly elementHandleBindings: ReadonlyArray<SemanticElementHandleBinding>;
  readonly localBindings: ReadonlyArray<SemanticLocalBinding>;
  readonly localDeclarations: ReadonlyArray<SemanticLocalDeclaration>;
  readonly aliases: ReadonlyArray<SemanticGraphAlias>;
  readonly stateReads: ReadonlyArray<SemanticStateRead>;
  readonly templateReads: ReadonlyArray<SemanticTemplateRead>;
  readonly stateWrites: ReadonlyArray<SemanticStateWrite>;
  readonly asyncBoundaries: ReadonlyArray<...>;
  readonly branchSites: ReadonlyArray<SemanticBranchSite>;
  readonly diagnostics: ReadonlyArray<SemanticGraphDiagnostic>;
};
```

Captured semantics include static graph paths, aliases/destructuring, mutability, component prop edges, module imports, handler parameters/source spans, branch and keyed-repeat scope IDs, async-boundary ownership, host locators, event sync-policy IR, and shared lifetimes (`request | container | page`). Type capture is shallow and syntactic (`valueKind`, declaration kind, prop shape); inferred TypeScript types are not part of this graph.

### Emission

Emission is primarily string construction, not AST generation. Examples:

- `public-render/*` joins imports, helpers, template HTML, and generated functions as strings.
- `symbol-modules.ts` emits lazy handler/computed/DOM-update modules with template literals and `.join('\n')`.
- `source-module.ts` assembles final app and resume virtual modules as strings.
- Authored expressions are retained through `source.slice(start, end)` in `ast/source.ts`.

Some emitted JS is reparsed through `parseJavaScriptModule()` for analysis/rewrite, but there is no persistent output AST or printer abstraction. Several downstream operations use regex/string replacement, including handler containment, capture detection, identifier replacement, and exported-symbol renaming.

## 3. Graph-based architecture

The compile/runtime graph represents concrete dataflow:

```text
state path -> computed dependency path -> DOM subscription
          \-> event/behavior reads and writes
```

A DOM binding record identifies `graphNodeId + path + hostNodeId + target`; event symbols carry lowered reads/writes; computed nodes carry dependency paths. Runtime subscriptions are correspondingly explicit ([runtime/graph.ts](/Users/jacksm5pro/dev/open-source/markless/packages/runtime/src/graph.ts:179)):

```ts
export type RuntimeGraphSubscription = {
  readonly id: string;
  readonly graphNodeId: string;
  readonly path?: ReadonlyArray<string>;
  readonly run: (value: unknown) => DomJournalResult | void | Promise<...>;
};
```

Writes dirty a specific path; `pathsIntersect()` selects affected subscriptions and computed dependencies. Computeds are lazy and cached. Async computeds add dependency keys, versions, cancellation, snapshots, and boundary ownership. This is materially more precise than component-level invalidation.

Ownership/lifetime is split across records rather than encoded as graph edges:

- component, branch, repeat, and async-boundary IDs establish creation/locator scopes;
- keyed rows preserve logical identity;
- host-owned subscriptions return unsubscribe functions;
- `attach` cleanups are stored per host and run in reverse order on reactivation/removal;
- `shared()` definitions carry request/container/page lifetime;
- removed hosts release subscriptions, behavior cleanup, element handles, and event records.

Precision is mixed:

- Strong: ESTree structural traversal, import-bound API recognition, source spans, static member paths, alias maps, read/write AST kinds, branch/repeat/boundary ownership, computed-cycle analysis.
- Limited: no TypeScript checker; dynamic property paths are rejected; inferred values and call effects are opaque.
- Some downstream stages fall back to source-text techniques. `symbol-resolver.ts` uses substring/regex containment for handler reads/writes and imported references; `capture-analysis.ts` implements a custom lexical scan over emitted source strings. Therefore “semantic graph” is accurate for core binding/path work, but not every closure/capture decision is fully scope-resolved AST semantics.

Compared with Mitosis’s code-string-heavy component JSON, Markless has first-class identities and edges for state paths, dependencies, hosts, events, lifetimes, and resumability. That is a much better substrate for backend-independent behavioral transforms. It has not eliminated code strings: `functionSource`, handler sources, expression sources, and emitted modules remain strings. A Frameless design should preserve the graph records while replacing these textual islands with typed expression/function ASTs before attempting multiple idiomatic backends.

## 4. Analyzer package

`@markless/analyzer` is a browser evidence evaluator, not a compiler static analyzer ([README](/Users/jacksm5pro/dev/open-source/markless/packages/analyzer/README.md:3)). It consumes application-owned route/action policy and collected evidence, then emits stable invariant results and versioned verdict reports.

Core invariant families:

- `MLA-I1`: console/page errors.
- `MLA-I2`: undeclared, failed, malformed, or leaked requests.
- `MLA-I3`: missing, overlong-pending, or unexpectedly rejected async boundaries.
- `MLA-I4`: semantic interaction candidates without valid framework/router wiring.
- `MLA-I5`: bootstrap/action executed-JavaScript byte budgets.
- `MLA-S1`: preloads arrive before their interaction/navigation window.
- `MLA-S2`: served payload event claims reconcile with debug-channel runtime registrations.
- `MLA-S3`: payload locators resolve to exactly one correctly shaped live node.
- `MLA-S4`: debug-channel sentinels are present in positive controls and stripped from production.

The evidence surface includes route/action matrices, request and console ledgers, V8 coverage, boundary snapshots, candidate inventories, `window.__MARKLESS_DEBUG__`, served payload scripts, and built artifacts. Missing/incompatible debug evidence is treated as collection failure rather than success.

The verdict contract is deliberately small ([contracts.ts](/Users/jacksm5pro/dev/open-source/markless/packages/analyzer/src/contracts.ts:32)):

```ts
export interface AnalyzerInvariantResult {
  readonly id: AnalyzerInvariantId;
  readonly status: 'pass' | 'fail' | 'not-run';
  readonly details: readonly string[];
}
```

Witness integration is only an adapter from an externally-run box outcome into a receipt-bearing verdict ([witness.ts](/Users/jacksm5pro/dev/open-source/markless/packages/analyzer/src/witness.ts:3)):

```ts
export interface WitnessBoxOutcome {
  readonly name: string;
  readonly tags: readonly string[];
  readonly passed: boolean;
  readonly receiptPath: string;
}
```

`createWitnessVerdict()` maps this to `MLA-EXT-WITNESS`; `createVerdictReport()` normalizes IDs, validates schema version 2, combines results, and fails the report if any result fails.

For Frameless, this is a strong pattern for cross-target equivalence receipts: define target-neutral scenarios and invariants, then give each framework an evidence collector. It is not presently a proof of semantic equivalence: it covers selected browser behaviors and seams, depends on consumer-owned matrices/budgets, and reports explicitly skipped locator classes. Cross-framework work would need a richer shared observation model—DOM/host snapshots, event ordering, state transitions, cleanup, async traces, and framework-specific collection adapters.

## 5. Current emit targets

Today’s production compiler emits only the Markless web runtime model:

- direct-DOM CSR module for simple shapes;
- general CSR module;
- SSR module producing HTML;
- streaming SSR arm records/templates;
- lazy ESM modules for events, callback props, behaviors, computed runners, DOM updates, branch flips, and async-boundary commits;
- `markless/state` and `markless/view` payloads/scripts;
- a generated dynamic-import symbol resolver;
- runtime-demand/preload metadata;
- scoped CSS virtual modules.

`packages/bundler/src/transform.ts` packages these as a transformed JS module plus virtual payload, resolver, resume, symbol, and style modules ([transform.ts](/Users/jacksm5pro/dev/open-source/markless/packages/bundler/src/transform.ts:50)). Browser resume consumes existing HTML and payload records; it does not rerun the component body.

There is no production React/Vue/Svelte/Solid/UIKit/AppKit backend and no emitter target interface. `CompileTsrxModuleInput` has no target discriminator; public-render artifacts directly name DOM locators, HTML, attributes/properties, `document.createElement`, and `@markless/web` helpers.

The repository README mentions UIKit/AppKit, but those are hand-built `poc/fixtures/proofs/*` demonstrations. The README says the next step is automatic compiler production of those outputs. `specs/framework/11-platform-organization.md` likewise says web is the only production target and describes future `packages/mobile`/`packages/desktop` packages ([platform spec](/Users/jacksm5pro/dev/open-source/markless/specs/framework/11-platform-organization.md:29)).

The reusable seam is the pass/artifact architecture, especially semantic graph → state lowering → symbol/capture planning. A Frameless backend could replace everything from render/payload planning onward. However, the current `PayloadArena`, `PublicRenderPlan`, `SemanticTemplateBindingTarget`, and symbol kinds are already DOM/resume-shaped, so they are not an existing multi-framework backend interface.

## 6. Authoring semantics

The public APIs are compile-time stubs that throw if executed without compilation ([framework-api.ts](/Users/jacksm5pro/dev/open-source/markless/packages/core/src/framework-api.ts:49)). Components use TSRX `@{}` bodies with ordinary TypeScript statements and structural template constructs.

Supported semantic model:

- `state(initial)`: plain reads; assignment, updates, resolvable deep member writes, delete, and supported mutating collection calls. Invalidation is path-granular.
- `computed(fn)`: lazy, read-only derivation. Dependencies are statically collected; graph cycles and writes inside derives are errors.
- ordinary locals and statements: constants, accumulators, loops, helper calls, and pre-root `if (...) return null` are tested in CSR/SSR.
- props: getter-backed graph references; parameter destructuring and known graph destructuring become live aliases.
- `element<T>()` plus `el={handle}`: exactly-one host locator for later lazy imperative access.
- `attach={behavior}`: host-only behavior, reactive inputs, reinstall on input change, cleanup on removal; arrays install forward and clean up reverse.
- `shared(factory, {scope})`: named graph factories with request/container/page lifetime, graph return properties/methods, composition, and dependency-cycle checking.
- async: `computed(async ({signal}) => ...)`; pre-first-`await` reads form the key, post-`await` reactive reads are errors; `@try/@pending/@catch` owns pending/error UI.
- structural TSRX: `@if`, `@for` with key/index/`@empty`, `@switch`, `@try`, dynamic tags, fragments, scoped styles, and opaque children projection.

Important current restrictions, evidenced by compiler diagnostics/tests:

- APIs must be direct named imports from `@markless/core`; API aliasing is rejected.
- `state()`/`computed()` cannot be module-scoped, nested as graph values, created in unstable JS branches/loops/handlers, or written from templates/computeds.
- computed values and props are read-only.
- dynamic graph paths, optional-chain writes, graph destructuring defaults, and some repeat-row state/handle forms are unsupported.
- interactive/stateful `@for` requires a stable key; index keys warn.
- event spreads and object-valued `style` are rejected; event props must be functions.
- synchronous `preventDefault`/`stopPropagation` conditions must be extractable from graph state, constants/props, and event fields.
- `attach` is host-only; element handles cannot be stored in state, ambiguously bound, or freely forwarded through arbitrary object/member shapes.
- templates cannot be stored as ordinary values/state/computed values.
- rich same-module component/boundary combinations, component-rich `@empty`, member-expression component names, some fragment roots, and multiple conditional component roots still fail loudly.
- children are opaque projection, not inspectable/mappable VNodes.
- no effects/tasks, hooks, `resource()`, `.loading`, `.error`, `track()`, lifecycle-without-host, TSX/JSX files, or reactivity in plain `.ts`.

Relative to Mitosis, Markless is less syntactically restrictive in ordinary component code: locals, loops, helper calls, accumulators, guard returns, and normal assignment are supported; conditional/repeated UI uses first-class TSRX syntax rather than forced imported `Show`/`For` components. It is stricter around resumability and deterministic graph ownership: serializable captures, stable creation sites, static graph paths, async read timing, and host lifetimes. The current emitter still has incomplete template-shape coverage, so the language contract is broader than every implemented web emission path.

## 7. Maturity signals

- Version is `0.1.1`; the README explicitly says “under active implementation.”
- Development is extremely active: 748 commits from 2026-06-12 through this checkout’s 2026-07-19 history, with recent daily compiler/runtime/bundler work. This demonstrates momentum but also substantial architectural churn.
- Test inventory: 180 `*.test.ts` files under production packages, including 37 compiler tests, 28 bundler tests, 24 web tests, and 44 `vitest-browser` tests. An additional 37 box/demo test files cover build/application scenarios.
- Coverage strategy is layered: pass-artifact tests, emitted-byte snapshots, graph/runtime/serializer units, browser-mode DOM tests, Witness boxes, analyzer receipts, application checks, JS Framework Benchmark regression guards, and production build/resume fixtures.
- Specs are unusually extensive for a 0.1 project, but not uniformly complete. `12-arm-rendering.md` is marked draft/implementation-in-progress; `13-resume-cache.md` is specified but not implemented; `08-deferred-decisions.md` retains server functions, reveal coordination, style composition, and related work.
- Concrete half-finished signals remain in production diagnostics/comments: unsupported repeat-in-async-arm shapes, same-module child async boundaries, richer `@empty`, repeat-row graph scopes, conditional roots, capture/string-rewrite limitations, and deferred CSR execution logging.
- Public docs lag implementation: `docs/` is still essentially a generated Router sample, while the real documentation lives in internal-facing specs and package READMEs.
- The pass architecture is mature enough to reuse, but the implementation has not fully achieved its own abstraction ideal: the graph is typed, while expression/capture/output handling still relies heavily on source strings and the final artifacts are web-specific.

Read-only limitation: workspace dependencies were not installed, so `@markless/core` could not be resolved through Node and no tests were executed. The source package’s versioned `agent/markless.md` guidance was available and used. No files were modified.

---

## Unit B — reuse-vs-gap table (full report)

## Reuse-vs-gap table

Status means capability in the repository today, not whether it could plausibly be added.

| Capability | What a successor needs | Markless today | File evidence | Notes |
|---|---|---:|---|---|
| Semantic program IR: scopes, closures, types, dependencies | A typed, target-neutral representation of declarations, expressions, lexical scopes, captures, component/template structure, and reactive edges | **Partial** | [`buildSemanticGraph`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/index.ts:39>) parses with `@tsrx/core`; [`SemanticGraphArtifact`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:402>) records bindings, reads/writes, aliases, components, events, branches, repeats, locals, and async boundaries; local scope is only `'module' \| 'component' \| 'function'` in [`SemanticLocalDeclaration`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:390>). Expressions and function bodies remain source strings throughout collectors, e.g. [`collect-state.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/collect-state.ts:299>) and [`collect-shared.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/collect-shared.ts:32>). Closure capture uses textual identifier scanning in [`capture-analysis.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/capture-analysis.ts:127>). | This is substantially better than Mitosis’s string-only IR: reactive paths and many structural relationships are explicit. It is not yet a complete semantic graph: no type objects, symbol identities, lexical scope tree, control-flow graph, or AST-valued expressions survive into the artifact. Capture analysis can model resumability eligibility but is not a general closure model. |
| Compiler pass and artifact architecture | Versionable passes with declared inputs/outputs, inspectable artifacts, and target-neutral stages before emission | **Exists**, but current artifacts are Markless-shaped | [`defaultCompilerPasses`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/pass-registry.ts:3>) declares producers/consumers; [`validateCompilerPassGraph`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/pass-graph.ts:41>) enforces ownership/order; [`runCompilerPassPipeline`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/pass-pipeline.ts:10>) executes and can dump artifacts. | Excellent reusable compiler skeleton. The semantic graph/state-lowering boundary is the natural fork point. Payload arena, symbol resolver, protocol, public-render plan, and runtime-demand map encode Markless resumability and should not become the common cross-framework IR. |
| Reactive dependency model | Explicit state/computed nodes, path-sensitive reads/writes, invalidation, equality, scheduling, mutation, and lifecycle rules that targets can implement or approximate | **Partial** | [`SemanticGraphBinding`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:61>) and [`SemanticStateWrite`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:298>) carry node IDs, paths, operations, dependencies, and mutability. Runtime computed values are lazy and dirty-checked in [`graph-computed.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/runtime/src/graph-computed.ts:32>); writes use `Object.is`, path invalidation, and microtask flushing in [`graph.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/runtime/src/graph.ts:252>) and [`graph.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/runtime/src/graph.ts:355>). Arrays, maps, sets, and dates receive explicit mutator treatment in [`graph-collections.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/runtime/src/graph-collections.ts:39>). | Strong semantic nucleus, but it describes Markless’s graph rather than a proven cross-target contract. There is no public effect primitive; component bodies do not rerun. A successor needs a normative definition for observable scheduling, equality, batching, stale reads, cleanup, and async settlement before generators can claim equivalence. |
| Per-framework state/computed mapping | Idiomatic React, Vue, Svelte, and Solid output without changing behavior | **Partial / lossy** | Ordinary assignment is intentionally compiled, while the author API exposes values rather than containers in [`framework-api.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/core/src/framework-api.ts:38>). State lowering resolves writes to graph node/path operations in [`state-lowering.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/state-lowering.ts:471>). | **React:** scalar writes can become setters, but nested mutation requires immutable cloning/useReducer or a non-idiomatic external store; `useMemo` is render-driven rather than Markless’s graph-lazy memo. **Vue:** `ref`/`computed` align fairly well, but assignments need `.value`; object `reactive` has proxy/deep-tracking semantics different from explicit Markless paths. **Svelte:** `$state`/`$derived` and assignment syntax are closest, but deep proxies and collection handling do not exactly match explicit paths. **Solid:** signals/memos are closest for fine-grained invalidation; nested state generally needs stores/reconcile rather than plain signals. All four have different batching and effect/DOM-commit timing. |
| Async derivation and boundaries | One portable contract for cancellation, pending/fulfilled/rejected states, stale-value visibility, and SSR/client behavior | **Partial** | `@try/@pending/@catch` becomes explicit async-boundary ownership in [`collect-async.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/collect-async.ts:22>). Async runners use `AbortController`, version gates, dependency blocking, and retain the prior fulfilled value while rerunning in [`graph-async.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/runtime/src/graph-async.ts:91>) and [`graph-async.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/runtime/src/graph-async.ts:181>). | This is richer than a generic “Promise in component” model. React Suspense, Vue Suspense, Svelte async blocks, and Solid resources each differ in cancellation, stale content, error ownership, SSR streaming, and when pending UI appears. A direct primitive-to-primitive rewrite would not preserve Markless semantics. |
| Template control flow | Structural conditional/list/async nodes with identity and enough information for each target’s native syntax | **Exists**, with important restrictions | Parser nodes `JSXIfExpression`, `JSXSwitchExpression`, `JSXForExpression`, and `JSXTryExpression` are dispatched structurally in [`semantic-graph/index.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/index.ts:123>). [`SemanticBranchSite`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:187>) and [`SemanticKeyedRepeat`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:169>) preserve tests, arms, collections, keys, and ownership. Repeat keys are mandatory and limited to an item path or explicit index in [`collect-repeat.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/collect-repeat.ts:15>). | The structural representation can drive React ternaries/`map`, Vue `v-if`/`v-for`, Svelte `{#if}`/`{#each}`, and Solid `Show`/`For`. It is better than recovering control flow from JSX strings. Current renderability is narrower: nested/reactive branch plans and rows fail closed on various components, events, spreads, multiple roots, or non-path expressions; see [`branch-planning.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/public-render/branch-planning.ts:34>) and [`repeat-planning.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/public-render/repeat-planning.ts:72>). |
| Props and component graph | Typed props, component identity/imports, callbacks, children/slots, dynamic components, and ownership | **Partial** | [`SemanticComponentEdge`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:34>) records parent/child, import source, prop classifications, child count, and branch/repeat ownership. [`collect-components.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/collect-components.ts:33>) recognizes props and classifies values as graph references, callbacks, literals, or opaque. Component wiring composes SSR/CSR children and callback symbols in [`component-wiring.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/public-render/component-wiring.ts:7>). | Basic React-style props map naturally. However, children are compiler-owned HTML/template projection, not a portable node tree or slot function. There is no named-slot model. Member-expression component references are rejected and some projected/row children are markup-only. Vue/Svelte slots and Solid/React lazy children require a richer ownership/evaluation model. |
| Children/slots | Preserve laziness, multiplicity, identity, and named/default slot behavior | **Partial** | Markless explicitly makes children opaque: inspection, mapping, indexing, and mutation diagnose in [`validation.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/public-render/validation.ts:91>) and [`diagnostics.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/public-render/diagnostics.ts:112>). Semantic edges retain only `childCount`. | Plain `{children}` placement/pass-through is reusable. React children are inspectable values; Vue/Svelte have named/scoped slots; Solid children may be lazy accessors. Those cannot be recovered from the current semantic artifact. |
| Shared/context state | Explicit provider/consumer relationships and lifetime rules that survive SSR concurrency | **Partial** | [`SemanticSharedDefinition`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:134>) records factory, dependencies, returned graph/method properties, and request/container/page scope. Runtime patch/version behavior is implemented in [`graph-shared.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/runtime/src/graph-shared.ts:14>). | React/Vue/Solid context and Svelte context can transport a value, but their provider lifetime does not directly encode Markless request/container/page scopes or patch versions. Server request isolation and page/container ownership need target adapters and explicit tests. |
| Refs, element handles, and lifecycle | Portable element reference plus mount/update/unmount cleanup semantics | **Partial** | `element()` is a compiler-only `T \| undefined` handle in [`framework-api.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/core/src/framework-api.ts:46>). `el` bindings and `attach` behaviors are explicit graph records in [`collect-elements.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/collect-elements.ts:491>); behavior cleanup is host-owned in [`resume-behaviors.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/web/src/resume-behaviors.ts:19>). | Maps conceptually to React refs plus layout effects/ref callbacks, Vue directives/refs, Svelte actions, and Solid refs/`onCleanup`. Timing differs materially: Markless has host-lifetime attachments and no general component effect API. Forwarded/nested handles and several repeated-handle shapes are explicitly restricted. |
| Events | Native event semantics, handler ordering, sync cancellation, callback props, and delegation | **Partial** | Events retain event name, multiple handler sources/parameters, and extracted synchronous `preventDefault`/`stopPropagation` policy in [`SemanticEvent`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:241>). Guidance requires native events and warns that deferred handlers cannot rely on `currentTarget` in [`agent/markless.md`](</Users/jacksm5pro/dev/open-source/markless/packages/core/agent/markless.md:9>). Event spreads are rejected because static discovery is required in [`diagnostics.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/diagnostics.ts:851>). | Vue, Svelte, and Solid are close to native events. React’s synthetic event layer, delegation, currentTarget behavior, and modifier conventions differ. Preserving exact cancellation timing may require generated wrappers rather than a direct idiomatic handler attribute. |
| Emitter abstraction | Target plugins consuming semantic nodes and emitting framework ASTs through a printer | **Missing** | [`PublicRenderModuleArtifact`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:1165>) exposes module source as strings. [`js-ast.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/js-ast.ts:1>) only reparses generated JavaScript; it is not a builder/printer. HTML, CSR, SSR, keyed-repeat, and symbol emitters interpolate source strings, e.g. [`html.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/public-render/html.ts:22>) and [`symbol-modules.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/symbol-modules.ts:18>). Public-render plus symbol-module emission is about 9,037 lines. | The abstraction boundary is “semantic graph → Markless payload/render plans → specialized DOM/resume module strings,” not “target-neutral IR → target AST.” The pass pipeline and pre-emission graph are reusable; the existing emitters mostly are not. A successor needs a typed expression IR and per-target AST builders/printers or structured templates. |
| Analyzer/Witness as equivalence oracle | Drive the same prop/action cases against each target, normalize DOM/events, and compare observable traces | **Partial** | Package-level verdict, request, console, coverage, matrix, and Playwright mechanics are portable; the README calls the package root runtime-agnostic in [`analyzer/README.md`](</Users/jacksm5pro/dev/open-source/markless/packages/analyzer/README.md:1>). But boundary/wiring/locator checks consume `markless/view`, `data-async-container`, and `window.__MARKLESS_DEBUG__` in [`playwright.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/analyzer/src/playwright.ts:66>) and [`playwright.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/analyzer/src/playwright.ts:258>). [`createWitnessVerdict`](</Users/jacksm5pro/dev/open-source/markless/packages/analyzer/src/witness.ts:10>) only wraps an external pass/fail receipt. | It is a good harness substrate, not an equivalence oracle today. Console/network/action matrices, DOM serialization adapters, coverage, verdict schemas, and receipt plumbing can be reused. Markless boundary/payload/debug invariants cannot evaluate React/Vue/Svelte/Solid without target-neutral instrumentation. There is no built-in paired-run comparator for DOM snapshots, event traces, focus/selection, timing, cleanup, or SSR/hydration behavior. |
| Authoring ergonomics versus Mitosis | Broad TypeScript/TSX authoring without losing behavior during lowering | **Partial, materially broader than Mitosis** | Component body statements and locals are preserved in source order by [`render-body.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/public-render/render-body.ts:11>). The TypeScript fixture demonstrates local DOM values, generic functions, and ordinary TS diagnostics in [`typescript.tsrx`](</Users/jacksm5pro/dev/open-source/markless/packages/typescript-plugin/test/fixtures/completion-matrix/typescript.tsrx:1>). State destructuring and nested ordinary assignments are exercised in [`state-lvalues/valid.tsrx`](</Users/jacksm5pro/dev/open-source/markless/poc/fixtures/proofs/state-lvalues/src/valid.tsrx:1>). A null guard return before one template root is supported, while a second template return is rejected in [`diagnostics.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/public-render/diagnostics.ts:228>). | Developers can write component locals, module helpers, nested closures, destructuring, type annotations/generics, assertions, ordinary assignment/update/delete and collection mutation, async `computed`, fragments, dynamic tags, and structural `@if/@switch/@for/@try`. Unlike Mitosis, there is no observed naming blacklist and no forced `Show`/`For` component vocabulary. Restrictions versus React include: one compiler-selected root; no multiple conditional JSX returns; children are opaque; no arbitrary JSX expression as reliably reactive output; no general effects/hooks; no event spreads; style objects unsupported; dynamic graph paths/defaulted graph destructuring restricted; lazy handlers cannot capture local functions, DOM nodes, class instances, or nonserializable locals; several nested branch/repeat/component shapes fail closed. |
| TypeScript and type preservation | Resolve source types into the semantic IR and emit framework-native typed props/state/events with source maps | **Partial** | [`compileTsrxForTypeService`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/type-service.ts:70>) produces a virtual TSX document plus Volar mappings. The TypeScript plugin exposes `.tsrx` as TSX and maintains mapped diagnostics/completions in [`language.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/typescript-plugin/src/language.ts:72>). The JSX contract has native-element/event typing in [`markless-jsx.d.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/typescript-plugin/src/markless-jsx.d.ts:1>). Production transform explicitly strips types from emitted code in [`transform.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/bundler/src/transform.ts:29>). | Author types work well in the editor, including component prop checking through generated TSX. They do not flow into `SemanticGraphArtifact`; generated target modules are JavaScript and the production transform returns `map: null`. Preserving author interfaces/generics in React/Vue/Svelte/Solid output requires TypeScript checker integration, type-bearing IR nodes, target-specific type lowering, and emitted source maps. |
| CLI/build tooling | Framework target selection, config, incremental compilation, dependency resolution, dev server/HMR, and output packaging | **Partial** | `create-markless` is a project scaffolder with runtime-abstracted filesystem/prompts in [`cli/src/index.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/cli/src/index.ts:196>), not a multi-target compiler CLI. [`transformTsrxModule`](</Users/jacksm5pro/dev/open-source/markless/packages/bundler/src/transform.ts:63>) builds payload/resume/symbol virtual modules. [`createMarklessRolldownPlugin`](</Users/jacksm5pro/dev/open-source/markless/packages/bundler/src/rolldown.ts:85>) supplies client/server/lib transforms, virtual modules, HMR, preload, and chunk rewriting. | The CLI runtime abstraction, diagnostics formatting, Vite/Rolldown plugin shells, invalidation graph, and environment handling are useful. Most bundler internals are tightly coupled to Markless payload scripts, resumability, lazy symbols, preload plans, and `@markless/web`; a successor should reuse the shell selectively rather than generalize those protocols into every target. |
| Editor tooling | Syntax, language service, mapped diagnostics, completion, navigation, and target-aware config | **Partial, strongly reusable** | The TypeScript plugin creates mapped virtual TSX and Volar language-service integration in [`typescript-plugin/src/language.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/typescript-plugin/src/language.ts:72>) and [`typescript-plugin/src/index.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/typescript-plugin/src/index.ts:1>). The VS Code extension supplies grammar, tag closing, and both TypeScript plugins in [`vscode-plugin/package.json`](</Users/jacksm5pro/dev/open-source/markless/packages/vscode-plugin/package.json:42>) and [`extension.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/vscode-plugin/src/extension.ts:6>). | Parsing, mappings, grammar, tag closing, recovery during incomplete edits, navigation, and basic TSX typing are direct assets. Intrinsic/component contracts and target-generated diagnostics will need to vary by selected target. |
| Styling | Preserve scoped styles and translate style bindings idiomatically | **Partial** | `<style>` nodes are extracted and selector-scoped with a stable generated class in [`style-scopes.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/public-render/style-scopes.ts:14>). CSS is handed to the bundler as a virtual stylesheet in [`transform.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/bundler/src/transform.ts:104>). Object `style={...}` is rejected in [`diagnostics.ts`](</Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/diagnostics.ts:926>). | CSS parsing/scoping is reusable. Vue/Svelte have native scoped-style compilation; React/Solid usually need CSS modules, imported CSS, or runtime styles. A target-neutral styling contract, including class merging and dynamic style objects, remains new work. |
| Behavioral test corpus | Cross-target fixtures for mutations, keyed identity, events, async, SSR, disposal, focus, and composition | **Partial** | Compiler snapshots and browser fixtures cover many Markless semantics; examples include [`state-lvalues/valid.tsrx`](</Users/jacksm5pro/dev/open-source/markless/poc/fixtures/proofs/state-lvalues/src/valid.tsrx:1>), [`03-keyed-flow.tsrx`](</Users/jacksm5pro/dev/open-source/markless/demos/codegen-size/corpus/03-keyed-flow.tsrx:1>), and [`06-async-boundary.tsrx`](</Users/jacksm5pro/dev/open-source/markless/demos/codegen-size/corpus/06-async-boundary.tsrx:1>). The workspace test command includes compiler, browser, bundler, router, benchmark, and Witness-box lanes in [`package.json`](</Users/jacksm5pro/dev/open-source/markless/package.json:8>). | This is a valuable semantics corpus, but current assertions prove Markless output, not equivalence among framework targets. Fixtures should be promoted into target-neutral scenarios with normalized DOM/event/state traces and executed against every generated target. |

## Hardest translation problems

1. **Render-once graph semantics versus React’s rerender model.** Markless component bodies establish graph nodes and host wiring; they are not rerun on state change. Idiomatic React reruns the component, recreating locals and reevaluating ordinary statements, so directly emitting hooks can introduce repeated computation or side effects that Markless never performs. Avoiding that requires either a carefully partitioned React component or a less-idiomatic external-store runtime.

2. **Ordinary mutation with path-level identity.** Markless lowers `obj.x++`, array mutators, `Map`/`Set`/`Date` calls, aliases, and deletes into explicit path dirtiness. React requires immutable updates to make rerenders observable; Solid commonly needs stores for equivalent nested behavior; Vue and Svelte proxies are closer but track access and collection mutations differently. Preserving return values, aliasing, `Object.is` suppression, and exactly which subscribers wake is more difficult than syntax replacement.

3. **Async computed and boundary state.** Markless has cancellation, version gates, dependency blocking, pending snapshots, prior-value retention, and explicit fulfilled/pending/rejected arms. Framework Suspense/resource primitives disagree about stale content, cancellation, error propagation, waterfall behavior, and SSR streaming, so a fully idiomatic mapping is unlikely to be exactly equivalent without a generated adapter layer.

4. **Scheduling, DOM commit, and cleanup timing.** Markless batches dirtiness in a microtask, runs path subscriptions, journals DOM work, and treats graph flush and DOM commit as distinguishable. React batching/effect phases, Vue’s scheduler, Svelte’s flush, and Solid’s synchronous fine-grained propagation expose different observation points. `attach` cleanup must also land in each framework’s correct host lifetime phase, not merely its nearest-looking API.

5. **Composition semantics: opaque children, context lifetimes, refs, and native events.** Markless children are compiler-rendered projection, shared state has request/container/page ownership, element handles are locator-backed, and deferred handlers use native events with fragile `currentTarget`. React children/synthetic events, Vue and Svelte slots, and Solid lazy children all provide different value and lifetime semantics; preserving behavior while still producing recognizable idiomatic code requires a richer common model than the current component edge.

## Bottom line

The successor thesis is well-supported in four areas:

- Markless already proves that `.tsrx` can be parsed structurally and analyzed into explicit components, graph bindings, path reads/writes, aliases, branches, keyed repeats, events, async boundaries, shared ownership, element handles, and diagnostics.
- Its state-lowering and runtime graph provide a concrete semantic starting point far stronger than Mitosis’s code strings.
- Its declared pass/artifact pipeline is a sound place to insert a new target-neutral IR and independent target backends.
- Its type-service/editor tooling and browser/Witness harness offer substantial reusable infrastructure and a rich source fixture corpus.

The existing code does **not** yet establish the core cross-framework claim. The semantic graph still embeds source strings and lacks types, full lexical scopes, symbol-resolved closures, and a control-flow/effect model. Emission is a large Markless-specific string generator, not a retargetable AST backend. Analyzer/Witness validates Markless runtime protocols and generic browser health, but does not compare framework outputs behaviorally. Current `.tsrx` is broader than Mitosis yet still narrower than React in roots, children, captures, effects, reactive expressions, styles, and several composition/control-flow cases.

The most defensible architecture is therefore: reuse the TSRX parser, diagnostics discipline, pass runner, graph/path analysis, type-service mappings, test fixtures, and generic browser harness; introduce a new typed lexical/program IR before Markless payload planning; define target-neutral observable reactivity/lifecycle semantics; build new AST-based framework emitters; and add paired behavioral tests with target adapters. Treat the current DOM/resume emitter, payload protocols, and Markless-specific analyzer seams as one target implementation—not as the successor’s common backend.
