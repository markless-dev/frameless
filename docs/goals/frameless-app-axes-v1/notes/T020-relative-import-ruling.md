# T020 — landing T017's three rulings across angular, vue and svelte

No emitter changed. No emitted byte moved. `git diff --exit-code` over every `generated/`,
`generated-composition/`, `generated-persistence/` and `demos/*/src/emitted/` path exits 0, paired
with `git status --short`, which shows only the seven files this card was allowed to touch plus the
owner's pre-existing `pnpm-lock.yaml`, `pnpm-workspace.yaml` and untracked `website/`.

---

## 1. What was measured before anything was written

Every number below is this card's own measurement, taken through each lane's own `checkSources` /
`checkGeneratedFiles`. Nothing was inherited from T015, T017 or T018.

| lane | `generated/` before | `generated-composition/` before | relative imports under `generated/` |
| --- | --- | --- | --- |
| angular | 15 files, **0** violations | **3** (`Content` ×2, `import:./M1-panel#Panel`) | **0** |
| vue | 16 files, **0** violations | **1** (`import:./M1-panel.vue#default`) | **0** |
| svelte | 16 files, **0** violations | **3** (`RenderTag`, `Component`, `import:./M1-panel.svelte#default`) | **0** |

That reproduces T017's evidence exactly, and the last column is the load-bearing one: **the new
policy cannot fire on a standing corpus**, because no lane's `generated/` contains a relative import
at all.

The emitter substitutions were read at their source, `moduleImportSpecifiers` in each lane's
`src/emitter/index.ts`, not assumed from React's:

- angular: `.tsrx` → **dropped entirely** (`./M1-panel.tsrx` → `./M1-panel`)
- vue: `.tsrx` → `.vue`
- svelte: `.tsrx` → `.svelte`

React's is `.tsrx` → `.jsx` **and basename-only**, and React additionally filters by
component-reference target. None of the three lanes do either, because none of their emitters do:
all three lower **every** `tsrx-module` import unconditionally. A mirror stricter than the emitter
would fail on output the emitter is entitled to write, so each lane's mirror reproduces its own
emitter and nothing else.

---

## 2. Ruling 1 — relative specifiers leave the inventory

Each lane's gate gained, in `src/gate/index.ts`:

- `RELATIVE_SPECIFIER` — `/^\.\.?\//`, the predicate that removes a specifier from `observeForms`'
  `import:` domain. Only `./` and `../`. Every bare package specifier still reaches the inventory.
- `recordedRelativeImportSpecifiers(artifact)` — mirroring React's, with the lane's own
  substitution.
- `observeRelativeImports(...)` and `undisclosedImportViolations(...)`.
- A new published policy `undisclosed-import`, **not** `requiresArtifact` — the same asymmetry React
  records. With no artifact the recorded set is empty, so a relative import is a **violation**, not
  `unevaluated`. Parking it would make an artifact-less caller the way to make the check disappear.

### Calibration, both directions, per lane

| lane | WITH fixture artifact | WITHOUT artifact | unrecorded specifier |
| --- | --- | --- | --- |
| angular | **0** violations, **0** unevaluated | exactly **1**, `undisclosed-import` on `M2-page.ts` line 3 | RED, `undisclosed-import` |
| vue | **0** violations, **0** unevaluated | exactly **1**, `undisclosed-import` on `M2-page.vue` line 3 | RED, `undisclosed-import` |
| svelte | **0** violations, **0** unevaluated | exactly **1**, `undisclosed-import` on `M2-page.svelte` line 3 | RED, `undisclosed-import` |

The "0 unevaluated" half is the one that is easy to lose: a tier gated without artifacts is "clean"
only because the artifact-required policies never ran.

### The inventory kept its package duty

All three foreign-import mutation rows still draw `baseline-form-inventory`, run individually and
confirmed green:

- svelte `rejects an import of on() from svelte/events` → `svelte/events#on`
- vue `rejects a runtime import the emitter has no ruling for` → `vue#watchEffect`
- angular `rejects a runtime import the emitter has no ruling for` → `@angular/core#NgZone`

### `generated-composition/` still does NOT go through `checkGeneratedFiles()`

That entry point supplies no artifact. Routing the tier through it would re-introduce exactly the
blindness the coverage rows exist to remove, and React and Solid do not do it either. The standing
corpus is still `generated/` only, in every lane.

---

## 3. Rulings 2 and 3 — the admissions, and both inversions

- **angular `template-node:Content`**, floor `2.0`, `unverified`, reason 1000+ characters. Below the
  lane's 19.0 standalone floor, so `ANGULAR_BASELINE_FLOOR` cannot move.
- **svelte `template-node:RenderTag`** and **`template-node:Component`**, floor `5.0`, both
  `unverified` with distinct reasons — see §5.

`ANGULAR_BASELINE_FLOOR` measured **19.0 before and 19.0 after**. The full 17.0 tier list is
byte-identical across the change:

```
floor 17.0: control-flow:@else, control-flow:@for, control-flow:@if,
            template-node:ForLoopBlock, template-node:IfBlock, template-node:IfBlockBranch
```

Inventory sizes: angular 32 → 33, vue 17 → 17, svelte 16 → 18.

### Both must-reject rows INVERTED, neither deleted

- **angular** `rejects a template node kind above the emitted surface: ng-content` → now
  `accepts <ng-content>, the admitted form, and rejects @switch, which the emitter has no route to`.
  The `<ng-content>` arm is inverted (asserts the form is accepted, and pins its recorded floor),
  and a new rejecting arm is added.
- **svelte** `rejects template forms outside the inventory: {@html}, {@render}, {#key}` → now
  `... {@html}, {#key} - and ACCEPTS {@attach}, {@render}`. The `{@render}` arm is inverted; the
  `{@html}` and `{#key}` arms are untouched and are what keep the row biting. This file's own
  precedent is one card old: the `{@attach}` arm was inverted, not deleted, when `AttachTag` was
  inventoried.

**The svelte contradiction was real and the T017 dispatch named only angular's.** `svelte/test/
gate.test.ts` planted `{@render thing()}` as a must-reject while `generated-composition/
M1-panel.svelte` shipped `{@render children?.()}` from the day composition landed — the identical
shape as angular's `<ng-content>` case. Both were resolved together.

---

## 4. Choosing angular's replacement — corpus-wide absence is NECESSARY AND NOT SUFFICIENT

**This is the card's brief error.** The dispatch said to choose the new angular template-node kind
"BY CORPUS-WIDE ABSENCE, not preference". Corpus-wide absence alone selects the wrong form.

Every candidate was parsed through the gate's own `collectEmittedForms` against all 18 files of
`generated/` + `generated-composition/`. The kinds actually observed corpus-wide are exactly:
`BoundAttribute, BoundEvent, BoundText, Content, Element, ForLoopBlock, IfBlock, IfBlockBranch,
Text, TextAttribute, Variable`.

| candidate | novel form produced | verdict |
| --- | --- | --- |
| `<ng-container>` | **none** — the parser reports it as `Element` | **dead anchor**, would never have bitten once |
| `<b #ref>` | `template-node:Reference` | absent from the corpus **and still wrong** — see below |
| `<ng-template>` | `template-node:Template` | viable |
| `@defer` | `template-node:DeferredBlock` | viable |
| `@let` | `template-node:LetDeclaration` | viable |
| `@switch` | `template-node:SwitchBlock` | **chosen** |

`template-node:Reference` is the trap. It has **zero** occurrences across the whole corpus, so
corpus-wide absence alone endorses it — but **this emitter has a route to it**. `classMembers` in
`packages/frameworks/angular/src/emitter/index.ts` prints a `#name` template reference variable
paired with `@ViewChild('name') …?: ElementRef`. The first emitted refs scenario would retire the
replacement row all over again, which is precisely the "an anchor that has stopped biting" failure
the `inject` → `NgZone` row in that same file was written to escape.

The standard that row actually states is **a form the emitter has no route to at all**. `@switch`
meets both tests: zero occurrences in the corpus, and the string `@switch` occurs **zero times** in
the emitter — this lane lowers every conditional to `@if`/`@else`. It is also the block-structured
answer to exactly the multi-branch problem the emitter solves the other way, which is the same
relationship `NgZone` has to `notifyAfterSuspension`.

**A latent finding recorded rather than acted on:** `template-node:Reference` is *not* in
`BASELINE_FORM_INVENTORY`, and the emitter can produce it. The day a refs scenario reaches
`generated/` for this lane the gate will go red on it and the form will need admitting with a floor.
That is the inventory failing closed exactly as designed, not a defect — but it is now written down
instead of being discovered by surprise.

---

## 5. Floor evidence for the svelte admissions, measured at the pin

T017 recorded that the svelte floors were undated and left the choice to this card: verify a
citation inside the resolved package, or record an `unverified` reason over 40 characters. Measured
against `svelte@5.56.8` as resolved:

- The `Snippet` interface in `types/index.d.ts` carries a doc comment naming `{@render ...}` and
  **no `@since` tag**. The nearest tags in that file are `5.42`, `5.40.0`, `5.36`, `5.29` — the
  package tags exactly the members that arrived *after* 5.0.
- The AST `RenderTag` and `Component` interfaces in the same file carry **no `@since`**.
- The package ships **no CHANGELOG**.

So nothing on disk dates either form and both are recorded `unverified`, with reasons well over 40
characters. They do **not** share `TEMPLATE_FLOOR_REASON`, and the difference is the point: that
string says the construct *predates Svelte 5 and is unchanged by it*, which is true of `Component`
and **false of `RenderTag`** — snippets arrived with Svelte 5, so 5.0 is a tight bound there rather
than a loose one. Reusing the shared string would have recorded a claim nobody measured.

