# T002 — Current/planned primitive surface with execution-timing semantics

EVIDENCE (cited to this checkout, main-descended branch worktree-storage-poc,
which includes composition-v1 GOAL COMPLETE). Purpose: give T003 real timing
semantics to assess per-class fit. Nothing here is a fit verdict.

## 1. attach — element-scoped behavior

Authoring shape (composition-v1 T001 pinned-capability note, §4):

```ts
const input = element<HTMLInputElement>();
<input el={input} attach={(node) => {
  node.dataset.ready = "yes";
  return () => { delete node.dataset.ready; };
}} />
```

- IR: `BehaviorRecord` (packages/compiler/src/schema.ts:442-473) — serialized
  behavior AST, `hostNodeId`, `inputs` (graph reads with provenance),
  `returnsCleanup`, `order`; built in packages/compiler/src/build.ts:409+
  (construct kind 'behavior', build.ts:110). Handle method calls are
  structured `HandleCall` records (e.g. `input?.focus()`), not raw refs.
- React lowering (packages/frameworks/react/src/emitter/index.ts:2930-3010):
  behaviors for a host are folded into ONE `useCallback` **callback ref** —
  node attach runs each behavior in `order`, collects cleanups; detach runs
  cleanups. TIMING: React callback refs run synchronously during commit
  (after DOM mutation, BEFORE the browser paints that commit) — layout-read
  capable on client-side mounts/updates. On an SSR-rendered page the first
  run happens at HYDRATION commit, i.e. AFTER the user has already seen
  server-painted HTML — attach can NOT prevent first-paint flash on SSR.
- Solid lowering (packages/frameworks/solid/src/emitter/index.ts:3185-3235):
  onMount/onCleanup-based — same class of timing (post-DOM, cleanup-paired;
  Solid refs/onMount run before paint on client mount, after first paint
  relative to SSR HTML).
- Inputs discipline: behavior graph reads carry provenance
  ('layer-a' | 'derived-from-ast') and are validated (react emitter
  index.ts:317-338) — behaviors are records with known dependencies, not
  opaque closures. This matters for any future re-run-on-change semantics.

## 2. element() handles + HandleCall

`element<T>()` produces a typed handle bound via `el={handle}`; reads like
`input?.focus()` become structured HandleCall records (composition T001 §4
table: elementHandleBindings + behavior-with-cleanup + no generic-attribute
fallback allowed). React: handle assignment folded into the same callback
ref (`handle.current = node`, emitter index.ts:2952-2961; forwarded handles
via `ref`).

## 3. storage() — recommended (UNRATIFIED) device-state contract

From storage-tradeoff (closed with named gap) + storage-poc (GOAL COMPLETE):
`storage(key, fallback)` persisted cell — inert at creation, lazy driver
read, app-level enablement emits a compiler-derived SYNC INLINE SEED SCRIPT
that runs during HTML parsing BEFORE FIRST PAINT (executed proof: T008
browser probe; T009 SSR probe; poc/09-storage green in
react/vue/svelte/angular). TIMING: this is the only family in the surface
that acts BEFORE first paint on an SSR page — via generated script, not
component code. Element-scoped variants were not probed (the seed targets
documentElement attributes + a window landing slot).

## 4. markless-native side (read-only, for completeness)

Resumable graph + payload seeding channel (storage-tradeoff P1: values can
land in the graph before runtime start). Behaviors/chunks wake lazily —
markless's whole premise; the owner's original storage pain ("in markless
it's no issue waking the one chunk; in Qwik visible task it's a big issue")
is the same asymmetry QDS components face with Qwik resumability.

## 5. Timing ladder (the axis T003 must score against)

1. **HTML-parse time, pre-first-paint** (SSR page, zero framework JS):
   ONLY the storage()-seed family reaches here today. Carousel-script-class
   candidates live here.
2. **Client commit, pre-paint for that commit** (node exists, not yet
   painted): attach reaches here in React (callback ref) and Solid
   (ref/onMount) for client-side mounts; measurement + synchronous DOM
   correction possible WITHOUT visible flash for client-rendered content.
3. **Post-hydration/resume on SSR content**: attach's first run on
   server-rendered elements — too late for first-paint correctness, right
   time for observers/listeners/focus wiring.
4. **Continuous/reactive**: ResizeObserver/MutationObserver/rAF — attach can
   host these (setup + cleanup shape fits); re-run semantics beyond
   setup/cleanup are NOT part of the current BehaviorRecord contract
   (single-run per attach with cleanup; inputs recorded but no re-invoke-on-
   input-change semantics found in the emitters — INFERENCE from read, flag
   for T003).

Gap candidates T003 must weigh (NOT conclusions): element-scoped pre-paint
script (class 1 for arbitrary elements, not just documentElement);
observer-as-primitive vs observer-in-attach (class 4); measurement-driven
first-render (class 1/2 boundary: SSR content whose correct initial layout
depends on client measurement — no current primitive reaches it pre-paint).
