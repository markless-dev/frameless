# T007 — Phase B audit: defects 4, 6 and 3-B

**Decision: approved.** All three T006 diagnoses stand on their evidence. Phase B
is complete as a *diagnosis* phase. `full_outcome_complete` stays **false**.

Four premises have been falsified on this board by checking. Checking here
falsified two more, both inside T006's own note, and surfaced a fourth Windows
cause and a vacuous invariant nobody had flagged. Details in §6.

---

## 0. Verification the Judge ran itself

| command | result |
| --- | --- |
| `pnpm check` | **pass**, exit 0, three `tsc` passes |
| `pnpm test` | **pass**, 561 passed (561), 39 files |
| `pnpm test:browser` | **pass**, react 55/55 (7 files), solid 44/44 (4 files) |
| `pnpm e2e` | **pass**, `[e2e] PASS`, 3 demos x 3 scenarios, all observations equal |
| `git status --short` | clean, zero paths |

Independent probes (scratchpad, nothing written to the repo):

- repo-wide scan for `.replace(<literal-with-newline>, …)` search arguments
- empirical ECMAScript template-literal CRLF normalisation test
- direct read of `build.ts` sort sites 326, 342, 428-431, 464, 629, 2079, 2725, 2740
- `packages/compiler/test/goldens/s1-render-once.json` binding inventory
- `.gitattributes` presence, `execFileSync` sites, all three `boundedQuiescence` copies

---

## 1. Ruling per defect

### Defect 4 — WebKit quiescence — **HARNESS ASSUMPTION** (instrument defect, real work required)

**The evidence does the work.** I checked the conclusion rather than accepting it.
The load-bearing claim is not the WebKit measurement; it is a property of the loop
that is readable in the source and true on every engine:

```ts
const deadline = performance.now() + 500;      // wall clock
while (performance.now() < deadline) {
    await flush();
    await new Promise((r) => requestAnimationFrame(() => r()));   // frame-gated
    ...
    if (stable >= 2) return;                    // needs THREE snapshots
}
```

`stable >= 2` requires three rAF deliveries. `requestAnimationFrame` promises
*ordering* — "before the next repaint" — and no *rate*. A headless browser that
never composites owes no repaint and therefore no callback on any schedule. So
`500` silently encodes a sustained-frame-rate floor of roughly 4 fps that no
specification provides. That is not an inference from the measurement; it is what
the code says.

T006's measurement then adds the part that could have gone the other way and did
not: `distinctDomDuringLoop: 1` in all nine runs, first snapshot equals final DOM,
byte-identical `innerHTML` across chromium/firefox/webkit, no post-settle change
in 600 ms. **None of the elapsed time is DOM settling.** Reading 2 — a genuine
WebKit divergence in React controlled inputs — would have shown up precisely here
and did not, and is further excluded by blast radius (CI failed 1 of 55; sustained
starvation fails 42 of 55, because 42 go through `settle()`) and by the two sibling
tests in the same file passing on the identical mechanism.

**Rejected: "raise the bound".** The board named this as the tempting wrong move
and the instrumented evidence explicitly does **not** support it. There is no
settle time to raise the bound *to* — nothing settles, because nothing is pending.
Raising 500 to 2000 buys margin against a symptom while leaving a frame-gated loop
under a wall-clock deadline in three adapters that three more frameworks are about
to copy. T006 declined to take it. Ratified.

**What closes it.** Bound the loop on the quantity it actually consumes, not on
wall clock. Either (a) gate progress on a primitive with a delivery contract — a
macrotask turn, or a `MutationObserver` quiet period — keeping the wall-clock
deadline as a genuine upper bound; or (b) keep rAF and bound on *ticks*, with the
wall-clock deadline retained only as a runaway guard. Both are acceptable. What is
**not** acceptable is a settle loop that cannot fail: the change must ship with a
calibration that induces a genuinely non-quiescing DOM and asserts the loop still
throws. It must land in **all three** adapters (`react`, `solid`, `qwik`), which
carry byte-equivalent copies at `react/src/adapter.ts:65-78`,
`solid/src/adapter.ts:52-65`, `qwik/src/adapter.ts:55-68`.

