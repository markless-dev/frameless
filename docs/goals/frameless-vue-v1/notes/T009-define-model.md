# T009 — Vue `defineModel` / `v-model` through all six gates

**Verdict: `approved`. Both limbs are DENIED, each on its own grounds. IR-4 was never the blocker,
and neither — for either limb — was Gate 2.**

Measured against `vue@3.5.40` / `@vue/compiler-sfc@3.5.40` / `@vue/runtime-core@3.5.40` /
`@vue/runtime-dom@3.5.40`, all resolved from `packages/frameworks/vue`. Sources read at `41aaed0`,
which is `HEAD`; the working tree is dirty with the in-flight S5 lane and was not measured.

---

## 0. The question does not survive as one question

`state.yaml:117` names the flagship sugar as "`v-model` / `defineModel`" and the gate fires one
`no-two-way-binding` policy for both. They are **two constructs, at two emission sites, with two
different domains and two different deciding gates**. Ruling them as one entry would repeat exactly
the fault T005 found in worked example 2: *a bundled entry is a ruling waiting to be wrong about one
of its members.*

- **12a — `v-model` on an emitted host element.** Domain: `renderHost()` / `attributesOf()` /
  `eventAttribute()`. **Populated — five shipped instances.** Decided by **Gate 3 and Gate 4**.
- **12b — declaring a prop as a `defineModel()` model.** Domain: `propsDeclaration()`
  (`packages/frameworks/vue/src/emitter/index.ts:400`) — the *same* domain as worked example 3.
  **Populated — six shipped props, sugar applies to zero.** Decided by **Gate 4 and Gate 5**.

There is a third construct that is *not* ruled here because its domain is empty and I refuse the
vacuous-totality move worked example 7 refused: **`v-model` on an emitted child component**. The Vue
emitter has no component-reference path at all — `renderNode`
(`packages/frameworks/vue/src/emitter/index.ts:921`) throws *"Vue emitter has no lowering for
template node kind …"* at `:935` on anything that is not `text`, `dynamic-text`, `fragment`,
`branch`, `keyed-repeat` or `host` — and **zero of the five compiler goldens contains a
`component-reference` node**. This is entry 2b's shape exactly, and is recorded below as a stated
non-ruling rather than smuggled into 12a.

---

## 1. Scoring order, as the card requires

G2–G5 were scored first. **IR-4 does not appear in the reasoning below until §6, and by then the
ruling is already decided four times over.** The T002 dissent's prediction is discharged in §5.

---

## 2. Entry 12a — `v-model` on an emitted host element

### The domain, in emitter terms, and it is POPULATED

Every host node `renderHost()` (`:815`) prints that carries a `DynamicBinding` named `value` or
`checked` from `attributesOf()` (`:753`) together with an event directive on the same host from
`eventAttribute()` (`:730`).

Enumerated from the compiler goldens rather than guessed — **five shipped instances**:

| golden | host | binding | event | handler `writes` | handler `reads` | `syncPolicy` |
|---|---|---|---|---|---|---|
| S2 | `h2` | `property:value` | `event:0` `input` | `[state:draft:assign]` | `[]` | none |
| S2 | `h7` | `property:value` | `event:2` `input` | `[state:todos:assign, state:todos:assign]` | `[prop:props.onTrace, state:todos, state:todos.id]` | none |
| S2 | `h8` | `property:checked` | `event:3` `change` | `[state:todos:assign, state:todos:assign]` | `[prop:props.onTrace, state:todos, state:todos.id]` | none |
| S3 | `h1` | `property:value` | `event:1` `input` | `[state:text:assign]` | `[prop:props.onTrace]` | none |
| S3 | `h2` | `property:checked` | `event:2` `change` | `[state:checked:assign]` | `[prop:props.onTrace]` | none |

This is a **populated domain**, so per the T007 rule its failures are `FAIL`, not `UNKNOWN`.

### G1 — PASS, measured and calibrated

`parse` + `compileScript` + `compileTemplate` over `ssr × isProd`, baseline vs candidate, on the S3
text-input and checkbox arms and on the `v-model` + `@input` combination:

```
BASELINE text input                parseErrors=0 exactEmpty=YES
CANDIDATE v-model alone            parseErrors=0 exactEmpty=YES
CANDIDATE v-model + @input         parseErrors=0 exactEmpty=YES
BASELINE checkbox                  parseErrors=0 exactEmpty=YES
CANDIDATE v-model checkbox         parseErrors=0 exactEmpty=YES
CALIBRATION planted err            parseErrors=1 exactEmpty=NO   <- reports in all four modes
```

Exact empty `errors` **and** `tips` for every accepted case; the planted member reports at parse and
in all four compile modes, so the probe can fail. `DEFERRED — framework absent` is unavailable.

### G2 — PASS, and this is the first refutation

`v-model` on a native element is a spelling inside the emitted template. The compiler injects
`vModelText` / `vModelCheckbox` into **the emitted module's own import list** — the self-scoped
reading the policy's Gate 2 scoping clause settles, and the clause names `defineModel` by name as
decided that way. Nothing is asked of a parent, a child, a plugin, a dependency or the build graph.

