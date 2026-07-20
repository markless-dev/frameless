# Equivalence oracle

The oracle compares observable behavior, not framework internals. An adapter mounts
a component into a host, dispatches typed scripted actions, settles its scheduler
with a bounded timeout, and unmounts it. Runs observe mount, immediately before and
after each dispatch, after one microtask, and after quiescence; sleeps are forbidden.

DOM traces preserve namespaces, ordered semantic children, text, sorted attributes,
live form properties, focus, and selection. Normalization removes only an explicit
framework-owned allowlist. Per-run WeakMap node ids expose row remounts, and rows
marked by `data-oracle-row-key` retain identity evidence. Callback traces preserve
order, payload, phase, cancellation, and invocation count. Comparison is exact and
reports channel, phase, and path.

The calibrated scenarios cover render-once locals, keyed todo mutation/identity, and
event/form ordering and cancellation. Mutants must prove rejection of wrong DOM,
wrong live properties, missing/reordered/duplicate callbacks, broken keys,
missing cancellation, and timing shifts.

Receipts are product evidence, not simulated status. Upstream-blocked legs are
explicit `blocked-by-upstream` records with findings; they are never omitted or
treated as passes. v0 claims only the fixture- and phase-scoped CSR behavior proven
by those receipts, not general framework equivalence.
