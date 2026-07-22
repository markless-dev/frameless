# markless-storage — session handoff (2026-07-21, fable-5 limit; continue on Opus 4.8)

Read this + goal.md + state.yaml + notes/T003-design.md ([v2]/[v3]/[v4]
sections rule) to resume with full context. This is a fable-codex orchestrator
run: PM directs, crew (`crew run <packets.json>`) produces, PM diff-reviews +
commits. Workflow tool BANNED. Board is at docs/goals/markless-storage/.

## Where the two repos are

- FRAMELESS: session cwd = /Users/jacksm5pro/dev/open-source/frameless/.claude/
  worktrees/storage-poc (branch worktree-storage-poc). Docs/board commits go
  here docs-only with `git commit --no-verify` (worktree lacks node_modules /
  vp-lint hook), then `git rebase main -q && git -C /Users/jacksm5pro/dev/
  open-source/frameless merge --ff-only worktree-storage-poc -q` to publish to
  frameless main. The frameless main has diverged before (a fork session adds
  commits) — rebase-then-ff handles it.
- MARKLESS: /Users/jacksm5pro/dev/open-source/markless/.claude/worktrees/
  storage (branch feat/storage). WRITE ACCESS OWNER-GRANTED for this goal
  (memory: markless-write-authority) — branch only, NEVER markless main
  without explicit owner confirmation. node_modules installed; suites run
  here directly. Baseline was 482 compiler tests; now 492.

## EXACT resume state

Board active_task: T005 (markless slice 2, W2a-W2c). T001-T004 done+receipted.

markless feat/storage commits (newest first):
- b21d6fd  W2c WIP — let/const storage support + browser fixture/tests +
           harness options. **PENDING: browser lane NOT yet confirmed green.**
- 07cf973  W2a+W2b — render-time seed, lazy cells, storage plane, enableStorage
- acc7c8e  gzip byte-neutrality repair (dev-validator removed)
- c9369b8  W1b transport (protocol v2) + W1c import sources
- fb3e399  W1a declaration + binding + lowering

## IMMEDIATE NEXT STEP (do this first)

The browser lane executes the 4 storage contract cases (cold
fallback-attr-before-wake; warm dark + ZERO extra driver reads; write+reload
round-trip; deferred consent -> zero reads -> enableStorage() -> exactly-once
read+patch+persist). First run `ba2vki10z` exited 0 but its captured log was
truncated to 4 lines (background-move lost the vitest summary stream) — NOT a
trustworthy pass. A re-run was launched with full capture to a FIXED FILE:
- Command: `pnpm --dir packages/vitest-browser exec vitest run
  browser/storage.test.ts` from the markless worktree.
- Log: **/Users/jacksm5pro/.claude/jobs/bc1ba03c/tmp/w2c-browser.log**
  (also background id bmw7wpv97 if still tracked).
1. READ that log for the real Test Files / Tests pass-fail summary. If it shows
   all storage tests passed, W2c is proven. If the log is absent/incomplete,
   RE-RUN the command from the markless worktree (needs a real localhost
   listener — crew sandbox CANNOT do this, PM runs it directly, not via crew;
   vitest browser cold start is slow, ~5-7 min, so use a long timeout or
   background + poll the log file).
2. If 4/4 GREEN: accept W2c, amend/replace b21d6fd's message to drop "PENDING",
   receipt T005 on the board (both oracle-half-a items proven:
   suite-green + executed browser). Then T006.
3. If any case FAILS for a product reason: that's a real gap — cut a repair
   packet (do NOT weaken assertions). The W2c worker already found one real
   gap this way (let-vs-const), which is why b21d6fd exists.

## THEN: T006 boundary critique (REQUIRED — public API + protocol change)

Second-model critique via crew before frameless consumption: rerun the FULL
markless suite (`pnpm test` from the worktree — vp test + boxes lanes + bench
guard), review protocol-v2 compatibility, API fidelity to ratified direction,
seed-script CSP/nonce, the reachability filter, and the 3 owner checkpoints.
Go/no-go for T007.

## THEN: T007 frameless consumption (the whole second half — ~30% of goal)

In the FRAMELESS worktree. Design section D6' W4:
1. Vendor repack: pack ALL 8 @markless/* tarballs from feat/storage into
   frameless vendor/ (currently 0.1.1 @ rev 5e5a100/older POC pack — 46+
   commits stale). Record packed-from rev in vendor/PROVENANCE for each.
   Re-verify the composition lane doesn't regress (composition-v1 shipped
   380+ tests).
2. Frameless compiler: recognize storage() through the enriched IR (a storage
   record), USING additionalFrameworkApiSources: ['@frameless/core'] so
   frameless consumers NEVER import @markless/* (this is the P5 branding
   constraint finally solved properly — owner corrected me twice on this).
3. React emitter: seed-script emission into SSR shell (T009 pattern) + cell
   lowering per the storage-poc react adapter (poc/09-storage/react).
4. e2e: the storage-poc runner assertions (poc/09-storage/runner/run.mjs,
   65/65 is the reference contract) against EMITTED frameless output. Full
   frameless lane green. Solid = stretch only if React lands clean.

## THEN: T999 final audit — full_outcome_complete requires EXECUTED proof
BOTH sides (markless browser green + frameless e2e green), not compiling code.
markless main merge only with explicit owner confirmation; else leave on
feat/storage and record the PR/merge decision.

## 3 OWNER CHECKPOINTS parked (report at delivery; none block progress)

1. Key namespacing policy — v1 = verbatim key, charset [a-z][a-z0-9-]*. Options
   (prefix config / hashed module-scoped ids) await owner.
2. enableStorage() naming + placement on the host runtime handle.
3. BUDGET: vite-csr / vite-plus zero-slack gzip gates RED by 13 / 19 bytes =
   irreducible strict-protocol-v2-decoder bytes. Options: ~20B budget raise
   vs specialized v1/v2 runtime entrypoints. Validation NOT weakened, budgets
   NOT touched. (music-player-ssr gate now PASSES by 2,847B after the
   dev-validator removal.)

## Ratified design invariants (do not re-litigate)

storage(key, fallback) is the ONLY new API. Inert at creation; lazy driver
read; landing-slot consumption; write-back + data-<key> attr; honest
fallback-then-patch. Seed AUTO-injected by compiler from reachability (no
enablement switch — that was library-world thinking). Consent = the one policy
gate (storageAccess immediate|deferred + enableStorage()). v1 = localStorage +
strings only. attach-promotion is a SEPARATE future goal but the slot schema
(Symbol.for('tsrx.storage/1'), <moduleId>#<key>, reserved element-instance
suffix) is kept promotion-compatible. Everything SUGGESTION until owner
ratifies; nothing "decided/final."

## Other live goals (not this session's task)
- qds-primitives: CLOSED (full_outcome_complete). frameless main.
- storage-tradeoff / storage-poc: CLOSED. poc/09-storage is the executed
  reference contract (65/65 four-framework + promotion probe).
- frameless-composition-v1: CLOSED by a fork session.
