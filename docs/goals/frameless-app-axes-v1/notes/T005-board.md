# T005 — DRAG AND DROP, measured, and the board's prediction is wrong in both directions

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `5260dd9` · **not committed**.

**The axis does NOT refuse.** `onDragStart` / `onDragOver` / `onDrop` / `onDragEnd`
/ `onPointerDown` are **produced by five of the six emitters**, and in **five of
six lanes they FIRE in a real browser**. The one lane where the emitted binding is
inert is **react**, and it is inert for the reason `DEFECTS.md` 15 gives.

**And drag still does not ship**, for a reason nobody predicted: it costs the
**type baseline**. One drop zone plus one draggable card takes `pnpm check` from
**267 to 280**. This board's oracle part 3 forbids the rise, so the axis is
**RECORDED, NOT SUBSTITUTED**: `s16-task-board` ships with **arrow buttons**, and
**the page says so on itself**, in a bordered note above the board.

---

## 1. Owner fingerprint — START and FINISH, IDENTICAL

Method, as the charter mandates: **sort the whole `shasum` OUTPUT LINES.**

| path | START | FINISH | expected |
|---|---|---|---|
| `pnpm-lock.yaml` | `f326d314…` | `f326d314…` | `f326d314` ✅ |
| `pnpm-workspace.yaml` | `aeb7edc1…` | `aeb7edc1…` | `aeb7edc1` ✅ |
| `website/` (lines sorted) | `f936e169…` | `f936e169…` | `f936e169` ✅ |
| `website/` file count | 116 | 116 | 116 ✅ |

Nothing under those three paths was read for content, moved, or written.

---

## 2. THE DRAG VERDICT — the deliverable

Two questions, in order, per lane. **Question 1 was asked of the REAL emitters on a
probe module; question 2 was asked in CHROMIUM, twice, by two independent arms.**

| lane | (1) SPELLED? | emitted form | (2) FIRES? | **verdict** |
|---|---|---|---|---|
| **react** | **YES** | `onDragover` `onDragstart` `onDragend` `onPointerdown` | **NO — only single-word `onDrop` fires** | **EMITS-BUT-MISBEHAVES** |
| **solid** | **YES** | `onDragover` `onDragstart` `onDragend` `onPointerdown` | **YES, all five** | **EMITS AND FIRES** |
| **qwik** | **YES** | `onDragover$` `onDragstart$` `onDragend$` `onPointerdown$` | **YES, all five** | **EMITS AND FIRES** |
| **svelte** | **CONDITIONALLY** — refuses the ELEMENT, not the event | `ondragover` `ondragstart` `ondragend` `onpointerdown` on `<ul>`/`<li>` | **YES, all five** | **REFUSES ON `<div>`/`<span>`, EMITS AND FIRES ON `<ul>`/`<li>`** |
| **vue** | **YES** | `@dragover` `@dragstart` `@dragend` `@pointerdown` | **YES, all five** | **EMITS AND FIRES** |
| **angular** | **YES** | `(dragover)` `(dragstart)` `(dragend)` `(pointerdown)` | **YES, all five (synthetic); native drag NOT PRODUCED on that page — see §2.4** | **EMITS AND FIRES** |

### 2.1 The board's prediction, and where it is wrong

The card said the four events *"cannot be produced"* and *"their lowercase forms
never fire"*. Both halves are too strong, and `DEFECTS.md` 15 already said so:

> **Status:** OPEN, **and not contained** — there is no refusal in front of it.

There is no refusal because `jsxEventName` **accepts** `/^on[A-Z]/` and then
destroys the casing. So the compiler takes the spelling it is about to ruin.

And the ruin is **lane-specific**, which entry 15 does not say. `dragover`,
`dragstart`, `dragend` and `pointerdown` **are the real DOM event names**. A lane
that binds by DOM event name gets the correct listener *by accident of the same
bug*:

