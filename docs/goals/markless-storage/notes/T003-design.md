# T003 — Integration design + slice contracts (Judge)

> REVISION NOTE: v1 of this design was REJECTED by second-model critique
> (12 findings, 6 blockers — banked in the T003 receipt). Sections marked
> [v2] below supersede the corresponding v1 text; unmarked sections stand.
> The v1 text is preserved underneath for the audit trail.

## [v2] D1'. Representation: writable state-kind binding + storage metadata

storage() does NOT ride shared()'s factory/member lowering (critique B1 —
that path resolves member accesses through returned properties and a bare
SemanticStorageDefinition would be invisible to graph-path lookup, lowering,
payload DOM updates, and symbol generation). Instead:

- A storage declaration lowers to a WRITABLE BINDING REUSING kind: 'state'
  with an attached `storage: { key }` metadata field on the binding record
  (artifacts.ts). Every existing kind-discriminating consumer treats it as
  state; only payload-arena/protocol-state/seed generation discriminate on
  the metadata. Graph id: definition-owned `storage:<moduleId>#<key>` (NOT
  claimed instance-scoped — see D3' slot schema).
- Module-scope declaration; v1 usage scope = whatever shared() supports
  for imports today, matched exactly (no new cross-file machinery).
- REACHABILITY (critique B2): storage cells/metadata/seed entries are
  emitted ONLY for definitions whose binding is used by an emitted
  component closure. Unused declaration ⇒ nothing in payload, nothing in
  seed, ZERO driver access — enforced by a negative test.

## [v2] D2'. Transport: explicit capability policy

- payload-arena + the COMPILER protocol-state producer (passes/
  protocol-state.ts — critique M4: the producer is compiler-side, not
  serializer-side) carry storage cells (fallback values) + `storage[]`
  records {graphNodeId, key}.
- COMPATIBILITY POLICY (critique B3 — unknown-field tolerance would make
  old runtimes silently drop persistence): protocol gains a `capabilities`
  array; decoders REJECT unknown capabilities; payloads with storage emit
  `capabilities: ['storage']`. Storage-free payloads are byte-identical to
  today's. This is the named T006 critique item.
- Full-tier enforcement (critique B8): the storage requirement threads into
  BOTH runtime-demand planning AND `transform.needsFullResume` (the actual
  selector), with a negative build test asserting a storage page never
  emits a lean dispatcher.

## [v2] D3'. Seed: render-time generation, neutral slot, two host contracts

- Seed is NOT a prebuilt static head injection (critique B5 — headInjections
  are serialized into immutable artifact metadata before render options
  exist, so a render-level consent flag could never suppress a prebuilt
  script). Instead: the compiler/bundler carries STRUCTURED storage seed
  metadata ({graphNodeId, key, fallback} list) on the SSR artifact; the
  executable script is GENERATED during container assembly
  (render-to-string) after applying `RenderToStringOptions.storageAccess:
  'immediate' | 'deferred'` (new option). Deferred ⇒ the emitted script
  fills the slot with fallbacks WITHOUT touching the driver.
- TWO HOST CONTRACTS, both tested (critique M6): router hosts get the seed
  relocated into <head> (create-server-entry path); direct renderToString
  hosts receive it as the LEADING executable fragment of the returned HTML
  (documented contract — renderToString does not insert into a head it
  does not own).
- SLOT (critique B11): branding-neutral, protocol-owned:
  `globalThis[Symbol.for('tsrx.storage/1')]` — a map keyed by a
  collision-free schema `<moduleId>#<key>` (definition identity), reserving
  a future `@<elementInstance>` suffix for promotion. The symbol key and
  entry schema are protocol constants exported by @markless/serializer;
  frameless consumes the constant, not a branded literal. No claim that
  current graphNodeId construction proves promotion-compat — the SCHEMA is
  the compatibility surface.

## [v2] D4'. Runtime: lazy-cell capability in the graph + hardened plane

- LAZY READS (critique B7 — RuntimeGraph.read hits the cell map directly;
  no first-read hook exists): packages/runtime/src/graph.ts gains an
  explicit lazy-cell capability — a cell may carry a `read initializer`
  invoked EXACTLY ONCE on first read (replacing the stored value, marking
  dirty, honoring consent suppression), with tests for exactly-once,
  failure (initializer throws ⇒ fallback + no retry storm), and
  notification semantics. The storage plane supplies initializers; the
  graph owns the hook.
- WRITE-BACK HARDENING (critique M9): every driver write and root-attr
  update wrapped per-subscription try/catch (quota/security errors must
  not reject the flush or starve later subscriptions); tested.
- ATTR POLICY (fold into key checkpoint): v1 keys must match
  `[a-z][a-z0-9-]*` (new diagnostic) — keys are then valid data-* names by
  construction; escaping schemes are a later owner choice.
- CONSENT ACTIVATION (critique B5 tail): deferred-mode activation is a
  HOST/CONTROL-PLANE api on the container/runtime handle (working name
  `container.enableStorage()`), NOT a core authoring export.
  [OWNER-CHECKPOINT: naming + surface placement, presented at delivery.]

## [v2] D5'. Import sources: real threading, scoped

`additionalFrameworkApiSources` threads through SemanticGraphInput →
buildSemanticGraph → CompileTsrxModuleInput (compile-module.ts) — the
actual entry points (critique M10). v1 SCOPE: direct compiler consumers
only (frameless invokes the compiler directly); bundler/Vite/Rolldown
option plumbing and TS-plugin auto-import behavior are RECORDED follow-ups,
not v1.

## [v2] D6'. Slices (recut per critique M12)

- W1a declaration+binding: core stub/types/exports; collect-module-scope +
  new collect-storage; artifacts.ts binding metadata; semantic-graph
  index/types/diagnostics; reachability + unused-storage negative test;
  state-lowering only if discrimination leaks (escalate if structural).
- W1b transport+tier: payload-arena; compiler passes/protocol-state.ts;
  serializer protocol/protocol-state/protocol-validation (capabilities);
  runtime-demand-map + bundler transform.needsFullResume + chunking
  metadata; negative lean-tier test; tests.
- W1c import-sources (small; direct-compiler scope only).
- W2a seed+render policy: SSR-artifact seed metadata (bundler transform/
  source-module); serializer storage-seed helper + slot constants;
  render-to-string storageAccess + generation + nonce; render-to-stream
  parity; two-host-contract tests.
- W2b runtime: graph.ts lazy-cell capability + tests; storage plane
  (write-back, try/catch, attr) in web; payload-graph-construct slot
  override; resume-runtime wiring; enableStorage control surface.
- W2c browser proof: vitest-browser harness extension (ssr-plugin render
  options — currently hardcoded/rejecting options, so harness work is IN
  SCOPE) + fixtures executing the storage-poc contract: cold/warm/
  write+reload/deferred-consent.
- Order: W1a → W1b (+W1c riding) → T006 mid-critique → W2a → W2b → W2c →
  T006 full boundary critique → W4 frameless (unchanged from v1).

## [v3] Confirm-pass deltas (B1/B2/B3/M12 closures)

- B1 CLOSURE: the module-scope `storage(...)` call itself is lowered by the
  public-render pass — packages/compiler/src/passes/public-render/shared.ts
  (which owns module-scope preserved calls) and render-body.ts (which today
  lowers only literal `state(...)`) BOTH gain storage handling so no
  executable `storage()` call survives into output. These two files are in
  W1a's allowed set (M12 closure). The core stub remains throw-on-execute;
  compiled output must never retain the call — asserted by a compile test.
- B2 CLOSURE: reachability is a named artifact — `usedStorageBindings`:
  computed from the semantic graph's component expression/read-write
  records (collect-expressions products) as the set of storage bindings
  referenced by any emitted component closure; produced as part of the
  payload-arena pass input (a small pre-filter step in payload-arena.ts,
  which currently emits every state binding — the filter is the insertion
  point). Both the payload cells AND the seed metadata derive from this
  same set. Negative test: unused storage definition ⇒ absent from
  payload, absent from seed metadata, zero driver access in the browser
  lane.
- B3 CLOSURE: explicit VERSION BUMP, old-decoder-visible: payloads whose
  `storage[]` is non-empty emit `version: 2`; the current v1 decoder
  validates the version field and rejects unknown versions (verify in
  W1b and cite the rejection site in its receipt — if v1 decoders do NOT
  reject unknown versions, make version validation strict first, as part
  of W1b). Storage-free payloads remain version 1, byte-identical.
  Capabilities array is DROPPED from the design (version bump supersedes).
- M12 CLOSURE: W1a allowed_files += packages/compiler/src/passes/
  public-render/shared.ts, packages/compiler/src/passes/public-render/
  render-body.ts (and their tests).

## [v4] B2 final closure — reachability at state's own granularity

Confirm-2 established payload-arena has no emitted-root artifact — and that
today it emits EVERY state binding of a compiled module (critic's citation,
artifacts.ts:520-523 / payload-arena semantics). Inventing a root-selection
artifact for storage would give storage STRICTER reachability than state
itself has. v4 therefore defines two-stage reachability matching existing
semantics exactly:

1. COMPILE-TIME (the new filter): `usedStorageBindings` = storage bindings
   appearing in at least one component read/write record of the compiled
   module. A declared-but-unreferenced storage() is dropped from payload
   cells AND seed metadata — the inert-declaration guarantee (declare
   without use ⇒ zero driver access) holds at the place the owner stated
   it.
2. MODULE-LEVEL: modules not shipped into a page contribute nothing — the
   bundler's existing module pruning, no new artifact, cite in W1b receipt.

RECORDED LIMIT (same limit state has today): a storage binding used by a
component that ships in the page bundle but never renders will still seed.
This is byte-consistent with how state payload cells behave and is the
promotion-compatible boundary; tightening both together is possible future
work, not a storage-specific gap.

PM adjudication: three critique rounds converged to this single granularity
question; accepted PM-side on the critic's own evidence (matching existing
state semantics cannot introduce a new violation). Packet-cutting proceeds.

