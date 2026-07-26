# Frameless Framework-Idiom Policy (Qwik `$`-prop as the instance)

## Objective

Settle, in writing and in code, how much framework-idiom sugar the frameless emitters own versus leave literal — using the Qwik `$`-suffixed-prop case as the concrete instance to decide — and prove the resulting rule is transferable by having a zero-context agent apply it correctly to an idiom it has never seen. Then prep the Vue, Angular, and Svelte expansion boards against that ratified rule.

## Original Request

> `onInput$={$((event, element) => { draft.value = element.value; })}` So in Qwik you don't actually need to inject a $ sign if the prop itself has $ sign on it. Although I'm not sure if it's worth the extra handling or not for us to do this, because it does work the way you have it. I'm also wondering if we should start the goals for Vue, Angular, and Svelte

Owner clarification during intake:

> IDK. I'm just telling you it's idiomatic to not have to include the $ there because Qwik's compiler does it for you in cases where the prop already has $ sign on it. It has a function called `implicit$FirstArg`

> We need to push all of our current stuff to latest we are the only person working on this

## Intake Summary

- Input shape: `vague` (two linked questions, neither with a decided answer)
- Audience: frameless maintainers and future adapter authors (human and agent)
- Authority: `approved` — owner is sole committer, explicitly authorized merging `land/stack-and-three-way-demo` into `main` and pushing
- Proof type: `test` + `review` (behavioral green plus cold-agent replication)
- Completion proof: the ratified policy exists, the Qwik `$`-prop case is resolved in line with it (either direction) with demos green, a zero-context agent applies the policy correctly to an unseen idiom, and the Vue/Angular/Svelte boards are prepped against it
- Goal oracle: see below
- Likely misfire: shipping `$`-prop inference in the Qwik emitter — or a tidy-sounding policy document — and calling the goal done, without proving the rule transfers. That leaves Vue, Angular, and Svelte to re-litigate the same question three times, inconsistently, which is the exact cost the goal exists to avoid.
- Blind spots considered:
  - The Qwik `$` question is not a Qwik question. It is a policy question about emitter-owned sugar that Vue (`v-model`, `emits`), Angular (signals, outputs), and Svelte 5 (runes) will each re-raise.
  - "Reject the sugar, stay literal, document why" is a legitimate and possibly correct outcome. The board must not presume implementation.
  - Emitter-owned idiom sugar buys ergonomics but bakes framework-version-specific knowledge into frameless and can make emitted output harder to debug against framework docs.
  - A policy that reads well to its author may be unusable by someone without the conversation that produced it — hence the cold-agent half of the oracle.
- Existing plan facts (preserve and validate, do not assume correct):
  - ~~Qwik exposes `implicit$FirstArg`; for `$`-suffixed props and APIs the optimizer/runtime accepts a raw function and performs the wrapping.~~ **Corrected by T002 (2026-07-26).** The conclusion holds but the mechanism does not. `implicit$FirstArg` (`core.mjs:3007`) unconditionally wraps arg0 via `$()`, with no `isQrl` guard, and applies **only to `$`-suffixed API functions** (`useTask$`, `useComputed$`, `event$`, …). It is **not involved in JSX event props** like `onInput$` — the Rust optimizer rewrites those at build time. Both `onInput$={$((e, el) => ...)}` and `onInput$={(e, el) => ...}` remain valid, for a different reason than assumed at intake. The owner's original wording is preserved verbatim under *Original Request* above; this bullet is the validated version.
  - Also from T002: explicit `$()` *inside* an `implicit$FirstArg` API — `useTask$($(fn))` — is a hard optimizer error (C03) that emits a broken chunk. Frameless does not emit that shape, but the policy must not accidentally license it.
  - The current frameless emitter output (explicit inner `$()`) **works today**. This is ergonomics/polish, not a defect. No regression pressure.
  - The owner is genuinely undecided on whether the extra emitter handling is worth its cost.
  - `land/stack-and-three-way-demo` must be merged into `main` and pushed before new work starts. Owner is the only committer; there is no review gate.
  - Untracked `test-results/` exists in the working tree and should be resolved (ignored or removed) rather than merged.

