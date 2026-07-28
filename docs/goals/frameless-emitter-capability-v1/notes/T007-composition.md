# T007 — Step 5, composition across the four lanes that had none

Measured at `14a1e90` + this change. Every claim below is a run, not a reading. Where an instrument
could not be run in-package, the run is named and its location stated.

**THIS STEP DOES NOT CLOSE ITS OWN VERIFY LINE.** `pnpm e2e` still compares composition across TWO
lanes, and §6 names the measurement that says why. Read that section before reading anything else as
a completion claim.

## 1. What Step 5 opened, and the two lanes it could not open all the way

Before this step, `qwik`, `svelte`, `vue` and `angular` refused every composition construct behind
one combined `if`, and the emitters contained **zero** occurrences of `component-reference` against
six in react and four in solid.

| construct | qwik | svelte | vue | angular |
|---|---|---|---|---|
| `ModuleImport` of a `.tsrx` module | **emitted** | **emitted** | **emitted** | **emitted** |
| `component-reference`, cross-module | **emitted** | **emitted** | **emitted** | **emitted** |
| `component-reference`, `module: 'self'` | **emitted** | **REFUSED — lane limit** | **REFUSED — lane limit** | **emitted** |
| `default-slot-projection` | `<Slot />` | `{@render children?.()}` | `<slot />` | `<ng-content />` |
| `ComponentPropExpression` on the edge | `prop={expr}` | `prop={expr}` | `:prop="expr"` | `[prop]="expr"` |
| the `shared` family | refused **by name** | refused **by name** | refused **by name** | refused **by name** |
| `handleForwards` | refused **by name** | refused **by name** | refused **by name** | refused **by name** |

The four combined refusals are now split, so a reader of the message learns **which** construct
stopped. `"does not support composition or shared constructs"` is gone from all four lanes.

## 2. THE ONE-EXPORT GUARD IS INTACT, AND THE BRIEF'S LINE NUMBERS FOR IT ARE STALE

The guard was not touched, weakened or relocated in any lane. It is on `ir.module.exports`, not on
`ir.components`, so a module with several components and one export was **always** admissible — which
is exactly the shape C1-slot has, and exactly why `emit() → file map` is not needed for it.

**Measured, and the board's citation is wrong in four places out of six.** The card and the T999
card both say the guard lives at `solid:495`, `svelte:724`, `vue:1101`, `angular:1275`. Only solid is
right. At `14a1e90` the guards are at **`svelte:1258`**, **`vue:1911`** and **`angular:2134`**; lines
724, 1101 and 1275 are behavior and handle code T005 and T006 pushed the guard down past. React and
qwik having none is correct. An auditor following those ordinals would read unrelated code and could
certify a weakened guard as intact — the same first-party-ordinal failure mode `pnpm check:citations`
exists to prevent, in a document the guard does not watch.

### The rejected `emit() → file map` pressure, re-measured

The card justifies the rejection with *"the pressure is a corpus-shape artifact (C1–C8 pack many
components per file) and `resolveModuleSet` already models one component per module."*

**The second half is false.** `resolveModuleSet` has an explicit `target.module === 'self'` branch
that resolves a reference against the module's OWN `componentNames`, so many components per module is
a first-class modelled case, not an artifact. And the pressure is not corpus-shape either:
`demos/composition-kit/src/dashboard.tsrx` packs **three** components into one module, `status.tsrx`
and `search.tsrx` two each — three of the five modules in the e2e module set. So Svelte's and Vue's
inability to express it is a **real structural limit**, not a fixture accident.

**The guard still stays, and nothing here reopens it.** This is recorded because the card asks for
new evidence before reopening, and this is new evidence — for the PM, not for this Worker.

## 3. The per-lane idiom, and the one that changed a shipped decision

### Svelte — `{@render children?.()}`, and the optional call is a RUNTIME ruling

