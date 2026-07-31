# T014 — landing T009's ADMIT ruling, and shipping S14 in angular

**Result: DONE.** `component-metadata:imports` is in `BASELINE_FORM_INVENTORY` at floor
`14.0`, evidence `unverified`. `ANGULAR_BASELINE_FLOOR` reads **19.0 before and 19.0
after**. `packages/frameworks/angular/generated/S14.ts` ships, `demos/angular-official`
serves `/hn-item`, and **the recursion was proven in a browser** — which was not optional
here, because every static layer is provably blind to it.

**No emitter was touched.** The emitter was always correct; its output was
under-inventoried.

---

## 1. The headline: the browser drive, and the cross-lane control that made it conclusive

T009's own `missing_evidence` said it plainly: *"NO BROWSER OBSERVATION EXISTS for angular
S14 … 'angular emits a CORRECT recursive component' IS A STATIC CLAIM, NOT A LANE
VERDICT."* That is now discharged.

Chromium (playwright 1.58.2), `demos/angular-official` on port 5199, at `/hn-item`.
**Every figure is a `getClientRects()` reading on the live document**, and nesting depth is
counted by walking `parentElement` for `.hn-cnest` — **not** read off `data-depth`, which
the component could have lied about.

| observation | T003 recorded (react / solid / qwik) | **angular, measured here** | **react, re-measured with the SAME script** |
|---|---|---|---|
| live `.hn-thread` instances | 15 | **15** | 15 |
| visible comments | 14 | **14** | 14 |
| max nesting (`.hn-cnest` levels below the root thread) | 4 | **4** | 4 |
| indent of the nested `.hn-comments` (px) | 104 / 132 / 160 / 188 / 216 | **104 / 132 / 160 / 188 / 216** | identical |
| masthead elements | 1 | **1** | 1 |
| collapse `c1` → visible comments | 14 → 10 | **14 → 10** | 14 → 10 |
| … `c4` (depth 3) still visible? | NO | **NO** | NO |
| … `kidsLabel` in its place | `3 replies` | **`3 replies`** | `3 replies` |
| expand `c1` → visible comments | 10 → 14 | **10 → 14** | 10 → 14 |
| upvote `c9` (depth 3) → arrow | `true → false` | **`true → false`** | `true → false` |
| `pageerror` | `[]` | **`[]`** | `[]` |

**THE FALSIFICATION THAT MATTERS FIRES IN THIS LANE TOO.** Collapsing `c1` — a *depth-0*
comment — removes `c4`, **a depth-3 descendant that no handler on this page names**.
`collapsed` gates `.hn-cnest`, the host holding the recursive instance, so the subtree goes
with it. An unrolled thread would screenshot identically and fail exactly here. It does not
fail.

**Route body hashes** (angular, over the served bytes): `/` `aeffad3a`, `/hn` `a737beea`,
`/hn-item` `b72d90db` — three distinct pages — and a bogus route **404s**. In the *same*
run react answered the bogus route **200 with `/`'s own hash (`2540b92a`)**, re-confirming
T001's and T003's fall-through finding from the other side of the same instrument.

### 1.1 Two apparent oracle mismatches were MY instrument, and the control proved it

The first pass reported `max DOM nesting depth: got 5 want 4` and an extra `96` in the
indent list. **Neither is an angular divergence.** Running the *identical script* against
the **react** lane produced **byte-identical readings**, `maxNestingDepth: 5` and
`indentByDepth {0:[96], 1:[104] … 5:[216]}` included. The difference is the counting
ORIGIN: my walk counts the root thread as a level and includes the un-nested root
`.hn-comments`, while T003's figures are the *nested* levels — consistent with `hn.css`'s
only indent rule, `.hn-cnest .hn-comments { padding-left: 28px }`. The instrument was
re-based and both lanes then match T003 exactly.

**This is why the control mattered.** Comparing angular against a *transcribed table* would
have produced a false divergence report; comparing it against react through **one
instrument in one run** settled it. **Angular and react agree on all eleven fields.**

### 1.2 The first run produced TWO FALSE NEGATIVES, and they are worth recording

The first pass also reported `expand c1 → 10` (want 14) and `upvote c9 → [true, true]`
(want `[true, false]`). **Both interactions actually work.** Isolated on a step-by-step
probe with explicit waits, every one of the three handlers fires correctly.

The cause is **read timing, not behaviour**: this lane is zoneless, so change detection
flushes asynchronously after the listener returns, and `page.evaluate` ran before the
flush. A 400 ms settle after each click — **neutral, it does not wait for the expected
value** — removed it. Recorded because *"the click did nothing"* and *"I read the DOM too
early"* are indistinguishable from a single red, and this page has fourteen comments'
worth of ways to mistake one for the other.

