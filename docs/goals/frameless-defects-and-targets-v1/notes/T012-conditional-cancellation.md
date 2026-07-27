# T012 — Conditional cancellation: implementation record

Worker, goal `frameless-defects-and-targets-v1`, task T012. Implements
`notes/T011-conditional-cancellation.md`, which is authoritative. This file records the things a
receipt cannot hold: the literal measurements, and the four places where the work departed from or
went past the ruling.

Ran in an isolated git worktree, concurrently with another Worker on a disjoint package.

## 1. Step 1 — the optimizer measurement (a gate on the whole design)

T011 §6 made this a **stop condition**, not a formality: a `sync$()` body containing an `if`
statement is a new shape for the Qwik optimizer, and S3 only ever proved that a single-call body
survives. If the guarded body were not extracted, not serialized, or dropped from the event prop,
the design was wrong and the task stopped.

Method: a scratch route in `demos/qwik` at the lockfile version (`@qwik.dev/core` 2.0.0-beta.38,
vite 7.3.1), **production build** via the official `pnpm create qwik` pipeline
(`qwikRouter()` + `qwikVite()`), served with `vite preview`. The probe route and component were
deleted afterwards; nothing in `demos/` is in this task's diff.

**Measured twice.** The first probe was hand-written from T011's example and used `onKeyDown$`. The
emitter actually emits `onKeydown$` — `eventAttributeName()` upper-cases only the first letter of
the IR's lowercase event name. The second probe used the emitter's byte-exact output. Both passed;
the second is the one that counts, and the discrepancy is exactly the kind of gap that makes
"measure the thing you ship" a rule rather than a slogan.

### 1.1 The optimizer rewrite, from the built client chunk

```js
n("input",{"q-e:keydown":[
  a(e=>{e.key==="Enter"&&e.preventDefault()},
    'event=>{if(event.key==="Enter"){event.preventDefault();}}'),
  c.w([t,o])
]},{"data-action":"probe-enter"},null,2,null)
```

`sync$(fn)` becomes `_qrlSync(fn, "<serialized source>")` (minified here to `a`). The **guarded**
body is carried verbatim as the serialized string.

### 1.2 The served container — the strings T012 was asked to record

Event props (`vite preview`, `/probe/`):

```
q-e:keydown="#0|q-wOvRpCvR.js#_run#1"     the sync$ at qFuncs index 0, then the lazy $() element
q-e:keydown="#1"                          sync$-only prop, one-element array
q-e:click="#2"
```

`qFuncs_26uzso` table, verbatim:

```js
["qFuncs_26uzso"]=[
  event=>{if(event.key==="Enter"){event.preventDefault();}},
  event=>{if(event.key==="Escape"){event.preventDefault();}},
  event=>{if(!(event.key==="Escape")&&event.detail===1){event.preventDefault();event.stopPropagation();}},
  …router internals…
]
```

All three guarded bodies survive verbatim, including the `not`/`and` composition and two actions in
one guard. **Step 1 passes.**

### 1.3 Two-sided behavioural check (extra, not asked for)

The serialization proof says the text arrives. It does not say the guard decides anything. On the
same production build, via Playwright:

| action | guard | result |
|---|---|---|
| `Enter` in a form's text input | `event.key === 'Enter'` | **no navigation** — implicit submission cancelled |
| `Enter` in a form's text input | `event.key === 'Escape'` | **navigated to `/probe/?b=`** — not cancelled |

A one-sided assertion would have passed against an always-cancel bug — which is precisely the Solid
bug §3 found. This is a one-off probe on a scratch route, **not a standing lane**; the durable
behavioural proof is still owed (§5).

## 2. Qwik lowering

`hoistsPreventDefault()` → `syncActionPlan()`, which returns a plan or **throws a named refusal**.
The `sync$()` body is **synthesized** from the condition tree by `conditionExpression()`, never
lifted from authored source, so a tree that passed `assertLowerableCondition()` can only produce
event-field reads and JSON literals. `assertClosedSyncBody()` then re-proves the synthesized AST
references nothing but the event parameter.

`stripSyncActions()` removes the located calls from the lazy remainder recursively — the T003
top-level filter could not see a call nested in an `if` — and applies T003's collapse rules
unchanged: an `if` whose consequent empties out is dropped, an empty body yields a one-element
array, the remainder is always `$()`-wrapped.

Byte-identity of the unconditional path is preserved: `constant-truthy` truthy ⇒ `guard: null` ⇒ no
`if` is synthesized. `generated/S1..S3.jsx` and `demos/*/src/emitted` are unchanged.

## 3. The Solid bugs, measured rather than inherited

T011 predicted two bugs behind Solid's over-narrow validator and one poor failure mode. The
validator was widened first and all three were **reproduced before being fixed**.

**Bug 1 — a conditional cancel became unconditional.** Emitted with the validator widened and
`normalizeHandler` unfixed:

```jsx
onClick={(event) => {
  event.preventDefault();               // ← unshifted, unconditional, not authored here
  if (event.key === 'Enter') {
    event.preventDefault();             // ← the authored, guarded call
    setSeen(1);
    props.onTrace('go');
  }
}}
```

The strip-filter only inspected top-level statements, so the authored call — nested in the
`IfStatement` — was never removed, and the unshift ignored `when` entirely.

**Bug 2 — `preventDefault` conjured for a `stopPropagation`-only policy.** For
`{constant-truthy true, ['stopPropagation']}`:

```jsx
onClick={(event) => {
  event.preventDefault();               // ← appears nowhere in the authored program
  event.stopPropagation();
  …
}}
```

**Bug 3 — the branches form threw `TypeError: Cannot read properties of undefined (reading
'length')`**, from casting the policy to `{actions}`.

Fix: strip-and-renormalize applies **only** to the shipped path — a single unconditional branch
declaring exactly `preventDefault` — so that path stays byte-identical while every other policy
leaves the authored body untouched, exactly as React does. The branches form gets a named refusal.

## 4. Deviations from the ruling

Four, all inside `allowed_files`, all recorded because they are decisions and not typos.

1. **A sixth refusal the ruling does not list.** While pinning the vocabulary, T012 measured that
   `if (k) { event.preventDefault(); } else { event.stopPropagation(); }` compiles cleanly and
   Markless extracts **only the consequent's action**. The else-branch call is therefore an ordinary
   statement, and the emitter shipped it into the lazily fetched remainder — a `stopPropagation`
   that runs after bubbling has finished. That is defect 1's failure mode arriving through a door V4
   does not watch. The Qwik emitter now refuses it by name. The gate caught the emitted shape
   already; this refuses to produce it.

   **Scoped to `plan !== null` deliberately.** With no policy at all the emitter still emits the
   authored call and the *gate* rejects it. Two reasons: the shape is unreachable from authored
   source (Markless raises `MARKLESS_SYNC_POLICY_UNEXTRACTABLE` rather than dropping a policy), and
   the green-vacuum guards in `test/gate.test.ts` **reconstruct unfixed main's output by deleting
   `syncPolicy` from a real IR**. Refusing that input would destroy the only mechanism this package
   has for proving its released expectations are not vacuous. That trade was made consciously.

2. **Solid gained React's declared-action cross-check.** T011 §3.3 says Solid should behave as React
   does; React refuses when a declared action is absent from the handler AST
   (`react/src/emitter/index.ts:2150-2153`). Without it, a widened Solid validator would accept a
   policy and then ignore it entirely, leaving the policy decorative on one lane of a three-way
   contract.

3. **A policy declaring zero actions is treated as no policy** rather than validated. Such a branch
   declares nothing for an adapter to place, and refusing it would be a refusal with no failure
   behind it. The `branches`-form refusal is unconditional regardless.

4. **`frameless/sync-qrl-must-be-closed` applies to every `sync$()` call, not only those under an
   event prop.** T011 §4.2 scoped it to event props; Qwik's invariant is unconditional, and the
   wider scope is simpler and fails closed. No emitted output contains a `sync$()` anywhere else.

## 5. What is still owed

- **The behavioural lane.** §1.3 is a probe, not a standing check. A three-way S-scenario asserting
  that a conditional cancel fires for the declared key and does **not** fire for another is the only
  thing that closes this the way defect 1 was closed. T011 §7 sequences it separately.
- **`docs/DEFECTS.md`.** The `stopPropagation` hole T011 found — an unfixed defect of defect 1's
  class that nothing caught — is not recorded there. That file is owned end to end by another task
  and is not in this task's `allowed_files`; the board already sequences the entry after it. The
  file still refers to the gate rule by its old name, `frameless/no-handler-prevent-default`.
- **The corpus.** No `.tsrx` fixture, compiler golden or `generated/*.jsx` was added, per the ruling:
  goldens ripple through every framework suite plus `metamorphic` and `generative`. Every test here
  builds its IR from an in-memory source string. Adding a conditional member to the shipped corpus
  is a separate package.

## 6. Unreachable-today refusals, and why they still ship

Three refusals cannot fire against anything Markless can currently produce, and each has a test that
says so rather than a mutant that pretends otherwise:

| refusal | why unreachable | how it is calibrated |
|---|---|---|
| Qwik V2 / Solid branches | authoring ≥2 handler functions on one prop fails **earlier**, in handler reconciliation: `Event event:0 expected 2 handler AST(s), found 1` | pinned in `compiler/test/v0-limits.test.ts`; refusal proved by IR mutation |
| Qwik V3 | no corpus member declares a statically false guard | refusal proved by IR mutation |
| Qwik V5 | `eventFieldName()` admits only a flat event field vs a literal, so a synthesized body is closed by construction | reachability test constructing a future condition type |

This is T007 rule 2 territory: a check that cannot fire today is exactly the check that catches the
day the IR grows a new condition type. What it must not do is *look* calibrated when it is not —
hence the table, and hence the tests being honest about which kind of evidence they are.