`{@render}` is the only construct that invokes a snippet and the implicit `children` prop is the only
place child content arrives, so this is a **singleton sanctioned set** and the six-gate procedure has
nothing to decide — the same shape T005 recorded for `bind:this`.

The **optional** call is the decision. `{@render children()}` **throws** when a parent passes no
children, while React's `{children}` and Solid's `{props.children}` render nothing, so the unguarded
form would make this lane diverge on exactly the case the other five treat as empty. MEASURED at
`svelte/compiler@5.56.8`: **both forms compile with an empty warning set in all four `client × server`
× `dev × prod` modes**, so no diagnostic distinguishes them and the ruling had to come from the
runtime semantics. Both arms are pinned in `test/composition.test.ts`, with a calibrated red beside
them.

**A second arm was found by running it.** `appendSibling` — the sibling-boundary printer — split a
childless `<Dashboard />` at its final `>`, producing `<Dashboard /` + newline + `>`, which
`svelte/compiler` rejects outright (`expected_token >`). A childless component reference is the first
form this printer emits that ends in a self-closing tag; no host form reaches it, because void
elements print `<input ...>` with no slash. The `/>` arm is now explicit.

### Vue — `<slot />`, and the first template-only SFC this repo has emitted

`<slot />` is the only Vue construct that renders default children. An unfilled one renders its
fallback, and this emitter prints none, so it renders **nothing** — React's and Solid's behaviour,
without the Svelte lane's guard problem.

**`children` is NOT declared in `defineProps`.** Vue delivers child content through the default slot,
so declaring it would announce an interface no caller can satisfy and leave the emitted `props`
binding unread. A name read **both** as a slot site and as a value has no Vue spelling at all and is
refused by name.

**That made a template-only SFC reachable for the first time, and it broke this lane's own checker.**
With no state, no events and no Vue-declared props, `Frame` has nothing to put in `<script setup>` —
and `@vue/compiler-sfc`'s `parse` **drops a block whose content is only whitespace**, so
`compileDiagnostics`' unconditional `descriptor.scriptSetup` check rejected the emitter's own correct
output. The check now fires only when a `<script>` block exists that is **not** `setup`, which is the
Options-API leak it was built for, and the calibration arm in `compile-emitted.test.ts` stays red.
This is the same class as T005's finding, from the other direction: there the checker was blind, here
it was over-firing.

### Qwik — `<Slot />`, and multi-component modules for free

`<Slot />` is Qwik's dedicated projection construct. `props.children` **exists** in Qwik v2 and is not
the same construct: projected content must survive **resumption** without the child serialising it,
which is what `Slot` models. This lane's whole doctrine is activation-neutrality, so that is a
constraint, not a preference. `test/composition.test.ts` re-asserts that no emitted composition module
carries a visible task under any spelling.

A `.tsx` file holds as many `component$` declarations as the module has components, so this lane
emits `C1-slot` — **the same fixture react and solid carry** — with only the exported component
exported. Specifiers are rewritten `.tsrx` → **`.jsx`**, byte-for-byte the substitution the react and
solid lanes already make.

### Angular — `<ng-content />`, `imports:`, and a decision `pnpm lint` overturned

`<ng-content />` is the only projection construct. `@Component` at 22.0.8 is standalone by default and
the emitted classes carry no `NgModule`, so `imports:` on the decorator is the whole resolution
mechanism; it is emitted **only** for classes the template actually referenced, because Angular's own
`NG8113 unused import` lives in AOT, outside this package. The specifier drops the extension rather
than rewriting to `.jsx`: this lane's artifact is a plain TypeScript module with no JSX in it.

**`pnpm lint` overturned a contract three prior-step tests asserted.** `Input` was imported
unconditionally, and `test/refs.test.ts` asserted that a component with **no props at all** still
imports it. Making it conditional broke those three tests, so it was reverted — and the revert took
`pnpm lint` from **0 warnings to 2**: `eslint(no-unused-vars): Identifier 'Input' is imported but
never used`, on `generated-composition/C1-slot.ts` and `M2-page.ts`. The old contract had **never been
exercised by a committed artifact** — all eight `generated/` scenarios declare at least one `@Input()`,
so the propless case existed only inside a test's source string, and Step 5 emits the first modules
that have none. The import is conditional and the three assertions were updated with the lint evidence
attached. **The emitter was not bent to keep three tests green.**

