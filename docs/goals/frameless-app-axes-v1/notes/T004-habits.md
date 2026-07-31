# T004 — SIX-LANE FAN-OUT, measured, and no lane was lost

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `a566a6c` · **not committed**.

**The axis is OPEN in all six lanes, and this is the first card on this project to
lose none.** `s15-habit-tracker` is authored once and **emits, gates, ships and
drives in react, solid, qwik, svelte, vue and angular**. One click moves **twelve
measured observables**, and the six lanes are **identical on every field at every
rung of the ladder**.

There were **no emitter refusals to record**. That is not luck and the note says
why: the fixture was built against the fifteen constraints S10–S14 bought, and the
one that mattered — the date — is stated in §3.

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

## 2. THE PER-LANE VERDICT — the deliverable

Every lane re-run through **its own gate** (`pnpm --dir packages/frameworks/<lane> test`),
then **driven in a browser**. A probe verdict is not a lane verdict; five static
gates are not one either.

| lane | emitter | lane gate | browser | **verdict** |
|---|---|---|---|---|
| react | `generated/S15.tsx` | **207 pass** | 12/12 move | **EMITS AND SHIPS** |
| solid | `generated/S15.tsx` | **202 pass** | 12/12 move | **EMITS AND SHIPS** |
| qwik | `generated/S15.tsx` | **96 pass** | 12/12 move (resumes) | **EMITS AND SHIPS** |
| svelte | `generated/S15.svelte` | **127 pass** | 12/12 move | **EMITS AND SHIPS** |
| vue | `generated/S15.vue` | **151 pass** | 12/12 move | **EMITS AND SHIPS** |
| angular | `generated/S15.ts` | **161 pass** | 12/12 move | **EMITS AND SHIPS** |

**SIX EMITTED, SIX GATED, SIX SHIPPED, SIX DRIVEN. No refusal, no
emits-but-misbehaves, no gate rejection.** S13 was the only other scenario all six
lanes serve; S15 is the second, and the first designed to be.

**All six emitted on the FIRST attempt** — against T002's three regeneration
rounds and T003's three spellings. The emitted sizes:

```
react   11724 B   solid 11802 B   qwik 12441 B
svelte   9536 B   vue    9972 B   angular 10829 B
```

---

## 3. THE TRAP THE BRIEF NAMED, AND IT IS REAL — measured on the live reference

The card predicted it and it is confirmed: **the reference renders a real date.**
Driven live at a 1440×1000 viewport, the hero reads

```
JULY 30, 2026
Thursday
```

— which is today. **Angular cannot NAME `Date`** in a transplanted body, so a
computed date would have taken that lane out for a reason with nothing to do with
this axis, and the six-lane claim would have evaporated on the one card where the
lane count *is* the measurement.

`s15-habit-tracker.tsrx` names **no global at all**. The date is a literal string
in the seeded data, exactly as S13's relative ages are.

### 3.1 THE BRIEF AND THE CARD DISAGREE ABOUT HOW, and both are satisfiable

- `state.yaml` T004: *"The date MUST arrive as a prop."*
- The dispatch brief: *"Every date and relative string must be a literal in the
  seeded data, exactly as S13 does."*

**Unlike T002's version of this instruction, the prop spelling here is
ACHIEVABLE.** T002 found it impossible because a relative age is **per row** and
IR-8 has no `TSArrayType` lowering, so no prop shape could carry twelve of them.
A page date is a **scalar**, and a scalar `string` prop demonstrably lowers in all
six lanes — S3's `initial` is one, shipped in six lanes since the beginning.

**Literal was chosen, and the reason is not preference.** The date is not computed
*anywhere* — no lane may name `Date` — so a prop would move the same constant
string from one place to **six host shells** and create six places for the lanes
to disagree. Both spellings satisfy the constraint the card was actually
protecting. Recorded as fixture constraint (10) and as a deviation.

---

## 4. THE BRIEF UNDERCOUNTS THE FAN-OUT — measured on the live reference

The board and the brief both say **"one click fans out to FIVE observable
updates"** and then list **SIX**: checkbox fill, title strikethrough, header
counter, sidebar badge, progress bar, encouragement line.

**Driven with a scripted click on the live reference, it is SEVEN.** The
un-named seventh is the **encouragement EMOJI**, which runs a *different ladder*
than the sentence:

