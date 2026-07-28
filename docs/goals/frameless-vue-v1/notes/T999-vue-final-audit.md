# T999 — Vue lane final audit (third pass)

**Verdict: `complete`. `full_outcome_complete: true`.**

Read at `fecd97f`. `pnpm e2e`, `pnpm test:browser` and `pnpm mutate:corpus` were **not** run — a 48-cell
mutation run is live and `packages/frameworks/*/generated/` is in motion. Every path in that class was
read at `git show fecd97f:<path>` for a stable view. `pnpm test` was re-run by this Judge and is green.
The PM's `fecd97f` e2e figures are the oracle of record.

This pass certifies rather than re-derives, but it re-measured every number it relied on. Two of
T009's deciding measurements and both re-enumerated domains were reproduced from scratch.

---

## 1. The flagship-sugar clause — DISCHARGED, and the discharge was checked, not accepted

### 1.1 Both limbs are ruled, each on its own grounds

`docs/emitter-idiom-policy.md` carries **12a** (`v-model` on an emitted host, `:1224`) and **12b**
(`defineModel()`, `:1308`), each with a full independent six-gate scoring, each **DENIED**, each naming
**Gate 5** as the deciding gate with 3, 4 and 6 denying independently.

The rejection trigger — "any limb still citing another entry's grounds" — **does not fire**:

- **Template limb**, `src/gate/index.ts:1013`. Cites worked example 12a. Names worked example 3 **only
  to disclaim it** ("do not read it as worked example 3, which rules a different macro (defineEmits)")
  and names Gate 2 only to disclaim it ("do not read it as denied at Gate 2, which it PASSES").
- **`defineModel` limb**, `:1057`. Cites worked example 12b. Its one mention of worked example 4 is
  *"That is the Vue instance of worked example 4 Angular count/countChange, **measured here rather than
  borrowed**"* — an analogy attached to a measurement I reproduced in §1.2, not an imported verdict.
- **`defineEmits` limb**, `:1066`. Worked example 3, which is its own entry.

The borrowed sentence `worked example 3 is already ruled DENIED at Gate 5` has **zero occurrences**
outside board receipts and the `not.toMatch` guard that forbids it.

### 1.2 Both deciding measurements reproduced at `@vue/compiler-sfc@3.5.40`

Independent probe, `compileScript` bindings threaded into `compileTemplate`:

| form | patch flag | errors | tips |
|---|---|---|---|
| `:value` + `@input` (baseline) | `PROPS, NEED_HYDRATION` | 0 | 0 |
| `v-model` **alone** (the adopted candidate) | **`NEED_PATCH`** | 0 | 0 |
| `v-model` + `@input` (combination arm) | `NEED_HYDRATION, NEED_PATCH` | 0 | 0 |

12a's G5 difference (1) holds: adopting the sugar means the handler goes away, and on that form
`NEED_HYDRATION` is genuinely lost. The third row is the arm T011 recorded as its own mis-probe; it
reproduces, and the ruling never claimed it.

12b's G5 collision also reproduces: `defineProps(['initialModifiers','onTrace'])` alongside
`defineModel('initial')` compiles with **0 parse errors** to
`props: _mergeModels(['initialModifiers','onTrace'], {...})`, `emits: ["update:initial"]`, `useModel`
present. The author's declaration is silently overwritten.

G1's exact-empty claim is visible in the same table: 0 errors and 0 tips on baseline **and** candidate.

### 1.3 The oracle's `final_proof` is met on its own terms

It asks for "at least one Vue idiom question run through all six policy gates reaching a non-DEFERRED
Gate 1 and Gate 6". 12a and 12b both record **G1 PASS** and **G6 FAIL**. Neither is DEFERRED. IR-4 is
refuted as a blocker for both limbs — four gates FAIL at the shipped version, and FAIL outranks
DEFERRED. T002's Gate 2 dissent is discharged and its mechanism refuted on a runtime source line.

---

## 2. The oracle — passes, re-read on the current tree

