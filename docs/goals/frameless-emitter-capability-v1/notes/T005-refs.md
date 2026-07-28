# T005 — Step 3, refs across the four lanes that did not have them

Measured at `c61136a` + this change. Every claim below is a run, not a reading. Where an
instrument could not be run in-package, the run is named and its location stated.

## What Step 3 opened, and what it deliberately did not

Before this step, `qwik`, `svelte`, `vue` and `angular` each carried **one combined `if`** that
threw `"<lane> emitter does not support composition or shared/handle constructs"` when **any** of
ten record families was non-empty. Refs were three of those ten:
`elementHandleBindings`, `handleForwards`, `handleCalls`.

That `if` is now split three ways per lane:

| family | after this step | owner |
|---|---|---|
| `elementHandleBindings` | **emitted** | Step 3 |
| `handleCalls` | **emitted** | Step 3 |
| `handleForwards` | refused **by its own name** | Step 5 (cross-module) |
| `behaviors` | refused **by its own name** | Step 4 (`attach=`) |
| composition / shared families | refused, message narrowed to `"composition or shared constructs"` | Step 5 |

`handleForwards` hands a **child's** node to a **parent** module; it cannot be lowered without the
composition path. `behaviors` is the authored `attach=` effect. Neither was widened, and both now
throw with a message naming the construct instead of a ten-way disjunction.

## The ref idiom per lane, measured before it was emitted

`element<T>()` from `@markless/core`, bound with `el={handle}` and called imperatively
(`input?.focus()`), lowers to:

| lane | declaration | template | call site |
|---|---|---|---|
| react (already shipped) | `useRef(null)` | `ref={input}` | `if (input.current !== null) { input.current.focus(); }` |
| solid (already shipped) | `let input;` | `ref={input}` | `input?.focus()` (verbatim) |
| **qwik** | `useSignal<HTMLElement>()` | `ref={input}` | `input.value?.focus()` |
| **svelte** | `let input;` | `bind:this={input}` | `input?.focus()` (verbatim) |
| **vue** | `ref()` | `ref="input"` | `input?.focus()` (verbatim) |
| **angular** | `@ViewChild('input') elementRefH1?: ElementRef;` + `get input()` | `#input` | `this.input?.focus()` |

**No lane had to be forced, and none was refused.** The `stop_if` "a lane has no ref idiom inside
its design envelope" did not fire for any of the four.

### Svelte — one sanctioned form, so no gate run

`bind:this` is the only Svelte 5 construct that puts a rendered node **in a variable**. `use:`
actions and `{@attach}` hand the node to a **function**, so neither is a member of the sanctioned
set *for this construct*. A singleton sanctioned set has no baseline-versus-candidate choice, so
the six-gate procedure has nothing to decide and was not run. Recorded so its absence is not read
as an omission.

### Vue — three sanctioned forms, decided on the compiler's own output

Measured at `vue`/`@vue/compiler-sfc` **3.5.40**, `vue-tsc` clean on all three:

| candidate | non-inline codegen | inline codegen | floor |
|---|---|---|---|
| **string ref** `ref="input"` + `const input = ref()` | `{ ref: "input" }`, resolved against `setupState` | **`ref_key: "input", ref: input`** | 3.0 |
| function ref `:ref="(el) => (input = el)"` | `ref: (el) => ($setup.input = el)` | (same shape) | 3.0 |
| `useTemplateRef('input')` | `{ ref: "input" }` — **identical to the string form** | `ref_key: "input"` — **identical** | **3.5** |

Two things decide it. `useTemplateRef` produces **byte-identical template codegen** to the string
form and floors at **3.5**, while every entry in this lane's `BASELINE_FORM_INVENTORY` floors at
3.0/3.2 — the lane's whole discharge of the idiom policy's version corollary is that it emits
nothing but baseline-version-safe forms, so a 3.5 form would raise the emitted module's floor for a
spelling that changes nothing. Between the remaining two, the string form is the one
`@vue/compiler-sfc` supplies **dedicated `<script setup>` machinery** for (`ref_key`); the function
form asks Vue to run an assignment it does not need to run.

### Qwik — two sanctioned forms, decided by obligation, then corrected by `tsc`

`Ref<EL extends Element = Element> = Signal<Element | undefined> | RefFnInterface<EL>`
(`@qwik.dev/core@2.0.0-beta.38`, `dist/core-internal.d.ts:2971`). The signal arm reuses `useSignal`,
which this emitter already imports and already respells through `.value`; the callback arm would
put a function on the prop for the optimizer to serialize. Signal arm chosen.

### Angular — the decorator family, not the signal query

