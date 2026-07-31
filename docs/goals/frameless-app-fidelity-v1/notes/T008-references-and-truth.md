# T008 — Oracle Part 1 for S10 and S14, and making the record true

Board: `docs/goals/frameless-app-fidelity-v1/state.yaml`. HEAD at start: `eaf7156`.
Every number below was measured **by this card, at HEAD**. Nothing is inherited
from T999's receipt or from any earlier card's write-up, and **"the six lanes
agree" is not offered anywhere in this document as evidence of fidelity** — every
fidelity claim below is against a driven capture of the thing the app copies.

---

## Part A — ORACLE PART 1 FOR S10 (TodoMVC)

### The reference, named and captured RENDERED

**Primary reference: `https://todomvc.com/examples/javascript-es6/dist/`** — the
framework-neutral canonical implementation on `todomvc.com`, which is where the
`todomvc-app-css` class names the fixture uses are published.

Captured rendered at **1440×1000, DRIVEN** — three todos typed in and the first
toggled, so nothing is compared on an empty app. **86,295-byte** screenshot.

Three further implementations were captured the same way as a **calibration on
which features are canonical and which are one implementation's choice**:

| implementation | capture | `.todo-count` after 1 of 3 done | row height | app width | row title |
| --- | --- | --- | --- | --- | --- |
| `javascript-es6` (primary) | 86,295 B | `2 items left` | 59.8px | 550px | `label` |
| `javascript-es5` | 90,197 B | `2 items left` | 59.8px | 550px | `label` |
| `vue` | 65,396 B | `2 items left ` | 59.8px | 550px | `label` |
| `react` | 106,590 B | **`2 items left!`** | 59.8px | 550px | `label` |

### Feature by feature, reference vs `/todomvc`

Ours driven separately **in each of the six lanes**; the per-lane readings were
identical, which is reported as a fact about our lanes and **is not offered as
fidelity evidence** — the right-hand column is compared only against the
left-hand one.

| feature | reference (`javascript-es6`, driven) | ours (`/todomvc`, driven per lane) | verdict |
| --- | --- | --- | --- |
| header `h1` | `todos` | `todos` | **MATCH** |
| new-todo placeholder | `What needs to be done?` | identical | **MATCH** |
| new-todo `autofocus` | present | absent | **DIVERGES** |
| new-todo host | **not inside a `<form>`** | **inside a `<form>`** | **DIVERGES (construct)** |
| add via Enter, input cleared | yes | yes (2 → 3 rows, input `''`) | **MATCH** |
| toggle-all control | `input[type=checkbox]` | `input[type=checkbox]` | **MATCH** |
| toggle-all label | `label[for=toggle-all]` "Mark all as complete" | identical | **MATCH** |
| toggle-all behaviour (clicked via its label) | `3 items left` → `0 items left`, completed 0 → 3 | `1 item left` → `0 items left`, completed 1 → 2 | **MATCH in kind** |
| row height | **59.8px** | **59.8px** | **EXACT** |
| toggle box | **40×40**, `opacity: 0` | **40×40**, `opacity: 0` | **EXACT** |
| completed row class | `completed` | `completed` | **MATCH** |
| completed strikethrough | `line-through` | `line-through` | **MATCH** |
| per-row children | `div.view` | `div.view` | **MATCH** |
| row title element | **`<label>`** | **`<button class="todo-title">`** | **DIVERGES** (`DEFECTS.md` 16, adjudicated NOT a defect) |
| destroy control | present | present | **MATCH** |
| counter text | **`2 items left`** | **`2 items left`** | **MATCH** |
| counter `<strong>` | `2` | `2` | **MATCH** |
| singular / plural | `1 item left` / `2 items left` | `1 item left` / `2 items left` | **MATCH** |
| filter labels + order | `All`, `Active`, `Completed` | identical | **MATCH** |
| filter hrefs | `#/`, `#/active`, `#/completed` | identical | **MATCH** |
| filter `selected` class moves | yes | yes | **MATCH** |
| **filter changes `location.hash`** | **yes** (`#/active`) | **no — stays `""` in all six** | **DIVERGES (construct)** |
| clear-completed | `<button>` "Clear completed" | `<button>` "Clear completed" | **MATCH** |
| clear-completed behaviour | 3 → 2 rows, `2 items left` | 3 → 2 rows, `2 items left` | **MATCH** |
| destroy behaviour | removes the row | 2 → 1 rows, `1 item left` | **MATCH** |
| empty list hides main + footer | yes | yes; `.new-todo` stays | **MATCH** |
| edit mode entry | double-click | double-click (via `event.detail === 2`) | **MATCH** |
| edit input seeded | `Buy a unicorn` | `Buy a unicorn` | **MATCH** |
| edit commit on Enter | yes | yes → `Buy a unicorn EDITED` | **MATCH** |
| **Escape reverts the edit** | **yes** — class returns to `""` | **NO — still `editing`** | **DIVERGES** |
| explicit cancel control | **absent** | **`button.cancel-edit` "cancel"**, and it reverts | **WE ADD ONE** |
| `.info` footer | `Double-click to edit a todo / Created by … / Part of TodoMVC` | **absent** | **DIVERGES** |
| app width | 550px | 550px | **EXACT** |
| body font | `"Helvetica Neue", Helvetica, Arial, sans-serif` | identical | **EXACT** |
| body background | `rgb(245, 245, 245)` | identical | **EXACT** |

