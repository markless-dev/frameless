# T017 — the count guard, and the denominator the board had wrong

OD3, verbatim: **"Make it a check"**. This card built it, proved it red against the real
pre-fix wording, and adopted it across the whole of family eight.

---

## 1. THE BRIEF CONTAINED AN ERROR, AND IT IS THE CENTRAL ONE

The card, the board and T015 all say **EIGHT wrapper components exist** in
`demos/angular-official/src/app/`, and read `habits-page.ts`'s "the SIXTH of EIGHT" as the
CORRECT value that `contacts-page.ts`'s "SIXTH of six" contradicts.

**There are NINE, and `habits-page.ts` was stale too.** `async-gate.ts` is a wrapper
component in this lane, and the lane's own source is what says so — three independent
statements, none of them mine:

- `app.routes.ts`, at the `s8` route: *"S8 is the one route with a WRAPPER component …
  See `./async-gate`."*
- `app.routes.ts`, at the `todomvc` route: *"AND IT IS THE SECOND OF TWO ROUTES HERE THAT
  GO THROUGH A WRAPPER."* — /todomvc is the second, so `async-gate` is the first.
- `todomvc-page.ts`: *"The precedent for a wrapper in this lane is `./async-gate.ts`."*

That third statement is decisive on its own: `todomvc-page.ts`'s own numerator, "the
SECOND of two", is only coherent if `async-gate.ts` is number one. Every denominator in
the family counted `*-page.ts` files and silently dropped the wrapper that started the
pattern.

**Why it matters more than being off by one.** The denominators had drifted apart because
**the population had never been defined anywhere a machine could read it**. Two files four
apart said SIXTH of six and SIXTH of EIGHT because they were counting different things, and
nothing in either sentence said which. That is the finding that decided the shape of the
guard: the fix is not a better number, it is a **definition in code**.

---

## 2. MY OWN SWEEP OF FAMILY EIGHT — 6 SITES / 6 FILES, NOT 5 / 5

Enumerated from the filesystem, not from prose. `@Component` + an import out of
`../emitted/` gives the population; `readdirSync` gives the files.

### Live stale sites, all inside `allowed_files` — ALL SIX CLOSED

| # | file:line at HEAD 20738a6 | wording | verdict |
|---|---|---|---|
| 1 | `board-page.ts:7` | "the FIFTH of five wrapper components in this lane" | position + count stale |
| 2 | `contacts-page.ts:7` | "the SIXTH of six wrapper components in this lane" | position + count stale |
| 3 | `habits-page.ts:7` | "the SIXTH of EIGHT wrapper components in this lane" | position + count stale (**8 ≠ 9**) |
| 4 | `hn-item-page.ts:6` | "the FOURTH of the wrapper components in this lane" | position stale, no denominator |
| 5 | `hn-page.ts:8` | "the THIRD of three wrapper components in this lane" | position + count stale |
| 6 | `todomvc-page.ts:7` | "the SECOND of two wrapper components in this lane" | position + count stale |

Against T015's **5 sites / 5 files** this is **6 sites / 6 files**, and site 3 is the one
T015 read as correct. Eight cards running have now undercounted.

### Sites that are CORRECT and were deliberately NOT touched

| file:line | wording | why it stands |
|---|---|---|
| `habits-page.ts:8` (HEAD) | `This line used to read "the FOURTH of four"` | **QUOTED HISTORICAL.** Preserved verbatim; the guard is proven not to fire on it. |
| `habits-page.ts:19` | "THIS LANE'S EIGHT APPLICATION ROUTES" | count **correct**; derived = 8. Kept and now machine-checked. |
| `habits-page.ts:40` | "all EIGHT application routes — /todomvc, …" | count **correct**; kept and machine-checked. |
| `hn-page.ts:18` | "THIS **WAS** THE THIRD APPLICATION ROUTE THIS LANE HAD" | **past tense**, a dated record. Ruling 3's class. |

### The same family, OUTSIDE `allowed_files` — RECORDED, NOT FIXED, NOT SWEPT

Recorded **in the guard itself** as `ANGULAR_COUNT_NOT_SCANNED`, each with its reason and
each checked for existence, so the successor card has its population enumerated:

| file | site | state |
|---|---|---|
| `app.routes.ts` | "S8 is the one route with a WRAPPER component" | stale |
| `app.routes.ts` | "the SECOND OF TWO ROUTES HERE THAT GO THROUGH A WRAPPER" | stale |
| `app.config.ts` | "instead of through three wrapper components" | stale |
| `async-gate.ts` | header argues this lane is otherwise "free of wrappers" | stale |

