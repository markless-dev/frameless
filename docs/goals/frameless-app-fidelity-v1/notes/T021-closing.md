# T021 — the closing card

**Written by the PM from T021's receipt.** The Worker's harness forbids it writing report `.md`
files; it said so and returned its findings as the receipt, which is the ruled behaviour on this
board (seven agents before it did the same). Nothing here is the PM's own measurement except where
it says so.

## Counts

Briefed for **four** sites in six files. Corrected **eight**. Twelfth card running to exceed its
brief's count. **No leak** — every one of the eight was inside `allowed_files`, and the
`packages/frameworks/angular/test/` layer moved **whole**, 0 → 3 of 3 plus a fourth site in the
same layer, so the layer is self-consistent at every point.

Measured by T021 itself, not copied from the card: `../emitted/` imports in `app.routes.ts` = **8**
(lines 3, 5, 6, 13, 14, 15, 16, 19); `ANGULAR_UNBUILT_SCENARIOS` = `[]`; `angular/generated/S11.ts`
(10,858 B) and `S12.ts` (10,086 B) both present, 17 artifacts S1–S17. Ruling 11 derivations at
HEAD: six-lane applications 7, corpus applications 8, corpus lanes 6, wrapper components 9,
application routes 8.

## The eight sites

| Site | Was | Ends |
|---|---|---|
| `gate.test.ts:66-68` | "this lane REFUSES S11 … no artifact for the gate to read" | prose-discipline; the facts it now names are machine-asserted by `emitter.test.ts` |
| `emitted-typecheck.test.ts:89-90` | "the underlying refusal is live" | prose-discipline; byte-identical to its twin, as before |
| `parse-emitted.test.ts:45-46` | byte-identical twin | prose-discipline |
| `emitted-typecheck.test.ts:150` **(beyond brief)** | "S8 is blocked on T046 and T047" | false at HEAD — both repairs landed, all six lanes carry a `generated/S8` |
| `app.routes.ts:25` | "the five components below are frameless-emitted" | count **removed** (OD3 half one); names `../emitted/`, greppable in one command |
| `app.routes.ts:137-138` **(beyond brief)** | "the FIFTH AND SIXTH LANES for S11 and S12" | position **removed**; it counted *repair order* and attached it to two **routes**, which are not lanes |
| `demos/qwik/src/routes/hn/index.tsx:37-41` **(beyond brief, inherited)** | "the one lane of the six that reaches /hn-item without a document reload" | false — measured sink by sink, **two** lanes |
| `demos/svelte-official/src/routes/hn/+page.svelte:6-7` **(beyond brief, inherited)** | "THE SHORTEST OF THE SIX BECAUSE this lane has one destination" | superlative measured **true** (32 chars vs vue 44) but the **because** was false — vue also has one destination and is longer |

## The two inherited files

T020 wrote to these two outside its `allowed_files`; the board checker caught it, the PM kept the
edits and recorded T020 **blocked**. T021 formally owned them and **re-measured rather than
accepting them**: T020's substantive claim is **correct** in both (all six lanes carry S10, S11 and
S12), and its meta-claim that a `.svelte` file is invisible to `check:citations` is **true** — 0 of
610 swept files are `.svelte` or `.vue`. **But they were not complete.** Each carried a separate
false sentence T020 never touched, and T020 left a broken line wrap in the qwik file. All fixed.

## Why no ruling-11 extension

Verify #3's guard clause is conditional — *"if a count stays and is guardable"*. After applying
OD3's **first** half, which the card says to prefer, **no fragile count stays** at any of the eight
sites. T021 measured the one candidate new noun, `emitted components`, and it would have had
**zero** live sites after the fix. OD3's own scope warning rules the path: *"A guard that is not
PROVEN RED-CAPABLE against REAL stale sites is worse than no guard."* There was nothing real left to
prove it red against, so no mutation demo is claimed.

## Its own instrument failed first

T021's first sweep keyed off each **line's** opening characters and therefore dropped every
continuation line of an `<!-- … -->` block — **the svelte HN route's entire 50-line header was
invisible to it**. Rebuilt as a real state machine handling `//`, `/* */` and `<!-- -->`: 6 files,
153 comment blocks, 15 family candidates. Sixth vacuous-instrument catch on this board.

## Deliberately not touched, recorded for the audit

- **`gate.test.ts:50` "four more scenarios are queued"** — false read at HEAD (17 exist, none
  queued), but it is a present-tense clause inside an **explicitly dated past-tense paragraph**.
  Left under the stop_if on dated records rather than ruled on unilaterally.
- **"SEVENTEEN OF THE THIRTY-ONE STUBS"** — T021 verified **seventeen** by enumeration (9
  masthead/nav + 8 footer) but could **not** derive **thirty-one**: it counts 26 `onTrace` sites and
  27 handler attributes; 31 appears to be a *rendered* link count. Not a measured stale site, so
  untouched — **but it lives in five places and three are outside any card's reach so far**:
  `packages/compiler/test/fixtures/s13-hn-front.tsrx` (a fixture, forbidden by name),
  `demos/react-official/src/App.jsx`, `demos/solid-official/src/App.jsx`.

## Verification at the true final bytes

`pnpm check` 261 → 261 (START measured at HEAD by the Worker, not inherited) · `pnpm test` 1 failed
/ 1473 passed, the foreign ARM B only · `pnpm e2e` 6 × 9 PASS, run alone, **twice**, the second on
the final bytes · `pnpm lint` 0/0 over 558 files · `pnpm check:citations` clean, 4 documents / 17
watched source / 610 swept, unchanged · derivation proof over **28 explicit paths** (T020 used 20),
each asserted to exist and be non-empty, `git diff --exit-code` **one path at a time**, no wildcard
pathspec anywhere · **zero non-comment lines changed in all six files** — PM independently
re-verified this and the guard's five recompiled subjects.

## Its verdict, unedited in substance

The last known population is closed. **The method has not converged.** Briefed for four, found
eight — a 100% over-run is not evidence of convergence but evidence that a per-card sweep still
finds more wherever it points. Two of the four extra sites were in the very files a predecessor had
just edited and the PM asked it to "confirm correct". The highest-yield successor target is the
three unowned files carrying "thirty-one", one of which is a `.tsrx` fixture no card on this board
has been allowed to open. And the structural limit is permanent: `.svelte` and `.vue` prose — **two
of the six lanes** — can never be guarded by `check:citations`. That is a property of the
instrument, recorded in ruling 11, not a defect to close.
