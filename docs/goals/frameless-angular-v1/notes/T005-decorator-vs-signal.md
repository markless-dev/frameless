# T005 — decorator-vs-signal, re-run against the landed Angular lane

**Ruling: the NO-SUGAR ruling HOLDS. Denied, not deferred. Gate 5 decides it.**

Two gates moved, and both moved the way the board predicted: **G1 cleared** (it was deferred only
because Angular was absent) and **G5 did not** (it was never about absence). Two gates that were
`DEFERRED — emitter absent` / `DEFERRED — no lane` are also discharged, and one of them —
Gate 6 — turned into a `FAIL` rather than a `PASS`, which is the same thing that happened to
Svelte's worked example 6 when its deferrals were discharged.

**One of the two originally-stated reasons for the Gate 5 `FAIL` is REFUTED by measurement.** A
different one survives, also measured. A wrong reason attached to a right answer is worth
correcting on its own — this is worked example 7's situation exactly, and it is the reason this
note is long.

---

## What was measured, and how

Everything below was measured against `@angular/core` **22.0.8**, the build
`demos/angular-official` ships, resolved through that demo's own `node_modules`. No claim here
rests on Angular's documentation.

**Instrument.** A throwaway `@angular/build:application` project outside the repository, with
`node_modules` symlinked to `demos/angular-official/node_modules` and `tsconfig.json` /
`tsconfig.app.json` copied from that demo verbatim — so `strictTemplates`, `strict`,
`strictInputAccessModifiers` and the lane's own `noImplicitAny: false` delta are all exactly what
the lane runs. Nothing in the repository was written, and neither `pnpm e2e` nor
`pnpm test:browser` was run.

- **Arm A** is `packages/frameworks/angular/generated/S1.ts` copied **byte-for-byte**.
- **Arm B** is the same file with the **only** change being the member declaration form
  (`@Input() label: any;` → `label = input<any>();`) plus the call syntax that change forces at
  each read site. Same selector shape, same template, same handler bodies, same getter.
- Both arms were AOT-built by `ng build`, then executed in `jsdom` from the built browser bundle
  and driven through `ApplicationRef` and `ComponentRef.setInput` — which is the **same API the
  lane's own wiring uses**: `withComponentInputBinding()` binds route `data` through
  `outlet.activatedComponentRef.setInput(...)`
  (`demos/angular-official/node_modules/@angular/router/fesm2022/_router-chunk.mjs:1940`, read,
  not assumed).

**Two-sided calibration of the instrument itself.** The probe is a verdict-issuing instrument, so
per this board's rule 4 it was calibrated against a known member rather than only asserted to have
run. Three of its rows come back **negative** — `ngOnChanges` parity, plain-`input()`
read-before-set parity, and identical rendered DOM — so it is demonstrably capable of reporting
"no difference", and the differences it does report are not an artefact of an instrument that only
knows how to say yes.

### The raw results

| probe | Arm A (`@Input()`) | Arm B (`input()`) |
|---|---|---|
| `ng build` diagnostics / warnings | 0 | 0 |
| rendered DOM (`innerHTML`) | `…<output data-value="derived">kit:2</output>…` | **identical** |
| `typeof instance.label` | `"string"` | `"function"` |
| `String(instance.label)` | `kit` | `[Input Signal: kit]` |
| `computed(() => instance.derived)` before | `kit:2` | `kit:2` |
| same computed after `setInput('multiplier',10)`, **no tick** | `kit:2` | **`kit:10`** |
| same computed after `ApplicationRef.tick()` | **`kit:2`** (DOM says `kit:10`) | `kit:10` |
| `instance.label = 'MUTATED'` then check | renders `MUTATED:10` | **throws** `TypeError: label is not a function` |
| unset optional input read in `ngOnInit` | `undefined` | `undefined` |
| unset **required** input read in `ngOnInit` | n/a | throws `NG0950` |
| `ngOnChanges` log across three `setInput`s | `x:first=true`, `x:first=false` | **identical** |

