# T004 — drag and drop on the task board, and four now-false claims

Board: `docs/goals/frameless-app-fidelity-v1/state.yaml`. HEAD at start `b873451`.
Nothing committed.

---

## 1. The headline

**S16 drags.** A real mouse drag moves a card between columns and it stays there
in **five lanes — solid, qwik, svelte, vue and angular**. **React is inert on
drag**, exactly as predicted, keeps the ◀ ▶ arrows, and the page says so in
words. The arrows still work in **all six**.

`pnpm check` **251 → 261**. The rise was **stated in advance** (see §5) and every
one of the ten new lines is attributed.

---

## 2. ORACLE PART 1 — measured against the reference, never against the lanes

Reference: **<https://square-ui-task-management.vercel.app/>** (`zerostaticthemes/square-ui`),
the reference `demos/shared/board-css/README.md` names. Licence-restricted to
reference-only, so nothing was copied; the capture stays in the session
scratchpad and every reading is transcribed here as a number.

Captured **rendered** at 1440×1000 with a real user agent. **HTTP 200**,
`document.title` = `"Task Management"`, 161,874 bytes of DOM.

| feature | reference | ours (`/board`) | verdict |
| --- | --- | --- | --- |
| `<h1>` | `"Task"` | `"Task"` | EXACT |
| card title type | `14px/500` | `14px/500` (board.css) | EXACT |
| first card title | `Mobile app redesign` | `Mobile app redesign` | EXACT |
| next five titles | API documentation update, Accessibility improvements, Design system update, Retention rate by 23%, Icon system | identical | EXACT |
| columns | Backlog / Todo / In Progress / Technical Review | same four | EXACT |
| Filter, Sort, Request task, Share, Add task | all present | all present | EXACT |
| `<h3>` card titles | 19 | 0 | **DELIBERATE** — a lone `<h3>` under no `<h2>` is a heading-order defect; ours are `<span>` |
| `<li>` | 0 | 9 | **DELIBERATE** — svelte refuses a drag handler on a static element, so cards are `<li>` in a `<ul>` |
| **`[draggable]`** | **0** | **9** | **WE OVERSHOOT THE REFERENCE** |
| cursor over a card | `auto` | `grab` | ours only |
| card count | 19 | 9 | recorded seed difference |

### The reference has no drag, and that was DRIVEN, not asserted

A real mouse drag of the reference's first card toward the far column:

- card order **before == after**, verbatim, all 19 titles;
- what the gesture actually did was **select text**:
  `"\nComplete redesign of mobile application for better UX\n\nDesign\nFeb 10\n2\n5\n3\nAPI "`.

That reproduces the PM's original live QA note exactly, with the selected string
captured. **`document.querySelectorAll('[draggable]')` returns ZERO** on that
page — not merely `[draggable="true"]`, which is the stronger reading.

**STATED PLAINLY: this page now does something the thing it copies does not do.**

No part of this section rests on cross-lane agreement.

---

## 3. The drive — a REAL MOUSE, never a synthetic `DragEvent`

`page.mouse.move/down/move×4/up` through playwright's real input pipeline.
Chromium turns that into a native HTML5 drag on a `[draggable=true]` element. No
`DragEvent` is constructed anywhere in the harness.

Ports (allocator routed around four occupied ones and killed nothing):
react 5173, solid 5174, qwik 5176, svelte 5177, vue 5179, angular 5181.

| lane | body distinct | draggables | mid-drag `data-dragging` | card moved | **stayed** | arrows | derived moved |
| --- | --- | --- | --- | --- | --- | --- | --- |
| react | true | 9 | `[]` | **false** | false | **true** | true |
| solid | true | 9 | `["t1"]` | true | **true** | true | true |
| qwik | true | 9 | `["t1"]` | true | **true** | true | true |
| svelte | true | 9 | `["t1"]` | true | **true** | true | true |
| vue | true | 9 | `["t1"]` | true | **true** | true | true |
| angular | true | 9 | `["t1"]` | true | **true** | true | true |

"Stayed" is a **second read 1.3 s after the drop**: a lane that re-seeded on the
next tick would pass "moved" and fail this.

**HTTP 200 was never read as proof.** Every lane's `/board` body was SHA-256'd
against a bogus route's body; **all six distinct**, and `data-app="task-board"`
is in the SSR payload of all six.

### React's inertness, measured three ways at HEAD

1. **The card does not move.** `midDragging` is `[]` — `dragstart` never fired,
   so `dragId` never left `''`.
