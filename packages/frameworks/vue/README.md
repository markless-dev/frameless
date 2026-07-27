# `@frameless/vue`

Emits Vue 3 single-file components from `frameless-enriched-ir/2`.

Landed by `docs/goals/frameless-vue-v1` T003. The measurements every design
choice here rests on are in
`docs/goals/frameless-vue-v1/notes/T003-vue-emitter.md`; this file is the short
version.

```
src/emitter/    IR  ->  .vue source
src/gate/       policies over emitted .vue, via @vue/compiler-sfc's own parser
                AND eslint-plugin-vue, the framework's own arbiter
src/format-emitted.ts   an ASSERTION over emitted text, not a formatter
generated/      the checked-in S1/S2/S3 corpus, byte-equal to a fresh emission
```

Regenerate with `pnpm --dir packages/frameworks/vue regenerate`; the goldens are
pinned by a byte-equality freshness test, so a stale artifact is a red test
rather than a surprise.

## The emitted shape

SFC with `<script setup>`, **no `lang="ts"`**, and the **valued `:` / `@`
shorthands** (`:key="todo.id"`, `@click="…"`). These are rulings, not
preferences — and they are rulings from *different* tasks, because the directive
spelling has already been re-decided once on this board:

- **No `lang="ts"`, no `defineProps<{…}>()`.** `frameless-vue-v1` T002 ruling 3.
  The IR carries no prop type field, so every emitted type would be inferred
  from what the corpus happens to do with a prop — a content-based trigger,
  which the emitter idiom policy's Gate 3 forbids outright, and unsound for any
  prop the corpus does not exercise, which Gate 4 forbids. Named **IR-8** and
  deferred.
- **Valued `:` / `@` shorthands, and no `.prevent` / `.stop` / `.self`.** Ruled
  by **T005** and adopted by **T006**. This **supersedes T002 ruling 2**, which
  had the emitter shipping longhand `v-bind:` / `v-on:` for as long as
  `docs/emitter-idiom-policy.md` worked example 2 read `DEFERRED`. T005 re-ran
  that entry's six gates against `vue@3.5.40` and split it: **2a** — shorthands
  *with a value* — is `PASS` on all six and therefore **sugar**; **2b** —
  `v-slot` / `#header` — is **DENIED**. T006 flipped all three emission sites.
  Modifiers are untouched by that split and are still not emitted; the gate's
  `no-directive-modifier` policy refuses them. A **value-less** shorthand is
  refused as well — `:key` with no expression is Vue 3.4's same-name form, and
  `directive-carries-value` rejects it in *both* spellings, a hazard T005
  measured to be symmetric rather than created by the adoption.
- **No named slots.** Worked example 2b is **DENIED**, so `#header` / `v-slot`
  is *not* available here: IR-3 carries no named-slot vocabulary, and the
  adopted set is the valued `:` / `@` pair and nothing else. The gate's
  `require-directive-shorthand` policy rejects any other shorthand — `#` and
  `.prop` both — citing 2b by name.
- **`defineProps` array form, `props.x` in the script.** Reactive props
  destructure only stopped being experimental in Vue 3.5; before that
  `const { multiplier } = defineProps(…)` reads the prop once, and S1's
  `computed` re-reads it. IR-4 is deferred, so this lane discharges the version
  corollary by emitting only baseline-safe forms.

## The one thing this emitter does that no other lane needs

Expressions are emitted **verbatim in the template** and **respelled in the
script**. In a Vue template, the compiler resolves identifiers against
`bindingMetadata` — a `ref` is unwrapped and a prop is reached — so the IR's own
spelling is already correct. In `<script setup>` there is no such resolution, so
a prop becomes `props.x` and a `ref` becomes `x.value`.

That respelling is **scope-aware**, because S2 contains a handler-local
`const count` and a component-level `count` ref, and a name substitution would
confuse them. It **refuses** an AST node type it has not been taught rather than
falling through, so an unfamiliar IR expression is a throw at emit time and not
plausible-looking Vue with an unresolved identifier in it.

## Whitespace is measured, and Svelte's answer does not transfer

Vue's SFC compiler defaults to `whitespace: 'condense'`, a **different rule**
from Svelte's. Measured at 3.5.40 through `vue/server-renderer`
(`test/compile-emitted.test.ts`):

| shape | result |
| --- | --- |
| newline between two ELEMENTS | removed |
| a SPACE between two elements, no newline | kept, as one space |
| newline between an INTERPOLATION and text | condensed to one space — `1/2` becomes **`1 /2`** |
| a text child on its own line | condensed — `increment` becomes **` increment `** |
| a lone interpolation child on its own line | safe |

So the emitter breaks a run of children across lines only when **every** child
renders as an element, and inlines the whole run otherwise. Svelte's
newline-inside-the-closing-tag idiom is not needed here and is not used.

`condense-stable-text` in the gate re-checks the *result* rather than the
layout: after condense, no emitted text node may carry leading or trailing
whitespace.

## The arbiter, and the tier that was excluded

The gate runs **both** arbiters: `@vue/compiler-sfc` (parse + `compileScript` +
`compileTemplate`, across `ssr` × `dev`/`prod`, with **errors and tips** required
to be an exact empty set) and **`eslint-plugin-vue`**'s `flat/essential` tier.

`flat/strongly-recommended` and `flat/recommended` are **excluded**, recorded in
`VUE_ESLINT_TIERS_EXCLUDED` with the exact rule ids each one reports on the
shipped corpus and a standing test that re-measures them. They are substantially
a formatter — and the two content-newline rules are worse than noise here:
`vue/singleline-html-element-content-newline` and its multiline twin demand the
layout measured above to produce `" increment "`, which would break the text
observation the e2e lane asserts equal across six frameworks. Those two carry
the exclusion **on their own**. `vue/v-on-style` and `vue/v-bind-style` used to
fire against the shipped longhand; since T006 adopted the shorthands they are
silent, which is a measurement recorded in `VUE_ESLINT_TIERS_EXCLUDED` and
**not** a reason to adopt the tier — the exclusion never rested on them.

Two rules inside the applied tier are omitted, each with a reason in code:
`vue/comment-directive` (measured: it lets emitted markup switch the arbiter off)
and `vue/multi-word-component-names` (it reads the file name, and the file names
are the repo's scenario ids).

## What it refuses to emit

Fail-closed beats untested. Each of these throws with a message naming the
construct and the reason:

- persistence-bearing IR, composition/shared/handle constructs, more than one
  component per artifact
- an early component guard — a `.vue` module has no return statement to guard
- **more than one root template node** — a multi-root `<template>` compiles to a
  Fragment, and a Fragment is server-rendered with `<!--[-->` / `<!--]-->`
  anchors that the e2e lane reads out of the served payload
- a branch arm or `v-for` row that is not exactly one host element, for the same
  reason: `<template v-if>` would introduce that Fragment
- a declared `stopPropagation` — zero instances across all twelve goldens, so the
  alternative is untested dead code
- a declared unconditional `preventDefault` the handler body does not spell
- a prop default value, a prop path with more than one segment, a component local
  that would shadow `props`/`ref`/`computed`
- output of its own that does not compile with an empty diagnostic set

## What T003 did NOT do

No demo, no e2e row, no scaffold — `demos/vue-official` and the fifth row in
`scripts/e2e.mjs` are T004's. The dev-warning sink in this package is the
**test lane's**, not the demo's; T004 stands up its own, and
`app.config.warnHandler` is never set anywhere here because it would suppress the
very console output a downstream sink has to read.
