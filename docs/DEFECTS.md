# Open defects in Frameless

Six open defects, ranked. Found by `frameless-testing-ci-v1`; this is the input
for a fix goal.

Full per-defect notes live in `docs/goals/frameless-testing-ci-v1/notes/`
(`findings-002` through `findings-007`). This file is the ranked summary.

Everything here was found by lanes that did not exist before that goal. None of
it was fixed there: the charter forbade changing emitter behavior from a testing
task, because doing so would change what the rest of the matrix was measuring.

**Nothing in this list is unfinished testing work.** These are defects the
testing work uncovered. The suite that found them is complete and green.

All line references are on branch `goal/frameless-testing-ci-v1` (unmerged).

---

## How these are ranked

By **how wrong the shipped output is**, not by effort. A defect that makes
emitted code behave incorrectly outranks one that makes it awkward to consume,
which outranks one that only affects contributors.

Two of the six are **diagnosed** (cause established). Three are **observed but
not diagnosed** — for those, the first task is to separate competing
explanations, not to write a fix. One is **partially mitigated**.

---

## 1. Qwik emits `preventDefault()` inside an async QRL — `findings-003`

**Status:** diagnosed by rule, runtime divergence NOT yet demonstrated
**Severity: highest.** This is the only defect that plausibly makes emitted
output behave incorrectly for an end user.

`packages/frameworks/qwik/generated/S3.jsx:38`:

```jsx
onClick$={$(async (event) => {
    event.preventDefault();
```

Qwik's own `no-async-prevent-default` rule flags this. In a resumable app the
handler is a QRL that must be fetched and executed asynchronously; by the time it
runs, the browser has already dispatched the default action, so the call is a
no-op. Qwik's supported mechanism is the `preventdefault:click` JSX attribute,
applied synchronously at the DOM level.

React and Solid are unaffected — their handlers are synchronous, so
`preventDefault()` is correct there. This is a case where "each framework gets
its own best practice" is a correctness requirement, not a nicety.

**Why it matters more than a lint warning.** Cancellation is an explicitly tested
channel here: `packages/analyzer/src/mutants.ts` declares a `wrong-cancellation`
mutant class against scenario S3, and the React and Solid calibration suites
prove the analyzer *detects* a broken `preventDefault`. S3's stated purpose
includes "bubbling, cancellation". The project already decided this channel
matters — and then shipped a Qwik emitter that appears to get it wrong in the one
scenario built to test it.

**Why nothing caught it.** The `wrong-cancellation` calibration runs only in the
browser calibration lanes, which exist for React and Solid but not Qwik (blocked
upstream: `@qwik.dev/core` peer-requires `vitest ">=2 <4"`, workspace is on
4.1.5). The Qwik gate had no framework-native rules at all before this work. And
`pnpm e2e`'s three-way contract asserts text content and write counts — not
whether the default action was actually prevented.

**The fix is known** — guidance from the repo owner, who is on the Qwik core
team. Qwik has two mechanisms:

- **Unconditional cancellation** → the `preventdefault:click` attribute on the
  element. **This is S3's case**: `s3-event-form.tsrx:37` calls
  `event.preventDefault()` as the first statement with no guard.
- **Conditional cancellation** → `sync$()`, which runs synchronously so
  `preventDefault()` works. Canonical case: a keydown that cancels only for
  certain keys. **Hard constraint: `sync$()` cannot close over reactive state** —
  no signals, no stores, because it runs before the container resumes. It may
  only read what is synchronously on the event, such as `e.target` attributes.

**Do this first, in order:**

1. Extend the three-way contract to assert the default action is prevented in all
   three frameworks. It currently cannot see this — it checks text and write
   counts only.
2. Watch it **fail for Qwik**. Confirm the divergence rather than assuming it —
   the rule fired, but no runtime failure has been demonstrated.
3. Emit `preventdefault:click` for the unconditional case; watch it pass.

**Then, as a separate design decision — do not rush it into the same change:**
the IR currently treats `preventDefault()` as just another statement in the
handler body, which is fine for React and Solid (synchronous handlers) and wrong
for Qwik. Deciding how it represents *conditional* cancellation pulls in
`sync$()` lowering, a gate policy proving a `sync$` body references no reactive
state, and a fail-closed path for the case Qwik genuinely cannot express — a
conditional cancel that depends on signal state. That last one is a new v-limit
in the same family as `unknown-template-node.test.ts`.

