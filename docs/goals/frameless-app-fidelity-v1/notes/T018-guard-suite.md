# T018 — the guard's red-capability becomes a test, and family eight closes

T017 proved ruling 11 red-capable **once, by hand, into a note**. This card made that proof
**re-runnable**, deleted the three `ANGULAR_COUNT_NOT_SCANNED` exemptions, and corrected the
sites behind them. HEAD at measurement: `b70b31e`.

---

## 1. THE BRIEF CONTAINED AN ERROR, AND IT IS ITS CENTRAL PREMISE

The card says the four recorded sites are reached **"the moment the exemptions are deleted —
no new code"**.

**MEASURED: deleting the three exemptions reaches the FILES but the detector fires on only
TWO sites, and NEITHER of the two `app.routes.ts` sites the card names is one of them.**

Run at `b70b31e` with only the exemption list emptied and no other change:

```
demos/angular-official/src/app/app.config.ts:12:51  three wrapper components   [stale-derived-count]
demos/angular-official/src/app/app.routes.ts:96:20  SECOND OF TWO ROUTES HERE THAT GO THROUGH A WRAPPER
                                                    [underivable-position]  <- only after the widening below
demos/angular-official/src/app/app.routes.ts:31:22  three wrapper components   [stale-derived-count]
```

At T017's exact spelling only the two `three wrapper components` sites fired. Three of the
four sites the card names are **prose the guard cannot see**, and one site that fires is a
site **no prior card recorded at all**.

## 2. MY OWN SWEEP — SIX SITES IN THREE FILES, AGAINST THE CARD'S FOUR

Read from the files, not from the check.

| # | site | wording | recorded before? | guard sees it? |
|---|---|---|---|---|
| 1 | `app.routes.ts:31` | "keeps this lane free of **three wrapper components** that exist only to spell `[label]="'kit'"`" | **NO — found by this card** | yes |
| 2 | `app.routes.ts:74` | "S8 is **the one route with a WRAPPER component**" | yes | **no — hole 1** |
| 3 | `app.routes.ts:96` | "IT IS **THE SECOND OF TWO ROUTES HERE THAT GO THROUGH A WRAPPER**" | yes | only after the widening |
| 4 | `app.config.ts:12` | "instead of through **three wrapper components**" | yes | yes |
| 5 | `async-gate.ts:7` | "**the ONE route in this lane that needs a wrapper component at all**" | as one site | **no — hole 1** |
| 6 | `async-gate.ts:11` | "which is what **keeps this lane free of wrappers**" | as one site | **no — hole 2** |

**Six, not four.** Site 1 is entirely new — it is in `app.routes.ts`, which T017 exempted for
two *other* sentences, so it sat inside a recorded exemption without being recorded.
`async-gate.ts` carries **two** stale claims, not one: a stale count and a stale claim of
**zero**.

All six are corrected. Nothing was weakened to make a site pass.

## 3. THE WRAPPER COUNT, DERIVED INDEPENDENTLY — **NINE**

Not copied from the card or from T017's receipt. `readdirSync` over
`demos/angular-official/src/app`, keeping files that contain `@Component(` **and** an import
from `../emitted/`:

```
async-gate.ts  board-page.ts  codex-page.ts  contacts-page.ts  habits-page.ts
hn-item-page.ts  hn-page.ts  todomvc-advanced-page.ts  todomvc-page.ts     = 9
```

Application routes, from the lane's own table minus the `['s1'..'s9']` three-way contract:
`todomvc, todomvc-advanced, codex, hn, hn-item, habits, board, contacts` = **8**. Both agree
with T017. The two decoys the definition must reject are asserted in the suite: `app.ts`
declares a component and mounts nothing emitted; `app.routes.ts` imports emitted components
and declares none.

**The route ratio is worth recording, because it is what makes the old prose false in the
plainest way: of 17 routes, 8 go straight to an emitted component and NINE go through a
wrapper.** Any sentence beginning "most routes here need no wrapper" is already false.

## 4. THE ONE DETECTOR CHANGE — A NOUN WIDENING, MEASURED

`wrapper components?` → `wrappers?(?:\s+components?)?`.

This lane calls the same thing "a WRAPPER" as often as "a wrapper component", and site 3 —
**the sentence T017 cited as its EVIDENCE that the denominator is nine** — was invisible for
exactly that reason. Blast radius measured across **all 15 `.ts` files of the lane before any
prose was edited: zero new findings** beyond site 3.

**It is a strengthening, never a loosening.** No site was made to pass by relaxing anything.

**It cost one of my own sentences, and that is the strongest thing I can say about it.** A
replacement paragraph I wrote read "`./habits-page.ts` carries **the one wrapper** count this
lane states", and the widened detector went red on it — reading "one wrapper" as a claim of
ONE. **I changed my prose, not the rule.**

## 5. THE TWO HOLES THAT STAND — RECORDED, NOT GLOSSED

Both are written into ruling 11's own header and pinned as tests, so neither can be mistaken
for an oversight.

**HOLE 1 — a number attached to ROUTES cannot be read as a number of WRAPPERS.** Sites 2 and
5 both count *routes that need a wrapper*. Letting the number float up to 40 characters from
the noun — the licence the POSITION rule already takes — would catch them **and would fire on
"one of this lane's wrapper components", which is the exact sentence T017 wrote into five
files AS THE FIX.** The guard would red-flag its own remedy. The tight rule stands; a test
asserts the remedy text stays green, and another asserts sites 2 and 5 stay invisible.

