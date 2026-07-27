# Frameless emitter idiom policy

Frameless emitters translate one IR into several frameworks' native source. At many points the
target framework accepts more than one correct spelling of the same construct, and one of them is
the one that framework's own community, docs, and tooling treat as normal. This document decides
when a frameless emitter adopts that spelling and when it does not.

The output is the product. A reader of frameless output must be able to check it against the
framework's own documentation. That is the standing bias, and the procedure below is how it is
applied.

## Vocabulary

- **Emission site** — a point where an emitter must choose the shape of its output for a
  construct the IR describes.
- **Sanctioned form** — a spelling the target framework's own documentation or toolchain accepts
  as correct at the version being targeted. A framework normally sanctions more than one.
- **Baseline form** — among the sanctioned forms available at an emission site, the one that
  (a) is valid across the widest range of target-framework versions, and (b) imposes the fewest
  obligations on any party other than the module being emitted.
- **Candidate sugar** — any sanctioned form other than the baseline that the emitter is being
  asked to emit instead.
- **Observable** — a difference a consumer of the emitted module, or a user of the running
  component, could detect. A difference visible only in emitted source text is not observable.

Note carefully: the baseline is **not** "the literal form" or "the naive form". In some
frameworks no such form exists. Angular template expressions forbid `const`, arrow functions,
destructuring and `++`, so a frameless handler body cannot be inlined into an Angular template at
all — it must become a class method. That is **forced lowering**, not sugar, and this procedure
does not apply to it. In Angular the baseline is simply the more permissive of the sanctioned
forms. Every framework has a baseline; not every framework has a naive one.

Angular's case is forced by **expressibility** — the naive form cannot be written down. That is
not the only trigger. Forced lowering also covers the case where the naive form is syntactically
legal in the target and produces observably incorrect behaviour for the construct the IR declares.
A form the framework accepts as *parseable* is not thereby a sanctioned form for that construct.
Before running the gates, state the sanctioned set — the forms the framework's own docs or
toolchain accept as *correct for that construct* — and choose the baseline from inside it. If the
current emitted output is not in that set, this is a defect fix and the procedure does not apply.
Never run Gate 5 against known-broken output: it will always `FAIL`, and the `FAIL` is
meaningless.

**This second trigger is gated on membership, not on preference.** It is available only where the
current form can be shown to be **outside** the sanctioned set, and the showing is the burden of
whoever invokes it: a framework diagnostic, a lint rule the framework ships against that shape, a
dedicated construct the framework provides *because* that shape does not work, or a witnessed
runtime failure. Name the evidence in the record. A form that is inside the sanctioned set and is
merely disliked, slower, less idiomatic or less pleasant to read is a **candidate sugar**, and it
goes through all six gates like everything else. If you cannot say what the framework itself
holds against the current output, you are not in forced lowering, and a `FAIL` at Gate 5 is a real
`FAIL`. Reframing a genuine Gate 5 `FAIL` as forced lowering in order to push a change through is
the failure mode this paragraph exists to stop.

Two entries below are this species rather than sugar questions: worked example 9, where Qwik
accepts `preventDefault()` inside a lazily fetched QRL and the call never runs in time; and the
original `stopPropagation` finding in worked example 6, where Svelte accepts the attribute form
and its delegated listeners defeat it. Note the difference between them — example 6 was repairable
by narrowing the domain, so it stayed a sugar question and kept running the gates, while example 9
was not.

## The procedure

Run all six gates. **Do not short-circuit.** Record an outcome for every gate even after one
fails; the record is what makes a ruling re-openable.

Outcomes per gate: `PASS`, `FAIL`, `UNKNOWN`, or `DEFERRED`.

`DEFERRED` is not available at every gate. Gate 6 may always record it. Gates 1 and 4 may record it
**only** for the two specific causes named in those gates — the target framework being absent from
this repo's lockfile, and the target emitter not existing. No other gate may record `DEFERRED`, and
no gate may record it for any other reason. "We did not get to it" is `UNKNOWN`, which is a no.

Then:

- Any `FAIL` → **no-sugar**, recorded as *denied*. Emit the baseline form.
- Any `UNKNOWN` → treat as `FAIL` → **no-sugar**, *denied*. Unknown is not a tie. It is a no.
- Otherwise, any `DEFERRED` → **no-sugar for now**, recorded as *deferred, not denied*. Emit the
  baseline form and re-run the procedure when every deferring condition is met.