```
0/6   ✨  "Let's make today count!"        bar   0%
1/6   🌱  "Good start! Stay consistent."   bar  16.6667%
2/6   🌱  "Good start! Stay consistent."   bar  33.3333%
3/6   💪  "Halfway through, great work!"   bar  50%
4/6   💪  "Halfway through, great work!"   bar  66.6667%
5/6   🔥  "Almost there, keep going!"      bar  83.3333%
6/6   🎉  "Perfect day! All done!"         bar 100%
```

Five bands, two parallel ladders — all read off the rendered page, not guessed.
The toggle itself also moves **three ways at once** (emoji → check glyph,
transparent → filled, dashed ring → solid), which the single word "fill" hides.

**S15 ships EIGHT authored observables**, adding today's dot inside the nested day
strip — the one placement none of the other seven cover.

### 4.1 A REFERENCE DEFECT, and this page does not copy it

The reference renders **"All habits tracked for today — great job!" at 0/6**,
before anything is ticked. Measured at *every* rung of its own ladder, including
zero. S15's footnote carries `hidden={doneCount < habits.length}`, so it appears
only at 6/6 — which also makes it a ninth derived observable. Recorded in the
fixture and in `habits.css`.

---

## 5. THE FAN-OUT, DRIVEN — one click, twelve observables, six lanes

Playwright/chromium against the six live `pnpm demo` servers. Every figure is a
`getComputedStyle()` / `getBoundingClientRect()` / `textContent` read on the live
document. **The progress bar is measured by its RECT WIDTH, never by its class.**

**One click on `[data-toggle="h1"]`, read in react:**

| observable | before | after |
|---|---|---|
| toggle field | `rgba(0, 0, 0, 0)` | `oklch(0.205 0 0)` |
| toggle ring | `dashed` | `solid` |
| toggle emoji shown | `true` | `false` |
| toggle check-mark shown | `false` | `true` |
| row title decoration | `none` | **`line-through`** |
| **SIDEBAR name decoration** | `none` | **`line-through`** |
| header counter | `0` | `1` |
| sidebar badge | `0/6` | `1/6` |
| **progress bar width** | **`0px`** | **`110.66px`** of `664px` |
| encouragement text | `Let's make today count!` | `Good start! Stay consistent.` |
| encouragement emoji | `✨` | `🌱` |
| today's dot | `oklch(0.922 0 0)` | `oklab(0.56275 0 0)` |

**110.66 / 664 = 16.6667%**, which is the reference's own measured value to four
decimal places.

### 5.1 ALL SIX LANES MOVED ALL TWELVE

```
react    moved=12    solid    moved=12    qwik     moved=12
svelte   moved=12    vue      moved=12    angular  moved=12
```

And field-by-field against react, at **four** stages — before the click, after one
click, at 6/6, and back down to 5/6:

```
at0: ALL SIX IDENTICAL
at1: ALL SIX IDENTICAL
at6: ALL SIX IDENTICAL
at5: ALL SIX IDENTICAL
```

**No lane updated some but not all.** There is no emits-but-misbehaves finding on
this card, and that is the result.

### 5.2 THE NEGATIVE CONTROL — what did NOT move

Three fields were probed on an **untouched sibling row** and are absent from every
`moved` list above: `h2NameDecoration`, `h2SideDecoration`, `h2ToggleBg`. Clicking
`h1` strikes `h1` in **two subtrees** and leaves `h2` alone in both. Without this
control, "twelve things changed" could not be distinguished from "the page
re-rendered".

### 5.3 THE HALF THAT MAKES IT FAN-OUT RATHER THAN A ROW RE-RENDER

`[data-sidename="h1"]` is in the **sidebar**, rendered by a **second `@for` over
the same `habits` cell**, in a different subtree from the control that was
clicked. So is the badge, the counter, the bar and the encouragement pair. **The
handler writes exactly ONE thing** — `habits` — and every one of the twelve
observations is a `computed` or a `class`/`hidden` binding downstream of it. A
lane that repainted only the clicked row would pass a checkbox assertion and fail
here.

### 5.4 The ladder, driven in both directions

