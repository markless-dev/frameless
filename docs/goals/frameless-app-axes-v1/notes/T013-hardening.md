# T013 — the refuted `checked` claim, and the `:has()` hardening pass

**Board:** `docs/goals/frameless-app-axes-v1/state.yaml` · **HEAD at start:** `4ba539f`
**Instrument:** Playwright / chromium at **1440×1000**, six live lanes on their own
official dev servers (react 5173, solid 5174, qwik 5176, svelte 5177, vue 5179,
angular 5180 — the two foreign holders of 5175 and 5178 routed around, never killed).

**Result in one line: the hardening lands in FIVE sheets rather than four, the
`checked` correction was independently REPRODUCED rather than copied, the
neighbouring `<select> value` claim WAS measurable after all and is also wrong,
and the mutation test found a residual the card did not predict and that no rule
in a page sheet can reach.**

---

## 0. THREE THINGS IN THE BRIEF WERE WRONG, AND THE INSTRUMENT WAS WRONG ONCE

| the brief said | measured |
|---|---|
| "**37 lane pairs** must stay at zero" | **36.** Derived from what each lane actually serves, by body hash: `/todomvc` 6 lanes, `/todomvc-advanced` 5, `/codex` 5, `/hn` 6, `/hn-item` **4** (angular landed at T014), `/habits` 6, `/board` 6, `/contacts` 6 → 5+4+4+5+3+5+5+5 = **36**. T008 measured 35 when `/hn-item` had three lanes; T014's angular lane makes it 36, not 37. |
| "harden the **four** newer page sheets" | **FIVE sheets carry the bare form.** T008 §8.1 says "the FIVE page sheets use BARE `:root`/`#root`/`h1, h2`" and then asks for "a `:has()` hardening pass across the four newer sheets" in the next sentence. `shadcn-theme/codex.css` got its `:root`/`#root`/`h1, h2` block from T008 itself, in the same bare form, on the same day. Hardening four of five would have left `/codex` — one of the eight pages the same card pixel-diffs — running the identical race. **codex.css is hardened too.** |
| "`requireForm` … T008 did **not** measure it. Either measure it the same way or leave it alone" | **It was measurable without authoring anything.** S7 binds `data-size` and never `value`, but **S17 (`/contacts`) ships TWO `<select value={…}>` bindings in all six lanes**, and the S17 golden lowers all fifteen of its `value` bindings to `kind: 'property'`. Measured, and the claim is wrong — see §5. |
| — (my own instrument) | **The first mutation harness produced 20 zeros and measured nothing**, and the first `<select>` scan reported a false third `<select>` in vue alone. Both caught, both recorded — §3.1 and §5.1. |

---

## 1. THE `checked` CLAIM — REPRODUCED AT ITS ORIGIN, NOT QUOTED

T015 found a claim that three documents attributed to a source it was never in.
So this correction was **re-measured from scratch** rather than transcribed from
T008 §6.1: a `MutationObserver` installed through `addInitScript`, which runs
**before any page script**, watching `attributeFilter: ['checked']` on the whole
document with `attributeOldValue`, plus a zero-JS `fetch` of the served payload.

Measured on `/s7`, all six lanes, dev servers, **2026-07-31**:

| lane | SERVED (`fetch`, zero JS) | HYDRATION INSTANT | POST-ACTIVATION |
|---|---|---|---|
| react | `r1 CHECKED · r2 – · cb1 – · cb2 CHECKED` | radio `present→present`, checkbox `present→present` | attr present, prop true |
| solid | *identical string* | **NO MUTATION AT ALL** | attr present, prop true |
| qwik | *identical string* | **NO MUTATION AT ALL** | attr present, prop true |
| svelte | *identical string* | **`present→absent` on both controls** | **attr ABSENT, prop true** |
| vue | *identical string* | radio `present→present`, checkbox `present→present` | attr present, prop true |
| angular | *identical string* | **NO MUTATION AT ALL** | attr present, prop true |

`SERVED IDENTICAL IN ALL SIX: true`, asserted by comparing the extracted
`checked` state of every radio/checkbox across lanes rather than by eye.

