# T002 — TodoMVC, authored once, emitted to six lanes

Worker receipt long-form. Everything below is MEASURED in this working tree at
`168f553`; nothing is inherited from the dispatch.

Source of truth: `packages/compiler/test/fixtures/s10-todomvc.tsrx` (one component,
one annotated prop, 251 lines including the constraint block).

---

## 1. The six-row launch table

Every command below was RUN, and every site was opened and DRIVEN in a real
Chromium through `playwright`, not merely fetched. All six produced **identical
observations and zero console errors**.

| lane | launch command | URL |
| --- | --- | --- |
| react | `pnpm --dir demos/react-official dev` | http://localhost:5173/todomvc |
| solid | `pnpm --dir demos/solid-official dev` | http://localhost:5173/todomvc |
| qwik | `pnpm --dir demos/qwik dev` | http://localhost:5175/todomvc |
| svelte | `pnpm --dir demos/svelte-official dev` | http://localhost:5174/todomvc |
| vue | `pnpm --dir demos/vue-official dev` | http://localhost:5173/todomvc |
| angular | `pnpm --dir demos/angular-official start` | http://localhost:4200/todomvc |

The verbs are NOT uniform and the ports are NOT uniform. React, solid and vue all
bind 5173 through their own `node server`, so they cannot run at the same time.

**ONE COLLISION, RECORDED RATHER THAN PAPERED OVER.** `pnpm --dir demos/qwik dev`
is `vite --port 5175 --strictPort`, and it FAILED on this machine with
`Error: Port 5175 is already in use`. The holder is PID 64413,
`node .../vite/bin/vite.js preview --port 5175 --strictPort`, elapsed
**3 days 8 hours** — it predates this session by days and is not mine to kill. The
qwik lane was therefore verified with the same vite on `--port 5176`, driven
identically and green. The documented command is unchanged and correct; the port
was simply occupied.

### What the driver exercised, per lane, identically

Served page → 2 seeded rows, `1 item left` → type `"  write the receipt  "` and
press **Enter** → 3 rows, input cleared, `2 items left` (**the title is trimmed**)
→ toggle `t2` → `1 item left` → filter **Active** shows only `t3` and the anchor
gains `class="selected"` → **Completed** shows `t1,t2` → **All** shows all three →
**double-click** the title → the row gains `class="editing"` and the edit input
appears → type and press **Enter** → the title commits → double-click again, type,
click **cancel** → the title is unchanged → **toggle-all** → `0 items left` →
**clear-completed** → 0 rows AND `main` and `footer` both vanish → add one back →
**destroy** → 0 rows.

That is the whole ruled-IN surface except Escape-revert, which is UNSPELLABLE —
see §3.

---

## 2. The derivation proof (the anti-hand-writing gate)

Asserted, not claimed. All twelve artifacts were **deleted**, then rebuilt by
`regenerate` + `copy-emitted`, and every one came back **byte-identical**:

```
1f00ceee…  demos/svelte-official/src/lib/emitted/TodoMvc.svelte
1f00ceee…  packages/frameworks/svelte/generated/S10.svelte
3d732f4a…  demos/vue-official/src/emitted/TodoMvc.vue
3d732f4a…  packages/frameworks/vue/generated/S10.vue
a1fa5452…  demos/angular-official/src/emitted/TodoMvc.ts
a1fa5452…  packages/frameworks/angular/generated/S10.ts
d9e03ee6…  demos/qwik/src/emitted/TodoMvc.tsx
d9e03ee6…  packages/frameworks/qwik/generated/S10.tsx
f563020b…  demos/solid-official/src/emitted/TodoMvc.tsx
f563020b…  packages/frameworks/solid/generated/S10.tsx
fbea844d…  demos/react-official/src/emitted/TodoMvc.tsx
fbea844d…  packages/frameworks/react/generated/S10.tsx
```

The digests pair up: each demo's copy equals its lane's generated file exactly.
**No per-lane app code was hand-written.** The only per-lane files authored by
hand are ROUTE WIRINGS — a `case`, a `<Match>`, a `v-else-if`, a route object, a
`+page.svelte`, an `index.tsx` — each of which does nothing but render the
emitted component with `onTrace`.

---

## 3. NINE MEASURED REFUSALS AND MISCOMPILES

Every one of these was hit while authoring, and every one changed the source. The
dispatch predicted one of them (the qwik event-casing hazard) and got its blast
radius wrong.

### 3.1 IR-8 has no lowering for an array type — react, svelte, angular

The obvious `{ seed }: { seed: Todo[] }` is refused in three lanes at once:

> React emitter has no IR-8 lowering for the type node TSArrayType in CapProbe props.seed
> Svelte emitter has no IR-8 lowering for the type node TSArrayType in CapProbe props.seed
> Angular emitter has no IR-8 lowering for the type node `TSArrayType` in @Input() seed of CapProbe

`typeNode()` in each emitter accepts exactly: `TSStringKeyword`, `TSNumberKeyword`,
`TSBooleanKeyword`, `TSVoidKeyword`, `TSUnknownKeyword`, a BARE `TSTypeReference`,
and a `TSFunctionType` whose parameters are annotated plain identifiers. A bare
`Todo` reference would name a type the emitted module cannot import.

**Consequence:** the app seeds itself. `onTrace` is its only prop. This is also
why all six lanes start from byte-identical data with no host wiring to keep in
step, which is strictly better for a six-lane comparison.

### 3.2 A branch arm renders ONE node — the compiler

> A code block renders a single node; wrap multiple nodes or text in a fragment '<>…</>'.

`main` and `footer` cannot share one `@if`. They are two `@if (todos.length > 0)`
blocks instead.

### 3.3 A branch needs BOTH arms — solid, qwik

> TemplateBranch branch-site:0 requires ordered then/else arms
> Qwik branch branch-site:0 requires explicit then and else arms

Every `@if` in the fixture carries an explicit empty `@else { }`.

### 3.4 Solid refuses a keyed repeat over a DERIVED collection

The natural TodoMVC filter — `@for (const todo of visible)` where `visible` is a
`computed` — is refused:

> Array state state:todos has unconsumed keyed identity semantics

Solid requires every array-valued STATE to be consumed by a keyed repeat that
names its key. A repeat over a computed leaves `state:todos` unconsumed.

### 3.5 …and a repeat ROW must be exactly one host element — react, qwik, vue

The obvious repair — wrap the `<li>` in the filter branch — is refused by three
more lanes:

> A keyed repeat row must have one host root in this fixture contract
> Qwik keyed repeat repeat:0 row root must be a host element
> Vue emitter requires a keyed repeat row to be exactly one host element (repeat:0): v-for and :key need an element to sit on

**Consequence:** the repeat stays over `todos`, every row keeps its key across a
filter change, and the filter drives a `hidden` binding on the row. `hidden` is
admitted by `DOM_BOOLEAN_CONTENT_ATTRIBUTES` and is deliberately NOT in
`LANE_PORTABLE_BOOLEAN_ATTRIBUTES`: S9 measured qwik serving `hidden="true"` where
five lanes serve `hidden=""`. That is a SERIALIZATION divergence, not a
behavioural one — the driver confirmed the same rows are visible in all six lanes
— and this module is not part of the byte-comparing three-way contract.

### 3.6 Svelte refuses TodoMVC's `<label>` title, and the `<span>` alternative

> Emitted Svelte module CapProbe.svelte did not compile warning-free: a11y_label_has_associated_control.
> Emitted Svelte module CapProbe.svelte did not compile warning-free: a11y_no_static_element_interactions.

The first is `<label>{todo.title}</label>`; the second is the `<span>` carrying the
same handler. The title is a `<button>`. The toggle-all `<label for="toggle-all">`
was measured SEPARATELY and is accepted, because `for` associates it with a
control.

### 3.7 Svelte refuses a `<form>` whose only event is `submit`

> Emitted Svelte module TodoMvc.svelte suppresses [a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions] but without those annotations Svelte reports []. A suppression that changes nothing is a silent over-fire.

`prefixIgnores` in the svelte emitter attaches that suppression to ANY `<form>`
carrying ANY event (`A11Y_EVENT_HOST_TAGS = new Set(['form'])`), and
`assertCompilesClean` is two-sided, so a form that provokes no warning is rejected
for suppressing nothing. The rule was calibrated against S3, whose form carries
`onClick`.

**Consequence:** both forms also carry an `onClick` that calls `onTrace('press', …)`.
That handler exists TO MAKE THE SUPPRESSION TRUTHFUL. It is stated plainly here
rather than dressed up as a feature.

### 3.8 THE BIG ONE — NO TWO-WORD DOM EVENT IS AUTHORABLE IN ANY LANE

Every emitter derives its event prop by capitalising only the FIRST letter of an
already-lowercased DOM event name, so `keydown` prints `onKeydown` and `dblclick`
prints `onDblclick`. React's react-dom, solid and qwik all reject that spelling.
No lane REFUSES it, which is what makes it dangerous: svelte, vue and angular want
the lowercase form, so it is correct there and SILENT everywhere else.

