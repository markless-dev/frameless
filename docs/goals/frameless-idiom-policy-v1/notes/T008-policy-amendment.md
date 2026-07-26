# T008 — Judge ruling: the two defects the cold-agent test exposed

Read-only Judge package for `frameless-idiom-policy-v1`. No implementation. The only file this task
wrote is this note.

**Part A** is the ruling. **Part B** is the exact replacement text T009 transcribes into
`docs/emitter-idiom-policy.md`. **Part C** is the T009 Worker package. Only Part B goes into the
policy document.

---

# Part A — Ruling

## A.1 Defect 1 — which artifact is wrong

**The worked examples are wrong. Gate 1 is right.**

Gate 1 already `FAIL`s the absent-framework case, via its own second clause: *"the only evidence
for the equivalence is documentary."* For a framework with no build in this repo, documentary
evidence is the only evidence there can be. The gate is not silent on the case; it swallows it.

Worked example 2 records **`G1 PASS`** and says so out loud in the same breath —
*"documented shorthands, identical compiled output — to be re-measured when a Vue lane exists."*
That is documentary-only evidence, recorded as a pass, in a gate whose entire purpose is that
documentary evidence is not evidence. Worked example 5 records a bare **`G1 PASS`** with no
justification at all. Worked example 4 omits Gate 1 entirely, against the procedure's own
instruction to record an outcome for every gate.

The cold agent read the gate correctly and got `FAIL`. Three of the eight worked examples did not.
The examples are the defect.

## A.2 But `FAIL` is not the right label either — and this is the deeper defect

Correcting the examples to `G1 FAIL` would make the document self-consistent and would make it
**self-defeating**, which is worse.

Gate 6's `DEFERRED` branch reads: *"no lane exists for that framework yet. Emit the baseline and
re-run when it lands."* That branch describes exactly one situation: a framework this repo does not
yet carry. But a framework this repo does not yet carry also has no measurable build — so Gate 1
`FAIL`s, and the procedure's combination rule says *any `FAIL` → no-sugar*, denied.

So under a strict reading, **Gate 6's `DEFERRED` outcome is unreachable for every framework it was
written for.** It is dead text. Every absent-framework question is a denial, and the distinction
the ratification built — deferred, not denied — never fires.

That is the real content of Defect 1: not that Gate 1 is incomplete, but that Gate 1 and Gate 6
disagree about the same fact, and the disagreement silently upgrades every deferral into a denial.

## A.3 The ruling

Worked examples 2, 4 and 5 are corrected. Gate 1's `FAIL` conditions are **not weakened** — they
are re-partitioned, so that the *cause* of the missing measurement is recorded rather than flattened:

- Framework **in** the lockfile, equivalence claimed on documentary evidence → **`FAIL`**, as
  today. The measurement was possible and was not made.
- Framework **absent** from the lockfile → **`DEFERRED — framework absent`**. The measurement was
  not possible.

**Gate 1 can never be `PASS` for an absent framework, and documentary evidence never passes this
gate at any framework, ever.** Stated as plainly as the Judge task asks for it:

> **No sugar for an absent framework can ship, full stop, until that framework has a lane in this
> repo at a pinned lockfile version.**

`DEFERRED` changes **no emitted output anywhere**. It never yields sugar; only all-`PASS` does.
What it changes is the record — "not measured" is a different claim from "measured and it
differed" — and which re-opening rule applies.

## A.4 Defect 2 — Gate 4 with no emitter

**`UNKNOWN` → no-sugar is the right *outcome* wearing the wrong *name*.** No sugar should ship for
a framework whose emitter does not exist; an expansion board asking "should the Vue emitter use
`v-model`?" before a Vue emitter exists does deserve a firm answer. But *denied* asserts that
something was found against the sugar, and nothing was. The correct force is **not yet**, and the
procedure already owns a label for exactly that.

The ruling turns on an asymmetry that is worth naming, because it is what keeps this from being a
blanket excuse: **with no emitter, Gate 4 is falsifiable but not verifiable.**

