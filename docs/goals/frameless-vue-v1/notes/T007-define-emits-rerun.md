# T007 — Worked example 3 (`defineEmits`) re-run

**Board:** `docs/goals/frameless-vue-v1` · **Task:** T007 (judge) · **Date:** 2026-07-27
**Ruling: DENIED STANDS.** Deciding gate: **Gate 5 — but not for the reason the entry gives.**
Three of six labels move, and two of them move *against* the sugar.

| Gate | Before | After | Moved? |
|---|---|---|---|
| G1 | `DEFERRED — framework absent` | **PASS** | yes, measured |
| G2 | PASS | PASS | no |
| G3 | PASS | PASS (conditional, see below) | no |
| G4 | `DEFERRED — emitter absent` | **FAIL** | yes, measured |
| G5 | FAIL | **FAIL — on measured grounds, the written mechanism refuted** | label same, basis replaced |
| G6 | `DEFERRED` | **FAIL** | yes |

Three deferrals became one PASS and two FAILs. The entry had one `FAIL`; it now has three
independent ones. The re-run **strengthened** the denial, which is the outcome the card predicted
in direction if not in size.

---

## The headline: the entry's stated Gate 5 mechanism is FALSE for the frameless baseline

The entry reads, verbatim:

> declaring a native event name in `emits` means the listener responds only to component-emitted
> events and no longer to native ones, and declared events are removed from fallthrough `$attrs`.
> A frameless component with a callback prop named `onClick` would stop receiving native clicks.

That describes the delta between an **undeclared** prop and a declared emit. **Frameless declares
the prop.** `propsDeclaration()` (`packages/frameworks/vue/src/emitter/index.ts:400`) prints every
`PropDestructuringEntry` into `defineProps([...])`, and all three shipped goldens carry
`onTrace` in that array. A **declared prop is removed from `$attrs` exactly as a declared emit is**,
so the fallthrough difference the entry rests on **does not exist between the two forms frameless
would actually choose between**.

Measured three-sided in a real DOM (jsdom 28.1.0) against `vue@3.5.40`, child root `<button>`,
parent passes `onClick`, then a native bubbling `MouseEvent('click')` is dispatched at the root:

| arm | child declares | `$attrs` keys | native click reached the parent handler |
|---|---|---|---|
| A — baseline-faithful | `props: ['onClick']` | `[]` | **false** |
| B — candidate | `emits: ['click']` | `[]` | **false** |
| C — **calibration, known member** | neither | `['onClick']` | **true** |

Arm C is the instrument rule 4 calibration: it plants an instance the probe is supposed to find,
and the probe finds it — `onClick` present in `$attrs` and the native click delivered. So the
instrument can see a fallthrough listener, and it reports **A and B identical**. The sentence "would
stop receiving native clicks" is measured **false as a delta**: under the baseline it never received
them.

This is the worked-example-1 shape recurring: *the conclusion survived; the stated mechanism did
not.* Gate 1 exists for exactly this, and the entry's G5 sentence had never been run through it,
because Gate 1 was `DEFERRED` when the entry was written.

## Why G5 is still FAIL — three measured differences, none of them the one on record

Same build, same harness, two-sided each:

1. **Throw / error behaviour** — Gate 5 names this explicitly. With **no** handler supplied by the
   parent: baseline `props.onTrace('setup', { runs: 1 })` throws
   `TypeError: props.onTrace is not a function` and takes down `setup`; candidate `emit('trace', …)`
   is a **silent no-op**. This is live for the corpus: all three goldens call `onTrace`
   unconditionally, S1 during the `<script setup>` body itself.
2. **Return value** — baseline `props.onTrace(…)` returns the handler's value (`42` measured);
   `emit(…)` returns `undefined`. A consumer-detectable difference in the module's behaviour.
3. **Handler-name resolution surface** — the two forms resolve *different sets of parent spellings*:

   | parent passes | baseline invokes | candidate `emit()` reaches |
   |---|---|---|
   | `onTrace` | yes | yes |
   | `on-trace` | **yes** | **no** |
   | `onTraceOnce` | **no** | **yes** |

   The candidate silently acquires the `.once` convention and silently loses the hyphenated
   spelling. Neither is a diagnostic; both are behaviour.

Any one of these is a Gate 5 `FAIL`. The verdict does not move; its basis is replaced wholesale.

## Gate 1 — PASS

