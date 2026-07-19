# Arcade C9 equivalence results

This package is the C9 evidence package. It runs the calibrated Arcade equivalence oracle against the three-scenario fixture family and compares markless CSR, Arcade-emitted React, Arcade-emitted Solid, and the handwritten React/Solid calibration references. A passing machine verdict demonstrates fixture- and phase-scoped CSR behavioral equivalence; it is not merely a framework smoke test.

## Claim map

**C9 — behavioral equivalence is machine-checkable.** The browser suite compiles the exact `poc/05-enriched-ir/src/fixtures/s1-render-once.tsrx`, `s2-keyed-todo.tsrx`, and `s3-event-form.tsrx` sources through the markless Vite plugin and mounts them with `@markless/web` `render`. For every scenario it records all eight required pairs: emitted React against handwritten React and Solid; emitted Solid against handwritten Solid and React; the two emitted targets against each other; and markless against handwritten React and both emitted targets. The copied browser oracle observes mount, before and after dispatch, after one microtask, and after bounded quiescence. It compares allowlist-normalized semantic DOM, live form state, focus/selection, keyed row identity, callback order/payload/phase/default prevention/multiplicity. Markless settlement awaits its graph flush and then polls observable browser DOM/live state through bounded animation-frame quiescence because graph flush alone is not a DOM commit barrier.

**Oracle integrity.** The same integrated Chromium suite reruns one representative mutant for every required channel: wrong DOM text, omitted callback, broken keyed identity/focus, wrong cancellation, and duplicate handler. C9 passes only when all 24 required pair verdicts are equal and all five mutants are rejected in their intended channels.

The suite machine-writes `results/verdict.json` (scenario × pair verdicts and mutant rejections) and generates `results/RESULTS.md` from that artifact before making its assertions. This intentionally preserves precise divergence evidence when a legitimate contract mismatch occurs.

## Fixture vendoring identity

The Markless Vite plugin transforms `.tsrx` only inside this package root, so the
three poc/05 authoring fixtures are vendored under `src/fixtures/`. `pnpm test` first
runs `test/fixture-identity.test.ts` in a listener-free Node Vitest config and compares
all three copies byte-for-byte with `../05-enriched-ir/src/fixtures/`. Only after those
three identity checks pass does it start the Chromium matrix. This ties native
Markless execution to the exact sources that produced the enriched-IR goldens and
both generated targets.

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

- Markless 0.1.1 accepts `if (!visible) return <p
  data-branch="hidden">hidden</p>` in the semantic compiler, but the bundler client
  transform leaves that JSX raw. Vite then fails with the exact error: `Failed to
  parse source for import analysis because the content contains invalid JS syntax.
  You may need to install appropriate plugins to handle the .tsrx file format, or if
  it's an asset, add "**/*.tsrx" to assetsInclude in your configuration.` S1 now uses
  root-level `@if`/`@else` with the identical hidden/visible DOM contract. A direct
  Markless client-transform check confirms the replacement contains no raw JSX and
  parses as JavaScript. Guard-return-null remains proven by poc/03 fixture c6e; this
  finding is specifically guard-returning-an-element.
- `vite-plugin-solid@2.11.0` is incompatible with Vite 8 because it consumes a removed Vite server-conditions export. This package therefore uses the same include-filter boundary as `poc/07`, implemented directly with pinned `@babel/core` + `babel-preset-solid`; only Solid generated/reference `.jsx` is transformed as Solid, React JSX remains on Vite's React path, and `.tsrx` remains exclusively owned by `markless()`.
- @markless/web render() never forwards props — packages/web/src/render.ts line 71 calls `component.renderCsr()` zero-arg while the CsrRenderArtifact type at line 25 advertises `renderCsr(props?: unknown)`. There is no public way to pass root props at CSR mount in 0.1.1; even direct renderCsr(props) does not wire values into the lazy event symbols (observed: handlers crash with null graph reads).

  The Markless harness therefore follows the app-owned composition pattern proven by
  poc/03 c6c: zero-prop wrapper apps instantiate the byte-identical fixtures as
  children with literal scenario props, and public `render()` mounts those apps with
  no props. A small mutable trace bridge lets the adapter provide the oracle's current
  callback to those wrapper apps. The bridge exists solely because of this root-prop
  limitation; it only forwards callback arguments and does not alter component
  behavior.
- Markless 0.1.1 cannot production-bundle all of the child fixture's lazy event
  symbols after props flow through the wrapper. Its symbol lowering rewrites graph
  reads inside object-literal callback payloads into invalid property syntax. For S1,
  `onTrace('change', { count })` becomes
  `context.graph.read("prop:props", ["onTrace"])('change', {
  context.graph.read("state:count") })`. For S3, the `checked` payload key becomes
  `{ context.graph.read("state:checked"): event.currentTarget.checked }`; the submit
  payload fails the same way. Rolldown reports ``PARSE_ERROR: Expected `,` or `}` but
  found `.` `` in the corresponding `virtual:markless:symbol:` modules (S1 symbol 0;
  S3 symbols 2 and 3), before any browser execution. This is a further callback-prop
  / lazy-handler compilation limitation. Per the W-D1 stop condition, the harness
  does not use internal APIs or rewrite the byte-authoritative fixtures to bypass it,
  and the 24-comparison browser matrix cannot be regenerated from this wrapper state.
- In the restricted worker sandbox, the three Node fixture-identity checks pass, but
  Chromium verification cannot start because Vitest's local browser server is denied
  `listen(127.0.0.1:51204)` with `EPERM`. Registry access also fails with `ENOTFOUND`
  and the isolated pnpm store lacks several tarballs, so verification reused exact
  repo-local installed dependency trees. Consequently the checked-in verdict remains
  explicitly pending/failing until the PM-side `pnpm test` command above
  machine-generates it. No behavioral divergence was observed or normalized away:
  the browser comparison process never started.

## What this does not prove

This is CSR-only and scoped to S1–S3 and the oracle's declared phases. It does not prove async semantics, cleanup or attach behavior, slots/children/context composition, styling, accessibility, multi-module builds, performance or bundle size, HMR, framework-version ranges, SSR, hydration, resume, type-preserving emission, generated-code debugging, or behavior outside this fixture family. Solid is specifically the disclosed 1.8.22 fallback runtime; this package makes no Solid 2 claim.