Worked example 6 proves the falsifiable half. Its `G4 FAIL` was found in
`SyncPolicyBranch.actions` in the IR schema, with no Svelte emitter in existence and none
contemplated. That is a real, decidable, negative finding, and the repair step handled it normally.
Nothing about an absent emitter excuses it.

The verifiable half is not available. "It applies to every instance in the domain" is a claim about
a function that has not been written, whose shape is not fixed. Recording `PASS` there claims a
totality nobody checked — which is precisely the folklore-domain failure the gate's own phrasing
requirement bans, arriving through the back door.

So: counterexample found → `FAIL` (repairable). No counterexample and no emitter →
`DEFERRED — emitter absent`. Never `PASS`.

## A.5 Gate 1 versus Gate 6 — duplication, and whether it is a problem

They do duplicate work for absent frameworks, and it is worth being exact about how much.

For an absent framework the two gates have **the same cause** (no lane) and **the same cure**
(stand one up on the framework's official scaffold at a pinned version). One event resolves both.
They are not independent evidence; they are one fact observed twice.

That redundancy is a **feature, on one condition: that the two gates report the same label.**

- As a feature, it is a cross-check with real teeth. If you ever find yourself writing `G1 PASS`
  next to `G6 DEFERRED`, you have measured against a build this repo does not ship — which is a
  `FAIL` under Gate 1's third clause. Worked example 2 is that exact contradiction, sitting in the
  ratified document, and nobody caught it until a stranger ran the procedure.
- As a defect, it is what A.2 describes: when the labels disagree (`FAIL` here, `DEFERRED` there),
  the combination rule takes the harsher one and the deferral silently disappears.

Hence the coupling clause in Part B: for an absent framework the two gates **must agree**, and
disagreement is diagnosed rather than averaged. The duplication is kept deliberately — collapsing
Gate 1 into Gate 6 would lose the cross-check, and Gate 1 still does independent work the moment a
framework *is* present.

## A.6 Regression check

### H3 — the banked cold-agent case

Angular decorator `@Input()`/`@Output()` (baseline) versus signal-based `input()`/`output()`
(candidate), re-run against the amended gates:

| Gate | Banked (T006) | Amended | Ruling effect |
|---|---|---|---|
| G1 | FAIL — no Angular in lockfile | **DEFERRED — framework absent** | none |
| G2 | PASS | PASS | none |
| G3 | PASS | PASS | none |
| G4 | PASS "provisionally", caveat on `@Input()` setters | **DEFERRED — emitter absent** | none |
| G5 | **FAIL** — reactivity depth, throw behavior | **FAIL** — unchanged | **decisive** |
| G6 | DEFERRED | DEFERRED | none |
| **Ruling** | **no-sugar, denied not deferred** | **no-sugar, denied not deferred** | **unchanged** |

`FAIL` outranks `DEFERRED`, so G5 alone carries it, and it is still *denied* rather than
*deferred*: an Angular lane would not change the answer. **The banked result stands.**

**Stated openly, because T999 should not have to discover it:** the amendment does change one cell
of the banked table — H3's G1 moves from `FAIL` to `DEFERRED`. That is not a retro-invalidation,
for three reasons. (1) The verdict, the decisive gate, and the denied-not-deferred branch are all
unchanged. (2) The T006 scoring band was *"no-sugar on substantially G1 and/or G5 grounds → PASS"*,
and the agent named **G5 as the strongest and least ambiguous failure**; the PASS is earned on G5
alone. (3) The agent and the PM **each independently flagged that exact cell as uncertain** —
whether G1 is properly `FAIL` or `UNKNOWN` when the framework is absent entirely
(`notes/T006-cold-agent.md:68-70`). The amendment resolves an ambiguity both derivations had
already surfaced; it does not overturn a finding either of them relied on.

Had the amendment flipped H3 to sugar or to deferred, it would be the amendment that was wrong.
It does not.

### The Qwik `$`-prop ruling — shipped and implemented

Both amended clauses are conditioned on **absence**. Qwik is present: `@qwik.dev/core@2.0.0-beta.38`
is in `pnpm-lock.yaml`, and worked example 1's G1 was measured on the `qwikVite` bundled in it, on a
real `pnpm --dir demos/qwik build`. Its G4 domain names `emitEvent` in
`packages/frameworks/qwik/src/emitter/index.ts` — a function that exists and shipped in T005.

Neither clause triggers. **Worked example 1 is untouched, its six `PASS`es stand, and the shipped
emitter change is not unruled.** No stop condition is reached.

### All eight worked examples

Lockfile checked directly: **Vue absent** (zero matches), **Angular absent** (zero matches),
**Svelte absent** (the only `svelte` matches are `@sveltejs/acorn-typescript@1.0.11`, an acorn
TypeScript plugin — not the Svelte compiler or runtime). **Qwik, React and Solid present.**

| # | Example | Ruling before | Ruling after | Cells changed |
|---|---|---|---|---|
| 1 | Qwik `$`-prop | sugar | **sugar** | none — framework and emitter both present |
| 2 | Vue shorthands | deferred | **deferred** | G1 `PASS`→`DEFERRED`, G4 `PASS`→`DEFERRED` |
| 3 | Vue `defineEmits` | no-sugar | **no-sugar** | G1 added `DEFERRED`, G4 `PASS`→`DEFERRED`, G6 added |
| 4 | Angular `[(prop)]` | no-sugar | **no-sugar** | G1 added `DEFERRED`, G4 added `DEFERRED` |
| 5 | Angular `@if`/`@for` | deferred | **deferred** | G1 `PASS`→`DEFERRED`, G4 `PASS`→`DEFERRED` |
| 6 | Svelte `onclick` | deferred, after repair | **deferred, after repair** | post-repair G1/G4 →`DEFERRED`; the pre-repair G4 `FAIL` **stands** |
| 7 | Svelte `$props()` | no-sugar | **no-sugar** | G1 added `DEFERRED`, G4 `PASS`→`DEFERRED`, G6 added |
| 8 | React `onChange`/`className` | sugar | **sugar** | none — framework and emitter both present |

**Zero rulings flip. Zero emitted bytes change.** Every correction lands on a gate cell that was
either unearned or unrecorded, and in each case the outcome was already being carried by a gate the
amendment does not touch. That is the result an amendment should produce if it is a repair rather
than a rewrite, and it is the strongest available evidence that this is one.

The one non-mechanical judgement is example 6's **pre-repair `G4 FAIL`, which is preserved
deliberately**. Under a lazier reading of Defect 2, an absent emitter would defer Gate 4
unconditionally and that `FAIL` would evaporate — taking the repair step's only worked illustration
with it. The falsifiable/verifiable split in A.4 exists to prevent exactly that.

---

# Part B — Replacement text (transcribe verbatim into `docs/emitter-idiom-policy.md`)

Six edits, keyed to line numbers in the file **as it stands today**. Each gives the exact text to
replace and the exact text to replace it with. Transcribe; do not improve.

Line numbers shift as you go — work **bottom-up** (B.6 first, then B.5, B.4, B.3, B.2, B.1) or
match on the quoted text rather than the line number.

## B.1 — Outcomes line (line 38)

**Replace:**

```
Outcomes per gate: `PASS`, `FAIL`, `UNKNOWN`, or (Gate 6 only) `DEFERRED`.
```

**With:**

```
Outcomes per gate: `PASS`, `FAIL`, `UNKNOWN`, or `DEFERRED`.

`DEFERRED` is not available at every gate. Gate 6 may always record it. Gates 1 and 4 may record it
**only** for the two specific causes named in those gates — the target framework being absent from
this repo's lockfile, and the target emitter not existing. No other gate may record `DEFERRED`, and
no gate may record it for any other reason. "We did not get to it" is `UNKNOWN`, which is a no.
```

## B.2 — Combination rules (lines 42–46)

**Replace:**

```
- Any `FAIL` → **no-sugar**. Emit the baseline form.
- Any `UNKNOWN` → treat as `FAIL` → **no-sugar**. Unknown is not a tie. It is a no.
- Gate 6 `DEFERRED` with every other gate `PASS` → **no-sugar for now**, recorded as *deferred,
  not denied*. Re-run the procedure when the gate-6 condition is met.
- All six `PASS` → **sugar**.
```

**With:**

```
- Any `FAIL` → **no-sugar**, recorded as *denied*. Emit the baseline form.
- Any `UNKNOWN` → treat as `FAIL` → **no-sugar**, *denied*. Unknown is not a tie. It is a no.
- Otherwise, any `DEFERRED` → **no-sugar for now**, recorded as *deferred, not denied*. Emit the
  baseline form and re-run the procedure when every deferring condition is met.
- All six `PASS` → **sugar**.

`FAIL` outranks `DEFERRED`. One `FAIL` anywhere makes the ruling *denied*, however many gates
deferred alongside it: every deferring condition can later be met and the ruling still not change.
Say in the record which one it is. *Denied* and *deferred* emit the same output — the baseline —
and differ only in what has to happen before the question is worth asking again.
```

## B.3 — Gate 1 `FAIL` conditions (lines 63–66)

**Replace:**

```
`FAIL` if: either form errors or warns; **or** the only evidence for the equivalence is
documentary; **or** the measurement was taken against a different build than the one this repo
ships. A package resolving to a different version, or a differently-packaged copy of the same
tool, is a different build.
```

**With:**

```
`FAIL` if: either form errors or warns; **or** the measurement was taken against a different build
than the one this repo ships; **or** the only evidence for the equivalence is documentary *and* a
build of the target framework is in this repo's lockfile — that is, the measurement was possible
and was not made. A package resolving to a different version, or a differently-packaged copy of the
same tool, is a different build.

**Absent framework.** If no build of the target framework is in this repo's lockfile, this gate is
not askable: record `DEFERRED — framework absent`, naming the framework. Vue, Angular and Svelte
are all absent today.

`DEFERRED` here is **not** a pass and never becomes one on paper. Gate 1 can never be `PASS` for a
framework absent from the lockfile, and documentary evidence never passes this gate at any
framework, ever. The consequence, stated plainly: **no sugar for an absent framework can ship, full
stop, until that framework has a lane in this repo at a pinned lockfile version.** The only thing
`DEFERRED` buys over `FAIL` is an honest record — "not measured" is a different claim from
"measured and it differed" — and that difference matters only to whoever re-opens the question
later.

`DEFERRED` is available at this gate for that one cause and no other. A framework that is in the
lockfile and was simply not measured is `UNKNOWN`, which is a no.

**Coupling with Gate 6.** For an absent framework this gate and Gate 6 have the same cause and the
same cure: no lane exists, and standing one up on the framework's official scaffold at a pinned
version resolves both at once. They must therefore agree. If you find yourself recording `PASS`
here and `DEFERRED` at Gate 6, you measured against something this repo does not ship, and this
gate is `FAIL`.
```

## B.4 — Gate 4, new subsection (insert after line 121, i.e. after the **Repair step** paragraph and before the `### Gate 5` heading)

**Insert, preceded by one blank line:**

```
**Absent emitter.** This gate asks you to name a function that may not exist yet. When there is no
emitter for the target framework, the gate is *falsifiable but not verifiable*, and is scored
accordingly:

- You must still state the domain in the terms that do exist — the IR construct and the **declared
  IR fields** that would trigger the sugar. A domain stated only in framework folklore is `FAIL`,
  absent emitter or not. The phrasing requirement above does not relax; a hypothetical emitter is
  not a licence to describe a hypothetical domain.
- If you can exhibit one construct inside the stated domain where the sugar does not apply — from
  the IR schema, from the compiler, or from the target framework's own rules — that is a real
  `FAIL`. It is decidable without an emitter, and the repair step applies to it normally. Worked
  example 6 below is this case: its Gate 4 failure was found in `SyncPolicyBranch.actions` in the
  IR schema with no Svelte emitter in existence, and the repair narrowed the domain using a
  declared IR field.
- If you cannot exhibit one, you have **not** earned `PASS`. The absence of a counterexample
  against a domain whose deciding function does not exist is not a totality proof — it is the
  folklore domain arriving by the back door. Record `DEFERRED — emitter absent`, naming the
  framework, and re-run when the emitter exists and the domain can be stated against a real
  function.

`UNKNOWN` is the wrong label here and so is `PASS`. `UNKNOWN` converts to *denied*, which asserts
that something was found against the sugar when nothing was; `PASS` claims a totality nobody
checked. `DEFERRED` says what is true: not yet.

As at Gate 1, `DEFERRED` is available for that one cause and no other. An emitter that exists and
whose domain was simply not enumerated is `UNKNOWN`, which is a no.
```

## B.5 — Worked examples 2 through 7

### B.5.1 — Example 2, Vue shorthands (lines 207–211)

**Replace:**

```
G1 PASS (documented shorthands, identical compiled output — to be re-measured when a Vue lane
exists), G2 PASS, G3 PASS (triggered by the binding's structural kind, not its contents),
G4 PASS (every directive use), G5 PASS. **G6 DEFERRED** — there is no Vue emitter and no Vue lane
in `pnpm e2e`. Ruling: baseline until a Vue lane on an official Vue scaffold exists; re-run then.
This is a deferral, not a rejection.
```

**With:**

```
**G1 DEFERRED — framework absent**: no Vue in this repo's lockfile, so the claim that the
shorthands compile identically is documentary, which is a hypothesis and not evidence. G2 PASS,
G3 PASS (triggered by the binding's structural kind, not its contents). **G4 DEFERRED — emitter
absent**: with no Vue emitter, "every directive use" names no function and its totality cannot be
shown; no counterexample is known either. G5 PASS. **G6 DEFERRED** — there is no Vue emitter and no
Vue lane in `pnpm e2e`. No gate `FAIL`s. Ruling: baseline until a Vue lane on an official Vue
scaffold exists; re-run then. This is a deferral, not a rejection.
```

### B.5.2 — Example 3, Vue `defineEmits` (lines 215–219)

**Replace:**

```
G2 PASS, G3 PASS, G4 PASS. **G5 FAIL**: declaring a native event name in `emits` means the
listener responds only to component-emitted events and no longer to native ones, and declared
events are removed from fallthrough `$attrs`. A frameless component with a callback prop named
`onClick` would stop receiving native clicks. That is a behavior change with no diagnostic. G6
would defer anyway; G5 decides it.
```

**With:**

```
**G1 DEFERRED — framework absent**, G2 PASS, G3 PASS, **G4 DEFERRED — emitter absent**.
**G5 FAIL**: declaring a native event name in `emits` means the listener responds only to
component-emitted events and no longer to native ones, and declared events are removed from
fallthrough `$attrs`. A frameless component with a callback prop named `onClick` would stop
receiving native clicks. That is a behavior change with no diagnostic. **G6 DEFERRED.** The three
deferrals do not decide this; G5 does, and `FAIL` outranks `DEFERRED`, so the ruling is **denied,
not deferred** — a Vue lane would not change it.
```

### B.5.3 — Example 4, Angular two-way binding (lines 226–231)

**Replace:**

```
**G2 FAIL**: `[(prop)]` is legal only if the child module declares the prop as two-way capable.
Frameless emits one module per `EnrichedIR`; the parent cannot decide the child's declaration
form. Independently **G5 FAIL**: the implicit change-output name is derived by appending `Change`
to the input name, so a component with sibling props `count` and `countChange` — both legal
frameless props — collides, whereas the baseline uses the author's two names as written.
**G6 DEFERRED** (no Angular lane, and the sugar is version-gated with no target-version input).
Three independent reasons; the ruling is stable.
```

**With:**

```
**G1 DEFERRED — framework absent** (no Angular in this repo's lockfile). **G2 FAIL**: `[(prop)]` is
legal only if the child module declares the prop as two-way capable. Frameless emits one module per
`EnrichedIR`; the parent cannot decide the child's declaration form. **G4 DEFERRED — emitter
absent.** Independently **G5 FAIL**: the implicit change-output name is derived by appending
`Change` to the input name, so a component with sibling props `count` and `countChange` — both
legal frameless props — collides, whereas the baseline uses the author's two names as written.
**G6 DEFERRED** (no Angular lane, and the sugar is version-gated with no target-version input).
Two independent `FAIL`s, which outrank the three deferrals: **denied, not deferred**. The ruling is
stable.
```

### B.5.4 — Example 5, Angular `@if`/`@for` (lines 236–237)

**Replace:**

```
G1 PASS, G2 PASS, G3 PASS (structural template facts), G4 PASS, G5 PASS, **G6 DEFERRED** (no
Angular lane). Ruling: baseline until an Angular lane exists.
```

**With:**

```
**G1 DEFERRED — framework absent**: no Angular in this repo's lockfile, so the only available
evidence is documentary, which this gate does not accept. G2 PASS, G3 PASS (structural template
facts). **G4 DEFERRED — emitter absent.** G5 PASS. **G6 DEFERRED** (no Angular lane). No gate
`FAIL`s. Ruling: baseline until an Angular lane exists. This is a deferral, not a rejection.
```

### B.5.5 — Example 6, Svelte `onclick` (lines 256, and 258–259)

Two edits inside this example. The paragraph at lines 247–252 stating the original **G4 FAIL** is
**not touched** — that failure stands.

**Replace (line 256, the final sentence of the repair paragraph):**

```
IR field, so Gate 3 still passes. Re-run: G1–G5 PASS, **G6 DEFERRED** (no Svelte lane).
```

**With:**

```
IR field, so Gate 3 still passes. Re-run: **G1 DEFERRED — framework absent** (no Svelte in this
repo's lockfile), G2 PASS, G3 PASS, **G4 DEFERRED — emitter absent** (the narrowed domain has no
known counterexample, but with no Svelte emitter its totality cannot be shown), G5 PASS,
**G6 DEFERRED** (no Svelte lane). No gate `FAIL`s: deferred, not denied.
```

**Replace (lines 258–259, the closing paragraph):**

```
This is the example to reach for when a sugar looks nearly right. The repair step distinguishes a
rule stated too broadly (repairable) from a rule that needs to inspect contents (not repairable).
```

**With:**

```
This is the example to reach for when a sugar looks nearly right. The repair step distinguishes a
rule stated too broadly (repairable) from a rule that needs to inspect contents (not repairable).
It is also the example that shows Gate 4 doing real work without an emitter: the original `FAIL`
was found in the IR schema, not in any Svelte emitter. An absent emitter defers Gate 4; it never
excuses it.
```

### B.5.6 — Example 7, Svelte `$props()` (lines 263–267)

**Replace:**

```
G2 PASS, G3 PASS, G4 PASS. **G5 FAIL**: destructured reactive values are not reactive, and
fallback values are not turned into reactive state proxies — so an object or array default is not
equivalent to defaulting at each read site. This matches an existing frameless ruling in the
Solid dossier, which already banned props destructuring for the same reason in a different
framework.
```

**With:**

```
**G1 DEFERRED — framework absent**, G2 PASS, G3 PASS, **G4 DEFERRED — emitter absent**.
**G5 FAIL**: destructured reactive values are not reactive, and fallback values are not turned into
reactive state proxies — so an object or array default is not equivalent to defaulting at each read
site. This matches an existing frameless ruling in the Solid dossier, which already banned props
destructuring for the same reason in a different framework. **G6 DEFERRED** (no Svelte lane).
`FAIL` outranks the deferrals: **denied, not deferred**.
```

## B.6 — Re-opening a ruling (lines 293–297)

**Replace:**

```
- A `FAIL` ruling is re-openable when the fact that caused the `FAIL` changes — a framework
  release, an IR capability, a new standing check.
- A `DEFERRED` ruling is re-run when its gate-6 condition is met, without further authority.
- Re-running means running all six gates again and rewriting the entry. It does not mean
  amending the old outcome.
```

**With:**

```
- A `FAIL` ruling is re-openable when the fact that caused the `FAIL` changes — a framework
  release, an IR capability, a new standing check.
- A `DEFERRED` ruling is re-run when **every** condition that deferred it is met, without further
  authority. Deferrals stack: a ruling that deferred at Gates 1, 4 and 6 is re-run once the
  framework is in the lockfile, the emitter exists, and a lane asserts the behavior — which in
  practice is one event, not three.
- Re-running means running all six gates again and rewriting the entry. It does not mean amending
  the old outcome.
```

## B.7 — What must NOT change

- **Worked examples 1 and 8.** Not one character. Qwik and React are both in the lockfile with
  emitters that exist; neither amended clause reaches them. Example 1 is the shipped Qwik ruling.
- **The pre-repair `G4 FAIL` in example 6** (lines 247–252). It stands, and it is the reason the
  Gate 4 amendment is worded as falsifiable-but-not-verifiable rather than as a blanket deferral.
- **Gates 2, 3, 5 and 6.** No text changes in any of them, including Gate 6's three outcomes and
  its version corollary.
- **All eight ruling headings**, byte for byte. The eight verdicts — sugar, deferred, no-sugar,
  no-sugar, deferred, deferred-after-repair, no-sugar, sugar — are unchanged by this amendment. If
  a heading needs to change, something has gone wrong: stop.
- **No new sections, no amendment-history block, no "see also".** The board's `state.yaml` and this
  note are the amendment trail; the policy document is the current record, not a changelog.
- **No new worked examples.** Example 9 for the H3 case is a live idea, but it is not authorized by
  this ruling and is not T009's to add.

---

# Part C — T009 Worker package

## C.1 objective

Apply the T008 amendment to `docs/emitter-idiom-policy.md` by transcribing the eleven
replace-pairs and the one insert in Part B above, verbatim. This is a **transcription task**, not
an editing task: every "Replace" block has been verified to appear in the policy document exactly
once, byte for byte, so each edit is an unambiguous mechanical substitution. Change nothing the
Judge did not name. Do not improve the wording, do not reflow paragraphs the amendment does not
touch, do not add sections, and do not add worked examples.

Work **bottom-up** (B.6 first, then B.5.6 → B.5.1, then B.4, B.3, B.2, B.1) or match on the quoted
text rather than the stated line numbers, since earlier edits shift later line numbers.

The insert in B.4 goes immediately **before** the line `### Gate 5 — Behavioral neutrality`,
separated from the preceding **Repair step** paragraph and from the Gate 5 heading by one blank
line each.

## C.2 allowed_files

```
docs/emitter-idiom-policy.md
```

One file. That is the whole scope. No emitter, no test, no golden, no board file — the PM owns
`state.yaml`, and the Judge note is already written.

## C.3 verify

No test, config, or lint rule in this repo references `docs/emitter-idiom-policy.md`; it is checked
by nothing. Running `pnpm test`, `pnpm check`, `pnpm test:browser` or `pnpm e2e` against a
markdown-only change would be ceremony, not proof, and they are deliberately **not** in this list.
The real risk here is mis-transcription and unauthorized ruling drift, and the checks below pin
exactly that: every ruling heading, every corrected gate cell, and the two examples that must not
move. Each expected number was computed by simulating this amendment against the current file.

Run all of these and record the output of each.

1. `git diff --stat docs/emitter-idiom-policy.md`
   — exactly one file, and it is this one.

2. `git status --short`
   — `M docs/emitter-idiom-policy.md` and nothing else. Two untracked directories,
   `docs/goals/frameless-testing-ci-v1/` and `docs/goals/frameless-testing-strategy-v1/`, are
   pre-existing and from outside this goal; leave them alone.

3. `grep -c "G1 PASS" docs/emitter-idiom-policy.md` → **exactly 2** (was 4)
   `grep -n "G1 PASS" docs/emitter-idiom-policy.md` → both hits must be inside worked example 1
   (Qwik) and worked example 8 (React). Any `G1 PASS` in examples 2–7 means an edit was missed.

4. `grep -c "G4 PASS" docs/emitter-idiom-policy.md` → **exactly 2** (was 6)
   `grep -n` — again only examples 1 and 8.

5. `grep -c "DEFERRED — framework absent" docs/emitter-idiom-policy.md` → **exactly 7** (was 0)
   One in the Gate 1 body, one each in worked examples 2, 3, 4, 5, 6, 7.

6. `grep -c "DEFERRED — emitter absent" docs/emitter-idiom-policy.md` → **exactly 5** (was 0)
   Seven logical occurrences, of which two are line-wrapped as `emitter` / `absent` across a line
   break (examples 2 and 4) and so do not match a single-line grep. **5 is the correct number**;
   do not reflow those lines to make it 7.

7. `grep -c "G4 FAIL" docs/emitter-idiom-policy.md` → **exactly 1** (unchanged)
   It is worked example 6's pre-repair failure. If this reads 0, the amendment was over-applied
   and Gate 4's absent-emitter rule has swallowed a real finding: **stop**.

8. `grep -c "G6 DEFERRED" docs/emitter-idiom-policy.md` → **exactly 6** (was 4; examples 3 and 7
   gain an explicit Gate 6 cell).

9. Ruling headings byte-identical — the eight verdicts must not move:

   ```
   diff <(git show HEAD:docs/emitter-idiom-policy.md | grep '^### [0-9]') <(grep '^### [0-9]' docs/emitter-idiom-policy.md)
   ```

   Must print nothing.

10. Gate headings byte-identical:

    ```
    diff <(git show HEAD:docs/emitter-idiom-policy.md | grep '^### Gate') <(grep '^### Gate' docs/emitter-idiom-policy.md)
    ```

    Must print nothing.

11. Worked examples 1 and 8 untouched, byte for byte:

    ```
    node -e "const{execSync}=require('child_process');const fs=require('fs');const seg=(t,a,b)=>t.slice(t.indexOf(a),t.indexOf(b));const before=execSync('git show HEAD:docs/emitter-idiom-policy.md').toString();const after=fs.readFileSync('docs/emitter-idiom-policy.md','utf8');const ok1=seg(before,'### 1. Qwik','### 2. Vue')===seg(after,'### 1. Qwik','### 2. Vue');const ok8=seg(before,'### 8. React','## Recording a ruling')===seg(after,'### 8. React','## Recording a ruling');console.log({example1Untouched:ok1,example8Untouched:ok8});if(!ok1||!ok8)throw new Error('worked example 1 or 8 was modified - the shipped Qwik and React rulings must not move');"
    ```

    Must print `{ example1Untouched: true, example8Untouched: true }` and not throw.

## C.4 stop_if

- Any file outside `allowed_files` needs to change.
- A "Replace" block from Part B does not appear verbatim in the policy document, or appears more
  than once. Each was verified unique against the current file; a mismatch means the file moved
  under this ruling. Stop and report — do not fuzzy-match it into place.
- Check 7 reports `G4 FAIL` at 0. Worked example 6's pre-repair failure was destroyed.
- Check 9, 10 or 11 reports a difference. A ruling heading, a gate heading, or worked example 1 or
  8 has moved. Worked example 1 is the shipped Qwik `$`-prop ruling; changing it would unrule
  running code.
- Any verify count differs from the stated expected value and the cause is not obvious and
  mechanical.
- You find yourself rewriting a gate the Judge did not amend. Gates 2, 3, 5 and 6 have **no** text
  changes in this amendment.
- You conclude the amendment would change the outcome of H3 or of any worked example. It does not —
  Part A.6 checks all nine. If you believe otherwise, stop and report rather than adjusting either
  the amendment or the example.
- You want to add an amendment-history section, a "see also", or a ninth worked example. All three
  are explicitly out of scope.
- Any verification fails twice.

## C.5 What T009 must transcribe versus must not touch

**Transcribe:** the eleven Replace→With pairs and the one Insert in Part B, exactly as written,
including emphasis markers, em dashes, backticks and line breaks.

**Do not touch:** worked examples 1 and 8; the pre-repair `G4 FAIL` paragraph in example 6; the
bodies of Gates 2, 3, 5 and 6; the Vocabulary section; the forced-lowering note; the
"Recording a ruling" section; the eight ruling headings; the document title and preamble.
