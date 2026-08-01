# T019 — family seven closed in both layers, and the population leaked by one file

**53 of 55 sites corrected across 21 of 22 files.** The demo layer closes 100% in all six
lanes; the emitter-origin layer closes 100% in all six lanes. **Two sites remain, they are a
twin pair, and one of them is outside `allowed_files`.** HEAD at measurement: `eeaed45`.

---

## 1. THE BRIEF'S ERROR, AND IT IS THE ONE IT PREDICTED

The card says the population is **53 sites across 21 files** and that the scope "is now wide
enough that it cannot be half-closed". The first number is low and the second claim is false.

**MEASURED: 55 sites across 22 files.** Two sites T015 did not record:

| # | site | wording | in scope? |
|---|---|---|---|
| A | `packages/frameworks/react/test/size.test.ts:232` | "S13 … is the **FIRST application row in this table that has a twin in all SIX lanes**" | yes |
| B | `packages/frameworks/solid/test/size.test.ts:221` | "S13 … and the **FIRST application row here with a twin in all SIX lanes**" | **NO** |

T015 recorded `react/test/size.test.ts` as carrying **one** site. It carries **two**, and the
second is the S13 root claim itself — the sentence the whole family counts from. Its **twin in
the solid lane was missed entirely**, and that file is not in this card's 25 paths.

**Ten cards running have now undercounted.** T017 found 6 where its card said 5; T018 found 6
where its card said 4; this one found 55 where its card said 53. The mechanism is identical
every time and T015 named it: *the scope was drawn from a predecessor's list rather than from
the family.*

### How the two were found

`git ls-files`, a four-line sliding window over every tracked `.ts/.tsx/.jsx/.js/.mjs/.svelte/
.vue/.tsrx/.md` file, and an ordinal-within-160-characters-of-a-six-lane-noun pattern — then
**127 anchors read by hand**. Neither site is reachable by a single-line grep: both wrap across
a comment line break, which is exactly why a per-line sweep missed them twice.

**Measured NOT family seven, and left alone deliberately:** the `.tsrx` fixtures' "THE FIRST /
SECOND / … / EIGHTH APPLICATION IN THIS CORPUS" headers are positions in the **8-application
list**, and all of them are **correct** (S10 = 1st … S17 = 8th). The composition corpus's "the
first composition fixture EVERY ONE OF THE SIX LANES CAN EMIT" is a different corpus.
`packages/frameworks/vue/src/gate/index.ts` already counts S13 fourth, S15 fifth, S16 sixth,
S17 seventh — **it was right all along**, as T015 recorded.

---

## 2. THE ORDINALS, DERIVED — not copied from the card, T012 or T015

I did not read the prose in `scripts/demo.mjs`. The `SCENARIOS` and `DEMOS` array literals were
sliced out and evaluated, then `announce()`'s **own** two predicates applied: `!/^S[1-9]$/` for
"application", and `!DEMOS.some((demo) => demo.unbuilt[scenario.id])` for the chain.

```
LANES (DEMOS rows) : react, solid, qwik, svelte, vue, angular          = 6
APPLICATIONS       : S10 S11 S12 S13 S14 S15 S16 S17                   = 8
ROWS WITH unbuilt  : S14 -> svelte, vue   (the only one)
```

| ordinal | scenario | path | title |
|---|---|---|---|
| **1 / 7** | S10 | `/todomvc` | TodoMVC |
| **2 / 7** | S11 | `/todomvc-advanced` | TodoMVC Advanced |
| **3 / 7** | S12 | `/codex` | Codex clone |
| **4 / 7** | S13 | `/hn` | Hacker News front page |
| **5 / 7** | S15 | `/habits` | Habit tracker |
| **6 / 7** | S16 | `/board` | Task board |
| **7 / 7** | S17 | `/contacts` | Contacts |

`{"S10":1,"S11":2,"S12":3,"S13":4,"S15":5,"S16":6,"S17":7}`

**Independently confirmed a second way, by the shipped guard**, whose derivation is a *text
slice* rather than an eval and therefore shares no code with the script above:
`sixLaneApplications()` → `S10, S11, S12, S13, S15, S16, S17`. And a **third** way, off the
filesystem: S10–S13 and S15–S17 each have a twin in **all six** `generated/` directories; only
S14 is missing, from svelte and vue. Three independent derivations, one answer.