```
react     onDragover        -> react-dom matches by PROP NAME     -> never fires
solid     onDragover        -> addEventListener('dragover')       -> FIRES
qwik      onDragover$       -> on-dragover                        -> FIRES
svelte    ondragover        -> the DOM attribute itself           -> FIRES
vue       @dragover         -> addEventListener('dragover')       -> FIRES
angular   (dragover)        -> addEventListener('dragover')       -> FIRES
```

**This is the same shape as `DEFECTS.md` 12.2: REACT ONLY.** Entry 15 was filed
off `onKeyDown` in react and generalised to "all six lanes" without measuring the
other five. That generalisation is refuted here.

### 2.2 ARM A — synthetic dispatch, which isolates "is a listener attached"

Real `DragEvent` objects with a real `DataTransfer`, dispatched at the emitted
elements. This asks only whether a listener exists for that event name.

```
lane      start  over   drop   end    pointer  landed
react     no     no     YES    no     no       c1      <-- ONLY the single-word event
solid     yes    yes    yes    yes    yes      c1
qwik      yes    yes    yes    yes    yes      c1
svelte    yes    yes    yes    yes    yes      c1
vue       yes    yes    yes    yes    yes      c1
angular   yes    yes    yes    yes    yes      c1
```

**React's row is the whole of `DEFECTS.md` 15, reproduced on drag.** `onDrop` is
the control: it is *single-word*, `slice(2).toLowerCase()` is the identity on it,
react prints `onDrop`, and it fires. Every two-word sibling on the same two
elements does not.

### 2.3 ARM B — a NATIVE drag with a real mouse

Mouse down on the card, twenty interpolated moves, mouse up over the drop zone.
The driver also installs its **own** document-level listeners as a **CONTROL**, so
"the browser produced no drag" is distinguishable from "the binding did not fire".

```
lane      emitted: start/over/drop/end/pointer   landed    DRIVER CONTROL saw
react     no  / no  / no  / no  / no             none      dragstart, dragover, drop, dragend, pointerdown
solid     yes / yes / yes / yes / yes            c1        dragstart, dragover, drop, dragend, pointerdown
qwik      yes / yes / yes / yes / yes            c1        dragstart, dragover, drop, dragend, pointerdown
svelte    yes / yes / yes / yes / yes            c1        dragstart, dragover, drop, dragend, pointerdown
vue       yes / yes / yes / yes / yes            c1        dragstart, dragover, drop, dragend, pointerdown
angular   no  / no  / no  / no  / yes            none      pointerdown ONLY
```

**React's row is the strongest single fact on this card.** The driver's own
listeners, on the same document, saw a complete native HTML5 drag — and the
emitted bindings saw **nothing**. That is not a synthetic-event artefact and not a
harness limitation; it is real mouse input producing real drag events that the
emitted React binding cannot receive.

**Four lanes completed a real end-to-end drag and drop**, `landed = c1`.

### 2.4 Angular's native row is UNRESOLVED, and the control is what says so

On the angular probe page chromium delivered **`pointerdown` and nothing else** —
not `mousedown`, not `dragstart` — **to the driver's own listeners as well as to
the emitted ones**. No native drag was produced on that page at all, so the
emitted binding is not on trial in this arm, and ARM A already showed all five of
its handlers firing.

**A control was run and it narrows it further:** on `angular /habits` and
`angular /board` the same driver sees `pointerdown, mousedown, mouseup, click`
normally, as do `vue /board` and `react /board`. So this is **not** an
angular-shell property and **not** a general angular defect — it is specific to
that probe page in that lane, and it is recorded as **open and unexplained**
rather than resolved in either direction.

### 2.5 The svelte refusal, verbatim

Svelte is the only lane that refuses anything, and it refuses **the element**:

```
Emitted Svelte module Probe.svelte did not compile warning-free:
a11y_no_static_element_interactions. Every emitted form must be warning-free; a
code that is legitimate for the authored shape has to be added to
SANCTIONED_SVELTE_IGNORE_CODES with a reason.
```

