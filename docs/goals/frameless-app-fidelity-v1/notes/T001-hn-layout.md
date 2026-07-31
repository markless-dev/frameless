# T001 — the Hacker News row is inline in all six lanes

Board `docs/goals/frameless-app-fidelity-v1/state.yaml` · HEAD `fc9bb14` · not committed.

**The whole functional change is one selector.**

```
demos/shared/hn-css/hn.css:271
-  .hn-story {
+  .hn-itemhead .hn-story {
```

Everything else in the 287-line diff is the measured comment recording why, plus the six
`copy-hn-css` copies of the same file.

---

## THE DISPATCH NAMED THE WRONG CAUSE, AND THAT IS THE FINDING

The brief and the card both state the cause as constraint (12) — svelte, vue and angular refuse a
handler-bearing element beside text, so the previous board *"gave every run its own `<span>` and
moved all spacing to flex `gap`, **which broke the inline layout**"*.

**It did not.** The `<span>` narrowing costs this page nothing. `.hn-story` was always declared
`display: flex; align-items: baseline` — its children (`.hn-rank`, `.hn-votebox`, `.hn-item`) are
flex items and lay out in a row correctly. No emitter, fixture, golden or generated file needed to
change, and **none did**.

The actual cause is a **single-selector cascade collision inside this one sheet**:

| | selector | specificity | file order | declares |
|---|---|---|---|---|
| S13 front page | `.hn-story` | (0,1,0) | line ~251 | `display:flex; align-items:baseline; gap:4px; padding:0 0 5px 0` |
| S14 item page | `.hn-story` | (0,1,0) | line ~484 | `display:flex; **flex-direction:column**; gap:2px; padding:6px 4px 0 8px` |

Identical specificity, S14 later, **so S14 won on `/hn` as well as on `/hn-item`**. The front
page's story rows were column flex, and the rank, the triangle and the title each took their own
line.

Measured, comments stripped, both blocks parsed:

```
S13-block selectors: 47   S14-block selectors: 20
COLLIDING (identical selector text, later wins): [".hn-story"]
```

`.hn-story` is the **only** collision in the file.

**This is the `margin: 0` trap exactly.** One sheet, loaded by all six lanes, so all six were
identically wrong and every cross-lane check passed.

---

## ORACLE PART 1 — compared against news.ycombinator.com, NOT against the other lanes

Reference captured **rendered** at 1440×1000, HTTP 200, headless Chromium, 2026-07-31.
Capture: `reference-hn.png` (session scratchpad — not committed; this repo does not vendor YC
bytes, see `demos/shared/hn-css/README.md`).

Reference geometry, first five rows, **identical on every row**:

```
rank     y=[42, 58]     x=[123.28, 136.61]   "1."
arrow    y=[45, 55]     x=[138.61, 148.61]
title    y=[43.5, 59.5] x=[150.61, 212.25]   "Elevators"
domain   y=[45.5, 58.5] x=[220.84, 265.59]   "john.fun"
subtext  y=[61, 72]     x=[150.61, 836.03]   "170 points by Jrh0203 1 hour ago | hide | 59 comments"

y-extent overlap:  rank^arrow=+10  rank^title=+14.5  arrow^title=+10  title^domain=+13
subtext.top - title.bottom = +1.5
```

### Feature-by-feature, reference vs this repo's `/hn` AFTER the change

| feature the reference defines | reference, measured | ours, measured (all six lanes) | verdict |
|---|---|---|---|
| rank and triangle share a row | `rank^arrow` y-overlap **+10** | **+6** | **matched** |
| rank and title share a row | `rank^title` **+14.5** | **+16** | **matched** |
| triangle and title share a row | `arrow^title` **+10** | **+6** | **matched** |
| ordering left→right | rank < arrow < title | rank x=[108,132] < arrow < title | **matched** |
| domain in parens on the SAME line | `title^domain` **+13** | **+13** | **matched** (exact) |
| domain suppressed on Ask HN posts | absent on text posts | `.hn-domain:empty{display:none}`; h5/h10 render none | **matched** |
| subtext directly beneath the title | `subtext.top - title.bottom = +1.5` | **+1.0**, `below=true` | **matched** |
| subtext carries points | `.score` present | `412` via `[data-points]` | **matched** |
| subtext carries author | `.hnuser` present | `by pg` | **matched** |
| subtext carries age | `.age` present | `3 hours ago` | **matched** |
| subtext carries **hide** | present | `[data-hide]` present | **matched** |
| subtext carries **comments** | `59 comments` | `128 comments` | **matched** |
| singular "point" at score 1 | reference shows `1 point` | h12 `.hn-scorelabel` = `"point"` | **matched** |