**This agrees with T008 row for row.** Two independent runs, two days apart, two
separately written scripts. The shipped four-way comment is wrong on **three of
its four rows**, and the two rows that named solid, qwik and vue as *not serving
the attribute* are refuted outright.

### 1.1 What the corrected comment says, and what it refuses to say

`demos/react-official/three-way-contract.ts` now carries T008 §6.1's wording
plus, explicitly:

> WHAT WAS MEASURED AND WHAT WAS NOT, STATED PLAINLY: both measurements drove the
> six **DEV** servers. `pnpm e2e` drives **PRODUCTION** builds, and the built
> artifacts were NOT measured. The SSR path is the same code, but that is an
> argument, not a reading.

It also names the refuted rows' provenance — a probe on an older tree (the T030
note) — which is why this one was re-read off the live payload.

### 1.2 A THIRD claim in the same file, refuted by the same reading

The S7 scenario overview said *"every `attribute` reading below is identical in
all six lanes, and **no `property` reading is identical in any two adjacent
ones**."* The second half is refuted by the measurement above: the served string
is identical in **all six** and the post-activation `.checked` property is too;
only svelte's **attribute** differs. Corrected, and deliberately **not** widened
to `assertS3`'s `value` on a text input, which is a different property on a
different element and was not re-measured.

---

## 2. THE HARDENING — FIVE SHEETS, AND WHY THE `h1, h2` HALF IS NOT THE `:root` HALF

`frameless-supplement.css` writes `html:has(.todoapp)` rather than `:root` and
documents why: React 19 hoists a `<link>` rendered anywhere in the tree into
`<head>`, while Vite injects `src/index.css` at module-eval, so the scaffold's
sheet can land AFTER ours. Bare `:root`, `#root` and `body` tie the scaffold's
own `:root`, `#root` and `body` **exactly**, so load order decides.

| sheet | scope | `:root` | `#root, #app` | `body` | `h1, h2` |
|---|---|---|---|---|---|
| `hn-css/hn.css` | `.hn, .hn-thread` | → `html:has(…)` | → `:has(…)` | → `body:has(…)` | none (page has no headings) |
| `habit-css/habits.css` | `.ht` | → `html:has(.ht)` | → `:has(.ht)` | → `body:has(.ht)` | → `.ht h1, .ht h2` |
| `board-css/board.css` | `.tb` | → `html:has(.tb)` | → `:has(.tb)` | → `body:has(.tb)` | → `.tb h1, .tb h2` |
| `contact-css/contacts.css` | `.cs` | → `html:has(.cs)` | → `:has(.cs)` | → `body:has(.cs)` | → `.cs h1, .cs h2` |
| `shadcn-theme/codex.css` | `.codex` | → `html:has(.codex)` | → `:has(.codex)` | → `body:has(.codex)` | → `.codex h1, .codex h2` |

### 2.1 `hn.css` NEEDED A LIST OF TWO, AND `.hn` ALONE WOULD HAVE BROKEN `/hn-item`

One sheet, **two routes, two different root elements**. Measured off the served
payload with proper class tokenisation:

```
/hn        react solid qwik svelte vue angular   root class `hn`
/hn-item   react solid qwik angular             root class `hn-thread`, NO `.hn` anywhere
```

`html:has(.hn)` alone would have silently un-neutralised the shell on `/hn-item`
in four lanes. The scope is `:has(.hn, .hn-thread)`.

### 2.2 THE `h1, h2` HALF CANNOT USE `html:has(…)`, AND THAT IS ARITHMETIC

The reset has to sit **above** the scaffold's `h1, h2` (0,0,1) and **below** each
page's own heading class, because those classes own `letter-spacing`,
`line-height` and `margin` and must keep them. CSS specificity is lexicographic,
so there is no pure-element form that beats `h1` and loses to `.ht-weekday`.

- `html:has(.ht) h1` is **(0,1,2)** — it beats `.ht-weekday` (0,1,0) and would have
  rewritten the day heading in **all six lanes at once**. "Six lanes agree" is
  satisfiable by breaking three of them; it is equally satisfiable by breaking six.
