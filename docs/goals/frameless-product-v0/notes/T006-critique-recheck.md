# T006 critique re-check (2026-07-20, second model via crew, medium)

Read-only re-check of packages/frameworks/solid against the original T006 rejection's
six re-entry items. Executed evidence: solid node lane 68/68, compiler suite 18/18,
targeted `checkSources` + EnrichedIR mutation probes. Browser lane not run by the
critic (PM-verified separately: solid-browser 17/17, react-browser 16/16).

Verdict: reject (3 residual defects), with items 2/4/5/6 CLOSED:

- CLOSED (2) retained ESLint policies published + mutation-tested, coverage assertion
  enforces the mapping.
- CLOSED (4) once-capture classification is binding-kind driven; opaque graph-ID
  metamorphic (byte-identical output) executed green.
- CLOSED (5) coherent key-rename / opaque-ID / store-shadow metamorphics assert real
  emitted properties and pass the gate.
- CLOSED (6) beta.9 blocker contract executable (subpath-export removal proven by
  resolution + real babel compile); README records blocker + overturn trigger.
- Adjudicated empty-arm branch semantics implemented correctly (validation + showNode
  + S2 golden), judged against the PM amendment.

Residual defects driving the reject (repair batch dispatched same day):

1. HIGH gate bypass: inline-object indirected setter `({ run: setValue }).run(1)`
   passes — member-call resolution only handles identifier-backed objects
   (gate/index.ts ~330).
2. HIGH gate bypass: structurally equivalent subtrees duplicated into both Show arms
   produce zero violations — Show-with-siblings-once (T003 ruling 5) not enforced
   against duplication (gate/index.ts ~596).
3. HIGH fail-closed hole: AST/read-record reconciliation exists only for event
   handlers; probe swapping S1's branch expression to `count` with `branch.reads=[]`
   was ACCEPTED (emitter/index.ts ~112/~669). Non-handler expression sites must
   reconcile both directions.

Also noted (compiler-side, informational): compiler derives branch reads from AST
(build.ts ~524) but its test asserts presence/known-IDs, not exact AST match — queued
as a candidate hardening item for a later compiler task, not a T006 blocker.

No over-broad rejection: checked-in S1/S2/S3 accepted by the executed gate lane.