One extra measurement, taken to test the *baseline choice* rather than the sugar: the decorator arm
AOT-builds **clean with `experimentalDecorators: false`** (clean cache, `.angular` and `dist`
removed first). `ngtsc` consumes Angular's decorators itself, so the baseline imposes **no**
tsconfig obligation on a consumer. And `Input` / `Output` carry **zero** `@deprecated` tags in
`@angular/core@22.0.8`'s declarations. The baseline is fully sanctioned at the pinned version,
which is what makes a Gate 5 `FAIL` a real `FAIL` rather than a forced-lowering candidate.

---

## The ruling, in the policy's own format

Fold this into `docs/emitter-idiom-policy.md` as **worked example 11**.

### 11. Angular — declaring a component prop as a signal `input()` rather than `@Input()` → **no-sugar**

**Re-run in full, not amended.** `frameless-idiom-policy-v1` T006 derived this twice independently
(PM pre-registration plus a zero-context cold agent) with **no Angular anywhere in this repo**.
Every condition that deferred it is now met — `@angular/core@22.0.8` is in the lockfile,
`packages/frameworks/angular` exists, and `pnpm e2e` drives `demos/angular-official` on the
official Angular CLI SSR scaffold — so the procedure was re-run against a real build by
`frameless-angular-v1` T005. **The ruling is unchanged. Its Gate 1 outcome inverted, its Gate 6
outcome inverted the other way, and one of its two Gate 5 reasons was measured false.**

Baseline: `@Input() <localName>: any;`, the form `propMembers()` ships at
`packages/frameworks/angular/src/emitter/index.ts:619`. It is the baseline on both limbs of the
definition, and both were **measured** rather than assumed: it is valid Angular 2 → 22 and carries
no `@deprecated` tag at 22.0.8, and it imposes no obligation on any other party — it AOT-compiles
clean even with `experimentalDecorators: false`, because `ngtsc` handles Angular decorators itself.

Candidate sugar: `<localName> = input<any>();`.

Domain, in emitter terms: every `PropDestructuringEntry` in `component.props.entries` reaching
`propMembers()` that survives its three named refusals — a `defaultValue`, a multi-segment `path`,
and an `alias`/renamed `sourceName`.

- **G1 PASS.** Was `DEFERRED — framework absent`; **discharged**, and the policy's own coupling
  rule required it to move together with Gate 6. Measured, not read, against
  `@angular/core@22.0.8`: the shipped `generated/S1.ts` was AOT-built verbatim beside a twin whose
  only change is the declaration form. Both arms report **zero diagnostics and zero warnings** from
  `ng build` under `strictTemplates`, and both render **byte-identical DOM** through the same
  `ComponentRef.setInput` path `withComponentInputBinding()` uses. Both forms are accepted by the
  exact build this repo ships. Note that a behavioural difference does **not** fail this gate —
  Gate 1 asks whether both forms are sanctioned and whether the correspondence was measured; the
  differences it surfaces are Gate 5's to adjudicate, and Gate 5 adjudicates them below.
- **G2 PASS.** Unchanged. `input` is an import the emitted module adds to its **own** import list,
  which the Gate 2 scoping paragraph settles. Nothing is asked of a parent, a child, another module
  or the build graph.
- **G3 PASS.** The trigger is the declared IR field `component.props.entries`; handler contents are
  never inspected, so the rider does not engage. **Recorded as a consequence, not a failure:** the
  shipped `this.`-qualification transform builds ONE undifferentiated `members` set from
  `props.entries` unioned with `locals[].names`
  (`packages/frameworks/angular/src/emitter/index.ts:1117-1118`), and the candidate would force that
  set to **split** — a prop read must become `this.x()` while a local read must stay `this.x`. Both
  halves are declared IR facts, so this stays inside Gate 3; but T006/T003a's own dissent already
  flagged that a total transform becoming a discriminator is where drift lives, and this would make
  it one.
