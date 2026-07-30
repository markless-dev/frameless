# T004 — the Codex clone: BLOCKED before the first product edit, on ONE missing file

Worker receipt detail. **Result: `blocked`. Nothing in the product tree was modified.**
The tree at finish is byte-identical to the tree at start (only the owner's three
in-flight paths differ from HEAD, exactly as at start).

The card was stopped at its **first** `stop_if` — *"Need files outside
allowed_files"* — and the stop was **measured, not predicted**: the blocker was
reproduced against the real suites, its full blast radius was enumerated, and the
probe was then completely reverted and the baseline re-proved.

---

## 0. THE HEADLINE

> **Adding the twelfth compiler golden — `packages/compiler/test/goldens/s12-codex-clone.json`,
> which is itself in `allowed_files` — turns `pnpm test` red in a file whose repair is
> `packages/frameworks/vue/src/gate/index.ts`, and that file is NOT in T004's
> `allowed_files`.**

**T003 had it. T004 does not.** T003's `allowed_files` carried
`packages/frameworks/vue/src/gate/index.ts` as its 22nd entry and T003's receipt lists it
as a changed file. T004's 48-entry list carries `packages/frameworks/vue/generated/**`
and `packages/frameworks/vue/test/**` and **no `vue/src/` glob at all**. Everything
else the twelfth ordinal moves is inside T004's list. **It is a one-file hole.**

This is not an emitter refusal and it is not a capability finding. It is a **board
configuration gap**, and it is reachable in about three minutes, so it was measured
before a single product byte was authored.

---

## 1. THE MEASUREMENT — reproduced, not reasoned

Two files were staged (**both inside `allowed_files`**) purely as a probe:

```
cp packages/compiler/test/goldens/s11-todomvc-advanced.json \
   packages/compiler/test/goldens/s12-codex-clone.json
cp packages/frameworks/vue/generated/S11.vue packages/frameworks/vue/generated/S12.vue
npx vitest run packages/frameworks/vue/test/gate.test.ts
```

Result: **2 failed | 42 passed**. Verbatim, the first:

```
AssertionError: expected 'Emitted Vue source uses v-model. Work…' to contain
'TWENTY-FOUR shipped instances and the…'

Expected: "TWENTY-FOUR shipped instances and the sugar applies to ELEVEN"
Received: "… re-enumerated over the eleven-scenario corpus it holds EIGHTEEN shipped
instances and the sugar applies to SEVEN …"
```

and the second:

```
Expected: "TWENTY-FOUR printed entries spanning seven distinct prop names"
Received: "… re-enumerated over the eleven-scenario corpus it holds TWENTY-THREE
printed entries spanning seven distinct prop names …"
```

*(The specific numbers above are an artefact of the probe using a **duplicate of S11** as
the stand-in golden. A real S12 produces different counts. The **failure** is not an
artefact — any twelfth golden produces it.)*

### 1.1 Why it is unavoidable, read off the mechanism rather than the symptom

Three separate assertions in `packages/frameworks/vue/test/gate.test.ts` bind the
**shipped denial message** in `packages/frameworks/vue/src/gate/index.ts` to a **live
re-derivation over the corpus**:

- `scenarioGoldens()` globs `/^s(\d+)-[\w-]+\.json$/` over the compiler golden directory.
  A twelfth golden makes its length **12**.
- `expectTemplateDomainFigures()` asserts the message contains
  `` `${spelled(scenarioGoldens(...).length).toLowerCase()}-scenario corpus` `` — so the
  shipped string must change from **"eleven-scenario corpus"** to **"twelve-scenario
  corpus"**. This fires on the **golden count alone**, independent of anything S12 contains.
- `expectTemplateDomainFigures()` also asserts the spelled instance/applicable counts, and
  `expectPrintedPropFigures()` the spelled printed-entry and distinct-name counts. S12
  declares an `onTrace` prop, so the printed-entry figure moves by construction; a chat
  composer needs a `value`-bound textarea with a same-host `onInput`, which is worked
  example 12a's domain **verbatim**, so that figure moves too.
- `deriveTwoWayHostDomain()` reads `S{digits}.vue` for **every** golden. So the vue lane
  cannot even be left *unbuilt* to dodge this — a missing `S12.vue` throws instead.

**All four numbers live in prose inside `src/gate/index.ts`.** They cannot be reached
from `test/**`.

### 1.2 The three exits that were considered and rejected

