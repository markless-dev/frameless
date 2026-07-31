# T007 — THE FIFTH AXIS: PERSISTENCE

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `805fcb2` · harness
`claude-code`.

**Result: `blocked` on the card's shipping objective, with the deliverable — the per-lane
persistence verdict — measured in full.** S11 cannot be persisted from the file this card is
allowed to edit, and the reason is not a lane property. Everything else the card asked for was
measured, in a browser, with two negative controls.

---

## 0. THE ONE-LINE ANSWER

**Persistence has no authoring surface.** `@markless/core` declares `state<T>(initial: T): T`
— **one parameter, no options object** — and pinned Markless 0.1.1's `SemanticGraphBinding`
**has no `storage` field at all**. `extractPersistenceSourceFacts` therefore returns `[]` for
**every** `.tsrx` that can ever be written against this vendor, in **all six lanes**, *upstream
of every emitter*. Editing `s11-todomvc-advanced.tsrx` cannot make `/todomvc-advanced` survive
a refresh, and no narrowing of the fixture changes that.

Measured, not read: **23 of 24 corpus fixtures build; total persistence records = 0.** (The
24th, `composition-attach-input-ambiguous.tsrx`, exists to be refused and does not build
standalone; it cannot report a record either.)

---

## 1. THE PER-LANE VERDICT — THE DELIVERABLE

Method: build the **real** S11 enriched IR from
`packages/compiler/test/fixtures/s11-todomvc-advanced.tsrx`, inject a persistence record into
`ir.records.persistence`, and call **each lane's real `emit()`**. Four arms per lane
(`filter` string / `todos` array / `next` number / `serverFails` boolean). This is the same
route every persistence test in this repository already uses, the vendor path being inert.

| lane | verdict | evidence |
| --- | --- | --- |
| **react** | **EMITS** | 4/4 arms emit; seed read `globalThis.__FRAMELESS_STATE__?.['markless:…']`; write-through emitted. |
| **solid** | **EMITS, WITH A HOLE** | 4/4 arms emit; **drops the write-through for a handler-only binding** (§3). |
| **qwik** | **REFUSES** | `Qwik emitter does not support persistence-bearing IR; persistence-on-Qwik is deferred` |
| **svelte** | **REFUSES** | `Svelte emitter does not support persistence-bearing IR` |
| **vue** | **REFUSES** | `Vue emitter does not support persistence-bearing IR` |
| **angular** | **REFUSES** | `Angular emitter does not support persistence-bearing IR` |

All four refusals are **identical across all four arms** — the refusal is on the *presence* of
`ir.records.persistence`, not on any property of the persisted binding.

### 1a. THE CARD'S PREMISE IS WRONG ABOUT THE FOUR LANES

The card reads: *"A SHIPPED CAPABILITY AT 2/6 LANES WITH NO APP EXERCISING IT IS THE SAME
SHAPE AS THE MUTATION HARNESS THAT WAS DEAD FOR 22 COMMITS … does persistence work in the FOUR
LANES THAT HAVE NEVER EMITTED IT?"**

**It is not that shape.** The four lanes are not unmeasured — they are **deliberately and
actively guarded**:

- each of the four emitters carries an explicit `throw` on `ir.records.persistence.length`;
- each of the four **gates** declares a `persistence-render-lowering` policy;
- each of the four already ships a **MUTATION test** (`packages/frameworks/{qwik,svelte,vue,
  angular}/test/gate.test.ts`, `…/test/emitter.test.ts`) that pushes a persistence record in
  and asserts *both* the gate violation *and* the emitter throw.

The dead-harness analogy fits `generated-persistence/P1.tsx` — one artifact, two lanes, written
only by `UPDATE_GOLDENS=1` — but **not** the four-lane refusal, which is the most thoroughly
guarded thing on this whole axis. **The unguarded fact was somewhere else entirely, and §2 and
§3 are it.**

---

## 2. THE FINDING THAT ANSWERS THE OWNER — THE READ HALF OF THE LOOP IS HOST-OWNED, AND NO OFFICIAL SHELL INSTALLS IT