- **G4 PASS on a narrowed rule, and the narrowing is worth reading.** `DEFERRED — emitter absent` is
  discharged: `propMembers()` exists and is the deciding function. A counterexample is exhibitable
  **from the IR schema**, which is exactly what this gate's absent-emitter clause says counts:
  `PropDestructuringEntry` carries a `graphNodeId` (`packages/compiler/src/schema.ts:205-212`),
  `GraphBindingKind` includes `'prop'` (`:20`), and `StateWriteRecord` is keyed on a `graphNodeId`
  and admits `operation: 'assign'` (`:266-274`) — so a prop a handler assigns to is representable,
  and the sugar cannot express it, because an `InputSignal` is read-only. That is not a paper
  objection: it is the measured `TypeError` in the Gate 5 entry below. The Gate 4 repair applies and
  is legitimate — narrow the domain to entries that are never a `StateWriteRecord` target, which is
  a declared IR fact — and on the narrowed rule the sugar is total. **The repair does not save the
  sugar.** Re-running from Gate 1 on the narrowed rule, as the repair step requires, lands on the
  same Gate 5.
- **G5 FAIL. This is the ruling, and its reasons have changed.**

  *Limb 1 — reactivity depth. CONFIRMED, and promoted from reasoning to measurement.*
  `computed(() => ref.instance.derived)` over the shipped S1 component: under the **baseline** it
  returns `kit:2` before `setInput('multiplier', 10)`, still `kit:2` after it, and still `kit:2`
  after `ApplicationRef.tick()` — at which point the component's own DOM reads `kit:10`. The read
  registers no producer, so a consumer's derivation never invalidates and silently diverges from the
  rendered component. Under the **candidate** the same `computed` returns `kit:10` **immediately,
  before any tick**, because `get derived()` reads `this.multiplier()` inside the consumer. The
  emitted class's derived member is not a reactive producer under the baseline and **is** one under
  the candidate. That is the first item in Gate 5's own failure list. The direction is irrelevant:
  a reasonable person can call the candidate's behaviour better, and Gate 5 is a **neutrality**
  gate, not a quality gate.

  *Limb 2 — throw behaviour. THE ORIGINALLY-STATED REASON IS REFUTED AND MUST NOT BE CARRIED
  FORWARD.* The 2026-07-26 derivations rested this limb on the required-input throw. Measured at
  22.0.8: `input.required()` read before it is set throws
  `NG0950: Input "x" is required but no value is available yet`, while `@Input()` yields
  `undefined` — **but plain `input()` also yields `undefined`, identical to the baseline.** And
  `input.required()` is **unreachable for this emitter**: `PropDestructuringEntry` has no `required`
  field, and `propMembers()` throws on the only adjacent field, `defaultValue`. Emitting
  `.required()` would be the emitter inventing a construct the IR does not declare — precisely the
  ground `frameless-angular-v1` T002 ruling 2 used to refuse `@Output()`. So the throw the original
  reason named cannot arise from the form this emitter would actually emit.

  *Limb 2′ — a DIFFERENT throw survives, and it is measured.* A consumer holding the component
  instance and writing `ref.instance.<prop> = v` renders under the baseline (`MUTATED:10`) and
  **throws `TypeError: … is not a function`** at the next check under the candidate, because the
  exported member's type changes from `any` to `InputSignal<any>`. `typeof instance.label` is
  `"string"` versus `"function"`; `String(instance.label)` is `kit` versus `[Input Signal: kit]`.
  That is *both* "throw or error behavior" *and* "the module's exports" from Gate 5's list, and
  unlike limb 2 it is unavoidable — it follows from the candidate by construction, not from an
  optional spelling.

  *NOT a failure, recorded so nothing is over-claimed:* `ngOnChanges` is **identical** across both
  forms — one first-change call, one subsequent change, and no call at all on a repeated identical
  `setInput`. Gate 5's `lifecycle` limb is measured **clean**. Neither original derivation claimed
  otherwise; this closes it by measurement rather than leaving it open.
