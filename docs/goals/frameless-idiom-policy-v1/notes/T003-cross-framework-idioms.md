# T003 — Cross-framework idiom-sugar survey (Vue 3, Angular, Svelte 5)

Scout receipt note for `frameless-idiom-policy-v1`. Read-only package.

**Provenance.** Dispatched to a general-purpose agent under read-only Scout rules because
Vue/Angular/Svelte are not installed in this repo and the dedicated `goal-scout` agent has no
web tools. All framework claims below were live-fetched from official docs on 2026-07-26; every
one carries a URL. Local claims cite file paths in this repo. Claims I could not source to an
official doc are explicitly marked **[inferred]**.

**Scope guard.** Per dispatch, this note does not investigate the Qwik emitter internals or
`implicit$FirstArg` — that is T002's package. The Qwik case is referenced conceptually only,
using the facts already recorded in `goal.md` / `state.yaml`.

**Not a recommendation.** No policy is proposed here. Section 4 sorts cases; it does not rule
on them.

---

## 0. Local baseline — what frameless already does about idiom sugar

This matters because the policy is not being written on a blank page. Frameless emitters
**already** own a substantial amount of framework-idiom sugar, and two prior Scout dossiers
already adjudicated cases of exactly this shape.

Verified from the repo:

| Precedent | Where | What was decided |
|---|---|---|
| `onInput` → `onChange` on leaf controls | `packages/frameworks/react/src/emitter/index.ts:1405-1406` (comment reads `// T002 ruling 9: leaf controls use React's idiomatic onChange surface.`) | React emitter rewrites the authored event name. Dossier: `docs/goals/frameless-product-v0/notes/T002-react-idioms.md` ruling 9, citing react.dev's "For historical reasons, in React it is idiomatic to use `onChange`". |
| `onInput` **kept** on leaf controls for Solid | `docs/goals/frameless-product-v0/notes/T003-solid-idioms.md` ruling 7 | Explicitly recorded as "deliberate inverse of React's onChange ruling, per-target divergence recorded". |
| `class` → `className` | `packages/frameworks/react/src/emitter/index.ts:1399` | React-only rename; Solid ruling 10 bans `className`. |
| structural branch → `<Show when fallback>` rather than a ternary | Solid dossier ruling 5; visible in `packages/frameworks/solid/generated/S1.jsx` | "Ternary retreats to attribute/text expression positions." React ruling 7 keeps the ternary-with-null-arm. |
| once-per-instance setup → `useRef` null-guard (React) vs. plain statement (Solid) | React ruling 3 / Solid ruling 9 | Same IR construct, two different framework-shaped emissions. |
| `untrack(...)` around once-captures (Solid) | `packages/frameworks/solid/generated/S1.jsx` | Emitted purely as a v2-forward intent marker; "behavior-neutral on 1.8.22". |
| `const next…` SSA + single setter call (React) vs. ordered setters as authored (Solid) | React ruling 5 / Solid ruling 6 | Driven by a real semantic difference (React batching vs. Solid synchronous sets), not by taste. |

The authored source that produces all of this is `.tsrx`, e.g.
`packages/compiler/test/fixtures/s2-keyed-todo.tsrx`:

```jsx
<input
  data-action="new"
  value={draft}
  onInput={(event) => draft = event.currentTarget.value}
/>
```

Keep that fixture in mind — it is literally the shape Vue's `v-model`, Angular's `[(ngModel)]`
and Svelte's `bind:value` all exist to compress, and it is the anchor for the strongest
candidate case in each of the three frameworks below.

**Observation (evidence, not a ruling):** the existing dossiers already distinguish
*surface-convention* sugar (`onChange`, `className`, `<Show>`) from *semantics-preserving
rewrites* (`const` SSA, `untrack`). Nothing in either dossier states a general rule for
deciding a new case. That gap is what this goal exists to close.

---

## 1. Vue 3

### 1.1 Candidate sugar cases

#### V-S1 — `v-model` on a native form control  *(strongest Vue case)*

Naive literal emission (direct transliteration of the IR: one `value` dynamic binding + one
`input` event record):

```vue
<input :value="draft" @input="event => draft = event.currentTarget.value" />
```

Idiomatic form:

```vue
<input v-model="draft" />
```

Officially sanctioned equivalence — Vue's own docs present the literal form *as the definition
of* the sugar:

> `v-model="text"` desugars to: `<input :value="text" @input="event => text = event.target.value" />`
> — https://vuejs.org/guide/essentials/forms.html

