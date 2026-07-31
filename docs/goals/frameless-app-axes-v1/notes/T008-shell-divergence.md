# T008 — the create-vite shell divergence, swept across every shipped page

**Board:** `docs/goals/frameless-app-axes-v1/state.yaml` · **HEAD at start:** `1aa8cbc`
**Instrument:** Playwright / chromium at **1440×1000**, six live lanes on their own
official dev servers (react 5173, solid 5174, qwik 5176, svelte 5177, vue 5179,
angular 5180 — the two foreign holders of 5175 and 5178 were routed around, never
killed).

**Result in one line: eight pages × six lanes now diff to ZERO PIXELS, and the two
things that were actually wrong were not the two things this card was written to
find.**

---

## 0. THE HEADLINE, BECAUSE THREE OF THIS CARD'S FOUR PREMISES WERE WRONG

| the card said | measured |
|---|---|
| `/todomvc`, `/todomvc-advanced` and `/codex` are "PRESUMABLY DIVERGENT TOO" | **`/todomvc` and `/todomvc-advanced` were ALREADY CLEAN** — repaired before `hn.css` existed, by `todomvc-app-css/frameless-supplement.css`, and with a **stronger** technique than any sheet since. `/codex` was the only one divergent. |
| "`/hn`, `/habits` and `/board` are very likely rendering ~20px differently AT THEIR HEADINGS" | **`/hn` AND `/hn-item` HAVE NO HEADING ELEMENTS AT ALL** — zero `h1`–`h6` — so that rule cannot reach them. `/habits` and `/board` diverged at their `<h1>` by **0 pixels** and by **colour**. |
| T002's blocker: "NOBODY HAD COMPARED GEOMETRY ACROSS ALL SIX LANES BEFORE THIS CARD" | **False.** `frameless-supplement.css` did exactly that, documented it in prose, and closed it — including the one rule every later sheet missed. |
| implicitly, that a rect/computed-style sweep is the instrument | **It is not.** The largest divergence in the shipped set moved **no box, no text-run width and none of thirty-six computed properties.** It was only visible in the image. |

**AND THE ONE THE CARD DID NOT ASK ABOUT AT ALL:** five page sheets — `hn.css`,
`habits.css`, `board.css`, `contacts.css` and (as of this card) `codex.css` — reset
the shell's `text-rendering` and **left `-webkit-font-smoothing: antialiased` and
`font-synthesis: none` standing.** Every page they style has been drawn with a
different glyph rasteriser in react/solid/vue than in qwik/svelte/angular since the
day it shipped. **T002's "six lanes now agree TO THE PIXEL" and T006's "Divergence
across our six lanes: NONE" are both refuted at the image.** Neither card was
careless; both measured rects, and rects cannot see it.

---

## 1. METHOD, AND WHY IT IS THREE INSTRUMENTS RATHER THAN ONE

1. **Body hashing before anything.** react, solid and vue answer 200 for any path
   with the S1 body. Every one of the 43 page/lane pairs was fetched and hashed
   first; all eight paths hash distinctly within every lane.
