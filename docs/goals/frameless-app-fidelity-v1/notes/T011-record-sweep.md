# T011 — the record sweep, and the count I found rather than inherited

Board: `docs/goals/frameless-app-fidelity-v1/state.yaml`. HEAD at start `8b321af`.
Nothing committed.

---

## 1. The headline

**19 claim-sites across 23 files, not 18.** T009 measured 18. The extra one is
`packages/frameworks/react/scripts/regenerate.ts:99` — a **second** claim in a
file T009 had already counted **once**. Four cards in a row counted the sites a
predecessor quoted; the fifth card counted a predecessor's *files*. So the file
count is unchanged at 23 and the claim count is one higher.

**A twentieth claim-site exists and is OUTSIDE `allowed_files`:**
`scripts/demo.mjs:122`. It is left standing and reported below.

Everything I corrected, I corrected against a measurement **I made at HEAD**.
Nothing here rests on T009's receipt, on T008's body-hash table, or on any two
agents agreeing.

---

## 2. What I measured, before I edited anything

### 2.1 The drag, re-driven in all six lanes

Six lanes launched from their **official** dev/start scripts on ports
5183–5188 (each port confirmed EMPTY before spawn; PIDs 17920 / 17925 / 17930 /
17935 / 17940 / 17945, all six stopped afterwards by their own recorded PID —
nothing else was touched, and nothing was listening on 5173–5181 at any point).

Driven at 1600×1000 with a **real native mouse** — `mouse.move`, `mouse.down`,
twenty interpolated `mouse.move`s, `mouse.up`. **No `DragEvent` is constructed
anywhere in the harness.** Card `t1` from `backlog` onto the `review` column's
`<ul>`. "Stayed" is a second read **1.3 s after the drop**.

| lane | `.tb-card` | `[draggable="true"]` | mid-gesture `data-dragging` | after drop | **stayed** | arrow buttons | arrow moved | console errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| react | 9 | 9 | `[]` | `backlog` | **no** | 2 | yes | **3** |
| solid | 9 | 9 | `["t1"]` | `review` | **yes** | 2 | yes | 4 (HMR only) |
| qwik | 9 | 9 | `["t1"]` | `review` | **yes** | 2 | yes | 0 |
| svelte | 9 | 9 | `["t1"]` | `review` | **yes** | 2 | yes | 0 |
| vue | 9 | 9 | `["t1"]` | `review` | **yes** | 2 | yes | 4 (HMR only) |
| angular | 9 | 9 | `["t1"]` | `review` | **yes** | 2 | yes | 0 |

**FIVE LANES DRAG. REACT DOES NOT. THE ARROWS MOVE A CARD IN ALL SIX.**

React's three console errors, verbatim and captured on a fresh load:

```
Invalid event handler property `%s`. Did you mean `%s`? onDragstart onDragStart
Invalid event handler property `%s`. Did you mean `%s`? onDragend onDragEnd
Invalid event handler property `%s`. Did you mean `%s`? onDragover onDragOver
```

That is `DEFECTS.md` 15, measured rather than quoted. solid's and vue's four
"errors" are Vite HMR websocket noise from two dev servers sharing the default
HMR port — **not** app errors, and they are named as such rather than counted.

On the first of two runs qwik reported `[]` for mid-gesture `data-dragging` and
still landed the drop; on the second it reported `["t1"]`. The fixture header
already records one measured intermittency in that lane and only that lane. It
is left standing, not smoothed over.

### 2.2 `pnpm check`

**START 261. END 261. DELTA 0**, as predicted. The drag is shipped at 261, well
inside the 267 that the stale prose called a wall.

### 2.3 `/hn-item`, re-hashed — and why a status code proves nothing

`HTTP 200` is **not** evidence a page exists in this corpus. React, solid and vue
fall through to `s1` for any unknown path. So every route was fetched and the
**body hashed**, with a nonsense path (`/zzz-not-a-route`) as the control.

| lane | `/hn-item` status | bytes | sha256/12 | control (`/zzz-not-a-route`) | verdict |
| --- | --- | --- | --- | --- | --- |
| react | 200 | 25,333 | `0595e2797c22` | 796 B, `2540b92adb0b` | **serves it** |
| solid | 200 | 31,431 | `43c6494f1de2` | 1,018 B, `fdbd246583ca` | **serves it** |
| qwik | 200 | 226,913 | `4b726393f529` | 404, `2e159237f4ac` | **serves it** |
| **angular** | **200** | **33,915** | **`b72d90db3e52`** | 404, 154 B, `f3d7272abb81` | **SERVES IT** |
| svelte | **404** | 3,396 | `e3dafebd6a9d` | 404, 3,396 B, **`e3dafebd6a9d`** | refuses — byte-identical to its 404 |
| vue | 200 | 3,722 | `24fa9fa5a13f` | 200, 3,722 B, **`24fa9fa5a13f`** | refuses — **byte-identical to a nonsense path**, i.e. the SPA shell |