— on a `<div>` or `<span>` carrying **any** drag handler, and

```
Emitted Svelte module Probe.svelte did not compile warning-free:
a11y_consider_explicit_label. Every emitted form must be warning-free; a code that
is legitimate for the authored shape has to be added to
SANCTIONED_SVELTE_IGNORE_CODES with a reason.
```

— on a `<button>` with no accessible name. **The identical handlers on `<ul>` and
`<li>` emit clean.** That is why `s16-task-board` has exactly one `<ul>` and one
`<li>` in its host census: they are where the drop zone and the draggable card
*would* have gone.

### 2.6 WHAT ACTUALLY KEEPS THE DRAG OFF THE PAGE — the type baseline

Measured by writing the probe's emitted output into each JSX lane's `generated/`
and running that project's own `tsc`:

| project | baseline | with one drop zone + one draggable card | delta |
|---|---|---|---|
| react | 117 | **123** | **+6** |
| solid | 80 | **86** | **+6** |
| qwik | 70 | **71** | **+1** |
| **`pnpm check` total** | **267** | **280** | **+13** |

React and solid pay **one `TS2322` per host** (the unknown prop) **plus one
`TS7006` per handler**, whose parameter can no longer be contextually typed.

**Qwik's single error is not an event at all, and it is a NEW FINDING.** It comes
from `draggable="true"`: this corpus lowers a static attribute as a **string**, and
qwik's JSX types declare `draggable?: boolean`. That is T003's `rows="6"` finding
in a **non-numeric** shape, and it widens the corpus constraint from *"no static
numeric attribute"* to **"no static attribute whose DOM type is not `string`"**.
Recorded as the fixture's constraint (14).

`pnpm check` **must not rise above 267**. So the axis is measured and recorded,
and the app ships a different interaction **with a label**.

---

## 3. WHAT SHIPPED, AND WHAT IT SAYS ABOUT ITSELF

`s16-task-board` — one `.tsrx`, **six lanes**, browsable at `/board`, in
`pnpm demo`. The page carries this, in a bordered note above the board, at 12px
on `--foreground` rather than as a muted footnote:

> **!** DRAG AND DROP IS NOT WIRED ON THIS PAGE, and that absence is the
> measurement. Cards move with the ◀ and ▶ arrows instead — a different
> interaction, labelled as one. Measured through all six real emitters: the drag
> events DO emit in five lanes and are inert only where the lane binds by a
> framework prop name, but one drop zone and one draggable card take pnpm check
> from 267 to 280. See the fixture header.

**The axis is not silently swapped.** The fixture header, all six `regenerate.ts`
rows, all six route wrappers, `scripts/demo.mjs`'s scenario table AND its closing
paragraph, and the page itself all say the same thing.

### 3.1 Per-lane result for the shipped app

| lane | emitter | lane gate | browser | **verdict** |
|---|---|---|---|---|
| react | `generated/S16.tsx` | **208 pass** | 9/9 ladder | **EMITS AND SHIPS** |
| solid | `generated/S16.tsx` | **203 pass** | 9/9 ladder | **EMITS AND SHIPS** |
| qwik | `generated/S16.tsx` | **97 pass** | 9/9 ladder (resumes) | **EMITS AND SHIPS** |
| svelte | `generated/S16.svelte` | **129 pass** | 9/9 ladder | **EMITS AND SHIPS** |
| vue | `generated/S16.vue` | **153 pass** | 9/9 ladder | **EMITS AND SHIPS** |
| angular | `generated/S16.ts` | **162 pass** | 9/9 ladder | **EMITS AND SHIPS** |

**All six emitted on the FIRST attempt**, as S15 did. Emitted sizes:

```
react 15679 B   solid 16402 B   qwik 16653 B
svelte 12050 B  vue 12471 B     angular 13657 B
```

At **89 hosts** it is now the largest template in the corpus, eight ahead of S15.

---

## 4. THE ARROW MOVE, DRIVEN — five stages, six lanes, all identical

