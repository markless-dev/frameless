# Findings ledger — Frameless

Six **findings**, ranked. Raised by `frameless-testing-ci-v1`; adjudicated by
`frameless-defects-and-targets-v1`. The title used to say "Open defects", and the
retitle is the smallest honest change this document needed: not one of these six
was a defect purely because a test went red. Each had to be adjudicated into
**product defect**, **test-suite defect**, **upstream**, or **not a defect**, and
the adjudication reversed the initial reading in four of six cases.

Full per-finding notes live in `docs/goals/frameless-testing-ci-v1/notes/`
(`findings-002` through `findings-007`) for the original observations, and in
`docs/goals/frameless-defects-and-targets-v1/notes/` for the adjudications
(`T006-diagnoses.md`, `T007-phase-b-audit.md`, `T008-portability-and-attr.md`).

## The framing this document used to carry, and why it was withdrawn

It opened:

> **Nothing in this list is unfinished testing work.** These are defects the
> testing work uncovered. The suite that found them is complete and green.

Both sentences are false, and the second is false twice.

**Adjudicated provenance:**

| #   | as filed                   | adjudicated                                                                            | by                      |
| --- | -------------------------- | -------------------------------------------------------------------------------------- | ----------------------- |
| 1   | product defect, "diagnosed by rule" | **product defect** — but the stated evidence was false four ways; the real evidence is T002's | T015 / T002 / T003      |
| 2   | product defect, high       | **not a defect** — the instrument clicked before any framework installs listeners      | owner overturn of T004  |
| 3   | portability defect         | **test-suite defect** — four causes, one root (the repo had no `.gitattributes`)       | T006 + T007 + T008      |
| 4   | possible engine divergence | **test-suite defect** — a wall-clock bound over a frame-gated loop                     | T006, ruled by T007     |
| 5   | consumption defect         | **upstream** — solid-js's typing gap; the emitted output is correct and required       | T008 measurement        |
| 6   | possible compiler defect   | **test-suite defect** — an invariant contradicting a declared canonicalisation         | T006, ruled by T007     |

**One product defect. One non-defect. Three test-suite defects. One upstream.**
Three of six *are* unfinished testing work — the exact claim the old opening
denied.

"Complete and green" is false a second time, because some of that green was
**vacuous**. Three instances are on record:

1. The Qwik gate's held expectation was green **on broken output** — `[]` was
   already what unfixed `main` produced, so releasing it alone would have shipped
   a gate that passed identically before and after the fix (T015, T003).
2. The Solid gate's `S-SH7` mutation could silently produce a **non-mutant**: its
   search literal spanned a line break, so on a CRLF checkout `String.replace`
   returned the fixture unchanged and the row asserted a policy against unmutated
   source (T006).
3. `metamorphic.test.ts`'s whole-IR rename invariant — the one this document used
   to say "holds exactly on all three checked-in fixtures" — ran on **one**
   fixture, whose IR has a single state binding and therefore could not exhibit
   finding 6 under any rename it performed. It passed because it was structurally
   incapable of failing (T007).

So the replacement claim is deliberately weaker and checkable: **the suite is
green, and its green is worth exactly as much as its calibration.** That is why
every instrument repaired in this goal ships with a test that makes it fail — a
witnessed prior failure, checked in, not a note that one was once observed.

## The shape all of them share

> **Every one measured the product through a proxy whose stability the product
> never promised, and asserted nothing about the proxy.**

| finding | asserted                       | actual proxy                     | what the target actually promised                          |
| ------- | ------------------------------ | -------------------------------- | ---------------------------------------------------------- |
| 2       | "the page is interactive"      | `domcontentloaded` has fired     | nothing about listeners at DCL — *no* framework promises it |
| 3-B     | "the source was mutated"       | `String.replace` was called      | to return a string, not to have matched                     |
| 4       | "the DOM has settled"          | 500 ms of wall clock             | rAF promises ordering before repaint, never a rate          |
| 6       | "the IR changed only in names" | array **positions** are equal    | the IR declares those arrays canonically sorted **by name** |

The failure is not that assumptions were made — instruments cannot avoid
assumptions. It is that each assumption was **silent**. Nothing asserted the
precondition it depended on, so when the precondition broke, the instrument
reported a **product** defect instead of an **instrument** fault. A silent
precondition converts every one of its own violations into a false finding about
something else. The secondary failure is human: in three of four cases the red
was interpreted before anyone asked whether the test was fair.

Three standing rules came out of this and are being carried onto the Svelte, Vue
and Angular charters (T007 §5.3): **triangulate** on one instrument variable and
one product variable before filing anything; **every instrument asserts its own
preconditions**; and **calibrate harnesses two-sided**, not only gates.

---

## How these are ranked

By **how wrong the shipped output is**, not by effort. A finding that makes
emitted code behave incorrectly outranks one that makes it awkward to consume,
which outranks one that only affects contributors. Note that the ranking is by
the finding *as filed* — it is preserved so the reordering caused by adjudication
stays visible. Under the adjudicated provenance above, finding 2 would now rank
last and finding 3 near the top.

As first written: two of the six were called **diagnosed** (cause established),
three **observed but not diagnosed**, one **partially mitigated**.

That count did not survive contact. Defect 1 was one of the two "diagnosed" ones
and its diagnosis turned out to rest on a lint rule that does not test what its
name says and that had stopped firing — so the honest count at the start of
`frameless-defects-and-targets-v1` was **one diagnosed, four undiagnosed, one
partially mitigated**. Defect 1 has since been demonstrated behaviourally and
**closed**; its entry below records the correction rather than hiding it.

Line references in entry 1 are on branch `goal/frameless-testing-ci-v1`
(unmerged). Line references added by `frameless-defects-and-targets-v1` are on
`main`.

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
read `onClick$={$(async (event) => {` — with a `$()` wrapper. On merged main, the
Qwik lane's emitted `S3` `onClick$` handler had no wrapper, because
`frameless-idiom-policy-v1` emits raw handlers and lets the optimizer wrap them.

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
`defaultPrevented: event?.defaultPrevented ?? null`, recorded on each
`CallbackRecord` by the `onTrace` prop in `packages/analyzer/src/run.ts` and
compared only as one field of that whole record, by the `callback` divergence in
`packages/analyzer/src/compare.ts` — the name `defaultPrevented` appears nowhere
in `compare.ts`. The `wrong-cancellation` mutant is realised as
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

## 2. Qwik drops clicks under a slow connection — `findings-007` — **NOT A DEFECT**

**Status:** CLOSED as **not a defect**. Verdict overturned by the repo owner on
2026-07-27, reversing both T004's "upstream Qwik" ruling and T005's ratification
of it.
**Severity: none.** There is nothing here to fix, in Frameless or upstream.

> Everything below the heading has been rewritten. The measurements were real;
> the conclusion drawn from them was not. This entry is kept, rather than deleted,
> because the way this finding went wrong is the most instructive thing in the
> document.

**What the instrument actually measured.** `demos/qwik/throttled-resume.mjs`
clicks as soon as `domcontentloaded` fires — **before any framework has installed
listeners**. No framework promises anything about listeners at DCL. Every
framework loses a click in that window; React and Solid lose it for *longer*,
because they need framework plus component code to arrive rather than a ~1 KB
loader. So the assertion under test was not "Qwik drops clicks" but "is this page
interactive with no JavaScript yet executed", whose answer is **no, everywhere**.

**The asymmetry was the harness's, and it is visible in this repo.** The
three-way contract does *not* hold React and Solid to this standard:
`waitForInteractive` blocks on the activation marker before clicking them. Only
Qwik was clicked at DCL with no wait. That is a difference between two
instruments, not between three frameworks.

**The strongest-looking evidence was the tell.** "It reproduces on an untouched
`pnpm create qwik` scaffold" was read as proof of an upstream defect. It is the
opposite: it is proof the **test** is unfair, because it would reproduce on
anything. A control that fails identically on a bare scaffold does not localise a
defect into the framework; it localises it into the instrument. This is exactly
what the triangulation rule now requires before a finding is filed.

**The upstream filing is RETRACTED and was never sent.** T004 and T005 produced
filing material (`notes/T004-upstream-qwik-dropped-click.md`); it must not be
sent, and no issue exists to withdraw.

**No workaround is recorded here, deliberately.** T005 carried a rider suggesting
`qwikLoader: 'inline'` be documented as a consumer workaround. That rider is
**superseded**: with no defect, there is nothing to work around, and recording a
non-default render option against a non-defect would be the same mistake in
documentation form. `demos/qwik` continues to use the default scaffold
configuration, which is the entire asset `frameless-qwik-v1` bought.

**Three parties missed this** — the Worker at T004, the Judge at T005, and the PM
— by never asking whether the instrument was fair before interpreting its output.
That is the process failure, and it is the reason for the standing rules above.

**Was held as:** the `qwik-throttled` job's throttled step,
`continue-on-error: true`. **That flag is now OFF** (T022). It was owner-ruled,
and its removal was gated on the lane being rescoped to click *after* the
container reports `resumed` rather than at `domcontentloaded` — which is what
`demos/qwik/throttled-resume.mjs` now does, blocking on
`q:container="resumed"`, Qwik's own report about itself and the same attribute
the three-way contract asserts. The rescoped lane **passes under real
300ms/400kbit**: on the production build, resumption arrives in **1588–1592 ms**
across four runs (21 ms unthrottled), the server-rendered value survives it, and
both post-resume clicks land. So the residual-failure clause never had to be
exercised — there is no genuine slow-link finding hiding behind this flag.

The rescoped gate was calibrated **two-sided** before the flag came off, because
a gate that cannot fail is worth nothing: with the container's scripts blocked,
`q:container` stays `paused`, the wait throws and the script exits 1. The
unthrottled control remains **not** flagged either: it is the instrument's own
health check.

---

## 3. The test suite does not run on Windows — `findings-004` — **test-suite defect**

**Status:** four causes named, **all four closed in code** by T008. The CI flag
**stays** until a real Windows cell is observed green.
**Severity: medium.** Blocked Windows contributors entirely; never affected
emitted output.

**35 tests failed across 8 files** (501 passed) on `windows-latest` / Node 24 —
the first time anything in this repo ran on Windows. macOS on the same run is
clean, so this is specifically a Windows portability gap.

**Cause A — confirmed, and unrelated to line endings.** Both
`format-emitted.test.ts` copies shelled out with `execFileSync('npx', ...)`. On
Windows `npx` is `npx.cmd`: without a shell `execFileSync` reports `ENOENT`, and
since the CVE-2024-27980 hardening Node refuses to spawn `.cmd`/`.bat` directly
even when named in full. **Fixed** on its own terms — `npx.cmd` plus
`shell: true`, on win32 only, in both copies.

**Cause B — CRLF confirmed as the trigger; the originally documented cause is
refuted.** This entry used to say `packages/frameworks/solid/test/gate.test.ts`
"fails a hash assertion, almost certainly CRLF", and labelled it a guess. It also
cited a line, which T054 dropped: pointing at a specific line was never load-
bearing for a claim that the assertion does not exist. T006 checked it: there
is **no hash assertion**, and the Solid gate is CRLF-**robust** — it detects a
genuine reorder under CRLF and clean-passes clean CRLF, because both sides go
through `formatEmitted`, which hard-codes `endOfLine: 'lf'`. The real fault was
the `S-SH7` row's own mutation: its search literal embedded `\n\t\t`, so on a CRLF
checkout `String.replace` matched nothing, returned the fixture unchanged, and the
row asserted a gate policy against a non-mutant — **passing, and measuring
nothing**. **Fixed twice over:** the pattern now matches `\r?\n` and puts the
file's own separator back, and the mutation goes through a constructor that
**throws** when the search pattern misses. A checked-in calibration reproduces the
CRLF no-op and proves the repaired row still mutates.

**Third cause — the goldens.** All three `packages/compiler/test/goldens/*.json`
bake **AST byte offsets** taken from LF sources, so a CRLF checkout breaks
`enriched-ir.test.ts`'s golden-dump tests. CRLF-ising the goldens does **not**
fix it, and they were deliberately left untouched: their offsets are correct for
the bytes they were built from. The checkout was wrong, not the golden.

**Fourth cause — was a hypothesis, now OBSERVED.**
The `is fresh from the compiler EnrichedIR golden` and
`generated-composition/… is fresh from its composition fixture` cases in
`packages/frameworks/react/test/emitter.test.ts` and
`packages/frameworks/solid/test/emitter.test.ts`
assert `readFile(generated/*.jsx) === emit(ir)` byte-for-byte while
`formatEmitted` hard-codes `endOfLine: 'lf'`, so every freshness assertion should
fail on a CRLF checkout. When this entry was written that was read off the
assertions and **never observed in a Windows log**, and it was labelled an
inference. T009 then read the real cell: **8 failed files / 36 errors before the
`.gitattributes` fix, 2 files after**. The inference is promoted to a finding,
and the arithmetic that used to justify the flag — "the named causes account for
roughly 6 of 35 failures across 4 of 8 files" — **no longer holds**: the ~29
previously unaccounted failures are accounted for by the one CRLF root.

**One root closes B, third and fourth.** The repo had **no `.gitattributes`** —
LF was a house invariant everywhere except at the one place that decides it.
`* text=auto eol=lf` now pins it. `git add --renormalize .` is a verified no-op on
this tree, which is what proves the working copy was already LF and that nothing
was silently rewritten.

**And the invariant no longer relies on itself.**
`packages/compiler/test/package-inventory.test.ts` now enumerates tracked files
and **fails if any tracked text file contains a CR**, using git's own binary
heuristic so it skips exactly what `text=auto` skips. Witnessed: staging a CRLF
file makes it fail by name. On a CRLF checkout it fails first and loudest, which
makes every downstream CRLF failure attributable instead of mysterious.

**Cause A is the one that is not closed.** Every other cause has been observed
fixed on the real cell. `npx.cmd` plus `shell: true` is functionally correct —
the tests pass on Windows now — but it is **timing-marginal**, because routing
through `cmd.exe` adds a shell process to a spawn chain that then resolves and
spawns `vp` again.

**Currently held as:** the Windows matrix cell, still `continue-on-error`. Its
justifying comment has now been corrected **twice**, and both corrections are
recorded rather than quietly applied. The first: the original comment stated a
reason T006 had refuted, and a flag whose stated reason is known-false is
indistinguishable from an unexamined flag at audit. The second (T022): the
arithmetic above is superseded, and the gate the comment stated — "an **observed**
green cell" — is **insufficient**, because **the cell is a coin flip**. Four
post-fix runs went RED, green, RED, green, discriminated **purely** by whether
both `vp fmt` tests beat vitest's 5000 ms default, with nothing in those files
changing between them:

| run       | cell  | react   | solid   |
| --------- | ----- | ------- | ------- |
| `e04b823` | RED   | 6747 ms | 7143 ms |
| `dfa9350` | green | 4139 ms | 4339 ms |
| `0cf937b` | RED   | 5150 ms | 5214 ms |
| `39c8a6d` | green | 4504 ms | 4706 ms |

The best green cleared the bound by **5.9%**; the narrower red missed it by
**3.0%**. At a 2-in-4 flip rate a single green is a sample, not a verdict.

**Removal gate, in two parts and in this order:** (1) the timeout raised **on a
measured basis** — done, both copies now carry 30 s, justified in-file against
the eight samples above; then (2) **three consecutive** green `windows-latest` /
node 24 cells with the two `vp fmt` durations **read out of each log** and
sitting far below the new bound. Three, because under the observed pre-fix
distribution one green had p≈0.5 and three in a row p≈0.125. Reading the
durations is what separates "fixed" from "got lucky thrice" — the last green
looked perfectly healthy and had 6% of headroom.

---

## 4. WebKit exceeds the analyzer's quiescence bound — `findings-005` — **test-suite defect**

**Status:** DIAGNOSED as a harness assumption, and **repaired by T017** — the
settle loop is now bounded on ticks in all three adapters, shipped with a
two-sided calibration. The flag stays; see the removal gate at the foot of this
entry, which is not the one this document used to state.
**Severity: medium.** It is not an engine divergence, but it is load-bearing: the
same loop exists in all three adapters and three more frameworks are about to copy
them.

```
react-browser (webkit)  test/adapter-input.browser.test.ts
  × dispatches analyzer input actions through React controlled inputs
Error: Observable DOM did not quiesce within 500ms
```

**"Only WebKit, only this test" was too narrow, and the narrowness mattered.**
That framing came from the first observation and this entry carried it by showing
one failing test. The **last** observed red — run `30229046866`, sha `3ff85ad`,
read from the job log — failed **two different tests in two different files**,
and `adapter-input` was not either of them:

```
FAIL  react-browser (webkit)  test/action-order.browser.test.ts
  × S3-event-form (order seed 1)                       797ms
FAIL  react-browser (webkit)  test/composition-emitted-smoke.browser.test.ts
  × C2-shared-propagation                              697ms
Error: Observable DOM did not quiesce within 500ms   (x2)
2 failed | 5 passed (7)
```

Same error, same loop, arbitrary victims. That is what a **shared instrument
fault** looks like, and it corroborates the diagnosis below more strongly than a
single repeatable test would have: whichever test happens to be running when
frames are starved is the one that dies. It also means "does `adapter-input`
pass?" was never the right question to ask of this cell.

**The bound measures the wrong quantity, and this is readable in the source
rather than inferred from the failure.** `boundedQuiescence` bounds **wall clock**
over a loop whose progress is gated entirely on `requestAnimationFrame`, and its
`stable >= 2` condition needs **three** rAF deliveries. rAF's contract is
ordering — "before the next repaint" — and carries **no rate guarantee**. A
headless browser that never composites owes no repaint and therefore no callback
on any schedule. So `500` silently encodes a sustained ~4 fps floor that no
specification provides. The copies are byte-equivalent: the `SETTLE LOOP` comment
block above `settleTick` in `packages/frameworks/react/src/adapter.ts`,
`packages/frameworks/solid/src/adapter.ts` and
`packages/frameworks/qwik/src/adapter.ts`.

