# T011 — Vue lane re-audit after the two-way-binding fold

**Verdict: `not_complete`.** The flagship-sugar clause **IS discharged** — T009's ruling is real,
measured, and now cites its own grounds in every place it is read. Completion is withheld on one
thing the fold introduced and nobody checked: **the two re-enumerated domain figures were folded in
as literal strings, in a file whose own doctrine forbids exactly that, while the scenario that
falsifies them is landing right now.**

Read at `a6bd400`, tree clean at the time of every probe below. `pnpm e2e`, `pnpm test:browser` and
`pnpm mutate:corpus` were **not** run — the dispatch forbids them while S7 is in flight; the PM's
figures at `a6bd400` are taken as the oracle of record and are consistent with everything I could
verify statically.

---

## 1. The clause the board was withheld on — discharged, and I checked the discharge

### 1.1 The borrowed reason is gone, in all three places it could hide

`grep` for the shipped string `worked example 3 is already ruled DENIED at Gate 5` over the whole
repo returns **exactly one hit**: `packages/frameworks/vue/test/gate.test.ts:432`, where it appears
inside a `not.toMatch` guard. It is nowhere in the gate, nowhere in the policy, nowhere in the
emitter.

The three limbs, read in source:

- **Template (`src/gate/index.ts:1000-1008`)** — 12a's own grounds. Names worked example 3 **only to
  disclaim it** ("do not read it as worked example 3, which rules a different macro"), and adds the
  Gate 2 disclaimer T009 measured.
- **`defineModel` (`:1040-1048`)** — 12b's own grounds. It cites worked example 4 once, and the
  citation is *"That is the Vue instance of worked example 4 Angular count/countChange, **measured
  here rather than borrowed**"*. That is an analogy attached to its own measurement — I reproduced
  the measurement independently (§3.4) — not a borrowed ground. It is the honest inverse of the
  defect: 4's *conclusion* is not imported, 4's *pattern* is named after Vue's own instance was
  measured.
- **`defineEmits` (`:1050-1058`)** — T008's message, and the commit diff proves the "byte-identical
  fold" claim mechanically: `git show 6190058 -- src/gate/index.ts` has **two deletion lines total**
  (the borrowed message, and the merged `defineModel || defineEmits` condition). The `defineEmits`
  message produces no diff line at all.

Policy entries 12a (`docs/emitter-idiom-policy.md:1224`) and 12b (`:1300`) each carry a full,
independent six-gate scoring. 12b's mention of worked example 4 is a refutation of the T002 dissent's
*mechanism*, not an import of its verdict.

**No limb cites another entry's grounds. The rejection trigger does not fire.**

### 1.2 The 19 RED calibrations — re-derived, not accepted

T010's receipt claims 19 of 19 message assertions went red against the pre-split strings. I did not
take that on trust; the pre-split strings are recoverable (`git show 6190058^:.../gate/index.ts`),
and every assertion is decidable against them by inspection:

Pre-split template message: `Emitted Vue source uses v-model; two-way binding needs a bindable prop
kind the IR does not have (IR-1) and an emit concept it does not have (IR-2), and worked example 3 is
already ruled DENIED at Gate 5`. Pre-split script message: one template literal fired for
`defineModel || defineEmits`, entirely about `defineEmits`.