Playwright/chromium against the six live `pnpm demo` servers.

```
stage      t1@col     b/t/r   shipped  L/R arrows  empty  summary
at0        backlog    3/3/1   1/9      T/F         hidden  ◑ Review is filling up.
at1        todo       2/4/1   1/9      F/F         hidden  ◑ Review is filling up.
atReview   review     2/3/2   2/9      F/T         hidden  ◕ Half the board is in review.
back       progress   2/3/1   1/9      F/F         hidden  ◑ Review is filling up.
emptied    progress   0/5/1   1/9      F/F         SHOWN   ◑ Review is filling up.
```

```
at0       ALL SIX IDENTICAL
at1       ALL SIX IDENTICAL
atReview  ALL SIX IDENTICAL
back      ALL SIX IDENTICAL
emptied   ALL SIX IDENTICAL
```

**Which click moves which is itself the measurement.** Not every observable moves
on every click, deliberately — a lane that repainted the page on every write would
be indistinguishable from a correct one if everything always moved:

```
at0 -> at1        t1Column, backlogCount, todoCount, t1LeftHidden           (4)
at0 -> atReview   + reviewCount, shipped, summaryText, summaryEmoji,
                    t1RightHidden                                           (8)
atReview -> back  t1Column, reviewCount, shipped, summaryText,
                    summaryEmoji, t1RightHidden                             (6)
back -> emptied   backlogCount, todoCount, backlogEmptyHidden               (3)
```

- `t1RightHidden` goes **false → true** on the review move: **the control that was
  clicked disappears under the pointer.**
- `back` is reached by clicking **◀**, so the derivation is proved to run
  **backwards** too, and the summary ladder closes again.
- **`total` (`/9`) never moves at any stage.** It is listed as an observable
  *because* it is a constant: a lane that rebuilt the seed on a write would move it.

### 4.1 The negative control — what did NOT move

`t9` sits in the final column and is never touched. `t9Column`, `t9Title` and
`t9RightHidden` are absent from every moved-fields list above, at every stage, in
every lane. Without this, "eight fields changed" could not be told from "the page
re-rendered".

### 4.2 The summary ladder was BROKEN AND THE FIRST DRIVE CAUGHT IT

The first spelling used S15's band edges — `0 / <3 / <6 / <9` — and the review
column's reachable range on this seed is 1…9, so **every stage of the drive sat
inside the same band and the sentence never changed**. Six lanes agreed, at every
rung, on a value that never moved: an observable measuring nothing, agreed on
unanimously.

Edges moved to `0 / <2 / <4 / <9` so the **first** review move crosses one, and
the emoji ladder crosses with it. Recorded in the fixture as constraint (16)
rather than tidied away.

### 4.3 `pageerror`, and the control that says it is not ours

```
react []   qwik []   svelte []   angular []
solid ["Error: WebSocket closed without opened."]
vue   ["Error: WebSocket closed without opened."]
```

**CONTROL:** the same two lanes emit the identical error on `/`, `/todomvc`,
`/hn` and `/habits` — routes this card did not touch. Pre-existing vite HMR noise,
exactly as T002 and T004 recorded.

---

## 5. VISUAL — asserted off the RENDERED page, and six lanes agree to the pixel

**Reference recorded on the card before the build:**
<https://square-ui-task-management.vercel.app/> — **REFERENCE-ONLY.** Its licence
(*"ln-dev UI License"* © 2026 lndev, GitHub `NOASSERTION`) forbids publishing the
templates **or any derivative** in any repository. **Nothing was copied.** The
geometry was measured live at 1440×1000 and reproduced on the vendored MIT shadcn
tokens at `demos/shared/shadcn-theme/`.

