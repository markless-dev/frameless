# T005 — TodoMVC Advanced, styled to its named reference and proved BY IMAGE

Worker receipt detail. The reference is **`todomvc-app-css@2.4.3`**, vendored verbatim at
`demos/shared/todomvc-app-css/index.css` with its MIT `LICENSE`, **plus the shipped
`/todomvc` page at HEAD as rendered ground truth**. Upstream bytes were not touched. All
new pixels are in `demos/shared/todomvc-app-css/frameless-advanced.css`.

---

## 0. THE HEADLINE — TWO DEFECTS, BOTH FOUND IN THE IMAGE, NEITHER READABLE FROM CSS

T007 on the prior board is why this card exists: it found a 3614-pixel heading divergence
invisible to every computed-style check, and a `margin: 0` that made all six lanes
identical **and all six wrong**. This card found two more of the same family.

| # | defect | how big | would a stylesheet review have seen it? |
|---|---|---|---|
| 1 | **The toggle-all chevron was not drawn at all** on `/todomvc-advanced` | 0 non-white pixels in a 45×65 band that carries 83 on `/todomvc` | **No.** Every declaration involved was upstream's, unmodified, and correct in isolation |
| 2 | **The bar's height was fractional**, putting the whole card on a different subpixel phase | **17976** differing pixels in a region asserted identical | **No.** `line-height: 1.4em` is unremarkable to read |

### 0.1 Defect 1 — `z-index: 3` did not fix the collision, it TRADED it

This is a **correction to an inherited claim, and the brief carries it**. The dispatch
describes `frameless-advanced.css` as holding "only plumbing (a measured `z-index: 3`,
needed because upstream's toggle-all chevron at `top:-65px` made the new bar's controls
unclickable — `z-index: 2` was tried first and measured to fail)".

Every word of that is true. **What nobody measured is what `z-index: 3` cost.**

Upstream puts `.toggle-all + label` at `position: absolute; top: -65px` inside `.main`, so
the chevron reaches 65px **above** the list. In canonical TodoMVC that lands inside
`.header`, at the left of the new-todo input — which is exactly where `/todomvc` draws it.
On `/todomvc-advanced` the element 65px above `.main` is the new bar. T003 measured that
the chevron's invisible 45×65 hit area ate the bar's clicks, and raised the bar above it.

**Raising an opaque bar over a control makes the control invisible.** Measured:

```
/todomvc            45x65 header band, ink pixels: 83   (bbox 16x10 at x=190,y=159)
/todomvc-advanced   45x65 header band, ink pixels:  0   ← the control was simply not drawn
```

The clickability measurement was real and the fix was real. It closed one hole by opening
another, and only an image could show it. **A z-index is not a layout.**

### 0.2 Defect 2 — a 19.6px line-height moved the entire card off the pixel grid

`line-height: 1.4em` at `font-size: 14px` is **19.6px**. Four of those made the bar
**198.765625px** tall, so `.todoapp` measured **424.359375px** where the simple card
measures **225.59375px** — *a different fractional part*. The rows survived it (chromium
snaps their backgrounds), which is exactly what made it hard to see; the footer, the
torn-paper sheets and the card's bottom edge did not:

```
REGION B (rows + footer + torn paper), advanced vs /todomvc on identical data
  before:  17976 differing / 216000   maxΔ=185
  after:     200 differing / 216000   maxΔ=1      ← and all 200 are OUTSIDE the card (§4)
```

Every length in the bar is now an integer and the bar is exactly **201px**, so the advanced
card measures **426.59375px** — the *same* fractional part as the simple card's 225.59375.

> **THE ARITHMETIC WAS WRITTEN DOWN WRONG FIRST AND THE BROWSER CORRECTED IT.** The comment
> in the stylesheet originally read `12 + 36 + 4x28 + 8 + 20 + 12 = 200`. The browser
> reported **201**. The missing term is the rule's own `border-top: 1px`, which sits outside
> the padding box. The comment now states the measured total with the border first. A
> derivation that disagrees with the instrument is wrong; it does not get to round.

