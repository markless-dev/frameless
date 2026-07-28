# T028 — Phase F audit: is the corpus ENOUGH?

**Verdict: `not_complete`.** Six of the ratified stopping rule's seven clauses are
satisfied *at seven scenarios*, and satisfied well. The clause that is not
satisfied is the count — and the count is wrong in **both** directions. The
evidence says the number is **NINE**, not eight: one scenario T024 folded away
that has since cost a red site, and one scenario (S8) that is blocked on a single
named open defect and must not land while it is open.

Everything below is measured at `fc69860`, tree clean, `HEAD == origin/main`,
`pnpm test` re-run by this audit: **51 files, 1004 tests, all passing**.

---

## 0. What I verified myself, and what I relied on

I am forbidden to run `pnpm e2e`, `pnpm test:browser` or `pnpm mutate:corpus`, so
the discipline is to state precisely which figures are mine and which are the
PM's sole-writer run.

**Mine, re-derived at HEAD:**

| Claim | How |
| --- | --- |
| Tree clean, `fc69860`, in sync with `origin/main` | `git status --porcelain` empty; `git rev-parse HEAD origin/main` identical |
| 1004 tests / 51 files | `pnpm test`, run by this audit |
| Seven scenarios, six lanes each | 7 fixtures, 7 goldens, 7 emitted files × 6 lanes = 42, **all tracked** (`git ls-files`), none ignored |
| 42 mutants exist, one per (lane, scenario) | `MUTANTS` table at `scripts/corpus-mutation.mjs:400-506` — six lane keys × seven scenario keys |
| Every mutant carries a named axis and a named expected red | each factory returns `{ axis, text, expect, apply }`; `report()` prints all four per row |
| Five sampled anchors are **live and unique at HEAD** | `grep -cF` on react S4/S7, vue S5, qwik S6, angular S4 → 1 each |
| Angular ruling 3d has a real instance | `packages/frameworks/angular/generated/S4.ts:20` — `(click)="onH9Click(group, row, $event)"`, outermost first, and the mutant swaps it |
| The mutation surface has **not moved** since the 42/42 run | `git log -- <MUTATION_SURFACE>` newest commit is `97f6062`; the six commits since — including the compiler change `f4d2e01` — moved no golden and no emitted byte |
| `threeWayScenarios` is exactly `['s1'..'s7']` | `scripts/e2e.mjs:65` |
| The 14-name boolean set | `packages/compiler/src/build.ts:221-236`; `nomodule`, `seamless`, `inert`, `muted`, `webkitdirectory` all absent |
| Angular's missing typecheck oracle now exists | `packages/frameworks/angular/test/emitted-typecheck.test.ts`; `async` occurs 8× in the Angular emitter where T031 measured 0 |
| React's async repair is exactly one functional line | `git show fc69860 -- packages/frameworks/react/src/emitter/index.ts`, added non-comment lines: `fn.async = true;` — one line, nothing else |
| Solid's accidental refusal is gone with its reason recorded | `solid/src/emitter/index.ts:1176-1185` documents the removed `\|\| fn.async`; `:828` retains the *legitimate* computed-binding predicate it was mis-cloned from |
| T039's v-limit shipped | `build.ts:987`, `:3050` `assertPortableInteriorWhitespace` |
| T044's refusal shipped and untouched | `react/src/emitter/index.ts:1798`, called at `:1866` |
| T038's Solid-gate ruling landed as a **recorded reason, not a predicate** | `solid/src/gate/index.ts:61-103` is prose; no whitespace rule was added |

**Relied on, not re-derived (and named as such):** the `6 demos × 7 scenarios,
all observations equal` result and the `42 mutants, every one RED, every one
restored` result are the PM's sole-writer run recorded on T030. I did not re-run
them. What I *can* say, and did check, is that **they are still attributable at
HEAD**: nothing in the mutation surface has changed since, so the anchors those
42 cells fired against are byte-for-byte the ones I sampled today.

**One re-run I would accept if offered, and why it is not required:** `pnpm
mutate:corpus --calibrate-classifier`. The 6/6 cross-lane-observation-diff arm
was last measured at T025, before `measureExactText` (S6) and `measureForm` (S7)
joined the observation readers. Its anchor (`data-empty="true">empty<`) is
untouched by both, so I judge the result still standing — but it is the one
figure on this board whose instrument has been extended since it was taken.

