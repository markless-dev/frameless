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

**Currently held as:** the `qwik-throttled` job's throttled step, still
`continue-on-error: true`. The flag is owner-ruled and is **not** re-litigated
here. Its removal is gated on that lane being rescoped to click *after* the
container reports `resumed` — owned by T016. Once it is, the step should need no
flag, and a residual failure there would be a genuine finding rather than grounds
to restore it. The unthrottled control remains **not** flagged: it is the
instrument's own health check.

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
refuted.** This entry used to say `solid/test/gate.test.ts:610` "fails a hash
assertion, almost certainly CRLF", and labelled it a guess. T006 checked it: there
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

**Fourth cause — a hypothesis, labelled as one.**
`react/test/emitter.test.ts:133-134,141,150` and `solid/test/emitter.test.ts:153,162`
assert `readFile(generated/*.jsx) === emit(ir)` byte-for-byte while
`formatEmitted` hard-codes `endOfLine: 'lf'`, so every freshness assertion should
fail on a CRLF checkout. This was read off the assertions, **never observed in a
Windows log**, and it is recorded as an inference rather than a finding.

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

**Currently held as:** the Windows matrix cell, still `continue-on-error`, with
its justifying comment corrected — the old comment stated a reason T006 had
refuted, and a flag whose stated reason is known-false is indistinguishable from
an unexamined flag at audit. **The flag does not come off on the strength of these
fixes**, and the reason is arithmetic: the four named causes account for roughly
**6 of the 35** failures across **4 of the 8** files, and the fourth is a
hypothesis. Removal gate: an **observed** green `windows-latest` / node 24 cell on
a real run.

---

## 4. WebKit exceeds the analyzer's quiescence bound — `findings-005` — **test-suite defect**

**Status:** DIAGNOSED as a harness assumption. The repair is specced as **T017**
and has not landed yet.
**Severity: medium.** It is not an engine divergence, but it is load-bearing: the
same loop exists in all three adapters and three more frameworks are about to copy
them.

```
react-browser (webkit)  test/adapter-input.browser.test.ts
  × dispatches analyzer input actions through React controlled inputs
Error: Observable DOM did not quiesce within 500ms
```

**The bound measures the wrong quantity, and this is readable in the source
rather than inferred from the failure.** `boundedQuiescence` bounds **wall clock**
over a loop whose progress is gated entirely on `requestAnimationFrame`, and its
`stable >= 2` condition needs **three** rAF deliveries. rAF's contract is
ordering — "before the next repaint" — and carries **no rate guarantee**. A
headless browser that never composites owes no repaint and therefore no callback
on any schedule. So `500` silently encodes a sustained ~4 fps floor that no
specification provides. The copies are byte-equivalent at
`react/src/adapter.ts:65-78`, `solid/src/adapter.ts:52-65`, `qwik/src/adapter.ts:55-68`.

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
comment repointed at the Phase B audit. The flag is now the **adjudicating
instrument**, not an annotation: the T017 repair is self-falsifying there, because
a genuine engine divergence would still fail a tick-bounded loop. Removal gate: an
observed green webkit cell **after** T017 lands. The Firefox cell is a normal
required cell — it passes.

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
`build.ts:428-430` sorts `bindings`, `aliases` and `events` by
`compareText(x.id, ...)`, and a state binding's id is `state:<name>`. An
alphabetical rename **must** permute them. That is the IR's declared canonical
form, present since `93420a3`. Demanding positional stability of an array whose
position is *defined by* the identifier just renamed is not a property the
compiler ever offered. Field-by-field diffing of the seed-20260726 counterexample
found all 8 differing leaves to be a permutation of `records.bindings`, and a
200-run sweep found zero non-permutation diffs, zero declaration-order changes and
zero cell-wiring changes. Three controls closed the mechanism: a rename that does
*not* move alphabetically produces zero diffs.

**The repair is by CITATION, not by taste.** An order-insensitive view is applied
to a collection only where the exact `build.ts` sort line keying on a name-derived
field can be cited, **and** the permutation has been witnessed:

| collection                                | cited sort line                                            | key                                        |
| ----------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `records.bindings`                        | `build.ts:428`                                              | `id` = `state:<name>` / `computed:<name>`   |
| `records.aliases`                         | `build.ts:429` (ids built at `2440`)                        | `id` = `alias:<Component>:<aliasName>`      |
| `records.stateReads`                      | `build.ts:431` → `2725` `.sort(compareReads)` (`2732`)      | componentId, graphNodeId, path              |
| `records.stateWrites`                     | `build.ts:342` → `sortWrites` `2740-2752`                   | componentId, **graphNodeId**, path, …       |
| every `reads` array, any depth            | `build.ts:1370` → `dedupeReads` `2866-2874`                 | graphNodeId, path, via                      |
| every `writes` array, any depth           | `build.ts:2671` and `:389` → `sortWrites` `2740-2752`       | as above                                    |
| `components[].locals[].semanticRecordIds` | `build.ts:629`                                              | bare `.sort()` over `state:` / `alias:` ids |

**`records.stateWrites` is included on a witnessed permutation, and an earlier
guardrail forbidding it was FALSE.** T006 recorded it as "`writes` unsorted,
authored write order". It is not: `build.ts:342` is `const writes = sortWrites(…)`.
Obeying that guardrail literally would have reproduced the same false finding from
a second collection. It is included here only because a program with two written
state nodes whose alphabetical order flips under an equal-length rename was
constructed and **watched** to permute it.

**Deliberately excluded — these stay order-sensitive:**

- `records.events` (`build.ts:430`). It sorts by id, but an event id is
  `event:<allocation index>` or `event:<hostNodeId>:<eventName>`; no local rename
  can move either. Probed, order unchanged. Its **nested** reads/writes do permute
  and are covered by the rule above.
- `module.exports` (`build.ts:464`). Keyed on `exportedName`, part of the
  observable contract, which a meaning-preserving rename never touches.
- `records.sharedWrites` (`build.ts:2079`) and `events[].handlers`
  (`build.ts:326`). Both **span-keyed**, not name-keyed.

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

## Closed, for the record

**`findings-001` — `engines.node: ">=20"` was false.** The toolchain cannot load
`vite.config.ts` on the Node 20 GitHub ships. **Fixed:** `>=22`, set from what the
matrix proved green rather than from the error message's claim.

---

## Where each one stands

| #   | disposition                     | code state                                   | what is left                                              |
| --- | ------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| 1   | product defect                  | **fixed** (T002 witness, T003 fix)            | conditional cancellation, deliberately deferred to T011/T012 |
| 2   | **not a defect**                | nothing to change                             | rescope the throttled lane to click after `resumed` (T016)   |
| 3   | test-suite defect               | **all four causes fixed** (T008)              | an observed green Windows cell before the flag comes off     |
| 4   | test-suite defect               | diagnosed, **not yet repaired**               | T017: bound the loop on ticks, with a failing calibration    |
| 5   | upstream                        | **nothing to change locally**                 | the owner files the solid-js typing report                   |
| 6   | test-suite defect               | **instrument repaired** (T008)                | none                                                         |

Three `continue-on-error` flags remain, and **each carries a removal gate that is
an observation, not an argument**: Windows (an observed green cell), WebKit (an
observed green cell *after* T017), and `qwik-throttled` (a rescoped lane, owner-ruled).
A flag that quietly persists is a defect that quietly persists — so none of them
comes off because a cause was fixed, only because a cell went green.

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