---

## 1. Method

**Every assertion below reads a rendered PNG.** Nothing consults a stylesheet, a computed
style, or the DOM — except geometry used only to *crop*, never to *assert*.

- **900×900, headless chromium, `colorScheme: 'light'`, `deviceScaleFactor: 1`,
  `reducedMotion: 'reduce'`.**
- **Identical data on both pages.** S11 seeds three rows, S10 seeds two, and the third
  (`Measure the async door`) is the only difference. It is **destroyed** before every shot —
  `destroy` is a synchronous handler, so it lands even in the vue lane whose async handlers
  throw. Both pages then read `1 item left` with the same two titles and the same done flags.
- **qwik is compared with `#qwik-inspector-overlay` and `#qwik-inspector-info-popup`
  REMOVED**, not masked, so nothing is painted over the app region either.
- Harness in the worker scratchpad: `lib.mjs`, `shoot.mjs`, `features.mjs`, `compare.mjs`,
  `mutate.mjs`, `interact.mjs`. **Nothing was added to the repository** — playwright, pngjs
  and pixelmatch were resolved straight out of `node_modules/.pnpm`, because
  `pnpm-lock.yaml` is one of the owner's three untouchable paths.

---

## 2. The five named visual features, asserted ONE BY ONE off the image

All green in all five running lanes. Numbers are from the react lane; the five lanes are
byte-identical (§3), so one set of numbers is *all* of them.

| feature | asserted how, off the image | measured |
|---|---|---|
| **grey page** | the four viewport corners | `rgb(245,245,245)` ×4 ✓ |
| **550px card** | longest run of pure white on a clean row of the list | **550**, x 175→725 ✓ |
| **shadowed** | darkest pixel in the 24px band left of the card edge | **214** vs the page's 245 ✓ |
| **torn-paper edges** | walk down the card's centre column below its bottom edge and count light bands re-entered after a dark row | **2** extra sheets: `255,255,196,238,246,246,246,196,238,246,246,246,196,…` — two `#f6f6f6` sheets each behind its own dark hairline ✓ |
| **80px heading** | ink bbox of everything above the card | **187 × 59** at (355,25) ✓ |
| **weight 200** | horizontal stroke runs across the stems | `[4,4,4,4,6,4,4,4,4]` — nine strokes, none thicker than 6 ✓ |
| **`#b83f45`** | count of pixels EXACTLY `rgb(184,63,69)` | **1061** ✓ |
| **round toggles** | ink bbox square, **four corners empty**, four edge midpoints inked | 32×32; corners `[0,0,0,0]`; edges `[10,9,9,8]` (completed) and `[9,9,9,8]` (active) ✓ |
| **strikethrough** | longest dark run across the title band, **with the active row as control** | completed **177px**, active **12px** ✓ |
| **selected pill boxed in red** | pixels near `#CE4646` in the footer: hollow, one cluster | 88 red px, box 30×26, **0 interior**, **1** cluster ✓ |
| *(added)* **chevron in the header** | ink in the 45×65 header band | **83** px, bbox 16×10 at (190,159) ✓ |

**Roundness is asserted as roundness, not as presence.** A square outline has a square
bounding box too, so the test is that the *corners* are empty while the four *edge
midpoints* are inked. §5 proves that distinction is real.

---

## 3. Cross-lane byte identity

Five lanes serve `/todomvc-advanced`. **One distinct image across all five**, on both routes:

| route | distinct images / lanes | sha256 (16) |
|---|---|---|
| `/todomvc-advanced` | **1 / 5** | `526f74ecca127c0d` |
| `/todomvc` | **1 / 5** | `7cc6b3eee3636d85` |

react, solid, qwik, svelte and vue all produce the identical file. **Vue included** — its
`_ctx.Promise` defect is in its async handlers, so its *static* render is unaffected, and
this card neither hid that finding nor let it exclude the lane from the visual result.