1. **Soften the assertions in `test/gate.test.ts`** (which *is* allowed). Rejected: that
   file's own doc comment is a 60-line account of why these numbers were converted **from**
   string literals **to** derivations — literals "are green whatever the corpus does, so the
   shipped violation message … was free to state a false MEASURED count," and S7 did exactly
   that while both assertions stayed green. Softening them re-creates the defect the file
   exists to prevent. It is also T003's stop_if verbatim: *"You are about to renumber the vue
   gate census instead of re-deriving and re-arguing it."*
2. **Leave the vue lane unbuilt.** Rejected on two grounds: `deriveTwoWayHostDomain()`
   throws on a missing `S12.vue` (§1.1), and — more importantly — **there is no honest
   refusal to record.** Vue emits S11 and would emit S12. Its real S12 verdict is
   `EMITS-BUT-MISBEHAVES`, which is a *shipping* verdict. Manufacturing an "unbuilt lane"
   to fit an `allowed_files` list would be exactly the fabricated refusal the oracle forbids.
3. **Ship the golden and accept a red `pnpm test`.** Rejected: it is two more of this
   card's own `stop_if`s (*"pnpm test exceeds exactly 1 failure"*), it would have cost a
   full build to arrive at the same stop, and it would have handed the PM a large dirty
   tree instead of a one-line fix.

---

## 2. THE FULL BLAST RADIUS — so the PM can unblock in ONE round trip

`pnpm test` with the twelfth golden and stand-in generated artifacts staged in all five
emitting lanes: **16 failed | 1213 passed**, across **9 files**. Every one of them is
inside T004's `allowed_files` **except the vue repair site**:

| failing suite | in `allowed_files`? | what the repair is |
|---|---|---|
| `packages/compiler/test/package-inventory.test.ts` | n/a | **the foreign ARM B baseline.** Fails at HEAD too — not caused by this |
| `packages/frameworks/react/test/size.test.ts` | ✅ `react/test/**` | add the `EMITTED_BUDGETS` row |
| `packages/frameworks/solid/test/size.test.ts` | ✅ `solid/test/**` | add the `EMITTED_BUDGETS` row |
| `packages/frameworks/solid/test/emitted-typecheck.test.ts` | ✅ `solid/test/**` | accepted finding-002 rows (one per bound text input) |
| `packages/frameworks/angular/test/emitter.test.ts` | ✅ `angular/test/**` | declare S12 in `unbuilt-scenarios.ts` |
| `packages/frameworks/angular/test/gate.test.ts` | ✅ `angular/test/**` | same subtraction |
| `packages/frameworks/angular/test/parse-emitted.test.ts` | ✅ `angular/test/**` | same subtraction |
| `packages/frameworks/angular/test/emitted-typecheck.test.ts` | ✅ `angular/test/**` | same subtraction |
| `packages/frameworks/vue/test/gate.test.ts` | ✅ `vue/test/**` … | **but the repair is `vue/src/gate/index.ts` — ❌ NOT in `allowed_files`** |

**The single edit that unblocks this card:** add

```yaml
- "packages/frameworks/vue/src/gate/index.ts"
```

to T004's `allowed_files`, exactly as T003 carried it.

> This list is a **lower bound**, and honestly so. The stand-in artifacts were **copies of
> S11**, not a real S12, and `enriched-ir.test.ts` was never driven against a real fixture.
> A real S12 may move more (the qwik and svelte gates in particular were silent here only
> because the stand-in was already-passing S11 output). **Nothing above should be read as
> "these eight and no others."**

### 2.1 The probe was proved to have landed, and proved to have been removed

The discipline T003 and T005 both recorded — *prove the delete landed* — applied in both
directions:

- **It measured something:** `pnpm test` reports **16 failures with the artifacts staged**
  and **1 without**. A probe that measured nothing would have reported 1 both times.
- **It left nothing:** after `rm`, `git status --short` is `M pnpm-lock.yaml`,
  `M pnpm-workspace.yaml`, `?? website/` — **the exact three-line status this session
  started with** — the `S12.*` glob matches nothing, and `pnpm test` is back to
  **exactly 1 failed | 1271 passed**, the foreign `package-inventory` ARM B.

---

## 3. THREE ERRORS IN THE DISPATCH, ALL MEASURED

The board's standing instruction is *assume the brief contains at least one error and find
it*. Three, of decreasing severity.

### 3.1 "SORT THE DIGESTS, NOT THE PATHS" is under-specified, and one literal reading of it is WRONG

The dispatch and the card both say: *"Sort the DIGESTS, not the paths — sorting paths
returns `b1dd182a` and is wrong."* Taken literally — sort the bare digest column — **that
produces a fourth number that is also wrong.** Measured, all four deterministic:

| method | `website/` digest |
|---|---|
| `find … -exec shasum -a 256 {} \; \| sort \| shasum -a 256` — **sort the shasum output LINES** | **`f936e169`** ✅ the recorded value |
| digest column only, sorted, then hashed (`… \| awk '{print $1}' \| sort \| …`) | `feddd40b` ❌ |
| paths sorted, digest lines **un**sorted | `c546c443` ❌ |
| (the card's recorded wrong reading) | `b1dd182a` ❌ |

The recorded method sorts **whole `shasum` output lines** — `<digest>  <path>`. Because the
digest is the leading field, that sort is *keyed* by digest, which is why the shorthand
"sort the digests" is nearly right and still not executable. **The correct instruction is
"sort the `shasum` output LINES."** T003 §8 and T005 both spell the command out in full;
the card's prose summary of them does not. The first command typed this session followed the
card's prose and returned `feddd40b`; it was caught by the mismatch, not by luck.

**This card's fingerprint, by the recorded method, at START and at FINISH:**
`f326d314` / `aeb7edc1` / `f936e169`, `website/` **116 files** — identical at both ends.

### 3.2 The card's shadcn radius formula is the PRE-v4 one — its conclusion survives, its arithmetic would not travel

The card states, as corroboration that the reference sits on the stock token scale:

> "shadcn ships `--radius 0.625rem` = 10px and `rounded-md` resolves to
> `calc(var(--radius) - 2px)` = 8px"

**Measured at source** (`apps/v4/content/docs/(root)/theming.mdx` on `shadcn-ui/ui@main`,
the file behind `ui.shadcn.com/docs/theming`, which is the page the card names):

```css
--radius-sm: calc(var(--radius) * 0.6);
--radius-md: calc(var(--radius) * 0.8);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) * 1.4);
```

The current scale is **multiplicative**, not additive. `--radius: 0.625rem` is confirmed.
**The card's conclusion is correct and its formula is stale** — the two scales coincide
*exactly* at the stock radius (10px → 6 / 8 / 10 / 14 either way) and diverge at any other
value. Worth recording rather than waving through, because a successor deriving a radius
the card did not measure, or reasoning about a non-default `--radius`, would silently get
the wrong number from the additive form.

**And there is a corroboration the card did not claim:** it measured the composer shell at
**radius 14px**. `--radius-xl` = `calc(0.625rem * 1.4)` = **14px** exactly. So the
reference's composer is stock `rounded-xl`, which is a *second* independent confirmation of
the stock token scale — on a different token from the one the card used.

### 3.3 The shadcn docs SITE's own `globals.css` is NOT the documented default theme

A trap for whoever picks this card up. The obvious "vendor shadcn's tokens verbatim" move is
to fetch `apps/v4/app/globals.css` from the repo. **That is the docs site's own theme and it
is materially different** from the default theme the card names. Measured, both fetched this
session:

| token | `apps/v4/app/globals.css` (docs site) | theming docs **default theme** ← the card's named source |
|---|---|---|
| `--foreground` | `oklch(0% 0 0)` | `oklch(0.145 0 0)` |
| `--primary` | `oklch(0% 0 0)` | `oklch(0.205 0 0)` |
| `--card-foreground` | `oklch(0% 0 0)` | `oklch(0.145 0 0)` |
| `--sidebar-foreground` | `oklch(0% 0 0)` | `oklch(0.145 0 0)` |
| `--chart-1..5` | `var(--color-blue-300…800)` | `oklch(0.646 0.222 41.116)` … |
| extras | `--surface`, `--code*`, `--selection*`, `--destructive-foreground` | absent |

**Vendor from `theming.mdx`'s "Default Theme CSS" block, not from the site's `globals.css`.**
The card is right about *which* source; it just does not warn that the repo's most obvious
file is the wrong one.

---

## 4. WHAT WAS SETTLED BEFORE THE STOP, so the successor does not redo it

### 4.1 Licences — verified at source, not inherited from the card

This harness **had network**, unlike T002's. Both licence claims on the card were checked
against the actual licence files rather than taken forward:

- **`shadcn-ui/ui/LICENSE.md`** → `MIT License` / `Copyright (c) 2023 shadcn`.
  **Card correct.**
- **`vercel/ai-elements/LICENSE`** → `Copyright 2023 Vercel, Inc.` / Apache-2.0 short form.
  **Card correct**, including its instruction to attribute this one **separately** from the
  MIT layer.
- **Square UI**: nothing was fetched, read, cloned or copied from that repository at any
  point in this session. The card's ruling was not tested and did not need to be.

The default-theme `:root` and `.dark` blocks were located and read in full, so the vendoring
step is a mechanical extraction from a named file with checkable provenance — the same shape
as `demos/shared/todomvc-app-css/`.

### 4.2 The authoring constraints S12 will have to satisfy

Gathered from the S11 fixture header, T003 and the card. Recorded here so the successor
inherits the *list*, not the search:

- **Streaming is a fixed unrolled chunk count.** A write inside a loop body is
  `DEFECTS.md` 8.1 in every lane.
- **Chain the post-`await` writes through `const`s** (`chunk1` → `chunk2` → `chunk3`) rather
  than re-reading the state cell. S11 §2.2 measured that react resumes from the
  pre-suspension `const` while solid/qwik/svelte resume from the live cell; a const chain is
  the one shape where **all four lanes agree by construction**, which is what a cross-lane
  comparison needs.
- **Never consume the awaited value** — `new Promise((settle) => …)` infers
  `Promise<unknown>` and consuming it costs `pnpm check` **+3** (TS2345/TS2769/TS2322, one
  code per lane), taking 267 → 270, which the board forbids.
- **`onTrace(…)` last, `event.preventDefault()` first**, in every handler.
- **No two-word DOM event.** Enter-to-send is unspellable; ship the Send **button**.
- **Every conditional an expression; every state write top-level and unconditional.**
- **No `state(null)`** — `''` sentinels.
- **No template text node with whitespace edges**; carry the space in the data.
- **Timestamps are literal strings**, never `Date` — and the angular lane is expected to
  refuse the module outright on the same global-identifier ban regardless.
- **`<textarea>` with a `value` binding is available** — S7 already ships one.
- One component per **module**; the fixture is one module, so the sidebar, thread and both
  detail panes live in a single component's template. (Multi-*module* composition is shipped
  at `demos/composition-kit/src/page.tsrx`, but T004's `allowed_files` names exactly one
  fixture.)