- `.ht h1` is **(0,1,1)** — beats the scaffold, loses to a re-scoped class.

So the reset is `.X h1, .X h2`, and **exactly the heading class rules** are
re-scoped to (0,2,0):

```
.ht-weekday    -> .ht .ht-weekday          (habits, the page's only <h1>)
.tb-crumb      -> .tb .tb-crumb            (board,  the page's only <h1>)
.cs-sidehead   -> .cs .cs-sidehead         (contacts)
.cs-crumb      -> .cs .cs-crumb
.cs-formhead   -> .cs .cs-formhead
.thread-title  -> .codex .thread-title     (codex)
```

Six rules, each carrying a comment saying why. Nothing else in any sheet moved.

---

## 3. THE MUTATION TEST — AND THE FIRST HARNESS MEASURED NOTHING

### 3.1 THE INSTRUMENT WAS WRONG FIRST, AND IT ANNOUNCED ITSELF AS TWENTY ZEROS

The first harness appended the scaffold's own bytes as a trailing `<style>` in
`<head>` and asserted it was `document.head.lastElementChild`. **The assertion
passed and all 20 arms reported `diff 0` — with the BARE selectors still in
place.** A check that cannot fail measures nothing.

The reason, measured rather than guessed, by listing every `link[rel=stylesheet]`
and `style` node with its `closest('head')`:

```
react/habits   0 STYLE head   :root { --text: #6b6375; …   <- the SCAFFOLD
               1 LINK  body   /shadcn-theme/tokens.css
               2 LINK  body   /habit-css/habits.css        <- the PAGE SHEET
```

**On the dev servers React does not hoist these links.** On all seven react pages
the scaffold is a `<style>` in `<head>` and the page sheet is a `<link>` in
`<body>` — so the page sheet is already last, and appending to `<head>` cannot
reproduce the race at all. The mutation has to land at the **end of `<body>`**.
The assertion was rewritten to compare against the last node of
`document.querySelectorAll('link[rel=stylesheet], style')`.

**That narrows `frameless-supplement.css`'s premise without contradicting it:**
the hoisting race is a property of the hosts and of React's own rules, not of
this tree's current dev output. Which is exactly why scoping is worth doing —
and `pnpm e2e` drives production builds whose injection order was **not**
measured here.

### 3.2 BOTH ARMS, WITH THE POSITIVE CONTROL THE CARD ASKED FOR

Scaffold bytes forced in as the **last** stylesheet in document order, in each of
the three scaffold lanes, diffed against an unmutated lane that ships no scaffold
at all (svelte; qwik for `/hn-item`). Every arm carries a `control(no mutation)`
reading that must be 0 first, or the arm would be measuring the baseline.

```
page        BARE (before)   HARDENED (after)   what remains
/todomvc              0            0           POSITIVE CONTROL: already :has()
/hn              307169            0           closed
/hn-item         327596            0           closed
/codex            26342         7303           `var(--border)` only
/habits          355726        13498           `var(--accent)` / `var(--border)`
/board           614625        27301           `var(--border)` only
/contacts        883567 + 12px  37698 + 0px    `var(--border)` / `var(--accent)`
```

`/todomvc` at 0 in **both** arms is the control that says the technique works
rather than that the instrument is asleep. `/contacts` also stopped changing
**document height** (2003 → 2015 became 2003 → 2003).

### 3.3 THE RESIDUAL IS NOT A SELECTOR, AND IT IS A NEW FINDING

Under the forced order, on the four token-based pages, **every rect still matches
and every property the hardened blocks declare still matches.** Aligned by LCS on
`tag.class`, 36 computed properties per element:

```
/habits    aligned 219/220   rects differing 0   backgroundColor 21, borderColor 12
/board     aligned 279/280   rects differing 0   borderColor 66
/contacts  aligned 413/414   rects differing 0   borderColor 33, backgroundColor 6
/codex     aligned  49/50    rects differing 0   borderColor 7
```