| feature | reference (measured live) | S16 (measured live) |
|---|---|---|
| sidebar | `[0, 0, 256, 1000]` | `[0, 0, 256, 1000]` ✅ |
| top bar | 0 → 60 | `[256, 0, 1184, 60]` ✅ |
| toolbar row | 60 → 118 | `[256, 60, 1184, 58]` ✅ |
| column | 360 wide, 12 gap, 12 pad, radius 10 | `[272, …, 360, …]`, pitch **372** ✅ |
| card | 334 wide, radius 10, 1px border | `[285, …, 334, 162]` ✅ |
| page heading | `18px / 600` | `18px / 600` ✅ |
| card title | `14px / 500` | `14px / 500` ✅ |
| four columns, last one clipped at 1440 | yes | yes ✅ |

**Divergence across our six lanes: NONE.** All nine measured rects are
byte-identical strings in all six lanes, which is the shell neutralisation in
`board.css` working — without it react, solid and vue would be 1126px wide and
centred, exactly as T002 found on `/hn`.

### 5.1 The rendered image caught a defect no CSS check could

The first build bound the **sidebar badge** to `{totalLabel}`, which is the
*header's suffix*. Beside the big shipped count it reads `1/9`; alone in the
sidebar it rendered as a bare **`/9`** — a stray slash. Every computed-style check
would have passed it. Repaired by giving the badge its own `tally` computed (S15's
shape); recorded in the fixture at the site of the change.

### 5.2 Where this page is deliberately NOT the reference, each with a cause

- **The tag chips are `--secondary`, not the reference's per-category blue / pink /
  amber.** Those are not shadcn default tokens; reproducing them would reproduce
  *their theme* rather than the measured geometry, which the licence ruling
  forbids. Same ruling T004 recorded for the habit tracker's purple. The measured
  20px height, 8px padding, 6px radius and 11px/500 type are kept.
- **No assignee avatars.** Overlapping gradient discs carrying no state, and a
  third nesting level measuring nothing.
- **Card titles are `<span>`, not `<h3>`.** The reference renders card titles as
  `<h3>` under an `<h1>` with no `<h2>` anywhere — a heading-order defect. This is
  the second place the page is deliberately more correct than the thing it
  reproduces.
- **`Filter`, `Sort`, `Share`, `Request task`, the column `+`, `Add task` and the
  three sidebar links are INERT.** `.tsrx` has no routing construct. **The
  reference's own `Filter` and `Add task` are inert too**, measured live.
- **The brand reads "Frameless", not "Square UI".** Reference-only.

### 5.3 The reference has no drag either, and it is now measured rather than reported

The PM QA'd it live and found the drag selects text. Measured again here:

```
document.querySelectorAll('[draggable="true"]').length === 0
```

**Zero draggable elements on the entire reference page.** It never had a drag to
break. `pageerror` on that site: `Minified React error #418`.

---

## 6. THE CENSUSES THAT MOVED — re-argued, never renumbered

| file | figure | argument |
|---|---|---|
| `react/test/size.test.ts` | **523 loc / 2410 nodes** | §6.1 |
| `solid/test/size.test.ts` | **558 loc / 2449 nodes** | §6.1 |
| `angular/test/emitter.test.ts` | `typedInputsSeen` 9 → **10**, untyped **held at 15** | §6.2 |
| `vue/src/gate/index.ts` **12a** | instances **held at 20**, corpus 14 → 15 | §6.3 |
| `vue/src/gate/index.ts` **12b** | entries 26 → **27**, names **held at 7** | §6.3 |
| `vue/test/gate.test.ts` | `SPELLED_NUMBERS` += `TWENTY-EIGHT` | the table's own doc comment instructs it |

### 6.1 The size rows test the rule in the MIDDLE of its range for the first time

S12 opened the claim that emitted size tracks **handler bodies**, not host count;
S15 sharpened it from one end (biggest template, smallest write count). **S16
interpolates it**, and that is the new information:

```
                 hosts  events  writes  react loc  lines/host
S13                 62      27       4        555        8.95
S12                 53       9      19        386        7.28
S16                 89      12       2        523        5.88
S15                 81       7       1        411        5.07
```