> **THE BOARD'S VERIFY ITEM SAYS "SIX SCREENSHOTS". THERE ARE FIVE, AND SIX IS
> UNREACHABLE.** The angular emitter refuses S11 on its global-identifier ban, so there is
> no component, no route, and `/todomvc-advanced` returns 404 in that lane — recorded by
> T003 and unchanged here. Six screenshots of a five-lane route cannot be taken. The
> stylesheet is still copied into the angular lane, because `copy-todomvc-css.mjs`'s
> contract is that the six asset roots are derived and byte-identical.

> **AND SIX BYTE-IDENTICAL IMAGES ARE NOT, BY THEMSELVES, EVIDENCE OF ANYTHING.** T007's
> `margin: 0` made all six lanes identical *and all six wrong*. Byte identity across lanes
> is a **consistency** result; §2 and §5 are the **correctness** result. They are reported
> separately on purpose.

---

## 4. The shared-region pixel diff — and ONE PLACE THE CARD ASKS FOR SOMETHING FALSE

The card requires: *"PIXEL-DIFF the shared region against the shipped `/todomvc` page on the
same data — header, card, rows and footer must be identical."*

Both pages put the element after `.header` at **y=195**, and after the repair the bar is a
whole **201px**, so `.main` sits at **396** vs **195** — an integral delta. Two crops:

| region | crop | result |
|---|---|---|
| **A** — page, heading, card top, **header** | `[0,0,900,195]` on both | **0 differing / 175500** |
| **B** — rows, footer, torn paper, shadow field | full width, from each page's own `.main` top, h=240 | 200 differing / 216000, **maxΔ=1** |
| **B1** — the **card column only** | `x 175..725`, same crop | **0 differing / 132000** |

Identical in all five lanes.

### THE 200 PIXELS ARE THE CARD'S OUTER DROP SHADOW, AND THEY CANNOT BE IDENTICAL

Characterised rather than waved away:

```
residual: 0 inside the card column, 200 in the shadow field | y range 0..16 | deltas {"1":200}
```

**Zero of them are inside the card.** All 200 sit outside `x 175..725`, in the top 17 rows
of the crop, and **every one is off by exactly 1/255**.

`.todoapp` carries `box-shadow: 0 2px 4px rgba(0,0,0,.2), 0 25px 50px rgba(0,0,0,.1)`. At
the crop's top edge the advanced page is 265px below the card's top and the simple page is
65px below it — both inside the 50px blur's reach of the shadow box's upper edge, at
different distances. **A card that is 201px taller does not cast the same shadow.**

So: *header, rows, footer and torn paper are byte-identical, and the card's own column is
byte-identical.* The **outer shadow field is not, necessarily, and no styling can make it
so.** Reporting `0 differing` over the full width would have required either a false claim
or a region quietly shrunk to fit the answer. **The region is stated at both sizes, with
the reason.**

---

## 5. THE ASSERTIONS WERE MUTATION-TESTED, BECAUSE A GREEN THAT CANNOT GO RED IS A VACUUM

This project keeps producing green vacuums — a mutation harness dead for 22 commits, a
derivation proof that compared two empty files and printed "BYTE-IDENTICAL". So every
assertion in §2 was given a mutant that breaks **exactly** the property it names, injected
as a stylesheet at the end of the cascade **in the live page only** — no tracked file was
ever left mutated.

**Control: unmutated page, all seven assertions green. Then 11/11 mutants KILLED.**

| mutant | injected | assertion that went red |
|---|---|---|
| M1 | `html,body { background:#fff }` | `f1.pageGrey` |
| M2 | `body { max-width:500px }` | `f1.cardWidth` |
| M3 | `.todoapp { box-shadow:none }` | `f1.cardShadow` |
| M4 | `.footer:before { box-shadow:none }` | `f1.tornPaper` |
| M5 | `h1 { font-size:70px }` | `f2.size` |
| M6 | `h1 { font-weight:400 }` | `f2.weight` |
| M7 | `h1 { color:#333 }` | `f2.colour` |
| **M8** | **toggle circle replaced with a SQUARE outline of the same 40×40 box** | `f3.cornersEmpty` |
| M9 | `.completed .todo-title { text-decoration:none }` | `f4.strikethrough` |
| M10 | `.filters a.selected { border-color:transparent }` | `f5.filterPills` |
| M11 | **this card's own chevron repair, reverted** | `f6.chevron` |

