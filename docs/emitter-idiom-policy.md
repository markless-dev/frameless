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

Worked example 9 is this species rather than a sugar question: Qwik accepts `preventDefault()`
inside a lazily fetched QRL and the call never runs in time.

Worked example 6 was once listed here alongside it, on the reading that Svelte's delegated
listeners defeat a declared `stopPropagation` in the attribute form and that the finding was
therefore repairable by narrowing the domain. **That reading did not survive the emitter.** The
narrowing was re-run against a real Svelte lane at a pinned version and ruled *denied*, and the
shipped emitter does not lower the construct at all — it **refuses** it. Refusal is not a lowering,
so example 6 is an ordinary sugar question that failed, and it is kept in this preamble only to
record that it was moved out of the forced-lowering family rather than quietly dropped.

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
not askable: record `DEFERRED — framework absent`, naming the framework.

The following frameworks are **not absent**, and a deferral recorded at this gate before the stated
date is **discharged** — re-running the entry may not record `DEFERRED — framework absent` again.
One line per framework, so a lane that lands can discharge itself without rewriting anyone else's:

- **Svelte**, since `frameless-svelte-v1` T003 put `svelte@5.56.8` in the lockfile. Worked
  examples 6 and 7 are both rewritten on exactly that ground.
- **Vue**, since `frameless-vue-v1` T004 put `vue@3.5.40` in the lockfile at two importers. Worked
  example 2 was re-run on that ground by T005, split into 2a and 2b, and folded back by T006.
- **Angular**, since `frameless-angular-v1` T004 put `@angular/core@22.0.8` in the lockfile and
  landed `demos/angular-official` on the official Angular CLI SSR scaffold. Worked example 11 was
  re-run on that ground by T005 and folded back by T008. Worked examples 4 and 5 were the two
  entries this line left standing as stale-and-owed; **that re-run has landed.** Both were re-run in
  full by T009 and folded back by T011, so **no Angular entry reads `DEFERRED` at any gate any
  more.** Example 4 keeps its `no-sugar` ruling and its deciding Gate 2, with its three `DEFERRED`s
  replaced by two `UNKNOWN`s and one `FAIL`; example 5's ruling **changed** — all six gates `PASS`
  and it is now **sugar, adopted**, carried by Gate 6. Nothing is owed on this line.

Any entry still reading `DEFERRED — framework absent` for a framework named above is stale by that
fact alone, and must be **re-run** rather than re-read: a stale label is not a verdict, and the
re-run may change the verdict in either direction. The list above is **owed a line by each lane that
lands**, added by that lane's own board — the sentence this replaced named two frameworks at once
and went half-false the moment one of them landed, which is why it is one line per framework now.
Angular's line above was added by `frameless-angular-v1` T008 on that board's own measurement, which
is the moment the retired sentence — "Vue and Angular are absent today" — went from half-false to
**fully** false. That is the whole argument for one line per framework: a shared sentence goes stale
in pieces, and a piece nobody owns is a piece nobody corrects.

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
`input()`/`output()` and Svelte's `on` from `svelte/events` are all decided by this scoping, and are
decided the same way: an import of the target framework's own runtime into the module being emitted
asks nothing of anyone else.

Worked example 6 is the entry to read on how little that buys. It records `PASS` here for `on()`, on
exactly this reasoning, **and is denied anyway** — at Gates 1 and 5. A gate is a veto, not a vote.

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
  example 6 is the case to read: its original Gate 4 failure was found in `SyncPolicyBranch.actions`
  in the IR schema with no Svelte emitter in existence, which is this gate doing real work against
  an absent emitter.

  Read the rest of that entry too, because it is also the warning. The repair the `FAIL` motivated —
  narrow the domain per event record, route the remainder through `on()` — was ratified with no
  emitter to check it against, and it was **wrong on the day it was ratified**: narrowing per event
  record mandates a mixed-mechanism component, which Gate 5 forbids. A repair passes Gate 4 by being
  total; it does not thereby pass the other five, and re-running from Gate 1 on the narrowed rule
  means *all* of them.
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

### 2a. Vue — `v-bind` and `v-on` shorthands **with a value** (`:id="x"`, `@click="h"`) → **sugar**

**Rewritten, not amended.** This entry previously read `DEFERRED` at Gates 1, 4 and 6 on the ground
that Vue was absent from the lockfile and no Vue emitter existed. Every one of those conditions has
been met — `vue@3.5.40` is in the lockfile at two importers, `packages/frameworks/vue` exists, and
`pnpm e2e` drives `demos/vue-official` on the `create-vite-extra@5.0.2 template-ssr-vue-ts`
scaffold — so the procedure was re-run in full by `frameless-vue-v1` T005 and the entry rewritten by
its T006, as the re-opening section requires. **It ripened into `PASS`.** The `v-slot` limb did not
travel with it and is now entry 2b.

Baseline: `v-bind:id="x"`, `v-on:click="h"`. Candidate: `:id="x"`, `@click="h"`, always with a
value.

Domain, in emitter terms — **three** deciding sites, and there are no others in
`packages/frameworks/vue/src/emitter/index.ts`:

1. every string returned by `eventDirectiveName()` (the sole `v-on` spelling, reached only through
   `eventAttribute()`);
2. every dynamic binding printed by `attributesOf()`;
3. the literal key attribute printed by `renderKeyedRepeat()`.

