# Frameless Angular adapter v1

**Status: prepped, not started.** Its `state.yaml` reads `status: active` only because the GoalBuddy checker requires an active task while a goal is active; nothing is running it. Do not read that as work in progress. Created by `frameless-idiom-policy-v1` task T007 on 2026-07-26.

## Objective

Add Angular as a frameless target: an emitter that turns `EnrichedIR` into Angular source, proven activation-neutral against React, Solid and Qwik on an **official Angular scaffold** at a pinned lockfile version, with S1/S2/S3 behaving identically to the existing three.

## Why this board is the hardest of the three

Angular is not a harder version of the Vue problem. It is a **structurally different** problem, and the idiom-policy goal established exactly why:

> Angular template expressions forbid `const`, arrow functions, destructuring and `++` ([expression-syntax](https://angular.dev/guide/templates/expression-syntax)), so a frameless handler body **cannot be inlined into an Angular template at all** — it must become a class method.

`docs/emitter-idiom-policy.md` names this **forced lowering** and declares it outside the policy's scope. That has a direct consequence for this board: for React, Solid and Qwik the emitter chooses a *shape* for a handler. For Angular the emitter must **restructure** it — hoist the body to a class member, name it, and reference it from the template. Every other target's handler path is a formatting decision; Angular's is a transformation. Plan for that, do not discover it.

The second-order consequence: Angular is the framework where "emit the baseline form" needed a definition that does not mean "the literal form", because Angular has no literal form. If this board finds a case where the policy's baseline definition still doesn't resolve, that is a policy defect worth reporting upward — not a licence to improvise.

## Non-negotiable constraints

- **`docs/emitter-idiom-policy.md` governs every emission-site form choice.** Run the six gates and record the outcomes. Forced lowering is explicitly *not* a policy question — do not run the gates on it.
- **Official scaffold only.** `ng new` as it ships. See `docs/goals/frameless-qwik-v1/` for what hand-rolled build harnesses cost this repo.
- **Activation neutrality is the bar.** S1/S2/S3 must produce observations equal to the existing three through `scripts/e2e.mjs`.
- Do not weaken any existing activation-neutrality check to make an Angular lane pass.

## Goal oracle

`pnpm e2e` includes an Angular row driving an official Angular scaffold at the pinned lockfile version, and its S1/S2/S3 observations are asserted equal to the existing three demos under the same matrix.

Secondary, after the lane exists: the decorator-versus-signal member-declaration question — held out and independently ruled **no-sugar** during the policy goal's cold-agent test — re-run against the now-present framework, and its Gate 1 and Gate 5 outcomes recorded against a real build rather than a description.

## Inherited intake facts

From `frameless-idiom-policy-v1` T003's survey and T006's held-out case. Evidence to validate, not settled truth.

### IR gaps that bite Angular

| Gap | What is missing | Angular feature it blocks |
|---|---|---|
| IR-1 | No two-way/bindable prop kind (`schema.ts:149-156`). | `model()` / `[(banana)]` |
| IR-2 | No emit/custom-event concept; `EnrichedEventRecord` binds to a `hostNodeId` (`schema.ts:318-325`). | `output()` |
| IR-3 | Only a default slot (`schema.ts:171-176`). | `ng-content select=` |
| IR-4 | No framework-version input (`schema.ts:493-501`). | signal `input()`/`output()` need ≥17.1/17.2 |
| IR-6 | No class/style binding vocabulary (`schema.ts:86-90`). | `[class.x]`, `ngClass` |

### Already ruled — do not re-litigate

The **decorator (`@Input()`/`@Output()`) versus signal (`input()`/`output()`) member-declaration choice was ruled `no-sugar`** during `frameless-idiom-policy-v1` T006, twice and independently: once by the PM's pre-registered derivation and once by a zero-context agent given only the policy. Decisive gates were **G1** (nothing measurable, Angular absent from the lockfile) and **G5** (the two forms differ in reactivity depth and in throw behavior — a signal input participates in the reactive graph and a required one throws when read before it is set; a decorator field does neither).

Note carefully that this was ruled **denied, not deferred** — it does not automatically become sugar the moment this board lands a lane. G1 will clear; **G5 will not**, because G5 was never about absence. Re-running it is worthwhile (`T005`), but expect the answer to hold and be suspicious of a re-derivation that flips it.

The full record is `docs/goals/frameless-idiom-policy-v1/notes/T006-cold-agent.md`.

### Unresolved source conflict, inherited

Angular's API docs say `model()` is stable since v19.0; the v20 announcement says v20. Nobody has reconciled these. Resolve against the actual lockfile version once one exists.

### Standing gaps — REVALIDATED by `frameless-defects-and-targets-v1` T010

Three gaps were inherited from `frameless-idiom-policy-v1`. After the testing branch merged, **two
of them are fixed and one still holds.** Corrected here so this board does not plan around problems
that no longer exist.

- ~~`pnpm check` does not typecheck `generated/`.~~ **FIXED.** `check` now runs three passes —
  `tsc --noEmit` plus per-package `tsc -p packages/frameworks/react` and `…/solid` — and each
  framework package ships an `emitted-typecheck.test.ts` lane that runs under `pnpm test`. A new
  adapter should add the equivalent tsconfig and lane rather than treating emitted output as
  unchecked.
- ~~`pnpm test:browser` hangs at the repo root.~~ **FIXED.** It runs clean: react 55/55, solid
  44/44, from a cold Vite cache.
- `pnpm e2e` **pins dev mode only** — `scenarios.box.ts` is `modes: ['dev']` in both
  `demos/qwik` and `demos/react-official`. **STILL TRUE.** Production coverage exists only where a
  task adds it explicitly, as the Qwik cancellation work had to.

Angular's own build also typechecks templates, which may cover more than the shared lane does; confirm rather than assume.

### Instrument rules — standing constraints, added by `frameless-defects-and-targets-v1` T010

This board adds **four new instruments**: a gate corpus, a calibration lane, a reference pair and an
e2e row. That matters because on the defects goal, **four of six findings turned out to be
instrument faults, not product defects** — a harness clicking before any framework installs
listeners, a wall-clock bound over a frame-gated loop, an invariant contradicting a declared
canonicalisation, and a mutation whose search literal silently failed to match.

The root, in the Phase B audit's words: every one of them measured the product through a **proxy
whose stability the product never promised, and asserted nothing about the proxy.** The fault was
not that assumptions were made — instruments cannot avoid them — but that each assumption was
**silent**, so when it broke, the instrument reported a *product* defect instead of an *instrument*
fault.

Three rules follow. They are not advice.

1. **Two-variable triangulation before any finding is filed.** Vary one instrument parameter and one
   product parameter, and confirm the signal tracks the **product**. All four of those false
   findings would have been caught in minutes. Corollary, learned the hard way: a finding that
   reproduces on a stock official scaffold with none of our code is evidence the **test** is unfair,
   not that the framework is broken.
2. **Every instrument asserts its own preconditions.** A mutation harness asserts the source
   actually changed. A readiness wait blocks on the framework's **own** signal, never a browser
   lifecycle event that predates it. A positional comparison cites that the collection is
   order-significant. A repo-wide byte invariant is asserted by a test.
3. **Two-sided calibration for harnesses, not only gates.** This repo proved its gates can go red
   and proved nothing about its harnesses. A settle loop that cannot throw is not a settle loop.
   Every red must survive the fairness question *in writing* before it is interpreted.

## Current tranche

Land an Angular lane: scaffold, emitter with handler lowering, gate, goldens, demo, e2e row. Then re-run the held-out sugar question against a real build.

## Stop rule

Stop when a final audit proves the oracle. Do not stop at "the emitter produces plausible Angular".

## Run order across the three adapter boards

The three *lanes* are independent — this board can scaffold, emit and prove activation neutrality without waiting on Vue or Svelte. S1/S2/S3 do not use version-gated constructs, so IR-4 does not block the lane.

But **this board's sugar ruling (T005) depends on IR-4**, which `frameless-svelte-v1` owns. Angular needs it for signal `input()`/`output()`, which require ≥17.1/17.2 — and note this compounds the unresolved `model()` stability conflict, which cannot be settled without knowing the targeted version. If Svelte has not ruled on IR-4 by the time T005 runs, T005 must **defer on IR-4 grounds and say so** rather than inventing a local answer — a local answer is exactly the "re-litigate the same question three times, inconsistently" cost the idiom-policy goal existed to prevent.

## Canonical board

`docs/goals/frameless-angular-v1/state.yaml` — machine truth. If this charter disagrees, `state.yaml` wins.

## Run command

```text
/goal Follow docs/goals/frameless-angular-v1/goal.md.
```
