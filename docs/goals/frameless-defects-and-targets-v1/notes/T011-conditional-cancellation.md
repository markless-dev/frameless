# T011 — Conditional cancellation: the IR representation ruling

Judge, goal `frameless-defects-and-targets-v1`, task T011. Read-only. Every claim below was
measured against the working tree at `ef59d55`, not read off a receipt. Probes live in the session
scratchpad (`probe-t011.mts`, `probe-t011-build.mts`, `probe-t011-gate.mts`).

## 0. Headline

**The IR already represents conditional cancellation correctly and completely. Do not change the
schema.** `SyncPolicy` is a declarative, target-neutral condition tree with a reference evaluator
shipped by Markless itself. The whole of the remaining work is *lowering*, *proof*, and *refusal* —
per adapter.

Three corrections to the premises this task was handed:

1. **FALSE PREMISE, corrected.** The task brief (and, loosely read, T005's
   `deferred_scope_still_correct`) says conditional cancellation "reaches the fail-closed throw
   instead". It does not. `hoistsPreventDefault()` returning `false` means `emitEvent()` returns
   `normalized.handler` at `emitter/index.ts:701` — a **bare lazily-fetched QRL containing the
   authored `preventDefault()`**. That is defect 1 verbatim, silently re-emitted for the conditional
   case. There is no throw on this path. Measured: `emit()` on an `event-equals` IR produced
   `onClick$={(event) => { if (event.key === 'Enter') { event.preventDefault(); } }}`.
   The Qwik **gate** catches it (`frameless/no-handler-prevent-default` fired); the **emitter** does
   not. So the v-limit T012 must build is *new behaviour*, not the re-labelling of an existing throw.

2. **`stopPropagation` is an unfixed live hole of the same class.** `SyncPolicy.actions` admits
   `'preventDefault' | 'stopPropagation'`. `hoistsPreventDefault()` only tests for `preventDefault`,
   so an unconditional `{when: constant-truthy true, actions: ['stopPropagation']}` emits
   `onClick$={(event) => { event.stopPropagation(); }}` — a lazily fetched QRL, by which time
   propagation has completed. **Nothing catches this**: the gate rule only matches the
   `preventDefault` property name (measured: zero violations for both the unconditional and the
   conditional `stopPropagation` shapes). This is reachable from authored source today.

3. **Solid refuses work it can trivially do, and hides two bugs behind that refusal.** Measured:
   Solid's `validateEnrichedIr` throws `SyncPolicy <id> has unsupported sync shape` for *every*
   policy that is not `{when: constant-truthy true, actions: ['preventDefault']}`, and
   `unknown semantic field: branches` for the branches form. So a user who authors
   `if (event.key === 'Enter') event.preventDefault()` gets a hard compile failure on the Solid lane
   while React compiles it correctly — the three-way contract cannot even be *authored* for the
   conditional case. See §4 for the two bugs the validator is currently masking.

## 1. What the IR actually is (measured, not assumed)

`packages/compiler/src/schema.ts:24-39`:

```ts
export type SyncPolicyCondition =
  | { type:'and';  conditions: readonly SyncPolicyCondition[] }
  | { type:'or';   conditions: readonly SyncPolicyCondition[] }
  | { type:'not';  condition: SyncPolicyCondition }
  | { type:'graph-truthy';    graphNodeId: string; path: readonly string[] }
  | { type:'constant-truthy'; value: JsonValue }
  | { type:'event-equals';    field: string; value: JsonValue };
export type SyncPolicyBranch = { when: SyncPolicyCondition; actions: readonly ('preventDefault'|'stopPropagation')[] };
export type SyncPolicy = SyncPolicyBranch | { branches: readonly SyncPolicyBranch[] };
```

`EnrichedEventRecord.syncPolicy?: SyncPolicy` (`schema.ts:318-325`).

### 1.1 The reference semantics are shipped, not inferred

`@markless/web/dist/sync-policy-core-*.js` is Markless's own runtime evaluator:

```js
function runSyncPolicyActions(policy, graph, event) {
  for (const branch of syncPolicyBranches(policy)) {          // ALL matching branches, in order
    if (!evaluateSyncPolicy(branch.when, graph, event)) continue;
    for (const action of branch.actions) {
      if (action === 'preventDefault')  event.preventDefault?.();
      if (action === 'stopPropagation') event.stopPropagation?.();
    }
  }
}
// graph-truthy   -> Boolean(graph.read(graphNodeId, path ?? []))
// event-equals   -> event[field] === value          <-- STRICT equality, flat field
// constant-truthy-> Boolean(value)
```

Two facts every adapter inherits and must not re-derive:

- **Branches are not exclusive.** Every branch whose `when` holds fires, in list order. It is not a
  `switch`.
- **`event-equals` is strict `===` on a *flat* field.** Markless's extractor maps both `===` and
  `==` in source onto `event-equals`, and its runtime evaluates with `===`. An emitter must emit
  `===`, even where the author wrote `==`. The IR, not the source text, is the contract.

### 1.2 The condition vocabulary reaching an emitter is closed — measured end to end

`buildEnrichedIr` on authored `.tsrx` (probe-t011-build.mts):

| authored guard | produced `when` |
|---|---|
| `if (event.key === 'Enter')` | `{type:'event-equals',field:'key',value:'Enter'}` |
| `if (locked)` where `locked = state(true)` | `{type:'graph-truthy',graphNodeId:'state:locked',path:[]}` |
| `if (!(event.key === 'Escape'))` | `{type:'not',condition:{event-equals …}}` |
| `if (event.key === 'Enter' && locked)` | `{type:'and',conditions:[event-equals, graph-truthy]}` |
| `event.stopPropagation()` (top level) | `{when:{constant-truthy,true},actions:['stopPropagation']}` |
| `if (event.target.tagName === 'INPUT')` | **upstream refusal**: `MARKLESS_SYNC_POLICY_UNEXTRACTABLE: … the guard is not limited to graph state, event fields, props, and constants` |

The last row is the important one. **Markless already fails closed on anything it cannot express**,
including the `event.target.<attr>` shapes the task brief assumed would arrive. `eventFieldName()`
requires `node.object === <event param>` and a static property name, so the only event-side
vocabulary that can ever reach an emitter is **one flat field of the event compared to a literal**.

Consequence, and this is the design pivot of the whole ruling:

> A `sync$()` body synthesized from a `SyncPolicy` condition tree that contains no `graph-truthy`
> node is, **by construction**, a pure function of the event parameter and JSON literals. Closure
> freedom is a property of the generator, not a conclusion of an analysis.

### 1.3 The `branches` form means "multiple handler functions", nothing else

`extractSyncPolicyFromHandlers` (markless compiler dist :4577-4595) pushes at most one branch per
handler function and returns the bare branch when there is exactly one. `{branches}` therefore
arises **iff** the event prop carries an array of ≥2 handler functions each contributing a policy.
It is not a way to express "two conditions on one handler" — a single handler yields exactly one
branch, because `extractSyncPolicyFromBody` returns at the first matching statement.

## 2. Ruling: IR representation

**No schema change. No new IR version.** Specifically rejected:

- *Adding a `syncBody`/`cancelExpression` AST field to `EnrichedEventRecord`.* It would put a
  target-shaped artifact in a target-neutral contract and would let a Qwik constraint dictate the
  IR — the inversion `frameless-idiom-policy-v1` exists to prevent.
- *Splitting `SyncPolicy` into "static" and "dynamic" variants.* The static/dynamic distinction is
  a **per-adapter capability question**, not a property of the authored program. React and Solid
  lower `graph-truthy` with no difficulty. Encoding Qwik's limit in the shared schema would export
  Qwik's weakness to Svelte, Vue and Angular, none of which have it.

The general rule every future adapter inherits:

> **The IR declares *when* and *what*; the adapter decides *where*.** An adapter partitions the
> declared condition tree into the part it can evaluate in its synchronous, pre-activation channel
> and the part it cannot. If the partition is not total for a declared action, the adapter **refuses
> to emit**. An adapter must never narrow the IR to what it happens to support.

## 3. Ruling: lowering, per framework

### 3.1 Qwik — synthesize the guard into `sync$()`

