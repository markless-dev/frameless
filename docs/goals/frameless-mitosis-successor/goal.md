# Frameless: Mitosis postmortem and markless-powered successor

## Objective

Produce three connected deliverables in this repo:

1. An in-depth, easy-to-understand postmortem of why Mitosis gained little adoption, grounded in the actual codebase at `/Users/jacksm5pro/dev/open-source/mitosis` plus external adoption evidence.
2. A successor design showing how the markless compiler, graph-based architecture, and an analyzer-like concept (from `/Users/jacksm5pro/dev/open-source/markless`) can emit idiomatic per-framework code that behaves identically.
3. A top-level `poc/` folder where every major claim in the report is proven by a runnable POC.

This tranche ends when the report exists, every claim is POC-backed or honestly labeled, and the final audit passes.

## Original Request

"Analyze the entire mitosis codebase, and figure out where everything went wrong and how mitosis gained little adoption. What I want to do is use the markless compiler, graph-based architecture, and with the compiler and similar concept to the analyzer, produce code that is idiomatic for each framework, where the output works the same. A successor to mitosis. This is also a play at adoption for my framework markless — the syntax would basically be the same: those wanting to write the syntax can just use markless as a framework, and those who write markless libraries will just support all the other frameworks. Look at the mitosis folder in open-source and the markless folder in open-source. Research this in depth, make the writing easy to understand, and prove each claim with a POC in a top-level poc folder in the repo."

## Intake Summary

- Input shape: `existing_plan`
- Audience: the user (markless author), and eventually the public as positioning material for frameless/markless
- Authority: `requested`
- Proof type: `artifact` (report) backed by `demo`/`test` (POCs)
- Completion proof: report in `docs/` where each numbered claim maps to a passing POC under `poc/`, plus a final audit receipt with `full_outcome_complete: true`
- Goal oracle: the claims-to-POC map — every claim has a verify command that passes, or an explicit strategic/opinion label
- Likely misfire: a persuasive essay with unproven claims; POCs that demo something adjacent to the claim they're attached to; or drifting into building the full successor compiler instead of claim-level proofs
- Blind spots considered: adoption failure is partly social/ecosystem, so external evidence is required; "works the same" needs a concrete equivalence harness; markless capability gaps must be reported honestly; the two-sided adoption thesis is a strategy bet POCs can only show feasibility for
- Existing plan facts: preserved in `state.yaml` under `goal.intake.existing_plan_facts` — validate them against evidence in T004, do not execute them blindly

## Goal Oracle

The oracle for this goal is:

`Every numbered claim in the research report points at a POC under poc/ with a verify command that passes on this machine, or carries an explicit [strategic bet] / [opinion] label. Cross-framework "works the same" claims are proven by an equivalence check, not prose.`

The PM must keep comparing task receipts to this oracle. Planning, discovery, or a good-looking report draft is not enough. The goal finishes only when a final Judge audit re-runs the POC verify commands, checks the claims map, and records `full_outcome_complete: true`.

## Goal Kind

`existing_plan`

## Current Tranche

Continuous execution: Scout both codebases and the external adoption record, have Judge distill the evidence into a canonical numbered claim list with proof sketches, then run Worker packages that build the POCs (`poc/`) and write the report (`docs/`), verifying each package, until the final audit passes. Plan-only stopping is not valid for this goal.

## Non-Negotiable Constraints

- `/Users/jacksm5pro/dev/open-source/mitosis` and `/Users/jacksm5pro/dev/open-source/markless` are read-only reference material. All writes stay inside this repo (`docs/`, `poc/`, `docs/goals/`).
- Load the `markless` skill before reading or writing markless-syntax (`.tsrx`) code or markless internals.
- This is a fable session: implementation artifacts (POCs, report) are produced through crew dispatch (`crew run <packets.json>`), never by invoking `codex` directly; the PM diff-reviews every crew branch before merge and records a run-or-skip reason for second-model critique at each merge. If crew is unavailable, fall back to the installed goal agents and record the fallback in the receipt.
- This repo is not yet a git repository. Before the first Worker package, the PM must `git init` (crew dispatch and diff review both require it).
- The writing must be genuinely easy to understand: plain language, concrete examples, no unexplained jargon. Claims are numbered and each carries `[POC: poc/<path>]` or `[strategic bet]`.
- POCs must prove the specific claim they are attached to. If a claim can't be proven as stated, reword or relabel the claim — never fake or fudge a proof.
- markless capability gaps discovered by POCs are findings to report, not bugs to patch in the markless repo during this goal.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after Scout findings or Judge selection — safe Worker packages (POCs, report) must be activated and executed in the same run.

Do not stop after a single verified Worker package while claims remain unproven. Advance to the next package.

Do not create one Worker/Judge pair per POC. Group POCs into coherent packages and review the package as a whole.

## Slice Sizing

Safe means bounded, explicit, verified, and reversible. It does not mean tiny.

A good Worker package here is "the equivalence harness plus the first cluster of POCs, verified" or "the full postmortem section of the report with its claims wired to existing POCs" — not "one markdown stub" or "one hello-world file."

Do not stop because a slice needs owner input. Mark that exact slice blocked with a receipt, create the smallest safe workaround task, and continue local work.

## Canonical Board

Machine truth lives at:

`docs/goals/frameless-mitosis-successor/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/frameless-mitosis-successor/goal.md.
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
10. If a problem, suggestion, or follow-up should become a repo artifact, create an approved issue/PR or ask the operator whether to create one.
11. Review at phase, risk, rejected-verification, ambiguity, or final-completion boundaries; do not review every small Worker by habit.
12. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the original user outcome and records `full_outcome_complete: true`.

Issue and PR handoffs are supporting artifacts. `state.yaml` remains authoritative, and every external artifact decision must be recorded in a task receipt.