---

## 1. The stopping rule, clause by clause, at seven

T024 ratified seven conjuncts. Here is each, with its status.

| # | Clause | Status at seven |
| --- | --- | --- |
| 1 | Eight scenarios exist | **NOT MET** — seven exist |
| 2 | Each lands in **all six lanes** | **MET** for all seven; 42 tracked emitted files, verified by inventory |
| 3 | 48 observation strings byte-identical cross-lane | **MET at 42/42**, short by the missing scenario |
| 4 | 48 recorded mutants, each with a **named red site** | **MET at 42/42**, short by the missing scenario |
| 5 | Harness calibrated **two-sided** on pre-existing s1–s3 | **MET** — 18/18 at the in-box site, 6/6 at the cross-lane site |
| 6 | No two scenarios duplicate a divergence axis | **MET** — seven distinct axes, read off the harness's own `axis` strings |
| 7 | (implicit, and the one that outranks all of them) A mutation cannot survive | **MET at 42/42** |

Clause 6, from the harness's own axis strings rather than from the cards:

- **s1** — derived recomputation after a state transition
- **s2** — the keyed-repeat construct itself: which rows it renders
- **s3** — cancellation of a real default action during dispatch
- **s4** — the nested collection is sourced from the **enclosing** repeat item
  (Angular's cell is a *different* mutant on the same scenario: ruling 3d's
  outermost-first ordering, which had **zero instances** in the repo before S4)
- **s5** — the torn-down arm is rebuilt from **current** state, not the state it held
- **s6** — one text node's edge whitespace, with nothing else changed
- **s7** — a dynamic attribute is dynamic: absent, `"false"` and a value are three states

No duplicates. Each attacks the thing its scenario *claims*, not incidental markup —
and three of them are visibly chosen against the easier alternative and say so in
source (s4 is not a truncation; s5 is not a frozen condition; s7 is not a value change).

### Is the harness an instrument that can fail?

Yes, and this is the clause I pushed hardest on, because "42/42 red" is exactly
the shape of number that four of this goal's six original defects turned out to be.

`scripts/corpus-mutation.mjs` earns the verdict:

- **Positive arm, per lane, per invocation** (`:897`). It takes the clean run
  *itself* and refuses to proceed if a lane is not green **before** any mutation —
  explicitly "never inherited from `pnpm e2e`". A harness that only ever observes
  red cannot distinguish a killed mutant from a broken lane.
- **`SURVIVOR` is a real class** (`:940`) with a real consequence (`:983-991`,
  `process.exitCode = 1`) and an instruction not to patch over it.
- **The second verdict path is calibrated, not assumed.** `CLASSIFIER_CALIBRATION`
  carries `requiredSite: 'cross-lane observation diff'` and the harness **throws**
  if it is caught anywhere else (`:955`). The comment at `:509-532` states the
  reason plainly: eighteen mutants all caught in-box would leave the
  observation-diff branch a verdict path never observed firing, and "a verdict path
  never observed firing is not a verdict path."
- **Preconditions are asserted, not assumed.** `assertCleanSurface()` refuses a
  dirty surface; `replaceOnce` throws unless the anchor occurs **exactly once**;
  `mutate()` throws if the mutant is byte-identical to its input; `restore()`
  verifies the restoration rather than performing it.
- **It reads the same strings `pnpm e2e` diffs.** `readThreeWayResults` was moved
  *into* this file and imported back by `e2e.mjs`, so there is one definition of
  "the observation" rather than two.

That is T007's three instrument rules applied to a harness. I find no way for this
one to report green vacuously.

**Conclusion on the corpus's quality: it is not volume.** The mutation budget is
proven red per lane, per scenario, at HEAD-attributable anchors, by an instrument
with a demonstrated failing mode. If the count were eight, I would close Phase F.

---

## 2. S8 — the ruling, made explicitly, because this is the third pass

This question has now been answered twice and both answers are superseded. I am
recording all three so the next reader inherits the *reasoning*, not the latest
sentence.

**Pass 1 — T031: "S8 is unlandable, structurally."** An async boundary is either
`async`/`await` or a continuation; Solid refuses the first, React miscompiles the
second; therefore the authoring space is empty. **This was wrong**, and the PM
endorsed it to the owner before it was caught.

