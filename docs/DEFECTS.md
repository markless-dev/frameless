# Open defects in Frameless

Six defects, ranked. Found by `frameless-testing-ci-v1`; this is the input for a
fix goal. **Defect 1 is now closed** — see its entry, which also corrects several
claims this document originally made about it. The other five are open.

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

As first written: two of the six were called **diagnosed** (cause established),
three **observed but not diagnosed**, one **partially mitigated**.

That count did not survive contact. Defect 1 was one of the two "diagnosed" ones
and its diagnosis turned out to rest on a lint rule that does not test what its
name says and that had stopped firing — so the honest count at the start of
`frameless-defects-and-targets-v1` was **one diagnosed, four undiagnosed, one
partially mitigated**. Defect 1 has since been demonstrated behaviourally and
**closed**; its entry below records the correction rather than hiding it.

---

## 1. Qwik emits `preventDefault()` inside a lazily fetched QRL — `findings-003`

> **CORRECTED, then CLOSED, by `frameless-defects-and-targets-v1`.** Everything
> from here to the end of this section has been rewritten. Four of this entry's
> original claims were false, and the correction is recorded rather than quietly
> applied, because the false claims are what made the defect look already-proven.
> The corrections come from that goal's T015 ruling
> (`docs/goals/frameless-defects-and-targets-v1/notes/T015-cancellation-observability.md`)
> and from T002, which produced the first behavioural evidence this defect ever
> had. T003 fixed it.

**Status:** CLOSED. Was "diagnosed by rule" — which was wrong twice over: the
rule had stopped firing, and the rule does not test what its name says. Between
T002 and T003 the honest status was **undiagnosed with zero demonstrated
evidence**; T002 then demonstrated it behaviourally and T003 fixed it.
**Severity: was highest, and correctly so.** It is the only defect that made
emitted output behave incorrectly for an end user, and that has now been
observed, not argued.

**The name of this defect is wrong.** It is not about `async`. T002's witnessed
failure was a fully **synchronous** handler:

```jsx
onClick$={(event) => { event.preventDefault(); }}
```

No `async`, no `await`, and it failed identically. The cause is **QRL laziness**:
the handler's segment is not resident when the event fires, so fetching it costs
a network round trip while the browser performs the default action immediately
after dispatch. CDP timing from the failing run — the segment arrived at +111ms,
the form's own `Document` GET went out at +118ms, and the click had been
dispatched roughly 58ms before the handler's code existed in the page. `async` is
correlated with the bug and is not what produces it. Qwik's upstream rule carries
the same misnomer; see `notes/T003-upstream-eslint-qwik.md`.

**The code snippet this entry used to show never existed on merged main.** It
read `onClick$={$(async (event) => {` — with a `$()` wrapper. On merged main,
`generated/S3.jsx:37-38` had no wrapper, because `frameless-idiom-policy-v1`
emits raw handlers and lets the optimizer wrap them.

**The lint rule could not serve as evidence.** Read in full,
`eslint-plugin-qwik@2.0.0-beta.38`'s `no-async-prevent-default` walks ancestors
for a `CallExpression` whose callee is the identifier `$`, and **never inspects
`async` at all**. With no `$()` in the emitted output the rule cannot fire. Its
silence on merged main was a parser miss, not a fix — the gate tripwire held here
went green while the defect was untouched.

**The fix is not `preventdefault:click`.** That was this entry's original claim
and it was corrected by the repo owner, who is on the Qwik core team. Qwik event
props accept an **array of QRLs, run in order**, and the first element may be a
`sync$()` QRL, which is serialized inline into the HTML and therefore executes
synchronously during dispatch, before resumption. That is why `preventDefault()`
works there. So the lowering splits the handler:

```jsx
onClick$={[
    sync$((event) => { event.preventDefault(); }),
    $(async (event) => { /* the rest of the body */ }),
]}
```

**Hard constraint:** a `sync$()` body cannot close over reactive state — no
signals, no stores — because it runs before the container resumes. It may read
only what is synchronously on the event.

React and Solid are unaffected — their handlers are synchronous, so
`preventDefault()` is correct there. This is a case where "each framework gets
its own best practice" is a correctness requirement, not a nicety.

**Why it matters more than a lint warning.** Cancellation is an explicitly tested
channel here: `packages/analyzer/src/mutants.ts` declares a `wrong-cancellation`
mutant class against scenario S3, and S3's stated purpose includes "bubbling,
cancellation".

**But the repo had never emitted or exercised a real cancellation in any
target.** Stated plainly, because this entry originally implied the opposite. The
only `preventDefault()` in the whole corpus sat on a `<button type="button">`,
which has no activation behavior inside a form, so there was no default action to
prevent — in React, in Solid, or in Qwik. The claim that the project "shipped a
Qwik emitter that appears to get it wrong in the one scenario built to test it"
was not supportable: that scenario did not test cancellation behaviourally.

