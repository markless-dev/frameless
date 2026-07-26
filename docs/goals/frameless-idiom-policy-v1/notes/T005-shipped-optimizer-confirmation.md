# T005 — shipped-optimizer confirmation

Resolves the PROVISIONAL caveat T002 raised and T004 sharpened: T002's A/B was driven against
`@qwik.dev/optimizer@2.1.0-beta.5`, which is not resolvable from `demos/qwik`. The demo builds
with the optimizer bundled inside `@qwik.dev/core@2.0.0-beta.38`
(`demos/qwik/node_modules/@qwik.dev/core/dist/optimizer.mjs`). Everything below was measured on a
real `pnpm --dir demos/qwik build`, reading `demos/qwik/dist/q-manifest.json`.

## The measurement

Verify step 9, exactly as specified in `notes/T004-policy-decision.md` Part C.5:

```
node -e "const m=require('./demos/qwik/dist/q-manifest.json');const s=Object.values(m.symbols).filter(v=>String(v.origin).includes('emitted'));const eh=s.filter(v=>v.ctxKind==='eventHandler');const out={emittedSymbols:s.length,eventHandler:eh.length,eventNames:[...new Set(eh.map(v=>v.ctxName))].sort(),dollarNamed:s.filter(v=>v.ctxName==='\$').length,capturing:s.filter(v=>v.captures).length};console.log(JSON.stringify(out,null,1));if(eh.length===0)throw new Error('no eventHandler symbols from emitted/: the raw form did not take effect on the shipped optimizer');if(out.dollarNamed!==0)throw new Error('symbols still named \$: some handler is still wrapped');"
```

## Before — baseline form, `onClick$={$(async () => …)}`

Read from the `demos/qwik/dist/q-manifest.json` that was on disk when T005 began (written
2026-07-26 13:25 by T004's build of the pre-change emitter). It reproduces T004's recorded
figures exactly.

```json
{
 "emittedSymbols": 18,
 "eventHandler": 0,
 "eventNames": [],
 "dollarNamed": 12,
 "capturing": 15
}
```

## After — candidate form, `onClick$={async () => …}`

Read from a fresh `pnpm --dir demos/qwik build` (client + preview SSR, both green, 333 ms /
332 ms) after the `emitEvent` change, `pnpm --dir packages/frameworks/qwik regenerate` and
`pnpm --dir demos/qwik copy-emitted`.

```json
{
 "emittedSymbols": 18,
 "eventHandler": 12,
 "eventNames": [
  "onChange$",
  "onClick$",
  "onInput$"
 ],
 "dollarNamed": 0,
 "capturing": 6
}
```

Command exit code 0; neither guard threw.

## Reading

| | before | after |
|---|---|---|
| symbols from `emitted/` | 18 | 18 |
| `ctxKind: 'eventHandler'` | 0 | 12 |
| distinct `ctxName` on those | — | `onChange$`, `onClick$`, `onInput$` |
| `ctxName === '$'` | 12 | 0 |
| `captures: true` | 15 | 6 |

All 12 frameless handlers moved from `ctxKind: 'function'` / `ctxName: '$'` into
`ctxKind: 'eventHandler'` named by their own event prop, and 9 of the 15 capturing symbols
stopped capturing. The symbol count from `emitted/` is unchanged at 18, so nothing was dropped or
duplicated — the same handlers were reclassified.

This is the classification-correctness and capture-elimination result T004 predicted from a
scratch single-component build, now confirmed on the full `demos/qwik` router build with the
shipped optimizer. **No latency benefit was measured, and none is claimed.**

## Conditional edit to `demos/react-official/three-way-contract.ts`: not made

Part C.4 permitted a narrow update to `resumeSymbols[*].includes` if removing the `$()` wrapper
changed the structural segment prefix. It did not. `pnpm e2e` passed unchanged, so the file was
left untouched.

Values, identical before and after:

| scenario | `includes` | `atLeast` |
|---|---|---|
| s1 | `_component_div_section_button_q_e_click_` | 1 |
| s2 | `_button_q_e_click_` | 3 |
| s3 | `_component_form_button_q_e_click_` | 1 |

Corroborated against the `qsymbol` handler segments recorded in the run's own witness receipt
(`demos/qwik/.witness/receipts/2026-07-26T19-06-27.044Z/receipt.json`), which still contain
`RenderOnce_component_div_section_button_q_e_click_…`,
`KeyedTodo_component_section_button_q_e_click_…` and
`EventForm_component_form_button_q_e_click_…`. The optimizer changed how these symbols are
*classified*, not how their structural segment is *named*.

## Verification run

| # | command | result |
|---|---|---|
| 1 | `pnpm --dir packages/frameworks/qwik regenerate` | pass |
| 2 | `git diff --stat packages/frameworks/qwik/generated/` | pass — exactly S1.jsx, S2.jsx, S3.jsx |
| 3 | `pnpm --dir packages/frameworks/qwik test` | pass — 2 files, 11 tests |
| 4 | `pnpm test` | pass — 35 files, 520 tests |
| 5 | `pnpm check` | pass — `tsc --noEmit`, clean |
| 6 | `pnpm test:browser` | **did not run to completion — see below** |
| 7 | `pnpm --dir demos/qwik copy-emitted` | pass |
| 8 | `pnpm --dir demos/qwik build` | pass — client 333 ms, preview 332 ms |
| 9 | shipped-optimizer confirmation | pass — figures above |
| 10 | `pnpm e2e` | pass — `[e2e] PASS`, 3 demos x 3 scenarios, all observations equal |
| 11 | `git status --short` | pass — no file changed outside `allowed_files` |

### Step 6 deviation, recorded honestly

`pnpm test:browser` (`vp test --project react-browser --project solid-browser`) hangs
indefinitely on this machine. It prints the vitest/browser mixed-version warning, launches
`chrome-headless-shell`, and then sits at 0% CPU with the main thread parked in `uv__io_poll` and
no vitest API server listening. Observed for >11 min, and again after clearing
`node_modules/.vite`.

It is **not caused by this change**:

- The hang reproduces identically with this task's five tracked edits stashed
  (`git stash push` → `pnpm test:browser` → same hang → `git stash pop`). It is pre-existing.
- The two browser projects live in `packages/frameworks/react` and `packages/frameworks/solid`
  and cannot reach the Qwik emitter this task edited.
- Playwright itself is healthy here: a scripted `chromium.launch()` → `page.goto` against a local
  `http://127.0.0.1` server succeeds, and `pnpm e2e` (step 10), which drives all three demos
  through Playwright, passes.

The same suites were therefore run directly through their own package scripts, which is the same
vitest config, the same files and the same browser:

- `pnpm --dir packages/frameworks/react test:browser` — **5 files, 45 tests, all passed**
- `pnpm --dir packages/frameworks/solid test:browser` — **4 files, 44 tests, all passed**
  (process exit 1 comes from an unrelated pre-existing `MISSING DEPENDENCY Cannot find dependency
  'jsdom'` notice printed before the run; every test in the browser project passed)

No check was weakened, lowered or skipped to reach a green result. The root-level
`vp test` browser orchestration is a standing tooling defect on this machine and is left for the
PM to route.