The emitted persistence code **only reads** `globalThis.__FRAMELESS_STATE__`. **Nothing in any
emitter populates it.** By design it is filled by a **pre-paint host script** that reads
`localStorage` before the body parses — the `landings` entry
`{ target: 'markless', kind: 'payload-scripts', slotSymbolKey: 'tsrx.storage/1' }`.

**Measured across all six official demo shells** (`demos/{react-official,solid-official,qwik,
svelte-official,vue-official,angular-official}`): **zero occurrences of `__FRAMELESS_STATE__`
and zero pre-paint installers.** The only shells in the repository that carry one are
`demos/persistence/{react-app,solid-app}/index.html`.

So even if S11 *were* authorable with persistence, react and solid would **write to
`localStorage` on every change and read nothing back**: the seed would fall through to the
authored initial on every load and the page would *still* forget. **The write half is
emitter-owned; the read half is host-owned; the two are wired together in exactly one place in
this repository, and it is not the six official demos.**

`demos/*/index.html` is **outside `allowed_files`** for this card.

### 2a. THE OWNER'S REPORT, REPRODUCED IN A BROWSER IN EVERY SERVING LANE

`pnpm demo`, chromium, `/todomvc-advanced`, toggle the first todo → reload:

| lane | `typeof __FRAMELESS_STATE__` | localStorage keys after the toggle | checked before → after click → after reload | survived? |
| --- | --- | --- | --- | --- |
| react | `undefined` | `[]` | true → false → **true** | **NO** |
| solid | `undefined` | `[]` | true → false → **true** | **NO** |
| qwik | `undefined` | `[]` | true → false → **true** | **NO** |
| svelte | `undefined` | `[]` | true → false → **true** | **NO** |
| vue | `undefined` | `[]` | true → false → **true** | **NO** |
| angular | — | — | HTTP **404**, 0 toggles | not served (emitter refuses S11) |

The owner is right, in five lanes, for the reason above. **`localStorage` stayed empty** — this
is not a lost write, it is an absent feature.

*(vue also logged `_ctx.Promise is not a constructor`, the already-recorded S11 runtime defect
on the async submit path. The toggle itself works, so S11's four-lane behaviour is unchanged by
this card.)*

---

## 3. THE UNGUARDED DEFECT THIS CARD BOUGHT — SOLID SILENTLY DROPS THE WRITE-THROUGH

Both "supported" lanes were given the **same canonical record**, produced by the **real vendor
adapter** `adaptPersistenceFacts` (not hand-shaped), for `state:next` — a binding read **only
inside handlers**, so `access = { render: false, handler: true }` and
`seed.lowering = 'none'`:

```
[react] next: seedLowering=none -> seedRead=false  writeCalls=1
[solid] next: seedLowering=none -> seedRead=false  writeCalls=0
```

React emits `__framelessWrite('markless:next', 'data-markless-next', …)` after the assignment.
**Solid emits `next = title === '' ? next : next + 1;` and no write at all** — not even the
`__framelessWrite` helper declaration.

The record's own contract says `writeThrough.trigger: 'ordinary-assignment'`. That assignment
**is** an ordinary assignment. Solid lowers a handler-only binding to a plain `let`, that path
never routes through `persistenceStatements`, and `validatePersistenceCorrelation` **accepts
the record anyway** — it asks only that a `kind: 'state'` binding of that name exists. **So the
binding seeds from storage and can never write back. Nothing refuses, nothing warns.**

**Why nothing caught it:** `generated-persistence/P1` persists `draft`, a **render-read
signal**, which sits entirely inside the covered half. The single golden that exercises this
feature is, by construction, blind to the hole.

### 3a. A SECOND, SMALLER ONE — A PERSISTENCE RECORD REPLACES THE AUTHORED INITIALIZER

With `seed.lowering = 'none'` there is no seed to read, yet `persistenceSeed` still falls back
to `record.authoredInitial`, which the record type declares as a **`string`**. The golden
authors `next = state(3)`; with a record attached both lanes emit the **string**:

```
react:  const next = useRef('3');
solid:  let next = '3';
```

`next + 1` is then `'31'`. This is consistent *only* because the vendor boundary refuses a
non-string `authoredInitial` upstream — **measured**: `number`, `array`, `boolean` and `object`
all throw `MarklessStorageSourceFact[0].authoredInitial must be a string.` **The emitters do
not re-check it.** Persistence is scalar-string-only and only one of the two boundaries says so,
and it is the inert one.

