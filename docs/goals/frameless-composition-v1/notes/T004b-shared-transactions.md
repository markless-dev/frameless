# T004b-shared-transactions (crew scout, executed probes, 2026-07-20)

Executed read-only React 19.2.3 probes support a notification-atomic transaction contract.

## Recommendation

For emitted multi-cell methods:

- Apply cell writes synchronously in authored order. Later method statements must read earlier writes.
- Suppress subscription notifications while the method is running.
- On successful outermost method completion, enter one post-method notification phase.
- Notify only cells whose final value changed by `Object.is`; do not invalidate every store consumer.
- Cache non-scalar snapshots by cell/version. Repeated `getSnapshot()` calls for an unchanged version must return the identical object.

This is atomic at the subscription boundary: React subscription callbacks and renders cannot observe `A-new/B-old`. It is intentionally not rollback isolation—authored code inside the method observes sequential write-through state.

## Findings

Notify-per-write exposed the intermediate state synchronously:

```text
write A -> A1/B0
notify A at A1/B0
notify->A callback sees A1/B0
```

React nevertheless coalesced rendering: A-only, B-only, and two-cell consumers each rendered once after dispatch and saw only `A1/B1`. Event-batched, microtask, and timeout scheduling produced the same result.

Post-method notification removed the intermediate subscription observation while retaining the same render counts:

```text
write A -> A1/B0
write B -> A1/B1
post-method notification phase at A1/B1
notify A at A1/B1
notify->A callback sees A1/B1
```

Automatic batching is therefore insufficient as the contract. It happened to protect rendered output in these probes, but inline subscription callbacks still observed partial state. Notification deferral establishes the stronger invariant independently of React scheduling.

Rebuilding an object snapshot per read caused React’s cache warning, 54 renders, and maximum-update-depth failure. A cached snapshot produced one initial and one update render.

## Verbatim primary output

```text
versions react=19.2.3

=== per-write / event ===
render A#1 sees A0/B0
render B#1 sees A0/B0
render Pair#1 sees A0/B0
-- dispatch=event --
method start A0/B0
write A -> A1/B0
notify A at A1/B0
notify->A callback sees A1/B0
notify->A callback sees A1/B0
write B -> A1/B1
notify B at A1/B1
notify->B callback sees A1/B1
notify->B callback sees A1/B1
method end A1/B1
render A#2 sees A1/B1
render B#2 sees A1/B1
render Pair#2 sees A1/B1
render totals A=2 B=2 Pair=2

=== per-write / microtask ===
render A#1 sees A0/B0
render B#1 sees A0/B0
render Pair#1 sees A0/B0
-- dispatch=microtask --
method start A0/B0
write A -> A1/B0
notify A at A1/B0
notify->A callback sees A1/B0
notify->A callback sees A1/B0
write B -> A1/B1
notify B at A1/B1
notify->B callback sees A1/B1
notify->B callback sees A1/B1
method end A1/B1
render A#2 sees A1/B1
render B#2 sees A1/B1
render Pair#2 sees A1/B1
render totals A=2 B=2 Pair=2

=== per-write / timeout ===
render A#1 sees A0/B0
render B#1 sees A0/B0
render Pair#1 sees A0/B0
-- dispatch=timeout --
method start A0/B0
write A -> A1/B0
notify A at A1/B0
notify->A callback sees A1/B0
notify->A callback sees A1/B0
write B -> A1/B1
notify B at A1/B1
notify->B callback sees A1/B1
notify->B callback sees A1/B1
method end A1/B1
render A#2 sees A1/B1
render B#2 sees A1/B1
render Pair#2 sees A1/B1
render totals A=2 B=2 Pair=2

=== post-method / event ===
render A#1 sees A0/B0
render B#1 sees A0/B0
render Pair#1 sees A0/B0
-- dispatch=event --
method start A0/B0
write A -> A1/B0
write B -> A1/B1
post-method notification phase at A1/B1
notify A at A1/B1
notify->A callback sees A1/B1
notify->A callback sees A1/B1
notify B at A1/B1
notify->B callback sees A1/B1
notify->B callback sees A1/B1
method end A1/B1
render A#2 sees A1/B1
render B#2 sees A1/B1
render Pair#2 sees A1/B1
render totals A=2 B=2 Pair=2

=== post-method / microtask ===
render A#1 sees A0/B0
render B#1 sees A0/B0
render Pair#1 sees A0/B0
-- dispatch=microtask --
method start A0/B0
write A -> A1/B0
write B -> A1/B1
post-method notification phase at A1/B1
notify A at A1/B1
notify->A callback sees A1/B1
notify->A callback sees A1/B1
notify B at A1/B1
notify->B callback sees A1/B1
notify->B callback sees A1/B1
method end A1/B1
render A#2 sees A1/B1
render B#2 sees A1/B1
render Pair#2 sees A1/B1
render totals A=2 B=2 Pair=2

=== post-method / timeout ===
render A#1 sees A0/B0
render B#1 sees A0/B0
render Pair#1 sees A0/B0
-- dispatch=timeout --
method start A0/B0
write A -> A1/B0
write B -> A1/B1
post-method notification phase at A1/B1
notify A at A1/B1
notify->A callback sees A1/B1
notify->A callback sees A1/B1
notify B at A1/B1
notify->B callback sees A1/B1
notify->B callback sees A1/B1
method end A1/B1
render A#2 sees A1/B1
render B#2 sees A1/B1
render Pair#2 sees A1/B1
render totals A=2 B=2 Pair=2

=== snapshot rebuilt-per-read ===
render#1 snapshot=0@0
render#2 snapshot=0@0
render#3 snapshot=0@0
render#4 snapshot=0@0
render#5 snapshot=0@0
render#6 snapshot=0@0
render total=54
warning cache-result=true
threw maximum-depth=true

=== snapshot cached-per-version ===
render#1 snapshot=0@0
render#2 snapshot=1@1
render total=2
warning cache-result=false
threw maximum-depth=false
```