2. **Rect digest.** Every element in `<body>` with a non-zero box, keyed
   `tag.class`, with its rect. Lanes are aligned by **LCS on the key**, so
   framework chrome (react/solid's wrapper `div`, angular's `<app-root>` /
   `<app-*-page>` / `<frameless-*>` hosts, qwik's inspector divs) is *aligned out*
   rather than hand-filtered, and the unaligned entries are printed.
3. **Computed-style digest**, parallel to the rect digest: 36 properties per
   element. This is what caught the `/habits` and `/board` colour bug that moved
   no pixel.
4. **Text-run widths.** Every text node's `Range` rect — catches letter-spacing
   changes that move no element box.
5. **THE IMAGE.** Full-page screenshots, diffed pixel by pixel in a canvas. This is
   the only instrument that saw the font-smoothing bug, and it is what "asserted
   off the image" has to mean.

**Qwik's two dev-only elements are REMOVED BY ID, not masked, and the removal is
reported.** `#qwik-inspector-info-popup` (the "Click-to-Source: Alt" chip) and
`#qwik-inspector-overlay` (a 4×4 marker at the origin) are injected by the qwik
vite plugin, are `position: fixed`, and exist in no other lane. Masking their
measured rects was tried first and left **2 633–11 234 residual pixels**, because
the chip's `box-shadow` falls outside its own rect. Removing them by id takes every
qwik pair to zero.

---

## 2. BEFORE — the root typography and container, per page, per lane

`html font-size | html line-height | html letter-spacing | #root|#app width/text-align/display | document scroll`

### `/todomvc` — **CONSISTENT ALREADY, NO REPAIR**
```
react    14px | normal | normal | 550/left/block | 1440x1000
solid    14px | normal | normal | 550/left/block | 1440x1000
qwik     14px | normal | normal | (no #root)     | 1440x1000
svelte   14px | normal | normal | (no #root)     | 1440x1000
vue      14px | normal | normal | 550/left/block | 1440x1000
angular  14px | normal | normal | (no #root)     | 1440x1000
```
boxes differing 0 · computed styles differing 0 · text runs differing 0 · **pixels differing 0**

### `/todomvc-advanced` — **CONSISTENT ALREADY, NO REPAIR**
Identical to `/todomvc` on every field. 0 / 0 / 0 / **0 pixels**.

### `/codex` — **DIVERGENT, AND THE ONLY PAGE THAT MOVED A BOX**
```
react    18px | 26.1px | 0.18px | 1126/center/flex | 1440x1000
solid    18px | 26.1px | 0.18px | 1126/center/flex | 1440x1000
qwik     16px | normal | normal | (no #root)       | 1440x1000
svelte   16px | normal | normal | (no #root)       | 1440x1000
vue      18px | 26.1px | 0.18px | 1126/center/flex | 1440x1000
```
react↔qwik: **boxes 4 · computed styles 43 · text runs 13 · pixels 18 014**

### `/hn` — geometry clean, **IMAGE NOT CLEAN**
All six: `13.3333px | normal | normal`, root `1440/left/block` where it exists.
boxes 0 · styles 0 · runs 0 · **pixels 47 344** (react↔svelte and react↔angular)

### `/hn-item` — geometry clean, **IMAGE NOT CLEAN**
All three: `13.3333px | normal | normal`. boxes 0 · styles 0 · runs 0 · **pixels 42 010**

### `/habits` — geometry clean, **ONE COMPUTED PROPERTY AND THE IMAGE NOT CLEAN**
All six: `16px | 24px | normal`. boxes 0 · runs 0 · **styles 1 element** · **pixels 17 807**

### `/board` — same shape as `/habits`
All six: `16px | 24px | normal`. boxes 0 · runs 0 · **styles 1 element** · **pixels 49 658**

### `/contacts` — geometry clean, **IMAGE NOT CLEAN**
All six: `16px | 24px | normal`. boxes 0 · styles 0 · runs 0 · **pixels 86 266**

---

## 3. THE THREE MECHANISMS, EACH MEASURED

### 3.1 `/codex` — the container half, and a scale nobody could see

`codex.css` already carried a partial, documented repair: `.codex { position:
fixed; inset: 0; text-align: left }`, added when someone noticed the rail starting
at x=78. **That repair is correct and it still stands** — it is why an 1126px
centred `#root` moved almost no visible box. What it does **not** close is
everything that *inherits* rather than *positions*:

```
letter-spacing   0.18px vs normal on 33 elements. `body` in codex.css sets
                 font-family, font-size and line-height but NOT letter-spacing,
                 so :root's value inherited straight through it.
                 "messages in this thread"  151.58px  vs  147.25px
                 "One authored source, emi" 449.34px  vs  438.17px

EVERY ROUNDED CORNER, 12.5% TOO LARGE.  --radius is 0.625rem and rem IS THE ROOT
                 FONT SIZE. An 18px root turned the whole shadcn radius scale into
                 11.25 / 9 / 6.75 / 15.75 where the other lanes drew 10 / 8 / 6 / 14.
                 The radius provenance recorded at the top of codex.css is RIGHT and
                 the page still drew the wrong numbers in three lanes, because the
                 scale is RELATIVE and the base was not that sheet's.

h2.thread-title  line-height 17.7px vs 24px; font-family from var(--heading);
                 color rgb(8, 6, 13) instead of the token's oklch(0.145 0 0).
                 `.thread-title` sets font-size and letter-spacing and does not set
                 the other three - a class does not beat an element rule it never
                 mentions.
```

### 3.2 `/habits` and `/board` — the heading half, and it is COLOUR, not geometry

The card predicted a ~20px offset as on `/contacts`. **Measured: the rects are
identical to the pixel in all six lanes** — `h1.ht-weekday` at `516,122,178.5,36`,
`h1.tb-crumb` at `312,16,38.84,27` — because `.ht-weekday` sets `font-size`,
`font-weight`, `letter-spacing`, `line-height` *and* `margin`, and `.tb-crumb` sets
four of those five. Exactly two declarations were left standing, on exactly one
element per page:

```
font-family   system-ui, "Segoe UI", Roboto, sans-serif          react/solid/vue
              ui-sans-serif, system-ui, -apple-system, …         qwik/svelte/angular
color         rgb(8, 6, 13)                                      react/solid/vue
              oklch(0.145 0 0)                                   qwik/svelte/angular
border-top-color  follows `color` through currentColor
```

**The day heading and the breadcrumb were a different colour in three of the six
lanes.** The two font stacks resolve to the same installed face on this machine, so
the page cost **zero pixels while being wrong** — which is precisely why the sweep
that caught `/hn` reported six passes here. `contacts.css` already recorded *why*
`/board` never showed the 20px offset (the crumb reads `Task`, four characters, and
the next rect sits behind a flex spacer); **that explanation is confirmed and it was
incomplete.**

### 3.3 ALL FIVE SHEETS — the rule two cards missed because they checked rects

The shell's `:root` declaration carries four things, not one:

```css
font-synthesis: none;
text-rendering: optimizeLegibility;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

`hn.css`, `habits.css`, `board.css` and `contacts.css` each reset **`text-rendering`
and nothing else.** So `-webkit-font-smoothing: antialiased` inherited into every
element on every one of those pages in react, solid and vue, and `auto` applied in
qwik, svelte and angular. Measured `getComputedStyle` on `/codex` before the repair:

```
react   -webkit-font-smoothing=antialiased  font-synthesis-weight=none
solid   -webkit-font-smoothing=antialiased  font-synthesis-weight=none
vue     -webkit-font-smoothing=antialiased  font-synthesis-weight=none
qwik    -webkit-font-smoothing=auto         font-synthesis-weight=auto
svelte  -webkit-font-smoothing=auto         font-synthesis-weight=auto
```

**Nothing else in the sweep can see this.** It changes no box, no text-run width, no
`text-align`, no colour value, no margin. It changes how every glyph is rasterised,
by up to 185–354 per channel-sum, across the entire content area. The diff bounding
box on `/contacts` was `[20, 28, 1386, 1948]` — the whole page.

**`frameless-supplement.css` HAD ALREADY FIXED THIS**, in the TodoMVC repair, with
this comment: *"index.css pins `-webkit-font-smoothing: antialiased` on `body` … at
this corpus's text they change no pixel today, and they are pinned anyway because a
lane-dependent default is a divergence waiting for longer strings."* It pinned
`text-rendering: auto`, `font-synthesis: initial` **and** `-webkit-font-smoothing:
auto`. `/todomvc` is the one page in the shipped set that diffed to zero pixels
before this card. Every sheet written afterwards copied two thirds of that block.

---

## 4. THE REPAIR

Five page-scoped sheets. **No shell was touched**, no emitter, no fixture, no
golden, nothing under `generated/` or `src/emitted/`.

| sheet | `:root`/`#root` | `h1, h2` | font-smoothing |
|---|---|---|---|
| `demos/shared/hn-css/hn.css` | already had it | **not added — page has no headings** | **ADDED** |
| `demos/shared/habit-css/habits.css` | already had it | **ADDED** | **ADDED** |
| `demos/shared/board-css/board.css` | already had it | **ADDED** | **ADDED** |
| `demos/shared/contact-css/contacts.css` | already had it | already had it | **ADDED** |
| `demos/shared/shadcn-theme/codex.css` | **ADDED** | **ADDED** | **ADDED** |

The new declarations:

```css
/* in :root */
-webkit-font-smoothing: auto;
-moz-osx-font-smoothing: auto;
font-synthesis: initial;
text-rendering: auto;

/* new element block */
h1, h2 {
	font-family: inherit;
	letter-spacing: normal;
	line-height: inherit;
	color: inherit;
	margin: 0;
}
```

**`line-height: inherit` rather than `contacts.css`'s literal `1.5`, and that is a
measurement.** `.ht-weekday` sets `1.2` and beats the element rule; `.tb-crumb` sets
none and takes the unitless `1.5` inherited from `:root`, computing to 27px;
`.thread-title` inherits `24px` as a length from `.codex`. A literal `1.5` would
have been right for one of the three and would have **moved all six lanes** on the
other two. `inherit` reproduces each page's own value exactly.

**`font-size` is deliberately NOT reset on `h1, h2`.** No single value is the UA
default for both, every heading in these sheets sets its own, and the sweep found
zero `font-size` divergence — so a guess here could only move six lanes rather than
fix three.

`tokens.css` and `theming-default.css` were **not** touched: the first is derived at
copy time, the second is upstream MIT.

---

## 5. AFTER — and the other half of the claim

### 5.1 Six lanes agree, off the image

**Zero differing pixels on all 37 lane pairs across all eight pages.**

```
/todomvc           react vs solid/qwik/svelte/vue/angular   diff 0
/todomvc-advanced  react vs solid/qwik/svelte/vue           diff 0
/codex             react vs solid/qwik/svelte/vue           diff 0
/hn                react vs solid/qwik/svelte/vue/angular   diff 0
/hn-item           react vs solid/qwik                      diff 0
/habits            react vs solid/qwik/svelte/vue/angular   diff 0
/board             react vs solid/qwik/svelte/vue/angular   diff 0
/contacts          react vs solid/qwik/svelte/vue/angular   diff 0
```

And zero on the other three instruments too: **35 of 35** lane-pairs report
`boxes DIFFERING=0 | styles DIFFERING=0 | runs DIFFERING=0`.

`/codex` root typography, before → after:
```
react/solid/vue   18px | 26.1px | 0.18px | 1126/center/flex   ->   16px | 24px | normal | 1440/left/block
qwik/svelte       16px | normal | normal | (no #root)         ->   16px | 24px | normal | (no #root)
```

### 5.2 THE LANES THAT WERE ALREADY RIGHT DID NOT MOVE

"Six lanes agree" is satisfiable by breaking three of them. The BEFORE and AFTER
captures were differenced **per lane**:

```
/todomvc, /todomvc-advanced, /hn, /hn-item   ALL LANES UNCHANGED
/contacts                                    ALL LANES UNCHANGED (rects/styles; the image moved, see below)
/codex     react, solid, vue   moved: 5 boxes, 13 runs, 18 style properties  (onto qwik/svelte)
           qwik, svelte        0 boxes, 0 runs, 0 element style properties
                               (only <html>'s own line-height normal->24px and font-family
                                Times->ui-sans-serif, which nothing inherits because `body`
                                sets both)
/habits    react, solid, vue   moved: 0 boxes, 0 runs, 3 style properties on h1.ht-weekday
           qwik, svelte, angular   UNCHANGED
/board     react, solid, vue   moved: 0 boxes, 0 runs, 3 style properties on h1.tb-crumb
           qwik, svelte, angular   UNCHANGED
```

The font-smoothing reset applies to all six lanes by construction, so it moved the
rendered glyphs in **every** lane on the five pages that gained it — react/solid/vue
back to `auto`, and qwik/svelte/angular re-declared at the value they already
computed. Its effect on rects, computed styles and text-run widths is exactly zero,
which is why it hid for three cards.

### 5.3 MUTATION TEST — and the first mutant survived

A check that cannot fail measures nothing.

- **Mutant 1: change `-webkit-font-smoothing: auto` to `antialiased` in `hn.css`.**
  **SURVIVED — `diff 0`.** Correctly so: the page sheet is served to **all six
  lanes**, so setting `antialiased` there makes all six antialiased and they still
  agree. The repair's value is a *choice*; its *presence* is what is load-bearing.
  Recording this because the obvious mutation is the wrong one.
- **Mutant 2: DELETE the three declarations from `hn.css`.**
  **KILLED — react vs svelte on `/hn` went to `diff 47344, maxd 185`, the exact
  BEFORE number.** Restored; `shasum` of the restored file matches the pre-mutation
  backup, and the diff returned to `0`.

---

## 6. THE SHIPPED `checked` CLAIM — SETTLED, AND IT IS WRONG ON THREE OF FOUR ROWS

`demos/react-official/three-way-contract.ts` (~line 1788) says a served `checked`
binding *"splits the six lanes FOUR ways"* and lists four behaviours. T006 measured
the served value and the post-activation DOM as identical in six lanes but could not
measure **the instant of hydration**. That instant is measurable: a
`MutationObserver` installed via `addInitScript` runs **before any page script**, so
it records the attribute mutations activation itself performs.

Measured on `/s7`, all six lanes, dev servers:

| lane | SERVED (`fetch`, zero JS) | HYDRATION INSTANT | POST-ACTIVATION |
|---|---|---|---|
| react | radio1 **CHECKED**, radio2 –, cb1 –, cb2 **CHECKED** | mutation fires, `present -> present` | attribute present, prop true |
| solid | *identical* | **no mutation at all** | attribute present, prop true |
| qwik | *identical* | **no mutation at all** | attribute present, prop true |
| svelte | *identical* | **`present -> absent` on both controls** | **attribute absent, prop true** |
| vue | *identical* | mutation fires, `present -> present` | attribute present, prop true |
| angular | *identical* | **no mutation at all** | attribute present, prop true |

**Row by row against the shipped comment:**

- `"react, angular  the server writes checked, and it never moves again"` —
  **angular exact. react half-wrong**: a mutation record *does* fire, though the
  value is unchanged.
- `"solid, qwik  the server does NOT write it; activation adds it, then frozen"` —
  **REFUTED, both halves. The server DOES write it in both, and activation performs
  no mutation whatsoever.**
- `"svelte  the server writes it and hydration DELETES it (remove_input_defaults)"` —
  **CONFIRMED EXACTLY**, mechanism and all. The only row that survives intact.
- `"vue  the server does not write it; activation adds it AND TRACKS state"` —
  **REFUTED on the first half** (the server does write it). "tracks state" was not
  exercised here — no click was performed.

**The six lanes split TWO ways at the observable, not four:** five lanes serve and
keep the `checked` attribute; svelte serves it and hydration removes it, leaving the
`.checked` property true. On the *instant* they split three ways (no mutation /
mutation with unchanged value / deleting mutation).

**The comment's operative conclusion is still correct** — a `checked` reading cannot
join a cross-lane observation string — but for **one lane's** reason, not four's.

**CAVEAT, STATED PLAINLY:** this was measured against the **dev** servers, not the
production builds `pnpm e2e` drives. The SSR path is the same code, but this
measurement does not prove the built artifacts behave identically.

### 6.1 Proposed replacement text — NOT APPLIED

`demos/react-official/three-way-contract.ts` is **not in this card's
`allowed_files`.** The exact wording, for whoever owns that file:

> S7's `checked` bindings — the two radios and the checkbox inside the keyed repeat
> — lower to `kind: 'property'`, and what a property binding does to the serialized
> `checked` attribute **splits the six lanes TWO ways**. Re-measured on this tree, in
> a real browser, with a `MutationObserver` installed before any page script (T008):
>
>     all six       the server writes `checked` identically - the served markup is
>                   the same string in every lane
>     five lanes    react, solid, qwik, vue, angular keep it; the attribute is
>                   present after activation and the property agrees
>     svelte        hydration DELETES the attribute (`remove_input_defaults`),
>                   leaving `.checked` true and the attribute absent
>
> At the INSTANT of hydration they split three ways: solid, qwik and angular perform
> no mutation at all; react and vue re-write the same value; svelte removes it. An
> earlier revision of this comment recorded a FOUR-way split in which solid, qwik and
> vue did not serve the attribute at all — **that is refuted; all six serve it.**
>
> So a `checked` reading cannot be part of a cross-lane observation string — because
> of svelte, not because of four disagreeing lanes. It is not silently dropped: what
> each control DID is observed instead, through `picked` and `chosen`.

The same four-way claim is repeated in `requireForm`'s `size` rationale (*"the six
lanes disagree four ways about whether it reaches the served attribute at all"*).
**That one is about a `<select>`'s `value`, which this card did not measure** — it
should not be edited on the strength of the `checked` finding.

---

## 7. BASELINES

| gate | result |
|---|---|
| `pnpm test` | **1 failed / 1348 passed** — the foreign `package-inventory` ARM B, exactly one |
| `pnpm check` | **267** error TS lines — did not rise |
| `pnpm e2e` | **PASS — 6 demos × 9 scenarios, all observations equal** |
| `pnpm lint` | 0 warnings, 0 errors, 550 files |
| `pnpm check:citations` | clean — 4 docs / 17 watched sources / 602 swept |
| `git diff --exit-code -- packages/` | exit 0 |
| `git diff --exit-code` over `generated*` + `src/emitted` | exit 0 |
| `git status --short` (paired) | **35 CSS files and nothing else**, plus the owner's three |
| copy derivation | **30 / 30 lane copies byte-identical** to their `demos/shared/` source |
| owner fingerprint START | `f326d314` / `aeb7edc1` / `f936e169` / 116 files |
| owner fingerprint FINISH | **identical**, sorting the whole `shasum` OUTPUT LINES |
| foreign processes | PID 64413 (5175, Jul 27) and PID 24931 (5178, Jul 30 15:55) **both alive with original start times**; `pkill -f` never used; demo servers stopped by recorded PID |

---

## 8. WHAT IS STILL OPEN

1. **The five page sheets use BARE `:root` / `#root` / `h1, h2` selectors, at equal
   specificity to the shell, and therefore depend on load order.**
   `frameless-supplement.css` deliberately does not: it writes `html:has(.todoapp)`
   and `#root:has(.todoapp)`, and says why — *"React 19 hoists a `<link>` rendered
   anywhere in the tree into `<head>`, while Vite injects `src/index.css` into
   `<head>` at module-eval time during hydration, so in that lane the scaffold's
   sheet can land AFTER ours."* It works today in all six lanes, measured. It is
   still a race the TodoMVC sheet already declined to run. **A `:has()` hardening
   pass across the four newer sheets is a card, not an emergency.**
2. **`/hn` and `/hn-item` have no heading elements at all**, so nothing on those
   pages guards the `h1, h2` shell rule. The moment one is added it will diverge.
3. **The `checked` comment is still shipped as written** — see §6.1. It is outside
   this card's `allowed_files`.
4. **The `<select> value` "four ways" claim in `requireForm` is UNMEASURED.** It is a
   different property on a different element and this card did not test it.
5. **The `checked` measurement is dev-server only** — see the caveat in §6.
6. Everything is uncommitted, as instructed.
