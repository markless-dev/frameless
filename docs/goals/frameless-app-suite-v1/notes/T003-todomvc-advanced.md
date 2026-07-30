# T003 — TodoMVC Advanced, the eleventh corpus scenario

Worker receipt detail. One authored source at
`packages/compiler/test/fixtures/s11-todomvc-advanced.tsrx`, attempted in all six
lanes, emitted in five, **with its async axes actually running in four**.

---

## 0. THE HEADLINE, AND IT CORRECTS BOTH THE DISPATCH AND T002's RULING

The brief and T002's ruling table both say the `new Promise` + `setTimeout` shape
(the "PA shape") **loses exactly one lane, angular**. Measured on the real module:

> **It loses TWO, at TWO DIFFERENT STAGES, and the second one is invisible to
> every static check this repository owns.**

| lane | verdict | where it fails | evidence |
|---|---|---|---|
| **react** | **RUNS** | — | driven, 7/7 axes, 0 console errors |
| **solid** | **RUNS** | — | driven, 7/7 axes, 0 console errors |
| **qwik** | **RUNS** | — | driven, 7/7 axes, 0 console errors |
| **svelte** | **RUNS** | — | driven, 7/7 axes, 0 console errors |
| **vue** | **EMITS-BUT-MISBEHAVES** | the **browser** | `_ctx.Promise is not a constructor`, ×3 |
| **angular** | **REFUSES** | the **emitter** | `Angular emitter cannot resolve the identifier "Promise" …` |

`EMITS-BUT-MISBEHAVES` is the third verdict T001 established, and this is the
first time it has been reached by a corpus scenario rather than by a probe.

### 0.1 Angular — the refusal, verbatim, read off THIS module

T001 measured the `PA`/`PC` probes. The card required the message to be re-read
off the real app, and it was — the member list in it is S11's own:

```
Angular emitter cannot resolve the identifier "Promise" in a transplanted body:
it is neither a body-local binding, a function parameter, a @for variable, nor a
declared component member (active, allDone, completed, draft, editDraft, editing,
filter, next, onTrace, query, remainingLabel, remoteHits, remoteLabel,
remoteStatus, remoteTerm, searching, serverFails, shown, shownLabel, syncNote,
todos). The emitter throws rather than guessing whether it is a global
```

There is no `packages/frameworks/angular/generated/S11.ts` and no angular route.
The refusal is **not about async** — `probes/async-door` `PC` reproduces it on a
fully synchronous module — so it is a **global-identifier ban**.

### 0.2 Vue — THE FINDING NOTHING PREDICTED, and nothing in this repo catches

Vue `emit()` **succeeds**. The dossier gate **passes**. `compileScript` reports an
**empty diagnostic set**. `pnpm check` is **unchanged**. And then the served page
reports, verbatim, once per async dispatch:

```
_ctx.Promise is not a constructor
```

**The cause, measured, not inferred.** The vue emitter inlines handlers into
**template expressions**:

```
@change="async (event) => { … await new Promise((settle) => { setTimeout(() => settle(true), 600); }); … }"
```

Vue's template compiler prefixes every identifier outside its own allowlist with
`_ctx.`. Read out of the installed package, `@vue/shared@3.5.40`:

```
GLOBALS_ALLOWED = "Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,
decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,
Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol"
```

```
isGloballyAllowed('Promise')    === false
isGloballyAllowed('setTimeout') === false
isGloballyAllowed('Date')       === true
isGloballyAllowed('JSON')       === true
```

So **a timed delay is unauthorable in the vue lane** for this emitter's shape:
both globals it needs are outside the allowlist. This is a **lane limit inside
Vue's own design envelope** — template expressions are deliberately scoped to the
render context — so per the owner's standing rule it is **recorded, not filed
upstream**, and not chased.

**What actually happens on the vue page**, from the drive: the **pre-`await`
writes land** (`sync = "saving"`, the optimistic `done` flips, the count moves),
the handler then throws at the boundary, and **nothing past it ever runs** — the
row stays in `saving` forever and the revert never fires. Add, destroy, filter and
**local** search all work. 4 of 7 axes.