**Gate 2 is not what denies this.**

### G3 — FAIL

The trigger would have to be *"this event handler assigns the element's own value to the state node
the sibling `value` binding reads."* The IR declares `writes` and `reads` per handler
(`EventHandlerRecord`, `packages/compiler/src/schema.ts:313`), so a first narrowing looks statable
in declared terms. It is not sufficient, and the reason is exhibited rather than asserted:

`StateWriteRecord` (`schema.ts:266`) records `operation: 'assign'` and carries the right-hand side
only as `value?: SerializableAstNode`. Measured on S3 `event:1`: `{ node: 'state:text', op:
'assign', hasValue: true, valueType: 'MemberExpression' }`. `draft = event.currentTarget.value`,
`draft = event.currentTarget.value.trim()` and `draft = someOtherInput.value` are **the same
declared record modulo that AST**. `v-model`'s generated assign is
`castValue(el.value, trim, castToNumber)` on the element's *own* value
(`runtime-dom.cjs.js:1515`). Separating the equivalent right-hand side from the non-equivalent ones
requires matching the shape of `StateWriteRecord.value` — inferring intent from the shape of an
expression, which Gate 3 forbids outright.

The Gate 3 **rider** is not what decides this and is not invoked: the Vue emitter throws on
persistence-bearing IR (`emitter/index.ts:1038-1039`), so the rider's clause-1 counterexample —
React's `__framelessWrite` injection — does not reproduce in this lane. Said so it is not
over-claimed.

### G4 — FAIL, four counterexamples exhibited from shipped output

Over the stated domain the sugar applies to **one of five**. S2 `h7`, S2 `h8`, S3 `h1` and S3 `h2`
all have handlers that do strictly more than the assignment — each calls `props.onTrace(…)`, and
S2's two additionally mutate a row alias and re-slice the array (two declared writes each). The
candidate's generated handler is `$event => (($setup.X) = $event)` **and nothing else**; adopting it
on those four drops the `onTrace` call, which is the e2e oracle's entire observation channel.

**The repair step was run, and it is not vacuous.** Narrow to: *handlers whose declared `writes` is
exactly the node the sibling binding reads, whose `reads` is empty, and which carry no
`syncPolicy`.* All three are declared IR fields, so this narrowing does not fall to Gate 3's trigger
test — and its domain is **not** empty: S2 `h2` / `event:0`
(`@input="(event) => draft = event.currentTarget.value"`) satisfies it exactly. I had predicted the
narrowed domain would be empty on the strength of S3 alone; **measuring S2 refuted that**, and the
narrowing therefore has to be beaten on its merits rather than dismissed as vacuous.

It is beaten twice. First by **G3**, above — the right-hand side is still unchecked, and the
unsoundness is now *reachable* rather than hypothetical, because the corpus contains an instance the
narrowing fires on. Second by **G5**, below: even the one instance the narrowing correctly identifies
is not behaviourally neutral. The repair step's own text says a narrowing that requires inspecting
contents is killed by Gate 3 and the answer is no-sugar.

### G5 — FAIL, on four measured differences

**(1) The value stops being a vnode prop, and the element loses `NEED_HYDRATION`.**

```
BASELINE  value: $setup.text                      patchFlag 40  /* PROPS, NEED_HYDRATION */  dynamicProps ["value"]
CANDIDATE withDirectives(…, [[vModelText, $setup.text]])
          "onUpdate:modelValue": $event => (($setup.text) = $event)
                                                  patchFlag 512 /* NEED_PATCH */             no value prop at all
```

`40 = 8 (PROPS) | 32 (NEED_HYDRATION)`; `512 = NEED_PATCH`. The candidate **drops the
`NEED_HYDRATION` flag**, and the value is applied by a custom directive instead of the vnode prop
diff. On a board that has already had to correct itself three times about which lane rewrites the
`value` attribute at hydration, moving the value off the vnode-prop path is a change to exactly the
mechanism under dispute.

**(2) The directive attaches listeners the baseline does not have, and suppresses one the baseline
delivers.** `vModelText.created` (`runtime-dom.cjs.js:1510-1527`) does its own `addEventListener` for
`input` (or `change` under `.lazy`), plus `compositionstart`, `compositionend` and `change`, and its
input listener opens `if (e.target.composing) return;`. **A keystroke delivered during an IME
composition writes state under the baseline and does not under the candidate.** That is a
user-detectable difference in event routing, which Gate 5 names first.

**(3) `mounted` writes the DOM unconditionally.** `vModelText.mounted(el, { value }) { el.value =
value == null ? "" : value; }` (`:1529-1531`) — and `mounted` runs on hydration. `beforeUpdate`
(`:1532-1550`) adds an `activeElement === el` guard that can *skip* a DOM write the baseline
performs. Neither behaviour exists in the baseline.

**(4) On a checkbox the SSR output itself changes.** This is the arm that was *blind* for worked
example 2a, and here it is not blind:

```
BASELINE   ssrIncludeBooleanAttr($setup.checked)
CANDIDATE  ssrIncludeBooleanAttr(Array.isArray($setup.checked) ? ssrLooseContain($setup.checked, null) : $setup.checked)
```

`v-model` on a checkbox **overloads the bound value's type at runtime**, switching to
array-membership semantics against the element's `value` (here `null`). That is in the served markup
path. The text-input arm's SSR output *is* byte-identical in both SSR modes — stated so the green is
not over-read, and so it is visible that the two arms of the same sugar do not agree.

### G6 — FAIL

A Vue lane exists, so `DEFERRED` is discharged. No standing check would fail if this sugar silently
regressed, because there is no emitted artifact to regress: `attributesOf()` and `eventAttribute()`
never print `v-model`, and the gate **actively refuses** it. That check pins the *denial*, not the
sugar. Same clause as entries 2b, 3 and 7.

### 12a ruling

`FAIL` at Gates 3, 4, 5 and 6: **denied, not deferred.** **Gate 5 decides it** — it is the one that
survives every repair, because it holds even on the single instance the narrowed domain correctly
identifies. Gates 3, 4 and 6 deny it independently. Gates 1 and 2 `PASS`.

---

## 3. Entry 12b — declaring a prop as a `defineModel()` model

Baseline (what the emitter ships): `const props = defineProps(['initial', 'onTrace'])`, read as
`props.initial`. Candidate: `const initial = defineModel('initial')`.

### The domain, in emitter terms, and it is POPULATED

Every `PropDestructuringEntry` in `component.props.entries` printed as a string literal into the
`defineProps([...])` array by `propsDeclaration()` (`emitter/index.ts:400`) — **the same domain as
worked example 3**. Six distinct shipped props: `label`, `multiplier`, `visible`, `seed`, `initial`,
`onTrace`.

### G1 — PASS

Both forms exact-empty across `ssr × isProd`, same probe and same calibration as 12a.

### G2 — PASS, and this is where the T002 dissent's *mechanism* is refuted

The dissent predicted `defineModel` **DENIED at Gate 2** because *"the child must declare bindability
and frameless emits one module per IR."* **That is worked example 4's Angular mechanism, and it does
not transfer.** Angular's `[(prop)]` is a *parent-side* form that is illegal unless the child declared
the pair — a genuine Gate 2 failure. `defineModel` is the **child's own declaration, made inside the
module being emitted**.

Measured from `runtime-core.cjs.js:4378-4384`: `useModel`'s setter reads `i.vnode.props` at runtime
and computes `hasVModel` from whether the *parent* passed both the prop and an `onUpdate:` listener —
and **when the parent did not, it falls back to a purely local value** (`localValue = value;
trigger()`). A `defineModel` component is fully functional in a tree whose parent knows nothing about
it. The imports it needs (`useModel`, `mergeModels`) land in **its own** import list.

Nothing is asked of any other module. **Gate 2 PASSES.** The policy's own Gate 2 scoping paragraph
already said so — it names `defineModel` among the constructs that clause decides — so the dissent
contradicted the paragraph it was reasoning from.

### G3 — FAIL

Unlike worked example 3, there is **no name-shape reading available**. Entry 3 could record `G3 PASS,
conditionally` because `/^on[A-Z]/` over `sourceName` is at least *decidable* from a declared field.
Nothing in a prop's `sourceName` indicates two-way intent. The only selective trigger is *"the body
assigns to `props.X`"*, which is flat content inspection.

Stated so the alternative is visible rather than skipped: a **totalising** rule — *declare every prop
as a model* — would have a declared trigger and would pass this gate. It is refuted at G4 by its own
counterexamples and at G5 outright, and is scored there.

### G4 — FAIL, six counterexamples, and IR-1 measured rather than inherited

Over the stated domain the sugar applies to **zero of six**. The sugar's precondition is the
component writing back to the prop; **no shipped prop is written back.**

The repair narrowing — *"props the component writes back to"* — is **not statable at all**, and this
is IR-1's measured content:

```
s1-render-once: prop:props writable=false writes=0 || label@prop:props,multiplier@prop:props,visible@prop:props,onTrace@prop:props
s2-keyed-todo:  prop:props writable=false writes=0 || seed@prop:props,onTrace@prop:props
s3-event-form:  prop:props writable=false writes=0 || initial@prop:props,onTrace@prop:props
s4-nested-list: prop:props writable=false writes=0 || seed@prop:props,onTrace@prop:props
```

**Every prop entry in every golden shares one graph node, `prop:props`, declared `writable: false`
with zero writes.** Per-prop write-back has no channel in the IR — not an unsound one, *none*. This
is distinct from IR-8: IR-8 is a missing *type* field on `PropDestructuringEntry`; this is a missing
*per-prop identity* in the graph. `ComponentPropExpression` (`schema.ts:149-156`) carries
`kind: 'graph-reference' | 'callback' | 'serializable' | 'opaque'` with no bindable member — that is
IR-1 as written — but the sharper fact is that even the *child* side has no per-prop node to hang
bindability on.