## Goal Oracle

The oracle for this goal has two halves, and both must be satisfied:

`(1) Behavioral: pnpm e2e / activation-neutrality stays green across demos/react-official, demos/solid-official, and demos/qwik after the Qwik $-prop decision is implemented (in whichever direction the Judge ratifies). (2) Transferability: a zero-context agent, handed only the written idiom policy and no conversation history, makes the correct sugar/no-sugar call on a framework idiom case it has never seen.`

The PM must keep comparing task receipts to this oracle. Half (1) alone proves a code change. Half (2) alone proves prose. Neither alone closes this goal. Planning, discovery, a passing tiny slice, or a clean-looking board is not enough. The goal finishes only when a final Judge audit maps receipts and verification back to both halves and records `full_outcome_complete: true`.

## Goal Kind

`open_ended`

## Current Tranche

Continuous execution, in this order:

1. Bring the repo to latest: merge `land/stack-and-three-way-demo` into `main`, push, resolve `test-results/`.
2. Gather evidence: how Qwik's `implicit$FirstArg` actually behaves, what the frameless Qwik emitter does today, and what the equivalent idiom-sugar tension looks like in Vue, Angular, and Svelte 5.
3. Judge ratifies the policy and the Qwik call, with an exact bounded Worker objective.
4. Worker implements the ratified decision and writes the policy, keeping demos green.
5. PM runs the cold-agent replication test against an unseen idiom.
6. PM preps the Vue, Angular, and Svelte goal boards against the ratified policy.
7. Judge audits both oracle halves.

Enough for the full owner outcome is: both oracle halves satisfied and the three expansion boards prepped. Not: the Qwik emitter changed.

## Non-Negotiable Constraints

- The Qwik `$`-prop decision is **open**. Implementing the sugar and documenting a reasoned rejection are equally acceptable verified outcomes. A Worker must not implement sugar before a Judge ratifies the direction.
- Ground the Qwik decision in `implicit$FirstArg` semantics and observed behavior, not in a plausible-sounding reading of the docs.
- Activation neutrality is not negotiable: react-official and solid-official hydrate, qwik resumes, identical S1 behavior. Any change that breaks it is rejected.
- The expansion boards for Vue, Angular, and Svelte are **prepped only** in this goal (`goal.md` + `state.yaml` + board). No adapter implementation for those frameworks happens here.
- Use official framework scaffolds for any new demo surface. Do not hand-roll SSR build harnesses.
- The cold-agent replication must genuinely be zero-context: a fresh agent, given only the policy document and the unseen case, with no access to this conversation or this board's reasoning.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after a single verified Worker package when the broader owner outcome still has safe local follow-up work. Advance the board to the next highest-leverage safe Worker package and continue unless a phase, risk, rejected-verification, ambiguity, or final-completion review is due.

Do not create one Worker/Judge pair per repeated file, emitter, or framework. Put repeated same-shape work into one Worker package and review the package as a whole.

## Slice Sizing

Safe means bounded, explicit, verified, and reversible. It does not mean tiny.

A good task is the largest safe useful slice. Small is not the goal. Useful is the goal.

Specifically here: the cross-framework idiom survey is **one** Scout package covering Vue, Angular, and Svelte — not three. The three expansion board preps are **one** PM package — not three.

A Worker should finish the whole assigned slice. A Judge should judge the whole assigned slice. A PM should reorient the board when tasks are safe but not moving the outcome.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/frameless-idiom-policy-v1/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/frameless-idiom-policy-v1/goal.md.
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
12. Finish only with a Judge audit receipt that maps receipts and verification back to **both** oracle halves and records `full_outcome_complete: true`.
