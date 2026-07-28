# T041 — Ruling on the dynamic HTML boolean attribute

Judge, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree read at `81be833`. Input: `notes/T030-corpus-s7-form-controls.md` §4.2, §4.4 — authoritative.

Everything below was re-derived at this tree from the pinned compilers and runtimes.
Nothing is inherited from the T030 note or from the T041 card, and **the card's own
central framing is overturned by measurement** (§2).

---

## 0. The ruling, in five lines

1. **Repair: PER-LANE LOWERING.** Not a v-limit. Not accept-and-document alone.
   Specifically: reclassify HTML boolean content attributes to `kind: 'property'`
   in `packages/compiler/src/build.ts`, which changes **exactly one lane's emitted
   form** (Angular `[attr.disabled]` → `[disabled]`) and **zero goldens today**.
2. **The construct is not unspellable. It is MIS-LOWERED.** All three refuted
   candidates vary the *value*. None varies the *binding kind* — which is the axis
   the answer lives on, and which T030 did not enumerate.
3. **The three candidates are exhaustive over the value axis** — re-derived, each
   confirmed at pinned versions — **and not exhaustive over the repair space.**
4. **DEFECTS.md entry 10.** Entries 8 and 9 landed since S7, so the card's "entry 8"
   is stale. It does **not** extend half 1's oracle (T038/T029 precedent, verbatim).
5. **`aria-disabled` is NOT ratified as guidance.** It is correct in the fixture and
   wrong as advice, for a reason that costs a real author accessibility, not bytes.

---

## 1. Environment check, because the card asserted one

The card states the tree is "clean at `81be833`, pushed to `origin/main`, 989 tests."
Two of those are right and one is not.

```
git status --porcelain   -> clean
HEAD                     -> 81be833743ab76484e15c025d98a841504b3d019
origin/main              -> 8b9d9e288425d1a3b2833dc78e21087eebe3abb8
```

**HEAD is one commit AHEAD of `origin/main`, not pushed.** `81be833`
(`docs(vue): point the last stale count at its derivation, line-neutrally`) exists
only locally. This does not change the ruling — the ruling is about source that is
identical either way — but the board should not carry "pushed" as a fact, and the
next agent told the same thing should check it again rather than inherit it.

`ps` shows no test, e2e, browser or mutation process. The only live things are an
esbuild service ping, a `pnpm docs:serve`, and a stale `vite preview` on port 5175
from a Qwik demo left running since 12:48AM. **Nothing else is running** — confirmed,
not accepted.

---

## 2. What I re-measured, and the thing it overturned

### 2.1 The Angular mechanism — CONFIRMED from source, at the pinned version

`@angular/core` 22.0.8, `demos/angular-official/node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs:5557`:

```js
function setElementAttribute(renderer, element, namespace, tagName, name, value, sanitizer) {
  if (value == null) {
    if (sanitizer != null) sanitizer(value, tagName || '', name);
    renderer.removeAttribute(element, name, namespace);
  } else {
    const strValue = sanitizer == null ? renderStringify(value) : sanitizer(value, tagName || '', name);
    renderer.setAttribute(element, name, strValue, namespace);
  }
}
```

and `_pending_tasks-chunk.mjs:483`:

```js
function renderStringify(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}
```

`value == null` is loose, so `null` and `undefined` remove. **`false` does not.**
`renderStringify(false)` is `String(false)` = `"false"`, so `[attr.disabled]="false"`
serves `disabled="false"`. T030's claim is exact and its consequence is exact.

### 2.2 The inversion — CONFIRMED in the DOM Angular actually serializes from

Angular 22 SSR bundles domino at
`@angular/platform-server/third_party/domino/bundled-domino.mjs`. Probing it directly:

```
setAttribute('disabled', 'false')  ->  <button disabled="false"></button>   .disabled === true
```

**`disabled="false"` disables the button, in Angular's own server DOM.** This is not
inferred from the HTML spec; it is read off the object Angular hands the serializer.

Independent corroboration from a second framework: react-dom 19.2.3 emits a runtime
warning for exactly this value —

