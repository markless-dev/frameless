# Frameless v0: the real product

> This goal turns the proven POC pipeline (goal `frameless-mitosis-successor`, closed
> with `full_outcome_complete: true`) into the actual Frameless product. Naming:
> **Frameless** (final). npm publishing is out of scope until the name is resolved.

## Objective

Ship Frameless v0 in this repo: a monorepo where

1. a **compiler-extension package** consumes the markless compiler (pinned vendored
   artifacts) and produces the versioned enriched IR;
2. a **targets/ architecture** hosts per-framework backends — `targets/react` (React
   19) and `targets/solid` — each owning its emitter, conventionality-gate config,
   oracle adapter, and framework-version matrix;
3. the **equivalence oracle** (vitest browser mode, headless Chromium) is the
   product's test infrastructure, and its receipts are the support matrix;
4. **one documented command** compiles a real demo TSRX component library end-to-end
   into both targets with gates and cross-target equivalence receipts green, from a
   fresh checkout.

## Original Request

"I want the real frameless project, I want this thing in reality, something that
would change the game for frontend forever." Preceded by: compiler extension vs
targets folder; vitest browser mode per framework; write-on-change is just regular
state; user picked productization over composition-first.

## Goal Oracle

`From a fresh checkout, one documented command compiles the demo TSRX library into
React 19 and Solid packages that pass each target's conventionality gate and produce
green cross-target equivalence receipts under the oracle in headless Chromium — and
the migrated POC evidence suites still pass.`

The demo library has no hand-written references: its receipts are cross-target
(React output vs Solid output) plus scripted scenarios. That IS the product value
prop; it must be exercised, not simulated.

## Non-Negotiable Constraints

- The markless repo is owned by the user's separate fixing board right now: read-only
  here, consumed via pinned vendored tarballs (poc/vendor pattern). IR-upstreaming
  and accepted-import-sources changes wait for that board to close.
- Migrate proven POC code; do not rewrite from scratch. poc/01..08 remain intact as
  the shipped report's evidence base — their suites must stay green.
- React target is 19 (ref-as-prop); validate the bump, don't assume it. Solid emits
  v2-forward idioms with the v1 runtime fallback documented (until a v2 toolchain
  exists). Solid's generality boundary docs carry over.
- v0 surface = the proven fixture-family surface. Composition (children/slots,
  shared->context, refs) is the next tranche; mount-scoped work is a markless
  language question queued behind the fixing board. Demo library must fit the
  proven surface — trim the demo rather than extend the surface.
- Fable session: implementation through crew dispatch (`crew run`), PM diff-reviews
  every branch, run-or-skip critique reason recorded at each merge; emitter/architecture
  packages always get second-model critique (lesson from the prior goal). Crew
  worktrees may lack node_modules and network — verification completes PM-side;
  failed-unit worktrees: stage only the unit's contract paths (stale-base lesson).
- Load the markless skill before touching .tsrx/markless internals. Honesty rules
  from the prior goal apply: no claim beyond proof, gaps are findings, receipts never
  fabricated.

## Stop Rule

Stop only when the final audit proves the oracle signal from a fresh checkout and
records `full_outcome_complete: true`. Do not stop at architecture decisions or a
scaffold — the end-to-end command working is the outcome. Do not let "change the
game forever" expand v0 scope: the recorded misfire is scope explosion, grand
rewrite, or skeleton theater; the final audit checks all three explicitly.

## Canonical Board

`docs/goals/frameless-product-v0/state.yaml` — if this charter and state.yaml
disagree, state.yaml wins.

## Run Command

```text
/goal Follow docs/goals/frameless-product-v0/goal.md.
```

## PM Loop

1. Read this charter, then state.yaml.
2. Work only the active task; assign by task type; crew-first with recorded
   fallbacks; PM verifies everything it accepts.
3. Receipt, board update, next largest safe package; Judge only at phase/risk/final
   boundaries.
4. Finish only with the T999 audit receipt recording full_outcome_complete: true.

## Org-convention constraint (2026-07-19, user)

Frameless will be pushed to the markless GitHub org. The monorepo must match the
markless repo's conventions — pnpm workspace under `packages/`, matching
package.json/tsconfig shapes, test lanes + doctor-script pattern, `specs/` as the
normative contract home, CONTRIBUTING package map, and the `agent/<name>.md`
playbook pattern — derived by T001 from the read-only markless checkout, not
invented. Divergences require a recorded rationale in T001's architecture note.
