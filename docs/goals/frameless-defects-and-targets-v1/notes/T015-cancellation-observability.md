# T015 — how cancellation becomes observable

Judge ruling. Written by the PM from the Judge's response; the Judge is barred from writing
analysis files and the PM owns state writes.

Two premises had already been falsified on this goal by checking rather than assuming, so this
ruling reads the `eslint-plugin-qwik` rule implementation and the analyzer's comparison path
directly rather than trusting their descriptions.

---

## 1. Did S3 ever test cancellation behaviorally? **No. Verified.**

The only `preventDefault()` in the corpus is at `packages/compiler/test/fixtures/s3-event-form.tsrx:33-41`,
on a `<button type="button">`. A `type="button"` inside a form has no activation behavior.
Reproduced verbatim by all three emitters. Finding 2 stands.

**The mutant is weaker than `docs/DEFECTS.md` claims.** `packages/analyzer/src/mutants.ts:9`
declares `wrong-cancellation` on channel `callback`, realised as `missing-prevent-default`
(`react/test/reference.tsx:198`, `solid/test/reference.solid.tsx:216`) — the mutant simply omits
the call. The analyzer's only cancellation observation is:

```ts
// packages/analyzer/src/run.ts:41
defaultPrevented: event?.defaultPrevented ?? null,
```

compared at `packages/analyzer/src/compare.ts:71`. That is **a flag recording that
`preventDefault()` was called**, not evidence that a default action was averted. There is no
default action anywhere in the corpus to avert.

So the doc's claim that "the React and Solid calibration suites prove the analyzer *detects* a
broken `preventDefault`" is true only narrowly: they detect the **absence of the call**.

**The load-bearing consequence** (inferred, well-grounded, untestable here as no Qwik browser lane
exists): Qwik's late async handler still *calls* `preventDefault()`, so it would still record
`defaultPrevented: true`. **The existing cancellation channel is structurally blind to defect 1.**
The doc attributes the miss to the absent Qwik browser lane. That attribution is wrong — even with
the lane, `wrong-cancellation` would have passed.

## 2. Finding 1 is now a verified fact, not a hypothesis

The full `no-async-prevent-default` rule from `eslint-plugin-qwik@2.0.0-beta.38/dist/index.js`:

```js
"CallExpression[callee.property.name='preventDefault']"(e){
  let t=e.parent;
  for(;t;){
    if(t.type==="CallExpression"&&t.callee&&t.callee.type==="Identifier"&&t.callee.name==="$"){
      r.report({node:e,messageId:"noAsyncPreventDefault"});break
    }
    t=t.parent
  }
}
```

It walks ancestors for a `$(...)` call and **never inspects `async` at all**, despite its name and
message. `onClick$={async (e) => {e.preventDefault()}}` has no `$()` ancestor, so it cannot fire.

This **refutes the alternative reading** that the raw-handler change accidentally fixed defect 1:
the rule's silence is a parser miss, not a semantic change. The rule's *intent* — "preventDefault
inside a QRL" — is right; its *implementation* detects QRL-ness only through the explicit `$()`
wrapper and misses the JSX-prop form the optimizer also turns into a QRL. Upstream gap, worth filing.

## 3. Ruling on observability

**Add one `<button type="submit" data-action="cancel-submit">` to S3, clicked only by the three-way
e2e contract, as the last step.**

Rejected alternatives, with reasons:

| Option | Why rejected |
|---|---|
| Change `type="button"` → `type="submit"` | Cheapest delta, but it makes the `wrong-cancellation` mutant **destructive**: `react/src/adapter.ts:56-62` dispatches real cancelable MouseEvents and relies on native activation, so `missing-prevent-default` would genuinely submit and navigate the vitest page away. The calibration lane would crash instead of reporting a divergence. Trades a working oracle for a broken one. |
| New S4 scenario | Correct but the largest bill: new fixture, IR golden, three generated files, three demo copies, three routes, analyzer scenario, two handwritten references, a `resumeSymbols` entry, a README row, a new e2e matrix row — then inherited three more times by Svelte/Vue/Angular. Marginal safety over the ruling is small. |
| Checkbox channel | The existing checkbox's toggle is what the `check` action depends on. A *new* checkbox is observable only via the `:checked` property, which `page.content()` cannot serialize, so it could not feed the cross-lane measured-observation diff. |

Why the chosen option works:

- **Real default action.** A form submit with no `action` is a GET to the current URL — a genuine
  `resourceType: 'Document'` request.
- **The instrument already exists and is already load-bearing.** `three-way-contract.ts:326-333`
  already throws unless exactly one Document request served the page; `:354-368` already asserts
  `navigations` per framework. No new machinery.
