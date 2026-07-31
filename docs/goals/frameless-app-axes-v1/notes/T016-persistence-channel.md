# T016 — THE PERSISTENCE AUTHORING CHANNEL

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `3bddd3b` · harness
`claude-code`.

**Result: `done`.** The scalar-string persistence authoring channel is open in the frameless
compiler, and **one app authored in one `.tsrx` survives a browser reload in both consuming
lanes, with no synthesized record anywhere in the path.** Both negative controls fired.

---

## 0. THE ONE-LINE ANSWER

`state('all', { storage: 'markless:filter' })` now produces a real
`FramelessPersistenceRecord` through the real `buildEnrichedIr`. It **refuses** anything that
is not a scalar **string**, at one choke point, with a recorded message. React and Solid
consume it; the other four still refuse verbatim.

**IT DOES NOT FIX THE OWNER'S BUG.** `/todomvc-advanced` forgets `state:todos`, which is
`state([{ id: 't1', title: 'Taste JavaScript', done: true, pending: false }, …])` — **an array
of objects**. This channel persists `filter`, `draft`, `query`, `editing`, `remoteStatus` and
`syncNote`. **It does not persist the completed state, and it never will without an array
channel the owner has to cost and take separately.** The refusal is tested against that exact
shape, quoted from S11 itself.

---

## 1. THREE ERRORS IN THE BRIEF, ALL MEASURED

### 1a. `valueKind` IS NOT THE SCALAR GUARD

T012's ruling and the card both say the guard reads `valueKind`: *"bindings whose enriched
`valueKind` is `'array'`, `'object'` or `'unknown'` … REFUSE"*. **Measured against pinned
Markless 0.1.1, that admits every number and every boolean in the corpus:**

| authored | `valueKind` | `initialValue` |
| --- | --- | --- |
| `state('all', {…})` | `scalar` | `"all"` |
| `state(3, {…})` | **`scalar`** | **`3`** |
| `state(false, {…})` | **`scalar`** | **`false`** |
| `state([{…}], {…})` | `array` | `[…]` |
| `state(seed.slice(), {…})` | `unknown` | *absent* |

`s11-todomvc-advanced.tsrx` authors `next = state(4)` and `serverFails = state(false)`. A
`valueKind === 'scalar'` test would have persisted **both**, and `localStorage.setItem` would
have round-tripped them back as strings — `next + 1` becomes `'31'`, the exact corruption T007
§3a recorded. **The refusal needs the initial value's own runtime type as its second half**,
and the card's `verify` line got this right where the ruling's rationale did not. Recorded in
`assertScalarStringPersistable`'s doc comment so it cannot be re-simplified.

### 1b. `generated-persistence/` IS NOT AN ESCAPE HATCH YOU CAN ADD TO

The card says *"`generated-persistence/` ALREADY EXISTS as the two-lane escape hatch"*. **Its
inventory is asserted EXACTLY, in a file outside `allowed_files`:**

`packages/frameworks/{react,solid}/test/gate.test.ts` — `expect(files).toEqual(['generated-persistence/P1.tsx'])`.

A second artifact breaks both lanes' gate suites and `test/gate.test.ts` is not editable here.
**Independently**, `generated-persistence/**/*.tsx` is inside both lanes' `tsconfig.json`
`include`, and today's two `P1.tsx` files contribute **28 of the 267** `pnpm check` errors, so
any additional emitted artifact pushes the count **above the 267 ceiling** — a `stop_if`.

**Two hard walls, same conclusion: the authored artifact takes the `P1` slot.** `P1.tsx` in
both lanes is now emitted **from the authored `.tsrx`** instead of from the `s2-keyed-todo`
golden with a hand-built record stapled on. That is strictly what this card exists to do —
*"NO synthesized record anywhere in the path"* — and it moved `pnpm check` **down** to 251.

### 1c. THE SOLID DEFECT IS TWO DEFECTS, AND THE SECOND ONE IS WORSE

The brief names one: the dropped write-through for a handler-only binding. Emitting the
authored fixture found a second in the same function — **a persisted signal wrote the OPPOSITE
value on any self-reading set**. See §4. It is worse because it is silent *and* wrong rather
than silent *and* absent: storage is non-empty, so every "is it persisting?" check passes.

---

## 2. THE CHANNEL, AND WHY THIS SHAPE

`packages/compiler/src/build.ts` — `helperCallOptions()` takes `arguments[1]` of the same
`CallExpression` `helperCallArgument()` already resolves for `arguments[0]`;
`authoredStorageKey()` parses `{ storage: '<key>' }` fail-closed;
`collectAuthoredStorageOptions()` binds each option to its graph node.

