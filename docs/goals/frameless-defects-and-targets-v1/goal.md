# Frameless defects and new targets

## Objective

Close the six open defects in `docs/DEFECTS.md`, then add Vue, Angular and Svelte as frameless targets — in that order, because the first phase strengthens the harness and settles the IR decisions the three new adapters inherit.

## Original request

> Setup a goal ready to start the work for vue, angular, and svelte once that testing goal claude is working on in frameless (the other agent) is done and merged into our branch … based on what we talked about, which includes the board with vue, angular and svelte. On top of that, I want you to look at `docs/DEFECTS.md`.

## Intake summary

- Input shape: `existing_plan` — `docs/DEFECTS.md` is a ranked, diagnosed plan with a suggested tranche split. Preserve it; validate before executing.
- Authority: `approved`. The owner explicitly authorised merging `goal/frameless-testing-ci-v1` into `main` and continuing.
- Proof type: `test`
- Likely misfire: **treating the defects list as a checklist and fixing symptoms.** Three of the six are explicitly *not diagnosed*, and the doc says so in bold. For those the deliverable is a decision separating competing explanations, not a patch. The single fastest way to fail this goal is to raise the WebKit timeout, make the rename comparison order-insensitive, and call two defects closed — converting two possible real findings into silence.
- Second misfire: **starting the adapters first.** Defect 1's fix extends the three-way contract to assert cancellation. Add three frameworks before that and you retrofit cancellation assertions into three adapters instead of inheriting one stronger bar.

### Owner decisions taken at prep, recorded because they shaped the board

- **One umbrella goal, not two.** The recommendation was two goals with defects first, on the grounds that fusing them produces one unbounded tranche whose final audit cannot mean much. The owner chose a single board. The mitigation is structural: **every phase ends in its own Judge audit**, and `full_outcome_complete` stays `false` until the last one. The final audit certifies the phase audits, not eleven unrelated things at once.
- **Merge and continue.** T001 may merge and keep going if the merge is clean and `main` is green afterward. Any conflict or red check stops it.

## Goal oracle

**Three halves. All required. None alone closes this goal.**

> **Half 3 was missing from this charter for a full day, and that is recorded rather than quietly fixed.** It was added to `state.yaml` on 2026-07-27 on owner instruction and never copied here, so this section described *two thirds* of its own oracle while `state.yaml` opened "THREE halves, all required". The final audit (T999) was dispatched on the two-half framing, checked it against `state.yaml` instead of accepting it, and refused it — had it taken the brief at face value it would have certified two thirds of the oracle and called the goal complete. Added here by T057 on 2026-07-28. `state.yaml` stays authoritative (see *Canonical board*); this section is a readable copy, which is precisely why a copy that silently lags is worse than no copy at all.

**Half 1 — defects.** All six defects in `docs/DEFECTS.md` are closed or explicitly ruled non-issues with receipts, and:

- the three-way contract asserts the default action is prevented in **all three** frameworks, and Qwik passes it;
- every `continue-on-error` flag the testing goal left behind (`qwik-throttled` throttled step, Windows cell, WebKit cell) is either **removed** or carries a receipt explaining why it must stay;
- the three defects currently held as known-failing expectations no longer are, and their fixes were each preceded by a test that failed for the right reason.

**Half 2 — targets.** `pnpm e2e` includes Svelte, Vue and Angular rows driving official scaffolds at pinned lockfile versions, with S1/S2/S3 observations **asserted** equal to the existing three.

**Half 3 — corpus breadth.** *(Added 2026-07-27 on owner instruction, after the owner asked what number of scenarios would justify real cross-framework confidence.)* The corpus covers **eight** scenarios rather than three, each chosen to exercise a **divergence axis** the original S1/S2/S3 do not, each landed in **all six** lanes, and each carrying at least one mutation **per emitter** proven to go red in the e2e matrix. The stopping rule is that **a mutation cannot survive** — not that a file count reached a number. Scenario count is a proxy, and four of the six original defects on this very goal were instrument faults, so this half is measured by what the corpus can *kill*, not by what it contains.

**Eight, not the twelve first written — and the number moved by measurement three times over.** T024 cut twelve to eight after measuring four emitters *hard-throwing* on `component-reference`, so the missing four were inexpressible rather than unwritten; T028 then ruled eight wrong in **both** directions and set nine; T050 landed S9. The corpus is S1–S7 plus S9, and S8's absence is a deferral on a falsifiable trigger that is still true at HEAD: `docs/DEFECTS.md` entry 12.2 is open, and `pnpm e2e` has no exception path, so landing S8 today would encode a known open defect as *expected behaviour* in this repository's strongest instrument. When 12.2 closes, S8 lands and the count is nine. Full provenance lives in `goal.oracle.signal` clause 3 in `state.yaml`.

## Non-negotiable constraints

- **Proof before fix.** Every fix is preceded by a test that fails for the right reason. This is the doc's own carried-over constraint and it is what found all six defects. A fix that lands without a witnessed failure is not done.
- **Do not silence an undiagnosed defect.** Defects 4 and 6 are observed, not diagnosed. `docs/DEFECTS.md` names the tempting wrong move for each — raising the 500ms quiescence bound, and making the rename comparison order-insensitive. Either may turn out to be correct, but only *after* the instrumented experiment says so.
- **Defect 1 has two halves and they are separate changes.** Emit `preventdefault:click` for the unconditional case first. The IR's representation of *conditional* cancellation — `sync$()` lowering, a gate policy proving a `sync$` body reads no reactive state, and a fail-closed v-limit for what Qwik genuinely cannot express — is a design decision that must not be rushed into the same change.
- **`sync$()` cannot close over reactive state.** No signals, no stores; it runs before the container resumes. It may read only what is synchronously on the event. This is a hard framework constraint, not a style preference.
- **`docs/emitter-idiom-policy.md` governs every emission-site form choice** in both phases. Run the six gates and record outcomes.
- **Official scaffolds only** for any new framework demo. See `docs/goals/frameless-qwik-v1/` for what hand-rolled harnesses cost this repo.
- Do not weaken any existing activation-neutrality assertion to make anything pass.

## Preserved plan facts from `docs/DEFECTS.md`

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

Continuous execution through six phases, each ending in a Judge audit:

1. **Integration** — merge the testing branch, prove `main` green.
2. **Phase A** — emitted-output correctness (defects 1, 2).
3. **Phase B** — diagnose the undiagnosed (defects 4, 6, 3-B).
4. **Phase C** — portability and consumption (defect 3 fixes, defect 5).
5. **Phase D/E** — shared IR foundation (conditional-cancellation representation, IR-4), then the three adapters via their own boards.
6. **Phase F — corpus breadth.** Added 2026-07-27 on owner instruction and recorded here by T057 on 2026-07-28; it runs *after* the adapters, because by then a scenario costs six emitters, six goldens, six demo routes and e2e wiring.

## Stop rule

Stop only when the final audit proves **all three** oracle halves and records `full_outcome_complete: true`.

Do not stop after a phase audit. Do not stop because a defect turns out to be upstream — record the decision, file or recommend the upstream issue, and continue.

## Canonical board

`docs/goals/frameless-defects-and-targets-v1/state.yaml` — machine truth. If this charter disagrees, `state.yaml` wins.

## Run command

```text
/goal Follow docs/goals/frameless-defects-and-targets-v1/goal.md.
```