```
Received the string `false` for the boolean attribute `disabled`.
The browser will interpret it as a truthy value. Did you mean disabled={false}?
```

React warns about the string that Angular *produces*. Two frameworks agree the value
is wrong; only one of the six emits it.

### 2.3 The three refuted candidates — each re-derived, none inherited

Angular halves read from `setElementAttribute` + `renderStringify` above. React halves
obtained by **running** `react-dom/server` 19.2.3, not by recalling its property table:

| candidate | react (measured) | angular (derived from source) | verdict |
| --- | --- | --- | --- |
| `null \| true` | `disabled=""` | `disabled="true"` | diverges |
| `null \| ''` | *omitted* | `disabled=""` | diverges |
| `null \| 'disabled'` | `disabled=""` | `disabled="disabled"` | diverges |

**All three refutations stand.** T030 got this right.

But the measurement adds a distinction T030 flattened, and it matters for §3:

- `null | true` and `null | 'disabled'` diverge in **serialization only**. Both
  spellings *disable the control* in every lane. They are behaviourally portable.
- `null | ''` diverges **behaviourally**: React ships an *enabled* button where
  Angular ships a *disabled* one. That is the same inversion as the bare boolean.

So of four spellings tried (the bare boolean plus three candidates), **two invert
behaviour and two only differ in bytes.** That refinement does not rescue candidates
1 and 3, because this harness deliberately asserts the byte-level distinction —
T030 §3.6 records that `measureForm` `JSON.stringify`s every attribute reading
precisely so `null`, `""` and `"false"` cannot collapse. A serialization divergence
is a genuine failure *by this project's own oracle*, not a cosmetic one. But it does
mean "no portable spelling" is doing less work than the card's "the underlying
construct remains unspellable."

### 2.4 THE THING THE ENUMERATION MISSED

Every candidate above varies **what value the author binds**. None varies **what kind
of binding the IR emits**. The IR already has that axis, and it already uses it:

Probing the compiler at this tree (`buildEnrichedIr`, probe source, not a fixture):

```
BINDING button {"kind":"attribute","name":"disabled"}
BINDING input  {"kind":"property","name":"checked"}
BINDING input  {"kind":"attribute","name":"readonly"}
BINDING input  {"kind":"attribute","name":"required"}
BINDING p      {"kind":"attribute","name":"hidden"}
```

**`checked` is a property. `disabled` is an attribute.** That is the entire finding.
`checked` did not invert in S7 and `disabled` did, and this line is why.

The classification is not frameless's. It is a hardcoded three-name allowlist inside
the vendored `@markless/compiler` 0.1.1:

```js
function bindingTargetForAttribute(attributeName) {
	if (attributeName === "class") return { kind: "class" };
	if (attributeName === "style") return { kind: "style" };
	if (isDomPropertyBindingName(attributeName)) return { kind: "property", name: attributeName };
	return { kind: "attribute", name: attributeName };
}
function isDomPropertyBindingName(attributeName) {
	return attributeName === "value" || attributeName === "checked" || attributeName === "selected";
}
```

`node_modules/.pnpm/@markless+compiler@file+vendor+markless-compiler-0.1.1.tgz…/dist/index.js:8558`.

Three names. Meanwhile `@tsrx/core` 0.1.32 — a sibling dependency in the same tree —
ships `DOM_BOOLEAN_ATTRIBUTES` with **29** names including `disabled`, `hidden`,
`readonly`, `required`, and a `DOM_PROPERTIES` list that is that set plus `value`
(`@tsrx/core/src/utils/dom.js:92`). The knowledge exists in the tree. The classifier
does not consult it.

**This is a coverage gap in a three-name list, not a portability limit of six
frameworks.** The framing is wrong in the card and wrong in T030 §4.4, and everything
in §3 follows from correcting it.

### 2.5 Does the property lowering actually work? Measured, both halves

**Angular's property path is built for exactly this.** `_debug_node-chunk.mjs:5381`:

```js
function mapPropName(name) {
  if (name === 'class') return 'className';
  if (name === 'for') return 'htmlFor';
  if (name === 'formaction') return 'formAction';
  if (name === 'innerHtml') return 'innerHTML';
  if (name === 'readonly') return 'readOnly';      // <- Angular already handles the boolean-attribute casing
  if (name === 'tabindex') return 'tabIndex';
  return name;
}
```

