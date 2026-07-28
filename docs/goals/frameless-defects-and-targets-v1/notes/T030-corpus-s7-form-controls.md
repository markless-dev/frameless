# T030 — S7 form controls folded with boolean/dynamic attributes, six lanes, and R1 answered with a population

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Dispatched at `a6bd400`; the tree moved three times underneath this card and §8 is
about that. Follows the pattern T034, T026 and T027 established
(`notes/T034-s4-registration.md`, `notes/T026-corpus-s5-branch-teardown.md`,
`notes/T027-corpus-s6-whitespace.md`); ruling is `notes/T024-corpus-breadth.md`
§3, §5.

## 0. Headline

**S7 landed in all SIX lanes.** `pnpm e2e` reports
`6 demos x 7 scenarios, all observations equal` — 42 byte-identical observation
records where there were 36. **No emitter threw on the S7 IR**, so T024's
capability-free ruling holds for this scenario. **No existing golden moved**, no
existing observation string changed, and the s1–s6 rows in this tree's matrix are
byte-identical to the ones T027 recorded.

**The S7 IR carries ZERO zero-read sites, 0 of 21**, re-derived with a walker that
enumerates no node kinds at all (§1).

**All six S7 mutants go RED, every one at the lane's own in-box assertion**, with
the same sentence in every lane (§5). Established by a hand run of the harness's
own steps; §6 says why the harness itself is still reported blocked even though
the surface is now clean.

**R1 GETS ITS POPULATION, AND THE ANSWER IS FOUR-WAY.** The Angular board asked
whether a property binding reaches the served attribute, on one control. Measured
here across three `checked` bindings and two control types, in six real browser
lanes: **three of six serve it, one of six deletes it at hydration, exactly one of
six keeps it in sync, and two of six never serve it but add it at activation.**
§4.1. That is why no `checked` reading is in the shipped observation string, and
§4 states the trade rather than leaving it implicit.

**THE BOOLEAN-ATTRIBUTE DIVERGENCE T024 RATIFIED THIS AXIS ON IS REAL, AND IT IS
ANGULAR ALONE.** A dynamic `disabled` serves `disabled="false"` in Angular where
the other five serve nothing at all — and `disabled="false"` **disables the
button**, so this is a behavioural divergence and not a serialization one. §4.2.
It is measured, recorded, and deliberately not shipped; §4.4 says why, and what
ships instead pins all three states of the axis in six lanes.

**Two standing rulings met their first `<select>` and `<textarea>` and both were
right** (§3.2, §4.3): the Solid gate's `controlled-input` policy, and Solid's
`attr:value` pair — which has no declared type on `SelectHTMLAttributes` or
`TextareaHTMLAttributes`, so a `value` binding on either tag is unshippable
today. That is finding 002, one axis wider.

---

## 1. The zero-read-site count, RE-DERIVED

The card's stop_if is "the S7 IR carries ANY zero-read site" and the discipline
line is MEASURE, NEVER INHERIT, so T026's and T027's readers were not reused. The
walk written for this card **enumerates no node kinds**: it visits every object in
the IR generically, records the KEY PATH at which each `reads` array sits, and
classifies a site from that path. A site kind nobody thought to enumerate cannot
be missed by construction.

```
DOM/dynamic sites (incl. event handlers) = 21
ZERO-READ DOM SITES = 0  []
all `reads` arrays anywhere in the IR: total=47  empty=9
  components.0.locals.0   size      // let size  = state('s')
  components.0.locals.1   notes     // let notes = state('draft')
  components.0.locals.2   pick      // let pick  = state('r1')
  components.0.locals.3   lock      // let lock  = state(null)
  records.bindings.5      prop:props    — the root prop
  records.bindings.6      state:lock
  records.bindings.7      state:notes
  records.bindings.8      state:pick
  records.bindings.10     state:size
```

