# T010 — Browser lane repair, and a correction to T002

`pnpm test:browser` now passes: **89 tests (45 React + 44 Solid), exit 0**, from
a cold Vite cache, in under 9 seconds.

## Correction: T002's diagnosis was wrong

T002 concluded the cause was **default file parallelism**, on the strength of one
comparison: `pnpm test:react` failed, and
`pnpm exec vitest run --project react-browser --no-file-parallelism` passed.

That comparison changed **two variables at once** and I attributed the result to
the wrong one. The passing command differed from the failing one by the flag
*and* by running the real `vitest` binary from the package directory instead of
`vp test` from the workspace root.

The decisive experiment, run in this task — real `vitest`, package directory,
**file parallelism left ON (default)** — passes: 5 files, 45 tests, 5.31s. So
parallelism was never the cause.

## Actual root cause

`vp test` surfaces it directly once you let the run print instead of tailing it:

```
Loaded vitest@0.1.20 and @vitest/browser@4.1.5.
Running mixed versions is not supported and may lead into bugs
Update your dependencies and make sure the versions match.
```

`vite-plus@0.1.20` bundles its own vitest runner, while `@vitest/browser` resolves
to 4.1.5. The mismatched pair breaks the browser RPC channel — which is why the
symptom was a dropped connection and zero executed tests rather than a normal
assertion failure.

## The fix

Route the browser lanes through the real `vitest` in the package that owns the
matching `@vitest/browser`, instead of through `vp test` at the root:

```json
"test:browser": "pnpm test:react && pnpm test:solid",
"test:react":   "pnpm --dir packages/frameworks/react exec vitest run --config vitest.config.ts --project react-browser",
"test:solid":   "pnpm --dir packages/frameworks/solid exec vitest run --config vitest.config.ts --project solid-browser"
```

No test assertion was weakened, skipped, or excluded. No `vitest.config.ts` was
changed — the `fileParallelism: false` edits made under the wrong diagnosis were
reverted, because leaving them would encode a false explanation in six files.

Also: the browser job's CI timeout dropped from 20 to 10 minutes. T004 established
that this lane's failure mode is an indefinite hang, so a generous budget just
burns runner time and reads as "slow" rather than "broken".

## The `jsdom` warning was an artifact, not a dependency gap

T002 recorded `MISSING DEPENDENCY Cannot find dependency 'jsdom'` on the Solid
lane and rated it low-severity noise. It was worse than that *and* less real.

At one point it was making `pnpm test:solid` exit 1 despite 44/44 tests passing.
Attempting to satisfy it made things worse in an instructive way: adding `jsdom`
to `packages/frameworks/solid/package.json` caused pnpm to create a **second
vitest peer identity** (`vitest@4.1.5_..._jsdom@29.1.1_...` alongside
`vitest@4.1.5_..._vite@8.0.16_...`), and `tsc` then saw two unrelated `vitest`
type identities and failed `pnpm check` with *"Types have separate declarations
of a private property `_clearScreenPending`"*. Moving `jsdom` to the workspace
root did not help — the framework packages carry their own `vitest`
devDependency, which still resolved without it.

Both attempts were reverted. A `pnpm install --frozen-lockfile --force` then made
the warning disappear locally and `test:solid` exit 0, which led me to record it
as a stale `node_modules` artifact.

**That was wrong, and CI caught it.** Run 30218566637 did a clean
`pnpm install --frozen-lockfile` and the probe came straight back: React 45/45
exit 0, Solid 44/44 but **exit 1** on `MISSING DEPENDENCY Cannot find dependency
'jsdom'`. The local `--force` reinstall had masked a real condition rather than
resolving one.

Real cause: `vite-plugin-solid` injects `environment: 'jsdom'` when it detects
vitest. These lanes run in a real browser so that environment is never used, but
vitest still tries to resolve `jsdom` and exits nonzero when it cannot — with
every test green. The fix is to state `environment: 'node'` explicitly in
`packages/frameworks/solid/vitest.config.ts`, which takes precedence over the
plugin's injection. No `jsdom` dependency is needed and none was added.

This is the second diagnosis in this task that a local run got wrong and CI
corrected — the first being T002's file-parallelism theory. Both were cases of a
local environment differing from a clean one in a way that hid the real
condition. It is a fairly direct vindication of audit item 1.

Worth keeping as a lesson for the version-matrix work in T007: in this workspace,
adding a dependency to one package can silently fork a peer-resolved toolchain
identity and break type-checking somewhere unrelated.

## Verification

| Check | Result |
| --- | --- |
| `pnpm test:browser` (cold Vite cache) | 89 tests, exit 0 |
| `pnpm test:react` | 45 tests, exit 0 |
| `pnpm test:solid` | 44 tests, exit 0, no MISSING DEPENDENCY |
| `pnpm check` | pass |
| `git status` | only `.github/workflows/ci.yml` and `package.json` modified |

## Still open

The demo browser projects — `demos/{ui-kit,composition-kit}/test/{react,solid}/vitest.config.ts`
— are declared in the root `vite.config.ts` `test.projects` but **no script
targets them**. `pnpm test` filters to `--project node`, and `test:browser` now
names only the two framework projects. They are exercised indirectly by
`pnpm e2e`, but never as unit browser lanes. Recorded for T007, which owns
matrix breadth.
