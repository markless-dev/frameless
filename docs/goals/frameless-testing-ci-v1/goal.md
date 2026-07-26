# Goal: frameless-testing-ci-v1

Build the enforcement layer and the corpus. Everything happens in a dedicated
git worktree; the owner merges it back.

## Original request

> Work on everything we talked about in the audit. I made frameless public so
> it now has unlimited github ci minutes. [...ranked list 1-5, plus the
> re-grounded "jitter" trio and metamorphic testing...] Do it in a separate git
> worktree then we will merge it back into main and also our current branch /
> what we're on now.

## Interpreted outcome

The eight highest-ranked findings from `frameless-testing-strategy-v1` are
implemented, each new lane is *calibrated* (proven able to fail), and the whole
suite runs green on GitHub Actions on a dedicated branch, ready for the owner
to merge.

## Input shape

`existing_plan` — the owner handed back the audit's own ranked list. The plan is
preserved as facts below and validated by T003 before any Worker runs. It is not
re-derived and it is not executed blindly.

## Scope (owner-selected)

Confirmed at intake: **Tiers 1+2 plus metamorphic** — audit items 1-7 and 11.

In scope:

1. CI (audit #1)
2. Type-check emitted output + widen `tsconfig` include (audit #2)
3. Matrix: framework versions, Node, OS, dev/prod, StrictMode (audit #3)
4. Qwik lane parity (audit #4)
5. Generative `fast-check` corpus over the IR grammar (audit #5)
6. Metamorphic invariants (audit #6)
7. Production-build and StrictMode lanes (audit #7)
8. Randomised action ordering + network-throttled Qwik resumption (audit #11)

Explicitly deferred, not cancelled — these stay in
`frameless-testing-strategy-v1` notes as the next tranche:

- downstream ecosystem-CI and per-PR preview packages (audit #8) — blocked
  regardless, since no consumer project exists yet;
- coverage instrumentation (#9), compiler-error suite (#10), sourcemaps (#12),
  a11y differential (#13), size/perf trend reporting (#15).

Cross-engine Firefox/WebKit (#14) is folded into the matrix task as its
**lowest-priority axis** — it may be cut inside that task without reopening
scope.

## Goal oracle

Two signals, both required. Neither is satisfiable by writing tests that pass
trivially:

1. **Green on GitHub Actions, on the branch, at a URL.** Not "it passes on my
   laptop" — that is the exact failure mode audit item #1 exists to kill. The
   run must be linked in the final receipt.
2. **Every new lane is calibrated — proven able to fail.** This repo's existing
   culture (`packages/analyzer/src/mutants.ts`, the `calibration.browser.test.ts`
   suites, "every style rule has a test proving it catches a bad output") is
   that a check nobody has watched fail is not evidence. Each new lane added by
   this goal must ship with a demonstration that it rejects a deliberately
   broken input.

Cadence: after each Worker package, and at final audit.

## Constraints (non-negotiable)

- **All work happens in a dedicated git worktree** on branch
  `goal/frameless-testing-ci-v1`. The primary checkout is not to be modified —
  a concurrent session is actively driving it.
- **Merge is the owner's action, not this goal's.** The goal ends at a pushed,
  green branch. Do not merge, do not rebase onto main, do not force-push.
- No changes to compiler or emitter *behavior*. This goal adds verification. If
  a new lane finds a real miscompile, that is a finding to record and escalate,
  not a bug to quietly fix inside a testing task — fixing it changes what the
  matrix is measuring.
- Emitted-output goldens under `packages/frameworks/*/generated{,-composition}/`
  are not to be regenerated to make a lane pass. A lane that fails against a
  committed golden is either a real finding or a bad lane.
- Do not weaken existing checks to get CI green. Red CI on arrival is a finding
  (see T002), not a reason to relax an assertion.

## Existing plan facts (preserved, to be validated by T003)

From the audit, restated by the owner:

- No `.github/` exists; `.githooks/pre-commit` runs `vp lint` only.
- Emitted output is all `.jsx` and never type-checked; root `tsconfig.json`
  excludes `packages/*/test`, so `pnpm check` skips tests too.
- One version pinned per framework: React 19.2.3, Solid 1.8.22, Qwik
  2.0.0-beta.38. Chromium only, dev mode only, no StrictMode lane.
- Qwik: 9 test cases vs React 64 / Solid 79; 163-LOC gate vs 547/713; no
  `eslint-plugin-qwik`; no browser test project, absent from `test.projects` in
  `vite.config.ts`.
- Zero `fast-check`/fuzz hits anywhere in the workspace.
- "Jitter testing" is not standard terminology; it is implemented here as a
  StrictMode lane, randomised action ordering, and throttled Qwik resumption.
- Metamorphic invariants: rename-all, reorder-siblings, extract-child,
  split-file — each must produce identical traces.

New fact supplied at intake: the repo is now **public**
(`github.com/markless-dev/frameless`, default branch `main`), so GitHub Actions
minutes are unmetered. Verified during prep. This is what makes the full matrix
in item 3 affordable rather than aspirational.

## Merge targets (owner action, pinned here because "current branch" moved)

This conversation began on `land/stack-and-three-way-demo`. During the session a
concurrent session switched the shared checkout to
`goal/frameless-idiom-policy-v1`. So "our current branch / what we're on now" is
now ambiguous and must not be guessed.

Recorded intent, for the owner to confirm at merge time:

- `main` — stated explicitly by the owner;
- `land/stack-and-three-way-demo` — the branch this work was scoped against and
  where the audit that produced this plan lives.

`goal/frameless-idiom-policy-v1` is assumed **not** to be a merge target; it is
a different concurrent goal. Confirm before merging.

## Likely misfire

Producing a large volume of green CI configuration that proves nothing. Every
item on this list can be implemented in a form that passes immediately and
detects nothing: a matrix that only ever runs one cell, a `tsc` invocation with
`skipLibCheck` and no strictness that cannot fail, a fast-check generator whose
arbitraries only emit the three shapes already in the corpus, metamorphic
transforms applied to programs simple enough that the invariant is trivial. The
calibration requirement in the oracle exists specifically to make this misfire
detectable. A Worker receipt that cannot point at a witnessed failure has not
finished its slice.

## Blind spots to name

- **CI may be red on arrival.** Nobody knows whether `pnpm test` + `pnpm e2e`
  pass from a cold checkout on Linux — everything to date was verified on
  macOS. T002 exists to find this out before any workflow is written.
- **Qwik pins Vite 7.3.1 while the root workspace is on Vite 8.0.16**
  (recorded in a prior goal). A Qwik browser project may collide with the root
  Vite version. This is a live hazard for T006, not a hypothetical.
- **Qwik is on a pre-release** (`2.0.0-beta.38`). A version matrix across a beta
  may be measuring churn rather than compatibility. T003 should decide whether
  Qwik gets a matrix axis at all or a single pinned cell.
- **A generative corpus will probably find real miscompiles.** That is the point,
  and it will also blow the scope of this goal if handled carelessly. The
  constraint above routes findings to escalation rather than to inline fixes.
- **Ordering tension:** CI-first means CI encodes the *current* suite and each
  later slice extends it. This is deliberate — it front-loads the enforcement
  substrate — but it means the workflow file is touched by most tasks. T003
  should confirm this rather than let it emerge.

## What counts as enough for this tranche

All eight in-scope items implemented, each with a calibrated failure
demonstration, running green in GitHub Actions on
`goal/frameless-testing-ci-v1`, pushed, with the run URL in the final audit
receipt — and the branch left unmerged for the owner.
