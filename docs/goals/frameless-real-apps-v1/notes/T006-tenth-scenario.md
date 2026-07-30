# T006 — the tenth scenario closes `pnpm test`, and two defects are recorded

`pnpm test` at dispatch: **1250 passed / 10 failed**. At finish: **1250+ passed /
1 failed**, the remaining one being the **foreign** `package-inventory` ARM B
caused by the owner's uncommitted lockfile. Nine were S10's.

## The census was RE-DERIVED, not renumbered

The card's hardest item was `packages/frameworks/vue/src/gate/index.ts`, a lane
policy source whose **shipped refusal text** asserts a live census. The stop_if
was explicit: do not edit the numbers to fit.

I re-derived both domains with my own script rather than reading the numbers out
of the failure text, walking the emitted templates with `@vue/compiler-sfc` and
the goldens with `JSON.parse` — the same definitions `test/gate.test.ts` uses,
re-implemented independently so agreement means something:

| figure                          | nine-scenario | ten-scenario | S10's share |
| ------------------------------- | ------------- | ------------ | ----------- |
| 12a domain instances            | 8             | **12**       | +4          |
| 12a instances the sugar reaches | 1             | **3**        | +2          |
| 12a instances outside the sugar | 7             | **9**        | +2          |
| 12b printed prop entries        | 21            | **22**       | +1          |
| 12b distinct prop names         | 7             | **7**        | +0          |

The PM's brief predicted "TWELVE and THREE" and it was right.

### The re-argument, which is the part that mattered

A moved number is not a moved ruling. Three things were re-checked:

1. **The verdict.** Gate 4 `FAIL`s when the sugar "applies only to a recognized
   subset of the domain as stated". **3 of 12 is still a proper subset**, so the
   verdict is unchanged on the same criterion.
2. **The stated reason.** The message says the others are outside the sugar's
   reach "because they call `props.onTrace(...)`". Re-derived over all **nine**
   outside handlers: **every one still calls `onTrace(`**. The reason survives
   the tenth scenario as well as the counts do.
3. **The direction the ruling moved — and it moved TOWARD denial.** The repair
   narrowing recorded against 12a (handlers whose declared `writes` is exactly the
   bound node, `reads` empty, no `syncPolicy`) had a domain of **one** shipped
   instance. Measured off the goldens it now has **three**: S2 `event:0`, S10
   `event:2`, S10 `event:6`. So the Gate 3 unsoundness — the right-hand side is
   never checked — is reachable on three shipped handlers instead of one. **A
   candidate sugar whose correct cases triple while staying a minority has not
   moved toward totality; it has widened the surface on which it would be wrong.**

12b was re-measured too, and its `ZERO` survived a real application: S10 declares
exactly one printed entry (`onTrace`, a name the corpus already had, which is why
the distinct-name figure did not move) and its `prop:props` node is still
`writable=false` with zero writes. A whole app was the strongest available chance
for a written-back prop to appear and none did.

## The calibration row hit the exact hazard its own comment described

`CALIBRATION: the derived domain figures go RED against a planted tenth scenario`
planted `s10-planted-calibration.json` plus `S10.vue` into a copy of the corpus.
Its header already warned, about the *previous* move from S8 to S10, that a plant
reusing a real ordinal "would be COPIED OVER by the faithful-copy loop and counted
twice, once per golden mapping to the same emitted file".

That is precisely what happened. Both `s10-todomvc.json` and
`s10-planted-calibration.json` mapped to `generated/S10.vue`, whose bytes the
plant had just overwritten, so the derivation counted **10** where it should have
counted **13** — the row failed on its own scaffolding.

**Naming the next free number is the same defect with a bigger literal.** The
ordinal is now **derived** as one past the highest scenario the corpus holds, with
two anti-collision assertions (the golden slot is free, the emitted file does not
exist). An eleventh scenario moves the plant without touching this file.

## The four mechanical files, and the two claims in them that were wrong

- `react/test/size.test.ts` — S10 row, **275 / 1262**.
- `solid/test/size.test.ts` — S10 row, **304 / 1299**.
- `solid/test/emitted-typecheck.test.ts` — two accepted rows, both the **same**
  `attr:value` producer (open finding 002) S2 and S3 already carry, reaching S10
  through TodoMVC's two distinct text inputs.