**Measured, and the measurement could have gone the other way.** Instrumented
across chromium, firefox and webkit: `distinctDomDuringLoop: 1` in all nine runs,
the first snapshot equals the final DOM, `innerHTML` byte-identical across
engines, no change in a further 600 ms. **None of the elapsed time is DOM
settling** — nothing settles, because nothing is pending. macOS WebKit completes
in 44 ms, 11× headroom.

**The decisive tell:** the verbatim CI error reproduces **on Chromium** against
the unmodified adapter once frames are slowed — passes at 240 ms/frame, fails at
260 ms/frame. It is a property of the assumption, not of WebKit.

**"Raise the timeout" is REJECTED, not deferred.** This entry used to offer it as
the good outcome of reading 1. The instrumented evidence removes it: there is no
settle time to raise the bound *to*. Raising 500 to 2000 buys margin against a
symptom while leaving a frame-gated loop under a wall-clock deadline in three
adapters.

**What closes it (T017).** Bound the loop on the quantity it actually consumes —
rAF **ticks**, or a primitive with a delivery contract such as a macrotask turn or
a `MutationObserver` quiet period — keeping wall clock only as a runaway guard, in
**all three** adapters. It must ship with the slow-cadence reproduction written
into the repo as a test that fails before the repair, and a calibration proving
the repaired loop still **throws** on a genuinely non-quiescing DOM. A settle loop
that cannot fail is not a settle loop.

**What is still formally unexcluded:** that the *CI incident* had this cause. The
failing cell is ubuntu headless WebKitGTK, unavailable locally, and the Chromium
cadence experiment is a substitute rather than a reproduction.

**Currently held as:** the WebKit matrix cell, `continue-on-error`, with its
comment repointed at the Phase B audit. The flag is the **adjudicating
instrument**, not an annotation: the T017 repair is self-falsifying there, because
a genuine engine divergence would still fail a tick-bounded loop.

**The removal gate this document used to state is NON-DISCRIMINATING**, and is
corrected rather than quietly replaced. It read: "an observed green webkit cell
**after** T017 lands". T009 traced the cell across 30 CI runs and found it was
**already green for five consecutive runs before T017 landed** (`cd34186`,
`ef59d55`, `72a09de`, `e04b823`, `dfa9350`) with no adapter change at all. A gate
the *unrepaired* adapter passes five times running cannot certify the repair — it
is the same single-sample-as-verdict mistake finding 3's gate made, in a cell
whose greens are even easier to come by.

What those 30 runs *do* show is a mechanism: all eight observed reds cluster in
two windows of rapid concurrent runs, consistent with CPU contention starving
frames. That corroborates the reading above — and it also means a green obtained
in a quiet window is measuring the quiet window. All three post-repair greens are
from quiet windows, so T017's distinguishing signatures (`within 30 settle ticks`
versus `runaway guard`) have **never actually been read**.

**Removal gate:** a green webkit cell observed under the **contention conditions
that produced the reds** — concurrent runs saturating the runner, not an idle one
— so the repaired loop is exercised on the frame cadence the failures came from.
The Firefox cell is a normal required cell — it passes.

---

## 5. Emitted Solid uses `attr:value`, which solid-js's types reject — `findings-002` — **upstream**

**Status:** SETTLED by measurement (T008). `attr:` is **required**; the emitted
output is correct; this is purely solid-js's typing gap.
**Severity: low.** It is a types-only defect in a dependency, already described
locally and correctly.

Emitted `S2.jsx` and `S3.jsx` use `attr:value`, which solid-js's shipped
`InputHTMLAttributes` does not declare. Three type errors, no React equivalent.

**Not a runtime bug.** `pnpm e2e` passes all nine three-way cells and the Solid
browser lane passes 44/44, exercising these exact files.

**The open question was whether `attr:` was necessary at all.** It has now been
measured rather than argued. Scratchpad copies of the emitted `S1`/`S2`/`S3` with
every `attr:value={...}` line **removed** — plain `value` only — were driven
through the repo's own Solid browser lane (real chromium, the analyzer's own
`runScenario`/`compareRuns`). No repo file was changed for the experiment.

**Result: divergent, in every scenario that has an input.**

| comparison                                            | S1        | S2                                     | S3                                     |
| ----------------------------------------------------- | --------- | -------------------------------------- | -------------------------------------- |
| plain-`value` emitted vs the handwritten reference     | identical | **33 DOM divergences**, mount onward   | **13 DOM divergences**, mount onward   |
| plain-`value` emitted vs the shipped `attr:value` emit | identical | **33 DOM divergences**, mount onward   | **13 DOM divergences**, mount onward   |

Every divergence is on the `dom` channel at `attributes.length` of the input
element, and it is present at `mount` and at every subsequent phase — `before`,
`after`, `microtask` and `quiescence` — of every action. A direct DOM probe pins
the mechanism:

```
attr:value   attribute="Beta!"   property="Beta!"
plain value  attribute=null      property="Beta!"
```

With plain `value`, Solid sets the DOM **property** only; the `value`
**attribute** is never written and never tracks the signal. The analyzer
serializes element attributes, so this is not a cosmetic difference — it is
observable state the oracle compares across all three frameworks.

**Therefore:**

- **`attr:` is necessary.** Removing it changes observable output. The emitter
  chose it deliberately, and the emitter is right.
- **The handwritten Solid references use `attr:value` too**, and diverge from
  plain-value output identically. The emitter is reproducing a deliberate house
  idiom, not inventing one — and the idiom is load-bearing, not stylistic.
- **This is solid-js's typing gap.** Solid supports `attr:*` generically at
  runtime; its shipped `InputHTMLAttributes` simply does not admit it.
  `packages/frameworks/solid/test/solid-attr-namespace.d.ts` is therefore
  **correct documentation of real behaviour**, not a suppression, and it stays.
- **The deliverable is an upstream report**, drafted in
  `docs/goals/frameless-defects-and-targets-v1/notes/T008-portability-and-attr.md`
  for the owner to file against solid-js. Nothing has been sent.

**Out of scope, and deliberately so:** changing emitted Solid output. The
measurement says it should not change; if it ever should, that needs its own
package with browser proof.

---

## 6. Whole-IR rename invariant fails generatively — `findings-006` — **test-suite defect**

**Status:** CLOSED. The compiler was never wrong; the invariant was. Instrument
repaired in T008, and the narrowed generative property has been **released**.
**Severity: none for shipped output.** It was a false finding waiting to be filed
against the compiler.

`metamorphic.test.ts` asserted that an equal-length rename of a local changes the
IR's identifier strings and nothing else — through the proxy of **array
position**. Applied generatively, the whole-IR comparison failed as soon as a
program had several locals.

**The invariant contradicted a declared property of the artifact it measured.**
The `records` literal that `buildEnrichedIr` returns, in
`packages/compiler/src/build.ts`, sorts `bindings`, `aliases` and `events` by
`compareText(left.id, right.id)`, and a state binding's id is `state:<name>`. An
alphabetical rename **must** permute them. That is the IR's declared canonical
form, present since `93420a3`. Demanding positional stability of an array whose
position is *defined by* the identifier just renamed is not a property the
compiler ever offered. Field-by-field diffing of the seed-20260726 counterexample
found all 8 differing leaves to be a permutation of `records.bindings`, and a
200-run sweep found zero non-permutation diffs, zero declaration-order changes and
zero cell-wiring changes. Three controls closed the mechanism: a rename that does
*not* move alphabetically produces zero diffs.

**The repair is by CITATION, not by taste.** An order-insensitive view is applied
to a collection only where the exact `packages/compiler/src/build.ts` sort site
keying on a name-derived field can be cited, **and** the permutation has been
witnessed. Every site below is named by its **symbol**, not its line. This table
was written with line numbers, and by the time T054 measured it they had rotted
far enough to be self-refuting: the paragraph under it named a line of
`packages/compiler/src/build.ts` and quoted `const writes = sortWrites(…)` as
what stands there, when that line holds the `buildEnrichedIr` signature. The
quotation was right and the ordinal was wrong, in a single sentence, with nothing
in the prose to tell a reader which half to trust — which is the whole argument
for citing symbols.

| collection                                | cited sort site                                                     | key                                        |
| ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------ |
| `records.bindings`                        | `records` in `buildEnrichedIr` — `.sort(compareText(left.id, …))`    | `id` = `state:<name>` / `computed:<name>`   |
| `records.aliases`                         | `records` in `buildEnrichedIr`, same comparator (ids built by `resolveAliases` as `` `alias:${owner.name}:${alias.name}` ``) | `id` = `alias:<Component>:<aliasName>`      |
| `records.stateReads`                      | `collectCanonicalReads` → `.sort(compareReads)`                      | componentId, graphNodeId, path              |
| `records.stateWrites`                     | `const writes = sortWrites(…)` in `buildEnrichedIr` → `sortWrites`   | componentId, **graphNodeId**, path, …       |
| every `reads` array, any depth            | `deriveReads` → `dedupeReads`                                        | graphNodeId, path, via                      |
| every `writes` array, any depth           | `deriveHandlerEffects` → `sortWrites`, and the same call in `buildEnrichedIr` | as above                          |
| `components[].locals[].semanticRecordIds` | the `semanticRecordIds` build in `enrichComponent`                   | bare `.sort()` over `state:` / `alias:` ids |

**`records.stateWrites` is included on a witnessed permutation, and an earlier
guardrail forbidding it was FALSE.** T006 recorded it as "`writes` unsorted,
authored write order". It is not: `buildEnrichedIr` builds it as
`const writes = sortWrites(…)`.
Obeying that guardrail literally would have reproduced the same false finding from
a second collection. It is included here only because a program with two written
state nodes whose alphabetical order flips under an equal-length rename was
constructed and **watched** to permute it.

**Deliberately excluded — these stay order-sensitive:**