- `scripts/e2e.mjs:39` carries the vue row, `activation: 'hydrate'`.
- `threeWayScenarios` at `:72` is `['s1'…'s7','s9']` — **eight**.
- Equality is **ASSERTED**: `:446-448` diffs each non-reference lane's
  `JSON.stringify(observed[scenario])` against react's, collects mismatches, and `process.exit(1)`s at
  `:471`. `:487` prints "6 demos x 8 scenarios, all observations equal".
- **Nothing weakened.** `git diff a6bd400..fecd97f -- demos/ scripts/` contains no deletion that is not
  a union or total-table widening plus one doc sentence. `servedClientEntry` and `expectedNavigations`
  are still total `Readonly<Record<…>>`; `calibrateServedClientEntry`, `assertServedActivation`,
  `calibrateDevSink` and `assertNoDevDiagnostics` are intact and the Vue box calls all four, with
  `calibrateDevSink` running **first**.
- **Goldens are the activated artifacts, 8/8.** sha256 over `git show fecd97f:` for every
  `generated/S<n>.vue` against its `demos/vue-official/src/emitted/*.vue` copy: identical in all eight
  pairs, with a negative control (S1 vs KeyedTodo differ) and an explicit empty-operand guard, because
  T011's first attempt at this comparison hashed empty strings.
- `pnpm test` re-run by this Judge: **1015 passed / 51 files**, matching the PM figure exactly.

---

## 3. The literal defect — the fix worked, and it proved itself a third time

I re-derived both domains from a `fecd97f` snapshot, with my own walker rather than the shipped one:

- **12a**: **eight** instances — `S2:14`, `S2:32`, `S2:43`, `S3:19`, `S3:27`, `S7:41`, `S7:51`,
  `S7:65` — **one** applicable. S9 contributes zero. The seven non-applicable handlers **all** call
  `onTrace(`, which is the reason the shipped message states.
- **12b**: **nineteen** printed entries (4+2+2+2+2+3+2+2) over **eight** goldens, **six** distinct
  names. S9 adds two entries and no new name.

The shipped gate messages spell exactly these: "eight-scenario corpus … **EIGHT** shipped instances and
the sugar applies to **ONE** … the other **seven** handlers", and "**NINETEEN** printed entries spanning
**six** distinct prop names".

**The correction landed on a witnessed prior failure, and it is provable by construction.** At `48ee449`
the same two messages read "**seven**-scenario corpus … EIGHT shipped instances" and "**seven**-scenario
corpus … **SEVENTEEN** printed entries". Against the eight-scenario corpus, `expectTemplateDomainFigures`
and `expectPrintedPropFigures` do `toContain` on the *derived* spelling, so both go RED — exactly the two
rows the PM reports going red. The whole gate diff in `fecd97f` is **four lines**, two message strings.
That is T012's derivation doing precisely what it was built to do, at the first opportunity it had.

The calibration is genuinely strong, not decorative. `CALIBRATION: the derived domain figures go RED
against a planted eighth scenario` (`gate.test.ts:764`) copies the corpus to a temp root, **asserts the
copy is faithful first** (so the row cannot "go red" because the temp corpus was empty), plants a
scenario inside **both** domains at once, asserts the derivation moves in both, then drives the **real
shipped messages** through the **same helpers** the live rows call and asserts they throw — and
separately asserts throw-on-empty-domain and throw-on-no-goldens.

---

## 4. T012's refusal to derive 12b's "applies to ZERO" — CONFIRMED, and sharpened

T012 deliberately left "applies to ZERO" as a stated ground rather than a derived figure, on the ground
that per-prop write-back has no channel in the IR, so a derivation could only return zero *by
construction*. **That judgement is correct and I uphold it.** A derived zero would be an instrument
that cannot fail, which is the defect the card existed to remove. 12a's "applies to ONE" is decided on
handler AST shape, genuinely varies, and is correctly derived.

**But there is a sharper move available that T012 did not make, and it is worth recording.** The
*ground* beneath the zero is corpus-checkable and **not** vacuous: "every prop entry in every golden
shares one graph node `prop:props`, `writable: false`, zero writes". I verified it **8/8 including S9**.
Today it is asserted only as string containment — `gate.test.ts:715-716` checks that the *message*
contains `prop:props` and `writable=false`. Pinning the *fact* would make 12b's own re-open trigger
("re-open only if the IR gains a per-prop graph node with declared write-back") **self-firing**: the day
IR-1 is closed, the check goes red and the entry demands re-scoring. That is strictly better than either
the literal or the refusal, and it is the one instrument this ruling still lacks.