2. **react-dom says so itself, at runtime, on the shipped page:**
   ```
   Invalid event handler property `onDragstart`. Did you mean `onDragStart`?
   Invalid event handler property `onDragend`.   Did you mean `onDragEnd`?
   Invalid event handler property `onDragover`.  Did you mean `onDragOver`?
   ```
   Three warnings, three spellings. This is the first time DEFECTS.md 15's
   runtime half has been reproduced on **drag** events (T011 measured `keydown`
   and `dblclick`).
3. **The arrows still move a card in react**, and move the derived set with it.

**React is NOT reported as dragging anywhere in this card.**

### NEW MEASUREMENT: it is FIVE lanes, not four

DEFECTS.md 15 records **four** lanes completing an end-to-end HTML5 drag (solid,
qwik, svelte, vue) and says angular "fired all five synthetically while that
probe page produced no native drag at all — **unresolved rather than settled**".

**Angular now completes a real native mouse drag on a real shipped page.** That
resolves it: five, not four. (DEFECTS.md is outside this card's `allowed_files`
— see §8.)

---

## 4. Negative controls — the assertion CAN fail

**Cross-lane is not offered as evidence of fidelity**; these are in-lane.

**Control A — the identical gesture onto a non-drop zone.** Drag `t1` onto
`[data-tb="sidebar"]`, which has no `dragover` handler, so no `preventDefault`,
so the browser must refuse:

| lane | onto sidebar | then onto a real zone |
| --- | --- | --- |
| solid | **backlog (refused)** | progress (accepted) |
| qwik | **backlog (refused)** | *see §6* |
| svelte | **backlog (refused)** | progress (accepted) |
| vue | **backlog (refused)** | progress (accepted) |
| angular | **backlog (refused)** | progress (accepted) |

The harness is therefore not "any mouse gesture moves a card".

**Control B — react is a live negative control** on the same run: `dragMoved`
reports `false` and is printed, not swallowed.

**Control C — the gate rules.** `react/no-unknown-property` and
`solid/event-handlers` are each driven in three arms through the same
`checkSources` entry point the assertion uses: the flattened spelling REPORTS,
the framework's own spelling is SILENT, and an unrelated two-word event REPORTS.
Arm B is the one that matters — it proves the rules answer to the **spelling**,
not to the presence of a drag handler.

---

## 5. The check budget — stated in advance, then attributed

The a-priori prediction was written to the scratchpad **before the fixture was
edited and before anything was typechecked**:

> **PREDICTED DELTA +13, END 264.** react +5 or +6, solid +6, qwik +0..+1,
> svelte/vue/angular +0. **BOUND STATED IN ADVANCE: the rise WILL NOT EXCEED +16
> (END 267).**

**MEASURED: 251 → 261, +10.** Under the prediction and well under the bound.

| lane | start | end | delta |
| --- | --- | --- | --- |
| react | 108 | 113 | +5 |
| solid | 73 | 78 | +5 |
| qwik | 70 | 70 | **+0** |
| root / svelte / vue / angular | 0 | 0 | +0 |

Every new line, individually:

```
react/generated/S16.tsx(367,10) TS2322   <ul> attribute object carries onDragover
react/generated/S16.tsx(367,23) TS7006   onDragover param loses its contextual type
react/generated/S16.tsx(417,12) TS2322   <li> attribute object carries onDragstart
react/generated/S16.tsx(417,26) TS7006   onDragstart param
react/generated/S16.tsx(426,24) TS7006   onDragend param
solid/generated/S16.tsx(367,11) TS2322   same <ul>
solid/generated/S16.tsx(367,24) TS7006   onDragover param
solid/generated/S16.tsx(431,14) TS2322   same <li>
solid/generated/S16.tsx(431,28) TS7006   onDragstart param
solid/generated/S16.tsx(439,26) TS7006   onDragend param
```

**Two parts of the prediction were wrong and both are worth recording.**

1. I predicted **four** handlers would lose contextual typing per lane. It is
   **three**. `onDrop` is ONE word, so `.toLowerCase()` is a no-op on it and it
   round-trips to both frameworks' own prop name — tsc types it
   `(event: DragEvent<HTMLUListElement>) => void` **inside the very object it is
   rejecting**. One element, two handlers, only the two-word ones broken: the
   whole mechanism of DEFECTS.md 15 in a single diagnostic.