then `setDomProperty` → `renderer.setProperty(element, propName, value)` (line 5416).
Angular maps the lowercase attribute spelling `readonly` to the DOM property `readOnly`
*itself*. Property binding on these names is a supported, first-class Angular path.

**And domino reflects it.** Probing the bundled server DOM across nine values:

```
.disabled = true        -> <button disabled=""></button>
.disabled = false       -> <button></button>
.disabled = null        -> <button></button>
.disabled = undefined   -> <button></button>
.disabled = ""          -> <button></button>
.disabled = "false"     -> <button disabled=""></button>
.disabled = "disabled"  -> <button disabled=""></button>
.disabled = 0           -> <button></button>
.disabled = 1           -> <button disabled=""></button>

.hidden/.required/.readOnly = false -> <input>
.hidden/.required/.readOnly = true  -> <input hidden="" required="" readonly="">
```

Compare against react-dom 19.2.3, measured in the same session:

```
disabled={true}        -> <button disabled="">
disabled={false}       -> <button>
disabled={null}        -> <button>
disabled={""}          -> <button>
disabled={"disabled"}  -> <button disabled="">
hidden={true} / {false} / {""} / {"x"}  -> hidden="" / — / — / hidden=""
```

**The two tables are identical on every value.** Routing `disabled` through Angular's
property path does not approximate the other five lanes; it reproduces React's table
exactly, including the `null`/`undefined`/`''`/`0` cases the corpus does not yet reach.

### 2.6 Blast radius: measured, and it is zero

Scanned every dynamic binding in every shipped golden:

```
BOOLEAN-ATTR ->  checked:property   s2-keyed-todo, s3-event-form, s7-form-controls
                 value:property     s2-keyed-todo, s3-event-form
                 aria-disabled:attribute, data-*:attribute   (21 others)
```

The only boolean content attribute bound anywhere in the corpus is `checked`, and it
is **already** `property`. Every other dynamic binding is `data-*`, `aria-*` or `value`.
`data-cell-open` is a `data-*` attribute, not `open`.

Therefore reclassifying the boolean set changes **no golden and no generated file in
any of the six lanes.** Confirmed at the emitter level too: only Angular and Solid read
`binding.kind` at all —

- `packages/frameworks/angular/src/emitter/index.ts:900` — `property` → `[name]`, else `[attr.name]`
- `packages/frameworks/solid/src/emitter/index.ts:2158` — adds `attr:value` **only** when `name === 'value'`
- react / qwik / svelte / vue — validate the kind and otherwise ignore it entirely

So the change is invisible everywhere except Angular, and invisible in Angular too until
something binds a boolean attribute. **That is the safety argument, and it is falsifiable:
regenerate all six and `git diff --exit-code` must be empty.**

---

## 3. The three options, with the bill for each

### (a) v-limit — REJECTED

The T039 precedent is the obvious model. The card warned it may still be wrong here.
**It is wrong here, and for a reason stronger than "the construct is mainstream."**

T039's v-limit was correct because interior whitespace is genuinely non-neutral: three
of six lanes condense it and one rewrites non-U+0020, and *no lowering can reconcile
that* — the divergence is in each framework's own template compiler, downstream of
anything we emit. There was nothing to fix, only something to refuse.

Here the opposite is true. §2.5 measures that a lowering **does** reconcile all six,
exactly, on every value. Refusing a construct that measurement shows is portable is not
conservatism; it is shipping a limitation we manufactured. And the bill is large:
`disabled`, `hidden`, `readonly`, `required`, `multiple`, `open`, `selected` are not
edge cases, and the only substitute a v-limit could offer is "write two static elements
under an `@if`" — which duplicates the element, duplicates its handlers, and changes
identity across the branch, i.e. it trades a one-lane serialization bug for a six-lane
reconciliation hazard.