**Six divergences, and every one of them already has a recorded reason in
`packages/compiler/test/fixtures/s10-todomvc.tsrx`:**

1. **Escape-revert, replaced by an explicit `cancel` control.** Fixture
   constraint (4): `keydown` is the only spelling of Escape and the compiler
   flattens `onKeyDown` to `onKeydown`, which react-dom never fires. Confirmed at
   HEAD: Escape leaves the row in `editing` in all six lanes; `button.cancel-edit`
   reverts it in all six.
2. **The row title is a `<button>` and not a `<label>`.** Fixture constraint (3),
   and `DEFECTS.md` 16 **adjudicated this NOT a defect** — Svelte's
   `a11y_label_has_associated_control` refusal is correct and canonical TodoMVC's
   clickable label is the anti-pattern.
3. **The new-todo input is inside a `<form>`.** Same constraint (4): Enter rides
   implicit form submission because the keyboard event is unspellable. **The
   observable behaviour is identical** — Enter adds and clears in both.
4. **The filters do not move `location.hash`.** Fixture "WHAT IS OUT": there is no
   routing construct in `.tsrx`, and three host routes would mean three instances
   with independent state. The `href`s are the canonical ones and the `selected`
   class tracks correctly; only the URL does not move.
5. **No `autofocus`.** Not previously recorded anywhere. **NEW, SMALL, UNOWNED.**
6. **No `.info` footer.** The reference's footer is site chrome ("Created by the
   TodoMVC Team", "Part of TodoMVC") rather than app behaviour. **NEW, UNOWNED.**

### AND A CORRECTION TO AN INHERITED BOARD CLAIM

T007's receipt records, as a **measured S11 fidelity gap**, that *"the counter is
missing the reference's `!`"* — `2 items left!` there against `2 items left` here.

**Measured at HEAD across four canonical implementations on `todomvc.com`, the
exclamation mark is REACT'S ALONE.** `javascript-es6`, `javascript-es5` and `vue`
all render `2 items left`, byte for byte what we render. The recorded gap is a
**choice of reference implementation**, not a divergence from TodoMVC — and it
would have been closed by adding a `!` that three of four references do not have.
T007's receipt is not in this card's write scope, so this is recorded rather than
edited.

---

## Part B — ORACLE PART 1 FOR S14 (Hacker News item page)

### It is a FOUR-LANE app, and that is proved before anything else is claimed

Both refusals reproduced **at HEAD, through the real emitters, over the real
golden** `packages/compiler/test/goldens/s14-hn-item.json`:

```
svelte: Svelte emitter has no lowering for a same-module component reference
        (HnItem): a .svelte file declares exactly one component, and a snippet
        cannot own state or a lifecycle
vue:    Vue emitter has no lowering for a same-module component reference
        (HnItem): a .vue SFC declares exactly one component
```

react, solid, qwik and angular all emit it (6,556 / 6,588 / 6,394 / 7,623 bytes).

**No route was invented in svelte or vue, and that is proved by body hash rather
than by HTTP status:**

| lane | `/hn-item` | a bogus path | app-root marker on `/hn-item` |
| --- | --- | --- | --- |
| react | 200, 25,333 B, `0595e2797c220997` | 200, 796 B, `2540b92adb0bfd58` | **present** |
| solid | 200, 31,431 B, `43c6494f1de27342` | 200, 1,018 B, `fdbd246583ca131d` | **present** |
| qwik | 200, 226,903 B, `73df8524eb7c7bb4` | 404, 36,717 B, `34f51a1f06a1dd14` | **present** |
| **svelte** | 404, 3,396 B, `e3dafebd6a9d4873` | 404, 3,396 B, **`e3dafebd6a9d4873`** | absent |
| **vue** | 200, 3,722 B, `24fa9fa5a13f6035` | 200, 3,722 B, **`24fa9fa5a13f6035`** | absent |
| angular | 200, 33,966 B, `40ee95be7275164a` | 404, 166 B, `1686fe3f4c66e6c5` | **present** |