**Currently held as:** a known-failing expectation in
`packages/frameworks/qwik/test/gate.test.ts` under exact equality, so it cannot
silently disappear.

---

## 2. Qwik drops clicks under a slow connection — `findings-007`

**Status:** diagnosed — the click is *lost*, not delayed
**Severity: high, but likely upstream.**

`demos/qwik/throttled-resume.mjs`, run against a **production** build:

| Condition | Result |
| --- | --- |
| Unthrottled | all 4 checks pass (`paused` container, `kit:2`, `kit:4`, `kit:6`) |
| 300ms latency / 400 kbit/s | times out; value never leaves `kit:2` |

With request logging on: **zero network requests are issued after the click.**
The handler QRL is never even requested.

That is materially different from "resumption is slow on a bad connection". The
click is being dropped. The likely mechanism is that it lands before Qwik's
bootstrap listener is installed over the slow link, and is not queued — and
queuing pre-resume interaction is precisely what a resumable framework claims to
do.

**Ruled out:** dev-bundle size. The production build fails identically, and 30s
at 400 kbit/s is roughly a 1.5 MB budget against small production QRL segments.

**Caveat, stated plainly:** the script clicks as soon as `domcontentloaded`
fires. That is aggressive — but not unfair, since "interactive before hydration"
is the claim resumability is sold on, and a real user on a slow connection can
tap a visible button before a background script finishes.

**Do this first:** reproduce on an untouched `pnpm create qwik` app. That
separates an upstream Qwik issue from a Frameless one — and since the emitted
components carry no bootstrap logic of their own, upstream looks more likely. If
it reproduces there, this is an issue to file against Qwik, not a change here.

**Currently held as:** the `qwik-throttled` CI job, whose unthrottled control is
*not* `continue-on-error` (so the job goes red if the instrument breaks) and
whose throttled step is (so the finding stays visible without blocking).

---

## 3. The test suite does not run on Windows — `findings-004`

**Status:** two causes identified, one confirmed and one suspected
**Severity: medium.** Blocks Windows contributors entirely; does not affect
emitted output.

**35 tests failed across 8 files** (501 passed) on `windows-latest` / Node 24 —
the first time anything in this repo ran on Windows. macOS on the same run is
clean, so this is specifically a Windows portability gap.

**Cause A (confirmed).** `format-emitted.test.ts` shells out with
`execFileSync('npx', ...)`. On Windows `npx` is `npx.cmd`, which `execFileSync`
cannot resolve without `shell: true`. Affects both the React and Solid copies.

**Cause B (suspected, not confirmed).**
`packages/frameworks/solid/test/gate.test.ts:610` — `expected [] to include
'S-SH7'`. An expected identifier is absent from gate output. The most likely
explanation is line endings: Windows checks out CRLF by default, and any hashing
or line-splitting over emitted source will differ from LF. **This is a guess and
is labelled as one.** Confirm before writing a fix.

**Currently held as:** the Windows matrix cell, `continue-on-error` with a
pointer to the note. Remove that flag once both causes are closed.

---

## 4. WebKit exceeds the analyzer's quiescence bound — `findings-005`

**Status:** observed, NOT diagnosed
**Severity: medium.** Could be a harness assumption or a real engine divergence.

```
react-browser (webkit)  test/adapter-input.browser.test.ts
  × dispatches analyzer input actions through React controlled inputs
Error: Observable DOM did not quiesce within 500ms
```

Firefox passes everything. Chromium passes everything. Only WebKit, only this
test.

**Two readings, not yet separated:**

1. `boundedQuiescence` waits up to 500ms for the DOM to settle. That bound was
   chosen against Chromium and never tested elsewhere. WebKit may simply be
   slower to settle controlled inputs.
2. WebKit genuinely handles React controlled inputs differently, and the analyzer
   is right to flag it.

**Do not raise the timeout first.** It would make the symptom vanish under either
reading, converting a possible real finding into silence.

**Do this first:** instrument the failing case to record how long WebKit actually
takes and what the DOM looks like when the bound expires. Settles at ~700ms with
identical final state → reading 1, raise the bound deliberately and document it.
Never settles, or settles differently → reading 2, and it belongs in the
divergence machinery.

