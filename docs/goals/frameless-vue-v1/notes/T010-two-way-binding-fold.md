# T010 — folding the two-way-binding ruling, and re-counting its domains

Worker receipt for `frameless-vue-v1` T010. The ruling itself is T009's
(`notes/T009-define-model.md`); this note records what the fold changed, the
**re-enumeration** the card required before any number was allowed through, and the
**red calibration** every new assertion was put through.

## 1. The re-enumeration, which came before the fold

T009's two domain figures — 12a's *"one of five"* and 12b's *"six shipped props"* — were
enumerated over **four** goldens at `41aaed0`. S5 (branch teardown) and S6 (whitespace) have since
landed. **The corpus is six.** A count folded into the policy that was true of a different corpus
is exactly the stale-label fault worked example 3 exists to record, so both were **re-measured**
rather than chosen between.

### 12a — domain unchanged at five, and that is a measurement

Domain: every host `renderHost()` (`src/emitter/index.ts:815`) prints carrying a `value` or
`checked` binding from `attributesOf()` (`:753`) **plus** a same-host event from `eventAttribute()`
(`:730`). Enumerated by parsing all six emitted `.vue` goldens with `@vue/compiler-sfc` and walking
the template AST for elements holding both a `bind` directive named `value`/`checked` and an `on`
directive:

| golden | line | tag | binding | event | handler |
|---|---|---|---|---|---|
| S2 | 14 | `input` | `value` | `input` | `draft = event.currentTarget.value` — **and nothing else** |
| S2 | 32 | `input` | `value` | `input` | alias write + re-slice + `onTrace('edit', …)` |
| S2 | 43 | `input` | `checked` | `change` | copy + alias write + `onTrace('toggle', …)` |
| S3 | 19 | `input` | `value` | `input` | assign + `onTrace('text', …)` |
| S3 | 27 | `input` | `checked` | `change` | assign + `onTrace('checked', …)` |

