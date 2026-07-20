# C9 equivalence results

> Machine-generated from `verdict.json` by the Chromium comparison suite. Do not edit by hand.

C9 verdict: **PASS** for the sanctioned emitted/handwritten scope.
Markless-native leg: **blocked**.

## Scenario × pair verdicts

| Scenario | Pair | Verdict |
| --- | --- | --- |
| S1-render-once-locals | emitted-react__handwritten-react | equal |
| S1-render-once-locals | emitted-solid__handwritten-solid | equal |
| S1-render-once-locals | emitted-react__handwritten-solid | equal |
| S1-render-once-locals | emitted-solid__handwritten-react | equal |
| S1-render-once-locals | emitted-react__emitted-solid | equal |
| S1-render-once-locals | markless__handwritten-react | divergent; still-present(#7) |
| S1-render-once-locals | markless__handwritten-solid | divergent; still-present(#7) |
| S1-render-once-locals | markless__emitted-react | divergent; still-present(#7) |
| S1-render-once-locals | markless__emitted-solid | divergent; still-present(#7) |
| S2-keyed-todo | emitted-react__handwritten-react | equal |
| S2-keyed-todo | emitted-solid__handwritten-solid | equal |
| S2-keyed-todo | emitted-react__handwritten-solid | equal |
| S2-keyed-todo | emitted-solid__handwritten-react | equal |
| S2-keyed-todo | emitted-react__emitted-solid | equal |
| S2-keyed-todo | markless__handwritten-react | blocked-by-upstream(#8) |
| S2-keyed-todo | markless__handwritten-solid | blocked-by-upstream(#8) |
| S2-keyed-todo | markless__emitted-react | blocked-by-upstream(#8) |
| S2-keyed-todo | markless__emitted-solid | blocked-by-upstream(#8) |
| S3-event-form | emitted-react__handwritten-react | equal |
| S3-event-form | emitted-solid__handwritten-solid | equal |
| S3-event-form | emitted-react__handwritten-solid | equal |
| S3-event-form | emitted-solid__handwritten-react | equal |
| S3-event-form | emitted-react__emitted-solid | equal |
| S3-event-form | markless__handwritten-react | blocked-by-upstream(#8) |
| S3-event-form | markless__handwritten-solid | blocked-by-upstream(#8) |
| S3-event-form | markless__emitted-react | blocked-by-upstream(#8) |
| S3-event-form | markless__emitted-solid | blocked-by-upstream(#8) |

## Upstream finding registry

- **#3:** “root props” Evidence: @markless/web packages/web/src/render.ts:71 calls component.renderCsr() with no props; CsrRenderArtifact advertises renderCsr(props?: unknown) at packages/web/src/render.ts:25.
- **#5:** “bare component at template root CSR-renders empty, silently” Evidence: Markless packages/compiler/src/passes/public-render/template.ts:164-170; local minimal repro wrappers/s1-visible.app.tsrx (host-element workaround at lines 5-12).
- **#6:** “aliased prop destructuring — `{ label: displayLabel }` — arrives undefined in child-component composition; plain destructuring works, c6c” Evidence: Markless packages/compiler/src/passes/public-render/shared.ts:218-232 and :49-50; direct runtime probe src/fixtures/s1-render-once.tsrx; compile-only repro ../05-enriched-ir/src/fixtures/alias-coverage.tsrx.
- **#7:** “multi-parameter callback props: lazy-symbol codegen references unbound parameters — 'payload is not defined' in wrapper callback symbol” Evidence: src/wrappers/s1-visible.app.tsrx:10; src/wrappers/s2.app.tsrx:11; src/wrappers/s3.app.tsrx:8.
- **#8:** “prop-derived state in child components never wires into the runtime graph: S2 child handlers crash on null graph reads while mount DOM renders” Evidence: src/fixtures/s2-keyed-todo.tsrx:4 (prop-derived state); runtime repro dispatches in test/equivalence.browser.test.ts.

## Oracle integrity

| Mutant | Expected channel | Rejected | Observed channels |
| --- | --- | ---: | --- |
| wrong-text | dom | yes | dom |
| omitted-callback | callback | yes | callback |
| broken-key-identity | identity | yes | identity |
| wrong-cancellation | callback | yes | callback |
| duplicate-handler | callback | yes | callback |

## Environment

| Item | Version/mode |
| --- | --- |
| execution | Vitest browser mode, headless Chromium; all 12 Markless pairs are live direct-first comparisons with attributed fallbacks only |
| vitest | 4.1.5 |
| browserProvider | @vitest/browser-playwright 4.1.5 |
| playwright | 1.58.2 (locally cached Chromium) |
| vite | 8.0.16 |
| markless | @markless/web + compiler/core/bundler 0.1.1 vendored tarballs; built from local markless-frameless-fixes worktree @ 5e5a100 |
| marklessTarballSha256.bundler | 301b5d6bcf2bd30b527b3836c0a6949681c7a60ccb83be5abb75569548a3e93d |
| marklessTarballSha256.compiler | 59e4fb0bf6b7f4edd9312f0355535e22b1b1ceeb071da9617628d55df6dc5848 |
| marklessTarballSha256.core | 2e957f84d54d8bb2383455be7250ea71b6d9436ff455a657a2376cf9ccf99c97 |
| marklessTarballSha256.router | 841739095013d31da3ec4adfeb3a84e9876b35116e6c05ff8c784985fc7ae573 |
| marklessTarballSha256.runtime | 3c1c5ba9e1e024391539ca9d9325ad631882a9d2817f09f77019e268fe9e4ed8 |
| marklessTarballSha256.serializer | 274d12df07964fc6821b71694ace652dee157d15fae4ff573e0cb78762a9a893 |
| marklessTarballSha256.web | 5fdb1817dffcabad3690102b6d202e696c307060d9cd17f4ac6d134194258c8c |
| react | 18.3.1 |
| solid | 1.8.22 fallback |
| oracle | frameless-equivalence-oracle/1 |