`v-model` is documented as "Limited to: `<input>`, `<select>`, `<textarea>`, components"
(https://vuejs.org/api/built-in-directives.html).

Why this is a live case for frameless specifically: the `s2-keyed-todo.tsrx` first input is
*exactly* the desugared shape, character for character. A Vue emitter that pattern-matched it
would produce a one-line template where the literal emission produces three.

#### V-S2 — `v-model` on a component, and `defineModel()` inside the emitted child

Naive literal emission, parent side:

```vue
<CustomInput :model-value="searchText" @update:model-value="newValue => searchText = newValue" />
```

Naive literal emission, child side (pre-3.4 equivalent, which Vue's docs publish verbatim as
the expansion):

```vue
<script setup>
const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue'])
</script>
<template>
  <input :value="props.modelValue" @input="emit('update:modelValue', $event.target.value)" />
</template>
```

Idiomatic form, parent:

```vue
<CustomInput v-model="searchText" />
```

Idiomatic form, child:

```vue
<script setup>
const model = defineModel()
</script>
<template>
  <input v-model="model" />
</template>
```

Source, including the explicit statement that the first block is the pre-3.4 expansion of the
second: https://vuejs.org/guide/components/v-model.html

#### V-S3 — same-name `v-bind` shorthand

```vue
<div :id="id"></div>   <!-- naive -->
<div :id></div>        <!-- idiomatic, Vue 3.4+ -->
```

> "**Available in Vue 3.4+** … When the attribute name matches the JavaScript variable name,
> you can omit the attribute value." — https://vuejs.org/guide/essentials/template-syntax.html

#### V-S4 — directive shorthands `:` / `@` / `#`

`v-bind:id` → `:id`, `v-on:click` → `@click`, `v-slot:header` → `#header`. Pure surface;
documented as shorthands with no behavioral note attached
(https://vuejs.org/guide/essentials/template-syntax.html).

#### V-S5 — relying on template ref auto-unwrapping

```vue
{{ count.value }}   <!-- naive: always correct -->
{{ count }}         <!-- idiomatic: correct only when `count` is a top-level ref -->
```

See the counter-case V-C6 — this one has a documented failure mode.

### 1.2 Counter-cases — where Vue sugar is wrong or lossy

#### V-C1 — the handler does more than assign  *(strongest Vue counter-case)*

This is not hypothetical; it is the second input in the repo's own S2 fixture
(`packages/compiler/test/fixtures/s2-keyed-todo.tsrx`):

```jsx
<input
  data-edit={todo.id}
  value={todo.title}
  onInput={(event) => {
    const title = event.currentTarget.value;
    const alias = todos.find((item) => item.id === todo.id);
    alias.title = title;
    todos = todos.slice();
    onTrace('edit', { id: todo.id, title }, event);
  }}
/>
```

`v-model` has exactly one expansion and it is `target = $event.target.value`. There is no
`v-model` spelling of "assign, then clone the array, then call a callback". So a `v-model`
emitter must be *conditional* on the handler body's shape, which means:

- the emitter output for two adjacent `<input value=… onInput=…>` sites in the same component
  diverges in **form**, not just in content — one becomes `v-model`, the other stays literal;
- the recognizer has to define, and hold stable forever, the exact predicate "this handler is
  nothing but the canonical assignment";
- worse, the same shape is *reachable by accident*. The persistence-emitted React output at
  `packages/frameworks/react/generated-persistence/P1.jsx` shows the first input's handler
  gaining a `__framelessWrite(...)` call once the cell is persisted. The authored `.tsrx` did
  not change; a later compiler pass added a statement. A `v-model` recognizer keyed on handler
  body shape silently switches emission form when an unrelated pass fires.

That last point is verified against this repo's own generated output, not inferred.

#### V-C2 — `v-model`'s expansion is element-type-dependent

Vue publishes four different desugarings (https://vuejs.org/guide/essentials/forms.html):

| element | binding | event | value read |
|---|---|---|---|
| text / textarea | `:value` | `@input` | `event.target.value` |
| checkbox | `:checked` | `@change` | `event.target.checked` |
| radio | `:checked="picked === 'a'"` | `@change` | `event.target.value` |
| select | `:value` | `@change` | `event.target.value` |

So a `v-model` emitter must read `type="checkbox"` out of the host's *static* attributes to
know which expansion the IR site corresponds to, and must reject sites whose IR shape doesn't
match the expansion for that element type. The radio row is the sharp one: its documented
desugaring binds `:checked="picked === 'a'"` — a *comparison*, not the bound cell — so a
frameless IR site with `checked={todo.done}` and a `value` static attribute is not a radio
`v-model` even though it superficially looks bindable.

#### V-C3 — `v-model` is documented as wrong for IME composition

> "For languages requiring IME (Chinese, Japanese, Korean), `v-model` doesn't update during
> composition. Use manual `@input` listener and `:value` binding instead."
> — https://vuejs.org/guide/essentials/forms.html

Vue's own docs tell you to write the *literal* form for a real class of users. A frameless
emitter that always sugars removes the author's ability to get the behavior Vue documents as
correct — and the frameless IR has no field that could carry "this input is IME-sensitive".

#### V-C4 — `v-model` overrides initial DOM attributes

> "`v-model` will ignore the initial `value`, `checked` or `selected` attributes found on any
> form elements. It will always treat the current bound JavaScript state as the source of
> truth." — https://vuejs.org/guide/essentials/forms.html

A frameless host can carry both a static `value` attribute (in `staticAttributes`) and a
dynamic `value` binding. Under literal emission those compose per normal Vue attribute rules;
under `v-model` the static one is silently discarded. Behavior change, no diagnostic.

#### V-C5 — declaring an emit changes native event routing

> "If a native event (e.g., `click`) is defined in the `emits` option, the listener will now
> only listen to component-emitted `click` events and no longer respond to native `click`
> events." — https://vuejs.org/guide/components/events.html

Also: "Declaring events in the `emits` option removes known listeners from fallthrough
attributes." So "emit a `defineEmits` declaration because it's idiomatic and self-documenting"
is **not** behavior-neutral: it changes `$attrs` contents and can shadow native events. A
frameless component whose parent-callback prop happens to be named `onClick` would, if lowered
to a declared `click` emit, stop receiving native clicks.

#### V-C6 — ref auto-unwrapping only applies to top-level template properties

> "`{{ object.id + 1 }}` … The rendered result will be `[object Object]1` because `object.id`
> is not unwrapped." — https://vuejs.org/guide/essentials/reactivity-fundamentals.html

And: "there is NO unwrapping performed when a ref is accessed as an element of a reactive array
or native collection type like `Map`". So an emitter that drops `.value` because "templates
unwrap refs" is correct only for top-level, non-collection-nested reads — and the frameless IR's
`GraphReadRef.path` is precisely a *path*, i.e. the nested case is first-class in the IR.

#### V-C7 — Vue template expressions are not JavaScript

> "Each binding can only contain **one single expression**." … flow control and declarations do
> not work. … "Template expressions are sandboxed and only have access to a restricted list of
> globals." — https://vuejs.org/guide/essentials/template-syntax.html

This is not a sugar counter-case so much as a hard constraint on *any* Vue emission (see §5),
but it bears on sugar: several "make it more idiomatic by inlining into the template" moves are
simply illegal.

### 1.3 Vue version sensitivity

| Feature | Version | Source |
|---|---|---|
| `v-model` on native elements | 3.0 (2.x too, different desugaring) | built-in-directives |
| `v-bind` `.prop` / `.attr` modifiers | 3.2+ (explicitly annotated) | https://vuejs.org/api/built-in-directives.html |
| `defineModel()` | **3.4+** | https://vuejs.org/guide/components/v-model.html, https://vuejs.org/api/sfc-script-setup.html |
| same-name `v-bind` shorthand `:id` | **3.4+** | https://vuejs.org/guide/essentials/template-syntax.html |
| reactive props destructure | **3.5+** | https://vuejs.org/api/sfc-script-setup.html |

Consequence: three of the five Vue candidate sugars are gated on a minor version. An emitter
that emits `defineModel()` produces output that does not compile on Vue 3.3, and produces output
whose *meaning* differs from `defineProps`+`defineEmits` only in ergonomics on 3.4+. Frameless
has no declared framework-version input today — see §5.

---

## 2. Angular (modern signal-based)

### 2.1 Candidate sugar cases

#### A-S1 — `model()` + `[(banana)]` two-way binding  *(strongest Angular case)*

Naive literal emission (parent):

```html
<app-counter [count]="initialCount" (countChange)="initialCount = $event"></app-counter>
```

Idiomatic form (parent):

```html
<app-counter [(count)]="initialCount"></app-counter>
```

Child, idiomatic:

```ts
export class Counter {
  count = model<number>(0);
}
```

Sanctioned equivalence, from the API reference for `model`:

> "declares a writeable signal that is exposed as an input/output pair on the containing
> directive." … **Output name**: "Generated by appending `Change` to the input name (e.g.,
> `firstName` input creates `firstNameChange` output)."
> — https://angular.dev/api/core/model

The `[(count)]` sample and the `count = model<number>(0)` child are both verbatim from
https://angular.dev/guide/templates/two-way-binding.

#### A-S2 — `input()` / `output()` signal APIs vs. `@Input()` / `@Output()` decorators

```ts
// naive / legacy
@Input() label!: string;
@Output() trace = new EventEmitter<TraceEvent>();

// idiomatic
label = input.required<string>();
trace = output<TraceEvent>();
```

Angular's own framing of the choice, quoted from the guides:

> "While the Angular team recommends using the signal-based input function for new projects,
> the original decorator-based `@Input` API remains fully supported."
> — https://angular.dev/guide/components/inputs

> "the Angular team recommends using the `output` function for new projects, the original
> decorator-based `@Output` API remains fully supported."
> — https://angular.dev/guide/components/outputs

Note the shape of that statement: *both are supported, one is recommended*. That is the same
rhetorical shape as Qwik's `$` case.

#### A-S3 — `[(ngModel)]` on native form controls

```html
<input type="text" [value]="firstName" (input)="firstName = $any($event.target).value" />  <!-- naive -->
<input type="text" [(ngModel)]="firstName" />                                              <!-- idiomatic -->
```

Verbatim sample and the `imports: [FormsModule]` requirement:
https://angular.dev/guide/templates/two-way-binding

#### A-S4 — `linkedSignal` for writable-derived cells

`linkedSignal` "creates a writable signal that is initialized and updated by a reactive
computation" (https://angular.dev/api/core/linkedSignal). The frameless IR's
`EnrichedGraphBinding` distinguishes `kind: 'computed'` from `kind: 'state'` and carries a
`writable` flag — so a binding that is both computed-from and written-to is representable, and
`linkedSignal` is its idiomatic Angular spelling. **[inferred]** — I did not find an Angular doc
that names this as the canonical lowering for a compiler; the API semantics are official, the
mapping is mine.

#### A-S5 — built-in control flow `@if` / `@for` vs. `*ngIf` / `*ngFor`

Already exercised in-repo: `poc/09-storage/angular/main.ts` uses `@if (!inert) { … }`.

### 2.2 Counter-cases — where Angular sugar is wrong or lossy

#### A-C1 — Angular templates are not JavaScript, so most frameless handler bodies cannot be inlined at all  *(strongest Angular counter-case)*

Verified from https://angular.dev/guide/templates/expression-syntax. **Prohibited** in Angular
template expressions: `new`, destructuring (object *and* array), declarations (`let`, `const`,
`function`, **arrow functions**, classes), the comma operator, bitwise operators. Event listener
statements additionally allow assignment but forbid pipes.

Now look at what frameless actually has to emit. From `s2-keyed-todo.tsrx`:

```jsx
onClick={(event) => {
  const item = { id: `c${next}`, title: draft, done: false };
  next++;
  todos = todos.concat(item);
  draft = '';
  onTrace('add', { id: item.id, title: item.title }, event);
}}
```

Not one line of that is legal in an Angular template: it declares a `const`, uses `++`, and is
a statement sequence. So the Angular emitter has no choice — handlers become class methods and
the template carries `(click)="add($event)"`. The consequence for sugar: **the "naive literal"
Angular emission does not exist.** For Angular, a large fraction of what looks like "idiom
sugar" is actually *forced lowering*, and a policy phrased as "prefer the literal form" has no
referent. A policy phrased as "prefer the form the framework's own docs use" does.

This also kills A-S3 as stated in the general case: `[(ngModel)]="x"` requires the update to be
a bare assignment to `x`, which the S2 second-input handler is not.

#### A-C2 — `model()`'s `Change` output is derived by string concatenation, so it can collide

The output name is "generated by appending `Change` to the input name"
(https://angular.dev/api/core/model). A frameless component with sibling props `count` and
`countChange` (both perfectly legal frameless props — `ComponentPropExpression.name` is an
arbitrary string, see `packages/compiler/src/schema.ts:150-156`) lowers to a `model('count')`
whose implicit output collides with the explicit `countChange` output. Two independently valid
IR props, one Angular name. Under literal `[count]` + `(countChange)` emission there is no
collision, because the author's own two names are used as written.

#### A-C3 — `[(ngModel)]` is not free: it changes the module graph and the control semantics

Using it "requires importing `FormsModule` from `@angular/forms`"
(https://angular.dev/guide/templates/two-way-binding). So the sugar decision at one template
site edits the component's `imports:` array — an emitter-owned sugar with a build-graph side
effect, unlike every sugar in the React/Solid dossiers. **[inferred]**, but from the official
requirement: `ngModel` also brings `NgModel` directive lifecycle (touched/dirty/valueAccessor)
that a plain `[value]`/`(input)` pair does not have.

#### A-C4 — `linkedSignal` resets on source change

The advanced signature is `{ source, computation }` and the whole point is that the writable
value is *recomputed* when `source` changes (https://angular.dev/api/core/linkedSignal). A
frameless `computed` binding that is also written to does **not** necessarily have "reset on
dependency change" semantics — that is a behavior the sugar would *add*. This is the clearest
Angular example of a sugar that is not two spellings of one thing.

### 2.3 Angular version sensitivity

This is the messiest of the three, and my sources partially conflict.

| API | Claim | Source |
|---|---|---|
| signal `input()` | "landed in v17.1" as developer preview | blog.angular.dev signal-inputs post, via search summary |
| `model()` | "Model inputs were released in Angular v17.2" | blog.angular.dev v17.2 post, via search summary |
| `model()` | **"stable since v19.0"** | https://angular.dev/api/core/model |
| inputs/queries etc. | "promoted to stable" in **v20** | blog.angular.dev v20 announcement, via search summary |
| `linkedSignal` | **"Stable since Angular v20.0"** | https://angular.dev/api/core/linkedSignal |
| `input()` | API page shows no experimental warning; page header reads `v22` | https://angular.dev/api/core/input |

**Conflict, stated plainly:** the `model` API page says "stable since v19.0"; the v20
announcement (which I could only reach through a search summary — `blog.angular.dev` 307s to a
Medium identity URL and I did not follow it) says the reactivity primitives were promoted to
stable in v20. I could not resolve this to a single authoritative statement. What is *not* in
doubt: none of `input()` / `output()` / `model()` / `linkedSignal` exist in Angular 16 or
earlier, all decorator equivalents remain "fully supported", and `linkedSignal` does not exist
before v19.

The `input()` API page fetch returned "v22" as a *documentation version selector*, not an
introduction version — I flag that so nobody quotes it as "input() landed in v22".

Practical consequence: an Angular emitter that emits `model()` produces output that does not
compile on Angular ≤17.1; one that emits `linkedSignal` does not compile on ≤18. The decorator
form compiles everywhere Angular still supports. This is the sharpest version-binding risk of
the three frameworks.

---

## 3. Svelte 5 (runes)

### 3.1 Candidate sugar cases

#### S-S1 — `onclick` event attributes (Svelte 5) vs. `on:click` directives (Svelte 4)

```svelte
<button on:click={toggle}>toggle</button>   <!-- Svelte 4 -->
<button onclick={toggle}>toggle</button>    <!-- Svelte 5 -->
```

> "In Svelte 4, we use the `on:` directive to attach an event listener to an element, in Svelte 5
> they are properties like any other (in other words — remove the colon)."
> — https://svelte.dev/docs/svelte/v5-migration-guide

Already the in-repo choice: `poc/09-storage/svelte/App.svelte` uses `onclick={toggle}`.

#### S-S2 — attribute and event shorthand

> "Shorthand form: `<button {onclick}>click me</button>`" and "When attribute name matches
> value: `{name}` replaces `name={name}`" — https://svelte.dev/docs/svelte/basic-markup

#### S-S3 — `$derived` instead of `$state` + `$effect`

```svelte
let complete = $state(0);
$effect(() => { complete = todos.filter(t => t.done).length; });  <!-- naive -->

let complete = $derived(todos.filter(t => t.done).length);        <!-- idiomatic -->
```

The frameless IR already distinguishes these: `EnrichedGraphBinding.kind` is `'state' | 'computed'
| 'element' | 'prop'` and `ComponentEvaluationPolicy.computedBindings` is `'reactive'`
(`packages/compiler/src/schema.ts:20, 226-229`). So this one needs **no inference at all** — the
IR says which it is.

#### S-S4 — `bind:` + `$bindable()` for two-way props

```svelte
<FancyInput value={message} onValueChange={(v) => message = v} />  <!-- naive callback prop -->
<FancyInput bind:value={message} />                                <!-- idiomatic -->
```

Child: `let { value = $bindable(), ...props } = $props();`
— https://svelte.dev/docs/svelte/$bindable

#### S-S5 — `bind:value` on native inputs

Direct analogue of Vue's `v-model` / Angular's `[(ngModel)]`, over the same S2 fixture shape.
"A `bind:value` directive on an `<input>` element binds the input's `value` property."
— https://svelte.dev/docs/svelte/bind

#### S-S6 — `$props()` destructuring with fallbacks instead of explicit defaulting

`let { adjective = 'happy' } = $props();` — https://svelte.dev/docs/svelte/$props. The frameless
IR carries this directly: `PropDestructuringEntry.defaultValue`
(`packages/compiler/src/schema.ts:205-212`).

### 3.2 Counter-cases — where Svelte sugar is wrong or lossy

#### S-C1 — `bind:` requires an lvalue, and props are not bindable by default  *(strongest Svelte counter-case)*

> "bindings require an lvalue — 'a variable or an object property.' You cannot bind arbitrary
> expressions" — https://svelte.dev/docs/svelte/bind

> "In runes mode, properties are not bindable by default: you need to denote bindable props with
> the `$bindable` rune." — https://svelte.dev/docs/svelte/v5-migration-guide

Two distinct failures follow.

*Lvalue.* The frameless IR's write target is a `graphNodeId` + a `path`
(`StateWriteRecord`, `schema.ts:266-280`) and the read is a `GraphReadRef` with the same shape.
A path-nested write into a keyed-repeat row — the S2 `todos.find(...).title = title` case, which
the IR records with `via: 'handler-local-alias'` — is not an lvalue Svelte can bind to.

*Bindability is a cross-file contract.* `bind:value` on a frameless-emitted child only works if
that child was itself emitted with `$bindable()`. So the sugar decision at the *parent's* call
site constrains how the *child module* is emitted. Under the current architecture, emitters
consume one `EnrichedIR` per module (`EnrichedIR.filename`, `schema.ts:493-501`); the parent
cannot unilaterally decide the child's prop declaration form.

#### S-C2 — `$derived` must be side-effect-free; frameless computeds are arbitrary expressions

> "The expression inside `$derived(...)` should be free of side-effects." Svelte "actively
> prevents state mutations (like `count++`) inside derived expressions."
> — https://svelte.dev/docs/svelte/$derived

The frameless IR stores a computed as `ExpressionSite.expression: SerializableAstNode` — an
arbitrary JS AST with no purity guarantee anywhere in the contract. Lowering every
`kind: 'computed'` binding to `$derived` is safe only for the subset that is actually pure, and
nothing in the IR certifies that subset. (S-S3, which looked like the free lunch, has a domain of
validity after all.)

#### S-C3 — event delegation changes `stopPropagation` semantics

> "Avoid `stopPropagation()` with delegated listeners; use the `on` function from `svelte/events`
> instead." Delegated events include `click`, `input`, `change`, `keydown`, …
> — https://svelte.dev/docs/svelte/basic-markup

The frameless IR has a first-class `SyncPolicy` whose actions are exactly
`'preventDefault' | 'stopPropagation'` (`schema.ts:35-39`). So the IR can express a
`stopPropagation` on a `click` — which is precisely the combination Svelte's docs tell you not to
write as an `onclick` attribute. The idiomatic-looking emission is the wrong one here, and the
Solid dossier already hit the mirror image of this (ruling 6: "stopPropagation forbidden outside
`on:` form (delegation caveat)").

#### S-C4 — event modifiers were removed, and two of them have no attribute-form replacement

> "Event modifiers (`|once`, `|preventDefault`, etc.) no longer work with the new syntax." … "capture:
> use event name modification: `onclickcapture={...}`" … "**passive/nonpassive**: These cannot be
> expressed as wrappers; use actions instead if absolutely necessary."
> — https://svelte.dev/docs/svelte/v5-migration-guide

If frameless ever grows `once`/`capture`/`passive` in `SyncPolicyBranch.actions`, the Svelte 5
attribute form can express `capture` (by renaming the attribute) but *cannot* express
`passive`/`nonpassive` at all. The Svelte 4 directive form could.

#### S-C5 — destructuring `$state` loses reactivity; fallbacks are not proxies

> "When destructuring reactive values, the resulting references are not reactive—they capture the
> value at that moment." — https://svelte.dev/docs/svelte/$state
> "Fallback values are not turned into reactive state proxies." — https://svelte.dev/docs/svelte/$props

So S-S6 (fallbacks in the destructure) is not equivalent to an explicit
`value ?? default` at each read site when the default is an object or array. This is the exact
class of bug the Solid dossier's ruling 8 was written to avoid ("NO props destructuring (docs:
breaks reactivity)") — same hazard, different framework.

#### S-C6 — mutating a non-`$bindable` prop is a warning, not an error

> "Attempting to mutate regular object props has no effect. Mutating reactive state props
> triggers an `ownership_invalid_mutation` warning" — https://svelte.dev/docs/svelte/$props

A wrong sugar call here fails at *runtime*, in dev only, as a console warning. Compare A-C1,
where a wrong Angular call fails at build time. Failure mode differs by framework.

### 3.3 Svelte version sensitivity

| Feature | Version | Source |
|---|---|---|
| runes, `onclick` attributes, `$props`, `$bindable` | **Svelte 5** (none exist in 4) | v5-migration-guide |
| function bindings `bind:value={get, set}` | **5.9.0+** | https://svelte.dev/docs/svelte/bind |
| `$props.id()` | **5.20.0+** | https://svelte.dev/docs/svelte/$props |
| reassignable `$derived` | **5.25+** ("Prior to Svelte 5.25, deriveds were read-only") | https://svelte.dev/docs/svelte/$derived |
| `$state.eager` | present in current docs; no version given | https://svelte.dev/docs/svelte/$state |

The Svelte 4→5 boundary is the largest single version discontinuity across all three frameworks:
it is not "one form is more idiomatic", it is "the other form does not exist". Within 5, the
gating is at the *patch/minor* level (5.9, 5.20, 5.25), which is finer-grained than Vue's or
Angular's.

---

## 4. Structural comparison to the Qwik `$`-prop case

### 4.1 The Qwik case's structural fingerprint

From `goal.md` / `state.yaml` (T002 owns the mechanics; I use only the recorded facts):

- Both `onInput$={$((e, el) => …)}` and `onInput$={(e, el) => …}` are valid.
- The framework itself does the wrapping for `$`-suffixed props.
- The trigger is a **syntactic property of the prop name** (`$` suffix) — nothing about the
  handler body, the element type, the other component, or the framework version.

That yields five discriminating axes, which I use to sort every case below. These are extracted
from the evidence, not proposed as policy:

| Axis | Qwik `$` |
|---|---|
| **Locality** — does the sugar change one token at one site, or does it also constrain another file/component? | one site |
| **Inference** — is it triggered by a declared IR fact, or by recognizing an intent pattern? | declared fact (prop name) |
| **Totality** — does it apply to every instance of the construct, or only a recognized subset? | total |
| **Semantic delta** — does anything observable change? | none |
| **Version binding** — is the sugar gated on a framework version? | no (within Qwik 2) |

### 4.2 Same in kind as the Qwik `$`-prop case

Local, no inference, total, no semantic delta, no version gate.

| Case | Framework | Why same in kind |
|---|---|---|
| V-S4 `:` / `@` / `#` shorthands | Vue | Documented as shorthands; identical compiled output; applies to every directive use. |
| S-S1 `onclick` attribute form | Svelte 5 | Within Svelte 5 there is only one form (`on:` is the *Svelte 4* form, not an alternative spelling) — so it is total and semantics-free **inside a fixed major**. See caveat below. |
| S-S2 `{onclick}` / `{value}` shorthand | Svelte | Pure attribute-name-equals-value elision. |
| A-S5 `@if` / `@for` | Angular | Two sanctioned template spellings of the same control flow, both current. Already the in-repo choice. |

Caveat on S-S1: it is same-in-kind *only* once you fix the major version. Across the 4/5
boundary it is a different-in-kind case, because the alternative form does not exist. That is
itself a finding: **"same in kind" is not a property of a sugar alone; it is a property of a
sugar plus a pinned framework version.**

Near-miss, listed separately because it fails exactly one axis:

| Case | Fails |
|---|---|
| V-S3 same-name `:id` shorthand | Version binding (3.4+). Local, total, semantics-free otherwise. |
| A-S2 `input()`/`output()` vs. decorators | Version binding, and it is a *whole-component* form choice rather than a per-site token. Rhetorically the closest Angular analogue to the Qwik case ("both fully supported, one recommended"). |
| S-S6 `$props()` fallbacks | Semantic delta via S-C5 (fallbacks are not proxies). |

### 4.3 Different in kind

| Case | Framework | Which axis breaks |
|---|---|---|
| **V-S1 `v-model` on native controls** | Vue | *Inference* (must recognize "handler is exactly the canonical assignment", V-C1) + *totality* (element-type-dependent expansion, V-C2) + *semantic delta* (static attr override V-C4, IME V-C3). Breaks four of five axes. |
| **V-S2 `v-model` / `defineModel` on components** | Vue | *Locality* — the parent's `v-model` is only valid if the child declares `modelValue`+`update:modelValue`. Cross-module contract. Plus version binding (3.4+). |
| V-S5 ref auto-unwrap | Vue | *Totality* — only top-level, non-collection-nested reads (V-C6), and the IR's read model is path-based. |
| Vue `defineEmits` declaration | Vue | *Semantic delta* — changes `$attrs` and can shadow native events (V-C5). |
| **A-S1 `model()` + `[(banana)]`** | Angular | *Locality* (child must declare `model()`) + *semantic delta* (implicit `Change` name can collide, A-C2) + version binding. |
| A-S3 `[(ngModel)]` | Angular | *Locality* in an unusual direction — it edits the component's `imports:` array (A-C3) — plus inference (assignment-only handlers) and added `NgModel` lifecycle. |
| A-S4 `linkedSignal` | Angular | *Semantic delta* — adds reset-on-source-change that the IR never asked for (A-C4). |
| **S-S4 / S-S5 `bind:` + `$bindable`** | Svelte | *Locality* (child must be `$bindable`) + *totality* (lvalue-only targets; the IR's `path` + `handler-local-alias` writes are not lvalues) (S-C1). |
| S-S3 `$derived` | Svelte | *Totality* — the IR declares which bindings are computed (so no inference needed, a genuinely favourable case) but does not certify purity, which `$derived` requires (S-C2). Closest of the "different in kind" set to being same-in-kind. |

### 4.4 The load-bearing pattern

Every framework's flagship sugar — Vue `v-model`, Angular `[(…)]`/`model()`, Svelte
`bind:`/`$bindable` — is the **same feature**: two-way binding. And in all three, it is
different in kind from the Qwik `$` case, for the same two reasons every time:

1. **It is a cross-component contract, not a local spelling.** The parent's sugared form is only
   legal if the child was declared to accept it (`defineModel` / `model()` / `$bindable()`).
   Qwik's `$` requires nothing of anyone else.
2. **It requires the compiler to infer intent from a handler body** — "this handler is nothing
   but the canonical assignment" — and that predicate is not a fact the frameless IR states. It
   is a shape the emitter would have to recognize, and (verified against
   `generated-persistence/P1.jsx`) it is a shape a *later compiler pass can silently destroy*.

Conversely, every case that came out same-in-kind is a pure lexical substitution with a
one-to-one mapping and no other party involved.

The three frameworks therefore do not present one hard question three times. They present one
easy class (lexical shorthands) and one hard class (two-way binding), and the Qwik `$` case sits
squarely in the easy class on every axis except that nobody has yet written down what the axes
are.

---

## 5. IR gaps — expansion-board inputs, **not** policy inputs

These are things the frameless IR cannot currently express. They belong on the Vue/Angular/Svelte
adapter goal boards. They are listed here only so they are not confused with the sugar question.
All verified against `packages/compiler/src/schema.ts` unless noted.

### 5.1 Cross-framework gaps

| # | Gap | Evidence | Affects |
|---|---|---|---|
| IR-1 | **No two-way / bindable prop kind.** `ComponentPropExpression.kind` is `'graph-reference' \| 'callback' \| 'serializable' \| 'opaque'` (schema.ts:152). `graph-reference` is read-only downward — see `generated-composition/C5-props.jsx`, where the child receives a plain value. There is no way to say "this prop is a two-way channel". | schema.ts:149-156 | Vue `defineModel`, Angular `model()`, Svelte `$bindable` |
| IR-2 | **No emit / custom-event concept.** Child→parent is callback props only. `EnrichedEventRecord` is bound to a `hostNodeId` (schema.ts:318-325) — i.e. DOM events on host elements — with no component-emitted-event record. | schema.ts:318-325 | Vue `defineEmits`, Angular `output()` |
| IR-3 | **Only a default slot.** `TemplateDefaultSlotProjection` (schema.ts:172-176) has no name. No named slots. | schema.ts:171-176 | Vue `#header` / `v-slot`, Angular `ng-content select=`, Svelte snippets |
| IR-4 | **No framework-version input.** Nothing in `EnrichedIR` or the adapter surface declares a target framework version. Given §1.3 / §2.3 / §3.3, an adapter has no way to know whether `defineModel` (3.4+), `model()` (≥17.2/19), or reassignable `$derived` (5.25+) is available. | schema.ts:493-501 | all three |
| IR-5 | **Event modifier vocabulary is two items wide.** `SyncPolicyBranch.actions` is exactly `'preventDefault' \| 'stopPropagation'` (schema.ts:35-39). No `once`, `capture`, `passive`, `self`, key aliases. | schema.ts:24-39 | Vue's 10 `v-on` modifiers; Svelte's removal of modifiers (S-C4) |
| IR-6 | **No class/style binding vocabulary.** `DynamicBinding` is `{kind: 'attribute' \| 'property', name, expression}` (schema.ts:87-90); `class` is handled by a one-line rename in the React emitter (`emitter/index.ts:1399`). No object/array class syntax, no per-class toggles. | schema.ts:86-90 | Vue `:class` object/array, Angular `[class.x]`/`ngClass`, Svelte `class:` |
| IR-7 | **Purity is never asserted.** `ExpressionSite.expression` is an arbitrary `SerializableAstNode`; `ComponentEvaluationPolicy` declares `computedBindings: 'reactive'` but nothing about side effects (schema.ts:74-78, 225-229). | schema.ts | Svelte `$derived` (S-C2), Vue's "should not have side effects" note on template function calls |

### 5.2 Vue-specific

- **IR-V1 — template expression language mismatch.** Vue bindings are "one single expression"
  with sandboxed globals (https://vuejs.org/guide/essentials/template-syntax.html). The IR stores
  full JS statement bodies (see the S2 `onClick` above). A Vue adapter must lower every non-trivial
  handler to a `<script setup>` function — a whole emitter capability, not a sugar choice.
- **IR-V2 — no modifier channel for `.lazy` / `.number` / `.trim`, nor for custom `v-model`
  modifiers** (which arrive at the child as a `modelModifiers` prop —
  https://vuejs.org/guide/components/v-model.html).
- **IR-V3 — no named-model channel.** Vue supports `v-model:title`, multiple per component.
  IR-1 and IR-3 both bite here.

### 5.3 Angular-specific

- **IR-A1 — template expression restrictions are stricter than Vue's** (no arrow functions, no
  destructuring, no `++`, no `const`; assignment allowed only in event statements —
  https://angular.dev/guide/templates/expression-syntax). Everything in `EventHandlerRecord`
  must become a class method. See A-C1.
- **IR-A2 — no class-member/decorator model.** The IR describes a function component
  (`EnrichedComponent` with `props`, `locals`, `guards`, `template`). Angular needs a class with
  fields, a `@Component` decorator, an `imports:` array, and a selector. The `imports:` array in
  particular is *not* derivable from `EnrichedIR.imports` alone (A-C3).
- **IR-A3 — no writable-derived distinction.** `EnrichedGraphBinding` has both `kind: 'computed'`
  and `writable: boolean` (schema.ts:288-291), so the *data* is there, but there is no recorded
  semantic for "what happens to the written value when a dependency changes" — which is exactly
  what `linkedSignal` decides (A-C4).

### 5.4 Svelte-specific

- **IR-S1 — no lvalue classification on writes.** `StateWriteRecord` carries
  `via: 'direct' | 'handler-local-alias'` (schema.ts:279) but nothing that says "this write target
  is a bindable lvalue". Required by S-C1.
- **IR-S2 — no `$state.raw` / deep-vs-shallow reactivity signal.** `GraphValueKind` is
  `'scalar' | 'object' | 'array' | 'unknown'` (schema.ts:22) — enough to pick a container, not
  enough to pick `$state` vs. `$state.raw`.
- **IR-S3 — no snippet/children-with-parameters concept**, which is Svelte 5's replacement for
  slot props. Compounds IR-3.

---

## 6. Prior local exploration — `poc/09-storage`

Both POCs are ~30-line hand-written probes for the storage/persistence goal, not emitter output.
Their value here is that they record what a frameless author *already assumed* about each idiom,
before this policy question was raised.

### `poc/09-storage/svelte/App.svelte` — Svelte 5 runes, and one non-idiomatic choice

```svelte
<script>
  import { onMount } from "svelte";
  let { cell } = $props();
  let value = $state(read());
  function read() { return cell.get(); }
  onMount(() => cell.subscribe((next) => (value = next)));
  function toggle() { cell.set(value === "dark" ? "light" : "dark"); }
</script>
<span id="value">{value}</span>
<button id="toggle" onclick={toggle}>toggle</button>
```

Assumptions recorded, and my read of each:

- **`$props()` + `$state`, not `export let`** — Svelte 5 runes mode assumed as the baseline. No
  Svelte 4 path was considered anywhere in the POC.
- **`onclick={toggle}`, not `on:click`** — S-S1 was already taken, silently, with no note.
- **`{value}` interpolation, `{cell}` destructured prop** — S-S2-adjacent shorthands taken.
- **`onMount` + manual `subscribe`, not `$effect`** — this is the interesting one. `$effect` is
  the runes-mode idiom for exactly this; `onMount` is the Svelte 4 lifecycle carried forward. So
  the POC is *not* uniformly idiomatic: it took the cheap syntactic sugars and skipped the one
  that would have required rethinking the shape. **[inferred]** as to motive.
- **`cell` is a plain prop, not `$bindable`** — the parent (`main.js`) passes `props: { cell: theme }`
  and never binds. Consistent with S-C1's constraint, though probably by accident rather than
  design.

### `poc/09-storage/vue/main.js` — Vue, and the idiom question dodged entirely

```js
const App = {
  setup() {
    const value = shallowRef(theme.get());
    const unsubscribe = theme.subscribe((next) => { value.value = next; });
    onUnmounted(unsubscribe);
    return () => [
      h("span", { id: "value" }, value.value),
      h("button", { id: "toggle", onClick: () => theme.set(...) }, "toggle"),
    ];
  },
};
```

Assumptions recorded:

- **Render functions (`h`), not SFC templates.** This sidesteps every Vue idiom question in this
  note: there is no `v-model`, no `:`/`@` shorthand, no `defineModel`, no template expression
  sandbox, because there is no template. It also means the POC used `onClick:` camelCase (the
  render-function form) rather than `@click`.
- **Explicit `.value`, not template auto-unwrapping** — V-S5/V-C6 never arose, again because
  there is no template.
- **`shallowRef`, not `ref`** — a deliberate reactivity-depth choice with no IR counterpart
  (relates to IR-S2's Vue analogue).
- **No SFC / no `<script setup>` at all**, so `defineProps`/`defineEmits`/`defineModel` were
  never touched.

### `poc/09-storage/angular/main.ts` — bonus, not in the dispatch but relevant

Uses `signal()`, `provideZonelessChangeDetection()`, `standalone: true`, and `@if` control flow —
so it assumed the modern signal-based Angular, and took A-S5. But it used `implements OnDestroy`
+ `ngOnDestroy` rather than a signal-native teardown, mirroring the Svelte POC's `onMount`
choice: syntactic modernity adopted, lifecycle shape left classic.

**Cross-POC finding.** All three POCs independently converged on "adopt the cheap surface-level
modern syntax, keep the classic lifecycle/effect shape". That is a real, if informal, prior: the
in-repo instinct has been to sugar what is lexical and stay literal where the shape would have to
change. Nobody wrote that down as a rule, and it was not applied consistently (the Vue POC opted
out of the entire question by using render functions).

---

## 7. Candidate held-out cases for the cold-agent replication test

Shortlist of five. Each is decidable, non-obvious, and has a defensible answer under any
coherent policy. **Per the T004 constraint, no answers are recorded here.** Each entry states the
case and the facts an agent would need — nothing about which way it should go.

Ordering is by how cleanly the case isolates a single axis, most-isolated first.

### H1 — Vue same-name `v-bind` shorthand (`:id="id"` → `:id`)

The emitter has a dynamic binding whose attribute name is identical to the identifier being
bound. Vue 3.4+ permits `:id`. Facts an agent needs: it is purely lexical, one site, no other
component involved, no behavior change — but it is gated on Vue 3.4, and frameless declares no
target version (IR-4). Isolates the version-binding axis alone, with every other axis clean.

### H2 — Svelte `$derived` for a frameless `computed` binding

The IR *declares* `kind: 'computed'`, so no intent inference is needed — this is not a
pattern-match. But `$derived` requires the expression to be side-effect-free, and the IR asserts
nothing about purity (IR-7). The alternative is `$state` + `$effect`, which is legal for any
expression. Isolates the totality axis: a declared IR fact that nonetheless has a domain of
validity.

### H3 — Angular `input()` / `output()` versus `@Input()` / `@Output()`

A whole-component form choice rather than a per-site token. Angular's docs say the signal form
is "recommended … for new projects" while the decorator form "remains fully supported" — the
same both-are-valid framing as the Qwik case. But the signal form does not exist before 17.1/17.2
and the two forms differ in *shape* (a callable signal vs. a plain field), which propagates into
every read site in the emitted template. Isolates: rhetorically-identical-to-Qwik, structurally
different granularity.

### H4 — Vue `v-model` on a native `<input>` whose handler is exactly the canonical assignment

Deliberately the *favourable* instance: the S2 first input, where the handler body genuinely is
`draft = event.currentTarget.value` and nothing else. Facts an agent needs: Vue publishes this
exact desugaring; the recognizer is a handler-body shape match, not a declared IR fact; the
adjacent second input in the same component does *not* match, so the two siblings would emit in
different forms; a later compiler pass (persistence) can add a statement to the handler and flip
the match, as verified in `generated-persistence/P1.jsx`. Isolates the inference axis under
best-case conditions.

### H5 — Svelte `bind:value` on a frameless-emitted child component

The parent has a `graph-reference` prop plus a `callback` prop that writes it back. Facts an
agent needs: `bind:` requires the *child* to declare `$bindable()`; frameless emits one module
at a time from one `EnrichedIR`; the IR has no bindable prop kind (IR-1); and a wrong call here
surfaces as a dev-only `ownership_invalid_mutation` console warning rather than a build error.
Isolates the locality axis, plus the failure-mode question.

**Selection note for T004.** H1 and H2 test whether the policy handles the *clean* axes in
isolation; H4 and H5 test whether it handles the two axes that every framework's flagship sugar
breaks. H3 is the trap case: it reads like the Qwik case and is structurally not. If only one is
held out, H3 discriminates a memorized answer from an applied rule most sharply. **[inferred]** —
this is my read of the shortlist's discriminating power, not a ruling on any case.

---

## Appendix — sources

Live-fetched 2026-07-26. All are official framework documentation except where noted.

**Vue 3**
- https://vuejs.org/guide/components/v-model.html
- https://vuejs.org/guide/essentials/forms.html
- https://vuejs.org/guide/essentials/template-syntax.html
- https://vuejs.org/guide/essentials/reactivity-fundamentals.html
- https://vuejs.org/guide/components/events.html
- https://vuejs.org/api/sfc-script-setup.html
- https://vuejs.org/api/built-in-directives.html

**Angular**
- https://angular.dev/guide/components/inputs
- https://angular.dev/guide/components/outputs
- https://angular.dev/guide/templates/two-way-binding
- https://angular.dev/guide/templates/expression-syntax
- https://angular.dev/api/core/model
- https://angular.dev/api/core/input
- https://angular.dev/api/core/linkedSignal
- blog.angular.dev v17.2 / v18 / v20 announcements and the signal-inputs developer-preview post
  — reached **only via search result summaries**; `blog.angular.dev` 307-redirects to a Medium
  identity URL that I did not follow. Treated as weaker evidence and flagged where it conflicts
  with the API pages (§2.3).

**Svelte 5**
- https://svelte.dev/docs/svelte/v5-migration-guide
- https://svelte.dev/docs/svelte/basic-markup
- https://svelte.dev/docs/svelte/$state
- https://svelte.dev/docs/svelte/$derived
- https://svelte.dev/docs/svelte/$props
- https://svelte.dev/docs/svelte/$bindable
- https://svelte.dev/docs/svelte/bind

**In-repo**
- `packages/compiler/src/schema.ts`
- `packages/frameworks/react/src/emitter/index.ts`
- `packages/frameworks/react/generated/S1.jsx`, `generated-composition/C5-props.jsx`,
  `generated-composition/C6-scalar-context.jsx`, `generated-persistence/P1.jsx`
- `packages/frameworks/solid/generated/S1.jsx`
- `packages/compiler/test/fixtures/s2-keyed-todo.tsrx`
- `docs/goals/frameless-product-v0/notes/T002-react-idioms.md`
- `docs/goals/frameless-product-v0/notes/T003-solid-idioms.md`
- `poc/09-storage/{vue,svelte,angular}/`
