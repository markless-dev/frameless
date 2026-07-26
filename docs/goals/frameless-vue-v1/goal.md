# Frameless Vue adapter v1

**Status: prepped, not started.** Created by `frameless-idiom-policy-v1` task T007 on 2026-07-26.

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

### Standing gaps inherited from the policy goal

- `pnpm check` (`tsc --noEmit`) does **not** typecheck `generated/` — the root tsconfig includes only `packages/*/src/**` and `packages/frameworks/*/src/**`. Emitted Vue output will be unchecked by default.
- `pnpm e2e` pins **dev mode only** (`demos/qwik/scenarios.box.ts` is `modes: ['dev']`). Production-mode coverage exists only where a task adds it explicitly.
- `pnpm test:browser` hangs at the repo root (pre-existing, unrelated to any emitter; the per-package `test:browser` scripts work). Anything this board wants to pin via that command needs the hang resolved first.

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
