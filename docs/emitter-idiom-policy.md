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

## The procedure

Run all six gates. **Do not short-circuit.** Record an outcome for every gate even after one
fails; the record is what makes a ruling re-openable.

Outcomes per gate: `PASS`, `FAIL`, `UNKNOWN`, or (Gate 6 only) `DEFERRED`.

Then:

- Any `FAIL` → **no-sugar**. Emit the baseline form.
- Any `UNKNOWN` → treat as `FAIL` → **no-sugar**. Unknown is not a tie. It is a no.
- Gate 6 `DEFERRED` with every other gate `PASS` → **no-sugar for now**, recorded as *deferred,
  not denied*. Re-run the procedure when the gate-6 condition is met.
- All six `PASS` → **sugar**.

---

### Gate 1 — Sanctioned, and measured

*Are both forms accepted by the exact framework build this repo ships, and was the correspondence
measured rather than read?*

Build or run both forms through the framework's own toolchain, at the exact version in this
repo's lockfile, and compare diagnostics and behavior.

A statement in the framework's docs, a doc-comment in its source, or a blog post is **not
evidence**. It is a hypothesis to test. Framework documentation routinely describes a mechanism
that is not the mechanism actually at work.

`FAIL` if: either form errors or warns; **or** the only evidence for the equivalence is
documentary; **or** the measurement was taken against a different build than the one this repo
ships. A package resolving to a different version, or a differently-packaged copy of the same
tool, is a different build.

### Gate 2 — Locality

*Is the sugar fully decided inside the single module being emitted?*

`FAIL` if it requires anything of another module, of the emitted component's parent or child, or
of the build graph — an added import list entry, a plugin, a new dependency, or a declaration the
other end must make.

Frameless emits one module per `EnrichedIR`. Any sugar whose legality depends on how a
*different* module was emitted fails this gate by construction. This is the gate that every
framework's two-way-binding sugar fails.

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

G1 PASS (documented shorthands, identical compiled output — to be re-measured when a Vue lane
exists), G2 PASS, G3 PASS (triggered by the binding's structural kind, not its contents),
G4 PASS (every directive use), G5 PASS. **G6 DEFERRED** — there is no Vue emitter and no Vue lane
in `pnpm e2e`. Ruling: baseline until a Vue lane on an official Vue scaffold exists; re-run then.
This is a deferral, not a rejection.

### 3. Vue — declaring a callback prop as a `defineEmits` event → **no-sugar**

G2 PASS, G3 PASS, G4 PASS. **G5 FAIL**: declaring a native event name in `emits` means the
listener responds only to component-emitted events and no longer to native ones, and declared
events are removed from fallthrough `$attrs`. A frameless component with a callback prop named
`onClick` would stop receiving native clicks. That is a behavior change with no diagnostic. G6
would defer anyway; G5 decides it.

### 4. Angular — two-way binding `[(prop)]` on an emitted child → **no-sugar**

Baseline: `[prop]="x"` plus `(propChange)="x = $event"`, with the handler as a class method.
Note this baseline is itself a sanctioned Angular form — there is no naive form to fall back to.

**G2 FAIL**: `[(prop)]` is legal only if the child module declares the prop as two-way capable.
Frameless emits one module per `EnrichedIR`; the parent cannot decide the child's declaration
form. Independently **G5 FAIL**: the implicit change-output name is derived by appending `Change`
to the input name, so a component with sibling props `count` and `countChange` — both legal
frameless props — collides, whereas the baseline uses the author's two names as written.
**G6 DEFERRED** (no Angular lane, and the sugar is version-gated with no target-version input).
Three independent reasons; the ruling is stable.

### 5. Angular — `@if` / `@for` control-flow blocks → **deferred**

G1 PASS, G2 PASS, G3 PASS (structural template facts), G4 PASS, G5 PASS, **G6 DEFERRED** (no
Angular lane). Ruling: baseline until an Angular lane exists.

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
IR field, so Gate 3 still passes. Re-run: G1–G5 PASS, **G6 DEFERRED** (no Svelte lane).

This is the example to reach for when a sugar looks nearly right. The repair step distinguishes a
rule stated too broadly (repairable) from a rule that needs to inspect contents (not repairable).

### 7. Svelte 5 — `$props()` destructuring with fallback values → **no-sugar**

G2 PASS, G3 PASS, G4 PASS. **G5 FAIL**: destructured reactive values are not reactive, and
fallback values are not turned into reactive state proxies — so an object or array default is not
equivalent to defaulting at each read site. This matches an existing frameless ruling in the
Solid dossier, which already banned props destructuring for the same reason in a different
framework.

### 8. React — `onInput` → `onChange` on leaf controls, and `class` → `className` → **sugar** (existing, retro-validated)

Both predate this document; both are re-derived by it. G1 PASS, G2 PASS, G3 PASS (triggered by
element kind and attribute name), G4 PASS, G5 PASS (React's `onChange` on leaf controls is
React's own idiomatic surface for the same event), **G6 PASS** — `pnpm test:browser` and
`pnpm e2e` drive `demos/react-official` at the lockfile React version and compare observable
behavior; a wrong event name or attribute name fails immediately.

Note the deliberate divergence recorded in the Solid dossier: Solid keeps `onInput` and bans
`className`. Per-target divergence is expected. The procedure is shared; its answers are not.

## Recording a ruling

Every ruling gets both:

1. A worked-example entry in this document, with all six gate outcomes.
2. A comment at the decision site in the emitter naming the ruling, matching the existing
   convention at `packages/frameworks/react/src/emitter/index.ts:1405-1406`.

A ruling that exists only in a document will be re-litigated by the next person to open the
emitter.

## Re-opening a ruling

- A `FAIL` ruling is re-openable when the fact that caused the `FAIL` changes — a framework
  release, an IR capability, a new standing check.
- A `DEFERRED` ruling is re-run when its gate-6 condition is met, without further authority.
- Re-running means running all six gates again and rewriting the entry. It does not mean
  amending the old outcome.
