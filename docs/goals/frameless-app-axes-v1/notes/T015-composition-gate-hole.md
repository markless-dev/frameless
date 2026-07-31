# T015 — the gate corpus, measured per lane and per output directory

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `f3d751c` · **not committed**.

**Result: `blocked`.** The measurement is complete and the closures that needed no ruling
are landed. **Three uninventoried forms across three lanes need a ruling this card could
not make from the six-gate policy alone**, and the card's own `stop_if` says record and
stop. They are named in §4.

**Nothing was admitted to any `BASELINE_FORM_INVENTORY`. No emitter and no emitted
artifact was modified.** Every `generated*/` tree in the repo is byte-identical to
`f3d751c`.

---

## 1. Owner fingerprint — START and FINISH, IDENTICAL

Method, as the charter mandates: **sort the whole `shasum` OUTPUT LINES** — not the digest
column, not the paths.

| path | START | FINISH | expected |
|---|---|---|---|
| `pnpm-lock.yaml` | `f326d314…` | `f326d314…` | `f326d314` ✅ |
| `pnpm-workspace.yaml` | `aeb7edc1…` | `aeb7edc1…` | `aeb7edc1` ✅ |
| `website/` (whole lines sorted) | `f936e169…` | `f936e169…` | `f936e169` ✅ |
| `website/` file count | 116 | 116 | 116 ✅ |

Nothing under those three paths was read for content, moved or written. Both foreign
processes were alive at START and at FINISH with their original start times — node PID
`64413` on 5175 (started Mon Jul 27 00:48:52) and PID `24931` on 5178 (Thu Jul 30
15:55:20). **`pkill -f` was never used, on any pattern.**

---

## 2. THE DELIVERABLE — six lanes × three generation tiers

**What is a lane's "gate corpus"?** In all six lanes it is one call:
`checkGeneratedFiles()` in `test/gate.test.ts`, which resolves
`discoverGeneratedFiles({ directory })` and defaults `directory` to `'generated'`. **Every
lane's gate already accepts a `directory` option. Not one lane other than React and Solid
had ever passed one.**

Measured by running each lane's own `discoverGeneratedFiles` + `checkSources` against each
tier that exists in that package.

### 2.1 Before this card

| lane | `generated/` | `generated-composition/` | `generated-persistence/` |
|---|---|---|---|
| **react** | **GATED** — 17 files, 0 violations | **GATED, WITH ARTIFACTS** — 10 files, 0 violations, 0 unevaluated | present (1 file), gated **by filename** in `emitter.test.ts`; **never discovered** |
| **solid** | **GATED** — 17 files, 0 violations | **GATED, WITH ARTIFACTS** — 10 files, 0 violations, 0 unevaluated | present (1 file), gated **by filename** in `emitter.test.ts`; **never discovered** |
| **qwik** | **GATED** — 17 files, 0 violations | **UNGATED** — 3 files; 0 violations when pointed at it | absent |
| **svelte** | **GATED** — 16 files, 0 violations | **UNGATED** — 2 files; **4 violations** | absent |
| **vue** | **GATED** — 16 files, 0 violations | **UNGATED** — 2 files; **1 violation** | absent |
| **angular** | **GATED** — 15 files, 0 violations | **UNGATED** — 3 files; **2 violations** | absent |

### 2.2 After this card

| lane | `generated/` | `generated-composition/` | `generated-persistence/` |
|---|---|---|---|
| **react** | GATED | **already covered — REPORTED, NOT REPAIRED** | **discovery closed** |
| **solid** | GATED | **already covered — REPORTED, NOT REPAIRED** | **discovery closed** |
| **qwik** | GATED | **CLOSED** — standing row + calibration + mutation | absent |
| **svelte** | GATED | **DEBT PIN** — 4 violations asserted as a literal | absent |
| **vue** | GATED | **DEBT PIN** — 1 violation asserted as a literal | absent |
| **angular** | GATED | **DEBT PIN** — 2 violations asserted as a literal | absent |

**There is no longer an output directory anywhere in `packages/frameworks/` that no test
opens.** Four of them are gated clean; three are pinned as exact, named, falsifiable debt.

### 2.3 The exact violation set in the three lanes that are not clean

