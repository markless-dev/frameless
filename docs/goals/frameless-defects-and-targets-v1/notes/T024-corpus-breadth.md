# T024 — the corpus-breadth ruling

Judge, 2026-07-27. Read-only. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Ruling on the T024 card's nine proposed scenarios, its target of twelve, its claimed
ranking, and the cross-lane mutation budget it asks to have ratified.

## 0. Headline

**The card's #1 is overturned as the first landing, and the target of twelve is
overturned as Phase F's number.**

Three of the nine proposed scenarios — composition (#1), effects with cleanup (#6)
and refs (#9) — are **not corpus work at all in four of the six lanes**. The Qwik,
Svelte, Vue and Angular emitters *hard-throw* on them. They are an emitter
**capability** project wearing a corpus costume, and folding them into Phase F
would stall breadth behind an emitter refactor.

Phase F's honest number is **EIGHT**, not twelve: the three that exist plus five
that the shipped IR and the shipped six emitters can already express. Twelve is
reachable only by counting the three capability projects, and those belong to a
separate phase alongside IR-8.

## 1. What was measured, not assumed

Every claim below was read out of the tree at `5edee60`.

**The corpus is three standalone single-component goldens.** Template-node census
of `packages/compiler/test/goldens/*.json`:

| golden | host | text | dynamic-text | branch | keyed-repeat | component-reference |
| --- | --- | --- | --- | --- | --- | --- |
| s1-render-once | 5 | 2 | 1 | 1 | 0 | 0 |
| s2-keyed-todo | 12 | 6 | 2 | 1 | 1 | 0 |
| s3-event-form | 11 | 4 | 1 | 0 | 0 | 0 |

Each has exactly one entry in `components`. No `component-reference`, no
`default-slot-projection`, no `fragment`, no nested repeat, no branch inside a
repeat, anywhere.

**Four of six emitters reject composition, refs and behaviours outright.**
The guard opens `emit()` in `packages/frameworks/svelte/src/emitter/index.ts`, and
character-for-character the same guard opens `emit()` in
`packages/frameworks/angular/src/emitter/index.ts`,
`packages/frameworks/vue/src/emitter/index.ts` and
`packages/frameworks/qwik/src/emitter/index.ts`:

```
if (
    ir.components.length !== 1 ||
    ir.imports.length ||
    ... ||
    ir.records.elementHandleBindings.length ||
    ir.records.handleForwards.length ||
    ir.records.behaviors.length ||
    ir.records.handleCalls.length
)
    throw new Error('Svelte emitter does not support composition or shared/handle constructs');
if (ir.module.exports.length !== 1)
    throw new Error('A .svelte module exports exactly one component');
```

Grepping the node kinds confirms it from the other side: `component-reference` and
`default-slot-projection` appear in `packages/frameworks/react/src/emitter/index.ts`
and `packages/frameworks/solid/src/emitter/index.ts` only. In Vue the only hits are
a comment and a gate message; in Qwik, Svelte and Angular there are none.

That guard also settles the *shape* of the composition problem. `A .svelte module
exports exactly one component` is not a policy line that can be deleted: `emit(ir)`
returns a **string**, and an SFC file holds exactly one component. Composition in
the Svelte and Vue lanes requires `emit()` to become a file map. That is emitter
architecture, not a golden.

**Refs and effects are cheaper than composition but blocked by the same guard.**
They need `elementHandleBindings` / `behaviors` support in four lanes, but no
multi-file emit and no IR change. Cost order within the capability group:
refs < effects < composition.

## 2. Why scenario #1 is overturned as the first landing

The card ranks composition first because it "converts three deferred instruments
into live ones" — vue-tsc, `svelte-check` and Angular `strictTemplates`, all of
which were ruled to have "a population of zero". Two independent measurements
overturn that as a *first* move.

**(a) Cost.** Four emitters throw; two of those need a string→file-map API change.
This cannot land as one coherent vertical across all six targets. It is a phase.

**(b) Value — falsified by this session's own four measurements.** Neither
`ComponentPropExpression` (`packages/compiler/src/schema.ts`) nor
`PropDestructuringEntry` (same file) carries a **type field**. So composition
emitted from today's IR passes **untyped** props. The consequence is already
visible in shipped output — `packages/frameworks/angular/generated/S2.ts`
emits `@Input() seed: any;` and `@Input() onTrace: any;`.

Against untyped props this session measured, four times independently:

- Vue — `vue-tsc` at **both** `checkJs` settings: unknown prop GREEN, wrong-typed
  prop GREEN. `defineProps([...])` types every prop `any` and undeclared props fall
  through to `$attrs`.
- Angular — a real production `ng build` with AOT: exactly six TS7006 diagnostics,
  **all** lambda parameters in transplanted handler bodies. The same gap, reached
  from a compiler instead of from reading a golden.
- Svelte — `svelte-check` does not catch a wrong-typed prop passed from a route.
- Solid — same hole.

So composition-over-today's-IR would buy those three instruments a **population**
but **no signal**. Population without signal is exactly the proxy the card's own
caveat forbids. The instruments go live only with **IR-8** — a type on the prop
entry — which is an IR change and which the card's own constraint requires to be
separated and justified rather than folded in.

Composition is not cancelled. It is re-sequenced behind IR-8 and behind the emitter
capability work, and out of Phase F.

## 3. The ratified Phase F set

Corpus 3 → 8. Per scenario: the divergence axis, and the evidence it is uncovered.

### S4 — NESTED LISTS (proposed #5)
**Axis:** loop-variable scoping across nesting depth, and inner-row key identity
under an outer reorder.
**Uncovered, measured:** every golden has at most one `keyed-repeat` (s2: exactly 1).
The Angular emitter documents its rule on `LoweredHandler` in
`packages/frameworks/angular/src/emitter/index.ts` — "`forVariables` are the
enclosing `@for` item names, **OUTERMOST FIRST**" — and restates it in ruling 3d
above `loweredHandlerBody` and on `collectEventScopes`. Every shipped call site is
a one-element list (`onH7Input(todo, $event)` in `generated/S2.ts`). **A rule whose
entire content is an ordering, exercised only at length one, is folklore.** This
scenario is the first instance of it.

### S5 — CONDITIONAL BRANCH TEARDOWN (proposed #2)
**Axis:** subtree destruction and cleanup ordering — block-based (Svelte/Vue/Angular)
vs reconciliation (React/Solid) vs resumed (Qwik).
**Uncovered, measured:** branches exist but none tears anything down. `s1`'s branch is
selected by a **static** prop (`visible={true}` in every demo's props) and never flips
at runtime. `s2`'s `@else` arm is literally empty and its `@if` arm is a static `<p>`.
No branch anywhere in the corpus encloses live state, a handler, or a keyed list.
T020's finding — a guarded control that stayed CORRECT while its guard had stopped
being consulted — is the precedent that this axis fails *silently*.

### S6 — WHITESPACE-SENSITIVE TEXT (proposed #8)
**Axis:** text-node normalisation.
**Uncovered, and already divergent by measurement:** the Angular lane **refuted** the
Vue lane's result this session. Vue's SFC compiler defaults to `whitespace:'condense'`;
Angular's `parseTemplate` preserves leading space and trailing newline on the same
shape. The corpus's only adjacency is `s2`'s `{complete}/{todos.length}`.
**Expected terminal state: a FINDING, not necessarily green.** A red here is the
payout, not the failure.

### S7 — FULL FORM CONTROLS **folded with** BOOLEAN/DYNAMIC ATTRIBUTES (#3 + #7)
**Axis:** value / checked / selected projection across control *types*, and
present-vs-absent-vs-`"false"` attribute semantics.
**Uncovered, measured:** the corpus has exactly two control types — a text `input` and
a checkbox `input`. No radio, select, textarea or multi-checkbox; no `disabled`,
`hidden` or `aria-*`. Evidence they diverge: in one night this repo hit React's
`defaultValue` attribute rewrite, Svelte's `remove_input_defaults` and Solid's
`attr:` — three frameworks, three behaviours, on the **one** control currently tested.
**Folded** because both proposals live on the same host/attribute machinery and one
demo route; two thin batches here would be worse slicing than one real one.

### S8 — ASYNC EVENT HANDLERS (proposed #4)
**Axis:** handler laziness and activation-time availability.
**Uncovered, measured:** zero `async` handlers in s1–s3. Defect 1 was exactly this —
Qwik QRL laziness, repaired with the `sync$` array form — and it is proven at **one**
site, outside the corpus.
**Known risk, flagged rather than hidden:** `assertLowerableCondition` and
`conditionExpression`, both in `packages/frameworks/qwik/src/emitter/index.ts`,
throw `synthesized sync$ body is not closed: unsupported guard condition`.
An async body may hit that. If it does, that is a finding about the Qwik lowering,
and it is why S8 does not share a batch with anything else.

### REJECTED from Phase F (not from the roadmap)
- **#1 composition**, **#6 effects with cleanup**, **#9 refs / direct DOM access** —
  capability-blocked in four of six lanes by the guard quoted in §1. They move to a
  capability phase, ordered refs → effects → composition, with **IR-8 first**.

Nothing else in the nine survives the selection principle as new: everything the
card proposed that the six emitters can already express is in S4–S8.

## 4. Landing order, and why

**S4 → S5 → S6 → S7 → S8.**

- **S4 first** because the first batch also has to prove the *measuring instrument*,
  and you do not calibrate an instrument on your hardest specimen. Nested lists are
  the cheapest scenario with the sharpest single mutant (an ordering rule with zero
  instances), so a red is unambiguous.
- **S5 second** because teardown is the axis where the three activation models
  differ most, and it is now measurable by a harness proven in batch 1.
- **S6 third, deliberately not first.** It is the scenario most likely to go red on
  landing. It should run only after two batches have established that a red means
  *the corpus*, not *the harness*. Placing a probable-red first is how an instrument
  fault gets misread as a defect — the exact mechanism behind four of this project's
  six original defects.
- **S7 fourth** — the widest surface and the most emitter-adjacent risk of the
  capability-free five.
- **S8 last and alone** — the Qwik `sync$` throw named under S8 above is a live
  possibility, and a batch that may terminate in an emitter finding must not carry
  a second scenario down with it.

## 5. The cross-lane mutation budget

**Binding rule.** A scenario is not landed until, **for each of the six lanes**, at
least one axis-specific mutation of that lane's
`packages/frameworks/<lane>/generated/<S>.<ext>` makes the e2e assertion for that
scenario **FAIL**, and the failure site is recorded as either

  (i) the lane's own in-box assertion in `demos/<lane>/scenarios.box.ts`, or
  (ii) the cross-lane observation diff in `scripts/e2e.mjs`.

A mutant caught by **neither** is a **FINDING**: that scenario is not load-bearing in
that lane. It is reported with the lane and the axis named. It is **not** patched over,
and no existing assertion is weakened to accommodate it.

**Why `generated/` and not the demo copy.** Every demo's `copy-emitted` script runs
first in `dev`/`build` and would overwrite a mutation placed in `demos/*/src/emitted/`.
`packages/frameworks/<lane>/generated/` is the only mutation point upstream of the copy.

**Two guards, inherited from T018.**
1. Every mutant goes through a `mutate()` that **throws when the result is byte-identical
   to its input**. T018 converted 126 rows to exactly this discipline; a no-op mutant
   that "passes" is the vacuity it exists to prevent.
2. Restoration is verified by `git diff --exit-code -- packages/frameworks/*/generated`.
   A harness that leaves a mutant on disk poisons every run after it.

**Two-sided calibration, and why batch 1 carries the harness.** The harness must first
be run against the **existing** s1/s2/s3 and prove red there too. If a deliberate break
of s2's keyed list does **not** turn e2e red, then the eighteen byte-identical
observation strings were never measuring the corpus, and adding five scenarios would
multiply theatre. The tree already holds this discipline elsewhere — the Vue and Angular
dev-sinks are calibrated against a deliberately corrupted served payload, and
`measureServedAttribute` runs both a payload-wide and a scoped negative arm on **every
call**. The corpus deserves the same.

### S4's six mutants, spelled concretely

Taken from the shipped `S2` output, which is the same construct one level shallower.
Each row names the emitted file but no line in it: `generated/` is regenerated by the
emitter, so a line ordinal into it is stale the next time the corpus moves.

| lane | mutant | what red proves |
| --- | --- | --- |
| react | delete `key={todo.id}` from the **inner** `.map(...)` row (shape in `packages/frameworks/react/generated/S2.jsx`) | inner-row identity survives an outer reorder |
| solid | change the inner `<For each={...}>` to `<Index each={...}>` (`packages/frameworks/solid/generated/S2.jsx`) | `Index` keys by position, not identity |
| qwik | delete `key={...}` from the inner `.map(...)` (`packages/frameworks/qwik/generated/S2.jsx`) | resumed reconciliation still keys rows |
| svelte | delete the inner `(todo.id)` from `{#each ... as ... (…)}` (`packages/frameworks/svelte/generated/S2.svelte`) | the T009 require-each-key shape, one level deeper |
| vue | delete `:key="todo.id"` from the inner `v-for` (`packages/frameworks/vue/generated/S2.vue`) | same axis, block-based renderer |
| angular | **swap** the two `forVariables` in one nested handler call: `onHxInput(outer, inner, $event)` → `onHxInput(inner, outer, $event)` | ruling 3d, first instance |

The Angular mutant is the sharpest on the board. Both variables are `any` (`@Input() seed: any`,
plus the six TS7006 lambda parameters), so the swap **compiles clean and AOT stays green** —
only behaviour can catch it. **If it does not go red, Angular ruling 3d is folklore, and that
is the headline finding of batch 1.**

### S5–S8: axis ratified, spelling delegated

Each Worker records its six mutants **verbatim** in its note, each byte-verified, each with
its red site named. The axis each mutant must attack:

- **S5** — the mutant must make a torn-down subtree's state or handler **survive** the flip
  (hoist the state out of the branch, or drop the cleanup).
- **S6** — the mutant must alter exactly one text node's leading or trailing whitespace.
- **S7** — one mutant flips a boolean attribute from absent to `="false"`; one flips a
  control's value projection from property to attribute.
- **S8** — the mutant must move one async handler's pre-await work to after the await.

## 6. The stopping rule — what closes Phase F

Phase F is **ENOUGH**, not merely bigger, when **all** of:

1. **Eight scenarios exist (s1–s8), each landed in SIX lanes.** Five-of-six is the
   broken-matrix case, not partial progress.
2. **`pnpm e2e` reports 6 demos × 8 scenarios with all 48 observation strings
   byte-identical**, PM-verified by *reading the strings*, not by reading the summary line.
3. **48 recorded mutants — one per scenario per lane** — each byte-verified
   non-identical, each with a named red site. Any surviving mutant is carried as an
   **open finding** naming the lane and the axis.
4. **The harness's own two-sided calibration is green on s1–s3** as well as s4–s8.
5. **Every scenario in the set has a written divergence axis not covered by another
   scenario in the set.** A scenario that duplicates an axis is *removed*, not kept for
   the count.

**Phase F is not closed by reaching twelve.** Twelve was a headcount over a list that
turns out to contain three capability projects. For the shipped IR and the shipped six
emitters the number is **eight**. Twelve is reachable only by counting composition, refs
and effects — and the "~sixteen at IR maturity" figure is where IR-1, IR-2, IR-3, IR-6
and IR-8 actually live, in a phase that has not been scoped.

## 7. Worker slicing

Batch 1 is specified in full on the T024 receipt's `worker_package` and belongs on **T025**.
Batches 2 and 3 belong on **T026** and **T027**; batches 4 and 5 need two new cards.

- **T025** — the mutation harness (calibrated two-sided on s1–s3) **+ S4 nested lists**,
  six lanes, mutation budget proven red.
- **T026** — **S5 conditional branch teardown**, six lanes, mutation budget proven red.
  `allowed_files` = T025's list with `s4-nested-list` → `s5-branch-teardown`, `S4` → `S5`,
  `NestedBoard` → `BranchBoard`, `s4` route → `s5` route, minus
  `scripts/corpus-mutation.mjs` and root `package.json` (the harness already exists),
  plus `notes/T026-corpus-s5-branch-teardown.md`.
- **T027** — **S6 whitespace-sensitive text**, same substitution pattern with `S6` /
  `WhitespaceBoard` / `s6`. Its `stop_if` must additionally say: *a cross-lane whitespace
  divergence is the expected finding — record it verbatim with both lanes' measured
  strings and STOP; do not normalise any emitter to make the matrix agree.*
- **T030 (new)** — **S7 form controls + boolean/dynamic attributes**, six lanes.
- **T031 (new)** — **S8 async event handlers**, six lanes, alone.
- **T032 (new, OUT of Phase F)** — the capability phase: **IR-8 typed prop entries first**,
  then refs → effects → composition across the four blocked emitters, including the
  Svelte/Vue `emit()` string→file-map change. This is the card's #1, #6 and #9, re-homed.

### Dispatch precondition on T025

A Worker is live on the Angular policy fold and is holding
`packages/frameworks/angular/src/emitter/index.ts`, `.../src/gate/index.ts`,
`.../test/gate.test.ts` and `docs/emitter-idiom-policy.md`. T025's `allowed_files`
include `packages/frameworks/angular/scripts/regenerate.ts` and
`packages/frameworks/angular/generated/S4.ts`, both inside that Worker's package.
**T025 must not dispatch until that Worker's receipt lands and the tree is clean.**
Two Workers inside `packages/frameworks/angular/**` is not provably disjoint, and
separate cards are not proof of disjointness.