`vue@3.5.40` and `@vue/compiler-sfc@3.5.40` resolve to the same version from
`packages/frameworks/vue` (`pnpm-lock.yaml:367-369`, `:725-727`), so `DEFERRED — framework absent`
is unavailable under Gate 1's own discharge list, to which T006 added Vue's line.

Both forms compiled through `parse` + `compileScript` + `compileTemplate` across `ssr × isProd`
(4 modes). Baseline = the **shipped** `packages/frameworks/vue/generated/S1.vue`; candidate = its
mechanical `defineEmits(['trace'])` twin. **Parse errors 0, template `errors` 0, template `tips` 0,
no throw — in all four modes, for both forms.**

Calibration: a planted template syntax error reports `1` parse error and `1` template error in all
four modes, so the probe is not a green vacuum.

**Recorded, because it is a hole rather than a result:** a second control — `emit('trace')` against
`defineEmits(['other'])`, i.e. emitting an *undeclared* event — is **exact-empty clean in all four
modes**. The compiler is blind to it. Gate 1 measures diagnostics; it cannot be read as measuring
correctness, and the entry's G5 basis is precisely the class it cannot see.

## Gate 4 — FAIL (and this is where it differs from 2b)

The emitter exists, so `DEFERRED — emitter absent` is discharged and unavailable.

**Domain, in emitter terms:** every `PropDestructuringEntry` in `component.props.entries` printed
as a string literal into the `defineProps([...])` array by `propsDeclaration()`
(`packages/frameworks/vue/src/emitter/index.ts:400`, called at `:482`). This is a *real* deciding
function with *live instances*, which is what separates this entry from 2b.

Over that domain the shipped corpus holds six distinct props — `label`, `multiplier`, `visible`,
`seed`, `initial`, `onTrace`. The sugar applies to **one of six**. Counterexample exhibited from
shipped output, not hypothesised: that is a real `FAIL`, this gate doing the work its own text
describes.

The **repair step** is then run, and every narrowing is unavailable:

- *"props whose value is a callback"* — `PropDestructuringEntry` (`packages/compiler/src/schema.ts:205`)
  carries `sourceName`/`localName`/`path`/`alias`/`graphNodeId`/`defaultValue?` and **no type
  field**. Not decidable from declared facts. This is IR-8, named and deferred by T002 ruling 3.
- *"props whose `sourceName` matches `/^on[A-Z]/`"* — decidable, and **unsound**: nothing in the IR
  says such a prop holds a function, so a non-callback prop with that name shape would be declared
  an emit that can never fire. Gate 4's own bar, and the same IR-8 hole one level down.
- *"props the component body calls"* — inspecting what a handler does. **Gate 3 kills it outright.**

Repair unavailable, so `FAIL` stands rather than narrowing into a `PASS`.

**Contrast with 2b, recorded so the two are not read as inconsistent.** 2b took `UNKNOWN` because
its domain was *empty* — no `v-slot` path, no instance, nothing to exhibit. Entry 3's domain is
non-empty and shipped, so a counterexample *is* exhibitable, and Gate 4's text makes that a `FAIL`
rather than an `UNKNOWN`. Empty domain → `UNKNOWN`; populated domain with a counterexample →
`FAIL`. Same gate, different facts.

## Gate 6 — FAIL, and Gate 1 forces the move

Gate 6's `DEFERRED` is available for **one** cause: "no lane exists for that framework yet." A lane
exists — `scripts/e2e.mjs:38` drives `demos/vue-official` in a green six-row `pnpm e2e`. The cause
is discharged, so the entry must be re-run here too.

Re-run: no standing check would fail if this sugar silently regressed, because the emitter has no
`emit` path to regress. Stronger than 2b: the gate **actively refuses** the form —
`packages/frameworks/vue/src/gate/index.ts:1024` raises `no-two-way-binding` on any emitted
`defineEmits(` call, citing this very worked example. That check pins the **denial**, not the sugar.
Gate 6's `FAIL` clause applies verbatim: the sugar's only justification is an artifact property
nothing checks, because there is no artifact.

**This move is not optional.** Gate 1's coupling paragraph: "If you find yourself recording `PASS`
here and `DEFERRED` at Gate 6, you measured against something this repo does not ship, and this gate
is `FAIL`." Having measured G1 `PASS`, leaving G6 at `DEFERRED` would force G1 to `FAIL`. The card
scoped this re-run to G1 and G4; **the policy's own coupling rule drags G6 along**, and that is the
one place this ruling exceeds its brief. It exceeds it in the direction of the existing verdict.