**M8 is the one worth reading.** It swaps the circle for a *rectangle* of the same size and
the same stroke — so a presence check passes, and a bounding-box check passes. Only an
assertion that genuinely tests **roundness** can kill it. It died.

Two mutants were aimed at the **diff** rather than at a feature, and they discriminate
cleanly — each breaks its own region and leaves the other clean:

| mutant | REGION A | REGION B1 |
|---|---|---|
| **D1** — the fractional line-height restored (bar → 201.765625) | **0** (clean) | **17252** ← breaks |
| **D2** — the chevron put back under the bar | **90** ← breaks | **0** (clean) |

That is the anti-vacuum proof for both repairs: remove either one and the corresponding
region stops being byte-clean, and *only* that one.

Collateral, recorded rather than trimmed: M1 also reddens `f2_heading` (the heading's ink
box is found against the page background) and M8 reddens both toggle rows (one selector).
Neither is a flaw; both are stated so the numbers are not read as tighter than they are.

---

## 6. `top: 1px`, not `top: 0` — and it took the image to see the difference

The repair changes the chevron's **containing block**, not its offset:

```css
.todoapp-advanced .main            { position: static; }
.todoapp-advanced .toggle-all + label { top: 1px; left: 0; }
```

`position: static` hands the label to `.todoapp`, which is already `position: relative`, so
the offset stops being "one header above the list" and becomes "the top of the card" — and
the label's own 65px height is exactly the header's height. The alternative,
`top: calc(-65px - <bar height>)`, was **rejected**: it hard-codes the bar's height in a
second place, so a longer status line would slide the chevron back out of the header
silently.

**`top: 0` was tried first and measured to fail.** An absolute offset resolves against the
containing block's **padding** box, and upstream gives `.main` a `border-top: 1px`. So on
the simple page `top:-65px` resolves against 195+1 and the chevron's border box lands at
**y=131**, not 130. `.todoapp` has no border, so `top: 0` put it at **130**:

```
region A diff at top: -65px (broken)  90 differing   ← chevron absent
region A diff at top: 0     (near)    80 differing   ← chevron present, ONE PIXEL HIGH
region A diff at top: 1px   (fixed)    0 differing
```

**"The chevron is back" was true, and still wrong**, and the count barely moved when it went
from absent to one-pixel-off. That is this card's argument in one line: a boolean check
would have flipped to green at `top: 0`.

**The `position: static` risk was measured, not reasoned away.** It also drops `.main`'s
`z-index: 2`, and `.footer:before` — the torn-paper stack — is an absolutely positioned box
whose bottom 50px overlap `.main`'s last row. If it painted anything inside its own border
box it would now paint over that row. It does not: all five of its shadows are **outer**
shadows. Confirmed by REGION B1 being byte-clean across the rows, the footer *and* the torn
paper afterwards.

---

## 7. A STYLING CARD CAN BREAK BEHAVIOUR, SO THE CONTROLS WERE RE-DRIVEN

This card moved a 45×65 hit area out of the bar and into the header, and made `.main`
static. Both sides of that move were driven in a real browser in **all five lanes**, and all
five returned identical results:

| check | result, all five lanes |
|---|---|
| the bar's `server-fails` checkbox — **the control the chevron used to eat** | toggles ✓ |
| the bar's search field | accepts text ✓ |
| chevron box | `x=175 y=131 w=45 h=65` — **the same box `/todomvc` reports** ✓ |
| `document.elementFromPoint` at the chevron's centre | `LABEL` — it owns its own hit area ✓ |
| clicking the chevron | `toggle-all` becomes checked ✓ |
| the new-todo input (the chevron now overlays its left 45px, as upstream intends) | accepts text ✓ |
| a row toggle across the 600ms await | lands ✓ |
| destroy | 3 rows → 2 ✓ |
| filter pill | gains `selected` ✓ |
| console errors | **none**, except vue's known `_ctx.Promise is not a constructor` |