```
at0: counter=0/6 badge=0/6 fill=0/664     cheer=✨ "Let's make today count!"       footnote=false
at1: counter=1/6 badge=1/6 fill=110.66    cheer=🌱 "Good start! Stay consistent."  footnote=false
at6: counter=6/6 badge=6/6 fill=664/664   cheer=🎉 "Perfect day! All done!"        footnote=TRUE
at5: counter=5/6 badge=5/6 fill=553.33    cheer=🔥 "Almost there, keep going!"     footnote=false
```

`at5` is reached by **un-clicking**, so the derivation is proved to run backwards
too — and the footnote proves the `hidden` binding closes again.

### 5.5 `pageerror`, and the control that says it is not ours

```
react []   qwik []   svelte []   angular []
solid ["Error: WebSocket closed without opened."]
vue   ["Error: WebSocket closed without opened."]
```

**CONTROL:** the same two lanes emit the identical error on `/`, `/todomvc` and
`/hn` — routes this card did not touch. It is pre-existing vite HMR noise, exactly
as T002 recorded. Not S15's.

---

## 6. VISUAL — asserted off the RENDERED page, and six lanes agree to the pixel

**Reference recorded on the card before the build:**
<https://square-ui-habit-tracker.vercel.app/> — **REFERENCE-ONLY.** Its licence
(*"ln-dev UI License"* © 2026 lndev, GitHub `NOASSERTION`) forbids publishing the
templates **or any derivative** in any repository. **Nothing was copied.** The
geometry was measured in a browser and reproduced on the vendored MIT shadcn
tokens at `demos/shared/shadcn-theme/`.

| feature | reference (measured live) | S15 (measured live) |
|---|---|---|
| sidebar | `[0, 0, 256, 1000]` | `[0, 0, 256, 1000]` ✅ |
| top bar height | 60px | `[256, 0, 1184, 60]` ✅ |
| main content column | x=496, 704px wide | `[496, 60, 704, …]` ✅ |
| weekday heading | `30px` / `900` / `-0.75px` | `30px` / `900` / `-0.75px` ✅ |
| streak card | `min-width: 80px`, `p-3`, radius 12px | `[…, 80, 94]`, padding 12px ✅ |
| habit toggle | 44×44, `rounded-xl` | `[533, 392, 44, 44]` ✅ |
| progress fill at 1/6 | `16.6667%` | `110.66 / 664` = 16.6667% ✅ |
| date / weekday | `JULY 30, 2026` / `Thursday` | identical ✅ |

**Divergence across our six lanes: NONE except one non-field.**

```
qwik.rootWidth: "no-shell"     svelte.rootWidth: "no-shell"     angular.rootWidth: "no-shell"
```

That is not a divergence: those three lanes **have no `#root`/`#app` element to
measure**. The three that do report `1440` — full viewport width — which is the
**shell neutralisation working**. Without it, react/solid/vue would be 1126px wide
and centred, and the six lanes would render two different pages, exactly as T002
found on `/hn`. Neutralised in `habits.css`, **never in the three shells**, which
are shared with the nine three-way scenarios.

### 6.1 Where this page is deliberately NOT the reference, each with a cause

- **`--primary` is near-black, not the reference's purple.** `oklch(0.6 0.22 290)`
  is **not a shadcn default token**. Reproducing it would be reproducing *their
  theme* rather than the measured geometry, which is what the licence ruling
  forbids. The fan-out is unaffected — the toggle still goes dashed-transparent →
  solid-filled.
- **Card radius 14px against the reference's 12px.** `--radius-xl` in the vendored
  default theme is `0.625rem × 1.4 = 14px`; the reference's `rounded-xl` is
  Tailwind's 12px. Building on the vendored scale rather than copying theirs is
  the ruling; this is its one visible cost.
- **No 30-day heat-map and no sparkline.** ~200 decorative cells per habit, ~1200
  authored hosts, measuring nothing the twelve observables do not.
