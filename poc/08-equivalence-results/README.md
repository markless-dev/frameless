# Arcade C9 equivalence results

This package is the C9 evidence package. It runs the calibrated Arcade equivalence oracle against the three-scenario fixture family and compares markless CSR, Arcade-emitted React, Arcade-emitted Solid, and the handwritten React/Solid calibration references. A passing machine verdict demonstrates fixture- and phase-scoped CSR behavioral equivalence; it is not merely a framework smoke test.

## Claim map

**C9 — behavioral equivalence is machine-checkable.** The browser suite compiles the exact `poc/05-enriched-ir/src/fixtures/s1-render-once.tsrx`, `s2-keyed-todo.tsrx`, and `s3-event-form.tsrx` sources through the markless Vite plugin and mounts them with `@markless/web` `render`. For every scenario it records all eight required pairs: emitted React against handwritten React and Solid; emitted Solid against handwritten Solid and React; the two emitted targets against each other; and markless against handwritten React and both emitted targets. The copied browser oracle observes mount, before and after dispatch, after one microtask, and after bounded quiescence. It compares allowlist-normalized semantic DOM, live form state, focus/selection, keyed row identity, callback order/payload/phase/default prevention/multiplicity. Markless settlement awaits its graph flush and then polls observable browser DOM/live state through bounded animation-frame quiescence because graph flush alone is not a DOM commit barrier.

**Oracle integrity.** The same integrated Chromium suite reruns one representative mutant for every required channel: wrong DOM text, omitted callback, broken keyed identity/focus, wrong cancellation, and duplicate handler. C9 passes only when all 24 required pair verdicts are equal and all five mutants are rejected in their intended channels.

The suite machine-writes `results/verdict.json` (scenario × pair verdicts and mutant rejections) and generates `results/RESULTS.md` from that artifact before making its assertions. This intentionally preserves precise divergence evidence when a legitimate contract mismatch occurs.

## Verify

```sh
cd poc/08-equivalence-results
pnpm install --offline
pnpm test
```

If the isolated repository store lacks packages but the user-level pnpm store is populated, use the PM environment (which can register the project in that store):

```sh
cd poc/08-equivalence-results
pnpm install --offline --store-dir "$(cd /private/tmp && pnpm store path)"
pnpm test
```

No Playwright browser download is needed or permitted; the test uses the locally cached Chromium installation.

## Environment and versions

| Item | Pinned version / mode |
| --- | --- |
| Execution | one environment: Vitest browser mode, headless Chromium |
| Vitest | 4.1.5 |
| Browser provider | `@vitest/browser-playwright` 4.1.5 |
| Playwright | 1.58.2, locally cached Chromium |
| Vite | 8.0.16 |
| Markless | 0.1.1 vendored tarballs |
| React / React DOM | 18.3.1 |
| Solid runtime | 1.8.22 fallback |
| Solid JSX transform | `babel-preset-solid` 1.9.12, isolated include filter |
| Oracle contract | `arcade-equivalence-oracle/1` |
| pnpm | 10.33.2 |

Vendored tarball SHA-256 receipts:

| Tarball | SHA-256 |
| --- | --- |
| `markless-bundler-0.1.1.tgz` | `c8058867e5814bf4912033cdd7bdeab79f66e187319e923c78e54e19a8b25253` |
| `markless-compiler-0.1.1.tgz` | `bc0f573b765e2cd3c2e5d546314acd347938ddc99fc05c276f30bf4fe0c800ad` |
| `markless-core-0.1.1.tgz` | `9b7a627ec8367dc2f2591564ff441a66173dbc96cee1a2200616eaa8002bd3cc` |
| `markless-router-0.1.1.tgz` | `afc0369273952d6fe05c9d7c2fbdb0ff0a6bf4032fd87d1313369b656c8f61cd` |
| `markless-runtime-0.1.1.tgz` | `6a4644113cd8bbbfcb56a7d8e82bb687b2625c09d38fbc5744f79198ce076117` |
| `markless-serializer-0.1.1.tgz` | `0fd0cab793da0b520d49fc1b9e8f187c92fbb66f4b851e8fef143056374bb5db` |
| `markless-web-0.1.1.tgz` | `3b399e06577b184f08517c12594fd766fadca16a9664770a6e8efee67cfee37a` |

## Findings

- `vite-plugin-solid@2.11.0` is incompatible with Vite 8 because it consumes a removed Vite server-conditions export. This package therefore uses the same include-filter boundary as `poc/07`, implemented directly with pinned `@babel/core` + `babel-preset-solid`; only Solid generated/reference `.jsx` is transformed as Solid, React JSX remains on Vite's React path, and `.tsrx` remains exclusively owned by `markless()`.
- In the restricted worker sandbox, Chromium verification could not start because Vitest's local browser server was denied `listen(::1)` with `EPERM`. The registry was also unavailable and the isolated store lacked several tarballs. Consequently the checked-in verdict remains explicitly pending/failing until the PM-side command above machine-generates it; no behavioral divergence was observed or normalized away because no browser test executed.

## What this does not prove

This is CSR-only and scoped to S1–S3 and the oracle's declared phases. It does not prove async semantics, cleanup or attach behavior, slots/children/context composition, styling, accessibility, multi-module builds, performance or bundle size, HMR, framework-version ranges, SSR, hydration, resume, type-preserving emission, generated-code debugging, or behavior outside this fixture family. Solid is specifically the disclosed 1.8.22 fallback runtime; this package makes no Solid 2 claim.