Svelte's and vue's `/hn-item` bodies are **byte-identical to their bogus-path
bodies**. Vue answers **200 for a page that does not exist**, which is exactly why
a status code is not evidence here.

**EVERY CLAIM IN THE TABLE BELOW IS A FOUR-LANE CLAIM: react, solid, qwik and
angular.**

### The reference, named and captured RENDERED

**`https://news.ycombinator.com/item?id=49120097`** — a real, live item page
("Google fixed more Chrome bugs in June than over the past two years, thanks to
AI", 454 points, 463 comments), captured rendered at **1440×1000** and **driven**:
the first comment's collapse control was clicked and the result measured.

### Feature by feature, reference vs `/hn-item`

| feature | reference (item?id=49120097) | ours (four lanes) | verdict |
| --- | --- | --- | --- |
| masthead link count | **9** (`Hacker News`, new, past, comments, ask, show, jobs, submit, login) | **3** (`Y`, `Hacker News`, `login`) | **DIVERGES** |
| rank cell on an item page | present but **empty text** | absent | **MATCH as rendered** |
| upvote arrow present | yes | yes | **MATCH** |
| upvote host | `div.votearrow` inside an `<a>` | `button.hn-vote` | **DIVERGES (host)** |
| arrow ∩ title (y-extent overlap) | **+10** | **+6** | **BOTH INLINE** |
| title ∩ domain (y-extent overlap) | **+13** | **+13** | **EXACT** |
| domain / sitebit element | **anchor** → `from?site=blog.google` | **`<span class="hn-domain">`** | **DIVERGES** (already recorded, unowned) |
| subtext, full text | `454 points by Garbage 12 hours ago \| hide \| past \| favorite \| 463 comments` | `412 points by pg 3 hours ago \| hide \| past \| favorite \| 128 comments` | **SET AND ORDER EXACT** |
| subtext `\|` separators | **4** | **4** | **EXACT** |
| subtext author + age | **anchors** (`user?id=`, `item?id=`) | plain `<span>`s | **DIVERGES** (already recorded, unowned) |
| `hide` / `past` / `favorite` | all three | all three | **MATCH** |
| comment reply box (`<textarea>`) | **present** | **absent** | **DIVERGES** — fixture constraint (16) records the measured reason: a controlled `<textarea>` needs a scalar cell, and a scalar read inside a handler **double-calls** in the solid lane once a module carries a same-module component reference |
| per-comment upvote | yes | yes, and clicking it **consumes the arrow** (visible → not visible) in all four | **MATCH** |
| per-comment author | `hnuser` | `hn-cby` | **MATCH** |
| per-comment age | `3 hours ago`, **a link** | `3 hours ago`, plain | **DIVERGES (link)** |
| collapse toggle | `<a class="togg">` | `<button class="hn-ctoggle">` | **DIVERGES (host)** |
| collapse glyph | `[` **U+2013 EN DASH** `]` — 462 of them | `[` **U+002D HYPHEN-MINUS** `]` | **DIVERGES (glyph)** |
| collapse hides the body | yes | yes | **MATCH** |
| collapse hides the descendants | yes — **451 → 415** visible rows | yes — **14 → 10** visible rows | **MATCH** |
| collapsed placeholder | **`[37 more]`** — a live descendant count | **`3 replies`** — literal seeded data | **DIVERGES (derivation)** |
| expand restores | yes | yes — 10 → **14** | **MATCH** |
| reply link | `reply` | `reply` | **MATCH** |
| indent per nesting level | **40px** | **28px** | **DIVERGES (metric)** |
| nesting levels rendered | 8 | 5 (`data-depth` max) | **DIVERGES (data volume)** |
| body font | `Verdana, Geneva, sans-serif` | `Verdana, Geneva, sans-serif` | **EXACT** |
| page width at 1440 | 1210px | 1224px | **NEAR** |

**The collapsed placeholder is the sharpest of these.** The reference derives it —
`[37 more]` is the count of rows the click just hid, and it changes per comment.
Ours is `kidsLabel`, **literal seeded data** that a collapse cannot make wrong
because nothing computes it. Same shape on screen, different guarantee.

### AN INSTRUMENT CAVEAT ON A CLAIM THIS BOARD ALREADY CARRIES

T006 and T999 both record *"the reference has ZERO `href='#'` out of 227
anchors"*. **On the item page that holds and it is easy to misread.** Measured
here:

| | reference item page | ours, `/hn-item` |
| --- | --- | --- |
| anchors | 3,795 | 21 |
| `href` **exactly** `#` | **0** | **0** |
| `href` **starting with** `#` | **1,420** | **20** |

The reference's 1,420 are **real in-page fragment targets** — `#49120596` and the
like, the comment `next`/`prev` navigation. Ours are **20 destination-less stubs**
(`#/`, `#/login`, `#/hide`, `#/past`, `#/favorite`, `#/reply`). The prefix form
and the exact form disagree by a factor of 1,420 on the reference and agree
perfectly on ours. **A successor doing a stub census must use `href === '#'` on
ours and neither form on the reference.**

---

## Part C — MAKING THE RECORD TRUE

### The drag, re-driven by this card at HEAD before anything was rewritten

A **real native mouse drag** — `mouse.move` to the card centre, `mouse.down`,
twenty interpolated `mouse.move` steps, `mouse.up`. **No synthetic `DragEvent`
appears anywhere in the probe.** Viewport 1600×1000, card `t1` out of `backlog`
onto `todo`, on the **shipped** `/board` page. Two full six-lane runs.

| lane | `[draggable="true"]` | `data-dragging="yes"` mid-gesture | moved | landed in target | still there +1.4 s | arrow moves a card |
| --- | --- | --- | --- | --- | --- | --- |
| react | 9 | **none** | **no** | no | — | **yes** |
| solid | 9 | `t1` | yes | yes | yes | yes |
| qwik | 9 | `t1` | yes¹ | yes¹ | yes | yes |
| svelte | 9 | `t1` | yes | yes | yes | yes |
| vue | 9 | `t1` | yes | yes | yes | yes |
| angular | 9 | `t1` | yes | yes | yes | yes |

**¹ One qwik drop in sixteen was lost** — the first drop from a fresh page in the
first six-lane run. 15 of 16 landed: the second six-lane run, six drops across
three fresh-page arms, and eight more across two configurations of a dedicated
arm — **four with a mid-drag DOM read and four without**, which **refutes** the
obvious guess that the instrument caused it. The mechanism stays **unresolved**
and inside qwik's own resumability envelope; nothing is filed upstream.

**The reading can fail.** The identical gesture released over the sidebar — not a
drop zone — **moved nothing, in all six lanes**.

**React's inertness, recorded three ways and never reported as a drag:** the card
does not move; it never reaches `data-dragging="yes"`; and react-dom logs, in its
own console, while the gesture runs —

```
Invalid event handler property `onDragstart`. Did you mean `onDragStart`?
Invalid event handler property `onDragend`.   Did you mean `onDragEnd`?
Invalid event handler property `onDragover`.  Did you mean `onDragOver`?
```

`[draggable="true"]` is **9 in react too**, so react is not missing the attribute
— it is missing the listener.

**The reference has no drag at all**, re-measured at HEAD by this card on the live
`square-ui-task-management` page: `[draggable]` = **0**, `[draggable="true"]` =
**0**. The page overshoots what it copies.

### The four sites corrected — and THE BRIEF UNDERCOUNTED THEM

| site | what it said | what it says now |
| --- | --- | --- |
| `demos/shared/board-css/README.md` | "`S16` is the **drag-and-drop scenario and it has no drag**… no `[draggable]` rule in this sheet" | the five-lane table above, the react row, the negative control, and what is *still* absent (drag ghost, drop-target highlight) |
| `demos/shared/board-css/board.css` | "This page is the DRAG scenario and it has no drag" | the correction, with the gesture and the lane split, and why the note is now a **label** rather than an apology |
| `demos/react-official/src/App.jsx`, `case 'board'` | "THE AXIS THIS PAGE EXISTS TO MEASURE IS NOT ON IT" | "…IS ON IT IN FIVE LANES AND NOT IN THIS ONE", with the attribute-vs-listener measurement and the re-measured check budget |
| `docs/DEFECTS.md` entry 15 | "**FOUR LANES** COMPLETED AN END-TO-END HTML5 DRAG… angular … unresolved rather than settled" | a marked second amendment: **five lanes on a shipped page, angular settled**, react inert, the negative control, and the one lost qwik drop stated rather than averaged away |

**THE BRIEF SAID FOUR AND THERE ARE FIVE.** `demos/react-official/src/App.jsx`
carries a **second** stale claim, in the `case 'contacts'` block, ninety lines
below the one the brief quoted:

> *"…after S13, S15 and S16, **and UNLIKE S16 THE AXIS IT MEASURES IS ACTUALLY ON
> THE PAGE**…"*

The brief counted **files**, and this is a second claim in a file it had already
named — so a worker fixing only the quoted string would have left the file
self-contradicting: one block saying S16's axis is on the page in five lanes, and
another, in the same `switch`, still saying it is not. Corrected: the contrast is
**withdrawn** rather than reversed, because what is actually true of `/contacts`
is that its axis is on it in **all six** lanes, which S16 cannot say.

A smaller refinement to the same brief: S14 is **not** entirely without a named
reference — `demos/shared/hn-css/README.md` names `news.ycombinator.com` for the
sheet that styles both S13 and S14. What was genuinely absent, and is closed here,
is a **rendered capture of an ITEM page** and any feature comparison against one.

### The status-row edit

Entry 15's "Where each one stands" row already read *react-only* and *five lanes
fire*, so it was **not** stale. It gained one clause: the third re-measurement, on
a shipped page, with angular named as the row T005 had left unresolved.

---

## Verification

| command | result |
| --- | --- |
| owner fingerprint, `shasum -a 256`, START and FINISH | `f326d314` / `aeb7edc1` / `f936e169`, **116** files — **IDENTICAL at both ends**. The three dirty paths were not touched, not cleaned, not committed |
| `pnpm check` | **START 261 → END 261, delta 0, predicted 0 in advance.** Attributed by project: react 113 + solid 78 + qwik 70 = 261; svelte, vue, angular and the root tsconfig contribute 0 each |
| `pnpm test` | **1 failed / 1412 passed** — exactly the foreign `package-inventory` ARM B peer-suffix row |
| `pnpm e2e` | **PASS — 6 demos × 9 scenarios, all observations equal.** Run **ALONE**, after the demo was stopped and after every regeneration had finished |
| `pnpm lint` | 0 warnings, 0 errors over 558 files |
| `pnpm check:citations` | clean over 4 watched documents, 17 watched source files and 610 swept files — re-run after every prose edit, `DEFECTS.md` included |
| derivation proof | **shell ARRAY**, 200 artifacts: 200 present → **PRESENT AFTER DELETE 0, asserted BEFORE any rebuild** → 200 rebuilt **byte-identical**, 0 different. Array-length and empty-digest guards both abort |
| derivation **negative control** | `/*T008-MUTANT*/` appended to three files in three different lanes: git saw **3 of 3** as modified; re-derivation left **0 of 3** modified and no marker survives. **The proof can fail** |
| `git diff --exit-code` over `generated/`, `src/emitted/`, `src/lib/emitted/` | **CLEAN** |
| `git status --short` | exactly the ten files this card intended, plus the owner's three pre-existing paths |
| six lane copies of `board.css` | changed **only** through `demos/shared/copy-board-css.mjs`; all seven copies share one digest |
| foreign PIDs | 64413, 24931, 31456, 51893 — **all four confirmed alive at exit**. `pkill` never run; the demo was stopped by its own recorded PID |

### Out of scope, deliberately

The `/contacts` submit trap (`type="url"` with a bare-host placeholder) was **not
touched**. It changes behaviour and needs its own ruling.

### Still open after this card

- **S12 Codex remains PARTIAL** for oracle part 1 — the public surface is a
  marketing page and the live UI is behind a login. Unchanged by this card and
  still needing an owner decision.
- The HN **domain span-vs-anchor** and the **subtext author/age links** are
  re-confirmed as gaps by this card's own item-page capture, on the item page as
  well as the front page. Unowned.
- **NEW from S14:** our masthead on the item page carries 3 links where the
  reference carries 9; the collapsed placeholder is seeded data where the
  reference derives a live count; indentation is 28px against 40px; and the
  collapse glyph is a hyphen against the reference's en dash.
- **NEW from S10:** no `autofocus` on the new-todo input, and no `.info` footer.
- T007's recorded S11 "missing `!`" gap is a **react-example-only** divergence —
  see Part A. That receipt is outside this card's write scope.
- The qwik lost drop (1 in 16) is reproduced and still **unresolved**.
