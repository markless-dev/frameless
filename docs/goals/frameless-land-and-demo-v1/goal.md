# Frameless: Land the Stack + Newcomer Three-Way Demo (v1)

## Objective

Declare the proven-but-undeclared Frameless work onto a pushed branch, finish the
S1/S2/S3 equality matrix across all three official demos, and ship a one-command
newcomer demo that shows **one source -> React hydrates / Solid hydrates / Qwik
resumes, identical observable behavior**.

## Original Request

"Land the stack (commit the uncommitted work in clean changesets and push), finish
the equality matrix (wire S2/S3 into the React/Solid demos, already in Qwik), then
the newcomer demo: a side-by-side 'one source -> React hydrates / Solid hydrates /
Qwik resumes, identical behavior.' All the pieces exist."

## Intake Summary

- Input shape: `existing_plan`
- Audience: newcomers evaluating Frameless (the demo is the front door); owner is the operator
- Authority: `approved` — branch + push explicitly granted this session; merge NOT granted
- Proof type: `demo`
- Completion proof: a fresh clone of the pushed branch runs one command and a newcomer
  observes identical S1/S2/S3 behavior across hydrate/hydrate/resume
- Goal oracle: see below
- Likely misfire: the board treats "commits exist" or "520 tests pass" as the outcome and
  closes before a newcomer can actually run the three-way comparison; or it builds the demo
  on top of an unpushed tree, so the proof is not reproducible from a fresh clone
- Blind spots considered:
  - `demos/react-official`, `demos/solid-official`, `demos/qwik` are official scaffolds with
    their own lockfiles and heavy `node_modules`. Whether they join the pnpm workspace, ship
    with committed lockfiles, or stay standalone is an unresolved decision that materially
    affects both the changeset shape and whether `pnpm demo` works from a fresh clone.
  - Qwik requires vite 7.3.1 (recorded finding). A fresh-clone demo must pin this or it breaks
    for the exact audience the demo exists for.
  - The 5 pre-existing unpushed commits become public in the same push as the new work.
  - Booting three dev servers from one command needs deterministic, non-colliding ports.
  - "Identical behavior" currently means S1 (`kit:2 -> kit:4`) only across React/Solid;
    S2/S3 exist in Qwik. The matrix is asymmetric until T003 closes it.
- Existing plan facts (preserved from the owner's stated order):
  1. Land the stack — commit uncommitted work in clean changesets, push.
  2. Finish the equality matrix — wire S2/S3 into the React/Solid demos (already in Qwik); mechanical.
  3. Newcomer demo — side-by-side one source -> three frameworks, identical behavior.
  4. (Out of tranche) Breadth: Angular/Vue/Svelte emitters.
  5. (Out of tranche) Gated follow-ons: persistence-on-Qwik, composition-on-Qwik.

## Goal Oracle

The oracle for this goal is:

`From a fresh clone of the pushed branch, a newcomer runs the documented single command,
reaches all three official demos, and observes the same S1/S2/S3 behavior in each —
React hydrating, Solid hydrating, Qwik resuming — with the shared IR source and the three
emitted outputs visible from the walkthrough.`

The PM must keep comparing task receipts to this oracle. Planning, discovery, a passing tiny
slice, green unit tests, or a clean-looking board is not enough. Commits landing is not the
oracle; a reproducible three-way comparison is. The goal finishes only when a final Judge/PM
audit maps receipts and verification back to this oracle and records `full_outcome_complete: true`.

## Goal Kind

`existing_plan`

## Current Tranche

Continuous execution across three work packages:

1. **Land** — inventory the working tree, group it into coherent changesets, cut a branch off
   `main`, commit, push the branch.
2. **Equalize** — wire S2/S3 into `demos/react-official` and `demos/solid-official` so the
   matrix is 3 frameworks x 3 scenarios.
3. **Demo** — a single documented command that boots all three and a README walkthrough that
   makes the one-source/three-activations story legible to someone who has never seen Frameless.

Enough for the full owner outcome: the oracle passes from a fresh clone of the pushed branch.

Explicitly deferred (do NOT pull into this tranche): Angular/Vue/Svelte emitters;
persistence-on-Qwik; composition-on-Qwik; merging the branch to `main`.

## Non-Negotiable Constraints

- `main` is untouchable. Cut a branch; never commit to or push `main`.
- Push the branch only. Do not merge, do not open a PR, do not request review without owner say-so.
- Never force-push. Never rewrite, squash, amend, or reorder the 5 pre-existing unpushed commits.
- Nothing may be deleted or discarded from the working tree to make a changeset "clean". If a path
  is unclear, ask — the tree holds unbacked-up proven work.
- `pnpm e2e` must be green before the landing commit and green again after every subsequent package.
- **Never hand-roll an SSR or build harness for a demo.** Use official framework scaffolds
  (`pnpm create qwik`, etc.). A previous session lost most of its time to a self-inflicted
  hand-rolled build harness that produced phantom framework bugs.
- No new runtime dependencies without owner approval.
- One activation model per framework as already proven: React hydrates, Solid hydrates, Qwik resumes.
  Do not "fix" Qwik to hydrate for symmetry — the asymmetry is the thesis.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after landing the commits. Landing is package 1 of 3 and is not the oracle.

Do not stop after a single verified Worker package when the broader owner outcome still has safe
local follow-up work. Advance to the next highest-leverage safe Worker package and continue unless
a phase, risk, rejected-verification, ambiguity, or final-completion review is due.

Do not create one Worker/Judge pair per demo app. Repeated same-shape work (the same S2/S3 wiring
in two demos) belongs in one Worker package.

If a slice needs owner input (a merge decision, a dependency approval, a repo-structure ruling),
mark that exact slice blocked with a receipt and keep doing the local work that still moves the goal.

## Slice Sizing

Safe means bounded, explicit, verified, and reversible. It does not mean tiny.

A good task is the largest safe useful slice. Small is not the goal. Useful is the goal.

A Worker should finish the whole assigned slice. A Judge should judge the whole assigned slice.
A PM should reorient the board when tasks are safe but not moving the outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/frameless-land-and-demo-v1/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task,
receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/frameless-land-and-demo-v1/goal.md.
```

## PM Loop

On every `/goal` continuation:

1. Read this charter.
2. Read `state.yaml`.
3. Run the bundled GoalBuddy update checker when available and mention a newer version without blocking.
4. Re-check the intake: original request, input shape, authority, proof, blind spots, existing plan facts, and likely misfire.
5. Work only on the active board task.
6. Assign Scout, Judge, Worker, or PM according to the task.
7. Write a compact task receipt.
8. Update the board.
9. If safe local work remains, choose the next largest reversible Worker package and continue unless blocked.
10. If a problem, suggestion, or follow-up should become a repo artifact, ask the operator before creating it.
11. Review at phase, risk, rejected-verification, ambiguity, or final-completion boundaries; do not review every small Worker by habit.
12. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the oracle and records `full_outcome_complete: true`.
