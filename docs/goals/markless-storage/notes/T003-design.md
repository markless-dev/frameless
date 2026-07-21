# T003 — Integration design + slice contracts (Judge)

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
