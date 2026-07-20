# C9 equivalence results

> Machine-generated from `verdict.json` by the Chromium comparison suite. Do not edit by hand.

C9 verdict: **PASS** for the sanctioned emitted/handwritten scope.
Markless-native leg: **blocked-by-upstream**.

## Scenario × pair verdicts

| Scenario | Pair | Verdict |
| --- | --- | --- |
| S1-render-once-locals | emitted-react__handwritten-react | equal |
| S1-render-once-locals | emitted-solid__handwritten-solid | equal |
| S1-render-once-locals | emitted-react__handwritten-solid | equal |
| S1-render-once-locals | emitted-solid__handwritten-react | equal |
| S1-render-once-locals | emitted-react__emitted-solid | equal |
| S1-render-once-locals | markless__handwritten-react | blocked-by-upstream(#3,#5,#6,#7,#8); dom-only-partial |
| S1-render-once-locals | markless__handwritten-solid | blocked-by-upstream(#3,#5,#6,#7,#8); dom-only-partial |
| S1-render-once-locals | markless__emitted-react | blocked-by-upstream(#3,#5,#6,#7,#8) |
| S1-render-once-locals | markless__emitted-solid | blocked-by-upstream(#3,#5,#6,#7,#8) |
| S2-keyed-todo | emitted-react__handwritten-react | equal |
| S2-keyed-todo | emitted-solid__handwritten-solid | equal |
| S2-keyed-todo | emitted-react__handwritten-solid | equal |
| S2-keyed-todo | emitted-solid__handwritten-react | equal |
| S2-keyed-todo | emitted-react__emitted-solid | equal |
| S2-keyed-todo | markless__handwritten-react | blocked-by-upstream(#3,#5,#6,#7,#8) |
| S2-keyed-todo | markless__handwritten-solid | blocked-by-upstream(#3,#5,#6,#7,#8) |
| S2-keyed-todo | markless__emitted-react | blocked-by-upstream(#3,#5,#6,#7,#8) |
| S2-keyed-todo | markless__emitted-solid | blocked-by-upstream(#3,#5,#6,#7,#8) |
| S3-event-form | emitted-react__handwritten-react | equal |
| S3-event-form | emitted-solid__handwritten-solid | equal |
| S3-event-form | emitted-react__handwritten-solid | equal |
| S3-event-form | emitted-solid__handwritten-react | equal |
| S3-event-form | emitted-react__emitted-solid | equal |
| S3-event-form | markless__handwritten-react | blocked-by-upstream(#3,#5,#6,#7,#8) |
| S3-event-form | markless__handwritten-solid | blocked-by-upstream(#3,#5,#6,#7,#8) |
| S3-event-form | markless__emitted-react | blocked-by-upstream(#3,#5,#6,#7,#8) |
| S3-event-form | markless__emitted-solid | blocked-by-upstream(#3,#5,#6,#7,#8) |

## Upstream findings carried by every blocked Markless pair

- **#3:** “root props” Evidence: @markless/web packages/web/src/render.ts:71 calls component.renderCsr() with no props; CsrRenderArtifact advertises renderCsr(props?: unknown) at packages/web/src/render.ts:25.
- **#5:** “bare component at template root CSR-renders empty, silently” Evidence: Markless packages/compiler/src/passes/public-render/template.ts:164-170; local minimal repro wrappers/s1-visible.app.tsrx (host-element workaround at lines 5-12).
- **#6:** “aliased prop destructuring — `{ label: displayLabel }` — arrives undefined in child-component composition; plain destructuring works, c6c” Evidence: Markless packages/compiler/src/passes/public-render/shared.ts:218-232 and :49-50; compile-only repro ../05-enriched-ir/src/fixtures/alias-coverage.tsrx.
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
| execution | Vitest browser mode, headless Chromium; blocked Markless records are adjudicated upstream findings, not executed passes |
| vitest | 4.1.5 |
| browserProvider | @vitest/browser-playwright 4.1.5 |
| playwright | 1.58.2 (locally cached Chromium) |
| vite | 8.0.16 |
| markless | @markless/web + compiler/core/bundler 0.1.1 vendored tarballs |
| react | 18.3.1 |
| solid | 1.8.22 fallback |
| oracle | frameless-equivalence-oracle/1 |