---

## 4. THE BEHAVIOURAL PROOF — RELOAD, PRE-PAINT, AND TWO NEGATIVE CONTROLS

A unit test asserting a seed was written is not the proof, and the card is right about that.
The only app in this repository with **both halves** of the loop is `demos/persistence`, whose
`PersistedApp.tsx` carries `// @generated by @frameless/{react,solid}`. Both prebuilt `dist`
bundles were served statically (**read-only; no file in `demos/persistence` was modified**) and
driven in chromium with a **per-animation-frame sampler installed at document-start**, so every
value a user could have seen is in the trace.

| step | react | solid |
| --- | --- | --- |
| cold load (empty storage) | seed `light`, input `light` | seed `light`, input `light` |
| type `SURVIVE-ME` | `localStorage['markless:draft'] = "SURVIVE-ME"` | same |
| **RELOAD** | **input `SURVIVE-ME` — SURVIVED** | **input `SURVIVE-ME` — SURVIVED** |
| frames before mount | 2 | 1 |
| every pre-mount value of `data-markless-draft` | `["SURVIVE-ME"]` | `["SURVIVE-ME"]` |
| every pre-mount value of the seed slot | `["SURVIVE-ME"]` | `["SURVIVE-ME"]` |
| first **mounted** frame's input value | `SURVIVE-ME` | `SURVIVE-ME` |
| every input value ever painted | `["SURVIVE-ME"]` | `["SURVIVE-ME"]` |
| **NEGATIVE CONTROL 1** — remove the key, reload | back to `light` everywhere | back to `light` everywhere |
| **NEGATIVE CONTROL 2** — plant `PLANTED-BY-CONTROL`, reload | page shows `PLANTED-BY-CONTROL` | page shows `PLANTED-BY-CONTROL` |

**PRE-PAINT, NOT A FLASH.** The authored default `light` appears in **no** painted frame after
a reload with a stored value, and the persisted value is already on `<html>` and in the seed
slot **before the framework has mounted anything**.

**NEGATIVE CONTROL 2 is the one that matters.** Control 1 alone leaves *"state survived"*
indistinguishable from *"the page always renders that"*; planting a value the app has never
written proves the page **reads storage**.

---

## 5. WHY THE CARD'S OBJECTIVE IS BLOCKED, PRECISELY

Making `/todomvc-advanced` survive a refresh requires **two** things, and **both** are outside
`allowed_files`:

1. **An authoring surface.** A `.tsrx` cannot request persistence; `SemanticGraphBinding` has
   no `storage`. Adding one means `packages/compiler/src/persistence.ts` / `build.ts` or the
   vendored Markless tarball. **Not in `allowed_files`.**
   *(Synthesising the record inside a `regenerate.ts` — which **is** in `allowed_files` — was
   considered and rejected: it fabricates a compile input the authored source does not contain,
   and oracle part 2 requires the app be authored **once**, in one `.tsrx`.)*
2. **The pre-paint host script.** `demos/*/index.html`. **Not in `allowed_files`.**

And a third, independent of both: **S11's completed state is `state:todos`, an ARRAY.** The
persistence contract is scalar-string-only (§3a). Persisting `todos` would need JSON encode /
decode that no emitter emits — `__framelessWrite` calls `localStorage.setItem(key, arrayValue)`
directly, which stringifies to `"[object Object],[object Object]"`. **Even with both files
above in scope, the owner's exact complaint would not be repairable without a design change.**

`stop_if` fired: *"Need files outside allowed_files."*

---

## 6. WHAT LANDED, AND WHY IT IS THE RIGHT DURABLE SHAPE

Three test files, no source, no generated bytes.

- **`packages/compiler/test/persistence.test.ts`** — locks §0. A corpus census asserting **zero
  authored persistence records**, plus a **POSITIVE CONTROL** feeding
  `extractPersistenceSourceFacts` a binding that *does* carry `storage` and getting the fact
  back. Without that control the census would pass identically if the extractor were dead —
  *the exact vacuous-proof trap this project keeps buying.* Plus four arms locking the
  string-only boundary.