**The oracle is not a green that has never been red.** It went red four times on the first
pass and once more on react's bogus route, so the assertions demonstrably fail.

---

## 2. The admission, and the two mutations that make it not decorative

`ANGULAR_BASELINE_FLOOR` measured through the real module, **before** and **after**:

```
BEFORE  FLOOR = "19.0"   31 entries   at the floor: ["(no standalone key)"]   imports present: false
AFTER   FLOOR = "19.0"   32 entries   at the floor: ["(no standalone key)"]   imports present: true
```

The 17.0 tier is unchanged: `IfBlock, IfBlockBranch, ForLoopBlock, @if, @else, @for`.

**T009's numbers were re-measured, not inherited.** Real `emit()` + real `checkSources` on
`s14-hn-item.json`: **28 distinct forms, exactly ONE uninventoried
(`component-metadata:imports`), exactly ONE violation**; **control S13 = 0**. Every figure
reproduced.

| mutation | expected | observed |
|---|---|---|
| **A** — remove the new entry | S14 draws `baseline-form-inventory` again | **it does**, same verbatim message, `line 6`; uninventoried set returns to `["component-metadata:imports"]`. Restored, control re-run clean |
| **B** — set the new entry's floor to `20.0` | the derived-floor row goes RED | **it does**: `AssertionError: expected '20.0' to be '19.0'` at `gate.test.ts:698`. Restored |

Both mutation harnesses assert the search literal matched before trusting the result — a
`String.replace` that misses returns the input unchanged and would have measured nothing.

**The floor is `14.0` and the evidence is `unverified`, which is not laziness.** All 32
entries are `unverified`, and `gate.test.ts` asserts that; `@angular/compiler@22.0.8` as
installed ships no CHANGELOG and no `@since` tag. **Presence at the pin is not a floor.**

---

## 3. `ungated-scenarios.ts` was DELETED, not emptied — and its own tripwire is why

T009: *"ANGULAR_UNGATED_SCENARIOS becomes EMPTY, and gate.test.ts asserts length > 0 - so
an empty list GOES RED BY CONSTRUCTION, which is the tripwire that file's own doc comment
promised."* Correct. The file is gone and **all four wirings are unwound** — `gate.test.ts`,
`emitter.test.ts`, `parse-emitted.test.ts`, `emitted-typecheck.test.ts` — plus the prose in
`scripts/regenerate.ts`. No reference to it survives anywhere in the repo outside the board
record.

**What was lost with it is a STANDING CHECK, and that had to be replaced.** An allowlist
entry for a form nothing emits is indistinguishable from an entry for a form everything
emits: both are green. So `gate.test.ts` gained two rows in its place:

- **`S14 really prints the 'imports' form, and the inventory really admits it`** — drives
  the real golden through the real emitter and asserts BOTH halves: `collectEmittedForms`
  contains `component-metadata:imports`, the source contains `imports: [HnItem]`,
  `checkSources` returns `[]`, and `generated/S14.ts` is **present** (the inverse of the
  absence assertion the deleted file made).
- **`MUTATION: without the 'imports' entry, S14 is rejected again`** — renames the key to
  one nothing has ruled on and asserts `baseline-form-inventory` fires on
  `"importsNotRuledOn"`.

`emitter.test.ts`'s corpus-wide `not.toContain('imports:')` was **not weakened to "S14 may
differ"** — that would have let a future module start printing the form unnoticed. It is
now a named set (`{'S14.ts'}`) asserted in **both** directions, with an anti-vacuity row
proving every name in the set is really in the corpus.

---

## 4. Three brief claims corrected

**(1) THE ONE THE BRIEF ITSELF FLAGGED, CONFIRMED AND PROPAGATED.** `ungated-scenarios.ts`
and `notes/T003-hn-item.md` both said the decorator **"must list its own selector's
provider."** That is **false** at Angular 22.0.8 — T009 measured 0 AOT diagnostics with the
entry and 0 without, `dependencies: [HnItem]` in both arms. The file carrying the claim is
deleted. **`notes/T003-hn-item.md` COULD NOT BE CORRECTED: it is outside this card's
`allowed_files`.** The correction is recorded here and in
`notes/T009-angular-imports.md`, and **`notes/T003-hn-item.md` still carries both the
"must list its own selector's provider" wording and the "moves the derived
ANGULAR_BASELINE_FLOOR for every scenario at once" claim this ruling refutes.** A later
card with write access to that note should fix it.

