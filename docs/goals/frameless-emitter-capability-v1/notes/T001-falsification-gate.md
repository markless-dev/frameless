# T001 — Step 0, the IR-8 falsification gate

**Verdict: IR-8 is NOT refuted. All six lanes went RED on a wrong-typed call site
against typed output, and all six correctly-typed twins went GREEN.**

The phase's premise survives. Step 1 may proceed on the merits of this gate.

Measured 2026-07-28 at `d6b37b6`. Probes at `probes/ir8-falsification/`,
re-runnable with `bash probes/ir8-falsification/run.sh`. Nothing under
`packages/`, `demos/` or `scripts/` was read or written by this task.

---

## 1. The matrix

Three arms per lane, not two. The brief asked for two; a third — **control** —
was added because two arms cannot establish *causation*.

| arm | child | call site | expectation |
|---|---|---|---|
| **control** | today's **untyped** emitted shape | wrong-typed | GREEN |
| **negative** | **IR-8 typed** shape | the *same* wrong-typed call site | **RED** |
| **positive** | **IR-8 typed** shape | correctly typed | GREEN |

`control` reproduces the five prior "instrument GREEN on an UNTYPED prop"
results *inside this same probe rig*. Without it, a RED in `negative` is
consistent with "the probe rig is stricter than the demos" — a confound that
would have made the whole gate uninterpretable. With it, the type annotation is
the **only** difference between a GREEN and a RED, in five of six lanes.

| lane | instrument | control (untyped) | **negative (typed, wrong)** | positive (typed, right) |
|---|---|---|---|---|
| react | `tsc` 5.9.3 | GREEN, exit 0 | **RED — `TS2322: Type 'string' is not assignable to type 'number'.`** @ `negative/Parent.tsx(6,32)` | GREEN, exit 0 |
| solid | `tsc` 5.9.3 | GREEN, exit 0 | **RED — `TS2322: Type 'string' is not assignable to type 'number'.`** @ `negative/Parent.tsx(5,32)` | GREEN, exit 0 |
| qwik | `tsc` 5.9.3 | **RED, different cause — see §2** | **RED — `TS2322: Type 'string' is not assignable to type 'number'.`** @ `negative/Parent.tsx(6,32)` | GREEN, exit 0 |
| vue | `vue-tsc` 3.3.8 / ts 6.0.3 | GREEN, exit 0 | **RED — `TS2322: Type 'string' is not assignable to type 'number'.`** @ `negative/Parent.vue(7,21)` | GREEN, exit 0 |
| svelte | `svelte-check` 4.7.3 | GREEN, 0 errors / 101 files | **RED — `code 2322`, `source "ts"`, `Type 'string' is not assignable to type 'number'.`** @ `negative/Parent.svelte:5:18` | GREEN, 0 errors |
| angular | `ng build` (`@angular/build:application`, AOT, `strictTemplates`) | GREEN, exit 0 | **RED — `TS2322: Type 'string' is not assignable to type 'number'. [plugin angular-compiler]`** @ `negative/Parent.ts:8:48` | GREEN, exit 0 |

Every lane's RED is **TS2322**, and in Angular's case it is raised by the AOT
template type-checker (`[plugin angular-compiler]`) against the
`[multiplier]="'3'"` binding span, not by plain `tsc` over the class.

**No lane's negative arm came back green. The `stop_if` did not fire.**

---

## 2. Qwik's control arm is RED, and it is not the same red

Every other lane's control is a clean GREEN. Qwik's is:

```
control/Parent.tsx(6,21): error TS2322: Type '{ label: string; multiplier: string; }'
  is not assignable to type 'IntrinsicAttributes & ComponentBaseProps & { children?: JSXChildren; }'.
  Property 'label' does not exist on type 'IntrinsicAttributes & ComponentBaseProps & { children?: JSXChildren; }'.
```

Today's emitted `component$((props) => …)` gives `tsc` no way to infer a prop
type, so it falls back to `ComponentBaseProps` and rejects **every** prop by
name. This is not the wrong-type signal — it is "this component accepts no
props at all".

