# Frameless C9 equivalence results

This package records the final C9 evidence for the three-scenario fixture family. The Chromium suite executes all five emitted/handwritten pairs and all four Markless/counterpart pairs per scenario. It also rejects one calibrated mutant in every required observation channel.

The harness treats the reference implementation like every other party: live equality, attributed fallback, and divergence receipts are recorded rather than normalized away.

## C9 claim

For this fixture family, Frameless-emitted React and Solid are behaviorally equivalent to each other and to handwritten React and Solid references under the calibrated oracle. The oracle observes mount, before and after each dispatch, after one microtask, and at bounded quiescence; it compares allowlist-normalized DOM, live properties, focus and selection, keyed node identity, and callback traces. Five mutant classes—wrong text, omitted callback, broken key identity, wrong cancellation, and duplicate handler—are rejected in their intended channels.

## Findings status: direct-first live execution

Every Markless scenario now mounts the fixture component directly. `@markless/web` still owns `render()`, while the adapter invokes the fixture artifact's `renderCsr(props)` with the scenario props and passes callbacks as ordinary props. This path has no wrapper app, trace bridge, or `data-harness` observation indirection.

If direct execution produces a diagnostic signature belonging to #3, #5, #6, #7, or #8, the suite selects the narrowest preserved workaround rung: callback bridge only for #7, plain S1 prop destructuring for #6, or the zero-prop wrapper plus harness observation for #3/#5. Finding #8 has no behavior-preserving runtime fallback and remains explicitly blocked if diagnosed. A successful fallback comparison is `equal` with only the triggering IDs; an attributed execution failure is `blocked-by-upstream`; a completed unequal comparison is `divergent` with its full divergence dump. Divergences without a finding attribution are never normalized and fail the suite loudly. Thus the 12 Markless records in `results/verdict.json` are live observations, not constructed adjudication records.

`summary.marklessNativeLeg` is derived from those records: `pass` when direct execution passes without findings, `partial(#...)` when attributed fallbacks still produce equal traces, and `blocked` when any live Markless pair cannot complete equally. The checked-in `results/` remains the last executed receipt until a browser-capable run regenerates it.

## Findings #3–#8, verbatim from the adjudications

- **#3 — “root props”.** Evidence: `@markless/web` `packages/web/src/render.ts:71` calls `component.renderCsr()` with no props although `CsrRenderArtifact` advertises `renderCsr(props?: unknown)` at line 25. The zero-prop wrappers in `src/wrappers/` are the local composition repro surface.
- **#5 — “bare component at template root CSR-renders empty, silently”.** Evidence: Markless `packages/compiler/src/passes/public-render/template.ts:164-170`; the host-element workaround is visible at `src/wrappers/s1-visible.app.tsrx:5-12` and `src/adapters/markless.ts:18-21`.
- **#6 — “aliased prop destructuring — `{ label: displayLabel }` — arrives undefined in child-component composition; plain destructuring works, c6c”.** Evidence: Markless `packages/compiler/src/passes/public-render/shared.ts:218-232` collects the local name and lines 49-50 destructure that name from props. The direct runtime probe is `src/fixtures/s1-render-once.tsrx`, its plain fallback is `s1-render-once-plain.tsrx`, and the compile-only minimal repro remains at `../05-enriched-ir/src/fixtures/alias-coverage.tsrx`.
- **#7 — “multi-parameter callback props: lazy-symbol codegen references unbound parameters — 'payload is not defined' in wrapper callback symbol”.** Evidence: callback wrappers are at `src/wrappers/s1-visible.app.tsrx:10`, `s1-hidden.app.tsrx:10`, `s2.app.tsrx:11`, and `s3.app.tsrx:8`.
- **#8 — “prop-derived state in child components never wires into the runtime graph: S2 child handlers crash on null graph reads while mount DOM renders”.** Evidence: prop-derived child state starts at `src/fixtures/s2-keyed-todo.tsrx:4`; the runtime repro actions are the S2 dispatch sequence in `test/equivalence.browser.test.ts`.

Finding #4 (object-literal callback payload production-symbol parsing) and the earlier S1 guard-element compiler/bundler inconsistency remain useful Markless findings, but adjudication 3 does not identify them as blockers for the final C9-native leg, so blocked pair records cite exactly #3/#5/#6/#7/#8.

