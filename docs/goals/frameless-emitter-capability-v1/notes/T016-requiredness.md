# T016 — IR-8 requiredness, and the Vue runtime prop declaration

Supplies `PropDestructuringEntry.optional` from the authored annotation and makes
the Vue lane print `defineProps({ name: { type, required } })`. One Gate 5 ground
dissolves; the other stands untouched.

## 1. The ground that dissolves, and the one that does not

Gate 5 denied `required: true` because it was *"synthesized from TS
non-optionality that no IR field declares"*. That was true of the IR, not of the
source. `s1-render-once.tsrx` declares all four props non-optional — `label:
string;`, not `label?:` — and `build.ts` `propTypeMembers` serialized only
`member.typeAnnotation.typeAnnotation`, never reading `member.optional`. The fact
was parsed, reached, and dropped at serialization.

It is now reported. `required` is `!optional`, and `optional` is the `?` the
author did or did not write.

**The other ground is untouched and still binding.** `{ visible: Boolean }` flips
`visible=""` from falsy to truthy. Measured a third time here, independently:

| form | `visible` ABSENT | `visible=""` |
|---|---|---|
| A array (HEAD) | `<p>hidden</p>` | `<p>hidden</p>` |
| C `{type, required:true}`, boolean → `null` | `<p>hidden</p>` | `<p>hidden</p>` |
| D `{visible: Boolean}` | `<p>hidden</p>` | **`<section data-scenario="s1">`** |

Booleans still map to `null`. Their `required` still prints: the coercion hazard
is a reason to drop the constructor, not a reason to drop a second fact the
source also states.

## 2. The three arms, against the real emitted artifacts

Rig staged outside the repo, driven by `demos/vue-official`'s own `vue-tsc`
3.3.8 / vue 3.5.40. Control uses HEAD's checked-in `S1.vue` via `git show`.

| arm | verdict | diagnostics |
|---|---|---|
| CALIBRATION HEAD S1 + wrong-typed parent | GREEN | 0 — **the hole**, and it proves the rig manufactures no reds |
| CALIBRATION HEAD S1 + correct parent | GREEN | 0 |
| CONTROL new S1 internals only | GREEN | 0 |
| **NEGATIVE** new S1 + wrong-typed parent | **RED** | exactly 1: `Parent.vue(7,15): error TS2322: Type 'number' is not assignable to type 'string'.` |
| **POSITIVE** new S1 + correct parent | GREEN | 0 |

This is the Vue lane's Step 0 RED, reproduced against **emitted** output.

T015's rejection of bare constructors reproduced exactly: internals RED ×3,
`TS2722` ×2 and `TS18048`, firing regardless of the parent, so its positive arm
is unreachable.

## 3. The dev warning, ruled

`required: true` adds dev-only warnings the baseline never emits. Rendered output
is **byte-identical on every case measured** — including both triggering cases,
which `pnpm e2e` cannot reach because every demo binds `visible={true}`.

| case | HTML | warning delta vs HEAD |
|---|---|---|
| `visible` ABSENT | byte-identical | `Missing required prop: "visible"` |
| `visible=""` | byte-identical | none |
| `visible={true}` / `{false}` | byte-identical | none |
| all four bound (what every demo does) | byte-identical | none |
| `label` ABSENT | byte-identical | `Missing required prop: "label"` |
| `multiplier="2"` | byte-identical | `Invalid prop: type check failed…` |

**RULED ACCEPTABLE**, on four grounds:

1. **Co-extensive with the declared contract.** A `Missing required prop` warning
   fires only where a parent omits a prop the source declares non-optional. It
   cannot fire on a prop the author marked optional — that prints
   `required: false`, and the synthetic arm in the emitter suite proves the
   printed value follows the flag rather than being hard-coded.