- All six `PASS` → **sugar**.

`FAIL` outranks `DEFERRED`. One `FAIL` anywhere makes the ruling *denied*, however many gates
deferred alongside it: every deferring condition can later be met and the ruling still not change.
Say in the record which one it is. *Denied* and *deferred* emit the same output — the baseline —
and differ only in what has to happen before the question is worth asking again.

---

### Gate 1 — Sanctioned, and measured

*Are both forms accepted by the exact framework build this repo ships, and was the correspondence
measured rather than read?*

Build or run both forms through the framework's own toolchain, at the exact version in this
repo's lockfile, and compare diagnostics and behavior.

A statement in the framework's docs, a doc-comment in its source, or a blog post is **not
evidence**. It is a hypothesis to test. Framework documentation routinely describes a mechanism
that is not the mechanism actually at work.

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

### Gate 2 — Locality

*Is the sugar fully decided inside the single module being emitted?*

`FAIL` if it requires anything of another module, of the emitted component's parent or child, or
of the build graph — an added import list entry **in another module**, a plugin, a new dependency,
or a declaration the other end must make.

Frameless emits one module per `EnrichedIR`. Any sugar whose legality depends on how a
*different* module was emitted fails this gate by construction. This is the gate that every
framework's two-way-binding sugar fails.

**Scope of the import clause.** It is scoped to *another* module deliberately, and that scoping is
settled, not a judgement call. An import the emitted module adds to **its own** import list is not
a Gate 2 failure: the emitter already manages its own framework imports — `useSignal`, `useStore`,
`useComputed$`, `$`, `sync$` — and worked example 1 already passes this gate with `$` in the
baseline's own import list, so the self-scoped reading would retroactively invalidate a shipped
ruling. Every other item in the failure list above is an obligation on a *third party*; read
self-scoped, the import clause would be the only one out of family. Vue's `defineModel`, Angular's
`input()`/`output()` and Svelte's `on` from `svelte/events` — which worked example 6 already
commits to — are all decided by this scoping, and are decided the same way: an import of the
target framework's own runtime into the module being emitted asks nothing of anyone else.

### Gate 3 — Declared trigger

*Is the sugar triggered by a fact the IR or the emitter declares, rather than by recognizing a
pattern in the contents of an expression or a handler body?*

`FAIL` if deciding whether to sugar requires inspecting what a handler does, or inferring the
author's intent from the shape of an expression.

**Rider — later-pass protection.** If a content-based trigger is ever admitted despite this gate,
it must satisfy both of the following, or it is `FAIL`:

1. The test runs on the emitter's **final lowered output** for that construct, not on the IR
   record it started from. The emitter injects statements into handler bodies from IR channels
   other than the one a content trigger would read. In this repo, `buildPersistenceRecords`
   (`packages/compiler/src/build.ts:420`) lands persistence records on the IR
   (`packages/compiler/src/schema.ts:476`), and the React emitter then injects a
   `__framelessWrite(...)` statement into the handler during its own lowering
   (`packages/frameworks/react/src/emitter/index.ts:1246`). The visible result is
   `packages/frameworks/react/generated-persistence/P1.jsx`, where a handler that is a bare
   assignment in the base golden acquires a second statement. A trigger that matched on the IR's
   `EventHandlerRecord` would never see it.
2. It ships with a **fail-closed enumeration** of every IR channel that can contribute statements
   to that construct, which fails when a new channel is added. Today that set is
   `EnrichedEventRecord.handlers` and `ir.persistence`. It will grow.

Without both, a content trigger silently rots: it keeps returning an answer, and the answer stops
being right, and nothing fails.

### Gate 4 — Totality over a stated, emitter-decidable domain

*State the domain in terms of the emitter's own code — which function, which construct. Does the
sugar then apply to every instance in that domain?*

`FAIL` if it applies only to a recognized subset of the domain as stated.

**Phrasing requirement.** State the domain in emitter terms, never in framework folklore. "The
framework does this for you" is a folklore domain; it is almost always wrong at the edges, and
the edge is where the build breaks.

**Repair step.** If Gate 4 fails, try restating the domain more narrowly, using only declared
facts, and re-run the procedure from Gate 1 on the narrowed rule. If the narrowing requires
inspecting contents, Gate 3 kills it and the answer is no-sugar. This repair step is what
separates a sugar that is merely stated too broadly from one that is unavailable.

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

