# T010 — nested validator exactness, and a shipped gate refusal re-derived

Two findings in the same lane family, both about a premise that was false. Everything below
was measured at `127a75b` unless stated otherwise.

---

## 1. The repo's anti-drift probes were aimed one level too high

### The hole, measured before it was closed

`angular/test/emitter.test.ts:600`, `svelte:277` and `vue:473` each claimed *"a schema addition
cannot pass silently"*. All three planted `newField` at the **top level** of `EnrichedIR`. **Qwik
carried no such probe at all** — the brief and T002 both named three lanes, which is correct, but
it is worth stating that the fourth lax lane's probe was not mis-aimed, it was absent.

Plant an unknown key on a **nested `PropDestructuringEntry`** of every component of all eight
goldens, then call each lane's real exported `emit()` and compare byte-for-byte against unplanted
output. Verdicts were identical across all eight goldens per lane.

| lane | nested key on `PropDestructuringEntry` | `newField` on `EnrichedIR` |
| --- | --- | --- |
| react | THROWS `PropDestructuringEntry has unknown semantic field: newNestedField` | THROWS |
| solid | THROWS same | THROWS |
| qwik | **ACCEPTS, byte-identical 8/8** | THROWS |
| svelte | **ACCEPTS, byte-identical 8/8** | THROWS |
| vue | **ACCEPTS, byte-identical 8/8** | THROWS |
| angular | **ACCEPTS, byte-identical 8/8** | THROWS |

This reproduces T002 and T003 exactly. **Nothing to report as a difference.**

That table is why the plan believed the six validators were symmetric: the test that would have
shown otherwise never looked below the top level, so *"a schema addition cannot pass silently"* was
true of the shape the probes planted and false of the shape IR-8 actually added.

### The fix

A `validatePropEntries()` helper in each of the four lax emitters, called from inside the existing
component loop immediately after `exactKeys('ComponentProps', …)`. It allowlists the seven declared
keys and additionally **shape-checks `type`** — a `type` that is not an AST node throws
`PropDestructuringEntry has malformed type annotation AST`. Admitting a key without checking its
shape would have traded one blind spot for another, and it brings the four lanes to parity with the
shape-check T003 added to react and solid.

**The two strict lanes spell their checker differently and neither was copied blindly.** React's is
an inline closure named `keys(construct, value, allowed)`; solid's is `exactKeys(value, allowed,
construct)` — *argument order reversed*. The four lax lanes share a third spelling,
`exactKeys(construct, value, allowed)`, which is what the helper is written against. This is the
same trap that made every grep-derived count in this phase miss a lane.

### After

All six lanes now throw on both the nested key and the top-level one, naming the construct that
actually carries it. **The top-level checks were not weakened** — every existing probe is intact and
still passes, and the new tests assert the two are not substitutes.

### The probes, re-aimed by ADDITION rather than replacement

The brief said "re-aim those probes at a nested construct". Read literally that would have replaced
the top-level arm, which the same brief forbids ("do not weaken any existing top-level check"). The
existing arm is **kept** and a nested arm **added** beside it, plus an IR-8 malformed/well-formed
pair. Qwik receives both arms, since it had neither.

**The calibration is the load-bearing assertion, not the throw.** Each nested test also asserts the
message does *not* name `EnrichedIR` — pinning that the nested plant is invisible to the top-level
allowlist. Delete the nested check and the nested test goes red; delete the top-level one and the
top-level test goes red. Watched: with the four `validatePropEntries` calls commented out, **8 tests
went red, two per lane**, each naming `PropDestructuringEntry`; restored, all green.

The positive arm is not decoration. `s1-render-once` is the only annotated fixture in the corpus —
**4 typed entries against 15 untyped across the other seven goldens** — so without it the `type`
allowlist entry would be indistinguishable from a dead one.

---

## 2. A shipped gate refusal resting on a premise this phase falsified

### The brief named one site. There were two.

The board and the dispatch both name `vue/src/gate/index.ts:1026-1034`. A **second** `no-typed-props`
limb at **`:1071-1079`** carried the same dead premise — *"the IR carries no prop type field, so the
type would have to be invented from expression contents (IR-8, deferred)"* — on the
`withDefaults`/type-argument-form trigger. Repairing only the named site would have left half the
false premise shipping, in the limb that actually decides.

### Re-derivation, gate by gate, measured at `vue@3.5.40`

**G3 now PASSES.** `PropDestructuringEntry.type` exists since T003 and `s1-render-once`'s golden
carries four, including a full `TSFunctionType`. "The entry declares a type" reads a *declared* IR
field — precisely what the old message said was unavailable.

**G4 is REPAIRABLE, so it does not decide either.** Annotation is per-component all-or-nothing in
the corpus today: `RenderOnce` 4 of 4 typed, the other seven goldens 0 of 15. "Components whose
every entry carries a type" is a stated, emitter-decidable narrowing.

**G5 DECIDES AND FAILS, on three runtime measurements.** `compileScript` output differs first:

```
array form         →  props: ['label', 'multiplier', 'visible', 'onTrace']
type-argument form →  props: { label: {type: String, required: true},
                               visible: {type: Boolean, required: true}, … }