Every one of them is a `var(--border)` or `var(--accent)` read. **The cause is a
CUSTOM-PROPERTY COLLISION, not a selector:**

```
create-vite scaffold  declares 13 custom properties
shadcn tokens.css     declares 39
COLLIDING NAMES: exactly TWO — `--accent` and `--border`
```

Both are declared on the **same element** from two `:root` blocks, so only source
order can separate them, and no rule in a page sheet can reach a token it does
not declare.

**CONTROL, and it is decisive:** force the same scaffold in with every `--x: …;`
declaration deleted and `/habits`, `/board`, `/contacts` and `/codex` all go to
**0**. `/hn`, which uses no tokens, is 0 in both arms.

**NOT REPAIRED, DELIBERATELY.** `shadcn-theme/tokens.css` is DERIVED at copy time
by `copy-shadcn-theme.mjs` from upstream MIT bytes and is headed *"DERIVED, DO
NOT EDIT"*; its contract is that upstream's `:root` and `.dark` blocks pass
through unchanged. Re-scoping its `:root` to `html:has(…)` (0,1,1) would also put
it **above its own `.dark` block** (0,1,0), inverting the theme's dark-mode
precedence. That is a ruling about the theme layer, not a mechanical hardening.
Recorded as a blocker with the exact mechanism and the exact two names.

---

## 4. PIXEL RESULTS — AND THE HALF THAT CATCHES A REPAIR THAT BREAKS THREE LANES

### 4.1 36 lane pairs, zero pixels

```
/todomvc           react vs solid/qwik/svelte/vue/angular   diff 0
/todomvc-advanced  react vs solid/qwik/svelte/vue           diff 0
/codex             react vs solid/qwik/svelte/vue           diff 0
/hn                react vs solid/qwik/svelte/vue/angular   diff 0
/hn-item           react vs solid/qwik/angular              diff 0
/habits            react vs solid/qwik/svelte/vue/angular   diff 0
/board             react vs solid/qwik/svelte/vue/angular   diff 0
/contacts          react vs solid/qwik/svelte/vue/angular   diff 0

LANE PAIRS: 36 · NON-ZERO: 0
```

Qwik's two dev-only injected elements (`#qwik-inspector-info-popup`,
`#qwik-inspector-overlay`) are **removed by id and the removal reported**, as
T008 established — masking their rects leaves residual pixels because the chip's
`box-shadow` falls outside its own rect.

### 4.2 44 per-lane captures, zero moved

"Six lanes agree" is satisfiable by breaking three of them, and the specificity
juggling in §2.2 is exactly the kind of change that could. **BEFORE → AFTER,
per lane, per page:**

```
LANE CAPTURES: 44 · MOVED: 0
```

Re-run BEFORE → FINAL after the comment corrections: **44 captures, 0 moved**,
and the 36 pairs still 0. Not one lane on one page moved one pixel.

---

## 5. THE NEIGHBOURING CLAIM — MEASURED, AND ALSO WRONG

`requireForm`'s `size` rationale said *"a `value` binding on a select lowers to
`kind: 'property'` and the six lanes disagree **four ways** about whether it
reaches the served attribute at all."* The card allowed either measuring it on
its own evidence or leaving it alone. **It was measurable.**

- `packages/compiler/test/goldens/s17-contacts.json`: **15 `value` bindings, all
  `kind: 'property'`**, two of them on `<select>`.
- `/contacts` ships those two selects in **all six lanes**.

Served payload, HTML comments stripped, six live dev servers:

```
                served <select value=…>       served <option selected>   post-activation .value
react           NO value ATTRIBUTE            all, northgate             "all" / "northgate"
svelte          NO value ATTRIBUTE            all, northgate             "all" / "northgate"
angular         NO value ATTRIBUTE            NONE                       "all" / "northgate"
solid           value="all" / "northgate"     NONE                       "all" / "northgate"
qwik            value="all" / "northgate"     NONE                       "all" / "northgate"
vue             value="all" / "northgate"     NONE                       "all" / "northgate"
```