**The route was KEPT, not deleted.** It is genuinely emitted, four axes run on it,
and removing it would delete a measured finding. It is labelled loudly in
`demos/vue-official/src/App.vue`, in `packages/frameworks/vue/scripts/regenerate.ts`
and in the fixture header.

### 0.3 Why this matters more than the count

Five separate gates said this module was fine in the vue lane: the emitter, the
dossier gate, `compileScript` in four modes, `tsc`, and `pnpm test`. **Only a
browser refuted it.** T002 listed exactly this as MISSING EVIDENCE — "whether a
promise created in a handler survives each lane's own output verification" — and
the answer is that surviving output verification is **not** evidence of running.

---

## 1. What shipped

**One authored source**, 13 measured constraints in its header, emitted by the
lanes' own `regenerate.ts` scripts. **No per-lane app code was hand-written** —
see §4.

Axes, all seven driven in a browser per lane:

| axis | shape | lanes it runs in |
|---|---|---|
| add (create) | form submit, trimmed | 5 emitted lanes |
| toggle / toggle-all / clear-completed | keyed map over `todos` | 5 |
| destroy | filter | 5 |
| edit by double-click | `event.detail === 2` | 5 |
| All/Active/Completed filter | `hidden` binding | 5 |
| **local search** | `computed` + the same `hidden` binding | 5 |
| **remote query, artificial delay** | `new Promise` + `setTimeout` in the handler | **4** |
| **optimistic write + revert**, per-row `pending` | same | **4** |

Both async axes are **user-initiated by nature**, so T002's narrowing from
"loads when it appears" to "when the user asks" cost nothing, and **no
initial-load button was built** — T002 ruled it out and that ruling held up.

---

## 2. Measurements taken on the real module, not inherited

### 2.1 Consuming the awaited value costs `pnpm check` +3 — MEASURED

`new Promise((settle) => …)` with no type argument infers `Promise<unknown>`. A
variant of this module whose search handler writes
`const delivered = await new Promise(…); remoteHits = delivered;` was emitted and
each lane's own `tsc -p` was run over it:

| lane | baseline | with the consuming variant | new diagnostic |
|---|---|---|---|
| react | 117 | 118 | `TS2345 Argument of type 'unknown' is not assignable to parameter of type 'SetStateAction<number>'` |
| solid | 80 | 81 | `TS2769 No overload matches this call` |
| qwik | 70 | 71 | `TS2322 Type 'unknown' is not assignable to type 'number'` |

**Three different codes, one per lane** — and +3 would take `pnpm check` from 267
to 270, which the board forbids. The **control** was run on the same instrument:
the shipped non-consuming shape leaves all three at **117 / 80 / 70**. So the
promise is a pure **latency**, and every post-`await` value comes from a `const`
captured before the boundary.

### 2.2 The optimistic axis trips DEFECTS.md 12.2's v-limit in react — BY CONSTRUCTION

12.2's repair folds a post-`await` write into `setTodos((current) => …)` only when
the cell's version "is read nowhere else" **and** the initializer reads the render
binding of the cell it writes. **An optimistic update writes the same cell on both
sides of the boundary**, so both conditions fail. Emitted react:

```jsx
const nextTodos = todos.map(… pending: true …);
setTodos(nextTodos);
await new Promise(…);
const nextTodos2 = nextTodos.map(…);   // ← the PRE-SUSPENSION const, not the cell
setTodos(nextTodos2);
```

The other three running lanes resume against the **live** cell —
`setTodos(reconcile(todos.map(…)))`, `todos.splice(0, todos.length, ...todos.map(…))`,
`todos = todos.map(…)`.