---

## 6. Every debt pin died, and each is killed both ways

The three `DEBT PIN: generated-composition/ … STILL DRAWS violations` rows are gone. **A pin left
standing after its debt is paid is a check that cannot fail** — those rows asserted that the
directory still draws violations, so once the forms were ruled they could only be satisfied by not
applying the ruling.

Each is replaced by a row in React's shape,
`discovers and gates every generated composition module with its fixture artifact`, asserting **0
violations AND 0 unevaluated**, with the tier supplied file-by-file paired with the fixture artifact
it was emitted from. The pairing is derived from `compositionFixtures` — the same list the
regeneration script writes the directory from — so a fixture that is added or renamed cannot leave a
file gated without its artifact.

Each is killed **both ways** by two new rows per lane:

1. **On-disk artifact mutation** — the committed bytes are read and the emitted specifier is changed
   to one the artifact does not record, *with the real artifact still supplied*; `undisclosed-import`
   must fire exactly once. The same row also withdraws the artifact from the **unmutated** bytes and
   requires the red to reopen, which is what distinguishes "the policy consults the artifact" from
   "the policy is satisfied by the source alone", and asserts the result is a violation and **not**
   `unevaluated`.
2. **Inventory-entry removal** — the tier's observed forms are measured against
   `BASELINE_FORM_INVENTORY` minus the admitted entry, and the uncovered set must be exactly that
   entry. This is red if the entry is removed *and* red if the observation is lost, which are the
   two ways the green could become a lie.

Neither writes to disk; both read the committed bytes, exactly as every other mutation row in these
files does.

**The vue entry-removal row was chosen by measurement, not by symmetry.** The obvious pick was a
package `import:` row, to show the package half of the inventory still reaches the tier. Measured,
**the vue composition tier observes no `import:` form at all** once relative specifiers leave the
domain: `M1-panel.vue` imports nothing and `M2-page.vue`'s only import is the relative one. An
`import:vue#ref` expectation would have asserted something about a form that is not in those two
files. The row uses `macro:defineProps`, and the package duty is proved where the forms actually
are — the `vue#watchEffect` mutation row over `generated/`.

Two other standing rows moved with the ruling rather than being left stale:

- angular `MUTATION: a form on the FIRST of two components is rejected, not skipped` — its control
  asserted that unmutated `C1-slot.ts` draws exactly one violation. It now draws **none**, so the
  expectation is `[]`. The control got *stronger*: it no longer has to tolerate an unruled form.
- svelte's `no-useless-mustaches` pinning from T018 was carried into the new coverage row intact,
  both halves — `label="Composed"` present and `={'` absent anywhere.

---

## 7. Full verification

| gate | result |
| --- | --- |
| angular node suite | 8 files, **169 passed** |
| vue node suite | 6 files, **158 passed** |
| svelte node suite | 6 files, **135 passed** |
| `pnpm test` | **exactly 1 failure**, 1380 passed |
| `pnpm check` | **251** — ceiling is 267 |
| `pnpm e2e` | **PASS**, 6 demos × 9 scenarios, all observations equal |
| `pnpm lint` | 0 warnings, 0 errors over 552 files, 93 rules |
| `pnpm check:citations` | clean, 4 watched documents, 17 watched source files, 604 swept |

**`pnpm test`'s single failure is the foreign one and the control is exact.** It is
`packages/compiler/test/package-inventory.test.ts > ARM B: every shared consumer resolves to its
recorded peer-suffix key`, which reads the owner's pre-existing modified `pnpm-lock.yaml`. Measured
with this card's seven files stashed, the **same** single failure is present at HEAD with **1374
passed**. 1380 − 1374 = **+6**, which is exactly the six rows added: two per lane.

**`pnpm check` was verified by SET DIFF, not by count.** The sorted `error TS` lines were captured
with the changes applied and again with all seven files stashed; `diff` between them is **empty**.
251 is this card's own measurement in both arms — not an agreement with T018 or T017.

**Owner fingerprint, measured by this card with RELATIVE paths and the board's recorded method
(sort the whole `shasum` output lines):**

| path | START | FINISH |
| --- | --- | --- |
| `pnpm-lock.yaml` | `f326d314` | `f326d314` |
| `pnpm-workspace.yaml` | `aeb7edc1` | `aeb7edc1` |
| `website/` (116 files) | `f936e169` | `f936e169` |

**This independently confirms the board and refutes T017's and T018's `24edb270 / 30403cba /
f1a06e0f` for a third time.** The method matters and this card measured that too: sorting the
**paths** before hashing gives `b1dd182a`, which is exactly the value the board's own parenthetical
records as the wrong answer. The tree digest is sensitive to the sort key as well as to the path
form.

Foreign processes PID 64413 (port 5175, started Mon Jul 27 00:48:52) and PID 24931 (port 5178,
started Thu Jul 30 15:55:20) were alive with their original start times throughout. `pkill -f` was
never used.
