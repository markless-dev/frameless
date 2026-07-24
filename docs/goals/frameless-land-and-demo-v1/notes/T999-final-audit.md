# T999 — Final audit (Judge)

Verdict: **complete**, `full_outcome_complete: true`.

The audit did not trust receipts. It cloned the pushed branch from GitHub and re-ran the oracle itself.

## Independently verified

**Land.** `git ls-remote origin` → `land/stack-and-three-way-demo` = `de342a8`, `main` = `895d187`
**untouched**. The 5 pre-existing commits carry unchanged hashes and are ancestors of HEAD.
`git diff origin/main...HEAD --diff-filter=D --stat` empty — zero deletions across all 18 commits.
Remote-tracking reflog shows four pushes, each a fast-forward. No force-push, no rewrite.

**Equality.** Confirmed in code that all eight former literals in `three-way-contract.ts` are now
interpolations of `measureText` / `measureAttribute` / `measureRowKeys`, each reading
`await page.content()` (lines 75–99, 212, 218, 240, 248, 255, 262, 276, 283).
`scripts/e2e.mjs:441-467` `JSON.stringify`-compares those arrays across frameworks and `process.exit(1)`s
on divergence. The diff T004 found tautological is now genuinely load-bearing.

**Resume.** Read from the witness receipt in the Judge's own clone:

```
s1 resume served=paused live=resumed qrlsServed=1 segsFetched=1
s2 resume served=paused live=resumed qrlsServed=5 segsFetched=3
s3 resume served=paused live=resumed qrlsServed=2 segsFetched=2
```

Real network fetches, e.g. `RenderOnce.jsx_RenderOnce_component_div_section_button_q_e_click_9Q3eIyNu4eE.js`.
`trackEvents('qsymbol')` is armed **before** the first click (contract line 203), so any symbol observed is
event-driven by construction. **S2's 5-served / 3-fetched asymmetry is the on-demand proof.** React and
Solid carry the matching negatives (`servedClickQrls=0`, no container, `forbidInServedPayload`).
This proves resume, not hydration.

**Demo.** Fresh GitHub clone → `pnpm install` exit 0 → `pnpm demo` printed exactly three URLs → 9/9 routes
200 with correct per-scenario markup → README step-2 curls reproduced verbatim (`q:container="paused"` on
:5175 only; `q-e:click` 0/0/1; `entry-client.jsx` 1/1/0) → `pnpm e2e` exit 0, 3×3 equal → SIGINT teardown
left zero listeners and zero orphans.

**Scope.** Deferred items genuinely deferred, none half-done. Only react/solid/qwik framework packages
exist; no Qwik `generated-persistence/`; Qwik `generated/` is S1/S2/S3 only; `packages/frameworks/qwik/package.json`
still carries the known dep-hygiene issue; `vite.config.ts`'s `pack` array still lacks `@frameless/qwik`.

## The recorded misfire did not occur

Completion rests on a reproducible demo, not on "commits exist" or "520 tests pass."

## The cold-machine risk, resolved

`playwright@1.58.2` ships `scripts: null`, so `pnpm install` never downloads Chromium; `@async/witness`
falls back to a system Chromium-family browser. A newcomer with neither fails at README line 82 while the
prerequisite sits at line 258.

**This does not block the oracle.** The oracle command is `pnpm demo`, which boots dev servers and needs
no browser binary — the newcomer uses their own. Follow-up, not a gate.

## What is NOT proven

- **No human or browser ever clicked against the `pnpm demo` server instances themselves.** Click behavior
  is proven on the shared render path (`createSsrHandler` for react/solid; the same vite + qwikRouter
  pipeline for qwik), and the `pnpm demo` instances are curl-proven to serve identical markup. The chain is
  strong, but a single end-to-end human observation does not exist. The README discloses this as
  "machine-checked, not eyeballed."
- Cold-machine `pnpm e2e` (no Playwright cache, no system Chromium).
- `handlerSegments` is *recorded*, not asserted, so S2's "add button's handler is never fetched" negative
  has no upper-bound assertion.
- The express dev wrapper for React/Solid is curl-verified only; the e2e lane mounts `createSsrHandler` on
  witness's own vite server.

## Overstatement audit

**The good news:** the phrase T004 flagged — "a real equality assertion, not three independent green
lanes" — appears **nowhere** in the README. The overstatement pattern did not survive into user-facing text.
"This is machine-checked, not eyeballed" (README:158) is honest; the claim matches what the code does.

**One genuine overstatement remains.** README:238:

> `| **Composition**: children, shared state, element access with cleanup | ✅ Shipped, verified from a fresh clone |`

No framework qualifier — while the saved-state row three lines below correctly says
"Proven (behavioral, **React/Solid**, via witness)", and the row below *that* announces Qwik shipped
"across three frameworks". Composition is React/Solid only; Qwik has no composition output. A newcomer
reads that row as three-framework.

**Minor:** T007's receipt phrase "Every `observed[]` entry is now measured" is marginally overstated —
contract line 369 still pushes the constant `'no console errors and no failed requests'`. It follows a real
`expect.page.outcome` assertion so it is not false, and it is not load-bearing.

**Cosmetic staleness:** README:60 "both outputs run in a real headless browser", the two-column output
table (lines 30–57), and the mermaid diagram (lines 65–76) all still show two frameworks. README:231
places `poc/` inside the `demos/` row, but the directory is top-level `poc/`.

## Follow-ups — none blocking, all need an owner ruling

1. **Highest value.** README "Try It" (line 82) runs `pnpm e2e` while the Chromium prerequisite is at line
   258. Move a one-line prerequisite next to "Try It", or lead with `pnpm demo`, which has no browser
   prerequisite.
2. Qualify README:238 Composition as React/Solid.
3. HMR websocket port 24678 collides between the two express demos (T005 observed it; its `stop_if`
   forbade the fix).
4. Add an upper-bound assertion on `handlerSegments` so S2's 5-served/3-fetched asymmetry is asserted,
   not just recorded.
5. Refresh README:60, the output table, and the mermaid diagram to three frameworks; fix the `poc/` placement.
6. Out of tranche as ruled: Qwik dep hygiene, `@frameless/qwik` in the `pack` array, Angular/Vue/Svelte
   breadth, persistence-on-Qwik, composition-on-Qwik, and **the merge decision — never granted**.
