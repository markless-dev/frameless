# T014 — Step 2 across react, solid, qwik and svelte

Four lanes now print `PropDestructuringEntry.type` on emitted props, and the
Step 0 oracle reproduces against **emitted output** in all four. With Angular
(T004) and Vue (T016) that is **six of six lanes**, which is what
`intake.completion_proof` asks for.

Nothing here was inherited. Every number below was measured in this task.

---

## 1. The oracle — four lanes, four arms

The card asked for three arms. There are four, because the third was measured
insufficient in one lane and the fourth repairs it everywhere.

| arm | artifact | call site | expectation |
|---|---|---|---|
| `calibration` | **HEAD's** emitted `S1`, verbatim | wrong-typed | call site **NOT** diagnosed |
| `negative` | **T014's** emitted `S1`, verbatim | the **same** wrong-typed text | call site **RED**, `TS2322` |
| `discriminator` | T014's `S1` with `multiplier` retyped `string` | the **same** wrong-typed text | call site **NOT** diagnosed |
| `positive` | T014's emitted `S1`, verbatim | correctly-typed | call site **NOT** diagnosed |

`RenderOnce` in every arm is the **real emitted file**, copied byte-for-byte —
`git show HEAD:…` for calibration, the working tree for the rest. The parent text
is character-identical between `calibration`, `negative` and `discriminator`, so
the only variable is the artifact.

### The measured table

| lane | instrument | calibration | **negative (the RED)** | discriminator | positive |
|---|---|---|---|---|---|
| react | tsc 5.9.3, `strict` | no call-site diagnostic | **`TS2322` `negative/Parent.tsx(7,32)` "Type 'string' is not assignable to type 'number'." exit 2** | no call-site diagnostic | no call-site diagnostic |
| solid | tsc 5.9.3, `strict` | no call-site diagnostic | **`TS2322` `negative/Parent.tsx(7,32)` exit 2** | no call-site diagnostic | **exit 0, fully clean** |
| qwik | tsc 5.9.3, `strict` | **RED FOR A DIFFERENT CAUSE** — see §2 | **`TS2322` `negative/Parent.tsx(5,32)` exit 2** | no call-site diagnostic | **exit 0, fully clean** |
| svelte | svelte-check 4.7.3 | **0 errors, exit 0** | **`TS2322` `negative/Parent.svelte:5:24` "Type 'string' is not assignable to type 'number'." exit 1** | no call-site diagnostic | **0 errors, exit 0** |

Every lane reproduces Step 0's code (`TS2322`) and Step 0's message, against
emitted output rather than a hand-written probe.

### Why the discriminator arm exists

The calibration shows an **untyped** artifact does not catch the call site. It
does **not** show that *this type* is what catches it — an emitter that printed
any annotation at all would pass. The discriminator retypes `multiplier` as
`string` and leaves everything else alone: the call-site `TS2322` **disappears in
all four lanes**, which pins the RED to the specific authored type.

It also proves the printed type is load-bearing *inside* the component. The
discriminator raises `TS2363` "The right-hand side of an arithmetic operation
must be of type 'any', 'number', 'bigint' or an enum type" — react
`RenderOnce.tsx(22,38)`, solid `(13,46)`, qwik `(16,70)`, svelte
`RenderOnce.svelte:13:47` — because `S1` computes `count * multiplier`. The
annotation is not decoration in any of the four.

### Artifact-level diagnostics, disclosed rather than filtered

The oracle reads **call-site** diagnostics. Two artifact-level classes appear and
neither is attributable to this step:

- **react/solid/qwik calibration**: HEAD's untyped `.tsx` artifact is itself an
  implicit-any error under `strict` (react `TS7031` ×4, solid `TS7006` ×1, qwik
  `TS18046` ×5). That is the hole this step closes, showing up in the arm that
  exists to show it.
- **react, all four arms**: `RenderOnce.tsx TS2322 "Type 'true' is not assignable
  to type 'null'"` — the emitted `useRef(null)` narrowing. It is present in the
  **calibration** arm too, at HEAD, which is what proves it pre-existing. It is
  the react twin of the `ref(null)` defect T005 found in Vue. **IR-8 cannot close
  it**: it is a ref initializer, not a prop.