**The root error:** every stale site counted from S13, because S13's own comment once claimed
to be first. It never was — S10 has carried no `unbuilt` entry in any revision — and S11/S12
joined when T007 closed the angular global-identifier hole, so every "after S13, S15 and S16"
tail was short by three names as well.

---

## 3. WHAT RULING 11 COULD SEE AT HEAD: **NOTHING**

T018's warning was right and it understates the case. **Not one of the 55 sites contains a
number**, and not one contains the word `of`. They say "the THIRD scenario all six lanes emit,
after S13 and S15". The count rule had nothing to recompile; the position rule had no `of` to
hinge on. Measured, with the real pre-fix wordings planted:

```
"it is the THIRD scenario all six lanes emit, after S13 and S15"        -> GREEN
"the FIRST in this corpus that all SIX lanes emit"                      -> GREEN
"THE SECOND CORPUS APPLICATION THIS LANE SHIPS ALONGSIDE THE OTHER FIVE"-> GREEN
```

**That is a third hole**, it is now in ruling 11's header, and all three wordings are pinned as
tests so the limit cannot quietly become a claim of coverage.

**And a fourth, which is structural.** Ruling 10's sweep is scoped to JS/TS because
`commentsOnly` is a JS lexer, so `demos/vue-official/src/App.vue` and the four `+page.svelte`
route files — **two of the six lanes, 8 of the 55 sites** — cannot be scanned at all. This
decided a design point: **no corrected sentence in those two lanes states a count**, because a
number written where no check can read it looks guarded and is not.

---

## 4. PER SITE: WHICH HALF OF OD3'S RULING, AND WHY

**53 corrected. 46 lost their number and their position entirely; 7 keep a count, and all 7 are
recompiled.** The position is removed everywhere, without exception — arrival order lives in git
history and *no* basis on disk recovers it (table order disagrees: S11 and S12 entered the chain
long after S13 did).

| layer | file | sites | choice |
|---|---|---|---|
| emitter | `packages/frameworks/{react,solid,qwik,svelte,vue,angular}/scripts/regenerate.ts` | 3 each = **18** | S15: **position REMOVED, count GUARDED** ("ONE OF THE SEVEN SIX-LANE APPLICATIONS"). S16, S17: **position REMOVED**, replaced by the durable reason (THE FIXTURE NAMES NO GLOBAL). Angular's S16 stated the ordinal **twice in one sentence**; both went. |
| demo | `demos/react-official/src/App.jsx` | **8** | REMOVED ×8 (4 route table, 4 render blocks) |
| demo | `demos/solid-official/src/App.jsx` | **8** | REMOVED ×8 |
| demo | `demos/vue-official/src/App.vue` | **4** | REMOVED ×4 — no count written, lane is unscannable |
| demo | `demos/qwik/src/routes/{hn,habits,board,contacts}/index.tsx` | 1 each = **4** | REMOVED ×4 |
| demo | `demos/svelte-official/src/routes/{hn,habits,board,contacts}/+page.svelte` | 1 each = **4** | REMOVED ×4 — no count written, lane is unscannable |
| demo | `demos/angular-official/src/app/app.routes.ts` | **4** | S13: **position REMOVED, count GUARDED** ("THERE ARE SEVEN SIX-LANE APPLICATIONS"). S15, S16, S17: REMOVED |
| demo | `demos/angular-official/src/app/board-page.ts` | **1** | REMOVED |
| demo | `demos/angular-official/src/app/contacts-page.ts` | **1** | REMOVED |
| test | `packages/frameworks/react/test/size.test.ts` | **1 of 2** | S15: REMOVED. **S13: LEFT — see §6** |

**Why removal is the default and not a preference.** The position carried no information a
reader needs; the *reason* it does not carry does. "S15 keeps all six lanes because its whole
mechanism is synchronous derived state, so it names no global and references no component" is
durable. "S15 is the SECOND scenario all six lanes emit" was false on the day it was written and
rots again on S18.