- **G6 FAIL.** Was `DEFERRED — no lane`; **discharged** by `demos/angular-official` on the official
  Angular CLI 22.0.8 SSR scaffold, so `DEFERRED` is no longer available at this gate. It does not
  ripen into `PASS`. The sugar's only justification is idiom — an artifact property nothing checks
  — which is this gate's `FAIL` clause verbatim. State the negative result plainly, because it is
  the useful part: `pnpm e2e` asserts the Angular row's S1/S2/S3 observations byte-identical to five
  other lanes, and **it would not go red on this sugar**, because the two arms were measured to
  render identically. A behavioural lane cannot pin a non-behavioural benefit. Nor can any check be
  built while the gate policy `no-signal-members`
  (`packages/frameworks/angular/src/gate/index.ts:303`) refuses the path — the same clause as worked
  example 6's `on()` arm and worked example 7's Gate 6. Independently, the **version corollary**'s
  second conjunct is unmet: the sugar is version-gated at 17.1 and the lockfile pins 22.0.8, but
  `EnrichedIR` has no target-version input, and this lane discharges the corollary the *second* way
  — by emitting only baseline-version-safe forms — which adopting this sugar would abandon.

`FAIL` at Gate 5 and Gate 6 → **denied, not deferred**. Say which one decides it: **Gate 5**.
Gate 6's `FAIL` is retirable in principle — someone could build a check, or an IR version input
could land. Gate 5's is not: the candidate changes the exported member's type and its reactive
character by construction, and no amount of lane, emitter or IR work retires that.

**IR-4 is NOT this ruling's blocker, and saying so is the point.** Per `frameless-svelte-v1` T999,
a version-gated sugar that `FAIL`s G2 or G5 is **denied**, not deferred. This one `FAIL`s G5. The
version corollary is a second, subordinate reason for the Gate 6 `FAIL`, not the ruling.

### 11b. The `@Output()` → `output()` half: **not ruled, because its domain is empty**

The held-out question was posed as `@Input()`/`@Output()` versus `input()`/`output()`. The
`@Output()` half **cannot be scored on this emitter**: `frameless-angular-v1` T002 ruling 2 refused
`@Output()`/`EventEmitter` outright on arity grounds, and the shipped emitter contains **zero**
occurrences of `Output` or `EventEmitter` in `src/emitter/` or in any golden. `onTrace`, the only
callback prop in the corpus, is an `@Input()`.

So the domain of "every `@Output()` the emitter emits" is **empty**, and the tempting move — "the
sugar applies to all zero of them, therefore total, therefore `PASS`" — is exactly the vacuous
totality worked example 7 refused and called *the folklore domain arriving by the back door*.
**G4 `UNKNOWN`, which is a no.** The output half is **no-sugar** on that ground alone, and it is a
weaker ground than the input half's, which is why it is recorded separately rather than folded in.

`packages/frameworks/angular/src/gate/index.ts`'s `SIGNAL_APIS` set already covers `output` and
`model` alongside `input`, so the shipped gate pins both halves. That is correct and should stay.

---

## Carried forward, verbatim, because it must not vanish

**`angular-eslint` holds the opposite view and it is an OPT-IN OPINION, not "the Angular team
decided X".** `@angular-eslint/prefer-signals` exists and prefers the candidate — but upstream did
**not** put it in `recommended`; it lives in `all`. T006/T003a verified in-repo that the derived
`recommended` set returns 0 messages on a planted `seed = input()`. Saying "the Angular team decided
signals" overstates it: they decided it is an opinion you may opt into. A lint preference addresses
neither Gate 5 limb, and this ruling does not overrule it — the two are answering different
questions.

**At Angular 22, OnPush is the default and `prefer-on-push-component-change-detection` reports only
explicit opt-out.** Emitting no `changeDetection` is correct, and emitted components are
OnPush-checked. Nothing in this ruling touches that.

---

## The policy needs three edits, and one of them is not mine to make

### 1. This case becomes worked example 11 (plus 11b). REQUIRED.

The policy has no entry for it — deliberately, because `frameless-idiom-policy-v1` T005's
contamination guard kept the whole decorator-versus-signal vocabulary out of the document so the
cold-agent test could not be leaked to. **That guard has served its purpose and is now the reason
the repo's most carefully derived Angular ruling is the one ruling the policy does not record.**
Fold it in. The policy's own "Recording a ruling" section also requires item 2 — a comment at the
decision site in the **emitter** naming the ruling. `propMembers()` has none; the only comment
naming this question lives in the **gate**, and it is phrased provisionally as "held out for T005",
which is now false.