### Gate 5 — Behavioral neutrality

*Is there any difference a consumer of the emitted module, or a user of the running component,
could detect?*

`FAIL` if the sugar changes event routing, initial or default values, reactivity depth, throw or
error behavior, lifecycle, or the module's exports.

**Not** a failure: differences in emitted source text, symbol names, chunk counts, or
build-artifact classification. Those are not behavior. They may be the *reason* to adopt a sugar,
and as such they are adjudicated by Gate 6, which requires them to be measured.

### Gate 6 — Pinned by a standing check against the shipped build

*If this sugar silently regressed, would a check this repo already runs fail?*

The check must exercise the target lane — the framework's own official scaffold — at the exact
framework version in the lockfile, and assert observable behavior.

- `PASS` — such a check exists, or the sugar's claimed benefit is itself asserted by one.
- `FAIL` — the sugar's only justification is an artifact property nothing checks, or the
  justification was measured against a toolchain this repo does not ship.
- `DEFERRED` — no lane exists for that framework yet. Emit the baseline and re-run when it lands.

**Version corollary.** A sugar available only from framework version *N* can pass Gate 6 only if
the lockfile pins ≥ *N* **and** the emitter can know the version it is targeting. Frameless has no
target-framework-version input in `EnrichedIR` today, so version-gated sugar `FAIL`s or `DEFER`s
until it does. Adding that input is an adapter-board concern, not a licence to guess.

---

## Worked examples

Each example states the six outcomes and the ruling. These are the record; they are not
illustrations.

### 1. Qwik — `$`-suffixed JSX event props → **sugar**

Baseline: `onClick$={$(async () => …)}`. Candidate: `onClick$={async () => …}`.
Domain, in emitter terms: the handler expression returned by `emitEvent` in
`packages/frameworks/qwik/src/emitter/index.ts`, for host-element event props, whose prop name is
produced by `eventAttributeName` and therefore always ends in `$`.

- **G1 PASS** — both forms build clean through the `qwikVite` bundled in
  `@qwik.dev/core@2.0.0-beta.38`, the build `demos/qwik` ships. Measured, not read: the
  documentary claim that `implicit$FirstArg` handles JSX event props is **false** —
  `implicit$FirstArg` wraps arg0 of `$`-suffixed *API functions* only; JSX event props are
  rewritten by the optimizer. The conclusion survived; the stated mechanism did not. This is the
  case Gate 1 exists for.
- **G2 PASS** — one call site, one module, nothing asked of any other party, no build-graph edit.
- **G3 PASS** — the trigger is the prop name produced by the emitter's own `eventAttributeName`.
  Handler contents are never inspected, so the Gate 3 rider does not engage.
- **G4 PASS** — total over the stated domain. Note what the folklore phrasing would have cost:
  "Qwik adds the `$` for you where the name ends in `$`" is **not** total. An explicit `$()`
  *inside* an `implicit$FirstArg` API — `useTask$($(fn))` — is a hard optimizer error (C03) that
  emits a broken chunk. That construct is a different emitter path and is out of the stated
  domain by construction; frameless already emits `useTask$(async () => …)` raw. Stating the
  domain in emitter terms is what keeps the two apart.
- **G5 PASS** — same lazy-load boundary, same handler, same behavior; the deltas are artifact
  classification and capture strategy.
- **G6 PASS** — `pnpm e2e` drives `demos/qwik` on its official Qwik Router scaffold at the
  lockfile version and asserts, per scenario, that the served container is `paused`, that it
  transitions to `resumed`, and that a `qsymbol` event fires whose detail contains
  `_q_e_click_` at the required count
  (`demos/react-official/three-way-contract.ts`, `resumeSymbols` and the outcome block). A
  handler that stopped being a lazily-pulled QRL would fail it.

Measured justification, on `demos/qwik/dist/q-manifest.json` from a real
`pnpm --dir demos/qwik build`: under the baseline form all 12 emitted handlers are
`ctxKind: 'function'`, `ctxName: '$'`, `captures: true`, and the manifest contains **zero**
`eventHandler` symbols. Under the candidate form the same handler becomes
`ctxKind: 'eventHandler'`, `ctxName: 'onClick$'`, `captures: false`. The optimizer's own
symbol-priority sort places `eventHandler` symbols first and ranks them by event name (`click`
first); `function` symbols are ranked against a list that does not contain `'$'`. The baseline
form therefore puts every interactive handler at the bottom of the optimizer's priority ordering.