**The ledger already ran this experiment.** Entry 9 (Angular silently dropped `async`)
was **CLOSED** — "removed, not contained: the construct is **lowered**." Entries 7 and 8
were **contained by refusal** and are the two that remain **OPEN**. This document's own
`Where each one stands` table is the evidence: lowering closes, refusal contains. Reaching
for T039 by reflex would have produced a third permanently-open entry.

### (b) accept-and-document — REJECTED as the sole action

The inversion is live in a shipped emitter. No fixture binds a boolean attribute, so the
corpus **cannot** catch it — the mutation budget has nothing to mutate. Documenting a
behavioural inversion that the instrument is structurally blind to is the failure mode
this board has named four times ("an instrument that cannot fail is not an instrument").

The ledger entry is still required — see §4 — but it is the record of the repair, not
the repair.

### (c) PER-LANE LOWERING — ADOPTED

This is the project's own thesis applied literally: **diverge in form, agree in behaviour.**
Angular is the one lane that distinguishes property from attribute bindings, so it is the
one lane whose emitted form changes; the other five already spell it correctly and emit
byte-identical output before and after.

**Placement: the IR, not the Angular emitter.** Both placements produce identical emitted
output today, so this is a design call, and it goes to the IR for a reason that is already
written down. `packages/frameworks/angular/src/emitter/index.ts:886-891`:

> `DynamicBinding.kind` carries the IR's own answer, so `property` becomes `[name]` and
> `attribute` becomes `[attr.name]` **with no emitter judgement in between.**

That is a standing ruling. Putting a name check in the Angular emitter would reintroduce
exactly the emitter judgement that comment says was deliberately excluded, and would leave
the IR asserting `kind: 'attribute'` for `disabled` while one consumer quietly disagreed.
Whether `disabled` is a DOM property is a fact about the DOM, not about Angular; it belongs
in the layer that already answers that question for `value`, `checked` and `selected`.

The site is `packages/compiler/src/build.ts:844`, which is **frameless's own** translation
from the semantic graph to the IR:

```ts
kind: target?.kind === 'property' ? 'property' : 'attribute',
```

This already post-processes the vendored classifier's answer. Widening it there is that
layer's job and forks nothing.

**The three costs, named rather than waved past:**

1. **Angular gains a validity check where it had none.** `isPropertyValid`
   (`_debug_node-chunk.mjs:2863`) accepts a property binding when `propName in element`.
   Measured in domino: `'hidden' in <p>` is `true` (HTMLElement), `'disabled' in <p>` is
   **`false`**. So `disabled={x}` on a `<p>` becomes a dev-mode
   `Can't bind to 'disabled' since it isn't a known property of 'p'` where `[attr.disabled]`
   silently accepted it. This is *mostly a gain* — it catches a genuine author error — but
   it is a new Angular-only hard failure and must be in the ledger entry. Sharper wrinkle:
   `isPropertyValid` returns `true` when `Node` is undefined, so on the server this can pass
   and fail only in the browser. Do not assume SSR green means the lane is green.
2. **`hidden="until-found"` becomes inexpressible through this path.** The property coerces
   to boolean, so the string form is lost in all six. Narrow, but real, and it is the one
   value where `hidden` is not a boolean.
3. **The set becomes a maintained list.** It must be written explicitly in `build.ts` with
   the measured matrix beside it, not imported from `@tsrx/core/src/utils/dom.js` — that is
   an internal path, not a public export, and depending on it would make a vendored refactor
   silently change our IR.

**Upstream observation, not an upstream filing.** `isDomPropertyBindingName`'s three-name
allowlist is arguably a bug in `@markless/compiler`. It is the owner's own package, so this
is a note for the capability goal, not a report — and per the autonomy grant, nothing
outward-facing gets filed regardless.

---

## 4. `docs/DEFECTS.md` entry 10, and the oracle

**Entry 10, not entry 8.** The card and T030 both say "entry 8"; entries 8 (React nested
`const` write, T044) and 9 (Angular dropped `async`, T045) landed after S7 was written.
Verified against the current ledger headings.

**It does NOT extend half 1's oracle.** T038 ruled this for the whitespace finding and the
reasoning transfers without amendment: half 1 is defined over the six named defects, and
folding in findings the goal itself produced makes the goal uncloseable by construction.
The precedent chain is T029 → T038/entry 7 → T044/entry 8 → T045/entry 9. Same treatment,
stated in the entry itself as those three are.