---
(v1 text below, superseded where marked)


Inputs: T002 surface map (all citations there), ratified direction (charter),
storage-poc contract (65/65 reference), T009 SSR pattern. DETAILS marked
[OWNER-CHECKPOINT] are presented before/at delivery, not silently decided.

## D1. Declaration: module-scope, shared()-shaped

`storage(key, fallback)` joins core's framework API (framework-api.ts stub +
union + index export; throws on direct execution like the others). It is a
MODULE-SCOPE declaration collected alongside shared() (collect-module-scope),
recorded as new `SemanticStorageDefinition` (artifacts.ts unions extended):
`{ id, graphNodeId, key, fallback }`.

- v1 KEY RULE: `key` must be a static string literal; anything else gets a
  new diagnostic (MARKLESS_STORAGE_KEY_STATIC). This is the minimal
  key-identity decision; namespacing schemes remain [OWNER-CHECKPOINT],
  presented at delivery with options (verbatim key = v1 default; prefix
  config; hashed module-scoped ids).
- v1 VALUE RULE: string values only (fallback must be a string literal or
  diagnostic). Non-string/serialized values are out of tranche.
- Reads/writes lower like state reads/writes against its graphNodeId
  (state-lowering path shared() already exercises).

## D2. Transport: protocol storage section (+ trigger-gate fix)

