# T006 — FORM INPUT TYPES, measured, and the card's own premise is wrong about three of five

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `5097543` · **not committed**.

**The axis does not refuse anywhere.** All **sixteen** `type=` values emit in all
six lanes, and **thirteen control kinds ship on `/contacts` and fire in all six
lanes in a real browser**, with byte-identical before/after readings.

**And the card's `WHAT_IS_ALREADY_MEASURED` is wrong about three of the five
things it names.** It says *"`select`, `radio`, `number`, `date` and the
multi-field form shape are ALL UNMEASURED"*. `select`, `radio` and the
multi-field form shape were measured **before this board existed**:
`packages/compiler/test/fixtures/s7-form-controls.tsrx` **is** a `<form>` with a
`<select>` carrying three `<option>`s, a `<textarea>`, a two-radio group and a
keyed checkbox group; it is in every lane's `generated/`; and it is **one of the
nine scenarios `pnpm e2e` drives in a real browser across six demos**. Only
`number` and `date` were genuinely unmeasured.

**What actually costs something is not the type — it is the attribute beside
it**, and it costs the **emitted typecheck** rather than any emitter. The card
predicted `min`, `max` and `step` would fail with the rest. **They are free in
all three JSX lanes**, which is what let the number, date, time and range fields
ship with real bounds.

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

## 2. THE PER-INPUT-TYPE, PER-LANE VERDICT — the deliverable

Three questions, in order. **(1) SPELLED?** asked of the REAL emitters on probe
modules. **(2) BOUND?** read off the SERVED payload and off the live DOM after
activation. **(3) FIRES?** driven in CHROMIUM against six live `pnpm demo`
servers.

### 2.1 SPELLED? — every type, every lane

| `type=` | react | solid | qwik | svelte | vue | angular |
|---|---|---|---|---|---|---|
| `text` `email` `tel` `url` `search` `password` | EMITS | EMITS | EMITS | EMITS | EMITS | EMITS |
| `number` `date` `time` `month` `week` | EMITS | EMITS | EMITS | EMITS | EMITS | EMITS |
| `range` `color` `checkbox` `radio` `hidden` | EMITS | EMITS | EMITS | EMITS | EMITS | EMITS |

**Sixteen types × six lanes = ninety-six emits and zero refusals.** The reason is
structural and is itself the result: **no emitter reads the VALUE of a `type`
attribute at all.** `type` is lowered as an ordinary static string attribute, so
there is no per-type code path anywhere for a type to be refused by. **The axis
has no refusal in it, and that absence is a measurement rather than a gap.**

Non-`<input>` and structural probes, same method:

| probe | result |
|---|---|
| `<select value={cell}>` + `<option>`s | **all six EMIT** |
| `<option selected={expr}>` | **all six EMIT** |
| `<option>`s from an `@for` repeat | **all six EMIT** |
| `<textarea value={cell}>` | **all six EMIT** |
| `<label for="x">` | **all six EMIT** |
| `<fieldset>` / `<legend>` | **all six EMIT** |
| `<datalist>` + `list="…"` | **all six EMIT** |
| `<output>` / `<progress value>` / `<meter value>` | **all six EMIT** |
| `placeholder` bound to a cell | **all six EMIT** |
| `onChange` instead of `onInput` | **all six EMIT** |
| **`<label htmlFor="x">`** | **SVELTE REFUSES** — §2.4 |
| **`<form onSubmit>` with no click handler** | **SVELTE REFUSES** — §2.4 |
| **a template literal in a template expression** | **ANGULAR REFUSES** — §2.5 |

### 2.2 THE SHIPPED PAGE — thirteen control kinds, driven, six lanes

`/contacts` in all six lanes, Playwright/chromium at 1440×1000. Each control was
driven and **its own observable** read; no two controls share one, which is what
makes this a per-type measurement rather than one form that either works or does
not.

| control | `type` | what was driven | observable | react | solid | qwik | svelte | vue | angular |
|---|---|---|---|---|---|---|---|---|---|
| first name | `text` | `fill "Zora"` | preview name | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| last name | `text` | `fill "Vance"` | preview name | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| email | `email` | `fill` | preview email row | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| phone | `tel` | `fill` | preview phone row | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| website | `url` | `fill` | preview site row | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| role | `text` | `fill` | preview role | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| company | `<select>` | `selectOption verity` | preview company **and** industry | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| open deals | `number` | `fill "7"` | preview deals line | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| client since | `date` | `fill "2027-03-14"` | preview since line | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| call slot | `time` | `fill "17:45"` | preview slot line | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| priority | `range` | `fill "5"` | preview word ladder **and class** | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| status | `radio` | `check prospect` | preview chip text **and class** | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| tags | `checkbox` in a keyed repeat | `check partner` | preview tag chips | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| notes | `<textarea>` | `fill` | preview note **and its `hidden`** | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| search | `search` | `fill "verity"` | shown counter, summary pair, every card's `hidden` | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |
| status filter | `<select>` | `selectOption inactive` | the same three, by a different route | MOVED | MOVED | MOVED | MOVED | MOVED | MOVED |

**Sixteen controls × six lanes = ninety-six drives, ninety-six moves, zero
misbehaviours.** The full before/after record was serialised per lane and
compared:

```
react    IDENTICAL to react     svelte   IDENTICAL to react
solid    IDENTICAL to react     vue      IDENTICAL to react
qwik     IDENTICAL to react     angular  IDENTICAL to react
```