Measured identically **with** and **without** the fixture artifacts, so the numbers below
are not an artifact of how the probe was called (see §3.1 for why that control exists).

**angular** — `generated-composition/`, 2 violations, 2 forms:

| file | policy | uninventoried form |
|---|---|---|
| `M1-panel.ts` | `baseline-form-inventory` | `template-node:Content` (`<ng-content />`) |
| `M2-page.ts` | `baseline-form-inventory` | `import:./M1-panel#Panel` |

**vue** — `generated-composition/`, 1 violation, 1 form:

| file | policy | uninventoried form |
|---|---|---|
| `M2-page.vue` | `baseline-form-inventory` | `import:./M1-panel.vue#default` |

**svelte** — `generated-composition/`, 4 violations, 3 forms **plus one that is not a form
question at all**:

| file | policy | detail |
|---|---|---|
| `M1-panel.svelte` | `baseline-form-inventory` | `template-node:RenderTag` |
| `M2-page.svelte` | `baseline-form-inventory` | `template-node:Component` |
| `M2-page.svelte` | `baseline-form-inventory` | `import:./M1-panel.svelte#default` |
| `M2-page.svelte` | `eslint:svelte/no-useless-mustaches` | **a third-party arbiter finding — see §5.3** |

---

## 3. Three claims on the dispatch that MEASUREMENT REFUTED

### 3.1 "FIVE violations across THREE uninventoried forms" — it was **FOUR**

T009's ruling recorded, and the T015 card repeated verbatim:

> "Run by hand, `generated-composition/` draws **FIVE** `baseline-form-inventory`
> violations across **THREE** uninventoried forms."

**The three forms are right. The count is not.** `inventoryViolations` **dedupes per file
per `kind:form`**, so the count is the number of distinct `(file, kind:form)` pairs:

| file | pre-T014 uninventoried forms | count |
|---|---|---|
| `C1-slot.ts` | `component-metadata:imports` | 1 |
| `M1-panel.ts` | `template-node:Content` | 1 |
| `M2-page.ts` | `component-metadata:imports`, `import:./M1-panel#Panel` | 2 |
| | | **4** |

Reconstructed exactly, not estimated: `git diff 9314115..f3d751c` over
`angular/src/gate/index.ts` is **+15 lines, all of them the one inventory entry** —
`observeForms` and `inventoryViolations` are byte-identical across T014 — and
`generated-composition/` has not changed since `98bbef2`. So removing
`component-metadata:imports` from the set reproduces the pre-T014 state precisely, and it
yields **4**.

At HEAD it is **2 across 2**, which is consistent with the card's "T014 retires one of the
three".

**Where the fifth probably came from, and it matters:** `C1-slot.ts` contains
`<ng-content />` too — inside `Frame`. Counted by eye it looks like a second `Content`
violation. The gate does not report it, for the reason in §5.1.

### 3.2 "`notes/T003-hn-item.md` still says the decorator *must list its own selector's provider*" — **it never said it**

T009's ruling, T014's note **and this card's dispatch** all state that the wording is in
`notes/T003-hn-item.md`. **It is not, and it never was.** `provider`, `must list` and `own
selector` do not occur anywhere in §1–§12 of that file.

The sentence lived in `packages/frameworks/angular/test/ungated-scenarios.ts`, which T014
**deleted**:

> "…a recursive standalone component whose decorator **must list its own selector's
> provider** — `imports: [HnItem]`…"

So it was corrected by deletion, one card before this one. Three documents cited each other
rather than the source, and the claim survived three hops. **The other half of the dispatch
is entirely correct**: the floor claim *is* in `T003-hn-item.md` at line 146, it *is*
false, and it is corrected in §13 of that file.

### 3.3 "measure whether it exists in the other **five** lanes" — it exists in **three**

React and Solid **already gate their composition tier, with artifacts, at 0 violations and
0 unevaluated policies**. Per the card, they are reported as such and were not repaired.
The hole was in **four** lanes, and only **three** of those are dirty.

---

## 4. THE RULINGS THIS CARD DID NOT MAKE — record and stop

The card's `stop_if` reads: *"A form needs a ruling you cannot make from the six-gate
policy alone — RECORD IT AND STOP."* Three forms are in that category, and they are one
question, not three.

