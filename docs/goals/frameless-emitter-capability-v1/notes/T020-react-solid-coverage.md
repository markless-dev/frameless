# T020 — react and solid: 11 of 19 → 19 of 19, and the honest total is 267

Measured 2026-07-28/29 at HEAD `02c3179` (+ this task's two `include` edits). Every
membership claim below is proven by a planted `TS2304` observed and then removed, with a
**causal control arm** the card did not ask for. No claim rests on a project reporting zero.

## 0. The change

Two lines of `include`, nothing else. No compiler option, no `exclude`, no `skipLibCheck`,
no `checkJs` flip, no emitter/gate/generated-file edit.

```
packages/frameworks/react/tsconfig.json
packages/frameworks/solid/tsconfig.json
  + "generated/**/*.tsx"
  + "generated-composition/**/*.tsx"
  + "generated-persistence/**/*.tsx"
```

The artifacts are now enrolled **directly**. That is the point: the fault T019 found was a
*transitive* reach — the artifacts were in the program only because a browser test happened
to import them. Membership that depends on a test's import list is membership that silently
lapses the moment the import list changes.

## 1. Method — plant, control, revert

1. `const __T020_PLANTED_PROBE__ = __T020_MISSING_SYMBOL__;` appended to **all 38** artifacts
   (19 react + 19 solid). `TS2304` prints `Cannot find name '__T020_MISSING_SYMBOL__'`, which
   is greppable; `TS2322` does not name the identifier, which is why T019 had to redo its
   first plant round.
2. **Treatment arm** — plant present, new `include` present: **19 of 19 hits in each lane.**
3. **Control arm** — *plant still in place*, `tsconfig.json` reverted to its dispatch state:
   **11 of 11 hits in each lane**, and the 8 misses are exactly
   `generated/S4 S5 S6 S7 S9`, `generated-composition/M1-panel`, `M2-page`,
   `generated-persistence/P1.tsx`.
4. Revert (`git checkout --` over the six generated dirs) + marker sweep over
   `packages demos scripts probes`: **zero residue.**

Step 3 is what makes this causal rather than correlational. Holding the plant fixed and
moving only the `include` shows the `include` is the sole variable, and it independently
reproduces T019's census file-for-file without inheriting it.

Cross-check, independent of the plant: `tsc -p <project> --noEmit --listFiles` before the
edit lists exactly the same 11 per lane.

## 2. The numbers

| Quantity | T019 (dispatch) | After T020 |
|---|---|---|
| `pnpm check` total | 186 | **267** |
| — root `tsc -p .` | 0 | 0 |
| — react | 69 | **117** (+48) |
| — solid | 47 | **80** (+33) |
| — qwik | 70 | 70 |
| — svelte / vue / angular | 0 (= not covered by this instrument) | 0 (unchanged) |
| react artifacts covered | 11 of 19 | **19 of 19** |
| solid artifacts covered | 11 of 19 | **19 of 19** |
| Artifacts covered by a standing **invoked** instrument (all 80) | 41 | **57** |

`267` was verified two ways, as T019 verified `186`: by the runner
(`pnpm check`, exit 6 = three projects × exit 2), and by summing seven independent
`tsc -p <project> --noEmit` invocations counted outside the script. They agree exactly.

**The pre-existing 116 did not move.** Summed per artifact, the eleven already-covered react
files still total exactly 69 and the eleven solid files still total exactly 47. The delta is
purely additive: 48 + 33 = **81 errors that no instrument in this repo had ever reached.**
Nothing was hidden to make a number smaller.

Also worth recording: **every one of react's 117 and solid's 80 is inside emitted output.**
Neither project reports a single error in its own `src/`, `test/` or `scripts/`. (Contrast
qwik, where T019's new project surfaced 1 real error in `test/gate.test.ts`.)

## 3. Per-artifact census — react and solid, 19 of 19 each

All 38 rows are COVERED by a standing, invoked instrument (`pnpm check`, and CI's check job),
membership proven by plant. `NEW` marks an artifact reached by nothing before this task.

| Artifact | react | solid |
|---|---|---|
| `generated/S1.tsx` | 1 | **0 (clean, proven)** |
| `generated/S2.tsx` | 11 | 9 |
| `generated/S3.tsx` | 3 | 2 |
| `generated/S4.tsx` **NEW** | 9 | 6 |
| `generated/S5.tsx` **NEW** | 3 | 1 |
| `generated/S6.tsx` **NEW** | 4 | 1 |
| `generated/S7.tsx` **NEW** | 8 | 6 |
| `generated/S9.tsx` **NEW** | 7 | 5 |
| `generated-composition/C1-slot.tsx` | 1 | 1 |
| `generated-composition/C2-shared.tsx` | 30 | 6 |
| `generated-composition/C3-ref.tsx` | 4 | 9 |
| `generated-composition/C4-attach.tsx` | 3 | 10 |
| `generated-composition/C5-props.tsx` | 1 | 2 |
| `generated-composition/C6-scalar-context.tsx` | 2 | 3 |
| `generated-composition/C7-object-context.tsx` | 6 | 5 |
| `generated-composition/C8-page-store.tsx` | 7 | **0 (clean, proven)** |
| `generated-composition/M1-panel.tsx` **NEW** | 2 | 1 |
| `generated-composition/M2-page.tsx` **NEW** | **0 (clean, proven)** | **0 (clean, proven)** |
| `generated-persistence/P1.tsx` **NEW** | 15 | 13 |
| **total** | **117** | **80** |

`M2-page.tsx` is the board's fourth and fifth covered-and-genuinely-clean artifact: both
took the planted error and reported it, and both are at 0 without it.

## 4. What the 81 new errors actually are

| Code | react | solid | Meaning |
|---|---|---|---|
| TS7006 / TS7031 / TS7005 / TS7034 | 46 | 29 | implicit `any` on an emitted parameter or binding element |
| TS7017 | 1 | 1 | `globalThis[...]` has no index signature |
| TS18046 | 0 | 2 | `'storeDraft' is of type 'unknown'` |
| TS2345 / TS2769 | 1 | 1 | genuine assignability failure |

**76 of 81 are the missing-annotation fault this whole phase exists to fix.** That is the
expected shape and it is good news for IR-8: the newly exposed artifacts fail for the *same*
reason the already-exposed ones do, so the phase's fix should close them too.

Two findings that are **not** annotation faults and are new to the board:

1. **`generated/S7.tsx` reports the same defect in both lanes, at the same site.**
   - react `S7.tsx(110,14)`: `TS2345: Argument of type '"on" | null' is not assignable to
     parameter of type 'SetStateAction<null>'.`
   - solid `S7.tsx(105,14)`: `TS2769: ... Argument of type '"on" | null' is not assignable to
     parameter of type '((prev: null) => null) | null'.`

   A cell initialised `null` is later set to `"on"`. Two independently written emitters
   produce the identical unsound shape from the same scenario, which points at the IR or the
   scenario rather than at either emitter. This is a widened-initialiser problem, not a
   missing annotation — an `any` on the parameter would *not* have surfaced it, and it is
   invisible to `pnpm e2e`, which passes S7 in all six lanes.

2. **`generated-persistence/P1.tsx` reports `TS7017` in both lanes** on the
   `globalThis`/`window.__FRAMELESS_STATE__` read that the persistence design depends on.
   Also structural, also identical across lanes, also not an annotation.

Neither is repaired here: both need an emitter or generated-file edit, which this card's
`stop_if` forbids. Reported, not repaired.

## 5. Correction to the T020 brief

**"`S1 S2 S3` arrive via three *different* tests"** — true of **react only**, and the brief
states it of "either lane". Measured import graph:

| Lane | S1 | S2 | S3 |
|---|---|---|---|
| react | `emitted-smoke` + `strictmode` | `emitted-smoke` + `strictmode` | `emitted-smoke` + `strictmode` + `action-order` |
| solid | `emitted-smoke` | `emitted-smoke` | `emitted-smoke` |

**Solid's three all arrive through one test**, `test/emitted-smoke.browser.test.ts`. The T019
census got this right; the brief mis-summarised its own input. It matters because it makes
solid's pre-T020 coverage *more* fragile than the brief describes, not less: a single file's
import list was carrying eleven of nineteen artifacts, and deleting one `import` line would
have silently dropped three of them out of `pnpm check` with the total going *down* and every
gate staying green.

A related detail worth recording: the transitive channel was
`import { RenderOnce } from '../generated/S1.jsx'` — a `.jsx` specifier resolving to a `.tsx`
file. Coverage depended not just on a test importing the artifact but on an extension rewrite
resolving the way the bundler expects. The direct `include` removes both dependencies.

Everything else in the brief that was checkable was checked and **held**: `pnpm check` 186 =
react 69 + solid 47 + qwik 70; `pnpm test` 1235/1; the eight per-lane artifacts reached by
nothing are exactly the eight named; and the three owner-path fingerprints
(`f326d314`, `aeb7edc1`, `f936e169`) reproduce byte-for-byte.

## 6. What is deliberately *not* done here

- **svelte and vue are untouched.** Their instruments (`vue-tsc -b`, `svelte-check`) resolve
  only from `demos/vue-official` / `demos/svelte-official`, hold **62 measured real errors**,
  and are invoked by nothing. Wiring them needs a ruling, not a Worker slice.
- **qwik and angular are untouched.** qwik was closed by T019 at 11 of 11; angular's
  `generated/S1..S9` is covered-and-clean by `ng build` inside `pnpm e2e`.
- **Angular's `generated-composition/C1-slot M1-panel M2-page`** (3 artifacts) and
  **svelte's / vue's `M1-panel M2-page`** (4 artifacts) remain reached by nothing at all.
  Nothing in this repo copies them into the demo that owns the instrument, so closing them is
  a demo/script change, not a tsconfig change.
- **The two structural defects in §4 are left standing.** Repairing them requires an emitter
  or generated-file edit.

## 7. Standing coverage after T020 — all 80 artifacts

| Lane | Covered by an invoked instrument | Shadow | Unreached |
|---|---|---|---|
| react | **19 of 19** | 0 | 0 |
| solid | **19 of 19** | 0 | 0 |
| qwik | 11 of 11 | 0 | 0 |
| angular | 8 of 11 (`pnpm e2e`) | 0 | 3 |
| svelte | 0 of 10 | 8 | 2 |
| vue | 0 of 10 | 8 | 2 |
| **total** | **57 of 80** | **16** | **7** |

Three lanes are now complete. The remaining 23 are the ruling (16 shadow) and a demo-copy
question (7 unreached), neither of which is a tsconfig.