Four state declarations initialised from literals, each appearing once as a local
and once as a binding, plus the props root. `locals.4` (`rows = state(seed.map(…))`)
reads the prop; all five computeds read. None of the nine is a dynamic DOM site.
Exactly S5's and S6's class, one state wider.

The capability-guard inputs were measured on the same pass, because a throw is
this card's hardest stop condition and predicting it from six emitters would be
the wrong instrument:

```
components=1  imports=0  module.exports=1
elementHandleBindings=0  handleForwards=0  behaviors=0  handleCalls=0
```

Every one is inside the guard the four capability-blocked emitters share. S7 is
capability-free **by measurement**, and none of the six threw.

## 2. The two axes, and why one fixture carries both

T024 folded them because they share a host. They turned out to share more than
that: they are the **same machinery producing opposite results**, and one
scenario is what makes that visible.

Measured on the shipped S7 IR — this is what `kind` the compiler assigns, not
what a lane does with it:

```
kind: 'property'    checked  (radio x2, checkbox inside a keyed repeat)
kind: 'attribute'   data-size  data-notes  data-tag  data-oracle-form-key
                    data-lock  data-held  aria-disabled
```

Then, across six lanes in a real browser:

```
every  kind:'attribute'  reading is IDENTICAL in all six lanes, at every step
no     kind:'property'   reading is identical in even two adjacent lanes
```

That is the finding the fold produced, and neither half alone could have produced
it. `packages/frameworks/angular/src/emitter/index.ts:866` is where the two kinds
part company most visibly — `binding.kind === 'property' ? name : \`attr.${name}\``
— but §4 shows the split is not Angular's alone.

## 3. What landed

### 3.1 The fixture

`packages/compiler/test/fixtures/s7-form-controls.tsrx`, component `FormBoard`.
Five states (`size`, `notes`, `pick`, `lock`, `rows`), five computeds (`chosen`,
`onFirst`, `onSecond`, `locked`, `guard`), one flat keyed repeat, seven handlers.

**No branch** — S5 owns teardown, and avoiding one also avoids the Solid
`show-two-arm` constraint T026 recorded, so §3 has no finding to report against
it. **Every static text node is a single word** (`small`, `medium`, `large`,
`resize`, `lock`, `guard`), so the T039 interior-whitespace v-limit never had
anything to bite; it was not weakened and it did not fire.

Four control types, which is the whole point — the corpus had exactly two before
S7, both an `<input>`, both in S3:

| control | binding under test | how its effect is observed |
| --- | --- | --- |
| `<select>` + 3 `<option>` | `data-size` (attribute) | `size`, and the `resize` click |
| `<textarea>` | `data-notes` (attribute) | `notes`, and the `resize` click |
| radio group, 2 members, one `name` | `checked` (property) | `picked`, as TEXT |
| checkbox inside a keyed repeat | `checked` (property) | `chosen`, as TEXT |

Plus the attribute axis on one guard element: `aria-disabled` bound to a boolean,
`data-held` bound to `null | 'held'`, and `data-lock` on the lock button bound to
`null | 'on'`.

### 3.2 THE SOLID `controlled-input` RULING met its first `<select>`, and it was right

The first S7 emission put `value={size}` and an `onChange` handler on the
`<select>`. The Solid dossier gate rejected it, verbatim:

```
{
  "file": "generated/S7.jsx",
  "policy": "controlled-input",
  "dossierRef": "T003 ruling 7",
  "message": "Controlled text value requires onInput and an identical attr:value pair",
  "line": 22
}
{
  "file": "generated/S7.jsx",
  "policy": "controlled-input",
  "dossierRef": "T003 ruling 7",
  "message": "Controlled text inputs must not use React onChange semantics",
  "line": 22
}
```