## Gates 2 and 3 — unchanged, with G3's PASS made conditional

**G2 PASS**, and now measured rather than assumed. `defineEmits` is a compiler macro inside the
emitted module; the parent's spelling does not change (measured: parent passing `onTrace` reaches
the handler under **both** forms), so nothing is asked of another module. This is the scoping Gate
2's import-clause paragraph already settled.

**G3 PASS — conditional, stated so it is not over-read.** It holds only under the *name-shape*
reading of the trigger, where `sourceName` is a declared IR field and a prefix test is not
expression-content inspection (the same posture as worked examples 1 and 8). The *other* available
trigger — "the body calls this prop" — is a flat Gate 3 `FAIL`. The label does not move because the
name-shape reading is available; what kills the sugar is that the name-shape reading is then
**unsound at Gate 4**. Recorded rather than flipped: re-labelling a gate outside this re-run's scope
is the accident this task was created to avoid.

## Instrument disclosures

- Gate 1 probe calibrated with a planted syntax error (reports) — and a disclosed blind spot: an
  undeclared `emit()` is exact-empty clean, so the compiler cannot see the class G5 decides on.
- Gate 5 probe calibrated with a known member (arm C: undeclared → `onClick` in `$attrs`, native
  click delivered), which is what licenses reading arms A and B's `false` as a real negative rather
  than a dead instrument.
- Measured in **jsdom**, not a real browser, and not through `pnpm test:browser` — a concurrent
  Worker holds the tree. The three findings are runtime-core behaviours (props/attrs partition,
  `emit` handler resolution, `emit` return value), not layout or paint, so jsdom is in envelope. If
  anyone wants the native-click arm re-taken in Chromium, it is cheap; it would not change the
  `FAIL`, which stands on the throw-behaviour arm alone.
- `pnpm-lock.yaml` shows as modified (` M`) in the working tree. T006's receipt asserts it was frozen
  at `f52229150e6b4b5a`. Not this task's scope and not touched here, but the PM should reconcile it
  before any completion audit reads that freeze as holding.

## Exact replacement text

Delivered in the T007 receipt and reproduced here for the folding package. It replaces the whole of
worked example 3 in `docs/emitter-idiom-policy.md` (currently lines 453-461). **Not applied** —
`docs/emitter-idiom-policy.md` is serialised behind the queued Angular fold.

---

