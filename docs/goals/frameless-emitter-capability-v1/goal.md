# Frameless emitter capability phase

## Objective

Close the capability gap that keeps four of six emitters from expressing composition, refs and
effects — **in the order the evidence supports, starting with a step that can refute the whole
premise.**

## Provenance

Carved out of `frameless-defects-and-targets-v1` Phase F by **T024**, then scoped and sequenced by
**T032**. This is not new work invented here; it is the part of the corpus-breadth ruling that was
measured to be *emitter architecture rather than corpus work* and deliberately re-homed.

T024's finding, verified: the Qwik, Svelte, Vue and Angular emitters all **hard-throw** on
`component-reference`, `elementHandleBindings`, `behaviors` and multi-component modules. And the
claimed payoff of landing composition was **falsified** — `ComponentPropExpression` carries no type,
so composition over today's IR hands the type instruments a population and **no signal**.

## The step that can refute this phase

**Step 0 is a falsification gate, and it carries no IR change.**

IR-8 has been reached independently by five paths — Vue's `vue-tsc` at both `checkJs` settings,
Angular's real AOT `ng build` (six TS7006s), `svelte-check`, Solid, and the Vue `defineEmits`
re-run. **Every one of those measured an instrument GREEN on an UNTYPED prop. Not one measured an
instrument RED on a TYPED one.**

So the inference "add the type and the instruments will catch wrong-typed props" is **unmeasured**.
Step 0 measures it: hand-write typed output per lane with a wrong-typed call site, and require
`vue-tsc`, `svelte-check`, Angular `strictTemplates` + AOT and `tsc` to go **RED**, with a
correctly-typed twin green. **A green negative arm refutes IR-8 for that lane and stops the phase.**

## Ordered sequence

| Step | What | IR change |
|---|---|---|
| **0** | Falsification gate — typed output goes RED per lane | none |
| **1** | IR-8 supply: `PropDestructuringEntry.type`, `ComponentPropExpression.type` | **yes** |
| **2** | IR-8 consumption: six emitters print types | none |
| **3** | Refs | none |
| **4** | Effects / behaviors | none |
| **5** | Composition via `resolveModuleSet` | none |

**Step 1 is the only schema change, and it is the dangerous one:** all six framework packages carry
their own `exactKeys` `validateEnrichedIr`, and `module-set.ts` is a seventh copy — they must move
in the same slice or every lane hard-throws. `ENRICHED_IR_VERSION` needs an explicit ruling.
Emitters ignore the new field at Step 1, so no `generated/` byte moves.

**The supply already exists.** `@tsrx/core` preserves prop type annotations in the AST `build.ts`
already reads (`TSTypeLiteral` and `TSTypeReference` + sibling `TSInterfaceDeclaration`, both
measured parseable). **No vendored compiler change is required.**

## `emit()` → file map: REJECTED

The pressure for it is a **corpus-shape artifact**, not composition: the C1–C8 fixtures pack many
components per file, while `demos/composition-kit/src` is five one-component modules and
`resolveModuleSet` already models exactly that. **One component per `.tsrx` module is the Svelte/Vue
composition contract**, and the one-export guard stays — reclassified from an obstacle to the
format's honest constraint.

What moves instead: C1–C8 re-authored as module sets for the four blocked lanes; the CLI gains four
targets and a per-target extension map replacing `program.ts:164`; and `assertCompilesClean` must be
re-derived for sibling-SFC imports **with a calibration**, because it degrades to *fewer things
checked* rather than to a failure.

> A file map is justified only if multi-component modules are separately mandated — and then all six
> emitters change together, not two.

## IR-1b

Per-prop write-back has no channel: one `prop:props` graph node, `writable: false`, zero writes,
shared by every entry. That is an **extension of IR-1 with a letter, not a new number**, and it is
**not on this critical path** — it gates two-way sugar only.

## Stop rule

Stop when Steps 0–5 are complete, or **immediately** if Step 0's negative arm comes back green in
any lane — that refutes IR-8 for that lane and the sequence must be re-derived rather than pushed
through.

## Sequencing

Starts **after `frameless-defects-and-targets-v1` T028** closes Phase F. Step 1 is not provably
disjoint from T030, T031 or the queued corpus work; the umbrella board is at 40 tasks; and that
board's own intake pre-authorised splitting rather than pushing on.