T001's Step 0 control was structurally different and **cannot be reproduced
today**: it put the untyped child in a `.jsx` file under `checkJs: false`, so the
untyped child was never checked at all. The emitted artifact has been `.tsx`
since T009/T011. The calibration above is *stricter* — same file extension, same
compiler settings, one variable.

---

## 2. Qwik's calibration is still not clean, and now the cause is measured

T999 flagged qwik's Step 0 control as "not a clean calibration". It still is not,
and this task measured **why**, which T001 did not:

`component$<PROPS>(onMount: OnRenderFn<PROPS>)` has **no inference source** when
the callback parameter is unannotated, so `PROPS` resolves to **`unknown`** — not
`any`. The call site then fails by NAME:

```
calibration/Parent.tsx(5,21): error TS2322: Type '{ label: string; multiplier: string; visible: boolean; onTrace$: () => void; }'
  is not assignable to type 'IntrinsicAttributes & ComponentBaseProps & { children?: JSXChildren; }'.
  Property 'label' does not exist on type 'IntrinsicAttributes & ComponentBaseProps & { children?: JSXChildren; }'.
```

**No compiler setting changes this, and both candidates were measured.**
`noImplicitAny: false` leaves it identical. `strict: false` leaves the call site
red and merely re-spells the interior errors from `TS18046` to `TS2339`
"Property 'onTrace$' does not exist on type 'unknown'". `unknown` is not governed
by either flag.

So: **a clean calibration arm is not producible for qwik**, and the reason is a
property of `component$`, not of the probe. The discriminator arm in §1 supplies
the causal control instead, and qwik's discriminator behaves exactly like the
other three lanes'. Qwik's row is real; its *calibration* remains structurally
unavailable, and that is now a measurement rather than an observation.

---

## 3. Three errors in the dispatch brief

### 3.1 The five `lang: 'jsx'` sites — the ordinals are wrong and the diagnosis is wrong

The brief named `react:148`, `:3896` and `solid:175`, `:3779`, `:3878` as five
unrepaired sites that "fire the moment you print a type".

**The ordinals were stale.** Measured at HEAD `773181e`: react
`src/emitter/index.ts` `:148` and `:3896`; solid `src/emitter/index.ts` `:175`,
**`:3843` and `:3942`** — not `:3779`/`:3878`. The brief also conflates files:
`react:148` matches `src/emitter/index.ts:148` **and**
`test/emitter.test.ts:148`. And the set was **incomplete for the third time** —
nobody enumerated `gate/custom-policies.ts` (react `:82`, `:90`; solid `:141`,
`:149`), or the eleven test-file sites, or `solid/test/solid2-blocker.test.ts`.
Full measured inventory, all flipped or ruled: **21 sites**.

### 3.2 Two of the five must NOT be flipped, and flipping them breaks the lane

`react/src/emitter/index.ts:148` and `solid:175` print **one handler expression**
into a throwaway declarator. A handler expression comes from IR expression nodes
and can never carry a type, so `jsx` is correct there — and the flip is **not
neutral**:

```
jsx  Identifier keys = ["type","start","end","name"]
tsx  Identifier keys = ["type","start","end","name","decorators","optional","typeAnnotation"]
```

`equivalent()` compares this re-analyzed AST against nodes the emitter **built**,
which carry the bare shape. Flipping the site makes every structural match fail:
`reconcileHandlerWrites` throws `EventHandlerRecord … has write record absent
from handler AST` on **seven of eight scenarios** in solid. Measured both ways.
The sites are left at `jsx` with the measurement recorded in-line.

Only the **whole-module output verifiers** had to move — react `:3896`, solid
`:3843`/`:3942` — plus the four gate parse sites and the test-side sites.

### 3.3 "40 of 73 are the implicit-any family that printing types deletes"

40 is the **class census**, not the deletable set. Printing types deletes an
implicit-any only where the **source is annotated**, and the corpus has exactly
**one** annotated fixture by charter. See §4.

