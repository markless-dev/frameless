# Frameless Vue adapter v1

**Status: prepped, not started.** Its `state.yaml` reads `status: active` only because the GoalBuddy checker requires an active task while a goal is active; nothing is running it. Do not read that as work in progress. Created by `frameless-idiom-policy-v1` task T007 on 2026-07-26.

## Objective

Add Vue as a frameless target: an emitter that turns `EnrichedIR` into Vue source, proven activation-neutral against React, Solid and Qwik on an **official Vue scaffold** at a pinned lockfile version, with S1/S2/S3 behaving identically to the existing three.

## Why this board exists

`frameless-idiom-policy-v1` ratified `docs/emitter-idiom-policy.md` and, in doing so, established that **no idiom sugar for a framework absent from the lockfile can ship** — Gate 1 defers and Gate 6 defers, both for the same reason: no lane. Every Vue sugar question is therefore blocked behind this board existing and landing a lane. That is the first-order reason to do this work, ahead of any ergonomics argument.

## Non-negotiable constraints

- **`docs/emitter-idiom-policy.md` governs every emission-site form choice.** Run the six gates and record the outcomes. Do not decide Vue idiom questions ad hoc, and do not amend the policy from inside this board — a policy amendment is a ruling on the policy's own goal, not a side effect of an adapter.
- **Official scaffold only.** Use `npm create vue@latest` (or the current official equivalent) exactly as it ships. The repo has already paid for the lesson that hand-rolled SSR harnesses produce fake failures: see `docs/goals/frameless-qwik-v1/` and the note that the whole "blocked on beta.38" episode was a self-inflicted broken build harness.
- **Activation neutrality is the bar**, not "it renders". S1/S2/S3 must produce observations equal to react-official, solid-official and qwik, through the same `scripts/e2e.mjs` matrix.
- Do not weaken any existing activation-neutrality check to make a Vue lane pass.

## Goal oracle

`pnpm e2e` includes a Vue row driving an official Vue scaffold at the pinned lockfile version, and its S1/S2/S3 observations are equal to the existing three demos under the same matrix — with the equality asserted, not eyeballed.

Secondary, and only after the lane exists: at least one Vue idiom question run through all six policy gates and **reaching a non-`DEFERRED` Gate 1 and Gate 6**, demonstrating that the lane actually discharged the deferral rather than merely being asserted to.

## Inherited intake facts

From `frameless-idiom-policy-v1` T003's survey. These are evidence to validate, not settled truth.

### IR gaps that bite Vue

| Gap | What is missing | Vue feature it blocks |
|---|---|---|
| IR-1 | No two-way/bindable prop kind. `ComponentPropExpression.kind` is `'graph-reference' \| 'callback' \| 'serializable' \| 'opaque'` (`schema.ts:149-156`); `graph-reference` is read-only downward. | `defineModel` |
| IR-2 | No emit/custom-event concept. Child→parent is callback props only; `EnrichedEventRecord` binds to a `hostNodeId` (`schema.ts:318-325`), i.e. DOM events on host elements. | `defineEmits` |
| IR-3 | Only a default slot. `TemplateDefaultSlotProjection` (`schema.ts:171-176`) has no name. | `#header` / named `v-slot` |
| IR-4 | No framework-version input. Nothing in `EnrichedIR` declares a target version (`schema.ts:493-501`). | `defineModel` needs Vue 3.4+ |
| IR-5 | Event modifier vocabulary is two items wide: `SyncPolicyBranch.actions` is exactly `'preventDefault' \| 'stopPropagation'` (`schema.ts:35-39`). | Vue's ten `v-on` modifiers |
| IR-6 | No class/style binding vocabulary. `DynamicBinding` is `{kind, name, expression}` (`schema.ts:86-90`). | `:class` object/array syntax |
| IR-7 | Purity is never asserted. | Vue's "should not have side effects" rule on template function calls |

### Open questions the board must answer before writing an emitter

- **What does the emitter emit?** SFC (`.vue`) or Vue JSX? This is the largest unforced decision on the board and it changes everything downstream — tooling, goldens, the gate, and how the demo consumes output. React/Solid/Qwik all emit JSX; Vue is the first target where that is not the obvious answer.
- **Which activation model does the official scaffold use** for the S1/S2/S3 scenarios, and does the e2e harness's hydrate/resume vocabulary already cover it?
- `poc/09-storage/vue` exists from earlier work and took cheap lexical sugar with classic lifecycle shapes. Prior in-repo assumption — evidence, not precedent.

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

Vue's own `vue-tsc` may cover more than the shared lane does; confirm rather than assume.

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

Land a Vue lane: scaffold, emitter, gate, goldens, demo, e2e row. Then, and only then, run the policy on Vue's flagship sugar.

## Stop rule

Stop when a final audit proves the oracle above, mapping receipts to the equality assertion in `pnpm e2e`. Do not stop at "the emitter produces plausible Vue".

## Run order across the three adapter boards

The three *lanes* are independent — this board can scaffold, emit and prove activation neutrality without waiting on Angular or Svelte. S1/S2/S3 do not use version-gated constructs, so IR-4 does not block the lane.

But **this board's sugar ruling (T005) depends on IR-4**, which `frameless-svelte-v1` owns. Vue needs a target-version input for `defineModel`, which requires Vue 3.4+. If Svelte has not ruled on IR-4 by the time T005 runs, T005 must **defer on IR-4 grounds and say so** rather than inventing a local answer — a local answer is exactly the "re-litigate the same question three times, inconsistently" cost the idiom-policy goal existed to prevent.

## Canonical board

`docs/goals/frameless-vue-v1/state.yaml` — machine truth. If this charter disagrees, `state.yaml` wins.

## Run command

```text
/goal Follow docs/goals/frameless-vue-v1/goal.md.
```