## 4. THE LANE LIMIT, AND IT IS THE FINDING OF THIS STEP

**A `.svelte` file and a `.vue` SFC each declare exactly one component.** A multi-component module is
refused **by name**, in `emit` and again at the template printer, so a self-reference cannot reach the
printer even if the front gate is later widened.

Both escape hatches were excluded on **membership**, not on preference:

- **Svelte — a snippet.** A snippet body is template-only: it cannot declare `$state`, cannot receive
  `$props()` and has no lifecycle. A component with its own state or an `attach=` behavior has no
  snippet spelling at all.
- **Vue — `defineComponent({ setup, render })`.** It abandons the `<template>` block entirely and puts
  the output on a render-function path **none of this lane's instruments cover**: `compileDiagnostics`,
  the SSR whitespace contract, and the `ref_key` machinery T005 chose the string ref for all assume the
  SFC template compiler.

This is not theoretical. It is what stops three of the five `demos/composition-kit` modules from
emitting in these two lanes — see §6.

## 5. The dead validators — repaired, and the split was 5-versus-1 with SOLID on the wrong side

`validateEnrichedIr` in the solid emitter early-returns into `validateCompositionIr` when
`hasComposition(ir)` holds, and `hasComposition` is true the moment `elementHandleBindings`,
`behaviors` **or** `handleCalls` is non-empty — while the strict path's `exactKeys` for those records
sits **after** that return. Each check could only run on IR containing none of the thing it checks.
T006 repaired `BehaviorRecord`; this step repaired the other two.

**MEASURED at `14a1e90`, on a real `element<T>()` + handle-call IR, through `validateEnrichedIr` AND
through `emit()`, before anything was written:**

| lane | `ElementHandleBinding.elementType` | `HandleCallRecord.awaited` | after this step |
|---|---|---|---|
| react | rejects | rejects | unchanged |
| **solid** | **ACCEPTED SILENTLY** | **ACCEPTED SILENTLY** | **rejects — repaired** |
| qwik | rejects | rejects | unchanged |
| svelte | rejects | rejects | unchanged |
| vue | rejects | rejects | unchanged |
| angular | rejects | rejects | unchanged |

**The board's standing "2-versus-4 split" is FIVE-versus-ONE at these records, and the one is solid** —
the lane the board treats as a strict reference. T005's matrix row recording solid as *"rejects
(`exactKeys`)"* at both was false; T006 predicted that and this step measured it. Pinned as a standing
row in `solid/test/emitter.test.ts`, which asserts the IR really takes the composition path so the
test cannot pass through the strict path that was never reachable.

### The composition records this step made reachable — and the split does NOT recur

Measured on `M1-panel` / `M2-page` IR, planting `slotted` on a `TemplateComponentReference`, `reactive`
on a `ComponentPropExpression` and `fallback` on a `TemplateDefaultSlotProjection`, through both entry
points:

| record | react | solid | qwik | svelte | vue | angular |
|---|---|---|---|---|---|---|
| `TemplateComponentReference` | rejects | rejects | **rejects** | **rejects** | **rejects** | **rejects** |
| `ComponentPropExpression` | rejects | rejects | **rejects** | **rejects** | **rejects** | **rejects** |
| `TemplateDefaultSlotProjection` | rejects | rejects | **rejects** | **rejects** | **rejects** | **rejects** |

**Six of six, at every record.** This is the first record class in this phase where the T003/T010 split
does not appear, and the reason is procedural rather than lucky: `validateCompositionNodes` was written
at the **same commit** as the lowering in all four lanes, with a lawful-IR green row beside each
rejection so none of them is green by accident.