S16's event and write counts sit **between** S15's and S13's, and its cost per
host lands **between theirs, in the same order**. Two extremes agreeing could be a
coincidence of two shapes; an interpolated point landing where the rule predicts
is the first evidence here that the relation is monotone.

Line/node split against S15: **1.27× lines on 1.10× hosts, 1.20× nodes** — 7%
apart with **lines ahead**, which is S13's direction rather than S15's. The cause
is in the source and is not flattering: **the two arrow handlers are twenty-line
object-rebuilding `.map` bodies differing by ONE identifier** (`prevId` against
`nextId`), so the app pays twice for one idea. A single handler taking a direction
argument is **not authorable** — it needs either a second argument channel or an
`if`, and `DEFECTS.md` 8.1 closes the second door.

Solid premium re-derived: **1.07× lines, 1.02× nodes**. The series is now
`1.11 / 1.04 / 0.94 / 1.04 / 1.03 / 1.03 / 1.07` across S10–S16 and still refuses
to name a trend — and this widest-since-S10 reading arrives on the application
with the **most duplicated handler text**, the shape most likely to amplify any
per-statement difference.

### 6.2 Angular's untyped arm held for the FOURTH time, on a harder test

`typedInputsSeen` 9 → 10 (one prop entry, `onTrace`, typed).
`untypedInputsSeen` **holds at 15**. S16 tests that hold harder than S15 did: it
takes the largest-template title at **89 hosts**, records **12 events** to S15's 7
and **2 state writes** to S15's 1, and adds **not one** untyped member — because
every one of its nine observables is a `computed` getter or a `class`/`hidden`
binding rather than an `@Input()`. Two applications in a row growing the template
*and* the event count while leaving this arm flat separates *"the untyped surface
is stable"* from *"the last app happened not to touch it"*.

### 6.3 The vue gate — 12a is a THIRD consecutive negative, and the strongest

Re-derived independently with `@vue/compiler-sfc` over the emitted `S16.vue`:

```
S16.vue: value/checked binds = 0   hosts with an on-directive = 12   12a instances = 0
```

**S16 contributes ZERO instances**, so instances hold at **twenty**, applicable at
**nine**, the ratio at 45%, the tag span at `<input>`/`<textarea>`, the
bound-property-kind span at `value`/`checked`.

S13 was a null result that still moved the count. S15 moved nothing but the
scenario count. **S16 moves nothing while carrying TWELVE evented hosts** — more
than any scenario in the corpus except S13's twenty-five — which is what separates
*"this domain has stopped growing"* from *"those two apps happened to have no
forms"*. A page with twelve evented hosts and no bound value is **positive**
evidence that this corpus's interaction surface is clicks, not two-way fields.

**12b** goes 26 → **27** printed entries with distinct names **held at seven for
the seventh consecutive time**, and ZERO is re-derived for the **seventh**. The
re-argument records what is new: S16 is the first module here that **wanted an
interaction it could not have**, and a component that cannot express an
interaction has an obvious escape — push it up to a parent through a written-back
prop. It does not take it.

---

## 7. Derivation — nothing under `generated/`, `src/emitted/` or the CSS copies was hand-written

**19 artifacts**: 1 golden, 6 × `generated/S16.*`, 6 × `src/emitted/TaskBoard.*`,
6 × `board-css/board.css`.

| step | result |
|---|---|
| record `shasum -a 256` of all 19 | 19 digests |
| **delete all 19** | **`PRESENT AFTER DELETE = 0`** — asserted, and the run **aborts** if not |
| `UPDATE_GOLDENS=1` + 6 × `regenerate` + 6 × `copy-emitted` + 6 × `copy-board-css` | `PRESENT AFTER REBUILD = 19` |
| compare | **19/19 BYTE-IDENTICAL** |

The `PRESENT AFTER DELETE = 0` assertion runs **before** the rebuild and gates it.
The six CSS copies are byte-identical to the shared source: **one unique digest
(`f90df591`) over all seven files**.