### 2. Gate 1's absent-framework paragraph is factually stale. REQUIRED.

`docs/emitter-idiom-policy.md:111` reads **"Vue and Angular are absent today."** Both are now in the
lockfile with landed lanes. Left as-is, the next reader records `DEFERRED — framework absent` for a
framework the same paragraph's Svelte clause would forbid deferring — the policy would contradict
itself in one paragraph. Correct it the way the Svelte clause is written, naming the discharging
task.

### 3. Worked example 5 must be re-run, and I am NOT ruling it here.

This is a finding, not a ruling — it is outside T005's objective, and a Judge should not decide a
sugar question it was not asked to run. **Worked example 5 (`@if`/`@for`) records `G1 DEFERRED —
framework absent` and `G6 DEFERRED`, ruling "baseline until an Angular lane exists" with `@if`/`@for`
as the CANDIDATE — and the shipped emitter emits `@if` and `@for` in all three goldens.** Every
deferring condition is met, so the policy's own re-opening rule mandates a re-run "without further
authority".

I looked far enough to say the re-run will probably *ratify* the emitter rather than indict it, and
to say exactly how far I looked: `NgIf` and `NgForOf` carry `@deprecated 20.0` in
`demos/angular-official/node_modules/@angular/common/types/_common_module-chunk.d.ts:840` and `:639`.
If that holds up, the baseline/candidate assignment in example 5 is **inverted** at 22.0.8 and
`@if`/`@for` is the baseline, on the same reasoning worked example 6 used to re-derive Svelte's
baseline. **What I did NOT measure, and nobody should read into this:** whether using `*ngIf` /
`*ngFor` at 22.0.8 actually produces a build diagnostic. A `@deprecated` JSDoc tag is a tag, not a
diagnostic — this board's own inventory discipline says an absent tag is not a floor, and the
converse holds too. That measurement is owed by whoever runs the re-run.

The same re-run is owed by worked example 4 (`[(prop)]`), whose `G1 DEFERRED — framework absent` is
equally discharged. Its ruling is `denied` on two independent `FAIL`s at G2 and G5, so the outcome
is very unlikely to move — but "unlikely to move" is not a re-run, and the policy does not offer
partial credit for that.

---

## Dissent, and what I am least sure of

- **Limb 1's consumer is somewhat exotic and I want that on the record.** Someone will say that
  wrapping `instance.derived` in a `computed()` is a user error, and that no real consumer does it.
  Two answers. First, Gate 5's standard is *could detect*, not *likely to*: worked example 3 turned
  on a hypothetical consumer with an `onClick` prop and was ratified on exactly that basis. Second,
  and more to the point, the probe is a *detector*, not a *use case* — what it detects is that the
  emitted component's reactive character changed, and that is what Gate 5 names. But limb 2′ is the
  sturdier of the two and I would not want the ruling to rest on limb 1 alone.
- **`jsdom`, not a real browser.** The behavioural probes ran in `jsdom` against a real AOT bundle,
  not in Chromium. That is weaker than this repo's usual standard, and it was chosen deliberately:
  two other Judges were running concurrently on this tree and the board's own instruction was not to
  contaminate browser measurement. Everything measured here is signal-graph and property semantics
  inside `@angular/core`, which `jsdom` does not mediate — but if any of these results is ever
  challenged, the correct response is to re-run it in Chromium, not to defend `jsdom`.
- **I did not measure the SSR payload.** Both arms were shown to render identical DOM client-side.
  Whether Angular's hydration annotations (`ngh`) differ between the forms is **unmeasured**, and I
  am not claiming they do not. It cannot change the ruling — the ruling is already `FAIL` — but a
  future reader should not read "renders identically" as a served-payload claim. This board has been
  bitten four times by exactly that kind of read-through.
- **The output half's `UNKNOWN` is honest but unsatisfying.** It converts to *denied*, which the
  policy warns "asserts that something was found against the sugar when nothing was". Here that
  warning is apt: nothing was found against `output()`, there is simply nothing to find it on. The
  correct reading is that the question is not askable on this corpus, and 11b says so rather than
  borrowing the input half's Gate 5 to look decisive.