Trigger stays the declared `SyncPolicy`, never handler contents (Gate 3). Widen `hoistsPreventDefault()`
into `syncActionPlan(event)` returning either a plan or a refusal reason.

Lowerable ⇔ single branch (not the `branches` form) **and** `when` contains no `graph-truthy` node
**and** `when` is not a falsy `constant-truthy`.

Emitted shape, for `if (event.key === 'Enter') { event.preventDefault(); submit(); }` with
`{when:{event-equals key Enter}, actions:['preventDefault']}`:

```jsx
onKeyDown$={[
  sync$((event) => { if (event.key === 'Enter') { event.preventDefault(); } }),
  $(async (event) => { if (event.key === 'Enter') { await props.submit(); } })
]}
```

- The `sync$` body is **synthesized from the condition tree**, never lifted from authored source.
  `constant-truthy true` → no guard (byte-identical to T003's shipped shape — this is the
  regression invariant). `event-equals` → `event.<field> === <literal>`, computed access
  `event["…"]` when the field is not a valid identifier. `not`/`and`/`or` → `!`/`&&`/`||`.
- The **declared actions**, all of them, are emitted in the `sync$` body in `actions` order.
- The lazy element keeps the authored guard **minus** the located action calls. The condition is
  therefore evaluated twice; that is sound precisely because it is pure over event fields.