- payload-arena includes storage cells in `cells[]` (value = FALLBACK —
  servers cannot read localStorage; the honest contract requires fallback
  here) and a NEW protocol section `storage[]`:
  `{ graphNodeId, key }` (driver implicit localStorage in v1). Protocol
  version: extend v1 with an OPTIONAL field rather than bumping — decoders
  ignore unknown optional sections; validation updated accordingly.
  Payload compatibility = named critique item for T006.
- `hasBrowserTriggers` gate (render-to-string.ts:258): presence of storage
  definitions ⇒ payload REQUIRED even with no other triggers (T002 conflict
  #4). Without this, storage-only pages lose their seed.

## D3. Seed channel: early head script + landing slot + wake override

Browser/SSR output gains a compiler-generated EARLY script via the existing
headInjections machinery (transform.ts:180 → router insertion before
</head>; nonce already applied to executable head injections in
render-to-string; the router-nonce gap is RECORDED, not fixed here). The
script is generated from the statically-known storage records:

  for each {key, fallback}: read localStorage.getItem(key) (try/catch),
  v = stored ?? fallback; slot[graphNodeId] = v;
  document.documentElement.setAttribute('data-'+key, v)
  — slot = `window.__MARKLESS_STORAGE__` (frameless re-exports the same
  slot name via its adapter; naming is internal, not consumer-facing).

On wake, payload-graph-construct overrides storage cells from the slot
before `createRuntimeGraph` (values land in graph before runtime start —
the P1 sequencing, re-verified on this HEAD by T002 conflict #2). If the
slot is absent (CSR, script stripped), the cell lazily reads the driver on
first graph read — the POC's lazy contract — implemented in the storage
plane, not in generic cell code.

- Native/no-DOM output: payload channel only; no script.
- Promotion-compatibility: the slot is keyed by graphNodeId (instance-
  scoped ids), and script generation is a standalone serializer helper so
  element-scoped early scripts can reuse it later. No promotion work now.

## D4. Runtime: storage plane (write-back + attr), full tier v1

A small storage plane in @markless/web (parallel to graph-shared's pattern):
at resume-runtime construction, for each storage record install a graph
subscription → localStorage.setItem(key, value) + root-attr maintenance.
Batched-notify semantics (graph.ts flush) are ACCEPTED for write-back — the
driver write happens on flush, same-value writes suppressed (matches the
T004b notification-atomic concerns; cite in tests).

- v1 TIER SCOPE: storage demands the FULL runtime tier (runtime-demand-map
  marks storage ⇒ full graph). Lean tiers (lean-shared cell maps) do NOT
  get storage in v1 — recorded limitation, design-compatible later.
- Cross-tab sync: NOT in v1 (designed: a `storage` event listener in the
  plane; deferred).
- CONSENT GATE [OWNER-CHECKPOINT on surface/naming]: mechanism v1 — a
  render/app-level flag `storageAccess: 'immediate' | 'deferred'` (default
  immediate, matching all observed production systems). When 'deferred':
  the early script emits NOTHING driver-touching (slot filled with
  fallbacks), lazy reads return fallback without driver access, and a
  runtime `enableStorage()` triggers the exactly-once read+patch (P2-proven
  path) and enables write-back. Mechanism lands in v1; the public NAMING
  and default go to the owner at delivery.

## D5. Import sources: config, not branding

`frameworkApiSources` (imports.ts:7) becomes extensible via a compiler
option `additionalFrameworkApiSources: string[]` threaded from compile
entry points. Markless gains NO frameless branding; frameless passes
`['@frameless/core']` (or its chosen name) when invoking the compiler.
This resolves P5 properly (accepted-import-sources) — named critique item.

## D6. Slice contracts

W1 (markless: declaration + records + transport) — allowed:
  packages/core/src/framework-api.ts, core index/types, core tests;
  packages/compiler/src/passes/semantic-graph/{imports,collect-module-scope,
  collect-shared-adjacent new collect-storage}.ts, artifacts.ts,
  payload-arena.ts, state-lowering.ts (member/read lowering only),
  runtime-demand-map.ts; packages/serializer/src/{protocol,protocol-state,
  protocol-validation}.ts; matching tests in compiler/serializer/core.
  verify: pnpm test:compiler + vp test packages/{core,serializer}/test.
  stop_if: protocol change requires breaking v1 shape; state-lowering
  needs structural change; suite red twice same cause.

W2 (markless: seed script + storage plane + gate fix) — allowed:
  packages/serializer/src/(new storage-seed).ts + payload-scripts.ts;
  packages/web/src/{render-to-string,payload-graph-construct,
  resume-runtime}.ts + new storage-plane file; packages/bundler/src/
  {transform,source-module}.ts (headInjection wiring only);
  packages/web/test/* + one vitest-browser lane test executing the
  storage-poc contract (cold/warm/write+reload/deferred-consent).
  verify: vp test packages/web/test + focused browser lane + test:compiler.
  stop_if: render-to-string assembly requires reordering beyond adding a
  head injection; browser lane infra can't express the contract.

W3 (markless: import-source config) — small; may ride with W1. allowed:
  imports.ts, compiler options plumbing, one test.

T006 critique (REQUIRED: public API + payload protocol + emission): rerun
suite, review protocol optional-section compatibility, API fidelity to
ratified direction, seed-script CSP/nonce, gate fix correctness.

W4 (frameless consumption, after T006): vendor repack from feat/storage
(all 8 tarballs, revs recorded in PROVENANCE), frameless compiler:
recognize storage() (enriched IR record), React emitter: seed script into
SSR shell (T009 pattern) + cell lowering per storage-poc react adapter +
additionalFrameworkApiSources usage for branding; e2e: storage-poc
assertions against EMITTED output; full lane green.

## Misfire self-check

Fallback-in-payload (not real value) keeps the honest contract server-side;
storage-only trigger gate fixed; no branding in markless; lean tiers +
cross-tab + namespacing + non-string values explicitly OUT with records;
two [OWNER-CHECKPOINT]s named (key namespacing, consent surface naming) —
mechanisms land, surfaces await the owner.