- **`packages/frameworks/react/test/emitter.test.ts`** — react honours the write-through for a
  handler-only binding (1 write), and records the initializer swap of §3a.
- **`packages/frameworks/solid/test/emitter.test.ts`** — **`DEFECT: drops the write-through for
  a HANDLER-ONLY persisted binding`**, 0 writes on the same canonical record. Labelled a
  characterization of a defect, not an endorsement: *if the Solid emitter learns to write these
  back, this test going red is the intended signal.*

The two lane tests are an explicit **cross-lane pair** and each names the other; if they ever
agree, one lane moved and the split must be re-recorded.

---

## 7. COMMANDS

| command | result |
| --- | --- |
| owner fingerprint START | `f326d314` / `aeb7edc1` / `f936e169` / 116, sorting the whole `shasum` OUTPUT LINES |
| authoring census, 24 fixtures through `buildEnrichedIr` | 23 built, **0 persistence records** |
| vendor boundary, 4 non-string arms | all refuse `authoredInitial must be a string` |
| six real emitters × 4 arms on the real S11 IR | react/solid EMIT; qwik/svelte/vue/angular REFUSE **verbatim** |
| canonical-record probe via `adaptPersistenceFacts` | react 1 write / **solid 0 writes** on `state:next` |
| pre-paint installer sweep, six official shells | **0 of 6** |
| `pnpm demo` + chromium `/todomvc-advanced`, six lanes | **5 lanes forget on reload**, storage empty, angular 404 |
| chromium reload proof, `demos/persistence` react + solid | **SURVIVED**, pre-paint, 2 negative controls |
| DERIVATION: delete both `generated-persistence/P1.tsx` | **PRESENT-AFTER-DELETE = 0 asserted first**, rebuilt **2/2 BYTE-IDENTICAL** |
| `pnpm test` | **EXACTLY 1** failure (foreign `package-inventory` ARM B), **1348** passed (+8) |
| `pnpm check` | **267** — did not rise |
| `pnpm e2e` | PASS — **6 demos × 9 scenarios**, all observations equal |
| `pnpm lint` / `pnpm check:citations` | 0 warnings 0 errors on 550 files; citations clean, 602 swept |
| `git diff --exit-code` over generated/goldens/fixtures/emitted | exit 0, **PAIRED** with `git status --short` (3 modified, all inside `allowed_files`) |
| demo servers stopped by recorded PID 60685 | six ports free; foreign PIDs **64413** and **24931** re-verified ALIVE with original start times; **`pkill -f` NEVER used** |
| owner fingerprint FINISH | `f326d314` / `aeb7edc1` / `f936e169` / 116 — **IDENTICAL to START** |

---

## 8. OPEN, FOR THE PM

1. **PERSISTENCE HAS NO AUTHORING SURFACE.** Nothing on any board can ship a persisted app
   until `state()` (or the vendored Markless semantic graph) grows a `storage` channel. This is
   a **design card**, not a fixture edit. It is the single blocking fact.
2. **SOLID DROPS THE WRITE-THROUGH FOR HANDLER-ONLY BINDINGS.** New, characterized, in
   `docs/DEFECTS.md`'s house style but **not** in `docs/DEFECTS.md` — that file is outside this
   card's `allowed_files`. Needs an entry.
3. **PERSISTENCE IS SCALAR-STRING-ONLY AND THE EMITTERS DO NOT ENFORCE IT.** A record for an
   array or numeric binding lowers cleanly and corrupts. Enforced only at the inert vendor
   boundary.
4. **THE PRE-PAINT SEED IS HOST-OWNED AND ABSENT FROM ALL SIX OFFICIAL SHELLS.** Whoever ships
   persistence must ship the shell half in the same card, or persistence will write and never
   read.
5. **THE CARD'S "FOUR UNMEASURED LANES" PREMISE IS WRONG** — those four are the best-guarded
   part of this axis (§1a). Correct the board text.
6. Inherited and re-confirmed: react/solid/vue answer **200 for any path**; both foreign
   processes (**64413** on 5175, **24931** on 5178) are alive; `style` lowering is still
   unmeasured in all six lanes.
