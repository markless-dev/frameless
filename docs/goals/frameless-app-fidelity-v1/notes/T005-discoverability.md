# T005 — the two discoverability findings

Board: `docs/goals/frameless-app-fidelity-v1/state.yaml` · HEAD at start `4818f11`
· harness: claude-code · one verification attempt (one negative control failed
mid-card and is written up in §3; the verify suite itself ran once, green).

Both apps worked. Both read as dead. This card changed **only what a user can
find** — the diff is four files of CSS and prose plus their twelve derived lane
copies, and **not one emitted artifact, fixture, golden or test moved.**

---

## 0. The brief's error, found by measuring it

> "The click target is only the dashed circle. **The emoji** and the sidebar
> habit name **do nothing**, so the owner clicked and concluded the page was
> dead."

**The emoji was never dead.** `<span class="ht-checkemoji">` is a CHILD of
`<button class="ht-check">` in `s15-habit-tracker.tsrx`, so a click on it is a
click on the toggle. Measured at HEAD, before any edit, one fresh page per arm,
all six lanes:

| clicked | observables that moved, at HEAD |
| --- | --- |
| the dashed circle | **12 of 12** |
| **the emoji inside it** | **12 of 12** |
| the habit **name** | 0 |
| the row's blank space | 0 |
| the seven-dot strip | 0 |
| the **sidebar** habit name | 0 |

The finding is real and the diagnosis was off by one element: what was inert was
the **name, the meta line and the 96% of the row that is not the button**, plus
the sidebar. Had I taken the brief literally I would have gone looking for a
broken binding on a control that already worked.

The twelve observables are the eight the fixture header lists, plus the toggle's
two `hidden` halves, the card's own class and the sidebar name — read straight
off the DOM by attribute, never off a screenshot.

**A second, smaller brief/card discrepancy.** The card's `verify` says
"`pnpm check` … Baseline is **251**". That is stale: T004 spent a stated +10 and
its own receipt records `251 -> 261`. Re-measured at HEAD, not inherited: **261**,
which is what the dispatch brief says.

---

## 1. ORACLE PART 1 — the habit tracker against **its reference**, driven

`https://square-ui-habit-tracker.vercel.app/`, Chromium, 1440×900, one fresh page
per arm. No lane was compared against another lane anywhere in this card.

| feature | reference, measured live | this page, before | this page, now |
| --- | --- | --- | --- |
| toggle element | `<button>`, **44×44** at `[517,427]`, dashed border, emoji inside | `<button.ht-check>`, **44×44** at `[533,392]`, 2px dashed, emoji inside | unchanged, **44×44** |
| toggle `cursor` | **`default`** | `pointer` | `pointer`, **over the whole row** |
| click the toggle | `0/6 → 1/6`, 2 strikethroughs | 12 observables | 12 observables |
| click the emoji | `0/6 → 1/6` | 12 observables | 12 observables |
| click the row **name** | **nothing** | **nothing** | **12 observables** |
| click the row body | **nothing** | **nothing** | **12 observables** |
| hover the row | **nothing** — `background-color`, `border-color` and `cursor` identical at rest and hovered | nothing | **row lights up**: border → `--primary` 45%, background → `--primary` 5% |
| click the **sidebar** row | **nothing** | nothing | nothing — deliberately unchanged |
| select the row name text | **"Meditate"** | "Meditate" | **""** — see the cost below |

**Where we follow the reference:** the 44×44 target, its dashed-ring-to-filled
transition, the row geometry, and an **inert sidebar** — the reference's sidebar
habit rows do not toggle either, so this card did not add a second write site
there. That would have been inventing behaviour, which is this card's stop_if.

**Where we deliberately overshoot it, and say so:** the reference's row is inert
in both directions and gives **no hover feedback at all**; ours makes the whole
row the target and lights it on hover. A 44×44 target on a 664×74 row is **1936
of 49136 px², four per cent**. The reference has the same four per cent and the
same problem; "the reference does it too" is not a defence when the reported
symptom is *a working page that reads as dead*.

**The cost, measured and kept:** text inside a habit card can no longer be
selected with the mouse (`getSelection()` returns `""` over the card name and
`"Meditate"` over the sidebar name, which is not overlaid). The reference lets
you select it. Recorded in `demos/shared/habit-css/README.md` rather than left
for someone to find.

---

## 2. ORACLE PART 1 — contacts against **its reference**, driven

