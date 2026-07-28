# T014 — two stale counts, and the line ordinals that made the last two cards expensive

Three changes, all documentation: the Vue emitter's bare line ordinals are gone from
`docs/emitter-idiom-policy.md`, and the two remaining corpus counts in
`packages/frameworks/vue/src/emitter/index.ts` are replaced — one by a pointer to its derivation,
one by a re-measurement carrying its scope.

**Both counts were re-derived from source before reading T013's receipt or the dispatch text.** Both
derivations agree. The agreement is reported as a result, not assumed as a premise.

---

## 1. The two defects are NOT the same defect

The card was right to insist the note say which each one is, because the repair differs:

| | `stopPropagation` count | SSR HTML count |
|---|---|---|
| shape | **never true** — born false | **true as measured**, phrased as coverage |
| written | `5ca20c7`, corpus held **3** goldens, comment said **twelve** | `5ca20c7`, corpus held **3** goldens, comment said **three** |
| today | substantive zero still holds | measurement still holds, and now covers the whole corpus |
| repair | point at the **derivation**; the comment should not own a size | state the measurement with **its scope**, so the next scenario extends it |

A stale count was once right and drifted. A born-false count was never right, and it survives
*because* the finding attached to it is true — the finding is what lends the number credibility.
Repairing the second as if it were the first (writing a fresher number) rebuilds it.

---

## 2. Measurement one — `stopPropagation` across the goldens

Derived straight off `packages/compiler/test/goldens/`, counting occurrences per file:

| golden | `stopPropagation` | `preventDefault` |
|---|---|---|
| `s1-render-once` | 0 | 0 |
| `s2-keyed-todo` | 0 | 0 |
| `s3-event-form` | 0 | **8** |
| `s4-nested-list` | 0 | 0 |
| `s5-branch-teardown` | 0 | 0 |
| `s6-whitespace-text` | 0 | 0 |
| `s7-form-controls` | 0 | 0 |
| **7 goldens** | **0** | **8** |

**The zero holds.** The fail-closed throw and its `no-stop-propagation` gate row are correct, and
nothing about them moved. Agrees with T013.

**`twelve` never matched this corpus, and that was verified rather than inherited.**
`git ls-tree 5ca20c7 packages/compiler/test/goldens/` returns exactly three files —
`s1-render-once.json`, `s2-keyed-todo.json`, `s3-event-form.json`. The line was written against a
three-file corpus while claiming twelve.

**The replacement states no size at all.** It names
`test/compile-emitted.test.ts`'s `scenarioCorpus()` as the thing that derives the corpus from
`goldens/s<n>-*.json` and **throws on empty** rather than yielding zero rows a green suite would
swallow, and records the re-derivation against a commit. The eighth scenario moves the derivation;
the comment stays true without being touched.

---

## 3. Measurement two — the SSR claim, re-measured before rewording

The card flagged this as lower confidence and required a re-measurement, with an instruction to stop
if it came back **false** rather than merely stale-scoped. It came back **true, and wider than the
sentence claimed**.

Probe (scratchpad, nothing added to the repo): each shipped `packages/frameworks/vue/generated/S<n>.vue`
against a mechanical **longhand twin** — `:x=` → `v-bind:x=`, `@x=` → `v-on:x=`, applied inside the
`<template>` block only — both loaded through `@vitejs/plugin-vue` and rendered by
`vue/server-renderer` `renderToString` at `vue@3.5.40`, with the demo's own props from
`demos/vue-official/src/{App.vue,scenario-props.ts}`. Every respelling asserts it changed the source.

| scenario | shorthands respelled | HTML bytes | shorthand vs longhand | planted control |
|---|---|---|---|---|
| S1 | 1 | 155 | **identical** | differs |
| S2 | 15 | 558 | **identical** | differs |
| S3 | 9 | 522 | **identical** | differs |
| S4 | 13 | 968 | **identical** | differs |
| S5 | 7 | 517 | **identical** | differs |
| S6 | 7 | 560 | **identical** | differs |
| S7 | 18 | 785 | **identical** | differs |
| **7 / 7** | **70** | | **7 identical** | **7 differ** |

Two things about the instrument, both deliberate:

- **The negative control is an attribute rename, not a `.stop` modifier.** T005 M-B already measured
  that the SSR channel is **blind to event-routing changes**; a `.stop` plant would have reported a
  false negative about the probe rather than a true one about Vue. The client-codegen arm is what
  carries the event half of Gate 5, and the reworded comment now says so at the decision site.
- **T005's byte figures are not reproducible today, and that is not a contradiction.** T005 recorded
  S1 155 / S2 561 / S3 521; today S1 is still 155 but S2 is 558 and S3 522 — because those
  *components* changed since `5ca20c7`, not because the equivalence did. A byte figure attached to a
  moving component is the same defect class in miniature, which is why the replacement records the
  **property** and its scope rather than the numbers.

**No stop_if fired.** The claim is not false; it was scope-shaped wrongly.

---

## 4. THE DATE IS NOT A DISCRIMINATOR IN THIS REPO — so scope is pinned to a COMMIT

Worth carrying forward, because it slightly amends the T012/T013 pattern the card asked me to
follow. The card offered two acceptable forms: point at a derivation, or state the measurement
**with its date and scope**.