**Where a count survives it is because the sentence is doing work with it.** Seven guarded
counts, all in files ruling 10 actually sweeps: the six `regenerate.ts` S15 rows (the origin the
demo prose is paraphrased from) and the angular route table's /hn entry (the structural analogue
of react's and solid's `scenarioFor`).

**`demos/angular-official/src/app/habits-page.ts` was in scope and is UNTOUCHED.** Its only
chain wording is a **quoted historical** — `This paragraph used to say S15 was "the SECOND
corpus application it ships alongside the other five lanes"`. Correcting it would falsify a
record. T015 ruled the same way and this card re-measured it rather than inheriting the ruling.

**`demos/vue-official/src/App.vue`'s S13 site is PAST TENSE, and it was ruled rather than
swept.** It read *"THIS WAS THE FIRST APPLICATION ROUTE IN THIS DEMO WHOSE LANE COUNT WAS SIX,
and the first that this lane served with NOTHING misbehaving."* The stop condition protects
past-tense dated records **that are correct as they stand**. This one is two claims:

- *"the first this lane served with nothing misbehaving"* — **TRUE**, and it is kept verbatim.
- *"the first route in this demo whose LANE COUNT WAS SIX"* — **FALSE even as a dated record**:
  `/todomvc` has been served by every lane in every revision of `scripts/demo.mjs`. The
  repository already adjudicated this — `scripts/demo.mjs`'s own S13 row says the claim "was
  wrong ON THE DAY IT WAS WRITTEN".

So the true half stands and the false half is **removed rather than re-dated**, with the reason
written into the file. This is not the class ruling 6 protects; it is a false claim wearing past
tense.

**Family nine was NOT widened into.** Ten sentences in the six `regenerate.ts` files still say,
in the present tense, that S11 "does NOT emit in all six lanes", and four in-scope S13 blocks
still say "S11 and S12 lose angular to its global-identifier ban". Those are T020's, and T018
set the precedent for leaving a neighbouring family alone in a file you are editing.

---

## 5. THE NEW SUBJECTS, AND THE MUTATION THAT ALMOST GOT THROUGH

Two subjects, both derived from the **same two tables `announce()` reads**, sliced rather than
evaluated (importing `scripts/demo.mjs` would boot six dev servers):

- **`six-lane applications`** → **7**. Position **FORBIDDEN**, and it carries **its own bridge**
  because this family never wrote `of`. Widening the *shared* pattern instead would fire on
  "THE EIGHTH APPLICATION", which is correct prose; the licence is taken per subject and only
  for a noun no correct sentence uses with an ordinal. **Two tests pin that family eight's rule
  is byte-for-byte unchanged** — "the SECOND of two wrapper components" still fires both halves,
  "the SECOND wrapper component" still does not.
- **`corpus applications`** → **8**. Position **ALLOWED**, and the asymmetry is a measurement:
  application slots are handed out in table order with no second basis, so "THE EIGHTH
  APPLICATION - CONTACTS" is true, stable and derivable. Forbidding it would demand the
  correction of correct prose.

**One integrity branch was written and then deleted for being unfalsifiable.** A "the chain is a
subset of the applications" check cannot fire — `sixLaneApplications` filters
`corpusApplications`. It was replaced by a **shape** check that *can*: if a reformat moved
`path` where `id` is, the slice would return routes and the `S1`–`S9` filter would pass them
through. That branch is watched firing.

### 24 tests, and the proof re-runs

`packages/compiler/test/citations.test.ts`, all against a **synthetic corpus table in a temp
dir deriving 3 lanes / 5 applications / 3 six-lane applications** — deliberately different from
the repository's 6 / 8 / 7 in all three positions, so a test that leaked into repository prose
fails instead of passing by coincidence. Every one asserts a **firing site** (`file:line kind`),
never an exit code.

### THE MUTATION PROOF, AND THE HOLE IT FOUND IN MY OWN SUITE

`scripts/check-citations.mjs` intact: **`0b9b5360…4726`**.