### 4.1 `import:./M1-panel#Panel` (angular) · `./M1-panel.vue#default` (vue) · `./M1-panel.svelte#default` (svelte)

**Every `import:` entry in all three inventories today is a FRAMEWORK PACKAGE specifier
carrying a version floor:**

| lane | every `import:` entry it has |
|---|---|
| angular | `@angular/core#Component`, `#Input`, `#OnInit`, `#ChangeDetectorRef`, `#inject` |
| vue | `vue#ref`, `vue#computed` |
| svelte | `svelte#untrack` |

A **relative sibling module** specifier is not a framework API. It has **no framework
version floor at all**, so the inventory's own contract — "each entry carries the version
floor claimed for it" (`docs/emitter-idiom-policy.md`, *The baseline form inventory*) — has
nothing to record. Worse, admitting the literal `./M1-panel#Panel` **allowlists one
filename**: the next composed pair reopens the identical red, in all three lanes, forever.

The two principled answers are both **structural**:

1. **Exclude relative specifiers from the inventory's domain.** They are not
   version-gated forms; `observeForms` is over-reporting rather than the inventory
   under-listing. This changes what the inventory *means*.
2. **Verify them against the artifact instead.** React and Solid already do exactly this
   with the `undisclosed-import` policy and `recordedRelativeImportSpecifiers(artifact)`
   — which is precisely why their composition tier is clean while these three are not, and
   it is the strongest evidence for which answer is right.

Either is a **cross-lane architecture decision**. It is also mechanically out of reach
here: `packages/frameworks/vue/src/gate/index.ts` and
`packages/frameworks/svelte/src/gate/index.ts` are **not in this card's `allowed_files`**,
and fixing angular alone would put three lanes carrying one form onto two different
mechanisms.

### 4.2 `template-node:Content` (angular) — blocked by a standing test, not by a floor

