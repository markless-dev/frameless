# T032 — the emitter capability phase: scope, order, and where it lives

Judge, 2026-07-27. Read-only. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Stable read point: `2bf42b5` (`packages/frameworks/**`, `packages/compiler/**` and `demos/**`
are in motion under T030 and a live Vue re-audit).

## 0. Headline

Three of this ruling's four load-bearing inputs were **re-derived and two of them moved.**

1. **The card's "published emitter signature" premise is FALSE.** All six framework packages are
   `private: true`, `version: 0.0.0`, and the CLI's target inventory is **react and solid only**.
   Nothing about Svelte's or Vue's `emit()` is published anywhere.
2. **`emit()` → file map is REJECTED**, and the file-map framing is rejected as the wrong shape of
   the problem. The pressure comes from a *corpus-shape* choice (multi-component `.tsrx` modules),
   not from composition itself. `resolveModuleSet` already models composition as one component per
   module, and the CLI already writes one file per module.
3. **IR-8's supply side already exists in the AST `build.ts` already reads.** Measured: `@tsrx/core`
   `parseModule` parses and preserves TypeScript prop type annotations today, in both forms. No
   vendored `@markless/compiler` change is required. This is the T033 precedent exactly.
4. **IR-8 has never been shown to be *sufficient*.** Five paths measured the *absence* of a type and
   all five measured instruments **green on untyped props**. Nobody has measured whether those
   instruments go **red on a wrongly-typed prop when the type IS present**. That is the one
   configuration the whole phase's ordering rests on, and it is unrun. It becomes Step 0.

And the phase **belongs in its own goal**, not on this board.

## 1. Re-derivation of the dispatch's own claims

### 1a. The guard — REAL, and the brief's line numbers are STALE

All four blocked emitters carry the same eleven-clause composition guard. At `2bf42b5`:

| lane | `emit()` | composition throw | one-export throw |
| --- | --- | --- | --- |
| svelte | `:706` | `:723` | `:725` |
| vue | `:1049` | `:1066` | `:1068` |
| qwik | `:1353` | `:1372` | **none** |
| angular | `:1203` | `:1220` | `:1222` |

