# Frameless composition v1: children/slots, shared state, refs

> Successor tranche to `frameless-product-v0` (closed `full_outcome_complete: true`,
> HEAD 8db86c1). This tranche ships the composition surface — the capabilities
> library authors actually need — on the proven pipeline (dossiers -> emitters ->
> gates -> cross-target oracle -> receipts).

## Objective

Extend Frameless so multi-component TSRX libraries compile end-to-end into both
targets: **children/slots** (cross-file component composition), **shared state**
(markless `shared()` lowered to each framework's idiomatic shared-state mechanism),
and **refs** (element access across component boundaries), with cross-target
equivalence receipts covering composition scenarios.

## Original Request

"Yes give us this [the composition surface: children/slots, context, refs — what
library authors actually need], and make sure we're doing it the idiomatic way. I
don't know if React Compiler makes it fast or not when doing context — if I
remember, context used to be pretty inefficient in React. Either way our shared
function should make the conversion here simple, because they should have the info
the framework needs for shared state."

## Goal Oracle

`From a fresh checkout, the documented command compiles a demo TSRX library that
composes components across files (children/slots), shares state between components
via shared(), and uses refs — into React 19 and Solid packages passing each
target's conventionality gate, with green cross-target equivalence receipts in
headless Chromium whose scenarios exercise composition (slot content rendering,
shared-state updates propagating across component boundaries, ref-driven focus) —
and every v0 product suite plus poc/01..08 evidence suite stays green.`

## Non-Negotiable Constraints

- **User directive (2026-07-20, verbatim intent):** React's lowering of `shared()`
  must be decided with EVIDENCE, not taste. React context was historically
  inefficient (re-render propagation); whether React Compiler changes that must be
  VALIDATED, not assumed. Candidate idioms to weigh in the dossier: context (+ memo
  discipline), context selectors, `useSyncExternalStore`-backed external store,
  prop threading. The deciding principle: markless `shared()`'s semantic records
  (reads/writes granularity per component) carry the information the emitter
  needs — the emitter consumes recorded semantics; no framework-side guessing.
- Idiom dossiers BEFORE emitters, per construct, corpus-evidenced with citations
  and overturn triggers — same protocol as T002/T003 of v0. React Compiler
  interplay gets its own evidenced ruling.
- The markless repo stays read-only (fixing board still owns it). The pinned
  vendored tarballs are 0.1.1: the first Scout must establish what the PINNED
  compiler actually supports for children/slots/shared/refs (markless upstream has
  moved — e.g. slot/passthrough work — but the pin may not include it). If the pin
  is insufficient, that slice BLOCKS pending the gated vendor refresh and the board
  surfaces it; do not patch vendored code, do not touch markless.
- Enriched IR changes are versioned deliberately (`frameless-enriched-ir/2` if the
  contract must grow) with fail-closed validation both sides, per the v0 pattern.
- v0 stays green throughout: all product suites, both browser lanes, `pnpm e2e`,
  and poc evidence suites are regression gates on every merge.
- Scope guard (recorded misfire): SSR (sketch exists at
  ../frameless-product-v0/notes/ssr-tranche-sketch.md), vendor refresh + IR
  upstreaming (gated on the markless fixing board), Solid 2 migration (gated on
  the beta.9 blocker overturn trigger), and Qwik v2 are NOT this tranche.
- Fable session process carries over: crew dispatch, PM diff-review of every unit,
  run-or-skip critique reason at each merge, second-model critique mandatory for
  emitter/architecture packages, honesty rules (no claim beyond proof, receipts
  never fabricated), crew-worktree lessons (vp-lint hook, node_modules).

## Stop Rule

Stop only when the final audit proves the oracle from a fresh checkout and records
`full_outcome_complete: true`. Composition demos must be REAL multi-component
libraries, not single-file fixtures renamed. The recorded misfire: React context
adopted (or rejected) by taste instead of evidence; shared() lowered by guessing
instead of consuming IR records; scope creep into SSR/Qwik/vendor-refresh.

## Canonical Board

`docs/goals/frameless-composition-v1/state.yaml` — state.yaml wins over this file.

## Run Command

```text
/goal Follow docs/goals/frameless-composition-v1/goal.md.
```