> **A QWIK READING WAS CORRECTED RATHER THAN REPORTED.** The first pass waited 1200ms after
> the toggle and read qwik at **3 rows and an unselected filter** — a two-axis failure in one
> lane. Qwik **resumes lazily**: it fetches and executes a handler's chunk only on first
> interaction, so the wait was measuring the harness. Re-run at 2000ms, and re-run again
> with the toggle step removed entirely, qwik reads **exactly** as the other four. Reporting
> the first number would have invented a qwik defect out of a `waitForTimeout`. Same class
> as T003's Vite-HMR correction.

---

## 8. What was deliberately left alone

- **`index.css` and `LICENSE` — upstream bytes.** `git diff --exit-code` over both, and over
  `frameless-supplement.css`: **exit 0**. Nothing moved.
- **The vue route was not touched and not deleted.** It is labelled EMITS-BUT-MISBEHAVES in
  three places, four of its seven axes run, and deleting it would delete a measured finding.
- **The angular lane was not chased.** No component, no route, 404 — T003's recorded refusal.
- **No emitter, IR, `generated/` or `src/emitted/` file was opened to fix appearance.**
  Two places where the markup constrains the look were handled in the stylesheet or
  recorded, never by editing the source:
  - `remoteStatus` and `syncNote` are **bare words**, so the bar rendered the token `idle`
    **twice**, 78px apart, with nothing to tell the two apart. Labels are generated in CSS —
    which is upstream's own idiom in this very cascade: `.toggle-all + label:before` draws
    the chevron with `content: '❯'` and `.todo-list li .destroy:after` draws the delete glyph
    with `content: '×'`. It now reads `remote idle` / `sync idle`.
  - **`.remote-count` reads `0 remote matches for` with a dangling `for`** until a search
    runs, because the term is interpolated and starts empty. That is emitted text, there is
    no state to select on, and hiding it would need markup. **Recorded, not papered over.**
    After a search it reads `1 remote match for unicorn`.
- **`.advanced { z-index: 3 }` was kept.** It is now belt-and-braces rather than the only
  thing holding the bar up, and the reasons are in the stylesheet: it is free, it is the
  recorded outcome of a real measurement, and any future control in that corner would meet
  the same chevron if the header ever stopped being 65px tall.

---

## 9. The bar's own layout, and the standard applied to it

The bar is **this repo's invention** — canonical TodoMVC has no search field, no
local/remote distinction, no failure control and no sync status, and T002 recorded that no
upstream "TodoMVC Advanced" stylesheet exists anywhere. So it has no reference to match and
was held to a different bar: *legible, coherent, and inside the vendored sheet's own visual
language*, while **touching nothing** the pixel diff asserts.

Read off the image before: a ragged left column of five unaligned lines, two of them the
identical word `idle`, with the `Reject the next save` label crowding the line above it.
After: a 36px search row, four labelled status lines on a 20px/8px rhythm, and the failure
control on its own line directly above the `sync` line it produces. Every selector is scoped
to `.advanced`, to `.todoapp-advanced`, or to a class (`saving`, `row-pending`) the simple
app's markup does not carry — which is *why* regions A, B1 came out byte-clean.

`white-space: nowrap` with an ellipsis on the status lines is **not decoration**: a remote
term long enough to wrap would add a line, change the bar's height, and move the whole list
— defect 2 again, from a different direction.

The in-flight states were driven and shot too (not required by the card, but the amber
`saving` state and `.row-pending` marker are inventions this card re-flowed): with a search
in flight and a rejection armed, the bar reads `remote searching` / `sync saving`, the
search button greys to `opacity .5`, and the row renders amber-italic with a right-aligned
`saving` marker. Settled, it reads `remote done` / `sync reverted` and
`1 remote match for unicorn`.