**File it OPEN, not closed, even after the lowering lands.** Entry 9 earned CLOSED because
its repair was proven by an oracle over emitted Angular. Here the lowering will be proven at
the compiler (kind assertion) and at the emitter (`[disabled]` not `[attr.disabled]`), but
**not in any served payload**, because no scenario binds a boolean attribute. This ledger's
own closing constraint is that *a green test is evidence only if something proves it can go
red*; probe tests satisfy that for the lowering and not for the six-lane serialization claim.

**Close trigger (state it in the entry):** a corpus scenario binds a real dynamic `disabled`
and the six-lane observation string asserts the transition *absent* → `disabled=""` equal in
all six lanes, with a mutation on that binding proven red per emitter. That is a corpus card,
and it is the natural place for S7 to finally carry the construct it had to substitute away.

**Re-open trigger, should a later reader treat this as settled:** the entry must carry the
same lift-trigger discipline T039 established — a registered cross-lane matrix test that goes
red **in either direction** if any of the six lanes changes its boolean-attribute
serialization at a version bump. If Angular ever makes `[attr.x]` boolean-aware, or if any of
the five ever stops omitting on `false`, that test reports it instead of memory doing so.

---

## 5. `aria-disabled` — correct in the fixture, refused as guidance

**Ratified for S7. Not ratified as advice.**

In the fixture it is right, and T030's reasoning holds: it is portable in all six, it pins the
`"false"` state the ratification named, and it keeps the axis asserted rather than dropped.
Shipping a real dynamic `disabled` would have made S7 permanently red in one lane, and Phase
F's stopping rule requires all six. **T030's decision to substitute is RATIFIED**, and this
ruling upgrades it from defensible to correct.

As guidance to a real author it is wrong, and the cost is not cosmetic:

`aria-disabled="true"` changes **nothing** about the control. The element stays focusable,
stays in the tab order, stays clickable, and — on a submit button — still submits the form.
It announces "disabled" to assistive technology while the control keeps working. An author
who substitutes it for `disabled` ships a control that screen-reader and keyboard users are
*told* is off and that those same users can still activate. That is worse than the divergence
it was substituting for: the Angular bug disabled a control that should have been enabled,
which is loud; this pattern enables a control that is announced as disabled, which is silent
and lands hardest on the users the attribute exists for.

`aria-disabled` is the correct spelling in exactly one situation — when you deliberately want
a focusable-but-inert control (so the user can reach it and discover *why* it is unavailable)
**and** you suppress the behaviour in the handler yourself. S7 never clicks the guard button,
so it never needs the second half. A guidance document that omitted the second half would be
teaching an accessibility bug.

The ledger entry should say this in one sentence, so the next reader who finds
`aria-disabled` in the fixture does not read it as a recommendation.

---

## 6. Fairness check — does the card's caution apply?

Weighed, and it **does not apply**, for the same reason T038 gave and one more.

Each lane's behaviour is its own framework's documented default. Angular's `[attr.x]`
stringifying its value is correct and intended; that is what an attribute binding *is*.
React's boolean-prop coercion is correct. Nothing here should be filed upstream against
Angular, and the finding does not reproduce "on a stock scaffold with none of our code" in
the sense that matters — a stock Angular app does not have five sibling lanes to disagree
with.

The extra reason: **the defect is not even that the lanes disagree.** It is that we asked
Angular the wrong question. We told the IR `disabled` was an attribute when it is a property,
and Angular answered the attribute question correctly. The instrument is fair, the frameworks
are fine, and the bug is ours — which is also why it is fixable, and why entry 10 can be
closed by removal rather than contained by refusal.

---

## 7. The repair, specified

**Rule.** A dynamic binding whose name is an HTML boolean content attribute lowers to
`kind: 'property'`, not `kind: 'attribute'`.

**Placement.** `packages/compiler/src/build.ts:844`, widening the existing
`target?.kind === 'property'` test with an explicit, locally-written name set.