## 6. WHY `pnpm e2e` STILL COMPARES COMPOSITION ACROSS TWO LANES

`pnpm e2e` passes and prints `composition-kit react=4, solid=4`. Six lanes is **not** reached, and the
binding reason is not plumbing.

**MEASURED, per module of the `demos/composition-kit` module set the e2e leg builds:**

| module | qwik | svelte | vue | angular |
|---|---|---|---|---|
| `frame.tsrx` | **emits** | **emits** | **emits** | **emits** |
| `page.tsrx` | **emits** | **emits** | **emits** | **emits** |
| `dashboard.tsrx` | `shared` | multi-component | multi-component | `shared` |
| `status.tsrx` | `shared` | multi-component | multi-component | `shared` |
| `search.tsrx` | `handleForwards` | multi-component | multi-component | `handleForwards` |

**Three of the five modules cannot be emitted by any of the four lanes**, and `page.tsrx` imports all
three. The missing constructs are the `shared()` family (`SharedDefinition`, `SharedInstance`,
`SharedRead`, `SharedCall`, `SharedWrite` — a per-lane context/provider lowering each) and
`handleForwards`. Neither is a plumbing gap; both are lowerings of the same size as this step's, and
this step did not do them.

**Three further blockers sit OUTSIDE this task's `allowed_files`, and are recorded so the next task is
not surprised by them:**

1. **The CLI has two targets.** `TARGET_INVENTORY` in `packages/cli/src/program.ts` lists `react` and
   `solid` only, and `scripts/e2e.mjs` builds the module set through `packages/cli/src/node.ts`.
   `packages/cli/**` is not in this task's `allowed_files`.
2. **The browser projects are registered in the root `vite.config.ts`**, which is not in
   `allowed_files`. (`scripts/e2e.mjs` *is*, so an explicit `--config` invocation is a possible route.)
3. **`demos/composition-kit` cannot resolve any of the four frameworks.** Measured from its own
   directory: `vue`, `svelte`, `@angular/core`, `@qwik.dev/core`, `@vitejs/plugin-vue` and
   `@sveltejs/vite-plugin-svelte` all fail to resolve.

**No per-lane exception was added to the equality check, and `scripts/e2e.mjs` was not modified.** The
`stop_if` naming that exception is intact.

## 7. What the corpus gained, and why it is not identical across six lanes

`generated-composition/` existed for **react and solid only**. It now exists for all six.

| lane | fixtures |
|---|---|
| react, solid | `C1`–`C8` **+ `M1-panel`, `M2-page`** |
| qwik, angular | `C1-slot`, `M1-panel`, `M2-page` |
| svelte, vue | `M1-panel`, `M2-page` |

**`M1-panel` / `M2-page` is the first composition fixture every one of the six lanes can emit.** It is
a genuine two-module set — one component per module, linked by a real `ModuleImport`, with a prop on
the reference edge and children projected across the boundary. C1–C8 all pack several components into
one module, so before this pair there was **no** composition fixture the six emitters could be compared
on at all.

The asymmetry is the §4 lane limit, recorded rather than papered over. Each lane's
`regenerate-composition.ts` carries a comment saying which fixture it does not have and why.

**A second source of truth was removed rather than retyped.** `react/test/gate.test.ts` and
`solid/test/gate.test.ts` each carried a hand-written `compositionNames` literal duplicating
`compositionFixtures`; the new fixtures made both fail loudly, which is the good outcome, and both now
derive from the regeneration script.

## 8. Instruments, per lane — and what is NOT covered

`pnpm e2e` type-checks nothing and renders no composition in these four lanes. **No claim below rests
on it.**