**Pass 2 — T043: refuted, on measurement.** Valid arithmetic over invalid
premises. Both "structural limits" were one-line bugs. `await ready` on a
**promise-valued prop** already emitted correctly in Qwik, Svelte and Vue. T031
had also misread its own matrix — it recorded Svelte/Vue/Angular as "OK" on the
nested-write authoring, where "OK" meant only "did not throw", and it had checked
none of them; **five** emitters lower nested writes correctly, so React is one
lane of six, not one of two. That single misreading is what made the space look
empty. T043 set the trigger: **Phase F closes at eight if T045, T046 and T047
land with witnessed RED calibrations** — *branch one* — or at seven with a
documented measured refusal if any is refused or fails calibration; and it named
*branch two*, "turns out to require a design change rather than the repair
specified here."

**The repairs landed. All three. In full. With witnessed REDs I checked in
source**, not in receipts:

- **T045 (Angular).** Built the *missing instrument first* — `emitted-typecheck.test.ts`
  now exists alongside React's and Solid's, closing the hole T043 identified as
  worse than the defect (Angular was the only lane emitting TypeScript and
  typechecking none of it). Then carried `arrow.async` onto the class method.
  Three RED calibrations, including one deliberately built because the oracle is
  *provably blind* to async-without-await, which emits valid TypeScript. Entry 9
  **CLOSED**.
- **T046 (Solid).** The accidental `|| fn.async` is gone; `:828`'s legitimate
  predicate — the one it was mis-cloned from — is untouched; the removal's reason
  is recorded at the site. Entry 11 **CLOSED**.
- **T047 (React).** Exactly one functional line, verified by diff: `fn.async = true`.

So **branch one is satisfied on its face.** And S8 still must not land. Here is why,
and the reason is new — neither prior pass names it.

### The measured blocker is in the oracle, not in the emitters

`scripts/e2e.mjs:436-451`:

```js
const [reference, ...others] = officialDemos;
for (const scenario of threeWayScenarios) {
    const expected = JSON.stringify(threeWay[reference.framework].observed[scenario]);
    for (const demo of others) {
        const actual = JSON.stringify(threeWay[demo.framework].observed[scenario]);
        if (actual !== expected) { threeWayDivergences.push({...}); }
    }
}
...
if (threeWayDivergences.length) { ...; process.exit(1); }
```

Strict `JSON.stringify` equality against a **reference lane**, `process.exit(1)`
on any difference, and **no per-lane exception mechanism anywhere**. The reference
lane is `officialDemos[0]` — **react**.

Now put entry 12.2 beside it. It is OPEN and it is **measured**, not predicted,
against real `react-dom` 19.2.3:

|  | react (emitted) | solid (measured) |
| --- | --- | --- |
| while both suspended | `0\|idle` | `0\|pending` |
| after the overlap | `1\|done` | `2\|done` |
| after the third click | `2\|done` | `3\|done` |

Two halves: **(a)** a stale render closure — two clicks produce one increment; and
**(b)** unpredicted, and arguably worse — the authored pre-await write
`phase = 'pending'` is **absent from the output entirely**, because `toConstSsa`
keeps only the final write per cell, which is unsound across an `await`. (b) makes
an authored pending state unrenderable under *any* interaction.

Entry 12.3 forbids the escape: "a single-dispatch assertion passes under both
lowerings and asserts nothing about the axis it exists to test."

So S8 has exactly two landings available today, and both are refused:

- **(a) Land it asserting the divergence.** React's `s8` observation string then
  differs from the other five. `pnpm e2e` exits 1. To keep the suite green the
  harness must grow a per-lane expected-divergence allowance — encoding a **known
  open product defect as expected behaviour** in the repo's strongest instrument,
  and putting the *defective* lane in the reference seat while the five correct
  lanes report as divergent. That is a design change to the oracle, and it would
  be the first exception this project's activation-neutrality claim has ever carried.
- **(b) Land it on one dispatch.** Asserts nothing about its own axis. Forbidden by
  entry 12.3 and by T031's own re-specification ("MUST DISPATCH TWICE, NOT ONCE").

