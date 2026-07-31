# T018 — the two emitter-adjacent findings T015 was forbidden to touch

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `1e6cc0a` · **not committed**.

**Result: `done`.** Both findings are closed at their source. The svelte emitter no
longer prints a useless mustache, and the angular gate no longer inspects half a
file. **No eslint rule was silenced. Nothing was admitted to any
`BASELINE_FORM_INVENTORY`.** Exactly one emitted byte-range moved, in one file, and
it was REGENERATED.

**Two errors in the dispatch, both measured, both in §5.**

---

## 1. Owner fingerprint — START and FINISH, IDENTICAL — and the brief's numbers do not match this tree

Method as the charter mandates: **sort the whole `shasum` OUTPUT LINES**, not the
digest column and not the paths.

| path | START | FINISH | the brief expected |
| --- | --- | --- | --- |
| `pnpm-lock.yaml` | `24edb270…` | `24edb270…` | `f326d314` ❌ |
| `pnpm-workspace.yaml` | `30403cba…` | `30403cba…` | `aeb7edc1` ❌ |
| `website/` (whole lines sorted) | `f1a06e0f…` | `f1a06e0f…` | `f936e169` ❌ |
| `website/` file count | 116 | 116 | 116 ✅ |

**This is not drift caused by this card — the START reading was taken before any
file was opened.** See §5.2 for what it is instead. The guarantee that matters
holds: **START == FINISH, byte-identical**, and nothing under those three paths was
read for content, moved or written.

Both foreign processes alive at START and at FINISH with their original start
times — node PID `64413` on 5175 (`Mon Jul 27 00:48:52 2026`) and PID `24931` on
5178 (`Thu Jul 30 15:55:20 2026`). **`pkill -f` was never used, on any pattern.**

---

## 2. FINDING 1 — the svelte emitter's useless mustache

### 2.1 What it was

`renderComponentReference` sent every component prop through `printExpression`, so
the authored

```tsx
<Panel label="Composed">
```

came back out of the emitter as `label={'Composed'}`.
`eslint-plugin-svelte`'s `svelte/no-useless-mustaches` reported *"Unexpected
mustache interpolation with a string literal value"* on
`generated-composition/M2-page.svelte` from the day the file was committed.

### 2.2 The fix, and the equivalence it rests on — MEASURED, not asserted

`quotableStringProp` in `packages/frameworks/svelte/src/emitter/index.ts` prints a
plain string-literal prop as the quoted attribute. A regex literal is excluded
(also `type: 'Literal'`), and a value containing a newline stays a mustache because
a raw line break inside a start tag is not modelled by the width arithmetic.

Equivalence measured through **svelte's own compiler at 5.56.8** — the only
authority on whether two spellings are the same component:

| pair | `client` dev+prod | `server` dev+prod |
| --- | --- | --- |
| `label={'Composed'}` vs `label="Composed"`, childless and with children | **byte-identical `js.code`** | **byte-identical** |
| `label={''}` vs `label=""` | **byte-identical** | **byte-identical** |
| `label={'a&<>{}"b'}` vs the `escapeAttributeValue` entity spelling | **byte-identical** | **byte-identical** |

The third row is the load-bearing one: it proves the entity round-trip is lossless
rather than passing a different string.

### 2.3 The asymmetry, recorded so it is not read as an oversight

**It is deliberately NOT applied to host attributes.** For a host the two spellings
are *not* the same compiled artifact:

```
<p data-x="y">t</p>   ->  from_html(`<p data-x="y">t</p>`)          — baked into the template
<p data-x={'y'}>t</p> ->  from_html(`<p>t</p>`); set_attribute(...)  — set at runtime
```

Server output is identical; client output is not. Behaviourally equivalent, but a
different compiled artifact, and a different decision from the one this card was
dispatched to make. **There are zero `={'` occurrences under svelte's `generated/`,
so no emitted byte turns on it either way** — measured before the change.

### 2.4 The derivation proof

`generated/` (16 files) and `generated-composition/` (2 files) were **deleted
first**, `PRESENT-AFTER-DELETE` asserted **0**, then both regenerated from their
scripts.

| | files | result |
| --- | --- | --- |
| `generated/` | 16 | **byte-identical to committed, all 16** |
| `generated-composition/M1-panel.svelte` | 1 | **byte-identical** |
| `generated-composition/M2-page.svelte` | 1 | **MOVED** — `label={'Composed'}` → `label="Composed"` |

One line, one file, one hunk. `svelte/generated/` is not in this card's
`allowed_files`; it was proved unmoved rather than assumed, and the delete-first
control is what makes that a real comparison instead of two untouched sets.

### 2.5 The gate delta

`checkSources` over `generated-composition/`: **4 violations → 3**. The one that
went is `eslint:svelte/no-useless-mustaches`. The three that remain are the
unruled inventory forms `template-node:RenderTag`, `template-node:Component` and
`import:./M1-panel.svelte#default` — **T017's cross-lane ruling, untouched.**

---

## 3. FINDING 2 — the angular gate saw only the last `@Component`

