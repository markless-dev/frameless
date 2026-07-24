# T004 — Phase gate: is the matrix equal, and what is T005? (Judge)

Read-only. `pnpm e2e` re-run independently: exit 0, 3×3 matrix printed, all nine observation strings
identical, react 24 / solid 24 / qwik 27 assertions.

## Verdict: the nine cells are genuinely equal — but the resume evidence is weaker than claimed

**T003 is approved.** The Worker disclosed rather than papered over. The gap below is a new task, not a rework.

### The equality diff is tautological, but the real gate is elsewhere

`scripts/e2e.mjs:438-467` does compare `JSON.stringify(observed)` per scenario across the three lanes.
But those `observed[]` arrays are **hardcoded literals** pushed inside `three-way-contract.ts`
(lines 52, 55, 73, 77, 82, 92, 96, 121). They are the same constants by construction, so the diff can
only ever catch *structural* divergence — a lane skipping a scenario. The T003 note's claim that this is
"a real equality assertion, not three independent green lanes" is **overstated and must not be repeated
in the README.**

Would React producing `kit:3` while Qwik produces `kit:4` be caught? **Yes — by a different mechanism.**
`expect.page.text` waits until the trimmed text *equals* the expected string, and that expected value is
the shared literal `'kit:4'`. React would time out, the box would fail, witness would exit non-zero, and
`e2e.mjs:60-65` would `process.exit` before the diff ever ran. `readThreeWayResults` (`e2e.mjs:82-108`)
independently rejects a non-passed box, a missing note, a wrong activation, or a missing scenario.

So the guarantee is **one shared oracle with exact expected values, run three times** — legitimate and
strong, just not "we compared measurements." The consequence worth fixing: the receipt records
constants, not measured values, which is thin against the oracle's `final_proof`, which asks for
per-framework per-scenario observed behavior to be *recorded*.

### The contract is genuinely shared

All three boxes import the same module and call `runScenario` with the same `scenarioIds`. Exactly two
per-framework differences exist and both are declared, not hidden: `waitForInteractive` branches on
activation (`three-way-contract.ts:36-45`), and the Qwik path table uses trailing slashes because its
router 301s. **No conditionals weaken any individual cell.**

### The `q:container` problem — the one that matters

The Qwik pause assertion is now `expect.response.matches(served, { contains: 'q:container="paused"' })`
on the served payload, and the live check degraded to `exists('[q\\:container]')` — which is satisfied by
the SSR payload before any JS runs.

**The entire published claim "Qwik resumes rather than hydrates" rests on one substring that every Qwik
SSR page emits regardless.** Nothing asserts that no hydration pass ran. Nothing asserts handlers are
pulled on demand. Meanwhile React and Solid carry an *affirmative* activation marker
(`data-frameless-activated`, set by `hydrateRoot` / `onMount`).

The asymmetry is backwards: the framework making the *unusual* claim carries the *weaker* evidence.

**The stronger evidence already exists and is simply unasserted.** In
`demos/qwik/.witness/receipts/.../receipt.json` the page network log contains per-handler QRL segments —
e.g. `/src/emitted/RenderOnce.jsx_RenderOnce_component_div_section_button_q_e_click_9Q3eIyNu4eE.js`.
`@async/witness` can assert exactly this: `PageHandle.trackEvents(...)` plus
`PageOutcomeExpectation.events` with `detailIncludes`, whose own doc comment names Qwik's `qsymbol`
"for a clicked handler's QRL", plus `page.networkRequests()`.

Also: T003 read its own finding #1 backwards. Served `paused` + live `resumed` is not noise — **it is the
resume transition, observed.** Asserting both is strictly stronger than asserting either.

### T003 finding #2 resolved

Qwik records 1 main-frame navigation per page, React/Solid 0, and `expect.page.outcome` omits
`navigations`, leaving an unexplained cross-framework difference outside the contract. Checked: each Qwik
page issues exactly **one** `resourceType: 'Document'` request, so it is a same-URL history entry from the
Qwik router, **not a reload**. Benign — but it should be asserted per framework rather than left silent.

### Coverage honesty: adequate

The lanes drive dev mode, and the newcomer command will be dev mode. The react/solid boxes share
`createSsrHandler` with `server.js`, so no second harness can drift. The remaining gap is the express
production path (curl only) — acceptable **if the README says so**, which T005 must enforce.

