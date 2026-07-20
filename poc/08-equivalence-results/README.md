# Frameless C9 equivalence results

This package records the final, adjudicated C9 evidence for the three-scenario fixture family. The Chromium suite executes all five C9-provable pairs per scenario: emitted React against handwritten React, emitted Solid against handwritten Solid, each emitted target against the other handwritten framework, and emitted React against emitted Solid. It also rejects one calibrated mutant in every required observation channel. The Markless machinery remains in the package, but its native-composition leg is recorded—not omitted—as blocked by upstream Markless 0.1.1 findings.

The harness catches the reference implementation: the Markless failures are the strongest demonstration that equivalence receipts matter, and they form a concrete pre-launch roadmap rather than being normalized away.

## C9 claim

For this fixture family, Frameless-emitted React and Solid are behaviorally equivalent to each other and to handwritten React and Solid references under the calibrated oracle. The oracle observes mount, before and after each dispatch, after one microtask, and at bounded quiescence; it compares allowlist-normalized DOM, live properties, focus and selection, keyed node identity, and callback traces. Five mutant classes—wrong text, omitted callback, broken key identity, wrong cancellation, and duplicate handler—are rejected in their intended channels.

The Markless-native leg does not pass C9. Every Markless pair for every scenario is present in `results/verdict.json` with `blocked-by-upstream` and findings `#3,#5,#6,#7,#8`. S1’s full DOM-channel pass against both handwritten references is retained as `dom-only-partial`; its callback channel is blocked by #7. `test/verdict-artifact.node.test.ts` enforces this shape so a blocked party cannot become a silent skip.

## Findings #3–#8, verbatim from the adjudications

- **#3 — “root props”.** Evidence: `@markless/web` `packages/web/src/render.ts:71` calls `component.renderCsr()` with no props although `CsrRenderArtifact` advertises `renderCsr(props?: unknown)` at line 25. The zero-prop wrappers in `src/wrappers/` are the local composition repro surface.
- **#5 — “bare component at template root CSR-renders empty, silently”.** Evidence: Markless `packages/compiler/src/passes/public-render/template.ts:164-170`; the host-element workaround is visible at `src/wrappers/s1-visible.app.tsrx:5-12` and `src/adapters/markless.ts:18-21`.
- **#6 — “aliased prop destructuring — `{ label: displayLabel }` — arrives undefined in child-component composition; plain destructuring works, c6c”.** Evidence: Markless `packages/compiler/src/passes/public-render/shared.ts:218-232` collects the local name and lines 49-50 destructure that name from props. The compile-only minimal repro remains at `../05-enriched-ir/src/fixtures/alias-coverage.tsrx`.
- **#7 — “multi-parameter callback props: lazy-symbol codegen references unbound parameters — 'payload is not defined' in wrapper callback symbol”.** Evidence: callback wrappers are at `src/wrappers/s1-visible.app.tsrx:10`, `s1-hidden.app.tsrx:10`, `s2.app.tsrx:11`, and `s3.app.tsrx:8`.
- **#8 — “prop-derived state in child components never wires into the runtime graph: S2 child handlers crash on null graph reads while mount DOM renders”.** Evidence: prop-derived child state starts at `src/fixtures/s2-keyed-todo.tsrx:4`; the runtime repro actions are the S2 dispatch sequence in `test/equivalence.browser.test.ts`.

Finding #4 (object-literal callback payload production-symbol parsing) and the earlier S1 guard-element compiler/bundler inconsistency remain useful Markless findings, but adjudication 3 does not identify them as blockers for the final C9-native leg, so blocked pair records cite exactly #3/#5/#6/#7/#8.

## Verdict artifacts

`results/verdict.json` is the machine-readable scenario × pair table, mutant evidence, finding registry, and environment receipt. `results/RESULTS.md` is generated from it. There is no `pending` state. The checked-in emitted/reference results and mutant divergences come from the completed Chromium run; adjudication 3 changes the interpretation of the non-executable Markless leg to explicit blocked records and preserves the accepted S1 DOM-only partial observation.

## Fixture identity and retained Markless machinery

The `.tsrx` fixtures are local because the Markless Vite plugin transforms files only inside the package root. The listener-free identity suite compares them byte-for-byte to `../05-enriched-ir/src/fixtures/`. The Markless adapter, wrappers, trace bridge, bounded settlement, and bridge tests remain intact as upstream gaps are fixed; they are not invoked as passing C9 comparisons while those blockers exist.

## Verify

```sh
cd poc/08-equivalence-results
pnpm install --offline
pnpm test
```

`pnpm test:node` runs fixture identity, trace-bridge, and verdict/artifact assertions without opening a browser listener. `pnpm test` runs those checks first and then the complete Chromium matrix. If the worker sandbox denies the browser listener, run `pnpm test:node` there and have the PM run the full command above in a listener-capable environment.

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
| `markless-bundler-0.1.1.tgz` | `c8058867e5814bf4912033cdd7bdeab79f66e187319e923c78e54e19a8b25253` |
| `markless-compiler-0.1.1.tgz` | `bc0f573b765e2cd3c2e5d546314acd347938ddc99fc05c276f30bf4fe0c800ad` |
| `markless-core-0.1.1.tgz` | `9b7a627ec8367dc2f2591564ff441a66173dbc96cee1a2200616eaa8002bd3cc` |
| `markless-router-0.1.1.tgz` | `afc0369273952d6fe05c9d7c2fbdb0ff0a6bf4032fd87d1313369b656c8f61cd` |
| `markless-runtime-0.1.1.tgz` | `6a4644113cd6b8bbbfcb56a7d8e82bb687b2625c09d38fbc5744f79198ce076117` |
| `markless-serializer-0.1.1.tgz` | `0fd0cab793da0b520d49fc1b9e8f187c92fbb66f4b851e8fef143056374bb5db` |
| `markless-web-0.1.1.tgz` | `3b399e06577b184f08517c12594fd766fadca16a9664770a6e8efee67cfee37a` |

## What C9 does and does not claim

C9 claims fixture- and phase-scoped CSR equivalence for the 15 emitted/handwritten pairs above, under the calibrated observation contract, with the five representative mutants rejected. It does not claim native Markless equivalence: that leg is blocked by the enumerated 0.1.1 composition gaps. The S1 DOM-only observation is partial evidence, not a callback-channel pass and not a whole-pair pass.

C9 does not generalize beyond S1–S3 or prove async semantics, cleanup/attach behavior, slots/children/context composition, styling, accessibility, multi-module builds, performance/bundle size, HMR, framework-version ranges, SSR/hydration/resume, type-preserving emission, or generated-code debugging. Solid uses the disclosed 1.8.22 fallback runtime; no Solid 2 claim is made.