`viewChild()` floors at **17.2**; `@ViewChild` at **2.0**, and the emitted class is already
all-decorator (`@Input()`). `@angular-eslint/prefer-signals` — the rule that would report the
choice — lives upstream in `all`, **not** in `recommended`, so this lane's *derived* applied set is
silent on it. That is worked example 11's measurement, re-used rather than re-derived, and it is
why this is a **baseline**, not a denied sugar.

Angular is also the one lane where **the handle is not the node**: no Angular query of any
generation returns the raw element, so an `ElementRef` has to be unwrapped. It is unwrapped in a
**getter** rather than by rewriting the handler, because `qualify()` earns its totality argument by
mapping every declared member name to `this.<name>` identically — and splicing `?.nativeElement`
into an optional chain would need synthesised `ChainExpression` wrappers, which `yuku-codegen` has
already been measured to print malformed while reporting `errors: []`.

## Three things the brief did not predict, found by running the instruments

### 1. Vue's own checker is blind to the class that broke it

The first lowering written for Vue was `const input = ref(null)`. `compileDiagnostics` — **this
lane's own oracle**, the one `assertCompilesClean` runs — reported an **exact-empty** set of errors
*and* tips across all four `ssr × isProd` modes. `demos/vue-official`'s own `vue-tsc` rejected the
same file outright:

```
src/Search.vue(10,52): error TS2339: Property 'focus' does not exist on type 'never'.
```

`ref(null)` infers `Ref<null>`. The emitted form is now `ref()`, which is clean under `vue-tsc`.
**This is the board's `pnpm e2e` warning one level in:** a green from a lane's own compiler is not
evidence its output type-checks, and here the two instruments disagreed on shipped-shaped output.

`ref()` and not `ref<HTMLElement | null>(null)`: the Qwik lane is **forced** into a fixed
`HTMLElement` bound because its bare form does not compile; Vue is not, and importing Qwik's guess
would make `input?.select()` red in Vue for no reason its toolchain asks for.

### 2. Qwik's bare `useSignal()` is a hard type error, and its output verifier could not parse the fix

`UseSignal` is `<T>(): Signal<T | undefined>` (`dist/core-internal.d.ts:4884`), so `useSignal()` is
`Signal<unknown>` — a **TS2322** at the `ref` prop and a **TS2339** at every `.value` read.
Assignability is not a strictness setting, so `strict: false` does not rescue it. The type argument
is load-bearing.

Printing it then hit a second, pre-existing hole: `emit()` verifies its own output with
`analyze(source, { lang: 'jsx' })`, and that language was **left at `jsx` when the artifact became
`.tsx`** at T009/T011. Measured at `yuku-analyzer@0.7.0` on `const input = useSignal<HTMLElement>()`
beside a JSX element:

| `lang` | result |
|---|---|
| `jsx` | `Empty parentheses are only valid as arrow function parameters` — it reads `<` as a comparison |
| `ts` | `Expected '>' to close a type assertion, but found 'ref'` |
| **`tsx`** | **0 diagnostics** |

The verifier is now `tsx`. The eight goldens are byte-identical across the change, which is what
makes it safe to land here: they carry no type, so `jsx` and `tsx` agree on every one of them.

**The same `lang: 'jsx'` sits on `.tsx` output in the react and solid emitters** (react `:148`,
`:3896`; solid `:175`, `:3779`, `:3878`). It is **not wrong there yet** — neither prints a type —
and it is **reported, not changed**: moving a verifier that the 73 standing `pnpm check` errors are
measured against is not this step's to do.

Related, measured in passing and worth a line: `yuku-codegen@0.7.0` prints a type argument correctly
under **`typeArguments`** and **silently drops it** under `typeParameters`, returning `errors: []`
either way. Same silent-drop family as the hazard `typeNode` was built against in the Angular lane.

### 3. The Svelte reactivity warning this step was going to rely on does not exist

The Svelte lowering was first written with a comment claiming that a plain `let` read from the
template would raise `non_reactive_update`, making `assertCompilesClean` two-sided over
`let` versus `$state()`. **Measured false** at `svelte/compiler@5.56.8`, four ways
(`client × server`, `dev × prod`) — every one of these is **clean**:

- `bind:this` into a plain `let`, with a template read
- `bind:this` into `let x = $state()`, with a template read
- a plain `let n = 0` reassigned in a handler and read in the template

So the reactivity difference between the two forms is **invisible to this lane's only instrument**.
The emitter therefore keeps the minimal `let` — the same declaration the Solid lane emits for the
same binding — and **refuses** a template expression that reads a handle name, rather than picking a
rune on a runtime property nothing in the package can check. Vue, Qwik and Angular need no such
refusal: their handles are reactive by construction.

## The per-lane validator matrix — the T003/T010 defect class at the two records this step made live

T010 closed the nested-field gap for `PropDestructuringEntry` and T016 confirmed all six lanes
reject a field planted there. **`ElementHandleBinding` and `HandleCallRecord` were never in that
survey**, because four lanes refused any IR carrying them — which is exactly the condition Step 3
removes. Measured on this step's own fixture, *before* `validateHandleRecords` existed:

| lane | unknown field on `ElementHandleBinding` | unknown field on `HandleCallRecord` | after this step |
|---|---|---|---|
| react | **rejects** (inline `keys` closure, **not** `exactKeys` — a grep misses it) | **rejects** | unchanged |
| solid | **rejects** (`exactKeys`) | **rejects** | unchanged |
| qwik | accepted **silently** | accepted **silently** | **rejects by name** |
| svelte | accepted **silently** | accepted **silently** | **rejects by name** |
| vue | accepted **silently** | accepted **silently** | **rejects by name** |
| angular | accepted **silently** | accepted **silently** | **rejects by name** |

The same 2-versus-4 split T002 measured one level up, at a different construct. Each of the four
lanes now carries `validateHandleRecords`, and each has a standing row in its own
`test/refs.test.ts` planting `elementType` on a binding and `awaited` on a call and requiring the
throw to **name the field**, plus a lawful-IR row so the rejections are not green by accident, plus
dangling-reference rows.

`handleForwards` and `behaviors` are deliberately **not** shape-checked in the four lanes: `emit`
still refuses them, so they stay unreachable, and a checker over an unreachable path asserts
nothing. Step 4 and Step 5 own them and own their validation.

## Type-level and behavioural arms, and what is NOT covered

The board's warning is honoured: **`pnpm e2e` type-checks nothing**, and no claim below rests on it.

| lane | in-package instrument | verdict | out-of-band instrument | verdict |
|---|---|---|---|---|
| qwik | **`tsc` program vs. resolved `@qwik.dev/core@2.0.0-beta.38`, `strict: true`** — new, standing, in `test/refs.test.ts` | **0 diagnostics**, calibrated red two ways (TS2322 + TS2339 on the bare form) | — | — |
| svelte | `svelte/compiler@5.56.8` `compile()` × 4 modes | **0 warnings**, calibrated red (`a11y_click_events_have_key_events`) | `demos/svelte-official`'s `svelte-check` | **0 errors / 0 warnings** at `strict: false`; 2 implicit-any at `strict: true` against **22 of the identical class** from the eight already-shipped components |
| vue | `compileDiagnostics` × 4 `ssr × isProd` modes | **exact-empty** errors *and* tips, calibrated red | `demos/vue-official`'s `vue-tsc` | **0 errors** (and it is what rejected `ref(null)`) |
| angular | `parseTemplate` grammar + the package's `tsc`-with-one-TS2307 rig | clean | `demos/angular-official`'s **`ngc` AOT, `strictTemplates: true`, `@angular/compiler-cli@22.0.8`** | **clean**, calibrated red two ways (TS2339 on an unknown template member; TS2322 on a wrong-typed field) |

**Not covered, stated plainly rather than implied:**

- **No lane has a behavioural (browser) arm for refs.** No corpus scenario carries an element
  handle, so `pnpm e2e` never renders one, and none of the `*.browser.test.ts` lanes see one either
  — they glob `generated/`, whose inventory is derived from the `s<n>-*.json` goldens. Every arm
  above is compile-time or type-time. **No claim is made that a ref binds at runtime in any of the
  four lanes.** Closing that needs a corpus scenario, which moves goldens, `generated/`, all six
  demos and `pnpm e2e` — a slice of its own.
- The Angular and Svelte out-of-band arms are **not standing checks**: they live in demo installs,
  not in the packages. They are recorded here so a re-run is reproducible, not asserted in CI.
- **The Qwik `HTMLElement` bound is a guess the IR does not license.** `ElementHandleBinding`
  carries `id`, `handleName`, `componentId`, `hostNodeId` and **no element type**; the authored
  `element<HTMLInputElement>()` type argument survives only on the local's initializer, which the
  emitter discards. Widening from a discarded AST is the move T002 struck from Step 1 for
  `ComponentPropExpression.type`. A handle call to a method **not on `HTMLElement`** (e.g.
  `input?.select()`) would be type-invalid in the Qwik lane. The corpus has no instance. The repair
  is an element type on the IR record, not a wider guess.

## The control arm

`git diff --exit-code` over `packages/frameworks/*/generated{,-composition,-persistence}` after
regenerating **all six lanes**: **exit 0, zero bytes moved**, eight scenarios × six lanes plus C1–C8
and P1.

The regeneration was proved real rather than assumed, per T003's discipline: junk was appended to
`S1` in all six lanes (`git diff --stat` reported 6 files, 12 insertions), the six `regenerate.ts`
scripts were re-run, and the tree returned to byte-identical. The seven unannotated scenarios plus
S1 are all unmoved, and each lane's standing "generated is fresh from the golden" test re-proves it
on every `pnpm test`.
