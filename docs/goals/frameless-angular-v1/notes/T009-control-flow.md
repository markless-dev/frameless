# T009 — Worked examples 4 and 5 re-run against the landed Angular lane

**Verdict in one line.** Worked example 5's baseline/candidate assignment **does NOT invert**. The
board's hypothesis is **refuted on measurement** — and its *conclusion* survives anyway. `*ngIf` /
`*ngFor` is still the baseline, it still compiles **completely clean** at 22.0.8, and the
`@deprecated` tag has **zero** diagnostic force. What changes is the **ruling**, not the
assignment: all six gates now `PASS`, so `@if` / `@for` is **sugar, adopted**, and the shipped
emitter is vindicated. Worked example 4 keeps its ruling and loses all three of its `DEFERRED`
labels.

**The emitter is not indicted.** That is stated up front so nobody reads the length of this note as
suspense, and it is stated *second* to the refutation so nobody reads it as the reason.

---

## 0. The hypothesis this task was handed, and why it is wrong

The card offered: *at the pinned 22.0.8, `NgIf`/`NgForOf` carry `@deprecated 20.0` while the
`Input`/`Output` decorators carry no deprecation tag at all; that asymmetry suggests the re-run
inverts example 5's baseline/candidate assignment.*

It does not, and the reason is embarrassingly simple once stated: **the policy's baseline
definition contains no deprecation limb.** It reads, verbatim:

> **Baseline form** — among the sanctioned forms available at an emission site, the one that
> (a) is valid across the widest range of target-framework versions, and (b) imposes the fewest
> obligations on any party other than the module being emitted.

Deprecation appears in neither limb. A tag cannot move an assignment that is defined over version
range and third-party obligation. The hypothesis reached for the one artifact T005 happened to have
read, and T005 itself flagged that reading as unmeasured in its own `missing_evidence`:

> "Whether `*ngIf` / `*ngFor` produce an actual build DIAGNOSTIC at 22.0.8 is UNMEASURED. Only the
> `@deprecated` JSDoc tag was read, and a tag is not a diagnostic."

I re-measured it rather than inheriting it. **A tag is not a diagnostic, and at 22.0.8 it does not
become one.**

This is the fifth time on this goal that a ruling was found resting on a wrong reason. It is the
first time the wrong reason was in the *task brief* rather than in a prior receipt.

---

## 1. Instruments, and their calibration

Three instruments. All three are two-sided. Nothing in the repository was written; no build was run
in `demos/angular-official`; `pnpm e2e`, `pnpm test:browser` and `pnpm mutate:corpus` were not run.
All scratch files live outside the repo. Sources for `packages/**` were read at `git show abb5e44:`.

### Instrument A — a real AOT compile

`@angular/compiler-cli@22.0.8`'s `performCompilation()`, driven directly, with `typescript@6.0.3`,
against a scratch project whose `node_modules` is symlinked to `demos/angular-official/node_modules`
and whose `tsconfig` carries the demo's own options **plus** an explicit `strict: true` and
`strictTemplates: true` — so the measurement is taken at a setting **at least as strong** as the
lane's. `readConfiguration` was asserted to resolve `strict: true`, `strictTemplates: true`, and to
find all five root files, before any result was read (instrument rule 2).

Four calibration mutants, each producing exactly one diagnostic, proving the instrument reports on
**both arms** and across **three independent diagnostic families**:

| mutant | result |
|---|---|
| M1 `*ngIf` with `NgIf` deleted from the component's own `imports` | `NG8103` (extended diagnostic) |
| M2 candidate `@if` test referencing an unknown member | `TS2339` — `Property 'nosuchmember' does not exist on type 'RenderOnce'` |
| M3 baseline `*ngIf` test referencing an unknown member | `TS2339` — same, on `RenderOnceBaseline` |
| M4 candidate `@for` with `track` deleted | `-995002` — `@for loop must have a "track" expression` |

M2 **and** M3 together are the load-bearing pair: they prove `strictTemplates` is genuinely
type-checking *both* forms, so a clean baseline arm is a measurement and not an unexercised code
path. An instrument that cannot fail is not an instrument; this one fails four ways.

### Instrument B — the lane's applied lint arbiter

`@angular-eslint/eslint-plugin-template@22.1.0` run through `eslint`'s `Linter` with the applied
set **derived exactly as the shipped gate derives it** — `meta.docs.recommended === 'recommended'`.
Calibrated against a known member: a planted `([ngModel])` draws `banana-in-box`, so the harness can
report. A control template with no control flow draws zero, so it is not reporting indiscriminately.

### Instrument C — a two-arm render probe in `jsdom`

Both control-flow forms JIT-compiled into minimal probe components taking the collection or the flag
as an `@Input()`, mounted through `createApplication` + `createComponent` + `ComponentRef.setInput`
+ `ApplicationRef.tick()`, with DOM node identity tracked across four collection mutations.

**This instrument's calibration is the most important thing in this note**, because it began by
lying to me. My first probe drove the shipped `S2` golden's own handlers and reported *no
reordering* — which I nearly wrote down as "the forms are identical". The precondition assertion
caught it: the reorder had not happened at all. The cause is real and worth recording:
**Angular 22's lane is zoneless, so a plain property write marks nothing dirty and
`ApplicationRef.tick()` is a no-op over it** — `markForCheck()` and `detectChanges()` on the
`ComponentRef` did not move it either. Only `setInput` propagates.

I then calibrated the harness against a **known answer already published on this board**: T005's
table says the shipped `S1` renders `kit:2`, and `kit:10` after `setInput('multiplier', 10)` +
`tick()`. My harness reproduces both cells exactly. That is instrument rule 4 — calibrate a
verdict-issuing instrument against a known member — and it is what licenses everything in §4.

---

## 2. Does `*ngIf` / `*ngFor` still compile clean at 22.0.8? — **MEASURED: YES, completely**

Five files compiled together under `strict` + `strictTemplates`:

| file | form | diagnostics |
|---|---|---|
| `S1_candidate.ts` — the shipped golden, **byte-for-byte** | `@if` / `@else` | **0** |
| `S1_baseline.ts` — same file, only change `@if`→`*ngIf` + `<ng-template #else>` + `imports: [NgIf]` | `*ngIf` | **0** |
| `S2_candidate.ts` — the shipped golden, **byte-for-byte** | `@if`, `@for` | **0** |
| `S2_baseline_trackby.ts` — `*ngIf`/`*ngFor` with a synthesized `trackBy` method | `*ngFor` | **0** |
| `S2_baseline_notrack.ts` — `*ngFor` with **no** `trackBy` at all | `*ngFor` | **0** |

**TOTAL: 0 errors, 0 warnings.** Not "0 errors and some warnings". Zero of everything.

The deprecation **is** machine-visible, but only at a tier no build in this repo collects. Asking
TypeScript for *suggestion* diagnostics rather than semantic ones:

```
S1_baseline.ts:        suggestions=2   deprecated-flagged=2   [6385] 'NgIf' is deprecated.
S2_baseline_trackby.ts:suggestions=10  deprecated-flagged=4   [6385] 'NgForOf'/'NgIf'/'NgFor' deprecated
S1_candidate.ts:       suggestions=0   deprecated-flagged=0
S2_candidate.ts:       suggestions=6   deprecated-flagged=0
```

TS code `6385`, `reportsDeprecated: true`. It is an **editor** diagnostic. `performCompilation` does
not collect it, `ng build` does not collect it, and the repo's emitted-typecheck lanes do not
collect it. The control row matters: `S2_candidate` has **6 suggestions and 0 deprecated-flagged**,
so the deprecated count is discriminating rather than a side effect of there being suggestions.

The verbatim tags, re-read at `@angular/common/types/_common_module-chunk.d.ts`:

- `:840` `@deprecated 20.0 / Use the `@if` block instead. Intent to remove in a future major release`
- `:507` `@deprecated 20.0 / The `ngFor` directive is deprecated. Use the `@for` block instead.`
- `:1097` `@deprecated 20.0` on `NgSwitch`

T005's tag reading is **confirmed**. Its inference was correctly withheld, and the withholding was
right: *"intent to remove in a future major release"* is the framework stating, in the same
sentence, that it has **not** removed it. Both classes remain `@publicApi`, exported, and accepted.

**Consequence for the ruling: `*ngIf` / `*ngFor` is still a sanctioned form at 22.0.8.** The
tempting move — declare the sanctioned set a singleton, dissolve the question the way T002 ruling 3e
dissolved `$event`, and never score a gate — is **refused**, and refused on the measurement. A form
the framework's own compiler accepts with zero diagnostics is accepted. The forced-lowering second
trigger is likewise **not** invoked: it is available only where the *current emitted* form is
outside the sanctioned set, and the current emitted form is `@if`/`@for`, which is unambiguously
inside it.

---

## 3. Which form is the baseline? — **`*ngIf` / `*ngFor`, unchanged**

Applying the definition limb by limb.

**Limb (a) — valid across the widest range of target-framework versions.** `*ngIf`/`*ngFor`: valid
from Angular 2.0, and **measured** to compile clean at 22.0.8. `@if`/`@for`: 17.0. **Limb (a)
resolves to `*ngIf`/`*ngFor`.**

**Limb (b) — fewest obligations on any party other than the module being emitted.** `@if`/`@for`:
zero. `*ngIf`/`*ngFor`: an `imports: [NgIf, NgForOf]` entry and an `@angular/common` import — both
in the emitted module's **own** metadata and **own** import list, which Gate 2's settled scoping
paragraph explicitly rules is not a third-party obligation, naming Angular by name. **Limb (b) is a
tie at zero.**

Limb (a) resolves and limb (b) ties, so **the baseline is `*ngIf`/`*ngFor` and `@if`/`@for` is the
candidate sugar.** The assignment in worked example 5 as written is **correct** and stands.

### The observation that nearly inverted it, recorded because it is the strongest argument the other way

The emitted modules **already floor at Angular 19.0**, and not because of control flow. The gate's
own inventory records `component-metadata: '(no standalone key)'` at floor `19.0`, with the comment
"the entry that sets this lane's floor" — the *absence* of a `standalone` key means at 14–18 the
same bytes declare a component needing an NgModule. `ANGULAR_BASELINE_FLOOR` derives 19.0 as the max
over the inventory, and `@if`'s 17.0 is **dominated by it**.

So switching to `*ngIf` would widen the *form*'s range from 17.0 to 2.0 and would widen the emitted
*module*'s range by **exactly zero**. Read at module level, limb (a) ties too, both limbs tie, and
the definition would fail to resolve — which the charter says is a **policy defect to report
upward**.

**I do not rule it that way**, and the reason is textual: the definition's subject is
"**Baseline form** — … the one that is valid across the widest range of target-framework versions".
It quantifies over the *form*, not over the module. `*ngIf` wins limb (a) on the definition as
written. The module-level reading is recorded here because it is genuinely arguable, because it
would change the ruling's *route* (though not, as §4 shows, its destination), and because a future
reader who notices it deserves to find it already considered rather than missed.

---

## 4. Worked example 5 — six gates against the landed lane

Two constructs are bundled in this entry and they are scored together because every gate lands the
same way for both. Where they differ, both cells are given. *(The document's own precedent for
splitting — 2a/2b, 11/11b — was considered and is **not** taken: a split is warranted when the
halves get different rulings, and these do not.)*

Baseline: `*ngIf` / `*ngFor` + `<ng-template #else>` + `trackBy:` + `imports: [NgIf, NgForOf]`.
Candidate: `@if` / `@else` / `@for … ; track …`.

Domain, in emitter terms: every `TemplateNode` of kind `'branch'` reaching `renderBranch()` and
every `TemplateNode` of kind `'keyed-repeat'` reaching `renderKeyedRepeat()` in
`packages/frameworks/angular/src/emitter/index.ts`.