**This is T043's branch two, arriving by a route T043 did not anticipate.** T043
wrote branch two as the case where the axis "turns out to require a design change
rather than the repair specified here." The repairs *were* the right repairs and
they worked. The design change branch two names is **entry 12.2's `toConstSsa`
lowering** — which T043 itself routed to `frameless-emitter-capability-v1`. Branch
two fires on its own terms, without any of the three repairs having failed.

### The word "refusal" would be the third mis-description, so I am not using it

T043's fallback wording was "a documented measured refusal naming lane, file, line
and verbatim message." **Nothing refuses.** All six emitters now accept the
authoring; Solid's throw is gone, React's re-parse survives an `await`, Angular
lowers the modifier and typechecks the result. There is no lane, no line and no
message to name, because there is no error.

The accurate status is:

> **S8 is DEFERRED, not refused and not impossible.** The authoring is emittable
> in all six lanes today. It is blocked by exactly one named, open, measured
> defect — `docs/DEFECTS.md` entry 12.2 — in exactly one lane, and its unblock
> trigger is falsifiable in one command: when entry 12.2 is CLOSED, S8 lands with
> the two-dispatch contract and six byte-identical observations.

That is a materially different claim from T031's ("impossible"), from T043's
branch one ("closes at eight now"), and from T043's branch two as worded
("refused"). Recording it as any of those three would lose the one fact that
matters to whoever picks this up: **the emitters are fixed; the lowering is not.**

---

## 3. Was eight the right number? No. It is NINE.

T024 cut twelve to eight on measurement, and I am checking the cut rather than
inheriting it. Three of its four moves survive; one does not.

**The cut that holds: composition, refs and effects → the capability phase.** T024
overturned its own brief's headline recommendation on the grounds that composition
"could not be shown to KILL anything" — `ComponentPropExpression` and
`PropDestructuringEntry` carry no type, so composition over today's IR would hand
`vue-tsc`, `svelte-check` and Angular `strictTemplates` a population with no
signal. I spot-checked the load-bearing half: the composition guard throws in four
emitters, and the IR node still carries no type. **Correct cut, and it is the
stopping rule applied to itself.**

**The move that measurement has since refuted: the FOLD.** T024 folded proposal 7
— *boolean and dynamic attributes* — into S7 (form controls), turning nine
candidates into eight scenarios. That fold has now cost a red site, twice:

1. **T030 could not author the axis.** The dynamic boolean attribute has **no
   portable spelling** across the six lanes; the shipped S7 fixture substitutes
   `aria-disabled`. S7 therefore asserts a **proxy** for the axis, not the axis.
   (T041 separately ruled `aria-disabled` correct *for the fixture* and refused it
   as author guidance, on accessibility grounds — it leaves the control focusable,
   clickable and submitting while announcing "disabled".)
2. **T041/T049 then proved the construct was MIS-LOWERED, not unspellable**, and
   shipped the lowering: 14 names in `build.ts:221`, admitted by a four-clause
   measured rule, RED-calibrated in **both** directions. Excellent work — and the
   Worker refusing its own ruling's instruction to copy 29 names, catching
   `nomodule` and `seamless` which would have **passed SSR and thrown in the
   browser**, is the sharpest single result in this phase.

And now the consequence. `docs/DEFECTS.md` entry 10 is **OPEN for exactly one
reason**, in its own words:

> the repair is proven **at the compiler and at the emitter and in no served
> payload**. No scenario in the corpus binds a boolean content attribute, so
> nothing yet observes the six lanes agreeing at runtime.

**The repo ships a compiler capability with zero corpus instances.** That is
precisely the condition T024 used to justify landing S4 *first* — "Angular's
ruling 3d specifies outermost-first and the corpus contains no nested loop at
all. **A rule with no instances is folklore.**" The board applied that standard to
ruling 3d, landed S4, and killed the folklore. One scenario later it created a new
instance of the same fault, and the ledger entry that records it names a corpus
card as its own close trigger:

> a corpus card binding a real dynamic `disabled` with a six-lane observation,
> `absent -> disabled=''`, and a per-emitter mutation proven red.

That is **S9**, already fully specified by the ledger. It is blocked by nothing.
T049 removed the only thing that blocked it.

### The number, stated plainly