No latency benefit was measured, and none is claimed.

**Known narrowing:** the candidate form depends on the optimizer running. Frameless Qwik output
is not expected to work in a runtime-only JSX setup with the optimizer bypassed. Gate 6 pins the
optimizer lane, so this is accepted, and recorded here so it is not rediscovered as a surprise.

### 2. Vue — `v-bind` / `v-on` / `v-slot` shorthands (`:id`, `@click`, `#header`) → **deferred**

**G1 DEFERRED — framework absent**: no Vue in this repo's lockfile, so the claim that the
shorthands compile identically is documentary, which is a hypothesis and not evidence. G2 PASS,
G3 PASS (triggered by the binding's structural kind, not its contents). **G4 DEFERRED — emitter
absent**: with no Vue emitter, "every directive use" names no function and its totality cannot be
shown; no counterexample is known either. G5 PASS. **G6 DEFERRED** — there is no Vue emitter and no
Vue lane in `pnpm e2e`. No gate `FAIL`s. Ruling: baseline until a Vue lane on an official Vue
scaffold exists; re-run then. This is a deferral, not a rejection.

### 3. Vue — declaring a callback prop as a `defineEmits` event → **no-sugar**

**G1 DEFERRED — framework absent**, G2 PASS, G3 PASS, **G4 DEFERRED — emitter absent**.
**G5 FAIL**: declaring a native event name in `emits` means the listener responds only to
component-emitted events and no longer to native ones, and declared events are removed from
fallthrough `$attrs`. A frameless component with a callback prop named `onClick` would stop
receiving native clicks. That is a behavior change with no diagnostic. **G6 DEFERRED.** The three
deferrals do not decide this; G5 does, and `FAIL` outranks `DEFERRED`, so the ruling is **denied,
not deferred** — a Vue lane would not change it.

### 4. Angular — two-way binding `[(prop)]` on an emitted child → **no-sugar**

Baseline: `[prop]="x"` plus `(propChange)="x = $event"`, with the handler as a class method.
Note this baseline is itself a sanctioned Angular form — there is no naive form to fall back to.

**G1 DEFERRED — framework absent** (no Angular in this repo's lockfile). **G2 FAIL**: `[(prop)]` is
legal only if the child module declares the prop as two-way capable. Frameless emits one module per
`EnrichedIR`; the parent cannot decide the child's declaration form. **G4 DEFERRED — emitter
absent.** Independently **G5 FAIL**: the implicit change-output name is derived by appending
`Change` to the input name, so a component with sibling props `count` and `countChange` — both
legal frameless props — collides, whereas the baseline uses the author's two names as written.
**G6 DEFERRED** (no Angular lane, and the sugar is version-gated with no target-version input).
Two independent `FAIL`s, which outrank the three deferrals: **denied, not deferred**. The ruling is
stable.

### 5. Angular — `@if` / `@for` control-flow blocks → **deferred**

**G1 DEFERRED — framework absent**: no Angular in this repo's lockfile, so the only available
evidence is documentary, which this gate does not accept. G2 PASS, G3 PASS (structural template
facts). **G4 DEFERRED — emitter absent.** G5 PASS. **G6 DEFERRED** (no Angular lane). No gate
`FAIL`s. Ruling: baseline until an Angular lane exists. This is a deferral, not a rejection.

Read this example together with the forced-lowering note above: most of what looks like Angular
"idiom sugar" is not sugar at all. Angular template expressions forbid `const`, arrow functions,
destructuring and `++`, so frameless handler bodies must become class methods regardless of any
ruling here. The procedure applies to genuine choices between sanctioned forms, not to lowerings
the target language forces.

### 6. Svelte 5 — `onclick={…}` event attributes → **deferred, after repair**

As first stated — "emit every event as an `onname` attribute" — **G4 FAIL**: the frameless IR can
declare a `stopPropagation` action on an event
(`SyncPolicyBranch.actions`, `packages/compiler/src/schema.ts:35-39`), and Svelte's docs say not
to use `stopPropagation` with delegated listeners — a set that includes `click`, `input`,
`change` and `keydown` — directing you to `on` from `svelte/events` instead. The rule is not
total over its stated domain.

Apply the **repair step**: narrow the domain to events whose declared `SyncPolicyBranch.actions`
do not include `stopPropagation`, and use `on()` for the rest. The narrowing reads a *declared*
IR field, so Gate 3 still passes. Re-run: **G1 DEFERRED — framework absent** (no Svelte in this
repo's lockfile), G2 PASS, G3 PASS, **G4 DEFERRED — emitter absent** (the narrowed domain has no
known counterexample, but with no Svelte emitter its totality cannot be shown), G5 PASS,
**G6 DEFERRED** (no Svelte lane). No gate `FAIL`s: deferred, not denied.

This is the example to reach for when a sugar looks nearly right. The repair step distinguishes a
rule stated too broadly (repairable) from a rule that needs to inspect contents (not repairable).
It is also the example that shows Gate 4 doing real work without an emitter: the original `FAIL`
was found in the IR schema, not in any Svelte emitter. An absent emitter defers Gate 4; it never
excuses it.

### 7. Svelte 5 — `$props()` destructuring with fallback values → **no-sugar**

**G1 DEFERRED — framework absent**, G2 PASS, G3 PASS, **G4 DEFERRED — emitter absent**.
**G5 FAIL**: destructured reactive values are not reactive, and fallback values are not turned into
reactive state proxies — so an object or array default is not equivalent to defaulting at each read
site. This matches an existing frameless ruling in the Solid dossier, which already banned props
destructuring for the same reason in a different framework. **G6 DEFERRED** (no Svelte lane).
`FAIL` outranks the deferrals: **denied, not deferred**.

### 8. React — `onInput` → `onChange` on leaf controls, and `class` → `className` → **sugar** (existing, retro-validated)

Both predate this document; both are re-derived by it. G1 PASS, G2 PASS, G3 PASS (triggered by
element kind and attribute name), G4 PASS, G5 PASS (React's `onChange` on leaf controls is
React's own idiomatic surface for the same event), **G6 PASS** — `pnpm test:browser` and
`pnpm e2e` drive `demos/react-official` at the lockfile React version and compare observable
behavior; a wrong event name or attribute name fails immediately.

Note the deliberate divergence recorded in the Solid dossier: Solid keeps `onInput` and bans
`className`. Per-target divergence is expected. The procedure is shared; its answers are not.

### 9. Qwik — unconditional `preventDefault()` → a leading `sync$()` QRL in a QRL array → **forced lowering** (adopted)

**Sanctioned set, stated first.** Per the second forced-lowering trigger above, the set is named
before any gate runs. For "cancel an event's default action", `@qwik.dev/core@2.0.0-beta.38` ships
exactly two sanctioned forms: the element-level `preventdefault:<event>` attribute
(`core-internal.d.ts:2445` declares
``[K in keyof HTMLElementEventMap as `preventdefault:${K}`]?: boolean``, and `core.mjs` carries
`isPreventDefault()`, `PREVENT_DEFAULT = 'preventdefault:'` and
`addUseOnModifier(…, 'preventdefault')`); and a leading `sync$()` QRL inside the array a Qwik
event prop accepts, whose elements run in order.

**The pre-fix output was in neither set.** It left `event.preventDefault()` inside the ordinary,
lazily fetched QRL. That shape is parseable and builds clean, and it does not work: Qwik ships a
lint rule against it (`eslint-plugin-qwik`'s `no-async-prevent-default`) and ships two dedicated
constructs precisely because it does not work. The runtime failure was witnessed, not argued —
clicking a `<button type="submit">` whose handler body is nothing but `event.preventDefault()`
still issued the form's GET, the handler's segment arriving roughly 58ms *after* dispatch by CDP
timings. That handler was fully **synchronous**, so the cause is QRL laziness and not `async`;
neither this lowering nor the gate policy guarding it inspects `async`. Wrong output is not a
baseline. This is therefore a defect fix under forced lowering, and the baseline was re-chosen
from inside the sanctioned set.

Adopted form:

```jsx
onClick$={[
  sync$((event) => { event.preventDefault(); }),
  $(async (event) => { /* the rest of the authored body */ }),
]}
```

Domain, in emitter terms: the handler expression returned by `emitEvent()`
(`packages/frameworks/qwik/src/emitter/index.ts`) for a host-element event prop whose
`EnrichedEventRecord` declares unconditional `preventDefault`.

- **G1 PASS** — measured, not read, against `@qwik.dev/core@2.0.0-beta.38`, the build `demos/qwik`
  ships. Two things were measured rather than assumed: that `sync$()` is serialized inline into
  the HTML and resolves without a network round trip, so it runs during dispatch; and that the
  optimizer does **not** extract array *elements*, so the remainder must be `$()`-wrapped or it
  stays an inline closure, never becomes a QRL, and is silently dropped from `q-e:click` during
  serialization.
- **G2 PASS** — one call site, one emitted module. The added `sync$` and `$` imports are the
  emitted module's **own** import list entries, which is not a Gate 2 failure under the scoping
  recorded at that gate. Nothing is asked of any other module, of a parent or child, or of the
  build graph.
- **G3 PASS** — the trigger is the declared IR field `EnrichedEventRecord.syncPolicy`, never
  handler contents. The Gate 3 rider does not engage.
- **G4 PASS** — the domain is every record for which `hoistsPreventDefault()` returns true, and
  that predicate **is** the deciding function: a single branch, `constant-truthy` with a truthy
  value, whose actions include `preventDefault`. It is total over that domain by construction.
  Everything else — a `branches` list, a `graph-truthy` or `event-equals` guard — is *conditional*
  cancellation, whose `sync$()` body would have to read reactive state, and is deliberately
  outside the stated domain rather than an unhandled subset of it.

  > **Superseded in part by worked example 10.** The stated domain was widened from "unconditional
  > `preventDefault`" to "any lowerable declared `SyncPolicy`", and the deciding function is now
  > `syncActionPlan()`. The G4 reasoning is unchanged in kind: what falls outside the domain is now
  > *refused by name* rather than silently emitted, which is the part of this entry that was wrong.
- **G5 — neither `PASS` nor `FAIL`. The procedure does not apply.** Recorded that way
  deliberately, and it is the outcome this entry exists to pin down. The two forms are plainly
  **not** behaviourally equivalent — the default action is now actually prevented, which is the
  entire point of the change — so under the letter of Gate 5 this `FAIL`s. But the pre-fix shape
  was never a *sanctioned* form for this construct, and Gate 5 compares a candidate against a
  baseline drawn from the sanctioned set. Comparing against wrong output is a category error that
  would produce a spurious `FAIL` every single time a defect is fixed. Restricted to the real
  sanctioned set, the pre-fix shape was never a member; forced lowering applies and the gate is
  not askable.

  Read the scope of that narrowly. "The procedure does not apply" is not a fifth outcome label
  available to a sugar question, and it is not reachable by preferring a different form. It is
  reachable here only because the sanctioned set was stated up front and the current output was
  shown to sit outside it, on the framework's own evidence — its lint rule, its two dedicated
  constructs, and a witnessed runtime failure.
- **G6 PASS** — `pnpm e2e` drives `demos/qwik` on its official Qwik Router scaffold at the
  lockfile version and asserts, after clicking `[data-action="cancel-submit"]`, that exactly one
  `resourceType` `Document` request served the page, that `[data-scenario="s3"]` still exists, and
  that `data-writes` still reads `2` — a reload would reset it to `0`. That check **failed before
  this change** (two Document requests) and passes after, and all three framework lanes now emit
  the identical observation. The standing check is `demos/react-official/three-way-contract.ts`,
  `assertS3`.

**Form choice between the two sanctioned forms was never gated, and is recorded here so it is not
reopened.** It was settled by the repo owner, who is on the Qwik core team. Two facts decide it:

1. The array carries the **rest of the handler body**, which `preventdefault:click` cannot. At the
   `type="button"` site the authored handler also performs two state writes and an `onTrace$`
   call, so the split into a `sync$()` element plus a `$()` element is needed there regardless of
   which cancellation mechanism is chosen. Using the array everywhere means one shape covers the
   whole lowering — hence the one-element array when cancellation was the entire body.
2. `preventdefault:click` is **element-level**, whereas `SyncPolicy` is **per-event-record**. The
   attribute cancels an event name on an element; the IR declares cancellation against a specific
   event record. Lowering a per-record declaration onto an element-level attribute would lose that
   correspondence wherever the two do not coincide.

### 10. Qwik — a **conditional** `SyncPolicy` → a **synthesized** guard inside the leading `sync$()` QRL → **forced lowering** (adopted)

Extends worked example 9 from the unconditional case to the whole lowerable condition grammar.
Ruled by `docs/goals/frameless-defects-and-targets-v1/notes/T011-conditional-cancellation.md`;
implemented by that goal's T012.

**Why this is a separate entry rather than a footnote to 9.** Example 9 recorded conditional
cancellation as "outside the stated domain". It was — but what happened to it was not neutral:
`hoistsPreventDefault()` returned `false`, `emitEvent()` returned a **bare lazily fetched QRL**
carrying the authored `event.preventDefault()`, and the emitter silently re-emitted defect 1. Only
the gate caught it. Outside-the-domain must mean *refused*, not *emitted anyway*; that is the
correction this entry carries.

Adopted form, for `if (event.key === 'Enter') { event.preventDefault(); submit(); }`:

```jsx
onKeydown$={[
  sync$((event) => { if (event.key === 'Enter') { event.preventDefault(); } }),
  $(async (event) => { if (event.key === 'Enter') { await props.submit(); } })
]}
```

Domain, in emitter terms: every `EnrichedEventRecord` whose `syncPolicy` is a single branch,
declares at least one action, and whose guard contains no `graph-truthy` node and is not a falsy
`constant-truthy`. The deciding function is `syncActionPlan()`.

**The load-bearing design choice is that the guard is SYNTHESIZED, never lifted.** The `sync$()`
body is generated from the declared condition tree, not copied from the authored source. A tree
that has passed `assertLowerableCondition` can only produce reads of the event parameter and JSON
literals, so **closure freedom is a property of the generator rather than a conclusion of an
analysis** — which matters because Qwik's hard constraint (`core.mjs:15905`, enforced in dev by
round-tripping the function through `new Function`) is that a synchronous QRL closes over nothing.
The condition is consequently evaluated twice, once in the `sync$()` and once in the lazy
remainder; that is sound precisely because it is pure over event fields.

- **G1 PASS** — measured, not read, and measured *again* after the emitter existed, because the
  first probe was hand-written and used `onKeyDown$` where the emitter actually emits `onKeydown$`.
  A `sync$()` body containing an `if` statement is a **new shape** for the optimizer, and worked
  example 9's G1 only ever proved a single-call body survives. Against `@qwik.dev/core@2.0.0-beta.38`
  on the official `pnpm create qwik` pipeline, production build: `sync$(fn)` is rewritten to
  `_qrlSync(fn, "<source>")`, the prop serializes as `q-e:keydown="#0|<chunk>#_run#1"`, and index 0
  of the container's `qFuncs_*` table is the guard **verbatim** —
  `event=>{if(event.key==="Enter"){event.preventDefault();}}`. A two-action `not`/`and` guard
  serialized the same way. Two-sided behavioural check on the same build: `Enter` into a form whose
  guard is `key === 'Enter'` did not navigate; the same key into a form guarded by
  `key === 'Escape'` did.
- **G2 PASS** — unchanged from 9. One call site, one emitted module, no demand on any other module.
- **G3 PASS** — the trigger remains the declared `EnrichedEventRecord.syncPolicy`. Handler contents
  are read only to *locate and remove* the calls the policy declares, never to decide whether to
  lower.
- **G4 PASS, and this is where the entry earns its place.** Totality is now discharged by
  **refusal** rather than by silence. Outside the domain, `syncActionPlan()` throws a named,
  greppable error: a `graph-truthy` guard (V1), the `branches` form (V2), a statically false guard
  (V3), a declared action the body does not spell (V4), and an unrecognised condition type (V5).
  A sixth refusal, not in the ruling, was added on measurement: an action call **stranded outside**
  the declared policy — `if (k) { preventDefault() } else { stopPropagation() }` compiles cleanly
  and Markless extracts only the consequent's action, so the else-branch call would otherwise ride
  the lazy QRL.

  V3 is worth stating explicitly: a statically false guard is **refused, not folded away**.
  Deleting the authored call would be equivalent only if the constant fold is right and would
  silently disable a real cancellation if it is wrong. The alternative on the table was to carve an
  exception into the gate, and **a gate is never weakened to accommodate a degenerate input.**
- **G5 — neither `PASS` nor `FAIL`, on exactly the grounds recorded in worked example 9**, and with
  the same narrow scope. The pre-fix shape here is the bare lazy QRL, which was never in the
  sanctioned set. The label is not available to a sugar question and is not reachable by preferring
  a different form.
- **G6 PASS** — three standing checks, each able to fail. The v-limits
  (`packages/frameworks/qwik/test/v-limits.test.ts`) each ship a case that watches the refusal
  fire. The gate ships `frameless/sync-qrl-must-be-closed`, which **proves** closure by scope
  analysis as an allowlist rather than sniffing for signals by name, plus a hardened
  `frameless/no-handler-sync-action`; both are calibrated by mutants, five of which were measured
  producing **zero** violations before this change. And the green-vacuum guard in
  `test/gate.test.ts` reconstructs the pre-fix output from the same IR by deleting its `syncPolicy`,
  then watches our rule reject it while upstream's stays silent.

  **What G6 does NOT yet cover, stated so it is not mistaken for covered:** there is no *behavioural*
  three-way scenario asserting that a conditional cancel fires for the declared key and does not
  fire for another. The G1 two-sided check above is a one-off probe on a scratch route, not a
  standing lane. That is queued as its own package; emitted text plus a gate is the evidence base
  defect 1 defeated.

**Explicitly considered and refused: mirroring graph state into a `data-` attribute** so a
`sync$()` could read `element.dataset.locked` and thereby express a `graph-truthy` guard. It would
make the emitter synthesize a reactive DOM binding that is not in the IR, it depends on
flush-before-event guarantees the IR does not make, and it converts a clean refusal into a subtle
timing bug — **the exact trade defect 1 was.** Reopen only with a two-sided behavioural proof on
official tooling plus an IR-level declaration of the mirror.

**Inherited by every other adapter, as a general rule and not a Qwik patch:** *the IR declares
**when** and **what**; the adapter decides **where**.* An adapter partitions the declared condition
tree into the part it can evaluate in its synchronous pre-activation channel and the part it
cannot, and **refuses to emit if that partition is not total for a declared action**. An adapter
must never narrow the IR to what it happens to support. Only Qwik is expected to need the split —
React, Solid, Svelte and Vue have synchronous resident handlers, and Angular's forced lowering is
orthogonal — but all of them inherit the refusal obligation.

## Recording a ruling

Every ruling gets both:

1. A worked-example entry in this document, with an outcome recorded for **all six** gates. A gate
   is never left out of an entry, whatever the ruling; an entry that omits one is incomplete.

   Under **forced lowering**, and only there, a gate's recorded outcome may be *"neither `PASS` nor
   `FAIL` — the procedure does not apply"* in place of one of the four labels. This is a legitimate
   outcome, not a gap: it is what worked examples 9 and 10 record at Gate 5, on the grounds set out
   there. Gate 5 compares a candidate against a baseline drawn from the sanctioned set, so where the
   pre-fix output was never a member of that set there is nothing admissible to compare against, and
   the letter of the gate would manufacture a spurious `FAIL` every time a defect is fixed. Where
   that is the situation, record it that way. **Do not label such a gate `PASS` to satisfy the
   count** — a fabricated `PASS` claims a neutrality check that was never run and is the more
   damaging of the two errors.

   Read the availability of that outcome as narrowly as those entries do. It is not a fifth outcome
   label available to a sugar question, and it is not reachable by preferring a different form. It is
   open only to an entry that has already discharged the forced-lowering burden stated in the
   preamble: the sanctioned set named **before** any gate runs, and the current output shown to sit
   **outside** it on the framework's own evidence — a framework diagnostic, a lint rule it ships
   against that shape, a dedicated construct it provides *because* that shape does not work, or a
   witnessed runtime failure — with that evidence named in the entry. Absent that showing you are not
   in forced lowering, the four labels are the only outcomes available, and a `FAIL` at Gate 5 is a
   real `FAIL`.

   Whichever it is, say which gate it applies to and why, in the entry itself.
2. A comment at the decision site in the emitter naming the ruling, matching the existing
   convention at `packages/frameworks/react/src/emitter/index.ts:1405-1406`.

A ruling that exists only in a document will be re-litigated by the next person to open the
emitter.

## Re-opening a ruling

- A `FAIL` ruling is re-openable when the fact that caused the `FAIL` changes — a framework
  release, an IR capability, a new standing check.
- A `DEFERRED` ruling is re-run when **every** condition that deferred it is met, without further
  authority. Deferrals stack: a ruling that deferred at Gates 1, 4 and 6 is re-run once the
  framework is in the lockfile, the emitter exists, and a lane asserts the behavior — which in
  practice is one event, not three.
- Re-running means running all six gates again and rewriting the entry. It does not mean amending
  the old outcome.
