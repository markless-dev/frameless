# T011 - Step 1.5, the `.jsx` -> `.tsx` half

**Result: BLOCKED on ONE verify line - `pnpm check` - which cannot pass without
two files outside `allowed_files`. Everything else in the slice is delivered and
verified, including the decisive `pnpm e2e`.**

No type is printed anywhere. All 66 renamed emitted artifacts are **byte-identical**
to their `.jsx` predecessors.

## The headline: the rename does not change bytes, it changes WHICH CHECKER RUNS

That is the finding this card did not anticipate, and it appears twice, in
opposite directions.

| checker | over `.jsx` | over the SAME bytes as `.tsx` |
| --- | --- | --- |
| `emitted-typecheck.test.ts` (react) | 5 diagnostics | **12** |
| `emitted-typecheck.test.ts` (solid) | 7 diagnostics | **21** |
| `tsc -p packages/frameworks/react` | 0 errors | **73** |
| `tsc -p packages/frameworks/solid` | 0 errors | **48** |

Both rows have the same cause and it is worth stating exactly, because it is the
thing Step 2 is going to be measured against:

- `packages/frameworks/{react,solid}/tsconfig.json` set `allowJs: true,
  checkJs: false`. A `.jsx` file reachable from a test import was in the program
  but **not checked**. A `.tsx` file is checked, always, and under the root's
  `strict: true`.
- Even with `checkJs: true` and `strict: false` - the calibrated settings
  `emitted-typecheck.test.ts` uses - the two inference modes are not equivalent.
  In a checked JS file an empty initialiser (`new Set()`) and an uninferrable
  type parameter fall back to `any`; in a TS file they are `unknown` / `{}` and
  every downstream use is reported.

Measured directly, one file at a time: `packages/frameworks/react/generated/S1`,
identical bytes, named `.jsx` -> **0** errors attributed to it; named `.tsx` ->
**5**.

### What was done about each

- **`emitted-typecheck.test.ts`: the 7 + 14 new diagnostics were ADDED to
  `ACCEPTED`, each with its site.** Not silenced, and the compiler options were
  not weakened. The assertion stays EXACT EQUALITY, so when Step 2 prints types
  and these disappear, the lane goes red and forces the list to be shortened
  deliberately. Every new entry is one family - `new Set()` in an emitted module
  store (react), and argument-less `createContext()` / uncontextualised
  `produce()` (solid). All are the untyped-emitted-value class this phase exists
  to delete. **The oracle got sharper for free, and it is now pointed at exactly
  what Step 2 must fix.**
- **`pnpm check`: NOT FIXED. It is the blocked item.** See below.

## THE BLOCKER, with its fix already measured

`pnpm check` runs `tsc -p packages/frameworks/react` and `-p .../solid`. Those
projects do not `include` `generated*/`, but their **browser tests import emitted
modules**, which pulls the files into the program, and a `.tsx` in the program is
checked. 73 + 48 errors, **all of them inside `generated*/`** - not one
hand-written file regressed.

The fix is one line per project, and it was measured working rather than
proposed: adding

```jsonc
"exclude": ["generated/**", "generated-composition/**", "generated-persistence/**"]
```

to `packages/frameworks/{react,solid}/tsconfig.json` takes the react project from
73 errors to **0**. (Verified against a scratch copy of that tsconfig; the two
residual errors it reported were `TS2688 Cannot find type definition file` for
`node`/`vitest/globals`, artifacts of the scratch config living outside the repo,
not of the exclusion.)

**Both files are outside `allowed_files`, so this is reported, not done.** It is
also not purely mechanical: it decides whether Frameless's strict repo-wide
typecheck covers emitted artifacts at all, or whether that stays the exclusive
job of `emitted-typecheck.test.ts` with its own calibrated `strict: false`. That
is a standing architectural choice, and Step 2 changes its stakes. A PM ruling is
the right instrument, not a Worker's judgement call.

There is no in-scope alternative. `exclude` is the only mechanism that suppresses
these; making emitted output pass `strict` requires printing types, which this
card forbids; and no edit confined to `test/`, `src/`, `scripts/` or `generated*/`
keeps an imported `.tsx` out of a `tsc` program.

## THE HAZARD THE CARD NAMED: measured, and it was real

`react/solid/qwik` gate discovery filters on the extension. Renaming without
moving it would make all three find zero files and pass vacuously.

**Discovery, before and after - identical, nothing went dark:**

| lane / directory | before | after |
| --- | --- | --- |
| react `generated` | 8 | 8 |
| react `generated-composition` | 8 | 8 |
| react `generated-persistence` | 1 | 1 |
| solid `generated` | 8 | 8 |
| solid `generated-composition` | 8 | 8 |
| solid `generated-persistence` | 1 | 1 |
| qwik `generated` | 8 | 8 |

Counting files is the weaker half. The eslint override `files: ['**/*.jsx']` is
the sharper one, because flat config lints only `**/*.{js,mjs,cjs}` unless a
config entry names another extension - **a stale glob there does not fail, it
drops every rule.** So the arbiter was watched firing, with the same planted
mutant (`const framelessGateProbeUnused = 1;`) fed under both filenames:

