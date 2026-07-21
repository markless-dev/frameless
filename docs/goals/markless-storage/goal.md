# markless-storage — storage() in the markless compiler, consumed by frameless

## Original request (verbatim, 2026-07-21)

"The markless compiler needs to support storage, so let's figure out how this
is going to work directly in markless, then consume that in frameless"

Intake follow-up: owner GRANTED markless write access for this goal ("Yes —
write markless now"), lifting the session-long read-only constraint. All
markless work happens on a dedicated branch/worktree in the markless repo —
NEVER its main branch.

## Interpreted outcome

`storage(key, fallback)` implemented as a compiler-known declaration in
markless — recognized by the compiler, seeded pre-paint through the unified
early-script/landing-slot channel, persisted with write-back, consent-gate
deferral available — and then consumed by frameless so the same authored
source compiles to working React/Solid output with the identical contract.
Executed end-to-end proof on both sides.

## Ratified direction (owner, via the qds-primitives loop — record its closure at /goal start)

- storage(key, fallback) is THE new API — the only one. Inert at creation;
  lazy driver read; landing-slot consumption; write-back + root-attr
  maintenance; honest fallback-then-patch contract.
- Seed script injected AUTOMATICALLY by the compiler from reachability (no
  provider/build enablement switch — that was library-world thinking);
  markless-native output may use the payload channel instead of a script
  (P1 executed proof: seed lands in graph before runtime start).
- Consent gate = the one policy switch: app-level opt-in that defers ALL
  driver reads until enabled (exactly-once patch proven).
- Driver surface DELIBERATELY NARROW in v1: localStorage, string values;
  driver/config growth is app-level and later. Key stability policy still
  open — design it, don't over-build it.
- attach-promotion is a SEPARATE future capability sharing the same channel;
  do NOT implement promotion in this goal, but do not architect the seed
  channel in a way that closes it off (element-scoped instances, slot
  keying).

## Goal oracle

Executed end-to-end, both sides, from ONE authored source using
storage('theme','light'):
(a) markless-native output: value seeded before runtime start, reactive
    read/write, persistence round-trip, consent-deferral path — proven by
    markless repo tests (suite green) plus an executed browser/native run;
(b) frameless-compiled React (Solid stretch): seed script in SSR output,
    no-flash at first paint, zero double driver reads, round-trip — proven
    through the existing frameless e2e/equivalence conventions (the
    storage-poc runner assertions are the reference contract, 65/65 green).
Final audit maps both proofs to the original ask; full_outcome_complete
requires executed evidence on BOTH sides, not compiling code.

## Constraints (non-negotiable)

- markless work on a dedicated branch/worktree; NEVER push/commit to
  markless main; frameless work in this goal's worktree flow as usual.
- Frameless consumers must never be required to import markless-branded
  packages. With markless now writable, prefer solving this properly via
  accepted-import-sources (the markless-side fix identified in P5) over
  import-rewrite — decide in design, record the decision.
- Respect both repos' test suites: markless suite green before and after
  each markless slice; frameless full lane green (composition-v1 shipped
  380+ tests — do not regress).
- Crew (`crew run`) produces; PM diff-reviews every branch before merge;
  second-model critique REQUIRED at the markless-API and cross-repo
  boundary merges (public API surface). Workflow tool banned.
- Suggestions-vs-decisions discipline: the DIRECTION above is ratified;
  design DETAILS still get owner checkpoints at named gates (key-identity
  policy, consent API shape) rather than silent invention.

## Input shape

specific/execution with rich existing evidence. Existing facts: P1 payload
probe (markless seed channel viable WITHOUT core changes — verify against
current markless HEAD, the pin may be stale); frameless vendors a pinned
markless (vendor refresh may be needed); storage-poc runner = executable
contract reference; T009 SSR probe = React emission pattern; qds-primitives
T007 = unified-channel design. Frameless emitters (React/Solid) shipped
with composition-v1.

## Likely misfire

1. Implementing against the stale pinned markless instead of current HEAD
   (or vice versa) — establish which markless the frameless side consumes
   EARLY, and record the vendor-refresh plan.
2. Scope creep into attach-promotion or driver zoo — v1 is storage() alone,
   localStorage, strings.
3. Treating ratified DIRECTION as license to invent unratified DETAILS
   (key namespacing scheme, consent API surface) without the named owner
   checkpoints.
4. Green-compiler-tests-but-no-executed-browser-proof completion.

## Enough for this tranche

Both oracle halves executed green; markless branch + frameless branch each
reviewed, critiqued at the named boundaries, and merged to their respective
mains (markless: merged to ITS main only if the owner confirms — otherwise
left on the branch with the PR/merge decision recorded); boards receipted;
final audit with full_outcome_complete mapping to executed evidence.