**Consequence, bounded honestly:** with ONE toggle in flight the lanes are
identical, because `nextTodos` is then exactly the current value. They diverge only
on **two overlapping in-flight toggles**, where react's second resume rebuilds from
a snapshot predating the first. **Emitted, not refused**; no gate or typecheck in
this repo sees it. Repairing it is an emitter change — out of this card's scope.
**Handed to the PM as a blocker.**

### 2.3 The Solid gate refuses P9's captured-list revert — a T001 gap

The probe's optimistic shape is `const previousRows = rows;` before the boundary
and `rows = ok ? … : previousRows` after it, and T001 recorded solid as **EMITTING**
it. That measurement ran `emit()` **only** — never the lane's own gate. On this
module the Solid gate's third-party arbiter refused it:

```
eslint:solid/reactivity — The reactive variable 'todos' should be used within JSX,
a tracked scope (like createEffect), or inside an event handler function, or else
changes will be ignored.        (generated/S11.tsx)
```

A bare `const previous = todos` reads the store proxy into an untracked local.
**Re-authored** so the revert *un-applies* rather than restores:
`done: rejected ? !wanted : wanted`. `!wanted` **is** the pre-optimistic value
(`wanted` came from the checkbox), so the outcome is identical for the touched row
and strictly better for every other row — un-applying cannot clobber a concurrent
edit the way restoring a whole captured list would.

### 2.4 The advanced bar is covered by upstream's toggle-all chevron — MEASURED IN A BROWSER

Upstream `index.css` gives `.toggle-all + label` `position: absolute; width: 45px;
height: 65px; top: -65px` — it deliberately reaches 65px **above** `.main`. In
canonical TodoMVC that is the header. TodoMVC Advanced puts the new control bar
there. Playwright, on the react lane:

```
<label for="toggle-all">Mark all as complete</label> from <main class="main">…</main>
subtree intercepts pointer events
```

`z-index: 2` was tried **first and measured to fail** — upstream already gives
`.main` `position: relative; z-index: 2`, so a tie loses on document order.
Measured geometry at that value: `.advanced` y 195–393 z 2, `.main` y 393–572 z 2,
the label y 329–394, and `document.elementFromPoint` at the checkbox's own centre
returned `LABEL for=toggle-all`. **`z-index: 3` is what clears it.**

---

## 3. The vue gate census — RE-DERIVED INDEPENDENTLY, and RE-ARGUED

`test/gate.test.ts` derives both censuses from the **emitted `.vue` templates** via
`@vue/compiler-sfc`. This card re-derived them from the **compiler goldens**, off
handler ASTs — a genuinely different route. **The two agree exactly.**

| figure | ten-scenario | eleven-scenario |
|---|---|---|
| 12a domain (value/checked bind + same-host event) | 12 | **18** |
| 12a sugar applies to | 3 | **7** |
| 12a outside the sugar, all calling `onTrace(` | 9 | **11 / 11** |
| 12b printed prop entries | 22 | **23** |
| 12b distinct prop names | 7 | **7 (unmoved)** |

**The verdict is unchanged and the denial is STRONGER, on two grounds.**

1. **Count.** 7 of 18 is 39% against the previous 25% — still a *recognized
   subset*, which is Gate 4's own FAIL criterion. A candidate sugar that more than
   doubles its correct cases while staying a minority of its domain has not moved
   toward totality; it has widened the surface on which the unchecked right-hand
   side would be wrong.
2. **Kind — and this is the part worth the re-argument.** Every applicable
   instance before S11 bound `value`, so the repair narrowing had only ever been
   exercised on **text inputs**. `S11 event:6` (the server-failure checkbox) is the
   corpus's **first v-model-shaped `checked` instance**. The G3 unsoundness is now
   reachable through `event.currentTarget.checked` as well as `.value`, and a
   matcher written against the `.value` shape alone would now be **wrong on a
   shipped handler**.

New applicable sites: `S11 event:2` (new-todo), `event:5` (search), `event:6`
(server-fails, **checked**), `event:10` (edit). New outside sites: `event:7`
(toggle-all), `event:12` (row toggle) — both call `onTrace(`, so the message's
stated *reason* survives too.