The dispatch (and the T024 receipt's `pm_independently_verified_both_load_bearing_claims`) cite
`vue:1053` and `angular:1132`. Those were true at `5edee60` and are **dead now**. The substance
holds; the citations do not. Qwik has **no** one-export clause — correctly excluded by the PM's own
note, but the dispatch's "identical guard in all four" flattens that.

React and Solid have no such guard: React computes a `composition` flag inline
(`react/src/emitter/index.ts:3395`), Solid branches `if (hasComposition(ir)) return emitComposition(ir)`
(`solid/src/emitter/index.ts:3723`). Both remain `emit(): string`.

### 1b. IR-8 — REAL

`ComponentPropExpression` (`schema.ts:149-155`) carries `name`, `kind`, `value`, `graphNodeId?`,
`path?` — no type. `PropDestructuringEntry` (`schema.ts:205`) carries `sourceName`, `localName`,
`path`, `alias`, `graphNodeId`, `defaultValue?` — no type. Shipped Angular output reads
`@Input() seed: any`. Confirmed.

### 1c. The child-side gap — REAL, and I rule on its numbering

Measured directly in `packages/compiler/test/goldens/s2-keyed-todo.json`: `records.bindings` contains
exactly one prop node, `id: "prop:props"`, `kind: "prop"`, `writable: false`, `reads: []`,
`writes: []`; and **both** entries in `components[0].props.entries` (`seed`, `onTrace`) carry
`graphNodeId: "prop:props"`. `docs/emitter-idiom-policy.md:1341` already states this over all six
base goldens.

**RULING: this is an extension of IR-1's written scope, recorded as IR-1b — not a new IR number.**

- IR-1 as written names only the parent side. `docs/goals/frameless-idiom-policy-v1/notes/T003-cross-framework-idioms.md:703`,
  and the identical rows in `frameless-svelte-v1/goal.md:41`, `frameless-angular-v1/goal.md:40` and
  `frameless-vue-v1/goal.md:34`, all define IR-1 as `ComponentPropExpression.kind` having no bindable
  member. The child-side absence is a *different missing structure* and is not implied by that text.
- It is **not** IR-8. A type field on an entry does not create a graph node. `T009-define-model.md:256`
  makes the same distinction and it is correct.
- It gets a **letter, not a number**, because `defineModel`, Angular `model()` and Svelte `$bindable`
  are each blocked by **both halves at once**, and neither half alone unblocks any of them. Two
  unrelated numbers would let a board close one and book progress against a sugar that is still
  dead. One item with two named halves cannot be half-closed.
- **Action owed:** rewrite IR-1's definition in all four places to state both halves. The current
  text is the reason five independent re-derivations were needed.
- **IR-1b is NOT on the capability critical path.** It gates two-way-binding sugar only. Refs,
  effects and composition do not touch it. It must not be folded into the sequence below.

### 1d. `emit()` returns a string — REAL, and in ALL SIX lanes

`export function emit(ir: EnrichedIR): string` in react, solid, qwik, svelte, vue and angular.
The dispatch frames this as a Svelte/Vue property. It is not; it is the shared shape of the
`FrameworkTargetModule` interface the CLI duck-types at `cli/src/node-runtime.ts:316`.

## 2. The measurement that changes the plan: IR-8's supply already exists

`build.ts:693` `propsEntries(component.fn.params?.[0], graph, environment)` receives the props
**parameter AST node** and already walks `parameter.properties`, reads `property.key`,
`property.value`, and serialises `AssignmentPattern.right` into `defaultValue` via `serializeAst`.

The type annotation sits on **the same node**, at `parameter.typeAnnotation`. Probed at `2bf42b5`
against the workspace's resolved `@tsrx/core`, `parseModule(source, filename, {collect, errors})`:

| authored form | parse errors | shape recovered |
| --- | --- | --- |
| `function P({ seed })` | none | no `typeAnnotation` |
| `function P({ seed, onTrace }: { seed: number; onTrace: (k: string) => void })` | none | `TSTypeAnnotation → TSTypeLiteral` with one `TSPropertySignature` **per prop**, each carrying its own `typeAnnotation` |
| `interface Props {...}` + `function P({ seed }: Props)` | none | `TSTypeAnnotation → TSTypeReference{typeName:"Props"}`, and `TSInterfaceDeclaration` present as a sibling top-level statement |

**Consequences.**

- The inline object-literal form yields a **direct per-entry type with zero inference**. That is IR-8's
  content, sitting in a node `build.ts` already holds.
- The named-interface form is resolvable **locally**, against a sibling statement in the same parsed
  program.
- **No change to the vendored `@markless/compiler` 0.1.1 is required.** This is precisely T033's
  precedent: derive locally what the graph leaves unset, and fail closed loudly.
- Every `.tsrx` fixture in the tree today is **unannotated** (`export function RenderOnce({ label,
  multiplier, visible, onTrace })`). So IR-8 is not only a schema change — it is also an **authoring
  surface decision**: annotations become the way a prop gets a type, and the corpus must be
  re-authored to carry them. That cost is real and is named here rather than discovered later.

## 3. The measurement that gates the plan: IR-8 has never been shown to work

Five paths reached IR-8 — Vue `vue-tsc` at both `checkJs` settings, Angular AOT `ng build` (six
TS7006, all lambda params in transplanted handler bodies), `svelte-check`, Solid, and the Vue
`defineEmits` re-run. **Every one of them measured the same configuration: instrument vs UNTYPED
output.** All green.

Nothing has measured **instrument vs TYPED output with a wrong prop planted.** The inference is
that the type is what is missing — but the Angular evidence is TS7006 on *lambda parameters*, which
only becomes a prop-type diagnostic if the inference chain `seed: Todo[] → todos → todo.done`
actually carries through the emitter's transplanted handler bodies. That chain is assumed, not
measured.

**Four of this project's six original defects were instrument faults.** An instrument that has only
ever been run in one configuration is not calibrated, and this board's own rule is that a fix is
preceded by a test that fails for the right reason. So:

> **Step 0 is a falsification probe, and it can kill the whole phase.** If a hand-written typed
> emitted component with a wrong-typed prop at its call site does **not** turn `vue-tsc`,
> `svelte-check`, Angular `strictTemplates` + AOT, and `tsc` red — with the correctly-typed twin
> green — then **IR-8 is not the fix**, and every step below it is misordered.

## 4. The ordered capability sequence

IR change named per step. Steps 0–2 are the IR-8 gate; 3–5 are the capability landings.

### Step 0 — FALSIFICATION GATE. Can the instruments fail at all?
**IR change: NONE.** Throwaway probe artifacts only.
Hand-write, per lane, the typed output an IR-8 emitter *would* print (`defineProps<{...}>()` +
`lang="ts"` for Vue; `<script lang="ts">` for Svelte; `@Input() seed: Todo[]` for Angular; a typed
props parameter for Solid/React/Qwik). Two arms per lane, both required:
- **negative arm:** a wrong-typed prop at the call site → the instrument MUST report a diagnostic;
- **positive arm:** the correctly-typed twin → the instrument MUST be clean.
A lane that reports on both arms, or on neither, is uncalibrated and its result is void.
**Outcome:** a per-lane table of *which instrument fires, on what, and how loudly*. This is the
first evidence that IR-8 buys signal rather than population. **A green negative arm in any lane is a
STOP-and-report, not a workaround.**

### Step 1 — IR-8 supply: carry the type into the IR. Emit nothing new.
**IR change: `PropDestructuringEntry.type` and `ComponentPropExpression.type`**, populated in
`build.ts` from `params[0].typeAnnotation` (both the `TSTypeLiteral` and the
`TSTypeReference` + sibling `TSInterfaceDeclaration` forms, per §2).
- **Absence must be declared, not defaulted.** An unannotated props parameter yields an explicit
  "no declared type" that an emitter can branch on — never a silent `any`. T033's fail-closed-loudly
  shape.
- **All six `validateEnrichedIr` implementations move in the same slice.** Each framework package
  carries its own `exactKeys` copy (`svelte:97-171` and its five twins) and each throws
  `unknown semantic field`. Landing a schema field without them makes **every lane hard-throw**.
  `packages/compiler/src/module-set.ts:41` has a seventh copy.
- **Rule explicitly on `ENRICHED_IR_VERSION`.** `frameless-enriched-ir/2` is asserted by name in
  emitter tests. An additive field behind seven exact-key validators is a compatibility decision;
  make it once, in writing.
- **Emitters ignore the new field in this step.** No `generated/**` byte moves, so Phase F's 48-cell
  mutation budget is untouched. This is what makes the step reversible.

### Step 2 — IR-8 consumption: print the type. Standing checks, not probes.
**IR change: NONE** (Step 1's field is consumed).
Six emitters print prop types; Step 0's probes become permanent gate rows. This is where the Vue
lane's deferred `lang="ts"` ruling is discharged — `vue/src/emitter/index.ts` says in its own
`emit()` doc comment *"There is no `lang="ts"`. See `propsDeclaration` for the ruling (IR-8)"* — and
where Angular's `@Input() seed: any` stops being `any`.
**Gate on Step 3+:** if the instruments do not go red here, on emitted rather than hand-written
output, the capability landings below buy nothing and must be re-argued.

### Step 3 — REFS (`elementHandleBindings`, `handleForwards`) in the four blocked lanes.
**IR change: NONE.** Cheapest of the three, and it has a reference implementation:
`packages/frameworks/{react,solid}/generated-composition/C3-ref.jsx` from
`test/composition-fixtures/C3-ref.tsrx`, plus `demos/composition-kit` calibrated against handwritten
references in a browser. Composition guard clauses removed one at a time, not wholesale.
**Corpus caveat:** `C3-ref.tsrx` is a two-component module — see §5. The Svelte/Vue instances must be
re-authored as module sets.

### Step 4 — EFFECTS / BEHAVIOURS (`behaviors`, `handleCalls`) in the four blocked lanes.
**IR change: NONE.** Reference: `C4-attach.tsrx` (a single-component module, so it ports as-is) and
`composition-attach-input.tsrx`. Teardown ordering here is the same axis Phase F's S5 measures, so
S5's harness is the oracle beneath it — a reason this step must come after Phase F, not beside it.

### Step 5 — COMPOSITION (`component-reference`, `default-slot-projection`, cross-module imports).
**IR change: NONE to the schema.** `resolveModuleSet` (`module-set.ts:316`) already resolves
cross-module component references and is already wired through `cli/src/node-runtime.ts:83`.
**The API change composition needs is in the CLI, not in `emit()`** — see §5.

### NOT in this sequence — IR-1b (per-prop write-back)
Gates `defineModel` / `model()` / `$bindable` only. Independent of Steps 0–5. Scope it separately or
leave it recorded as an open IR item; do not let it lengthen the capability critical path.

## 5. RULING — `emit()` → file map is REJECTED

### What was measured

1. **Nothing is published.** `packages/frameworks/{react,solid,qwik,svelte,vue,angular}/package.json`
   are all `version: 0.0.0`, `private: true`, `exports: {".": "./src/index.ts"}`. The card's premise
   *"it changes a published emitter signature"* is **false as stated**. This is a repo-internal
   contract with a countable caller set, not an external API.
2. **The CLI does not target Svelte or Vue at all.** `cli/src/program.ts:6-9` `TARGET_INVENTORY` is
   exactly `react` and `solid`; the usage text says *"Build react or solid"*; and
   `emittedFilenameFor` at `program.ts:164` hardcodes `.tsrx → .jsx`. Svelte, Vue, Angular and Qwik
   are unreachable through the CLI and it could not name their output files if they were reachable.
3. **Where `emit(): string` IS load-bearing is the CLI's output mapping, not the emitter.**
   `node-runtime.ts` takes `emittedFilename` from the **build-plan input**, computes
   `outputPath = join(outputDirectory, module.emittedFilename)`, hashes one content per module into
   the receipt, gates via `checkSources([{file, source, artifact}])`, and stages per target. The
   README's collision rule — *"inputs that share a basename are rejected"* — is a direct consequence
   of one-module-in / one-file-out.
4. **Composition does not require multi-component modules.** `composition-import.tsrx` is
   `import { Child } from "./child.tsrx"`, and `demos/composition-kit/src/` is five separate modules
   (`frame`, `page`, `dashboard`, `search`, `status`) linked by `.tsrx` imports. That is the shape
   `resolveModuleSet` exists to serve.
5. **The file-map pressure is a corpus-shape artifact.** The React/Solid capability corpus packs many
   components per file — C1: 2, C2: 4, C3: 2, C5: 2, C6: 5, C7: 3 — which is legal in JSX and
   impossible in an SFC. The blocking clause is `ir.components.length !== 1`, and that is a property
   of **how C1–C8 were authored**, not of composition.
6. **Svelte and Vue `emit()` already compute their own filename and self-compile.**
   `assertCompilesClean(source, \`${component.name}.svelte\`, context.suppressed)` at
   `svelte/src/emitter/index.ts:766`, and `assertCompilesClean(source, \`${component.name}.vue\`)` at
   `vue/src/emitter/index.ts:1104`. Per the Svelte README, `emit()` compiles its output warning-free
   in `client` and `server` at `dev: true`, **and** re-compiles with `svelte-ignore` stripped to prove
   the suppressions fire. A file map is exactly what breaks this: a sibling-importing SFC no longer
   compiles in isolation.

### The ruling

**`emit(): string` stays. One component per `.tsrx` module is the composition contract for the
Svelte and Vue lanes, and the guard line `A .svelte module exports exactly one component` STAYS** —
reclassified from *a limitation to be removed* to *the target format's honest constraint, enforced*.
Composition is expressed through `resolveModuleSet` + cross-module imports.

Only the composition guard's **other** clauses relax: `imports.length`, `elementHandleBindings`,
`behaviors`, `handleCalls`, and the `component-reference` / `default-slot-projection` template kinds.
The `ir.components.length !== 1` and `ir.module.exports.length !== 1` clauses **stay in svelte, vue
and angular** and are the reason the string return survives.

### What breaks, and what must move with it

- **The C1–C8 capability corpus must be re-authored as module sets for the four blocked lanes.**
  C1/C2/C3/C5/C6/C7 are multi-component modules Svelte and Vue can never express. React and Solid
  keep theirs unchanged; the blocked lanes get a parallel one-component-per-module corpus. **This is
  the real cost of this ruling and it is stated, not hidden.**
- **The CLI gains the four missing targets and a per-target extension map**, replacing the hardcoded
  `.jsx` at `program.ts:164`, with the basename-collision rule re-derived per target. This — not
  `emit()` — is the actual API change composition needs, and it is additive.
- **`assertCompilesClean` must be re-derived for a module that imports a sibling SFC.** Either a stub
  resolver or an explicitly narrowed self-check. This is the single most likely silent regression in
  the whole phase: it degrades to *fewer things checked*, not to a failure. **It must ship with a
  calibration proving the narrowed check still fires on a planted defect**, on the pattern the Svelte
  lane already uses for its two-sided suppression check.

### When a file map WOULD be justified

Only if a separate, explicit decision is taken that one `.tsrx` module may declare several components
**and** Svelte/Vue must support that. That decision has not been taken and must not be taken inside a
capability-landing task. If it ever is: widen **all six** emitters to the same
`Record<filename, string>` — never Svelte and Vue alone, because the CLI loads targets by duck-typing
a single `FrameworkTargetModule` shape (`node-runtime.ts:316`) and a per-lane signature defeats it —
and move the CLI's `emittedFilename` mapping, receipt `modules` list, per-module hashing, staging
window, and `checkSources` contract with it.

## 6. RULING — this belongs in its OWN GOAL

**Yes. A new top-level goal, not a task on this board and not a `subgoals/` child.**

1. **Scope collision, measured.** Step 1 alone touches `packages/compiler/src/{schema.ts,build.ts}`,
   seven goldens, `module-set.ts`, and **all six** `packages/frameworks/*/src/emitter/index.ts`
   validators. This board currently has T030 **active** inside `packages/frameworks/**`, T031 queued,
   and T025/T026/T027/T034/T035 blocked on the same tree. Not provably disjoint from any of them.
   Separate cards on one board are not proof of disjointness — T024 already ruled that here.
2. **The constraint "do not let it block T028" is only structurally satisfiable off-board.** T028
   carries `depends_on: ["T031"]`. A capability card sitting on this board is a standing invitation
   for the Phase F audit to absorb it. A separate board makes that impossible.
3. **This board is at 40 tasks**, with eight blocked/queued Workers plus T999. The intake's own
   `blind_spots_considered` says: *"OWNER OVERRODE the prep recommendation of two separate goals...
   If the board starts sprawling, the PM should propose splitting rather than pushing on."* T024
   named the single-umbrella tranche as this board's main risk. **This is the split the charter
   pre-authorised**, and declining it now would be the misfire the charter predicted.
4. **It is not in either oracle half.** Oracle half 3 is corpus breadth, ratified at eight scenarios.
   Capability work cannot be certified by this goal's `final_proof` and would sit at T999 as an
   un-mappable remainder — which is the one thing T999 is instructed to reject completion over.

**Proposed:** `docs/goals/frameless-emitter-capability-v1`, **started after T028 closes Phase F**,
not beside it. Phase F's six-scenario / 36-red mutation oracle is the bed this phase lands on; the
S5 teardown harness is Step 4's oracle. Starting earlier costs the oracle and buys nothing.

## 7. First Worker package for the NEW board (not dispatchable here)

Recorded so the new board does not start from zero. **It must NOT be dispatched on this board:** its
scope is disjointness-unsafe against T030/T031 and it is out of Phase F's stopping rule.

- **objective:** Measure whether typed emitted output actually turns each lane's type instrument RED
  on a wrong-typed prop. Hand-write, per lane, the typed component an IR-8 emitter would print, plus
  a wrong-typed call site (negative arm) and a correctly-typed twin (positive arm). Both arms are
  required per lane; a lane reporting on both or neither is uncalibrated and void. Record per lane:
  instrument, exact diagnostic text, and whether it fired. Change no emitter, no schema, no golden.
- **allowed_files:** probe-only scratch fixtures under each lane's `test/` plus
  `docs/goals/frameless-emitter-capability-v1/notes/T001-ir8-falsification.md`. Exact list is the new
  board's to fix once its own tree is clean — **not curated from memory here.**
- **verify:** the four instruments run directly and one at a time — `vue-tsc`, `svelte-check`,
  Angular `ng build` with `strictTemplates`, and `tsc` for Solid/React/Qwik. **Not** `pnpm e2e`,
  `pnpm test:browser` or `pnpm mutate:corpus`.
- **stop_if:** (a) **any lane's negative arm stays GREEN** — that refutes IR-8 as the fix for that
  lane; record it verbatim and STOP, do not proceed to Step 1. (b) any lane's positive arm goes red —
  the probe is miswritten, not the instrument. (c) any emitter, schema or golden file is modified.
  (d) a lane is reported without both arms run.

## 8. Corrections owed to the record

1. **T032's card text is wrong** where it says `emit()` becoming a file map *"changes a published
   emitter signature."* All six framework packages are `private: true` / `0.0.0`. Correct it so the
   claim is not inherited a sixth time.
2. **Stale line citations** in the T024 receipt's `pm_independently_verified_both_load_bearing_claims`:
   at `2bf42b5` the throws are `vue:1066` (not 1053) and `angular:1220` (not 1132), and Qwik has no
   one-export clause. Prefer symbol names over line numbers in future citations — three of this
   session's re-checks were forced by line drift alone.
3. **IR-1's written definition** must be amended in all four places (§1c) to name both halves.
