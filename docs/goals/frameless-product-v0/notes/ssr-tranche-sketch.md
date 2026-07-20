# SSR equivalence testing — next-tranche sketch (2026-07-20, user-requested)

User direction: "We'll also need some way to figure out SSR tests." Out of v0 scope
(charter misfire guard: no scope expansion; boundary docs currently disclaim
SSR/hydration). Recorded here so the next tranche cuts from evidence.

## Two-phase approach

Phase 1 — node-side SSR string equivalence (no browser, cheap to add):
- React: `renderToString` from react-dom/server on the emitted component.
- Solid: `renderToString` from solid-js/web (server entry, 1.8.22 fallback pin);
  requires the emitted JSX compiled with `generate: 'ssr'` (babel-preset-solid
  option) — the emitted .jsx source is unchanged; only the compile mode differs.
- Cross-target comparison needs NORMALIZATION, not raw string equality: Solid
  injects hydration keys (`data-hk`), React historically injects comment markers
  (React 19 behavior must be validated, not assumed — same rule as the act
  decision in T002). Parse both HTML strings into a normalized structural form and
  compare — candidate: extend @frameless/analyzer with an HTML-trace serializer so
  the SSR verdict reuses the existing divergence vocabulary. Keep the analyzer
  framework-free; parsing can use a neutral DOM parser in the node lane.

Phase 2 — hydration/browser phase (real new infrastructure):
- vitest browser mode CAN carry this: pre-render HTML node-side, inject as the
  mount host's initial innerHTML, then `hydrateRoot` (React 19) / `hydrate`
  (solid-js/web) and re-run the scripted scenarios; oracle compares post-hydration
  traces cross-target AND asserts no hydration mismatch warnings (both frameworks
  report mismatches — capture consoles as a trace channel).
- Markless constraint (playbook): markless itself resumes, it does not hydrate by
  rerender — SSR equivalence here concerns the TARGET frameworks' own SSR, and
  must not be conflated with markless resume semantics. Any mount-scoped/resume
  interaction is a markless-language question queued behind the fixing board.

## Preconditions discovered this goal
- Solid SSR compile mode needs a vite/babel lane addition (browser projects
  currently compile generate:'dom' only).
- The frameless-build-receipts/1 delegation record should grow an SSR authority
  entry when the lanes exist (schema is versioned; bump deliberately).
- Beta.9 blocker applies to SSR too: solid-js 2 beta drops ./web — the SSR lane
  stays on the 1.8.22 fallback until the v2 toolchain exists (same overturn
  trigger, test/solid2-blocker.test.ts).