### 3.4 Bonus: the board's own corrected regeneration count went stale again

`state.yaml:1539` records "PM CONFIRMED: 6 / 2 / 0". Counted at HEAD: **6 / 6 / 0**
— there are now six `regenerate-composition.ts` files, not two. The dispatch
brief's `6 / 6 / 0` is right and the board is wrong. Only react and solid expose
a `regenerate:composition` **package script**; the other four must be invoked as
`node scripts/regenerate-composition.ts`.

---

## 4. `pnpm check`: 73 → 69, and the ruling on the remainder

**No compiler option was reached for.**

### The `&&` is hiding half the standing regression

`pnpm check` is `tsc --noEmit && tsc -p react && tsc -p solid && …`. It
**short-circuits at react**, so the "73" every task on this board has reported is
**react only**. Measured per project at dispatch:

| project | baseline | after T014 |
|---|---|---|
| root | 0 | 0 |
| react | **73** | **69** |
| solid | **48 (never reached)** | **47** |
| svelte | 0 | 0 |
| vue | 0 | 0 |
| angular | 0 | 0 |
| **true total** | **121** | **116** |

`pnpm check` reports **69**. The true standing regression is **116**, and the
board has never recorded solid's 48. `package.json` is outside `allowed_files`,
so the `&&` is reported, not repaired.

### The delta is exactly attributable

`diff` of the full diagnostic list, baseline vs after — **nothing else moved**:

- react `−4`: `generated/S1.tsx(4,30|37|49|58) TS7031` on `label`, `multiplier`,
  `visible`, `onTrace`. Gone.
- solid `−1`: `generated/S1.tsx(4,28) TS7006` on `props`. Gone.
- react `S1.tsx TS2322 "Type 'true' is not assignable to type 'null'"` survives,
  relocated `(7,3) → (17,3)` because the file grew.

### The ruling: types alone cannot close the remainder, and the reason is measured

The remaining 116 fall into two groups.

**Group A — implicit-any in UNANNOTATED components (react `TS7031`×10,
`TS7006`×24, `TS7034`/`TS7005`; solid `TS7006`×19, `TS7005`×7, `TS7034`×3).**
Closable by IR-8 **in principle**, but only by annotating more corpus fixtures —
and that is **outside this card's `allowed_files`, measured not assumed**:

```
vue     emit(unannotated) === emit(annotated) ?  false
angular emit(unannotated) === emit(annotated) ?  false
```

The Vue and Angular emitters **consume** `type` and `optional` (T004, T016), so
annotating any additional fixture moves
`packages/frameworks/{vue,angular}/generated/`, neither of which this card may
touch. The corpus therefore stays at one annotated fixture, and **the control arm
survives whole: seven of eight scenarios unannotated in all six lanes**.

**Group B — narrowing and assignment (react `TS2339`×18, `TS18046`×7,
`TS2322`×6, `TS2571`×2; solid `TS2339`×16, `TS18046`×2). Not closable by IR-8 at
any corpus coverage.** IR-8 supplies **prop types only**. These are:

- `Property 'dataset' does not exist on type 'EventTarget'` — event-target
  narrowing. No IR channel; Angular's emitter refuses to invent `event: Event`
  for the identical reason.
- `Type 'true' is not assignable to type 'null'` — the `useRef(null)` /
  `createSignal(null)` initializer class. A **ref** fact, not a prop fact.
- `'x' is of type 'unknown'` — inference through untyped callback parameters.

Driving these to zero needs an IR field that does not exist, which is a slice of
its own. **They are ruled, not suppressed.**

---

## 5. What each lane prints

```tsx
// react — annotation on the ObjectPattern
export function RenderOnce({ label, multiplier, visible, onTrace }: {
	label: string; multiplier: number; visible: boolean;
	onTrace: (name: string, detail: Record<string, unknown>) => void;
}) {

// solid — on the single `props` parameter; destructuring would sever reactivity
export function RenderOnce(props: { label: string; … }) {

// qwik — on the component$ callback parameter, key RENAMED to the emitted name
export const RenderOnce = component$((props: { …; onTrace$: (name: string, …) => void }) => {
```

