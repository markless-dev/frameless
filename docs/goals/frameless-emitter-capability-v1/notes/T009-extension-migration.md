# T009 - Step 1.5, extension + lang migration: PARTIAL

**Result: BLOCKED, with the vue/svelte half delivered and verified.**

Step 1.5 has two independent halves. One landed in full and is proved
behaviour-neutral. The other cannot be executed inside this card's
`allowed_files` and is reported rather than forced.

| half | state |
| --- | --- |
| vue + svelte `lang="ts"` flip | **DONE**, `pnpm e2e` green |
| `.jsx` -> `.tsx` for react/solid/qwik and every referencing file | **BLOCKED** - needs 18 load-bearing files outside `allowed_files` |

They are independent: vue and svelte carry no `.jsx` reference at all, and the
three JSX lanes carry no script-lang attribute. Landing one does not constrain
the other.

## What landed

- The vue emitter emits `<script setup lang="ts">`; the svelte emitter emits
  `<script lang="ts">`. **No type is printed in either.**
- `script[setup,lang=ts]` entered the vue `BASELINE_FORM_INVENTORY` with a
  measured floor - the ruling T010 deliberately left unmade.
- Both lanes regenerated, and the two demo apps' checked-in emitted copies
  refreshed through their own `copy-emitted` scripts.
- Five vue tests re-aimed. The suite count did not move.

## The behaviour-neutrality proof