- `angular/test/emitter.test.ts` — `typedInputsSeen` **6 → 7**; S10 is the third
  annotated module after S1 and S8, declaring one prop and declaring it typed.
  `untypedInputsSeen` holds at 15.

Two comments I drafted were **refuted by my own measurement before shipping**, and
both would have been plausible:

- I wrote that S10's solid-over-react gap "is larger than S2's and S4's put
  together". True on lines (29 > 11), **false on nodes** (37 < 39).
- I attributed solid's premium to its per-computed accessor arrows, as S7's row
  does. **Refuted**: S10 declares **four** `computed` against S7's **five**. The
  row now records the measurement and explicitly declines to name a mechanism its
  own corpus contradicts.

The angular comment's denominator was **already stale before this card**: it read
"seven of the eight scenarios" while the corpus held nine. Now seven of ten — the
numerator surviving is a coincidence of S10 declaring exactly one typed prop.

## The two defects, and why one of them is not a new entry

**Entry 15 (new) — a two-word DOM event name is unspellable in all six lanes.**
Source-verified: `jsxEventName` in `packages/compiler/src/build.ts` accepts `/^on[A-Z]/` and
then returns `name.slice(2).toLowerCase()`, so the word boundary is destroyed
**in the compiler**, before any emitter sees it. React's event-prop naming in
`packages/frameworks/react/src/emitter/index.ts` can then only produce `onKeydown`. T002 measured the
consequence at `react-dom@19.2.3`: `onKeydown` and `onDblclick` **never fire**.
`dblclick` and React's `onDoubleClick` share no stem, so a per-lane spelling map
is required.

**Defect (b) is NOT new — it is entry 8, and I filed it as 8.1.** The board asked
me to record "React silently miscompiles a state write nested inside an `if`" as
one of two new defects. **Entry 8 already documents that exact mechanism**
(`emitMutableHandler` iterating `fn.body.body`, the write printed as an assignment
to the `const` from `useState`, `TS2588`, five other lanes correct). Filing it
again would have duplicated the ledger.

The genuinely new fact is sharper and worse: **entry 8's shipped refusal does not
cover the `if` form.** `assertLowerableWrites` refuses only when an ancestor is in
`NESTED_FUNCTION_TYPES` — `ArrowFunctionExpression`, `FunctionExpression`,
`FunctionDeclaration`, `ObjectMethod`, `ClassMethod`. A write inside `if (c) { … }`
passes only `BlockStatement` and `IfStatement`, so `nested` stays `null`, the loop
hits `if (!nested) continue;`, and **nothing refuses it** — while
`emitMutableHandler`, iterating top-level statements only, still fails to lower
it. Not lowered, not refused. Entry 8's containment claim, and this ledger's
standing table, both said "contained" without that qualification; both now say
what the predicate actually enforces.

**Entry 16 — the `<button>` title, adjudicated NOT A DEFECT.** The board left this
to my judgement. The emitter is not unable to print a `<label>`; the **Svelte gate
refuses** the canonical markup as `a11y_label_has_associated_control` and the
`<span>` alternative as `a11y_no_static_element_interactions`. Both refusals are
correct — canonical TodoMVC's clickable label with no associated control is the
anti-pattern. Ruling it a defect would mean asking an emitter to reproduce an
upstream a11y fault because a stylesheet assumed it.

## What I did NOT do

No emitter was repaired. Entry 15 and entry 8.1 are recorded only. The
`if`-nested repair card owes a **planted fixture driven through `emitOrRefuse`**
beside the existing `nested-then` / `nested-callback` rows — my evidence for 8.1
is the emitter source plus T002's observation, and 8.1 says so rather than
implying a measurement nobody took.

## An incidental finding, outside this card

`packages/frameworks/react/src/emitter/index.ts` contains **one NUL byte**, as a deliberate composite map-key separator inside `segmented()`:

```ts
`${segmentOf.get(statement) ?? 0}\0${variable}`
```

It is committed and intentional. Its unintended consequence is that **`grep`
treats the whole 4306-line file as binary and reports no matches for anything** —
`grep -c import` on it exits 1. Every grep-based sweep of this repo, human or
scripted, is silently blind to the entire React emitter. I only found the nested
-write guard by falling back to Python. Not filed in `DEFECTS.md` (it is not
emitted output) and not repaired (out of envelope), but it is worth a card.

## Protected paths

Owner fingerprints identical at start and finish: `f326d314` / `aeb7edc1` /
`f936e169`, `website/` 116 files, digests sorted.
