# T019 — the honest denominator: a per-artifact type-check coverage census

Measured 2026-07-28 at HEAD `857744f` (+ this task's two edits). Every membership claim
below was proven by **planting a deliberate error in the artifact and observing the
instrument report it**, then removing it. No claim rests on a project reporting zero.

## 0. Method

`pnpm check` reported 116 at dispatch. The board already knew the runner had been
`&&`-chained (T014) and that T018 fixed it. The remaining question was whether the
*project set* covers the *artifacts*. "The project reports 0" cannot answer that, so:

1. A statement `const __T019_PLANTED_PROBE__ = __T019_MISSING_SYMBOL__;` was planted in
   **all 80** artifacts under `generated/`, `generated-composition/` and
   `generated-persistence/` across all six lanes — appended top-level for `.ts`/`.tsx`,
   inserted before `</script>` for `.vue`/`.svelte`.
   TS2304 was chosen over TS2322 deliberately: **TS2322 does not name the offending
   identifier**, so the first plant round was ungreppable and had to be redone. TS2304
   prints `Cannot find name '__T019_MISSING_SYMBOL__'` and is greppable in every
   instrument's output, including `svelte-check`'s human format and Angular's
   colour-coded esbuild plugin output.
2. Every candidate instrument was run against the planted tree.
3. Everything was reverted (`git checkout -- packages demos`) and a marker sweep over
   `packages/` and `demos/` confirmed zero residue.

Independent of the plant, program membership was cross-checked with
`tsc -p <project> --noEmit --listFiles`. The two methods agree on every lane.

## 1. Instrument inventory — what exists, and what actually runs it

| # | Instrument | Invoked by | Artifacts it provably reaches |
|---|---|---|---|
| I1 | `tsc -p .` (root `tsconfig.json`) | `pnpm check`, CI | **none** — 0 probe hits |
| I2 | `tsc -p packages/frameworks/react` | `pnpm check`, CI | react `S1 S2 S3` + `C1..C8` (11) |
| I3 | `tsc -p packages/frameworks/solid` | `pnpm check`, CI | solid `S1 S2 S3` + `C1..C8` (11) |
| I4 | `tsc -p packages/frameworks/qwik` **(added by T019)** | `pnpm check` **(added by T019)**, CI | qwik `S1..S9` + `C1-slot M1-panel M2-page` (**11 of 11**) |
| I5 | `tsc -p packages/frameworks/svelte` | `pnpm check`, CI | **none** — 0 probe hits |
| I6 | `tsc -p packages/frameworks/vue` | `pnpm check`, CI | **none** — 0 probe hits |
| I7 | `tsc -p packages/frameworks/angular` | `pnpm check`, CI | **none** — 0 probe hits |
| I8 | `ng build --configuration development` (AOT + `strictTemplates`) in `demos/angular-official` | **`pnpm e2e`** via the `build:e2e` prepare script, and CI's e2e job | angular `S1..S9` (8), through `copy-emitted` |
| I9 | `vue-tsc -b` in `demos/vue-official` (inside its `build` script) | **NOTHING** | would reach vue `S1..S9` (8) |
| I10 | `svelte-check` in `demos/svelte-official` (its `check` script) | **NOTHING** | would reach svelte `S1..S9` (8) |
| I11 | `tsc -p demos/qwik` | **NOTHING** (no script references it) | qwik `S1..S9` copies (8) |
| — | `demos/react-official`, `demos/solid-official` | — | **no tsconfig and no type instrument of any kind** |

`pnpm --dir demos/<d> build` is the only path that would fire I9, and CI's `production`
job runs it for `react-official` and `solid-official` only. `pnpm e2e` runs
`copy-emitted` for five demos and `build:e2e` for angular alone. So I9 and I10 are real,
resolvable, dependency-installed instruments that **nothing in this repo ever invokes**.

## 2. Per-artifact census — all 80 artifacts

Legend: **COVERED** = in a standing, invoked instrument, membership proven by plant.
**SHADOW** = an instrument exists and reaches it, but nothing invokes it.
**UNREACHED** = no instrument in this repo reaches it at all.

### react — 19 artifacts, 11 covered

| Artifact | Status | Instrument | Errors |
|---|---|---|---|
| `generated/S1.tsx` | COVERED | I2, via `test/emitted-smoke.browser.test.ts` and `test/strictmode.browser.test.ts` | 1 |
| `generated/S2.tsx` | COVERED | I2, same two tests | 11 |
| `generated/S3.tsx` | COVERED | I2, plus `test/action-order.browser.test.ts` | 3 |
| `generated/S4 S5 S6 S7 S9.tsx` | **UNREACHED** | none | unmeasured |
| `generated-composition/C1-slot.tsx` | COVERED | I2, via `test/composition-emitted-smoke.browser.test.ts` | 1 |
| `generated-composition/C2-shared.tsx` | COVERED | I2, same | 30 |
| `generated-composition/C3-ref.tsx` | COVERED | I2, same | 4 |
| `generated-composition/C4-attach.tsx` | COVERED | I2, same | 3 |
| `generated-composition/C5-props.tsx` | COVERED | I2, same | 1 |
| `generated-composition/C6-scalar-context.tsx` | COVERED | I2, same | 2 |
| `generated-composition/C7-object-context.tsx` | COVERED | I2, same | 6 |
| `generated-composition/C8-page-store.tsx` | COVERED | I2, same | 7 |
| `generated-composition/M1-panel.tsx` | **UNREACHED** | none | unmeasured |
| `generated-composition/M2-page.tsx` | **UNREACHED** | none | unmeasured |
| `generated-persistence/P1.tsx` | **UNREACHED** | none | unmeasured |

### solid — 19 artifacts, 11 covered

Identical membership shape to react. `S1.tsx` and `C8-page-store.tsx` are the two
**covered-and-genuinely-clean** artifacts on this board: both took the planted error and
reported it, and both are at 0 without it.

| Artifact | Status | Instrument | Errors |
|---|---|---|---|
| `generated/S1.tsx` | COVERED | I3, via `test/emitted-smoke.browser.test.ts` | **0 (clean, proven)** |
| `generated/S2.tsx` | COVERED | I3, same | 9 |
| `generated/S3.tsx` | COVERED | I3, same | 2 |
| `generated/S4 S5 S6 S7 S9.tsx` | **UNREACHED** | none | unmeasured |
| `generated-composition/C1-slot.tsx` | COVERED | I3, via `test/composition-emitted-smoke.browser.test.ts` | 1 |
| `generated-composition/C2-shared.tsx` | COVERED | I3, same | 6 |
| `generated-composition/C3-ref.tsx` | COVERED | I3, same | 9 |
| `generated-composition/C4-attach.tsx` | COVERED | I3, same | 10 |
| `generated-composition/C5-props.tsx` | COVERED | I3, same | 2 |
| `generated-composition/C6-scalar-context.tsx` | COVERED | I3, same | 3 |
| `generated-composition/C7-object-context.tsx` | COVERED | I3, same | 5 |
| `generated-composition/C8-page-store.tsx` | COVERED | I3, same | **0 (clean, proven)** |
| `generated-composition/M1-panel.tsx` | **UNREACHED** | none | unmeasured |
| `generated-composition/M2-page.tsx` | **UNREACHED** | none | unmeasured |
| `generated-persistence/P1.tsx` | **UNREACHED** | none | unmeasured |

### qwik — 11 artifacts, 11 covered (this task)

`packages/frameworks/qwik/tsconfig.json` did not exist. It now does, mirroring its five
sibling lanes (`extends` the root config, `src`/`test`/`scripts`) plus the two emitted
directories explicitly, with the official Qwik scaffold's JSX settings
(`jsx: react-jsx`, `jsxImportSource: @qwik.dev/core`, taken from `demos/qwik/tsconfig.json`).
All 11 reported the plant.

| Artifact | Status | Instrument | Errors |
|---|---|---|---|
| `generated/S1.tsx` | COVERED | I4 (explicit `include`) | **0 (clean, proven)** |
| `generated/S2.tsx` | COVERED | I4 | 14 |
| `generated/S3.tsx` | COVERED | I4 | 7 |
| `generated/S4.tsx` | COVERED | I4 | 11 |
| `generated/S5.tsx` | COVERED | I4 | 6 |
| `generated/S6.tsx` | COVERED | I4 | 6 |
| `generated/S7.tsx` | COVERED | I4 | 14 |
| `generated/S9.tsx` | COVERED | I4 | 9 |
| `generated-composition/C1-slot.tsx` | COVERED | I4 | **0 (clean, proven)** |
| `generated-composition/M1-panel.tsx` | COVERED | I4 | 1 (TS18046 `'props' is of type 'unknown'`) |
| `generated-composition/M2-page.tsx` | COVERED | I4 | 1 (TS2322 on `{ children; label }`) |

Cross-check: I11 (`tsc -p demos/qwik`, a wholly independent config on the official
scaffold) reports **67** errors across the eight `src/emitted/*.tsx` copies — exactly the
67 I4 reports across `generated/S2..S9`. Two unrelated instruments agree to the error.

The new project also surfaces **1 pre-existing error in qwik's own `test/gate.test.ts`**
(TS2339 `requiresArtifact` on a discriminated union). It is real, it is not emitted
output, and it was invisible only because qwik had no project. Left standing: excluding
`test/**` to drop it would be shrinking the number, not making it honest — and every
sibling lane includes `test/**`.

### angular — 11 artifacts, 8 covered

| Artifact | Status | Instrument | Errors |
|---|---|---|---|
| `generated/S1..S9.ts` (8) | **COVERED** | **I8** — `ng build` AOT + `strictTemplates`, inside `pnpm e2e`, via `copy-emitted` | **0 (clean, proven — all 8 reported the plant)** |
| `generated-composition/C1-slot.ts` | **UNREACHED** | none | unmeasured |
| `generated-composition/M1-panel.ts` | **UNREACHED** | none | unmeasured |
| `generated-composition/M2-page.ts` | **UNREACHED** | none | unmeasured |

### svelte — 10 artifacts, 0 covered

`tsc` structurally cannot read `.svelte`, and `tsc -p packages/frameworks/svelte` was
proven not to reach these (0 probe hits). Per the card's constraint, no `.svelte` artifact
was enrolled into a plain `tsc` project.

| Artifact | Status | Instrument | Errors |
|---|---|---|---|
| `generated/S1..S9.svelte` (8) | **SHADOW** | I10 `svelte-check`, invoked by nothing | **22, all inside `src/lib/emitted/`** |
| `generated-composition/M1-panel.svelte` | **UNREACHED** | none | unmeasured |
| `generated-composition/M2-page.svelte` | **UNREACHED** | none | unmeasured |

Shadow breakdown: `AttrBoard` 4, `EventForm` 2, `FormBoard` 5, `KeyedTodo` 6,
`NestedBoard` 5. `RenderOnce`, `BranchBoard` and `WhitespaceBoard` are clean.
All 8 reported the plant, so the instrument's reach is proven, not assumed.

### vue — 10 artifacts, 0 covered

| Artifact | Status | Instrument | Errors |
|---|---|---|---|
| `generated/S1..S9.vue` (8) | **SHADOW** | I9 `vue-tsc -b`, invoked by nothing | **40, all inside `src/emitted/`** |
| `generated-composition/M1-panel.vue` | **UNREACHED** | none | unmeasured |
| `generated-composition/M2-page.vue` | **UNREACHED** | none | unmeasured |

Shadow breakdown: `AttrBoard` 4, `EventForm` 10, `FormBoard` 9, `KeyedTodo` 12,
`NestedBoard` 5. `RenderOnce`, `BranchBoard` and `WhitespaceBoard` are clean.
This independently reproduces T006's and T016's 40, three sessions apart.

## 3. The numbers

| Quantity | At dispatch | After T019 |
|---|---|---|
| `pnpm check` total | 116 | **186** |
| — root | 0 | 0 |
| — react | 69 | 69 |
| — solid | 47 | 47 |
| — qwik | *no project existed* | **70** (69 emitted + 1 in `test/gate.test.ts`) |
| — svelte / vue / angular | 0 (= not covered) | 0 (= not covered) |
| Artifacts covered by a standing **invoked** instrument | 30 of 80 | **41 of 80** |
| Artifacts reached only by an **uninvoked** instrument | 24 | **16** |
| Artifacts reached by **nothing at all** | 26 | **23** |
| Errors measured outside `pnpm check` | 129 (vue 40, svelte 22, qwik-demo 67) | 62 (vue 40, svelte 22) |
| **Total measured type errors, all instruments** | 245 | **248** |

`186` was verified two ways: by the runner, and by summing seven independent
`tsc -p <project> --noEmit` invocations counted outside the script. They agree exactly.

The +70 in `pnpm check` is not new damage. 67 of it was already measurable through I11
and simply had no project; the genuinely *new* measurements are **3**: qwik
`M1-panel` (1), qwik `M2-page` (1) and qwik `test/gate.test.ts` (1) — none of which any
instrument in this repo had ever reached. That is why the all-instruments total moves
245 → 248 while `pnpm check` moves 116 → 186.

The 30 → 41 coverage movement is entirely qwik's 11. Angular's 8 were *already* covered
at dispatch; the board simply did not know, because nobody had asked whether `pnpm e2e`
type-checks. Nothing got worse; the denominator got honest.

## 4. Corrections to the T019 brief

1. **"react and solid reach theirs only transitively, via
   `test/composition-emitted-smoke.browser.test.ts` importing
   `'../generated-composition/C1-slot.jsx'`"** — the channel is right, the census is not.
   That test reaches `C1..C8` only. `generated/S1 S2 S3` come in through three *different*
   tests (`emitted-smoke`, `strictmode`, `action-order`). And in both lanes
   `S4 S5 S6 S7 S9`, `M1-panel`, `M2-page` and `generated-persistence/P1` are reached by
   **nothing** — so the two "covered" lanes are themselves only 11 of 19. The same fault
   the board has now found twice is present a *third* time, inside the lanes it thought
   were covered.

2. **"svelte/vue/angular 0 means NOT COVERED, not clean"** — true for svelte and vue,
   **false for angular's `generated/`**. `pnpm e2e` runs `pnpm --dir demos/angular-official
   build:e2e`, which is `copy-emitted && ng build --configuration development`, and Angular's
   compiler plugin type-checks with AOT and `strictTemplates`. Planting in all eight
   `packages/frameworks/angular/generated/S*.ts` made `ng build` exit 1 with exactly eight
   TS2304s. Angular's emitted output is **covered-and-clean by a standing invoked
   instrument** — it is the only lane on this board that can say so for all of `generated/`.
   The instrument is just `pnpm e2e`, not `pnpm check`.

3. **"corroborated by T006 and T016 measuring `demos/vue-official` at 40"** — correct, and
   reproduced here, but **incomplete**: `demos/svelte-official` ships a `check` script that
   runs `svelte-check` and reports **22 more**, also entirely inside emitted output, also
   invoked by nothing. The brief named one shadow instrument; there are two.

4. **"`pnpm check` 116 at dispatch"** — accurate as a runner total, but as a statement
   about the tree it understates by at least 62 measured errors sitting behind I9 and I10,
   and by an unmeasured amount behind the 23 artifacts nothing reaches.

## 5. What is deliberately *not* done here

Per this task's `stop_if`, closing the remaining coverage requires work outside a
tsconfig:

- **svelte and vue cannot be closed from the package.** Their instruments resolve only
  from `demos/svelte-official` and `demos/vue-official`, and only `generated/S1..S9` is
  copied there. Wiring `pnpm --dir demos/vue-official build` / `demos/svelte-official
  check` into `pnpm check` would add 62 real errors and needs a ruling, not a Worker.
- **`generated-composition/` is uncovered in four of six lanes** (react `M1/M2`, solid
  `M1/M2`, svelte `M1/M2`, vue `M1/M2`, angular `C1-slot/M1/M2`) and
  **`generated-persistence/P1.tsx` is uncovered in both lanes that have it.** Closing
  react's and solid's needs their tsconfigs, which are outside this card's `allowed_files`.
- **No compiler option, `exclude`, `skipLibCheck` or `checkJs:false` was used**, and the
  one error the new qwik project surfaces in qwik's own test file was left standing rather
  than excluded.