Regeneration was proved **non-vacuous first** (T003's catch): junk was appended
to `packages/frameworks/vue/generated/S1.vue` and
`packages/frameworks/svelte/generated/S1.svelte`, both lanes regenerated, and
both files came back restored. Only then was the diff trusted.

Normalised diff, both directions: for all 32 changed emitted files (16 in
`packages/frameworks/{vue,svelte}/generated`, 16 in the two demos), normalising
the script open tag on **both** sides leaves **zero** residual difference. The
raw diff is `+32 -32` - exactly one line per file, and that line is always the
script open tag.

`pnpm e2e`: **PASS**, 6 demos x 8 scenarios, all observations equal, plus the
SSR and persistence witnesses. That is the decisive check and it did not move.

### The `defineComponent()` delta, named rather than discovered

T010 handed this over and it reproduces exactly. Measured at
`@vue/compiler-sfc@3.5.40`, `compileScript` on the same SFC:

- without `lang="ts"`: `export default {` ... `setup(__props, { expose: __expose }) {`
- with `lang="ts"`: an added `import { defineComponent as _defineComponent } from 'vue'`,
  then `export default /*@__PURE__*/_defineComponent({` ... same `setup(...)`.

So compiled output genuinely changes. It is runtime-neutral - the wrapper
returns the options object it is handed - and `pnpm e2e` is what actually
discharges that claim rather than the reasoning.

## The floor ruling: `script[setup,lang=ts]`, floor 3.2, `unverified`

Measured against the vue this repo actually resolves, not asserted:

- `vue@3.5.40` and `@vue/compiler-sfc@3.5.40` are what the vue package
  resolves. The vue package ships **no CHANGELOG**, and `@since` appears
  **zero** times across its shipped type declarations. Nothing on disk dates
  this form, which is why the floor is recorded `unverified` - the same footing
  as every other row in that inventory.
- **3.2, because `<script setup>` is the binding conjunct, not `lang`.** A
  `lang` attribute on an SFC script block predates Vue 3 entirely, so it cannot
  raise the floor above the `script[setup]` row it replaces.
- What the pin *does* establish is that the form compiles there: `compileScript`
  accepts `<script setup lang="ts">` over untyped source with an empty
  diagnostic set in all four `COMPILE_MODES`. That is presence at the pin, not
  a floor - exactly what the shorthand row already says of its own citation.

**It REPLACES the bare `script[setup]` row rather than joining it**, on the
reasoning already written into that file for the `:`/`@` shorthands: the
inventory is an allowlist of forms the emitter *may* produce, and after this
step nothing can produce a bare `<script setup>`. Keeping both would permit a
form nothing emits.

## The guards were watched firing

The emitter's attribute was reverted in both lanes, both lanes regenerated, and
the suite re-run:

- **vue: 14 tests went red** - the inventory anti-vacuity pin, the re-aimed
  script-block mutation row, the emitter shape row, the compile oracle
  calibration, and the whole `baseline-form-inventory` mutation family, whose
  mutants are built on the shipped sources.
- **svelte: 0 tests went red.**

Both emitters were then restored and every check re-run green.

### FINDING: the svelte lane is blind to its own script-lang flip

This is why the brief's "sole gate-side blocker" framing is only half the
picture. Vue refused the flip in three places and had to be given a ruling.
Svelte accepted it in complete silence:

- The svelte `BASELINE_FORM_INVENTORY` has no `sfc-block` / script-block kind
  at all, so `checkSources` never observes the script block's attributes. Driven
  through the real gate on S1, S3 and S7, `lang="ts"` produced **zero**
  violations - against vue's one.
- No svelte test pins the emitted script open tag. The four svelte tests that
  mention `<script>` all use it to *construct* synthetic sources.

The gate is not otherwise degraded: the eslint arbiter still fires identically
through `lang="ts"` - an unkeyed `{#each}` mutant drew
`eslint:svelte/require-each-key` both before and after. So this is a missing
detector, not a broken one.

### FINDING: two stale premises now shipping in the svelte gate

`packages/frameworks/svelte/src/gate/index.ts` is **outside `allowed_files`**, so
these are reported, not repaired.

1. `svelte/require-event-dispatcher-types` is omitted partly because the rule
   "returns early unless a `<script lang="ts">` block is present, **which this
   emitter never produces**". That clause is now false. The *conclusion*
   survives on two independent axes the same entry already names - the rule's
   own `svelteVersions: ['3/4']` meta against a 5.56.8 pin, and its need for a
   `createEventDispatcher` call - so this is a dead limb in a correct verdict,
   the exact shape T010 found twice in the vue gate.
2. `svelte/no-unused-props` is omitted as "silent BY CONSTRUCTION" on "plain
   emitted `.svelte`", unblocked by "a tsconfig covering emitted output". The
   trigger is `getTypeScriptTools(context)`, which needs a TypeScript *program*
   rather than merely `lang="ts"`, so the verdict still holds - but the phrase
   "plain emitted `.svelte`" no longer describes what this lane emits.

## The blocked half, measured

**The 93 is close but the actionable set is different in kind.** Re-derived at
this HEAD: `.jsx` appears in **169** tracked files. Excluding `probes/`, `poc/`
and historical goal notes under `docs/goals/` leaves **96 files / 476
reference lines**. Of those 96, **59 are inside `allowed_files` and 37 are
outside**, and **18 of the 37 are load-bearing** - they are not documentation
that goes stale, they are code that stops working:

| file | why it is load-bearing |
| --- | --- |
| `packages/frameworks/react/src/gate/index.ts` | discovery filters on `endsWith('.jsx')`; eslint override is `files: ['**/*.jsx']`; derives `./X.jsx` import specifiers |
| `packages/frameworks/solid/src/gate/index.ts` | same three |
| `packages/frameworks/qwik/src/gate/index.ts` | same three |
| `packages/frameworks/react/scripts/regenerate-composition.ts` | writes `${fixture}.jsx` - the allowlist grants the *output dir* but not the script that fills it |
| `packages/frameworks/solid/scripts/regenerate-composition.ts` | same |
| `packages/frameworks/react/scripts/measure-size.ts` | reads `S1.jsx`..`S3.jsx`; `size.test.ts` depends on it |
| `packages/frameworks/solid/scripts/measure-size.ts` | same |
| `packages/frameworks/solid/vitest.config.ts` | browser project include regex matches `generated(-composition)?/.*\.jsx` |
| `packages/cli/test/program.test.ts` | asserts emitted filenames `button.jsx`, `card.jsx` |
| `packages/cli/test/node-runtime.test.ts` | asserts `output/{react,solid}/*.jsx` on disk and `from './frame.jsx'` |
| `packages/cli/test/receipts.test.ts` | asserts `counter.jsx` |
| `demos/ssr/react-app/src/app.tsx` + `emitted.d.ts` | import CLI output `dist/*/react/*.jsx` |
| `demos/ssr/solid-app/src/app.tsx` + `emitted.d.ts` | same |
| `demos/ssr/calibration-handler-noop-seat.box.ts` | keys on `dist/PricingCard/*/PricingCard.jsx` |
| `demos/ssr/test/fixtures/witness-receipt.json` | records those paths |
| `demos/ui-kit/test/{react,solid}/capture.browser.test.tsx` | import CLI output |
| `demos/ui-kit/test/solid/vitest.config.ts` | include regex on `dist/.*/solid/.*\.jsx` |

`demos/ssr` and `demos/ui-kit` are the sharpest of these: **`pnpm e2e` drives
both**, and both consume the CLI's emitted filename. Changing
`packages/cli/src/program.ts` - which *is* allowed - without them breaks the
step's own decisive check.

**The gate trio is the dangerous one.** Their discovery walk filters on
`endsWith('.jsx')`, so renaming the output to `.tsx` does not make them fail
loudly - it makes them find **zero files**. A gate that has stopped looking is
the silent-hole class this project keeps catching, and it would be introduced by
doing the rename with the allowlist as written.

### One fear measured and REFUTED

The citation guard does **not** couple to generated file paths. Measured
directly: `packages/frameworks/react/generated/S1.jsx` was renamed to `.tsx` and
`pnpm check:citations` exited **0**. Roughly 50 historical goal notes cite
`generated/*.jsx` paths; none of them would need rewriting, and the rename does
not force a ruling about editing the historical record. That fear was real
enough to check and it is not a constraint.

### `format-emitted.ts` is a Step 2 handover, not a Step 1.5 need

`packages/frameworks/{react,solid,qwik}/src/format-emitted.ts` passes the virtual
filename `generated.jsx` to `oxfmt`. Leaving it alone keeps formatting - and
therefore emitted bytes - identical, which is what a no-type-printing step
wants. It is outside `allowed_files` anyway. **Step 2 will need it**: once a type
is printed, a `.jsx` parser is the wrong one.
