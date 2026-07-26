# Finding 003 — the Qwik emitter emits `preventDefault()` inside an async QRL

**Status:** open, recorded not fixed
**Found by:** T006, first run of `eslint-plugin-qwik` against emitted output
**Severity:** high — a probable behavioral divergence in a channel the project
already treats as correctness-critical
**This is an emitter defect, not a lint style preference.**

## What the rule says

```
generated/S3.jsx:38
eslint:qwik/no-async-prevent-default
  This is an asynchronous function and does not support preventDefault.
  Use preventDefault attributes instead
```

The emitted source:

```jsx
onClick$={$(async (event) => {
    event.preventDefault();
    ...
```

Qwik's own rule exists because in a resumable app the handler is a QRL that must
be **fetched and executed asynchronously**. By the time it runs, the browser has
already dispatched the default action, so `event.preventDefault()` is a no-op.
Qwik's supported mechanism is the JSX attribute — `preventdefault:click` — which
is applied synchronously at the DOM level before the QRL resolves.

React and Solid have no equivalent problem: their handlers are synchronous, so
`preventDefault()` works, and the emitters are right to use it there. This is
precisely the kind of place where "the same component compiles to different
shapes because each framework's best practice differs" is not a nicety but a
correctness requirement.

## Why this one matters more than the other findings

Cancellation is not an incidental detail in this codebase — it is an explicitly
tested behavior channel. `packages/analyzer/src/mutants.ts` declares a
`wrong-cancellation` mutant class against scenario `S3-event-form`, and the React
and Solid calibration suites prove the analyzer *detects* a broken
`preventDefault`. Scenario S3's stated purpose includes "bubbling, cancellation".

So the project already decided cancellation is a channel where divergence is a
bug worth catching — and then shipped a Qwik emitter that appears to get it
wrong, in the one scenario built to test it.

## Why nothing caught it until now

This is a direct, concrete instance of the asymmetry the audit named and T003
Ruling 2 documented:

- the analyzer's `wrong-cancellation` calibration runs in the **browser
  calibration lanes**, which exist only for React and Solid;
- Qwik has **no browser test project** (blocked upstream: `@qwik.dev/core`
  peer-requires `vitest ">=2 <4"`, workspace is on 4.1.5);
- the Qwik gate had **no framework-native lint rules at all** before T006 — only
  two hand-written policies;
- `pnpm e2e` exercises Qwik S3, but its three-way contract asserts text content
  and write counts (`text = hello`, `writes = 2`), **not** whether the default
  action was actually prevented.

Every lane that could have caught this was either absent for Qwik or not looking
at cancellation. Adding one third-party rule set found it in a single run.

## What is NOT yet established

Honesty about the limits of this evidence:

- **The rule fired; a runtime divergence has not been demonstrated.** No test yet
  proves the default action actually occurs in a browser. It is possible the
  emitted markup also carries a `preventdefault:` attribute that makes the point
  moot, or that this handler's default action is immaterial. That should be
  checked before anyone writes a fix.
- The right fix is a **compiler-behavior decision** — emit `preventdefault:click`
  for Qwik, and decide how the IR represents "this handler cancels" so all three
  emitters lower it correctly. This goal's charter explicitly forbids changing
  emitter behavior from a testing task, because doing so would change what the
  rest of the matrix is measuring.

## Recommended next step

A dedicated task that, in order:

1. writes a browser-level assertion that the default action is prevented in all
   three frameworks (extending the three-way contract, which currently cannot
   see this);
2. watches it **fail for Qwik** — confirming the divergence rather than assuming
   it;
3. then fixes the emitter and watches it pass.

That sequence keeps the proof ahead of the fix, which is how everything else in
this repo is verified.

## Status in the test suite

Per T003 Ruling 5 the violation is **not** suppressed and the rule is **not**
disabled. `packages/frameworks/qwik/test/gate.test.ts` asserts the gate's
violations equal exactly one known entry, labelled with a pointer to this note.
If the emitter is fixed and the violation disappears, that test fails and forces
this note to be closed deliberately.