These are exempt from the SCAN and counted BY the derivation. That is the honest state:
scanning them would turn the repository red on files this card cannot write to.

---

## 3. WHAT WAS CHOSEN PER SITE — REMOVE, OR GUARD

The card's instruction was **prefer removing the fragile count to guarding it**.

| site | choice | why |
|---|---|---|
| `board-page.ts:7` | **REMOVE** → "one of this lane's wrapper components" | The position carried no information a reader needs, and the next paragraph already NAMES the siblings. |
| `contacts-page.ts:7` | **REMOVE** | same |
| `hn-page.ts:8` | **REMOVE** | same |
| `hn-item-page.ts:6` | **REMOVE** | same |
| `todomvc-page.ts:7` | **REMOVE** | same; this file already names `./async-gate.ts` as the precedent. |
| `habits-page.ts:7` | **REMOVE the position, KEEP one guarded count** | This is the file that owns the family's correction record. The count "NINE wrapper components" is written ONCE, here, and is recompiled at check time. |
| `habits-page.ts:19` | **REMOVE the position, KEEP the count** | "EIGHT APPLICATION ROUTES" is load-bearing — it is what "THIS LANE HAS NO ABSENCES LEFT" rests on. Now checked. |
| `habits-page.ts:40` | **KEEP** | Enumerates the eight routes it counts; measured against a booted server by T014. Now checked. |

**Five sites lost their number entirely. Three keep a count, and all three are recompiled.**

---

## 4. THE GUARD — RULING 11 IN `scripts/check-citations.mjs`

Two rules, because the owner's ruling has two halves.

**(1) A position among the wrapper components may not be stated at all.** This is the half
this repository **cannot** derive. Those ordinals were written in **arrival order**, which
lives in git history rather than on disk; **route order** — the only order a file can be
read for — disagrees with every one of them. A check that recomputed a position would be
GUESSING A BASIS and would silently rewrite what the author meant.

**(2) A count may be stated, and then it is recompiled here.** Nothing in the guard stores
either number:

- `angularWrapperComponents()` — `readdirSync` the lane, keep files with `@Component` **and**
  an import from `../emitted/`. Admits `async-gate.ts` and the eight `*-page.ts`; excludes
  `app.ts` (declares a component, mounts no emitted output) and `app.routes.ts` (imports
  emitted components, declares none). → **9**
- `angularApplicationRoutes()` — parse the lane's own `app.routes.ts` for `path:` entries,
  drop `''` and `s2`–`s9` (the three-way contract `scripts/e2e.mjs` pins to `['s1'..'s9']`).
  → **8**

**Scope is the directory minus named exemptions, not a list of files** — ruling 10's
inversion at small scale. A new wrapper page is scanned the day it lands. 12 files scanned.

**Position forbidden for wrappers, allowed for routes, and the asymmetry is a
measurement.** `hn-page.ts:18` records a **past-tense** application-route position and this
guard has no instrument that can tell a dated record from a live claim. Forbidding route
positions would demand the "correction" of a true sentence — the one thing ruling 6 exists
to stop. Wrapper positions carry no such survivor, so they are refused outright.