| lane | in-package instrument | verdict | out-of-band | verdict |
|---|---|---|---|---|
| svelte | `svelte/compiler@5.56.8` `compile()` × 4 modes, inside `emit` | clean, calibrated red (`a11y_click_events_have_key_events`) | — | — |
| vue | `compileDiagnostics` × 4 `ssr × isProd`, inside `emit`; **`vue/server-renderer` SSR of the emitted pair** | exact-empty; **projection proven on real bytes** | — | — |
| qwik | `yuku-analyzer` `lang: 'tsx'` output verification, inside `emit` | 0 diagnostics | — | — |
| angular | `parseTemplate` grammar, inside `emit` | clean, calibrated red | **`ngc` AOT, `strictTemplates`, `@angular/compiler-cli@22.0.8`** | **clean**, calibrated red **two ways** |

**The Angular out-of-band arm is the strongest evidence in this step**, because `imports:` resolution
and selector matching are decided by AOT and by nothing in this package. Run against the three emitted
composition modules with `strict: true` and `strictTemplates: true`, using `demos/angular-official`'s
own resolved install, from a scratch directory — **no repo file outside `allowed_files` was created or
modified.** Calibrated red two ways: deleting `imports: [Panel]` gives **NG8001** *'frameless-panel' is
not a known element*, and renaming the bound input gives **NG8002** *Can't bind to 'notALabel'*.

**The Vue behavioural arm found a served-payload difference, and it is stated rather than hidden.** Vue
server-renders projected slot content wrapped in **fragment anchor comments** — `<!--[-->` / `<!--]-->`
— which react, solid and angular do not emit at the same site. An unfilled slot renders the anchors
with nothing between them. The test asserts the **exact bytes** including the anchors. It does **not**
break the oracle: `pnpm e2e`'s three-way matrix compares observations — text, attributes, request
counts — and an HTML comment is invisible to all of them. It is named here so a future step that
compares payload bytes finds it already measured. Same family as the `<template v-if>` fragment
refusal this emitter already carries.

**Not covered, stated plainly rather than implied:**

- **No lane has a browser arm for composition except react and solid.** The Vue SSR arm is server-side;
  the Angular arm is compile-time. **No claim is made that a Svelte or Qwik composed module renders at
  runtime.** Closing that is §6's work.
- **Svelte has no type-level and no behavioural arm here.** `svelte-check` is coupled to
  `demos/svelte-official`'s separate install, and compiling a `.svelte` pair to runnable modules needs
  a bundler this package does not have.
- **`demos/vue-official` still does not type-check at HEAD** — 40 `vue-tsc` errors, all inside
  `src/emitted/`. This step adds **nothing** to it: no demo file was touched and `generated/` is
  byte-identical in all six lanes.
- The two-module set carries **one** prop, a string literal. A `graph-reference` or `callback` prop
  across a module boundary is emitted by the same code path but has **no fixture** in this corpus.

## 9. The control arm

`git diff --exit-code` over `packages/frameworks/*/generated{,-composition,-persistence}` after all
three regeneration tiers: **exit 0, zero pre-existing generated bytes moved.**

Regeneration was proved **real** before the diff was trusted, and each tier was observed restoring
**only** its own files:

1. junk appended to `generated/S1` in all six lanes → restored by the six `scripts/regenerate.ts`,
   with the tier-2 and tier-3 junk still present afterwards;
2. junk appended to `generated-composition/M2-page` in all six lanes → restored by the **six**
   `scripts/regenerate-composition.ts` (this step took that tier from **two** scripts to **six**);
3. junk appended to `generated-persistence/P1` in react and solid → restored by `UPDATE_GOLDENS=1`
   over their `test/emitter.test.ts`, which still has **no script at all**.

The tier count in the board's verify line is now **6 / 6 / 0**, not 6 / 2 / 0.

`pnpm check` held at **exactly 73** and its error list is **byte-identical by diff**, not by count.
The new `generated-composition/` trees do not reach it: no framework `tsconfig` includes a `generated*`
directory, and react's 73 arrive transitively through `test/composition-emitted-smoke.browser.test.ts`,
which imports C1–C8 and does not import `M1`/`M2`.