### Defect 6 — rename invariant — **HARNESS ASSUMPTION** (instrument defect, real work required, with a corrected guardrail)

**The evidence does the work, and this one is provable rather than argued.**
`build.ts:428-430` sorts `bindings`, `aliases` and `events` by `compareText(x.id, …)`;
a state binding's id is `state:<name>`; therefore an alphabetical rename *must*
permute them. That is the artifact's declared canonical form. The invariant
"a rename changes identifier strings and nothing else" demands *positional*
stability of arrays whose position is *defined by* the identifier just renamed. It
contradicts a declared property of the thing it measures.

T006 did not stop at the single seed, which was right: the counterexample has no
reads, events or writes, so alone it could only have supported an extrapolation.
The 200-run sweep with multiset-level permutation checking, zero non-permutation
diffs, and zero `components[].locals` movement is what makes this a ruling rather
than a guess. Three controls (`epsilon9→dpsilon9` unchanged position → 0 diffs;
`beta6→zeta6` → same permutation) close the loop on the mechanism.

**"Compare order-insensitively" is therefore permitted here.** Approved.

**T006's guardrail is FALSE as written and must not be handed to a Worker verbatim.**
This is the sharpest finding of this audit. T006 states:

> It must **not** be applied to `records.stateWrites`, which is `writes` unsorted
> and whose order is *authored write order*

`records.stateWrites` is **not** unsorted. `build.ts:342` is
`const writes = sortWrites(...)`, and `sortWrites` (`build.ts:2740-2752`) sorts by
`componentId`, then **`graphNodeId`** — which is name-derived — then `path`,
`operation`, `method`, and only then `sourceSpan.start`. So `stateWrites` is
name-canonicalised too, and a rename that flips the alphabetical order of two
written state nodes will permute it in exactly the same way. A Worker who obeys
T006's guardrail literally will exclude `stateWrites`, and the invariant will keep
producing the same species of false finding from a second collection.

T006's list of four is also **incomplete** in the other direction. Name-derived
sorts I found that its list omits:

| site | collection | key |
| --- | --- | --- |
| `build.ts:342` | `records.stateWrites` | `componentId`, then `graphNodeId` |
| `build.ts:464` | `module.exports` | `exportedName` |
| `build.ts:629` | a per-component id array | bare `.sort()` on ids |

And two sites in its neighbourhood are **span-keyed, not name-keyed**, and must
stay order-sensitive: `build.ts:326` (by `expression.start`) and `build.ts:2079`
(`sharedWrites`, by `targetSpan.start`).

**The correct guardrail — a rule with a proof obligation, not a list.** Apply the
order-insensitive view to a collection **only if** the Worker can cite the exact
`build.ts` line whose comparator keys on a name-derived field, and records that
line number next to the entry. Anything the Worker cannot cite stays
order-sensitive. Compare as a **multiset of whole entries** (each entry
JSON-canonicalised *after* `structural()` blanking), never as a sorted-then-compared
array: a multiset over whole entries still detects any genuine change to an entry,
including an authored write reorder, because `sourceSpan` travels inside the entry.

