# Frameless defects and new targets

## Objective

Close the six open defects in `docs/defects.md`, then add Vue, Angular and Svelte as frameless targets — in that order, because the first phase strengthens the harness and settles the IR decisions the three new adapters inherit.

## Original request

> Setup a goal ready to start the work for vue, angular, and svelte once that testing goal claude is working on in frameless (the other agent) is done and merged into our branch … based on what we talked about, which includes the board with vue, angular and svelte. On top of that, I want you to look at `docs/defects.md`.

## Intake summary

- Input shape: `existing_plan` — `docs/defects.md` is a ranked, diagnosed plan with a suggested tranche split. Preserve it; validate before executing.
- Authority: `approved`. The owner explicitly authorised merging `goal/frameless-testing-ci-v1` into `main` and continuing.
- Proof type: `test`
- Likely misfire: **treating the defects list as a checklist and fixing symptoms.** Three of the six are explicitly *not diagnosed*, and the doc says so in bold. For those the deliverable is a decision separating competing explanations, not a patch. The single fastest way to fail this goal is to raise the WebKit timeout, make the rename comparison order-insensitive, and call two defects closed — converting two possible real findings into silence.
- Second misfire: **starting the adapters first.** Defect 1's fix extends the three-way contract to assert cancellation. Add three frameworks before that and you retrofit cancellation assertions into three adapters instead of inheriting one stronger bar.

### Owner decisions taken at prep, recorded because they shaped the board

- **One umbrella goal, not two.** The recommendation was two goals with defects first, on the grounds that fusing them produces one unbounded tranche whose final audit cannot mean much. The owner chose a single board. The mitigation is structural: **every phase ends in its own Judge audit**, and `full_outcome_complete` stays `false` until the last one. The final audit certifies the phase audits, not eleven unrelated things at once.
- **Merge and continue.** T001 may merge and keep going if the merge is clean and `main` is green afterward. Any conflict or red check stops it.

## Goal oracle

Two halves. Both required. Neither alone closes this goal.

**Half 1 — defects.** All six defects in `docs/defects.md` are closed or explicitly ruled non-issues with receipts, and:

- the three-way contract asserts the default action is prevented in **all three** frameworks, and Qwik passes it;
- every `continue-on-error` flag the testing goal left behind (`qwik-throttled` throttled step, Windows cell, WebKit cell) is either **removed** or carries a receipt explaining why it must stay;
- the three defects currently held as known-failing expectations no longer are, and their fixes were each preceded by a test that failed for the right reason.

**Half 2 — targets.** `pnpm e2e` includes Svelte, Vue and Angular rows driving official scaffolds at pinned lockfile versions, with S1/S2/S3 observations **asserted** equal to the existing three.

## Non-negotiable constraints

- **Proof before fix.** Every fix is preceded by a test that fails for the right reason. This is the doc's own carried-over constraint and it is what found all six defects. A fix that lands without a witnessed failure is not done.
- **Do not silence an undiagnosed defect.** Defects 4 and 6 are observed, not diagnosed. `docs/defects.md` names the tempting wrong move for each — raising the 500ms quiescence bound, and making the rename comparison order-insensitive. Either may turn out to be correct, but only *after* the instrumented experiment says so.
- **Defect 1 has two halves and they are separate changes.** Emit `preventdefault:click` for the unconditional case first. The IR's representation of *conditional* cancellation — `sync$()` lowering, a gate policy proving a `sync$` body reads no reactive state, and a fail-closed v-limit for what Qwik genuinely cannot express — is a design decision that must not be rushed into the same change.
- **`sync$()` cannot close over reactive state.** No signals, no stores; it runs before the container resumes. It may read only what is synchronously on the event. This is a hard framework constraint, not a style preference.
- **`docs/emitter-idiom-policy.md` governs every emission-site form choice** in both phases. Run the six gates and record outcomes.
- **Official scaffolds only** for any new framework demo. See `docs/goals/frameless-qwik-v1/` for what hand-rolled harnesses cost this repo.
- Do not weaken any existing activation-neutrality assertion to make anything pass.

## Preserved plan facts from `docs/defects.md`

Validate these; do not assume them correct. All line references in that document are **on branch `goal/frameless-testing-ci-v1`, unmerged** — which is why T001 exists and why a botched merge silently invalidates the input.

| # | Defect | Status per the doc |
|---|---|---|
| 1 | Qwik emits `preventDefault()` inside an async QRL | diagnosed by rule; **runtime divergence not yet demonstrated** |
| 2 | Qwik drops clicks under a slow connection | diagnosed — the click is *lost*, not delayed; likely upstream |
| 3 | Test suite does not run on Windows | cause A confirmed (`execFileSync('npx')`), cause B suspected (CRLF) |
| 4 | WebKit exceeds the analyzer's quiescence bound | observed, **not diagnosed** |
| 5 | Emitted Solid uses `attr:value`, rejected by solid-js types | partially mitigated; design question open |
| 6 | Whole-IR rename invariant fails generatively | observed, **not diagnosed** |

`findings-001` (`engines.node` was false) is already fixed and closed.

The doc's own tranche split is adopted: **A** = defects 1, 2 (emitted-output correctness). **B** = defects 4, 6 and defect 3's cause B (diagnose the undiagnosed). **C** = defect 3's fixes and defect 5's design decision (portability and consumption).

## Adapter facts carried from `frameless-idiom-policy-v1`

Three per-framework boards already exist and are **not** re-specified here — this goal hands off to them:

- `docs/goals/frameless-svelte-v1/` — owns the IR-4 ruling
- `docs/goals/frameless-vue-v1/`
- `docs/goals/frameless-angular-v1/`

All three currently read `status: active` / `active_task: T001` with nothing running them, which misleads any future `/goal`. Fixing that is part of this board.

Svelte runs first because it owns IR-4 (target-framework-version input), which Vue's `defineModel` (3.4+) and Angular's signal `input()`/`output()` (≥17.1/17.2) both inherit. The *lanes* are independent; the *sugar rulings* are not.

## Current tranche

Continuous execution through five phases, each ending in a Judge audit:

1. **Integration** — merge the testing branch, prove `main` green.
2. **Phase A** — emitted-output correctness (defects 1, 2).
3. **Phase B** — diagnose the undiagnosed (defects 4, 6, 3-B).
4. **Phase C** — portability and consumption (defect 3 fixes, defect 5).
5. **Phase D/E** — shared IR foundation (conditional-cancellation representation, IR-4), then the three adapters via their own boards.

## Stop rule

Stop only when the final audit proves **both** oracle halves and records `full_outcome_complete: true`.

Do not stop after a phase audit. Do not stop because a defect turns out to be upstream — record the decision, file or recommend the upstream issue, and continue.

## Canonical board

`docs/goals/frameless-defects-and-targets-v1/state.yaml` — machine truth. If this charter disagrees, `state.yaml` wins.

## Run command

```text
/goal Follow docs/goals/frameless-defects-and-targets-v1/goal.md.
```
