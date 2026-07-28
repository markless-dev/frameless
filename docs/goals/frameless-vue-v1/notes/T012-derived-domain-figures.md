# T012 — the two `no-two-way-binding` domain figures, derived and fail-closed

**Both numbers moved.** T011 predicted S7 would falsify them and it did, in both directions it
named. Re-enumerated over the settled **seven**-scenario corpus (S7 landed at `5c79782`; S8 was
measured unlandable, so seven is the corpus):

| figure | T009 (4 goldens) | T010 (6 goldens) | **T012 (7 goldens)** | moved? |
|---|---|---|---|---|
| 12a shipped instances | 5 | 5 | **8** | **YES, +3** |
| 12a instances the sugar applies to | 1 | 1 | **1** | no |
| 12b printed prop entries | 10 | 15 | **17** | **YES, +2** |
| 12b distinct prop names | 6 | 6 | **6** | no |
| scenario count | 4 | 6 | **7** | **YES** |

The two figures T010 folded in as string literals — `'FIVE shipped instances and the sugar applies
to ONE'` and `'FIFTEEN printed entries'` — were **both false at HEAD before this task**, and the
gate suite was **green**. That is the defect this card exists to remove, exhibited rather than
argued.

---

## 1. What was measured, and how

### 1.1 12a — hosts with a `value`/`checked` bind and a same-host `on` directive

Every emitted `S<n>.vue` parsed with `@vue/compiler-sfc@3.5.40` (`parse`), walked for
`NodeTypes.ELEMENT` carrying **both** a `bind` directive whose `arg.content` is `value` or `checked`
**and** an `on` directive. That is worked example 12a's own domain definition, read off the artifact
the entry is about.

| golden | line | tag | binding | event | inside the sugar's reach? |
|---|---|---|---|---|---|
| S2 | 14 | `input` | `value` | `input` | **YES** |
| S2 | 32 | `input` | `value` | `input` | no |
| S2 | 43 | `input` | `checked` | `change` | no |
| S3 | 19 | `input` | `value` | `input` | no |
| S3 | 27 | `input` | `checked` | `change` | no |
| **S7** | **41** | `input` | `checked` | `change` | no |
| **S7** | **51** | `input` | `checked` | `change` | no |
| **S7** | **65** | `input` | `checked` | `change` | no |

**Eight instances, one applicable.** S7 contributes three (two `name="s7pick"` radios plus the
`v-for` tag checkbox); S5 and S6 still contribute zero. S7's `<select>` and `<textarea>` are **not**
in the domain — they carry `:data-size` / `:data-notes`, not `value`.

"Applicable" is decided on the handler's **AST**, not on a substring: `v-model` generates
`$event => ((x) = $event)` and nothing else, so a handler qualifies only when it is an arrow whose
entire body is an assignment of its own event parameter's `currentTarget.value`/`.checked`. Only
`S2.vue:14` (`(event) => draft = event.currentTarget.value`) qualifies. **All seven others call
`props.onTrace(...)`**, which the shipped message states as its reason — so that clause is asserted
too, not just the count.

**My own first instrument was wrong and I caught it before it reached the gate.** The scratch pass
classified "does strictly more" by testing a **truncated** 90-character handler snippet for
`onTrace`, and reported four bare handlers including `S2.vue:32` — which does call `onTrace`, 130
characters in. T011's table was right and my probe was not. The shipped derivation reads
`on.exp.content` in full and decides on the parsed AST, which cannot be fooled that way. Recorded
because a count taken off a truncated string is the same class of fault as a count taken off a stale
corpus.

### 1.2 12b — `PropDestructuringEntry` values printed into `defineProps([...])`

Counted over `packages/compiler/test/goldens/s<n>-*.json`, `components[].props.entries`, which is
what `propsDeclaration()` prints (one string literal per entry, `entry.path[0]`).

S1 4 + S2 2 + S3 2 + S4 2 + S5 2 + S6 3 + **S7 2** = **17 printed entries**, **6 distinct names**
(`label`, `multiplier`, `visible`, `onTrace`, `seed`, `initial`). S7 declares
`defineProps(['seed', 'onTrace'])` — two more entries, no new name — so the entry count moved and
the distinct-name count did not, exactly as it did across S5/S6.