- `records.events` (the third `.sort` in `buildEnrichedIr`'s `records`). It sorts
  by id, but an event id is
  `event:<allocation index>` or `event:<hostNodeId>:<eventName>`; no local rename
  can move either. Probed, order unchanged. Its **nested** reads/writes do permute
  and are covered by the rule above.
- `module.exports` (sorted on `exportedName` in the `module` literal
  `buildEnrichedIr` returns). Keyed on `exportedName`, part of the
  observable contract, which a meaning-preserving rename never touches.
- `records.sharedWrites` (`buildSharedWrites`, ordered on `targetSpan.start`) and
  `events[].handlers` (the `enrichedHandlers` sort in `buildEnrichedIr`, ordered
  on `expression.start` then `expression.end`). Both **span-keyed**, not
  name-keyed.

**The comparison is a multiset of WHOLE ENTRIES**, JSON-canonicalised after
identifier blanking. A whole entry carries its own `sourceSpan`, so a genuine
authored reorder still changes the multiset. That is proved, not asserted: a
calibration swaps two authored writes and requires the comparison to still catch
it.

**The case against the broad fix, stated accurately.** "Recursively sort every
array on both sides" was probed, and it *also* catches the authored write reorder
and a template sibling swap — this IR is span-rich enough that positional
information is largely redundant, so the broad fix does not obviously silence
these calibrations. The reason it is still wrong is different and simpler: it
discards order across the whole artifact to fix seven collections, leaving every
future order-bearing array silently unchecked. The shipped view is **minimal and
cited** — order-insensitivity applies exactly where a `build.ts` line justifies
it, and the comparison is exact everywhere else.

**The third vacuous green, and why the fix would otherwise be calibrated against
nothing.** The fixture-level invariant ran on **one** fixture — `renames` gave s2
and s3 empty lists, which hit `continue` — and that fixture's IR has a single
state binding, so `computed:derived < prop:props < state:count` held before and
after every rename it performed. It could not exhibit this finding under any
circumstances. Three checked-in cases that **can** permute now sit alongside it,
each asserting both that the invariant holds *and* that the old positional
comparison would have failed, so they cannot silently decay the same way.

**The narrowing is released, and not alone.** `generative.test.ts` property 3 had
been narrowed to compare template node **kinds**; it now compares the **whole IR**
under the order-insensitive view — a far stronger property. Its release ships with
a witness counter that fails if the corpus ever stops generating programs where
the positional comparison would have failed. A held expectation is only evidence
for as long as something proves it can still fail.

---

## 7. Interior whitespace in static template text is not neutral across the six activations — **OPEN — frameless's own emitted output**

> **One of two OPEN defects in this ledger that are in frameless's own shipped
> output** — this one and entry 8, which was filed later and is the worse of the
> two. Entries 3, 4 and 6 are test-suite defects, 5 is upstream, 2 is not a
> defect, and 1 is closed. Raised by `frameless-defects-and-targets-v1` (T027
> measured it, T038 ruled on it, T039 landed the repair), so it does **not**
> extend that goal's oracle, which is defined over the six findings above.

**Status:** OPEN, with a **fail-closed v-limit shipped**. The construct is now
refused at the compiler rather than emitted into six lanes and hoped for. The
defect stays open because the underlying non-neutrality is still real — the
refusal contains it, it does not remove it.

**The defect is ours, and it is not that any framework is broken.** We compiled
one IR into six activations without ever asserting that a static text node
survives all six. Each lane's behaviour below is its own framework's documented
default. Nothing here should be filed upstream.

**The measurement.** Each lane probed through its own pinned compiler, inputs
built with `String.fromCharCode` so nothing depends on what a shell did to a
literal. Re-derived by T039 at `6190058`:

| construct                   | react | qwik | svelte | solid          | vue        | angular    |
| --------------------------- | ----- | ---- | ------ | -------------- | ---------- | ---------- |
| `one` U+0020 U+0020 `two`   | keep  | keep | keep   | **condense**   | **condense** | **condense** |
| `one` U+00A0 `two`          | keep  | keep | keep   | **→ U+0020**   | keep       | keep       |

Versions: react-dom 19.2.3, `@qwik.dev/optimizer` 2.1.0-beta.5 (the callable
transform `@qwik.dev/core` 2.0.0-beta.38 loads internally), svelte 5.56.8,
`babel-preset-solid` 1.9.12, `@vue/compiler-sfc` 3.5.40, `@angular/compiler`
22.0.8.

**The second row is the load-bearing one, and it is what T027 did not have.** A
run of spaces splits the six 3–3. A single non-breaking space — one character, no
run at all — splits them **5–1, with Solid alone**, because Solid does not merely
condense runs: it rewrites the **identity** of every Unicode whitespace character
to U+0020. U+00A0 is non-breaking and U+0020 is not, so the author's line-break
guarantee is silently deleted in exactly one lane. Vue and Angular, the two lanes
that *do* condense space runs, both preserve U+00A0 byte-for-byte.

**Why the repair is a refusal and not a normalisation.** "Make the matrix agree"
sounds like the obvious fix and is the destructive one. The only uniform rule
that produces six-way agreement is Solid's `/\s+/g → ' '`, so agreement means
normalising **five** lanes down to the floor of the one, and deleting
non-breaking-space semantics product-wide. The seductive form is a single line in
`normalizeJsxText`, and that is the worst version of all: once the compiler
erases the author's characters, no lane can ever again be measured against the
source, and a reported divergence becomes a permanently undetectable one. That is
the finding-into-silence move this ledger exists to name.

**The repair as shipped.** `assertPortableInteriorWhitespace` in
`packages/compiler/src/build.ts`, called immediately after `normalizeJsxText`, so
the throw carries the source file and the offending value. It rejects a static
text node containing two adjacent whitespace characters or any whitespace
character that is not U+0020. The message names the value and its code points,
states the three-of-six split, and points at the **portable spelling: whitespace
carried as an interpolated value**, which all six lanes preserve and which
`demos/react-official/three-way-contract.ts` already asserts equal across six as
`[ wide  load ]`. It deliberately does **not** suggest `&nbsp;` or U+00A0 —
Solid rewrites those to U+0020, so that advice would be wrong in the one lane it
is meant to protect.

**The compiler is the right layer for the opposite of the obvious reason.**
`normalizeJsxText` maps `\t` to one space **per tab** — a 1:1 character map, not
a condense — so `one\t\ttwo` becomes `one  two`. The compiler was **manufacturing**
the divergent construct, not setting precedent against it. Two authoring paths,
one rule, stated once at the only layer that sees the input to all six lanes.

**Text-node EDGES are deliberately out of scope**, by measurement rather than by
taste: the edge form of the same predicate fires on four live demo texts
(`" open"` in the two `TaskList.tsrx`, `" seats"` in the two `PricingCard.tsrx`),
and the two lanes that cannot express a whitespace edge already guard it
downstream. Attribute values keep interior runs in all three condensing lanes, so
the refusal correctly scopes to text nodes.

**No gate gained a predicate, and that is a ruling rather than a shortcut.** The
Vue gate reads `descriptor.template.ast` and the Angular gate reads
`parseTemplate` under `preserveWhitespaces: false` — **both already condensed**.
`one  two three` reaches both predicates as `one two three`, so widening either
one would not fire; it would need a second parse with preserve options, per lane,
and two of the six lanes have no template parser to hang it on. The Solid gate,
which had no whitespace policy at all, gains the **recorded measurement** its Vue
and Angular siblings carry — an unexplained silence converted into an explained
one, with no predicate.

**The instrument, and why this one needed calibrating more than most.** The rule
fires on **0 of 108** static text nodes across every live `.tsrx` in `demos/`,
`packages/` and `poc/` — re-derived by T039, not inherited. It is a pure guard
that cannot be used to make anything green, which is exactly the shape this
ledger's own closing section says is worthless without a two-sided proof. So it
ships with planted violations that are **shown** red, and with the legal
neighbours of each shown green. Four mutants were killed on the way in: disabling
the guard, dropping either half of the predicate independently, and the forbidden
`\s+ → ' '` condense relocated into `normalizeJsxText`.

**THE LIFT TRIGGER.** The v-limit may be **removed** when, at pinned versions,
all six lanes are measured to render an interior whitespace run **byte-identically**
— in practice when `babel-plugin-jsx-dom-expressions`, `@vue/compiler-sfc` and
`@angular/compiler` all stop condensing, or the three preserving lanes are shown
to have changed. What will notice is the registered cross-lane matrix test in
`packages/compiler/test/enriched-ir.test.ts`, which runs all six lanes' own
compilers and asserts both rows of the table above. **It re-opens this ruling if
any single lane moves in either direction** — a lane that *starts* preserving is
as much a change to the basis as one that starts condensing, and it is the
direction that would let the limit be lifted. The behaviour is asserted; the
versions are recorded and printed on failure rather than asserted, because three
of the six are pinned with a caret and a red on every unrelated patch bump is a
red nobody reads.

**What this entry does not know.** Qwik's row was measured through
`createOptimizer().transformModules`, which is the transform the lane's build
actually runs, and independently end-to-end in a browser by T027 for the space-run
case. The `@qwik.dev/core` `./optimizer` subpath exports only `qwikVite` and
`qwikRollup`; the callable transform lives in `@qwik.dev/optimizer`, resolved
through core's own `node_modules`. T038 recorded the Qwik non-ASCII cell as
**unmeasured**; T039 filled it, and it is **preserve**.

---

## 8. React emitted a nested state write as an assignment to a `const` — **OPEN — frameless's own emitted output**

> **The second OPEN defect in frameless's own shipped output, and the more
> serious of the two.** Entry 7 changes how a space renders. This one emitted
> **invalid TypeScript that silently does nothing at runtime**, in React, on
> `main`, today. Measured by T031 while probing S8, repaired to a **refusal** by
> T044. Like entry 7 it was raised by `frameless-defects-and-targets-v1`, so it
> does **not** extend that goal's oracle, which is defined over findings 1–6.

**Status:** OPEN, with a **fail-closed refusal shipped**. The construct is now
named and rejected at the React emitter. The defect stays open because the
underlying inability to lower a nested write is still real — Solid lowers it
correctly, React refuses it. The refusal contains the miscompile; it does not
remove the gap.

**IT HAS NOTHING TO DO WITH ASYNC.** T031 found it while probing async event
handlers, and that is an accident of where it was standing. It reproduces with a
plain callback prop, no promise anywhere. **The trigger is NESTING**: any state
write inside any function inside a handler — a `.then` continuation, a callback
prop, a side-effecting `forEach`.

**The mechanism, in one line.** `emitMutableHandler` in
`packages/frameworks/react/src/emitter/index.ts` iterates `fn.body.body` — the
**top-level statements** of the handler body. A write anywhere else was never a
candidate for lowering, so it was copied through verbatim, into a scope where the
name it assigns to is the `const` that `useState` destructured.

**The second half is worse than the first.** For a state that *also* has a
top-level write, `toConstSsa` → `replaceVersionReads` rewrote the nested write
**target** as if it were a version **read**, renaming it to the SSA version and
then freezing that version with `const`. The emitter did not merely fail to lower
an assignment; it **manufactured** an assignment to a name it had just made
immutable.

**The measurement.** Re-derived by T044 at `f2d8aaf` with this repo's own
`typescript@5.9.3`, over emitted output, from two independent authorings:

```
nested-then.jsx(16,7): error TS2588: Cannot assign to 'ticks' because it is a constant.
nested-then.jsx(17,7): error TS2588: Cannot assign to 'nextPhase' because it is a constant.
nested-callback.jsx(14,7): error TS2588: Cannot assign to 'ticks' because it is a constant.
```

`nested-then` is `settle().then(() => { ticks = ticks + 1; phase = 'done' })`;
`nested-callback` is `defer(() => { ticks = ticks + 1 })`, which contains no
promise. The `nextPhase` row is the manufactured assignment above. The same
authoring with the writes moved to the **top level** type-checks clean and lowers
to `setTicks(...)`, which is the negative control that makes the two rows mean
something.

**Runtime, not just types.** Under a bundler the assignment either throws in
strict mode or writes a dead local; either way the setter is never called, so
**React never re-renders**. The emitted component looked plausible and did
nothing.

**Why nothing caught it.** Every emitted-output instrument in this repo —
`emitted-typecheck.test.ts` included, which is the one that runs real `tsc` — only
ever sees `packages/frameworks/react/generated/`. **The corpus has never contained
a nested write.** That is the entire reason this survived to `main`: not a weak
instrument, an absent input. It is exactly the class the corpus-breadth phase
exists to surface, and it was surfaced by a scenario that could not land.

**Why the repair is a refusal and not a lowering.** Lowering nested writes
correctly is a design change with a real blast radius — the write must become a
setter call whose value is computed from a snapshot the closure captured, and the
SSA versioning has to follow it across a scope boundary. **Solid already does this
correctly** (`setTicks(ticks() + 1)` inside the same nested arrow), so a later
ruling can port a proven approach rather than invent one under time pressure.
Until then, a loud refusal is strictly better than a silent miscompile, and it is
reversible in a way that a hasty lowering would not be.

**The repair as shipped.** `assertLowerableWrites` in
`packages/frameworks/react/src/emitter/index.ts`, called from
`emitMutableHandler` **before** any renaming, so the diagnostic carries the
**authored** state name rather than an SSA version an author has never seen. It
walks the handler's unresolved references, keeps the ones that are write targets
(including the root of a member chain, so `rows[0].label = x` is covered), and
throws if any of them sits inside a nested function scope. The message names **the
write, the enclosing function** (`the function passed to settle().then(...)`) and
**what would otherwise have happened**, quoting the `TS2588` verbatim — because
the failure mode was silent, and a bare throw teaches nothing.

**The instrument, and its calibration.** This guard fires on **nothing** in the
shipped corpus — proven by re-emitting every ratified scenario golden and every
composition fixture through it in
`packages/frameworks/react/test/emitter.test.ts`, not by inspection — and on
**0 of the 61 tracked `.tsrx` files** in `packages/`, `demos/` and `poc/`, swept
once by hand for the wider reading. A guard that
fires on nothing is not an instrument, so it ships with the two planted
violations above **watched red before the repair**, with their `tsc` output as the
failure text, and with the top-level control watched **green** in the same table.
The standing assertion is the honest invariant that survives the fix: *the emitter
may refuse a construct, and it may emit a construct, but it may never emit a
construct `tsc` rejects.*

**THE LIFT TRIGGER.** The refusal may be **removed** when the React emitter lowers
nested writes correctly, as the Solid emitter already does — that is, when a
nested `ticks = ticks + 1` emits a `setTicks` call over a captured snapshot and
the SSA versioning follows it across the scope boundary. What will notice is the
`nested-then` / `nested-callback` table in
`packages/frameworks/react/test/emitter.test.ts`: its invariant is *refuse or
typecheck*, so a correct lowering turns those rows green **through the other
branch** with no edit here, and the two message tests are the only thing that must
then be deleted deliberately.

**What this entry does not know.** Whether the other five lanes have the same hole
in a form nobody has authored. T031 measured **Solid and Qwik lowering nested
writes correctly** and did not probe Svelte, Vue or Angular on this axis
specifically. **T043 has since measured all three**, and all three lower nested
writes correctly — as do Solid and Qwik, so React is alone at one lane of six
rather than one of two, which strengthens this entry's case that a later ruling
can port a proven approach. Angular carried a **separate, unrelated** silent
defect from the same T031 sweep — an authored `async` handler became a synchronous
method — now ruled by T043 and filed as **entry 9**. **None of this is upstream.**
React supports every construct involved; the defect is entirely in our emitter.

### 8.1 THE REFUSAL HAS A HOLE THE SHAPE OF AN `if` BLOCK — `frameless-real-apps-v1` T002, filed by T006

**The miscompile this entry says is contained is still reachable, and the way in
is a plain `if`.** T002 hit it authoring TodoMVC and worked around it; T006 traced
it to source. It is filed **here rather than as a new entry** because it is the
same defect with the same mechanism and the same emitted symptom — what is new is
that entry 8's own containment does not cover it.

**Two conditions have to line up, and they are checked in different places.**

- **The lowering gap is wider than the refusal.** `emitMutableHandler` iterates
  `fn.body.body`, the handler body's **top-level statements**. Entry 8 above
  describes what escapes that as "a write inside any nested *function*", and that
  is the description that let the hole through. A write inside `if (cond) { … }`
  is not inside a nested function — it is in the **same function**, one block
  down — and it is equally invisible to an iteration over top-level statements.
- **The guard only looks for functions.** `assertLowerableWrites`
  (`packages/frameworks/react/src/emitter/index.ts`) walks from the write up to the
  handler and refuses only if it passes a node in `NESTED_FUNCTION_TYPES` —
  `ArrowFunctionExpression`, `FunctionExpression`, `FunctionDeclaration`,
  `ObjectMethod`, `ClassMethod`. A write inside an `if` passes `BlockStatement` and
  `IfStatement`, neither of which is in that set, so `nested` stays `null` and the
  loop hits `if (!nested) continue;` — **no refusal**.

**So the construct falls between the two: not lowered, and not refused.** It is
copied through verbatim as an assignment to the `const` that `useState`
destructured — the exact `TS2588` output this entry was opened for, arriving
through the door the repair left open. **Svelte, Vue, Angular, Solid and Qwik all
lower it correctly** (T002), which matches entry 8's existing five-lanes-of-six
reading and is a further reason a later ruling can port rather than invent.

**Status of the evidence, stated precisely so it is not over-read.** The
*mechanism* above is read off the emitter source by T006 and is exact — the
`NESTED_FUNCTION_TYPES` set and the `if (!nested) continue;` are quoted from it.
The *emitted symptom* is T002's measurement while authoring S10. **No planted
`if`-nested fixture has been driven through `emitOrRefuse` and pinned**, because
this card records and does not repair. **That is the first measurement a repair
card owes**, and it belongs beside the existing `nested-then` / `nested-callback`
rows in `packages/frameworks/react/test/emitter.test.ts`, whose invariant —
*refuse or typecheck* — is already the right one to hold it to.

**Why nothing caught it, again.** The same reason as entry 8 proper, one axis
over: **no S1–S9 handler writes state inside an `if`**. The guard's own
calibration row asserts it "fires on NOTHING in the shipped corpus", which was
true and stayed true, because the corpus could not exhibit the construct. **S10 is
the first authoring that wanted to** — TodoMVC's Escape-revert and its
commit-on-Enter both want a conditional write — and T002 rewrote every conditional
as an expression to get around it, recording that as a deviation.

**What this does to entry 8's lift trigger:** nothing, and that is the point. The
trigger is still "React lowers a nested state write the way Solid already does",
and a correct lowering closes both forms at once. What changes is the
**containment claim**: entry 8 is contained against nested *functions* only, and
the table below now says so.

---

## 9. Angular silently dropped `async` from an authored event handler — **CLOSED — frameless's own emitted output**

> **The third defect in frameless's own shipped output, and the only one of the
> three whose root cause was a MISSING INSTRUMENT rather than a missing input.**
> Entry 8 survived because the corpus never contained a nested write — a weak
> input through a working oracle. This one survived because **Angular was the only
> lane in this repo that emits TypeScript and typechecks none of it**. Measured by
> T031, re-derived and ruled by T043, repaired by T045. Like entries 7 and 8 it was
> raised by `frameless-defects-and-targets-v1`, so it does **not** extend that
> goal's oracle, which is defined over findings 1–6.

**Status:** CLOSED. The construct is now **lowered**, not refused: an authored
`async` arrow emits an `async` class method returning `Promise<void>`. Angular
supports async event handlers natively, so refusing one would have made this the
only lane unable to express a mainstream construct its own framework supports.

**THERE WERE TWO FAILURE MODES BEHIND ONE BUG, AND ONLY ONE OF THEM WAS EVER
CATCHABLE.** Conflating them is what made this look smaller than it was.

**Mode A — `async` WITH `await`: invalid TypeScript, unchecked.** The `async` was
dropped and the `await` was kept, so the emitted method contained an `await` it
had no right to. Under this repo's own `typescript@5.9.3`:

```
generated/async-with-await.ts: TS1308 'await' expressions are only allowed within
                               async functions and at the top levels of modules.
```

A typecheck oracle catches this the instant it exists — **and this lane did not
have one.** That is the whole reason it shipped.

**Mode B — `async` WITHOUT `await`: valid TypeScript, uncatchable.** The keyword
was dropped and nothing else was wrong. The method returned `void` instead of
`Promise<void>`, every caller that awaited it silently awaited a non-promise, and
the output type-checks **perfectly**. No oracle anywhere — not this repo's, not a
hypothetical perfect one — can see mode B, because nothing about it is a type
error. It is a pure semantic downgrade wearing valid syntax.

**So one instrument was insufficient by construction**, and the repair ships two.
`packages/frameworks/angular/test/emitted-typecheck.test.ts` catches mode A and
carries a standing test pinning its own **blindness** to mode B — green both
before and after the fix, so the gap is stated rather than left for a reader to
infer. `packages/frameworks/angular/test/emitter.test.ts` asserts the **emitted
keyword directly**, which is the only thing in the repo that can see mode B.

**The mechanism, in one line.** The string `async` occurred **zero** times in
`packages/frameworks/angular/src/emitter/index.ts`. Handler methods are built from
a hand-written string template, and `qualify()` transplants the arrow's **body**
into it — so the arrow's modifier had nowhere to go.

**Why nothing caught it — and this is the part that outlives the `async` fix.**
Every other lane that emits code runs a compiler over its emitted output: React
and Solid run real `tsc`, Svelte and Vue run their own framework compilers. Angular
had `parse-emitted.test.ts`, which checks the **template** grammar via
`parseTemplate` and never looks at the class body, and
`packages/frameworks/angular/tsconfig.json` does not `include` `generated/**`, so
`pnpm check` never saw the emitted component either. **The dropped `async` was one
instance of a hole through which any type-invalid Angular emission shipped
silently.** THE INSTRUMENT WAS THE REPAIR; the `async` fix is one thing it catches.

**Why the oracle is a vitest file and not a `tsconfig` include.**
`packages/frameworks/angular` is deliberately free of `@angular/core` — that
absence is the structural guarantee that Vite 7 and Vite 8 never meet in one
package (`test/toolchain.test.ts`, `frameless-angular-v1` T002 ruling 1). Routing
`generated/**` into `pnpm check` would make the lane permanently red on an import
that cannot resolve here by construction, and adding the dependency would trade a
real toolchain guarantee for a convenience. The oracle instead asserts **"no
diagnostic other than `TS2307` for `@angular/*`"** — one expected unresolved
module, per file, matched by **code and module name**, so a mis-emitted relative
import is still red even though it is also a `TS2307`.

**The calibration.** The oracle fires on **nothing** in the shipped corpus — all
seven `generated/S*.ts` are clean apart from that one expected diagnostic — so it
ships with the planted `async` authoring **watched red before the emitter moved**,
with the `TS1308` above as its failure text, and with a **synchronous control**
watched green so that "async is carried" is not vacuously true of every handler.
Three further planted mutations (an undeclared member read, a second unresolved
import, an illegal construct in the class body) prove the lane can fail at all.

**No emitted byte moved.** The shipped corpus contains no async handler, so a
correct repair is **invisible** to it — which is exactly why the planted
calibration is the whole proof, and why the emitter tests now assert that the
corpus really is async-free rather than assuming it.

**Not upstream.** Angular supports async event handlers natively; the defect was
entirely in our emitter.

---

## 10. A dynamic HTML boolean attribute served `disabled="false"` in Angular, which DISABLES the control — **CLOSED — frameless's own emitted output**

> **The fourth defect in frameless's own shipped output, and the only one of the
> four whose root cause was a THREE-NAME LIST.** Entry 8 survived on a missing
> input, entry 9 on a missing instrument; this one survived because the question
> "is this a DOM property?" was answered by a hardcoded allowlist of `value`,
> `checked` and `selected`, and `disabled` is not on it. Measured by T030 (S7),
> ruled by T041, repaired by T049. Like entries 7, 8 and 9 it was raised by
> `frameless-defects-and-targets-v1`, so it does **not** extend that goal's
> oracle, which is defined over findings 1–6.

**Status:** **CLOSED**, by removal and then by a **served payload**. The
construct is lowered rather than refused — an authored `disabled={expr}` reaches
the IR as `kind: 'property'` and Angular emits `[disabled]` — and as of S9 the
corpus **observes the six lanes agreeing at runtime**, which is the one thing
this entry stayed open for.

**What closed it, measured rather than asserted.** `packages/compiler/test/fixtures/s9-boolean-attributes.tsrx`
binds a real dynamic `disabled` at two structurally different sites — a
component-level state cell on the gate button, and a member of the LOOP VARIABLE
on a button inside a keyed repeat — and `pnpm e2e` reports **6 demos × 8
scenarios, all observations equal**. The six `s9` observation strings are
byte-identical. Read off that run:

| reading | react | solid | qwik | svelte | vue | angular |
| --- | --- | --- | --- | --- | --- | --- |
| served payload, gate | absent | absent | absent | absent | absent | absent |
| served payload, field `f2` | absent | absent | absent | absent | absent | absent |
| live, as served | `null` | `null` | `null` | `null` | `null` | `null` |
| live, after lock | `""` | `""` | `""` | `""` | `""` | `""` |
| live, after unlock | `null` | `null` | `null` | `null` | `null` | `null` |
| live, after sealing `f2` (in the repeat) | `""` | `""` | `""` | `""` | `""` | `""` |
| live, `f1` (never sealed) | `null` | `null` | `null` | `null` | `null` | `null` |

**No lane serves the attribute at all in the initial state** — asserted at the
element in the server's own bytes by `forbidServedAttribute`, which calibrates
itself two-sided on every call because a check on an ABSENCE passes by default
on any payload including an empty one. **Removal is asserted as well as
addition**: a lane that wrote the attribute once and never reconciled it passes
every reading up to the unlock click and fails there.

The mutation budget now has something to mutate, which it did not before: one
mutant per lane replaces the binding with a static `disabled="false"` — the exact
byte sequence the defect produced — anchored on a string that occurs **exactly
once** in each lane's emitted output, verified non-vacuous in all six.

**The defect, in three lines.** `disabled={false}` served `disabled="false"` in
Angular where the other five lanes served nothing. `disabled="false"` **disables
the control** — the attribute is boolean, so its *presence* is the signal and its
value is ignored. So the one lane that emitted extra bytes also shipped the
opposite behaviour, silently, on a control the author asked to be **enabled**.

**The mechanism, measured at the pinned versions.** Angular's attribute path
removes an attribute only on nullish and stringifies everything else —
`@angular/core` 22.0.8, `_debug_node-chunk.mjs:5557` guards on `value == null`,
and `renderStringify(false)` is `"false"` (`_pending_tasks-chunk.mjs:483`). That
is correct and intended: it is what an attribute binding *is*. Angular is not
broken, and nothing here is upstream.

**THE CONSTRUCT WAS NEVER UNSPELLABLE. IT WAS MIS-LOWERED.** S7 enumerated three
candidate spellings — `null | true`, `null | ''`, `null | 'disabled'` — and each
diverged across the six. All three vary **what value the author binds**. None
varies **what kind of binding the IR emits**, which is the axis the answer was
on. The IR already had that axis and already used it: `checked` arrived as
`kind: 'property'` and `disabled` as `kind: 'attribute'`. **That one line is why
`checked` did not invert in S7 and `disabled` did.**

**The root cause is a coverage gap in a three-name list, not a portability limit
of six frameworks.** The vendored `@markless/compiler` 0.1.1 decides it with:

```js
function isDomPropertyBindingName(attributeName) {
	return attributeName === "value" || attributeName === "checked" || attributeName === "selected";
}
```

while `@tsrx/core` 0.1.32 — a sibling dependency **in the same tree** — ships a
29-name `DOM_BOOLEAN_ATTRIBUTES`. The knowledge was already here; the classifier
did not consult it.

**The repair as shipped.** `DOM_BOOLEAN_CONTENT_ATTRIBUTES` in
`packages/compiler/src/build.ts`, widening the existing
`target?.kind === 'property'` test at the one site that already post-processes
the vendored classifier's answer. **Not in the Angular emitter**, which carries a
standing ruling that `DynamicBinding.kind` is the IR's answer and the emitter
puts no judgement between it and the emitted form. Whether `disabled` is a DOM
property is a fact about the DOM, not about Angular.

**The name set is a MAINTAINED list, written out rather than imported.**
`@tsrx/core`'s list lives at `@tsrx/core/src/utils/dom.js` — an internal path,
not a public export — so importing it would let a vendored refactor silently move
our IR. Fourteen names ship: `async`, `autofocus`, `autoplay`, `controls`,
`default`, `defer`, `disabled`, `hidden`, `loop`, `multiple`, `open`, `readonly`,
`required`, `reversed`. `value`, `checked` and `selected` are deliberately absent
— they already arrive as `property`, and re-listing them would fork one fact.

**The admission rule, and the two clauses that each caught what the other let
through.** A name ships only if it is an HTML boolean **content** attribute, is
in `@tsrx/core`'s list, has its **lowercase attribute spelling reach the browser
property** (verified against `lib.dom.d.ts`, typescript 5.9.3; Angular's own
`mapPropName` maps exactly one member, `readonly` → `readOnly`), **and** is
reflected back to the attribute by Angular's own server DOM (the domino bundled
in `@angular/platform-server` 22.0.8).

