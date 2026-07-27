# T020 — Conditional cancellation: the behavioural lane

Worker, goal `frameless-defects-and-targets-v1`, task T020. Discharges the first item of
`notes/T011-conditional-cancellation.md` §`missing_evidence`, which T012's own receipt re-flagged:

> No behavioural proof exists that a conditional cancel fires for the declared key and does NOT fire
> for another. Emitted text plus a gate is exactly the evidence base defect 1 defeated.

T012's two-sided check was a one-off probe on a scratch route that has since been deleted. This
converts it into a standing check on the shipped corpus, run by all four lanes of `pnpm e2e`.

Ran in an isolated git worktree, concurrently with another Worker on a disjoint package.

**Status: complete and green.** `pnpm check`, `pnpm test` (667 passed, 1 skipped, 668),
`pnpm test:browser` (react 60/60, solid 49/49, svelte 13/13) and `pnpm e2e` (four rows, all
observations equal) all pass, and regenerating the four emitters is idempotent.

**The three things in here that are easy to skim past, and shouldn't be:**

1. **The always-cancel arm is the load-bearing one** (§4). Under the reproduced bug the *guarded*
   control still behaved correctly, so a one-sided check would have been **green against it**.
2. **`<details>`/`<summary>` was forced, not preferred** (§1.2). A submit navigates the page away; a
   checkbox is unobservable without dragging four frameworks' synthetic `change` semantics into the
   measurement.
3. **The calibration lane cannot reach this scenario at all** (§5). That is a finding about the
   analyzer's reach, not a scoping preference.

---

## 1. The scenario

Two `<details>` appended to `s3-event-form.tsrx`, inside the existing form, after everything S3
already asserts. Their `<summary>` handlers differ in **one integer literal** and nothing else:

| control | authored guard | a single click | default action |
|---|---|---|---|
| `[data-action="cancel-open"]` | `event.detail === 1` | satisfied | **cancelled** — `<details>` stays closed |
| `[data-action="allow-open"]` | `event.detail === 2` | not satisfied | **runs** — `<details>` opens |

The IR records exactly that, and nothing else moved:

```
event:5  {"actions": ["preventDefault"], "when": {"field": "detail", "type": "event-equals", "value": 1}}
event:6  {"actions": ["preventDefault"], "when": {"field": "detail", "type": "event-equals", "value": 2}}
```

`event-equals` on a flat event field, per T020's `stop_if`: T012's V1 refuses `graph-truthy` guards
for Qwik, so a graph guard could not be expressed in all four lanes.

### 1.1 Why both arms are required

The `cancel-submit` control T002 added proves *unconditional* cancellation and cannot distinguish a
correct handler from one that cancels **always**. That is not a hypothetical failure: it is the
Solid bug T012 found hiding behind that emitter's own validator, where `normalizeHandler` unshifted
an unconditional `preventDefault()` and a conditional policy fired regardless of its guard. A
one-sided assertion would have called that correct. §4 reproduces it and shows this scenario catching
it.

Because the two handlers differ only in the literal, neither an always-cancel nor a never-cancel bug
can hide behind a structural asymmetry between the two controls.

### 1.2 Why `<details>`, and not a second form submit or a checkbox

The negative arm deliberately **lets its default action run**, so that default action has to be real,
observable, and non-destructive.

- A second `type="submit"` would navigate the page away mid-scenario and take every later assertion
  with it.