### G5 — FAIL, on the module's own public surface

`defineModel('initial')` compiled at 3.5.40:

```js
props: /*@__PURE__*/_mergeModels(['onTrace'], { "initial": {}, "initialModifiers": {} }),
emits: ["update:initial"],
setup(__props, …) { const initial = _useModel(__props, 'initial'); … }
```

Three differences Gate 5 names explicitly:

1. **The module's exports change.** The component's `props` option gains **`initialModifiers`**, a
   prop the author never declared, and the component gains an `emits` option it did not have.
2. **The local becomes a `ref`.** `props.initial` is a value; `defineModel`'s return is a `customRef`
   (`runtime-core.cjs.js:4357`). Every read site changes shape, and reactivity depth changes with it.
3. **The synthesized `<name>Modifiers` prop collides silently with a legal frameless prop.** Measured:

```js
// defineModel('initial') alongside defineProps(['initialModifiers', 'onTrace'])
props: _mergeModels(['initialModifiers', 'onTrace'], { "initial": {}, "initialModifiers": {} })
// parse errors: 0
```

`mergeModels` (`runtime-core.cjs.js:3665-3669`): with `a` an array and `b` an object it falls to
`extend({}, normalizePropsOrEmits(a), normalizePropsOrEmits(b))`, so **`b` wins and the author's
declaration is overwritten with zero diagnostics.** `initial` and `initialModifiers` are both legal
`PropDestructuringEntry` names. **This is the Vue instance of worked example 4's Angular
`count`/`countChange` collision — measured here for the first time rather than borrowed — and it is
worse, because Angular's derived name is at least visible in the template while this one is silent.**

Also live, and inherited honestly from entry 3's own measurement: declaring `emits: ["update:initial"]`
holds `onUpdate:initial` back from fallthrough `$attrs`. Here that *is* the delta, because the
baseline declares no emits at all.

### G6 — FAIL

A Vue lane exists, so `DEFERRED` is discharged. No standing check would fail if this sugar silently
regressed, because `propsDeclaration()` emits only the string-literal array form and the gate
actively refuses `defineModel(`. The check pins the denial, not the sugar. Same clause as 2b, 3, 7
and 12a.

### 12b ruling

`FAIL` at Gates 3, 4, 5 and 6: **denied, not deferred.** **Gate 5 decides it** — the synthesized
`<name>Modifiers` prop is a silent public-surface collision that no narrowing can remove. Gates 3, 4
and 6 deny it independently. Gates 1 and 2 `PASS`. **Re-open only if the IR gains a per-prop graph
node with declared write-back (IR-1 proper), *and* Vue's model-modifier prop stops sharing the prop
namespace** — the second is upstream and is not ours to wait on.

---

## 4. Not ruled: `v-model` on an emitted child component

Recorded as a stated non-ruling so nobody reads 12a or 12b as covering it. The Vue emitter has **no
component-reference lowering** — `renderNode` (`emitter/index.ts:921`) throws at `:935` on that kind
— and **zero of the five compiler goldens contains a `component-reference` node**. The domain is
**empty**, which under the T007 rule gives `UNKNOWN` at Gate 4, which is a no; and G6 `FAIL`s because
no check can exist for a path the emitter refuses to emit. That is entry 2b's shape exactly. It is
*denied by the same procedure*, but it is denied for a **different reason** than 12a or 12b, and
folding it into either would be the vacuous-totality move worked example 7 refused.

---

## 5. The T002 dissent's prediction — discharged, split

> *"PREDICTS defineModel is DENIED at Gate 2, not deferred — the child must declare bindability and
> frameless emits one module per IR. FAIL outranks DEFERRED, which would mean IR-4 was never its
> blocker."*