2. **No rendered output moves.** Dev-only, and stripped from production builds.
3. **It is the compile-time contract, delivered at runtime**, for callers
   TypeScript cannot reach — plain-JS parents, dynamic components, templates
   never passed through `vue-tsc`.
4. **The alternative is worse and was measured.** Dropping `required` makes the
   emitted component's own script fail strict TS in three places.

**Cost, recorded:** a downstream consumer who both violates the declared contract
and asserts "no console warnings" would newly fail. That is the price of having a
contract, and it is paid only by contract violators.

**The brief named one delta; there are two classes.** `Invalid prop: type check
failed` is a delta of the runtime *type* (`type: Number`), not of `required`.
T010 measured it originally; the T016 card's "its one delta" is incomplete.

## 4. Six-validator matrix

Method as T003 and T010: plant on every `PropDestructuringEntry` of all eight
goldens, call each lane's real exported `emit()`.

**Before** — all six reject `optional` by name: `PropDestructuringEntry has
unknown semantic field: optional`. Unlike T003's situation there was no lax lane;
T010's parity work held, and the guard was watched firing on all six before any
was widened.

**After:**

| plant | react | solid | qwik | svelte | vue | angular |
|---|---|---|---|---|---|---|
| valid `optional` (annotated golden) | accepted, byte-identical | accepted, byte-identical | accepted, byte-identical | accepted, byte-identical | **accepted, output moved** | accepted, byte-identical |
| `optional: 'yes'` | throws | throws | throws | throws | throws | throws |
| `optional` with no `type` | throws | throws | throws | throws | throws | throws |

Vue's output moving is the point — it is the lane that consumes the field. **No
lane accepts it silently.**

`type` and `optional` are read from one `TSPropertySignature`, so all six reject
an `optional` arriving without a `type`: requiredness that did not come from the
supply site was invented downstream. That check caught two existing tests in
react and solid which stripped `type` and left `optional` orphaned.

## 5. Brief errors found

1. **`pnpm check` is not "all in `react/generated/`".** It is 73, confirmed — but
   54 of the 73 are in `react/generated-composition/`; only 19 are in
   `generated/`. Unchanged by this slice, byte-for-byte.
2. **`pnpm e2e` never runs `vue-tsc`.** T015 stated bare constructors "land in
   pnpm e2e … so vue-tsc -b checks them and THE DEMO BUILD GOES RED". Measured:
   `scripts/e2e.mjs` runs each demo's `copy-emitted` and then the witness against
   the dev server. It never runs `build`, so `vue-tsc -b` is never invoked on this
   lane. T015's rejection of form B stands on its primary ground — the three-arm
   oracle, reproduced here — but its e2e mechanism is false.
3. **`vue-tsc -b` was already red at HEAD.** 40 diagnostics over the seven
   unannotated emitted components, byte-for-byte identical before and after this
   change, none in `RenderOnce.vue`.
4. **T013 predicted "three of four will flip RED" in `tsconfig.app.json`. One
   did.** The two bottom rows were already RED and cannot flip; the "unknown
   prop" row cannot be closed by any prop typing, because Vue lets an undeclared
   prop fall through to attrs.

## 6. Still open

- **The unknown-prop row stays MISSED**, by a Vue framework rule. Not a gap in
  IR-8.
- **Only `RenderOnce` is covered.** It is the corpus's only annotated module; the
  other seven still emit the array form and type every prop `any`.
- **`vue-tsc -b`'s 40 pre-existing diagnostics** are untouched and unowned.
- **No standing behavioural check anywhere in this repo observes a boolean prop
  bound absent or bound to an empty string.** The strongest Vue denial on the
  board is still pinned by text checks plus out-of-tree probes. T013 recommended
  queueing that corpus scenario after Step 5 as a denial tripwire; it is still
  not queued.
- **The printed declaration is one long line.** `yuku-codegen` always inlines
  object expressions, and `estree.ts` forbids running any formatter over a
  `.vue`. Cosmetic, disclosed, not worked around.