**S5 and S6 contribute ZERO instances** — neither golden emits a `value` or a `checked` binding at
all. Domain size **5**; the sugar applies to **1** (S2 line 14, the emitter's `h2`/`event:0`). The
node ids in T009's table were re-derived from the compiler goldens' template trees and are correct:
S2 `h2`, `h7`, `h8` and S3 `h1`, `h2`.

**`one of five` survives, and it survives because it was re-measured.** A figure that happens to
hold across a corpus change is indistinguishable, on the page, from one nobody re-checked — which is
why the entry now says so in as many words.

### 12b — the domain MOVED, 10 → 15, while the headline figure did not

Domain: every `PropDestructuringEntry` in `component.props.entries` printed into
`defineProps([...])` by `propsDeclaration()` (`src/emitter/index.ts:400`). Enumerated directly off
`packages/compiler/test/goldens/*.json`:

| golden | printed entries | names |
|---|---|---|
| S1 | 4 | `label`, `multiplier`, `visible`, `onTrace` |
| S2 | 2 | `seed`, `onTrace` |
| S3 | 2 | `initial`, `onTrace` |
| S4 | 2 | `seed`, `onTrace` |
| S5 | 2 | `seed`, `onTrace` |
| S6 | 3 | `seed`, `label`, `onTrace` |

**Fifteen printed entries across six goldens; six distinct names.** T009's "six shipped props" was
a *distinct-name* count over four goldens. The **entry** count went 10 → 15; the **distinct-name**
count did not move, because S5 and S6 introduce no prop name S1–S4 did not already carry.

Both numbers are now stated in the entry and in the gate message, because only one of them was ever
re-measured and the two are trivially confusable.

**IR-1's measured content re-checked across all six goldens**, since 12b's Gate 4 rests on it:
every golden's prop bindings reduce to a single graph node `prop:props`, `writable: false`, `writes:
[]`. Six for six. The repair narrowing *"props the component writes back to"* is still not statable.

## 2. What landed

- **`docs/emitter-idiom-policy.md`** — worked examples **12a** and **12b** inserted after 11b,
  nothing else touched. No entry renumbered, no section restructured, and neither the Angular fold's
  worked examples 4/5 nor Gate 1's discharge list was modified. 12a carries the **stated non-ruling**
  for `v-model` on an emitted child component: empty domain, `UNKNOWN` at Gate 4 and `FAIL` at Gate
  6, entry 2b's shape — recorded as a non-ruling, not smuggled in as ruled.
- **`packages/frameworks/vue/src/gate/index.ts`** — `no-two-way-binding` now has **three limbs with
  three messages**. The template `v-model` message is 12a's grounds; the script branch is **split**,
  `defineModel` getting 12b's grounds and `defineEmits` keeping **T008's message verbatim**.
- **`packages/frameworks/vue/test/gate.test.ts`** — one row became four, and the file gained the
  `defineModel` row it never had.
- **`packages/frameworks/vue/src/emitter/index.ts`** — `propsDeclaration`'s decision-site comment
  names 12b as the ruling of record. **Comment-only**, verified mechanically.

## 3. The defect this removes, stated once

The shipped `v-model` message justified itself with *"worked example 3 is already ruled DENIED at
Gate 5"* — **and worked example 3 rules `defineEmits`, a different macro**. A correct rule resting on
a borrowed reason, in a user-facing string, read at the exact moment someone decides whether to trust
the rule. T008 repaired this for the `defineEmits` limb; this repairs the other one, in both places
it lived (the template directive and the shared script branch).

**The instrument gap was the same shape.** The file pinned the `defineEmits` message four ways,
asserted only the *policy id* for `v-model`, and had **no `defineModel` row at all**. The limb whose
reason was borrowed was also the limb with no calibration — not a coincidence, since an unpinned
message is one nobody has to justify.

## 4. The ruling of record

Both limbs **DENIED**, deciding gate **G5**, with **G3, G4 and G6 denying independently**. **G1 and
G2 PASS for both.** **IR-4 was never the blocker**: four gates FAIL at the version this repo ships,
FAIL outranks DEFERRED, and `v-model` on a host element is not version-gated at all. The T002
dissent's Gate 2 mechanism is **refuted** — it imported worked example 4's *Angular* reasoning, and
`useModel` reads the parent vnode props at runtime and falls back to a purely local value, so
`defineModel` asks nothing of any other module.

## 5. Calibration — every new assertion shown RED first

The gate edit was reverted to `HEAD`, the new tests were run against the **pre-split** strings, and
the three new rows failed there. Because vitest stops a test at its first failing assertion, each
predicate was **additionally** evaluated one by one against the two pre-split message strings
captured from that run. **19 of 19 message assertions RED**, then all 42 tests green with the split
restored.

| # | assertion | pre-split |
|---|---|---|
| A1–A5 | `v-model` message contains `Worked example 12a`, `NEED_HYDRATION`, `el.composing`, `ssrLooseContain`, `FIVE shipped instances and the sugar applies to ONE` | RED |
| A6 | `v-model` message does **not** match `/worked example 3 is already ruled DENIED at Gate 5/` | RED — that is the exact shipped string |
| A7 | `v-model` message contains `denied at Gate 2, which it PASSES` | RED |
| B1–B7 | `defineModel` message contains `Worked example 12b`, `mergeModels`, `Modifiers`, `prop:props`, `writable=false`, `FIFTEEN printed entries`, `FAIL outranks DEFERRED` | RED |
| D1 | `mergeModels` appears in **exactly** the `defineModel` message | RED — pre-split it appeared in neither |
| D2–D3 | `onTraceOnce` / `silent no-op` appear in **exactly** the `defineEmits` message | RED — pre-split **both** macros received them |
| D4 | `NEED_HYDRATION` appears in **exactly** the template message | RED |
| D5 | the three limbs' **grounds** are three distinct texts | RED — pre-split the set had two members |

### Why the negative guards are EXCLUSIVITY assertions, and this is a deliberate deviation

§9.4 asked for two one-sided negatives. **Both are unsatisfiable or vacuous as literally written,
and the reason is worth recording rather than quietly working around:**

1. *"the `v-model` row must not match `/worked example 3/`"* — **unsatisfiable.** §9.3(a)'s
   prescribed message mentions worked example 3 on purpose, to *disclaim* it. So the guard pins the
   **withdrawn justification clause** instead, in the exact spelling it shipped in. That is T008's
   own precedent — it guarded `/receiving native|no longer to native/`, the refuted claim's
   spelling, not the topic.
2. *"the `defineEmits` message must not match `/defineModel|mergeModels/`"* — **a green vacuum.**
   T008's message folds through verbatim and never mentioned either token, so the guard passes
   before and after and can never distinguish. Phrased as **"`mergeModels` appears in exactly the
   `defineModel` message"** the same protection goes RED against the shared branch (it appeared in
   neither) *and* RED again if it ever leaks into the `defineEmits` message. Strictly stronger, and
   calibratable — which the one-sided form is not.

The symmetric guard on the `defineModel` side (`onTraceOnce` / `silent no-op` reaching **only** the
`defineEmits` message) is the sharpest row in the set: **pre-split both macros received both
tokens**, which is the defect in one assertion.

### The one assertion that is green both ways, and what was done about it

`twoWayMessage`'s `toHaveLength(1)` is a **precondition**, not a claim about the fix — instrument
rule 2. It passes against both gates, so it is **calibrated against a known member** (instrument rule
4) rather than trusted: a mutant calling **both** macros draws exactly two violations and the helper
is asserted to **reject** it. `find()` over a list of two would have silently read the first, and
with three limbs now firing from two different files, "which limb answered" is precisely what these
rows exist to settle.

## 6. Citations corrected while folding

- `renderNode`'s throw is at `src/emitter/index.ts:934`, not `:935` as §9.1 has it. Folded at the
  measured line. The throw is the generic *"no lowering for template node kind"* arm, which is what
  a `component-reference` would reach; `component-reference` occurs **zero** times in all six
  compiler goldens (`grep -c`, six for six).
- §9.1's "zero of the **five** compiler goldens" became **six**, for the same reason the domain
  counts were re-run.
- `renderHost:815`, `attributesOf:753`, `eventAttribute:730` and `propsDeclaration:400` were each
  re-read at HEAD and are all correct as cited.

## 7. Verification

`pnpm check`, `pnpm test`, `pnpm lint`, `pnpm test:browser`, `pnpm e2e`, and the regenerate
byte-equality gate all green. **No emitted golden moved** — this fold changes no emitted byte, and
the emitter diff is mechanically proven comment-only. The `pnpm e2e` observation block is
byte-identical to the pre-change capture taken on the clean tree at `8af8ed1`.