### 7.1 `git diff` — nothing tracked moved

```
$ git diff --exit-code -- 'packages/frameworks/*/generated' \
    'packages/frameworks/*/generated-composition' 'packages/frameworks/*/generated-persistence' \
    'packages/compiler/test/goldens' 'demos/*/src/emitted' 'demos/*/src/lib/emitted'
exit 0

$ git diff --exit-code -- 'demos/*/public' 'demos/svelte-official/static'
exit 0
```

**No scenario artifact — S1 through S15, in any lane, plus every composition and
persistence artifact and every golden — changed a byte.** Every S16 artifact is
untracked, so the clean exits say nothing about them; their internal consistency
is proved by §7 and by `pnpm test`. Paired with `git status --short` (§10).

---

## 8. Browsable, findable, and NOT a fall-through

`pnpm demo` was **RUN**, and every route it printed was fetched and **hashed**.

```
react    routes=16 distinct=16  /board=200/d4645481  bogus=200/6b286960  fall-through? NO
solid    routes=16 distinct=16  /board=200/85a681ce  bogus=200/71208110  fall-through? NO
qwik     routes=16 distinct=16  /board=200/78f09495  bogus=404           fall-through? NO
svelte   routes=15 distinct=15  /board=200/8d970002  bogus=404           fall-through? NO
vue      routes=15 distinct=15  /board=200/b0726776  bogus=200/dad3b1ac  fall-through? NO
angular  routes=13 distinct=13  /board=200/3a8dd767  bogus=404           fall-through? NO
```

**THE TRAP IS LIVE AND DID NOT FIRE.** react, solid and vue all answer **HTTP 200
on a bogus route**; every lane's `/board` hash is distinct from its bogus hash and
from every other route it serves.

**The qwik trailing slash was re-measured:** `GET /board` → **301**,
`location: /board/`.

### 8.1 The launch commands actually run

All six through `pnpm demo`, which runs each lane's own official dev script:

| lane | command | URL |
|---|---|---|
| react | `pnpm --dir demos/react-official dev` (`PORT=5173`) | `http://localhost:5173/board` |
| solid | `pnpm --dir demos/solid-official dev` (`PORT=5174`) | `http://localhost:5174/board` |
| qwik | `pnpm --dir demos/qwik dev --port 5176` | `http://localhost:5176/board/` |
| svelte | `pnpm --dir demos/svelte-official dev --port 5177` | `http://localhost:5177/board` |
| vue | `pnpm --dir demos/vue-official dev` (`PORT=5179`) | `http://localhost:5179/board` |
| angular | `pnpm --dir demos/angular-official start --port 5180` | `http://localhost:5180/board` |

Ports **5175 and 5178 were SKIPPED** by the preflight with the holder reported.
Nothing was killed.

### 8.2 `pnpm demo`'s hand-written paragraph went stale again, exactly as T004 predicted

T004's blocker: *"a third six-lane app will stale it again and nothing will catch
it."* It did, and nothing did. The closing prose read *"S13 and S15 are the two
that all SIX lanes serve"*, which became false the moment S16 landed. Repaired to
name all three **and** to state the drag verdict in the front door. **The scenario
table is derived; that paragraph is not, and the asymmetry is still worth a card.**

---

## 9. Baselines — none moved

| check | baseline (measured before any edit) | final | gate |
|---|---|---|---|
| `pnpm test` | 1 failed / **1318** passed | **1 failed / 1329 passed** | exactly 1 ✅ |
| `pnpm check` | **267** | **267** | must not rise above 267 ✅ |
| `pnpm e2e` | 6 × 9 | **PASS — 6 demos × 9 scenarios, all observations equal** | 6 × 9 ✅ |
| `pnpm lint` | clean | **0 warnings, 0 errors, 535 files** | clean ✅ |
| `pnpm check:citations` | clean | **clean, 580 swept** | clean ✅ |

