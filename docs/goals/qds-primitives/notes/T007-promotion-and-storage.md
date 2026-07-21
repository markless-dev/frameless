# T007 — Promotion design (researched) + does storage() survive?

STATUS: SUGGESTIONS ONLY. Owner ratifies. Inputs: T001 QDS inventory, T002
surface map, T005 prior art (Qwik constraint model + ecosystem record), T006
executed promotion probe, storage-tradeoff/storage-poc evidence base.

## 1. The promotion design, refined by the research

Zero new API. Authors write `attach` + cells. The compiler promotes an
attach behavior to a parse-time inline script emitted after its element when
four statically-checkable rules hold:

  P1. Body serializable with NO runtime captures — only the node parameter
      and statically-resolvable constants. (Qwik's capture discovery is
      syntactic — transform.rs:982-1012 — ours is the same class of
      analysis; yuku scopes already resolve bindings.)
  P2. Inputs static-only — BehaviorRecord.inputs provenance already
      distinguishes graph reads; any graph read = demote.
  P3. returnsCleanup = false (already a record field). A parse-time script's
      closure cannot be re-entered for teardown.
  P4. Writes only to slot-seedable cells (the landing-slot channel executed
      green in T006/T008/T009 and production-proven by @nuxtjs/color-mode).

Demotion is the only failure mode, and it is benign: the same behavior runs
at hydration/resume with identical semantics (T006 executed both paths:
promoted = attr correct AT first paint, one measurement, runtime consumed
the seed; demoted = identical converged state, observably later). This is
the structural simplification vs Qwik: $ is SEMANTIC (code must cross, so
five error layers exist — lint, C02/C03, dev-runtime throw, serializer,
resume); promotion is OPTIMIZATION (may always decline), needing ONE
visibility layer, not five error layers.

Ecosystem verdict supporting implicitness here (T005): implicit SEMANTICS
failed (Svelte 4 -> runes retreat — inference changed meaning); implicit
OPTIMIZATION shipped and won (React Compiler stable with silent bailouts +
tooling + per-function opt-out; Marko auto-hydration). Promotion is the
second kind — demotion never changes meaning, only first-paint quality.

Required accompaniments (the React Compiler lesson, priced):
- A promotion report (which attaches promoted; for each demotion, the exact
  rule and source position that blocked it — mirror of Qwik's lexical-scope
  diagnostics but informational).
- The known regression class: one added runtime read silently demotes
  (perf/flash regression, never correctness). Mitigation is the report +
  optionally, later, a "must-promote" assertion — deliberately NOT proposed
  as API now.
- Element identity: currentScript adjacency (QDS technique, T006-executed)
  — none of Qwik's VNode identity machinery is needed.
- Retry semantics (load/fonts.ready) wrapped by the compiler by default
  (every real early script in the audit needed them).
- Novelty priced honestly: NO framework runs user code at parse time today
  (T005: Qwik's loader installs infrastructure only; precedent for shipping
  serialized-but-uninvoked functions exists in qFuncs). Promotion is
  first-in-class; QDS hand-rolling proves demand, not safety at ecosystem
  scale. CSP/nonce handling comes with the seed channel (winners thread
  nonces; T008 storage round).

## 2. Should we still need storage()? — YES as a declaration, NO as machinery

The question decomposes: promotion subsumes the storage SEED; it does not
subsume the storage CONTRACT.

What a raw attach+state recipe would look like without storage():

```ts
const theme = state('light');
<div attach={(node) => theme.set(localStorage.getItem('theme') ?? 'light')}>
```

Promotable (P1-P4 hold) — the READ+seed side works through the same channel.
But the corpus evidence (storage-tradeoff T006: six hand-rolled families,
keys hardcoded/colliding, ZERO consent gates anywhere, sync mostly absent,
byte-identical duplication) is precisely what this recipe recreates:

- WRITE-BACK: persisting on set needs a subscription (returns cleanup ->
  never promotable, and hand-written per usage).
- KEY IDENTITY: the compiler advantages the owner weighed in the storage
  round (static keys, namespacing, alias/version stability) require knowing
  "this is a persistence key" — a string literal inside arbitrary attach
  code is not a declaration.
- CONSENT: gating storage access as an app-level switch requires knowing
  which reads ARE storage reads. ePrivacy 5(3) analysis stands.
- CROSS-TAB SYNC, DRIVER CHOICE (localStorage/session/cookie/MMKV-class):
  contract features, not early-execution features. Cookie driver notably
  changes WHERE seeding happens (server-side — Nuxt precedent).
- DOCUMENT-LEVEL SEEDING: promotion is element-scoped (BehaviorRecord has a
  host); storage cells have no host element.

SUGGESTED ANSWER: keep `storage(key, fallback)` as the persistence
DECLARATION — but it stops owning any bespoke machinery. It becomes a
compiler-known cell whose seed is simply a document-level instance of the
SAME promotion channel (early script + landing slot), with write-back,
sync, consent gating, and driver selection generated from the declaration.
One channel, two entry points: attach-promotion (element-scoped, derived)
and storage() (document-scoped, declared). The 4-framework POC and all
seed probes remain valid evidence for both.

Menu:
  (a) RECOMMENDED: storage() stays as compiler-known declaration; promotion
      becomes the unified early-script channel under both it and attach.
  (b) Drop storage(); document the attach+state recipe. Cheapest surface;
      predictably reproduces the corpus's four failure classes in userland.
  (c) Defer storage(); ship promotion first, revisit with usage data.
      Viable ordering; risks the interim hand-roll wave (b)'s costs.

## 3. What remains unproven (priced)

- Promotion's static analysis on REAL attach bodies at scale (probe emulated
  compiler output; no analyzer implementation exists). Price: an analyzer
  spike over the QDS-derived cases when implementation begins.
- Streaming SSR interaction for element-adjacent scripts (spec-guaranteed
  ordering + next-themes production evidence carried from T008; not
  re-executed for arbitrary element positions).
- Multi-instance pages (two carousels -> two scripts): currentScript
  adjacency handles identity; slot KEYING for element-scoped results needs a
  scheme (per-instance ids) — designed, unprobed.
- The promotion report's UX (the thing that makes implicitness livable) is
  asserted from React Compiler's trajectory, not prototyped.

## 4. Misfire self-check

Nothing ratified. The zero-new-API direction was owner-pushed and the record
says so (T004 receipt). The storage answer is a menu, not a decision; (a) is
argued, (b)/(c) are stated with real costs. Corrections carried: carousel =
measurement-first; zero observers in QDS; promotion novelty priced.