### G1 — **PASS**

Was `DEFERRED — framework absent`. **Discharged** by `@angular/core@22.0.8` in the lockfile, and
Gate 1's own discharge list already names Angular and flags this entry as stale. Both forms measured
through the framework's own toolchain at the exact pinned version: **0 diagnostics each**, four-way
calibrated (§2). Gate 1 asks whether both forms are sanctioned and whether the correspondence was
measured. Both are; it was. Documentary evidence was not used and would not have passed.

The policy's Gate 1 / Gate 6 coupling rule is satisfied: both move to `PASS` together.

### G2 — **PASS**

`@if`/`@for` require nothing of anyone — no import, no plugin, no dependency, no declaration by a
parent or child, nothing from the build graph. Nothing is asked of any third party. (The *baseline*
needs `imports: [NgIf]`, which is self-scoped and would not fail this gate either; the direction
merely favours the candidate.)

### G3 — **PASS**

The trigger is `TemplateNode.kind`, a declared IR structural fact. `renderBranch()` reads only
`node.arms[].kind`, `node.expression` and `node.children`; `renderKeyedRepeat()` reads only
`node.index`, `node.empty`, `node.item`, `node.collection.expression` and `node.key.expression`. No
handler body is inspected, no expression shape is pattern-matched, no author intent is inferred. The
later-pass rider does not engage, because nothing content-based is admitted — and note that the
rider's own worked hazard (`ir.persistence` injecting `__framelessWrite(...)` into handler bodies
during lowering) touches **handlers**, which this decision never reads.

### G4 — **PASS on a narrowed rule**

`DEFERRED — emitter absent` is **discharged and unavailable**: `renderBranch()` and
`renderKeyedRepeat()` both exist and are the deciding functions.

On the domain as stated, counterexamples are exhibitable **from the emitter's own code**, which is
this gate doing real work rather than a formality. `renderKeyedRepeat` refuses a `node.index`
binding and a `node.empty` fallback; `renderBranch` refuses more than two arms and a non-`then`
first arm; `blockBody` refuses a block whose children are not all block-level.

The Gate 4 repair applies and is legitimate, because every narrowing term is a **declared IR field**:
branches with exactly one `then` arm and at most one `else` arm whose arm children are all
block-level, and keyed repeats with no `index`, no `empty`, and an identifier-safe `item`. On the
narrowed rule the sugar is **total** — all **8** control-flow blocks in the shipped corpus at
`abb5e44` take it, with zero refusals: 4 `@if` (three carrying `@else`) and 4 `@for`, across S1, S2,
S4 and S5.

Re-running from Gate 1 on the narrowed rule, as the repair step requires, lands on the same
outcomes; the narrowing changes no gate.

**A count correction, recorded because it is this board's evidence base.** T005's flag reads "ALL
THREE Angular goldens EMIT `@if` AND `@for` TODAY." **Measured false in both quantifiers.** There
are five goldens, not three; **S3 emits neither** `@if` nor `@for` — it has no control flow at all —
and **S1 emits `@if` but no `@for`**. The correct statement is: 8 control-flow blocks across 4 of 5
goldens. This does not change T005's point (the emitter does ship the form the policy defers) and
does not change any ruling, but a re-run that repeated the sentence would have propagated it.

### G5 — **PASS**, and this is the gate that was actually at risk

Measured with instrument C, both arms, same collection mutations, DOM node identity tracked by
tagging live nodes before each mutation:

| mutation | candidate `@for … track x.id` | baseline `*ngFor … trackBy` |
|---|---|---|
| initial | keys `a,b,c` | keys `a,b,c` |
| reverse | keys `c,b,a`, marks `n2,n1,n0` | **identical** |
| replace every item object, same ids | keys `c,b,a`, marks `n0,n1,n2` | **identical** |
| remove the middle row | keys `c,a`, marks `n0,n2` | **identical** |
| prepend a new row | keys `z,c,a`, marks `NEW,n0,n1` | **identical** |

Nodes **move** rather than being recreated under a reverse, and survive a wholesale object
replacement that preserves ids, **identically in both arms**. The `NEW` cell is the two-sided proof
that the identity reader can distinguish reuse from recreation — without it, five rows of "identical"
would be an instrument that only knows how to say yes.

`@if`/`@else` against `*ngIf` + `<ng-template #else>`: stripped DOM **identical in the then state,
in the else state, and after toggling back**.

Two differences were found. Neither is on this gate's failure list, and both are recorded rather
than dropped:

1. **Comment-anchor placement.** In the else state the candidate renders
   `<!--container--><p data-arm="else">…<!--container-->` where the baseline renders
   `<p data-arm="else">…<!--container--><!--container-->`. Comments only; no element, attribute or
   text node differs. Not event routing, initial values, reactivity depth, throw behaviour,
   lifecycle or exports.
2. **Duplicate track keys.** Neither arm **throws** and both render both rows. The candidate emits a
   dev-mode `console.warn` `NG0955` (`@angular/core` `_debug_node-chunk.mjs:14297-14310` — measured
   as `console.warn`, explicitly **not** a throw, inside `if (ngDevMode)`); the baseline is
   **silent**. This is the candidate being *more* diagnostic, and Gate 5 is a neutrality gate rather
   than a quality gate, so direction is irrelevant — but a console warning on a collection the IR's
   key contract does not sanction is not "throw or error behavior", which is what the gate's list
   actually enumerates.

**The one difference I refuse to score, and why.** The `*ngFor` baseline requires a synthesized
public class method — `trackBy` binds a **function** while the IR declares an **expression** — and
the prototypes differ by exactly that name (measured: baseline carries `trackByH6`, candidate does
not). By the letter of "the module's exports" that is a difference. **It is not scored as the
failure**, on this document's own precedent: worked example 1 passes Gate 2 with `$` in the
baseline's own import list, i.e. baseline-only machinery is not charged to the candidate for
removing it. Scoring it the other way produces a plain absurdity — the policy would compel the
emitter to **invent** a class member the IR does not declare, purely so that removing it could be
the reason to forbid removing it.

