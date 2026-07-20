# Agent guidance

Agent rules and MCP configuration for this repo are generated from `.ruler/` by Ruler. Edit the
source here and run `pnpm rules` to sync `AGENTS.md`; never edit the generated file alone.

A change known to affect a consuming application must pass that application's checks before it
lands; the owning package suite alone is not sufficient evidence. Protocol and configuration facts
are imported from their owning package, never restated as literals.

The task packet or active goal card defines scope. Stay inside its named files and preserve
unrelated work. If a required decision is missing, stop rather than improvise. Goal state under
`docs/goals/**` is PM-managed and read-only unless a task explicitly owns it.

For direct interactive work, read the owning package README and playbook plus any dossier named by
the request. The production package folders are `packages/analyzer`, `packages/cli`,
`packages/compiler`, `packages/frameworks/react`, and `packages/frameworks/solid`.

Treat `/Users/jacksm5pro/dev/open-source/markless` and `poc/**` as read-only reference evidence.
Keep `poc/**` out of every workspace and root tool lane. Never update reference-repository files or
POC lockfiles from this workspace.

The compiler owns enriched IR only. It must not import analyzer, DOM, React, Solid, Vite,
filesystem, gate, or dossier types. Framework dependencies, adapters, transforms, and browser
projects stay inside their owning `packages/frameworks/*` package.

Merging or pushing to main, pushing a shared branch, or closing a goal requires an explicit owner
directive for that specific change set. A prior directive does not carry forward to follow-up work.

Verification receipts must distinguish passed, failed, blocked, and unrun commands. Never invent
browser output, weaken a negative control to make a lane green, or describe unexecuted work as
verified.

Write user-facing explanations in clear, concise language without reducing technical precision.
Preserve material evidence, constraints, tradeoffs, caveats, and uncertainty. Do not rewrite code,
identifiers, commands, quoted text, or prescribed formats merely to satisfy this style rule.

Owner-facing decision menus must be understandable without the goal context. Lead with the choice
and recommendation, surface only decisions that change the outcome or carry real risk, explain each
in everyday language, and keep researched defaults behind a note pointer. Do not use internal task
codes or process shorthand without defining them.