The consequence is the useful part: **emitted Qwik output does not type-check
under `tsc` today, at any call site that passes a prop.** That is consistent
with `packages/frameworks/qwik/` having **no `emitted-typecheck.test.ts`** —
angular, react and solid have one, qwik and the rest do not — and with
`demos/qwik/` carrying no `typescript` dependency. IR-8 does not merely add
signal to the Qwik lane; it is what would make a typecheck lane *possible*
there. Recorded as an opportunity, not a defect, and not this task's to fix.

---

## 3. Step 2's blast radius is larger than the plan's table implies

The charter's table says Step 2 ("six emitters print types") carries **no IR
change** and, by implication, no other change. Measured, printing a type is not
a local edit in **five of six lanes**:

| lane | what else must move with the type | measured diagnostic if it does not |
|---|---|---|
| react, solid, qwik | the file extension: goldens are **`.jsx`** | `TS8010: Type annotations can only be used in TypeScript files.` @ `extension/Child.jsx(13,4)` |
| vue | `<script setup>` → `<script setup lang="ts">` | `TS1005: ',' expected.` + `TS1109: Expression expected.`; and `@vue/compiler-sfc` `compileScript` **throws**: `Unexpected token, expected "," (2:42)` |
| svelte | `<script>` → `<script lang="ts">` | svelte compiler `js_parse_error` "Complex binding patterns require an initialization value" + `TS8008: Type aliases can only be used in TypeScript files.` |
| angular | nothing — `@Input() x: any` → `@Input() x!: string` is a local edit | n/a |

Two consequences worth the PM's attention before Step 2 is scoped:

1. **`.jsx` → `.tsx` for three lanes.** The charter parks "a per-target
   extension map replacing `program.ts:164`" under **Step 5** (CLI targets).
   Measurement says three lanes cannot print a type at all until an extension
   decision is made, so that dependency runs **Step 2 → Step 5**, i.e. backwards
   from the plan's order. This is a sequencing finding, not a refutation.
2. **Vue's `lang="ts"` flip is gated by an exact-empty assertion.**
   `packages/frameworks/vue/test/compile-emitted.test.ts` runs
   `@vue/compiler-sfc` `compileScript` and requires errors *and tips* to be an
   exact empty set. `compileScript` **throws** on `defineProps<T>()` without
   `lang="ts"`, so the two edits are not merely coupled — splitting them
   hard-fails that test.

---

## 4. Angular: `strictTemplates` is load-bearing, and the repo's stated reason for it is wrong

Calibration arm — typed child, wrong-typed call site, `strictTemplates: false`:

```
Application bundle generation complete.   exit=0     # GREEN
```

So Angular's RED is attributable to `strictTemplates`, not to AOT alone. IR-8's
payoff in this lane is **conditional on that flag**.

`demos/angular-official/tsconfig.json` never spells `strictTemplates`. Its
`tsconfig.app.json` header comment explains why it is nonetheless on:

> Angular's `strictTemplates` — which keys off TypeScript's `strict`, not off
> `noImplicitAny`

**That mechanism is false.** Measured in the installed compiler,
`@angular/compiler-cli@22.0.8`, `bundles/chunk-NF6UJ6O7.js:4898`:

```js
get strictTemplates() {
  return this.options.strictTemplates !== false;
}
```

It is **opt-out and defaults to `true`**, independent of TypeScript's `strict`.
The comment reaches the right conclusion (the flag is on) by the wrong route.
Left as-is: `demos/` is outside this task's `allowed_files`, and a comment that
is right in outcome is a docs repair, not a gate finding. Flagged so the phase
does not later cite the mechanism.

---

## 5. Two prior claims this gate corrects

**5a. `demos/svelte-official/tsconfig.json` contradicts its own citation.**
Its header comment reads:

> the route-to-emitted-component prop contract is still checked — prop errors
> are reported at the consuming .svelte route … **Calibrated two-sided in the
> T004 note: a bogus prop and a wrong-typed prop each turn this check red.**