| assertion | pre-split outcome | why |
|---|---|---|
| A1–A5 `Worked example 12a`, `NEED_HYDRATION`, `el.composing`, `ssrLooseContain`, `FIVE shipped instances and the sugar applies to ONE` | RED | none of the five tokens exists in the pre-split template string |
| A6 `not.toMatch(/worked example 3 is already ruled DENIED at Gate 5/)` | RED | the pre-split string **is** that sentence, verbatim |
| A7 `denied at Gate 2, which it PASSES` | RED | absent |
| B1–B7 `Worked example 12b`, `mergeModels`, `Modifiers`, `prop:props`, `writable=false`, `FIFTEEN printed entries`, `FAIL outranks DEFERRED` | RED | the pre-split `defineModel` message was T008's `defineEmits` text; none of the seven appears in it |
| D1 `mergeModels` in **exactly** the `defineModel` message | RED | pre-split it appeared in **neither**, so the filter yields `[]` |
| D2–D3 `onTraceOnce` / `silent no-op` in **exactly** the `defineEmits` message | RED | pre-split **both** macros received both tokens — the filter yields two members |
| D4 `NEED_HYDRATION` in **exactly** the template message | RED | absent everywhere pre-split |
| D5 the three grounds are three distinct texts | RED | after `groundsOf` strips `Emitted Vue source calls defineX();`, the pre-split model and emits messages are byte-identical: the set had **two** members |

