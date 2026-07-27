# T006 — adopting the T005 shorthand ruling

Worker record, `frameless-vue-v1` T006, 2026-07-27. Implements
`docs/goals/frameless-vue-v1/notes/T005-vue-shorthand-ruling.md`, which is authoritative. Nothing
here re-litigates that ruling; this file records what the adoption actually changed, the two places
the package's own text was read differently from a literal reading of the card, and the numbers the
ruling predicted so a later reader can check them rather than take them.

## What landed

1. **`docs/emitter-idiom-policy.md`** — worked example 2 REPLACED by 2a (sugar, six `PASS`) and 2b
   (`v-slot`, denied at G6 with G4 `UNKNOWN`), copied from the ruling with all six gate outcomes
   recorded on each. Worked example 3 and the Angular entries were not touched: worked example 3's
   stale G1/G4 labels are T007's, and its `DENIED` rests on G5, which this ruling does not reach.
2. **Gate 1's absent-framework paragraph** — the sentence "Vue and Angular are absent today" is gone.
   It was a single sentence naming two frameworks, and it went half-false the moment the Vue lane
   landed and fully false when the Angular lane did. It is now a **one-line-per-framework list**, so
   a lane that lands discharges itself without rewriting anyone else's line. Svelte's existing
   discharge was carried over verbatim in substance; Vue's was added. **Angular's line was
   deliberately left unwritten** — the Angular fold is queued behind this task and owns it.
3. **Three emission sites flipped** in `packages/frameworks/vue/src/emitter/index.ts`:
   `eventDirectiveName()` → `@name`, `attributesOf()` → `:name`, `renderKeyedRepeat()` → `:key`.
   `v-for` keeps its longhand and is not an exception: it has no shorthand, and `todo in todos` is
   not a JavaScript expression.
4. **The decision-site comment rewritten.** It previously read "DECISION SITE — LONGHAND `v-on:`,
   never `@`" and said the ruling was T005's to make; it now names the ruling, states the mechanism
   (`ondirname` at `compiler-core.cjs.js:2435`), and carries the three refusals that did *not* travel
   with the adoption — modifiers, the `.prop` shorthand, and `v-slot` — each with its own reason.
5. **`no-directive-shorthand` inverted**, and **renamed** — see deviations.
6. **`directive-carries-value`**, a new standing gate policy.
7. **`BASELINE_FORM_INVENTORY`**: `:` and `@` added at floor `3.0`, evidence `unverified`, with a
   floor reason that says in as many words that `ondirname` proves the *equivalence* and dates
   *nothing*. `v-bind` and `v-on` removed — see deviations.
8. **Both `VUE_ESLINT_TIERS_EXCLUDED` `firesOnCorpus` lists** cut from eight ids to six, and both
   reason texts rewritten. **The exclusion stands**, on the two content-newline rules that would
   break the cross-lane text observation under `whitespace:'condense'`.

## The polarity reversed exactly, and it was measured both ways

The ruling predicted "0 violations on the longhand corpus and 30 on the shorthand twin, split across
`no-directive-shorthand` (25) and `baseline-form-inventory` (5)", and required the polarity to
reverse. Measured after the flip, by running `checkSources` over the shipped corpus and over a
mechanically respelled longhand twin:

| corpus | violations |
| --- | --- |
| shipped (shorthand) | **0** |
| longhand twin | **30** — `require-directive-shorthand` 25, `baseline-form-inventory` 5 |

Same total, same split, opposite sign. The `baseline-form-inventory` half of that is the reason
`v-bind`/`v-on` had to come *off* the inventory rather than sit alongside `:`/`@`: had they stayed,
the longhand twin would have tripped one policy instead of two, and the second independent detector
the ruling relies on would have been quietly lost.

## Layout did not move, and that was the thing most likely to move

The ruling warned that `renderHost`'s `width()`/`fits` decision would change, because the shorthand
is 6 characters shorter per `v-bind` and 4 per `v-on`. **It did not.** The golden diff is a pure
respelling — no start tag changed between single-line and multi-line — because every multi-line start
tag in the corpus is multi-line on account of a `\n` inside a handler value, which `fits` rejects
before width is consulted. The one single-line candidate (`<li v-for … :key … :data-oracle-row-key>`)
was already single-line.

`pnpm e2e` was captured **before** any edit and compared after: all **18** observation strings across
six lanes × three scenarios are byte-identical, `sha256 909ff0a74031a9d7…` both times.

## Deviations from a literal reading of the card

1. **The policy id is `require-directive-shorthand`, not `no-directive-shorthand`.** The card says
   invert the policy; it does not say freeze its id. A policy whose id reads "no directive
   shorthand" while it *requires* the shorthand would print that phrase in every violation message
   it emits, and the id is the only part of a violation a reader sees first. The rest of this gate
   names policies honestly (`generated-header`, `condense-stable-text`), so a positive-polarity name
   is the existing convention rather than a new one. Recorded loudly because a later reader grepping
   for `no-directive-shorthand` will find nothing.
2. **`v-bind` and `v-on` were REMOVED from `BASELINE_FORM_INVENTORY`, not merely joined by `:` and
   `@`.** The card says "add". The inventory's stated contract is "an explicit allowlist of every
   form the emitter *may* put in its output"; after the flip no emission site can produce the
   longhand, so leaving it listed would be a silent widening in the other direction and would cost
   the longhand its second detector (see the table above). Reversible in one line if the PM disagrees.
3. **The emitter-side text assertions are scoped to the `<template>` block.** A shorthand-shaped
   regex over the whole file matches the generated header — `@generated by @frameless/vue` — and
   reports a directive that is not there. Caught by the first run of the new row, and the slicer
   itself now has a calibration row, because an empty haystack satisfies every `not.toMatch` in that
   test.

## Instrument notes

- **`.` and `:` normalise to the same directive `name`.** The first draft of
  `require-directive-shorthand` keyed on `directive.name` and therefore accepted `.checked="checked"`
  as if it were the adopted `:checked="checked"`. Reading `rawName` is the only thing that separates
  them, which is exactly what the ruling says about `ondirname`. Both the `#` and `.` arms now have
  their own mutation row.
- **`directive-carries-value` needs an anti-vacuity row of its own**, because `v-else` is emitted and
  carries no value: a naive "every directive has an expression" would be red on the clean corpus. The
  value-less allowlist is fail-closed with `v-else` as its only member, and a planted `v-once` proves
  it still rejects an unnamed value-less directive.
- **The two eslint rules that stopped firing are asserted as an ABSENCE with a calibration.** A
  missing rule id and a satisfied rule id look identical in a list. The new row lints a *reverted*
  S2 with `flat/strongly-recommended` and watches `vue/v-bind-style` come straight back, so the
  absence is a measurement rather than an upstream removal nobody noticed.

## Left standing, deliberately

- **`packages/frameworks/vue/README.md` lines 24–25 still say the emitter ships "longhand `v-bind:` /
  `v-on:`" and attribute it to T002 ruling 2.** That is now false. The file is **outside this task's
  `allowed_files`**, so it was not edited. It needs one sentence from a later package.
- **The `eslint-plugin-vue` tier exclusion.** `vue/v-on-style` and `vue/v-bind-style` now pass, and
  that is explicitly *not* a reason to adopt `flat/strongly-recommended`: the exclusion rests on six
  other measured rules, two of which would turn `<button>increment</button>` into
  `<button> increment </button>` and break the observation six lanes assert equal.
- **The `:`/`@` floors read `unverified`,** matching every other Vue floor. `compiler-core:2435`
  proves the normalisation, not the version it arrived in. Never record a floor you did not verify.