The cited source, `docs/goals/frameless-svelte-v1/notes/T004-svelte-demo.md:161-163`,
says the opposite for the wrong-typed case:

| unknown prop `bogusProp={1}` on `<RenderOnce>` | **RED** |
| required prop `onTrace` removed | **RED** |
| wrong-*typed* prop (`initial={noTrace}`) | **GREEN** — honest limitation |

This gate's svelte **control** arm independently reproduces the note's GREEN.
The tsconfig comment overstates its instrument on exactly the axis this phase
exists to close — a claim born wrong at the commit that wrote it. The note is
right; the comment is wrong. Not repaired here (`demos/` is out of scope).

**5b. The card's `pnpm test` baseline of 1083 is stale — see §6.**

---

## 6. Baseline: `pnpm test` is red at HEAD, and not because of this task

The card's verify line reads `pnpm test   # 1083 at prep; the gate must not
move it`. Measured **before** any probe file existed:

```
Test Files  1 failed | 51 passed (52)
     Tests  1 failed | 1082 passed (1083)
```

Total is still 1083. The failure is
`packages/compiler/test/package-inventory.test.ts` →
*"ARM B: every shared consumer resolves to its recorded peer-suffix key"*, and
it is caused by the **foreign, uncommitted `pnpm-lock.yaml` change** that adds
`website` to the workspace: `@markless/core`'s single recorded peer-suffix key
has split into two.

```
- "@markless/core@…(@typescript-eslint/types@8.65.0)(chokidar@5.0.0)(lru-cache@11.5.2)(rolldown@1.0.3)(rollup@4.62.2)(vite@…)"
+ "@markless/core@…(@typescript-eslint/types@8.65.0)(rolldown@1.0.3)(vite@…)"
+ "@markless/core@…(chokidar@5.0.0)(lru-cache@11.5.2)(rolldown@1.0.3)(rollup@4.62.2)(vite@…)"
```

That test reads `pnpm-lock.yaml` off disk by design, so a new workspace member
is exactly the event it exists to catch. **It is working correctly.** The
baseline for this task is therefore **1082 passed / 1 failed**, and the gate is
required to leave *that* unchanged — which it does, since no probe file is
inside any vitest project.

---

## 7. Probe construction, so the evidence can be audited

- Each lane directory holds a **symlinked `node_modules`** pointing at the
  package or official demo that owns its instrument (`packages/frameworks/react`,
  `…/solid`, `…/qwik`; `demos/vue-official`, `demos/svelte-official`,
  `demos/angular-official`). Nothing was installed — the sandbox has no network
  — and `probes/` is **not** a `pnpm-workspace.yaml` member, so no lockfile
  moved.
- Every child component is annotated in-file with the golden it mirrors and the
  exact delta from it. The only intended difference between `control` and
  `negative` is the type.
- `probes/ir8-falsification/svelte/svelte.config.js` is an **instrument fix, not
  a measurement**: without it `svelte-check` escapes the probe directory, finds
  the repo-root `vite.config.ts`, and reports *"No Svelte configuration found in
  vite config"* against every `.svelte` file. That noise appeared in the first
  svelte run and would have polluted the positive twin. Fixed rather than
  reported as a finding, per the card's third `stop_if`.
- React's negative arm was re-run at **`strict: false`** — the setting the
  repo's own `emitted-typecheck` lanes use — and still reports TS2322. The RED
  therefore does not depend on strictness, which matters because Step 2's
  oracle will run in those lanes.

## 8. What this gate did *not* establish

- It measured **hand-written** typed output. That the emitters can *produce*
  this shape is Step 2's question, and §3 says that is a bigger change than the
  plan's table implies.
- It used one prop type pair (`string` / `number`). Richer shapes — unions,
  object literals, function props such as `onTrace`, and Qwik's QRL-valued
  `onTrace$` — were not exercised. The `onTrace` prop is the one every scenario
  carries and the one most likely to be awkward to type from
  `@tsrx/core` annotations.
- It says nothing about whether `@tsrx/core` actually supplies these types.
  That is T002's question and it is untouched here.