`packages/frameworks/solid/src/gate/custom-policies.ts:637` applies the policy to
`['input', 'textarea', 'select']` uniformly, and until this scenario existed it
had only ever seen `input`. **Unlike T026's `show-two-arm` case, its prescribed
remedy WAS available**: the DOM fires `input` before `change` on a `<select>`, so
`onInput` is the correct Solid spelling and the authored handler moved to it. Not
patched over, and the gate was not touched.

### 3.3 The golden

`packages/compiler/test/goldens/s7-form-controls.json`, created with
`UPDATE_GOLDENS=1 pnpm test`, then proven byte-stable by re-running **without**
it. The S1–S6 goldens are **unmoved**.

### 3.4 Six emitters, no throw, byte-stable

All six `regenerate` scripts learned the fixture; all six produced output; none
threw. Byte stability was proven by sha256 across a second and a third
regeneration rather than by `git diff --exit-code` alone:

```
a2cdccb7…  packages/frameworks/react/generated/S7.jsx
716ed903…  packages/frameworks/solid/generated/S7.jsx
00d2ddee…  packages/frameworks/qwik/generated/S7.jsx
5fc38d84…  packages/frameworks/svelte/generated/S7.svelte
53fbab99…  packages/frameworks/vue/generated/S7.vue
0e77ad7f…  packages/frameworks/angular/generated/S7.ts
```

Identical before and after a second `regenerate`, and identical again after the
six mutate/restore cycles in §5. `git diff --exit-code` over all six `generated/`
directories is clean, which covers S1–S6 as well.

### 3.5 Six demo routes