A control outside `act` confirmed that `act` was not masking a render difference:

```text
=== outside-act event-batched ===
render#1 A0/B0
method start
write A
callback A sees A1/B0
after notify A
write B
callback B sees A1/B1
method end
render#2 A1/B1
total=2
=== outside-act microtask ===
render#1 A0/B0
method start
write A
callback A sees A1/B0
after notify A
write B
callback B sees A1/B1
method end
render#2 A1/B1
total=2
=== outside-act timeout ===
render#1 A0/B0
method start
write A
callback A sees A1/B0
after notify A
write B
callback B sees A1/B1
method end
render#2 A1/B1
total=2
```

## Cross-target oracle implication

The v0 dossiers require Solid setter calls to remain in authored order, and its store updates batch synchronously within the event. The analyzer observes after dispatch. Therefore:

- Solid’s oracle window sees the final `A1/B1` state.
- React with the recommended commit phase also sees final `A1/B1`.
- Authored internal write/read ordering is retained on both targets, while post-dispatch traces remain equal.

This does not claim identical framework-internal reactive scheduling—only equality at the established post-dispatch observation boundary.

## Gate rules

Require:

- exact emission of every recorded write in authored `order`;
- transaction depth/changed-cell accumulation, committing only at the outermost method boundary;
- no listener invocation between method writes;
- notifications only for cells whose final snapshot changed;
- stable store, `subscribe`, and `getSnapshot` identities;
- `Object.is`-stable snapshots, with immutable/cached object snapshots per version;
- negative controls for reordered/collapsed writes, inline notification, global all-cell invalidation, and rebuilt snapshots;
- fail-closed handling until async, throwing, or reentrant method semantics are explicitly modeled.

The governing authored-order evidence is in [React composition T002](/Users/jacksm5pro/dev/open-source/frameless/.fable-codex/runs/2026-07-20T23-13-05-432Z/units/shared-transaction-probes/worktree/docs/goals/frameless-composition-v1/notes/T002-react-composition-idioms.md), [React v0 T002](/Users/jacksm5pro/dev/open-source/frameless/.fable-codex/runs/2026-07-20T23-13-05-432Z/units/shared-transaction-probes/worktree/docs/goals/frameless-product-v0/notes/T002-react-idioms.md), and [Solid v0 T003](/Users/jacksm5pro/dev/open-source/frameless/.fable-codex/runs/2026-07-20T23-13-05-432Z/units/shared-transaction-probes/worktree/docs/goals/frameless-product-v0/notes/T003-solid-idioms.md).

Overturn this contract if Markless defines mid-method subscriber observations as semantic, the oracle begins sampling inside dispatch, or executable async/reentrant/throwing method records require rollback or suspension semantics. React scheduling changes alone should not weaken notification atomicity.

Evidence limits: real `react-dom/client` reconciler and hooks, minimal DOM host, development mode, no StrictMode. The event control used React’s explicit batching wrapper around the stored handler; native event delegation was not exercised. No transitions, Suspense, SSR, hydration, concurrent interruption, async methods, exceptions, or Solid runtime were probed. The initial launch failed before React execution because Node 24’s `navigator` global is getter-only; the corrected primary and outside-`act` probes passed. `git status --short` was clean, and the scratchpad still contains only its original `package.json`, lockfile, and `node_modules`.