### 3.1 What it was

`parseEmitted` overwrote its `component` binding on every match, so a module
declaring two components was inspected **only at the last one** — its metadata, its
class members and its whole template.

The split that let it hide: **the module-scoped policies were always correct.**
`no-signal-members`, `no-output-emitter`, `no-stop-propagation` and the
import/decorator half of `observeForms` walk `module`. Only the component-scoped
half was blind: `baseline-form-inventory`, `whitespace-stable-text`,
`no-two-way-binding`, `no-change-detection-override`, `getter-expression-purity`
and `template-parse`.

### 3.2 The fix

`Parsed` now carries `components: readonly ParsedComponent[]` — every
`@Component`-decorated class in source order, each with its own metadata, template,
template line, parsed template nodes and template errors. The six component-scoped
policies iterate it; the module-scoped four are untouched, so they cannot start
double-reporting. `sourceViolations` refuses on `components.length === 0` where it
used to refuse on a null component.

`inventoryViolations` still dedupes **per file** per `kind:form`, so the count
semantics T015 established are preserved rather than silently changed to
per-component.

### 3.3 THE THING THIS CARD WAS TOLD TO WATCH FOR — measured on both gates, side by side

| directory | in the standing corpus? | HEAD gate | fixed gate |
| --- | --- | --- | --- |
| `generated/` (15 files) | **yes** | **0 violations** | **0 violations** |
| `generated-composition/` (3 files) | **no** | **2 violations** | **3 violations** |

**NO CURRENTLY-GREEN GATE TURNED RED.** `generated/` — the standing corpus, the
only directory `checkGeneratedFiles()` opens by default — is 0 before and 0 after.
`generated-composition/` was **already red at 2** and is now red at 3. It went from
red to *more* red, which is the only honest direction for a better instrument.

The new violation is `C1-slot.ts`, `template-node:Content`, **line 7** — inside
`Frame`, the first of that file's two components, the one the old parser threw
away. **This is T015 §3.1's phantom fifth violation. It was real, and it is now
counted by the gate rather than by eye.**

**Nothing was admitted to `BASELINE_FORM_INVENTORY` to absorb it.** `Content` is
still uninventoried, the inventory still holds 32 entries and
`ANGULAR_BASELINE_FLOOR` is unmoved at `19.0`.

### 3.4 What went red, and why updating it is the opposite of hiding it

Exactly one test row: T015's own **DEBT PIN**, which asserted the 2-violation
literal and asserted that `Frame`'s `<ng-content />` was **NOT** seen. T015 wrote
that assertion for precisely this event:

> "Assert both, so a future `parseEmitted` that starts walking every component
> turns this red rather than silently widening what the lane claims to inspect."

It is a tripwire, it fired, and the response it asks for is to re-take the
decision in the open. The pin now asserts the **3**-violation literal, names
`C1-slot.ts`'s `Content` at its line, and states the before/after of both
directories in its comment. What the card forbade — adjusting the **inventory** so
the violation disappears — was not done and is not needed.

`generated-composition/M1-panel.ts`'s `<ng-content />` and the standing
`rejects a template node kind above the emitted surface: ng-content` mutation row
are **both untouched and both still green**. The contradiction between them is
unchanged in substance and **still T017's to rule** — it simply now covers two
shipping files instead of one. No ruling was pre-empted.

### 3.5 The mutation that kills the fix

The shipped corpus **cannot** supply it: every rejected form in it sits in a
single-component file the old parser saw anyway. So the new row builds a mutant
from the real `C1-slot.ts` and plants **three** rejected forms on the **first**
component, each reaching the gate by a different scoped path:

| plant | policy | scoped path |
| --- | --- | --- |
| `[(value)]="x"` on `Frame`'s `<section>` | `no-two-way-binding` | template nodes |
| `changeDetection: 1` on `Frame`'s decorator | `no-change-detection-override` | decorator metadata |
| an impure getter on `class Frame` | `getter-expression-purity` | class members |

Each is asserted with the **line it was reported at**, and every line is required
to fall **inside the first component** — computed off the *mutant*, not the
original, because two of the plants insert lines ahead of the second decorator. A
file-level "the gate reported something" would pass just as well if the second
component had grown the form.

The control: the unmutated artifact draws **exactly** its one known violation.

**Both new/updated rows are mutation-killed.** Reverting `parseEmitted` to HEAD
and re-running: `2 failed | 165 passed` — the debt pin and the mutation row, and
nothing else.

### 3.6 T015's blast-radius assertion still holds

`C1-slot.ts` remains the **only** multi-component emitted file: measured across
every tracked `packages/frameworks/angular/generated*` file and every
`demos/*/src/emitted/*.ts`, it is the sole file with two `@Component({` and every
other has exactly one. Asserted per file in `test/gate.test.ts`.

---

## 4. Verification