2. I predicted qwik **+0..+1**. It is **+0**, because the fixture **binds**
   `draggable={task.id !== ''}` instead of spelling `draggable="true"`. The
   entire qwik cost in the earlier 267→280 probe was that one static attribute
   against `draggable?: boolean`. Constraint (14) held and the line never
   appeared.

**tsc's own words on the react lane:** `Did you mean 'onDragOver'?` — it named
the authored spelling the compiler destroyed.

---

## 6. FINDING: the qwik lane loses one drop after a cancelled drag

Reproduced from a **fresh page**, real mouse, three arms:

| sequence | result |
| --- | --- |
| drop, drop | both land |
| **cancel**, drop, drop | **FIRST DROP LOST**, second lands |
| **cancel, cancel**, drop, drop | **FIRST DROP LOST**, second lands |

"Cancel" = a drag released outside any drop zone (sidebar, the Share button and
the headline all reproduce it).

**Every visible precondition is correct when the drop is lost:** the `drop` event
is delivered to the column's `<ul>`, `defaultPrevented` is `true` so the
`dragover` guard ran, `data-dragging` reads the right card so `dragId` holds the
right id, and there is **no console error and no page error**. A 2.5 s settle
does not help. Svelte run through the identical sequence lands the drop.

**The mechanism is UNRESOLVED and is recorded as unresolved.** The suspect is
visible in the emitted output — qwik alone splits the handler into a synchronous
`sync$` that calls `preventDefault()` and a lazily-resolved `$()` that does the
work — but the settle result argues against the obvious version of it and it was
not proven. It sits inside qwik's own resumability envelope and is **not a defect
to file upstream**.

It is written into the S16 fixture header, where every other measured lane limit
in this corpus lives.

---

## 7. The four now-false claims — and the brief undercounted one site

1. **`scripts/demo.mjs`** — `unbuilt: { S11: ANGULAR_REFUSAL, S12: ANGULAR_REFUSAL }`
   is now `unbuilt: {}` and the `ANGULAR_REFUSAL` constant is **deleted**, not
   left dangling. `pnpm demo` was run and now prints, for angular:
   `S11 /todomvc-advanced` and `S12 /codex`, with **no refusal line**, and the
   derived sentence reads
   *"Of those, S10, S11, S12, S13, S15, S16, S17 are the **7** that all SIX lanes
   serve"* — up from 5.
2. **The S16 row and banner paragraph** in the same file, which claimed the page
   had no drag and quoted 267→280.
3. **`demos/vue-official/src/App.vue`** — **the brief and T007 both said THREE
   blocks. There are FOUR.** The S11 block, the S12 block, the S13 block *and*
   the **S15 block**, which states `S11 and S12 EMIT in this lane ... and THROW
   IN THE BROWSER — '_ctx.Promise is not a constructor'` as live. All four are
   corrected; the S16 block in the same file was also stale and is corrected.
   **Leaving the S15 one would have kept the lie in the very lane T007 repaired.**
4. **The S11 and S12 fixture headers** — both rewritten to record the refusals as
   history with the shape preserved, since the *shape* of the two failures is the
   finding.

Editing the S11/S12 headers moved their goldens. **Every changed line in both is
a `start`/`end` source span and nothing else** (4046 and 2600 changed lines,
zero non-span lines), and **no S11/S12 emitted artifact moved in any lane.**

---

## 8. Six MORE files carry the same stale drag prose, and they are out of scope

`demos/vue-official/src/App.vue` was the only host file in `allowed_files`. Six
others carry now-false S16 drag claims (`no drag`, `267 -> 280`):

- `demos/react-official/src/App.jsx`
- `demos/solid-official/src/App.jsx`
- `demos/qwik/src/routes/board/index.tsx`
- `demos/svelte-official/src/routes/board/+page.svelte`
- `demos/angular-official/src/app/board-page.ts`
- `demos/angular-official/src/app/app.routes.ts`

Not touched. Same class as the `demo.mjs` blocker T007 recorded rather than
reaching outside its slice.

---

## 9. What the gates said, and what was done about it

Shipping the axis produced **six** new gate violations across two lanes. They
were **not** silenced.

**Fixed at source (2):**

- `react/no-unescaped-entities` — my `.tb-note` prose contained an apostrophe.
  Reworded.