## Verdict artifacts

`results/verdict.json` is the machine-readable scenario × pair table, mutant evidence, finding registry, and environment receipt. `results/RESULTS.md` is generated from it. There is no `pending` state. The checked-in emitted/reference results and mutant divergences come from the completed Chromium run; adjudication 3 changes the interpretation of the non-executable Markless leg to explicit blocked records and preserves the accepted S1 DOM-only partial observation.

## Fixture identity and retained Markless machinery

The `.tsrx` fixtures are local because the Markless Vite plugin transforms files only inside the package root. The listener-free identity suite compares S2/S3 byte-for-byte to `../05-enriched-ir/src/fixtures/`; S1 is proven to differ only by the #6 alias probe, with a byte-identical plain fallback retained separately. The wrappers, trace bridge, and harness observation remain only as finding-attributed fallback machinery. The direct adapter preserves the same runtime graph flush and bounded-quiescence settlement used by the fallback.

## Verify

```sh
cd poc/08-equivalence-results
pnpm install --ignore-workspace
pnpm test
```

`--ignore-workspace` is required because the product workspace at the repository root otherwise captures this POC install. `pnpm test:node` runs fixture identity, trace-bridge, and verdict/artifact assertions without opening a browser listener. `pnpm test` runs those checks first and then the complete Chromium matrix. If the worker sandbox denies the browser listener, leave `results/` untouched and have the PM run the full command above in a listener-capable environment.

## Environment and versions

| Item | Pinned version / mode |
| --- | --- |
| Vitest | 4.1.5 |
| Browser provider | `@vitest/browser-playwright` 4.1.5 |
| Playwright | 1.58.2, locally cached Chromium |
| Vite | 8.0.16 |
| Markless | 0.1.1 vendored tarballs |
| React / React DOM | 18.3.1 |
| Solid runtime | 1.8.22 fallback |
| Solid JSX transform | `babel-preset-solid` 1.9.12 |
| Oracle contract | `frameless-equivalence-oracle/1` |
| pnpm | 10.33.2 |

Vendored tarball SHA-256 receipts:

| Tarball | SHA-256 |
| --- | --- |
| `markless-bundler-0.1.1.tgz` | `301b5d6bcf2bd30b527b3836c0a6949681c7a60ccb83be5abb75569548a3e93d` |
| `markless-compiler-0.1.1.tgz` | `59e4fb0bf6b7f4edd9312f0355535e22b1b1ceeb071da9617628d55df6dc5848` |
| `markless-core-0.1.1.tgz` | `2e957f84d54d8bb2383455be7250ea71b6d9436ff455a657a2376cf9ccf99c97` |
| `markless-router-0.1.1.tgz` | `841739095013d31da3ec4adfeb3a84e9876b35116e6c05ff8c784985fc7ae573` |
| `markless-runtime-0.1.1.tgz` | `3c1c5ba9e1e024391539ca9d9325ad631882a9d2817f09f77019e268fe9e4ed8` |
| `markless-serializer-0.1.1.tgz` | `274d12df07964fc6821b71694ace652dee157d15fae4ff573e0cb78762a9a893` |
| `markless-web-0.1.1.tgz` | `5fdb1817dffcabad3690102b6d202e696c307060d9cd17f4ac6d134194258c8c` |

These tarballs were built from the local `markless-frameless-fixes` worktree at `5e5a100`.

## What C9 does and does not claim

C9 claims fixture- and phase-scoped CSR equivalence for the 15 emitted/handwritten pairs above, under the calibrated observation contract, with the five representative mutants rejected. Native Markless equivalence is claimed only when the live 12-pair leg reports `pass`; `partial(#...)`, `blocked`, and genuine divergence receipts retain their narrower meanings without normalization.

C9 does not generalize beyond S1–S3 or prove async semantics, cleanup/attach behavior, slots/children/context composition, styling, accessibility, multi-module builds, performance/bundle size, HMR, framework-version ranges, SSR/hydration/resume, type-preserving emission, or generated-code debugging. Solid uses the disclosed 1.8.22 fallback runtime; no Solid 2 claim is made.