**VERDICT PER LANE: EMITS AND SHIPS, all six.**

### 2.3 BOUND? — the served byte and the live DOM, and they agree in all six

Read off the **served payload** (a plain `fetch`, before any script runs) and off
the live DOM after activation:

| reading | all six lanes |
|---|---|
| `type="number"` served `value` | `3` |
| `type="date"` served `value` | `2026-02-10` |
| `type="time"` served `value` | `09:30` |
| `type="range"` live `value` | `3` |
| `<select>` live `value` | `northgate` |
| `radio` served **and** live `checked` | present / `true` |
| `checkbox` served **and** live `checked` | present / `true` |
| `min` / `max` / `step` reaching the DOM | `0` / `20` / `5` / `2020-01-01` |
| `<label for>` pairs resolving to a real `id` | **20 of 20** |
| heading elements | **4** |
| `<textarea>` count | **1** |

#### 2.3.1 A DOCUMENTED FOUR-WAY SPLIT DOES NOT REPRODUCE, on either scenario

`demos/react-official/three-way-contract.ts` records that what a `property`
binding does to the serialized `checked` attribute *"splits the six lanes FOUR
ways"* — react/angular write it, solid/qwik do not, svelte writes then deletes
it, vue writes then tracks it. **Measured live on both scenarios:**

```
lane      S7 radio  S7 checkbox   S17 radio  S17 checkbox
react     checked   -             checked    checked
solid     checked   -             checked    checked
qwik      checked   -             checked    checked
svelte    checked   -             checked    checked
vue       checked   -             checked    checked
angular   checked   -             checked    checked
```

S7's checkbox is absent in all six because its seed row is genuinely `on: false`,
so that column proves nothing; **S7's radio and BOTH of S17's controls are served
identically by all six lanes.** After activation the live `.checked` is `true` in
all six as well. **On the served byte and on the post-activation DOM the split
does not reproduce.** This does *not* refute the entry's claims about the
*mechanism* — svelte's `remove_input_defaults` and vue's tracking are about the
instant of hydration and were not re-measured — but the observable outcome that
comment says cannot be part of a cross-lane reading **is identical in six lanes
today**, and S17 is the first scenario carrying a `checked` binding that is
actually `true` on a checkbox.

### 2.4 THE SVELTE REFUSALS, verbatim — and neither is about a type

```
Emitted Svelte module Probe.svelte did not compile warning-free:
a11y_label_has_associated_control, attribute_invalid_property_name. Every
emitted form must be warning-free; a code that is legitimate for the authored
shape has to be added to SANCTIONED_SVELTE_IGNORE_CODES with a reason.
```

— on `<label htmlFor="x">`. **The portable spelling is `for`**, and it survives
the react lane only because **the react emitter rewrites `for` → `htmlFor` on its
own** (it does the same for `class` → `className` and `readonly` → `readOnly`).

```
Emitted Svelte module ZProbe.svelte suppresses
[a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions]
but without those annotations Svelte reports []. A suppression that changes
nothing is a silent over-fire.
```

— on a `<form>` carrying a `submit` handler and no `click` handler. This is S13
constraint 13 / S14 constraint 11, **re-measured on this card's own probe rather
than inherited**, and it is why `s17-contacts.tsrx`'s form carries a `press`
trace beside its `add` trace.

A third svelte refusal is recorded because it did **not** shape the fixture:
`a11y_autofocus, a11y_no_redundant_roles` on a static `autofocus` and a redundant
`role` — both of which are also type errors in all three JSX lanes.

### 2.5 THE ANGULAR REFUSAL, verbatim — and it nearly took the lane