```svelte
<!-- svelte — on the $props() destructuring pattern -->
let { label, multiplier, visible, onTrace }: { … } = $props();
```

### Rulings taken at the decision sites

- **All-or-nothing.** The annotation is printed only when **every** binding in
  the pattern carries an authored type. A partial literal would need a type for
  props IR-8 says nothing about, and the only spellings are `any` — implicit-any
  re-introduced while pretending the author declared it — or a guess. Synthesized
  bindings (a forwarded `ref`, a shared-prop route) therefore **suppress** the
  annotation rather than being filtered out of it.
- **Qwik's `$` suffix is part of the type.** The lane renames a callback prop's
  last path segment to `<name>$`, so the literal declares `onTrace$`. The **type**
  is the authored one, unchanged — this emitter does not know a `QRL<T>` and will
  not invent one.
- **The converter is total and fail-closed** in all four lanes, re-measured here
  rather than inherited from Angular: yuku-codegen prints a mis-dialected
  `TSFunctionType` as `() => ;` and returns `errors: []`.
- **Fail-closed body coverage** (solid, qwik): every `props.<member>` the emitted
  body reads must be declared by the printed literal, or the emitter throws. React
  and Svelte destructure, so this is structurally impossible there.

---

## 6. The gates

Four gates were refusing valid output. All four refusals were the ones T004
measured, and all four are now measured green.

| lane | refusal | repair |
|---|---|---|
| react | `component-shape` (yuku-parser `jsx`) + `eslint:parse "Unexpected token :"` | `tsx` at 3 sites; `@typescript-eslint/parser` |
| solid | same two | `tsx` at 3 sites; `@typescript-eslint/parser` |
| qwik | `eslint:parse "Unexpected token :"` | `@typescript-eslint/parser` |
| svelte | `eslint:parse "Complex binding patterns require an initialization value"` | `parserOptions.parser` on `svelte-eslint-parser` |

No `parserOptions.project` anywhere. A parser is not a program, so every rule the
qwik and svelte gates already record as `*_REQUIRING_TYPES` stays silent for the
**same** recorded reason, and no gate silently gained or lost a rule.

### A `no-unused-vars` artifact, suppressed by position and calibrated

Adding the parser made `eslintJs.configs.recommended`'s core `no-unused-vars`
report the **parameter names inside a function type** — `'name' is defined but
never used` on `onTrace: (name: string, detail: …) => void`, in react, solid and
qwik. They are not bindings; they are documentation inside a type that TypeScript
has no grammar to omit. Angular never hit this because its gate does not include
`eslintJs.configs.recommended`.

Both obvious knobs were measured and **both weaken the rule**:

```
default              -> ["1:58 'name' …","1:72 'detail' …","2:9 'unusedReal' …","5:28 'deadArg' …"]
args: 'none'         -> ["2:9 'unusedReal' …"]          <- drops the REAL dead arg too
argsIgnorePattern    -> reports all four; no pattern can match every authored name
```

The correct instrument is `@typescript-eslint/no-unused-vars`, which lives in
`@typescript-eslint/eslint-plugin` — **verified not resolvable from any of the
five lanes**, so it is a new dependency and a lockfile move. Recorded, not taken.

Instead: `withoutTypeOnlyParameterReports` re-parses the same source with the
same parser, collects the **exact source positions** of every function-type
parameter name, and drops a `no-unused-vars` message only when its position
matches. Position-exact against the parser's own tree — not message text, not a
name shape — and a real unused binding cannot occupy a type-parameter position.
**The gate suites calibrate it**: a genuinely dead emitted argument still
reports, so this cannot quietly become an off switch.

---

## 7. Tests: two rows were pinning the hole

`react` and `solid` each carried
`admits the authored prop type and still emits byte-identically without printing it`,
asserting `emit(ir) === emit(stripped)`. **That is false by design after this
step** — Step 2 is the step that prints. A row that kept passing would have been
pinning the hole the phase exists to close.