- **Two independent failure signals for Qwik**: the extra Document request, and the reload
  resetting `data-writes` from `2` to `0` — which the existing measured observation already reads.
- **It cannot fail for React or Solid.** `waitForInteractive` (`:187-204`) blocks on the activation
  marker before any click, so their synchronous handlers are installed. Qwik deliberately does not
  wait. That asymmetry is the thesis, and it is exactly what makes it fail.
- **Non-destructive.** The analyzer's S3 action list (`packages/analyzer/src/scenarios.ts:56-60`)
  does not click it, so calibration, `emitted-smoke`, `action-order` and `strictmode` never trigger
  a submit. The `wrong-cancellation` mutant is untouched.
- **S3's existing oracle is fully preserved.** Clicking last means every current assertion still
  runs and still passes for all three first. Nothing is traded; a channel is added.
- `data-action="cancel-submit"` ≠ `"submit"`, so the form's bubble guard does not fire and
  `expectedCallbacks` is unchanged.

**Blast radius:** the fixture and its IR golden; `enriched-ir.test.ts:32-39` (one
`['button','data-action']` row); three `generated/S3.jsx`; two handwritten references, which
`emitted-smoke.browser.test.ts:27` compares node-for-node; both `size.test.ts` files, which
hard-code S3 at `physicalLoc: 69/51, structuralNodes: 307/226`; three demo `EventForm.jsx` copies
(auto-derived by `copy-emitted`); the contract. Possibly the two `emitted-typecheck.test.ts`
expected-error lists.

**Residual risks T002 must verify, not assume:** that `@qwik.dev/router` leaves a plain `<form>`
submit uninterrupted (only `<Form>` is intercepted — inferred from `demos/qwik/src/routes/s3/index.tsx`,
which uses neither); and that the compiler accepts a handler whose body is only
`event.preventDefault()`.

## 4. The lost lint detection: restore it in T003, as a frameless-owned gate policy

Do **not** revert the emission shape to `$(handler)` to satisfy a rule that does not check what its
name says. That would invert `frameless-idiom-policy-v1` and let an upstream heuristic dictate
emitted output.

Is the lint still load-bearing once the runtime assertion exists? For defect 1, no — the runtime
assertion is strictly stronger. In general, yes, **and here is the sharp edge**: T003 must flip
`qwik/test/gate.test.ts:73-82` from one expected violation to `[]`. But `[]` is *already* what
merged main produces, unfixed. Flipping it alone would ship a green gate that would pass identically
if the emitter were never touched — precisely the green-vacuum failure mode this board is worried
about.

**Ruling:** T003 must, in the same change, add a frameless-owned Qwik gate policy rejecting
`preventDefault()` inside any emitted event-handler body regardless of `$()` wrapping,
mutation-tested in the pattern of `gate.test.ts:93-110`, and only then release the known-failing
expectation. Not a separate package — splitting risks the green vacuum landing first. This is also
the natural home for T011/T012's fail-closed conditional-cancellation limit.

## 5. Recommended `docs/DEFECTS.md` corrections

Recommended, not applied. Folded into T003.

1. **Keep the #1 rank; restate the basis.** Lines 55-61 — the suites detect the *absence of the
   call* via `event.defaultPrevented`; no default action is exercised anywhere in the corpus.
2. **Correct the "why nothing caught it" attribution** (63-68). The miss is not primarily the absent
   Qwik browser lane; the channel is structurally blind. The lane would not have caught it.
3. **Correct the code snippet** (38-43). On merged main `generated/S3.jsx:37-38` has no `$()`
   wrapper. Add that the rule matches `$()` ancestry, never checks `async`, and so can no longer
   serve as evidence.
4. **Downgrade "diagnosed by rule" to "undiagnosed".** With the rule silent and the runtime
   divergence undemonstrated, defect 1 currently has *zero* demonstrated evidence.
5. **State plainly that the repo has never emitted or exercised a real cancellation in any target.**

On severity: the Judge would still rank defect 1 **#1**. The mechanism is deterministic — a QRL
costs at minimum a microtask, and the default action runs immediately after dispatch;
`preventDefault()` on a submit button is the single most common cancellation in web apps; and
Svelte, Vue and Angular are about to inherit an IR whose `preventDefault()` lowering has never been
behaviorally validated in *any* target. **The inertness of S3 makes this more worrying, not less.**

6. Rename to lowercase or update references — `docs/DEFECTS.md` is uppercase on disk and Linux CI
   will not resolve `docs/defects.md`.