The sharpest pair is `nomodule` and `seamless`. **Domino reflects both**, so a
measurement taken only against Angular's server DOM would have admitted them —
and neither is a browser property at all (`noModule` is the real spelling;
`seamless` was removed from HTML). Angular's `isPropertyValid` returns `true`
when `Node` is undefined, so those two would have **passed SSR and thrown in the
browser**. In the other direction `inert`, `muted` and `webkitdirectory` are real
browser properties that domino does **not** implement, so admitting them would
have had SSR omit an attribute the client then sets. `indeterminate` is refused
for a third reason: it is a property with no content attribute at all.

**The value axis, after the repair.** Angular's property path and react-dom
19.2.3 agree on every value — `true`/`'false'`/`'x'`/`1` present the attribute,
`false`/`null`/`undefined`/`''`/`0` omit it — including the four values the
corpus does not reach. The lowering does not approximate the other five lanes; it
reproduces React's table exactly. React independently agrees the old output was
wrong, warning on precisely the byte sequence Angular produced: *"Received the
string `false` for the boolean attribute `disabled`."*

**Blast radius: measured, and zero.** The only boolean content attribute bound
anywhere in the golden corpus is `checked`, already `property`; every other
dynamic binding is `data-*`, `aria-*` or `value`. Only two emitters read
`binding.kind` at all — Angular, and Solid, whose branch also requires
`name === 'value'`. **That claim is falsifiable in one command** and was run:
all six lanes regenerated, then `git diff --exit-code` over the seven goldens and
all six `generated/` directories. Empty. Had it not been, the ruling this repair
rests on would have been refuted rather than adjusted.

**The costs, named rather than waved past.**

1. **Angular gains a dev-mode validity check where it had none.**
   `isPropertyValid` accepts a property binding when `propName in element`, and
   `'disabled' in <p>` is **`false`** — so `disabled={x}` on a `<p>` now raises
   *"Can't bind to 'disabled'"* where `[attr.disabled]` accepted it silently.
   Mostly a gain, since it catches a real author error, but it is a **new
   Angular-only hard failure**, and per the clause above it can pass on the
   server and fail in the browser. SSR green does not mean the lane is green.
2. **`hidden="until-found"` becomes inexpressible** through this path: the
   property coerces to boolean, so the string form is lost in all six lanes.
   Narrow, but real — it is the one value where `hidden` is not a boolean.
3. **The set is maintained by hand** and must be copied rather than imported.

**The instruments, and both of their calibrations.** The corpus cannot catch this
— no fixture binds a boolean attribute, so the mutation budget has nothing to
mutate — and registering one would enlist every lane's derived inventories at
once. So the proof is probe sources plus two registered matrices:
`packages/compiler/test/enriched-ir.test.ts` registers 33 names against the kind
each lowers to, and `packages/frameworks/angular/test/emitter.test.ts` asserts
the emitted form and hands it to `@angular/compiler`'s own `parseTemplate` to
read the `BindingType` **Angular** assigns. **Both matrices were watched red in
both directions**: removing `disabled` from the set flips the row to `attribute`
and the emitted form back to `[attr.disabled]`, and adding `inert` to it flips
that row to `property` — so neither a careless deletion nor a careless addition
can pass.

**`aria-disabled` is correct in S7 and wrong as advice.** S7 substituted
`aria-disabled` for the construct this entry repairs, and that substitution is
**ratified** — it is portable in all six and it kept the axis asserted rather
than dropped. It is not guidance. `aria-disabled="true"` changes **nothing**
about a control: it stays focusable, stays in the tab order, and still submits.
An author who substitutes it for `disabled` ships a control that screen-reader
users are *told* is off and can still activate — worse than the divergence it
replaces, and it lands hardest on the users the attribute exists for. It is right
only when you deliberately want a focusable-but-inert control **and** you
suppress the behaviour in the handler yourself.

**Close trigger — MET.** It read: "a corpus scenario binds a real dynamic
`disabled`, and the six-lane observation string asserts the transition *absent* →
`disabled=""` equal in all six lanes, with a mutation on that binding proven red
per emitter." S9 is that scenario. The first two conjuncts are **measured** and
recorded in the table above. The third — the per-emitter mutation proven red — is
**registered but not yet witnessed**: the six mutants exist in
`scripts/corpus-mutation.mjs` with verified single-occurrence anchors, and
`pnpm mutate:corpus` restores with `git checkout --` over `MUTATION_SURFACE`, so
it is run by the sole writer after commit rather than by the card that wrote the
mutants. **If any of the six survives, this entry re-opens on that lane.**

**A NAME THIS SCENARIO MEASURED OUT OF THE PORTABLE SET, recorded because it was
found rather than predicted.** S9 originally bound `hidden` as a second name in
the class, on a different tag, to show the class behaving as a class. It was
measured **RED IN THE QWIK LANE**: after the lock click five lanes serve
`hidden=""` and qwik serves `hidden="true"`. The cause is in Qwik's own table —
`@qwik.dev/core`'s `isBooleanAttr` lists 21 names **including `disabled` and
excluding `hidden`** — so it minimizes one and stringifies the other. The element
is still hidden either way, so this is a **serialization** divergence and not a
behavioural one: it is the class T041 §2.3 named, where a spelling diverges in
bytes while every lane does the right thing. It is **not** an upstream matter and
must not be filed as one — Qwik's table is Qwik's own, and it is this repo's
oracle that asserts bytes. The fixture now binds `required` instead, which is
present in qwik's, vue's and svelte's boolean tables and canonical lowercase in
React, and which measured green in all six.

So the admitted set of fourteen now has **four names measured non-portable
through some lane** — `readonly`, `autofocus` and `autoplay` through React, and
`hidden` through Qwik — none of which the compiler's admission rule can see,
because that rule asks what the DOM accepts and not what each lane's serializer
does. That is the standing gap, and it is carded rather than left here.

**Lift / re-open trigger.** The registered matrices report in **either**
direction. If a future edit narrows or widens the set they go red; if Angular
ever stops classifying `[x]` and `[attr.x]` differently, the arbiter test goes red
at the version bump instead of memory doing so.

**Two questions belong to `frameless-emitter-capability-v1`, and neither blocks
this repair:** whether the IR should carry a first-class third kind
(`boolean-attribute`) rather than overloading `property` — which would give
`hidden="until-found"` somewhere to live — and `isDomPropertyBindingName`'s
three-name allowlist as an observation about the vendored dependency. It is the
owner's own package, so that is a note, not a report.

---

## 11. Solid refused **every** async event handler, through an undocumented bare throw — **CLOSED — frameless's own emitted output**

> **The fifth defect in frameless's own shipped output, and the only one of the
> five that was never a decision at all.** Entry 8 survived on a missing input,
> entry 9 on a missing instrument, entry 10 on a three-name allowlist. This one
> survived because a **shape assertion copied from sixty lines earlier** was read
> by three later readings as a deliberate v-limit — including by this board's own
> T031, which built an impossibility proof on it. Measured by T031, re-derived and
> ruled an accident by T043, repaired by T046. Like entries 7–10 it was raised by
> `frameless-defects-and-targets-v1`, so it does **not** extend that goal's
> oracle, which is defined over findings 1–6.
>
> **Numbering note.** T043 §7 reserved entry 10 for this and entry 11 for React.
> Entry 10 was taken first by the boolean-attribute repair (T041/T049), so this is
> **11** and the React `await` defect will be **12**. The reservation is stale;
> the ledger is not.

**Status:** CLOSED. `packages/frameworks/solid/src/emitter/index.ts` now reads
`if (!t.isArrowFunctionExpression(fn))`. **No v-limit replaces it**, because there
was nothing to limit: Solid supports async listeners natively, and the lane's
lowering pipeline was already async-safe before the clause was written.

**THE WITNESSED RED, verbatim.** On the re-specified S8 authoring — an `await` on
a promise-*valued* prop, which clears Angular's globals v-limit and Qwik's
callback-statement rule, both of which are **correct** and untouched here:

```
EventHandlerRecord event:0 requires a synchronous arrow
```

Thrown from `validateEnrichedIr(ir)` and again from `emit(ir)`, identically with
and without a leading `event.preventDefault()`. The IR *built* fine both times;
only Solid refused it.

**Four independent lines say ACCIDENT, and all four were re-derived at the
repair**, not inherited from the ruling:

1. **Provenance.** `git blame` puts the line in `1309b00`, whose own message is
   *"t006: solid emitter + dossier gate (codex killed at ceiling; PM completing)"*
   — original-landing code from a session that ran out of budget and was finished
   by hand.
2. **No reachable justification.** The string `requires a synchronous arrow`
   occurred **exactly once** in tracked code, at the throw, with no comment, no
   dossier reference, **no test** and no documentation. Every v-limit in this repo
   that survived scrutiny — Angular's globals rule, Qwik's callback rule, entry
   7's whitespace limit — carries a comment stating its cost.
3. **It is a copy.** Earlier in the same `validateEnrichedIr`, the **computed
   binding** check reads
   `!t.isArrowFunctionExpression(fn) || fn.async || fn.params.length !== 0`, and
   there async genuinely is unsupported — the same function refuses async state
   constructs outright, throwing
   `Unsupported async state construct in <kind> binding <id>`. The handler check
   is that predicate with
   the arity clause dropped — which is itself the tell, since a handler
   legitimately takes an `event` parameter and a computed does not. A shape
   assertion that travelled, not a decision that was taken.
4. **The pipeline behind it was already async-safe.** `reanalyzeExpression`
   prints `const __framelessExpression = <the arrow itself>` and
   re-analyzes; it wraps **nothing**, so an async arrow re-parses as valid module
   source. `normalizeHandler` mutates the arrow in place, so `fn.async` survives
   to output untouched. Contrast React, whose re-parse primitive fabricates a
   *synchronous* wrapper — that is a real bug and it is entry 12's.

**THE IRONY WORTH KEEPING.** Solid is the lane that lowers **nested** writes
correctly — it is entry 8's reference implementation, the thing React is being
asked to port. So Solid was right about the half React gets wrong, and refused the
half React allows. The nested-write lowering was **not touched** by this repair.

**The proof this repair had to produce, and did.** T043 argued the path was sound
from the re-parse primitive and from in-place mutation, and said plainly that it
**could not prove the end-to-end path without editing the validator**. That proof
is this entry's, and it is behavioural, not structural. The emitted handler:

```jsx
onClick={async (event) => {
	event.preventDefault();
	setPhase('pending');
	await props.ready;
	setTicks(ticks() + 1);
	setPhase('done');
	props.onTrace('run', { phase: 'done' }, event);
}}
```

The `async` survives, the prop read lowers to `props.ready`, and — the load-bearing
part — the post-await write is `setTicks(ticks() + 1)`, which reads the **live
signal at resume**, not a value captured before the boundary.

`packages/frameworks/solid/test/emitter.test.ts` lifts that arrow back out of the
emitted JSX **by AST**, rebuilds it over real `createSignal`s from solid-js, and
**dispatches it three times: twice while the first call is still suspended at the
`await`, then once sequentially.** Three increments, `ticks() === 3`, `phase ===
'done'`, and `preventDefault()` observed three times. A single dispatch would have
passed under either lowering and asserted nothing.

**The calibration, because a green test is evidence only if something proves it
can go red.** The same harness is run against a hand-written **stale** variant —
React's `toConstSsa` shape, `const nextTicks = ticks() + 1` hoisted **above** the
await — and it reports `2`, not `3`. The instrument distinguishes a live read from
a captured one, and it is registered saying so. A second calibration guards the
substrate: this suite runs under `environment: 'node'`, where a bare `solid-js`
import resolves to the **SSR** build whose signals are inert; the test loads the
client build by path and **proves** it did, via a `createMemo` that returns 10 on
the client build and 2 on the server build. Loading the wrong one would have left
the whole proof green and blind.

**No fixture and no golden were registered.** The scenario inventories are derived
from `goldens/s<n>-*.json`, so a golden alone enlists a scenario into every lane's
gates at once. This is a **probe source**, per entry 7's precedent. Consequently
**no emitted byte moved**: `regenerate.ts` reproduces `generated/` exactly, which
is also the falsifier for the claim that widening the gate cannot regress the
shipped corpus.

**Not upstream.** Solid supports async event handlers natively; the refusal was
entirely ours.

**What this did NOT close, WHEN IT WAS WRITTEN.** The re-specified S8 was not yet
in the corpus, so no **served payload** had ever observed an async handler in
Solid — the proof was at the emitter and in a node harness over the real client
runtime, not in a browser. **S8 landed at T004 and closed it**: `pnpm e2e` runs
this lane's emitted async output in Chromium and its row is byte-identical to the
other five. See 12.4. It also does
not touch entry 12: React's `await` failure is a different mechanism in a
different lane, and T043's prediction that the two lanes **diverge on a second
dispatch across an await** was half-measured here — Solid's half is above, and it
is the half that comes back **clean**. **The other half has since been measured
and it does not** (entry 12.2): the prediction holds, the divergence is real, and
the row above is the reference the React lane is measured against.

---

## 12. The React emitter could not emit **any** handler containing `await`, and the repair uncovered two more defects behind it — **CLOSED — frameless's own emitted output**

> **The sixth defect in frameless's own shipped output, and the first one whose
> repair made the *real* defect visible rather than closing it.** Entry 11's
> sibling in the Solid lane came back clean. This one did not. The syntax half was
> fixed and proven first; **two behavioural halves stayed open for a phase**, and
> they were found only because the syntax fix made them measurable at all. Raised
> by `frameless-defects-and-targets-v1` (T031 measured, T043 ruled, T047 repaired
> and measured), so it does **not** extend that goal's oracle, which is defined
> over findings 1–6. Closed by `frameless-async-and-defects-v1` T003.
>
> **Numbering note.** T043 §7 reserved entry 11 for this defect. Entry 10 was
> taken by the boolean-attribute repair and entry 11 by the Solid one, so this is
> **12**. The reservation is stale; the ledger is not.