`https://square-ui-contacts.vercel.app/`, Chromium, **1440×900 — measured, not
assumed** (`innerWidth`/`innerHeight` read on every page).

| feature | reference, measured live | this page, before | this page, now |
| --- | --- | --- | --- |
| document height at a 900 fold | **900** — `scrollHeight === innerHeight`, no page scroll at all | **2003** | **1277** |
| the New-Contact control | `<button>` `[16,72,224,36]`, above the fold | `.cs-new` `[12,64,231,40]`, above the fold | unchanged |
| what it opens | `[role="dialog"]` at `[480,112,480,676]`, **entirely in view** | nothing visibly — it resets 14 cells of a form **below the fold** | the same reset, **beside a form that is now on screen** |
| the form's top edge | 112 | **848** (52px of title band inside the fold) | **249** |
| first field | in view | `[305,935]`, **out of view** | `[961,336]`, **in view** |
| form width | **480** | 480 | 480 |
| control kinds in the fold | 9 fields, all of them | **1 of 13** (only the top-bar search) | **11 of 13** |
| headings in the document | **0** | 4 | 4 |
| Notes control | single-line `<input type="text">` | `<textarea>` | `<textarea>` |

**Where we follow the reference:** the 480px panel width (its dialog's own
measured width), the field/label/pitch geometry, and the property that matters —
**the form is usable without scrolling the page.**

**Where we do not, with the reason each time:**

- **Its construct.** It is a modal `[role="dialog"]`. `.tsrx` has no portal, no
  focus trap and no `dialog`; `s17-contacts.tsrx` constraint (18) already ruled a
  fake modal a worse artifact. The rail reaches the same property with the
  construct this surface has.
- **Its zero headings and its single-line Notes field.** Unchanged from the
  page's existing, recorded divergence. The card is right that the reference is
  not the standard on every axis: a `<textarea>` for notes and a document with an
  `<h1>` are both better, and both stay.
- **Its three-column grid at 1440.** This is the card's real cost and it is not
  waved away: the rail takes a column. Cards go **370 → 314 wide**, pitch **382 →
  326**, columns **3 → 2**, at viewports ≥ 1360px only. The reference keeps three
  columns *because* its form is a modal that costs the grid nothing — the exact
  trade we cannot make.

---

## 3. What was actually changed — and the negative control that failed first

### Habits: one pseudo-element, no markup

```css
.ht-card { position: relative; }              /* containing block */
.ht-check::after { content: ''; position: absolute; inset: 0; }
.ht-card:has(.ht-check:hover) { … }           /* the row-wide hover */
```

The overlay is a child box of the **same button**, so a click on it is a click on
the same single handler and the same single `habits` write. The alternative —
wrapping the row's content in the `<button>` in the fixture — would have moved the
fixture, the golden, six `generated/` artifacts, six `src/emitted/` copies, the
81-row host census in `enriched-ir.test.ts` and six size budgets, **to buy a hit
area**.

**THE NEGATIVE CONTROL CAUGHT A REAL DEFECT IN MY OWN FIRST VERSION.** It read
`inset: -14px -16px`, on the belief that insets resolve against the containing
block's *border* box. They resolve against its **padding box**, which already
contains the padding. The overlay therefore reached **13px outside every card**,
and `.ht-list`'s row gap is **10px**, so it swallowed the gap:

```
BEFORE FIX  elementFromPoint(gap between card 1 and card 2) = BUTTON.ht-check
            a real click in the gap TOGGLED THE CARD BELOW IT   (all six lanes)
AFTER FIX   elementFromPoint(same point)                  = UL.ht-list
            the same click moves NOTHING                        (all six lanes)
```

Nothing on the rendered page looked wrong in either version. Only the control
that clicks a place that must stay inert could see it.

### Contacts: one media block, no DOM change

`.cs-main` becomes a two-column grid at ≥1360px with the grid explicitly in
column 1, the empty-state note in column 1 row 2 and the form in column 2 as a
`position: sticky` rail with its own scroller. Placement is explicit because
auto-placement would have put the empty note in column 2 and wrapped the form.

Both sheets' file-header prose had gone false and both were corrected:
`contacts.css` and its README claimed the form was a "persistent panel **below
the grid**" while `s17-contacts.tsrx` constraint (18) claimed a "persistent
**right rail**". The fixture was right about the intent; only the stylesheet was
wrong, and the README had even argued *against* the rail on card-pitch grounds —
that argument is now answered with the measured trade table above.

