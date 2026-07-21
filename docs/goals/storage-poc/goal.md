# storage-poc — POC of storage() across Angular, React, Svelte, Vue

## Original request (verbatim, 2026-07-21)

"ok I want you to make a POC of the storage function across several different
frameworks, angular, react, svelte, vue, and see if it works. Do this in a new
git worktree"

## Interpreted outcome

A working proof-of-concept of the `storage()` device-state contract running in
all four named frameworks — Angular, React, Svelte, Vue — with executed
browser evidence per framework that it works, built inside a fresh git
worktree dedicated to this goal.

LABELED ASSUMPTION (owner may correct): "POC of the storage function" means a
hand-authored runtime implementation of the contract the storage-tradeoff
research recommended — NOT compiler emission work. Concretely, per framework:
- `export const theme = storage('theme', 'light')` — standalone persisted
  cell, inert at import, lazy driver read;
- the compiler-derived seed script emulated by hand: sync inline script that
  reads the driver pre-paint, patches the root attribute, and writes the
  landing slot (`window.__FRAMELESS_STATE__`);
- a per-framework reactive adapter so components read/write the cell
  idiomatically (React hook, Vue ref, Svelte store/rune, Angular signal);
- write-back to the driver + root-attribute maintenance on change.

## Goal oracle

Per-framework executed browser run (real Chromium, same harness family as the
storage-tradeoff T008/T009 probes) in which the SAME assertion set passes in
all four frameworks:
1. seed runs before first paint; root attribute correct AT first paint
   (no-flash with a stored value, honest fallback cold);
2. component reads the cell and renders the seeded value; runtime performs
   ZERO extra driver reads (landing slot consumed);
3. writing the cell updates the component, the root attribute, and persists
   (round-trip proven by reload);
4. declaration is inert: importing the module without the seed/enablement
   does not touch the driver.
Final proof: a single runner output showing the assertion table green for
angular, react, svelte, and vue, receipted on the board.

## Relationship to storage-tradeoff

This commission is the owner's response to the storage-tradeoff loop: a named
evidence gap ("see if it works" = executed cross-framework proof). It does
NOT ratify the API — the POC uses the recommended-but-unratified shape
(storage(key, fallback); lazy; seed as explicit enablement; landing slot),
and its results feed the storage-tradeoff decision. Record the cross-link on
the storage-tradeoff board at /goal start.

## Constraints (non-negotiable)

- ALL POC work happens in a NEW git worktree created from main for this goal
  (owner-directed). Nothing lands in product packages; the POC is evidence,
  not shipped surface.
- markless repo is read-only (fixing board owns it). Frameless consumers must
  never be required to import markless-branded packages — the POC's authoring
  surface uses neutral naming.
- Workflow tool is permanently banned. Crew (`crew run <packets.json>`) is
  the production channel for implementation units; PM diff-reviews and merges.
- No npm installs inside crew sandboxes (DNS is broken there) — PM installs
  dependencies with network, or units reuse locally cached deps
  (react/react-dom/vue/svelte/@angular packages, esbuild, playwright-core +
  cached Chromium already proven available in sibling checkouts/scratch).
- Nothing here is "decided/final/adopted" language — POC success is evidence
  for the owner's still-pending ratification, and receipts say so.

## Input shape

specific (frameworks enumerated, proof named, worktree named). Existing-plan
facts: the recommended contract + probe harness patterns from
docs/goals/storage-tradeoff/notes/ (T003, T008, T009) are the design input
and must be reused, not rediscovered.

## Likely misfire

1. Treating a green POC as ratification of the API (the owner has ratified
   nothing — occurred twice before in this design thread; receipts must keep
   the SUGGESTION framing).
2. Scope inflation into compiler/emitter work — this tranche is a runtime
   POC only.
3. Hand-waving Angular: it is the highest-risk framework here (no prior
   probe, build tooling friction without the CLI, zone vs signals). "It
   works" requires the same executed assertions as the other three, or an
   honest blocked receipt naming exactly what Angular needs.

## Enough for this tranche

The oracle's assertion table green in all four frameworks (or green in three
plus an honest, specific blocked receipt for the fourth), receipted with the
runner output, POC committed on the goal worktree branch, and a final audit
mapping the evidence to the original ask. SSR smoke per framework is a
stretch goal, not tranche-blocking (React SSR already proven in T009).