| | scenarios | observation strings | mutants |
| --- | --- | --- | --- |
| T024 ratified | 8 | 48 | 48 |
| Landed and proven | 7 | 42 | 42 |
| **What the evidence now says** | **9** | **54** | **54** |

- **S9 — dynamic boolean attribute.** Landable *now*. Closes entry 10. Its own
  axis (`present / absent / "false"` on a **content attribute lowered to a
  property**) is distinct from s7's, which tests a `data-*` attribute the lanes
  already agree on — s7 proves the *reader* keeps `null` and `"false"` apart; S9
  proves the *lowering* makes six lanes agree at runtime. No axis duplication.
- **S8 — async handlers.** Not landable until entry 12.2 closes. Its axis is
  untouched by anything else in the corpus.

So eight was wrong in both directions at once: **one too few** (the fold dropped a
scenario whose absence is now a named open ledger entry) and, on this goal's
timeline, **one too many** (S8 cannot land here). That is not a criticism of T024,
which ruled on what was measurable in front of it. It is what checking a cut
rather than inheriting it produces.

---

## 4. Does half 1's oracle extend? NO.

Confirmed on three independent grounds, one of which is the ledger's own text.

1. **T038 ruled it, and gave the reason:** "It belongs in `docs/DEFECTS.md` but
   does **NOT** extend half 1's oracle — half 1 is scoped to the six defects the
   charter named."
2. **T041 followed the precedent** for the boolean attribute rather than reaching
   for it by reflex — it weighed T039 explicitly and found the precedent pointing
   the *other* way on the repair, while still holding on the oracle question.
3. **The ledger says so in entry 10's own header block:** "Like entries 7, 8 and 9
   it was raised by `frameless-defects-and-targets-v1`, so it does **not** extend
   that goal's oracle, which is defined over findings 1–6."

The principled reason, which I want on the record because six new entries is a lot
of new evidence to rule "out of scope": **entries 7–12 are findings produced *by*
this goal's instruments, not inputs *to* its oracle.** Half 1 is defined over the
six defects `frameless-testing-ci-v1` handed this board. Extending it to the
board's own discoveries would make the completion condition a function of what the
goal finds — an oracle that recedes as it is approached, unclosable by
construction, and a direct violation of `goal_pressure_requires_oracle` in spirit
if not in letter. The correct disposition is the one already taken: entries 7, 8,
10 and 12 stay **OPEN with lift triggers**, handed to
`frameless-emitter-capability-v1`. That is a valid terminal state for this goal in
exactly the way "drafted and complete, pending owner" is for the upstream filings.

**Ledger standing at HEAD**, for T999 to certify rather than re-derive:

| entry | standing | why it is where it is |
| --- | --- | --- |
| 1–6 | the charter's six | closed or explicitly ruled; these and only these are half 1 |
| 7 | **OPEN** | contained by a fail-closed v-limit (T039); lift = six lanes measured byte-identical on an interior run |
| 8 | **OPEN** | contained by a fail-closed refusal (T044); lift = React lowers a nested state write as Solid already does |
| 9 | **CLOSED** | removed by lowering, **and the missing oracle built** (T045) |
| 10 | **OPEN** | lowered (T049); needs a **served payload** — that is S9 |
| 11 | **CLOSED** | removed (T046); no served payload yet observes an async handler — that is S8 |
| 12 | **OPEN** | half removed (T047); 12.2 is measured, behaviourally wrong, and **blocks S8** |

---

## 5. Findings versus hiding — the distinction T028 was told to draw

**No mutant survived, and no batch hid anything.** I looked specifically for the
failure mode this constraint anticipates — a Worker quietly not reporting an
unkillable cell — and found the opposite pattern, consistently:

- **T031** reported an impossibility proof that was *wrong*, and reported it with
  enough structure that T043 could refute it in one probe. It also **refused to
  land a partial S8**, correctly reasoning that the derived inventories (T035/T036)
  would enlist a lone golden into every gate in all six lanes and leave `pnpm test`
  red for the next agent. Being wrong loudly and legibly is what let the mechanism
  work.
- **T047** shipped its repair and then reported the defect its own repair
  *uncovered*, including one nobody predicted, and **stopped** at the stop_if
  rather than reaching for the adjacent lowering fix. It filed tests that pin the
  **defect's own numbers** and said, in the entry, that they must go red and be
  rewritten when 12.2 is fixed.
