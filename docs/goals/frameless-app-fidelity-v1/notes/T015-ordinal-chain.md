# T015 — the six-lane ordinal chain: derived, swept, and BLOCKED on scope

**Result: BLOCKED. No product file was edited.** The population is real, it is larger than the
card's `allowed_files`, and every way of slicing it leaks into demo files this card cannot write.

**HEAD at measurement: `57a1f45`.** Every count below was taken at that commit.

---

## 1. The ordinals, DERIVED — not copied from the card, not copied from T012

I did not read the hand-written prose in `scripts/demo.mjs`. I sliced the real `SCENARIOS` and
`DEMOS` array literals out of the file, evaluated them, and applied `announce()`'s own predicate
for "application" (`!/^S[1-9]$/.test(scenario.id)`) and its own predicate for the six-lane chain
(`!DEMOS.some((demo) => demo.unbuilt[scenario.id])`).

```
LANES (DEMOS rows): react, solid, qwik, svelte, vue, angular = 6
ALL SCENARIOS: S1 … S17 = 17
APPLICATIONS:  S10, S11, S12, S13, S14, S15, S16, S17 = 8
ROWS WITH AN `unbuilt` ENTRY IN ANY LANE:
  S14: svelte, vue          <-- THE ONLY ONE
```

**DERIVED CHAIN — application rows with NO `unbuilt` entry in ANY lane:**

| ordinal | scenario | path | title |
|---|---|---|---|
| **1 / 7** | **S10** | `/todomvc` | TodoMVC |
| **2 / 7** | **S11** | `/todomvc-advanced` | TodoMVC Advanced |
| **3 / 7** | **S12** | `/codex` | Codex clone |
| **4 / 7** | **S13** | `/hn` | Hacker News front page |
| **5 / 7** | **S15** | `/habits` | Habit tracker |
| **6 / 7** | **S16** | `/board` | Task board |
| **7 / 7** | **S17** | `/contacts` | Contacts |

`{"S10":1,"S11":2,"S12":3,"S13":4,"S15":5,"S16":6,"S17":7}`

This **independently reproduces** what the card asserted (S13 fourth, S14 the only `unbuilt` row)
without taking it on trust. The dispatch was correct on this point.

**The root error the whole population inherits:** every stale site counts the chain *from S13*,
because S13's own comment used to claim it was the FIRST six-lane application. It was never first
— S10 has carried no `unbuilt` entry in any revision of that table. So S15/S16/S17 are not
2nd/3rd/4th; they are **5th/6th/7th**, and the "after S13", "after S13 and S15", "after S13, S15
and S16" tails are all short by three names each (they omit S10, S11, S12).

---

## 2. MY OWN COUNT versus the card's starting point

The card offered **15 sites across 12 files** as "a STARTING POINT, NOT THE POPULATION". It is a
starting point. My sweep, run across the whole repository rather than the six named lanes, finds:

| band | files | sites |
|---|---|---|
| **A — inside `allowed_files`** | 11 of the 12 | **28** |
| **B — demo layer, OUTSIDE `allowed_files`** | 3 | **6** |
| **C — emitter / test layer, OUTSIDE `allowed_files`** | 7 | **19** |
| **TOTAL FAMILY** | **21** | **53** |

**53 sites across 21 files, against a starting point of 15 across 12.** Eight cards running have
now undercounted; this one would have undercounted by 3.5x if it had trusted its own list.

### Band A — inside `allowed_files` (28 sites, 11 files)

React and Solid each carry the chain **twice**: once in the `scenarioFor` route table and once
again in the per-page render blocks. T014's list named only the render blocks.

- `demos/react-official/src/App.jsx` — **8** (route table: S13 "the first one in this corpus that
  SIX lanes emit", S15 "the second scenario", S16 "the third scenario … after S13 and S15", S17
  "the fourth scenario … after S13, S15 and S16"; render blocks: the same four again for
  `hn`/`habits`/`board`/`contacts`)