---

## 4. DRIVEN AT HEAD AFTER THE CHANGE — all six lanes

`pnpm demo`, real mouse clicks through playwright's input pipeline, one fresh
page per arm, 1440×900.

**Habits — the five click points, observables moved (before → after):**

| lane | circle | emoji | **name** | **row blank** | **dot strip** |
| --- | --- | --- | --- | --- | --- |
| react | 12 → 12 | 12 → 12 | **0 → 12** | **0 → 12** | **0 → 12** |
| solid | 12 → 12 | 12 → 12 | **0 → 12** | **0 → 12** | **0 → 12** |
| qwik | 12 → 12 | 12 → 12 | **0 → 12** | **0 → 12** | **0 → 12** |
| svelte | 12 → 12 | 12 → 12 | **0 → 12** | **0 → 12** | **0 → 12** |
| vue | 12 → 12 | 12 → 12 | **0 → 12** | **0 → 12** | **0 → 12** |
| angular | 12 → 12 | 12 → 12 | **0 → 12** | **0 → 12** | **0 → 12** |

The twelve, listed once: the toggle's class, its emoji half, its check half, the
row name's class, the **sidebar** name's class, the header counter `0 → 1`, the
sidebar badge `0/6 → 1/6`, the progress fill's measured width, the cheer text,
the cheer emoji, today's dot in the nested repeat, and the card's own class.

**Negative and positive controls, all six lanes:**

| control | result |
| --- | --- |
| click the 10px gap between two cards | **nothing moves**, `elementFromPoint` = `UL.ht-list` |
| click the **sidebar** habit name | **nothing moves** — matches the reference |
| click **row 2's** name | h2 toggles; **h1 and h3 unchanged**; counter `0 → 1`; badge `0/6 → 1/6` |
| geometry | card rect `[516,377,664,74]` and toggle rect `[533,392,44,44]` **identical before and after** |
| cursor at the row's blank space | `pointer` |
| page errors | none (two lanes logged a vite HMR `WebSocket closed` on page teardown) |

**Contacts — the thirteen control kinds still behave exactly as they did**, all
six lanes, driven through the rail: every field moves the live preview (name,
role, company **and** industry, email, phone, site, deals, since, slot, the
priority word ladder, the status chip text and class, the tag chips, the note),
the search filters `9 → 1` cards, the status filter gives `2`, **submit adds a
card `9 → 10`**, and the sidebar "New contact" resets the fourteen cells.

**Body hashes, never HTTP 200** — the board's warning is real, and re-measured
here: react, solid **and vue answer 200 for a bogus path**; qwik, svelte and
angular 404.

| lane | `/habits` | `/contacts` | bogus path | all three distinct |
| --- | --- | --- | --- | --- |
| react | `200 1167cca262397007` | `200 c4c639e802f41efc` | `200 41e363f9a623d7e9` | yes |
| solid | `200 40fb83ff6a6f9fac` | `200 cef86f84643eacab` | `200 65f996060150577f` | yes |
| qwik | `200 905970305c26d407` | `200 25ee37a754deb0b3` | `404 51ae87c7fb36501d` | yes |
| svelte | `200 025929fd7b1aec53` | `200 6162c67c9d48d819` | `404 e3dafebd6a9d4873` | yes |
| vue | `200 573f04576c6a4924` | `200 1b2d9c507107c2f1` | `200 24fa9fa5a13f6035` | yes |
| angular | `200 e2d19b327193c1cc` | `200 ca0366c8d08e3014` | `404 cc0fdf2fbbdbacf6` | yes |

`data-app="habit-tracker"` and `data-app="contacts"` are present in the
**server-rendered payload** of all six.

---

## 5. A live defect this card found, diagnosed, and did NOT fix

While driving the contacts form, a full thirteen-control pass **failed to add a
card** in all six lanes. Bisected to one field:

```
react +phone  : cards 9 -> 10
react +site   : cards 9 -> 9      <- the Website field
```

**Cause: native constraint validation, not this page's code.** The Website field
is `type="url"`, and its own placeholder is `example.com` — a **bare host, which
is not a valid URL**. With it filled, `input.checkValidity()` is `false`,
`form.checkValidity()` is `false`, the submit event never fires, and **nothing on
the page says so**, because the guard hint is keyed on the three required fields
and they are all filled. With `https://zoe.example` the same form adds `9 → 10`.

