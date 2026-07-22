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

## STATUS: warm/write reconcile fix now EXECUTED-PROVEN in Node; browser 4/4 still pending a clean env

markless HEAD is now **259f89c**. Three commits address the 2/4 browser
failures, and the fix is now proven at the graph level in Node (which runs
here; the browser lane does not — see env block below):
- 4784d70: two root-cause fixes (slot-key anchor + readInitializer in
  payload-graph-construct). But fix #2 alone had a GAP: readInitializer only
  fires on a READ, and an SSR-rendered text binding never re-reads itself, so
  nothing triggered the reconcile in immediate/warm mode.
- 259f89c: CLOSES that gap — the storage plane now reads each cell on
  immediate-mode mount, firing the slot-backed initializer -> dirty -> flush
  -> dependents reconcile fallback->seeded. NEW Node test
  'immediate warm mount reconciles a dependent from fallback to the seeded
  value' (packages/web/test/storage-plane.test.ts) reproduces the EXACT
  browser-failure scenario and passes: subscriber notified 'dark' exactly
  once, zero extra driver read. web+runtime 334 green.

CONFIDENCE NOW: high — the specific failing behavior (a dependent stuck on the
fallback) is executed-proven fixed in Node. The browser lane would additionally
prove the real SSR->resume->DOM wiring; run it in a clean env to fully close
W2c (command + gotchas below). If it somehow still fails, the Node test shows
the graph mechanism is correct, so any residual would be in the DOM-patch
layer, not the adoption logic.