**Why nothing caught it — the original attribution was wrong.** This entry blamed
the absent Qwik browser calibration lane. That lane would not have caught it
either. The analyzer's only cancellation observation is
`defaultPrevented: event?.defaultPrevented ?? null` (`packages/analyzer/src/run.ts:41`,
compared at `compare.ts:71`), and the `wrong-cancellation` mutant is realised as
`missing-prevent-default` — it simply omits the call. That channel records **that
`preventDefault()` was called**, not that a default action was averted. Qwik's
late handler still _calls_ `preventDefault()`, so it would still have recorded
`defaultPrevented: true`. **The existing cancellation channel was structurally
blind to this defect.** What was actually missing was any default action to
cancel, and any instrument watching for one.

**What closed it.** T002 added one `<button type="submit" data-action="cancel-submit">`
to S3, clicked last by the three-way contract, and asserted through the Document-request
instrument the contract already runs. It failed for Qwik and only Qwik: **2**
`Document` requests instead of 1, the form's GET reaching the network. T003 then
emitted the `sync$()` split and the same assertion passes at **1** Document
request, with React and Solid unchanged and their observation strings identical.
The gate expectation was released and replaced by a frameless-owned policy,
`frameless/no-handler-prevent-default`, which keys on which kind of QRL the call
lands in — rejecting a lazily fetched one, allowing `sync$()` — and looks at
neither `$()` nor `async`.

**What is closed, and what is not.** Only **unconditional** cancellation. Both
S3 sites qualify — each calls `event.preventDefault()` as the first or only
statement with no guard — and the emitter's trigger is the IR's own declared
`SyncPolicy`: a single branch, `when: constant-truthy`, actions containing
`preventDefault`. Anything else fails the trigger and is emitted unchanged.

**Still open, as a separate design decision:** the IR treats `preventDefault()`
as just another statement in the handler body, which is fine for React and Solid
(synchronous handlers) and wrong for Qwik. Representing **conditional**
cancellation pulls in a `sync$()` body that would need to read state, a gate
policy proving such a body references no reactive state, and a fail-closed path
for the case Qwik genuinely cannot express — a conditional cancel that depends on
signal state. That last one is a new v-limit in the same family as
`unknown-template-node.test.ts`. Owned by T011/T012 of
`frameless-defects-and-targets-v1`, deliberately not folded into the fix above.

**Was held as:** a known-failing expectation in
`packages/frameworks/qwik/test/gate.test.ts` under exact equality. That
expectation is now **released**, and it was not released alone: `[]` was already
what unfixed main produced, so a flip on its own would have shipped a gate that
passed identically on broken output. It was replaced in the same change by
`frameless/no-handler-prevent-default`, whose own mutation test reconstructs the
pre-fix emitter output from the IR and watches the gate reject it while the
upstream rule stays silent.

---

## 2. Qwik drops clicks under a slow connection — `findings-007`

**Status:** diagnosed — the click is _lost_, not delayed
**Severity: high, but likely upstream.**

`demos/qwik/throttled-resume.mjs`, run against a **production** build:

| Condition                  | Result                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| Unthrottled                | all 4 checks pass (`paused` container, `kit:2`, `kit:4`, `kit:6`) |
| 300ms latency / 400 kbit/s | times out; value never leaves `kit:2`                             |

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
_not_ `continue-on-error` (so the job goes red if the instrument breaks) and
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
declares `attr:${string}` on `JSX.CustomAttributes`. That is a _description of
real behavior_ — Solid does support `attr:*` — and it unblocked type-checking.

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
template _structure_, with a pointer to the note. The fixture-level invariant in
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
concern Qwik, both need a _proof before a fix_, and defect 1 needs a real
extension to the three-way contract. This is the tranche that changes what users
receive. _Defect 1 is done: the contract extension landed in T002 and produced
the witnessed failure, and T003 fixed it. Defect 2 remains._

**Tranche B — diagnose the undiagnosed.** Defects 4 and 6, plus confirming
defect 3's cause B. Each is a bounded experiment whose output is a decision, not
a patch. Cheap, and it stops three `continue-on-error` flags from becoming
permanent.

**Tranche C — portability and consumption.** Defect 3's fixes and defect 5's
design decision. Neither affects runtime behavior; both affect who can use and
contribute to the project.

**One constraint worth carrying over.** Every fix should be preceded by a test
that fails for the right reason. That discipline is what found all six of these,
and three of them were held as known-failing expectations precisely so a fix
could not land silently. Defect 1's is now released — and its release is the
sharpest illustration of why the constraint matters. The held expectation had
gone green on its own, without the defect being touched, so _releasing it alone
would have been the fix landing silently_, in the exact way the tripwire existed
to prevent. A held expectation is only evidence for as long as something proves
it can still fail.