---

## 2. The fix: derived, spelled, and fail-closed

`packages/frameworks/vue/test/gate.test.ts` now carries `deriveTwoWayHostDomain()` and
`derivePrintedPropEntries()`, both taking a `CorpusRoots` so a calibration can point them at a
throwaway corpus, and both **throwing on an empty result**. `spelled()` maps a count to the word the
shipped messages use and **throws out of range** rather than silently falling back to digits — a
digit fallback would make the assertion unsatisfiable against a message that spells, which reads as
"the gate is wrong" when the truth is "the table is short".

Two assertion helpers replace the two literals:

- `expectTemplateDomainFigures(message)` — asserts the message spells the derived instance count and
  applicable count, spells the remainder (`the other seven handlers`), asserts every non-applicable
  handler really does call `onTrace(`, and asserts the scenario count in `seven-scenario corpus`.
- `expectPrintedPropFigures(message)` — asserts `SEVENTEEN printed entries spanning six distinct
  prop names` and the same scenario count.

The messages **still state their numbers**. Softening to "several instances" was available and is
refused: the claim is what lets a reader audit the ruling, and deleting a claim is not the same as
checking it.

**Same pattern as `1bb0552`, same file** — `scenarioCorpus` was refactored onto a shared
`scenarioGoldens(goldenRoot)` so there is now one enumeration of the corpus in this file rather than
two, and its `throw`-on-empty moved with it.

---

## 3. RED calibration (required before landing) — verbatim

The permanent row is
`CALIBRATION: the derived domain figures go RED against a planted eighth scenario`. It copies the
real goldens and the real emitted files into a temp corpus, **asserts the copy is faithful first**
(otherwise "red" could mean "empty temp dir"), plants an eighth scenario that is inside **both**
domains, and drives the **real shipped gate messages** through the **same** helpers the two rows
above call.

Planted: `s8-planted-calibration.json` declaring one prop entry named `plantedCalibrationProp`, and
an `S8.vue` with `:value="planted"` plus a same-host `@input` handler that calls `onTrace`. Derived
counts move 8 → 9 instances, 17 → 18 entries, 6 → 7 distinct names; the applicable count stays 1.

The `toThrow` wrappers were removed **temporarily** to capture the failure a real eighth scenario
would produce. **Verbatim, 12a:**

```
AssertionError: expected 'Emitted Vue source uses v-model. Work…' to contain 'NINE shipped instances and the sugar …'

Expected: "NINE shipped instances and the sugar applies to ONE"
Received: "Emitted Vue source uses v-model. Worked example 12a rules this form DENIED on ITS OWN
grounds, MEASURED against vue@3.5.40 - … re-enumerated over the seven-scenario corpus it holds
EIGHT shipped instances and the sugar applies to ONE, …"

 ❯ expectTemplateDomainFigures test/gate.test.ts:293:18
```

**Verbatim, 12b:**

```
AssertionError: expected 'Emitted Vue source calls defineModel(…' to contain 'EIGHTEEN printed entries spanning sev…'

Expected: "EIGHTEEN printed entries spanning seven distinct prop names"
Received: "Emitted Vue source calls defineModel(). Worked example 12b rules it DENIED on ITS OWN
grounds, MEASURED against vue@3.5.40. … re-enumerated over the seven-scenario corpus it holds
SEVENTEEN printed entries spanning six distinct prop names, …"

 ❯ expectPrintedPropFigures test/gate.test.ts:310:18
```

The `toThrow` wrappers were then restored and the suite is green at **99 passed**.

**One instrument fault of my own, in the calibration itself.** The first `toThrow` pattern was the
full expected sentence and the row **failed** — vitest **elides the middle of both operands** in an
assertion message, so `NINE shipped instances and the sugar applies to ONE` never appears in the
error text it is asserting about. The pattern is now the derived word plus its noun, with the reason
written beside it. This is the mirror image of a green vacuum: an assertion that could not pass
against the very failure it names.

`deriveTwoWayHostDomain` is separately shown to throw `domain derived EMPTY` against a barren corpus
(one golden, an emitted file with no bindings), and `scenarioGoldens` to throw on a directory with no
`s<n>-*.json` at all.

---

## 4. Citation drift, corrected