**A quotation is a recitation.** A match inside a pair of double quotes is exempt — the
same reading ruling 6 gives a fenced block. Backticks deliberately do **not** exempt: this
codebase spells paths and identifiers in them constantly, and going blind wherever a
backtick appears would be the vacuous pass the file's header warns about. **The hole is
written down rather than glossed** (ruling 9's precedent): someone can hide a live stale
count by quoting it. Both lexer failure modes — an unpaired quote, and a pair longer than
`QUOTATION_LIMIT` — **drop** the exemption, so the instrument fails **towards red**.

**A wrapped sentence is one sentence.** `proseStream` joins the comment stream while
keeping each character's original line and column, so a claim reflowed across two comment
lines is still caught and still reported where a reader will find it. Proven: the
quoted-historical negative control below spans a line break.

---

## 5. RED-CAPABILITY PROOF — 8 PLANTS, ALL PASS

**The strongest form was available and was taken: the guard was run against the
UNMODIFIED HEAD prose before a single demo byte was edited.** It reported **11 problems
across 6 files**, naming every one of the six real stale sites by file and line, with zero
false positives anywhere else in the repository.

Then each site was planted and restored individually. `sha256` before/after each plant:

| plant | file | red at | exit | sha256 before == after |
|---|---|---|---|---|
| REAL "FIFTH of five" | `board-page.ts` | `:7:30`, `:7:39` | 1 | `db22a17e…f52a` ✅ |
| REAL "SIXTH of six" | `contacts-page.ts` | `:7:33`, `:7:42` | 1 | `37c4dff7…1355` ✅ |
| REAL "SIXTH of EIGHT" | `habits-page.ts` | `:7:31`, `:7:40` | 1 | `04ad9638…c6c1` ✅ |
| REAL "FOURTH of the" | `hn-item-page.ts` | `:6:32` | 1 | `b767fbfb…ebde` ✅ |
| REAL "THIRD of three" | `hn-page.ts` | `:8:27`, `:8:36` | 1 | `02439831…147c` ✅ |
| REAL "SECOND of two" | `todomvc-page.ts` | `:7:32`, `:7:42` | 1 | `b8c0684a…cbe3` ✅ |
| SYNTHETIC "SEVEN APPLICATION ROUTES" | `habits-page.ts` | `:33:31` | 1 | `04ad9638…c6c1` ✅ |
| **NEGATIVE CONTROL** — the same real stale claim, **QUOTED** | `board-page.ts` | *none* | **0** | `db22a17e…f52a` ✅ |

Every restore was **byte-identical** and every restored run was green. The
application-route subject had no real stale value at HEAD — its count was right — so its
branch was planted synthetically rather than left unproven.

### Negative controls

- **Correct counts do not fire.** The live "NINE wrapper components" and both "EIGHT
  APPLICATION ROUTES" sites are green at every run.
- **The quoted historical does not fire.** `habits-page.ts`'s `"the FOURTH of four"` is
  green — and the planted control proves the **exemption** is doing the work, not the
  pattern merely failing to match: the identical sentence **unquoted** goes red, **quoted**
  stays green.
- **Family seven is untouched.** `contacts-page.ts`'s "THE EIGHTH APPLICATION", "the FOURTH
  scenario", `board-page.ts`'s "THE THIRD CORPUS APPLICATION" — none fires. This card did
  not widen into T018's or T019's population.

### THE DERIVATION IS LIVE, NOT STORED — PROVEN WITHOUT MOVING A REPOSITORY BYTE

The lane was copied to a scratch directory, a **tenth** wrapper and a **ninth** route were
added there, and the exported derivations were pointed at the copy. `scanAngularCounts` was
then run over the **byte-for-byte green** `habits-page.ts` text:

```
REAL lane derives   : 9 wrappers / 8 application routes
COPIED lane derives : 9 wrappers / 8 application routes
COPY + a tenth wrapper and a ninth route: 10 wrappers / 9 application routes

The SAME green prose, scanned against that CHANGED source:
  RED  habits-page.ts:14  NINE wrapper components   -> prose says 9; the source has 10
  RED  habits-page.ts:33  EIGHT APPLICATION ROUTES  -> prose says 8; the source has 9
  RED  habits-page.ts:54  EIGHT application routes  -> prose says 8; the source has 9
```

**A guard carrying its own copy of the number could not do that.** `git status` after the
probe showed no new or modified repository file.

### Anti-vacuity

`angularCountIntegrityProblems()` is fatal like any citation violation: a floor on the
scanned enumeration, a floor on each derivation, an existence check on the lane directory,
and an existence check on every recorded exemption. Measured: real scope 12 files (floor
4); an empty directory yields 0 files and 0 wrappers, tripping both floors.

---

## 6. THE CHECK'S SURFACE AND COST — UNCHANGED

|  | before (HEAD) | after |
|---|---|---|
| watched documents | 4 | **4** |
| watched source files | 17 | **17** |
| swept source files | 610 | **610** |
| wall clock | 0.493 s | 0.473 s |

Ruling 11 is a **second detector over prose ruling 10 already reads**, not a second sweep —
those 12 files are inside the 610 and are counted there once.

---

## 7. WHAT THIS DOES NOT CLOSE

- **Family seven (53 sites / 21 files) and family nine (~15 sites) are untouched.** T018's
  and T019's, per OD3's sequencing.
- **Four sites of family eight itself remain**, in `app.routes.ts` (×2), `app.config.ts` and
  `async-gate.ts` — outside this card's `allowed_files`. They are enumerated in the guard,
  checked for existence, and exempt from the scan until a card can write to them. **The
  mechanism generalises to them with no new code: delete three entries from
  `ANGULAR_COUNT_NOT_SCANNED` and the scan reaches them.**
- The quotation exemption is a deliberate, documented hole.
- **`async-gate.ts` is the file the whole family forgot, and it is still telling the reader
  this lane is "free of wrappers".** That sentence is the origin of the wrong denominators
  and should be the successor card's first line.