**HOLE 2 — a count of zero spelled in English is not a number.** "keeps this lane free of
wrappers" asserts the count is nought. It was wrong by nine. There is no numeral in it.

**Both were found by READING THE FILES, NOT BY RUNNING THE CHECK.** That is the honest
statement of the instrument: ruling 11 makes a stated NUMBER re-derivable. It does not make
prose true.

## 6. THE SUITE — 23 TESTS, AND THEY ARE NOT VACUOUS

`packages/compiler/test/citations.test.ts`, all eight of T017's plants plus fifteen more.
Every one asserts the **firing site** — `file:line kind` — never an exit code.

**None of them reads repository prose.** The stale wordings are fixtures; the NUMBERS come
from a **synthetic nine-wrapper, eight-route lane built in a temp dir**, with the *shipped*
subjects repointed at it. So the day a card corrects a comment in `demos/angular-official`,
or lands a tenth wrapper, not one of these tests moves.

| block | tests | what it pins |
|---|---|---|
| the six real wordings | 7 | each of T017's six sites, at `:6`, plus the route-count plant |
| negative controls | 5 | quoted historical **paired with its unquoted twin**; wrapped-across-lines; correct counts; T017's remedy text; family seven untouched |
| the deleted exemptions | 5 | scope is now 15 files; the bare noun; **both holes** |
| the derivation is live | 2 | a tenth wrapper + a ninth route turn green prose red; the two decoys are rejected |
| anti-vacuity | 4 | emptied lane; moved lane; **a dangling exemption**; the quote lexer failing towards red |

`ANGULAR_COUNT_NOT_SCANNED` is now `[]`. It stays as an empty, reason-bearing seam, and
because a loop over nothing passes forever, `angularCountIntegrityProblems` now takes its
lane, exemptions and subjects as arguments — the same shape `foreignShadowProblems` and
`emitterClassificationProblems` already had — **so the suite hands it a dangling exemption and
watches that branch fire.**

## 7. THE MUTATION PROOF — THE WHOLE POINT OF THE CARD

`scripts/check-citations.mjs` intact: **`45cf338f…f22b`**.

**MUTATION 1 — the detector returns nothing.** `scanAngularCounts` short-circuits to `[]`.
Digest **`ed33510e…37e1`**.

```
pnpm check:citations  ->  CLEAN. "recompiled 9 wrapper components and 8 application
                          routes and agreed with the prose in 15 file(s)."  EXIT 0
pnpm test             ->  13 of the 23 new tests RED
```

**The check certifies the tree while its detector is dead. That is the failure this card
exists to prevent, and it is now caught by the suite instead of by nobody.**

**MUTATION 2 — the count is STORED instead of derived.** `angularWrapperComponents` returns a
literal nine-element array. Digest **`86805b18…5a1a`**. This is the subtler regression: the
guard still *says* nine and still passes.

```
pnpm check:citations  ->  CLEAN, and still prints "recompiled 9 wrapper components"
pnpm test             ->  3 RED: the tenth-wrapper liveness test, the decoy-rejection
                          test, and the emptied-lane anti-vacuity test
```

**RESTORED byte-identical: `45cf338f…f22b`**, `pnpm test` 1435 passed / 1 failed, the ARM B
failure and nothing else.

## 8. NUMBERS

| | START | END |
|---|---|---|
| `pnpm check` | 261 | **261** (delta 0) |
| `pnpm test` | 1412 passed / **1** failed | **1435** passed / **1** failed (**+23**, the tests added) |
| `pnpm check:citations` | 4 docs / 17 watched source / 610 swept, **0.461 s** | same 4 / 17 / 610, **0.463 s** |
| ruling 11 scope | 12 lane files | **15** lane files |
| `pnpm e2e` | — | PASS, **6 demos x 9 scenarios, all observations equal** |
| `pnpm lint` | — | 0 warnings, 0 errors |

Derived trees clean over **13 explicit paths**, each asserted to exist and be non-empty first
(16–17 files each), shell array, no wildcard pathspec — before **and after** `pnpm e2e`
re-ran the six regenerate and six copy-emitted steps. **This card derived nothing.**

Owner fingerprint `f326d314` / `aeb7edc1` / `f936e169`, 116 files, identical at START and
FINISH.

## 9. WHAT THIS DOES NOT CLOSE

- **Family seven (53 sites / 21 files) and family nine (~15 sites)** — T019's and T020's. A
  test asserts ruling 11 does **not** fire on family seven's wordings, so this card is
  measured not to have leaked into them.
- **A STALE COUNT IN A FILE THIS CARD EDITED, LEFT DELIBERATELY.** `app.routes.ts:25` says
  "**the five components below are frameless-emitted**". There are **eight** `../emitted/`
  imports in that file. It is a count of EMITTED COMPONENTS — **not family eight** — so
  correcting it here would be widening into a population another card owns and would put a
  hand-written number back into prose with no derivation behind it. Recorded, untouched.
- **The two holes in §5.** Neither is closable by widening a regex without breaking the
  remedy text.
