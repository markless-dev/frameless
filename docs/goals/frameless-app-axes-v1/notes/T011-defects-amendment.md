# T011 — `DEFECTS.md` 15 amended to REACT ONLY, and the static-attribute rule NARROWED rather than widened

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `726f501` ·
**not committed** · **documentation only**.

**Entry 15's title claimed all six lanes. It is react only, and the card is right
about that.** The second half of the card is where the brief was wrong: it asked
to widen T003's static-attribute rule to *"no static attribute whose DOM type is
not `string`"*, and **that formulation is refuted in both directions** by a
measurement taken here. It is filed as new entry **17** with the narrower rule.

---

## 1. Owner fingerprint — START and FINISH, IDENTICAL

Method, as the charter mandates: **sort the whole `shasum` OUTPUT LINES.**

| path | START | FINISH | expected |
|---|---|---|---|
| `pnpm-lock.yaml` | `f326d314…` | `f326d314…` | `f326d314` ✅ |
| `pnpm-workspace.yaml` | `aeb7edc1…` | `aeb7edc1…` | `aeb7edc1` ✅ |
| `website/` (lines sorted) | `f936e169…` | `f936e169…` | `f936e169` ✅ |
| `website/` file count | 116 | 116 | 116 ✅ |

Nothing under those three paths was read for content, moved, or written.

---

## 2. WHAT WAS RE-MEASURED AND WHAT IS CITED — the card asked for this plainly

| question | provenance |
|---|---|
| (1) **what does each emitter print** for a two-word event? | **REPRODUCED HERE**, through the six real emitters on probe modules built by the real `buildEnrichedIr`. Agrees with T005. |
| (2) **does react's binding fire?** | **RE-MEASURED HERE** in chromium, real key presses and a real double click, `react-dom@19.2.3`. Agrees with T002 and T005. |
| (2) **do the other five fire?** | **CITED FROM T005**, which drove five drag/pointer names in six browsers in two arms. **NOT reproduced here** — it needs the emitted modules served by six real shells, and this card may not write into `demos/`. |
| the five lanes × **`keydown` specifically** | **NEITHER** — stated in the amended entry as an **inference** and marked unrun. |
| the **static-attribute** cost per lane | **MEASURED HERE**, one attribute per emitted module, each lane's own JSX types. |

**Nothing in the repository was written to take these measurements.** Every probe
module was produced by `emit(buildEnrichedIr(...))` into a scratchpad outside the
worktree, and each lane's `node_modules` was reached by symlink. `git status`
carries no probe artifact.

---

## 3. QUESTION (1), REPRODUCED — all six lanes PRODUCE the binding

Authored `onKeyDown`, single-word `onClick` beside it as the control:

```
lane      onClick     onKeyDown
react     onClick     onKeydown
solid     onClick     onKeydown
qwik      onClick$    onKeydown$
svelte    onclick     onkeydown
vue       @click      @keydown
angular   (click)     (keydown)
```

`.toLowerCase()` is the identity on `click`, so the control row is unchanged and
the difference in the second column is the flattening and not the probe.

### 3.1 The svelte refusal is per (ELEMENT × INTERACTION), and T005's reading of it was one case wide

T005 recorded *"the identical handlers on `<ul>` and `<li>` emit clean"*. That is
true **of drag**. Measured here across the grid:

| host | drag set | keyboard set |
|---|---|---|
| `<div>` | REFUSED `a11y_no_static_element_interactions` | REFUSED `a11y_no_static_element_interactions` |
| `<li>` | **emits** `ondragstart …` | REFUSED `a11y_no_noninteractive_element_interactions` |
| `<ul>` | **emits** | — |
| `<button>` | — | **emits** `onkeydown onkeyup` |
| `<textarea>` | — | **emits** `onkeydown onkeyup` |

**`<textarea>` is exactly the Codex clone's Enter-to-send host, and it emits
warning-free in all six lanes.** This is not a contradiction of T005 — it is a
case T005 never ran, and it matters because the keyboard consequence is what the
unamended entry cost.

---

## 4. QUESTION (2) FOR REACT, RE-MEASURED IN A BROWSER

Real key presses and a real double click at `react-dom@19.2.3`, with two
plain-DOM controls installed on the same page:

```
onKeyDown       (react's own spelling)          2 hits
onKeydown       (WHAT THIS COMPILER EMITS)      0 hits
onDoubleClick   (react's own spelling)          1 hit
onDoubleclick   (from authored onDoubleClick)   0 hits
onDblclick      (from authored onDblClick)      0 hits
CONTROL  addEventListener('keydown')            2 hits
CONTROL  onkeydown content attribute            2 hits
```

React's own console, captured in the same run:

```
Invalid event handler property `onKeydown`. Did you mean `onKeyDown`?
Invalid event handler property `onDoubleclick`. Did you mean `onDoubleClick`?
Invalid event handler property `onDblclick`. Did you mean `onDoubleClick`?
```

**The two controls are the load-bearing part.** They are the two shapes the other
five lanes reduce to, they were driven by the same key presses in the same page,
and they fired. So react's zero is a property of react's prop table, not of the
harness.

### 4.1 The type cost, re-measured — it is react and solid only

One binding, one host, each lane's own JSX types:

| authored | react | solid | qwik |
|---|---|---|---|
| `onClick` (single word) | 0 | 0 | 0 |
| `onKeyDown` | **+2** (`TS2322` + `TS7006`) | **+2** | **0** |
| five drag handlers on one host | **+5** (1 × `TS2322`, 4 × `TS7006`) | **+5** | 0 |

The `TS7006` half exists because an unknown prop cannot contextually type its own
parameter; `onDrop` is single-word, stays a known prop, and pays nothing — which
is why the S1–S9 corpus never saw any of this. The entry's inherited *"267 → 272
across three lanes (T002)"* is left attributed to T002 rather than silently
restated: **this measurement is +4 for one binding on one host, and it is qwik
that is free, not a third payer.**

---

## 5. THE STATIC-ATTRIBUTE RULE — the card asked me to widen it and the measurement narrowed it

**One attribute, one emitted module, per lane, typechecked against that lane's own
JSX types.** One module per attribute is the whole instrument: a probe that puts
many attributes on one host gets **one** excess-property diagnostic for the entire
host and undercounts every attribute after the first.

| static attribute | DOM IDL type | react | solid | qwik |
|---|---|---|---|---|
| `id` · `title` · `data-*` | string | 0 | 0 | 0 |
| **`draggable="true"`** | **boolean** | **0** | **0** | **+1** |
| `rows="6"` · `cols="20"` | number | +1 | **0** | +1 |
| `maxlength` · `tabindex` | number | +1 | **0** | +1 |
| `spellcheck` · `readonly` | boolean | +1 | +1 | +1 |
| `hidden` · `contenteditable` | boolean / enum | +1 | +1 | +1 |
| `autocomplete="off"` | **string** | **+1** | 0 | 0 |
| `autoComplete="off"` | **string** | 0 | +1 | +1 |

**Two cells kill the DOM-type formulation.** `draggable` is boolean in the DOM and
**free in react and solid**; `autocomplete` is a string in the DOM and **costs
react**. The predicate is the **lane's own declared JSX prop entry for that exact
spelling**, name and type — not the DOM type.

**Why the DOM-type reading looked right.** `@qwik.dev/core` derives element
attribute types from the DOM interfaces themselves —
`HTMLElementAttrs extends HTMLAttributesBase, FilterBase<HTMLElement>`, `FilterBase`
being a mapped type over the DOM interface — so **for qwik, and only for qwik, the
DOM IDL type IS the declared prop type**. `@types/react` declares
`draggable?: Booleanish`, i.e. `boolean | "true" | "false"`, on purpose. T005
measured `draggable` in the one lane where "the DOM type" happens to be the rule
and generalised from it — **the same shape as entry 15's react-only
over-generalisation, one card later, in the other direction.**

### 5.1 A finding nobody had: NO SPELLING OF `draggable` IS FREE IN ALL THREE LANES

The three JSX emitters disagree about how to print a **valueless** static
attribute:

```
authored  draggable="true"   ->  react draggable="true"   solid draggable="true"   qwik draggable="true"
authored  draggable          ->  react draggable=""       solid draggable          qwik draggable
```

so the cost moves rather than disappearing:

| authored | react | solid | qwik |
|---|---|---|---|
| `draggable="true"` | 0 | 0 | **+1** |
| `draggable` | **+1** — `""` is not `Booleanish` | 0 | 0 |