**Measured in a real DOM at react-dom 19.2.3** (jsdom + `createRoot` + `act`,
dispatching real `KeyboardEvent`/`MouseEvent`):

```
HANDLERS THAT FIRED: ["onKeyDown","onDoubleClick"]
REACT WARNINGS:      Invalid event handler property `%s`. Did you mean `%s`?
```

`onKeydown` and `onDblclick` NEVER FIRE. Note also that React's name for the
double-click is `onDoubleClick`, which NO capitalisation scheme over `dblclick`
could ever produce.

**Measured at the type level.** One `onKeyDown` binding took `pnpm check` from
**267 to 272** — five errors, in three of the six lanes:

```
react/generated/TodoMvc.tsx(134,12): error TS2322: Type '{ …; onKeydown: (event: any) => void; }' is not assignable to type 'DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>'.
react/generated/TodoMvc.tsx(134,24): error TS7006: Parameter 'event' implicitly has an 'any' type.
solid/generated/TodoMvc.tsx(214,13): error TS2322: Type '{ …; onKeydown: (event: any) => void; }' is not assignable to type 'InputHTMLAttributes<HTMLInputElement>'.
solid/generated/TodoMvc.tsx(214,25): error TS7006: Parameter 'event' implicitly has an 'any' type.
qwik/generated/TodoMvc.tsx(157,37): error TS2339: Property 'key' does not exist on type 'Event'.
```

That is a hard `stop_if` on this card, so the binding was removed.

**Consequences, all three:**

- **Enter-to-add** and **Enter-to-commit-an-edit** ride IMPLICIT FORM SUBMISSION.
  `submit` is one word, so all six lanes spell it correctly.
- **Double-click-to-edit** rides `event.detail === 2` on a `click` — the idiom S3
  already proves in this corpus.
- **ESCAPE-REVERT IS UNSPELLABLE.** `keydown` is its only possible spelling.
  The BEHAVIOUR survives as an explicit `<button class="cancel-edit">`; the KEY
  does not. This is the one item of the ruled-IN surface that no authoring choice
  could reach, and it is recorded as a lane limit rather than worked around.

This corrects the dispatch. T001 attributed the casing bug to qwik's
`eventAttributeName` alone and said "record it if it bites; do not fix the emitter
under this card". It is not qwik-specific, it is not cosmetic, and it bites hard
enough to be a `stop_if`.

### 3.9 React drops STATE WRITES NESTED INSIDE AN `if` — silent, react-only

The first draft put the add logic inside `if (event.key === 'Enter') { … }`. The
react emitter lowered only the TOP-LEVEL statements and printed the nested writes
as RAW ASSIGNMENTS against the `const` that destructures `useState`:

```jsx
const [todos, setTodos] = useState(…);
…
onKeydown={(event) => {
  const currentState5 = next.current;
  if (event.key === 'Enter') {
    …
    currentState5++;              // assignment to a const
    todos = todos.concat(item);   // assignment to a const — TypeError at runtime
    draft = '';                   // assignment to a const
```