```markdown
### 3. Vue — declaring a callback prop as a `defineEmits` event → **no-sugar**

**Re-run, not re-read.** This entry previously read `DEFERRED` at Gates 1, 4 and 6 on the ground
that Vue was absent from the lockfile and no Vue emitter existed. All three conditions are gone —
`vue@3.5.40` is in the lockfile at two importers, `packages/frameworks/vue` exists, and `pnpm e2e`
drives `demos/vue-official` (`scripts/e2e.mjs:38`) in a six-row run. `frameless-vue-v1` T007 re-ran
the entry. **The ruling is unchanged and its basis is not:** the denial rested on a single `G5 FAIL`
whose stated mechanism has been *measured false*, and it now rests on three independent `FAIL`s.

Baseline (what the emitter ships): the callback is a declared prop —
`defineProps([… , 'onTrace'])`, invoked as `props.onTrace(…)`. Candidate:
`defineEmits(['trace'])` with `emit('trace', …)`.

Domain, in emitter terms: every `PropDestructuringEntry` in `component.props.entries` printed as a
string literal into the `defineProps([...])` array by `propsDeclaration()`
(`packages/frameworks/vue/src/emitter/index.ts:400`).

- **G1 PASS.** Measured, not read, against `vue@3.5.40` / `@vue/compiler-sfc@3.5.40` — the same
  version at both, resolved from the package that ships the emitter. The shipped `S1.vue` and its
  mechanical `defineEmits` twin both produce an **exact empty** diagnostic set — parse errors,
  template `errors` *and* `tips` — across `ssr × isProd`. A planted syntax error reports in all four
  modes, so the probe can fail. `DEFERRED — framework absent` is no longer available.
  **Stated so the `PASS` is not over-read:** `emit('trace')` against `defineEmits(['other'])` — an
  emit of an undeclared event — is *also* exact-empty clean in all four modes. This gate measures
  diagnostics, and the compiler is blind to the class Gate 5 decides on.
- **G2 PASS.** `defineEmits` is a compiler macro inside the emitted module, and the parent's
  spelling is unchanged — measured: a parent passing `onTrace` reaches the handler under **both**
  forms. Nothing is asked of any other module. Same scoping as the import clause above.
- **G3 PASS, conditionally, and the condition is what kills the sugar at Gate 4.** It holds only
  under the *name-shape* reading of the trigger, where `sourceName` is a declared IR field and a
  prefix test is not expression-content inspection — the posture of worked examples 1 and 8. The
  only other available trigger, "the component body calls this prop", is a flat `FAIL` here.
- **G4 FAIL.** The emitter exists, so `DEFERRED — emitter absent` is discharged. Over the stated
  domain the shipped corpus holds six distinct props — `label`, `multiplier`, `visible`, `seed`,
  `initial`, `onTrace` — and the sugar applies to **one of six**. The counterexample is exhibited
  from shipped output, not hypothesised. The repair step is run and every narrowing is unavailable:
  "props whose value is a callback" is not decidable — `PropDestructuringEntry`
  (`packages/compiler/src/schema.ts:205`) carries no type field, which is IR-8; "props whose
  `sourceName` matches `/^on[A-Z]/`" is decidable but **unsound**, since nothing in the IR says such
  a prop holds a function; "props the body calls" is killed by Gate 3. Contrast entry 2b, which took
  `UNKNOWN` on an *empty* domain with nothing to exhibit. Empty domain gives `UNKNOWN`; a populated
  domain with a counterexample gives `FAIL`.
- **G5 FAIL — and the mechanism previously recorded here is withdrawn as measured false.** This
  entry used to read that "a frameless component with a callback prop named `onClick` would stop
  receiving native clicks" because declared events leave fallthrough `$attrs`. That is the delta
  between an **undeclared** prop and a declared emit. *Frameless declares the prop*, and a declared
  prop leaves `$attrs` exactly as a declared emit does. Measured three-sided at 3.5.40 with a real
  DOM, child root `<button>`, parent passing `onClick`, native bubbling click: `props: ['onClick']`
  → `$attrs` empty, handler **not** called; `emits: ['click']` → `$attrs` empty, handler **not**
  called; **calibration arm** declaring neither → `$attrs` is `['onClick']` and the handler **is**
  called. The probe can see a fallthrough listener and reports the two candidate forms identical.
  The gate still `FAIL`s, on three differences that were measured rather than read:
  1. **Throw behaviour**, which this gate names explicitly. With no handler supplied,
     `props.onTrace('setup', …)` throws `TypeError: props.onTrace is not a function` and takes down
     `setup`; `emit('trace', …)` is a silent no-op. Live for the corpus — all three goldens call
     `onTrace` unconditionally, S1 during the `<script setup>` body itself.
  2. **Return value.** `props.onTrace(…)` returns the handler's value; `emit(…)` returns
     `undefined`.
  3. **Handler-name resolution surface.** The forms resolve different sets of parent spellings: a
     parent passing `on-trace` is reached by the baseline and **not** by `emit()`; a parent passing
     `onTraceOnce` is reached by `emit()` and **not** by the baseline. The candidate silently
     acquires the `.once` convention and silently loses the hyphenated spelling. Neither is a
     diagnostic.
- **G6 FAIL.** A Vue lane exists, so `DEFERRED` is discharged — it is available for that one cause
  only. No standing check would fail if this sugar silently regressed, because there is no emitted
  artifact to regress: `packages/frameworks/vue/src/gate/index.ts:1024` **actively refuses** any
  emitted `defineEmits(` call. That check pins the *denial*, not the sugar. Same clause as entries
  2b and 7.

Three `FAIL`s: **denied, not deferred.** Say which one decides it: **Gate 5 does**, and Gate 4 and
Gate 6 each deny it independently. **Re-open only if IR-2 gains an emit concept *and* IR-8 gains a
prop type field** — the first to give the sugar a declared trigger, the second to make its domain
sound. Note that a Vue lane, which is what the old deferrals were waiting for, did **not** change
the ruling; it changed the *evidence*, and it converted the entry's one documentary `FAIL` into
three measured ones.

**The standing lesson this entry adds, and it is the reason the re-run was worth its cost.** The
deferrals were never load-bearing — `FAIL` outranked them, and the entry said so. What was
load-bearing, and unexamined, was the sentence explaining the `FAIL`. A gate outcome that outranks
its neighbours is exactly the one nobody re-checks, and this one had never been through Gate 1
because Gate 1 was deferred when it was written. **Stale labels travel with an unmeasured
rationale**; clearing the labels is the occasion to measure the rationale, not a substitute for it.
```