**12b is unchanged at ZERO and was a stronger test than the tenth scenario's.**
S11 is a second whole application, the largest module in the corpus, and the only
one whose defining mechanism is asynchronous, with 19 events of which two suspend
across an `await`. If any authoring were going to write back through a prop it
would be a handler resuming from a remote answer. None does: S11 declares one
printed entry (`onTrace`), `prop:props` is `writable=false` with **zero** writes.

---

## 4. Proof that no per-lane app code was hand-written

All 16 S11 artifacts were **deleted** and rebuilt from the scripts alone, then
compared by `shasum -a 256`:

- 5 × `packages/frameworks/*/generated/S11.*`
- 5 × `demos/*/…/emitted/TodoMvcAdvanced.*`
- 6 × `…/todomvc-app-css/frameless-advanced.css`

**16/16 byte-identical.** And each demo copy's digest **equals** its lane's
`generated/` digest:

| lane | generated | demo copy |
|---|---|---|
| react | `eb63f6df0368717b` | `eb63f6df0368717b` |
| solid | `6d16d228e842f3ab` | `6d16d228e842f3ab` |
| qwik | `6a714bd0666877cb` | `6a714bd0666877cb` |
| svelte | `bfae0ec84b42f926` | `bfae0ec84b42f926` |
| vue | `07153d8ed6ba6941` | `07153d8ed6ba6941` |

Stylesheet source `17c5154b951784ab`, all six copies equal.

> **A FIRST ATTEMPT AT THIS PROOF WAS VACUOUS AND IS RECORDED RATHER THAN
> QUIETLY REDONE.** It used `shasum $FILES` with an unquoted scalar; **zsh does
> not word-split**, so `shasum` received one giant filename, `rm` deleted nothing,
> and two *empty* digest files compared equal — reporting "16 artifacts
> BYTE-IDENTICAL" while measuring nothing. It was caught by reading the `0` in
> `artifacts before: 0`. Redone with a real array.

`git diff --exit-code` over `packages/frameworks/react/generated/S10.tsx`,
`packages/compiler/test/fixtures/s10-todomvc.tsrx`,
`demos/shared/todomvc-app-css/index.css` and `…/LICENSE` — **exit 0**. Upstream
bytes and S10 did not move. `git diff --stat` over all six `generated/`
directories is empty apart from the new `S11.*` files.

---

## 5. Launch commands — ACTUALLY RUN, and the ports actually used

`PORT` was set per lane because six servers ran side by side.

| lane | command actually run | URL |
|---|---|---|
| react | `PORT=5301 pnpm dev` in `demos/react-official` | `http://localhost:5301/todomvc-advanced` |
| solid | `PORT=5302 pnpm dev` in `demos/solid-official` | `…:5302/todomvc-advanced` |
| qwik | `pnpm copy-emitted && pnpm copy-todomvc-css && npx vite --port 5303 --strictPort` in `demos/qwik` | `…:5303/todomvc-advanced` |
| svelte | `pnpm copy-emitted && pnpm copy-todomvc-css && npx vite dev --port 5304 --strictPort` in `demos/svelte-official` | `…:5304/todomvc-advanced` |
| vue | `PORT=5305 pnpm dev` in `demos/vue-official` | `…:5305/todomvc-advanced` |
| angular | `pnpm copy-emitted && pnpm copy-todomvc-css && npx ng serve --port 5306` | `…:5306/todomvc` (advanced path **404**) |

**A FOREIGN PROCESS HELD PORT 5175** — `node`, **PID 64413**, which is the qwik
demo's own default port. It was **recorded and avoided**, never killed; qwik was
given 5303 instead. Every process this task started was stopped by **recorded
PID**. `lsof` at the end confirms 5301–5306 free and **PID 64413 still listening**.

### Per-lane observations

**react / solid / qwik / svelte — all seven axes, ZERO console errors, ZERO failed
requests.** Identical observation strings across the four. Abridged:

```
00 loaded:  visible=[Taste JavaScript, Buy a unicorn, Measure the async door]  count="2 items left"  local="3 rows match locally"  remote="idle"     sync="idle"
01 add:     +[Ship the eleventh scenario]                                      count="3 items left"  local="4 rows match locally"
02 toggle in flight:                                                           count="2 items left"                                                  sync="saving"     ← pending observed WHILE suspended
03 toggle settled:                                                             count="2 items left"                                                  sync="saved"
05 revert in flight:                                                           count="3 items left"                                                  sync="saving"
06 reverted:                                                                   count="2 items left"                                                  sync="reverted"   ← optimistic value restored
07 local search "unicorn":  visible=[Buy a unicorn]                            local="1 row matches locally"
08 remote in flight:                                                           remote="searching"  "0 remote matches for unicorn"
09 remote settled:                                                             remote="done"       "1 remote match for unicorn"
10 filter completed: visible=[Taste JavaScript, Buy a unicorn]
11 filter active:    visible=[Measure the async door, Ship the eleventh scenario]
13 destroy first:    visible=[Buy a unicorn, Measure the async door, Ship the eleventh scenario]
```

`pendingObservedInFlight: true` and `revertRestoredDone: true` in all four.

**vue** — status 200, the page renders and hydrates, add/destroy/filter/local
search all correct; **exactly three console errors, all `pageerror: _ctx.Promise
is not a constructor`** (one per async dispatch), zero failed requests. `sync`
sticks at `"saving"` from the first toggle onward and `revertRestoredDone: false`.

**angular** — the SITE RUNS: `/todomvc` returns **200** with 2 rows and
`"1 item left"`. `/todomvc-advanced` returns **404**, body `Cannot GET
/todomvc-advanced`, no `[data-advanced="bar"]` — there is no component to mount.

> **A console-error reading was corrected rather than reported.** Driving all six
> servers concurrently produced Vite HMR websocket errors in the solid and vue
> lanes, because the first Vite server claims port **24678** and the rest cannot.
> Those are **harness** artifacts, not app behaviour. Both lanes were re-driven
> **alone**: solid then reported **zero** console errors, and vue reported
> **only** the three `_ctx.Promise` page errors. Reporting the first reading would
> have blamed the app for the harness — and hand-waving it away would have hidden
> vue's real ones.

---

## 6. The inventory blast radius — closed, per T002 §5

The eleventh ordinal moved eleven surfaces. All closed on **this** card:

- `packages/compiler/test/enriched-ir.test.ts` — `FIXTURES`, `EXPECTED_HOSTS`,
  `ANNOTATED`, the scripted-callback map; golden written with `UPDATE_GOLDENS=1`
- 6 × `scripts/regenerate.ts` — five gain the row, **angular documents its omission**
- react + solid `test/size.test.ts` `EMITTED_BUDGETS`
- solid `test/emitted-typecheck.test.ts` — three accepted rows (finding 002)
- angular `test/emitter.test.ts`, `gate.test.ts`, `parse-emitted.test.ts`,
  `emitted-typecheck.test.ts` — all four subtract S11 through **one** new module
- vue `src/gate/index.ts` **and** `test/gate.test.ts` — re-derived and re-argued
- 5 × `demos/*/package.json` `copy-emitted`
- 5 route wirings + 6 tracked stylesheet copies

### The angular subtraction is ASSERTED, not declared

`packages/frameworks/angular/test/unbuilt-scenarios.ts` is the single declaration
the four suites import. A bare "scenarios we do not emit" list is indistinguishable
from a skip list, so `emitter.test.ts` gained two rows:

- **every** declared unbuilt scenario is driven through the real `emit()` and must
  **throw**, with the recorded message, and its artifact must be **absent**;
- a **CONTROL** — `s10-todomvc.json` through the same call — must **not** throw, so
  `toThrow` cannot be satisfied by a broken loader or a universally-failing emitter.

