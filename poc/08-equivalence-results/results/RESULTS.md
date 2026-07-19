# C9 equivalence results

> Machine-generated from `verdict.json` by the Chromium comparison suite. Do not edit by hand.

Verdict: **FAIL**

## Required comparisons

| Scenario | Pair | Equal | Divergences |
| --- | --- | ---: | ---: |
| S1-render-once-locals | emitted-react__handwritten-react | yes | 0 |
| S1-render-once-locals | emitted-solid__handwritten-solid | yes | 0 |
| S1-render-once-locals | emitted-react__handwritten-solid | yes | 0 |
| S1-render-once-locals | emitted-solid__handwritten-react | yes | 0 |
| S1-render-once-locals | emitted-react__emitted-solid | yes | 0 |
| S1-render-once-locals | markless__handwritten-react | no | 10 |
| S1-render-once-locals | markless__emitted-react | no | 10 |
| S1-render-once-locals | markless__emitted-solid | no | 10 |
| S2-keyed-todo | emitted-react__handwritten-react | yes | 0 |
| S2-keyed-todo | emitted-solid__handwritten-solid | yes | 0 |
| S2-keyed-todo | emitted-react__handwritten-solid | yes | 0 |
| S2-keyed-todo | emitted-solid__handwritten-react | yes | 0 |
| S2-keyed-todo | emitted-react__emitted-solid | yes | 0 |
| S2-keyed-todo | markless__handwritten-react | no | 83 |
| S2-keyed-todo | markless__emitted-react | no | 83 |
| S2-keyed-todo | markless__emitted-solid | no | 83 |
| S3-event-form | emitted-react__handwritten-react | yes | 0 |
| S3-event-form | emitted-solid__handwritten-solid | yes | 0 |
| S3-event-form | emitted-react__handwritten-solid | yes | 0 |
| S3-event-form | emitted-solid__handwritten-react | yes | 0 |
| S3-event-form | emitted-react__emitted-solid | yes | 0 |
| S3-event-form | markless__handwritten-react | no | 24 |
| S3-event-form | markless__emitted-react | no | 24 |
| S3-event-form | markless__emitted-solid | no | 24 |

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
| execution | one environment: Vitest browser mode, headless Chromium |
| vitest | 4.1.5 |
| browserProvider | @vitest/browser-playwright 4.1.5 |
| playwright | 1.58.2 (locally cached Chromium) |
| vite | 8.0.16 |
| markless | @markless/web + compiler/core/bundler 0.1.1 vendored tarballs |
| react | 18.3.1 |
| solid | 1.8.22 fallback |
| oracle | arcade-equivalence-oracle/1 |