**Status:** CLOSED. `12.1` closed the syntax half at T047. `12.2` — the two
behavioural halves — is **closed at T003**, on a witnessed before-and-after
measurement in the only lane the defect reaches, with the calibration arm held
fixed as the control. One boundary the repair does **not** cross is recorded as a
**v-limit** in 12.2, with its triggering authoring and a registered test.

**The lane count is measured, not inherited.** Both mechanisms are **React
alone**. `toConstSsa` — the named cause of (b) — appears four times in the React
emitter and **zero** times in the other five. A live six-lane emit of the probe
below (T002) confirms it end to end: Solid, Qwik, Svelte, Vue and Angular all keep
the pre-await write and read live at resume, and Qwik's `preventDefault` variant
splits correctly into `sync$` + `$(async)`. **There is no lane limit on this
axis**, which is a stronger result than "four of six broken" in either direction.

### 12.1 The syntax half — CLOSED

**THE WITNESSED RED, verbatim**, on the re-specified S8 authoring (an `await` on
a promise-*valued* prop, authored around Angular's globals v-limit and Qwik's
callback-statement rule, both of which are **correct** and untouched):

```
yuku-analyzer rejected emitted handler: 'await' is reserved in an async/module
context and cannot be used as an identifier; Expected a semicolon or an implicit
semicolon after a statement, but found 'ready'
    at reanalyzeFunction   (react/src/emitter/index.ts:150)
    at replaceFreeNames    (react/src/emitter/index.ts:167)
    at replaceVersionReads (react/src/emitter/index.ts:1951)
    at toConstSsa          (react/src/emitter/index.ts:2050)
```

Identical with and without a leading `event.preventDefault()`. **Unlike entry 11,
`validateEnrichedIr` did not refuse it** — the IR built and validated fine, and
only `emit` threw. The refusal was not a rule anyone wrote; it was a **scratch
arrow**.

`replaceFreeNames` wraps a statement in a throwaway arrow purely to get scope
analysis out of `reanalyzeFunction`, splices the transformed node back out, and
discards the wrapper. **The wrapper was synchronous**, so any `await` inside
re-parsed in non-async context, where `await` is a reserved identifier. Measured
against the same `yuku-analyzer` the emitter uses:

```
wrapper async=false: diagnostics=2  unresolved=[]
wrapper async=true:  diagnostics=0  unresolved=[phase,ready]
```

**Read the `unresolved=[]` twice.** Had that diagnostic ever been suppressed
rather than fixed, free-name replacement would have silently done **nothing** —
so the throw must stay loud, and the repair is the flag, not the message.

The fix is one assignment, `fn.async = true`, at that one call site. It is set at
the call site rather than in `estree.ts`'s `arrowFunctionExpression` because this
is the only wrapper that is **thrown away**; every other arrow that helper builds
is real output whose `async` must stay `false`. It cannot change existing output:
`reanalyzeFunction` analyzes under `sourceType: 'module'`, where `await` is
**already** reserved as an identifier, so nothing that parses today parses
differently under an async wrapper. The falsifier is cheap and was run —
`regenerate.ts` reproduces `generated/` byte-for-byte.

### 12.2 THE MEASUREMENT T043 COULD NOT TAKE — it came back **REAL**, and it is now **CLOSED**

T043 predicted, from the *shape* of `toConstSsa`, that React reads the **render
closure** where Solid reads the **live signal**, and that the two lanes therefore
diverge on a **second dispatch across an `await`** — a prediction it could not
test without making this repair, and which is why the re-specified S8's
behavioural contract requires **two** dispatches rather than one.

**It is not inferred here. It was run**, against real `react-dom` 19.2.3, on the
handler lifted back out of the emitted JSX by AST, with the identical
three-dispatch sequence the Solid lane uses — two dispatches overlapping at the
`await`, then one sequential from the newest render's closure:

|                       | react RED (before T003) | react GREEN (after T003) | solid (entry 11, measured) |
| --------------------- | ----------------------- | ------------------------ | -------------------------- |
| while both suspended  | `0\|idle`               | `0\|pending`             | `0\|pending`               |
| after the overlap     | `1\|done`               | `2\|done`                | `2\|done`                  |
| after the third click | `2\|done`               | `3\|done`                | `3\|done`                  |
| renders observed      | 3                       | 4                        | 4                          |

The emitted React handler, **before**:

```jsx
onClick={async (event) => {
	await ready;
	const nextTicks = ticks + 1;
	setTicks(nextTicks);
	const nextPhase = 'done';
	setPhase(nextPhase);
	onTrace('run', { phase: 'done' }, event);
}}
```

and **after**:

```jsx
onClick={async (event) => {
	const nextPhase = 'pending';
	setPhase(nextPhase);
	await ready;
	setTicks((currentTicks) => currentTicks + 1);
	const nextPhase2 = 'done';
	setPhase(nextPhase2);
	onTrace('run', { phase: 'done' }, event);
}}
```

**(a) STALE CLOSURE — the predicted defect, confirmed.** `ticks` is the `useState`
binding of the render that created the handler. Two dispatches that overlap at the
`await` both compute `0 + 1`, so **two clicks produce one increment**. The
authored source is `ticks = ticks + 1`, which every other lane lowers to a read at
resume. React alone reads a value fixed at handler-creation time.

**(b) DROPPED PRE-AWAIT WRITE — not predicted, and found by the same run.** The
authored `phase = 'pending'` is **absent from the output entirely**. `toConstSsa`
keeps only the final write per cell, which is sound when nothing can render in
between and is **not** sound across an `await`. React renders 3 times where the
live shape renders 4, and `pending` is never observable. **This one is arguably
worse than (a)**: (a) loses a count under a double click, while (b) makes a
pending state that the author wrote unrenderable under **any** interaction.

**The instrument, and both of its calibrations.**
`packages/frameworks/react/test/emitter.test.ts` rebuilds the emitted component
body exactly — the same prop destructuring, the same two `useState` calls, in the
same order — renders it with `react-dom/client`, and dispatches the lifted arrow.
The suite runs under `environment: 'node'` and no DOM implementation is a declared
dependency in this workspace, so the container is a minimal hand-rolled DOM used
**only** to let React reconcile and commit; React's event system is never used and
nothing re-implements a hook.

- **The harness can report the clean numbers.** The same harness, the same
  dispatch sequence, over a hand-written live-reading handler — React's own
  idiomatic answer, `setTicks((current) => current + 1)`, with the pre-await write
  left in place — reports **exactly Solid's row**: `0|pending`, then 2, then 3. So
  the numbers above are a property of the emitted code, not of the instrument.
- **The runtime can fail.** A module-level guard renders a counter and drives it
  through a **captured** closure and then a **fresh** one, asserting `0,1,1,2`. If
  the minimal DOM ever stopped carrying real commits, every measurement would
  report the initial state forever and the whole proof would be a **green vacuum**;
  the guard throws at load instead. This is the React analogue of entry 11's
  `createMemo` check, and it exists for the same reason.

**These tests pinned the DEFECT, not the desired behaviour.** This entry said, in
writing, that on repair they must go red and be **rewritten to the calibration's
numbers**. T003 did exactly that, and the rewrite is compliance with this
paragraph rather than a moved goalpost. That is why the instruction was written
here in the first place: a ledger entry whose test agrees with the bug is the only
kind that reports the day it stops being true.

### 12.2.R The repair — T003

Both mechanisms live in `toConstSsa`, and both are gated on the **suspension
boundary** rather than on anything else, which is what makes the repair
byte-neutral.