`/s7` in every lane, each following that scaffold's own convention: a `switch` arm
in the react `App`, a `<Match>` in solid's `<Switch>`, `src/routes/s7/index.tsx`
in qwik, `src/routes/s7/+page.svelte` in svelte, a `v-else` arm in the vue `App`
(S6's `v-else` became `v-else-if` so the chain still terminates in exactly one
default, exactly as S5's did for S6), and a seventh entry in Angular's
`app.routes.ts` carrying its props as route `data`.

The seed is byte-identical in all six:

```js
[{ id: 't1', on: false }, { id: 't2', on: true }]
```

**The two rows' flags DIFFER, and that is deliberate.** One keyed repeat then
carries a `checked` binding that is false and one that is true, so "the checkbox
reflects its own row" and "every checkbox reflects the same value" are
distinguishable. Two rows in the same state could not tell them apart.

### 3.6 The contract

`three-way-contract.ts` gains `'s7'`, `assertS7`, `measureForm`, `requireForm`,
`measureFormKeys` and a **measured** `resumeSymbols` entry.

Rows are keyed with `data-oracle-form-key`, a **fifth** key attribute, for the
reason S4 introduced the second, S5 the third and S6 the fourth: each key reader
matches its own attribute globally, so a scenario reusing one would silently join
that scenario's observation string.

**`measureForm` `JSON.stringify`s every attribute reading, and that is the single
most load-bearing decision in this card.** `null` (absent), `""` (present and
empty) and `"false"` (present, carrying a string) are three different outcomes on
this axis, and a reader that returned a bare string would collapse the first two
into something a failure message could not tell apart. `measureText`,
`measureExactText`, `measureRowKeys`, `measureCellKeys`, `measureBranchKeys` and
`measureTextKeys` are all **byte-unchanged**.

### 3.7 The seven observations

```
server-rendered size = s and notes = draft with picked r1, chosen t2, tags t1,t2, lock null and aria-disabled "false"
after picking r2 picked = r2 with chosen still t2
after checking t1 chosen = t1+t2 and the tags are still t1,t2
after resizing size = "l" and notes = "final" with chosen still t1+t2
after locking lock = "on", data-held = "held" and aria-disabled = "true"
1 document request served this page
no console errors and no failed requests
```

| step | what must move | what must not |
| --- | --- | --- |
| click radio `r2` | `picked` | `chosen`, `size`, `notes` |
| click checkbox `t1` (inside the repeat) | `chosen` | `picked`, `tags` |
| `resize` | `size`, `notes` | `picked`, `chosen` |
| `lock` | `lock`, `held`, `ariaDisabled` | every control reading |

**All three states of a dynamic attribute are asserted, in six lanes:**

```
lock, held      ABSENT            ->  present, carrying a string
ariaDisabled    present, "false"  ->  present, "true"
```

`size` and `notes` additionally get a **served-payload** read through
`measureServedAttribute`, which runs its payload-wide and scoped two-sided
calibration on every call.

**`resize` is a BUTTON and not a real selection change**, and that is a measured
constraint rather than a shortcut: `PageHandle` (@async/witness 0.7.0) exposes
`click`, `content`, `networkRequests`, `trackEvents`, `reload` and
`emulateNetwork` — no `fill`, no `select`, no `type`, no `evaluate`. A `<select>`
and a `<textarea>` cannot be driven from a witness lane at all. What `resize`
proves is the half this axis is about anyway: that both controls' projections
re-render from state.

### 3.8 Qwik pulled two click segments for four clicks — and the other two were `change`

`resumeSymbols.s7` was **measured** off this lane's own `handlerSegments`
evidence. Two segments, in click order, verbatim:

```
FormBoard.jsx_FormBoard_component_form_button_q_e_click_226Fd9wpp00.js
FormBoard.jsx_FormBoard_component_form_button_q_e_click_1_HB6KOsk6TiI.js
```

`_form_button_q_e_click_` rather than the `_button_q_e_click_` s2/s4/s5/s6 share:
S7's board is a `<form>`, not a `<section>`, so the structural prefix genuinely
differs and asserting the shared one would have been a weaker read than this lane
supports.

**The radio and the checkbox are `change` handlers, and they are the first
`change` handlers in this corpus any lane is ever asked to run** — S3 carries one
and the contract never clicks it. `runScenario`'s evidence filter is
`url.includes('_q_e_click_')`, so their QRLs are not counted here; that they were
pulled at all is proven behaviourally, by `picked` and `chosen` moving in the
qwik lane exactly as in the other five.

## 4. THE FINDINGS — the property/attribute split, measured six ways

### 4.1 R1, with a population: `checked` splits the six lanes FOUR ways

The instrument is the shipped S7 scenario itself, run through each lane's own
demo pipeline in a real browser, reading both the **served payload** and the
**live DOM** at every step. Not an AST reading and not a documentation claim.

```
                served      live, initial   after the state moved
react           checked=""  checked=""      UNCHANGED  (stale)
angular         checked=""  checked=""      UNCHANGED  (stale)
solid           absent      checked=""      UNCHANGED  (stale)
qwik            absent      checked=""      UNCHANGED  (stale)
svelte          checked=""  absent          absent     (deleted at hydration)
vue             absent      checked=""      TRACKS the state
```

Four distinct behaviours from one shared IR, on the same three bindings:

1. **react, angular** — the server writes the attribute and it never moves again.
2. **solid, qwik** — the server does not write it; activation adds it, then frozen.
3. **svelte** — the server writes it and hydration **deletes** it. This is
   `remove_input_defaults`, already on record for `value`
   (`docs/goals/frameless-svelte-v1/notes/T006-value-attribute-ruling.md` calls
   the `checked` case a "latent twin" that "is not asserted, so there is no impact
   today"). **It is no longer latent: S7 has three `checked` bindings and this is
   the measurement.**
4. **vue** — the server does not write it, activation adds it, **and it tracks
   state**. Vue is the only lane of six whose serialized `checked` stays true.

The same probe measured `value` on a `<select>` and a `<textarea>`, and it splits
four ways too:

```
                served select value   served textarea value
react           absent                absent
angular         absent                absent
svelte          absent                absent
solid           "s"                   "draft"
vue             "s"                   absent  (live: tracks)
qwik            "s"  (frozen)         absent
```

**This is why no `checked` or `value` reading is in the shipped observation
string.** It is not silently dropped: what each control DID is observed instead,
through `picked` and `chosen`, which are text projections of the state those
handlers write. That is the same trade `assertS3` records for `value` on a text
input, one axis wider — and S7 is what turns that trade from one lane's quirk
into a measured four-way split.

### 4.2 The boolean attribute: Angular alone, and it is behavioural

The construct is a dynamic `disabled` on a `<button>`, which lowers to
`kind: 'attribute'` and therefore to `[attr.disabled]` in Angular. Measured
end-to-end in all six lanes, on the served payload and the live DOM:

```
                as served     after the flag became true
react           absent        disabled=""
solid           absent        disabled=""
qwik            absent        disabled=""
svelte          absent        disabled=""
vue             absent        disabled=""
angular         disabled="false"   disabled="true"
```

The mechanism is named, not merely observed: `setElementAttribute` in
`@angular/core` 22.0.8 removes the attribute only when the value is `null` or
`undefined`, and otherwise writes `renderStringify(value)`.

**`disabled="false"` disables the button.** Any value of a boolean content
attribute disables the control, so the Angular lane served a *disabled* guard
button where the other five served an enabled one. This is not a serialization
difference that a diff would flag and a user would not notice — it is the control
being in the opposite state.

**There is no portable spelling of a dynamic HTML boolean attribute across these
six.** Enumerated and rejected, each for a measured reason:

- `null | true` — Angular writes `"true"`, the others write `""`.
- `null | ''` — React treats `disabled` as a boolean prop and `''` is falsy, so
  React omits it where Angular writes `disabled=""`.
- `null | 'disabled'` — React normalises a truthy string on a boolean attribute
  to `disabled=""`; Angular writes `disabled="disabled"`.

### 4.3 A `value` binding on a `<select>` or `<textarea>` is unshippable today

`packages/frameworks/solid/src/emitter/index.ts:2158` adds an `attr:value` pair
for every `kind: 'property'` binding named `value`, unconditionally. That rule was
written for `<input>` and had never met the other two control tags. It produces,
verbatim:

```
generated/S7.jsx: TS2322 … is not assignable to type 'SelectHTMLAttributes<HTMLSelectElement>'.
  Property 'attr:value' does not exist on type 'SelectHTMLAttributes<HTMLSelectElement>'.
generated/S7.jsx: TS2322 … is not assignable to type 'TextareaHTMLAttributes<HTMLTextAreaElement>'.
  Property 'attr:value' does not exist on type 'TextareaHTMLAttributes<HTMLTextAreaElement>'.
```

This is **OPEN FINDING 002** — the solid-js typing gap T008 §3 drafted an
upstream report for — reaching two more JSX interfaces. `emitted-typecheck.test.ts`
asserts EXACT equality against its `ACCEPTED` list and is **outside this card's
`allowed_files`**, so accepting these two would have required a file this card may
not touch. The `value` bindings were removed from the fixture instead. **The
existing `ACCEPTED` list is byte-unchanged and no diagnostic was silenced.**

For the PM: the upstream ask in T008 §3 should be widened from
`InputHTMLAttributes` to every JSX interface that accepts `CustomAttributes`, and
until it lands S7 cannot carry a `value` binding on a select or a textarea.

### 4.4 What was NOT done, and why each refusal is the card's

**No emitter was changed. No gate was widened. No assertion was weakened. No
existing golden or observation string moved.**

**The divergent constructs are not in the shipped fixture**, and the reasoning is
stated here rather than left implicit, because it is the judgement call on this
card — the same one T027 §4.4 made and for the same reasons:

- Shipping a dynamic `disabled` would have made S7 permanently red in one lane.
  Phase F's stopping rule requires each scenario to land in **all six**, so that
  is the broken-matrix case, not partial progress, and it would have cost the
  corpus everything S7 *can* prove in six lanes.
- Recording it costs nothing: §4.2 is reproducible in one edit per lane, the
  mechanism is named, and the three rejected spellings are enumerated with the
  lane that rejects each.
- **What ships is not a weaker claim.** `aria-disabled` bound to a boolean is the
  one spelling all six lanes agree on, and it pins the `"false"` state — the exact
  third state T024 named — *inside* the observation string, in six lanes, at every
  step. So the shipped corpus asserts absent, `"false"` and present-with-a-value,
  which is the whole axis. Only the tag it is spelled on had to change.

**These are open FINDINGS for the PM, not repairs this card was scoped to make.**
Deciding whether Angular's `[attr.x]` should special-case a boolean, or whether
the compiler should refuse a dynamic binding on a boolean content attribute the
way T038/T039 refused interior whitespace, is a policy question about the
emitters, which this card's `allowed_files` deliberately does not reach.

## 5. The mutation budget — six mutants, six red sites

One mutant per lane, one axis, spelled in each lane's own attribute idiom. T024
§5 ratified the axis in these words: *one mutant flips a boolean attribute from
absent to `="false"`.*

**`data-lock` stops being a binding and becomes a static `data-lock="false"`.**
Not a character changes anywhere else.

| lane | mutant | red site | evidence |
| --- | --- | --- | --- |
| react | `data-lock={lock}` → `data-lock="false"` | in-box assertion | `as served the lock reading is "\"false\"", not "null".` |
| solid | `data-lock={lock()}` → `data-lock="false"` | in-box assertion | same sentence |
| qwik | `data-lock={lock.value}` → `data-lock="false"` | in-box assertion | same sentence |
| svelte | `data-lock={lock}` → `data-lock="false"` | in-box assertion | same sentence |
| vue | `:data-lock="lock"` → `data-lock="false"` | in-box assertion | same sentence |
| angular | `[attr.data-lock]="lock"` → `data-lock="false"` | in-box assertion | same sentence |

Six spellings, one per renderer, not inherited between lanes. Each anchors
**exactly once** in its file and each changes the bytes, checked independently of
the harness.

**Why this and not a value change.** The point of this axis is that absent, `""`
and `"false"` are three outcomes and not one. A mutant that turned `'on'` into
`'off'` would be caught by any reader that compares strings and would say nothing
about whether the attribute is *present*. This one is caught only by a reader that
keeps `null` and `"false"` apart — which is exactly why `measureForm`
`JSON.stringify`s every attribute reading (§3.6), and this mutant is what makes
that decision load-bearing rather than decorative.

**It is red at BOTH ends, deliberately.** Red on the very first reading, where
the attribute must be absent, and red again after the lock click, where it must
read `"on"`. A mutant breaking only one end could be satisfied by a lane that had
frozen the attribute at its correct initial value.

**All six lanes go red at their own in-box assertion.** None reaches the
cross-lane observation diff, which is the same result S1–S6 produce and the reason
`CLASSIFIER_CALIBRATION` exists.

## 6. THE HARNESS — reported blocked, but NOT for the reason the card predicted

The card's stop_if says `pnpm mutate:corpus` refuses a dirty mutation surface,
that `--dry-run` does not bypass it, and that the two harness commands are to be
reported blocked for the PM to run after committing.

**The surface is not dirty any more, and that is not this card's doing.** Three
concurrent commits by other agents swept this entire package into `main` while it
was in progress (§8), so `MUTATION_SURFACE` is now clean and committed and the
refusal would not fire. The commands are still reported **blocked**, for a
different and now larger reason:

> `pnpm mutate:corpus` writes mutants into `packages/frameworks/*/generated` and
> `demos/*/emitted` and restores with `git checkout --` over that surface. Three
> other agents committed into this working tree in the last twelve minutes of
> this card. A concurrent `git add -A` landing while a mutant is on disk would
> commit a mutant to `main`, and a concurrent `git checkout --` would discard the
> other agent's work. **The harness is not safe to run until the tree has one
> writer.**

```
pnpm mutate:corpus --scenario s7
pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3 --scenario s4 --scenario s5 --scenario s6
```

**No temporary commit was created and no history was rewritten**, by this card.

### 6.1 What was done instead, and what it is worth

The six red sites in §5 were established by a **hand run of exactly the steps the
harness performs**, minus every git operation: read the pristine bytes, assert the
anchor occurs exactly once, assert the mutant changes the bytes, run the lane's
own `copy-emitted` (`build:e2e` for angular), run its witness box, read the
verdict out of the receipt rather than out of stdout, then restore **from the
saved bytes** and verify with sha256, then re-run the lane's own `copy-emitted` so
the demo copy matches its `generated/` source again.

All six restored byte-identical; the six sha256 values in §3.4 are unchanged
after all of them, and `git diff --exit-code` over the six `generated/`
directories is clean.

This is **not** a harness verdict and is not offered as one. It cannot classify a
`cross-lane observation diff` red, and it does not exercise the harness's own
`replaceOnce`/`mutate`/`restore` code paths. What it establishes is what the card
asks to be recorded per lane: the mutant bites, and the lane goes red on it, with
the raised sentence quoted.

### 6.2 The 36/36 regression check

Not blocked, and it did not degrade: `pnpm e2e` ran to completion and reports
`6 demos x 7 scenarios, all observations equal`. The s1–s6 rows in that matrix are
byte-identical to the strings T027 recorded, the S1–S6 goldens are unmoved, and
the six `generated/S1..S6.*` are byte-unchanged.

## 7. The derivation held, and only budgets needed a hand

T035/T036's derived corpus inventories picked S7 up with **ZERO edits** everywhere
derivation applies: every lane's gate test, emitter test, parse-emitted test,
type-check test and the compiler's own sufficiency loops all found S7 on their
own. `pnpm test` went from 944 to **968** with no inventory edited.

The only two hand edits were the **size budgets**, in the two files this card's
`allowed_files` correctly carries. MEASURED off this tree's emitted output:

```ts
// packages/frameworks/react/test/size.test.ts
S7: { physicalLoc: 118, structuralNodes: 573 },

// packages/frameworks/solid/test/size.test.ts
S7: { physicalLoc: 112, structuralNodes: 578 },
```

S7 is the corpus's most expensive scenario on physical lines. The two numbers pull
apart against S2 — more lines for fewer nodes — because most of S7's cost is
per-attribute rather than per-element, and the formatter gives every attribute its
own line once a tag carries three. Solid records fewer lines and more nodes than
react, the same crossover S5 showed and the reverse of S6.

**No inventory needed a hand edit, so there is no derivation defect to report.**

## 8. PARALLEL SAFETY — THREE other agents committed this card's work

This is the most serious thing on this receipt and it is not a code defect.

The card was dispatched with "Tree is clean at `a6bd400`. Two read-only Judges are
running … they write only their own note files under `docs/goals/*/notes/`", and
with an instruction to verify that rather than trust it. Verified: `git status
--porcelain` was empty at the first command of this session and HEAD was
`a6bd400`. **Both halves of that sentence then became false.**

```
2bf42b5  21:01  docs(angular): lane closed complete; T999 corrected our own record
dd9a875  21:03  docs(vue): re-audit withholds completion — the literal defect came back
97f6062  21:12  docs(goals): capability phase gets its own goal …
```

Those three commits touched **27 files inside this card's `allowed_files`**,
including the fixture, the golden, all six `generated/S7.*`, all six
`regenerate.ts`, `three-way-contract.ts`, both `size.test.ts`, `scripts/e2e.mjs`
and `scripts/corpus-mutation.mjs`. The first two captured **intermediate,
diagnostic-build states** of this card's work — `2bf42b5` committed a fixture with
a Solid gate violation in it, and `dd9a875` committed a contract whose `assertS7`
was a temporary measurement dump.

**Nothing was lost or mangled**: the working tree held the correct content at each
point, and the final commit's blobs are byte-identical to this card's finished
work. Verified by sha256 on all six `generated/S7.*` and by `cmp` on all six
`demos/*/emitted/FormBoard.*` against their `generated/` sources.

**But this card was instructed not to commit, and its work is committed anyway,
by three agents that were described as read-only.** That is the T008 §5 hazard
recurring for at least the third time in this project, and it now has teeth it did
not have then:

1. A Worker's `allowed_files` is not a lock. Three separate agents wrote to it.
2. Intermediate states reached `main`. `2bf42b5` and `dd9a875` are each a commit
   in which `pnpm test` was red on this tree.
3. **`pnpm mutate:corpus` becomes actively dangerous under this condition.** Its
   `restore()` is `git checkout --` over `MUTATION_SURFACE`. Had the PM run it
   between `2bf42b5` and now, it would have reverted the six `generated/S7.*` to
   the round-1 blobs, silently, and the run's verdicts would have been about a
   fixture nobody chose. §6 is why the commands are still reported blocked.

The PM should establish one writer before dispatching the harness.

## 9. What was NOT done, and why each refusal is the card's

- **No emitter and no gate was touched.** The Solid `controlled-input` violation
  was fixed in the FIXTURE (§3.2), never by relaxing the policy.
- No emitted-typecheck `ACCEPTED` entry added, and no diagnostic silenced (§4.3).
- `measureText`, `measureExactText`, `measureRowKeys`, `measureCellKeys`,
  `measureBranchKeys` and `measureTextKeys` untouched, byte for byte.
- No `expectedNavigations` entry relaxed; the table is per lane and unchanged.
- No activation-neutrality assertion weakened. `assertServedActivation` is
  unchanged and S7 goes through it in all six lanes like every other scenario.
- No existing golden regenerated, and no existing observation string moved.
- **No emitter's attribute handling normalised.** §4.4.
- The compiler and the six emitters were not touched at all. This card adds a
  fixture and registers it; it repairs nothing.
- No temporary commit, no `git reset`, no history rewrite — by this card. §8.
- No branch in the fixture, so the Solid `show-two-arm` constraint had nothing to
  bite, deliberately, since S5 owns the teardown axis.
- The whitespace v-limit never fired and was not weakened; every static text node
  in the fixture is a single word.

## 10. Reproducing every claim in this note

```
UPDATE_GOLDENS=1 pnpm test && pnpm test          # the golden, created then proven stable (968)
pnpm --dir packages/frameworks/react/ regenerate # and solid, qwik, svelte, vue, angular
pnpm check && pnpm lint
pnpm test:browser                                 # react 60, solid 49, svelte 13, vue 18
pnpm e2e                                          # 6 demos x 7 scenarios, all observations equal
git diff --exit-code -- packages/frameworks/*/generated

# the harness needs ONE WRITER on the tree — see §6
pnpm mutate:corpus --scenario s7
pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3 --scenario s4 --scenario s5 --scenario s6
```

To watch a red site directly without the harness, edit
`packages/frameworks/svelte/generated/S7.svelte` to read `data-lock="false"` and
run
`pnpm --dir demos/svelte-official copy-emitted && pnpm --dir demos/svelte-official exec witness run`.

**To reproduce §4.2's finding**, add `disabled={locked}` back to the guard button
in the fixture, regenerate, and read the served payload for `/s7` in each lane:
five serve nothing, Angular serves `disabled="false"`. **To reproduce §4.1**, read
`checked` off `[data-pick="r1"]` in both the served payload and the live DOM,
before and after clicking `[data-pick="r2"]`, in each of the six lanes.

The §1 measurement is reproduced by walking `buildEnrichedIr`'s output over
`packages/compiler/test/fixtures/s7-form-controls.tsrx`; the registered S7 tests
assert the same properties on every run.