```

Rendering both through `renderToString`:

| parent passes | array form | type-argument form |
| --- | --- | --- |
| `visible` present | `true` (boolean) | `true` (boolean) |
| `visible` **absent** | `undefined` | **`false`** — Boolean casting invents a value |
| `visible=""` | `""` — **FALSY** | **`true`** — **TRUTHY**; a `v-if` renders the other branch |
| `multiplier="2"` | `"2"`, silent | `"2"` + `Invalid prop: type check failed` |

Plus two diagnostics the baseline never emits: `Missing required prop: "visible"` and `Invalid
prop: type check failed`. The `required: true` enforcing them is synthesized from the TS type being
non-optional, and **no IR field declares requiredness** — so the candidate asserts something about
every prop that the IR never said. That is the invention the old message named, in the wrong place.

This lands on `RenderOnce`, the one corpus component that could take the sugar today, and it carries
a `visible: boolean` prop. The delta is a **rendering** change, not a typing one.

**Verdict: the refusal of the type-argument form SURVIVES. Its reason does not.** IR-8 is explicitly
struck as the re-open condition and replaced with the three deltas.

### The `lang` limb does NOT survive, and removing it opens no hole

The retired limb fired on the **language attribute**, not on a typed prop. Two measurements:

1. `<script setup lang="ts">` over **untyped** source compiles clean and yields the **identical**
   `props: ['label', …]` option as the no-lang baseline. The sole delta is a `defineComponent()`
   wrapper. T002's one-directional-coupling finding is **confirmed**.
2. **Three independent refusals already cover the ground**, measured through the real gate rather
   than assumed: the `lang="ts"` mutant draws **`baseline-form-inventory`** on its own IR-4 grounds
   (`script[setup,lang=ts]` is not in the recorded inventory); `defineProps<T>()` and
   `withDefaults()` draw the surviving `no-typed-props` limb directly; and type arguments with no
   `lang` — unparseable TS — draw `eslint:parse`.

A `no-typed-props` violation on a file containing zero types taught a reader nothing and left the
real refusal looking like a formality behind it. The limb is withdrawn; the `dossierRef` moved with
the grounds, since `frameless-vue-v1 T002 ruling 3` denied this form *because* IR-8 was missing.

### ⚠️ CORRECTION TO THE BRIEF: removing this did NOT unblock Step 1.5

The dispatch says the rule "will otherwise block Step 1.5's `lang="ts"` flip". **Measured: it was
neither the only blocker nor the deciding one.** `baseline-form-inventory` refuses
`script[setup,lang=ts]` independently, on grounds that are still sound. **T009 must give that form a
measured version floor in `BASELINE_FORM_INVENTORY` before the flip can land.** That is a
version-floor ruling, not a side effect, and it was deliberately left for T009 rather than taken
here.

Note also for T009: `lang="ts"` makes `compileScript` wrap the module in `defineComponent()` where
the baseline emits a plain object literal. Runtime-neutral, but it is a **real delta in compiled
output**, and Step 1.5's behaviour-neutrality claim should name it rather than be surprised by it.

### The parse-visibility hole this exposed (NOT repaired here — out of scope)

`parseEmitted()` swallows `compileScript` failures with `catch { script = [] }`. A script the
compiler cannot read yields an **empty AST**, so *every* script-walking limb goes silent, not just
this one. Measured: TS type arguments with no `lang` produce exactly that, and only the eslint
arbiter notices. The retired limb did **not** cover this — it fires when `lang` is present, i.e.
precisely when the parser is most capable. Recorded for whoever owns the gate next.
