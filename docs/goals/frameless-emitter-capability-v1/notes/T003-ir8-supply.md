# T003 — Step 1: IR-8 supply (`PropDestructuringEntry.type`)

Measured at `c53c506`, on top of T001's falsification gate and T002's plan validation.

## What landed

`PropDestructuringEntry.type`, an **optional** serialized TypeScript type-node subtree,
supplied at `packages/compiler/src/build.ts` `propsEntries()` from the annotation
`@tsrx/core` already parses onto the props parameter. Two validators were widened to
admit it. One corpus fixture was annotated so the field is not `undefined` in 100% of
the corpus.

`ComponentPropExpression.type` was **NOT** added — struck by T002's F5 and by this
card's first `stop_if`. `ENRICHED_IR_VERSION` was **NOT** bumped: it remains
`frameless-enriched-ir/2`, because an optional field is additive and 37 files carry
that literal.

## The six-lane matrix — RE-DERIVED, NOT INHERITED

Method: plant `type: { type: 'TSStringKeyword' }` on **every** `PropDestructuringEntry`
of **all eight goldens**, then call each lane's real exported `emit()` and compare the
result byte-for-byte against that lane's un-planted output. `resolveModuleSet` measured
the same way on its returned link table. 8/8 goldens per lane, 19 planted entries per
sweep.

**BEFORE the change** (verdict identical across all 8 goldens for every lane):

| consumer                                  | verdict                | detail                                                    |
| ----------------------------------------- | ---------------------- | --------------------------------------------------------- |
| react `src/emitter/index.ts`              | **THROWS**             | `PropDestructuringEntry has unknown semantic field: type`  |
| solid `src/emitter/index.ts`              | **THROWS**             | `PropDestructuringEntry has unknown semantic field: type`  |
| qwik `src/emitter/index.ts`               | ACCEPTS SILENTLY       | output byte-identical, 8/8                                 |
| svelte `src/emitter/index.ts`             | ACCEPTS SILENTLY       | output byte-identical, 8/8                                 |
| vue `src/emitter/index.ts`                | ACCEPTS SILENTLY       | output byte-identical, 8/8                                 |
| angular `src/emitter/index.ts`            | ACCEPTS SILENTLY       | output byte-identical, 8/8                                 |
| compiler `src/module-set.ts` `resolveModuleSet` | ACCEPTS SILENTLY | link table identical, 8/8                                  |

**This reproduces T002's matrix exactly. No difference to report.** The charter's
"ALL validateEnrichedIr copies move in the same slice or EVERY LANE HARD-THROWS" stays
refuted: five of seven consumers never cared.

**AFTER the change**: all six emitters and `resolveModuleSet` return
`ACCEPT — byte-identical`, and a full regeneration of every lane leaves all ten
`generated*/` directories at `git diff --exit-code` = 0.

### The guard fired, and this is where it was hiding

The card's constraint was *"land the field without a validator and watch a lane throw
— a guard nobody has seen fire is not a guard."* It fired, twice, with the message
above. The trap T002 named is real and worth restating:

> **The react emitter's exactness checker is an inline closure named `keys`, defined at
> `packages/frameworks/react/src/emitter/index.ts:219`. It is NOT named `exactKeys`.**
> `grep -c exactKeys` in that file returns **zero**, so every grep-derived survey in
> this phase missed the single file most affected by the change.

Solid's *is* `exactKeys` (`packages/frameworks/solid/src/emitter/index.ts:63`). The two
lanes that break are spelled differently, which is exactly why counting instead of
measuring produced the wrong answer in both directions.

## The corpus was the real blocker, and it is now unblocked

T002's F4, reproduced here before any edit: `buildEnrichedIr` on an annotated
`.tsrx` completed cleanly through Markless lowering **and dropped every type**, because
`propsEntries()` never read the annotation. So the supply channel was intact and simply
unused.

`packages/compiler/test/fixtures/s1-render-once.tsrx` is now the corpus's **only**
annotated module, and its golden is the proof:

| prop         | supplied `type.type` |
| ------------ | -------------------- |
| `label`      | `TSStringKeyword`    |
| `multiplier` | `TSNumberKeyword`    |
| `visible`    | `TSBooleanKeyword`   |
| `onTrace`    | `TSFunctionType`     |

The other seven scenarios stay unannotated **on purpose**: they are the control arm
proving the field is absent when the author wrote nothing, rather than defaulted in.

### A gap in T002's "missing evidence" is now partly closed

T002 recorded that whether a **function type** survives `@tsrx/core -> IR -> six
emitters` was unmeasured, and named it Step 2's risk. The *supply* half is now measured:
`onTrace` arrives with its full signature — both parameters, their own annotations
(including a generic `TSTypeReference` for `Record<string, unknown>`), and the
`TSVoidKeyword` return — all as walkable syntax. Whether six emitters can **print** it
remains open and is still Step 2's risk.

## What the field deliberately does NOT do

Only an **inline type literal** supplies anything. A bare type reference
(`({ label }: Props)`) supplies **nothing**, because its members live in another
declaration and possibly another module — resolving that is cross-module inference,
the "new source" the charter forbids. Same for intersections/unions of literals, and
for rest elements, which have no single member to name them. All four boundaries are
encoded as tests, not just as prose.

The key is `sourceName`, never `localName`: an annotation names the property as the
**caller** spells it, so `({ label: displayLabel }: { label: string })` matches on
`label`. Keying on the local name would have silently supplied nothing for every
aliased prop.

## Types are supplied but NOT PRINTED, and that is not laziness

No emitter prints the type yet, and no emitted byte moved. T001 measured **TS8010** —
a type annotation cannot live in a `.jsx` file — and react/solid/qwik still emit `.jsx`.
Printing is therefore blocked behind the extension + `lang="ts"` migration (T009), which
is why T002 inserted it between Step 1 and Step 2.

## Verification

| command | result |
| ------- | ------ |
| `pnpm test` | 1092 passed / 1 failed (1093). Baseline was 1082/1 (1083); the delta is **exactly the 10 tests this task added** (6 compiler + 2 react + 2 solid). The single failure is the pre-existing, foreign `package-inventory.test.ts` ARM B — same file, same test name, same cause, unchanged. |
| `pnpm check` | exit 0 |
| `pnpm lint` | 0 warnings, 0 errors over 396 files |
| `pnpm check:citations` | clean |
| `pnpm e2e` | PASS — "Three-way: 6 demos x 8 scenarios, all observations equal" |
| `git diff --exit-code` over all 10 `generated*/` dirs | exit 0, **after** regenerating every lane from the moved golden |
| `git status --short` | 9 owned files + exactly the 3 foreign entries |

## Board defect found while reading the card

**The T003 card carries two `allowed_files` keys** — a populated list and, twelve lines
later, `allowed_files: []`. Under last-key-wins YAML the empty one governs, which would
make the task unexecutable; several other cards on this board carry the same trailing
empty key. The populated list is plainly the intended one — the card's own
`allowed_files_provenance` block explains how it was derived by measurement — so it was
used, and the duplicate is reported here rather than silently edited, since the board is
the PM's file.
