# Storage tradeoff study: device state done right for markless AND frameless

> Exploration goal. The deliverable is an evidence-complete tradeoff dossier and
> an owner decision menu — NOT an implementation and NOT recorded decisions. The
> owner decides; this goal makes the decision easy ("continue researching until
> it has gotten super evident" — owner, 2026-07-20).

## Objective

Determine the best way to handle device state (localStorage/theme/prefs-class
state needed on the client, often immediately) such that ONE authored concept is
ideal in BOTH consumption modes:

- **markless** — native runtime, progressive chunk execution, resume payloads
- **frameless** — compiled to React/Solid (later Qwik/native), no markless
  runtime ships; emitters lower from graph records

## Original Request

"Explore what the best tradeoff is here for handling this type of state and how
we can keep it both ideal for both frameless and markless."

## Goal Oracle

`The owner reads the final tradeoff dossier + decision menu and can decide
without further research — every candidate scored against both consumption
modes with executed or cited evidence, every rejected option carrying its
reason, remaining unknowns explicitly priced.` Proof type: owner decision,
backed by source-backed answers. The final audit records whether the owner
called it evident (or what evidence gap remains).

## The candidate space (seeded from the recorded exploration — validate, extend, kill)

- A. Inert `storage()` cell + explicit app-level seed enablement (variants:
  provider-like construct, build option, explicit include — next-themes-shaped)
- B. Plain persisted reactive cell only in v1; pre-paint seed ships later as a
  separate explicit feature
- C. Module-scope-restricted declaration + "compiled upgrade" reframe (runtime
  semantic = persisted cell; pre-paint = compiler guarantee, not semantic)
- D. File/manifest conventions (router-style: build-time facts live in
  build-facing files)
- E. Explicit directive/marker syntax ("use client"-family: visible boundary
  syntax at the declaration)

Cross-cutting axes each candidate must answer: authored surface (state option vs
storage() vs separate package); key identity (derived vs explicit, namespacing);
package home + frameless branding (no markless import required for frameless
consumers — owner constraint); enablement mechanism per platform; driver
sync/async story (localStorage vs SQLite); consent/CSP ownership.

## Evidence already banked (preserve, do not re-derive)

- docs/goals/frameless-composition-v1/notes/T013-persistence-api.md — full trail;
  STATUS CAVEAT: sections after the evidence pass are unsettled exploration the
  owner explicitly declined to ratify. Treat as candidate material only.
- notes/persistence-design-input.md — needed-at insight, pre-paint direction,
  T004b transaction contract, resumeFromPayloadScripts repo evidence.
- Tonight's three-line convergence (chat, to be banked by T001): ePrivacy 5(3)
  technology-neutral consent (app must own storage-access timing); ecosystem
  explicit-boundary pattern ("use client", Astro directives); next-themes'
  provider-as-enablement production precedent.
- Slack design session (2026-07-20): storage() leaning, separate-package
  direction (@markless/storage, driver/repository), device-state-not-data
  charter, progressive runtime execution, explicit-key sketch, "too much magic
  isn't great", declaration-inertness concern ("no other declaration does stuff
  on the client").

## Non-Negotiable Constraints

- EXPLORATION ONLY: no product-file edits, no markless repo edits (fixing board
  owns it), no spec ratification. Probes execute in scratch space only.
- Every ruling-shaped statement in outputs is labeled CANDIDATE or EVIDENCE —
  never "adopted/final/resolved". Only the owner ratifies, via the decision
  menu at the end.
- Both-modes scoring is mandatory: a candidate that is ideal for one mode and
  awkward for the other must show the asymmetry explicitly, not average it away.
- Frameless consumers must never be required to import markless-branded packages
  (owner constraint, recorded).
- Scope: device state only. Data (sync/conflicts) is out per the owner's
  device-state-not-data charter.
- Honesty rules: executed vs cited vs inferred always distinguished; unknowns
  priced, not hidden.

## Likely Misfire

Prematurely converging: presenting one candidate dressed as a conclusion, or
recording exploration as decisions (this exact failure occurred 2026-07-20 and
was owner-corrected twice). Second misfire: candidate-space theater — scoring
strawmen instead of steelmanning each option with real probes/citations.

## Canonical Board

`docs/goals/storage-tradeoff/state.yaml` — state.yaml wins over this file.

## Run Command

```text
/goal Follow docs/goals/storage-tradeoff/goal.md.
```