Both were **rewritten, not extended** (T004's precedent), into
`CONSUMES the authored prop type, and prints NOTHING when it is absent`, which
measures three things instead of one: the annotated IR prints the authored type;
the stripped IR prints no annotation at all; and a **partially** stripped IR
prints the same as the fully stripped one, pinning all-or-nothing. An emitter
that synthesized types from corpus usage fails arm two; one that dropped IR-8
fails arm one.

`svelte`'s runes-surface row pinned the bare `$props()` text; it now pins the
**typed** form on S1 **and the bare form on S2**, so a corpus that annotated
everything, or nothing, fails instead of going quiet.

### Size budgets moved, and the consequence is recorded

S1 is the only row that moved, in the only annotated scenario:

| lane | physicalLoc | structuralNodes |
|---|---|---|
| react | 31 → **41** | 153 → **183** |
| solid | 29 → **34** | 144 → **174** |

**It flips react's headline comparison.** Emitted S1 was 31 lines against a
39-line handwritten reference and is now **41** — emitted output is larger than
the hand-written twin for the first time in this corpus. That is the honest price
of a typed prop surface the reference does not declare, and the budget comment
now says so rather than being trimmed to look tidy. The node delta is identical
in both lanes (+30, the same type literal); the line delta differs because Solid
annotates one parameter where React annotates a four-binding pattern.

---

## 8. Verification

| command | result |
|---|---|
| `pnpm test` | **1235 passed / 1 failed (1236)** — identical to dispatch; the 1 is `package-inventory` ARM B against the owner's dirty lockfile, foreign |
| `pnpm check` | **69** (was 73). Per project: react 69, solid 47, svelte/vue/angular/root 0 |
| `pnpm lint` | 0 warnings, 0 errors over 426 files |
| `pnpm check:citations` | clean — 4 documents, 17 watched, 508 swept |
| `pnpm e2e` | **PASS**, 6 demos × 8 scenarios, all observations equal. Did not move |
| four-lane oracle | §1 — 4 lanes × 4 arms |
| regeneration, all three tiers | **6 / 6 / 0**, non-vacuity proved first |
| `git diff` over `generated*/` | **exactly 4 files**: `S1` in react, solid, qwik, svelte |

### Regeneration was proved real before any diff was trusted

`// FRAMELESS_T014_JUNK` was appended to `generated/S2.*` in all six lanes,
`generated-composition/C2-shared.tsx` in react and solid, and
`generated-persistence/P1.tsx` in react and solid — **ten planted files across
all three tiers**. All six `regenerate`, both `regenerate:composition` scripts
plus qwik's and svelte's direct invocations, and `UPDATE_GOLDENS=1` for the
persistence tier removed every one. Only then was the diff read.

**The control arm did not move.** `git diff --exit-code` over the seven
unannotated scenarios is exit 0 in **all six lanes**, and tiers 2 and 3 moved
zero bytes.

### The three foreign paths

`pnpm-lock.yaml`, `pnpm-workspace.yaml` and `website/` were verified untouched at
start and at finish. Nothing was committed.

---

## 9. Carried forward

- **`pnpm check`'s `&&` hides solid's 47.** `package.json` is outside this card.
  The successor goal's "drive `pnpm check` to zero" is a **116**-error job, not 69.
- **`@typescript-eslint/eslint-plugin`** would replace the position filter in §6
  with the rule built for the job. New dependency; sandbox has no network.
- **The corpus stays at one annotated fixture**, bounded by vue's and angular's
  `generated/` being outside this card — not by choice. Closing Group A needs a
  card that owns all six lanes' generated output.
- **Qwik has no clean calibration** and structurally cannot have one (§2).
- **Group B** (`TS2339`, `TS18046`, `TS2322`, `TS2571`) needs IR channels for
  event targets and ref initializers that do not exist.
- **`react/generated/S1.tsx TS2322` on `useRef(null)`** is the react twin of the
  Vue `ref(null)` defect T005 found. Vue's was caught by a demo toolchain; react's
  has been sitting in `pnpm check` unattributed.