**Named so the green is not over-read:** *event routing* and *lifecycle* were **not** independently
driven across a control-flow boundary in both arms. What was measured is that both arms render
identical elements with identical bindings and preserve node identity identically, which is the
substrate routing rides on — but that is an inference, not the measurement, and if this cell is ever
challenged the answer is to drive a click through both arms, not to defend this paragraph. The
render probe ran in `jsdom`, not Chromium, deliberately, per the command restriction; T005's
identical caveat applies verbatim, and the correct response to a challenge is to re-run in Chromium
rather than defend `jsdom`.

### G6 — **PASS**, and it is the interesting one

Was `DEFERRED — no lane`. **Discharged** by `demos/angular-official`; `DEFERRED` is unavailable.

The question is *"if this sugar silently regressed, would a check this repo already runs fail?"*
**Measured: yes, and by a third-party-authored rule rather than a frameless opinion.**

`packages/frameworks/angular/src/gate/index.ts` derives its applied `@angular-eslint` set from
upstream's own metadata — `meta.docs.recommended === 'recommended'`. Measured at
`@angular-eslint/eslint-plugin-template@22.1.0`:

```
total template rules: 41
DERIVED: ["banana-in-box","eqeqeq","no-negated-async","prefer-control-flow"]
prefer-control-flow meta.docs.recommended === "recommended"
```

`prefer-control-flow` is **1 of only 4**, and it reports the baseline by name:

```
CANDIDATE @if/@else  (as shipped):  0 messages
CANDIDATE @for       (as shipped):  0 messages
BASELINE  *ngIf/*ngFor           :  3 messages
   [prefer-control-flow] Use built-in control flow instead of directive ngIf.    (x2)
   [prefer-control-flow] Use built-in control flow instead of directive ngForOf.
CALIBRATION planted ([ngModel])   :  1 message  [banana-in-box]
CONTROL plain markup, no control flow: 0 messages
```

**This is the exact inverse of worked example 11's situation, and the contrast is the argument.**
That entry's Gate 6 `FAIL` turned on a measured fact: `@angular-eslint/prefer-signals` prefers the
signal form but upstream keeps it in `all`, not `recommended`, so the applied set is **silent** on a
planted `seed = input()` — "they decided it is an opinion you may opt into." Here upstream made the
opposite call for the opposite form, and the applied set is **loud**. Two rulings, one measurement
each, opposite answers because the measurements are opposite.

A second standing check asserts a second claimed benefit: `@for`'s `track` is **syntactically
mandatory**, asserted by the gate's `parseTemplate` arbiter as an exact-empty error set with a
track-deletion mutation calibration. I reproduced it independently (calibration M4:
`@for loop must have a "track" expression`). Under the baseline, `trackBy` is **optional and its
omission is silent** — measured: `S2_baseline_notrack.ts` compiles with **0** diagnostics.

Third: the gate's `BASELINE_FORM_INVENTORY` pins `control-flow: @if / @else / @for` and
`template-node: IfBlock / IfBlockBranch / ForLoopBlock` as an exact allowlist that goes red on any
unlisted form.

**The reading, stated explicitly because it is contestable.** Gate 6's preamble demands a check that
"exercise[s] the target lane … and assert[s] observable behavior". Read as governing every bullet,
the emitter gate does not qualify and this would be `FAIL`. I do not read it that way, and the
deciding text is **Gate 5's own**:

> "Not a failure: differences in emitted source text, symbol names, chunk counts, or build-artifact
> classification. Those are not behavior. **They may be the reason to adopt a sugar, and as such
> they are adjudicated by Gate 6, which requires them to be measured.**"

Gate 5 *routes* non-behavioural reasons to Gate 6 and states that what Gate 6 demands of them is
**measurement**. A non-behavioural benefit can never be asserted by a behavioural lane check; under
the strict reading Gate 6's `PASS` would be unreachable for the entire class of sugar Gate 5 sends
it, which cannot be the intent of a document that wrote that sentence. The benefit here is measured,
and it is measured by a check `pnpm test` already runs, authored upstream.

**The honest negative, stated plainly, because worked example 11 taught this board to state it:**
`pnpm e2e` would **not** go red on a *competent* switch to `*ngIf`/`*ngFor` — §4's G5 table is
precisely the proof that the two forms are behaviourally indistinguishable. It *would* go red on an
*incompetent* one: dropping `@if` without adding `imports: [NgIf]` yields `NG8103` and renders the
guarded subtree **not at all**, taking `data-scenario="s1"` with it. What pins this form choice is
the emitter gate, not the browser.

### Ruling

**All six `PASS` → sugar.** Worked example 5 moves from *deferred, not denied* to **adopted**. The
shipped emitter is correct, and was correct before this task ran — which is worth saying precisely
because the previous four rulings on this goal that "came out fine" each did so on a reason that did
not survive checking. This one comes out fine on reasons that were measured this session, and the
reason the *board* offered is not among them.

Say which gate carries it: **Gate 6**, and it is the only one that was ever in doubt. Gates 2, 3 and
4 were near-formalities; Gate 1 and Gate 5 were measurements that could have gone the other way and
did not.

---

## 5. Worked example 4 — `[(prop)]` two-way binding: **ruling unchanged, every label stale**

The ruling was already *denied, not deferred* and it stays denied. What is stale is that it carries
**three `DEFERRED`s**, all of which are now unavailable — Angular is in the lockfile and the emitter
exists — and Gate 1's discharge list already flags this entry by name.

- **G1 — `UNKNOWN`, which is a no.** `DEFERRED — framework absent` is **discharged and
  unavailable**. But no `[(prop)]`/`[prop]`+`(propChange)` pair was ever built, because **there is
  no instance to build one from**: the emitter emits one component per `EnrichedIR` and instantiates
  **no child components at all**, so the emission site "a two-way binding on an emitted child" has
  never existed. `PASS` is not earned. This is worked example 11b's G1 verbatim.