**The set.** Written out in `build.ts`, sourced from the HTML spec's boolean content
attributes and cross-checked against `@tsrx/core`'s `DOM_BOOLEAN_ATTRIBUTES` — but
**copied, not imported.** `value`, `checked` and `selected` continue to arrive as
`property` from the vendored classifier and need no entry.

**Proof, without enlisting the corpus.** Follow the T039 precedent exactly: prove it with a
probe source in `enriched-ir.test.ts` (`whitespaceProbeSource` is the model) plus a
cross-lane matrix test registering the measured six-lane table, and an Angular emitter
assertion. **Do not register a fixture or a golden** — the inventories are derived, so one
fixture enlists every lane's gates at once, and the e2e half is a separate, later card
(§4, close trigger).

**The safety gate is falsifiable and must be run:** regenerate all six emitters, then
`git diff --exit-code` over goldens and all six `generated/` directories. It must be empty.
If it is not, the zero-blast-radius claim in §2.6 is wrong and the task stops.

**Not handed to `frameless-emitter-capability-v1`.** The lowering is a defect repair with
measured zero blast radius and belongs on this board. Two questions *do* belong to the
capability goal, and only these two:

1. Should the IR carry a first-class third kind (`boolean-attribute`) rather than overloading
   `property` — which would let a lane distinguish "reflectable boolean" from "DOM property"
   and would give `hidden="until-found"` somewhere to live?
2. `@markless/compiler`'s `isDomPropertyBindingName` three-name allowlist, as an observation
   about the vendored dependency.

Neither blocks the repair.

---

## 8. Reproducing every claim in this note

```sh
# §1 the tree is one commit ahead of origin/main, not pushed
git rev-parse HEAD origin/main

# §2.1 Angular's attribute path, at the pinned version
sed -n '5557,5567p' demos/angular-official/node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs
sed -n '483,488p'   demos/angular-official/node_modules/@angular/core/fesm2022/_pending_tasks-chunk.mjs

# §2.2 / §2.5 the server DOM Angular serializes from
node -e "import('./demos/angular-official/node_modules/@angular/platform-server/third_party/domino/bundled-domino.mjs').then(m=>{const d=(m.default??m).createDocument('<html><body></body></html>',true);const b=d.createElement('button');d.body.appendChild(b);for(const v of [true,false,null,undefined,'','false','disabled',0,1]){b.disabled=v;console.log(JSON.stringify(v),'->',b.outerHTML)}b.setAttribute('disabled','false');console.log('attr false ->',b.outerHTML,b.disabled)})"

# §2.3 / §2.5 React's table, run rather than recalled
node -e "Promise.all([import('./demos/react-official/node_modules/react/index.js'),import('./demos/react-official/node_modules/react-dom/server.node.js')]).then(([R,S])=>{const r=S.renderToStaticMarkup??S.default.renderToStaticMarkup;for(const v of [true,false,null,undefined,'','disabled','false'])console.log(JSON.stringify(v),'->',r(R.default.createElement('button',{disabled:v},'g')))})"

# §2.4 the IR's own answer, probed through the compiler
#   buildEnrichedIr on a probe source binding disabled / readonly / required / hidden / checked

# §2.4 the three-name allowlist in the vendored classifier
grep -n "isDomPropertyBindingName" -A 3 \
  node_modules/.pnpm/@markless+compiler@file+vendor+markless-compiler-0.1.1.tgz_*/node_modules/@markless/compiler/dist/index.js
grep -n "DOM_BOOLEAN_ATTRIBUTES" -A 32 \
  node_modules/.pnpm/@tsrx+core@0.1.32_*/node_modules/@tsrx/core/src/utils/dom.js

# §2.6 blast radius — every dynamic binding in every golden
#   scan packages/compiler/test/goldens/*.json for dynamicBindings name:kind pairs

# §2.6 which emitters read binding.kind at all
grep -rn "'property'" packages/frameworks/*/src/emitter/index.ts
```

`pnpm e2e`, `pnpm test:browser` and `pnpm mutate:corpus` were **not** run — the card
forbids them, and the last restores with `git checkout --` over `MUTATION_SURFACE`.
No fixture and no golden was registered. The only file written by this ruling is this note.