- `demos/solid-official/src/App.jsx` — **8** (same doubled shape; its S13 render block reads "the
  FIRST route in this demo whose lane count is SIX")
- `demos/vue-official/src/App.vue` — **4** (S13 "THIS WAS THE FIRST APPLICATION ROUTE IN THIS DEMO
  WHOSE LANE COUNT WAS SIX", plus S15 / S16 / S17)
- `demos/qwik/src/routes/{habits,board,contacts}/index.tsx` — **1 each = 3**
- `demos/svelte-official/src/routes/{habits,board,contacts}/+page.svelte` — **1 each = 3**
- `demos/angular-official/src/app/board-page.ts` — **1** ("THE THIRD CORPUS APPLICATION THIS LANE
  SHIPS ALONGSIDE THE OTHER FIVE, after S13 and S15" → sixth)
- `demos/angular-official/src/app/contacts-page.ts` — **1** ("the FOURTH scenario in this corpus
  that all six lanes emit and ship, after S13, S15 and S16" → seventh)
- `demos/angular-official/src/app/habits-page.ts` — **0 LIVE.** The card put it in scope in case
  the sweep found something. It did not: T014 already corrected this file, and its only surviving
  chain wording is a **quoted historical** "This paragraph used to say S15 was …", which ruling 3's
  logic protects. **Correcting it would falsify a record.**

### Band B — the blocker: three DEMO files carrying the SAME family, outside scope

- `demos/angular-official/src/app/app.routes.ts` — **4 sites.** S13 "is the first corpus
  application that all SIX lanes serve"; S15 "THE SECOND CORPUS APPLICATION THIS LANE SHIPS
  ALONGSIDE THE OTHER FIVE"; S16 "the THIRD scenario this lane ships alongside the other five,
  after S13 and S15"; S17 "the FOURTH scenario this lane ships alongside the other five, after
  S13, S15 and S16". **This is the angular lane's route table — the exact structural analogue of
  the React and Solid `scenarioFor` tables that ARE in scope.**
- `demos/qwik/src/routes/hn/index.tsx` — **1 site.** S13 "the FIRST in this corpus that all SIX
  lanes emit" — **verbatim identical** to the React render-block sentence that IS in scope.
- `demos/svelte-official/src/routes/hn/+page.svelte` — **1 site.** The same sentence again.

### Band C — the emitter and test layer, outside scope (19 sites, 7 files)

- `packages/frameworks/{react,solid,qwik,svelte,vue,angular}/scripts/regenerate.ts` — **3 each =
  18.** Each lane's `MODULES` table says S15 "IS THE SECOND SCENARIO IN THE CORPUS THAT ALL SIX
  LANES EMIT, after S13", S16 "the THIRD scenario all six lanes emit, after S13 and S15", S17 "the
  FOURTH scenario all six lanes emit". These are the **upstream source of the demo-lane wording** —
  the demos paraphrase them. Correcting the demos alone leaves the origin stale.
- `packages/frameworks/react/test/size.test.ts` — **1.** "S15 is the SECOND scenario in the corpus
  that all six lanes emit".

**Measured NOT stale, worth recording so nobody re-opens it:** `packages/frameworks/vue/src/gate/index.ts`
counts S13 as "THE FOURTH WHOLE APPLICATION", S15 the "FIFTH", S16 the "SIXTH" and S17 the
"SEVENTH". **That is the derived chain, exactly right.** One file in the repo already counts this
correctly, and it is the one nobody thought to check.

---

## 3. WHY THIS IS BLOCKED AND NOT A PARTIAL LANDING

`allowed_files` was drawn from T014's list, and T014's list was drawn from a partial sweep. The
scope is therefore **three demo files short of its own population**. Two `stop_if` conditions fire
together, and the second is the one the card exists to enforce:

**(a) "Need files outside `allowed_files`."** Band B is required to close the demo layer.

**(b) "About to half-close this population — correcting some lanes and leaving others."** The S13
root claim lives in **all six lanes**. React, Solid and Vue are in scope. Qwik, Svelte and Angular
are not. Editing the twelve would correct S13 in three lanes and leave it standing in three —
*correcting some lanes and leaving others*, the exact wording of the stop condition.

**And it would be worse than uniform staleness inside one lane.** `board-page.ts` and
`contacts-page.ts` are in scope; `app.routes.ts`, the angular route table that dispatches to both,
is not. A twelve-file edit leaves the angular lane **internally self-contradicting**: its route
table would say S15 is the second six-lane application while the component that route mounts says
it is the fifth. A reader can currently trust that the angular lane is consistently wrong. After a
half-close, they could trust neither line.

**No slice avoids this.** I checked the two natural partitions:

- **By lane** — blocked: qwik, svelte and angular each have a band-B file.
- **By scenario** — also blocked. S13's claim needs qwik `hn`, svelte `hn` and angular
  `app.routes.ts`. S15, S16 and S17 each need angular `app.routes.ts`. There is no scenario whose
  sites are wholly inside scope.

So the largest safe useful slice of *this population* is **zero product files**, and the useful
work this card can actually deliver is the derivation and the census above.

---

## 4. THE EIGHTH FAMILY — asked for explicitly, and it EXISTS

The dispatch asked whether an eighth stale-record family exists and to characterise its size
rather than manufacture one. **It exists, it is small, and I found it inside `allowed_files`.**

**FAMILY 8 — "the Nth of M wrapper components in this lane", `demos/angular-official/src/app/*-page.ts`.**

There are **eight** `*-page.ts` wrapper components in that directory (`board`, `codex`, `contacts`,
`habits`, `hn-item`, `hn`, `todomvc-advanced`, `todomvc`). Six of them open with an "Nth of M"
header, and **five of the six denominators are stale**:

| file | says | M should be |
|---|---|---|
| `todomvc-page.ts` | "the SECOND of **two** wrapper components" | eight |
| `hn-page.ts` | "the THIRD of **three** wrapper components" | eight |
| `hn-item-page.ts` | "the FOURTH of **the** wrapper components" | (no denominator) |
| `board-page.ts` | "the FIFTH of **five** wrapper components" | eight |
| `contacts-page.ts` | "the SIXTH of **six** wrapper components" | eight |
| `habits-page.ts` | "the SIXTH of **EIGHT** wrapper components" | **correct — T014 fixed it** |

The numerators rot too. Ordered by the route table, `board-page` is the **seventh** wrapper and
`contacts-page` the **eighth**; they claim fifth and sixth. And `contacts-page.ts` claiming "the
SIXTH of six" **directly contradicts** `habits-page.ts` claiming "the SIXTH of EIGHT" — two files
in one directory both claiming the sixth slot.

**Size: 5 stale sites across 5 files. Two of those files are in `allowed_files`
(`board-page.ts`, `contacts-page.ts`); three are not (`todomvc-page.ts`, `hn-page.ts`,
`hn-item-page.ts`).** So family 8 is *also* split by this card's scope, and closing only its
in-scope half would reproduce the same half-close.

**The generating mechanism, which is the part worth acting on:** every one of these was written as
**"the LATEST of N"** at the moment its file was created — "fifth of five", "sixth of six", "third
of three". They were true when written and self-falsify on the next file added. That is the same
mechanism as the chain ordinals: **a count derived at authoring time and frozen into prose.**

---

## 5. A NINTH FAMILY, PARTLY OPEN — "the angular emitter refuses S11/S12"

Not asked for, found while separating claim families, and reported because T014's own note records
this family as having had 25 sites of which a predecessor named only 16.

`scripts/demo.mjs` states that its now-empty `unbuilt` map "was the last **executable** thing in
the repo still saying angular refuses them". **That sentence is precisely true and I am not
disputing it** — the word *executable* is load-bearing. But the non-executable record is not clean:

- `packages/frameworks/{react,solid,qwik,svelte,vue}/scripts/regenerate.ts` — each states, in the
  **present tense**, that S11 "does NOT emit in all six lanes — the angular emitter refuses it on
  its global-identifier ban" and that S12 "is the SECOND scenario the angular emitter refuses".
  **10 sites.**
- `packages/compiler/test/enriched-ir.test.ts` — "It is the SECOND fixture the Angular emitter
  refuses". **1 site.**
- In-scope collateral: the S13 render blocks in React, Solid, Qwik and Svelte each say "S11 and S12
  **lose angular** to its global-identifier ban" in the present tense. **4 sites**, two of them
  inside `allowed_files`, and they sit in the very sentences this card would have rewritten.

**Measured already closed:** `demos/shared/todomvc-app-css/README.md` quotes the old claim and
marks it false. React's and Solid's `App.jsx` route tables do the same for S11.

**Size: ~15 live sites, none in `allowed_files` except the four collateral clauses.**

---

## 6. IS THE RECORD CONVERGING?

Asked directly, so answered directly: **no — not yet, and the shape of the evidence says why.**

Seven populations were found by seven cards, each by sweeping a claim family its predecessor had
not looked at. This card looked at an eighth family and **found two more** (families 8 and 9),
both live, both split across the scope boundary. That is not the signature of a record with a few
remaining pockets.

**The mechanism is consistent across all of them, and it is one mechanism, not nine.** Every stale
family is a **count or an ordinal derived from a table at authoring time and then written out by
hand into prose**, in a file that no check recompiles:

- the six-lane chain position — derived by `announce()`, hand-written everywhere else;
- the wrapper-component count — derived by `ls`, hand-written in six headers;
- the angular refusal — derived by `unbuilt`, hand-written in eleven comments;
- and `scripts/demo.mjs`'s own header still warns that its `S1-S9` / `S10-S17` ranges "ARE
  HAND-WRITTEN AND BOTH HAVE GONE STALE BEFORE".

**So the honest read is: the record is systematically stale in a single, identifiable way, and
sweeping families one at a time will keep finding them.** Each sweep costs a card and closes one
family; the generator keeps producing new ones every time a row is appended.

**What would actually converge it** — offered as a finding, not as a decision this card may take:

1. **Stop writing derivable counts in prose.** Where a comment can state the *fact* without the
   fragile position, it should. "S15 keeps all six lanes because it names no global and references
   no component" is durable; "S15 is the SECOND scenario all six lanes emit" rots the day S18
   lands. **This is what verify item 3 asked for, and it is the right instruction — a successor
   should apply it rather than write freshly-derived-but-still-hand-written ordinals.**
2. **Where a count is genuinely load-bearing, make it a check**, the way
   `scripts/check-citations.mjs` made citation ordinals a check after four cards had hand-corrected
   them and T048 measured that five of eight had already re-drifted. The precedent is in the tree
   and its own header argues exactly this case.
3. **Scope the closing card to the family, not to a predecessor's list.** Every one of the eight
   undercounts, including this card's, came from inheriting the previous card's quoted sites as the
   population.

---

## 7. What was and was not run

No product file was edited, so nothing could regress. `pnpm check` was measured to confirm the
board's stated baseline is still the baseline; `pnpm lint` and `pnpm check:citations` were run
because this note is a prose edit. `pnpm test` and `pnpm e2e` were **not** run: with an empty
product diff they measure the previous commit, not this card, and `pnpm e2e` would occupy the six
demo ports for no evidence. Recorded as a deviation rather than quietly skipped.

The owner's three dirty paths were fingerprinted at START and FINISH and are unchanged.