Angular's `/hn-item` body is distinct from **every other angular route** and
carries `<app-root>`, **15** `<frameless-hn-item>` elements and **14** nested
`.hn-cnest` levels — the self-reference actually rendering, with no fixed depth.

**IT IS FOUR LANES.** `hn.css` said three, and said angular's own gate rejects
the `imports` its recursive component needs. That gate admitted the form.

---

## 3. The population — 19 sites, and how I found them

I swept for the **claim**, in three families, over the whole live tree
(derived trees, `node_modules`, `website/` and prior goal receipts excluded), by
phrase families rather than by any string a predecessor quoted:
`axis … is not (in the file|on (it|the page))`, `arrow buttons? instead`,
`267 (to|->) 280`, `RECORDED rather than shipped`, `UNLIKE S16`,
`three lanes serve`, `angular's own gate`, plus a `[S16|task board]` file list
read one by one.

### Family A — "the drag axis is not on the page" (11 sites)

| # | site | corrected |
| --- | --- | --- |
| 1 | `packages/frameworks/react/scripts/regenerate.ts:76` | ✅ |
| 2 | `packages/frameworks/solid/scripts/regenerate.ts:76` | ✅ |
| 3 | `packages/frameworks/qwik/scripts/regenerate.ts:78` | ✅ |
| 4 | `packages/frameworks/svelte/scripts/regenerate.ts:94` | ✅ |
| 5 | `packages/frameworks/vue/scripts/regenerate.ts:108` | ✅ |
| 6 | `packages/frameworks/angular/scripts/regenerate.ts:151` | ✅ |
| 7 | `demos/angular-official/src/app/board-page.ts:28` | ✅ |
| 8 | `demos/angular-official/src/app/app.routes.ts:231` | ✅ |
| 9 | `demos/qwik/src/routes/board/index.tsx:7` | ✅ |
| 10 | `demos/solid-official/src/App.jsx:368` | ✅ |
| 11 | `demos/svelte-official/src/routes/board/+page.svelte:10` | ✅ |

Site 11 read **"THIS LANE IS THE ONLY ONE THAT REFUSED ANY PART OF IT"** while
svelte is one of the five lanes I watched drag. Its refusal was always about an
**element** (`a11y_no_static_element_interactions` on a `<div>`/`<span>`), and
that refusal is why the drop zone is a `<ul>` and the card an `<li>` — it
**shaped** the markup rather than removing the axis. Same correction in
`svelte/scripts/regenerate.ts`.

`demos/vue-official/src/App.vue` and `demos/react-official/src/App.jsx` were
**already correct** at HEAD and were left alone; vue's board comment reads "THE
AXIS THIS PAGE EXISTS TO MEASURE IS NOW ON IT".

### Family B — the contrast T008 withdrew from react (7 sites, T009 counted 6)

| # | site | corrected |
| --- | --- | --- |
| 12 | `demos/angular-official/src/app/contacts-page.ts:11` | ✅ |
| 13 | `demos/qwik/src/routes/contacts/index.tsx:6` | ✅ |
| 14 | `demos/solid-official/src/App.jsx:402` | ✅ |
| 15 | `demos/svelte-official/src/routes/contacts/+page.svelte:9` | ✅ |
| 16 | `demos/vue-official/src/App.vue:438` | ✅ |
| 17 | `packages/compiler/test/fixtures/s17-contacts.tsrx:12` | ✅ |
| **18** | **`packages/frameworks/react/scripts/regenerate.ts:99`** | ✅ **NEW** |

**Site 18 is the one nobody had counted.** `react/scripts/regenerate.ts` carries
the family-A claim at line 76 *and* the family-B claim ninety lines later, in the
S17 row: *"THE AXIS IS ON THE PAGE THIS TIME, WHICH IS THE DIFFERENCE FROM S16."*
Correcting only the S16 row would have left one file contradicting itself — which
is exactly the failure T008 recorded in `react-official/src/App.jsx` and the
reason its card said the brief "counted files, not claims". The same brief then
counted `regenerate.ts` as one site each.

### Family C — `/hn-item` lane count (1 authored site, 7 files)

| # | site | corrected |
| --- | --- | --- |
| 19 | `demos/shared/hn-css/hn.css:504` + six byte-identical lane copies | ✅ |

Edited **only** the shared sheet, then re-ran `demos/shared/copy-hn-css.mjs` in
all six lanes via each lane's own `copy-hn-css` script. No lane copy was
hand-edited.

**All seven shared `b64089ab` before. All seven share `0973ee54` after.**

---

## 4. What I did NOT correct, and why

- **`scripts/demo.mjs:122`** — *"S17 IS … THE FIRST APPLICATION ROW SINCE S15
  WHOSE AXIS IS ACTUALLY ON THE PAGE."* S16 sits between S15 and S17, so this
  asserts S16's axis is not on its page. **It is false at HEAD.** The file is
  **outside `allowed_files`** — the front door this board has already repaired
  twice still carries the claim in a third place. **Left standing and reported.**