| lane | `generated/Probe.tsx` | `generated/Probe.jsx` |
| --- | --- | --- |
| react | `eslint:no-unused-vars` | **NOTHING** |
| solid | `eslint:no-unused-vars` | **NOTHING** |
| qwik | `eslint:no-unused-vars` | `eslint:parse` on clean AND mutant |

React and Solid would have gone **completely silent**. Qwik is the interesting
one: it would have reported `eslint:parse` rather than nothing, so at
`checkSources` level it fails loudly - but its `discoverGeneratedFiles` would
still have returned zero, so `checkGeneratedFiles` would still have passed over
an empty set. Three of three needed the glob; one of three would have said so.

## The one deliberate asymmetry: files are `.tsx`, specifiers stay `.jsx`

The emitted file is `X.tsx`. The specifier the emitter writes for a sibling
module is still `./X.jsx`, and so are every consumer import in this repo. That is
a ruling, not an oversight, and it is recorded inline at all four sites (both
emitters, both gates, plus `packages/cli/src/program.ts` and the two official
demo `App.jsx` files):

- A specifier ending `.tsx` is **TS5097** in any consumer that has not enabled
  `allowImportingTsExtensions`, which also forces `noEmit`. Emitting one would
  put a hard constraint on every downstream `tsc`.
- A `.jsx` specifier resolves to `X.tsx` under TypeScript's JS-to-TS extension
  substitution, and under Vite's. **Measured in Vite's own resolver, not
  assumed:** `knownTsOutputRE = /\.(?:js|mjs|cjs|jsx)$/` and
  `tryResolveRealFile(fileName + fileExt.replace("js","ts"))`, present and
  identical at **vite 7.3.1, 7.3.6 and 8.0.16** - the three versions this repo
  and its demos pin.
- It also makes the byte-neutrality claim trivial instead of normalised: emitted
  CONTENT does not change at all, so the residual is zero with no normalisation.

### And that resolution order is itself a hazard, found by measurement

`tryCleanFsResolve` tries the **literal** path first and only then substitutes.
So a stale `PersistedApp.jsx` left by a pre-migration build **wins** over the
fresh `PersistedApp.tsx` next to it, and the demo builds, runs and passes against
emitted output nobody regenerated.

Every other demo emits into a `dist/` its build owns, so only
`demos/persistence` - which writes into a persistent `src/` - could hold the
shadow, and **it did**: both `PersistedApp.jsx` files were sitting next to the
new `.tsx` after the first e2e run. They were byte-identical this time, so
nothing was mismeasured, but that is luck. `demos/persistence/build.ts` now
deletes the stale file before writing, with the reason inline, and `.gitignore`
covers both extensions.

## `format-emitted.ts`: CHANGED to `generated.tsx`, and the decision was measured

The card asked for a deliberate choice. Both are byte-neutral today, so the
tie-break is which statement is true.

- **Measured first:** for all 42 checked-in emitted files,
  `format('generated.jsx', ...)` and `format('generated.tsx', ...)` produce
  **byte-identical output, 42/42, zero errors on either side**. So changing it
  cannot move an emitted byte, which is what this step had to protect.
- **Changed** because the artifact is now `.tsx`, and a virtual filename that
  says `.jsx` is a false statement about the thing being formatted - the dead-limb
  shape this board keeps finding. Step 2 needed it changed anyway, and leaving it
  would have handed Step 2 an unmeasured change.

**The parser `lang: 'jsx'` settings were deliberately NOT changed**, and that is
not an inconsistency. Measured the same way - parsing all 42 files under
`lang: 'jsx'` and `lang: 'tsx'` gives identical programs and identical
diagnostics, 42/42 - so it was a free choice, and `lang: 'jsx'` is still a TRUE
statement: the emitted output contains no TypeScript. It also leaves Step 2 a
loud tripwire at the exact sites that must change. `measure-size.ts` is the one
exception: its `typescript` flag is now `true` for the emitted side, because that
flag is a claim about the FILE, and the comment claiming reference and emitted
"use the same parser" became true for the first time.

## Stale premises corrected rather than deleted

Three, all re-derived rather than edited.

1. **svelte `require-event-dispatcher-types`** - the card named this one.
   Measured at eslint-plugin-svelte 3.22.0 / svelte 5.56.8: the rule's `create()`
   sets `isTs` only for `<script lang="ts"|"typescript">` and returns at
   `Program:exit` otherwise, so the clause "which this emitter never produces"
   **is dead** - it always produces one now. The verdict survives on the two
   remaining axes, both re-measured: `meta.conditions = [{ svelteVersions:
   ['3/4'] }]`, and `createRule`'s wrapper returns an **empty visitor** before
   `create()` runs at a 5.x pin (decisive on its own); and it reports only on a
   tracked ESM `createEventDispatcher` reference, of which the emitter has
   **zero** across `src/` and `generated/`.
