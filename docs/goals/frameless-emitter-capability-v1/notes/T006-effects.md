# T006 — Step 4, effects (`attach=`) across the lanes that did not have them

Measured at `48dd38d` + this change. Every claim below is a run, not a reading. Where an instrument
could not be run in-package, the run is named and its location stated.

## What Step 4 opened, and the one lane it deliberately did not

Before this step, `qwik`, `svelte`, `vue` and `angular` each refused `behaviors` by name — the
`attach=` construct T005 split out of the old ten-way disjunction and left for Step 4.

| lane | after this step |
|---|---|
| **svelte** | **emitted** — `{@attach}` |
| **vue** | **emitted** — `onMounted`/`onUnmounted` + `watch(..., { flush: 'post' })` over a template ref |
| **angular** | **emitted** — `@ViewChild` + `ngAfterViewInit`/`ngDoCheck`/`ngOnDestroy` |
| **qwik** | **REFUSED, and the refusal is a measurement** — see below |
| `handleForwards` | still refused by name in all four; Step 5's |

## The contract, and the obligation that is easy to miss

`attach=` obliges the emitter to four things, and the fourth is the one a lowering can meet by
accident in one framework and miss silently in another:

1. install with the node,
2. honour a returned cleanup,
3. re-run when a declared input changes, cleanup first,
4. **let the cleanup observe the input values current at its own install** — not the ones that
   replaced them.

