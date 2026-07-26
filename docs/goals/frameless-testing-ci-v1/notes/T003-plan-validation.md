# T003 — Plan validation and sequencing rulings

Judge-shaped review of the owner's plan against T002 evidence. Read-only.

Verdict: **the plan survives, with one item materially re-scoped (Qwik) and one
new item inserted ahead of it (the browser-lane repair).** The owner's ranking by
silent-miscompile risk is preserved; nothing is reordered on preference, only on
dependency and on evidence that contradicted an intake assumption.

---

## Ruling 1 — CI lands first and is *expected* to go red

**Decision: T004 (CI) runs before T010 (browser-lane repair), and its first run
is expected to fail the browser job.**

The tempting order is the opposite: fix the defect, then write CI over a
known-green suite. Rejected, because it throws away the best calibration
artifact this goal will ever get for free.

The goal oracle requires every lane to be *proven able to fail*. For most lanes
that means constructing a deliberately broken input. For CI itself, constructing
a synthetic failure would be theatre — but T002 found a **real, pre-existing,
reproducible defect** (`pnpm test:browser`, zero tests executed, four
reproductions). If CI lands first, its very first run on the branch goes red on
that defect, from real provenance, and T010 then turns it green.

That red → green pair *is* CI's calibration, and it is stronger evidence than any
seeded mutant: it proves CI catches a bug nobody planted.

This also resolves the intake blind spot "CI may be red on arrival" in the best
possible direction. It will be red, we know exactly why, and the redness is the
proof rather than the problem.

**Amendment to T004:** its `verify` must not demand a fully green run. It must
demand: `check`, `lint`, `test`, and `e2e` jobs green; the browser job red *for
the T002 reason specifically* and not for any other. A browser job that fails for
a different reason is a stop condition — it would mean a second, unknown defect.

**Constraint reaffirmed:** the workflow must not be written to skip, `continue-on-error`,
or exclude the browser job to manufacture green. The charter forbids weakening
checks, and doing so here would destroy the calibration this ruling exists to
capture.

---

## Ruling 2 — the Qwik browser project is cancelled, not deferred

**Decision: T006 no longer adds a Qwik browser test project. It is re-scoped, and
the browser project is recorded as blocked on upstream with a concrete unblock
condition.**

T002 corrected the intake assumption. The blocker is not Vite:

- `@qwik.dev/core@2.0.0-beta.38` peers: `vite ">=6 <9"`, `vitest ">=2 <4"`.
- Root resolves `vite@8.0.16` — **inside** Qwik's range. The recorded "Qwik needs
  Vite 7.3.1" hazard is not the obstacle; only `demos/qwik` pins 7.3.1 locally.
- The workspace runs `vitest@4.1.5` — **outside** Qwik's declared peer range.

Adding a Qwik browser project on vitest 4 would run Qwik outside the support
window its own maintainers declare. The decisive argument is not caution, it is
**interpretability**: if such a lane went red, we could not tell whether our
emitter is wrong or the unsupported runner is. A test whose failures cannot be
attributed is not a test. Building one would be a direct instance of this goal's
recorded misfire — volume of green that proves nothing.

**T006 is re-scoped to what is both possible and interpretable:**

1. adopt `eslint-plugin-qwik` in the Qwik gate (if it supports Qwik 2 — T006
   must verify, and record the answer either way);
2. expand Qwik gate policies toward React/Solid parity, each with the
   catches-a-violation test this repo requires;
3. register the existing Qwik node project properly in `vite.config.ts`
   `test.projects`, which is a real gap independent of the browser question;
4. document, in-repo, why there is no Qwik browser project, with the unblock
   condition.

**Unblock condition, recorded so it is actionable rather than folklore:** a
`@qwik.dev/core` release whose `peerDependencies.vitest` range admits 4.x. At
that point the browser project becomes a small task, not a re-litigation.

**Behavioral Qwik coverage is not lost.** `pnpm e2e` passes and genuinely
exercises Qwik resumption — T002 measured all three S1/S2/S3 scenarios green
through the official Qwik scaffold, including the `paused` → `resumed` transition
and on-demand QRL fetches. Qwik's behavioral proof continues to come from the
lane that already works. What Qwik lacks after T006 is *unit-level* browser
coverage, which is a real but correctly-attributed gap.

**Welcome side effect:** this materially shrinks the collision with the
concurrent `frameless-idiom-policy-v1` goal. That goal is editing
`qwik/src/emitter/index.ts`, `qwik/test/emitter.test.ts`, and the three
`qwik/generated/S*.jsx`. Re-scoped T006 touches `qwik/src/gate/`,
`qwik/package.json`, and `vite.config.ts` — **almost disjoint**. The
`worktree.collision_warning` risk drops from high to low without any scheduling
concession. T006 may therefore run in its planned position rather than being
held back.

---