All six serve 9 `<option>` elements. **No lane mutates a `<select>`'s `value`
attribute at the hydration instant** — a one-way agreement.

- On the exact question the rationale asks — *whether it reaches the served
  attribute at all* — it is a **TWO-way** split, not four.
- Widen it to *how the selection is served at all* and it is **THREE**: react and
  svelte serve `<option selected>` instead; solid, qwik and vue serve the
  attribute and no `selected` option; **angular serves NEITHER**, so its payload
  carries no record of the selection until JS runs.

**The operative conclusion survives and is strengthened** — a `value` reading on
a select still cannot join a cross-lane observation string, and angular is a
sharper reason than any of the four the old comment listed. Corrected in place,
attributed to S17 rather than S7, with the dev-server-only limit stated.

### 5.1 THE INSTRUMENT PRODUCED A FALSE DIVERGENCE AND THE CONTROL CAUGHT IT

The first run reported **three** `<select>` elements in vue and two everywhere
else. Looked at rather than believed: the vue lane serialises the fixture's own
prose into the payload as an HTML comment, and that prose contains the literal
text `` `<select>` ``. Comments are stripped before scanning now. Two lanes'
worth of counting would have shipped a vue-only defect that does not exist.

---

## 6. BASELINES

| gate | result |
|---|---|
| `pnpm test` | **1 failed / 1357 passed** — the foreign `package-inventory` ARM B, exactly one |
| `pnpm check` | **267** `error TS` lines — did not rise |
| `pnpm e2e` | **PASS — 6 demos × 9 scenarios, all observations equal** |
| `pnpm lint` | 0 warnings, 0 errors, 552 files |
| `pnpm check:citations` | clean — 4 docs / 17 watched sources / 604 swept |
| `git diff --exit-code -- packages/` | exit 0 |
| `git diff --exit-code` over `generated*` + `src/emitted` | exit 0 |
| `git status --short` (paired) | **35 CSS files + `three-way-contract.ts` and nothing else**, plus the owner's three |
| copy derivation | **30 / 30 lane copies byte-identical** to `demos/shared/`, re-checked after `pnpm e2e` rebuilt every lane |
| owner fingerprint START | `f326d314` / `aeb7edc1` / `f936e169` / 116 files |
| owner fingerprint FINISH | **identical**, sorting the whole `shasum -a 256` OUTPUT LINES |
| foreign processes | PID 64413 (5175, Mon Jul 27 00:48:52) and PID 24931 (5178, Thu Jul 30 15:55:20) **both alive with original start times**; `pkill -f` never used; the six demo servers were stopped by recorded PID (87300–87310, then their listeners 88141–88146) |

---

## 7. WHAT IS STILL OPEN

1. **THE `--accent` / `--border` COLLISION IS UNREPAIRED AND IS A CARD.** The
   create-vite scaffold and the derived `shadcn-theme/tokens.css` both declare
   those two names on `:root`, so on `/habits`, `/board`, `/contacts` and
   `/codex` the winner is still decided by load order. Measured cost if the
   scaffold lands last: 13 498 / 27 301 / 37 698 / 7 303 pixels, zero rect
   movement. The fix is in `copy-shadcn-theme.mjs`'s `deriveTokens()`, and it has
   to answer what happens to `.dark`.
2. **`/hn` AND `/hn-item` STILL HAVE NO HEADING ELEMENTS**, so `hn.css` has no
   `h1, h2` block and nothing on those pages guards the shell heading rule. The
   moment one is added it will diverge. Unchanged from T008 §8.2 and deliberately
   not pre-empted — a rule that matches nothing cannot be mutation-tested.
3. **EVERYTHING HERE IS DEV-SERVER ONLY.** Both the `checked` measurement, the
   `<select> value` measurement and the stylesheet-position finding drove the six
   dev servers. `pnpm e2e` drives production builds and passes, but nothing here
   read a built artifact's `<head>`.
4. **BOTH FOREIGN PROCESSES STILL ALIVE**, untouched.
5. Everything is uncommitted, as instructed.