Obligation 4 is what both shipped lanes already do. React gets it from closure identity (the
previous callback ref closed over the previous render's consts); Solid gets it by running the
cleanup **before** assigning `capture = captureNext`. Vue and Angular would have got the **opposite**
for free: `disposeX()` and `ngDoCheck` both run *after* the value has changed, so a cleanup body
respelled to `value.value` or `this.value` would read the **new** value.

**All three lanes therefore capture the inputs as PARAMETERS.** The authored function's own parameter
list gains one entry per distinct declared input, the current values are passed at install, and the
authored body is transplanted **byte-for-byte with no identifier renamed**. The parameter shadows the
component binding, and all three lanes' rewriters (`rewriteScript` in Vue, `qualify` in Angular) are
already scope-aware, so the appended parameter suppresses exactly the respelling that would otherwise
re-read through the live binding. The authored cleanup closes over the parameter, so obligation 4
holds **structurally in three lanes** rather than by three different framework accidents.

## Per-lane idiom, measured before it was emitted

### Svelte — `{@attach}`, and `use:` is OUTSIDE the sanctioned set

This is **forced lowering**, not a sugar ruling, and the showing is the burden the idiom policy's
preamble places on whoever invokes it. Two of the four kinds of evidence it names are present:

- **A dedicated construct the framework provides *because* that shape does not work.**
  `svelte/src/internal/client/dom/elements/actions.js` invokes the action inside `untrack(...)`.
  A bare `use:fn` therefore **never** re-runs when state read inside `fn` changes — obligation 3 is
  unreachable through it. `attachments.js` runs the attachment inside `effect(...)`, which tracks.
  Svelte ships `fromAction` to convert an action into an attachment, in that direction only.
- **A witnessed runtime failure.** The re-run *can* be reached through `use:fn={params}` plus a
  synthesized `{ update, destroy }` wrapper. That lowering was built and driven in a real DOM at
  5.56.8, and it **diverges on obligation 4**: `update()` is called from a `render_effect`, after
  the state is committed, so the authored cleanup observes the **post**-change value.

| form | mount | after change | after unmount |
|---|---|---|---|
| `{@attach}` | `i:a;` | `i:a;` **`c:a;`** `i:b;` | `… c:b;` |
| `use:` + synthesized `update` | `i:a;` | `i:a;` **`c:b;`** `i:b;` | `… c:b;` |

Both compile **clean** in all four `client × server` × `dev × prod` modes, so **no diagnostic
distinguishes them** and the ruling had to come from the runtime. Both arms are pinned in
`test/effects.test.ts`.

**Measured in passing, and recorded because the lowering deliberately does NOT depend on it:** Svelte
would have supplied obligation 4 for free. `get()` in `svelte/src/internal/client/runtime.js` serves a
signal read from `old_values` while `is_destroying_effect` is set, so a teardown inside `{@attach}`
reads the pre-update value. The parameter capture is kept anyway, because the same shape has to work
in Vue and Angular, which have no such rule.

**THE VERSION COST IS REAL AND IS STATED RATHER THAN BURIED.** `{@attach}` floors at **5.29**;
every other entry in this lane's `BASELINE_FORM_INVENTORY` floors at 5.0. So a module carrying an
`attach=` behavior floors at 5.29 instead of 5.0. That cost is accepted because `{@attach}` is the
**only** member of the sanctioned set for this construct — the idiom policy's version corollary
governs *sugar*, and forced lowering is not sugar. The inventory now carries the form with floor
`5.29` and a **verified** citation (`types/index.d.ts`, `@since 5.29`), which makes it **the first
verified floor in this lane** and is why `test/gate.test.ts`'s "every entry is unverified"
calibration had to be inverted rather than left to go vacuous.

### Vue — `onMounted`/`onUnmounted` + `watch(..., { flush: 'post' })`

Sanctioned set for this construct, at 3.5.40, with the two rejects excluded on **membership** rather
than on preference:

| candidate | verdict |
|---|---|
| `onMounted` + `onUnmounted` + `watch(sources, cb, { flush: 'post' })` over a template ref | **emitted**; every API floors at 3.0 |
| a custom directive object (`vAttach = { mounted, updated, unmounted }`) | outside: `updated` fires on **every component update**, not on a declared input change |
| a function ref `:ref="(el) => …"` | outside: re-invoked on **re-render**, so an unrelated re-render would tear the behavior down and reinstall it |

`flush: 'post'` is not decoration — the re-install reads the node out of the template ref, so it has
to run after Vue has patched the DOM for the same change. A host that already carries an element
handle **shares** the handle's template ref: two `ref=` attributes on one element is not a Vue form.
Every API floors at 3.0, so this lane's standing discharge of the version corollary is unchanged.

### Angular — `@ViewChild` + `ngAfterViewInit` / `ngDoCheck` / `ngOnDestroy`

Three of the four are not choices: `ngAfterViewInit` is the first hook at which an element query is
resolved, which is the same fact T005 recorded when it refused a handle call outside an event
handler. The **re-run** is the one place there was a choice, and `ngDoCheck` with an explicit
previous-value comparison wins by elimination:

- `ngOnChanges` sees only `@Input()` props. A behavior input is whatever graph node the author read,
  and the probe reads `state`, so it is not total over the domain — Gate 4 would kill it.
- `effect()` requires the inputs to be **signals**. This class is all-decorator and all-plain-field
  by worked example 11's measurement; adopting `effect()` would mean re-spelling every state field as
  a signal, which is a different ruling on a different construct.

`ngDoCheck` runs on every change-detection cycle, so the comparison is what keys the re-run to the
input rather than to the cycle — the same manual previous-value check Solid performs inside its
`createEffect`. The `installed` flag is **not** defensive padding: `ngDoCheck` runs **before**
`ngAfterViewInit` on the first cycle, when the element query is still unresolved.

### Qwik — NO IDIOM INSIDE ITS DESIGN ENVELOPE, and the refusal is the finding

`attach=` obliges the emitter to run application code against a **mounted DOM node**. Measured at
`@qwik.dev/core@2.0.0-beta.38`, the resolved build:

1. The `ref` prop — **both** arms of `Ref<EL> = Signal<Element | undefined> | RefFnInterface<EL>` —
   is applied by `applyRef`, whose only **two** call sites are `createNewElement` and
   `patchProperty`, both in the **client vnode diff**. `dist/server.mjs` contains **zero**
   occurrences of `applyRef`. So for markup this container server-rendered and **resumed** — the only
   mode this lane ships — a `ref` callback never runs.
2. `useTask$` runs before render and has no DOM on the server.
3. The construct that *does* run against a mounted node is the **visible-lifecycle family**, and this
   lane bans it in **two** places: `emit()` throws on `useVisibleTask$`/`onQVisible$`, and the gate
   policy `no-visible-task` additionally bans `q-e:qvisible` and `on:qvisible` over emitted source.
   That ban is the lane's activation-neutrality doctrine — *"it must do no client work merely because
   the element became visible"* (`frameless-qwik-v1` T001).

`useOnDocument('DOMContentLoaded', …)` would evade the marker regex and is **not** a loophole this
emitter walks through: it is the same eager client work under a spelling the ban does not name.

So the construct is refused **by name, with the reason in the message**, rather than lowered onto a
form the lane already forbids. The owner's standing rule is that a framework is not tested outside
its design envelope and that such output is not read as a defect. `test/effects.test.ts` **re-measures
the refusal's premise on every run** — `applyRef` present in `core.mjs`, absent from `server.mjs` —
so a future Qwik that makes `ref` reachable from the server renderer re-opens this by a **failing
test** rather than by an auditor happening to look.

This lane therefore gains **no** `validateBehaviorRecords`: `emit` still refuses the family, so a
checker over it would assert over a path that cannot be taken — T005's own reasoning for
`handleForwards`, applied to the record it left for this step.

## The per-lane validator matrix — AND THE BOARD'S SUMMARY OF IT WAS WRONG

The brief inherited from T005 says the recurring split is *"react and solid reject a planted field,
the other four accept silently"*. **At `BehaviorRecord` it was ONE versus FIVE.** Measured at
`48dd38d`, before anything in this step was written, on a real `attach=` IR:

| lane | unknown field on `BehaviorRecord` | unknown field on `BehaviorInput` | after this step |
|---|---|---|---|
| react | **rejects** (inline `keys` closure) | **rejects** | unchanged |
| **solid** | **ACCEPTED SILENTLY** | rejects | **rejects** — repaired |
| qwik | accepted silently | accepted silently | unchanged, **deliberately** (family still refused) |
| svelte | accepted silently | accepted silently | **rejects by name** |
| vue | accepted silently | accepted silently | **rejects by name** |
| angular | accepted silently | accepted silently | **rejects by name** |

**Solid's acceptance is not a missing line — it is a check that could only run when it had nothing to
check.** `packages/frameworks/solid/src/emitter/index.ts` *does* contain an `exactKeys` call naming
`BehaviorRecord`, in the strict path at the top of `validateEnrichedIr`. But `validateEnrichedIr`
**early-returns** into `validateCompositionIr` when `hasComposition(ir)` holds, and `hasComposition`
returns true the moment `elementHandleBindings`, `handleCalls` **or** `behaviors` is non-empty. So
the strict path's key checks for those three families are **unreachable for any IR that carries
one**. `validateCompositionIr` *does* check `BehaviorRecord GraphReadRef`, which is why a field
planted one level **down** was still caught — and that is precisely what made the hole look absent.
It was measured identically through `validateEnrichedIr` **and** through `emit()`.

Repaired for `BehaviorRecord`, which is this step's record. **Still open, reported rather than
widened:** `ElementHandleBinding` and `HandleCallRecord` carry the same dead check for the same
reason, so **T005's recorded matrix row for solid at those two records is wrong** — it reads
*"rejects (`exactKeys`)"* and measures as **accepted, silently**, today. Those are Step 3's records,
not Step 4's.

Same family as the hole T005 found in qwik's own output verifier: a checker that had stopped
following its artifact.

## Type-level and behavioural arms, and what is NOT covered

The board's warning is honoured: **`pnpm e2e` type-checks nothing**, and no claim below rests on it.
Confirmed again here — `demos/vue-official`'s `build` runs `vue-tsc -b`, and `pnpm e2e` runs `dev`.

| lane | in-package instrument | verdict | out-of-band instrument | verdict |
|---|---|---|---|---|
| svelte | `svelte/compiler@5.56.8` `compile()` × 4 modes | **0 warnings**, calibrated red (`a11y_click_events_have_key_events`) | `demos/svelte-official`'s `svelte-check`; **real mount / state change / unmount in jsdom** | 22 → **25** errors, delta **3, all TS7006 implicit-any** — the class that is 22 of the 22 pre-existing; **behaviour exact** |
| vue | `compileDiagnostics` × 4 `ssr × isProd` modes | **exact-empty** errors *and* tips, calibrated red | `demos/vue-official`'s `vue-tsc`; **real mount / state change / unmount in jsdom** | 40 → **45** errors, delta **5** (2 TS7006, 2 TS7005, 1 TS7034); **behaviour exact** |
| angular | `parseTemplate` grammar, calibrated red | clean | `demos/angular-official`'s **`ng build` AOT, `strictTemplates`, `@angular/compiler-cli@22.0.8`** | **clean**, calibrated red **two ways** (TS2339 on an unknown template member; TS2349/TS2322/TS2564 on a wrong-typed cleanup field) |
| qwik | — | — | `dist/core.mjs` / `dist/server.mjs` read as artifacts, asserted in-package | refusal premise holds |

**The behavioural arm, for the two lanes that have one.** The emitted module was compiled by the
framework's own compiler, mounted in a real DOM, driven through a state change and unmounted. Both
lanes produce the **identical** trace, and it is the React/Solid contract including obligation 4:

```
mount         -> i:a;
after change  -> i:a;  c:a;  i:b;      <-- the cleanup saw the INSTALL-TIME value
after unmount -> i:a;  c:a;  i:b;  c:b;
```

**Stated plainly rather than implied:**

- **`demos/vue-official` DOES NOT TYPE-CHECK AT HEAD, and nothing in this repo notices.** 40 errors
  before any change of this step, every one of them inside `src/emitted/`, and its own `build` script
  runs `vue-tsc -b`. `pnpm e2e` drives the dev server and never sees it. That is the board's
  instrument warning one level deeper than it was written, and it is the context for the delta above:
  this step adds to an existing red, it does not turn a green red.
- **The 5 Vue and 3 Svelte additions are implicit-`any` on transplanted parameters, and they are not
  repaired here.** Printing a type is Step 2's construct. TS7005/TS7034 (`let cleanup;`) are new to
  the Vue demo but are the same class as `nextTodos` in `react/generated/S2.tsx`, which is inside the
  73 standing `pnpm check` errors.
- **ANGULAR HAS NO BEHAVIOURAL ARM.** The AOT build type-checks the class and the template with
  `strictTemplates`, calibrated red two ways, but nothing drives `ngDoCheck` at runtime. A bootstrap
  harness needs a bundler entry this demo does not have, and standing one up is a slice of its own.
  **No claim is made that the Angular re-run fires at runtime.**
- **No corpus scenario carries an `attach=` behavior**, so `pnpm e2e` never renders one and the
  browser-test lanes never see one. Closing that needs a corpus scenario — which moves goldens, all
  six `generated/` trees, all six demos and `pnpm e2e`, and is a slice of its own.
- **A behavior input with a member path or a non-`direct` `via` is REFUSED by name in all three
  lanes.** A parameter can only shadow a **base** name, so a `value.a.b` read has no capture spelling
  here; and in Svelte, reading only the root of a `$state` proxy does not subscribe to `.a.b`, so the
  alternative is a silently under-reactive attachment. React and Solid carry the full path in their
  dependency channels; the corpus has no instance of one.

## `DEFECTS.md` 12.2 — no collision

Entry 12.2 (react post-await handler staleness) is OPEN and was **not** touched. Nothing in this step
is on the async axis: no lowering here awaits, and `BehaviorRecord` carries no async flag. The
`stop_if` did not fire, and there is no collision to record.

## The control arm

`git diff --exit-code` over `packages/frameworks/*/generated{,-composition,-persistence}` after
running **all three regeneration tiers**: **zero bytes moved**, eight scenarios × six lanes plus
C1–C8 and P1.

Regeneration was proved **real** before the diff was trusted: junk was appended to `S1` in all six
lanes, to `C4-attach.tsx` in react and solid, and to `P1.tsx` in react and solid (10 files, 10
insertions). The six `scripts/regenerate.ts` restored the first six; the two
`scripts/regenerate-composition.ts` restored the next two; `UPDATE_GOLDENS=1` over react and solid's
`test/emitter.test.ts` restored the last two. Each tier was observed restoring **only** its own files,
which is what makes "6 / 2 / 0" a measurement here rather than an inherited claim.

Note for Step 5: `generated-composition/` already contains **`C4-attach.tsx`** in react and solid, so
the composition corpus does exercise this construct — in two lanes.