---

## 5. What remains — three stale counts, and why they do not block

S9 falsified the *unchecked* twins of the two figures T012 instrumented. All three are false at `HEAD`
and nothing derives them:

| site | states | true at `fecd97f` |
|---|---|---|
| `docs/emitter-idiom-policy.md:1317-1321` | "**seventeen** printed entries — S1 four … S7 two", "10 → 15 → **17**" | **nineteen**; S9 two; 10 → 15 → 17 → **19** |
| `docs/emitter-idiom-policy.md:1347` (12b's **G4 scoring sentence**) | "zero of the **seventeen** printed entries" | zero of **nineteen** |
| `packages/frameworks/vue/src/emitter/index.ts` `propsDeclaration` doc | "today **SEVENTEEN** values, six distinct names, **seven** goldens" | **nineteen** / **eight** |

Three further sites carry a stale *scope label* over a claim that is still **true**, which I verified
rather than assumed: `:1232` "seven-scenario corpus" (its **eight instances** are correct at HEAD),
`:1303-1304` "zero of the seven compiler goldens" (`component-reference` is **0 of 8**), `:1350`
"across all seven base goldens" (`prop:props`/`writable:false`/zero writes holds **8/8**).

**No verdict moves.** 12a's live G4 sentence "the sugar applies to **one of eight**" is true at HEAD.
12b's zero holds. Gate 5 decides both entries and no G5 measurement is corpus-sized.

**Why this is not a completion blocker, stated against the T011 precedent it superficially resembles.**
T011 withheld on a *green instrument certifying a false claim in executable, user-facing output* — the
suite passed while a shipped violation message stated a false measured count. That is a proof-integrity
defect and blocking was right. These three are **prose that no instrument claims to check**. Nothing is
green-while-false; the checked half went red loudly and was corrected the same commit. The evidence base
is sound.

And blocking would be the loop rather than the cure. T013 and T014 were already two consecutive
prose-only cards, and a fourth hand-sweep would leave the class exactly as open as this one found it —
S10 falsifies it again. The board already demonstrates the durable pattern **in the same file**:
T014's `stopPropagation` replacement says "**THE SIZE OF THAT CORPUS IS NOT A LITERAL THIS COMMENT
OWNS**", points at the derivation, and is **still true at HEAD** (I re-measured: `stopPropagation` 0 of
8, `preventDefault` 8, all in `s3`). T013's `propsDeclaration` replacement kept "today SEVENTEEN … seven
goldens" and pointed at the derivation — it satisfied its card, but its card's stated *goal* ("so the
next scenario does not silently falsify it again") was not achieved by that means, and the next scenario
falsified it. The repair is therefore mechanical and known: **own no size**, or extend the existing
derivation to assert against those two files. It belongs with **T048 on the umbrella board**, which
already carries six same-class sites, not as a fourth Vue card.

---

## 6. Carried forward, not introduced here

- IR-8 (no prop type field) — named and deferred by T002, unchanged.
- `pnpm e2e` still pins `modes ['dev']` on every lane.
- T007's native-click arm remains jsdom-only; ruled sufficient by the first T999 pass and undisturbed.
- `pnpm e2e` / `test:browser` / `mutate:corpus` were the PM's runs at `fecd97f`, not this Judge's.

## 7. Verdict

- **Flagship-sugar clause: DISCHARGED.** Two entries, six gates each, measured at `vue@3.5.40`, both
  DENIED at G5, G1 and G6 non-DEFERRED, IR-4 refuted, every limb on its own grounds. Two deciding
  measurements reproduced independently by this Judge.
- **Oracle: PASSES.** Vue row present, equality ASSERTED with a non-zero exit, eight scenarios, nothing
  weakened, goldens 8/8 byte-identical to the activated demo copies.
- **Full outcome: COMPLETE.** Vue is a fifth frameless target with proven activation neutrality on
  official tooling, and the flagship sugar has a ruling of record.