Svelte, vue, angular, solid and qwik ALL lower nested writes correctly (verified
by reading each lane's output for the same source), so this is react-only and
silent. It has never been visible because no fixture in S1–S9 writes state inside
an `if` — S3's `if` bodies contain only `onTrace` and `preventDefault`.

**Consequence:** every conditional in the fixture is a conditional EXPRESSION on
the value, and every write is unconditional and top-level. Writing a cell back to
itself is the no-op arm, which React's `useState` bail-out understands because the
reference is unchanged.

---

## 4. THE BLOCKER — `generated/` is an exact-inventory-asserted directory

The dispatch's `allowed_files` cannot reach a green `pnpm test`, and this is
STRUCTURAL rather than incidental.

T001 recorded the risk as "each regenerate/copy-emitted chain carries a hardcoded
9-entry list and NONE HAS EVER GROWN". Those lists were the easy part and they are
inside `allowed_files`. **The real barrier is that ten-plus per-lane suites assert
the INVENTORY of `generated/` EXACTLY**, deriving it from the compiler goldens
that match `/^s(\d+)-[\w-]+\.json$/`.

Two routes were measured end to end.

### Route A — the card's literal names (`todomvc.json` → `generated/TodoMvc.*`)

A tenth artifact whose name is not an ordinal is rejected by construction. Ten
test files go red, ALL outside `allowed_files`:

```
packages/frameworks/react/test/gate.test.ts
packages/frameworks/solid/test/gate.test.ts
packages/frameworks/qwik/test/gate.test.ts
packages/frameworks/svelte/test/gate.test.ts
packages/frameworks/vue/test/gate.test.ts
packages/frameworks/angular/test/gate.test.ts
packages/frameworks/react/test/emitted-typecheck.test.ts
packages/frameworks/solid/test/emitted-typecheck.test.ts
packages/frameworks/svelte/test/compile-emitted.test.ts
packages/frameworks/vue/test/compile-emitted.test.ts
```

### Route B — the ordinal slot (`s10-todomvc.json` → `generated/S10.*`) — SHIPPED

Riding the ordinal makes every derived inventory adopt the app with NO edit, and
`scripts/e2e.mjs` still pins `threeWayScenarios` to the literal `['s1'..'s9']`, so
`pnpm e2e` stays at 6 × 9 exactly as required. This is what is in the tree.

**Residual: 9 real failures in 5 files, all outside `allowed_files`.** (`pnpm test`
is 1250 passed / 10 failed; the tenth is the FOREIGN pre-existing
`package-inventory` ARM B caused by the owner's uncommitted lockfile.)

| file | tests | what it needs |
| --- | --- | --- |
| `packages/frameworks/react/test/size.test.ts` | 2 | an `S10` row in `EMITTED_BUDGETS`; the key set is asserted EXACTLY against the derived corpus |
| `packages/frameworks/solid/test/size.test.ts` | 2 | the same |
| `packages/frameworks/solid/test/emitted-typecheck.test.ts` | 1 | two accepted `S10.tsx TS2322 … Property 'attr:value' does not exist` rows — the SAME pre-existing solid defect S2 already carries, on the two text inputs |
| `packages/frameworks/angular/test/emitter.test.ts` | 1 | `typedInputsSeen` 6 → 7; S10 is the third annotated module |
| `packages/frameworks/vue/test/gate.test.ts` | 3 | see below — the hard one |

**The vue one is not mechanical, and it reaches a POLICY SOURCE.**
`packages/frameworks/vue/src/gate/index.ts:1047` hardcodes a refusal message that
states a live census: *"re-enumerated over the nine-scenario corpus it holds EIGHT
shipped instances and the sugar applies to ONE, because the other seven handlers
do strictly more than the assignment"*. The test derives the same figures from the
corpus and asserts the message contains them. With a tenth scenario the census is
TWELVE and THREE, so the vue lane's own ruling text is stale and must be
RE-MEASURED and RE-ARGUED — including the clause about what the other handlers do.
A third vue test, `CALIBRATION: the derived domain figures go RED against a planted
tenth scenario`, plants its own tenth scenario and now collides with the real one.

That is a lane ruling, not a fixture list. It is not this card's to rewrite.

---

## 5. Verification status

| command | status | evidence |
| --- | --- | --- |
| `pnpm check` | **pass** | exactly **267**, unchanged; **S10 contributes ZERO** in all three checked lanes, which is what the full prop annotation bought |
| `pnpm e2e` | **pass** | `Three-way: 6 demos x 9 scenarios, all observations equal` |
| `pnpm lint` | **pass** | 0 warnings, 0 errors over 453 files |
| `pnpm check:citations` | **pass** | clean over 4 documents, 17 watched and 518 swept source files |
| six sites launched and driven | **pass** | §1 |
| derivation proof | **pass** | §2, twelve byte-identical artifacts |
| `pnpm test` | **BLOCKED** | 1250 passed / 10 failed. Baseline was 1248/1. 1 failure is the foreign lockfile ARM B; the other 9 need the 5 files in §4, all outside `allowed_files` |

Protected paths fingerprinted at start AND finish, unchanged:
`f326d314…` / `aeb7edc1…` / `f936e169…`, `website/` 116 files.

---

## 6. What a follow-up card should decide

1. **Grant the five files in §4**, and treat the vue gate census as its own unit —
   it needs a measurement and an argument, not an edit.
2. **The two-word event defect (§3.8) is the most valuable thing this card found**
   and it belongs to the emitters, not to an app. It is a SILENT behavioural break
   in react and a type error in react, solid and qwik. `onDoubleClick` proves a
   per-lane spelling MAP is required; capitalisation alone cannot be correct.
3. **The nested-write defect (§3.9)** is react-only, silent, and produces code that
   does not compile. Both belong in `docs/DEFECTS.md`.
4. **Wiring TodoMVC into `pnpm e2e`** would take the three-way contract from 6 × 9
   to 6 × 10 and is deliberately NOT done here — browsable first, per the board.