**Re-measured, not inherited.** Against pinned Markless 0.1.1 the second argument builds with
**zero diagnostics** and the binding **identical to baseline**; `Object.hasOwn(binding,
'storage')` is `false`, so `extractPersistenceSourceFacts` still returns `[]` and the vendor
half is untouched. When Markless grows a real `storage` field the frameless half is a
**deletion**, not a rewrite.

**The key origin is `explicit`, not `derived`.** The author wrote the literal; `derived` is
reserved for a key the compiler invented and must keep reconstructible. This follows the
standing test *"preserves an explicit markless-prefixed key without reclassifying it"*.

**The anti-silent-drop sweep.** After binding every option to a graph node,
`collectAuthoredStorageOptions` walks the whole program for any `state(…)`/`computed(…)` with
a second argument that **no component-owned state binding claimed** and throws. A `storage`
written on a shared-definition cell or on a `computed` would otherwise be **read by nobody and
forgotten** — a feature that compiles and does nothing, which is the failure mode this axis
exists to stop shipping.

### THE REFUSALS, VERBATIM

```
Persistence refuses state binding "value" (state:value): storage is scalar-string-only and this binding has valueKind "array".
Persistence refuses state binding "value" (state:value): storage is scalar-string-only and this binding has valueKind "object".
Persistence refuses state binding "value" (state:value): storage is scalar-string-only and this binding has valueKind "unknown".
Persistence refuses state binding "value" (state:value): storage is scalar-string-only and this binding's initial value is number, not a string.
Persistence refuses state binding "value" (state:value): storage is scalar-string-only and this binding's initial value is boolean, not a string.
Persistence options for state binding "value" must be an object literal.
Persistence options for state binding "value" has unknown field "store"; only "storage" is supported.
Persistence options for state binding "value" is missing required field "storage".
Persistence options for state binding "value" field "storage" must be a non-empty string literal.
Persistence options for state binding "value" must contain only plain "storage" properties.
```

The empty string is **accepted** — `''` is a legitimate scalar initial and the record type only
requires a `string`. The array arm is driven by the object shape **quoted out of
`s11-todomvc-advanced.tsrx`**, so it cannot drift away from the construct it claims to be about.

---

## 3. AUTHORED, NOT SYNTHESIZED — THE PROOF PATH

`packages/compiler/test/fixtures/persistence-authored.tsrx`, 25 lines, three persisted cells:

| cell | authored | `access` | `seed.lowering` | why it is there |
| --- | --- | --- | --- | --- |
| `filter` | `state('all', { storage: 'markless:filter' })` | render + handler | `pre-paint` | the reload proof, and a **self-reading toggle** |
| `draft` | `state('', { storage: 'markless:draft' })` | render + handler | `pre-paint` | the covered half `P1` used to test |
| `touches` | `state('0', { storage: 'markless:touches' })` | **handler only** | `none` | the half `P1` was **blind to** |

Not one test, script or fixture in this path constructs a `FramelessPersistenceRecord`. The
census asserts the whole corpus and **names the single non-zero**:

- 25 `.tsrx` fixtures; every pre-existing one still reports **0** records — the corpus is unmoved;
- the one that asks reports **3**;
- **the differential**: stripping `, { storage: … }` from that same source drops it back to `0`,
  which proves the channel reads the *construct* and not the filename;
- T007's **positive control** on the vendor extractor is kept, and a new negative one asserts
  `extractPersistenceSourceFacts` still sees **nothing** on the authored fixture.

---

## 4. THE SOLID DEFECT — AND THE ONE BESIDE IT

Both in `appendPersistenceWrites`. Full write-up in `docs/DEFECTS.md` entry 18.