The single failure is the foreign `package-inventory` ARM B, byte-identical to the
baseline captured **before any edit on this card**. `+11` tests are the derived
S16 rows the corpus tables generate.

**`pnpm check` held at 267 with SIX new typechecked artifacts** — and holding it
is *the finding*, not housekeeping: the fixture's constraints (13) and (14) are
what kept it there, and the drag measurement in §2.6 is what they were protecting
against.

---

## 10. `git status --short`

Untracked: the fixture, the golden, six `generated/S16.*`, six
`src/emitted/TaskBoard.*`, the qwik and svelte `/board` routes, the angular
`board-page.ts`, `demos/shared/board-css/`, `demos/shared/copy-board-css.mjs`,
six `board-css/` copies.
Modified: the compiler test tables, six `regenerate.ts`, react/solid size tests,
the angular emitter test, the vue gate source and test, six `package.json`, two
`App.jsx`, `App.vue`, `app.routes.ts`, `scripts/demo.mjs`, this note.

`pnpm-lock.yaml`, `pnpm-workspace.yaml` and `website/` show as modified **in the
owner's in-flight state, exactly as at START** — all three fingerprints match §1.

**Nothing was committed.**

---

## 11. Process notes

- **`pkill -f` was never used.** The demo run was stopped by recorded PID
  **31188** and the six ports confirmed free. Both foreign processes were
  re-verified **alive with their original start times**: **64413**
  (`Mon Jul 27 00:48:52`, port 5175) and **24931** (`Thu Jul 30 15:55:20`, port
  5178).
- **No dependency was added.** Playwright and `@vue/compiler-sfc` were resolved out
  of `node_modules/.pnpm`.
- **No emitter, no IR, no authoring surface and no `scripts/e2e.mjs` was touched.**
- **THE DRAG PROBE SCAFFOLD WAS REMOVED.** Answering question (2) needed the
  emitted drag modules running in six real browsers, so a temporary `/dragprobe`
  route was installed in all six shells, driven, and then deleted. Every probe
  module came out of `emit(ir)` + `formatEmitted` — the same two calls
  `regenerate.ts` makes — so no per-lane app code was hand-written even
  temporarily. `git status` carries no probe artifact.

---

## 12. For the next card

- **DRAG IS OPEN IN FIVE LANES AND SHIPPABLE IN NONE OF THEM**, and the blocker is
  a **type baseline**, not an emitter. If `DEFECTS.md` 15 is ever repaired with the
  per-lane spelling map it asks for, the JSX lanes' 13 errors go away and this app
  can grow a real drop zone with **no other change** — its `<ul>`/`<li>` pair is
  already the shape svelte accepts.
- **`DEFECTS.md` 15 IS TOO STRONG AS WRITTEN.** Its title says *"in all six
  lanes"*. Measured: react only. The other five print the real DOM event name and
  fire. **That entry deserves an amendment card** — it is the same react-only
  over-generalisation 12.2 carried.
- **A NEW CONSTRAINT, WIDER THAN T003's:** `draggable="true"` fails qwik's emitted
  typecheck the same way `rows="6"` failed react's. The rule is **no static
  attribute whose DOM type is not `string`** — not merely no numbers.
- **`style` LOWERING IS STILL UNMEASURED IN ALL SIX LANES.** This card was the
  likeliest consumer — a drag ghost or a drop-target highlight — and it never
  needed one, because there is no drag. **Nothing has probed it yet.**
- **ANGULAR'S PROBE PAGE SWALLOWED `mousedown` WHILE DELIVERING `pointerdown`**
  (§2.4), on that page only. Unexplained. If a later card drives pointer input in
  that lane, expect it.
- **`board.css` now exists beside `hn.css`, `habits.css` and `codex.css`.** The
  `:root`/`#root`/`#app` shell neutralisation at its top is what keeps the six
  lanes comparable and must be copied into any new page-scoped sheet.
- **`pnpm demo`'s closing paragraph staled again** (§8.2) — third time predicted,
  first time confirmed. A derived sentence would end it.
