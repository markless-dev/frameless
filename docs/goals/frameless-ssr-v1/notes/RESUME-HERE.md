# RESUME POINT — frameless-ssr-v1 (session handoff)

Fable 5 hit its usage limit mid-T004. New session continues on Opus 4.8.

## One-line resume

Run: `/goal Follow docs/goals/frameless-ssr-v1/goal.md.`

The board (`state.yaml`) has `active_task: T004`. The PM re-dispatches T004 from
its card. Nothing else needs reconstructing.

## Exact state at handoff

| Task | Status | Artifact |
|------|--------|----------|
| T001 Scout (witness + SSR + Qwik v2 evidence) | done | `notes/T001-witness-ssr-evidence.md` |
| T002 Worker (`@frameless.md/core`) | done, verified green | `packages/core/**` (on disk; committed locally) |
| T003 Judge (SSR architecture lock) | done, approved, fitness PASS | `notes/T003-ssr-architecture.md` — THE AUTHORITY for T004/T005 |
| **T004 Worker (SSR infrastructure)** | **active — NOT STARTED (wrote nothing)** | none |
| T005 Worker (box suite + calibration + equality + schema + docs) | queued, fully specced | — |
| T900 Solid 2 / T901 Qwik v2 | blocked (gated, do not start) | — |
| T999 Judge (fresh-clone audit) | queued | — |

## What T004 must do (authority: notes/T003-ssr-architecture.md Decision 8)

Build `demos/ssr/` witness root: `react-app/` (renderToString prerender +
hydrateRoot, react-dom 19.2.3) and `solid-app/` (NEW vite lane: ssr:true,
solid.generate:'ssr', hydratable, hydrate + generateHydrationScript, solid-js
1.8.22), both consuming CLI-BUILT emitted output (never authored .tsrx).
Build-time prerender via local vite plugin (fallback: in-box prerender via
witness `project.edit.create`). Pin `@async/witness` EXACTLY 0.7.0 + record the
five re-evaluation triggers. Boxes: the two-previews-one-run PROBE FIRST (if it
fails, blocked-return — fallback topology is a PM/Judge call), then one
first-render box per framework. `e2e:ssr` script stub only (full verdict
integration is T005).

allowed_files: `demos/ssr/**`, root `package.json` (scripts + witness dep only),
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `scripts/e2e.mjs` (CLI-build hook only).

Hard stops: markless repo is off-limits (active storage agent); witness 0.7.0
gaps = product feedback blocked-return; probe fail = blocked-return.

## Load-bearing facts for the resumer

- The interrupted T004 subagent (id a20e061f0185dde8b) wrote NOTHING to the tree
  and left the lockfile clean (no `@async/witness` yet). Ignore it; start fresh.
- Board hygiene already applied: oracle/goal text updated to activation-neutral
  wording; solid2-blocker path corrected to
  `packages/frameworks/solid/test/solid2-blocker.test.ts`.
- Owner directives locked in the charter: Qwik = v2 ONLY (`@qwik.dev/core`
  2.0.0-beta.38 line; never v1/@builder.io/qwik); Solid = v1 default, v2 later
  as experimental flag-gated; activation-model neutrality (no hydration-only
  proof surface — this is why the schema uses `activation: hydrate|resume`).
- A Stop hook is armed on the goal condition; the new session should just work
  the board, not ask what to do.

## GoalBuddy housekeeping

- 0.4.1 available (repo on 0.3.7) — `npx goalbuddy` to update, optional.
- Validate the board any time: `node <goalbuddy-skill>/scripts/check-goal-state.mjs docs/goals/frameless-ssr-v1/state.yaml`
- Local board: http://goalbuddy.localhost:41737/frameless-ssr-v1/