- **G2 — `FAIL`. Unchanged, and it never needed a lane.** `[(prop)]` is legal only if the child
  module declares the prop two-way capable. Frameless emits one module per `EnrichedIR`; the parent
  cannot decide the child's declaration form. This is Gate 2's own stated general rule — "This is
  the gate that every framework's two-way-binding sugar fails."
- **G3 — `PASS`.** Declared IR fields; no contents inspected.
- **G4 — `UNKNOWN`, which is a no.** `DEFERRED — emitter absent` is **discharged and unavailable**.
  The domain is **empty** — IR-1 (no bindable prop kind) and no emitted child components. The
  tempting "it applies to all zero of them, therefore total, therefore `PASS`" is the vacuous
  totality worked example 7 refused and 11b named *the folklore domain arriving by the back door*.
- **G5 — `FAIL`. Re-measured at 22.0.8 rather than inherited.** The entry's stated reason is that
  the implicit change-output name is derived by appending `Change`, so sibling props `count` and
  `countChange` — both legal frameless props — collide. **Measured in `@angular/core@22.0.8`:**
  `_debug_node-chunk.mjs:8516` is `return hasInput(directiveDef, name) && hasOutput(directiveDef,
  name + 'Change');` and `:8590` is `outputBinding(publicName + 'Change', …)`. The suffix derivation
  is literal string concatenation at the pinned version. **The reason holds on measurement.** It is
  recorded this way because on this goal an inherited reason has failed four times.
- **G6 — `FAIL`.** `DEFERRED — no lane` is discharged and unavailable. No check can exist for a path
  the emitter refuses to emit — the same clause worked examples 2b, 6 (`on()` arm), 7 and 11b
  record.

Three `FAIL`s and two `UNKNOWN`s → **denied, not deferred.** Say which decides it: **Gate 2**, and
it is the strongest of the three because it is structural — it follows from frameless emitting one
module per `EnrichedIR` and holds at every Angular version, with or without a lane, with or without
IR-1. Gate 5's collision is real and measured but is a naming accident that a different IR could
avoid; Gate 6 is retirable in principle.

**Empty domain → `UNKNOWN`; populated domain with no sound narrowing → `FAIL`.** Example 4's G1 and
G4 domains are empty, so they are `UNKNOWN`. Nothing in example 5 is `UNKNOWN`, because nothing in
it has an empty domain — all 8 instances ship today.

---

## 6. Exact replacement text for a later fold

The two entries below replace worked examples 4 and 5 in `docs/emitter-idiom-policy.md` **verbatim**.
Nothing else in that document changes: Gate 1's discharge list already names Angular, and its
sentence flagging examples 4 and 5 as stale-and-owed must be **edited to record the re-run as
landed**, not deleted — see the fold spec in the receipt.

**Worked example 12a/12b (Vue) cites worked example 4.** Its citation is to example 4's *Gate 2
two-way-binding reasoning*, which is preserved verbatim below, including the sentence it leans on.
The heading text and the ruling word (`no-sugar`) are unchanged, so the citation does not break.

---

### 4. Angular — two-way binding `[(prop)]` on an emitted child → **no-sugar**

**Re-run in full, not amended.** This entry carried three `DEFERRED`s recorded when Angular was
absent from this repo. Every deferring condition is now discharged — `@angular/core@22.0.8` is in
the lockfile and `packages/frameworks/angular` exists — so all six gates were re-run by
`frameless-angular-v1` T009. **The ruling is unchanged and its deciding gate is unchanged. Three
`DEFERRED`s became two `UNKNOWN`s and one `FAIL`, and Gate 5's reason was re-measured rather than
carried forward.**

Baseline: `[prop]="x"` plus `(propChange)="x = $event"`, with the handler as a class method.
Note this baseline is itself a sanctioned Angular form — there is no naive form to fall back to.

Domain, in emitter terms: a two-way binding on a **child component instantiated by the emitted
module**. The emitter emits one component per `EnrichedIR` and instantiates no child components, so
this domain is **empty** — which is what makes two of the six gates unanswerable rather than
passing.

- **G1 `UNKNOWN` — which is a no.** `DEFERRED — framework absent` is **discharged and unavailable**.
  No `[(prop)]` / `[prop]`+`(propChange)` pair was ever built, because there is no instance to build
  one from, so the correspondence was not measured and `PASS` is not earned. Same shape as worked
  example 11b's Gate 1.
- **G2 `FAIL`, and this is the ruling.** `[(prop)]` is legal only if the child module declares the
  prop two-way capable. Frameless emits one module per `EnrichedIR`; the parent cannot decide the
  child's declaration form. This is this gate's own general statement — *this is the gate that every
  framework's two-way-binding sugar fails* — and it holds at every Angular version, with or without
  a lane, with or without IR-1.
- **G3 `PASS`.** The trigger would be declared IR fields; no handler contents and no expression
  shapes are inspected.
- **G4 `UNKNOWN` — which is a no.** `DEFERRED — emitter absent` is **discharged and unavailable**:
  the emitter exists. The domain is empty, and "the sugar applies to all zero of them, therefore
  total, therefore `PASS`" is the vacuous totality worked example 7 refused and worked example 11b
  named *the folklore domain arriving by the back door*.
- **G5 `FAIL`, re-measured at the pin rather than inherited.** The implicit change-output name is
  derived by appending `Change` to the input name, so a component with sibling props `count` and
  `countChange` — both legal frameless props — collides, whereas the baseline uses the author's two
  names as written. Measured in `@angular/core@22.0.8`: the derivation is literal string
  concatenation, `hasInput(directiveDef, name) && hasOutput(directiveDef, name + 'Change')`
  (`_debug_node-chunk.mjs:8516`) and `outputBinding(publicName + 'Change', …)` (`:8590`).
