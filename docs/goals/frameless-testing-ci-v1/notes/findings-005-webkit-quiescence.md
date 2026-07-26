# Finding 005 — WebKit exceeds the analyzer's 500ms quiescence bound

**Status:** open, recorded not fixed
**Found by:** T007's cross-engine axis, the first time the suite ran outside Chromium
**Severity:** medium — either a harness assumption or a real engine divergence

## What fails

```
react-browser (webkit)  test/adapter-input.browser.test.ts
  × dispatches analyzer input actions through React controlled inputs
Error: Observable DOM did not quiesce within 500ms
```

Firefox passes all lanes. Chromium passes all lanes. Only WebKit fails, and only
on this one test.

## Two possible readings, not yet distinguished

1. **A harness assumption.** `boundedQuiescence` in the React adapter waits up to
   500ms for the DOM to settle. That bound was chosen against Chromium and has
   never been tested elsewhere. WebKit may simply be slower to settle controlled
   inputs, in which case the bound is wrong rather than the code.
2. **A real engine divergence.** WebKit's handling of React controlled inputs may
   genuinely differ in a way the analyzer is right to flag.

These have very different implications, and the evidence so far does not
separate them. Raising the timeout would make the symptom disappear under either
reading, which is exactly why it should not be the first move — it would convert
a possible real finding into silence.

## Suggested next step

Instrument the failing case to record how long WebKit actually takes and what
the DOM looks like when the bound expires. If it settles at, say, 700ms with
identical final state, it is reading 1 and the bound should be raised
deliberately and documented. If the DOM never settles, or settles differently,
it is reading 2 and belongs in the divergence machinery.

## Status in CI

The WebKit cell is marked `continue-on-error` with a pointer to this note; the
Firefox cell is **not** — it passes and is a normal required cell. WebKit keeps
running so the finding stays visible. Remove `continue-on-error` once resolved.