**S-SH7 is not threatened by this, and T006's reason for saying so was wrong.**
S-SH7 is a *Solid gate policy over emitted source*, comparing emitted output
against the artifact's recorded sequence. It is not a compiler-IR test. What
metamorphic/generative comparison does with array positions has no bearing on it.
The thing genuinely worth protecting is that a real reorder still gets caught —
and the existing calibration (`metamorphic.test.ts:192-213`, "changing a literal is
caught", "dropping a cell is caught") must still fail after the change. That is the
guard, not the exclusion list.

**`stateWrites` gets the witnessed-failure treatment.** Before including it, the
Worker must construct a program with two written state nodes whose alphabetical
order flips under an equal-length rename and *watch the invariant fail on
`records.stateWrites`*. If that failure cannot be produced, exclude it and record
why. Applying the view to a collection nobody has seen misbehave is the same
unexamined-assumption move this whole audit is about.

### Defect 3-B — Windows `S-SH7` — **REAL FINDING in the test suite** (not a non-issue)

CRLF is confirmed as the trigger; the documented cause is refuted. I re-read the
row myself at `packages/frameworks/solid/test/gate.test.ts:470-478`: the search
literal is
`'setHistory(\`${history()}:${count()}\`);\n\t\tsetCount(count() + 1);'`, and
`shared` is `compositionSources.get('C2-shared')`, read **from disk** at
`gate.test.ts:42-45`. On a CRLF checkout that literal cannot match, `String.replace`
returns the input unchanged **with no error**, and the harness asserts a mutation
against a non-mutant. Rows C and D of T006's table exonerate the gate: it detects a
genuine CRLF reorder and clean-passes clean CRLF, because both sides go through
`formatEmitted` with `endOfLine: 'lf'`.

**This is a green vacuum and it does not get closed by "instrument problem".** A
mutation fixture that can silently fail to mutate is the exact failure mode this
board polices at `T003`'s gate release. The fix is two things, not one: make the
row CRLF-proof, **and** make the no-op impossible to have silently — assert the
mutation actually changed the source, in the pattern already used at
`metamorphic.test.ts:79` (`expect(renamedSource).not.toBe(original)`).

**T006's "exactly one CRLF-fragile row" claim needed checking and survives — for a
reason T006 did not state.** My repo-wide scan finds **four** `.replace()` search
literals containing a newline, not one:

```
packages/frameworks/react/test/gate.test.ts:251   'const nextValue = value + 1;\n    setValue(nextValue);'
packages/frameworks/react/test/gate.test.ts:259   'const nextValue = value + 1;\n    setValue(nextValue);'
packages/frameworks/react/test/gate.test.ts:375   'const nextValue = value + 1;\n    setValue(nextValue);'
packages/frameworks/solid/test/gate.test.ts:473   'setHistory(`${history()}:${count()}`);\n\t\tsetCount(count() + 1);'
```

The three React rows operate on `valid`, an **in-file template literal**, and
ECMAScript normalises `<CR><LF>` to `<LF>` inside template literals. Verified
empirically rather than from memory — a CRLF-encoded `.mjs` with a multi-line
template literal yields `"a\nb"`, and an LF-escaped `.replace` search matches. So
they are safe.

**The real discriminator is therefore not "which file" but: disk-read source +
escaped-`\n` search literal.** That is the shape a fixer must look for, and it is
the shape the three adapter boards will reproduce the moment they add gate tests
with composition fixtures.

---

## 2. Two more Windows causes, and why the flag cannot come off

T006 found a **third** cause unprompted: the compiler goldens bake AST byte
offsets, so `enriched-ir.test.ts`'s golden-dump tests break on a CRLF checkout and
CRLF-ising the golden does not fix them. Ratified — the offsets are correct for the
bytes they were built from, so the golden is not the thing that is wrong.

Checking that led me to a **fourth**, of identical shape and larger blast radius.
`packages/frameworks/react/test/emitter.test.ts:133-134, 141, 150` and
`packages/frameworks/solid/test/emitter.test.ts:153, 162` assert
`readFile(generated/*.jsx) === emit(ir)` byte-for-byte. `formatEmitted` hard-codes
`endOfLine: 'lf'`. On a CRLF checkout every freshness assertion in every emitter
test fails.

**This is the accounting that kills any early removal of the Windows flag.**
`findings-004` reports **35 failures across 8 test files**. The causes anyone has
named account for roughly:

| cause | files | failing tests |
| --- | --- | --- |
| A — `execFileSync('npx')` | 2 | 2 |
| B — S-SH7 no-op mutation | 1 | 1 |
| third — golden byte offsets | 1 | 3 |
| **named total** | **4** | **~6** |
| **reported** | **8** | **35** |

Roughly **29 failures across 4 files are still unexplained**, and the fourth cause
is a *hypothesis of mine*, not an observation — nobody has ever seen a green
Windows run, and nobody has the failing log enumerated at file level. T008 must
therefore **not** remove the flag, and its stop_if already says so; I am
strengthening that from a caution into a hard gate (§4).

**The root fix is one file.** The repo has **no `.gitattributes`**. Its emitters
hard-code `endOfLine: 'lf'`, its goldens bake LF byte offsets, and its freshness
tests compare bytes. LF is already a house invariant everywhere except at the one
place that decides it. `* text=auto eol=lf` plus `git add --renormalize .` closes
cause B, the third cause and the fourth cause at once. Cause A is unrelated and
needs its own `shell: true` / `npx.cmd` fix in both copies.

**And the invariant must stop being silent.** Add one test asserting that no
tracked text file in the working tree contains a CR. That is the pattern fix from
§5 applied to this defect: the assumption was never wrong, it was never *asserted*.

---

## 3. Defect 4's missing reproduction — sufficient to act on, insufficient to de-flag

The card asks me to be careful in both directions. Here is the split.

**Act on it.** The claim being acted upon is *"the loop bounds wall clock over a
frame-gated wait, and rAF carries no rate guarantee"*. That claim is proven by
reading the source and is true on ubuntu WebKitGTK whether or not anyone runs it
there — WebKitGTK cannot falsify a statement about the loop's own structure. The
Chromium rAF-cadence experiment is not doing evidentiary work for the mechanism at
all; it is a *demonstration* that the failure is engine-independent, which is a
bonus. Refusing to repair a loop that provably measures the wrong quantity, in
three adapters, on the eve of three more frameworks copying them, because an
unavailable CI cell could not be reproduced, would be the mirror-image failure of
the T004 overturn: declining to act on good evidence rather than acting on bad.

**Do not de-flag on it.** The claim *not* proven is that the **CI incident** had
this cause. T006's three arguments against reading 2 are good and I checked them,
but "Linux WebKit produced a different DOM" remains formally unexcluded, and T006
says so plainly rather than papering over it.

**The sequencing that resolves both.** The repair is **self-falsifying on the real
cell**. If the CI failure were a genuine engine divergence, a loop bounded on ticks
or on a delivery-contracted primitive would *still* fail there — it would still see
a different `innerHTML`, or still never stabilise. So: land the repair, keep the
WebKit `continue-on-error` **on**, and let the ubuntu WebKitGTK cell adjudicate.
Removing the flag before that observation would be discarding the only instrument
capable of settling the question.

**The witnessed-failure discipline is satisfiable locally, and is required.** T006
already showed the verbatim error reproduces on Chromium at 260 ms/frame against
the unmodified adapter. That reproduction, written *into the repo* as a test that
fails before the repair and passes after, is the witnessed prior failure the
charter demands. Defect 4 does not get a fix without it.

---

## 4. `continue-on-error` ruling

**No flag comes off in this phase. All three stay, each with a stated removal gate.**
That is the honest answer, and each gate is an observation, not an argument.

### Windows cell — `.github/workflows/ci.yml:85` — **STAYS**

Removal gate: an **observed green** `windows-latest / node 24` cell on a real CI
run. Not "both causes fixed" — the named causes account for ~6 of 35 failures
across 4 of 8 files (§2), so closing them cannot justify removal.

**The justifying comment is currently false and must be corrected now**, in T008.
`ci.yml:69-74` says `solid/test/gate.test.ts:610 fails a hash assertion, almost
certainly CRLF`. T006 refuted that: there is no hash assertion, the gate is
CRLF-robust, and the fault is a mutation search literal that silently no-ops. A
flag whose stated reason is known-false is indistinguishable from an unexamined
flag at the T009 and T999 audits.

### WebKit cell — `.github/workflows/ci.yml:162` — **STAYS**

Removal gate: an observed green `webkit` cell **after** the quiescence repair
lands. Per §3 the flag is the adjudicating instrument, not just an annotation.
Comment should be repointed at this audit and state the three facts: the loop is
frame-gated under a wall-clock bound, the failure reproduces on Chromium at slow
frame cadence, and the cell is being kept to confirm the repair on the real port.

### `qwik-throttled` throttled step — `.github/workflows/ci.yml:280` — **NOT RE-LITIGATED**

Owner-ruled; rescoping owned by T016. Recorded only so the count is complete: once
the click fires after the container reports resumed, the step should need no flag,
and a residual failure is a genuine finding rather than grounds to restore it.

---

## 5. The pattern ruling

### 5.1 The DEFECTS.md framing does not survive

The document opens:

> **Nothing in this list is unfinished testing work.** These are defects the
> testing work uncovered. The suite that found them is complete and green.

Both sentences are now false, and the second is false in two independent ways.

Adjudicated provenance of the six:

| # | as filed | adjudicated | by |
| --- | --- | --- | --- |
| 1 | product defect, "diagnosed by rule" | **product defect** — but the stated evidence was false four ways; the real evidence is T002's | T015/T002/T003 |
| 2 | product defect, high | **not a defect** — instrument clicks before any framework installs listeners | owner overturn of T004 |
| 3 | portability defect | **test-suite defect**, four causes, one root (no `.gitattributes`) | T006 + this audit |
| 4 | possible engine divergence | **test-suite defect** — wall-clock bound over a frame-gated loop | T006 |
| 5 | consumption defect | **open**, most likely an upstream solid-js typing gap | T008 |
| 6 | possible compiler defect | **test-suite defect** — invariant contradicts a declared canonicalisation | T006 |

**One product defect. One non-defect. Three test-suite defects. One open question.**
Three of six *are* unfinished testing work — the exact claim the opening denies.

"The suite that found them is complete and green" is false a second time, because
some of that green is vacuous. Three instances now on record:

1. The qwik gate's held expectation was green **on broken output** — `[]` was
   already what unfixed main produced (T015, T003).
2. The S-SH7 mutation can silently produce a non-mutant (T006).
3. **New, found in this audit.** `metamorphic.test.ts`'s whole-IR rename invariant
   — the one DEFECTS.md says "holds exactly on all three checked-in fixtures" — runs
   on **one** fixture. `metamorphic.test.ts:60-68` defines renames only for
   `s1-render-once.tsrx`; `s2` and `s3` have `[]` and hit `if (pairs.length === 0) continue`.
   And that one fixture **cannot exhibit defect 6**: its golden has exactly three
   bindings — `computed:derived`, `prop:props`, `state:count` — one state binding,
   and the renames (`count→tally`, `prefix→banner`, `derived→display`) leave the
   `computed < prop < state` ordering unchanged. The invariant passed because it was
   structurally incapable of failing, not because the property held.

**What the document should say instead.** Replace the opening with an honest
statement of mixed provenance: that these are *findings*, that each required
adjudication into product defect / test-suite defect / upstream / non-issue, that
the final tally is 1/3/1-pending/1, and that three of the suite's own instruments
were found to encode assumptions their targets never made. Drop "complete and
green" in favour of something checkable: the suite is green, and its green is worth
exactly as much as its calibration — which is why every instrument repaired in this
goal ships with a test that makes it fail.

Retitling to reflect that this is a findings ledger rather than a defect list is
also warranted, but is cosmetic next to the framing.

### 5.2 The common shape — yes, there is one, and it is one sentence

> **Every one of them measured the product through a proxy whose stability the
> product never promised, and asserted nothing about the proxy.**

| defect | asserted | actual proxy | what the target promised |
| --- | --- | --- | --- |
| 2 | "the page is interactive" | `domcontentloaded` has fired | nothing about listeners at DCL — *no* framework promises this |
| 4 | "the DOM has settled" | 500 ms of wall clock | rAF promises *ordering before repaint*, never a rate |
| 6 | "the IR changed only in names" | array **positions** are equal | the IR declares those arrays canonically sorted **by name** |
| 3-B | "the source was mutated" | `String.replace` was called | `replace` promises to return a string, not to have matched |

The failure is **not** that assumptions were made — instruments cannot avoid
assumptions. The failure is that each assumption was **silent**: nothing in the
test asserted the precondition it depended on, so when the precondition broke, the
instrument reported a **product** defect instead of an **instrument** fault. A
silent precondition converts every one of its own violations into a false finding
about something else.

The secondary failure is downstream and human: in three of four cases the red was
interpreted before anyone asked whether the test was fair. Three parties missed it
on defect 2. T006 asked the question first, on the owner's correction, and went
three for three.

### 5.3 What catches the next one — three rules, all cheap, all checkable

**Rule 1 — Two-variable triangulation, before any finding is filed.** Vary one
*instrument* parameter and one *product* parameter, and confirm the signal tracks
the product. All four would have been caught in minutes:

- defect 2: run it against a bare scaffold → still red → instrument
- defect 4: run it on Chromium at slow frame cadence → red → instrument
- defect 6: rename to a name that does *not* move alphabetically → green → instrument
- defect 3-B: run the same mutation on LF → green → instrument

This is not new methodology; it is precisely what T004 and T006 each did. It just
has to be a *gate*, not a virtue.

**Rule 2 — Every instrument asserts its own preconditions.** Concretely, and each
of these is a one-line change:

- a mutation harness asserts the source actually changed (`not.toBe(original)`), or
  uses a helper that throws when the search literal does not match
- a readiness wait blocks on the framework's **own** readiness signal, never on a
  browser lifecycle event that predates it
- a positional comparison over a collection asserts, or cites, that the collection
  is order-significant
- a repo-wide byte invariant (LF) is asserted by a test, not assumed by every
  consumer of it

**Rule 3 — Two-sided calibration for harnesses, not only for gates.** This repo has
excellent one-sided discipline: gates get mutation tests proving they *can* go red.
Harnesses got none. Every harness must also be shown able to go red for the reason
it claims — a settle loop that cannot throw is not a settle loop — and every red
must survive the fairness question in writing before it is interpreted.

**This is load-bearing for the three adapter boards.** Svelte, Vue and Angular will
each add a gate corpus, a calibration lane, a reference pair and an e2e row. Every
one of those is a new instrument. Rules 1-3 should be standing constraints on
`docs/goals/frameless-svelte-v1`, `-vue-v1` and `-angular-v1` before T013 starts —
which is a T010 board-hygiene item, since T010 is already touching all three
charters. Rule 2's mutation-helper is also why I am speccing T018 (§6.3) to land
before T013 rather than after: the adapters will copy whatever mutation-table idiom
they find in `react/test/gate.test.ts`.

---

## 6. Follow-up packages

Phase B's output is three fixes with three different verification surfaces and
three different blast radii. Folding them into one T008 would make a five-defect
package whose failure modes cannot be attributed. Three packages, each a whole
vertical slice.

### 6.1 T008 (respecced) — Windows portability, defect 6, defect 5, and the truth in DEFECTS.md

Full package in the receipt's `worker_package`. Shape: **test, config and doc files
only** — no emitter, no adapter, no generated output, no `src/`. One verification
surface (the full oracle). Fully reversible.

Notable inclusions and exclusions:

- `.gitattributes` is the root fix for causes B, third and fourth. It is one file
  and it is why this is one package rather than three.
- The goldens themselves need **no** change. Their offsets are correct for LF input;
  the checkout was wrong, not the golden.
- The CRLF invariant gets an assertion, per Rule 2.
- Defect 6 gets the corrected guardrail from §1, including the `stateWrites`
  witnessed-failure obligation.
- Defect 5 is a **measurement and a decision**, not an emitter change. The
  measurement runs in the scratchpad, T006-style: emit S2/S3 with plain `value`,
  run the Solid browser lane against it, and see whether the asserted behaviour
  survives. Identical behaviour → `attr:` is unnecessary and the finding is at most
  cosmetic; divergent → `attr:` is required and this is purely solid-js's typing
  gap, the `.d.ts` is correct documentation, and the deliverable is an upstream
  report. Either way, **changing emitted Solid output is out of scope** and needs
  its own package with browser proof — which T008's existing stop_if already says.
- `docs/DEFECTS.md` moves **entirely** to T008, including defect 2's rewrite. See
  `required_board_updates`: T016 currently also lists it, and two packages editing
  the same document across a framing rewrite is how a correction gets silently
  reverted.

### 6.2 T017 (new) — the quiescence instrument

Own package because it is the only one that changes `src/`, it is load-bearing for
99 browser tests, its verification surface is `pnpm test:browser`, and it is on the
critical path for T013 (Svelte will copy `adapter.ts`).

- **objective**: Replace the wall-clock bound over a frame-gated wait in all three
  adapters with a bound on the quantity the loop actually consumes, preceded by an
  in-repo witnessed failure reproducing the verbatim CI error at slow frame cadence,
  and followed by a calibration proving the new loop still throws when the DOM
  genuinely never quiesces.
- **allowed_files**: `packages/frameworks/react/src/adapter.ts`,
  `packages/frameworks/solid/src/adapter.ts`,
  `packages/frameworks/qwik/src/adapter.ts`,
  `packages/frameworks/react/test/adapter-input.browser.test.ts`,
  `packages/frameworks/react/test/adapter-entry.test.ts`,
  `packages/frameworks/solid/test/adapter-entry.test.ts`,
  `.github/workflows/ci.yml` *(comment only, per stop_if)*
- **verify**: `pnpm check`, `pnpm test`, `pnpm test:browser`, `pnpm e2e`
- **stop_if**: need files outside `allowed_files`; you are about to raise the 500 ms
  bound — the instrumented evidence explicitly does not support it and nothing
  settles at any larger number; the new loop cannot be made to throw on a
  genuinely non-quiescing DOM — a settle loop that cannot fail is not a settle loop,
  stop rather than shipping it; the witnessed failure cannot be reproduced in-repo
  at slow frame cadence — report rather than fixing an unwitnessed defect; you are
  about to change any `continue-on-error` **value** (T007 ruled all three stay);
  React or Solid browser lanes regress from 55/55 and 44/44; verification fails
  twice for the same reason.

### 6.3 T018 (new) — the mutation-no-op audit, the Rule 2 fix at corpus scale

Own package because it is ~139 mechanical call sites and because converting them is
itself an audit: any mutation that is *already* a silent no-op on LF will surface as
a throw, and each one then needs individual adjudication. That is unbounded work to
bolt onto anything else.

- **objective**: Replace every `.replace()` mutation construction in the three gate
  test corpora with a helper that throws when the search literal is not found, and
  adjudicate every mutation the conversion reveals to be already vacuous.
- **allowed_files**: `packages/frameworks/react/test/gate.test.ts`,
  `packages/frameworks/solid/test/gate.test.ts`,
  `packages/frameworks/qwik/test/gate.test.ts`
- **verify**: `pnpm check`, `pnpm test`
- **stop_if**: need files outside `allowed_files`; the conversion reveals more than
  two already-vacuous mutations — stop and report, because a vacuous mutation means
  a gate policy has never been tested and that is a finding, not a cleanup;
  you are about to delete or weaken a mutation to make the helper pass;
  verification fails twice.
- **ordering**: before T013. The adapters copy this idiom.

### 6.4 Dependency order

`T008 → T017 → T018 → T009` (Phase C audit) `→ T016 → T010 → T011/T012 → T013`.

T016 must run **after** T008 and with `docs/DEFECTS.md` removed from its
`allowed_files`. T018 must land before T013.

---

## 7. What I could not settle

- **Whether the 29 unaccounted Windows failures share the CRLF root.** My
  fourth-cause hypothesis (emitter freshness comparisons) fits the file count
  well — 4 named files + react/solid/qwik emitter tests ≈ 8 — but it is an
  inference from reading the assertions, not from a Windows log. Only the CI cell
  can settle it, which is why the flag stays.
- **Whether the CI WebKit incident had the frame-cadence cause.** Formally
  unexcluded; see §3. The repair is self-falsifying on the real cell.
- **Whether `records.stateWrites` actually permutes under a realistic rename.**
  `sortWrites` keys on `graphNodeId`, so it should; T006's 200-run sweep did not
  report it at top level, which may mean its generated programs rarely write to two
  differently-named nodes. T008 must witness it or exclude it, not assume either.
- **Whether `module.exports` (`build.ts:464`, sorted by `exportedName`) can be
  permuted by the rename invariant.** Renames target locals, so probably not
  reachable — but "probably not reachable" is the shape of assumption this audit is
  about. T008 cites or excludes.