### (superseded) earlier note: browser 4/4 NOT yet executed-confirmed
markless earlier HEAD was 4784d70, on top of a893f14
(red marker) / b21d6fd (W2c WIP). The two warm/write failures were diagnosed
to TWO root causes, both fixed, both unit-green (compiler 492, web units 289):
1. SLOT-KEY MISMATCH: the seed script wrote the landing slot under a key built
   from the BUNDLER filename (transform.ts passed input.filename), but the
   wake-time override derived its lookup key from the payload record's
   graphNodeId (storage:<COMPILER-filename>#key). Different origins -> lookup
   miss -> fallback. Fixed: new `createStorageSeedMetadataFromGraphNodeId`
   (serializer/storage-slot.ts) anchors the seed slotKey to the graphNodeId so
   both sides match by construction (transform.ts:209 uses storage.graphNodeId).
2. RECONCILE GAP (the deeper one): the immediate/warm adoption in
   payload-graph-construct.ts SET the cell's initial value to the seeded value.
   That fires no notification, and SSR rendered the FALLBACK text (server can't
   read localStorage), so the text never reconciled; a later equal write is
   Object.is-suppressed too. FIX: route the seeded value through a
   `readInitializer` (the proven dirty-on-first-read path the CSR branch
   already uses), leaving cell.value at the fallback so the reconcile genuinely
   fires; reads the slot (not the driver) so "no extra driver read" still holds.
   This mirrors why enableStorage (deferred) and toggle (interaction) already
   worked — both reconcile via a dirtying write.

WHY NOT CONFIRMED — ENVIRONMENTAL, not a code signal (do NOT keep retrying on
this machine without clearing it first):
- The vitest-browser lane needs >8-10 min cold. The harness SIGTERMs the
  background/foreground job before it finishes -> empty or bogus
  "0 tests / success:true" JSON (that JSON shape = a KILLED run, not a pass).
- After many launches the machine hit MEMORY PRESSURE: the last isolated
  warm-only run was SIGKILL-ed (OOM), each vitest+chromium worker is ~300-400MB
  and killed runs left residue. A wedged node proc holding the vitest port
  (was PID 72056) caused startup hangs earlier.
- All stray procs/ports cleared at handoff, but the machine likely needs a
  FRESH state (new terminal, or reboot) to run the lane cleanly.
DEFINITIVE FINDING (11+ attempts incl. a fully-clean machine, isolated single
test, foreground + background): the markless vitest-browser lane
(`packages/vitest-browser exec vitest run browser/storage.test.ts`) CANNOT
complete in this session's environment — it is killed during collection every
time (rc=1, JSON with 0 tests / bogus success:true). This is NOT a cleanup
issue (a verified-clean machine failed identically). The heavy vitest-browser
+ vite-plus + Playwright stack exceeds what the harness/machine allows here.

RECOMMENDED PATH (two options, in order):
1. STANDALONE playwright-core RUNNER (proven to work in THIS environment):
   earlier this session the frameless poc used poc/09-storage/runner/run.mjs —
   a plain Node script that launches chromium via playwright-core, serves HTML,
   runs assertions — and it completed fine (65/65, plus the promotion probe).
   The vitest-browser lane is what fails, not browsers. So: write an equivalent
   standalone runner for the markless storage contract — compile the fixture
   through markless (SSR HTML + client resume bundle), serve it, drive the 4
   cases (cold/warm/write+remount/deferred) with playwright-core directly. This
   AVOIDS the vitest-browser+vite-plus stack and should run here. Reuse the
   poc/09-storage runner as the template (same Symbol.for slot, same
   assertions). This is the highest-value next task and is buildable in-session.
2. Or a human runs the vitest-browser lane in a real terminal (no harness
   job-timeout, full memory). One clean run confirms 4/4.

NOTE the graph-level reconcile is ALREADY Node-executed-proven (259f89c test),
so the browser proof's remaining marginal coverage is only the SSR->resume->DOM
patch layer.

### DO THIS FIRST (confirm the fix)
Run the lane where it can finish uninterrupted (human-run in a terminal, or a
session whose job timeout exceeds ~12 min). ALWAYS kill stragglers first:
  `pkill -9 -f vitest; pkill -9 -f ms-playwright; pkill -9 -f chrome-headless;
   lsof -nP -iTCP:63315 -sTCP:LISTEN` (kill any PID still holding it), then:
  `cd <markless-worktree> && pnpm --dir packages/vitest-browser exec vitest run
   browser/storage.test.ts --reporter=json --outputFile=/tmp/w2c.json`
Read /tmp/w2c.json: numFailedTests==0 AND numTotalTests==4 = W2c PROVEN.
The 4 cases: cold seed-attr / warm adopt-without-extra-read / write+SSR-remount
/ deferred+enableStorage. If warm/write STILL fail 'expected dark got light'
after 4784d70, the reconcile fix's readInitializer isn't firing a post-wake
read — fall back to the enableStorage pattern: in storage-plane immediate mode,
on creation do `graph.write(seededFromSlot)` per record (cell must be left at
fallback in payload-graph-construct so the write isn't Object.is-suppressed);
that write path is PROVEN to reconcile (deferred test passes via it).

### After 4/4 green: accept W2c, then continue below.

## (prior red-state section, superseded by the fix above)
## ⚠️ BROWSER PROOF WAS RED — 2/4 FAIL (now fixed pending confirm)

Definitive JSON result (clean run bds3knr6j, no port conflicts):
/Users/jacksm5pro/.claude/jobs/bc1ba03c/tmp/w2c-result.json — 2 passed, 2 FAILED.
The earlier "exit 0" runs were FALSE POSITIVES from port-conflicted runs that
never truly executed (lesson: never trust exit-0 alone here; use the json).

- PASS: "cold load seeds the fallback before framework wake"
- PASS: "deferred storage waits for enableStorage and persists later writes"
- FAIL: "warm load adopts the seed without an extra runtime driver read"
        (storage.test.ts:78) — expected 'dark', got 'light'
- FAIL: "writes update every plane and survive a fresh SSR mount"
        (storage.test.ts:109) — expected 'dark', got 'light'

DIAGNOSIS (single root cause): the component's reactive `{theme}` text renders
the FALLBACK, not the seeded/written value. Cold passes (attribute seeded) and
deferred passes, so the seed script, the data-<key> attr, and the slot WRITE
all work. The broken link is WAKE-TIME ADOPTION: the value in
window[Symbol.for('tsrx.storage/1')] slot (warm) / the persisted write is not
reaching the graph cell that the component's `{theme}` read resolves to.
LOOK AT: packages/web/src/payload-graph-construct.ts (the v2 storage slot
override before createRuntimeGraph — is it matching the cell by the right
graphNodeId/slotKey and actually replacing the value the component reads?);
how the compiled fixture lowers `{theme}` (does the text binding read the
storage graph node, or a separate payload cell that keeps the fallback?);
resume-runtime.ts storage-plane wiring. The storage-poc reference
(poc/09-storage) shows the intended behavior: seed -> landing slot ->
runtime consumes slot value, zero re-read. Likely the slot key schema
(<moduleId>#<key>) used by the render-time seed (W2a) and the lookup in
payload-graph-construct (W2b) DISAGREE, or the override runs but the text
binding reads a pre-seeded fallback cell.

REPAIR PATH: cut a crew packet to fix the adoption path, re-run the browser
lane (detached + json + port-cleanup per gotchas below), require 4/4 before
accepting W2c. Only THEN un-pend b21d6fd, receipt T005, go to T006.
Current markless HEAD: a893f14 (empty marker recording this red state) on
top of b21d6fd (W2c WIP).

## IMMEDIATE NEXT STEP (after the repair above lands 4/4)

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
1. READ the result. NOTE: plain stdout redirection TRUNCATES (vitest's summary
   stream is lost whenever the harness backgrounds the process — happened 3x,
   all exit 0 but 4-line logs). Exit 0 from `vitest run` = all passed (it
   returns 1 on any failure), so 3 consecutive exit-0 runs is strong evidence
   W2c passes — but for a STRUCTURED result use the JSON reporter, which vitest
   writes atomically at the end:
     Target file: **/Users/jacksm5pro/.claude/jobs/bc1ba03c/tmp/w2c-result.json**
     (numTotalTests/numPassedTests/numFailedTests + per-assertion status).
     Latest clean detached run: background id **bds3knr6j** (log w2c-clean.log).
   GOTCHAS learned the hard way (do not repeat):
     - Run DETACHED (run_in_background), NEVER a foreground timeout: the lane
       needs >8 min; foreground SIGALRMs it (exit 144) before it writes json.
     - Launching multiple runs leaves ZOMBIE vitest/chromium procs holding the
       port ("Port 63315 is in use") which SIGTERM the next run (exit 143).
       Before a fresh run: `pkill -f "vitest.*storage.test"; pkill -f
       chrome-headless; pkill -f vitest-browser; sleep 2` then launch ONE.
     - Plain stdout redirect truncates to 4 lines; only the --reporter=json
       --outputFile path gives a durable structured result.
   Command: `pnpm --dir packages/vitest-browser exec vitest run
     browser/storage.test.ts --reporter=json --outputFile=<path>` from the
     markless worktree.
   EVIDENCE SO FAR: 2 clean exit-0 runs (ba2vki10z, bmw7wpv97) — vitest run
     returns 0 only if all pass, so this strongly indicates W2c passes; the
     json just makes it structured/auditable.
   If numFailedTests==0, W2c is proven; accept it and proceed to T006.
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