**19 of 19 confirmed red by construction, independently of the Worker's run.** `vitest run
packages/frameworks/vue/test/gate.test.ts` at `a6bd400`: **42 passed**, matching the receipt.

### 1.3 The two stop_if conflicts — the replacements are stronger, with one omission worth naming

- **Conflict 1 (unsatisfiable).** §9.4 asked the `v-model` row to not match `/worked example 3/`,
  while §9.3(a)'s own prescribed message names worked example 3 in order to disclaim it. T010 pinned
  the **withdrawn justification clause in its exact shipped spelling** instead. That is strictly
  better than the literal guard: the literal one could only have been satisfied by deleting the
  disclaimer, which is the sentence a reader most needs.
- **Conflict 2 (green vacuum).** `expect(emitsMessage).not.toMatch(/defineModel|mergeModels/)` passes
  against the pre-split gate too — it can never distinguish. The replacement,
  `all.filter(includes('mergeModels')) === [modelMessage]`, asserts presence in one limb **and**
  absence in the other two, and goes RED pre-split. **Strictly stronger and calibratable.** The same
  reasoning gives D2/D3, which are the sharpest rows in the file: pre-split, both macros received
  `onTraceOnce` and `silent no-op`, so the exclusivity form states the defect as one assertion.
- **An omission, minor and not a defect in the result.** §9.4 requirement 2 also asked that the
  `defineModel` message not match `/defineEmits/`. That guard is **unsatisfiable for the same reason
  as conflict 1** — §9.3(b)'s prescribed message says "It is NOT worked example 3, which rules
  defineEmits" — so dropping it was right. T010's note calls it "two stop_if conflicts"; it was
  three, and the third was silently absorbed rather than recorded. No consequence for the ruling.
- **The one green-both-ways assertion is handled correctly.** `twoWayMessage`'s `toHaveLength(1)` is
  a precondition, and it is calibrated against a known member: a mutant calling **both** macros draws
  two violations, and the helper is asserted to *reject* it (`rejects.toThrow`). That is instrument
  rule 4 satisfied, not cited.

### 1.4 What in T010's receipt was reported rather than measured

The PM already caught the wrong `test:browser` figures. Everything else in that receipt that is
statically checkable, I checked, and it holds:

- gate diff is exactly two deletions (§1.1);
- the emitter diff is **comment-only** — `git show 6190058 -- src/emitter/index.ts` is a single
  13-line addition inside `propsDeclaration`'s doc comment;
- **no emitted golden moved** — `generated/` appears nowhere in the commit's diffstat, and all six
  Vue goldens are byte-identical to the demo copies today (§2.2);
- `component-reference` occurs **0 times in all six** compiler goldens (re-counted).

One receipt claim I could not verify and did not try to: the `pnpm e2e` observation block being
byte-identical to the `8af8ed1` capture. The fold changes no emitted byte, which makes it plausible,
and the PM re-ran the suite at `a6bd400`.

---

## 2. Certifying T999 — spot-checks, and one of my own instruments failed first

### 2.1 The oracle, re-read on the current tree

- `scripts/e2e.mjs:39` still carries the vue row (`activation: 'hydrate'`).
- `threeWayScenarios` is now **six** (`:65`), matching the PM's "6 demos × 6 scenarios".
- Equality is still **asserted**: `:438-452` diffs every non-reference lane's
  `JSON.stringify(observed[scenario])` against react's and `process.exit(1)`s at `:461-465`.
- Anti-vacuity intact in `scripts/corpus-mutation.mjs:613-643` — `readThreeWayResults` throws on a
  non-`passed` box, on a missing `three-way-results` note, on an activation mismatch, and on **any
  required scenario with no observations**.
- **Nothing weakened.** `git diff 41aaed0..a6bd400 -- demos/react-official/three-way-contract.ts`
  deletes only the scenario-union lines (`'s1'|…|'s4'` widened to s6) and the assertion table's type
  line; `servedClientEntry` and `expectedNavigations` are still total `Readonly<Record<…>>`. The Vue
  box diff is **two lines**: the paths table gains `s5`/`s6`, and the box name. `calibrateDevSink`,
  `assertNoDevDiagnostics` and the planted-mismatch control are untouched.

### 2.2 Goldens really are the activated artifacts

Six pairs hashed `generated/S{1..6}.vue` against `demos/vue-official/src/emitted/*.vue`: **6 of 6
identical**, with a negative control (S1 vs S2 differ). **My first attempt at this returned six
"IDENTICAL" lines from six comparisons of empty strings** — a shell quoting fault that made the
instrument unable to fail. I caught it only because the missing-file noise leaked to stderr. Recorded
because this audit's own first instrument was a green vacuum, in a repo whose standing rule 3 is
about exactly that.

### 2.3 T999's spot-checks, re-measured over the corpus that has since grown

- **T006's inventory contract, now over six goldens.** Zero `v-bind:`, zero `v-on:`, zero `#`, zero
  `.prop`, zero modifiers in **all six** emitted files. T999 verified this over four; S5 and S6 did
  not break it.
- **T006's gate-fooling defect still reproduces.** `.checked="checked"` compiles at 3.5.40 with
  **0 parse errors, 0 template errors, 0 tips**. My first control (`:value="text""`) reported
  **0 errors** — i.e. it did not calibrate anything — so I replanted with a bad expression
  (`1 / 1 / 0`) and an unclosed tag (`1 / 2 / 1`). The probe demonstrably fails; the `.prop` green is
  real. The frameless `rawName` policy is still the only thing separating that form from `:`.
- **T007's premise, read off shipped output.** `generated/S1.vue` declares `onTrace` in
  `defineProps([...])` and calls `props.onTrace(` **unguarded** — no `?.` anywhere. The G5 throw arm
  stands without a Chromium re-take, as T999 ruled.

### 2.4 The re-enumerated domains — both re-derived from scratch

**12a.** Parsed all six emitted `.vue` files with `@vue/compiler-sfc@3.5.40` and walked for elements
carrying both a `bind` directive named `value`/`checked` and an `on` directive:

| golden | line | tag | binding | event | handler |
|---|---|---|---|---|---|
| S2 | 14 | input | value | input | `(event) => draft = event.currentTarget.value` — **nothing else** |
| S2 | 32 | input | value | input | alias write + re-slice + `onTrace(...)` |
| S2 | 43 | input | checked | change | copy + alias write + `onTrace(...)` |
| S3 | 19 | input | value | input | assign + `onTrace(...)` |
| S3 | 27 | input | checked | change | assign + `onTrace(...)` |

**Five, S5 and S6 contributing zero, and exactly one bare assignment.** "One of five" holds, and the
lines match T010's table exactly. No golden contains a `v-model`.

**12b.** Counted `props.entries` across the six compiler goldens **and** cross-read the six emitted
`defineProps([...])` arrays: S1 4, S2 2, S3 2, S4 2, S5 2, S6 3 = **15 printed entries**, **6 distinct
names** (`label`, `multiplier`, `visible`, `onTrace`, `seed`, `initial`). The pre-S5/S6 count was
4+2+2+2 = **10**, so the "10 → 15, distinct-name 6 unchanged" claim is exact.

**IR-1's measured content, six for six:** every golden's prop bindings reduce to a single graph node
`prop:props`, `writable=false`, `writes=0`.

---

## 3. Spot-checking the ruling itself, since the deciding gate carries the whole clause

### 3.1 The patch-flag claim — I nearly filed it as false, and the fault was mine

12a's G5 difference (1) says the element **loses `NEED_HYDRATION`**: `40 /* PROPS, NEED_HYDRATION */`
becomes `512 /* NEED_PATCH */`. My first probe, replacing `:value="text"` with `v-model="text"` in
S3 while **leaving the `@input` handler in place**, produced `544 /* NEED_HYDRATION, NEED_PATCH */` —
the flag retained. Re-probed across spellings with real `compileScript` bindings:

| form | patch flag |
|---|---|
| `:value` + `@input` (baseline) | `40 PROPS, NEED_HYDRATION` |
| `v-model` **alone** (the adopted candidate) | **`512 NEED_PATCH`** |
| `v-model` + `@input` (the G1 combination arm) | `544 NEED_HYDRATION, NEED_PATCH` |
| `:value` alone, no listener | `8 PROPS` |

**T009 is right.** Adopting the sugar *means* the handler goes away — the gate message says so in the
same breath ("v-model generates `$event => ((x) = $event)` and nothing else") — and on that form
`NEED_HYDRATION` is genuinely lost. My 544 was the combination arm, which the ruling never claims. It
also shows *why* the flag is lost: it came from the template listener, which is difference (2)'s
subject. Recorded because a Judge that reports its own mis-probe as a finding is how this board's
four "right verdict, wrong reason" episodes started.

### 3.2 The checkbox SSR difference — reproduced

Baseline SSR output contains no `ssrLooseContain`; the `v-model` checkbox candidate contains both
`Array.isArray` and `ssrLooseContain`. The served-markup change is real.

### 3.3 12b's deciding measurement — reproduced

`defineModel('initial')` alongside `defineProps(['initialModifiers', 'onTrace'])` compiles at 3.5.40
to `props: _mergeModels(['initialModifiers', 'onTrace'], { "initial": {}, "initialModifiers": {} })`
plus `emits: ["update:initial"]` plus `useModel`, with **0 parse errors**. The silent collision is
exactly as ruled.

### 3.4 Gate 1 and Gate 6 resolve non-DEFERRED

The oracle's `final_proof` asks for a Vue idiom question reaching a **non-DEFERRED Gate 1 and Gate 6**.
12a and 12b both record **G1 PASS** (measured, with a planted control that reports) and **G6 FAIL**.
Neither is DEFERRED. **The tranche's second clause is met on its own terms.**

---

## 4. Why completion is still withheld

Two findings. The second is the one that blocks.

### 4.1 Minor: every emitter line citation in the fold is off by 13, and the fold did it

`git show 6190058^` vs HEAD:

| symbol | cited | actual at HEAD |
|---|---|---|
| `propsDeclaration` | `:400` (policy `:478` **and** `:1308`) | **413** |
| `eventAttribute` | `:730` | **743** |
| `attributesOf` | `:753` | **766** |
| `renderHost` | `:815` | **828** |
| `renderNode` / its throw | `:921` / `:934` | **934** / **947** |

Every one is `+13` — the exact length of the comment block T010 added above `propsDeclaration`. T010
re-read all five at HEAD, found them correct, corrected §9.1's `:935`→`:934`, and then invalidated
all of them with its own insertion. Worked example 3's long-standing `:400` citation was collateral.
Severity is **low**, because every citation names the symbol beside the ordinal and the symbol is
correct — a reader greps and lands. Recorded, not blocking.

### 4.2 Blocking: the re-enumerated figures were folded in as literals, and S7 falsifies them

`packages/frameworks/vue/test/gate.test.ts` opens with a doctrine, in its own words:

> *"THE SCENARIO INVENTORY IS DERIVED, NOT RE-LITERALLED. … A literal that must be edited once per
> scenario is the same defect one scenario later, and four more scenarios are queued."*

That derivation landed six commits earlier, in `1bb0552` — *"derive every corpus inventory, and one
of them was passing falsely"* — which converted thirteen hardcoded corpus facts repo-wide after
finding one **green while covering three of four**.

T010's three new rows then wrote corpus counts back in as **string literals**:

```
expect(message).toContain('FIVE shipped instances and the sugar applies to ONE')   // gate.test.ts:430
expect(message).toContain('FIFTEEN printed entries')                              // gate.test.ts:462
```

and the shipped gate messages state the same numbers. **These assertions test string containment
against a constant. They cannot go red when the corpus grows.** The policy entries carry the same
counts with no pin at all.

This is not hypothetical. **S7 is landing across all six lanes right now**, and its own card
(`frameless-defects-and-targets-v1` T030) reads: *"Land S7 **FULL FORM CONTROLS** folded together
with **BOOLEAN AND DYNAMIC ATTRIBUTES** across all SIX targets."* Form controls are 12a's domain
definition — a host with a `value`/`checked` binding and a same-host event — and any new prop moves
12b's entry count. That same card's stop_if says:

> *"The corpus INVENTORIES are derived and should pick S7 up with ZERO edits. **If any needs a hand
> edit, that is a defect in the derivation and a FINDING.**"*

The morning after S7 lands, `packages/frameworks/vue/src/gate/index.ts` will tell a user, in a
user-facing violation message, that the domain holds FIVE instances and FIFTEEN entries — and the
gate suite will be green. **A false measured claim in the `no-two-way-binding` message, silently
green, is the precise defect T008, T009 and T010 were spent removing from that exact string.** T010's
own note names the standard it fell to: *"A count folded into the policy that was true of a
different corpus is exactly the stale-label fault worked example 3 exists to record."*

That is why this is a completion blocker rather than a carried-forward note: the clause is discharged
by a fold that is **stale by construction**, with the falsifier already in flight, and the board's own
ratified pattern for the fix already exists in the same file.

---

## 5. What is owed, and it is one slice

Make both figures **derived and fail-closed**, and re-point the drifted ordinals. Concretely: derive
12a's domain by walking the six emitted `.vue` templates for `value`/`checked` bind + same-host `on`,
derive 12b's from `props.entries` across the goldens, and assert the numbers spelled in the shipped
messages **equal the derived counts** — with the derivation throwing on an empty result and a red
calibration proving it moves. Same shape as `1bb0552`, same file, no ruling touched.

**What must not change:** the 12a/12b verdicts, their deciding gate (G5), the four exclusivity
assertions, or a single emitted byte. This is a durability fix, not a re-ruling.

---

## 6. Verdict

- **Flagship-sugar clause: DISCHARGED.** Six gates scored against `vue@3.5.40` for both limbs, G2–G5
  before IR-4 appears, both DENIED at G5 with G3/G4/G6 independent, G1 and G2 PASS, IR-4 refuted as a
  blocker. The T002 dissent is discharged and its mechanism refuted on a runtime source line. Every
  limb cites its own grounds in policy, gate message and test. Oracle `final_proof` satisfied:
  non-DEFERRED G1 and G6.
- **Oracle: PASSES**, re-read on the current tree; nothing weakened; goldens are the activated
  artifacts, 6/6.
- **Full outcome: NOT COMPLETE**, on §4.2 alone — one bounded, verifiable, imminent defect with the
  repair pattern already ratified in this repo.