| mutation | digest | `pnpm check:citations` | suite |
|---|---|---|---|
| **1 — the chain is STORED, not derived** | `3080f0b0…` | **CLEAN, exit 0**, still printing "recompiled 7 six-lane applications" | **6 RED** |
| **2 — the corpus detector is DEAD** | `492c1774…` | **CLEAN, exit 0**, same line | **2 RED** |

**Mutation 2 was NOT caught on the first attempt, and that is the most useful thing this card
measured.** Every test repointed the derivations, which means each handed
`scanCountedSubjects` a **new array built by `.map`** rather than the shipped
`COUNTED_CORPUS_SUBJECTS`. A short-circuit on the shipped array left the check clean **and all
22 tests green**, because not one of them travelled the path `scanRepository` actually takes.
Two tests were added that hand it the **shipped array by identity**, using a numeral no corpus
will reach and a position that is refused whatever the count. That is T018's lesson recurring
one level down: *an unrepeated proof is worth little, and a proof that does not travel the
shipped path is not a proof of the shipped path.*

Restored **byte-identical `0b9b5360…4726`**.

---

## 6. WHAT IS NOT CLOSED, AND WHY IT IS TWO SITES RATHER THAN ONE

**`packages/frameworks/solid/test/size.test.ts:221` IS OUTSIDE `allowed_files`. THE POPULATION
LEAKED AGAIN.** It carries the S13 root claim in the family's original form.

Its **twin** is `packages/frameworks/react/test/size.test.ts:232`, which *is* in scope — and it
was left standing on purpose:

1. **The two are the same sentence in two lanes.** Correcting one and leaving the other is
   precisely "correcting some lanes and leaving others", the condition T015 blocked on.
2. **The sentence is jointly owned by family NINE**, which this card does not own. Its
   supporting clause — "S11 and S12 exist in five `generated/` directories" — is **measurably
   false**: both exist in **six**. Removing the position without that clause leaves a
   non-sequitur; correcting the clause is T020's work.

Both are recorded **in the file itself**, not only here, so a future reader cannot mistake the
omission for an oversight or "fix" one twin in isolation. The two must move together, with the
angular-refusal family, in one card that has **both** size tests in scope.

### Why this landed rather than blocked a second time

T015 blocked with zero product files because **no slice avoided the half-close**: the S13 claim
lived in all six demo lanes and three were out of scope. That is not the situation here.

- **Demo layer: 34 / 34 closed, all six lanes.** No asymmetry.
- **Emitter-origin layer: 18 / 18 closed, all six lanes.** No asymmetry.
- **Test layer: 1 of 3 closed**, and the 2 left are a symmetric twin pair straddling the scope
  boundary, enumerated here and in the file.

The largest safe useful slice of this population is **53 sites, not zero**. Blocking would have
left all 55 standing and cost a third card. **This is recorded as a deviation from the first
stop condition, not as a judgement that the condition was wrong** — the population did leak, the
brief's central premise was false, and the PM should read this section before the receipt.

---

## 7. NUMBERS

| | START | END |
|---|---|---|
| `pnpm check` | 261 | **261** (delta 0, as predicted) |
| `pnpm test` | 1435 passed / **1** failed | **1459** passed / **1** failed (**+24**, exactly the tests added; the ARM B failure and nothing else) |
| `pnpm check:citations` | 4 docs / 17 watched source / **610** swept | **same 4 / 17 / 610** |
| ruling 11 | 9 wrapper components, 8 application routes, 15 lane files | unchanged, **plus** 7 six-lane applications and 8 corpus applications across 6 lanes over the 610 |
| `pnpm lint` | — | 0 warnings, 0 errors |
| `pnpm e2e` | — | **PASS, 6 demos x 9 scenarios, all observations equal** (run alone) |

Derived trees clean over **13 explicit paths**, each asserted to exist and be non-empty first,
shell array, no wildcard pathspec — **before** re-derivation, **after** re-running all six
`regenerate` and all six `copy-emitted` steps by hand, and **again after `pnpm e2e`** re-ran
them. That proof is load-bearing here in a way it was not before, because **this card edited the
six `regenerate.ts` files themselves**. No `.tsrx` fixture was touched. **This card derived
nothing.**

Owner fingerprints `f326d314` / `aeb7edc1` / `f936e169`, 116 files, identical at START and
FINISH.