**Recorded gaps against the reference** (measured, not smoothed, and out of this card's scope):

- **Separators are `<span class="hn-bar">|</span>` hosts, not literal `" | "` text nodes.** Forced
  by Angular's `escapeText` refusing whitespace-edged text nodes. Invisible on the rendered page —
  the subtext geometry above matches.
- **The relative ages are literal strings** (`"3 hours ago"`), because Angular cannot name the
  global `Date` in a transplanted body. Fixture constraint (9). This is board card **T003**.
- **Every link is `href="#/…"` and inert.** No routing construct exists in `.tsrx`. This is board
  card **T002** and is deliberately untouched here.

*No part of this section rests on the six lanes agreeing.* Every row above is our geometry against
YC's geometry.

---

## ORACLE PART 2 — the browser observation, at HEAD after the change

Six lanes driven live via `pnpm demo` (ports auto-allocated **around** the two foreign holders;
nothing was killed): react 5173, solid 5174, qwik 5176, svelte 5177, vue 5179, angular 5181.

**The assertion is made off the rendered page** — `getBoundingClientRect()` y-extents of
`.hn-rank`, `.hn-vote` and `.hn-storylink` inside `li.hn-story[data-story="h1"]` — never off the
declared CSS.

### BEFORE (defect reproduced in all six)

```
li.hn-story computed flex-direction = "column"   in ALL SIX
h1:  rank y=[36,52]   arrow y=[59,65]   title y=[67,83]
     rank^arrow = -7    rank^title = -15    arrow^title = -2      => INLINE FAIL x6
VERDICT before: rank/arrow/title share a row in all six lanes = false
```

### AFTER

```
li.hn-story computed flex-direction = "row"      in ALL SIX
h1:  rank y=[30,46]   arrow y=[35,41]   title y=[30,46]
     rank^arrow = +6    rank^title = +16    arrow^title = +6      => INLINE PASS x6
VERDICT after: rank/arrow/title share a row in all six lanes = true
```

(The row also rises 6px: the S14 rule had been overriding the front page's `padding: 0 0 5px 0`
with the item page's `padding: 6px 4px 0 8px`.)

### NEGATIVE CONTROL — the assertion CAN fail

The pre-fix rule restored **in memory** (`page.addStyleTag`, appended last so it wins the cascade
exactly as it did at `fc9bb14`):

```css
.hn-story { display: flex; flex-direction: column; gap: 2px; padding: 6px 4px 0 8px; }
```

```
flex-direction = "column" in ALL SIX
rank^arrow = -9   rank^title = -19   arrow^title = -4   => INLINE FAIL x6
VERDICT negctl: rank/arrow/title share a row in all six lanes = false
```

The instrument is awake. The assertion is not calibrated to an observed number.

### The controls still drive — a real mouse click on the drawn triangle

`page.mouse.click()` at the triangle's rendered centre (its border-box is 10×6; it is
`width:0;height:0` plus borders, so this proves the hit area survived the layout change):

```
react    vote h1: 412 -> 413   triangleBox=10x6   rowStillInline=true  fd=row
solid    vote h1: 412 -> 413   triangleBox=10x6   rowStillInline=true  fd=row
qwik     vote h1: 412 -> 413   triangleBox=10x6   rowStillInline=true  fd=row
svelte   vote h1: 412 -> 413   triangleBox=10x6   rowStillInline=true  fd=row
vue      vote h1: 412 -> 413   triangleBox=10x6   rowStillInline=true  fd=row
angular  vote h1: 412 -> 413   triangleBox=10x6   rowStillInline=true  fd=row
```

### HTTP 200 is not proof — bodies hashed

react, solid and vue answer 200 for any path. Every lane's `/hn` body was hashed against a
`/definitely-not-a-route-xyz` body on the same origin; **`distinct=true` in all six**. Vue's
`/hn-item` is a live demonstration: **HTTP 200 with no `.hn-thread` on the page at all**.

### S14 `/hn-item` did not regress

Full-viewport screenshots before and after the change, same session:

```
react   046a790a77c39acc -> 046a790a77c39acc  IDENTICAL
solid   046a790a77c39acc -> 046a790a77c39acc  IDENTICAL
qwik    280f62496d82b1d1 -> 280f62496d82b1d1  IDENTICAL
svelte  eea61da276b96e3f -> eea61da276b96e3f  IDENTICAL   (HTTP 404 — refuses the page)
vue     b17300b50b2888a8 -> b17300b50b2888a8  IDENTICAL   (HTTP 200, no thread rendered)
angular 046a790a77c39acc -> 046a790a77c39acc  IDENTICAL
```

`.hn-itemhead .hn-story` at (0,2,0) beats the S13 rule wherever it applies and is inert elsewhere,
so the item page is byte-identical.

**A stale claim found in passing, NOT changed by this card:** the S14 header comment in
`hn.css` (~line 455) says *"three lanes serve this page (react, solid, qwik) … and angular's own
gate rejects the `imports` its recursive component needs."* **Angular serves `/hn-item` — measured
HTTP 200 with 15 `.hn-thread` elements and geometry identical to react/solid.** Four lanes serve
it, which is what `scripts/demo.mjs` already prints. Left for a card that owns that prose.

---

## ORACLE PART 3 — nothing regresses

| gate | required | measured | |
|---|---|---|---|
| `pnpm check` **start** | baseline 251 | **251** | |
| `pnpm check` **end** | no unattributed rise | **251** | **no rise, nothing to attribute** |
| `pnpm test` | exactly 1 failure | **1 failed / 1380 passed (1381)**, 1 file of 65 | foreign |
| `pnpm e2e` | 6 × 9 | `Three-way: 6 demos x 9 scenarios, all observations equal` · `[e2e] PASS` | |
| `pnpm lint` | clean | `Found 0 warnings and 0 errors` over 552 files | |
| `pnpm check:citations` | clean | `clean over 4 watched document(s), 17 watched source file(s) and 604 swept` | |

The single `pnpm test` failure is the foreign `packages/compiler/test/package-inventory.test.ts:493`
peer-suffix ARM B, driven by the owner's in-flight `pnpm-lock.yaml`. Untouched by this card.

### Derivation proof — and the first attempt was VACUOUS

The six `public/`/`static/` sheets are derived by `demos/shared/copy-hn-css.mjs`.

**First attempt reported a clean pass and proved nothing.** It used `PATHS="a b c"` with unquoted
`$PATHS`, and **this harness's shell is zsh, which does not word-split unquoted expansions**. The
whole list became one filename: `rm -f` deleted nothing, the existence loop tested one nonexistent
path, and `PRESENT AFTER DELETE = 0` was true for the wrong reason. Redone with a zsh array:

```
files that exist right now:  6 of 6
PRESENT AFTER DELETE      =  0 of 6      <- asserted BEFORE rebuilding
PRESENT AFTER REBUILD     =  6 of 6
diff pre.txt post.txt     -> empty       => BYTE-IDENTICAL (6/6)

422b60945ce781fe0f7e3e25908368cdb0266d7f684661b6d1138b463da92bb9  (all six, and shared)
```

### Scope — `git diff --exit-code` paired with `git status --short`

```
 M demos/angular-official/public/hn-css/hn.css
 M demos/qwik/public/hn-css/hn.css
 M demos/react-official/public/hn-css/hn.css
 M demos/shared/hn-css/hn.css
 M demos/solid-official/public/hn-css/hn.css
 M demos/svelte-official/static/hn-css/hn.css
 M demos/vue-official/public/hn-css/hn.css
 M pnpm-lock.yaml          <- owner's, pre-existing, untouched
 M pnpm-workspace.yaml     <- owner's, pre-existing, untouched
?? website/                <- owner's, pre-existing, untouched
```

`git diff --exit-code` over `packages/compiler/test/fixtures/**`,
`packages/compiler/test/goldens/**`, `packages/frameworks/*/generated/**`, `demos/*/src/emitted/**`,
`demos/svelte-official/src/lib/emitted/**`, `packages/frameworks/*/scripts/**`,
`packages/frameworks/*/test/**` and `enriched-ir.test.ts`: **CLEAN**.

**S13 is not merely the only scenario that moved — NO s-numbered artifact moved at all.** The card
budgeted for a fixture/golden change; the defect did not need one.

### Owner's three paths — `shasum -a 256`, relative paths, sorting WHOLE OUTPUT LINES

**Algorithm named explicitly: SHA-256. Plain `shasum` is SHA-1 and yields different values.**

| path | START | FINISH | expected |
|---|---|---|---|
| `pnpm-lock.yaml` | `f326d314…` | `f326d314…` | `f326d314` |
| `pnpm-workspace.yaml` | `aeb7edc1…` | `aeb7edc1…` | `aeb7edc1` |
| `website/` (**116** files) | `f936e169…` | `f936e169…` | `f936e169` |

All three match at both ends.

*A note on the digest method, since it is easy to get wrong:* fingerprinting all three paths
together yields `194093bd…` over **118** files — the two lockfiles plus website's 116. The board's
`116` is `website/` alone, so the three are fingerprinted **separately**, and website's digest sorts
the whole `shasum` output lines before re-hashing.

### Process discipline

`pnpm demo` allocated ports **around** the foreign holders and killed nothing, printing:

```
port 5175 is already in use, so qwik was moved off it. Nothing was killed.
port 5178 is already in use, so vue was moved off it. Nothing was killed.
port 5178 is already in use, so angular was moved off it. Nothing was killed.
port 5180 is already in use, so angular was moved off it. Nothing was killed.
```

PID 64413 on 5175 and PID 24931 on 5178 were confirmed alive with `lsof` at start and never
signalled. **No `pkill` was run at any point.** Only the `pnpm demo` this card started was stopped,
by its own recorded PID. **A third occupied port, 5180, was found that the brief does not list** —
also routed around, not touched.

---

## What this card did NOT do

- Did not touch an emitter. The three-lane inline refusal was never the cause.
- Did not touch a fixture, a golden, `generated/`, `src/emitted/`, or a create-vite shell.
- Did not add a dependency; `pnpm-lock.yaml`, `pnpm-workspace.yaml` and `website/` are byte-identical.
- Did not raise `pnpm check`.
- Did not fix routing (T002), the globals allowlist (T003), drag (T004) or discoverability (T005).
- Did not commit.
