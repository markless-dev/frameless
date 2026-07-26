# Frameless Svelte adapter v1

**Status: prepped, not started.** Created by `frameless-idiom-policy-v1` task T007 on 2026-07-26.

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

### Standing gaps inherited from the policy goal

- `pnpm check` does not typecheck `generated/`. Svelte's own `svelte-check` may cover part of this; confirm rather than assume.
- `pnpm e2e` pins dev mode only.
- `pnpm test:browser` hangs at the repo root (pre-existing; per-package scripts work).

## Current tranche

Land a Svelte lane: scaffold, emitter, gate, goldens, demo, e2e row. Then rule on IR-4.

## Stop rule

Stop when a final audit proves the oracle. Do not stop at "the emitter produces plausible Svelte".

## Canonical board

`docs/goals/frameless-svelte-v1/state.yaml` — machine truth. If this charter disagrees, `state.yaml` wins.

## Run command

```text
/goal Follow docs/goals/frameless-svelte-v1/goal.md.
```