- `no-unused-vars` ×2 — `const currentState2` dead in `onDragStart`/`onDragEnd`.
  **A real react emitter wart, newly surfaced:** the emitter opens every handler
  that WRITES a `useRef`-lowered cell with a snapshot local, and these are the
  first handlers in the corpus that write a cell without reading it. Routed
  around rather than silenced by binding `data-dragging` into the template, which
  makes `dragId` a template read and therefore `useState` rather than `useRef` —
  **and buys the dragging highlight the fixture had refused**, through a bound
  `data-` attribute and a CSS attribute selector, with no bound `class` or
  `style`. The wart is recorded in constraint (13); it is *avoided here*, not
  fixed.

**Recorded exactly, with calibration (3+3):** the three `no-unknown-property`
(react) and three `solid/event-handlers` (solid) violations are DEFECTS.md 15
itself and cannot be avoided while shipping the axis. Each list is asserted by
**exact equality** minus the line ordinal, so a fourth violation still fails; the
rule is not disabled; and the new calibration test proves each rule still
reports.

### And the two gates disagree about the same emitted string

| lane | rule | message |
| --- | --- | --- |
| react | `react/no-unknown-property` | **"Unknown property `onDragstart`"** |
| solid | `solid/event-handlers` | "should be renamed to `onDragStart` **for readability**" |

One emitted spelling, two linters, and only one is describing a broken binding.
**That is a third independent instrument agreeing DEFECTS.md 15 is REACT-ONLY**,
after the six-lane emitter probe and the driven browser — and the first one that
is **static**, so it runs on every `pnpm test`.

The solid `emitted-typecheck` rows say the same thing in the other direction:
solid's tsc *also* rejects the spelling, but solid delegates by lowercasing the
suffix, so it is a **type-surface gap, not a dead binding**. That distinction is
written into both tables so nobody copies the react framing into the solid lane.

---

## 10. Derivation proof — with a shell ARRAY, and one caught vacuity

**21 artifacts** (3 goldens, 6 `generated/`, 6 `src/emitted/`, 6 lane copies of
`board.css`):

```
ARTIFACT COUNT: 21
PRESENT BEFORE: 21
PRESENT AFTER DELETE: 0      <- ASSERTED BEFORE ANY REBUILD
ALL 21 REBUILT BYTE-IDENTICAL
```

Run twice (before and after the last header edit). The list is read into a
`while IFS= read -r` array, because **zsh does not word-split**.

**A vacuity I caught in my own proof.** The `generated/` ↔ `src/emitted/`
pairwise check first used `set -- $p` on a two-path string; zsh did not split it,
both digests came out **empty**, and the comparison printed `EQUAL` **six times
for the wrong reason**. Redone with real arrays and an explicit empty-digest
abort: **6 of 6 genuinely equal**, digests printed. Same trap T001 hit, caught
the same way.

**A separate derivation fact worth keeping:** a header-comment-only edit to the
fixture moved **the golden and nothing else** — all six emitted artifacts stayed
byte-identical. That is why the size budgets and gate line expectations did not
have to be touched twice.

---

## 11. Regression sweep

| command | result |
| --- | --- |
| `pnpm test` | **1 failed / 1412 passed** — exactly the foreign `package-inventory` ARM B |
| `pnpm e2e` | **PASS — 6 demos × 9 scenarios, all observations equal** |
| `pnpm lint` | 0 warnings, 0 errors over 558 files |
| `pnpm check:citations` | clean, 4 documents / 17 watched / 610 swept |
| `pnpm check` | **251 → 261**, attributed line by line above |
| `pnpm demo` | six lanes up, angular's two routes printed, derived count 5 → **7** |

`git diff --exit-code` is clean over every artifact this card did not intend to
move — qwik/svelte/vue/angular `src/`, every other s-numbered fixture, golden and
generated file, and all five demo host directories other than
`demos/vue-official/src/App.vue`.

**Owner paths, `shasum -a 256`, relative, whole lines sorted, START and FINISH:**

```
f326d314c25619b6608f95c4f6c60f882c6db32902d181e0f0a7de0b14f4fc4a  pnpm-lock.yaml
aeb7edc10eefe317eacf7e330d7f1ce3f593f2789ff670e98d7e1434a4ef245e  pnpm-workspace.yaml
f936e169d45d39afba81d2964b29cf803516b2c0e89501cc41787c7a7336cdfa  website/ (116 files)
```

Identical at both ends. Not touched, not cleaned, not committed.

**Foreign PIDs.** 64413 (5175), 24931 (5178), 31456 (5180) and 51893 (4173) were
all confirmed alive at start and at exit. `pkill` was never run in any form; the
demo was stopped by its own recorded PID.