- **T049** refused its ruling's literal instruction and shipped 14 names instead of
  29, catching two that would have passed SSR and thrown in the browser.
- **T045** caught its *own* contaminated probe — a component named `AsyncProbe`
  made the selector `frameless-async-probe` match its own control's negative
  assertion — and nearly filed it as a third defect. It named it as an instrument
  fault instead.

That is four independent instances of the discipline the charter's `likely_misfire`
warns about. The corpus is not weak anywhere I can measure, and nothing was hidden.

---

## 6. One process observation, recorded not carded

Commit `97f6062` carries the message `docs(goals): capability phase gets its own
goal` and contains **the entire S7 corpus landing** — 42 files including all six
`generated/S7.*`, all six demo routes, the fixture, the golden and
`three-way-contract.ts` — squashed together with the capability-goal documents.
Consequently `git log --oneline -- <the mutation surface>` attributes the corpus's
largest single landing to a docs commit, and the commit *named* `feat(corpus): S7
form controls` (`5c79782`) contains only the harness rows and the note.

Not a correctness problem — I verified the files are tracked and the bytes are
right. It is a legibility problem in exactly the layer this board has repeatedly
found faults in: **the record, not the product.** It cost me two probes to
establish that the mutation surface had not moved since the 42/42 run, which is a
fact a future auditor will need again. Worth a sentence in T999; not worth a task.

---

## 7. Ruling

**Phase F: `not_complete`.** The corpus is **excellent and not yet enough**, and
the gap is two named scenarios, not a quality problem.

- **Seven scenarios, six lanes each, 42 byte-identical observations, 42/42 mutants
  red at named sites, harness two-sided calibrated, no duplicated axis.** All
  verified or HEAD-attributable. Nothing here is volume.
- **S8 is DEFERRED, not refused and not impossible.** T031's proof was wrong;
  T043's refutation was right; the three repairs landed in full with witnessed
  REDs. It is blocked by entry 12.2 alone, and by the fact that landing it today
  would require encoding a known open defect as expected behaviour in the
  `e2e.mjs` equality check. **Branch two of T043's trigger fires.**
- **Eight was not the right number. It is nine.** The fold of boolean/dynamic
  attributes into S7 cost a red site, and entry 10 is OPEN naming a corpus card as
  its close trigger.
- **Half 1's oracle does not extend.** T038's precedent holds; entries 7–12 are
  outputs of this goal's instruments, not inputs to its oracle.

**Next Worker slice: S9, the dynamic boolean attribute, in all six lanes, closing
entry 10.** It is the largest reversible local work package available at this
boundary: one coherent vertical — fixture, golden, six emitted outputs, six demo
routes, e2e wiring, six mutants — landing an axis whose repair is already shipped
and whose only missing evidence is a served payload. S8 is not available and no
smaller slice moves the outcome.

`allowed_files` for that package are **copied from the verbatim landed shape of
the previous scenario** (`git show --name-only 97f6062`, S7), with `S7 → S9` and
`FormBoard → AttrBoard`, minus `state.yaml` (PM-owned) and minus the
capability-goal documents that were squashed into that commit. It is not curated
from memory; hand-curated scopes are what this board keeps catching.

**What remains for Phase F, in order:**

1. **S9** (Worker) — landable now, closes entry 10, takes the corpus to 8/48/48.
2. **S8** (Worker) — dispatchable the moment entry 12.2 is CLOSED, takes it to
   9/54/54 and closes the served-payload gap entry 11 also names.
3. **Entry 12.2** (`frameless-emitter-capability-v1`) — React lowers post-await
   reads live and stops collapsing writes a render can be observed between. This
   is the gate on item 2 and it is **outside this goal**, so it must be recorded as
   a cross-goal dependency rather than left to be rediscovered.
4. **T028 re-audit** after items 1 and 2, or a final ruling that Phase F closes at
   **eight** with S8 documented as deferred on a cross-goal dependency — if the
   owner or the PM will not hold this board open for another goal's lowering work.
   That second option is legitimate and I am naming it so the PM has it: **8/48/48
   with S9 landed and S8 deferred on a named external trigger is a defensible close
   of Phase F.** Seven is not, because S9 is landable today and its absence is
   already a filed OPEN defect.