It goes red three ways: the day the ban lifts, the day the reason changes, and the
day a listed golden disappears.

### Solid's three new accepted diagnostics are finding 002 scaling, not new defects

S10 carried two (new-todo + edit inputs); S11 carries **three** — it adds the
**search** field. Finding 002's producer is any host with a bound `value`, so it
scales one-for-one with bound text inputs; S11 is the first scenario able to test
that at three. Two of the three are byte-identical because the search and new-todo
inputs print the same attribute set; they are separate hosts.

---

## 7. Styling — the PLANNED HANDOFF to T005

`demos/shared/todomvc-app-css/frameless-advanced.css` is a **third** stylesheet,
linked only on `/todomvc-advanced`, copied by the existing `copy-todomvc-css.mjs`.
`index.css` and `LICENSE` were **not touched** (proved by `git diff --exit-code`).
A third file makes the whole styling step reversible by deletion and leaves
`/todomvc`'s six byte-identical screenshots untouched.

Per T002 §3, every declaration is either **traceable to a named selector** in
vendored `index.css` — `.todoapp`, `.new-todo, .edit`, `.clear-completed`,
`.todo-count`, `.todo-count strong`, `.todo-list li.completed`,
`.todo-list li .destroy` — or listed as **this repo's own invention**:

1. **The `.advanced` bar.** Canonical TodoMVC has no search field, no local/remote
   distinction, no failure control and no sync status; there is no upstream
   "TodoMVC Advanced" stylesheet anywhere.
2. **The `saving` row state and `.row-pending`.** Canonical TodoMVC has no
   asynchrony at all. **Amber is a convention, not a measurement**, and is recorded
   as a stand-in rather than dressed up.
3. **`.server-fails` and its label** — a test affordance the real app would not
   have, styled subordinate for that reason.

**The pixel pass is T005's card.** This card's visual obligation was that the six
sites run and are driven, and it is met.

---

## 8. Baselines

| command | result |
|---|---|
| `pnpm test` | **exactly 1** failure — `package-inventory` ARM B, foreign; 1271 passed |
| `pnpm check` | **267** `error TS` lines — did **not** rise |
| `pnpm e2e` | **PASS**, `6 demos x 9 scenarios, all observations equal` |
| `pnpm lint` | 0 warnings, 0 errors, 467 files |
| `pnpm check:citations` | clean, 4 documents / 17 watched / 531 swept |

`scripts/e2e.mjs` was **not** touched; it still pins `['s1'..'s9']`, which is what
keeps e2e at 6 × 9 while S11 stays browsable-only.

**Owner's three paths, sha256, sorting the DIGESTS not the paths — identical at
start and finish:** `f326d314` / `aeb7edc1` / `f936e169`, `website/` 116 files.
Method: `shasum -a 256` for the two files; for `website/`,
`find website -type f -exec shasum -a 256 {} \; | sort | shasum -a 256`.

---

## 9. For the PM

1. **VUE IS NOT A SHIPPING LANE FOR THE ASYNC AXES**, and the board's "expect five"
   is now "four run, one emits-but-misbehaves, one refuses". This needs to reach
   `goal.md` and T004's card: **T004's streaming axis is four-lane, not five.**
2. **Neither refusal has a `docs/DEFECTS.md` entry.** Angular's global-identifier
   ban was already flagged by T002 as unfiled; **vue's template-expression global
   limit is new and also unfiled**. `docs/DEFECTS.md` is outside this card's
   envelope. Both belong on a filing card, as T006 filed entries 15 and 8.1.
3. **The react const-SSA divergence (§2.2) is a THIRD unfiled finding** — a
   post-`await` read of a cell written on *both* sides of the boundary. It sits
   just outside DEFECTS.md 12.2's recorded v-limit, which enumerates only reads of
   *another* cell. Emitted, not refused, and invisible to every check here.
4. **T001's "solid EMITS P9" was `emit()`-only.** Any future card inheriting a
   probe verdict should assume the lane's own gate was not run.