- **G6 `FAIL`.** `DEFERRED — no lane` is **discharged** by `demos/angular-official`. It does not
  ripen into `PASS`: no check can exist for a path the emitter refuses to emit — the same clause
  worked examples 2b, 6's `on()` arm, 7 and 11b record.

Three `FAIL`s and two `UNKNOWN`s → **denied, not deferred.** Say which one decides it: **Gate 2**,
because it is structural — it follows from frameless emitting one module per `EnrichedIR`. Gate 5's
collision is real and measured but is a naming accident a different IR could avoid; Gate 6's `FAIL`
is retirable in principle. The ruling is stable.

**Re-open** when the IR grows a bindable prop kind (IR-1) **and** the emitter instantiates child
components, at which point Gates 1 and 4 become answerable on a real instance — and Gate 2 will
still be `FAIL`.

---

### 5. Angular — `@if` / `@for` control-flow blocks → **sugar**

**Re-run in full, not amended. The ruling changed.** This entry previously read *deferred, not
denied — baseline until an Angular lane exists*. Every deferring condition is now met —
`@angular/core@22.0.8` is in the lockfile, `packages/frameworks/angular` exists, and `pnpm e2e`
drives `demos/angular-official` on the official Angular CLI SSR scaffold — so the procedure was
re-run in full by `frameless-angular-v1` T009. **All six gates `PASS`. It ripened rather than
curdling**, which worked example 6 did not and worked example 7 did.

**The emitter has shipped this form since the lane landed.** That was a live contradiction between
this document and shipped code, flagged by `frameless-angular-v1` T005 and deliberately left unruled
there. The re-run resolves it **in the emitter's favour, on measurement** — not by relabelling.

Baseline: `*ngIf` / `*ngFor` with `<ng-template #else>`, a `trackBy:` method, and
`imports: [NgIf, NgForOf]` on the standalone component. Candidate sugar: `@if` / `@else` /
`@for … ; track …`.

**The baseline is `*ngIf`/`*ngFor` and the deprecation tag does not change that.** Limb (a) of the
baseline definition resolves to `*ngIf`/`*ngFor` — valid from Angular 2.0, and **measured** to
compile with zero errors and zero warnings at 22.0.8 under `strict` + `strictTemplates`. Limb (b)
ties at zero: the baseline's `imports: [NgIf]` is an entry in the emitted module's **own** metadata,
which Gate 2's scoping paragraph settles. `NgIf`, `NgForOf` and `NgSwitch` do carry
`@deprecated 20.0 / Intent to remove in a future major release`
(`@angular/common/types/_common_module-chunk.d.ts:840, :507, :1097`), and it has **no diagnostic
force**: it surfaces only as TypeScript *suggestion* diagnostic `6385`, which `ng build`,
`performCompilation` and this repo's emitted-typecheck lanes all do not collect. **A tag is not a
diagnostic.** The baseline definition has no deprecation limb, and an inversion argued from the tag
would be arguing from a criterion this document does not contain.

Domain, in emitter terms: every `TemplateNode` of kind `'branch'` reaching `renderBranch()` and
every `TemplateNode` of kind `'keyed-repeat'` reaching `renderKeyedRepeat()` in
`packages/frameworks/angular/src/emitter/index.ts`.

- **G1 `PASS`.** Was `DEFERRED — framework absent`; **discharged**, and the coupling rule required
  it to move together with Gate 6. Measured, not read, at `@angular/core@22.0.8`: the shipped
  `generated/S1.ts` and `generated/S2.ts` were AOT-compiled **byte-for-byte** beside twins whose
  only change is the control-flow form, under `strict` + `strictTemplates`. **Every arm reports zero
  errors and zero warnings**, including a `*ngFor` arm carrying no `trackBy` at all. The instrument
  is calibrated four ways and goes red on **both** arms — a planted unknown member in the test
  expression yields `TS2339` under `@if` *and* under `*ngIf`, so the clean baseline is a measurement
  and not an unexercised path.
- **G2 `PASS`.** `@if`/`@for` require nothing of anyone: no import, no plugin, no dependency, and no
  declaration by a parent, a child, another module or the build graph.
- **G3 `PASS`.** The trigger is `TemplateNode.kind`, a declared IR structural fact. The deciding
  functions read only declared fields — `arms[].kind`, `index`, `empty`, `item`,
  `collection.expression`, `key.expression`. No handler body is inspected, so the later-pass rider
  does not engage.
- **G4 `PASS` on a narrowed rule.** `DEFERRED — emitter absent` is **discharged and unavailable**.
  Counterexamples are exhibitable from the emitter's own code — `renderKeyedRepeat` refuses an
  `index` binding and an `empty` fallback, `renderBranch` refuses more than two arms, `blockBody`
  refuses non-block-level children. The repair applies and every narrowing term is a declared IR
  field: branches with one `then` arm and at most one `else` arm whose children are all block-level,
  and keyed repeats with no `index`, no `empty`, and an identifier-safe `item`. On the narrowed rule
  the sugar is **total** — all 8 control-flow blocks in the shipped corpus take it with zero
  refusals. Re-running from Gate 1 on the narrowed rule changes no outcome.
- **G5 `PASS`, measured on node identity rather than on rendered markup.** Both forms were driven
  through four collection mutations with live DOM nodes tagged before each. Under a reverse, nodes
  **move** and keys read `c,b,a` with marks `n2,n1,n0` — **identically in both arms**. Under a
  wholesale replacement of every item object with a fresh clone carrying the same ids, nodes are
  **reused**, identically in both arms. Removing the middle row and prepending a new one are
  identical too, and the prepend's `NEW` cell is what proves the reader can tell reuse from
  recreation. `@if`/`@else` against `*ngIf` + `<ng-template #else>` renders identical DOM in the
  then state, in the else state, and after toggling back. **Two differences were found and neither
  is on this gate's list:** comment-anchor placement in the else state, and duplicate track keys —
  where **neither arm throws** and both render both rows, but the candidate emits a dev-mode
  `console.warn` `NG0955` while the baseline is silent, which is the candidate being *more*
  diagnostic. *Recorded so nothing is over-claimed:* event routing and lifecycle were not
  independently driven across a control-flow boundary in both arms, and the probes ran in `jsdom`
  against a real AOT compile; if either is challenged, re-run in Chromium rather than defend `jsdom`.