T011 measured every emitter citation as `+13` — the length of the doc-comment block T010 inserted
above `propsDeclaration`. **Re-verified at HEAD by `grep -n` on the declarations themselves**, not
inherited:

| symbol | cited | at HEAD | policy sites fixed |
|---|---|---|---|
| `propsDeclaration` | `:400` | **413** | `:478` (worked ex. 3), `:1318` (12b) |
| `eventAttribute` | `:730` | **743** | `:1232` (12a) |
| `attributesOf` | `:753` | **766** | `:1231` (12a) |
| `renderHost` | `:815` | **828** | `:1230` (12a) |
| `renderNode` | `:921` | **934** | `:1304` (12a's stated non-ruling) |
| `renderNode`'s `throw` | `:934` | **947** | `:1304` |

Six sites, all corrected. Also re-counted while there: `component-reference` occurs **0 times in all
seven** compiler goldens, so 12a's stated non-ruling ("zero of the *six*") is now "zero of the seven,
re-counted over S1–S7" and its domain is still empty.

**Standing recommendation, not acted on here because it is outside this card's scope:** a bare line
ordinal in a policy citation is drift-by-construction — this is the second time these six have moved
under an edit to a *comment*. Every citation already names its symbol, which is what keeps severity
low; dropping the ordinal entirely, or generating it, would remove the class.

---

## 5. Two corrections owed to earlier receipts

### 5.1 T010 reported "two stop_if conflicts". There were THREE.

T011 caught this and it is recorded here so it stops being oral history. Section 9.4 requirement 2
prescribed **two** negatives on the `defineModel`/`defineEmits` split:

1. `emitsMessage.not.toMatch(/defineModel|mergeModels/)` — a **green vacuum**, because T008's
   `defineEmits` message folds through verbatim and never mentioned either token, so it passes
   before and after. T010 recorded this one and replaced it with exclusivity.
2. `modelMessage.not.toMatch(/defineEmits/)` — **equally unsatisfiable**, and T010 recorded nothing.
   §9.3(b)'s own prescribed message says *"It is NOT worked example 3, which rules defineEmits"*: the
   message names `defineEmits` **in order to disclaim it**, exactly as the template limb names worked
   example 3 in order to disclaim it. Dropping the guard was **right** — the alternative was deleting
   the disclaimer, which is the sentence a reader most needs — but it was dropped **silently**.

**A dropped requirement nobody wrote down is how a fold quietly narrows a ruling.** The result is
unaffected: the exclusivity assertion `all.filter(includes('mergeModels')) === [modelMessage]` is
strictly stronger than either negative, and all four exclusivity assertions are **untouched by this
task**.

### 5.2 A stale count survives in a file this card could not touch

`packages/frameworks/vue/src/emitter/index.ts:404-405` — `propsDeclaration`'s doc comment, the block
whose insertion caused the `+13` drift — still reads *"fifteen printed `PropDestructuringEntry`
values across the six goldens, six distinct names"*. **Both figures are now false** (seventeen,
seven). The emitter is **not in this task's `allowed_files`**, so it is reported rather than fixed.
It is a comment, not a user-facing message, and the distinct-name count is still right — but it is
the same defect class in the same fold, and it needs one line in a follow-up.

---

## 6. What was deliberately NOT changed

- **No ruling moved.** 12a and 12b are still DENIED, G5 is still the deciding gate for both, G2 still
  PASSES for both, IR-4 is still refuted as a blocker, and every limb still cites its own grounds.
- **The four exclusivity assertions** in `THE SPLIT: each no-two-way-binding limb carries its own
  grounds` are byte-identical.
- **No emitted byte moves.** `git diff --exit-code -- packages/frameworks/vue/generated` is clean.
- **12b's "applies to ZERO" is left as a stated ground, not derived.** It looked like the third
  figure to pin and it is not: 12b's whole ground is that per-prop write-back **has no channel in the
  IR**, so a derivation of "props the component writes back to" can only ever return zero **by
  construction**, never by corpus. Pinning it would have added exactly the instrument-that-cannot-fail
  this card exists to remove. 12a's "applies to ONE" is genuinely corpus-dependent — a new golden
  could ship a bare assignment — so that one **is** derived.
