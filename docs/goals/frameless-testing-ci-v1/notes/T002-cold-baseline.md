# T002 — Cold-checkout verification baseline

Measured in the fresh worktree `.claude/worktrees/frameless-testing-ci-v1`
(branch `goal/frameless-testing-ci-v1`, based on `main` @ `eb15408`), macOS,
Node per repo `engines` (`>=20`), pnpm 10.33.2.

## Headline

**`pnpm test:browser` does not pass as written.** Everything else is green and
fast. The total green-path wall clock is about 40 seconds, which means the
matrix in T007 is far more affordable than assumed at intake.

## Command-by-command

| Command | Result | Wall clock | Detail |
| --- | --- | ---: | --- |
| `pnpm install --frozen-lockfile` | pass | 2.3s | **Warm pnpm store — not a cold-CI figure.** See caveat below. |
| `pnpm check` | pass | 1.6s | `tsc --noEmit`, `src` only (tests/demos/scripts excluded). |
| `pnpm lint` | pass | 1.5s | 0 warnings, 0 errors, 236 files, 93 rules. |
| `pnpm test` | pass | 2.3s | 35 files, **519 tests**, 1 skipped. |
| `pnpm test:browser` | **FAIL** | ~95–186s then dies | See below. |
| `pnpm test:react` (serial) | pass | 5.0s | 5 files, 45 tests. |
| `pnpm test:solid` (serial) | pass | 4.8s | 4 files, 44 tests. |
| `pnpm e2e` | pass | 27.1s | 9/9 three-way cells equal; all receipts written. |

## Finding 1 — the browser lane is broken by default file parallelism

This is the most consequential thing in this note.

Reproduced four times. `pnpm test:browser` and `pnpm test:react` both fail with:

```
Error: [vitest] Browser connection was closed while running tests.
       Was the page closed unexpectedly?
Caused by: Error: [birpc] rpc is closed, cannot call "createTesters"
 Test Files   (9)
      Tests  no tests
```

They burn 95–246 seconds before dying, and report **`Tests  no tests`** — not a
single test executes.

Isolation performed:

- One file alone (`emitted-smoke.browser.test.ts`) → **passes**, 4 tests, 1.78s.
- All 5 React files, default parallelism → **fails**, twice.
- All 5 React files, **`--no-file-parallelism`** → **passes**, 45 tests, 4.98s.
- All 4 Solid files, `--no-file-parallelism` → **passes**, 44 tests, 4.80s.
- Chromium launches fine standalone (145.0.7632.6), so this is not a missing or
  broken browser.
- No competing `vitest`/`chromium` processes were running during the failures.

A warm Vite dep-optimizer cache does **not** fix it — the first run also emitted
`Vite unexpectedly reloaded a test ... optimized dependencies changed`, but the
failure persisted after the cache was warm, so that reload is a symptom of the
same concurrency problem rather than the cause.

**Why this matters beyond CI.** `packages/frameworks/{react,solid}/vitest.config.ts`
declare `browser.instances: [{ browser: 'chromium' }]` — one instance — while
vitest defaults to running test *files* in parallel. Multiple files contend for
a single browser instance and the connection drops. The README's "How We Test"
section and the calibration guarantees rest on these lanes. As currently
scripted, the command an outside contributor would run to check that work does
not pass.

Fix is one setting, and it belongs to T004/T006, not here: either
`fileParallelism: false` (or `browser.fileParallelism`) in the two browser
configs, or `--no-file-parallelism` in the `test:browser` script. The serial cost
is ~5s per project, so there is no meaningful speed argument for parallelism here.

## Finding 2 — the Qwik blocker is vitest, not vite

The intake blind spot recorded "Qwik pins Vite 7.3.1 while root is on Vite
8.0.16". That is real but it is **not** the blocker. Measured:

- `@qwik.dev/core@2.0.0-beta.38` peer dependencies: `vite: ">=6 <9"`,
  **`vitest: ">=2 <4"`**.
- Root workspace resolves `vite@8.0.16` — inside Qwik's supported range.
- `packages/frameworks/qwik` resolves `vite@8.0.16`; only `demos/qwik` pins
  `vite@7.3.1` locally.