**(b) SEGMENTED SYNC RETENTION.** The "retain only the final sync per cell" filter
now keys on `(segment, cell)` rather than on `cell`, where a new segment opens
after every statement that can suspend the handler. Collapsing to one sync is
still applied — to the interval it is actually true of. A new `suspends()` helper
answers the boundary question, and it stops at every nested function type
(`assertLowerableWrites`'s set), because an `await` inside a callback belongs to
that callback's suspension and not to this handler's.

**(a) FUNCTIONAL UPDATER.** `liftPostAwaitReadsToUpdaters` folds a post-suspension
version const and its sync into `setTicks((currentTicks) => currentTicks + 1)`
when — and only when — the version's initializer freely reads **the render binding
of the cell it is writing**, the version is read nowhere else, the initializer
does not itself suspend, the cell is `state`-storage, and the cell carries no
persistence record. The parameter name comes from the emitter's own allocator, so
it cannot collide with an authored name. This is React's own documented answer to
(a) and it is the same shape the calibration arm has always used.

**BYTE-NEUTRALITY IS THE FALSIFIER, AND IT WAS RUN.** No corpus fixture contains
`await` and no generated artifact in any tier contains `async`, so a repair gated
on the boundary must move **zero** generated bytes. All three tiers were
regenerated — six `regenerate.ts`, six `regenerate-composition.ts`, and
`generated-persistence/P1` in the React and Solid lanes, which has no script and is
written only by `UPDATE_GOLDENS=1` — and the regeneration was **proved real before
the diff was read**: all 80 artifacts' mtimes moved, and a planted marker in one
artifact per tier was restored by the run. `git diff` over `generated*/` is then
empty. A vacuous green here would have been indistinguishable from a real one.

**THE V-LIMIT, RECORDED RATHER THAN ENGINEERED AROUND.** A functional updater
receives **one** cell's value, so a post-`await` read of a cell **other than** the
one being written cannot be repaired this way. Triggering authoring:

```jsx
onClick={async (event) => {
	await ready;
	ticks = ticks + 1;
	mirror = ticks + 1;   // reads `ticks` — a second live cell
}}
```

The fold declines on both writes here (the first because its version is read again,
the second because it reads a different cell), and the emitted output keeps the
const-SSA form. Three narrower shapes are out of reach for the same reason: a
post-`await` read that is not part of a write at all, a version whose own
initializer suspends (an updater callback cannot be `async`), and a **persisted**
cell, whose sync argument is re-read by `persistenceStatements` as a *value*. All
four are **emittable and behaviourally stale**, not refused — closing them needs a
ref mirror or a reducer over a record, which is a design change, not a bigger
updater. `V-LIMIT, MEASURED: a post-await read of ANOTHER cell still reads the
closure` in the React emitter suite pins the boundary and goes red the day it
moves.

**THE CALIBRATION ARM DID NOT MOVE, AND THAT IS THE POINT.** The hand-written
live-reading handler is the harness's control, and it was left **byte-untouched**
across this repair. It reports `0|pending` / 2 / 3 before and after. Both arms now
report the same row over two different handlers — one emitted, one hand-written —
so the row is a property of the lowering. Had the calibration moved, the instrument
would have moved and the emitted arm's green would have meant nothing.

### 12.3 What this means for S8, and what it is not

**S8 must assert the divergence rather than hide it.** A single-dispatch
assertion passes under both lowerings and asserts nothing about the axis it exists
to test; the two-dispatch contract T043 specified is not a precaution but a
measured requirement. With 12.2 closed, **S8's React row is now expected to equal
every other lane's** — `0|pending`, then 2, then 3 — and the two-dispatch shape is
what makes that equality mean anything. **Hiding it behind a one-click assertion
would make the second dispatch meaningless.**

**And S8's action button must carry a TEXT CHILD.** The probe as first authored
used a self-closing `<button ... />`, and the **Svelte emitter refuses it**: `did
not compile warning-free: a11y_consider_explicit_label`. Nobody saw it because the
probe had only ever been run through React. With a label, all six lanes emit
cleanly. Measured by T002; recorded here because it would otherwise block S8 at
the Svelte lane for a reason that has nothing to do with async.

**This is not entry 8.** Entry 8 is React's inability to lower a **nested** state
write, and it stays OPEN with its own lift trigger; `assertLowerableWrites` was
**not touched** here. Every write in this probe is at the **top level** of the
handler body — that is precisely why the re-specified S8 uses `async`/`await`
rather than a continuation — so 12.2 is a *third* React lowering defect, not a
restatement of that one. The overlap is only that both are answered by porting
what five other emitters already do.

**Not upstream.** React supports async event handlers natively, and the functional
updater in the calibration is React's own documented answer to (a). Both halves of
12.2 are ours.

**No fixture and no golden were registered**, per entry 7's precedent — the
inventories are derived from `goldens/s<n>-*.json`, so a golden alone enlists a
scenario into every lane's gates. Consequently **no emitted byte moved**.

**And no served payload** — WHEN THIS WAS WRITTEN. Closed by 12.4.

### 12.4 S8 HAS LANDED, and the served payload closes the last residue — T004

**Six browsers have now run a frameless-emitted async handler**, which is the one
thing entries 10, 11 and 12 all said they were missing. `s8-async-handlers.tsrx`
is in the corpus, `pnpm e2e` reports **6 demos x 9 scenarios, all observations
equal**, and the six S8 mutants are RED in `pnpm mutate:corpus` at a budget of
**54 cells**.

The row every lane records, verbatim and byte-identical across all six:

```
server-rendered ticks = 0 with phase = idle and cancels = 0
after one run over a resolved gate ticks = 1 with phase = done
while two dispatches are suspended at the await ticks = 1 with phase = pending
after releasing the gate the two overlapping dispatches left ticks = 3 with phase = done
after a fourth run from the newest render ticks = 4 with phase = done
after cancel-run 1 document request served this page and cancels = 1
```

**Both of 12.2's mechanisms have a served red site now, and they are different
readings.** The React mutant is not invented: it is the pre-T003 emitted output
restored verbatim, and it fails at THREE of the five readings — `phase` reads
`idle` where `pending` is required while the dispatches are suspended (mechanism
b), ticks reads 2 rather than 3 after the release (mechanism a), and 3 rather
than 4 after the fourth dispatch.

**12.3's two-dispatch requirement was satisfiable, and its OVERLAP half was NOT
satisfiable the way it was written.** 12.3 says the arm must drive two dispatches
that overlap at the `await`. It can, in all six lanes — but only because the
promise is armed by a CLICK. Two facts about `@qwik.dev/core` 2.0.0-beta.38,
measured by T004: its SSR serializer resolves a promise by AWAITING it
(`await Promise.race(this.$promises$)` in a loop), so a gate that is pending when
the server renders hangs that lane outright, and a timer gate is serialized
RESOLVED so the client has no window at all. Neither is a defect — a pending
promise with a live resolver is by construction not serializable, and that is
what resumability is. The `/s8` page in every lane therefore serves an
already-resolved gate and arms a pending one client-side.

**And the pre-await write is observable at exactly one site, which is why the
gate is held rather than timed.** Mechanism (b) leaves no trace after the fact:
the post-await write to the same cell lands either way, so a final-state reading
passes under both lowerings. The only observation that separates them is a render
taken WHILE the handler is suspended. A timer would have made that a race.

---

## 14. Emitted Angular never re-rendered a state write made AFTER an `await` — **CLOSED — frameless's own emitted output**

> **The sixth defect in frameless's own shipped output, and the first found by a
> SERVED PAYLOAD rather than by a compiler, a type-checker or a unit test.** It
> was invisible to every instrument this repo had, and it was invisible for a
> structural reason: nothing in the corpus contained an `await` until S8, and no
> instrument except a browser renders anything.

**THE WITNESSED RED, verbatim.** Driving `/s8` in `demos/angular-official`, after
the release click:

```
expected '[data-async="ticks"]' to have text "3", but it was "1"
  (page http://127.0.0.1:5173/s8, waited 5000ms)
```

**And the diagnosis was measured rather than inferred.** The same run was repeated
with ONE extra click on an unrelated harness control inserted after the release,
and the reading became `3` immediately — then failed one step later at `expected
"4", but it was "3"`, the same fault one dispatch downstream. So both continuations
had run and both writes had landed: **the state was correct and the DOM was
stale.**

**The cause.** Angular 22 scaffolds are zoneless, and this lane holds component
state in PLAIN CLASS FIELDS. That works for a synchronous handler for exactly one
reason: invoking a template `(click)` listener notifies the change-detection
scheduler itself, so whatever the listener wrote is picked up by the tick that
follows. An `await` ends that. The continuation runs after the listener has
returned, nothing notifies anything, and no tick is scheduled.

**The repair — `notifyAfterSuspension` in the Angular emitter.** A class with an
async handler injects `ChangeDetectorRef` and every suspension segment after the
first ends with `this.changeDetector.markForCheck()`, which under zoneless
Angular notifies the scheduler rather than merely flagging a view. The first
segment is deliberately not notified: the listener's own notification covers it.

**ZERO generated bytes moved.** The insertion is gated on `handler.isAsync`, and
S8 is the only scenario in the corpus with an async handler, so the other eight
scenarios and both composition tiers are byte-identical across three
proven-real regeneration tiers.

**What this deliberately is NOT.** The other answer is to lower every cell to an
Angular signal, which notifies on write wherever the write happens and would make
the pass unnecessary. That is a re-lowering of the whole lane and an architecture
decision; it is recorded here as the alternative and not taken. The narrow one is
correct at the corpus's authorings and moves nothing else.

**Two forms entered `BASELINE_FORM_INVENTORY`** with recorded floors —
`@angular/core#ChangeDetectorRef` at 2.0 and `@angular/core#inject` at 14.0, both
below this lane's 19.0 standalone floor, so `ANGULAR_BASELINE_FLOOR` did not
move. The gate refused the emitted output until they were entered, which is that
inventory working exactly as designed.

> **These two are the on-the-record precedent a later ruling leaned on.** A
> third form, `component-metadata:imports`, entered the same inventory the same
> way for **S14** (the recursion scenario) at floor **14.0**, evidence
> `unverified`, again below 19.0 and again leaving `ANGULAR_BASELINE_FLOOR`
> unmoved — measured 19.0 before and 19.0 after. **The difference worth knowing**
> is that S14's admission is the one case where the inventory's own "it cannot
> see what a form MEANS" caveat bites hardest: Angular 22.0.8 compiles the module
> **identically with and without** the entry, so no static layer in this repo can
> witness it. That lane was proven in a **browser**. Ruled by
> `frameless-app-axes-v1` T009, landed by T014.

**Not upstream.** Angular supports async event handlers natively and documents
`markForCheck()` as the notification channel for code that is not signal-based.
The defect was entirely ours.

**The residue is honest and it is named.** `notifyAfterSuspension` does not
descend into nested functions: a state write inside a `.then` callback or a
`setTimeout` in an Angular handler would still land unrendered. No authoring in
the corpus produces one — entry 8 is the React twin of the same nesting question
— and the pass says so at its own definition rather than claiming more than it
does.

---

## 13. Four of the fourteen admitted boolean attribute names are NON-PORTABLE, and the admission rule could not see it — **OPEN — frameless's own emitted output**

> **The fifth defect in frameless's own shipped output, and the first whose root
> cause is an ADMISSION RULE rather than a lowering.** Entry 10's repair is
> correct and stays CLOSED: a dynamic boolean attribute really does reach the IR
> as `kind: 'property'`, and S9 really does observe six lanes agreeing. What was
> never established is that the *fourteen names* that repair admits are
> interchangeable. Four of them are not. Found by T050 (one name) and T051 (the
> rest), which measured all fourteen in all six lanes.

**Status:** **OPEN.** Three of the four are **repaired** (react's `jsxName`); two
are **contained** — excluded from `LANE_PORTABLE_BOOLEAN_ATTRIBUTES`, which no
fixture may bind — and **cannot be repaired from this repo's emitters at all**.
The entry stays open because containment is not removal.

**The defect, in three lines.** `DOM_BOOLEAN_CONTENT_ATTRIBUTES` admits fourteen
names on a four-clause rule in which **every clause asks what the browser DOM
accepts**. Whether each of the six lanes' *serializers* accepts them was never
asked. Four names pass all four clauses, lower correctly, emit valid-**looking**
output in all six lanes, and are then silently dropped or mis-serialized.

**THE FULL 14 × 6 MATRIX, MEASURED BY EXECUTING EACH LANE.** Every cell is
`getAttribute(name)` in the **true** state / the **false** state, on the element
that defines the property. `""` / `null` is agreement.

| name | react | solid | vue | svelte | qwik | angular |
| --- | --- | --- | --- | --- | --- | --- |
| `async` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `autofocus` | **`null` / `null`** | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `autoplay` | **`null` / `null`** | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `controls` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `default` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `defer` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `disabled` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `hidden` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | **`"true"` / `null`** | `""` / `null` |
| `loop` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `multiple` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `open` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `readonly` | **`null` / `null`** | `""` / `null` | `""` / `null` | `""` / `null` | **`"true"` / `null`** | `""` / `null` |
| `required` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |
| `reversed` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` | `""` / `null` |

**Four names, FIVE cells — `readonly` fails through two lanes, by two unrelated
mechanisms.** That is the fact that decides the repair.

**Bare `disabled` and `disabled=""` are NOT a divergence, and reading bytes would
have said they were.** react and svelte serve `disabled=""`; solid and vue serve
a bare `disabled`; all four read `""`. `measureBooleans` in the three-way
contract states the standard in as many words — the claim is "about the state the
six lanes end up in, not about which API each one used to get there". A
byte-level matrix would report **ten** false divergences and bury the four real
ones.

**The mechanisms, read from each lane's own source.**

- **react** (`react-dom` 19.2.3) — `autofocus`, `autoplay` and `readonly` are not
  react props. React serves **nothing in both states** and raises
  `console.error: Invalid DOM property \`readonly\`. Did you mean \`readOnly\`?`.
  It raises it **once per prop name per process, on whichever render comes
  first, in either state** — which is worth stating precisely, because measuring
  it in a single process reports the second state as silent and makes the warning
  look state-dependent. It is not.
- **qwik** (`@qwik.dev/core` 2.0.0-beta.38) — its client patch consults its own
  `isBooleanAttr` to choose between `element[key] = parseBoolean(v)` and
  `directSetAttribute(element, key, v)`, and the latter stringifies `true`.
  `isBooleanAttr` is `<a 24-name list> && key in element`, and **the two failing
  names fail different halves of that conjunction**: `hidden` is the only one of
  the fourteen missing from the list, while `readonly` is *on* the list and fails
  `key in element`, because the DOM property is `readOnly`. Qwik's SSR path has no
  boolean table at all and serves all fourteen identically; the divergence is
  activation-side only.

**NEITHER IS UPSTREAM.** React supports all three under `autoFocus`/`autoPlay`/
`readOnly`, so the react half is **our emitter's defect**. Qwik's attribute table
is Qwik's own and is internally consistent — a framework is not defective for
behaviour inside its own design envelope, and nothing here was filed against it.

**Why the admission rule could not see any of this.** Clause 3 required the
lowercase spelling to reach the browser DOM property — **"either because they are
identical, or because Angular's own `mapPropName` maps it"**. That second half is
the hole. `mapPropName` is an **Angular runtime** fact; it can only ever establish
that *Angular* reaches the property, and the set is read as if it were
lane-neutral. `readonly` is the only name that clause ever admitted, and
`readonly` is now the name that fails through two lanes. Clauses 1–4 caught
`nomodule` and `seamless` by asking whether the **DOM** would accept them; nobody
asked whether each **lane** would.

**The repair as shipped, and the two options that were REFUSED on measurement.**

- **Refused — removal from the admitted set.** Only the Angular emitter branches
  on `kind` (solid does too, but guarded by `name === 'value'`), so removal is an
  **Angular-only** change: it cannot alter what react or qwik serve and therefore
  repairs nothing. What it *would* do is send Angular back down `[attr.name]`,
  where domino gives `<div hidden="false">` **with `.hidden === true`** — entry
  10's own inversion, reintroduced into the one lane that is currently correct.
  Strictly worse, and measured rather than argued.
- **Refused — a casing map as the whole answer.** It repairs react and cannot
  touch qwik, which has no alternative spelling to map. **The qwik rows are the
  proof this was never a React special case.**
- **Shipped.** (a) The casing map in react's `jsxName`, which is where `class` →
  `className` and `for` → `htmlFor` already lived — so the claim that no emitter
  in this repo carried a casing map was false. (b) **Clause 3 amended** to drop
  the `mapPropName` escape hatch as a portability argument, and **clause 5 added**:
  every lane's own serializer, executed, must agree in both states. (c) A second,
  explicitly per-lane set, `LANE_PORTABLE_BOOLEAN_ATTRIBUTES` — twelve names —
  because one set was answering two different questions.

**The instruments, and their calibration.** `packages/compiler/test/enriched-ir.test.ts`
executes **four** of the six lanes' serializers — react, solid, vue and svelte —
where the predecessor recorded that "react-dom is the one lane whose serializer is
callable from this package"; that was inherited, not measured. Qwik is measured at
its deciding function, extracted from its shipped bundle, and the extraction
**throws a named diagnostic rather than returning an empty list** if the shape
moves. Angular is measured at its own `DomElementSchemaRegistry`. The react map is
asserted **equal to the set react-dom actually rejects**, executed — so a react
release that renames a prop moves the map or goes red. Watched red in **both**
directions on both sets, and on the qwik extraction, before being reported green.

**What is NOT proven.** No served payload observes any of this: S9 binds
`disabled` and `required`, both portable, and registering a fixture for a
non-portable name is precisely what the portable set forbids. Qwik's row is
derived from its own source and from T050's real-build e2e measurement of
`hidden`, not from a standalone qwik render — its SSR renderer refuses to run
without a real client build manifest, and hand-rolling one is a trap this repo has
already paid for. **And the react repair is not clean in bytes:** react lowercases
`autoFocus` on the way out but writes `autoPlay` and `readOnly` to the payload
**camelCase**, which the live-DOM oracle cannot see and which
`startTagCarriesAttribute` — a case-sensitive read of served bytes — would. Today
S9 reads served bytes only in the false state, where every lane is absent. That
cost is registered as a test, not as a promise.

---

## 15. A two-word DOM event name is UNSPELLABLE IN REACT, and its emitted binding silently never fires — THE OTHER FIVE LANES BIND BY DOM EVENT NAME AND DO FIRE — **OPEN — frameless's own emitted output**

> **Found by building a real application** — `frameless-real-apps-v1` T002,
> authoring TodoMVC — and filed by T006. The casing is destroyed in the
> **compiler**, before any emitter sees it, so all six lanes are downstream of the
> same loss — but **only one of them is damaged by it**, and the original title
> said all six.

> **AMENDED BY `frameless-app-axes-v1` T011, ON MEASUREMENT — the scope was wrong
> and it was expensive.** This entry was filed off `onKeyDown` in **react** and
> generalised to *"in all six lanes"* without the other five being measured.
> `frameless-app-axes-v1` T005 measured them and **refuted it**; T011 reproduced
> the emitter half and the react half here. **This is the same react-only
> over-generalisation entry 12.2 carried**, and it is corrected the same way: the
> original reading is kept below, marked, rather than erased.
>
> **What the unamended title cost.** It has been quoted as a hard six-lane blocker
> on **five task cards across two boards** plus both of their charters —
> `frameless-app-suite-v1` T002, T004, T006 and T999, and `frameless-app-axes-v1`
> T005. It is why the **Codex clone shipped with no keyboard at all** (that
> receipt's own words: *"the app actually lost the keyboard entirely"*), and why
> the drag card was written expecting a refusal it never got. A scope error in a
> ledger title is not a typo; it removes features nobody ever measured as blocked.

**Status:** OPEN, **and not contained** — there is no refusal in front of it. The
`/^on[A-Z]/` guard **accepts** the spelling and then destroys it, so the binding
**is** produced. Ranked above entries 7 and 13 by this document's own rule (how
wrong the shipped output is) and filed last only because it was found last, which
is the convention entry 8 already set.

**The mechanism, in one line — unchanged, and it was never the wrong half.**
`jsxEventName` in `packages/compiler/src/build.ts`:

```ts
if (!/^on[A-Z]/.test(name)) return null;
return name.slice(2).toLowerCase();
```

The guard requires a capital — so `onKeyDown` is *accepted* — and then
`.toLowerCase()` flattens `KeyDown` to `keydown`. **The word boundary is gone from
the IR and no emitter can recover it**, because nothing downstream records where
the capital was.

**WHAT THE ENTRY MISSED: `keydown` IS THE REAL DOM EVENT NAME.** Almost every DOM
event name is already all-lowercase — `keydown`, `keyup`, `dblclick`, `dragover`,
`dragstart`, `dragend`, `drop`, `pointerdown`, `mouseover`, `focusin`. For those,
`.toLowerCase()` is **lossless with respect to the DOM** and destructive only with
respect to a **framework's camelCase prop table**. Exactly one lane binds by a
framework prop table.

**THE PER-LANE TABLE. Question (1) — what does the emitter print? — was asked of
the REAL emitters on a probe module by T005 and REPRODUCED INDEPENDENTLY by T011.
Question (2) — does it fire? — was asked in chromium.**

| lane | authored `onKeyDown` prints | binds by | (2) FIRES? | measured on |
| --- | --- | --- | --- | --- |
| **react** | `onKeydown` | **the framework prop name** | **NO — inert, and React warns** | `keydown` + `dblclick`, T011 |
| solid | `onKeydown` | the flattened name, via `addEventListener` | **YES** | the five drag/pointer names, T005 |
| qwik | `onKeydown$` | the flattened name | **YES** | the five drag/pointer names, T005 |
| svelte | `onkeydown` | the all-lowercase DOM event name | **YES** | the five drag/pointer names, T005 |
| vue | `@keydown` | the flattened name | **YES** | the five drag/pointer names, T005 |
| angular | `(keydown)` | the flattened name | **YES (synthetic)** | the five drag/pointer names, T005 |

**WHAT IS MEASURED HERE AND WHAT IS INFERRED, stated rather than blurred.**
T005 drove `dragstart`, `dragover`, `drop`, `dragend` and `pointerdown` — not
`keydown` — in six real browsers, in two arms, and **FOUR LANES COMPLETED AN
END-TO-END HTML5 DRAG WITH A REAL MOUSE** (solid, qwik, svelte, vue); angular
fired all five synthetically while that probe page produced no native drag at all,
which T005 recorded as unresolved rather than settled.

> **AMENDED AGAIN BY `frameless-app-fidelity-v1` T008, ON A SHIPPED PAGE — IT IS
> FIVE LANES, AND ANGULAR IS SETTLED.** T005's four is a **probe-page** number and
> its angular row was **unresolved, not negative**. Re-measured at HEAD on the
> **shipped** `/board` (`S16`), with a real native mouse drag — mouse down, twenty
> interpolated moves, mouse up, **no synthetic `DragEvent`** — at 1600×1000, run
> twice through all six lanes: card `t1` leaves `backlog`, lands in `todo` **and is
> still there 1.4 s later** in **solid, qwik, svelte, vue AND ANGULAR**.
> `[draggable="true"]` is **9 in all six lanes**, so react is not missing the
> attribute — it is missing the listener, and its card never reaches
> `data-dragging="yes"` while react-dom logs *"Invalid event handler property
> `onDragstart` / `onDragend` / `onDragover`"*. **The reading can fail:** the
> identical gesture released over the sidebar, which is not a drop zone, moves
> nothing in **all six**. The `◀`/`▶` arrows move a card in **all six** and are how
> react moves one.
>
> **One qwik drop in sixteen was lost**, on the first drop from a fresh page — the
> recorded qwik lane limit, whose mechanism is **still unresolved** and which
> belongs to qwik's own resumability envelope, not upstream. **15 of 16 landed**,
> across two full six-lane runs and eleven dedicated qwik arms, half of them with
> a mid-drag DOM read and half without, which **refutes** the obvious guess that
> the instrument caused it. The five-lane claim is stated with that reading
> attached rather than averaged away.

T011 reproduced the emitter
half for `keydown` in all six lanes and the runtime half **for react only**. That
the other five fire `keydown` **specifically** is therefore an **inference**, from
a binding path that is indifferent to which name it is handed and from `keydown`
being a real DOM event name exactly as `dragover` is. It is a strong inference and
it is still an inference: **five lanes × `keydown` in a browser is unrun.**

**Five lanes get the correct listener BY ACCIDENT OF THE SAME BUG**: the string
the compiler flattened to is the string those lanes were going to bind with
anyway.

**The react row, re-measured by T011 in chromium rather than inherited.** Real
key presses and a real double click against `react-dom@19.2.3`, with two
plain-DOM controls on the same page:

```
onKeyDown       (react's own spelling)     2 hits
onKeydown       (WHAT THIS COMPILER EMITS) 0 hits
onDoubleClick   (react's own spelling)     1 hit
onDoubleclick   (from authored onDoubleClick) 0 hits
onDblclick      (from authored onDblClick)    0 hits
CONTROL  addEventListener('keydown')       2 hits   <- what solid/vue/angular reduce to
CONTROL  onkeydown content attribute       2 hits   <- what svelte reduces to
```

React says so itself, in its own console, while nothing in this repo listens:

```
Invalid event handler property `onKeydown`. Did you mean `onKeyDown`?
Invalid event handler property `onDoubleclick`. Did you mean `onDoubleClick`?
Invalid event handler property `onDblclick`. Did you mean `onDoubleClick`?
```

**WHAT IS STILL SIX-LANE FATAL, AND IT IS A NARROWER SET.** The binding is dead
everywhere when the **flattened string is not a real DOM event name**. Authoring
`onDoubleClick` lowers to `doubleclick`, which is not an event in any lane;
authoring `onDblClick` lowers to `dblclick`, which is the real event and fires in
all five DOM-name lanes. React additionally cannot reach `onDoubleClick` from
either spelling — the DOM's `dblclick` and React's `onDoubleClick` share no stem,
so **no capitalisation rule can bridge them**. That is why a repair needs a
**per-lane spelling map** and not a smarter capitaliser, and it is unchanged by
this amendment.

**THE KEYBOARD, CORRECTED — this is the consequence that cost the most.** The
Codex clone shipped **no keyboard at all** on the reading that `onKeyDown` is
unspellable everywhere. **It is spellable in all six**, and the emitter half below
was measured by T011 through the real emitters, per lane and per host, with a
single-word `onClick` beside it as the control. The runtime half carries the
provenance stated above — react measured, the other five inferred:

- **svelte, vue and angular: spellable and FREE.** They do not typecheck emitted
  templates, so a `keydown` binding costs the `pnpm check` budget nothing.
- **qwik: spellable and FREE.** `onKeydown$` is accepted by qwik's own JSX types
  and its handler parameter is contextually typed — **zero** `error TS` lines.
- **solid: spellable, at +2 `error TS` lines per binding** — one `TS2322` for the
  unknown prop on that host and one `TS7006` for the parameter that can no longer
  be contextually typed. Against a fixed 267 budget that is the real constraint,
  and it is a budget question, not a capability one.
- **react: spellable, and INERT.** The one lane where the loss is fatal, and the
  only one measured in a browser on `keydown` itself.

**A keyboard-carrying application is therefore blocked in ONE lane, not six** —
and the first card to want one owes the five-lane × `keydown` browser run that
this entry has not done.

**And svelte's refusals are about the ELEMENT, not the event.** Svelte is the only
lane that refuses anything here, and what it refuses is an interaction on a host
that a11y rules disallow — measured by T011 across the (element × interaction)
grid, `<div>` refuses both drag and keyboard as
`a11y_no_static_element_interactions`; `<li>` **accepts drag** and **refuses
keyboard** as `a11y_no_noninteractive_element_interactions`; **`<button>` and
`<textarea>` accept both cleanly.** A `keydown` on a `<textarea>` — which is
exactly the Codex clone's Enter-to-send host — emits warning-free in all six
lanes.

**It also costs `pnpm check`, and the cost is react and solid only.** T002
recorded a single `onKeyDown` binding taking the inherited count **267 → 272**
across three lanes. Re-measured by T011 on one binding on one host: **react +2,
solid +2, qwik 0**. The `TS7006` half disappears for a single-word event, because
a known prop types its own parameter — which is why the corpus never saw this.

**What it cost the deliverable, and the ONE-SOURCE constraint that is easy to
overstate in the other direction.** TodoMVC's **Escape-revert** was dropped and
shipped as an explicit cancel control instead. In **react** that was correct and
remains correct — and because this corpus authors **one** `.tsrx` and emits it six
ways, authoring the handler anyway would make **react silently wrong** while five
lanes worked, which is worse than absence and is a real reason to keep it out of a
**six-lane** fixture. **That is not the same claim as "unspellable in all six",
and the difference is a whole feature.** An application that does not ship the
react lane, or that ships it with a labelled limitation the way this board already
labels absences on the page itself, could have had the keyboard — the Codex clone,
which angular already refused, is exactly that case. That is the cost of this
entry's scope error, and it is the strongest argument for amending a ledger title
rather than only its body.

**Why nothing caught it.** **All three events in the S1–S9 corpus are
single-word** (`click`, `input`, `change`), for which `.toLowerCase()` is the
identity and the defect is invisible. No served payload had ever carried a
two-word event name until S10 tried to. This is the same shape as entry 8: **not a
weak instrument, an absent input.** And nothing caught the **scope** error for the
same reason in reverse: the one lane the entry was filed from is the one lane it
is true of.

**What a repair owes, and it is not just the map.** The `/^on[A-Z]/` guard
currently **accepts** a name it cannot represent. Whatever the map does, the
compiler should stop silently accepting a spelling it is about to destroy — a
refusal here would have surfaced this on the day `onKeyDown` was first authored,
which is the standard entry 8's repair already set. **A repair also has a cheaper
lower bound than this entry implied**: react is the only lane needing a mapped
name at all, and `pnpm check` would fall by two lines per binding in react and
solid if the emitted prop were spelled the way each lane's own types declare it.

---

## 16. The todo title is a `<button>` where canonical TodoMVC has a `<label>` — **NOT A DEFECT — adjudicated by T006**

Raised by `frameless-real-apps-v1` T007 while styling the six TodoMVC sites, and
recorded here because the ledger keeps adjudications that came back negative
(entry 2 is the precedent). **This is a lane limit plus a stylesheet assumption,
not an emitter defect.**

**What was observed.** The emitted markup carries
`<button className="todo-title">` where `todomvc-app-css@2.4.3` hangs the title
gutter, the strikethrough (its `.todo-list li.completed label` rule) and the round
toggle circle (its `.todo-list li .toggle + label` background rule, drawn on the
label because `.toggle` is `opacity: 0`) off
**`label` selectors**. Three of the five things the PM had named to the owner as
"the TodoMVC look" were exactly the ones that would have been missing.

**Why it is not an emitter defect.** The emitter is **not unable to print a
`<label>`**. T002 recorded the actual cause: the **Svelte gate refuses** the
canonical markup as `a11y_label_has_associated_control`, and refuses the `<span>`
alternative as `a11y_no_static_element_interactions`. Both refusals are
**correct** — canonical TodoMVC's clickable `<label>` with no associated control
is a genuine accessibility anti-pattern, and Svelte is right to say so. Ruling
this a defect would mean asking an emitter to reproduce an upstream anti-pattern
because a stylesheet assumed it.

**Disposition.** No emitter change. T007 repaired the rendering in a **separate,
clearly-marked supplement** (`demos/shared/todomvc-app-css/frameless-supplement.css`)
without touching the vendored upstream bytes, which is the right layer: the
markup is defensible and the stylesheet's `label` assumption is the thing that
does not transfer.

**What would re-open it.** Evidence that the emitter cannot print a `<label>` for
a reason **other** than an a11y refusal — that would be a real expressiveness gap
rather than a rule working as designed.

---

## 17. A static attribute is lowered as a STRING, and each lane's own JSX types decide whether that typechecks — the rule is PER LANE, NOT per DOM type — **OPEN — frameless's own emitted output**

> **Filed by `frameless-app-axes-v1` T011, which was sent to WIDEN this rule and
> instead had to NARROW it.** It has been carried in fixture headers and board
> `stop_if` clauses for three cards without ever being written down here, and each
> restatement was wider than the measurement under it. T003 recorded *"cannot
> spell a static NUMERIC attribute"* from `rows="6"` failing **react's** emitted
> typecheck. T005 widened that to *"no static attribute whose DOM type is not
> `string`"* from `draggable="true"` failing **qwik's**. T006 measured a three-lane
> table and read it as confirming T005. **T011 re-measured it one attribute per
> emitted module and the DOM-type formulation is refuted in both directions.**

**Status:** OPEN, **and contained only by hand** — the containment is fixture
constraints and board `stop_if` clauses, which is to say by authors remembering.
No emitter refuses it, and the compiler has no per-lane type knowledge to refuse
it with.

**The mechanism.** `StaticAttribute` in `packages/compiler/src/schema.ts` is
`{ name: string; value: string | true }`. A **valued** static attribute therefore
reaches every emitter as a **string**, and no lane's declared JSX prop type is
consulted anywhere. Three lanes typecheck their emitted output — react, solid and
qwik — so the whole `pnpm check` budget lives in those three; svelte, vue and
angular do not typecheck templates and contribute **0** to every row below.

**THE MEASUREMENT. One attribute, one emitted module, per lane, through the REAL
emitters, typechecked against THAT LANE'S OWN JSX types.** One module per
attribute matters: a probe that puts many attributes on one host gets **one**
excess-property diagnostic for the whole host and undercounts the rest.

| static attribute, as authored | DOM IDL type | react | solid | qwik |
| --- | --- | --- | --- | --- |
| `id="probe"` · `title="t"` · `data-*="0"` | string | 0 | 0 | 0 |
| **`draggable="true"`** (on `div`, `li`, `button`) | **boolean** | **0** | **0** | **+1** |
| `rows="6"` · `cols="20"` | number | **+1** | **0** | **+1** |
| `maxlength="10"` · `tabindex="0"` | number | **+1** | **0** | **+1** |
| `spellcheck="true"` · `readonly="true"` | boolean | +1 | +1 | +1 |
| `hidden="true"` · `contenteditable="true"` | boolean / enum | +1 | +1 | +1 |
| `autocomplete="off"` | **string** | **+1** | 0 | 0 |
| `autoComplete="off"` | **string** | 0 | **+1** | **+1** |

**THE TWO CELLS THAT KILL THE "DOM TYPE" FORMULATION.** `draggable` has DOM type
`boolean` and is **free in react and solid**; `autocomplete` has DOM type `string`
and **costs react**. The predicate is not the DOM type. It is **the lane's own
declared JSX prop entry for that exact spelling — its name and its type.**

**Why the DOM-type reading looked right, and it is a lane-shaped illusion.**
`@qwik.dev/core` derives element attribute types **from the DOM interfaces
themselves** — `HTMLElementAttrs extends HTMLAttributesBase, FilterBase<HTMLElement>`,
where `FilterBase` is a mapped type over the DOM interface — so for qwik, and for
qwik alone, **the DOM IDL type IS the declared prop type**. React's and solid's
tables are hand-written and deliberately admit the string forms: `@types/react`
declares `draggable?: Booleanish`, where `Booleanish = boolean | "true" | "false"`.
T005 measured `draggable` in **the one lane where the DOM type is the rule** and
generalised from it — the same shape as entry 15's react-only over-generalisation,
one board later, in the other direction.

**AND THERE IS NO SPELLING OF `draggable` THAT IS FREE IN ALL THREE LANES.** The
three JSX emitters disagree on how to print a **valueless** static attribute:

```
authored  draggable="true"   react  draggable="true"   solid  draggable="true"  qwik  draggable="true"
authored  draggable          react  draggable=""       solid  draggable         qwik  draggable
```

so the cost simply **moves**:

| authored | react | solid | qwik |
| --- | --- | --- | --- |
| `draggable="true"` | 0 | 0 | **+1** |
| `draggable` (valueless) | **+1** (`""` is not `Booleanish`) | 0 | 0 |

This is T006's `autocomplete` / `autoComplete` finding — *no spelling of it is
free in both* — repeated on **value presence** instead of on **casing**. Two
independent axes, same consequence.

**THE OPERATIONAL RULE, stated as narrowly as it was measured.** A static
attribute is safe to author **only if every typechecked lane's own JSX prop table
admits a string under that exact spelling.** `id`, `title`, `for`, `name`,
`placeholder`, `pattern`, `role`, `aria-*`, `data-*`, `min`, `max`, `step` and
`inputMode` are measured free in all three (T006). Everything else is measured
per lane or is unmeasured — and *unmeasured* is not *free*.

**An unreconciled reading, recorded rather than smoothed.** T006's table has qwik
at **0** for `autoComplete` (camel); T011 measures **+1**, with qwik's own
diagnostic naming `autocomplete` as the member it expected. The likeliest cause is
the one-host undercount described above, but that is a hypothesis and the two
readings are left standing side by side. Nothing in this entry rests on that cell.

**What this entry does NOT rule.** Whether the repair belongs in the compiler
(carry the authored value's kind into the IR), in each emitter (consult a per-lane
attribute table, which is entry 15's spelling-map problem again), or nowhere at
all (keep it an authoring constraint and give it a refusal instead of a
convention). That is a design ruling this entry deliberately does not take.

**What would close it.** An emitted static attribute that cannot typecheck in a
lane being **refused at authoring time** rather than reaching that lane's `tsc` —
the same standard entries 8 and 15 already set, and the same reason: a constraint
enforced by remembering is not contained.

---

## 18. Emitted Solid persisted the WRONG value, and for a handler-only cell no value at all — **CLOSED — frameless's own emitted output**

> **Half of this was filed by `frameless-app-axes-v1` T007 and could not be
> witnessed in a browser, because there was no way to author persistence at all.**
> T016 opened the authoring channel and BOTH halves became reproducible from a
> `.tsrx` and measurable in chromium. React gets both right; Solid got both wrong.
> Neither is a lane property of Solid — both are `appendPersistenceWrites` in
> `packages/frameworks/solid/src/emitter/index.ts`.

**Status:** CLOSED — **removed, not contained.** Both arms are witnessed in a
browser, before and after, on the same served bytes.

**HOLE 1 — A HANDLER-ONLY PERSISTED CELL NEVER WROTE BACK, AND NOTHING REFUSED.**
A binding no render site reads is not `visible`, so Solid lowers it to a plain
`let` and its write stays an `AssignmentExpression`. `appendPersistenceWrites`
matched only an `ExpressionStatement` whose expression is a `CallExpression` with
an `Identifier` callee — the signal setter — so the plain-`let` write **never
matched**. `validatePersistenceCorrelation` accepted the record anyway; it asks
only that a `kind: 'state'` binding of that name exists. The cell therefore had a
seed path and **no write path**, silently.

**HOLE 2 — A SIGNAL WROTE THE OPPOSITE VALUE ON ANY SELF-READING SET, and this
one was found at T016.** The write-through **cloned the setter's argument
expression** and re-evaluated it **after** the set. For the ordinary toggle
`filter = filter === 'all' ? 'done' : 'all'` that emitted

```js
setFilter(filter() === 'all' ? 'done' : 'all');
__framelessWrite('markless:filter', 'data-markless-filter', filter() === 'all' ? 'done' : 'all');
```

and the second ternary reads the value the first one just committed, so it
evaluates to the **opposite**. The same clone also **double-evaluates** any
argument with a side effect. `generated-persistence/P1` could not see either hole:
until T016 it persisted `draft`, a render-read signal set from
`event.currentTarget.value` — a value that neither reads the cell nor has a side
effect. **The single artifact exercising the feature was, by construction, blind
to both.**

**THE BROWSER MEASUREMENT.** Same authored `.tsrx`, same generated pre-paint
script (`contentSha256` `1a9f39a2…`), same chromium, one emitter change between
the two rows: type `SURVIVE-ME`, click `cycle`, **reload**.

| | `markless:filter` in storage | screen after the click | `markless:touches` | after RELOAD |
| --- | --- | --- | --- | --- |
| **Solid, before** | `"all"` | `done` | **absent** | `all` — **FORGOT** |
| **Solid, after** | `"done"` | `done` | `"1"` | `done` — **SURVIVED** |
| **React, both** | `"done"` | `done` | `"1"` | `done` — SURVIVED |

The "before" row is the owner's own complaint reproduced *inside the feature meant
to fix it*: the page forgot on reload **even though localStorage was non-empty**,
because the value in it was wrong.

**The repair.** The signal arm reads the accessor — after `setX(v)`, `x()` **is**
`v` — which is correct, cheaper, and makes the signal arm agree with the store and
plain-`let` arms that already read the binding by name. A plain-`let` arm handles
`AssignmentExpression` and `UpdateExpression` targets, guarded against a handler
that declares its own binding of that name.

**What reports a regression.** The two `test/emitter.test.ts` files carry a
**cross-lane pair** that names each other and requires **both** lanes to report
**one** `__framelessWrite` for the handler-only cell; they disagreed for the whole
life of the feature. The Solid half also asserts the write-through argument is
`filter()` and **not** a re-printed ternary.

**What this does NOT close.** A handler-only record still has
`seed.lowering: 'none'`, so `generatePrePaintPersistenceScript` **excludes** it and
the cell starts at its authored initial after a reload. It is write-only by
contract (`reason: 'no-render-read'`), and nothing on screen depends on it, but
the write is only useful to a future render read.

---

## 19. The Svelte emitter printed a useless mustache, and upstream reported it to nobody for the whole life of the composition tier — **CLOSED — frameless's own emitted output**

> **Measured by `frameless-app-axes-v1` T015, which was forbidden to touch an
> emitter; fixed by T018.** This entry is filed for **one lane** — svelte — and
> the other five were run before that scope was written down, per the standing
> rule entry 15 bought.

**Status:** CLOSED — **removed, not contained**, and the rule was never silenced.

**WHAT IT WAS.** `renderComponentReference` in
`packages/frameworks/svelte/src/emitter/index.ts` sent every component prop
through `printExpression`, so the authored `<Panel label="Composed">` came back
out as `label={'Composed'}`. `eslint-plugin-svelte`'s
`svelte/no-useless-mustaches` reported *"Unexpected mustache interpolation with a
string literal value"* on `generated-composition/M2-page.svelte` from the day the
file was committed.

**WHY NOBODY HEARD IT, AND THIS IS THE PART WORTH KEEPING.** The rule lives in
**one instrument in this repository**: the svelte gate's own programmatic ESLint
(`packages/frameworks/svelte/src/gate/index.ts`). Until T015, no test in the
package had ever pointed that gate at `generated-composition/`. And the obvious
place to look for a lint finding **cannot see it at any strength**: `pnpm lint` is
oxlint over 93 rules and does not carry the rule at all. MEASURED, with the defect
planted back into the artifact on purpose:

| instrument | on the artifact carrying `label={'Composed'}` |
| --- | --- |
| `pnpm lint` (oxlint, 552 files, 93 rules) | **0 warnings, 0 errors** |
| `pnpm exec vp lint <that one file>` | **0 warnings, 0 errors** |
| the svelte gate's `checkSources` | **`eslint:svelte/no-useless-mustaches`, line 6** |

So a green from `pnpm lint` here is **indistinguishable from a disabled rule, and
always will be**. That is a property of the tool, not of this defect.

**THE FIX, AND WHY IT IS NOT A BEHAVIOUR CHANGE.** `quotableStringProp` prints a
plain string-literal prop as the quoted attribute. Equivalence measured through
svelte's **own** compiler at 5.56.8 rather than asserted:
`<P label={'Composed'}>x</P>` and `<P label="Composed">x</P>` produce
**byte-identical `js.code`** in `client` and `server`, dev and prod — childless,
with children, for the empty string, and for a value containing `& < > { } "` put
through `escapeAttributeValue`, which is what proves the entity round-trip is
lossless.

**AND A DELIBERATE ASYMMETRY, RECORDED SO IT IS NOT READ AS AN OVERSIGHT.** It is
**not** applied to host attributes, because for a host the two spellings are *not*
the same compiled artifact: `<p data-x="y">` bakes the attribute into the template
HTML while `<p data-x={'y'}>` calls `set_attribute` at runtime. There are zero
`={'` occurrences under `generated/`, so no emitted byte turns on it either way.

**What reports a regression.** Three rows, and the last is the one that matters:
`test/composition.test.ts` asserts the emitted page contains `label="Composed"`
and **no** `={'` anywhere; the same file re-runs the compiled-equivalence
measurement including the host negative; and `test/gate.test.ts` reverts the real
artifact byte-for-byte to `label={'Composed'}` and requires **upstream to still
report it**, with the shipped artifact drawing zero eslint messages as the
control. Without that last pair, a green would be worth nothing.

---

## 20. The Angular gate parsed only the LAST `@Component` in a file, so half of a two-component module was never inspected — **CLOSED — test-suite defect**

> **Measured by `frameless-app-axes-v1` T015 (§5.1), which recorded it and
> deliberately did not repair it; repaired by T018.** Not emitted-output: this is
> an **instrument** defect, the same family as entries 4 and 6.

**Status:** CLOSED — **removed**, and it made a real violation visible that had
been counted by eye and never by the gate.

**WHAT IT WAS.** `parseEmitted` in `packages/frameworks/angular/src/gate/index.ts`
walked the module and **overwrote** its `component` binding on every match:

```ts
walkTs(module, (node) => {
	if (node.type === 'ClassDeclaration' && decoratorNamed(node, 'Component')) component = node;
});
```

So a module declaring two components was inspected **only at the last one**. Every
component-scoped policy in the file — `baseline-form-inventory`,
`whitespace-stable-text`, `no-two-way-binding`, `no-change-detection-override`,
`getter-expression-purity`, `template-parse` — silently skipped everything before
it, including that component's **entire template**. The module-scoped policies
(`no-signal-members`, `no-output-emitter`, `no-stop-propagation`, and the
import/decorator half of `observeForms`) walk `module` and were always correct,
which is exactly why this could sit unnoticed: **half the gate was already right.**

**WHAT IT WAS HIDING.** `generated-composition/C1-slot.ts` declares `Frame` then
`SlotPage`. `Frame`'s `<ng-content />` was never observed, so the file reported
**zero** uninventoried forms while `M1-panel.ts` reported `template-node:Content`
for the identical construct. T015 named that as the likely origin of the **phantom
fifth violation** in T009's ruling, which measured four. **The phantom was real,
and it is now counted.**

**WHAT THE FIX MOVED, MEASURED BOTH WAYS.** The HEAD gate and the fixed gate were
run side by side over both directories:

| directory | in the standing corpus? | before | after |
| --- | --- | --- | --- |
| `generated/` (15 files) | **yes** | 0 violations | **0 violations** |
| `generated-composition/` (3 files) | **no — already red** | 2 violations | **3 violations** |

**NO GREEN GATE TURNED RED.** `generated-composition/` was already failing; the
better instrument made it fail *bigger*. **Nothing was admitted to
`BASELINE_FORM_INVENTORY` to absorb the third violation** — `Content` is still
uninventoried, the inventory still holds its 32 entries and
`ANGULAR_BASELINE_FLOOR` is unmoved at `19.0`. The joint
`template-node:Content` / `ng-content`-must-reject ruling is unchanged in
substance and still owned by T017; it now has **two** shipping files to move
rather than one.

**Why it was harmless in `generated/`, and how that stays true.** `C1-slot.ts` is
still the only multi-component emitted file in the package — every other emitted
Angular artifact carries exactly one `@Component({`, asserted per file in
`test/gate.test.ts`.

**What reports a regression.** The shipped corpus **cannot** supply the killing
mutation, because every rejected form it contains sits in a single-component file
the old parser saw anyway. So `test/gate.test.ts` plants **three** rejected forms
on the **first** of `C1-slot.ts`'s two components, each reaching the gate by a
different scoped path — a two-way binding (template), a `changeDetection` override
(decorator metadata) and an impure getter (class member) — and asserts each is
reported **at a line inside the first component**. A file-level "the gate said
something" would pass just as well if the second component had grown the form. The
unmutated artifact drawing exactly its one known violation is the control.
Reverting `parseEmitted` turns **both** that row and the debt pin red.

---

## Closed, for the record

**`findings-001` — `engines.node: ">=20"` was false.** The toolchain cannot load
`vite.config.ts` on the Node 20 GitHub ships. **Fixed:** `>=22`, set from what the
matrix proved green rather than from the error message's claim.

---

## Where each one stands

| #   | disposition                     | code state                                   | what is left                                              |
| --- | ------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| 1   | product defect                  | **fixed** (T002 witness, T003 fix)            | conditional cancellation, deliberately deferred to T011/T012 |
| 2   | **not a defect**                | nothing to change                             | **nothing** — lane rescoped and its flag removed (T022)      |
| 3   | test-suite defect               | **all four causes fixed** (T008), timeout raised on measurement (T022) | 3 consecutive green Windows cells, durations read |
| 4   | test-suite defect               | **instrument repaired** (T017)                | one green WebKit cell observed under contention              |
| 5   | upstream                        | **nothing to change locally**                 | the owner files the solid-js typing report                   |
| 6   | test-suite defect               | **instrument repaired** (T008)                | none                                                         |
| 7   | **product defect — OPEN**       | **contained**, not removed: fail-closed v-limit at the compiler (T039) | the lift trigger — all six lanes measured byte-identical on an interior run at pinned versions |
| 8   | **product defect — OPEN**       | **contained AGAINST NESTED FUNCTIONS ONLY**, not removed: the fail-closed refusal (T044) tests `NESTED_FUNCTION_TYPES`, so a write inside an `if` is neither lowered nor refused — see **8.1** | the lift trigger — React lowers a nested state write the way Solid already does — **plus** the planted `if`-nested row 8.1 says a repair card owes first |
| 9   | **product defect — CLOSED**     | **removed**, not contained: the construct is lowered, and the missing typecheck oracle over emitted Angular now exists (T045) | none — but note the oracle is structurally blind to mode B, which the emitted-keyword assertion covers instead |
| 10  | **product defect — CLOSED**     | **removed**, not contained: boolean content attributes reach Angular as `[disabled]`, not `[attr.disabled]` (T049), and S9 gives the lowering a **served payload** — six lanes byte-identical on *absent* → `disabled=""` → *absent*, at a state cell and inside a keyed repeat (T050) | none for the defect — the six registered mutants are witnessed by `pnpm mutate:corpus`, and a survivor re-opens it on that lane |
| 11  | **product defect — CLOSED**     | **removed**, not contained: the accidental `\|\| fn.async` is gone from the Solid validator and the across-await lowering is proven by running it (T046), and S8 gives it a **served payload** — six lanes byte-identical on the suspended reading and on the overlap (T004) | none |
| 12  | **product defect — CLOSED**     | **removed**, not contained: the `await` survives re-analysis (T047), the final-sync retention is **segmented at the suspension boundary** and post-await reads of the cell being written are lowered to React's **functional updater** (T003). Witnessed before/after against real `react-dom`, with the calibration arm held fixed as the control, and **zero generated bytes moved** across three proven-real regeneration tiers | none for the defect — a **v-limit** (post-await read of a *different* cell) is recorded in 12.2 with its triggering authoring and its own registered test. The **served payload** landed with S8 (T004): six lanes byte-identical, and the react mutant is the pre-T003 lowering restored verbatim, RED at three of five readings |
| 13  | **product defect — OPEN**       | **half removed**: react's three names are repaired in `jsxName` and pinned against react-dom's own rejections; `hidden` and `readonly` are **contained** — excluded from `LANE_PORTABLE_BOOLEAN_ATTRIBUTES`, unrepairable from any emitter, because both fail inside `@qwik.dev/core`'s own `isBooleanAttr` | the lift trigger — a qwik release whose `isBooleanAttr` admits `hidden` and stops gating `readonly` on `key in element`, at which point the clause-5 matrix goes red and the portable set widens |
| 14  | **product defect — CLOSED**     | **removed**, not contained: a class with an async handler injects `ChangeDetectorRef` and every suspension segment after the first ends with `markForCheck()` (T004). Found by a **served payload** and by nothing else, with the diagnosis measured — one extra click made the stale DOM jump to the correct value | none for the defect — nested-function writes are NOT covered and the pass says so; no corpus authoring produces one |
| 15  | **product defect — OPEN, REACT ONLY (amended)** | **not contained** — no refusal anywhere: the casing is destroyed in the compiler (`jsxEventName` in `packages/compiler/src/build.ts`), so no emitter can spell `onKeyDown` **as react-dom needs it** and react's emitted binding is inert at runtime. **The other five lanes bind by the DOM event name, which is what the flattening produces, and they FIRE** — measured in browsers (T005) with the react row re-measured (T011), and re-measured a third time on the SHIPPED `/board` page by `frameless-app-fidelity-v1` T008, where a real native mouse drag moves a card in **five** lanes — **angular included, which T005 had left unresolved** — and moves nothing in react. The residue that is genuinely six-lane is narrower: a flattened name that is not a real DOM event, such as `doubleclick` from `onDoubleClick` | a per-lane spelling map **for react** (`dblclick` → React's `onDoubleClick` shares no stem with it), **and** a compiler-side refusal so `/^on[A-Z]/` stops accepting a name it is about to flatten |
| 16  | **not a defect**                | nothing to change in any emitter — the Svelte a11y refusals are correct and canonical TodoMVC's clickable `<label>` is the anti-pattern | **nothing** — rendered via a marked supplement (T007), vendored bytes untouched |
| 18  | **product defect — CLOSED**     | **removed**, not contained: `appendPersistenceWrites` reads the committed accessor instead of re-evaluating a cloned setter argument, and grows a plain-`let` arm so a handler-only persisted cell writes back (T016). Witnessed in chromium before and after on the same served bytes — before, Solid stored `"all"` while the screen read `done` and **forgot on reload**; after, it survives, matching React | none for the defect — a **contract limit** is recorded above: a handler-only record has `seed.lowering: 'none'`, so it is write-only until something reads the cell in render |
| 19  | **product defect — CLOSED, SVELTE ONLY** | **removed**, not contained: `quotableStringProp` prints a plain string-literal component prop as the quoted attribute, and `generated-composition/M2-page.svelte` was REGENERATED (T018). Equivalence measured through svelte's own compiler — byte-identical `js.code` in client and server, dev and prod, including the entity round-trip | none for the defect — but the instrument finding stands on its own: **`pnpm lint` cannot see `svelte/no-useless-mustaches` at any strength**, measured with the defect planted back, so only the svelte gate's own ESLint reports it |
| 20  | test-suite defect               | **instrument repaired** (T018): `parseEmitted` collects EVERY `@Component` in a module instead of keeping the last one, and the mutation that kills it plants three rejected forms on the FIRST of two components | none — but it made a real violation visible: `generated-composition/` went from 2 to 3, `generated/` stayed at 0, and **nothing was admitted to the inventory to absorb it**. The `Content` ruling is still T017's, now over two files |
| 17  | **product defect — OPEN**       | **contained only by hand** — fixture constraints and board `stop_if` clauses. Every valued static attribute reaches every emitter as a **string** (`StaticAttribute` in `packages/compiler/src/schema.ts`) and no lane's declared JSX prop type is consulted anywhere, so the emitted output fails that lane's own `tsc`. Measured per lane: `rows="6"` costs react and qwik and is free in solid; `draggable="true"` costs qwik alone; the valueless `draggable` costs react alone | a refusal at authoring time instead of a convention — and, first, a ruling on whether the value's kind belongs in the IR or in a per-lane attribute table |

**Entries 7, 8, 13, 15 and 17 are the OPEN defects in frameless's own emitted
output**, and 7, 8 and 13 are the ones on this table a later reader could mistake
for closed because their repairs are green. Entries 7 and 8 *contain* something
that is still there — a non-neutrality in 7, an unlowerable construct in 8 — so
their repairs are refusals, and a refusal is not a removal. In all of these cases
a registered test reports the day the status should change, and in all of them it
reports in **either** direction.

**Entries 15 and 17 are in none of those states, and that is what distinguishes
them.** Neither is contained, repaired-but-unwitnessed, or
accepted-and-wrong-by-design the way entry 12 was for a phase. **Nothing refuses
either and nothing reports either**: the compiler accepts `onKeyDown`, flattens
it, and **react** emits a binding that renders clean and never fires; the compiler
accepts `rows="6"`, lowers it as a string, and react and qwik emit output their own
`tsc` rejects. Entry 12's phase was a deliberate choice with tests asserting the
defect's own numbers; entry 15 has **no instrument at all**, because the corpus's
three events are single-word and `.toLowerCase()` is the identity on every one of
them, and entry 17's only instrument is the 267 budget noticing *after* an author
has already spent one.

**AND ENTRY 15's SCOPE WAS WRONG FROM THE DAY IT WAS FILED UNTIL T011, WHICH IS
THE SHARPEST THING ON THIS TABLE.** Its title said *"in all six lanes"*; it is
**react only**, and five task cards across two boards quoted the
title as a hard six-lane blocker — one of them shipping an application with **no
keyboard at all**. This is the second time this ledger has generalised a react
lowering defect to all six lanes (12.2 was the first) and the second time a
later card had to measure the other five to find out. **A scope claim in a title
is the part that gets quoted, and this document has now been wrong in that exact
place twice.** The standing rule it buys: an entry filed from one lane says *one
lane* in its title until the other five have been run.

**And entry 8's containment claim was overstated until T006 measured it.** This
table said "contained" for eight entries' worth of reading; what is contained is
the *nested-function* form. The `if` form was never refused, and the entry's own
prose — "a write inside any nested **function**" — is where the gap hid. A
containment claim is only as wide as the predicate that enforces it, and the
predicate here is a five-member set of function node types.

**Entry 10 moved to CLOSED on 2026-07-28, and the distinction it used to
illustrate is worth keeping.** Its repair always *removed* the defect the way
entry 9's did; what it lacked was not a lowering but a **witness**, because
nothing in the shipped corpus bound a boolean attribute and entry 9 had earned
CLOSED on exactly the evidence entry 10 did not have. S9 supplied it: six lanes,
byte-identical, *absent* → `disabled=""` → *absent*, asserted in the server's own
bytes as well as the live DOM. "Repaired but unwitnessed" was a real and distinct
status for eight days, and it is recorded here rather than erased, because the
next repair proven at the compiler and the emitter alone will be in it too.

**Entry 12 was open for a THIRD reason, and the status it occupied is worth
keeping on the record.** Entries 7 and 8 are *contained* — the construct is
refused, loudly, so nothing wrong ships. Entry 10 was *repaired but unwitnessed*,
and is now witnessed and closed. Entry 12 was neither: for a phase the emitter
**accepted** the construct and **emitted output that was behaviourally wrong**,
with no refusal in front of it, and that state was deliberate rather than
accidental. Refusing async handlers again would have thrown away a measurement
nobody had ever taken, and the alternative — a lowering that reads live and stops
collapsing writes across a suspension point — was a design change T047 explicitly
did not make. **T003 made it.** So entry 12's registered tests asserted the
**defect's own numbers** for a phase, and they are the only tests in this ledger
that had to be **rewritten**, not merely re-run, on the day it was fixed. That
rewrite happened, to the numbers this entry named in advance, with the calibration
arm untouched. A test that agrees with a bug is a liability unless the entry it
belongs to says so **and says what it must become**; this one said both.

**Entry 12 is CLOSED to entry 11's standard, not entry 10's**, and it carries the
same residue: a calibrated instrument watched red on the exact construct before
the emitter moved, plus a v-limit that is recorded rather than hidden — but **no
served payload**. No browser has yet run a frameless-emitted async React handler.
That is a corpus gap for S8, not an open repair.

**Entry 11 is CLOSED to entry 9's standard, not entry 10's**, and the difference
is worth stating because both lack a served payload. Entry 9 and entry 11 each
ship a **calibrated** instrument that was watched red on the exact construct
before the emitter moved and that fails if the repair is undone; entry 10's
repair is proven at the compiler and the emitter and observed **nowhere** —
there is no test that would notice if a served Angular payload regressed. A
missing e2e witness for a construct the corpus does not yet contain is a corpus
gap. A repair whose only evidence is upstream of the artefact is an open defect.

**Entry 8 outranks entry 7 by this document's own ranking rule** — how wrong the
shipped output is. Entry 7 changes how a space renders; entry 8 emitted invalid
TypeScript that silently never re-rendered. It is filed second only because it was
found second, and it is worth naming why: it was not found by a better instrument
but by an **absent input** finally being supplied. Ranking preserves discovery
order everywhere else in this ledger, so it does here too.

**Two** `continue-on-error` flags remain, down from three, and each carries a
removal gate that is an observation, not an argument — **and each gate has now
been restated, because the first version of both was met literally while the
thing it stood for was not true** (T009):

| flag              | state    | gate as first written                | why that was not enough                                            | gate now                                                                 |
| ----------------- | -------- | ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Windows           | **on**   | an observed green cell               | the cell is a coin flip: 2 green / 2 red on a 5000 ms bound          | timeout raised on measurement (done), **then** 3 consecutive greens with the durations read |
| WebKit            | **on**   | a green cell *after* T017            | already green for 5 consecutive runs *before* T017, no adapter change | a green observed under the **contention** that produced the reds          |
| `qwik-throttled`  | **off**  | a rescoped lane, owner-ruled         | met — the lane now blocks on `q:container="resumed"` and passes throttled | n/a                                                                       |

A flag that quietly persists is a defect that quietly persists — but the sharper
lesson is the middle column. **A removal gate is itself an instrument, and an
uncalibrated one lies in exactly the way the six findings did**: both of these
gates named an observation, both observations were duly made, and neither
established what it was standing in for. Before treating a green cell as a
verdict, establish the cell's variance.

## The constraint that survived all of this

**Every fix is preceded by a test that fails for the right reason** — and the
corollary this goal added, at cost: **a green test is evidence only if something
proves it can go red.**

That discipline is what found these six. It is also what let three of them be
misread, because it was applied one-sidedly: the gates were proven able to go red,
and the **harnesses** were proven nothing about. Every instrument repaired here now
ships with its own calibration — the mutation constructor throws on a miss, the CR
scan is shown to see a CR, the order-insensitive view is shown to still catch an
authored reorder, and the released generative property counts the cases that make
it non-vacuous.

Defect 1's release remains the sharpest illustration. Its held expectation had gone
green on its own, without the defect being touched, so _releasing it alone would
have been the fix landing silently_, in the exact way the tripwire existed to
prevent. Finding 6's release follows the same rule, which is why it ships with a
witness counter rather than a note.