- **DENIED, not deferred: CONFIRMED.** Both limbs.
- **"IR-4 was never its blocker": CONFIRMED.** See §6.
- **"at Gate 2": REFUTED.** Gate 2 `PASS`es for both limbs, and for `defineModel` it passes on a
  runtime source line (`useModel`'s `hasVModel` fallback at `runtime-core.cjs.js:4381-4384`) rather
  than on reading. The dissent imported worked example 4's *Angular* mechanism, where a parent-side
  `[(prop)]` really is illegal without a child declaration. Vue's `defineModel` is the child's own
  declaration and Vue's native `v-model` is a template spelling; neither asks anything of anyone.

**This is the fourth time on this goal that a correct verdict was found resting on an incorrect
reason** — after the Angular T005 NG0950 limb, the T007 toolchain mechanism, and worked example 3's
`$attrs` rationale. It is also the second time the wrong reason was *shipping in a user-facing gate
message*. The pattern is now stable enough to name: **on this board, a verdict nobody disputes is the
one whose reason nobody has read.**

---

## 6. IR-4 — reached last, and it was never the blocker

Only now. `defineModel` is version-gated (stable from Vue 3.4), so the Gate 6 version corollary is
engageable in principle, and `state.yaml:117`'s inherited prose says the flagship sugar is "blocked
by IR-1 **and** IR-4."

**IR-4 is not a blocker for either limb, and never was.** Both are `FAIL` at Gates 3, 4, 5 and 6 on
grounds measured against the version this repo actually ships. `FAIL` outranks `DEFERRED`; every
deferring condition could be met — an `EnrichedIR` target-version input, a lockfile floor, anything —
and neither ruling would change by one word. The inherited "blocked by IR-1 and IR-4" is **half
right**: IR-1 is load-bearing (measured in §3's G4 — one non-writable `prop:props` node for all
props), IR-4 is decorative.

`v-model` on a native element is not version-gated at all, so IR-4 was never even *applicable* to
12a. The board has been carrying a version-gate excuse for a construct that has shipped since Vue 2.

This is exactly the outcome `state.yaml:23-36` was corrected to allow: *"A version-gated sugar that
FAILs G2 or G5 is DENIED, not deferred."*

---

## 7. Summary table

| gate | 12a `v-model` on a host | 12b `defineModel()` |
|---|---|---|
| G1 | **PASS** (measured, calibrated) | **PASS** (measured, calibrated) |
| G2 | **PASS** — asks nothing of another module | **PASS** — refutes the T002 dissent |
| G3 | **FAIL** — right-hand side needs expression-shape matching | **FAIL** — no declared trigger exists |
| G4 | **FAIL** — 1 of 5; repair reachable and still unsound | **FAIL** — 0 of 6; repair not statable (IR-1) |
| G5 | **FAIL** — **deciding gate** | **FAIL** — **deciding gate** |
| G6 | **FAIL** — no artifact; the check pins the denial | **FAIL** — same clause |
| ruling | **no-sugar, denied** | **no-sugar, denied** |
| domain | **POPULATED** → FAIL, not UNKNOWN | **POPULATED** → FAIL, not UNKNOWN |

---

## 8. An instrument gap found while reading the pins

`packages/frameworks/vue/test/gate.test.ts:391` is titled *"rejects v-model and defineEmits"*. It
mutates `:value="text"` → `v-model="text"` and asserts only the **policy id**; it mutates in a
`defineEmits(['go'])` and asserts the **message text** in four ways (`silent no-op`, `returns
undefined`, `onTraceOnce`, and a negative guard against the withdrawn `$attrs` phrasing).

**There is no `defineModel` mutation row anywhere in the file.** The limb whose reason is borrowed is
also the limb with no calibration at all — the same coincidence T007 named: *a gate outcome that
outranks its neighbours is exactly the one nobody re-checks.* The fold must add one, and must pin the
new messages the way the `defineEmits` row pins its own, calibrated red against the current strings.

---

## 9. Exact replacement text for the follow-on Worker

### 9.1 New worked examples — insert after 11b

```markdown
### 12a. Vue — `v-model` on an emitted host element → **no-sugar**

Baseline (what the emitter ships): `:value="x"` (or `:checked="x"`) plus a `@input` / `@change`
handler that performs the assignment. Candidate: `v-model="x"`.

Domain, in emitter terms: every host node `renderHost()`
(`packages/frameworks/vue/src/emitter/index.ts:815`) prints that carries a `DynamicBinding` named
`value` or `checked` from `attributesOf()` (`:753`) together with an event directive on the same
host from `eventAttribute()` (`:730`). The domain is **populated** — five shipped instances: S2
`h2`/`event:0`, S2 `h7`/`event:2`, S2 `h8`/`event:3`, S3 `h1`/`event:1`, S3 `h2`/`event:2`.

- **G1 PASS.** Measured, not read, against `vue@3.5.40` / `@vue/compiler-sfc@3.5.40`. Baseline and
  candidate both produce an **exact empty** diagnostic set — parse errors, template `errors` *and*
  `tips` — across `ssr × isProd`, on the text arm, the checkbox arm and the `v-model` + `@input`
  combination. A planted syntax error reports at parse and in all four modes, so the probe can fail.
- **G2 PASS.** A spelling inside the emitted template; the compiler injects `vModelText` /
  `vModelCheckbox` into the emitted module's **own** import list. Nothing is asked of a parent, a
  child, a plugin, a dependency or the build graph. **Gate 2 is not what denies this** — see the
  note under 12b.
- **G3 FAIL.** The trigger would be "this handler assigns the element's own value to the node the
  sibling binding reads". `StateWriteRecord` (`packages/compiler/src/schema.ts:266`) records
  `operation: 'assign'` and carries the right-hand side only as `value?: SerializableAstNode`, so
  `draft = event.currentTarget.value`, `draft = event.currentTarget.value.trim()` and
  `draft = otherEl.value` are the same declared record modulo that AST. `v-model`'s assign is
  `castValue(el.value, trim, castToNumber)` (`runtime-dom.cjs.js:1515`) on the element's own value.
  Separating them means matching the shape of an expression, which this gate forbids outright.
- **G4 FAIL.** The sugar applies to **one of five**. S2 `h7`, S2 `h8`, S3 `h1` and S3 `h2` all have
  handlers that do strictly more than the assignment — each calls `props.onTrace(…)`, and S2's two
  additionally mutate a row alias and re-slice the array. The candidate's generated handler is
  `$event => (($setup.X) = $event)` and nothing else. Counterexamples exhibited from shipped output.
  **The repair step was run and it is not vacuous:** narrowing to *handlers whose declared `writes`
  is exactly the bound node, whose `reads` is empty, and which carry no `syncPolicy`* uses only
  declared IR fields, and its domain is **not** empty — S2 `h2`/`event:0` satisfies it exactly. The
  narrowing is beaten on its merits, at Gate 3 above (the right-hand side is still unchecked, and
  the unsoundness is now *reachable* because the corpus contains an instance the rule fires on) and
  at Gate 5 below (the one instance it correctly identifies is still not neutral).
- **G5 FAIL, and it is the deciding gate.** Four measured differences.
  1. **The value stops being a vnode prop, and the element loses `NEED_HYDRATION`.** Baseline:
     `value: $setup.text`, patchFlag `40 /* PROPS, NEED_HYDRATION */`, `dynamicProps ["value"]`.
     Candidate: no `value` prop at all, `withDirectives(…, [[vModelText, $setup.text]])`, patchFlag
     `512 /* NEED_PATCH */`. `40 = 8 | 32`; the `32` is gone.
  2. **Event routing.** `vModelText.created` (`runtime-dom.cjs.js:1510-1527`) attaches its own
     `input` (or `change` under `.lazy`), `compositionstart`, `compositionend` and `change`
     listeners, and its input listener opens `if (e.target.composing) return;`. A keystroke
     delivered during an IME composition writes state under the baseline and does not under the
     candidate.
  3. **`mounted` writes the DOM unconditionally** — `el.value = value == null ? "" : value`
     (`:1529-1531`), and `mounted` runs on hydration. `beforeUpdate` (`:1532-1550`) adds an
     `activeElement === el` guard that can skip a write the baseline performs.
  4. **On a checkbox the SSR output itself changes.** Baseline
     `ssrIncludeBooleanAttr($setup.checked)`; candidate
     `ssrIncludeBooleanAttr(Array.isArray($setup.checked) ? ssrLooseContain($setup.checked, null) : $setup.checked)`.
     `v-model` overloads the bound value's type at runtime. **Stated so the green is not
     over-read:** the *text* arm's SSR output is byte-identical in both SSR modes — the two arms of
     the same sugar do not agree, which is why the checkbox arm is the proof and the text arm is not.
- **G6 FAIL.** A Vue lane exists, so `DEFERRED` is discharged. `attributesOf()` and
  `eventAttribute()` never print `v-model` and the gate actively refuses it, so there is no emitted
  artifact to regress; the check pins the *denial*, not the sugar. Same clause as entries 2b, 3 and 7.

Four `FAIL`s: **denied, not deferred.** Say which one decides it: **Gate 5 does** — it is the one
that survives every repair, holding even on the single instance the narrowed domain correctly
identifies. Gates 3, 4 and 6 deny it independently. **Re-open only if the IR gains a declared
"this handler is exactly the element's own write-back" fact** — a narrowing, not a type field, and
not IR-8.

**Not covered by this entry, and deliberately not folded into it: `v-model` on an emitted child
component.** `renderNode` (`emitter/index.ts:921`) throws at `:935` on a `component-reference`, and
zero of the five compiler goldens contains one. That domain is **empty**, which gives `UNKNOWN` at
Gate 4 and `FAIL` at Gate 6 — entry 2b's shape, a different reason for the same answer. Ruling it
inside 12a would be the vacuous-totality move worked example 7 refused.

### 12b. Vue — declaring a prop as a `defineModel()` model → **no-sugar**

Baseline (what the emitter ships): the prop is declared in the string-literal array —
`defineProps(['initial', 'onTrace'])`, read as `props.initial`. Candidate:
`const initial = defineModel('initial')`.

Domain, in emitter terms: every `PropDestructuringEntry` in `component.props.entries` printed as a
string literal into the `defineProps([...])` array by `propsDeclaration()`
(`packages/frameworks/vue/src/emitter/index.ts:400`) — **the same domain as worked example 3**. The
domain is **populated**: six distinct shipped props — `label`, `multiplier`, `visible`, `seed`,
`initial`, `onTrace`.

- **G1 PASS.** Measured at `vue@3.5.40`; both forms exact-empty across `ssr × isProd`, calibrated by
  a planted error that reports in all four modes.
- **G2 PASS — and this refutes the prediction that stood against this entry.** `frameless-vue-v1`
  T002's dissent predicted `defineModel` **DENIED at Gate 2**, on the ground that "the child must
  declare bindability and frameless emits one module per IR". **That is worked example 4's Angular
  mechanism and it does not transfer.** Angular's `[(prop)]` is a *parent-side* form that is illegal
  unless the child declared the pair. `defineModel` is the **child's own declaration, made inside
  the module being emitted**. Measured from `runtime-core.cjs.js:4378-4384`: `useModel`'s setter
  reads `i.vnode.props` at runtime, computes `hasVModel` from whether the parent passed both the
  prop and an `onUpdate:` listener, and **falls back to a purely local value when the parent did
  not**. A `defineModel` component is fully functional in a tree whose parent knows nothing about
  it, and the imports it needs land in its own import list. This is the scoping the Gate 2 import
  clause already settles, and which already names `defineModel`.
- **G3 FAIL.** Unlike worked example 3 there is no name-shape reading available: `/^on[A-Z]/` over
  `sourceName` was at least *decidable* from a declared field, and nothing in a prop's `sourceName`
  indicates two-way intent. The only selective trigger is "the body assigns to `props.X`", which is
  flat content inspection. A **totalising** rule — declare every prop as a model — would have a
  declared trigger and pass this gate; it is refuted at Gate 4 by its own counterexamples and at
  Gate 5 outright.
- **G4 FAIL.** The sugar applies to **zero of six**: its precondition is the component writing back
  to the prop, and no shipped prop is written back. **The repair narrowing "props the component
  writes back to" is not statable at all.** Measured across all four base goldens: every prop entry
  shares one graph node, `prop:props`, declared `writable: false` with zero writes. Per-prop
  write-back has no channel in the IR — not an unsound one, none. **This is IR-1, and it is
  distinct from IR-8:** IR-8 is a missing *type* field on `PropDestructuringEntry`; this is a
  missing *per-prop identity* in the graph. `ComponentPropExpression`
  (`packages/compiler/src/schema.ts:149-156`) carrying no bindable `kind` is the parent-side face of
  the same gap.
- **G5 FAIL, and it is the deciding gate.** `defineModel('initial')` compiles at 3.5.40 to
  `props: mergeModels(['onTrace'], { "initial": {}, "initialModifiers": {} })`,
  `emits: ["update:initial"]`, and `const initial = useModel(__props, 'initial')`. Three differences
  this gate names:
  1. **The module's exports change.** The `props` option gains **`initialModifiers`**, a prop the
     author never declared, and the component gains an `emits` option it did not have.
  2. **Reactivity depth.** The local becomes a `customRef` (`runtime-core.cjs.js:4357`) rather than
     a value; every read site changes shape.
  3. **The synthesized `<name>Modifiers` prop collides silently with a legal frameless prop.**
     Measured: `defineModel('initial')` alongside `defineProps(['initialModifiers', 'onTrace'])`
     compiles to `mergeModels(['initialModifiers', 'onTrace'], { "initial": {}, "initialModifiers":
     {} })` with **zero diagnostics**; `mergeModels` (`runtime-core.cjs.js:3665-3669`) falls to
     `extend({}, normalizePropsOrEmits(a), normalizePropsOrEmits(b))` when `a` is an array and `b`
     an object, so the author's declaration is overwritten. **This is the Vue instance of worked
     example 4's Angular `count`/`countChange` collision** — and it is worse, because Angular's
     derived name is visible in the template while this one is silent.
  Also live: declaring `emits: ["update:initial"]` holds `onUpdate:initial` back from fallthrough
  `$attrs`. Here that *is* the delta, because the baseline declares no emits at all — the converse
  of worked example 3, where the baseline already declared the prop and the delta vanished.
- **G6 FAIL.** A Vue lane exists, so `DEFERRED` is discharged. `propsDeclaration()` emits only the
  string-literal array form and `packages/frameworks/vue/src/gate/index.ts` actively refuses an
  emitted `defineModel(` call; the check pins the *denial*, not the sugar. Same clause as 2b, 3, 7
  and 12a.

Four `FAIL`s: **denied, not deferred.** Say which one decides it: **Gate 5 does**, and Gates 3, 4
and 6 deny it independently. **Re-open only if the IR gains a per-prop graph node with declared
write-back (IR-1 proper) *and* Vue's model-modifier prop stops sharing the prop namespace** — the
second is upstream and is not ours to wait on.

**The standing lesson this pair adds, and it is why IR-4 is mentioned only here.** This board carried
"the flagship sugar is blocked by IR-1 **and** IR-4" as inherited prose for the whole of its life.
Scored properly, **IR-4 was never the blocker for either limb** — both `FAIL` four gates at the
version this repo ships, `FAIL` outranks `DEFERRED`, and no target-version input would move either
ruling by a word. `v-model` on a host element is not even version-gated; it has shipped since Vue 2.
IR-1 is load-bearing and IR-4 is decorative, and the two had been travelling together unexamined —
the same failure worked example 3 records one level down. **A conjunction inherited as a blocker is
two claims, and the weaker one is the one nobody scores.**
```

### 9.2 Gate 1 — no change

Vue's discharge line already stands. 12a and 12b record `G1 PASS` and must not reintroduce
`DEFERRED — framework absent`.

### 9.3 `packages/frameworks/vue/src/gate/index.ts` — split both limbs

**(a) Template limb, currently at `:997-999`.** Replace the message string:

```
'Emitted Vue source uses v-model. Worked example 12a rules this form DENIED on ITS OWN grounds, MEASURED against vue@3.5.40 - do not read it as worked example 3, which rules a different macro (defineEmits), and do not read it as denied at Gate 2, which it PASSES. G4 FAIL: the domain is every host renderHost() prints with a value/checked binding from attributesOf() plus a same-host event from eventAttribute(); it holds FIVE shipped instances and the sugar applies to ONE, because the other four handlers do strictly more than the assignment - they call props.onTrace(...), which is the e2e oracle observation channel, and v-model generates $event => ((x) = $event) and nothing else. G3 FAIL on the repair: StateWriteRecord (schema.ts:266) records operation "assign" and carries the right-hand side only as an AST, so draft = event.currentTarget.value and draft = otherEl.value are the SAME declared record, and separating them means matching the shape of an expression. G5 FAIL, four measured differences: the value stops being a vnode prop and the element LOSES the NEED_HYDRATION patch flag (40 PROPS|NEED_HYDRATION becomes 512 NEED_PATCH); vModelText.created attaches its own input/compositionstart/compositionend/change listeners and DROPS any input fired while el.composing is true; vModelText.mounted writes el.value unconditionally, on hydration too; and on a checkbox the SSR OUTPUT itself gains an Array.isArray(...) ? ssrLooseContain(...) branch the baseline does not have. G6 FAIL: no emitted artifact to regress. IR-1 and IR-2 are real gaps but they are NOT what denies this form, and IR-4 was never its blocker - v-model on a host element is not version-gated at all'
```

**(b) Script limb, currently at `:1024-1031`.** Today one branch fires for
`defineModel || defineEmits` and its message is entirely about `defineEmits`. Split the condition so
each macro carries its own grounds; the `defineEmits` message is T008's and folds through
**verbatim**. New `defineModel` branch:

```
'Emitted Vue source calls defineModel(). Worked example 12b rules it DENIED on ITS OWN grounds, MEASURED against vue@3.5.40. It is NOT worked example 3, which rules defineEmits, and it is NOT denied at Gate 2 - that prediction is REFUTED: useModel (runtime-core 3.5.40, useModel setter) reads the PARENT vnode props at runtime and falls back to a purely local value when the parent did not use v-model, so defineModel is the child module declaring itself and asks nothing of anyone. G4 FAIL: the domain is every PropDestructuringEntry propsDeclaration() prints into defineProps([...]); it holds six shipped props and the sugar applies to ZERO, because its precondition is the component writing back to the prop. The repair narrowing "props the component writes back to" is NOT STATABLE: every prop entry in every golden shares ONE graph node, prop:props, declared writable=false with zero writes, so per-prop write-back has no channel in the IR at all. That is IR-1, and it is distinct from IR-8, which is a missing prop TYPE field. G5 FAIL: defineModel("x") compiles to props: mergeModels([...], { x: {}, xModifiers: {} }) plus emits: ["update:x"] plus a customRef local, so the module SILENTLY gains a prop the author never declared, gains an emits option, and changes every read site from a value to a ref - and xModifiers COLLIDES with a legal frameless prop of that name with ZERO diagnostics, because mergeModels falls to extend({}, normalizePropsOrEmits(a), normalizePropsOrEmits(b)) and the synthesized object wins. That is the Vue instance of worked example 4 Angular count/countChange, measured here rather than borrowed. G6 FAIL: no emitted artifact to regress; this check pins the DENIAL, not the sugar. IR-4 was never the blocker - four gates FAIL at the version this repo ships, and FAIL outranks DEFERRED'
```

### 9.4 `packages/frameworks/vue/test/gate.test.ts` — pin both, and add the missing row

The existing test at `:391` must split. Requirements:

1. The `v-model` mutation row must assert the **message text**, not only the policy id: it must
   contain `NEED_HYDRATION`, `composing`, `ssrLooseContain` and `one of five` (or the exact
   phrasing chosen), and must **not** match `/worked example 3/`.
2. **Add a `defineModel` mutation row — there is none today.** Mutate S3's
   `const props = defineProps(['initial', 'onTrace']);` to add `const initial = defineModel('initial');`,
   assert `no-two-way-binding` fires, and assert the message contains `mergeModels`,
   `Modifiers`, `prop:props` and `writable=false` (or the exact phrasing), and does **not** match
   `/defineEmits|onTraceOnce/`.
3. The `defineEmits` row keeps its four existing assertions unchanged, and gains a negative:
   its message must **not** match `/defineModel|mergeModels/`.
4. Every new assertion must be **calibrated red** against the current strings before the edit lands,
   the way T008 calibrated its own.

### 9.5 `packages/frameworks/vue/src/emitter/index.ts` — decision-site comment

The `propsDeclaration` doc comment (`:395-400`) should name 12b as the ruling of record for why the
string-literal array form is emitted, so the decision site and the policy agree. **Comment text
only — no behaviour change, and the emitted goldens must not move.**