- Collapse rules from T003 carry over unchanged: empty consequent → drop the `if`; empty body →
  one-element array; remainder always `$()`-wrapped (T003's measured optimizer requirement).

### 3.2 React — nothing to do, and pin that fact

Measured: React emits the authored `if (…) event.preventDefault()` unchanged for `event-equals`,
`graph-truthy` and `branches` alike. React handlers are synchronous and resident; the `SyncPolicy`
is used only as a **cross-check** (`emitter/index.ts:2140-2152` asserts each declared action's call
is present in the handler AST). React's validator already accepts the full condition grammar
(`:715-795`). Correct as shipped — but **unpinned**: no test asserts React preserves a conditional
guard. T012 adds one, otherwise the "React needs no change" claim is an assumption.

### 3.3 Solid — widen the validator, and fix the two bugs it is masking

Solid is in the same position as React (synchronous, resident handlers) and should behave the same
way: **preserve the authored body**. Two defects sit behind the current over-narrow validator and
will be uncovered the moment it is widened:

- `normalizeHandler` (`solid/src/emitter/index.ts:2264-2271`) **unshifts an unconditional
  `event.preventDefault()` whenever `actions.length` is non-zero, ignoring `when` entirely.** For a
  conditional policy the authored call is nested in an `IfStatement`, so the strip-filter does not
  remove it — the result would be a cancellation that fires **always**, plus the authored
  conditional call. A conditional cancel silently becomes unconditional. This is the single most
  dangerous line in the change and it is why "just widen the Solid validator" is a trap.
- The same block unshifts `preventDefault` even when `actions` is `['stopPropagation']`.
- `syncActions()` (`:2228-2232`) casts to `{actions}` and would throw `TypeError` on the branches
  form rather than giving a named refusal.

Required Solid behaviour: strip-and-renormalize **only** for single-branch `constant-truthy`-true
policies (the shipped path, byte-identical output); for every other policy leave the authored body
untouched, exactly as React does. Refuse the branches form with a named error.

### 3.4 The absent adapters

Svelte, Vue and Angular inherit §2's rule. The partition question is per-framework: Svelte's
`on:` directives and Vue's `@` handlers are synchronous and resident (React/Solid case). Angular's
forced-lowering constraint is orthogonal — the guard must be hoisted to a class member, but it is
still synchronous. No adapter other than Qwik is expected to need the split; all of them inherit
the **refusal obligation**.

## 4. Ruling: the gate policy that *proves* closure

Two rules, both frameless-owned, both in `packages/frameworks/qwik/src/gate/index.ts`.

### 4.1 `frameless/no-handler-sync-action` (renames `no-handler-prevent-default`)

The current name is a lie once `stopPropagation` is in scope. Widen to both action names, and
harden the ancestor walk per T005.

**Current defect (T005's carried item), reproduced and confirmed:** the walk asks *"is there a
`sync$` between the call and the prop"*. Measured, both of these produce **zero**
`frameless/…` violations today:

```jsx
onClick$={[$(async (event) => { sync$((e) => { e.preventDefault(); }); await go(); })]}   // D
onClick$={(event) => { sync$((e) => { e.preventDefault(); }); }}                          // E
```

Both are broken at runtime — a `sync$` created inside a lazily fetched QRL is resolved long after
dispatch. (Upstream's `qwik/no-async-prevent-default` happens to fire on D because of the `$(async)`
ancestry; it is silent on E. We do not rely on it.)

**Fixed rule.** Walking outward from the action call, the *first* ancestor that is either a
`sync$(…)` call or a JSX event attribute decides:

- first hit is a `sync$(…)` call **and** that `sync$` call is either the direct value of the event
  `JSXExpressionContainer` or a direct element of the array that is that value → **allow**;
- first hit is a `sync$(…)` call that is *not* in direct position → **report** (D and E);
- first hit is a JSX attribute matching `/^on[A-Z]/` → **report**.

Still keys on *which kind of QRL the call lands in*. Still inspects neither `$()` nor `async`.

### 4.2 `frameless/sync-qrl-must-be-closed` (new)

This is the rule the task asks for, and it must **prove**, not sniff. It does **not** try to decide
"is this a signal" — an undecidable, name-based heuristic. It proves the strictly stronger,
decidable property:

> The function passed to `sync$()` under an event prop references **no binding other than its own
> parameters**. No component scope, no module scope, no globals.

Closure freedom ⟹ no reactive state, by implication rather than detection. Decided with ESLint's
own scope analysis: take the `sync$` argument function's scope, and report if any reference in that
scope or any descendant scope either (a) resolves to a variable declared outside the function, or
(b) is unresolved. An **allowlist**, so an unforeseen construct fails closed rather than passing.

This is Qwik's own stated invariant, not ours: `core.mjs:15905` — *"Synchronous QRLs functions can't
close over any variables, including exports"* — and in dev Qwik enforces it by round-tripping the
function through `new Function('return ' + fn.toString())()` (`core.mjs:15911-15920`), which turns a
captured reference into a `ReferenceError` at dispatch. Measured: a `sync$` body reading
`locked.value` draws **zero** frameless violations today.

### 4.3 Mutants — every one must make the gate go RED

Per T007 rule 3, the mutants are the calibration; a rule nobody proved can fail is not a rule.
Shapes A–E and G below are ones the **current** gate is silent on or (A) already catches; all were
executed against `checkSources` for this ruling, so the "currently silent" claims are measurements.

`no-handler-sync-action` — must report:
1. conditional `preventDefault` in a bare lazy QRL (A — caught today; must stay caught)
2. unconditional `stopPropagation` in a bare lazy QRL (B — **silent today**)
3. conditional `stopPropagation` in a bare lazy QRL (C — **silent today**)
4. `sync$` nested inside the lazy `$()` element (D — **silent today**, T005's item)
5. `sync$` nested inside a bare lazy handler (E — **silent today**)
6. action call in the lazy element of a `sync$`-led array (T003's mutant; keep)
7. `async`-independence: the sync and async raw handlers each report exactly one violation
8. **IR-level green-vacuum mutant, T003's pattern**: take a conditional-policy IR, delete
   `syncPolicy`, emit → assert the output contains no `sync$` **and** that the gate reports exactly
   the expected violations. The released expectation must be one that unfixed `main` fails.

`sync-qrl-must-be-closed` — must report:
9. `sync$` body reading a signal (`locked.value`) (G — **silent today**)
10. `sync$` body reading a store member
11. `sync$` body calling a module-scope function
12. `sync$` body reading a component-scope `const`
13. `sync$` body referencing a global (`window`) — refused under the strict allowlist

Anti-vacuity accepts (all must stay clean): the shipped unconditional shape; the new conditional
shape; a `sync$` body using its own second (element) parameter; a non-handler function calling
`preventDefault`.

## 5. Ruling: the fail-closed v-limit

Lives in the **Qwik emitter's `validateEnrichedIr`**, not in the compiler — the limit is Qwik's, and
`packages/compiler` must not learn about it (§2). Qwik currently validates `syncPolicy` **not at
all**; that is the gap. Test file `packages/frameworks/qwik/test/v-limits.test.ts`, in the shape of
`packages/compiler/test/unknown-template-node.test.ts`: assert the exact message.

Refuse to emit when an `EnrichedEventRecord` declares a `SyncPolicy` and any of:

| id | condition | message stem |
|---|---|---|
| V1 | the condition tree of any branch contains a `graph-truthy` node | `declares a conditional sync action whose guard reads graph state <id>; Qwik sync$() QRLs cannot close over reactive state` |
| V2 | the policy is the `branches` form | `declares a multi-handler sync policy; Qwik emits one QRL array per event prop` |
| V3 | a branch's `when` is `constant-truthy` with a falsy value | `declares a sync action guarded by a statically false condition` |
| V4 | a declared action's authored call cannot be located in the handler body | (widen the existing `:587-590` throw to both actions and to guarded positions) |
| V5 | the synthesized `sync$` body would reference any identifier other than the event parameter | `synthesized sync$ body is not closed` |

Each message names the event id and is distinct and greppable. Each gets a test that proves the
**refusal**, per T007.

Notes on the two non-obvious ones:

- **V3 refuses rather than silently deleting.** Stripping the authored call would be behaviourally
  equivalent *if* the constant fold is right, and would silently disable a real cancellation if it
  is wrong. Refusing costs nothing today (no corpus member hits it) and avoids the alternative,
  which would be to carve an exception into the gate. **Never weaken a gate to accommodate a
  degenerate input.**
- **V5 is the emitter asserting its own precondition** (T007 rule 2). §1.2 proves it can never fire.
  A check that cannot fire is exactly the check that catches the day the IR grows a new condition
  type — which is the failure mode `unknown-template-node.test.ts` exists for. It is a
  self-assertion, not a gate, so it needs no failing mutant; it needs a *reachability* test that
  constructs an unknown condition `type` and proves the refusal.

### 5.1 Explicitly considered and refused: mirroring state into a DOM attribute

A `sync$` QRL receives the element and could read `element.dataset.locked`, letting Qwik express a
`graph-truthy` guard by mirroring the graph node onto the host. **Refused for v1**, recorded here so
the next adapter author does not re-improvise it:

1. it makes the emitter synthesize a reactive DOM binding not present in the IR — new, user-visible
   markup that can collide with authored attributes;
2. correctness depends on the mirror being flushed before the event, i.e. on render-scheduling
   guarantees the IR does not make;
3. it converts a clean refusal into a subtle timing bug — the exact trade defect 1 was.

Reopen only with a behavioural two-sided proof on official tooling (state flips → cancellation flips)
and an IR-level declaration of the mirror. Not a Worker decision.

## 6. Measurement obligation before implementing

T003 measured the array form against the shipped optimizer and found that a raw arrow array element
is silently dropped with no diagnostic. The same discipline applies here and the risk is real: a
`sync$` body with an `if` statement is a **new shape** for the optimizer, which rewrites `sync$(fn)`
to `_qrlSync(fn, "<serialized source>")`. S3 proves only that a single-call body survives.

T012 measures **first**: build `demos/qwik` at the lockfile version with a conditional handler and
confirm the event prop serializes (`q-e:keydown="#N|…"`) and the guarded body appears verbatim in
the container's `qFuncs_*` table. If it does not, the lowering design is wrong and the task stops
and reports rather than shipping emitted text that looks right.

## 7. What T012 is NOT

The durable **behavioural** proof — a three-way S-scenario asserting that cancellation fires for the
declared key and does **not** fire for another (two-sided, per T007) — needs
`packages/analyzer/src/scenarios.ts`, the three-way contract and all three demos. It is a separate
package (recommended id **T019**), sequenced after T008/T017/T018 which own the e2e lanes. T012
must not add a `.tsrx` corpus fixture or golden: goldens ripple through every framework suite plus
`metamorphic`/`generative`, which T008 is editing. Test-local emitted strings only.