That is T006's `autocomplete`/`autoComplete` finding — *no spelling is free in
both* — repeated on **value presence** instead of on **casing**. Two independent
axes, one consequence.

### 5.2 One reading that does NOT reconcile, recorded rather than smoothed

T006's table puts qwik at **0** for `autoComplete` (camel). This measurement puts
it at **+1**, with qwik's own diagnostic naming `autocomplete` as the member it
expected. The likeliest cause is the one-host undercount described above, but that
is a hypothesis and both readings are left standing. **Nothing in the amendment
rests on that cell.** It is a difference with T006, not with T005; every T005
measurement this card re-ran agreed.

---

## 6. WHAT THE UNAMENDED TITLE COST — counted, because the card's number was low

The card said *"three cards across two boards"*. Measured by walking both board
files and attributing each mention to its enclosing card:

```
frameless-app-suite-v1   charter + T002, T004, T006, T999
frameless-app-axes-v1    charter + T005
```

**Five task cards and two charters**, one of which shipped an application with no
keyboard at all: *"WHAT THE APP ACTUALLY LOST IS THE KEYBOARD ENTIRELY"*.

---

## 7. What changed in `docs/DEFECTS.md`

1. **Entry 15's TITLE** now carries the react-only scope and the five-lane
   counter-fact. The title is the thing that gets quoted, which is the whole
   reason this card exists.
2. An **AMENDED-BY block** stating what was generalised, by whom it was refuted,
   and what the error cost — with the original reading kept and marked, per this
   ledger's own convention (entry 10's precedent).
3. A **per-lane table** with a `measured on` column, plus an explicit paragraph
   separating what is measured from what is inferred.
4. **The keyboard consequence corrected per lane**, including the type cost, and
   the residual six-lane-fatal case named narrowly: a flattened name that is not a
   real DOM event (`doubleclick` from `onDoubleClick`), not "two-word events".
5. **New entry 17** for the static-attribute rule, with both instances the card
   named (`rows="6"` react, `draggable="true"` qwik) and the narrower predicate.
6. The **standings table** rows 15 and 17, and the two summary paragraphs that
   restated entry 15's six-lane scope.

---

## 8. Baselines

| check | result | gate |
|---|---|---|
| `pnpm check:citations` | see §9 | clean ✅ |
| `pnpm test` | see §9 | exactly 1 ✅ |
| `pnpm check` | see §9 | ≤ 267 ✅ |
| `pnpm e2e` | see §9 | 6 × 9 ✅ |
| `pnpm lint` | see §9 | clean ✅ |
| `git diff --exit-code -- packages/ demos/ scripts/` | exit 0, paired with `git status --short` | doc-only ✅ |

## 9. Process notes

- **`pkill -f` was never used.** No demo server was started. Both foreign
  processes were left alone: **64413** (port 5175) and **24931** (port 5178). The
  browser probe bound an **ephemeral** port chosen by the OS.
- **No dependency was added.** Playwright, `esbuild`, `tsc`, `react` and
  `react-dom` were resolved out of the workspace's existing `node_modules`.
- **No emitter, compiler, fixture, golden, `generated/`, `src/emitted/` or script
  was touched.** Two files changed: `docs/DEFECTS.md` and this note.

## 10. For the next card

- **THE FIVE-LANE × `keydown` BROWSER RUN IS UNRUN.** The amended entry says so in
  its own text. It is the one thing that would take the keyboard claim from strong
  inference to measurement, and it needs write access to `demos/`.
- **A KEYBOARD-CARRYING APP IS BLOCKED IN ONE LANE, NOT SIX.** Solid pays +2
  `error TS` lines per binding against a 267 budget; svelte, vue, angular and qwik
  pay nothing; react cannot have it. **The one-source constraint still bites a
  SIX-LANE fixture**: authoring a `keydown` handler there makes react silently
  wrong while five lanes work, which is worse than absence. It does not bite an
  app that omits react or labels it, which is what the Codex clone already was.
- **`draggable` HAS NO FREE SPELLING** in the three typechecked lanes (§5.1), so
  the drag app that T005 left unbuilt does not become cheaper by dropping the
  attribute's value.
- **ENTRY 17 IS CONTAINED ONLY BY AUTHORS REMEMBERING.** Its containment is
  fixture headers and board `stop_if` clauses. Entry 15 has the same shape, and
  both are the class this ledger keeps calling *not contained*.