- **G6 `PASS`, and it is the deciding gate.** Was `DEFERRED — no lane`; **discharged** by
  `demos/angular-official`, so `DEFERRED` is unavailable. A check this repo already runs **does** go
  red on the regression, and it is **third-party-authored**:
  `packages/frameworks/angular/src/gate/index.ts` derives its applied `@angular-eslint` set from
  upstream's own `meta.docs.recommended`, and `@angular-eslint/template/prefer-control-flow` is
  **1 of only 4** template rules in it (of 41). Measured: it reports the baseline three times by
  name — *"Use built-in control flow instead of directive ngIf / ngForOf"* — and the shipped
  candidate zero times, with a planted `([ngModel])` drawing `banana-in-box` as calibration. A
  second claimed benefit is asserted by a second standing check: `@for`'s `track` is **syntactically
  mandatory**, pinned by the gate's `parseTemplate` arbiter with a track-deletion mutation proving
  red, whereas `*ngFor`'s `trackBy` is **optional and its omission silent** — measured, a `*ngFor`
  arm with no `trackBy` compiles clean. The gate's `BASELINE_FORM_INVENTORY` additionally pins
  `@if` / `@else` / `@for` as an exact allowlist. **State the negative result plainly:** `pnpm e2e`
  would **not** go red on a competent switch to the baseline, because Gate 5 measured the two forms
  behaviourally indistinguishable; it would go red on an incompetent one, because dropping `@if`
  without adding `imports: [NgIf]` yields `NG8103` and renders the guarded subtree not at all. What
  pins this form choice is the emitter gate, not the browser.

All six `PASS` → **sugar**. Say which one carries it: **Gate 6**, and it is the only one that was
ever in doubt.

**The contrast with worked example 11 is the argument, and both rulings rest on the same
measurement taken twice.** That entry's Gate 6 `FAIL` turned on `@angular-eslint/prefer-signals`
living in `all` rather than `recommended`, so the applied set is **silent** on a planted
`seed = input()` — "they decided it is an opinion you may opt into." Upstream made the **opposite**
call for control flow, and the applied set is **loud**. Two Angular sugars, one metadata read each,
opposite answers.

**On Gate 6's reading, because it is contestable.** Gate 6's preamble demands a check that exercises
the target lane and asserts observable behaviour. Read as governing every bullet, no non-behavioural
benefit could ever pass this gate — yet Gate 5 explicitly *routes* non-behavioural reasons here,
saying they "may be the reason to adopt a sugar, and as such they are adjudicated by Gate 6, which
requires them to be **measured**." Measurement is what this gate demands of them, and it is what was
supplied. Recorded because the strict reading would flip this entry to `FAIL` and force the emitter
to rewrite 8 shipped call sites into a form its own applied arbiter reports as a violation.

**The version corollary is discharged the second way and this entry does not weaken it.**
`@if`/`@for` floors at 17.0, and the emitted module **already floors at 19.0** for an unrelated
reason — the absence of a `standalone` key, which is the entry that sets `ANGULAR_BASELINE_FLOOR`.
So this sugar costs the lane **no version reach at all**: adopting the baseline would widen the
form's range and widen the emitted module's range by exactly zero. IR-4 is **not** this ruling's
blocker; per `frameless-svelte-v1` T999 it could not have been, since no gate `FAIL`s.

Read this example together with the forced-lowering note in the preamble. Most of what looks like
Angular "idiom sugar" is not sugar at all — frameless handler bodies must become class methods
regardless of any ruling here. **This one is genuine sugar**, which is why it went through all six
gates, and it is the first Angular entry to reach `PASS` at every one. Note also that the preamble's
claim that Angular template expressions forbid **arrow functions** is stale at 22.0.8
(`compiler.d.ts:1964` declares `class ArrowFunction extends AST`); forced lowering is unaffected,
because `const`/`let` and `UpdateExpression` remain absent from the action grammar.

---

## 7. What was NOT measured, and what should make this re-open

- **Event routing and lifecycle across a control-flow boundary** were not independently driven in
  both arms. Inferred from identical elements, identical bindings and identical node identity. If
  challenged, drive a click through both arms.
- **The SSR served payload** was not compared between the forms. `@if` and `*ngIf` place their
  hydration comment anchors differently in the else state, and whether Angular's `ngh` annotations
  differ is **unmeasured**. It cannot change the ruling — every gate already `PASS`es on
  client-side measurement — but "renders identically" is not a served-payload claim. Worked example
  11 carries the identical caveat for the identical reason.
- **`jsdom`, not Chromium**, per the command restriction (a Worker was concurrently landing S6 and
  running the full e2e matrix). The harness was calibrated against T005's published `S1` result and
  reproduces it exactly, which is the strongest available substitute and is not the same thing.
- **S6 was in flight** during this task. The ruling is at the **form** level and generalises, but
  the count "8 control-flow blocks across 4 of 5 goldens" is measured at `abb5e44` and S6 will move
  it.