**HOLE 1 (T007's).** A handler-only cell lowers to a plain `let`, so its write is an
`AssignmentExpression`; the filter matched only a setter *call*. **Never matched, never
refused.**

**HOLE 2 (found here).** The write-through **cloned the setter's argument** and re-evaluated it
**after** the set:

```js
setFilter(filter() === 'all' ? 'done' : 'all');
__framelessWrite('markless:filter', 'data-markless-filter', filter() === 'all' ? 'done' : 'all');
```

The second ternary reads what the first just committed, so it stores the **opposite**. The
same clone **double-evaluates** any argument with a side effect.

**Both were invisible to the old `P1`**, which persisted a render-read signal set from
`event.currentTarget.value` — a value that neither reads the cell nor has a side effect.

**The repair.** Read the accessor: after `setX(v)`, `x()` **is** `v`. That is correct, cheaper,
and makes the signal arm agree with the store and plain-`let` arms that already read by name.
Plus a plain-`let` arm for `AssignmentExpression`/`UpdateExpression`.

**The shadow guard is deliberate and unreachable from authored source** — measured: a handler
declaring its own `let touches` beside a `state:touches` cell is refused far upstream with
`EventHandlerRecord event:0 has write record absent from handler AST`. It is kept for the
injected-record path every persistence test in this repository uses, and the emitter comment
says so rather than implying coverage.

**The cross-lane pair is kept and now names a closure**: both lanes must report **one**
`__framelessWrite` for the handler-only cell. They disagreed for the whole life of the feature.

---

## 5. THE BROWSER RELOAD PROOF — WITH THE BEFORE ROW

Served bytes: the **committed** `generated-persistence/P1.tsx` of each lane, asserted equal to
`formatEmitted(emit(ir))` before serving; the pre-paint script from
`generatePrePaintPersistenceScript`, **hashed as the browser parsed it**
(`contentSha256` `1a9f39a210e94d467e794d64e441b7ec50c135037e87aad5c7ee5004af02bfc2`, matched in
both lanes). Chromium, per-frame sampler, zero page errors. No file in `demos/` was read as
input or written.

| step | react | solid (fixed) | **solid (pre-fix)** |
| --- | --- | --- | --- |
| cold load, empty storage | `all` | `all` | `all` |
| type `SURVIVE-ME`, click `cycle` — screen | `done` | `done` | `done` |
| storage after the click | `filter=done`, `draft=SURVIVE-ME`, `touches=1` | same | **`filter=all`, `draft=SURVIVE-ME`, no `touches`** |
| storage agrees with the screen | yes | yes | **NO** |
| **RELOAD** | `done` — **SURVIVED** | `done` — **SURVIVED** | **`all` — FORGOT** |
| pre-paint probe, before mount | seed `done`, attr `done`, mounted `false` | same | seed `all` |
| every value ever painted after mount | `["done"]` | `["done"]` | `["all"]` |
| **CONTROL 1** — clear the keys, reload | `all` / `""` | `all` / `""` | `all` |
| **CONTROL 2** — plant a value never written | **`PLANTED-NEVER-WRITTEN`** | **`PLANTED-NEVER-WRITTEN`** | `PLANTED-NEVER-WRITTEN` |

**The pre-fix column is the point.** It is the owner's complaint reproduced *inside the feature
meant to fix it*, and `localStorage` was **non-empty** the whole time — so every "is it
persisting?" check would have passed. It came from the emitter at `3bddd3b`, restored from git
and re-emitted, not from an edited artifact.

**CONTROL 2 is the one that matters.** Control 1 alone leaves *"state survived"*
indistinguishable from *"the page always renders that"*; planting a value the app has never
written proves the page **reads** storage.

---

## 6. THE EDITOR — MEASURED, AND IT IS RED

**`@markless/typescript-plugin` 0.2.2 DOES red-squiggle `state(initial, options)`.** Measured
by compiling the authored fixture through the plugin's own `compileToVolarMappings` — the same
virtual TSX the editor's language service type-checks — and running `tsc` over it with the
website's own compiler options:

```
virtual.tsx(4,27): error TS2554: Expected 1 arguments, but got 2.
virtual.tsx(5,23): error TS2554: Expected 1 arguments, but got 2.
virtual.tsx(6,26): error TS2554: Expected 1 arguments, but got 2.
```

**One diagnostic per persisted binding**, mapped straight back to the author's `.tsrx`.
`@markless/core` declares `state<T>(initial: T): T` — one parameter. `pnpm check` is unaffected
(`.tsrx` is in no `tsconfig` `include`; 267 → **251**), so **the cost is entirely in the editor,
and the owner authors in one.**

**It is not fixable from this card.** The repair is an optional second parameter on
`@markless/core`'s `state`, which is `vendor/` — a `stop_if`. This is the concrete, measured
price of choosing frameless over Markless, and it is now a number rather than a caveat.

---

## 7. WHAT THIS DOES NOT DO

1. **It does not persist arrays, objects, numbers or booleans.** It refuses them. The owner's
   `todos` is an array of objects.
2. **A handler-only record is write-only.** `seed.lowering: 'none'` means
   `generatePrePaintPersistenceScript` excludes it, so `touches` is written on every click and
   starts at `'0'` after every reload. Consistent with `reason: 'no-render-read'` — nothing on
   screen depends on it — but the write only pays off if something later reads the cell in
   render.
3. **It does not ship the shell half.** T012 refuted *"the read half is host-owned"* — the
   script is generated — but the **one-line `<script>` include** is still absent from all six
   official shells (`demos/*/index.html`, outside `allowed_files`). **Persistence in a demo
   still writes and never reads.** The proof above installed the generated script in a
   throwaway app precisely because the shells do not.
4. **It does not join the `s(\d+)` corpus.** Four lanes throw on persistence-bearing IR — still
   verbatim, re-measured on this authored IR — so a persisted scenario would break their
   `regenerate.ts` and move the vue gate's derived census.
5. **It does not fix the react dangling-version defect found on the way** — see §8.

---

## 8. FOUND EN ROUTE, NOT FIXED — A REACT EMITTER DANGLING REFERENCE

The first draft of the fixture read a handler-only cell **after** writing it
(`touches = …; onTrace('cycle', { filter, touches })`). React emitted:

```js
const currentState3 = touches.current;
touches.current = `${Number(currentState3) + 1}`;
onTrace('cycle', { filter: nextFilter, touches: nextTouches }, event);   // nextTouches IS NEVER DECLARED
```

**`nextTouches` is declared nowhere in the module** — a `ReferenceError` on click.

**It is NOT persistence-caused**: measured with the identical program at
`records.persistence.length === 0`, the dangling reference is **identical**. It is a
`useRef`-storage version-naming defect in `packages/frameworks/react/src/emitter/index.ts`,
which is **outside `allowed_files`**. The fixture was reshaped to stop reading the cell after
writing it — recorded here rather than smoothed. **Reproduce it** by restoring
`onTrace('cycle', { filter, touches }, event)` in the authored fixture. It needs its own card.

---

## 9. COMMANDS

| command | result |
| --- | --- |
| owner fingerprint START | `f326d314` / `aeb7edc1` / `f936e169` / 116, sorting the whole `shasum` OUTPUT LINES |
| Markless 0.1.1 probe, second `state()` argument | BUILDS, **0 diagnostics**, binding IDENTICAL to baseline, `hasStorage: false` |
| Markless 0.1.1 probe, number/boolean initials | **both `valueKind: 'scalar'`** — the brief's guard refuted |
| authoring census, 25 fixtures through `buildEnrichedIr` | **24 pre-existing at 0**, the authored one at **3**; strip the option → **0** |
| scalar refusal, 5 arms + 6 malformed-option arms | all refuse with the messages in §2 |
| six real emitters on the AUTHORED IR | react/solid EMIT; qwik/svelte/vue/angular **REFUSE verbatim** |
| solid write sites, authored fixture, before → after | **2 → 3**, and `filter()` replaces a re-printed ternary |
| chromium reload proof, react + solid, 2 negative controls | **SURVIVED**, pre-paint, `PLANTED-NEVER-WRITTEN` read back |
| chromium, **pre-fix solid emitter**, same served harness | **FORGOT** — storage `filter="all"` with the screen on `done` |
| pre-paint `contentSha256` vs bytes the browser parsed | `1a9f39a2…` — **equal in both lanes** |
| DERIVATION: delete both `generated-persistence/P1.tsx` | **PRESENT-AFTER-DELETE = 0 asserted first**, rebuilt **2/2 BYTE-IDENTICAL** |
| `@markless/typescript-plugin` 0.2.2 virtual TSX + `tsc` | **TS2554 × 3** — one per persisted binding |
| `pnpm test` | **EXACTLY 1** failure (foreign `package-inventory` ARM B), **1372** passed |
| `pnpm check` | **251** — did not rise above 267 |
| `pnpm e2e` | PASS — **6 demos × 9 scenarios, all observations equal** |
| `pnpm lint` / `pnpm check:citations` | 0 warnings 0 errors; citations clean, 604 swept |
| `git diff --exit-code` over goldens/fixtures/generated | exit 0, **PAIRED** with `git status --short` |
| foreign PIDs | **64413** on 5175 and **24931** on 5178 re-verified ALIVE; proof server used **5399**; **`pkill -f` NEVER used** |
| owner fingerprint FINISH | `f326d314` / `aeb7edc1` / `f936e169` / 116 — **IDENTICAL to START** |

---

## 10. OPEN, FOR THE PM

1. **THE ARRAY CHANNEL IS STILL THE OWNER'S DECISION.** This card refuses arrays; it does not
   cost one. T012's costing stands: `authoredInitial` stops being a string,
   `__framelessWrite` grows `JSON.stringify`, the pre-paint script grows `JSON.parse` with a
   corruption fallback, and the `data-markless-*` anti-flash attribute would stringify the
   whole todo list onto `<html>` before paint and needs a different mechanism.
2. **THE SHELL HALF IS STILL MISSING FROM ALL SIX OFFICIAL DEMOS.** One `<script src>` per
   shell. Until it lands, no demo reads back what it writes. This is the next slice and it is
   small.
3. **THE EDITOR SHOWS TS2554 ON EVERY PERSISTED BINDING.** Fixable only in `@markless/core`.
   The owner is upstream.
4. **A NEW REACT EMITTER DEFECT IS RECORDED IN §8 AND NOT FIXED** — outside `allowed_files`,
   needs a card, and has a one-line reproduction.
5. **`docs/DEFECTS.md` entry 18 is new** and closes the T007 open item that had no entry.
6. Re-confirmed: both foreign processes alive; the four refusing lanes are still the
   best-guarded part of this axis.