**(2) THE BRIEF SAID "SHIP S14 AS THE FOURTH `/hn-item` LANE" AND THAT IS RIGHT, BUT
"THREE LANES REFUSE IT" — STILL LIVE IN `scripts/demo.mjs`'s CLOSING BANNER — WAS ALREADY
GOING TO GO STALE.** It was hand-written prose beside a derived table: exactly the rot T004
repaired, T005 repaired again and predicted would recur, and T006 finally fixed by
deriving. It is **now derived** from `DEMOS` and `SCENARIOS` rather than repaired by hand
for a fourth time.

**(3) NOT AN ERROR, BUT THE BRIEF'S "TWO EMITTER DEFECTS" FRAMING DOES NOT APPLY HERE.**
Neither the solid double-call nor the qwik function-prop defect is reachable in this lane;
angular's `imports` absence was never an emitter defect at all. Stated so the three are not
filed together.

---

## 5. Static green is real but blind — recorded at every site that could be misread

`@angular/compiler-cli@22.0.8` reports **0 diagnostics with `imports: [HnItem]` and 0
without**, with `dependencies: [HnItem]` in **both** arms, because
`StandaloneComponentScopeReader` seeds the component's own scope and then skips a self-entry
with `if (seen.has(ref.node)) continue;` (T009, mechanism read off the shipped bundle;
two-sided control — a sibling selector and an unknown element both draw `NG-998001`, a
planted unknown member draws `NG2339`). **The `ng build` that ran here was green and proves
nothing about the recursion.**

That caveat is written down at **five** sites so a future reader cannot take the green for
the verdict: the inventory entry's floor reason, `scripts/regenerate.ts`'s S14 row, the
angular `README.md`, `demos/angular-official/src/app/hn-item-page.ts`, and the new
`gate.test.ts` row's doc comment.

**This is also exactly why the OMIT form loses.** Leaning on the implicit self-scope fails
Gate 6's version corollary: **no standing check in this repo would go red if upstream
stopped self-seeding.** `imports` is the wider-range spelling, so it is the baseline.

---

## 6. `generated-composition/` — RECORDED, NOT FIXED

T009 found `packages/frameworks/angular/generated-composition/` **is never gate-checked**:
the gate corpus is `generated/` only. Pointed at it by hand, angular's own gate draws **five
`baseline-form-inventory` violations across three uninventoried forms** —
`component-metadata:imports`, `import:./M1-panel#Panel`, `template-node:Content` — and
`M2-page.ts:7` and `C1-slot.ts:14` have been shipping the `imports` form all along.

**This card's admission retires ONE of the three.** The other two, and the wider question
of whether the other five lanes have the same hole, are **T015**. Nothing under
`generated-composition/` was touched here, and no gate corpus was widened.

---

## 7. Verification

| command | result |
|---|---|
| owner fingerprint START | `f326d314` / `aeb7edc1` / `f936e169` / 116 files — sorting the whole `shasum` OUTPUT LINES |
| `ANGULAR_BASELINE_FLOOR` before / after | **19.0 / 19.0**; floor tier exactly `['(no standalone key)']` both times |
| MUTATION A (remove entry) | S14 draws `baseline-form-inventory` again — mutant killed, restored |
| MUTATION B (floor `20.0`) | derived-floor row RED — mutant killed, restored |
| angular's own gate over `generated/` | 0 violations, corpus DERIVED (S14 in, S11/S12 still out) |
| derivation proof | `present-after-delete = 0` **asserted first**, then regenerate → S14.ts; demo copy byte-identical |
| browser drive, chromium, `/hn-item` | **all eleven T003 oracle fields match**, `pageerror []` |
| cross-lane control (react, same script) | **identical on all eleven fields** |
| body hashes | `/`, `/hn`, `/hn-item` distinct; bogus route **404** |
| `pnpm demo` | S14 lists **four** lanes incl. angular; banner derived; refusal string gone |
| `pnpm test` | exactly 1 failure (foreign package-inventory ARM B) |
| `pnpm check` | did not rise above 267 |
| `pnpm e2e` | 6 × 9 |
| `pnpm lint` / `pnpm check:citations` | clean |
| `git diff --exit-code` over non-S14 artifacts | exit 0, **paired** with `git status --short` |
| owner fingerprint FINISH | identical to START |

**Foreign processes:** node PID 64413 (5175, since Jul 27) and PID 24931 (5178, since Jul
30) verified alive with original start times at start and finish. My own servers ran on
**5198/5199** and were stopped by recorded PID. **`pkill -f` was never used.**

**Pre-existing working-tree state, NOT this card's:** `pnpm-lock.yaml` and
`pnpm-workspace.yaml` were already modified and `website/` already untracked at HEAD
`9314115`. Their fingerprints are unchanged from START to FINISH — none of the three was
touched.