## Ruling 3 — matrix cells, enumerated

T002 measured the green path at ~40 seconds. The intake assumption that matrix
width would need rationing **does not hold**. Cost is no longer the constraint;
interpretability of each cell is.

Rejected: the full cartesian product (3 OS × 3 Node × 2 modes × 3 engines × 2
framework versions = 108 cells). Most cells would carry no information — a
Windows × Node 24 × production × WebKit × React-19.2.3 failure tells you almost
nothing you would not learn from a cheaper cell, and 108 cells makes any single
red hard to attribute.

Adopted, following Svelte's shape (broad on one OS, thin elsewhere):

| Axis | Cells | Rationale |
| --- | --- | --- |
| **Primary** | `ubuntu-latest` × Node 20, 22, 24 | Full suite. Matches Svelte exactly. Node 20 is the repo's `engines` floor. |
| **OS breadth** | `macos-latest` × Node 20, `windows-latest` × Node 20 | Catches path/line-ending/shell assumptions. Nothing here has ever run on Windows. |
| **Framework version** | React 19.2.3 + latest 19.x; Solid 1.8.22 + latest 1.x | **The distinctive axis** — Frameless is downstream of three frameworks at once. Runs on ubuntu × Node 22 only. |
| **Qwik version** | single pinned cell, `2.0.0-beta.38` | **No axis.** Per the intake blind spot: a matrix across a pre-release measures upstream churn, not our compatibility. Revisit at Qwik 2 stable. |
| **Build mode** | dev + production | ubuntu × Node 22. Closes the README's admitted "verified by curl only" gap. |
| **Browser engine** | chromium everywhere; firefox + webkit on ubuntu × Node 22 | T002 found both already cached locally. Cheap enough to attempt; still the first axis to cut if flaky. |
| **StrictMode** | dedicated lane, ubuntu × Node 22 | Directly tests the S1 `setup runs === 1` assertion against React 19's dev double-invoke. |

Every declared cell must actually execute. T007's `verify` already forbids
silently-skipped cells; that is the guard against a matrix that looks wide and
runs narrow.

---

## Ruling 4 — shared-workflow-file contention is accepted

T004, T005, T006, T007, T008, and T009 all touch `.github/workflows/`. That was
flagged at intake as a risk to confirm rather than let emerge.

**Accepted as-is, no structural mitigation.** Workers run strictly one at a time
under `one_active_task` and `max_write_workers: 1`, so there is no concurrent
edit hazard — only sequential appends to a growing workflow. Splitting into six
workflow files to avoid a contention that cannot occur would be over-engineering
and would fragment the CI story a newcomer has to read.

One instruction to carry: each Worker **adds a job** rather than restructuring
existing ones. A Worker that finds itself rewriting T004's jobs has exceeded its
slice and should stop.

---

## Ruling 5 — escalation protocol for miscompile findings

T009 (generative corpus) is expected to surface real compiler bugs; T008
(metamorphic) may too. The charter forbids fixing them inline, because a testing
task that also changes compiler behavior invalidates what the rest of the matrix
is measuring.

**Protocol:**

1. Record the finding in `notes/findings-<id>.md` with the minimal reproducing
   `.tsrx`, the shrunk input, and the observed vs expected trace.
2. Add a `queued` board task describing the fix. Do not activate it.
3. Mark the *generated case* as a known-failing expectation with an explicit
   pointer to the finding note — never delete it, never weaken the invariant.
4. Continue the current slice.

The rule that makes this work: **an invariant that fails is evidence, not a bug
in the invariant.** Any Worker tempted to relax a metamorphic transform or
narrow an arbitrary to make a run go green has inverted the goal.

---

## Ruling 6 — the `jsdom` warning is in scope for T010

T002 found Solid's browser run printing `MISSING DEPENDENCY Cannot find
dependency 'jsdom'` before passing all 44 tests. Small, but it lands in the same
configs T010 is already opening, and an unexplained MISSING DEPENDENCY line in
CI logs will be misread as a failure by exactly the outside contributor CI exists
to serve. Fix it or add a one-line explanatory comment; do not leave it bare.

---

## Sequence, as validated

```
T003 (this)  →  T004 CI, expected red on browser  →  T010 browser repair, CI goes green
             →  T005 emitted-output type-check
             →  T006 Qwik gate parity (re-scoped; no browser project)
             →  T007 matrix per Ruling 3
             →  T008 metamorphic + randomised order + throttled Qwik
             →  T009 generative corpus
             →  T999 final audit
```

Owner's risk ranking preserved. The only insertion is T010, which is a
dependency, not a re-prioritisation.

## Nothing in the plan was found infeasible

All eight in-scope items remain achievable. One (Qwik browser project) was never
in scope as written — it was an assumed sub-part of item 4 that the evidence
shows is upstream-blocked, and item 4 retains three of its four parts.