```
Angular emitter refuses the template expression "`#/company/${row.id}`": a
backtick, a ${ or a backslash would terminate or interpolate the TypeScript
template literal the inline template lives in
```

The first spelling of the fixture used **six** template literals inside template
expressions — a company link `href`, a per-status avatar class, a joined
first/last name, and the tag checkboxes' `id`/`name`/`for` triple. **The other
five lanes took every one of them.** The narrowing is the one constraint (10)
makes for globals: they are **seeded row fields** (`href`, `avatarClass`, `full`,
`initial`, `domId`, `controlId`) or `computed` getters, both of which live in the
CLASS rather than the inline template. **A template literal in a `computed` body
or a handler body is fine in this lane; only the template is closed.**

`Date` was the trap the card named and it did not fire: a `date` input is not a
clock, `since` and `slot` are literal seeded strings, and **the fixture names no
global at all.**

---

## 3. THE TYPE-COST TABLE — measured, not inherited, and the card is wrong twice

Measured by emitting probe modules carrying ~40 candidate attributes into **each
JSX lane's own `generated/`** and running **that project's own `tsc`**. Svelte,
vue and angular contribute **0** to `pnpm check` (their projects are at 0 errors
and do not typecheck templates), so the whole budget lives in three lanes.

| static attribute | react | solid | qwik |
|---|---|---|---|
| `type` (**all sixteen values**) | 0 | 0 | 0 |
| `name` `placeholder` `id` `for` `pattern` `title` `aria-*` `role` | 0 | 0 | 0 |
| **`min` `max` `step` (incl. `step="any"`)** | **0** | **0** | **0** |
| `inputMode` (camel) | 0 | 0 | 0 |
| a **bound** `value` / `min` on any control | 0 | 0 | 0 |
| `required` | **+1** | **+1** | **+1** |
| `multiple` · `<select multiple>` | **+1** | **+1** | **+1** |
| `disabled` | **+1** | **+1** | **+1** |
| `readonly` / `readOnly` | **+1** | **+1** | **+1** |
| `autofocus` / `autoFocus` | **+1** | **+1** | **+1** |
| `spellcheck` | **+1** | **+1** | **+1** |
| static `checked="true"` | **+1** | **+1** | **+1** |
| `maxlength` · `maxLength` · `minlength` | **+1** | 0 | **+1** |
| `size` · `<select size>` | **+1** | 0 | **+1** |
| `tabindex` | **+1** | 0 | **+1** |
| `rows` · `cols` on a `<textarea>` | **+1** | 0 | **+1** |
| `autocomplete` (lower) | **+1** | 0 | 0 |
| `autoComplete` (camel) | 0 | **+1** | 0 |
| `inputmode` (lower) | **+1** | 0 | **+1** |
| `list` | 0 | 0 | **+1** |

**TWO READINGS THAT ARE NOT IN THE BRIEF.**

1. **`min`, `max` and `step` are FREE in all three lanes.** The brief listed them
   with `maxlength`, `size`, `required` and `multiple` as the set that *"fails
   react's emitted typecheck"*. They do not: their JSX types are
   `string | number`. That is why the number, date, time and range fields on this
   page carry **real bounds** (`min="0" max="20" step="1"`,
   `min="2020-01-01" max="2030-12-31"`, `min="07:00" max="19:00" step="900"`,
   `min="1" max="5" step="1"`) rather than decorative ones — and the bounds are
   confirmed present in the live DOM in all six lanes (§2.3).
2. **CASING IS ITS OWN COST AXIS, and it is not symmetric.** React's JSX types
   want camelCase; solid's want the lowercase DOM attribute name. So
   `autocomplete` costs **react** and `autoComplete` costs **solid** — **no
   spelling of it is free in both**, and it is simply absent from the page.
   `inputMode` happens to be free in all three, which is the only reason it is
   spellable at all. **T005's rule — "no static attribute whose DOM type is not
   `string`" — is confirmed and now has a second axis beside it: and no static
   attribute whose SPELLING differs between react and solid.**

**`pnpm check` held at 267 with six new typechecked artifacts**, and holding it is
the finding rather than housekeeping: the fixture spends **zero** of the costing
attributes. The `*` markers on required fields are **literal text**, and the
submit guard is a **ternary in the handler** plus an `aria-disabled` binding —
`aria-*` being the one boolean-shaped spelling all six lanes agree on (S7's
finding, reused).

---

## 4. THE SOLID FINDING THE CARD PREDICTED — finding-002 crosses two more tags AND loses its last confound

The card said *"expect more here"*, and there is more. `S17` adds **fifteen** new
`attr:value` rows to `packages/frameworks/solid/test/emitted-typecheck.test.ts`,
taking the finding from nine instances across four applications and two tags to
**twenty-four instances across six applications and FOUR tags**.

| what S17 adds | why it matters |
|---|---|
| **`SelectHTMLAttributes<HTMLSelectElement>`** ×2 | third tag. S7 ships two `<select>`s and binds `data-size`, never `value` |
| **`OptionHTMLAttributes<HTMLOptionElement>`** ×1 | fourth tag — see below |
| `TextareaHTMLAttributes` ×1 | second textarea instance after S12's composer |
| `InputHTMLAttributes` ×11 | six labelled text inputs, one search, four bounded numeric controls |

**THE `<option>` ROW IS THE STRONGEST INSTANCE IN THE CORPUS AND IT CLOSES THE
QUESTION S12 OPENED.** It prints **three members total**:

```
generated/S17.tsx: TS2322 Type '{ children: string; value: string; "attr:value": string; }'
  is not assignable to type 'OptionHTMLAttributes<HTMLOptionElement>'.
```

**No event handler. No `data-*`. No `class`, no `id`.** Every one of the previous
fourteen instances carried an event handler, so `attr:value` could still have been
read as something the **event** lowering emitted alongside the value. It cannot
be: **a bound `value` and nothing else produces it.**

**AND THE NEGATIVE CONTROL IS NEW TOO.** S17 ships three radios and a keyed
checkbox group, all bound with `checked`, and **not one of them appears in the
list**. The emitter mirrors into `attr:` for `value` and **not** for `checked`, so
the finding's domain is the `value` binding specifically and not "any property
binding".

**IT IS ALSO VISIBLE IN THE SERVED HTML, WHICH NO TYPE ROW SHOWS.** Fetched from
the live solid server:

```
<input type="number" … data-control="deals" value="3" value="3">
```

**The attribute is printed twice.** Every other lane prints it once. `finding-002`
is not only a type error; it puts a duplicate attribute in the payload.

---

## 5. THE MULTI-FIELD FORM SHAPE, END TO END — four arms, six lanes, all identical

| arm | what it tests | result, **identical in all six lanes** |
|---|---|---|
| **A — the guard** | empty required fields | `aria-disabled="true"`; HTML constraint validation says the form is **VALID** (nothing carries `required`); the click lands with `force: true` and **no card is added**, 9 → 9. **The ternary guard is what held.** |
| **B — an invalid `url`** | `type="url"` doing real work | `form.checkValidity() === false`, `site: "Please enter a URL."`, **submit blocked by the browser**, 9 → 9 |
| **C — a valid `url`** | the whole form | 9 → **10**; the new card reads `Zora Vance` / `Prospect` / `Verity Studio` / `zora@vance.example` / tags `Customer,Partner`; shown `10`, badge `10/10`, and the summary crossed a ladder band to *"Every contact is in view."* |
| **D — Enter in a text field** | the other way a form submits | 10 → **11**, `Owen Ferris` |

**ARM B IS THE STRONGEST EVIDENCE ON THIS CARD THAT THE TYPES ARE NOT
DECORATIVE.** The first drive of this page typed `vance.example` into the
`type="url"` field and the submit silently did nothing in all six lanes. That was
not an emitter defect and not a harness bug: **the browser's own constraint
validation refused a form containing an invalid URL**, and repairing the value to
`https://vance.example` made the identical click add the contact in all six lanes.
A `type` attribute that changes whether a submit happens is the opposite of inert
markup.

**Playwright's own actionability check refused to click the submit button while
`aria-disabled="true"`** — which is independent evidence that the `aria` spelling
reaches tooling, and is why arm A needs `force: true` to test the ternary at all.

### 5.1 The reset — fourteen cells in one click

The sidebar's `New contact` button writes **fourteen state cells at once**, the
largest single-handler write in the corpus. After it, in all six lanes:

```
first "" · deals "3" · since "2026-02-10" · priority "3" · company "northgate"
notes "" · tagPartner false · statusActive true · preview name "New contact"
```

### 5.2 The negative control — what did NOT move

Three readings on untouched siblings, absent from every moved list above and
identical in all six lanes: `[data-cardname="c1"]` = `Ama Boateng`,
`[data-cardstatus="c1"]` = `Active`, `[data-control="tag-investor"].checked` =
`false`. Without this, "sixteen things moved" could not be told from "the page
re-rendered".

### 5.3 `pageerror`, and the control that says it is not ours

```
react []   qwik []   svelte []   angular []
solid ["Error: WebSocket closed without opened."]
vue   ["Error: WebSocket closed without opened."]
```

The same two lanes emit the identical error on `/`, `/hn`, `/habits` and `/board`
— routes this card did not touch. Pre-existing vite HMR noise, exactly as T002,
T004 and T005 recorded.

---

## 6. VISUAL — and the RENDERED IMAGE caught a six-lane divergence four cards missed

**Reference recorded on the card before the build:**
<https://square-ui-contacts.vercel.app/> — **REFERENCE-ONLY.** Its licence
(*"ln-dev UI License"* © 2026 lndev, GitHub `NOASSERTION`) forbids publishing the
templates **or any derivative** in any repository. **Nothing was copied — not a
class, not a declaration, not a contact.** The nine people, five companies and
five tags are this repository's own invention. The geometry was measured live at
1440×1000, **including the New Contact dialog, which this card was the first to
open**, and reproduced on the vendored MIT shadcn tokens at
`demos/shared/shadcn-theme/`.

| feature | reference (measured live) | S17 (measured live) |
|---|---|---|
| sidebar width | `256` | `256` ✅ |
| search field | `[439, 21, 320, 36]`, radius 8, 1px border | `[419, 21, 320, 36]`, radius 8 ✅ (x differs — §6.2) |
| card | `370 × 194`, radius 14, 1px border, 16px padding | `371 × 187`, radius **14**, 16px padding ✅ |
| card column pitch | `382` (12px gap) | `383` ✅ |
| avatar disc | 40 | `[297, 266, 40, 40]` ✅ |
| tag / status chip | 22 tall, 12px/500 | `[…, 52, 22]`, `12px/500` ✅ |
| **dialog / form panel** | `480` wide, radius 10, 24px padding | `480` wide, radius **10**, **24px** ✅ |
| form control | 36 tall, radius 8 | `[…, 209, 36]`, radius 8 ✅ |
| form label | 14px/500, 8px above its control | `14px/500`, gap **8** ✅ |
| two-column field row | `209 + 12 + 209` | `209 + 12 + 209` ✅ |
| submit button | `115 × 36` | `[620, 1910, 115, 36]` ✅ |

**Divergence across our six lanes, after the repair in §6.1: NONE.** Nineteen of
twenty measured fields are byte-identical strings in all six lanes; the twentieth
is `rootWidth`, which is not a field — qwik, svelte and angular have no
`#root`/`#app` element to measure, and the three that do report `1440`, the full
viewport, which is the shell neutralisation working.

### 6.1 THE RENDERED IMAGE FOUND A BUG THAT HAS BEEN THERE SINCE `hn.css`

The first drive reported **seven** differing geometry fields. The cause is a
**second half of the shell neutralisation that `hn.css`, `habits.css` and
`board.css` all lack**. The create-vite scaffold shared by react, solid and vue
carries, in its own `index.css`:

```css
h1, h2 { font-family: var(--heading); font-weight: 500; color: var(--text-h) }
h1     { font-size: 56px; letter-spacing: -1.68px; margin: 32px 0 }
h2     { font-size: 24px; line-height: 118%; margin: 0 0 8px }
```

A page class that sets `font-size` and `font-weight` **does not beat any of
that** — `font-family`, `letter-spacing`, `line-height`, `color` and `margin` all
survive — and qwik, svelte and angular ship no such scaffold. Measured live:

```
                        react/solid/vue        qwik/svelte/angular
<h1> "All contacts"     63px wide              83px wide
search field x          399                    419      <- 20px apart
sidebar height          1997                   2003
form / field / label y  5-6px apart
```

**Every declared value in `contacts.css` was identical in all six.** Only the
rendered rect said so. Repaired by neutralising `h1, h2` in the page-scoped sheet
— **never in the three shells**, which are shared with S1–S12 and with the nine
scenarios `pnpm e2e` compares across six lanes.

**S16 HAS AN `<h1>` TOO AND NEVER SAW THIS.** Its crumb reads `Task`, four
characters rather than twelve, and the next rect T005 measured sits behind a flex
spacer that absorbed the difference. **The bug was always there; S17 is the first
page whose layout put a measured rect immediately after a heading.** This is the
second instance of the rule T007 bought on the previous board.

### 6.2 Where this page is deliberately NOT the reference, each with a cause

- **THE FORM IS A PERSISTENT PANEL, NOT A MODAL.** The reference opens it as a
  dialog; `.tsrx` has no portal, no focus trap and no `dialog` construct, and a
  modal that is merely an absolutely positioned `<div>` is a worse artifact than a
  panel. It is placed **below** the grid at the dialog's own measured 480px, which
  is the cheaper divergence: a right-hand rail would have cost the grid a column
  and made the card pitch unmeasurable. Both geometries stay comparable.
- **The avatars are `--secondary` discs carrying initials, not gradient discs**,
  and **the tag chips are `--secondary`, not the reference's per-tag blue / violet
  / amber.** Neither set is a shadcn default token; reproducing them would
  reproduce *their theme* rather than the measured geometry. Same ruling T004
  recorded for the habit tracker's purple and T005 for the board's chips. The
  measured 40px disc, 22px chip and 12px/500 type are kept.
- **The search field sits 20px left of the reference's**, because the reference's
  title area carries an extra icon this page does not draw.
- **The status filter is a native `<select>`**, where the reference uses a
  button-plus-popover. A native control is the point of the card.
- **The nav links, company links, view-mode and theme buttons and the card stars
  are INERT.** `.tsrx` has no routing construct.
- **The brand reads "Frameless", not "Square Contacts".** Reference-only.

### 6.3 THE REFERENCE'S OWN DEFECTS — three, measured, none copied

The PM did not QA this one. It was QA'd here, live, dialog opened:

1. **Its "Notes" field is a single-line `<input>`, not a `<textarea>`.** With the
   New Contact dialog open the whole document holds **seven `<input>`s, two
   `<select>`s and ZERO `<textarea>`s**. A notes field that cannot wrap is a
   defect. This page ships a real `<textarea>`.
2. **The page has no heading element at all.**
   `document.querySelectorAll('h1,h2,h3,h4')` returns **0** on the entire
   document, dialog included. This page has an `<h1>` and three `<h2>`s. Same
   family as S16's heading-order finding — the third consecutive card where this
   corpus ships something more correct than the thing it reproduces.
3. **Only its email field carries a `type`.** Its phone field is not
   `type="tel"`; first name, last name, role and notes carry no `type` at all.
   On the card whose entire axis is form input types, **the reference types one
   field out of seven.**

What the reference *does* do, measured and working: its search filters (17 → 2
matches on `amara`), its tag chips filter (17 → 9), its status popover opens and
lists four options, and its New Contact dialog is a real `<form>`. `pageerror` on
that site: none.

---

## 7. THE CENSUSES THAT MOVED — re-argued, never renumbered

| file | figure | argument |
|---|---|---|
| `react/test/size.test.ts` | **1373 loc / 6279 nodes** | §7.1 |
| `solid/test/size.test.ts` | **1401 loc / 6519 nodes** | §7.1 |
| `solid/test/emitted-typecheck.test.ts` | ACCEPTED **+15** rows | §4 |
| `angular/test/emitter.test.ts` | `typedInputsSeen` 10 → **11**, untyped **held at 15** | §7.2 |
| `vue/src/gate/index.ts` **12a** | instances 20 → **38**, applicable **held at 9** | §7.3 |
| `vue/src/gate/index.ts` **12b** | entries 27 → **28**, names **held at 7** | §7.3 |
| `vue/src/gate/index.ts` tier census | `flat/recommended` gains **`vue/attributes-order`** | §7.4 |
| `vue/test/gate.test.ts` | `SPELLED_NUMBERS` += `TWENTY-NINE`…`FORTY` | the table's own doc comment instructs it |

### 7.1 The size rows BREAK the proxy four scenarios had been using

**212 hosts** — 2.4× S16's eighty-nine, and by far the largest template in the
corpus — with **32 events** and **35 state writes**, more of both than anything
else here.

```
                 hosts  events  writes  react loc  lines/host
S13                 62      27       4        555        8.95
S12                 53       9      19        386        7.28
S17                212      32      35       1373        6.48
S16                 89      12       2        523        5.88
S15                 81       7       1        411        5.07
```

S12 opened the claim that emitted size tracks **handler bodies**, not host count;
S15 sharpened it from one end and S16 interpolated it — and **all three used the
EVENT COUNT as the proxy**. S17 breaks the proxy: it has the most events *and* the
most writes and still costs **less per host** than S12 on nine events. The
underlying claim survives and is sharpened: **fourteen of S17's thirty-two events
are three-line field handlers** — take `next`, write one cell, trace — while S12's
nine include one that suspends three times. It is the **size of the bodies**, and
an event count is only a proxy for that when the bodies are similar.

Against S16: **2.63× the lines on 2.38× the hosts and 2.61× the nodes** — lines
and nodes **2% apart**, the closest any pair in this table has been, which is what
a template made almost entirely of one repeated shape looks like.

**The solid premium is 1.02× lines and 1.04× nodes**, and this is the first row in
the table whose divergence has a cause **visible in another test file**: this
emitter mirrors a bound `value` into a second `attr:value` (§4), and S17 has
fifteen `value`-bound hosts — more than the rest of the corpus put together.
Fifteen extra attributes are fifteen extra **nodes** on lines that were being
printed anyway. The series is now
`1.11 / 1.04 / 0.94 / 1.04 / 1.03 / 1.03 / 1.07 / 1.02` across S10–S17 and still
refuses to name a trend.

### 7.2 Angular's untyped arm held for the FIFTH time, on the hardest test it could have

`typedInputsSeen` 10 → 11 (one prop entry, `onTrace`, typed).
`untypedInputsSeen` **holds at 15**. **This is by far the hardest test that hold
has had**, because a form is the one shape that could plausibly have wanted
per-field inputs: thirteen distinct control kinds, each with its own bound cell.
Not one is an `@Input()` — every draft cell is component-local `state` and every
preview reading is a `computed` getter or a class/`hidden` binding.

### 7.3 The vue gate — 12a nearly DOUBLES, and it half-refutes three cards of silence

Re-derived independently with `@vue/compiler-sfc` over the emitted `S17.vue`, and
the derivation agrees with the gate's own:

```
S17.vue: hosts with an on-directive = 31   value/checked binds + same-host event = 18
corpus total 12a instances = 38            applicable = 9
```

Instances **20 → 38** in one scenario, more than every scenario since S7 combined,
and **the sugar's reach does not move at all**, holding at nine — all eighteen new
handlers call `props.onTrace(...)`. The ratio falls to **24%**, the **lowest this
entry has ever recorded**, below S10's 25%.

**S13, S15 and S16 read three consecutive negatives as evidence that the domain
had stopped growing. That is half refuted and half confirmed, and the split is the
datum.** REFUTED: the domain had not stopped growing; it had run out of forms to
grow on, and three consecutive click-only applications cannot tell those apart.
CONFIRMED: the **shapes** did not grow in proportion — the bound-property-kind
span still holds at `value` and `checked` after eighteen new instances across
thirteen control types.

**The tag span DOES move, from two to three.** `<select>` joins `<input>` and
`<textarea>`, and it is not cosmetic: `v-model` on a `<select>` is
**`vModelSelect`**, a different runtime directive from `vModelText` — it sets
`el.value` in a mounted hook, reads `el.options` and `el.selectedIndex`, and on a
multiple select produces an **array** where the baseline binding produces a
string. No scenario in this corpus had ever bound `value` on a `<select>`.

**And 12a gains its first NEGATIVE CONTROL.** S17's five `<option value={row.id}>`
hosts bind a value with **no** on-directive, so they are correctly excluded by the
second half of the domain definition rather than by accident of nothing matching.
Before S17, every bound host in the corpus also had an event, so that clause had
never actually excluded anything.

**12b** goes 27 → **28** printed entries with distinct names **held at seven for
the eighth consecutive time**, and ZERO is re-derived for the **eighth**. The
re-argument records what is new: `defineModel` exists so a child owning an
**editable value** can hand it back to its parent, and **a fourteen-cell form is
the most natural shape for that in this whole corpus** — far more natural than a
stream or a fan-out, which the six rows above had to reach for. It declares one
printed entry, `onTrace`.

### 7.4 An EXCLUDED eslint tier fired for the first time, and the exclusion still stands

`VUE_ESLINT_TIERS_EXCLUDED`'s `flat/recommended` row carried the claim that the
eight rules that tier adds *"are all silent on emitted output today"*. **That was
true for sixteen scenarios and is now false for one of them:**
**`vue/attributes-order` fires eighteen times, all in `S17.vue`, all the identical
complaint — `Attribute "id" should go before "class"`.**

S17 is the first module here where bound controls also need `id`s, because a
`<label for>` points at each of them; S13's footer search field is the only earlier
host with an `id` and it happens to print `id` first.

**The exclusion is unchanged and so is its ground.** The rule is pure attribute
ORDER: it moves no rendered byte, it is not a correctness rule, and the emitter
prints attributes in **authored** order, so it is a claim about the fixture rather
than the emitter. **It was deliberately NOT silenced by reordering the fixture**,
because letting a tier this lane does not apply dictate authoring order is the
failure mode the list exists to prevent — and because five other lanes emit the
same source and none of them holds an opinion about it. The two content-newline
rules in the row above still decide the exclusion on their own.

**This is the census working exactly as its own comment says it should**:
*"Recorded so that a later rule arriving in this tier and firing is a red test here
rather than an unexamined exclusion."*

---

## 8. Per-lane result for the shipped app

| lane | emitter | lane gate | browser | **verdict** |
|---|---|---|---|---|
| react | `generated/S17.tsx` (41544 B) | **209 pass** | 16/16 controls fire | **EMITS AND SHIPS** |
| solid | `generated/S17.tsx` (41139 B) | **204 pass** | 16/16 | **EMITS AND SHIPS** |
| qwik | `generated/S17.tsx` (44013 B) | **98 pass** | 16/16 (resumes) | **EMITS AND SHIPS** |
| svelte | `generated/S17.svelte` (33320 B) | **131 pass** | 16/16 | **EMITS AND SHIPS** |
| vue | `generated/S17.vue` (35051 B) | **155 pass** | 16/16 | **EMITS AND SHIPS** |
| angular | `generated/S17.ts` (37367 B) | **163 pass** | 16/16 | **EMITS AND SHIPS** |

**All six emitted on the SECOND attempt** — the first was refused by angular alone,
on the template-literal ground in §2.5. S15 and S16 emitted on the first.

---

## 9. Derivation — nothing under `generated/`, `src/emitted/` or the CSS copies was hand-written

**19 artifacts**: 1 golden, 6 × `generated/S17.*`, 6 × `src/emitted/Contacts.*`,
6 × `contact-css/contacts.css`.

| step | result |
|---|---|
| record `shasum -a 256` of all 19 | 19 digests |
| **delete all 19** | **`PRESENT AFTER DELETE = 0`** — asserted, and the run **aborts** if not |
| `UPDATE_GOLDENS=1` + 6 × `regenerate` + 6 × `copy-emitted` + 6 × `copy-contact-css` | `PRESENT AFTER REBUILD = 19` |
| compare | **19/19 BYTE-IDENTICAL** |

The `PRESENT AFTER DELETE = 0` assertion runs **before** the rebuild and gates it,
so the comparison is 19 rebuilt files against 19 recorded digests and not two
empty sets. The six CSS copies are byte-identical to the shared source: **one
unique digest (`c7627b1c`) over all seven files.**

### 9.1 `git diff` — nothing tracked moved

```
$ git diff --exit-code -- 'packages/frameworks/*/generated' \
    'packages/frameworks/*/generated-composition' 'packages/frameworks/*/generated-persistence' \
    'packages/compiler/test/goldens' 'demos/*/src/emitted' 'demos/*/src/lib/emitted'
exit 0

$ git diff --exit-code -- 'demos/*/public' 'demos/svelte-official/static'
exit 0
```

**No scenario artifact — S1 through S16, in any lane, plus every composition and
persistence artifact and every golden — changed a byte.** Every S17 artifact is
untracked, so the clean exits say nothing about them; their internal consistency
is proved by §9 and by `pnpm test`. Paired with `git status --short` (§12).

---

## 10. Browsable, findable, and NOT a fall-through

`pnpm demo` was **RUN**, and every route it printed was fetched and **hashed**.

```
react    routes=17 distinct=17  /contacts=200/ff050a9f  bogus=200/2540b92a
solid    routes=17 distinct=17  /contacts=200/c3703358  bogus=200/fdbd2465
qwik     routes=17 distinct=17  /contacts=200/f2ce971d  bogus=404
svelte   routes=16 distinct=16  /contacts=200/6162c67c  bogus=404
vue      routes=16 distinct=16  /contacts=200/455846f3  bogus=200/a3731810
angular  routes=14 distinct=14  /contacts=200/0c132c54  bogus=404
```

**THE TRAP IS LIVE AND DID NOT FIRE.** react, solid and vue all answer **HTTP 200
on a bogus route** — and in all three the bogus body is byte-identical to the S1
body, which is the fall-through the trap describes. **Every lane's `/contacts`
hash is distinct from its bogus hash and from every other route it serves**
(17/17, 17/17, 17/17, 16/16, 16/16, 14/14 distinct).

**The qwik trailing slash was re-measured:** `GET /contacts` → **301**,
`location: /contacts/`.

### 10.1 The launch commands actually run

All six through `pnpm demo`, which runs each lane's own official dev script:

| lane | command | URL |
|---|---|---|
| react | `pnpm --dir demos/react-official dev` (`PORT=5173`) | `http://localhost:5173/contacts` |
| solid | `pnpm --dir demos/solid-official dev` (`PORT=5174`) | `http://localhost:5174/contacts` |
| qwik | `pnpm --dir demos/qwik dev --port 5176` | `http://localhost:5176/contacts/` |
| svelte | `pnpm --dir demos/svelte-official dev --port 5177` | `http://localhost:5177/contacts` |
| vue | `pnpm --dir demos/vue-official dev` (`PORT=5179`) | `http://localhost:5179/contacts` |
| angular | `pnpm --dir demos/angular-official start --port 5180` | `http://localhost:5180/contacts` |

Ports **5175 and 5178 were SKIPPED** by the preflight with the holder reported.
Nothing was killed.

### 10.2 `pnpm demo`'s closing paragraph went stale a THIRD time — and is now DERIVED

T004 repaired it by hand, T005 repaired it by hand and predicted a third break.
It broke. **This time the two figures that keep rotting are computed from `DEMOS`
and `SCENARIOS` rather than written out**, and the derivation immediately caught a
fourth error nobody had noticed:

> **before (hand-written):** *"S13, S15 and S16 are the three that all SIX lanes serve."*
> **after (derived):** *"Of those, S10, S13, S15, S16, S17 are the 5 that all SIX lanes serve."*

**S10 TodoMVC has been served by all six lanes since before this board opened, and
two consecutive repairs of that sentence both left it out.** The prose around the
numbers is still hand-written; the counts are not.

---

## 11. Baselines — none moved

| check | baseline (measured before any edit) | final | gate |
|---|---|---|---|
| `pnpm test` | 1 failed / **1329** passed | **1 failed / 1340 passed** | exactly 1 ✅ |
| `pnpm check` | **267** | **267** | must not rise above 267 ✅ |
| `pnpm e2e` | 6 × 9 | **PASS — 6 demos × 9 scenarios, all observations equal** | 6 × 9 ✅ |
| `pnpm lint` | clean | **0 warnings, 0 errors, 550 files** | clean ✅ |
| `pnpm check:citations` | clean | **clean, 591 swept** | clean ✅ |

The single failure is the foreign `package-inventory` ARM B
(`peer-suffix key(s) for @markless/core@file:vendor/markless-core-0.1.1.tgz`),
byte-identical to the baseline captured **before any edit on this card**. `+11`
tests are the derived S17 rows the corpus tables generate.

Per-project `tsc` before and after S17 landed: **react 117 → 117, solid 80 → 80,
qwik 70 → 70.** Holding that is the finding, not housekeeping: §3's table is what
kept it there.

---

## 12. `git status --short`

Untracked: the fixture, the golden, six `generated/S17.*`, six
`src/emitted/Contacts.*`, the qwik and svelte `/contacts` routes, the angular
`contacts-page.ts`, `demos/shared/contact-css/`,
`demos/shared/copy-contact-css.mjs`, six `contact-css/` copies.
Modified: the compiler test tables, six `regenerate.ts`, react/solid size tests,
solid's emitted-typecheck ACCEPTED list, the angular emitter test, the vue gate
source and test, six `package.json`, two `App.jsx`, `App.vue`, `app.routes.ts`,
`scripts/demo.mjs`, this note.

`pnpm-lock.yaml`, `pnpm-workspace.yaml` and `website/` show as modified **in the
owner's in-flight state, exactly as at START** — all three fingerprints match §1.

**Nothing was committed.**

---

## 13. Process notes

- **`pkill -f` was never used.** Three demo runs were stopped by recorded PID and
  the six ports confirmed free each time. Both foreign processes were re-verified
  **alive with their original start times**: **64413** (`Mon Jul 27 00:48:52`,
  port 5175) and **24931** (`Thu Jul 30 15:55:20`, port 5178).
- **No dependency was added.** Playwright, `@vue/compiler-sfc`, `eslint` and
  `eslint-plugin-vue` were resolved out of `node_modules/.pnpm` or the lane's own
  `node_modules`.
- **No emitter, no IR, no authoring surface and no `scripts/e2e.mjs` was touched.**
  The one refusal that shaped the source — angular's template literals — was
  narrowed around in the fixture, never repaired in the emitter.
- **The probe scaffolding was removed.** Answering "spelled?" and "what does it
  cost?" needed emitted probe modules inside three lanes' `generated/`; every one
  came out of `emit(ir)` + `formatEmitted`, the same two calls `regenerate.ts`
  makes, and all were deleted. `git status` carries no probe artifact.

---

## 14. For the next card

- **THE AXIS IS OPEN AND THE CARD'S PREMISE WAS WRONG ABOUT `select`, `radio` AND
  THE MULTI-FIELD FORM SHAPE.** `s7-form-controls` had them all along and `pnpm
  e2e` has been driving them in six browsers for as long as the three-way contract
  has existed. **Read `packages/compiler/test/fixtures/` before believing a
  "nothing has measured this" claim on this board.**
- **THE COST TABLE IN §3 IS THE REUSABLE ARTIFACT.** `min`/`max`/`step` are free;
  `required`/`multiple`/`disabled`/`readonly`/`autofocus`/`spellcheck`/static
  `checked` cost all three JSX lanes; `maxlength`/`size`/`rows`/`cols`/`tabindex`
  cost react and qwik and are free in solid; and **no spelling of `autocomplete`
  is free in both react and solid**.
- **`h1`/`h2` NEUTRALISATION IS MISSING FROM `hn.css`, `habits.css` AND
  `board.css`** (§6.1). Those three pages are almost certainly rendering 20px
  differently in react/solid/vue than in the other three lanes at their headings,
  and nothing measures it because no rect on those pages sits immediately after a
  heading. **That is a real cross-lane divergence on three shipped pages and it
  deserves a card.**
- **`style` LOWERING IS STILL UNMEASURED IN ALL SIX LANES.** This card was the
  likeliest consumer yet — a `type="range"` wants a filled track — and used a
  class ladder instead. Nothing has probed it.
- **THE SERVED `checked` FOUR-WAY SPLIT IN `three-way-contract.ts` DOES NOT
  REPRODUCE** on S7 or S17 (§2.3.1). Either the stack moved under it or it was
  over-stated. It deserves a re-measurement card of its own; this card measured
  the served byte and the post-activation DOM, not the instant of hydration.
- **`finding-002` NOW SPANS FOUR TAGS AND HAS NO CONFOUND LEFT** (§4), and it puts
  a **duplicate `value` attribute in solid's served HTML**, which no type row
  shows. If it is ever repaired, fifteen ACCEPTED rows go with it.
- **`contacts.css` now exists beside `hn.css`, `habits.css` and `board.css`.** Its
  shell neutralisation is the only one of the four that also covers `h1`/`h2`, and
  any new page-scoped sheet should copy **that** version.
- **S17 IS THE LARGEST TEMPLATE IN THE CORPUS BY 2.4×** and made the react suite's
  emitted-size rows the first ones to test the size rule in the middle of its range
  with a *high* event count and *small* bodies. The rule survived; the event-count
  proxy did not.
