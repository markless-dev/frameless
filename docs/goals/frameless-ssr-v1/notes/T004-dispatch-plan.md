# T004 dispatch plan (PM working note)

T004 (SSR infrastructure) is executed via a **crew sub-sequence** (fable session:
production goes through `crew run`, single-unit `parallel:1` runs in the main
checkout with node_modules installed and self-verifies). Authority: T003 Decision 8.

The unit is decomposed to **de-risk the biggest unknown first** — does build-time
prerender + static witness preview actually work in this repo (novel here; markless
leaned on nitro, which we cannot import). Splitting by framework also keeps each unit
inside the ~15-min crew envelope.

## Sub-units

> **LESSON (2026-07-21):** the crew worker sandbox has **no network**. T004a's first
> attempt tried `pnpm install` to add `@async/witness`, which failed (ENOTFOUND) and
> **purged node_modules**, breaking the repo. PM restored via `pnpm install
> --no-frozen-lockfile` (this also installed `@async/witness@0.7.0` + updated the
> lockfile — a real T004 deliverable). Rule: PM pre-installs new deps; workers never
> install. See memory `crew-sandbox-no-network`.

- **T004a — react-ssr-foundation** (attempt 1 BLOCKED on install-purge; draft salvaged —
  high quality, only bug was a vite client-build `index.html` UNRESOLVED_ENTRY when built
  through witness's `pipeline.build` overlay): **REPAIR dispatched**, run-id
  `t004a-repair-client-entry`, crew bg id `bln8433m4` — deps pre-installed, fix the
  client-build entry so the react render box passes + full verify. Draft (attempt 1) crew
  bg id was `bxkmjeacu`. witness root `demos/ssr/` as ONE workspace package;
  `@async/witness` pinned 0.7.0 + five re-eval triggers in `demos/ssr/WITNESS-PIN.md`;
  `react-app/` consuming CLI-built emitted React `.jsx` (PricingCard copy);
  build-time prerender (local vite plugin; fallback in-box `project.edit.create`);
  ONE browserless render box (`preview.request('/')` + bounded `expect.html.contains`
  smoke + build-parity). Root `e2e:ssr` **stub** only. Proves the serving mechanism.

**T004a: ACCEPTED (PM-verified 2026-07-21).** React SSR foundation green — witness box
`react emitted output prerenders before activation` PASSED (pipeline+box corroborate),
prerendered HTML carries real server output (`<h2>Pro</h2>...$20`), `@async/witness@0.7.0`
pinned in lockfile, `pnpm check/lint/test/build` all pass (481 tests). Mechanism proven:
build-time prerender plugin + static `pipeline.preview`. Second lesson: **crew sandbox
also blocks the loopback listener** (`EPERM 127.0.0.1:4173`), so witness's preview step
can't run in-sandbox — witness-run verification is PM-side.

- **T004b — solid + probe + e2e stub** (DISPATCHED, run-id `t004b-solid-lane-and-probe`,
  crew bg id `b92czhcia`; PM pre-installed solid-js 1.8.22 + vite-plugin-solid 2.11.10 into
  demos/ssr; worker builds+self-verifies, PM runs witness for the preview boxes+probe):
  `solid-app/` NEW vite lane (`ssr:true`, `solid.generate:'ssr'`, `hydratable`,
  server-condition resolution, `hydrate` + `generateHydrationScript`, solid-js 1.8.22);
  solid render box; the **two-previews-one-run PROBE** (both apps now exist — T003
  Decision 2 mandatory; if it collides → blocked-return, fallback topology is PM/Judge);
  finalize `e2e:ssr`.

## Merge model

`parallel:1` writes DIRECTLY to the working tree (no branch). PM reviews the resulting
`git diff` and independently re-runs `witness run` before accepting. Critique gate per
fable-codex: run second-model critique only if the diff touches a compat/security/emit
boundary, verification is incomplete, or worker deviated — otherwise record skip reason.

## T005 tranche plan (active — same crew model: PM pre-installs deps, PM runs witness/e2e)

T005 (full proof suite + schema + docs, T003 Decision 8) decomposed into sequential
crew units, foundations first:

- **T005a — pre-activation adapter** (DISPATCHED, run-id `t005a-preactivation-adapter`,
  bg `bqqquhvj6`): parse5 HTML → analyzer `SerializedNode` → `evaluateExpectations`
  (dom-* only, Decision 3), ZERO analyzer changes, + unit tests with a negative control.
  Fully sandbox-verifiable (no witness/browser). PM pre-installed `parse5@7.2.1` +
  `@frameless/analyzer` (workspace) into demos/ssr. Contract: `demos/ssr/**` only.
  **ACCEPTED (PM-verified):** `evaluatePreActivation` via `parseFragment`→SerializedNode,
  dom-* only, focus+non-mount filtered, zero analyzer changes; 5/5 tests incl. negative
  control ($999 vs observed $20). Integration note for T005d: decide the HTML slice fed to
  the adapter (full doc vs `#root` innerHTML) so dom-path expectations align.
- **T005b — ui-kit scenario expectations** (DISPATCHED, run-id `t005b-uikit-mount-expectations`,
  bg `bjzizqoku`): add mount-phase dom-* initial-state expectations to `demos/ui-kit/scenarios.ts`
  (Decision 3 flagged gap; extend the LOCAL structural Scenario type — no analyzer import, its
  package.json isn't in contract). e2e.mjs:62 already evaluates `scenario.expectations` generically.
  Node/tsc-verifiable in-sandbox; VALUE-correctness (vs real DOM) PM-verified via `pnpm e2e`.
  **ACCEPTED (PM value-verified):** local structural Expectation union + optional field
  (no analyzer import). All 24 mount expectations (3 scenarios × react/solid) PASS against
  real captured DOM — pricing $24, task-list "2 open"/counts, newsletter "idle"/fields.
  **FINDING (must fix in T005e):** `scripts/e2e.mjs`'s ui-kit loop (147-167) does `compareRuns`
  but NEVER calls `assertExpectations` (only the composition-kit loop, 176-177, does). So the
  SHIPPED `pnpm e2e` does not yet EVALUATE ui-kit expectations — T005e must add
  `assertExpectations(react,scenario)`+`(solid,scenario)` to the ui-kit loop (and store
  ui-kit expectationResults) so "ui-kit covered" is genuinely true for T999. PM verified values via a
  throwaway script against `demos/ui-kit/traces/{react,solid}/*.json`.
- **T005c — receipts-schema bump** (QUEUED, CRITIQUE-SENSITIVE): `frameless-receipts/1`→`/2`
  with the `ssr` entry EXACTLY per Decision 6 (activation: hydrate|resume; rejected fields
  stay out), analyzer validateReceipt + tests + `renderResults` string. Make the `ssr`
  entry OPTIONAL so `pnpm e2e` stays green before T005e populates it. Contract: packages/analyzer.
- **T005c — receipts-schema bump — ACCEPTED (PM critique PASS).** `frameless-receipts/2`,
  optional `ssr` entry EXACTLY per Decision 6, exact-key validation, activation∈{hydrate,resume},
  4 new tests incl. `hydrationMismatches`-rejection negative (Decision 7 fitness enforced), grep
  guard clean, 485 tests green. Opus-vs-gpt-5.6-sol diff review = the required second-model critique.
- **T005d — full box inventory + calibration** (split; QUEUED): claims a/b/c boxes per framework
  using the adapter + scenarios + calibration boxes (incl. React-19 mismatch-console-shape
  verification — a stop_if if mismatches don't surface as consoleErrors). PM runs witness.
  - Design fact: routes must render each component with its SCENARIO initialProps (single-sourced
    by importing `../ui-kit/scenarios.ts`, Decision 5d) so mount DOM matches T005b expectations.
    Component props match scenario initialProps keys exactly (verified). Current apps hardcode
    mismatched props ('Pro' vs 'Studio') — T005d1 fixes this.
  - **T005d1** (routing + emit all 3 components + claim (a) pre-activation boxes both frameworks)
    — **ACCEPTED (PM-verified, after a PM serving hotfix).** Full ui-kit corpus SSRs at
    /pricing-card, /task-list, /newsletter-form (+ / alias); claim-(a) boxes evaluate #root inner
    markup via the adapter. All 5 witness boxes pass (claim-a react+solid, 2 render smokes, probe).
    **BUG witness caught that the worker's in-process direct-eval MISSED:** apps were `appType:'spa'`
    and boxes requested `/task-list` (no trailing slash) → SPA fallback served the ROOT (PricingCard)
    page for every route → task-list observed 0 (and pricing-card FALSE-passed since root===pricing-card).
    **PM hotfix:** `appType:'mpa'` (no fallback masking wrong routes) + boxes request the directory
    path `/name/`. This fix is witness-coupled (only the PM host can run witness — loopback), so a blind
    crew round-trip was low-value; done PM-side + re-verified (5/5). LESSON: worker self-checks that
    bypass `pipeline.preview` (direct artifact eval) miss serving bugs — the PM witness run is the real gate.
  - **T005d2** (claim (b) clean-activation boxes both frameworks) — **ACCEPTED (PM-verified).**
    7/7 witness boxes pass; the two claim-(b) boxes show `[pipeline+ client+ driver+]` — the
    CLIENT witness CORROBORATES real browser activation with consoleErrors:0/failedRequests:0
    across all 3 routes × 2 frameworks. No hydration mismatches. Framework-neutral (Decision 7):
    bounded DOM settle via `expect.page.exists`, no hydrate-moment assumption. **Claims (a)+(b)
    now behaviorally proven for React+Solid across the full ui-kit corpus.**
  - **T005d3** (claim (c) post-activation scenarios — DISPATCH NEXT). **WITNESS CAPABILITY FINDING:**
    `PageHandle` is intentionally minimal — ONLY `click(selector, opts)`; NO text-input/type/fill/
    focus primitive (`PageInteraction.kind` = `'click'` only). Decision 5 anticipated this ("input
    actions AS EXPRESSIBLE"), so NOT a blocker: claim (c) drives click + checkbox-via-click actions
    on seed data (pricing-card add-seat → seat/price update; task-list toggle/remove/clear on seed
    tasks; newsletter check+subscribe), asserts post-action DOM + clean console, and RECORDS the
    text-`input`/`focus` actions as inexpressible-in-witness-0.7.0. → **PRODUCT-FEEDBACK candidate
    for the owner** (owner owns witness): a bounded text-input primitive would let the SSR lane
    replay full scenarios. Surface at T999 / final summary (non-blocking).
  - **T005d3** (claim (c) post-activation) — **ACCEPTED (PM-verified, after a PM $48 fix).**
    9/9 boxes pass; both claim-(c) boxes `client+`. Click/checkbox-expressible actions:
    pricing-card add-seat → seat 2 / $48 (12×2×2 — my packet said $36 by arithmetic slip; the
    behavior was correct, I fixed the asserted constant); task-list create/toggle/remove/clear
    (open-count 3→2→1→0); newsletter check+subscribe → 'subscribed'. Text-input/focus actions
    recorded as witness-0.7.0-inexpressible. **Both frameworks pass the SAME assertions → claim (d)
    equality evidenced behaviorally; formal aggregation is T005e.** **Claims (a)+(b)+(c) PROVEN
    for React+Solid.**
  - **T005d4** (claim (b) calibration) — **ACCEPTED (PM-verified, after a PM calibration-pattern
    redesign).** 11/11 boxes pass; the 2 calibration boxes are **contested passes** (`client!`,
    "1 page error", exit 0). **STOP_IF RESOLVED FAVORABLY:** React skew → hydration mismatch
    error #418 → observed in `consoleErrors` (which counts console-errors + uncaught page-errors);
    Solid hydratable-off → 1 page error. So claim (b)'s `outcome({consoleErrors:0})` genuinely
    detects a dirty activation — **claim (b) is trustworthy, empirically.** **CALIBRATION PATTERN
    LESSON (witness evidence model):** a try/catch around `expect.page.outcome({consoleErrors:0})`
    does NOT make a green box — witness records the failed assertion permanently AND the client
    witness contradicts on the console error. The correct pattern: assert the EXPECTED-BROKEN count
    (`outcome({consoleErrors:1})`) → the box's own assertion passes → witness marks it a CONTESTED
    PASS (green run + receipted intentional error). This literally realizes Decision 5's "run stays
    green while fallibility is receipted." T005e's calibration.proven aggregation reads these
    contested-pass calibration receipts.
  - **T005d4b** (claim (a) + claim (c) calibrations) — **ACCEPTED (PM-verified).** 13/13 boxes pass
    (content calibration clean; handler calibration `client+` clean; the 2 claim-b calibrations
    stay contested-pass). Full box inventory + all 4 calibration types green. **Box suite COMPLETE.**
- **T005e — e2e folding + equality + ui-kit assertExpectations wiring** (DISPATCHED, run-id
  `t005e-e2e-ssr-folding`, bg `b1wx0ohtq`): pure `buildSsrEntry(receipt)` module + fixture test
  (against the real 13/13 receipt on disk) → folds the Decision-6 `ssr` entry + equality verdict
  into `pnpm e2e`; wires ui-kit `assertExpectations` (T005b gap). Worker self-verifies the pure
  module + check/lint/test/build; PM runs the live `pnpm e2e` (browser+loopback).
- **T005f — docs honesty + browser provisioning** (QUEUED): README (only what's proven — React/Solid
  SSR behavioral proof, activation-neutral contract; NOT Qwik, NOT publish) + `WITNESS_BROWSER_PATH`/
  Chromium fresh-clone prereq for T999.
- **Then:** apply T005 board receipt (all sub-units) + advance to T999 (fresh-clone audit).
  - **T005e** e2e folding must also wire ui-kit `assertExpectations` (see T005b finding) + fold ssr entry.
- **T005e — equality aggregation + verdict folding** (QUEUED): scripts/e2e.mjs SSR lane +
  fold `ssr` entry into frameless-receipts.json (Decision 5d). PM runs `pnpm e2e`.
- **T005f — docs honesty + browser provisioning** (QUEUED): README/docs (only what's proven);
  document `WITNESS_BROWSER_PATH`/Chromium as a fresh-clone prereq for T999.

Merge/critique gate applies per unit; T005c (schema/compat) and any React-19-mismatch
finding in T005d are the likely critique triggers.

## After both sub-units accepted

Apply the T004 receipt to `state.yaml` (changed files, verify results, box statuses,
receipt path), then advance `active_task` to **T005**.
