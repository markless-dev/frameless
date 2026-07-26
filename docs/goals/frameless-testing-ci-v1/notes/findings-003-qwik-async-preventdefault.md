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

## The fix, per the Qwik core team

Guidance below is from the repo owner, who is on the Qwik core team. It is
authoritative and settles what the rest of this note previously left open.

Qwik has **two** mechanisms, and which applies depends on whether the
cancellation is conditional.

### Unconditional — the `preventdefault:` attribute

If the handler always cancels, declare it on the element:

```jsx
<button preventdefault:click onClick$={...}>
```

**This is S3's case.** `packages/compiler/test/fixtures/s3-event-form.tsrx:37`
calls `event.preventDefault()` as the first statement of the handler, with no
guard. So the emitted Qwik output should carry `preventdefault:click` and drop
the call from the QRL body.

### Conditional — `sync$()`

If cancellation depends on the event, Qwik provides `sync$()`: a handler that
runs **synchronously**, so `preventDefault()` still works. The canonical case is
a keydown that cancels only for particular keys — arrow keys, say — and lets
everything else through.

**`sync$()` carries a hard constraint: it cannot close over reactive state.** No
signals, no stores. It runs before the container resumes, so that state is not
available to it. It may only read what is synchronously present on the event —
`e.target` and its attributes, key codes, and so on.

## What this means for the compiler, beyond patching S3

The constraint is the interesting part, and it lands squarely in this project's
stated territory: reject what it cannot prove.

1. **The IR needs to distinguish unconditional from conditional cancellation.**
   Today `preventDefault()` is just another statement in the handler body. React
   and Solid can keep lowering it that way because their handlers are
   synchronous. Qwik cannot.
2. **Anything lowered into `sync$()` must be proven not to reference reactive
   state.** That is a gate policy, and it is exactly the shape of the policies
   already in `packages/frameworks/qwik/src/gate/index.ts` — a rule with a test
   proving it rejects a violating input.
3. **If a component conditionally cancels *based on* signal state, Qwik cannot
   express it.** Per this project's own charter the right response is to fail
   closed with a clear message rather than emit something that silently does not
   cancel. That is a new limit, deserving a test in the same family as
   `packages/compiler/test/unknown-template-node.test.ts`.

Point 3 is what turns this from a bug fix into a design decision, and it is worth
settling before the emitter change is written.

## What is NOT yet established

Honesty about the limits of this evidence:

- **The rule fired; a runtime divergence has not been demonstrated.** No test yet
  proves the default action actually occurs in a browser. It is possible the
  emitted markup also carries a `preventdefault:` attribute that makes the point
  moot, or that this handler's default action is immaterial. That should be
  checked before anyone writes a fix.
- The emitter change itself was out of scope here: this goal's charter forbids
  changing emitter behavior from a testing task, because doing so would change
  what the rest of the matrix is measuring.

## Recommended next step

Unchanged in shape — proof before fix — but the fix is now known rather than open:

1. Write a browser-level assertion that the default action is prevented, in all
   three frameworks. The three-way contract currently cannot see this: it asserts
   text content and write counts only.
2. Watch it **fail for Qwik**, confirming the divergence rather than assuming it.
3. Emit `preventdefault:click` for S3's unconditional case and watch it pass.
4. Separately, decide how the IR represents conditional cancellation, whether
   `sync$()` lowering is in scope, and what the gate policy and fail-closed
   message look like when a conditional cancel depends on reactive state.

Steps 1-3 are a bug fix. Step 4 is a design decision and should not be rushed
into the same change.

## Status in the test suite

Per T003 Ruling 5 the violation is **not** suppressed and the rule is **not**
disabled. `packages/frameworks/qwik/test/gate.test.ts` asserts the gate's
violations equal exactly one known entry, labelled with a pointer to this note.
If the emitter is fixed and the violation disappears, that test fails and forces
this note to be closed deliberately.
