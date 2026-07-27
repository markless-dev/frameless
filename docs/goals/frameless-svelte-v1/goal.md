# Frameless Svelte adapter v1

**Status: prepped, not started.** Its `state.yaml` reads `status: active` only because the GoalBuddy checker requires an active task while a goal is active; nothing is running it. Do not read that as work in progress. Created by `frameless-idiom-policy-v1` task T007 on 2026-07-26.

## Objective

Add Svelte 5 as a frameless target: an emitter that turns `EnrichedIR` into Svelte source, proven activation-neutral against React, Solid and Qwik on an **official Svelte scaffold** at a pinned lockfile version, with S1/S2/S3 behaving identically to the existing three.

## The thing that makes Svelte different

Svelte 5 is the target where **the version pin is not a detail, it is the whole problem**. The idiom-policy goal found that "is this sugar the same kind of thing as the Qwik `$` case?" is not a property of a sugar at all — it is a property of a sugar **plus a pinned framework version**. Svelte is where that bites hardest:

- `onclick` (Svelte 5) versus `on:click` (Svelte 4) is the *same lexical substitution* flipping category across a major version.
- Reassignable `$derived` requires 5.25+.
- Svelte 5 **removed event modifiers** entirely, which interacts directly with IR-5.

And `EnrichedIR` has **no target-framework-version input** (IR-4). `docs/emitter-idiom-policy.md`'s version corollary is explicit that version-gated sugar `FAIL`s or `DEFER`s until it does, and that adding that input is an adapter-board concern. This is that adapter board. Deciding whether IR-4 gets closed here — and if so, how — is arguably this board's most consequential decision, and it is one the other two adapter boards will inherit.

## Non-negotiable constraints

- **`docs/emitter-idiom-policy.md` governs every emission-site form choice.** Run the six gates and record the outcomes.
- **Official scaffold only.** `npx sv create` (or the current official equivalent) as it ships. See `docs/goals/frameless-qwik-v1/` for the cost of hand-rolled harnesses.
- **Activation neutrality is the bar.** S1/S2/S3 must produce observations equal to the existing three through `scripts/e2e.mjs`.
- Do not weaken any existing activation-neutrality check to make a Svelte lane pass.
- **If this board closes IR-4, it does so as a general facility**, not a Svelte-shaped hack — Vue and Angular need the same thing for `defineModel` (3.4+) and signal `input()`/`output()` (≥17.1/17.2).

## Goal oracle

`pnpm e2e` includes a Svelte row driving an official Svelte scaffold at the pinned lockfile version, and its S1/S2/S3 observations are asserted equal to the existing three demos under the same matrix.

Secondary, after the lane exists: a ruling on IR-4 — either the target-version input is implemented and at least one version-gated sugar question resolves through it, or IR-4 is explicitly deferred with the reason recorded and the consequence for Vue and Angular stated.

## Inherited intake facts

From `frameless-idiom-policy-v1` T003's survey. Evidence to validate, not settled truth.

### IR gaps that bite Svelte

| Gap | What is missing | Svelte feature it blocks |
|---|---|---|
| IR-1 | No two-way/bindable prop kind (`schema.ts:149-156`). | `$bindable` / `bind:` |
| IR-3 | Only a default slot (`schema.ts:171-176`). | snippets |
| IR-4 | No framework-version input (`schema.ts:493-501`). | reassignable `$derived` (5.25+), and the `onclick`/`on:click` split itself |
| IR-5 | Modifier vocabulary is exactly `'preventDefault' \| 'stopPropagation'` (`schema.ts:35-39`). | Svelte 5 removed modifiers — the interaction needs deciding, not assuming |
| IR-6 | No class/style binding vocabulary (`schema.ts:86-90`). | `class:` directives |
| IR-7 | Purity is never asserted; `ExpressionSite.expression` is an arbitrary AST node. | `$derived` expects a pure expression |

### Already surveyed — the `bind:` counter-case

`bind:` was found to be **different-in-kind** from the Qwik `$` case on two independent axes: it requires an **lvalue** (the IR's path-based and `handler-local-alias` writes are not lvalues), and **bindability is declared by the child** while frameless emits one module at a time from one `EnrichedIR`. A wrong call surfaces as a dev-only `ownership_invalid_mutation` console warning rather than a build error — which means a naive `bind:` implementation can look fine in tests and be wrong in production. Do not treat `bind:` as a formatting choice.

### Prior in-repo work

`poc/09-storage/svelte` exists and took cheap lexical sugar with classic lifecycle shapes. Prior assumption — evidence, not precedent.

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

Svelte's own `svelte-check` may still cover more than the shared lane does; confirm rather than assume.

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

Land a Svelte lane: scaffold, emitter, gate, goldens, demo, e2e row. Then rule on IR-4.

## Stop rule

Stop when a final audit proves the oracle. Do not stop at "the emitter produces plausible Svelte".

## Run order across the three adapter boards

**This board should run first of the three, or at least reach its IR-4 ruling first.**

The three *lanes* are independent — nothing stops Vue or Angular from scaffolding, emitting and proving activation neutrality in any order. S1/S2/S3 do not depend on version-gated constructs, so IR-4 does not block a lane.

What IR-4 does block is each board's **sugar rulings**. Vue needs it for `defineModel` (3.4+) and Angular for signal `input()`/`output()` (≥17.1/17.2), and this board owns the decision. Run Vue or Angular's sugar ruling first and it will either defer on IR-4 grounds or invent a local answer that this board then contradicts — which is precisely the "re-litigate the same question three times, inconsistently" cost the idiom-policy goal existed to prevent.

## Canonical board

`docs/goals/frameless-svelte-v1/state.yaml` — machine truth. If this charter disagrees, `state.yaml` wins.

## Run command

```text
/goal Follow docs/goals/frameless-svelte-v1/goal.md.
```