**Currently held as:** the WebKit matrix cell, `continue-on-error`. The Firefox
cell is a normal required cell — it passes.

---

## 5. Emitted Solid uses `attr:value`, which solid-js's types reject — `findings-002`

**Status:** partially mitigated; the design question is open
**Severity: medium.** Affects anyone consuming Solid output in TypeScript.

Emitted `S2.jsx` and `S3.jsx` use `attr:value`, which solid-js's shipped
`InputHTMLAttributes` does not declare. Three type errors, no React equivalent.

**Not a runtime bug.** `pnpm e2e` passes all nine three-way cells and the Solid
browser lane passes 44/44, exercising these exact files.

**What was already done:** `packages/frameworks/solid/test/solid-attr-namespace.d.ts`
declares `attr:${string}` on `JSX.CustomAttributes`. That is a *description of
real behavior* — Solid does support `attr:*` — and it unblocked type-checking.

**What it does NOT settle**, and why this is still on the list:

- **Is `attr:` necessary?** The emitter chose it over plain `value` to force
  attribute semantics on a controlled input. Whether plain `value` preserves the
  behavior S2/S3 assert is a compiler-behavior question.
- **Or is this solid-js's typing gap?** Solid supports `attr:*` generically, so
  arguably `InputHTMLAttributes` should admit it — in which case the right move is
  upstream and the local declaration is just documentation.

**An informative wrinkle:** the **handwritten** Solid references use `attr:value`
too, not only emitted output. So the emitter is reproducing a deliberate house
idiom rather than inventing one. That makes the upstream reading more plausible.

---

## 6. Whole-IR rename invariant fails generatively — `findings-006`

**Status:** observed, NOT diagnosed
**Severity: unknown.** Recorded so it is not lost; may turn out to be a non-issue.

`metamorphic.test.ts` asserts that an equal-length rename of a local changes the
IR's identifier strings and nothing else. That holds exactly on all three
checked-in fixtures.

Applied generatively, the same whole-IR comparison fails once a program has
several locals. Counterexample (fast-check seed 20260726): three state locals,
a single text node, rename `epsilon9` → `zpsilon9`. A single-local version of the
same shape compares identical.

**Hypothesis, explicitly labelled as one:** the rename moves that name from first
to last alphabetically. If any part of the IR orders locals by name, the
representation would legitimately reorder and the comparison would report a
difference that is not a bug. **Not verified.** The alternative — that
declaration order is genuinely unstable under renaming — is more serious.

**Do this first:** dump both IRs for that counterexample and diff field by field.
Only the order of a name-keyed collection differs → closes as legitimate, and the
comparison needs an order-insensitive view. Declaration order or cell wiring
differs → real compiler finding, escalate.

**Currently held as:** property 3 in `generative.test.ts` narrowed to compare
template *structure*, with a pointer to the note. The fixture-level invariant in
`metamorphic.test.ts` still asserts exact whole-IR equality and still passes.

---

## Closed, for the record

**`findings-001` — `engines.node: ">=20"` was false.** The toolchain cannot load
`vite.config.ts` on the Node 20 GitHub ships. **Fixed:** `>=22`, set from what the
matrix proved green rather than from the error message's claim.

---

## Suggested shape for the fix goal

The six above are not one tranche. They split cleanly:

**Tranche A — emitted-output correctness (do first).** Defects 1 and 2. Both
concern Qwik, both need a *proof before a fix*, and defect 1 needs a real
extension to the three-way contract. This is the tranche that changes what users
receive.

**Tranche B — diagnose the undiagnosed.** Defects 4 and 6, plus confirming
defect 3's cause B. Each is a bounded experiment whose output is a decision, not
a patch. Cheap, and it stops three `continue-on-error` flags from becoming
permanent.

**Tranche C — portability and consumption.** Defect 3's fixes and defect 5's
design decision. Neither affects runtime behavior; both affect who can use and
contribute to the project.

**One constraint worth carrying over.** Every fix should be preceded by a test
that fails for the right reason. That discipline is what found all six of these,
and three of them are currently held as known-failing expectations precisely so a
fix cannot land silently.