| check | result |
| --- | --- |
| `pnpm test` | **1 failed / 1374 passed** — the one failure is the known foreign ARM B (`compiler/test/package-inventory.test.ts` peer-suffix keys, from the owner's already-dirty `pnpm-lock.yaml`). **CONTROL: the same six files stashed gives 1 failed / 1372 passed, so +2 is exactly the two rows added** |
| `pnpm check` | **251** — and verified by **SET DIFF, not by count**: the error lines were captured with the six edits applied and again with them stashed, sorted, and `diff` is **empty**. Not one error moved, appeared or shifted a line |
| `pnpm e2e` | **PASS — 6 demos × 9 scenarios, all observations equal**; six official-demo receipts written |
| `pnpm lint` | 0 warnings, 0 errors, 552 files |
| `pnpm check:citations` | clean — 4 watched documents, 17 watched source files, 604 swept |
| `git diff --exit-code` over every OTHER lane's `generated*/` and `demos/*/src/emitted/` | **exit 0**, paired with `git status --short` |
| owner fingerprint | START == FINISH, 116 files — **but see §1 and §5.2** |
| foreign processes | PID `64413` (5175) and `24931` (5178) alive at both ends with original start times; `pkill -f` never used |

`pnpm-lock.yaml` and `pnpm-workspace.yaml` show modified in `git status` — they
were already modified before this card started, and their digests are identical at
START and FINISH. `website/` is untracked and byte-identical.

---

## 5. TWO ERRORS IN THE DISPATCH

### 5.1 `pnpm lint` CANNOT SEE THE SVELTE FINDING — the card's own verify names a blind instrument

The card's first verify reads:

> "`pnpm lint` reports ZERO `svelte/no-useless-mustaches` — and PROVE THE RULE
> STILL FIRES by planting one, so the green is not a disabled rule."

**`pnpm lint` has never reported that rule and never will.** It is `vp lint` —
oxlint, 93 rules — and `svelte/no-useless-mustaches` is not one of them. The rule
exists in exactly **one** instrument in this repository: the svelte gate's own
programmatic ESLint in `packages/frameworks/svelte/src/gate/index.ts`.

Measured by doing exactly what the card asked — planting the defect back into the
real artifact:

| instrument | on `M2-page.svelte` carrying `label={'Composed'}` |
| --- | --- |
| `pnpm lint` (552 files, 93 rules) | **Found 0 warnings and 0 errors** |
| `pnpm exec vp lint <that one file>` | **Found 0 warnings and 0 errors** |
| the svelte gate's `checkSources` | **`eslint:svelte/no-useless-mustaches`, line 6** |

So the card's proposed proof is **exactly the failure it was written to prevent**:
a `pnpm lint` green here is permanently indistinguishable from a disabled rule.
T015's own note also reported `pnpm lint` at 0/0 over 552 files **on the same
commit the finding was live** — the two facts were sitting next to each other and
neither document reconciled them.

**The verify is satisfied on both readings**, and the second is the real one:
`pnpm lint` is 0/0, **and** the rule is proven live at the instrument that carries
it, by a standing row that reverts the shipped artifact to the mustache and
requires upstream to still report it, with the shipped artifact's zero as the
control. The pre-existing `RED: svelte/no-useless-mustaches` row planted a **text**
mustache, which does not prove the rule reaches a component **attribute** — the
position the emitter was actually printing into. That row now carries both plants.

### 5.2 The owner-fingerprint digests in the dispatch are stale, and none of them matches this tree

The card names `f326d314` / `aeb7edc1` / `f936e169`. **All three differ from what
this working tree hashes to — measured at START, before any file was opened.**
The file count, 116, matches.

Traced rather than guessed:

- The **committed** `pnpm-lock.yaml` and `pnpm-workspace.yaml` are **byte-identical
  between `f3d751c` (T015's HEAD) and `1e6cc0a`** — `git show` on both blobs gives
  the same digests at both commits. So no commit on this board changed them.
- Therefore the change is in the **owner's uncommitted working copies** and in the
  **untracked `website/` tree**, between T015 finishing and this card starting.
- It is **not a method difference**: the path-sorted variant, the double-hash
  variant and a combined-all-three variant were each computed, and none reproduces
  the expected digests either.

**The expected digests are inherited from T015's note and are no longer true of the
tree.** They are quoted forward as a hard constraint, which is the same
citation-rot shape T015 itself caught in §3.2 — a value copied between documents
instead of re-measured at its source. The check that is actually load-bearing —
**START == FINISH** — is satisfied, and is the one reported above.

---

## 6. For the next card

1. **T017 still owns the `template-node:Content` / `ng-content`-must-reject joint
   ruling**, and it now has **two** shipping files rather than one:
   `generated-composition/M1-panel.ts` and `generated-composition/C1-slot.ts`. The
   angular debt pin is now 3 and names both.
2. **The relative-import ruling (T015 §4.1) is untouched** and still blocks
   angular, vue and svelte composition tiers from the standing corpus.
3. **The board should carry the fingerprint correction from §5.2** rather than
   passing the stale digests to a fourth card.
4. **Do not verify a lint rule with `pnpm lint` again** without checking that
   oxlint carries it. The 93-rule set and the per-lane gate ESLint configurations
   are disjoint in both directions.