`git log -1 --date=short 5ca20c7` returns **2026-07-27**, and today is **2026-07-27**. The false
"twelve" and its repair are the same calendar day. **A date would not have distinguished them.** This
lane's history moves in commits, not days, so both replacements pin scope with `81be833` — the tree
they were measured on — and the SSR one names the resolved runtime version as well. A date alone is
the weakest of the three anchors available here.

Preference order the two repairs actually used, strongest first:

1. **A derivation that throws on empty** (`scenarioCorpus()`) — cannot go stale, cannot pass vacuously.
2. **A measurement scoped to a commit plus a resolved version** — falsifiable, and a new scenario
   extends it instead of silently contradicting it.
3. A date. Insufficient on its own here.

---

## 5. The ordinals are gone, and the reason they cost two cards

`docs/emitter-idiom-policy.md` cited the Vue emitter by bare line number in four places. Every one of
them **already named its symbol**, so the ordinal carried no navigational information a reader would
use — while imposing an edit-time line budget on any comment above the cited line.

| was | now |
|---|---|
| `.../vue/src/emitter/index.ts:413` (worked ex. 3) | `propsDeclaration()` in `.../vue/src/emitter/index.ts` |
| `.../vue/src/emitter/index.ts:828` + bare `` `:766` ``, `` `:743` `` (12a) | `renderHost()`, `attributesOf()`, `eventAttribute()` — "all three in that file" |
| `emitter/index.ts:934` throws at `:947` (12a's non-coverage note) | `renderNode` "falls through to a `throw`" |
| `.../vue/src/emitter/index.ts:413` (12b) | `propsDeclaration()` in `.../vue/src/emitter/index.ts` |

**Two bare ordinals the verify grep would have missed were removed too** — `` (`:766`) `` and
`` (`:743`) `` in 12a are Vue-emitter citations that do not match `index\.ts:[0-9]+`. The card's
instruction was to replace each ordinal with the symbol it carries, and those carry
`attributesOf()` and `eventAttribute()`; leaving them would have satisfied the grep and missed the
point.

No worked example was renumbered, restructured or re-scored. No domain figure, verdict or gate score
was touched — only the parenthetical that pointed at a line.

**This is what unblocked the rest of the card.** T013 had to hold its replacement to exactly ten
lines for ten, dropping a clause and compressing provenance, because growing that comment by one
line would have falsified four citations in a file it could not edit. This card removed the
citations first and then wrote both replacements at whatever length the argument needed — the SSR
one grew from four lines to twenty. That is the tax, paid once, made visible by not paying it.

---

## 6. Same defect class elsewhere — REPORTED, NOT WIDENED

Found while grepping; **none was touched**, per the card.

| location | citation |
|---|---|
| `docs/emitter-idiom-policy.md:200` | `packages/frameworks/react/src/emitter/index.ts:1246` |
| `docs/emitter-idiom-policy.md:1489` | `packages/frameworks/react/src/emitter/index.ts:1405-1406` |
| `docs/emitter-idiom-policy.md:528` | `packages/frameworks/vue/src/gate/index.ts:1024` |
| `docs/emitter-idiom-policy.md:583` | `_debug_node-chunk.mjs:8516` and bare `` `:8590` `` (Angular) |
| `docs/emitter-idiom-policy.md:1088` | bare `` `:20` `` |
| `docs/goals/frameless-defects-and-targets-v1/notes/T024-corpus-breadth.md:43` | `.../vue/src/emitter/index.ts:1041-1055` |

Two notes on that list rather than a flat "fix them all":

- **The `vue/gate/index.ts:1024` one is live and exposed.** It is the only remaining ordinal in the
  policy pointing at a file this lane actively edits, so it is the next one to drift.
- **The Angular `_debug_node-chunk.mjs:8516` one is different in kind and should NOT be dropped.** It
  cites a *third-party build artifact* the repo does not control, where a line number may be the only
  stable-ish handle available and the symbol is not the reader's entry point. The rule this card
  applied — "the ordinal buys nothing because the symbol is already named" — does not hold there.
- Board receipts (`docs/goals/frameless-vue-v1/state.yaml:1021`, `:1209`, `:1491`) and prior notes
  carry ordinals too, but those are **dated historical records of where something was**, not live
  navigational citations. They are correct as written and should stay.

---

## 7. Verification

All five gates passed on the **first** attempt.

- `pnpm test` — **989 passed**, 51 files. Exactly the dispatch figure; no test moved.
- `pnpm lint` — 0 warnings, 0 errors.
- `node packages/frameworks/vue/scripts/regenerate.ts && git diff --exit-code -- packages/frameworks/vue/generated` — **clean; no emitted byte moved.**
- the mechanical comment-only filter over the emitter diff — **empty output**. Every added line in
  `emitter/index.ts` is a comment line, shown rather than asserted.
- `grep -nE 'index\.ts:[0-9]+' docs/emitter-idiom-policy.md` — **no Vue emitter hit remains.**

## 8. What was deliberately NOT changed

- **No behaviour, no assertion, no golden, no gate message.** The `stopPropagation` throw, its
  message, and the `no-stop-propagation` gate row are untouched.
- **No worked example renumbered or re-scored**, and no domain figure edited.
- **No fresher bare count written for either.** One points at a derivation; one carries a commit and
  a version.
- **Nothing committed.** The tree carries the two modified files plus this note.
