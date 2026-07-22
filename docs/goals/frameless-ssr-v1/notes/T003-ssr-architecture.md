# T003 — SSR architecture lock (phase boundary)

Judge decision note. Every decision cites T001 evidence (`notes/T001-witness-ssr-evidence.md`,
cited as T001 §n) or files read this pass. Owner directives in goal.md are treated as binding.

## Decision 1 — SSR serving strategy: BUILD-TIME PRERENDER + STATIC PREVIEW

**Locked:** each per-framework demo app is built through `pipeline.build` (builder strategy,
client + ssr environments); the server bundle renders the app's routes to HTML at build time
(`renderToString` React / `renderToString` from `solid-js/web` server build for Solid), writing
prerendered `index.html` (server markup + hydrate client entry `<script type="module">`, plus
Solid's `generateHydrationScript()` output) into the build output. `pipeline.preview` then
serves it statically; `preview.request(path)` returns the true pre-activation HTML and
`preview.browser.visit(path)` performs real activation against served output.

**Primary mechanism:** a small local Vite plugin in each demo app's own config runs the
prerender at the end of the build, so `pipeline.build` alone yields a servable dist.
**Sanctioned fallback (same architecture, no re-lock needed):** the box itself imports the
built server bundle (boxes run in node via runnerImport, T001 §1 discovery) and writes the
prerendered HTML via `project.edit.create` (auto-restored after the box, T001 §1) before
`pipeline.preview`. T004 picks between the two; stop_if only if neither works.

**Why, grounded:**
- Witness has **no "run my node SSR server" primitive** (T001 §3: "witness's API has no run-my-
  node-SSR-server primitive"); markless previews are SSR-capable only because markless's own
  plugin brings nitro. A minimal node server entry would mean rebuilding a nitro-alike — the
  most new machinery of the three options, and it replicates the one part of the markless
  pattern we cannot import.
- A Vite SSR **dev-server** lane fails the charter twice: claims must be proven over **CLI-built
  emitted output served as built artifacts** (goal.md misfire: apps bypassing the pipeline; dev
  mode serves transformed sources, not built output), and dev-mode SSR environments are the
  *unproven* half of witness's surface (EnvironmentHandle.import noted "dev mode" only, T001 §1).
- Prerender + preview uses **only witness primitives proven in anger** by the real markless SSR
  box (T001 §1 "Real SSR usage pattern": build → `preview.request` → string assertions →
  `browser.visit` → interactions → `expect.page.outcome({consoleErrors:0, failedRequests:0})`).
  T001 §3 itself names build-time prerender as candidate (b).
- Hydration/activation against statically-served prerendered HTML is exactly the deployment
  shape static SSR ships with — the behavioral claims are proven on the artifact, not a dev shim.

## Decision 2 — Topology and command surface

**Locked:** ONE witness root at `demos/ssr/` containing both apps (`demos/ssr/react-app/`,
`demos/ssr/solid-app/`) and all `*.box.ts` at the root, boxes selecting the app via the
`configFile` inline overlay (the exact markless pattern, T001 §1: `pipeline.build({config: c =>
({...c, configFile: ...})})`). One `witness run` → one receipts tree at
`demos/ssr/.witness/receipts/` (satisfies the oracle's ".witness/receipts/" location).

- **Mandatory probe (T004):** the one-preview-per-run limitation was recorded by markless in a
  nitro context and is **unverified for plain static preview** (T001 §1 known limitation; T001
  Open risk 2). T004's first box must prove two static previews (react + solid) in one run.
  If they collide: blocked-return with the receipt — fallback is two per-app `witness run`
  roots aggregated by the e2e script (also evidenced shape, T001 §3). Do not silently fork.
- **Command surface:** `pnpm e2e` REMAINS the one documented command. `scripts/e2e.mjs` grows
  the SSR lane: after the existing CLI-build + browser-mount lane, it invokes `witness run` in
  `demos/ssr/`, reads the run's `receipt.json` (resolving via the `latest` pointer, T001 §1),
  cross-checks equality (Decision 5d), and folds the verdict into `frameless-receipts.json`.
  `pnpm e2e:ssr` is added as a dev-iteration convenience only; docs and T999 point at `pnpm e2e`.
- **Verdict aggregation:** a box `status` of failed OR any witness `contradicts` verdict
  (four-witness model, T001 §1 receipt shape) fails the lane; `contested` passes are surfaced
  in the frameless receipt, not swallowed. The `asyncWitnessReceipt` version marker is read
  from the live receipt, never assumed (T001 Open risk 8).

## Decision 3 — Pre-activation assertion mechanism: ANALYZER REUSE over parsed server HTML

**Locked:** in-box node-side evaluation. `preview.request(path)` yields the pre-activation HTML
string (the only true pre-activation observation — in a live browser scripts execute on visit,
T001 Open risk 3). A small adapter in `demos/ssr/` parses that HTML (parse5, spec-compliant,
dev-dep of the ssr root only) into the analyzer's `SerializedNode` shape and calls
`evaluateExpectations` from `@frameless/analyzer` with a synthetic single-observation
`RunTrace` at phase `mount`.

**Feasibility verified this pass** (`packages/analyzer/src/expectations.ts`): the evaluator's
own contract is "Evaluate scenario assertions against serialized observations, never the live
DOM" (:139). `SerializedNode` is purely structural (`nodeType/tag/attributes/text/children`,
`packages/analyzer/src/types.ts:66-75`); `nodeId` is consumed only by the `focus` kind, so
`dom-text` / `dom-present` / `dom-path` evaluate over parsed HTML with zero analyzer changes.

- **Scope rule:** the pre-activation corpus is dom-* kinds only; `focus` expectations are
  activation-dependent and excluded pre-activation (they remain in post-activation lanes).
- **Rejected:** `expect.html.contains` as the mechanism — string containment is textual
  verification (the charter's deleted Phase-1 in miniature) and cannot express dom-path/count.
  It stays permissible only as a cheap smoke ("markup non-empty, app root present") in T004's
  first render boxes. Rejected: `browser.visit` with JS disabled — witness exposes no
  JS-disable option (PageHandle surface, T001 §1: networkConditions only).
- **No tree equality anywhere** — equality is expectation-outcome equality (Decision 5d),
  honoring behavioral-not-structural.

**Flagged gap (not rubber-stamped):** `demos/ui-kit/scenarios.ts` defines NO `expectations`
field at all (its local `Scenario` type is `initialProps/actions/expectedCallbacks` only —
verified this pass); only `demos/composition-kit/scenarios.ts` carries mount-phase dom-*
expectations (5 found). The charter's "the scenarios' existing initial-state expectations" is
currently only true for composition-kit. **Resolution:** T005 adds mount-phase dom-* initial-
state expectations to ui-kit scenarios using the existing vocabulary (additive data, no new
kinds); until then claim (a) would silently cover half the corpus. This is in T005's objective
and allowed_files, and T999 must check ui-kit is covered.

## Decision 4 — Witness pin: 0.7.0

**Locked: pin 0.7.0** (markless parity). Verified this pass against the registry:
- `npm view @async/witness` — versions 0.5.0–0.8.0, latest 0.8.0 (published 2026-07-03).
- The 0.7.0 and 0.8.0 registry READMEs are **byte-identical** (157 lines each, empty diff).
  0.8.0's changes are NOT determinable from the registry; no changelog is published. Adopting
  an unreviewable release over the version proven by markless's real SSR box would be vibes.
- Owner owns witness: if 0.7.0 lacks a needed assertion, that is product feedback (T004
  stop_if), not a reason to gamble on 0.8.0.

**Recorded re-evaluation triggers** (T001 §1, restated with the dep; record them in
`demos/ssr/package.json`-adjacent docs in T004):
1. A required assertion inexpressible in 0.7.0 (blocked-return, product feedback to owner).
2. Any release whose changelog (once obtainable, e.g. repo commits) touches receipt schema,
   preview/build pipeline, or multi-preview support — re-read before adopting.
3. Vite peer-range movement (currently ^8.0.0; frameless on 8.0.16 — satisfied, T001 §1).
4. Multi-preview-per-run support landing.
5. NEW: if T004's two-previews-one-run probe fails on 0.7.0, evaluate 0.8.0 (against repo
   sources, not the silent registry) BEFORE falling back to two-root topology.

## Decision 5 — Box inventory mapped to the four claims + calibration plan

All boxes `modes: ['build']`, tagged `['ssr']`; calibration boxes additionally `['calibration']`.
Per framework fw ∈ {react, solid}:

| Box | Claim | Mechanism |
|---|---|---|
| `ssr initial content — <fw>` | (a) correct pre-interactive content | build → `preview.request(route)` per scenario → parse5→SerializedNode → `evaluateExpectations` (mount, dom-* corpus) → all pass; results written as a machine-readable artifact + `receipt.note` |
| `clean activation — <fw>` | (b) clean activation | `preview.browser.visit(route)` → bounded `expect.page.*` confirms served content intact → `expect.page.outcome({consoleErrors: 0, failedRequests: 0})`. NO wait on any hydrate callback/event — settle is bounded-wait on observable DOM only (fitness check, Decision 7) |
| `post-activation scenarios — <fw>` | (c) scenarios pass | visit → scripted scenario actions via `page.click` (+ input actions as expressible) → `expect.page.text/exists/attribute` per post-action expectations → `outcome({consoleErrors: 0, failedRequests: 0})`; per-scenario results artifact |
| build parity (cheap, inside box a) | bonus | `expect.build.artifact/exists` for server+client bundles; `expect.build.forbids` scans dist for an authored-source-only marker — proving apps consume CLI-built emitted output, not authored `.tsrx` (goal.md misfire guard) |

**(d) cross-framework equality — mechanism:** both frameworks run the IDENTICAL expectation
corpus (same scenarios file is the single source). Boxes (a) and (c) emit normalized
per-scenario `ExpectationResult` artifacts; `scripts/e2e.mjs` cross-checks (i) corpus identity
(same expectation list evaluated on both sides — drift guard) and (ii) outcome equality (all
pass on both). Equality = same behavioral verdicts over the same expectations; markup is never
compared (behavioral-not-structural). Verdict folds into `frameless-receipts.json`.

**Calibration plan (boxes must be able to fail — proven per claim, per framework):**
Calibration boxes use `project.edit` (auto-restored, T001 §1) to break the app, then assert the
failure signal IS observed (box passes when breakage is detected → run stays green while
fallibility is receipted):
- **React, claim (b):** skew server markup vs client render (edit the prerender template or
  client entry props) → `hydrateRoot` mismatch → assert consoleMessages contain errors.
  This DOUBLE-DUTIES as the T001 Open-risk-6 verification: React 19's mismatch console shape
  is unverified; calibration must confirm mismatches land in `consoleMessages` as errors. If
  they do NOT (e.g. surface as warnings invisible to `consoleErrors`), the clean-activation
  box is untrustworthy → **stop_if, blocked-return**; do not ship a box that can't see the
  failure it exists to catch.
- **Solid, claim (b):** build with hydratable compile disabled (config overlay:
  `solid.generate:'ssr'` without `hydratable` / omit `generateHydrationScript`) → `hydrate()`
  failure signals in console. (vite-plugin-solid options verified, T001 §2.)
- **Claim (a), both:** edit prerendered output to violate one dom-text expectation → evaluator
  reports fail.
- **Claim (c), both:** break the client entry (or a handler) → scripted scenario assertion fails.
- **Claim (d):** covered by (a)/(c) calibrations — a one-sided break must flip the e2e
  equality verdict; e2e.mjs's aggregation is exercised in T005's verify against a calibration
  receipt at least once.

## Decision 6 — Receipts-schema bump

`RECEIPT_SCHEMA_VERSION` `frameless-receipts/1` → **`frameless-receipts/2`**
(`packages/analyzer/src/receipts.ts:9`), adding an `ssr` entry:

```
ssr: {
  witness: { version: "0.7.0", runId, receiptPath, receiptVersionMarker },  // marker READ from live receipt
  frameworks: {
    <fw>: {
      activation: "hydrate" | "resume",          // the discriminant; react/solid = "hydrate" today
      preActivation:  { expectations: n, failures: n },
      activationClean: boolean,                   // consoleErrors 0 + failedRequests 0 over the activation window
      postActivation: { expectations: n, failures: n },
      calibration: { claims: [...], proven: boolean }
    }
  },
  equality: { corpusIdentical: boolean, outcomesEqual: boolean }
}
```

**Explicitly rejected fields (hydration-only, per fitness check):** any `hydration:` object;
`hydrationMismatches` count (vacuous under resume — v2 performs no reconciliation walk, T001
§4.3); any `hydrateCompletedAt`/activation-timestamp field (no global activation moment under
resume, T001 §4.2). Mismatch-warning specifics are calibration EVIDENCE (receipt
notes/captures), never schema fields.

## Decision 7 — Resumability fitness check (mandatory; Qwik v2 facts from T001 §4 only)

| Contract piece | Hydrate meaning (React/Solid) | Resume meaning (Qwik v2) | Verdict |
|---|---|---|---|
| Claim (a) pre-interactive content | server HTML before `hydrateRoot`/`hydrate` | server HTML with `qwik/json` script, `q:container="paused"`, `q-e:*` attrs, before any interaction | **FITS** — fetch-string + dom-* evaluation is indifferent to `q:*` attrs; selectors target `data-*` |
| Claim (b) clean activation | zero console errors/mismatch warnings through hydrate settle | zero console errors at load (only qwikloader runs) and at each per-interaction wake | **FITS** with rule: window = load → first interaction → settle; assertion is `consoleErrors:0 / failedRequests:0`, never "hydrate was called". Future resume targets add `networkRequests()`-based no-eager-chunk assertion (primitive exists, T001 §1) without contract change — encodes the no-eager-visible-task rule (persistence-design-input GATE RULE; `q-e:qvisible` eager wake = failure, T001 §4.4) |
| Claim (c) post-activation scenarios | after hydrate settle, interact, assert | first interaction IS activation; assert after each action | **FITS** — contract split is FIRST-INTERACTION-based, not hydrate-barrier-based (T001 §4 assumption 5). Waiting-for-hydrate lives only inside React/Solid box bodies as implementation detail, never in claim wording, schema, or shared helpers |
| Claim (d) equality | expectation-outcome equality | identical — resumed DOM is server DOM, never rebuilt (T001 §4 assumption 6); outcome equality is markup-independent | **FITS** |
| `activation: hydrate\|resume` | `"hydrate"` | `"resume"` | **FITS** by construction |
| `activationClean: boolean` | clean hydrate | clean load + clean wakes | **FITS** — framework-neutral wording |
| `preActivation`/`postActivation` | pre/post hydrate | pre/post first interaction | **FITS** — named by interaction boundary |
| `hydrationMismatches` field | mismatch count | vacuous — no reconciliation walk exists (T001 §4.3) | **REJECTED** — not in schema |
| "hydration completed" event/wait | hydrate promise/callback | no such moment; wake is per-interaction and permanently partial (T001 §4.2) | **REJECTED** — boxes use bounded DOM waits only |
| "framework runtime loaded before scenarios" | expected | INVERTED — eager chunk execution pre-interaction is a FAILURE (T001 §4.4) | **REJECTED** as a contract assumption; never asserted |
| Full-tree client re-render wait | plausible | never happens (T001 §4.6) | **REJECTED** — no assertion may wait for DOM replacement |

**Fitness verdict: PASS** — every retained claim/field maps cleanly onto the Qwik v2 resume
model; every hydrate-assuming piece is rejected by name above. T901 stays gated; nothing here
authorizes Qwik work.

## Decision 8 — Worker packages

### T004 — SSR infrastructure (largest safe reversible slice)

**Objective:** Create the `demos/ssr/` witness root per this lock: per-framework SSR demo apps
(`react-app/`: renderToString prerender + hydrateRoot client entry on react-dom 19.2.3;
`solid-app/`: vite-plugin-solid lane with `ssr: true`, `solid.generate:'ssr'`, `hydratable`,
server-condition resolution, `hydrate` + `generateHydrationScript` on solid-js 1.8.22 — NEW
vite lane per T001 §2), both consuming CLI-built emitted output from `dist/` (extend the CLI
build step to target these apps; never import authored `.tsrx`). Build-time prerender via
local vite plugin (fallback: in-box prerender + `project.edit.create`, Decision 1). Pin
`@async/witness` 0.7.0 with the five re-evaluation triggers recorded. Boxes: (1) the
two-previews-one-run PROBE (Decision 2 — must run first), (2) first passing render box per
framework: build → `preview.request('/')` returns non-empty markup containing the app root
(bounded `expect.html.contains` smoke sanctioned here only). Wire `e2e:ssr` script stub
(full e2e integration is T005).

**allowed_files:**
- `demos/ssr/**`
- `package.json` (root scripts + witness dep only)
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `scripts/e2e.mjs` (only if the CLI-build step for ssr apps must hook in; no verdict logic)

**verify:**
- `pnpm check` && `pnpm lint` && `pnpm test` && `pnpm build`
- `pnpm --dir demos/ssr exec witness run` (or the `e2e:ssr` stub) — probe + both render boxes pass; receipts under `demos/ssr/.witness/receipts/`
- `git diff --stat -- poc/` → empty (F8 control untouched)

**stop_if:**
- Need files outside allowed_files.
- Witness 0.7.0 cannot express a required assertion — blocked-return with the exact gap
  (owner owns witness; product feedback, not a workaround site).
- Two-previews-one-run probe fails — blocked-return with the receipt (fallback topology is a
  PM/Judge decision, not Worker's).
- Neither prerender mechanism (plugin nor in-box) works — blocked-return with evidence.
- Verification fails twice.
- Anything requires touching `/Users/jacksm5pro/dev/open-source/markless` — hard stop.

### T005 — Box suite + calibration + equality + schema + docs (largest safe slice)

**Objective:** Complete the SSR proof per this lock: (1) pre-activation adapter — parse5 →
`SerializedNode` → `evaluateExpectations` reuse (Decision 3), dom-* only; (2) add mount-phase
dom-* initial-state expectations to `demos/ui-kit/scenarios.ts` (existing vocabulary; closes
the flagged corpus gap) and consume composition-kit's existing 5; (3) the full box inventory
of Decision 5 for both frameworks (claims a/b/c + build-parity checks); (4) calibration boxes
per Decision 5, including the React-19 mismatch-console-shape verification; (5) equality
aggregation + verdict folding in `scripts/e2e.mjs` (Decision 5d) — `pnpm e2e` remains THE
documented command, `pnpm e2e:ssr` = convenience; (6) receipts-schema bump to
`frameless-receipts/2` with the `ssr` entry EXACTLY as Decision 6 (activation discriminant; no
rejected fields) + analyzer receipt validation/tests updated; (7) README/docs honesty update —
only what is actually proven (React/Solid SSR behavioral proof; activation-model-neutral
contract; not Qwik, not publish); document browser provisioning (system Chromium or Playwright
cache, `WITNESS_BROWSER_PATH`) as a fresh-clone prerequisite for T999.

**allowed_files:**
- `demos/ssr/**`
- `demos/ui-kit/scenarios.ts`
- `demos/composition-kit/scenarios.ts`
- `packages/analyzer/src/**`, `packages/analyzer/test/**`
- `scripts/e2e.mjs`
- `package.json`, `pnpm-lock.yaml`
- `README.md`, `docs/README*` (docs honesty only)

**verify:**
- `pnpm check` && `pnpm lint` && `pnpm test` && `pnpm build`
- `pnpm e2e` — full lane green including SSR; `frameless-receipts.json` carries the `ssr` entry with `equality.outcomesEqual: true` and `calibration.proven: true` per framework
- Calibration evidence present in `demos/ssr/.witness/receipts/` (mismatch console captures)
- Grep guard: no `hydrationMismatch`/`hydration:` field in the schema or receipts (fitness check honored)
- `git diff --stat -- poc/` → empty

**stop_if:**
- Need files outside allowed_files.
- A cross-framework SSR divergence appears in a node-assertable path — blocked-return
  verbatim; product finding for PM adjudication (board T005 stop_if preserved).
- React 19 hydration mismatches do NOT surface in `consoleMessages` as errors — blocked-return
  with the calibration receipt (the clean-activation box would be blind; do not ship it).
- Witness 0.7.0 cannot express a required assertion — blocked-return (product feedback).
- A schema field cannot be expressed without a hydrate-only assumption — blocked-return citing
  Decision 7 (do not improvise around the fitness check).
- Verification fails twice.

## Flags (not rubber-stamped)

1. **ui-kit has no initial-state expectations** (verified this pass) — charter presumes they
   exist; only composition-kit carries them. Resolved via T005 objective item (2); T999 must
   verify ui-kit coverage landed.
2. **One-preview-per-run unverified for static preview** — T004 probe is mandatory with an
   explicit blocked-return path (T001 Open risk 2).
3. **React 19 mismatch console shape unverified** — promoted from T001 risk 6 to a T005
   stop_if; the clean-activation box is untrusted until calibration proves it can see failure.
4. **witness 0.8.0 changelog indeterminable** from the registry (READMEs byte-identical,
   verified this pass) — 0.7.0 pin stands; trigger 5 added.
5. **Wording drift:** state.yaml oracle/goal text still says "pre-hydration"/"hydrates";
   goal.md's later activation-neutrality directive is binding — shipped schema/boxes/docs use
   activation wording. PM should align the board oracle text when convenient (cosmetic).
6. **Path drift** (T001 risk 7): board cites `test/solid2-blocker.test.ts`; actual path is
   `packages/frameworks/solid/test/solid2-blocker.test.ts`. PM board hygiene, not blocking.
7. **Fresh-clone browser provisioning** (T001 risk 5): witness needs a Chromium-family browser;
   T005 documents the prerequisite; T999 must actually exercise it from the fresh clone.