### 4.3 The expected lane table — NOT measured, and flagged as such

The card predicts four run / one emits-but-misbehaves / one refuses. **This card did not
reach the point of testing that**, and the board's own rule applies to the prediction as
much as to a probe: *a prior-card verdict is not a lane verdict.* T003's verdicts were
measured on **S11**, not on S12. Whoever picks this up must re-run **each lane's own gate**
on the real S12 module and then **run it in a browser** — five static gates passed S11 in
the vue lane and only a browser refuted it.

---

## 5. BASELINES AND HYGIENE

| command | result |
|---|---|
| `pnpm test` (start, and again at finish after revert) | **exactly 1** failure — `package-inventory` ARM B, foreign; 1271 passed |
| `pnpm test` (with probe artifacts staged) | 16 failed / 1213 passed — **the measurement**, since reverted |
| `git status --short` (start and finish) | identical: the owner's three in-flight paths only |
| owner fingerprint (start and finish) | `f326d314` / `aeb7edc1` / `f936e169`, 116 files |

`pnpm check`, `pnpm e2e`, `pnpm lint` and `pnpm check:citations` were **not run**, and that
is deliberate rather than an omission: **no file they inspect was modified**, in either
direction, and `git status` proves it. Reporting them as passes would be reporting a
baseline, not a verification of this card's work — of which there is none in the product
tree.

**No server was started, so no port was used and no process was killed.** `pkill` was never
invoked.

---

## 6. FOR THE PM

1. **Add `packages/frameworks/vue/src/gate/index.ts` to T004's `allowed_files`.** That is
   the whole blocker. T003 carried it; T004 dropped it.
2. When re-dispatching, carry T003's stop_if with it: *"You are about to renumber the vue
   gate census instead of re-deriving and re-arguing it."* The twelfth scenario has to
   **re-argue** the 12a/12b denials, not renumber them — and S12 is a genuinely strong test
   of 12b, since a streaming chat is the strongest chance yet for a written-back prop.
3. **Fix the fingerprint instruction** on this board and its successors: *sort the `shasum`
   output **LINES***. "Sort the digests" has now cost two cards a wrong first reading.
4. **Correct the card's `calc(var(--radius) - 2px)`** to `calc(var(--radius) * 0.8)`, and
   consider adding the composer's 14px = `--radius-xl` corroboration — it is a second,
   independent confirmation on a different token.
5. **Warn the successor off `apps/v4/app/globals.css`.** It is the docs site's theme, not the
   documented default theme, and the difference is visible (`--foreground` black vs near-black,
   chart tokens rebound to blues).
6. The blast-radius table in §2 is a **lower bound** measured with stand-in artifacts. Do not
   let a successor treat it as the complete inventory.