On its own this is the easy one: `<ng-content />` is Angular's content-projection node,
present since 2.0, with **no alternative spelling**, so the six-gate *sugar* procedure does
not engage (T009's own reasoning for `imports`) and it would be a straight admission at
floor `2.0`, evidence `unverified`, alongside the seven other `template-node` entries at
that floor.

**It is not on its own.** See §5.2 — this lane ships a standing mutation row that uses
`<ng-content>` as its example of a form that **must be rejected**. Admitting the form
retires that row's chosen construct, which is a decision about what the lane's emitted
surface *is*. And admitting it alone would still leave `M2-page.ts` red, so the directory
still could not join the corpus.

### 4.3 `template-node:RenderTag`, `template-node:Component` (svelte)

Out of reach mechanically: `packages/frameworks/svelte/src/gate/index.ts` is not in
`allowed_files`. Recorded with floors **unmeasured**, deliberately — the card's rule is
that evidence is `unverified` unless it is actually dated, and *presence at the pin is not
a floor*. All 16 svelte entries, all 17 vue entries and all **32** angular entries are
`unverified` today.

### 4.4 The derived floor, printed before and after

| | before | after |
|---|---|---|
| `ANGULAR_BASELINE_FLOOR` | **`19.0`** | **`19.0`** |
| `BASELINE_FORM_INVENTORY` entries | 32 | 32 |
| entries at the floor | exactly `['(no standalone key)']` | exactly `['(no standalone key)']` |
| entries with `unverified` evidence | 32 of 32 | 32 of 32 |

**It is unchanged because nothing was admitted.** Angular is also the **only** lane of the
six that derives a floor at all — `grep -rn "export.*BASELINE_FLOOR"` returns exactly one
hit. Svelte and Vue ship an inventory with per-entry floors and **no derived lane-wide
constant**, so "the derived floor" is an angular-only quantity and the card's before/after
instruction has no referent in the other five lanes. Recorded rather than silently skipped.

---

## 5. FOUR THINGS FOUND THAT NOBODY WAS LOOKING FOR

### 5.1 Angular's gate parses only the LAST `@Component` in a file

`parseEmitted` walks the module and **overwrites** its `component` binding on every match:

```ts
walkTs(module, (node) => {
	if (node.type === 'ClassDeclaration' && decoratorNamed(node, 'Component')) component = node;
});
```

so in a multi-component module **only the last class is inspected** — its metadata, its
class members and its template. `generated-composition/C1-slot.ts` declares `Frame` then
`SlotPage`; **`Frame` is never parsed**, and its `<ng-content />` is never observed. That
is why `C1-slot.ts` reports **zero** uninventoried forms while `M1-panel.ts` reports
`Content` for the identical construct, and it is the most likely origin of the phantom
fifth violation in §3.1.

**Blast radius, measured:** `C1-slot.ts` is the **only** multi-component emitted file in
the whole package — every one of the 15 files in `generated/` has exactly one
`@Component({`. So `generated/` is unaffected today. That fact is now asserted in
`angular/test/gate.test.ts`, so it cannot stop being true unnoticed.

This is not repaired here. Widening `parseEmitted` would surface `Frame`'s forms and put
another unruled form in front of the same blocked ruling.

### 5.2 The angular lane asserts that `<ng-content>` must be rejected, and ships it

`packages/frameworks/angular/test/gate.test.ts` carries a standing mutation row:

```
test('rejects a template node kind above the emitted surface: ng-content', …)
```

It plants `<ng-content></ng-content>` into S1 **as its example of a form this lane must
reject** — while `generated-composition/M1-panel.ts` has been shipping `<ng-content />`
since composition landed. **The package asserts both at once**, and only ever got away with
it because the corpus was `generated/` only. Confirmed by mutation: admitting
`template-node:Content` to the inventory turns **that row** red as well as the debt pin.

This is the sharpest available statement of what an un-inspected output directory costs. It
is not a form drifting in unannounced; it is a **direct contradiction between a standing
test and a committed artifact**, held for the entire life of the composition tier.

### 5.3 A third-party arbiter has been reporting a svelte emitter finding to nobody

`eslint:svelte/no-useless-mustaches` fires on `generated-composition/M2-page.svelte`:

> Unexpected mustache interpolation with a string literal value.

The emitter prints `label={'Composed'}` for a static string prop where `label="Composed"`
is the idiomatic spelling. **This is an emitter finding, not an inventory question** —
upstream said so from the day the file was committed and **nothing was listening**. It is
**not** repaired here: the card's `stop_if` forbids modifying an emitter to satisfy a gate,
and silencing the rule would be worse. It needs its own card. The pin asserts the *spelling*
as well as the violation, so an emitter that stops printing it turns the row red rather
than leaving a stale expectation.

### 5.4 React's and Solid's persistence tier was gated by filename, never discovered

`generated-persistence/P1.tsx` **is** gated with its artifact — in `emitter.test.ts`, right
next to the emit that produces the record, which is the right place for it. But **nothing
in either package ever asked the directory what it contains.** A second persisted artifact
would have shipped with no policy pointed at it and every row in the repo would have stayed
green. Same family, one tier along. Closed.

---

## 6. What was changed, and the mutation that killed each row

**Six files, all of them a lane's `test/gate.test.ts`, plus one gate source that was
mutated and restored.** No emitter, no emitted artifact and no `src/` change survives in
the diff.

| lane | row added | mutation that proved it can go red |
|---|---|---|
| qwik | `discovers and gates every generated composition module` + `CALIBRATION: … missing file, an extra file, and a mutant` | **on-disk mutation**: planted `useVisibleTask$` into `generated-composition/M1-panel.tsx` → row **RED** on `no-visible-task` ×2. Artifact restored, `git diff --exit-code` clean |
| angular | `DEBT PIN: generated-composition/ …` | **inventory mutation**: added `Content` to `BASELINE_FORM_INVENTORY` → pin **RED**, *and it also turned the pre-existing `ng-content` rejection row red* (§5.2). Gate restored |
| vue | `DEBT PIN: generated-composition/ …` | **on-disk mutation** of `generated-composition/M2-page.vue` → pin **RED**. Artifact restored |
| svelte | `DEBT PIN: generated-composition/ …` | **on-disk mutation**: `label={'Composed'}` → `label="Composed"` → pin **RED**. Artifact restored |
| react | `discovers the whole generated-persistence tier…` | **planted an extra file** in `generated-persistence/` → row **RED**. File removed |
| solid | `discovers the whole generated-persistence tier…` | **planted an extra file** in `generated-persistence/` → row **RED**. File removed |

**Every row was also confirmed to actually execute**, by name, under
`--reporter=verbose`. A row that is never collected is the same green as a row that
measures nothing.

### 6.1 Why the pins assert a literal violation set rather than a count

A count is satisfied by *any* N violations, including N the emitter never used to produce.
Each pin asserts the `(file, policy)` pairs **and** the quoted form inside the message, so
the day a form is ruled, a fixture is added, or an emitter changes, the row goes red and the
decision is re-taken. Each also carries an anti-vacuity half — vue asserts `M1-panel.vue`
is clean through the same call, angular asserts `C1-slot.ts` is clean *for both of its two
independent reasons* — so "this gate rejects the directory wholesale" is excluded.

**A debt pin is not coverage, and every one of them says so in its first line.**

### 6.2 The control that stopped this card filing a false report

The first probe ran every lane's `checkGeneratedFiles({ directory })` **source-only**, and
reported that **React and Solid each draw an `undisclosed-import` violation** on
`generated-composition/M2-page.tsx`.

That is a false divergence. Their standing rows pass the **fixture artifacts**, and
`undisclosed-import` is checked against `recordedRelativeImportSpecifiers(artifact)` —
with the artifact it resolves and both lanes are clean at **0 violations, 0 unevaluated**.
Re-run in both modes, side by side, before anything was written down.

Reporting the first number would have opened two repairs against two lanes that were
already correct — and it is the identical failure T014 caught in its browser instrument one
card ago, by the identical method: **run the instrument against a second lane as a
control.** The four lanes that *are* dirty were re-measured the same way, and their numbers
are **identical with and without artifacts**, which is what makes §2.3 a property of the
artifacts rather than of the probe.

---

## 7. Verification

| check | result |
|---|---|
| `pnpm test` | **1 failed / 1357 passed** — the one failure is the known foreign ARM B (`compiler/test/package-inventory.test.ts` peer-suffix keys, from the owner's already-dirty `pnpm-lock.yaml`). T014 left **1350** passed; **+7 is exactly the seven rows added here** |
| `pnpm check` | **267** — did not rise. Verified by **set diff, not by count**: the error set was captured with the six test edits stashed and again with them applied, and the **only** difference in 267 lines is one pre-existing `qwik/test/gate.test.ts` error moving from line 180 to 184, shifted by the four-line import |
| `pnpm e2e` | **PASS — 6 demos × 9 scenarios, all observations equal**; six official-demo receipts written |
| `pnpm lint` | 0 warnings, 0 errors, 552 files |
| `pnpm check:citations` | clean — 4 watched documents, 17 watched source files, 604 swept |
| `git diff --exit-code` over every `generated/`, `generated-composition/`, `generated-persistence/` and `demos/*/src/emitted/` path | **exit 0**, paired with `git status --short` |
| owner fingerprint | `f326d314` / `aeb7edc1` / `f936e169` / 116 files — **identical at START and FINISH** |
| foreign processes | PID `64413` (5175, started Jul 27 00:48:52) and PID `24931` (5178, Jul 30 15:55:20) **alive at both ends with original start times**; `pkill -f` never used |

`pnpm-lock.yaml` and `pnpm-workspace.yaml` show as modified in `git status` — **they were
already modified before this card started**, and their digests match the expected owner
fingerprint at both ends, so nothing here touched them. `website/` is untracked and
byte-identical.

---

## 8. For the next card

1. **RULE the relative-import form, once, for all three lanes** (§4.1). It is one decision
   with two candidate mechanisms and React/Solid already ship the better one. Until it is
   taken, `generated-composition/` cannot enter the standing corpus in angular, vue or
   svelte, and the three debt pins are the honest state.
2. **RULE `template-node:Content` together with the `ng-content` mutation row** (§4.2,
   §5.2). Whichever way it goes, both sites move together.
3. **The svelte `{'Composed'}` emitter finding needs its own card** (§5.3). It is not a
   gate problem and must not be closed by silencing a rule.
4. **`parseEmitted` sees one component per file in the angular gate** (§5.1). Harmless
   today, and asserted so it stays harmless; it must be fixed *before* any multi-component
   module reaches `generated/`.
5. **The count in T009's ruling reads 5 and measures 4** (§3.1). The board's own record
   should carry the correction; this note is where it is recorded, since the ruling text
   itself is landed verbatim and must not be edited.