### Board hygiene defect found

`state.yaml` is modified and `notes/T003-equality-matrix.md` is **untracked** — the pushed branch at
`8646c7a` does not contain T003's receipt or note. T003's "git status empty after commit" verify line is
stale. T005 must commit both.

## Ruling: `three-way-contract.ts` stays where it is

Not moved in T005, not in T007. Moving it is pure churn against the only equality machinery the goal
has, there is precedent (`demos/ssr` imports `demos/ui-kit/scenarios.ts`), and the README will cite its
path.

## The vite 7.3.1 rationale — honesty guard

The **only** record is `docs/goals/frameless-qwik-v1/state.yaml:421`: "vite 7.3.1 *per the
pnpm-create-qwik scaffold*." There is **no** recorded proof that vite 8 breaks Qwik.

T005 must not invent an incompatibility. It records the observed fact, cites that receipt, and states
that a bump to `catalog:` is unverified and must be re-proven with a green `pnpm e2e` first.

## T005 runner design (binding)

- New `scripts/demo.mjs`; root script `"demo": "node scripts/demo.mjs"`.
- One port table lives in the runner: **react 5173, solid 5174, qwik 5175.**
  `demos/{react,solid}-official/server.js:6` already honours `process.env.PORT`, so **neither needs
  editing**. Qwik needs a new `dev` script because vite ignores `PORT`.
- Spawn each demo's **own official `dev` script** via `pnpm --dir demos/<name> dev`. Never re-implement a
  demo's dev command — that is the hand-rolled-harness trap.
- Clean shutdown requires `detached: true` per child and `process.kill(-child.pid, 'SIGINT')` on the
  parent's SIGINT, so the whole `pnpm → node → vite` group dies. Plain `child.kill()` orphans vite.
- Poll all three URLs until HTTP 200 (bounded, ≤60s) and print the URLs **only then**, so a drifted port
  fails loudly instead of silently. If a child exits early or a poll times out, kill the survivors and
  exit non-zero.
- **No new dependency** — no `concurrently`, no `npm-run-all`, no `wait-on`.

## T005 README walkthrough (binding contents)

1. **Run block** — `pnpm install; pnpm demo`, listing React :5173, Solid :5174, Qwik :5175, and noting
   Qwik's routes are `/s2/` and `/s3/` (trailing slash) because its router normalises them.
2. **The one shared source chain, by path**, every one of which must exist:
   `packages/compiler/test/fixtures/s1-render-once.tsrx` → `packages/compiler/test/goldens/s1-render-once.json`
   (the IR) → `packages/frameworks/{react,solid,qwik}/generated/S1.jsx` →
   `demos/{react-official,solid-official,qwik}/src/emitted/RenderOnce.jsx`, plus the S2/S3 rows.
3. **How a newcomer sees hydrate-vs-resume themselves**, three concrete steps: view-source at :5173/:5174
   shows markup plus a client entry module that must run before the page reacts, while :5175 shows
   `q:container="paused"` and `on:click` QRL attributes; `curl -s localhost:5175/ | grep -o 'q:container="[^"]*"'`
   prints `paused` while the same curl on 5173/5174 prints nothing; DevTools Network with a JS filter —
   click increment and watch Qwik fetch a handler segment whose URL contains
   `_component_div_section_button_q_e_click_`, while React/Solid fetch nothing because their component JS
   was already downloaded.
4. A line stating the identical S1/S2/S3 behavior is machine-checked by `pnpm e2e`'s three-way witness lanes.
5. **Honesty scope** in "What It Does Not Do": the lanes and `pnpm demo` exercise the dev-mode SSR path;
   the express production path is curl-verified only.

## T005 deferred-item closeout (all binding)

- `README.md:154` "More frameworks | Planned" — stale now that Qwik shipped.
- `README.md:115` "SSR behavior is proven for CLI-emitted React and Solid output" — must include Qwik.
- Add a `packages/frameworks/qwik` row to the Packages table.
- `README.md:143` "demos/ | The two demo libraries" — stale; there are seven demos.
- Record **why** `demos/qwik` pins vite 7.3.1 in both `demos/qwik/README.md` and a top-level `"//vite"`
  key in `demos/qwik/package.json`, under the honesty guard above.