- **The streak strip is in seed order, not sorted by streak descending.** Sorting
  would need a repeat over a `computed`, which Solid refuses ("has unconsumed
  keyed identity semantics"). Recorded infidelity, constraint (2).
- **`Statistics`, `New habit`, the sidebar toggle and the theme toggle are
  INERT.** `.tsrx` has no routing construct.
- **The brand reads "Frameless", not "Square UI".** Reference-only.

---

## 7. THE CENSUSES THAT MOVED — re-argued, never renumbered

Five derived tables went red. **Every one was re-derived and re-argued.**

| file | figure | the argument |
|---|---|---|
| `react/test/size.test.ts` | **411 loc / 2002 nodes** | §7.1 |
| `solid/test/size.test.ts` | **425 loc / 2029 nodes** | §7.1 |
| `angular/test/emitter.test.ts` | `typedInputsSeen` 8 → **9** | §7.2 |
| `vue/src/gate/index.ts` **12a** | instances **held at 20**, corpus 13 → 14 | §7.3 |
| `vue/src/gate/index.ts` **12b** | entries 25 → **26**, names **held at 7** | §7.3 |

### 7.1 The size rows: the largest template in the corpus, and the cheapest per host

**EIGHTY-ONE hosts** — nineteen more than S13's sixty-two, the previous largest —
emitting **411** lines against S13's 555.

```
lines per host:   S15 5.07   S12 7.28   S14 8.44   S13 8.95
events:           S15    7   S13   27   S11   19   S10   15
state writes:     S15    1   S11   29   S10   19   S12   19
```

**S12's row claimed emitted size tracks HANDLER BODIES and not host count. S15 is
that claim's strongest instance** — the biggest template in the corpus and the
smallest write count of any application in it.

And the **line/node split points the other way**: 411/555 = **0.74×** the lines
but 2002/2073 = **0.97×** the nodes — 22% apart, as far as S13's own 19% split and
**in the opposite direction**. S13's lines ran ahead of its nodes because sixteen
one-character separator spans each cost a line and almost no nodes. S15's **nodes**
run ahead of its lines because of its **seed**: thirty-six `{ id: 'h1d1', on: true },`
literals, one per line. **Two opposite divergences of the same magnitude from two
different source shapes** is what turns S13's explanation from an assertion into a
confirmed one — the split tracks what the source is made of, not a per-element tax.

The solid premium is re-derived: **1.03× lines, 1.01× nodes**. The series is now
`1.11 / 1.04 / 0.94 / 1.04 / 1.03 / 1.03` and still refuses to name a trend.

### 7.2 Angular's typed arm moved and its UNTYPED arm held, which is the half to read

`typedInputsSeen` 8 → 9 (one prop entry, `onTrace`, declared with a type).
`untypedInputsSeen` **holds at 15 for the third consecutive application** — S15 is
the largest template in the corpus and adds **not one** untyped member, because
every one of its derived observables is a `computed` **getter**, not an `@Input()`.

The figure is short of the corpus's annotated count by **three modules and two
distinct kinds of absence** (S11/S12 refused at emit; S14 emits and the lane gate
rejects `imports`), which is exactly why it is derived per lane.

### 7.3 The vue gate — and 12a is a SECOND NEGATIVE, stronger than S13's

**12a did not move at all except the scenario count.** Derived independently with
`@vue/compiler-sfc` over the emitted `S15.vue`:

```
S15.vue: value/checked binds = 0    hosts with an on-directive = 7    12a instances = 0
```

**S15 contributes ZERO hosts to worked example 12a's domain.** It is the first
application in this corpus **with no form control at all** — every interaction is
a `<button>` or `<a>` click. Instances hold at **twenty**, applicable at **nine**,
the ratio at 45%, the tag span at `<input>`/`<textarea>`, the bound-property-kind
span at `value`/`checked`.

S13 was a null result that still moved the count from nineteen. **S15 moves
nothing but the scenario count** — which is what a domain looks like once it has
stopped growing, and it makes the completeness reading S13 opened rest on **two**
independent applications instead of one. The re-argument also records that S15 is
the strongest shape a two-way sugar could have wanted (one click keeping eight
places in step) and that what it needs is the **opposite** direction: one-way
derivation **down** from a single cell.

**12b** goes 25 → 26 printed entries with distinct names **held at seven for the
sixth consecutive time**, and ZERO is re-derived for the **sixth** time.

`SPELLED_NUMBERS` gained `TWENTY-SEVEN` — the calibration row plants a scenario
and would otherwise throw. The table's own doc comment instructs exactly this:
*"Extend the table; do not soften the message."*

---

## 8. Derivation — nothing under `generated/`, `src/emitted/` or the CSS copies was hand-written

**19 artifacts**: 1 golden, 6 × `generated/S15.*`, 6 × `src/emitted/HabitTracker.*`,
6 × `habit-css/habits.css`.

| step | result |
|---|---|
| record `shasum -a 256` of all 19 | 19 digests |
| **delete all 19** | **`PRESENT AFTER DELETE = 0`** — asserted, and the run **aborts** if not |
| `UPDATE_GOLDENS=1` + 6 × `regenerate` + 6 × `copy-emitted` + 6 × `copy-habit-css` | `PRESENT AFTER REBUILD = 19` |
| compare | **19/19 BYTE-IDENTICAL** |

The `PRESENT AFTER DELETE = 0` assertion runs **before** the rebuild and gates it,
so the comparison is 19 rebuilt files against 19 recorded digests and not two
empty sets.

**The six CSS copies are byte-identical to the shared source**: one unique digest
over all seven files.

### 8.1 `git diff` — and unlike T003, nothing tracked moved at all

```
$ git diff --exit-code -- 'packages/frameworks/*/generated' \
    'packages/frameworks/*/generated-composition' 'packages/compiler/test/goldens' \
    'demos/*/src/emitted' 'demos/*/src/lib/emitted'
exit 0

$ git diff --exit-code -- 'demos/*/public' 'demos/svelte-official/static'
exit 0
```

**No scenario artifact — S1 through S14, in any lane, plus every composition
artifact and every golden — changed a byte.** T003's row exited **1** on the second
command, because `hn.css` and its six copies gained an S14 block; this card added
a **new** sheet (`habits.css`) rather than extending an existing one, so every copy
is untracked and no shipped stylesheet moved. Measured, not assumed.

Every S15 artifact is **untracked**, so the clean exits say nothing about them;
their internal consistency is proved by §8 and by `pnpm test`, which asserts the
golden byte-equal to a fresh dump and each `generated/S15.*` byte-equal to fresh
emitter output. Paired with `git status --short` (§11).

---

## 9. Browsable, findable, and NOT a fall-through

`pnpm demo` was **RUN, twice**, and every route it printed was fetched and
**hashed**.

```
react    routes=15 distinct=15  /habits=5401324d  bogus=200/2540b92a  fall-through? NO
solid    routes=15 distinct=15  /habits=0b1c205b  bogus=200/3c694dde  fall-through? NO
qwik     routes=15 distinct=15  /habits=6f350516  bogus=404          fall-through? NO
svelte   routes=14 distinct=14  /habits=4731aed1  bogus=404          fall-through? NO
vue      routes=14 distinct=14  /habits=2fb585c4  bogus=200/a3731810  fall-through? NO
angular  routes=12 distinct=12  /habits=73cbbd2c  bogus=404          fall-through? NO
```

**THE TRAP IS LIVE AND DID NOT FIRE.** Re-confirmed this card: react, solid and
vue answer **HTTP 200 on a bogus route**. Every lane's `/habits` hash is distinct
from its bogus hash and from every other route it serves, so all six really serve
the page. **vue is the one that fired on T003's `/hn-item`** and is clean here —
`2fb585c4` against a bogus `a3731810`.

**The qwik trailing slash WAS re-measured this time** (T003 explicitly did not):

```
GET /habits   -> 301  location: http://localhost:5176/habits/  0 bytes
GET /habits/  -> 200  104527 bytes
```

### 9.1 The launch commands actually run

All six through `pnpm demo`, which runs each lane's **own official dev script**:

| lane | command | URL |
|---|---|---|
| react | `pnpm --dir demos/react-official dev` (`PORT=5173`) | `http://localhost:5173/habits` |
| solid | `pnpm --dir demos/solid-official dev` (`PORT=5174`) | `http://localhost:5174/habits` |
| qwik | `pnpm --dir demos/qwik dev --port 5176` | `http://localhost:5176/habits/` |
| svelte | `pnpm --dir demos/svelte-official dev --port 5177` | `http://localhost:5177/habits` |
| vue | `pnpm --dir demos/vue-official dev` (`PORT=5179`) | `http://localhost:5179/habits` |
| angular | `pnpm --dir demos/angular-official start --port 5180` | `http://localhost:5180/habits` |

Ports **5175 and 5178 were SKIPPED** by the preflight with the holder reported.
Nothing was killed.

### 9.2 `pnpm demo` was LYING in its footer, and it is repaired

Appending the S15 row was one line, as the file's own doc comment promises. But the
banner's closing prose read:

> `S14 Hacker News item are the applications. S13 is the only one all SIX lanes serve;`

**That became FALSE the moment S15 landed** — and nothing would have caught it,
because the prose is a `lines.push` string and not a derived value. Repaired to
name both, and to state what each measures. **The scenario table is derived; this
paragraph is not, and that asymmetry is worth a later card.**

---

## 10. Baselines — none moved

| check | baseline (measured before any edit) | final | gate |
|---|---|---|---|
| `pnpm test` | 1 failed / **1307** passed | **1 failed / 1318 passed** | exactly 1 ✅ |
| `pnpm check` | **267** | **267** | must not rise above 267 ✅ |
| `pnpm e2e` | 6 × 9 | **PASS — 6 demos × 9 scenarios, all observations equal** | 6 × 9 ✅ |
| `pnpm lint` | clean | **0 warnings, 0 errors, 520 files** | clean ✅ |
| `pnpm check:citations` | clean | **clean, 569 swept** | clean ✅ |

The single failure is the foreign `package-inventory` ARM B, byte-identical to the
baseline captured **before any edit on this card**. `+11` tests are the derived S15
rows the corpus tables generate.

**`pnpm check` held at 267 with SIX new typechecked artifacts**, three of them in
lanes `pnpm check` compiles. It never rose during this card: constraint (14) kept
every numeric out of a static attribute, which is the exact shape that took T003
to 268 on `rows="6"`.

---

## 11. `git status --short`

Untracked (new): the fixture, the golden, six `generated/S15.*`, six
`src/emitted/HabitTracker.*`, the qwik and svelte `/habits` routes, the angular
`habits-page.ts`, `demos/shared/habit-css/`, `demos/shared/copy-habit-css.mjs`,
six `habit-css/` copies.
Modified: the compiler test tables, six `regenerate.ts`, react/solid size tests,
the angular emitter test, the vue gate source and test, six `package.json`, two
`App.jsx`, `App.vue`, `app.routes.ts`, `scripts/demo.mjs`, this note.

`pnpm-lock.yaml`, `pnpm-workspace.yaml` and `website/` show as modified **in the
owner's in-flight state, exactly as at START** — all three fingerprints match §1.

**Nothing was committed.**

---

## 12. Process notes

- **`pkill -f` was never used.** Two demo runs were stopped by recorded PID
  **18768** and **22815**; the six ports were then confirmed free. Both foreign
  processes were re-verified **alive with their original start times**: **64413**
  (`Mon Jul 27 00:48:52`, port 5175) and **24931** (`Thu Jul 30 15:55:20`, port
  5178).
- **No dependency was added.** Playwright was resolved out of `node_modules/.pnpm`.
- **No emitter, no IR, no authoring surface and no `scripts/e2e.mjs` was touched.**
  There was nothing to narrow around: all six lanes took the module as authored.

---

## 13. For the next card

- **The habit tracker measured the axis and lost no lane. T005 is drag, and the
  board expects it to REFUSE** — `onDragStart`/`onDragOver`/`onDrop`/`onPointerDown`
  are all two-word and `build.ts` does `name.slice(2).toLowerCase()`. This card
  spent nothing on that question; constraint (4) simply avoided keyboard and
  two-word events entirely.
- **THE FIFTEEN CONSTRAINTS ARE WHY THIS WORKED.** Six lanes on the first attempt
  is a consequence of S10–S14's refusals being written down. T005 should inherit
  constraints (1)–(9) and re-measure (10)–(15) rather than assume them.
- **A single-component app avoids both open emitter defects entirely.** Solid's
  double-called signal read and qwik's un-forwardable function prop are only
  reachable through a component reference. S15 has none, and qwik got its
  `onTrace$` back (S14 is still the corpus's only fixture with no trace channel).
- **`pnpm demo`'s closing paragraph is hand-written prose beside a derived table**
  and went stale the moment this card landed (§9.2). A third six-lane app will
  stale it again.
- **`habits.css` now exists beside `hn.css` and `codex.css`.** A second
  shadcn-token page should extend the token layer, not add a third sheet; the
  `:root`/`#root`/`#app` shell neutralisation at the top is what keeps the six
  lanes comparable and must be copied into any new page-scoped sheet.
- **The reference's own "great job!" line fires at 0/6** (§4.1). If a later card
  QAs that site, that is a known defect and not a mis-read.
