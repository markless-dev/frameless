# Goal: frameless-testing-strategy-v1

## Original request

> I want you to do an audit of the codebase (no code changes), as well as grep
> mcp the general ecosystem and audit what kinds of testing we should also have
> here. For example, matrix testing, jitter testing? Other types of testing I
> don't know about? Ideally we want as much testing as possible that makes
> sense so that we can know our code is incredibly robust before anyone ever
> uses this to compile to other frameworks.

## Interpreted outcome

A source-backed testing-strategy audit that (a) inventories what Frameless
tests today, by *kind* of testing rather than by file, (b) names the kinds of
testing a cross-framework compiler needs that Frameless does not yet have,
grounded in what comparable compilers actually do, and (c) ranks the gaps by
what would most reduce the chance of silently emitting wrong code.

## Input shape

`audit` — read-only. No product code changes. Control files and notes under
`docs/goals/frameless-testing-strategy-v1/` only.

## Goal oracle

A source-backed answer. The audit is true only if:

- every claim about the current suite cites a real path, count, or config line
  in this repo, verified during the run, not recalled;
- every recommendation cites either a concrete comparable project's practice
  (Svelte, Vue, Qwik, Mitosis, Vite ecosystem-CI, compiler-testing literature)
  or a specific mechanism in *this* codebase that it would protect;
- gaps are ranked, and each carries an explicit cost/benefit, so the owner can
  cut the list rather than receive an undifferentiated wish list.

## Constraints (non-negotiable)

- No changes to any file outside `docs/goals/frameless-testing-strategy-v1/`.
- No new dependencies installed, no test runs that mutate the working tree.
- `test-results/` (untracked, pre-existing) is left alone.
- Recommendations must respect the repo's stated philosophy: behavior is the
  proof, string snapshots are not. A recommendation that reduces Frameless to
  Mitosis-style snapshot verification is a misfire.
- The `grep` MCP server the owner expected is **not configured** in this
  environment (global and project `mcpServers` are both empty). Ecosystem
  research substituted `gh search code` / `gh api` against real repositories
  plus web research. This substitution must be disclosed, not papered over.

## Likely misfire

Producing a generic "add more tests" listicle — mutation testing, fuzzing,
coverage thresholds — without connecting each technique to the specific thing
in *this* compiler that can silently break. Frameless already has an unusually
strong oracle (differential behavioral comparison, calibrated against
deliberately broken components). The valuable output is the short list of
things that oracle cannot see, not a survey of testing in general.

## Blind spots to name explicitly

- Coverage of the *oracle itself* vs. coverage of the compiler. The analyzer
  proving it can detect 8 hand-written mutant classes is not the same as the
  scenario corpus covering the IR grammar.
- Input-space coverage. Three scenarios and eight composition fixtures is a
  fixed corpus; the IR grammar it is checked against is open.
- Everything outside the happy path: production builds, non-Chromium engines,
  multiple framework versions, error messages, sourcemaps.

## What counts as enough for this tranche

Three notes — current-state audit, ecosystem survey, ranked recommendation —
plus a final audit receipt confirming all three are evidence-backed and the
recommendation is ranked and costed. No implementation. Whether any of the
recommendations get built is a separate, owner-approved goal.