2. **svelte `no-unused-props`** - "plain emitted `.svelte`" no longer describes
   this lane. Verdict unchanged, and the corrected reason names the real trigger:
   `getTypeScriptTools` returns `null` unless `sourceCode.parserServices` carries
   a `program` AND `hasFullTypeInformation`, which needs `parserOptions.project`.
   Lang was never the gate.
3. **qwik `QWIK_ESLINT_RULES_REQUIRING_TYPES`** - the card did NOT name this one.
   It carried the same false clause, "cannot run against plain emitted `.jsx`".
   Corrected for the same reason: the gate lints with the default parser and no
   project, so the extension never mattered.

## The svelte instrument gap, closed on the cheap axis

T009 measured that reverting the vue `lang="ts"` attribute turned **14** tests
red and reverting svelte's turned **zero** - svelte was blind, not clean.

`packages/frameworks/svelte/test/emitter.test.ts` now pins the emitted script
open tag across the derived scenario set, reading the SHIPPED files so a
checked-in artifact that drifted from its emitter is also caught. **Watched
firing:** the emitter's `lang="ts"` was reverted, the lane regenerated and the
suite re-run - **svelte went from 0 red to 1 red**, then everything was restored
and re-run green (81/81).

The expensive half is NOT done and is left named: svelte's
`BASELINE_FORM_INVENTORY` still has no script-block kind, so `checkSources` still
never observes a script attribute. Adding one needs a version-floor ruling of the
sort vue's `script[setup,lang=ts]` row was given, which is a PM call.

## Corrections to the dispatch and to T009's table

- **"169 tracked files reference `.jsx` (I confirmed 169)" does not reproduce.**
  Measured at HEAD `0f51527` with `git grep -lF '.jsx'`: **213** tracked files -
  74 under `docs/`, 48 `packages/`, 44 `demos/`, 28 `poc/`, 15 `probes/`, and one
  each of `vite.config.ts`, `scripts/`, `README.md`, `.gitattributes`. It was 212
  at the two preceding commits, so 169 was not a stale-but-once-true number.
  Excluding `probes/`, `poc/` and `docs/goals/` leaves **98 files / 482 reference
  lines**, against T009's 96 / 476.
- **T009's 18-file table lists `packages/frameworks/qwik/src/gate/index.ts` as
  carrying "same three" as react's.** It carries **two**: discovery and the
  eslint glob. It has no `./X.jsx` specifier derivation at all - qwik emits no
  cross-module imports.
- **`demos/ssr/test/fixtures/witness-receipt.json` is NOT load-bearing** and was
  deliberately left alone. Its `.jsx` strings are a RECORDING of a past run,
  consumed as a static input by `ssr-receipt.test.ts`; nothing asserts them
  against the filesystem, and `src/ssr-receipt.ts` contains no `.jsx` reference.
  Rewriting a recording to match a new reality is the thing this repo forbids.
  (`demos/persistence/test/fixtures/witness-receipt.json`'s four hits are inside
  minified bundle text - irrelevant.)
- **The table is missing `packages/frameworks/{react,solid}/test/emitted-typecheck.test.ts`**,
  which is the most load-bearing file in the whole slice: it carries exact
  diagnostic strings, a derived inventory, AND the same `endsWith('.jsx')`
  discovery filter the gates have. It is the file that produced this task's
  headline finding.
- **And it is missing `packages/frameworks/{react,solid}/tsconfig.json`**, which
  is the blocker above.

## Qwik segment names moved, and the contract absorbed it by design

A Qwik segment is `<source file>_<component>_<element path>_q_e_<event>_<hash>`,
so the rename moved the filename prefix of all **31** segments and, because the
hash covers the name, every hash with it -
`BranchBoard.jsx_..._click_pnwm0Iro4cY.js` is now
`BranchBoard.tsx_..._click_mZF9DZjqH1Q.js`. **Not one assertion moved**, because
every `resumeSymbols.includes` string starts at `_component_` or `_button_`. The
hash-free, filename-free design in `three-way-contract.ts` is what absorbed it.
The verbatim readings quoted in that file's comments were **re-measured off this
lane's own post-migration receipt** rather than hand-edited, and the note
explaining why the assertions are filename-free is now written down.

## Verification

| command | result |
| --- | --- |
| `pnpm test` | **1102 passed / 1 failed (1103)** - byte-identical to the dispatch baseline; the one failure is the pre-existing `package-inventory` ARM B, foreign-lockfile cause |
| `pnpm check` | **FAIL** - 73 react + 48 solid errors, all inside `generated*/`; see THE BLOCKER |
| `pnpm lint` | pass, 0 warnings / 0 errors over 398 files |
| `pnpm check:citations` | pass, exit 0, clean over 4 documents / 17 watched / 481 swept |
| `pnpm e2e` | **PASS** - 6 demos x 8 scenarios, all observations equal, plus the SSR and persistence witnesses |
| per-gate non-vacuity | pass - counts unchanged, arbiter watched firing, control arm silent |
| per-lane residual diff | **zero over 42 package + 24 demo files, with no normalisation at all** |
| regeneration non-vacuity | pass - junk appended to five emitted files, all five restored by regeneration before any diff was trusted |

`pnpm mutate:corpus` was not run and nothing was committed, per the card.