- **G1 PASS.** Measured, not read, against `vue@3.5.40` / `@vue/compiler-sfc@3.5.40`, the build this
  repo ships and the same build the browser lane runs (asserted at test time, four ways, by the
  lane's own M4 test). Both forms produce an **exact empty** diagnostic set — `errors` *and* `tips` —
  across `ssr × isProd`; template codegen and production `compileScript` output are byte-identical in
  all four modes; and rendered SSR HTML is byte-identical for all three scenario components with real
  props. The second arbiter was measured two-sided: `flat/essential` is clean on both forms, while
  the plugin's own `strongly-recommended` tier flags `vue/v-on-style` and `vue/v-bind-style` on the
  **baseline** and neither on the candidate. `DEFERRED — framework absent` is no longer available.
- **G2 PASS.** A spelling inside the emitted template. No import, no plugin, no dependency, no
  declaration by a parent or child, no build-graph edit. Nothing is asked of any other module.
- **G3 PASS.** The trigger is the emission site itself — the directive kind the emitter is already
  printing — never the contents of a handler body or an expression. The Gate 3 rider does not engage,
  because no content is inspected at all: the sugar applies at three sites unconditionally.
- **G4 PASS, and structurally rather than by sample.** `@vue/compiler-core@3.5.40`
  `dist/compiler-core.cjs.js:2435` normalises `:` to `bind` and `@` to `on` inside `ondirname`, at
  parse time, before any argument or modifier is read; the raw spelling survives only as `rawName`.
  Equivalence is therefore total over every argument and modifier by construction. The sample
  confirms it two-sidedly: 19 binding names spanning the emitter's own `ATTRIBUTE_NAME` language and
  9 event names spanning its own event-name language, each in four modes, zero divergence, with a
  planted divergent member proving the probe can report one. What lies outside the domain is refused
  by name rather than emitted silently: `assertPlainAttributeName` already rejects every attribute
  name beginning `:`, `@`, `#` or `v-`, so no directive can arrive through the static-attribute path,
  and modifiers are refused at the decision site.
- **G5 PASS.** Byte-identical generated code in all four modes on both compile paths means there is
  no consumer-detectable difference to have: not event routing, not initial or default values, not
  reactivity depth, not throw behaviour, not lifecycle, not the module's exports. The rendered SSR
  HTML agrees. **Stated so the green is not over-read:** the SSR-HTML arm is *blind* to event
  routing — the `.stop` control is identical in both SSR modes and differs only in the client
  modes — so this gate rests on the client codegen identity, and the HTML arm is corroboration, not
  the proof.
- **G6 PASS.** `pnpm e2e` drives `demos/vue-official` on its official scaffold at the lockfile
  version and asserts S1/S2/S3 observations byte-equal to the react, solid, qwik, svelte and angular
  lanes. `demos/vue-official/package.json` `copy-emitted` copies
  `packages/frameworks/vue/generated/{S1,S2,S3}.vue` into `src/emitted/` on every `dev` and every
  `build`, and the three checked-in demo files are byte-identical to the goldens — so the lane drives
  **the exact emitted text**, not a hand-maintained facsimile. A shorthand that failed to bind would
  take out the S1 increment, S2 add/toggle/remove and S3 submit observations immediately. The emitted
  spelling is independently pinned in text by the gate's `require-directive-shorthand` and
  `baseline-form-inventory` policies, which this ruling required to be **inverted** rather than
  deleted.

  **What G6 does *not* cover, stated so it is not mistaken for covered:** no behavioural check can
  distinguish the shorthand from the longhand, because they are behaviourally identical — which is
  what G1 and G5 measured. A silent revert to longhand would be caught by the gate's text policy
  alone, and would have zero user-visible consequence. Gate 6 is satisfied here in the sense worked
  example 8 satisfies it: the *mechanism* the sugar depends on is asserted behaviourally on the lane,
  and a wrong directive name fails immediately.

All six `PASS` — **sugar**. Adopt `:` and `@`, always with a value.

**The value conjunct is load-bearing, and the reason is a measurement that refuted the Judge's own
hypothesis.** T005 predicted the flip would *introduce* a version hazard, on the theory that a
value-less `:x` is Vue 3.4's same-name shorthand while a value-less `v-bind:x` would be an error.
Measured at 3.5.40: `<span v-bind:count>` and `<span :count>` **both** compile as the 3.4-gated
same-name shorthand, and `v-on` without an expression is a `SyntaxError` in **both** spellings. The
hazard is *symmetric and pre-existing*; the flip neither creates nor enlarges it. What it does do is
expose a latent hole worth closing — the version inventory records these forms at floor `3.0` and
reads the directive *form*, not whether it carries a value — so the adopting package added a
standing `directive-carries-value` assertion over emitted output. Recorded here because a Judge
inventing an asymmetry and then legislating against it is a proxy-for-measurement fault, not a
finding.

### 2b. Vue — `v-slot` shorthand (`#header`) → **no-sugar**

Split out of worked example 2 by `frameless-vue-v1` T005. It was carried along by the old entry's
three deferrals; measured separately, it does not share their fate. **A bundled entry is a ruling
waiting to be wrong about one of its members.**

Baseline: `v-slot:header`. Candidate: `#header`.

- **G1 PASS.** Measured at 3.5.40 alongside 2a, and it is the one gate this limb clears:
  `<Child><template v-slot:header>…</template></Child>` and the `#header` twin produce byte-identical
  codegen in all four modes with empty `errors` and `tips`. Planted member `#header` vs `#footer`:
  divergent, so the comparator can report one. Same `ondirname` normalisation, `#` to `slot`.
- **G2 PASS.** A spelling inside the emitted template.
- **G3 PASS.** Structural, not content-based.
- **G4 UNKNOWN — which is a no.** The Vue emitter **exists**, so `DEFERRED — emitter absent` is
  discharged and unavailable. There is no deciding function to state a domain against: the emitter
  has no `v-slot` emission path anywhere, and the IR's slot vocabulary is a single
  `default-slot-projection` kind (`packages/compiler/src/schema.ts:173`) — IR-3, default slot only.
  The tempting move is "the domain is empty, so totality is vacuous, so `PASS`". It is refused on
  this document's own precedent: worked example 7 refused exactly that move, and a vacuous totality
  is the folklore domain arriving by the back door.
- **G5 PASS.** No behavioural difference; same normalisation as 2a.
- **G6 FAIL.** No check can exist for a path the emitter refuses to emit — the same clause worked
  example 6's `on()` arm and worked example 7 record. The sugar's only justification is an artifact
  property nothing checks, because there is no artifact.

`FAIL` at Gate 6, `UNKNOWN` at Gate 4: **denied, not deferred.** Say which one decides it: Gate 6
does, and Gate 4 would deny it independently. **Re-open when IR-3 gains named-slot vocabulary *and*
the Vue emitter emits a `v-slot`**, at which point all six gates are re-run and 2a's `PASS` does not
transfer — a measurement is valid for the construct it was taken on.

**The standing lesson this pair adds.** A landed lane discharges exactly two deferrals and it really
does discharge them: this is the first entry on any board where `DEFERRED` at Gate 1 and Gate 6
*ripened* into `PASS` rather than curdling into `FAIL`. Worked example 6 curdled; worked example 7
curdled. The difference is not optimism — it is that the shorthand's whole claim was an
*equivalence*, and an equivalence is the one kind of claim a lane can settle outright.

### 3. Vue — declaring a callback prop as a `defineEmits` event → **no-sugar**

**Re-run, not re-read.** This entry previously read `DEFERRED` at Gates 1, 4 and 6 on the ground
that Vue was absent from the lockfile and no Vue emitter existed. All three conditions are gone —
`vue@3.5.40` is in the lockfile at two importers, `packages/frameworks/vue` exists, and `pnpm e2e`
drives `demos/vue-official` (`scripts/e2e.mjs:38`) in a six-row run. `frameless-vue-v1` T007 re-ran
the entry. **The ruling is unchanged and its basis is not:** the denial rested on a single `G5 FAIL`
whose stated mechanism has been *measured false*, and it now rests on three independent `FAIL`s.

Baseline (what the emitter ships): the callback is a declared prop —
`defineProps([… , 'onTrace'])`, invoked as `props.onTrace(…)`. Candidate:
`defineEmits(['trace'])` with `emit('trace', …)`.

Domain, in emitter terms: every `PropDestructuringEntry` in `component.props.entries` printed as a
string literal into the `defineProps([...])` array by `propsDeclaration()`
(`packages/frameworks/vue/src/emitter/index.ts:400`).

- **G1 PASS.** Measured, not read, against `vue@3.5.40` / `@vue/compiler-sfc@3.5.40` — the same
  version at both, resolved from the package that ships the emitter. The shipped `S1.vue` and its
  mechanical `defineEmits` twin both produce an **exact empty** diagnostic set — parse errors,
  template `errors` *and* `tips` — across `ssr × isProd`. A planted syntax error reports in all four
  modes, so the probe can fail. `DEFERRED — framework absent` is no longer available.
  **Stated so the `PASS` is not over-read:** `emit('trace')` against `defineEmits(['other'])` — an
  emit of an undeclared event — is *also* exact-empty clean in all four modes. This gate measures
  diagnostics, and the compiler is blind to the class Gate 5 decides on.
- **G2 PASS.** `defineEmits` is a compiler macro inside the emitted module, and the parent's
  spelling is unchanged — measured: a parent passing `onTrace` reaches the handler under **both**
  forms. Nothing is asked of any other module. Same scoping as the import clause above.
- **G3 PASS, conditionally, and the condition is what kills the sugar at Gate 4.** It holds only
  under the *name-shape* reading of the trigger, where `sourceName` is a declared IR field and a
  prefix test is not expression-content inspection — the posture of worked examples 1 and 8. The
  only other available trigger, "the component body calls this prop", is a flat `FAIL` here.
- **G4 FAIL.** The emitter exists, so `DEFERRED — emitter absent` is discharged. Over the stated
  domain the shipped corpus holds six distinct props — `label`, `multiplier`, `visible`, `seed`,
  `initial`, `onTrace` — and the sugar applies to **one of six**. The counterexample is exhibited
  from shipped output, not hypothesised. The repair step is run and every narrowing is unavailable:
  "props whose value is a callback" is not decidable — `PropDestructuringEntry`
  (`packages/compiler/src/schema.ts:205`) carries no type field, which is IR-8; "props whose
  `sourceName` matches `/^on[A-Z]/`" is decidable but **unsound**, since nothing in the IR says such
  a prop holds a function; "props the body calls" is killed by Gate 3. Contrast entry 2b, which took
  `UNKNOWN` on an *empty* domain with nothing to exhibit. Empty domain gives `UNKNOWN`; a populated
  domain with a counterexample gives `FAIL`.
- **G5 FAIL — and the mechanism previously recorded here is withdrawn as measured false.** This
  entry used to read that "a frameless component with a callback prop named `onClick` would stop
  receiving native clicks" because declared events leave fallthrough `$attrs`. That is the delta
  between an **undeclared** prop and a declared emit. *Frameless declares the prop*, and a declared
  prop leaves `$attrs` exactly as a declared emit does. Measured three-sided at 3.5.40 with a real
  DOM, child root `<button>`, parent passing `onClick`, native bubbling click: `props: ['onClick']`
  → `$attrs` empty, handler **not** called; `emits: ['click']` → `$attrs` empty, handler **not**
  called; **calibration arm** declaring neither → `$attrs` is `['onClick']` and the handler **is**
  called. The probe can see a fallthrough listener and reports the two candidate forms identical.
  The gate still `FAIL`s, on three differences that were measured rather than read:
  1. **Throw behaviour**, which this gate names explicitly. With no handler supplied,
     `props.onTrace('setup', …)` throws `TypeError: props.onTrace is not a function` and takes down
     `setup`; `emit('trace', …)` is a silent no-op. Live for the corpus — all three goldens call
     `onTrace` unconditionally, S1 during the `<script setup>` body itself.
  2. **Return value.** `props.onTrace(…)` returns the handler's value; `emit(…)` returns
     `undefined`.
  3. **Handler-name resolution surface.** The forms resolve different sets of parent spellings: a
     parent passing `on-trace` is reached by the baseline and **not** by `emit()`; a parent passing
     `onTraceOnce` is reached by `emit()` and **not** by the baseline. The candidate silently
     acquires the `.once` convention and silently loses the hyphenated spelling. Neither is a
     diagnostic.
- **G6 FAIL.** A Vue lane exists, so `DEFERRED` is discharged — it is available for that one cause
  only. No standing check would fail if this sugar silently regressed, because there is no emitted
  artifact to regress: `packages/frameworks/vue/src/gate/index.ts:1024` **actively refuses** any
  emitted `defineEmits(` call. That check pins the *denial*, not the sugar. Same clause as entries
  2b and 7.

Three `FAIL`s: **denied, not deferred.** Say which one decides it: **Gate 5 does**, and Gate 4 and
Gate 6 each deny it independently. **Re-open only if IR-2 gains an emit concept *and* IR-8 gains a
prop type field** — the first to give the sugar a declared trigger, the second to make its domain
sound. Note that a Vue lane, which is what the old deferrals were waiting for, did **not** change
the ruling; it changed the *evidence*, and it converted the entry's one documentary `FAIL` into
three measured ones.

**The standing lesson this entry adds, and it is the reason the re-run was worth its cost.** The
deferrals were never load-bearing — `FAIL` outranked them, and the entry said so. What was
load-bearing, and unexamined, was the sentence explaining the `FAIL`. A gate outcome that outranks
its neighbours is exactly the one nobody re-checks, and this one had never been through Gate 1
because Gate 1 was deferred when it was written. **Stale labels travel with an unmeasured
rationale**; clearing the labels is the occasion to measure the rationale, not a substitute for it.

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

### 6. Svelte 5 — routing a declared `stopPropagation` through `on()` from `svelte/events` → **no-sugar**

**Rewritten, not amended.** This entry previously read "deferred, after repair". Every condition
that deferred it has since been met — `svelte@5.56.8` is in the lockfile, `packages/frameworks/svelte`
exists, and `pnpm e2e` drives `demos/svelte-official` on the official SvelteKit scaffold — so the
procedure was re-run in full by `frameless-svelte-v1` T005 and the entry rewritten by its T008, as
the re-opening section requires. **It did not ripen into `PASS`. It became `FAIL`.**

Baseline: the `onname={…}` event attribute, for every event. It is the baseline rather than a
candidate because the alternatives are not free — MEASURED at 5.56.8: `on:click` in a runes
component warns `event_directive_deprecated`, and mixing `on:click` with `onclick` in one component
is the hard error `mixed_event_handler_syntaxes`. The zero-warning, no-obligation sanctioned set has
exactly one member.

Candidate: `on()` from `svelte/events`, for the events whose declared `SyncPolicyBranch.actions`
include `stopPropagation` — the narrowing this entry used to record as a successful Gate 4 repair.

Domain, in emitter terms: every `EnrichedEventRecord` reaching `syncPolicyGuard()`
(`packages/frameworks/svelte/src/emitter/index.ts`), which is the deciding function.

- **G1 FAIL.** The attribute arm is measured exhaustively: T003's two-variable triangulation in real
  Chromium at 5.56.8 (`onclick=` with `preventDefault` 1→1 Document requests, without it 1→2;
  `on()` with 1→1, without 1→2 — the signal tracks the *product* variable and is insensitive to the
  emission form, and the negative control proves the instrument can see a navigation), re-measured
  against the real emitted `generated/S3.svelte` and now standing as two browser checks with a
  planted-member calibration. The **`on()` arm is not measured at all**. Its entire justification —
  that `on()` escapes delegation and therefore stops propagation where the attribute form cannot —
  is Svelte's documentation, while Svelte is in this repo's lockfile and the measurement is
  demonstrably possible: `use:` + `on()` and `{@attach}` + `on()` both compile with an **empty**
  warning set at 5.56.8, at Svelte 5.0 baseline. That is Gate 1's named `FAIL` clause verbatim —
  documentary evidence with a build in the lockfile — and `DEFERRED` is not available, because the
  absent-framework cause is discharged. **IR-4 was never this arm's blocker; the lack of a
  measurement was.**
- **G2 PASS.** Both arms are self-scoped. `on` from `svelte/events` is an import the emitted module
  adds to its *own* import list, which the Gate 2 scoping paragraph settles as a `PASS`. Nothing is
  asked of a parent, a child, another module or the build graph.
- **G3 PASS.** The trigger is the declared IR field `SyncPolicyBranch.actions`, never handler
  contents. `syncPolicyGuard()` reads the handler body only to *refuse* a policy the body does not
  spell — the same posture as worked example 10 — so the Gate 3 rider does not engage.
- **G4 PASS — by refusal, and for the rule AS SHIPPED rather than the rule as previously written.**
  The shipped emitter does not implement this entry's old repair. `syncPolicyGuard()` **throws** on
  a declared `stopPropagation` in any branch, naming the construct and the reason; everything else
  emits the attribute form. Totality is therefore discharged the way worked example 10 discharges
  it, by named refusal rather than by silence, and an independent gate policy `no-stop-propagation`
  re-reads emitted output, with `baseline-form-inventory` rejecting an `on` imported from
  `svelte/events` by any route at all. Scored against the rule as *written* — narrow per event
  record, route the rest — this gate is `UNKNOWN`: the emitter exists, so `DEFERRED` is gone, and
  nobody enumerated that rule's domain against a deciding function. `UNKNOWN` is a no.
- **G5 FAIL, and this is the ruling.** The repair narrows **per event record**, so a
  mixed-mechanism component is the *normal* case rather than an edge — `S3` carries four events, and
  a policy on one of them would put that component on both mechanisms at once. Delegated-versus-
  attached is an event-**routing** difference, the first item in Gate 5's own failure list, and the
  compiler cannot see it: MEASURED at 5.56.8, `mixed_event_handler_syntaxes` fires for `on:` +
  `onname` and does **not** fire for `on()` + `onname`, which compiles clean. T002 ruling 4 had
  independently reached "if the attribute form ever proves unsound, switch the WHOLE component to
  `on()` — never a mix" for the same reason.
- **G6 PASS (attribute arm) / FAIL (`on()` arm).** For the attribute arm a standing check exists and
  asserts observable behaviour: `pnpm e2e` drives `demos/svelte-official` on its official SvelteKit
  scaffold at the lockfile version and `assertS3` requires exactly one `Document` request after the
  click on `[data-action="cancel-submit"]`, byte-identical to the react, solid and qwik lanes. For
  the `on()` arm nothing can exist, because the emitter refuses to emit that path — the sugar's only
  justification is an artifact property nothing checks, which is Gate 6's `FAIL` clause.

`FAIL` at Gate 1 and Gate 5 → **denied, not deferred**. Say which one decides it: Gate 5 does. A
future measurement can retire the Gate 1 `FAIL`; nothing retires Gate 5's without abandoning the
per-record narrowing, and abandoning it is abandoning the repair.

**The substance of this rewrite, and the reason it is worth reading twice.** The repair was not
merely unverified when it was ratified — it was **wrong**. Its per-event-record narrowing *mandates*
a mixed-mechanism component, while `frameless-svelte-v1` T002 independently ruled "never a mix",
and the two sat in the record together without anyone noticing the contradiction. Nobody noticed
because there was no emitter: a rule that names no deciding function cannot be read against a real
component, and Gate 4's `DEFERRED — emitter absent` correctly said as much about *that* gate while
saying nothing about the other five. A deferral is not a partial credit that ripens; it is a
statement that a question was not asked.

### 7. Svelte 5 — `$props()` destructuring with fallback values → **no-sugar**

**Rewritten. The ruling is unchanged and its first stated reason was measured FALSE.** As first
written this entry gave two reasons at Gate 5: that destructured reactive values are not reactive,
and that fallback values are not turned into reactive state proxies. The first is refuted at 5.56.8.
A wrong reason attached to a right answer is worth correcting on its own, and this one is
load-bearing: the shipped Svelte emitter destructures `$props()` **unconditionally**, so a reader
taking the first reason at face value would read the emitter as violating this very entry.

Baseline: declare the prop without a fallback and default where the value is read. Candidate:
`let { x = fallback } = $props()`. Domain, in emitter terms: every entry in
`component.props.entries` handled by `propsDeclaration()` in
`packages/frameworks/svelte/src/emitter/index.ts`.

- **G1 PASS.** Both forms compile clean — an empty warning set at 5.56.8, the build this repo
  ships — and the candidate's lowering was read out of that same build's emitted client module
  rather than out of the docs. `DEFERRED — framework absent` is no longer available.
- **G2 PASS.** Entirely inside the emitted module.
- **G3 PASS.** The trigger is the declared IR field `ComponentPropEntry.defaultValue`, never the
  shape of an expression.
- **G4 UNKNOWN — which is a no.** The deciding function `propsDeclaration()` now exists, so
  `DEFERRED — emitter absent` is discharged, and its domain was never enumerated against the
  candidate rule. The tempting answer — "the emitter refuses every prop default, so the domain is
  empty and totality is vacuous" — is refused: T005 refused the same move for worked example 6, and
  a vacuous totality is the folklore domain arriving by the back door.
- **G5 FAIL, on the second limb only.**
  - *First limb, REFUTED by measurement at 5.56.8:* `let { label } = $props()` lowers to
    `$.template_effect(() => $.set_text(text, $$props.label))` — a **live** `$$props.label` read
    inside the effect. Destructured props are reactive. The Solid dossier's ban on props
    destructuring, cited here as agreement, rests on Solid's own getter semantics and does not
    transfer; per-target divergence is expected, and borrowing another target's reason without
    measuring it in this one is what produced the error.
  - *Second limb, which carries the ruling:* a **fallback** is not turned into a reactive state
    proxy. `let { config = { open: false } } = $props()` lowers to
    `$.prop($$props, 'config', 23, () => ({ open: false }))`, with no `proxy()` call anywhere in the
    emitted module; `prop()` resolves the fallback through `derived`
    (`svelte/src/internal/client/reactivity/props.js:276-300`), never through the state proxy. So an
    object or array default is not equivalent to defaulting at each read site, and mutating a
    defaulted object is untracked — reported, if at all, as a dev-only ownership warning.
- **G6 FAIL.** No standing check in any lane asserts prop-default behaviour, because the corpus has
  no prop defaults and the emitter refuses to emit one. Same clause as worked example 6's `on()`
  arm: no check can exist for a path the emitter refuses to emit.

`FAIL` at Gate 5, `FAIL` at Gate 6, `UNKNOWN` at Gate 4: **denied**. The emitter enforces exactly
this split — it destructures unconditionally, which the entry does **not** deny, and throws on a
declared prop default, which is the limb that survives.

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

### 11. Angular — declaring a component prop as a signal `input()` rather than `@Input()` → **no-sugar**

**Re-run in full, not amended.** `frameless-idiom-policy-v1` T006 derived this twice independently
(PM pre-registration plus a zero-context cold agent) with **no Angular anywhere in this repo**, and
it was deliberately kept out of this document at the time so the cold-agent test could not be leaked
to. Every condition that deferred it is now met — `@angular/core@22.0.8` is in the lockfile,
`packages/frameworks/angular` exists, and `pnpm e2e` drives `demos/angular-official` on the official
Angular CLI SSR scaffold — so the procedure was re-run against a real build by `frameless-angular-v1`
T005 and folded in here by its T008. **The ruling is unchanged. Its Gate 1 outcome inverted, its
Gate 6 outcome inverted the other way, and one of its two Gate 5 reasons was measured false.**

Baseline: `@Input() <localName>: any;`, the form `propMembers()` ships in
`packages/frameworks/angular/src/emitter/index.ts`. It is the baseline on both limbs of the
definition, and both were **measured** rather than assumed: it is valid Angular 2 → 22 and carries
no `@deprecated` tag at 22.0.8, and it imposes no obligation on any other party — it AOT-compiles
clean even with `experimentalDecorators: false`, because `ngtsc` handles Angular decorators itself.

Candidate sugar: `<localName> = input<any>();`.

Domain, in emitter terms: every `PropDestructuringEntry` in `component.props.entries` reaching
`propMembers()` that survives its three named refusals — a `defaultValue`, a multi-segment `path`,
and an `alias`/renamed `sourceName`.

- **G1 PASS.** Was `DEFERRED — framework absent`; **discharged**, and the policy's own coupling rule
  required it to move together with Gate 6. Measured, not read, against `@angular/core@22.0.8`: the
  shipped `generated/S1.ts` was AOT-built verbatim beside a twin whose only change is the declaration
  form. Both arms report **zero diagnostics and zero warnings** from `ng build` under
  `strictTemplates`, and both render **byte-identical DOM** through the same `ComponentRef.setInput`
  path `withComponentInputBinding()` uses. Both forms are accepted by the exact build this repo
  ships. Note that a behavioural difference does **not** fail this gate — Gate 1 asks whether both
  forms are sanctioned and whether the correspondence was measured; the differences it surfaces are
  Gate 5's to adjudicate, and Gate 5 adjudicates them below.
- **G2 PASS.** `input` is an import the emitted module adds to its **own** import list, which the
  Gate 2 scoping paragraph settles. Nothing is asked of a parent, a child, another module or the
  build graph.
- **G3 PASS.** The trigger is the declared IR field `component.props.entries`; handler contents are
  never inspected, so the rider does not engage. **Recorded as a consequence, not a failure:** the
  shipped `this.`-qualification transform builds ONE undifferentiated `members` set from
  `props.entries` unioned with `locals[].names`, and the candidate would force that set to **split** —
  a prop read must become `this.x()` while a local read must stay `this.x`. Both halves are declared
  IR facts, so this stays inside Gate 3; but a total transform becoming a discriminator is where
  drift lives, and this would make it one.
- **G4 PASS on a narrowed rule, and the narrowing is worth reading.** `DEFERRED — emitter absent` is
  discharged: `propMembers()` exists and is the deciding function. A counterexample is exhibitable
  **from the IR schema**, which is exactly what this gate's absent-emitter clause says counts:
  `PropDestructuringEntry` carries a `graphNodeId` (`packages/compiler/src/schema.ts:205-212`),
  `GraphBindingKind` includes `'prop'` (`:20`), and `StateWriteRecord` is keyed on a `graphNodeId`
  and admits `operation: 'assign'` (`:266-274`) — so a prop a handler assigns to is representable,
  and the sugar cannot express it, because an `InputSignal` is read-only. That is not a paper
  objection: it is the measured `TypeError` in the Gate 5 entry below. The Gate 4 repair applies and
  is legitimate — narrow the domain to entries that are never a `StateWriteRecord` target, which is a
  declared IR fact — and on the narrowed rule the sugar is total. **The repair does not save the
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
  the candidate. That is the first item in this gate's own failure list. The direction is irrelevant:
  a reasonable person can call the candidate's behaviour better, and Gate 5 is a **neutrality** gate,
  not a quality gate.

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
  That is *both* "throw or error behavior" *and* "the module's exports" from this gate's list, and
  unlike limb 2 it is unavoidable — it follows from the candidate by construction, not from an
  optional spelling.

  *NOT a failure, recorded so nothing is over-claimed:* `ngOnChanges` is **identical** across both
  forms — one first-change call, one subsequent change, and no call at all on a repeated identical
  `setInput`. The `lifecycle` limb is measured **clean**. Neither original derivation claimed
  otherwise; this closes it by measurement rather than leaving it open.
- **G6 FAIL.** Was `DEFERRED — no lane`; **discharged** by `demos/angular-official` on the official
  Angular CLI 22.0.8 SSR scaffold, so `DEFERRED` is no longer available at this gate. It does not
  ripen into `PASS`. The sugar's only justification is idiom — an artifact property nothing checks —
  which is this gate's `FAIL` clause verbatim. State the negative result plainly, because it is the
  useful part: `pnpm e2e` asserts the Angular row's S1/S2/S3 observations byte-identical to five
  other lanes, and **it would not go red on this sugar**, because the two arms were measured to
  render identically. A behavioural lane cannot pin a non-behavioural benefit. Nor can any check be
  built while the gate policy `no-signal-members`
  (`packages/frameworks/angular/src/gate/index.ts`) refuses the path — the same clause as worked
  example 6's `on()` arm and worked example 7's Gate 6. Independently, the **version corollary**'s
  second conjunct is unmet: the sugar is version-gated at 17.1 and the lockfile pins 22.0.8, but
  `EnrichedIR` has no target-version input, and this lane discharges the corollary the *second* way —
  by emitting only baseline-version-safe forms — which adopting this sugar would abandon.

`FAIL` at Gate 5 and Gate 6 → **denied, not deferred**. Say which one decides it: **Gate 5**.
Gate 6's `FAIL` is retirable in principle — someone could build a check, or an IR version input
could land. Gate 5's is not: the candidate changes the exported member's type and its reactive
character by construction, and no amount of lane, emitter or IR work retires that.

**IR-4 is NOT this ruling's blocker, and saying so is the point.** Per `frameless-svelte-v1` T999, a
version-gated sugar that `FAIL`s Gate 2 or Gate 5 is **denied**, not deferred. This one `FAIL`s
Gate 5. The version corollary is a second, subordinate reason for the Gate 6 `FAIL`, not the ruling.

**The right answer stood on one wrong reason, which is worked example 7's situation exactly.** The
originally-decisive "throw behaviour differs" limb rested on `NG0950`, and that reason was
load-bearing enough that a reader could have retired the whole ruling by retiring it. Two
independent derivations reached no-sugar; a third measurement now reaches it on corrected grounds.
A wrong reason attached to a right answer is worth correcting on its own.

**Carried forward, because it must not vanish:** `@angular-eslint/prefer-signals` exists and prefers
the candidate — but upstream did **not** put it in `recommended`; it lives in `all`, and the derived
`recommended` set was measured in-repo returning **zero** messages on a planted `seed = input()`.
"The Angular team decided signals" overstates it: they decided it is an opinion you may opt into. A
lint preference addresses neither Gate 5 limb, and this ruling does not overrule it — the two are
answering different questions.

**What was NOT measured, so a green is not over-read:** the SSR served payload. Both arms were shown
to render identical DOM client-side; whether Angular's `ngh` hydration annotations differ between
the forms is **unmeasured**. It cannot change the ruling — the ruling is already `FAIL` — but
"renders identically" is not a served-payload claim. The behavioural probes also ran in `jsdom`
against a real AOT bundle rather than in Chromium, deliberately, to avoid contaminating a concurrent
browser measurement; if any result here is challenged, the correct response is to **re-run it in
Chromium**, not to defend `jsdom`.

### 11b. The `@Output()` → `output()` half: **not ruled, because its domain is empty**

The held-out question was posed as `@Input()`/`@Output()` versus `input()`/`output()`. The
`@Output()` half **cannot be scored on this emitter**: `frameless-angular-v1` T002 ruling 2 refused
`@Output()`/`EventEmitter` outright on arity grounds — `emit()` takes one value and the corpus calls
`onTrace` with two and three positional arguments — and the shipped emitter contains **zero**
occurrences of `Output` or `EventEmitter` in `src/emitter/` or in any golden. `onTrace`, the only
callback prop in the corpus, is an `@Input()`.

**Entry 11's measurements do not transfer, and that is the rule rather than a caution:** a
measurement is valid for the construct it was taken on. The T005 twin changed the *input*
declaration form and nothing else, so it says nothing about `output()`.

- **G1 UNKNOWN — which is a no.** `@angular/core@22.0.8` is in the lockfile, so
  `DEFERRED — framework absent` is discharged and unavailable. But no `@Output()`/`output()` pair was
  ever built, because there is no instance to build one from, so the correspondence was not measured
  and `PASS` is not earned. (The `FAIL` clause for "the measurement was possible and was not made" is
  arguably reachable here too; it does not matter, because both labels are a no and Gate 4 decides.)
- **G2 PASS.** `output` would be an import the emitted module adds to its **own** import list, which
  the Gate 2 scoping paragraph settles for exactly this construct by name.
- **G3 PASS.** Nothing about the choice inspects handler contents; the rider does not engage.
- **G4 UNKNOWN — which is a no, and it is the decider.** The domain of "every `@Output()` the emitter
  emits" is **empty**, and the tempting move — "the sugar applies to all zero of them, therefore
  total, therefore `PASS`" — is exactly the vacuous totality worked example 7 refused and called *the
  folklore domain arriving by the back door*. The emitter **exists**, so `DEFERRED — emitter absent`
  is not available either.
- **G5 UNKNOWN — which is a no.** Not `PASS`: no neutrality check was run, because there is no
  baseline instance to run one against, and a fabricated `PASS` to satisfy the six-gate count is the
  more damaging of the two errors this document names. Not `FAIL` either — nothing was found against
  `output()`.
- **G6 FAIL.** No check can exist for a path the emitter refuses to emit — the same clause worked
  example 2b, worked example 6's `on()` arm and worked example 7 record.

`UNKNOWN` at Gates 1, 4 and 5 and `FAIL` at Gate 6: **no-sugar**. Say which one decides it:
**Gate 4**, and it is a weaker ground than the input half's, which is why this is recorded separately
rather than folded into entry 11. The honest reading — and this document's own warning that
`UNKNOWN` "asserts that something was found against the sugar when nothing was" is apt here — is
that the question is not askable on this corpus. Entry 11b says that rather than borrowing entry
11's Gate 5 to look decisive.

**Re-open** when the IR grows an emit concept (IR-2) and the emitter emits an `@Output()`, at which
point all six gates are re-run on a real instance and entry 11's `FAIL` does not transfer either.

`packages/frameworks/angular/src/gate/index.ts`'s `SIGNAL_APIS` set covers `output` and `model`
alongside `input`, so the shipped gate pins both halves. That is correct and stays.

### 12a. Vue — `v-model` on an emitted host element → **no-sugar**

Baseline (what the emitter ships): `:value="x"` (or `:checked="x"`) plus a `@input` / `@change`
handler that performs the assignment. Candidate: `v-model="x"`.

Domain, in emitter terms: every host node `renderHost()`
(`packages/frameworks/vue/src/emitter/index.ts:815`) prints that carries a `DynamicBinding` named
`value` or `checked` from `attributesOf()` (`:753`) together with an event directive on the same
host from `eventAttribute()` (`:730`). **Re-enumerated over the six-scenario corpus by
`frameless-vue-v1` T010** — `frameless-vue-v1` T009 took its figure over four goldens, and S5 and S6
have since landed. **Both new goldens contribute zero instances: neither emits a `value` or a
`checked` binding at all.** The domain is **populated**, and it is still five shipped instances: S2
`h2`/`event:0`, S2 `h7`/`event:2`, S2 `h8`/`event:3`, S3 `h1`/`event:1`, S3 `h2`/`event:2`. The
figure is unchanged because it was re-measured, not because it was re-read.

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
component.** `renderNode` (`emitter/index.ts:921`) throws at `:934` on any template node kind it has
no lowering for, `component-reference` included, and **zero of the six compiler goldens contains
one** — re-counted over S1–S6 rather than carried. That domain is **empty**, which gives `UNKNOWN` at
Gate 4 and `FAIL` at Gate 6 — entry 2b's shape, a different reason for the same answer. Ruling it
inside 12a would be the vacuous-totality move worked example 7 refused.

### 12b. Vue — declaring a prop as a `defineModel()` model → **no-sugar**

Baseline (what the emitter ships): the prop is declared in the string-literal array —
`defineProps(['initial', 'onTrace'])`, read as `props.initial`. Candidate:
`const initial = defineModel('initial')`.

Domain, in emitter terms: every `PropDestructuringEntry` in `component.props.entries` printed as a
string literal into the `defineProps([...])` array by `propsDeclaration()`
(`packages/frameworks/vue/src/emitter/index.ts:400`) — **the same domain as worked example 3**.
**Re-enumerated over the six-scenario corpus by `frameless-vue-v1` T010**, and unlike 12a's this one
moved. The domain is **populated** with **fifteen printed entries** — S1 four, S2 two, S3 two, S4
two, S5 two, S6 three — spanning **six distinct prop names**: `label`, `multiplier`, `visible`,
`seed`, `initial`, `onTrace`. `frameless-vue-v1` T009 recorded "six shipped props" over four
goldens; **the entry count went 10 → 15 and the distinct-name count did not move**, because S5 and
S6 introduce no prop name S1–S4 did not already carry. Both figures are stated because a single
number that happens to survive a corpus change looks identical to one nobody re-checked.

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
- **G4 FAIL.** The sugar applies to **zero of the fifteen printed entries, and to zero of the six
  distinct names**: its precondition is the component writing back to the prop, and no shipped prop
  is written back. **The repair narrowing "props the component writes back to" is not statable at
  all.** Measured across all six base goldens: every prop entry shares one graph node, `prop:props`,
  declared `writable: false` with zero writes. Per-prop write-back has no channel in the IR — not an
  unsound one, none. **This is IR-1, and it is distinct from IR-8:** IR-8 is a missing *type* field
  on `PropDestructuringEntry`; this is a missing *per-prop identity* in the graph.
  `ComponentPropExpression` (`packages/compiler/src/schema.ts:149-156`) carrying no bindable `kind`
  is the parent-side face of the same gap.
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

## The baseline form inventory

The version corollary at Gate 6 has two conjuncts: the lockfile pins ≥ *N*, **and** the emitter can
know the version it is targeting. `frameless-svelte-v1` T002 ruling 3 deferred IR-4 without amending
that corollary, and recorded that the second conjunct is satisfiable two ways — an explicit
target-version or capability input, or **an emitter that emits only baseline-version-safe forms**,
in which case there is no version-gated sugar and the corollary never engages. The Svelte lane is
the second way. So are Vue and Angular, by inheritance.

That second way is a **claim about emitted output**, and until `frameless-svelte-v1` T008 nothing
asserted it. It was already false-by-drift once: T003 added two `svelte-ignore` codes *after* T002
ruled, growing the set of forms the emitter may emit with no record and no check. An emitter that
discharges the corollary this way therefore ships a **baseline form inventory**:

- An explicit allowlist of every form the emitter may put in its output — rune names, imported
  framework APIs, template node kinds, the shape of an event attribute, warning-suppression codes.
- Each entry carries the **version floor** claimed for it and an **evidence status** of `verified`
  or `unverified`. A floor is a lower bound and need not be tight; `unverified` carries the reason
  it could not be checked. **Never record a floor you did not verify.** A `verified` entry cites a
  file and verbatim text inside the *resolved* framework package, and a test re-reads the citation.
- The gate goes **red** when emitted output contains a form that is not on the list, so growing the
  emitter's surface is a deliberate edit to the inventory rather than a silent widening.
- It ships with mutation rows proving it goes red, and — because an allowlist whose walk observes
  nothing accepts everything — an **anti-vacuity row pinning the observed form set** of the shipped
  corpus.

The reference implementation is `packages/frameworks/svelte/src/gate/index.ts`
(`BASELINE_FORM_INVENTORY`, policy `baseline-form-inventory`), calibrated in
`packages/frameworks/svelte/test/gate.test.ts`. Today every Svelte floor reads `unverified`, and the
reason is itself instructive: the resolved package documents a floor for exactly the members that
arrived after 5.0 — `@since 5.20.0` on `$props.id`, `@since 5.36` on `settled` — and carries no tag
at all on `$state`, `$derived`, `$props` or `untrack`. **An absent tag is not a floor.** It is
equally consistent with "5.0" and with "nobody wrote one down", and the package ships no changelog.

**What the inventory cannot see, stated so a green is not over-read:** it reads emitted text, so it
catches a *new form arriving unannounced* and not a form whose meaning changed under a fixed
spelling. `onclick={…}` parses in Svelte 4 too and means something else entirely there. That is what
the floor column is for, and why it is not decoration.

### The measurement that made this worth building

`frameless-svelte-v1` T005 argued that the emitter's `svelte-ignore` codes are an unasserted
precondition over a growing set, and reported that an unrecognised code *warns* `unknown_code`. A
later re-measurement reported the opposite — that it is silent. **Both are right, and neither named
the variable.** Measured at 5.56.8 across three component shapes, both generate modes and both dev
settings:

- In a **runes** component an unrecognised code warns `unknown_code`, and a Svelte 4 dash-case
  spelling warns `legacy_code`.
- In a **runes-free** component there is **no diagnostic at all**.
- In both cases the annotation suppresses nothing, so the real warnings still fire.

The deciding line is `if (runes)` in the resolved package's
`src/compiler/utils/extract_svelte_ignore.js:38`: in runes mode an unrecognised code is reported, in
legacy mode it is pushed onto the ignore list unreported, where it matches nothing.

The conclusion T005 drew survives and is sharper than either report. In *this* repo both arms fail
loudly at emit time, because the emitter's own two-sided check fails on any warning and the
unsuppressed warnings are warnings. The exposure is at a **consumer's** version, where nothing runs
that check: on a minor where one of those codes was renamed, a consumer gets the accessibility noise
with no diagnostic pointing at the cause — and in a runes-free emitted module, not even the rename
is reported. Hence two things in the inventory: the codes are entries with floors, and an emitted
`svelte-ignore` in a module containing no rune is itself a violation, because it is an annotation
nothing upstream will ever validate.

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