- Prior receipts and notes (`state.yaml`, `notes/T00*.md`) that quote the old
  numbers. History — recorded, never edited.
- `packages/compiler/test/fixtures/s16-task-board.tsrx:64`,
  `scripts/demo.mjs:111`, `packages/frameworks/react/test/size.test.ts:354`,
  `demos/shared/board-css/board.css:556` and its six copies,
  `demos/shared/board-css/README.md` — all read the 267→280 figure as **past
  tense**, and all state the drag is shipped. Checked one by one; **correct at
  HEAD**, so untouched.
- `demos/angular-official/public/contact-css/contacts.css:1080` mentions the 267
  ceiling as a live budget, which it is. Not a drag claim. Untouched.
- `docs/DEFECTS.md` — its one S16 mention (line 2013) already records the shipped
  drag. Watched, and outside `allowed_files` anyway.
- `s17-contacts.tsrx:1018` — T010's, already fixed, verified untouched.

---

## 5. THE FINDING THIS CARD DID NOT EXPECT: a fixture *comment* moves a golden

My first edit to `s17-contacts.tsrx:12` was three rewritten comment lines,
**line-count neutral**. `pnpm test` went to **2 failures**:

```
FAIL packages/compiler/test/enriched-ir.test.ts > golden dumps >
     s17-contacts.tsrx: deterministic across builds and byte-equal to its
     checked-in golden
```

`packages/compiler/test/goldens/s17-contacts.json` records **absolute character
offsets** into the fixture (`"start": 13713`, `"end": 13715`, …). A header
comment sits before every one of them, so **changing its length by one byte
shifts the entire golden** — and `pnpm regenerate` does **not** rewrite goldens
(only `UPDATE_GOLDENS=1 pnpm test` does), so the derivation proof cannot see it.

Two escapes existed and only one is compatible with this card:

1. regenerate the golden — **forbidden**, `packages/compiler/test/goldens` is in
   the derived set this card must leave clean;
2. make the edit **byte-length neutral**.

I took (2). The shipped edit replaces `, AND UNLIKE S16 THE AXIS IS` with
`, AND IN ALL SIX LANES IT IS` — **28 characters for 28**. The fixture is
**49,476 bytes before and 49,476 after**, one line changed, and `pnpm test`
returns to exactly one failure.

**This is a live trap for any future card.** *"Prose-only, so nothing derives"*
is FALSE for `.tsrx` fixtures: any byte-length change in a fixture, comment or
not, moves the checked-in golden. Only a byte-neutral edit is prose-only there.

---

## 6. The derivation proof, and the false pass I re-measured

`git diff --exit-code` over **13 explicitly enumerated** derived paths, after
re-running **all six** `regenerate` steps and **all six** `copy-emitted` steps:
**rc=0, CLEAN**, paired with `git status --short` and with
`git status --porcelain` over the same 13 paths (untracked churn a diff cannot
see). Each path was asserted to **exist and be non-empty** first, so silence
means clean rather than absent — 17/17/17/16/16/17 generated, 17 goldens,
17/17/17/16/17 emitted, 16 svelte emitted.

**The wildcard shape is a false pass, re-measured on my own real changes:**

```
git diff --name-only -- 'demos/*/src'            ->  0 files
git diff --name-only -- demos/qwik/src demos/solid-official/src \
    demos/svelte-official/src demos/vue-official/src \
    demos/angular-official/src                   ->  9 files
```

Nine files I had actually edited, invisible to the wildcard. Git drops
leading-directory matching once a pathspec contains a wildcard. **No wildcard
pathspec appears in this card's proof.**

---

## 7. Verification

| command | result |
| --- | --- |
| `pnpm check` START | **261** |
| `pnpm check` END | **261** — delta **0**, as predicted |
| `pnpm test` | **exactly 1 failure**, the foreign ARM B peer-suffix inventory (`pnpm-lock.yaml`, the owner's dirty file — not mine) |
| `pnpm e2e` | **PASS**, run alone. `Three-way: 6 demos x 9 scenarios, all observations equal` |
| `pnpm lint` | 0 warnings, 0 errors, 558 files |
| `pnpm check:citations` | clean over 4 watched documents, 17 watched source files, 610 swept |
| derived trees | `git diff --exit-code` **rc=0** over 13 explicit paths after 6 regenerate + 6 copy-emitted |
| seven `hn.css` | one digest before (`b64089ab`), **one digest after (`0973ee54`)** |

Owner's three dirty paths, fingerprinted at START and FINISH with
`shasum -a 256`, whole output **lines** sorted:
`f326d314` / `aeb7edc1` / `f936e169`, **116 files** — identical at both ends.
Never staged, never `git add -A`.

---

## 8. What is still open

1. **`scripts/demo.mjs:122`** — the twentieth claim-site, outside
   `allowed_files`. One line, prose only.
2. The `.tsrx`-golden coupling in §5 belongs in whatever this board tells the
   next card about "prose-only" edits.