---

## 10. Derivation — the six copies are derived, never hand-kept

All six lane copies **deleted**, regenerated by each lane's own `pnpm copy-todomvc-css`,
compared by `shasum -a 256`:

```
array length: 6            ← an ARRAY, because T003's first attempt used a SCALAR and
present before: 6             zsh does not word-split, so it deleted nothing and compared
PRESENT AFTER DELETE: 0    ← two empty files. The 0 here is the proof the rm landed.
present after regenerate: 6
DERIVATION: 6/6 BYTE-IDENTICAL after delete+regenerate
```

And every copy equals the source, `3531ddfca5c9c688`:

| lane | asset root | digest |
|---|---|---|
| react | `public/` | `3531ddfca5c9c688` |
| solid | `public/` | `3531ddfca5c9c688` |
| qwik | `public/` | `3531ddfca5c9c688` |
| svelte | `static/` | `3531ddfca5c9c688` |
| vue | `public/` | `3531ddfca5c9c688` |
| angular | `public/` | `3531ddfca5c9c688` |

---

## 11. Baselines

| command | result |
|---|---|
| `pnpm test` | **exactly 1** failure — `package-inventory` ARM B, foreign; **1271 passed** |
| `pnpm check` | **267** `error TS` lines — did **not** rise |
| `pnpm e2e` | **PASS** — `6 demos x 9 scenarios, all observations equal` |
| `pnpm lint` | 0 warnings, 0 errors, 467 files |
| `pnpm check:citations` | clean — 4 documents, 17 watched sources, 539 swept |

**Owner's three paths, sha256, SORTING THE DIGESTS NOT THE PATHS — identical at start and
finish:** `aeb7edc1` / `f326d314` / `f936e169`, `website/` **116 files**.

> **THE FIRST FINGERPRINT READING WAS WRONG, AND THE BOARD HAD ALREADY SAID WHY.** The
> `website/` digest came out `b1dd182a`, not `f936e169`, because the first attempt piped
> `find … | sort | xargs shasum` — **sorting the PATHS**. The recorded method sorts the
> **digest lines**: `find website -type f -exec shasum -a 256 {} \; | sort | shasum -a 256`.
> Both are deterministic; they are not the same number. Re-run by the stated method it
> matches exactly. Recorded because the board warns about this in three places and it still
> caught the first command typed.

**Servers.** Ports **5311–5315** (react/solid/qwik/svelte/vue). **A foreign process holds
port 5175 — `node`, PID 64413**, the qwik demo's own default. It was **recorded and routed
around, never killed**, and `lsof` confirms it still listening at the end. Every process
this task started was stopped by **recorded PID**; three had been reparented to PPID 1 and
were identified by the exact ports they held before being stopped individually. `pkill` was
never used.

---

## 12. For the PM

1. **The card's "header, card, rows and footer must be identical" is satisfied, with one
   necessary exception stated in §4:** the card's **outer drop shadow** cannot match,
   because the advanced card is 201px taller and the shadow is a function of the box. 200
   pixels, all outside the card column, all off by 1/255. Everything else is byte-clean.
2. **The board's verify item asks for SIX screenshots; five exist and six is unreachable** —
   angular has no `/todomvc-advanced` route. Not a narrowing, a count error.
3. **`z-index: 3` was a trade, not a fix, and that framing came into this card from the
   brief** (§0.1). The clickability measurement was sound; nobody measured visibility. Worth
   carrying to T004 as a pattern: *a stacking fix that makes a control reachable can make it
   unseeable, and only an image tells you.*
4. **Nothing in `docs/DEFECTS.md` changed and nothing new is owed there.** Both defects here
   are in this repo's own stylesheet, not in an emitter or a lane.
5. **T003's three open findings are untouched and still open** — vue's template-expression
   global limit, angular's global-identifier ban, and react's post-`await` const-SSA
   divergence. This card is a styling card and none of them is a styling matter.