- A checkbox's `checked` is a DOM *property*. `PageHandle` exposes no `evaluate` and `expect.page.*`
  has no property accessor (the constraint `assertS3`'s own doc comment already records), so it
  would have to be mirrored through component state — putting four frameworks' synthetic `change`
  semantics between the guard and the observation. React in particular routes checkbox `onChange`
  off the *click* event, so a `preventDefault()` in `onClick` does not reliably suppress it.
- A `<summary>` click's default action toggles the `open` **content attribute** on its `<details>`,
  which `page.content()` serializes directly. No state is bound, so nothing re-renders these nodes
  and no lane can "repair" a toggle after the fact.

`<summary onclick>` was **measured** to raise no Svelte a11y warning at 5.56.8, in both `client` and
`server` generate modes. That mattered: the Svelte emitter's `assertCompilesClean` throws on any
unsuppressed warning, and `A11Y_EVENT_HOST_TAGS` contains only `form`. A handler on `<details>`
itself *does* warn (`a11y_click_events_have_key_events`, `a11y_no_noninteractive_element_interactions`)
and would have forced an emitter change — which T020 forbids. The handler is on the `<summary>` for
that reason.

### 1.3 Why the assertions are ordered as they are

A summary's activation behaviour runs synchronously at the end of dispatch, so a *failure* to cancel
appears immediately, whereas the absence of an attribute never "becomes true" and cannot be waited
for. So the unguarded arm is clicked second and awaited first: `expect.page.attribute` blocks until
`unguarded` really opened, and only then is `guarded` read. The guarded click is by then strictly
older than a toggle already observed to land.

This is deliberately cheaper than `settleAfterCancellableClick`, which every lane pays 2s for: here
the positive arm *is* the settle.

## 2. Divergence in form, identity in behaviour

The four emitters were regenerated from the same golden. This is the first corpus scenario that tests
the thesis on a **conditional**, and the four forms are genuinely different:

**React** — the authored guard, verbatim:

```jsx
onClick={(event) => {
  if (event.detail === 1) {
    event.preventDefault();
  }
}}
```

**Solid** — identical to React. T012 widened its validator and fixed three bugs so a conditional
policy leaves the authored body untouched; this is the first corpus evidence of that path.

**Qwik** — the guard is **synthesized from the IR's condition tree** into a `sync$()` QRL, and
because the body has no lazy remainder the prop is a one-element array:

```jsx
onClick$={[
  sync$((event) => {
    if (event.detail === 1) {
      event.preventDefault();
    }
  }),
]}
```

**Svelte** — in-body, lowercase prop, inside the whitespace-significant sibling chain:

```svelte
><details data-cancel="guarded"
  ><summary
    data-action="cancel-open"
    onclick={(event) => {
      if (event.detail === 1) {
        event.preventDefault();
      }
    }}
  >cancel-open</summary
></details
```

All four produce the **byte-identical** observation:

```
after conditional clicks guarded details reads open=null and unguarded details reads open=""
```

It is *measured*, not a literal pushed alongside the assertion: both values are read back out of
`page.content()` through `measureAttribute` and interpolated, so `scripts/e2e.mjs`'s cross-lane diff
is comparing data the four frameworks actually produced.

S1's and S2's observations are byte-unchanged, and S3's three existing observations are byte-unchanged.
The new string is appended.

## 3. Negative proof, arm A — the pre-fix Qwik shape

A scenario never observed failing is not a proof. `syncPolicy` was deleted from the two **conditional**
events of the real golden — exactly what the green-vacuum guard in `qwik/test/gate.test.ts` does — and
the Qwik emitter regenerated. The unconditional policies were left in place so the failure could only
be attributed to the conditional lowering.

Reconstructed output (no `sync$`, the authored guard riding a lazily fetched QRL — defect 1's shape):

```jsx
onClick$={(event) => {
  if (event.detail === 1) {
    event.preventDefault();
  }
}}
```

The Qwik lane then failed, verbatim:

```
fail qwik — S1/S2/S3 from emitted output  (scenarios.box.ts)
     clicking [data-action="cancel-open"] left its <details> open, so the guarded handler did not
     cancel the summary's default action during dispatch. Its whole body is
     `if (event.detail === 1) event.preventDefault()` and a single click carries detail 1, so the
     guard was satisfied and the cancellation still did not reach the browser in time.
```

Receipt: `demos/qwik/.witness/receipts/2026-07-27T15-29-18.064Z/receipt.json`. The golden and the
generated output were restored and re-verified byte-identical afterwards.

## 4. Negative proof, arm B — the always-cancel bug (**the load-bearing arm**)

Arm A only proves the scenario catches a *never*-cancel emitter, and a never-cancel emitter is the
easy case — every cancellation check in the repo already catches it. The arm that makes this scenario
**two-sided rather than merely doubled** is this one, so T012's Solid Bug 1 was reproduced directly
in the Solid demo's emitted copy: an unconditional `event.preventDefault()` unshifted to the top of
both conditional handlers, with the authored guarded call left nested in its `if`. The guard is still
in the source; it just no longer decides anything.

```jsx
onClick={(event) => {
  event.preventDefault();          // ← unshifted, unconditional, not authored here
  if (event.detail === 1) {
    event.preventDefault();
  }
}}
```

The Solid lane failed on the **unguarded** arm, verbatim:

```
fail solid-official — S1/S2/S3 from emitted output  (scenarios.box.ts)
     expected '[data-cancel="unguarded"]' attribute 'open' to be "", but it was null
     (page http://127.0.0.1:5173/s3, waited 5000ms)
```

Receipt: `demos/solid-official/.witness/receipts/2026-07-27T15-30-17.902Z/receipt.json`. The demo
copy was restored and re-verified byte-identical.

**This is the arm a one-sided assertion does not have, and the reason it matters is precise:** under
arm B the guarded control **still stayed closed**. `[data-action="cancel-open"]` cancelled, exactly
as it is supposed to. Every assertion about the declared-key side passed. A check that only asked
"did the conditional cancel fire when its guard was satisfied?" would have reported **green against
a handler that had stopped consulting its guard entirely** — which is not a hypothetical, it is the
bug T012 found sitting behind Solid's own validator.

The only thing that distinguishes correct behaviour from that bug is an observation of the case where
cancellation must **not** happen. That is why the second `<details>` exists, and why removing it
would silently reduce this scenario to the evidence base defect 1 already defeated.

## 5. What was deliberately NOT done

**`packages/analyzer/src/scenarios.ts` was left untouched**, though T020 lists it as writable. The
first reason is precedent; the second is a **finding about the calibration lane's reach** and is the
decisive one.

1. Precedent. T002 kept `cancel-submit` out of the S3 action list because the `missing-prevent-default`
   mutant would make a calibration lane genuinely submit and navigate the vitest page away. The same
   argument applies to the `allow-open` control, whose default action runs by design.

2. **FINDING: this scenario is structurally outside the analyzer's reach, and adding it there would
   produce a false green.** The guards read `event.detail`. A real browser sets it to 1 for a user
   click; a constructed `MouseEvent` leaves it at 0, and `react/src/adapter.ts` dispatches
   constructed `MouseEvent`s. Under calibration **both** guards would therefore evaluate false —
   `cancel-open` would silently stop cancelling and `allow-open` would keep not cancelling — so the
   scenario would assert nothing while presenting as a passing two-sided cancellation check. That is
   worse than absence: it is a green in the lane least equipped to report that it had gone blind.

   This is the same *class* of problem T015 identified in the analyzer's original cancellation
   channel, which observed `event.defaultPrevented` — a flag recording that the call was *made* —
   and was therefore structurally blind to defect 1. The channel there recorded the wrong fact; the
   channel here cannot produce the input the fact depends on. In both cases the instrument, not the
   framework, is the limit.

   Generalised, for whoever adds the next behavioural scenario: **any assertion that depends on a
   property only trusted user activation supplies cannot be calibrated by the analyzer**, and must
   live in the e2e lane. `event.detail`, `event.isTrusted` and native activation behaviour are all in
   that set.

The elements themselves are still rendered under calibration and are compared node-for-node against
both handwritten references by `emitted-smoke.browser.test.ts`, so their *structure* stays honest
there even though their *behaviour* cannot be.

**No emitter source was changed.** T012 shipped the lowering; this task adds a corpus case and an
assertion. Every emitter produced the new shape with no modification.

**Size measurements stayed honest.** Reference and emitted both moved by exactly +24 physicalLoc and
+76 structuralNodes on React, and by exactly the same deltas on Solid, so the comparison the two
`size.test.ts` files make is unchanged in substance.

## 6. The two unit tests the corpus change moved

Two files carry counts that the corpus change moves from 2 to 4. This task was briefly blocked on
them — they were outside `allowed_files` — and the PM widened scope rather than hand-editing them,
because the numbers are the least interesting part of both edits.

**Neither was a chased red.** In both cases the count moved because the corpus gained a genuinely
new *kind* of member, and in both cases the count alone is now too weak an assertion to carry the
claim, so the kinds are pinned separately.

### 6.1 `packages/frameworks/qwik/test/gate.test.ts` — coverage widened

`MUTATION: the pre-fix emitter shape is rejected, and upstream stays silent` is the green-vacuum
guard protecting the released defect-1 expectation. It strips every declared `SyncPolicy` from S3's
golden and requires the gate to reject what the emitter then produces.

Before T020 that reconstructed **one** pre-fix shape. It now reconstructs **two**:

```
unconditional  ->  onClick$={(event) => { event.preventDefault(); }}
conditional    ->  onClick$={(event) => { if (event.detail === 1) { … } }}
```

The second is the path T011 measured as **silently re-emitting defect 1**: `hoistsPreventDefault()`
returned false, `emitEvent` handed back a bare lazily fetched QRL carrying the authored guard, and
nothing threw. Until now no gate test exercised it against the real corpus.

So the test is the **unit-level twin of §3**: this proves the *gate* rejects the pre-fix conditional
shape, §3 proves a *browser* does. Neither substitutes for the other — that non-substitutability is
the entire reason T020 exists — and the test comment now says so, so a future reader meeting `2 → 4`
does not read it as someone chasing a red.

Added alongside the count: an assertion that the four stripped policies are
`[constant-truthy, constant-truthy, event-equals, event-equals]`, and a regex pinning the
reconstructed conditional shape. A corpus change that quietly dropped the conditional members would
otherwise leave this test passing at a smaller count with no signal that its coverage had narrowed.

### 6.2 `packages/frameworks/solid/test/emitter.test.ts` — both paths pinned

`the shipped unconditional path still strips and renormalizes` pins the emitted shape of S3's
cancellation sites. The count went to 4, and two regexes were added pinning the conditional bodies as
authored, because that is the property T012 restored when it fixed the three bugs Solid's old
over-narrow validator was hiding. Bug 1 — an unconditional `preventDefault()` unshifted above a
guarded call — would now surface directly in this test rather than only in a browser.

### 6.3 Everything else

The rest of the ripple was inside the original `allowed_files` and is done: the fixture, the IR
golden, the `EXPECTED_HOSTS` rows, four generated files, both handwritten references, both size
measurements, four demo copies, and the contract.