- The workspace runs **`vitest@4.1.5`**, which is *outside* Qwik's declared
  peer range.

So the reason `packages/frameworks/qwik` has only a `vitest.node.config.ts` and
no browser project is a **vitest major-version incompatibility**, not a Vite
one. T006 must be re-planned around that: adding a Qwik browser project on
vitest 4 means running Qwik outside its own declared support window. T003 should
rule on whether that is acceptable, whether the Qwik lane instead gets its
behavioral coverage from the already-passing `pnpm e2e` witness lane (which does
exercise Qwik resumption end to end, successfully), or whether the browser
project waits for a Qwik release supporting vitest 4.

## Finding 3 — install timing is the one number CI will differ on

`pnpm install --frozen-lockfile` took 2.3s here **because the local pnpm store is
already populated**. A GitHub runner starts empty. This is the single figure in
the table that will not transfer, and the only one that needs a cache strategy
(`actions/setup-node` with `cache: pnpm`, as Svelte and Vue both do). Everything
else is small enough that runner speed differences are irrelevant.

## Finding 4 — cross-engine is cheaper than assumed

`~/Library/Caches/ms-playwright/` already contains `firefox-1509` and
`webkit-2248` alongside four Chromium builds. Locally, adding Firefox/WebKit to
the matrix costs no download. On CI they need provisioning, but Playwright
installs them with one command. T007's lowest-priority axis is more affordable
than the audit assumed — worth attempting rather than pre-emptively cutting.

## Finding 5 — total runtime makes the matrix cheap

Green path end to end is roughly **40 seconds** (`check` + `lint` + `test` +
serial browser + `e2e`), excluding install. Even a wide matrix — 3 OSes × 3 Node
versions × 2 build modes — stays well inside a normal CI budget. The intake
assumption that matrix width would need rationing does not hold. Cost is not the
constraint; correctness of the cells is.

## Smaller observations

- Solid's browser run prints `MISSING DEPENDENCY  Cannot find dependency 'jsdom'`
  before passing. Non-fatal, all 44 tests pass, but it is noise that will read as
  a failure in CI logs and should be resolved or explained.
- `pnpm install` runs `prepare` → `git config core.hooksPath .githooks`. In CI
  this is harmless but pointless; worth an `--ignore-scripts` consideration or
  leaving alone.
- Ignored build scripts warning for `esbuild@0.27.7` and `sharp@0.34.5`
  (`pnpm approve-builds`). Currently benign.
- **Test-count reconciliation:** the audit counted 303 written `it(`/`test(`
  call sites; vitest executes **519**. Both are right — the suites loop over
  scenario and mutant tables (`for (const scenario of calibrationScenarios)`,
  `for (const mutant of mutantClasses)`), so written call sites expand at
  runtime. No discrepancy, but future receipts should quote the executed number.

## Feasibility check for T005 (type-checking emitted output)

Confirmed available: `@types/react@19.2.14`, `@types/react-dom@19.2.3`, and
`solid-js/types/jsx.d.ts`.

Emitted output is untyped-by-design — props arrive destructured with no
annotations (`export function RenderOnce({ label, multiplier, visible, onTrace })`).
So a strict `noImplicitAny` pass would drown in false positives. The workable
configuration is `checkJs: true` with `noImplicitAny: false`, per framework, with
`jsx: react-jsx` for React and `jsxImportSource: solid-js` for Solid. That still
catches the class of bugs worth catching: undefined identifiers, missing or wrong
imports, misused framework APIs, invalid JSX element and attribute names.

Calibration for that lane is straightforward — feed it an emitted file with a
removed `useState` import and prove `tsc` rejects it.

## What T003 must now decide

1. Whether fixing the browser-parallelism defect is folded into T004 (it gates
   every later browser-dependent lane) or split out.
2. Whether the Qwik browser project proceeds on vitest 4 outside Qwik's declared
   peer range, defers, or is replaced by leaning on the passing e2e witness lane.
3. Matrix cells, now knowing runtime is ~40s and Firefox/WebKit are available.
4. Whether the `jsdom` warning is in scope.