- **Re-open triggers.** Example 5: if `NgIf`/`NgForOf` are actually **removed** in a future major
  (the tag says intent), the sanctioned set becomes a singleton and this entry becomes a
  non-question rather than a sugar — the ruling would not change but its *shape* would. If upstream
  moves `prefer-control-flow` out of `recommended`, **Gate 6 loses its `PASS`** and this entry must
  be re-run, because Gate 6 is the deciding gate and that metadata read is what carries it. **That
  trigger is tripwired, and this bullet originally understated it.** It was written as the single
  most fragile input in the ruling, named here so it would not be discovered by accident — which
  reads as though discovery depended on someone reading this note. It does not.
  `packages/frameworks/angular/test/gate.test.ts` asserts `ANGULAR_ESLINT_TEMPLATE_RULES_DERIVED`
  equals the **exact four names** — `banana-in-box`, `eqeqeq`, `no-negated-async`,
  `prefer-control-flow` — and separately asserts `ANGULAR_ESLINT_RULES_APPLIED` does **not** contain
  `@angular-eslint/prefer-signals`, the opposite-direction metadata read worked example 11 turns on.
  So a demotion of `prefer-control-flow` **or** a promotion of `prefer-signals` goes **red by name**
  on a routine `pnpm test`. **Measured rather than inferred** by `frameless-defects-and-targets-v1`
  T040: with each plugin's `meta.docs.recommended` mutated in memory before the gate module is
  evaluated, the demotion drops the derived template set to 3 and removes `prefer-control-flow` from
  the applied set, and the promotion raises the derived TS set from 12 to 13 and puts
  `prefer-signals` into the applied set — each of which contradicts a pinned assertion. Four further
  rows fail alongside them: the three applied-set cardinalities (17 / 12 / 4), the baseline-floor row
  asserting `prefer-control-flow` is applied, and the `*ngFor` mutation row expecting it to report.
  **The re-open is triggered by a failing test, not by an auditor's attention.** The residual risk
  is what a tripwire cannot cover: it fires when the lockfile moves, so it says nothing about an
  upstream release nobody has installed yet.

---

## 8. Fold record — `frameless-angular-v1` T011

The fold specified in §6 **landed**, changing no emitted output. Three edits, and nothing else:

1. `docs/emitter-idiom-policy.md` worked examples 4 and 5 replaced with §6's text **verbatim**. The
   only departure from a byte copy is that §6's own `---` horizontal rules — which separate the two
   entries *inside this note* — were dropped, because the policy document uses `---` only for
   top-level section breaks and carries no rule between worked examples. Example 4's heading and its
   ruling word `no-sugar` are unchanged, so the queued Vue 12a/12b citation still resolves; example
   5's heading moved `deferred` → `sugar`.
2. Gate 1's Angular discharge bullet **rewritten, not deleted**, to record the re-run as landed. The
   one-line-per-framework shape is preserved and no other framework's line was touched.
3. Decision-site comments at `renderBranch()` and `renderKeyedRepeat()` in
   `packages/frameworks/angular/src/emitter/index.ts`, naming the ruling, the deciding gate (G6) and
   the measurement. `renderBranch`'s pre-existing bare assertion — that `prefer-control-flow` "is in
   this lane's applied rule set and reports `*ngIf`/`*ngFor` directly" — was **corrected to cite the
   ruling**: the claim is now measured true (1 of 4 rules of 41, derived from
   `meta.docs.recommended`, 3 messages on the baseline and 0 on the candidate) rather than asserted.
   The edit is **comment-only**, verified mechanically rather than asserted: the added-lines diff
   filtered of comment and blank lines is empty, and `scripts/regenerate.ts` run twice moves no byte
   of `packages/frameworks/angular/generated`.

**The two carry-forwards of §6 and §7 are now recorded at three sites** — this note, worked example
5, and the `renderBranch` comment — so that a future auditor meets them wherever they enter: Gate
6's reading is contestable and was decided on Gate 5's own routing sentence, and Gate 6's `PASS`
depends on upstream keeping `prefer-control-flow` in `recommended`.

**One count updated at the emitter comment only, and deliberately not in the policy entry.** §4's
"8 control-flow blocks across 4 of 5 goldens" is measured at `abb5e44` and the policy entry
transcribes it unchanged, because that is the number the ruling was taken on. §7 predicted S6 would
move it and it has: `generated/S6.ts` carries one `@for` and no `@if`, so the corpus now stands at
**9 blocks across 5 of 6 goldens**. The emitter comment states both, with the qualification that the
count moves with the corpus while the form-level ruling does not.

---

## 9. Addendum — `frameless-defects-and-targets-v1` T040

Two corrections to this note's own record. **No gate outcome, ruling or verdict is touched by
either**; §6 is deliberately left as the as-folded text, since it is the record of what was written
into `docs/emitter-idiom-policy.md`, and the policy document is the live copy.

1. **The upstream-tier dependency was recorded as an unmitigated risk, and it is mechanically
   tripwired.** Corrected in §7's re-open trigger above, where the tripwire is named and the
   measurement that confirms it is recorded. The direction of the error is worth naming: it
   **understated** our own safety rather than overstating it, which is the less dangerous error and
   was still wrong.
2. **§8's claim that the carry-forwards were "recorded at three sites" did not hold for one of the
   three.** Measured at T040: worked example 5 in `docs/emitter-idiom-policy.md` carried the Gate 6
   *derivation* — the applied set is derived from `meta.docs.recommended`, `prefer-control-flow` is
   1 of 4 of 41 — but it did **not** carry the upstream-dependency carry-forward in any form. §8's
   sentence is left standing as the record of what T011 believed it had done; the third site now
   exists, created by T040 and stated as tripwired rather than as fragile.

**And the contestable-reading carry-forward is no longer a carry-forward.** Gate 6's preamble stated
its lane-and-version-and-behaviour requirement as one undivided sentence above a `PASS` clause that
is a **disjunction**, so the preamble contradicted its own second arm. T040 scoped the requirement to
the behavioural arm. Two shipped entries turn on the second arm — worked example 10, whose `G6 PASS`
is carried entirely by standing non-behavioural checks and which says so outright, and worked
example 5 — and **neither was re-scored**; per this note's §6 and per `frameless-angular-v1` T999,
example 5's reading holds on example 10's precedent, and its evidence is the stronger of the two
because its arbiter is third-party-derived rather than frameless-authored. The scoping is a
statement of the rule both entries were already decided under.
