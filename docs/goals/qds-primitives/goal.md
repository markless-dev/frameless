# qds-primitives — Audit Qwik Design System; determine what primitives are needed

## Original request (verbatim, 2026-07-21)

"I want you to audit Qwik Design System and figure out what is needed
primitive wise to solve the problems there. For example, carousel I think had
a script that gets minified and it does it through some browser API and does
so to prevent flashes I believe, but there may even be use cases with a
Resizer, Mutation Observer, etc. In those cases we need to figure out if
attach makes sense, or if something else is needed etc. So do the audit, then
let me know what we need"

## Interpreted outcome

A source-backed audit of the local Qwik Design System checkout that
inventories every place components resort to imperative browser machinery
(inline/minified scripts, pre-paint flash prevention, ResizeObserver,
MutationObserver, IntersectionObserver, measurement, focus/scroll management,
visible tasks, etc.), characterizes WHY each exists, and maps each case to
what the markless/frameless primitive surface would need to express it —
ending in a "what we need" answer: which cases the existing/planned surface
(state, shared, refs/attach-style element behaviors, the recommended
storage() contract) already covers, and which need something new, with
options where the answer is not obvious.

## Goal oracle

The owner reads the audit dossier + "what we need" primitive-requirements
menu and can decide what to build without re-doing the research. Proof type:
source_backed_answer feeding an owner decision. Every claim about QDS cites
file:line in the local checkout; every primitive-requirement claim traces to
specific audited cases; open questions (e.g. "does attach fit observers?")
are presented as options with tradeoffs, never as decisions.

## Constraints (non-negotiable)

- Qwik Design System checkout is READ-ONLY for this goal; markless repo is
  READ-ONLY (fixing board owns it). No product-package writes anywhere —
  outputs are board notes only.
- SUGGESTIONS-ONLY for primitive decisions: the owner ratifies; nothing is
  "decided/final/adopted" (twice-corrected owner pattern — the standing
  misfire in this design thread).
- Workflow tool permanently banned. Crew (`crew run <packets.json>`) does the
  repo-mining scout work; PM handles quick lookups directly; web research is
  PM-direct (crew sandbox has no network).
- Do not conflate with the storage-tradeoff/storage-poc thread: device-state
  persistence is settled EVIDENCE input (the recommended storage() contract
  exists as a suggestion + green 4-framework POC), not something this audit
  re-opens; cross-reference it where the carousel-style pre-paint script
  overlaps.

## Input shape

audit (read-only) with a decision deliverable. Existing facts to preserve:
owner's memory of the carousel — a script that gets minified, uses some
browser API, believed to be for flash prevention (VERIFY against source, and
correct the owner's recollection honestly if it differs); expected additional
cases around ResizeObserver / MutationObserver; the open question of whether
"attach" (element-scoped behavior primitive from the composition surface)
covers these or something else is needed. Also available as prior evidence:
storage-tradeoff T006 corpus notes already characterized QDS/Qwik UI theme
handling (pre-slot sync script, no useVisibleTask$ for initial read).

## Likely misfire

1. Presenting primitive choices as decided instead of as an options menu.
2. A shallow audit that stops at the carousel example instead of sweeping the
   whole component library for the full pattern inventory.
3. Losing the WHY per case (flash prevention vs measurement vs reactive
   observation vs lifecycle) — the primitive answer differs per class, so
   collapsing classes produces a wrong requirement.
4. Designing primitives in a vacuum: every requirement must trace back to
   cited QDS cases.

## Enough for this tranche

Full-library pattern inventory with citations and per-case why; a
classification of cases into primitive-requirement classes; a "what we need"
menu mapping classes to existing surface vs named gaps (with attach-fit
assessed per class, options + tradeoffs where open); delivered to the owner
in plain language; final audit confirms the owner got a decidable answer.
Implementation of any primitive is OUT of this tranche.