**PROVED PRE-EXISTING BY A TRUE BEFORE-ARM**, not by argument: the react lane was
temporarily served the **HEAD (pre-card) stylesheet**, the same four arms were
driven, and the results were identical (`bare host` 9→9, `absolute URL` 9→10, at
both 1440 and 1200), after which the lane copy was restored and re-digested. It
also reproduces at 1200px, where this card's media query does not apply.

Fixing it means changing the placeholder, the field type, or adding a visible
validation message — **all three change what the app does**, which is this card's
stop_if. Recorded as a blocker for the board to rule on.

---

## 6. Derivation proof — shell **array**, delete asserted before rebuild

Twelve derived artifacts: six lane copies of `habits.css`, six of `contacts.css`.

```
ARTIFACT COUNT: 12
PRESENT BEFORE: 12
PRESENT AFTER DELETE: 0   <- ASSERTED BEFORE ANY REBUILD
ALL 12 REBUILT BYTE-IDENTICAL
EMPTY DIGESTS: 0 (must be 0)
PAIRWISE EQUAL TO SOURCE: 12 of 12
```

The list is a real `ARTS=( … )` **array** with `${#ARTS[@]}` asserted to be 12 —
zsh does not word-split, and a string-plus-`set --` version of this proof has now
been vacuously true on two earlier cards. Both the empty-digest guard and the
array-length guard abort rather than print `EQUAL`. Every rebuild ran the
sanctioned `demos/shared/copy-habit-css.mjs` / `copy-contact-css.mjs`; nothing
under `public/` or `static/` was hand-written.

---

## 7. Regression sweep

| command | result |
| --- | --- |
| `pnpm test` | **1 failed / 1412 passed** — exactly the foreign `package-inventory` ARM B |
| `pnpm e2e` | **PASS — 6 demos × 9 scenarios, all observations equal** |
| `pnpm lint` | 0 warnings, 0 errors over 558 files |
| `pnpm check:citations` | clean — 4 watched documents, 17 watched source files, 610 swept |
| `pnpm check` | **START 261 → END 261. Delta 0, predicted 0 IN ADVANCE** |
| `git diff --exit-code` | clean over `packages/`, `scripts/`, `docs/`, all six lanes' `src/`, the other shared sheets and both copy scripts |
| `git status --short` | the 16 intended files, plus **only** the three known-foreign dirt paths |

The `pnpm check` prediction was written to disk **before the first edit**:
`PREDICTED END 261, DELTA 0, BOUND +0 — this card edits only .css and .md, and
pnpm check typechecks TypeScript`. A rise of any size would have been a stop.
Measured end: 261.

**Owner paths, `shasum -a 256`, relative, whole lines, START and FINISH:**

```
f326d314c25619b6608f95c4f6c60f882c6db32902d181e0f0a7de0b14f4fc4a  pnpm-lock.yaml
aeb7edc10eefe317eacf7e330d7f1ce3f593f2789ff670e98d7e1434a4ef245e  pnpm-workspace.yaml
f936e169d45d39afba81d2964b29cf803516b2c0e89501cc41787c7a7336cdfa  website/ (116 files)
```

Identical at both ends. Not touched, not cleaned, not committed. **Nothing was
committed by this card at all.**

**Foreign PIDs.** 64413 (5175), 24931 (5178), 31456 (5180) and 51893 (4173) were
confirmed alive at start and at exit. `pkill` was never run in any form; the demo
this card started was stopped by its own recorded PID.

---

## 8. What is still open

1. **The `type="url"` submit trap in §5** — pre-existing, diagnosed, unfixed
   because every fix changes behaviour. It is the one thing on `/contacts` that
   can still silently do nothing.
2. **The rail costs the card grid a column** at ≥1360px (370 → 314 wide). The
   reference keeps three columns because its form is a modal; we cannot be both
   without a construct `.tsrx` does not have.
3. **Text selection inside a habit card is gone.** Bought deliberately; the
   sidebar name is still selectable.
4. **Below 1360px the contacts form is still below the fold**, exactly as it was.
   The card's finding was measured at 1440×900 and so is the fix.
5. **The sidebar habit rows remain inert** in both apps, matching both
   references. Making them live is a behaviour change and needs its own card.
