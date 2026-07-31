# T003 — RECURSION, measured three ways, with a verdict per lane

Board: `docs/goals/frameless-app-axes-v1/state.yaml` · HEAD at start `c50595f` · **not committed**.

**The axis is OPEN, not closed.** A component that names itself in its own template
**emits in four of six lanes**, and the two that refuse do so on a *file-format* limit
rather than on recursion. The card was written expecting a refusal and predicted the
fallback; **the fallback was never needed and was not used.** There is no fixed depth
anywhere in `s14-hn-item.tsrx`.

S14 **ships in three lanes** — react, solid, qwik — at `/hn-item`. The three absences
have **three different causes**, and that spread is the most useful thing on this card.

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

## 2. THE RECURSION VERDICT — three spellings, six lanes, measured

The card asked for two steps. **There are three spellings, not two**, and the first two
are **exact complements** — which is why one refusal could never have been the verdict.

### 2.1 The matrix

| spelling | react | solid | qwik | svelte | vue | angular | `resolveModuleSet` |
|---|---|---|---|---|---|---|---|
| **A** — same-module self-reference (`<HnItem/>` inside `HnItem`) | EMITS | EMITS | EMITS | **REFUSES** | **REFUSES** | EMITS | **LINKS OK** |
| **B** — the module imports **itself** under an alias | EMITS | EMITS | **REFUSES** | EMITS | EMITS | **REFUSES** | **REFUSES** |
| **C** — two modules in mutual reference, A → B → A | EMITS | EMITS | EMITS | EMITS | EMITS | EMITS | **REFUSES** |

**The union of A and B is all six lanes.** No single spelling wins all six, and B is
closed one layer up regardless.

### 2.2 The verbatim refusals

**Spelling A**, read off the real `s14-hn-item.tsrx` and not off a probe:

```
svelte:  Svelte emitter has no lowering for a same-module component reference
         (HnItem): a .svelte file declares exactly one component, and a snippet
         cannot own state or a lifecycle
vue:     Vue emitter has no lowering for a same-module component reference
         (HnItem): a .vue SFC declares exactly one component
```

**Spelling B** — the way Svelte and Vue spell recursion *natively*:

```
qwik:    Qwik emitter has no lowering for a renamed ModuleImport: Comment as Self
angular: Angular emitter has no lowering for a renamed ModuleImport: Comment as Self
linker:  Component-reference cycle: src/comment.tsrx -> src/comment.tsrx
```

Svelte prints `import Self from './comment.svelte'` inside `comment.svelte` — real
Svelte recursion. **Un-aliased it never reaches the linker at all**: `import { Comment }
from './comment.tsrx'` beside `export function Comment` is
`Identifier 'Comment' has already been declared`.

**Spelling C**:

```
linker:  Component-reference cycle: src/a.tsrx -> src/b.tsrx -> src/a.tsrx
```

**All six emitters emit both modules.** Multi-module recursion is closed in every lane
and it is closed at the **linker**, not at any emitter.

### 2.3 Why spelling A ships

It is the only one that **both emits and links**, and it wins the two lanes (qwik,
angular) that B loses. Spelling B is also **unshippable in this corpus's layout**: the
emitted import specifier is derived from the `.tsrx` specifier, so a module built from
`s14-hn-item.tsrx` would import `./s14-hn-item.svelte` while the artifact on disk is
`generated/S14.svelte`.

The mechanism behind A linking is worth recording: `assertNoCycles` in
`packages/compiler/src/module-set.ts` builds its edge set from `externalTargets` only, so
a `module: 'self'` target **is never added to the cycle graph**. Self-recursion passes the
linker by construction; mutual recursion does not.

### 2.4 THE FALLBACK WAS NOT TRIGGERED

The card's step 3 — a fixed-depth unrolled thread — was conditioned on **both** spellings
refusing. Four lanes take spelling A, so the condition never held. **`s14-hn-item.tsrx`
contains no depth cap, no unrolled level and no `depth`-driven margin.** `depth` is
carried for exactly two things, both stated in the fixture: gating the masthead to the
root instance, and publishing `data-depth` so the nesting can be asserted.

---

## 3. THE PER-LANE VERDICT FOR S14, and it has THREE kinds of absence

Every lane re-run through **its own gate** (`pnpm --dir packages/frameworks/<lane> test`).

| lane | emitter | lane gate | browser | verdict |
|---|---|---|---|---|
| react | `generated/S14.tsx` | 206 pass | drives | **EMITS AND SHIPS** |
| solid | `generated/S14.tsx` | 201 pass | drives | **EMITS AND SHIPS** |
| qwik | `generated/S14.tsx` | 95 pass | drives (resumes) | **EMITS AND SHIPS** |
| svelte | **REFUSES** (verbatim §2.2) | 125 pass | — | **UNBUILT, emitter refuses** |
| vue | **REFUSES** (verbatim §2.2) | 149 pass | — | **UNBUILT, emitter refuses** |
| angular | **EMITS** a correct recursive component | **REJECTS IT** | — | **EMITS-BUT-GATE-REFUSES** |

### 3.1 Angular is the interesting absence, and it is NOT an emitter refusal

`emit()` **succeeds**. Angular is one of only four lanes that lower a same-module
component reference, and it produces a genuinely correct recursive standalone component:

```ts
@Component({
	selector: 'frameless-hn-item',
	imports: [HnItem],
	template: ` … <frameless-hn-item [parent]="comment.id" [depth]="depth + 1"/> … `,
})
export class HnItem { … }
```

The lane's own dossier gate then rejects the emitted source, verbatim:

```
Emitted Angular source uses the component-metadata form "imports", which is not in
the baseline form inventory. IR-4 is DEFERRED, so this emitter's only discharge of
the version corollary's second conjunct is an explicit allowlist with a recorded
floor per entry; a new form has to be added to BASELINE_FORM_INVENTORY with a
version floor and an honest floor-evidence status, and it may raise
ANGULAR_BASELINE_FLOOR
```

**S14 is the first scenario in the corpus with a component reference at all**, so it is
the first emitted Angular module ever to print `imports`. Admitting the form is **a
dossier ruling, not a code edit** — it needs a version floor and floor evidence, and
`imports` arrives with standalone components well above several entries' `2.0` floors, so
it would move the **derived** `ANGULAR_BASELINE_FLOOR` for every scenario at once.
`packages/frameworks/angular/src/gate/index.ts` is outside this card's write scope by
construction, which is the right place for that decision to stop.

Recorded in a **new** declaration, `packages/frameworks/angular/test/ungated-scenarios.ts`,
deliberately kept separate from `unbuilt-scenarios.ts`: that file's whole contract is that
`emit()` **throws**, and folding a gate rejection into it would either assert a throw that
does not happen or soften the contract until a real emitter regression could hide behind a
gate diagnostic. The new suite row asserts **both halves** — that the emit succeeds *and*
that the gate reports exactly the recorded policy and message — which is a **strictly
stronger** claim than the S11/S12 rows beside it. It carries a control (a shipped artifact
through the same `checkSources` must come back clean), so "the gate reported something" is
not mistaken for "the gate reported this".

---

## 4. TWO EMITTER DEFECTS THAT ONLY RECURSION COULD REACH

Both were **isolated on minimal two-source probes**, not inferred from S14, and both cost
the app a feature. **No emitter was touched.**

### 4.1 Solid: a self-reference breaks every signal read inside a handler

Two sources identical except for one `@if (depth > 0) { <div><P …/></div> }` arm:

| | without the self-reference | with it |
|---|---|---|
| handler read | `const text = draft();` | **`const text = draft()();`** |
| controlled input | `value={draft()}` **and** `attr:value={draft()}` | **`attr:value` DROPPED** |

Both halves are caught by the solid lane's own instruments:

```
generated/S14.tsx: TS2349 This expression is not callable.
                   Type 'String' has no call signatures.
gate: Controlled text value requires onInput and an identical attr:value pair
      (policy controlled-input, T003 ruling 7)
```

**Store reads are unaffected** (`comments` is a `createStore`; every `.map` and spread over
it lowers correctly) and **template reads are unaffected**. So the narrowing is: the comment
forest is a store and carries all mutable state; the story header's vote arrow became an
**inert** control like `hide`/`past`/`favorite` beside it; and **the reference's reply box is
not on this page**, because a controlled `<textarea>` needs a scalar cell.

### 4.2 Qwik: a function prop cannot cross a component boundary, in any spelling

The qwik emitter renames a function-typed prop to the `$`-suffixed QRL spelling in the
**declaration** and at every **read**, and prints the **authored** name at a
component-reference **call site**:

```tsx
export const P = component$((props: { onTrace$: (…) => void }) => …
  await props.onTrace$('x', …)
  … <P depth={props.depth} onTrace={props.onTrace$} />   ← mismatch
```

```
TS2322: Type '{ parent: string; depth: number; onTrace: (…) => void; }' is not
assignable to type 'IntrinsicAttributes & Omit<{ …; onTrace$: (…) => void; },
`${string}$`> & _Only$<…>
```

**Authoring the prop as `onTrace$` does not help** — the suffix is appended
unconditionally, giving `onTrace$$` in the declaration and still `onTrace$` at the call
site. Nothing in the repo had reached this: the shipped composition corpus
(`M1-panel`/`M2-page`) forwards only **data** props, and every scenario before this one is
a single component. **A recursive component must forward every required prop to itself**,
which is exactly what found it.

**Consequence: S14 is the only fixture in the corpus with no `onTrace` prop.** Its oracle
is the **rendered DOM** instead — which is the stronger instrument anyway, and is what §6
uses. Every inert control here is a plain `<a href="#/…">` with no handler, so a left click
moves the fragment and nothing else.

### 4.3 A third, smaller one, retired by 4.1

While the reply box existed, `rows="6"` on the `<textarea>` produced
`generated/S14.tsx: TS2322 Type 'string' is not assignable to type 'number'` in the react
lane: `TextareaHTMLAttributes.rows` is `number` and **this authoring surface cannot spell a
static NUMERIC attribute at all**. S12 ships a textarea and never set `rows`, so no earlier
fixture had reached it. Recorded as fixture constraint (17) even though the box is gone.

---

## 5. THE CARD'S OWN BRIEF WAS WRONG ABOUT ARRAYS, AND IT MATTERS FOR T004

The brief (inheriting T002 §8.1) states that **IR-8 has no lowering for `TSArrayType`**, and
concludes no prop shape can carry a list. The first half is true and **the conclusion is
too strong**:

| prop spelling | react | solid | qwik | svelte | vue | angular |
|---|---|---|---|---|---|---|
| `kids: string[]` | refuses | refuses¹ | refuses | refuses | EMITS | refuses |
| **`kids: Array<string>`** | **EMITS** | refuses¹ | **EMITS** | **EMITS** | **EMITS** | **EMITS** |

¹ solid refuses for an unrelated reason — `TemplateKeyedRepeat repeat:0 has unconsumed key
semantics`, because the probe keyed on the item itself rather than on a single member path.

`typeNode()` accepts `TSTypeReference` **with type arguments** and simply has no
`TSArrayType` case. **The limit is on the SPELLING, not on arrays.** It still cannot carry a
*comment*: `Array<CommentNode>` prints a type name the emitted module cannot resolve, and an
inline `Array<{ id: string }>` throws on `TSTypeLiteral` in all six. S14 therefore still
seeds in-component — but for the reason in fixture constraint (1), not the one the brief
gave. **T004 should not read "no array props" as settled.**

---

## 6. RUN IN A BROWSER — the recursion asserted off the RENDERED IMAGE

Playwright/chromium against the three live `pnpm demo` servers. **Every figure below is a
`getBoundingClientRect()` / `getComputedStyle()` reading on the live document**, and the
nesting depth is counted by walking `parentElement` for `.hn-cnest` — **not** read off
`data-depth`, which the component could have lied about.

| observation | react | solid | qwik |
|---|---|---|---|
| live `.hn-thread` instances | **15** | 15 | 15 |
| visible comments | 14 | 14 | 14 |
| **max DOM nesting depth** | **4** | 4 | 4 |
| indent by depth (px) | 104 / 132 / 160 / 188 / 216 | identical | identical |
| masthead elements on the page | **1** | 1 | 1 |
| collapse `c1` → visible comments | 14 → **10** | 14 → 10 | 14 → 10 |
| … and `c4` (depth 3) still present? | **NO** | NO | NO |
| … `kidsLabel` shown in its place | `3 replies` | `3 replies` | `3 replies` |
| expand `c1` → visible comments | 10 → **14** | 10 → 14 | 10 → 14 |
| upvote `c9` (depth 3) → arrow | `true → false` | `true → false` | `true → false` |
| `pageerror` | `[]` | `[]` | `[]` |

**The three lanes are identical on every field.**

**THE FALSIFICATION THAT MATTERS:** collapsing `c1` — a *depth-0* comment — removes `c4`, a
**depth-3 descendant that no handler on this page names**. `collapsed` gates `.hn-cnest`,
the host that holds the recursive instance, so the subtree goes with it. **An unrolled
thread would screenshot identically and fail exactly here.**

**The indent is 28px per level, compounding, and it is real DOM nesting.** `hn.css` has one
rule for it — `.hn-cnest .hn-comments { padding-left: 28px }` — and there is deliberately no
`[data-depth]` indentation rule anywhere in the file. A depth-driven margin would have
rendered this same picture while proving nothing, which is the substitution this card's
oracle rejects.

**Fifteen instances and exactly ONE masthead** is the other half: `@if (depth === 0)` is the
only thing keeping the page frame off the recursive instances, and it holds at every level.

### 6.1 Visual comparison against the named reference

**Reference recorded on the card before the build:** `news.ycombinator.com` item page —
indented comment tree, the same masthead as T002.

| feature | reference | measured on the rendered page |
|---|---|---|
| masthead bar | `#ff6600` | `rgb(255, 102, 0)` |
| page background | `#f6f6ef` at 85% width | `rgb(246, 246, 239)`, `.hn-thread[data-depth="0"]` = 1088px of 1280 (85%) |
| body type | Verdana ~10pt | `Verdana`, title `13.33px` = 10pt |
| comment byline colour | `#828282` | `rgb(130, 130, 130)` |
| indented comment tree | `<td class="ind">` at 40px/level | **real DOM nesting**, 28px/level, measured 104→216 |
| collapse control | `[–]` / `[+]` with "N more" | `[-]` / `[+]` with `3 replies` |

**Where this page is deliberately NOT the reference**, each with a measured cause:

- **No reply box.** §4.1 — a controlled `<textarea>` is mis-lowered by the solid emitter
  once the module recurses.
- **No trace channel, and every inert control is a bare link.** §4.2.
- **The story header's vote arrow is inert.** §4.1 — it would need a scalar cell.
- **`hide`, `past`, `favorite`, `reply` and the masthead links do nothing.** `.tsrx` has no
  routing construct, so `/hn` does not link here either.
- **`kidsLabel` is literal seeded data** (`3 replies`). Counting descendants needs a filter
  over the forest inside a template expression; the ages are literal for the same family of
  reason as S13 constraint (9).

---

## 7. Derivation — nothing under `generated/` or `src/emitted/` was hand-written

**13 artifacts**: 1 golden, 3 × `generated/S14.*`, 3 × `src/emitted/HnItem.tsx`, 6 ×
`hn-css/hn.css` copies (all six lanes take the sheet — `/hn` links it everywhere).

| step | result |
|---|---|
| record `shasum -a 256` of all 13 | 13 digests |
| **delete all 13** | **`PRESENT AFTER DELETE = 0`** — asserted, and the run **aborts** if not |
| `UPDATE_GOLDENS=1` + 3 × `regenerate` + 3 × `copy-emitted` + 6 × `copy-hn-css` | `PRESENT AFTER REBUILD = 13` |
| compare | **13/13 BYTE-IDENTICAL** |

The `PRESENT AFTER DELETE = 0` assertion runs **before** the rebuild and gates it, so the
comparison is 13 rebuilt files against 13 recorded digests and not two empty sets.

### 7.1 `git diff` — what it proves, and the ONE tracked file that did move

```
$ git diff --exit-code -- 'packages/frameworks/*/generated' \
    'packages/frameworks/*/generated-composition' 'packages/compiler/test/goldens' \
    'demos/*/src/emitted' 'demos/*/src/lib/emitted'
exit 0
```

**No scenario artifact — S1 through S13, in any lane, plus every composition artifact and
every golden — changed a byte.** Every S14 artifact is **untracked**, so that clean exit
says nothing about them; their internal consistency is proved by §7's derivation and by
`pnpm test`, which asserts the golden byte-equal to a fresh dump and each `generated/S14.*`
byte-equal to fresh emitter output.

**One tracked artifact DID change, and it is stated rather than filtered out of the
command.** `demos/shared/hn-css/hn.css` and its six copies gained the S14 block, so a
`git diff` that includes `demos/*/public` and `demos/svelte-official/static` exits **1**.
Measured, because "additive" is a claim and not an observation:

```
demos/shared/hn-css/hn.css            +154  -0
demos/{react,solid,qwik,vue,angular}…  +154  -0   (each)
demos/svelte-official/static/…         +154  -0
```

**Zero lines removed in all seven**, and all seven are byte-identical to each other (one
unique `shasum` over the set), so the copies are still derived from the shared source and
no S13 rule was touched. Paired with `git status --short` (§10).

---

## 8. Browsable, findable, and NOT a fall-through

`pnpm demo` was **RUN**, and every route it printed was fetched and **hashed**.

```
react    routes=14 distinct=14  /hn-item=0595e279  bogus=200/2540b92a(=S1)  fall-through? NO
solid    routes=14 distinct=14  /hn-item=2820a8b0  bogus=200/c0baf41b(=S1)  fall-through? NO
qwik     routes=14 distinct=14  /hn-item=f5c58487  bogus=404                fall-through? NO
svelte   routes=13 distinct=13  /hn-item=404                                (unbuilt)
vue      routes=14 distinct=13  /hn-item=a3731810  bogus=200/a3731810       *** FALL-THROUGH ***
angular  routes=11 distinct=11  /hn-item=404                                (unbuilt)
```

**THE TRAP FIRED.** `vue` answers **HTTP 200** on `/hn-item` and its body hash is
**byte-identical to its bogus-route hash** — it is serving S1. Reading that 200 as "vue
serves the item page" would have been a false six-lane claim on the one card where the lane
count *is* the measurement. Only body hashing catches it; T001 predicted exactly this and it
is the second card to be saved by the rule.

**The qwik trailing slash is honoured but NOT independently re-measured here.** The demo
table prints `/hn-item/` and the probe above fetched the slashed form in that lane, so the
`f5c58487` body is a page and not a redirect. T001 measured the bare-path 301 on every
route in this table; this card did not re-run that control, and says so rather than
restating it as if it had.

### 8.1 The launch commands actually run

| lane | command | URL |
|---|---|---|
| react | `pnpm --dir demos/react-official dev` (`PORT=5173`) | `http://localhost:5173/hn-item` |
| solid | `pnpm --dir demos/solid-official dev` (`PORT=5174`) | `http://localhost:5174/hn-item` |
| qwik | `pnpm --dir demos/qwik dev --port 5176` | `http://localhost:5176/hn-item/` |

`pnpm demo` prints all three plus the three refusals, each with its own reason rather than
one shared one.

---

## 9. Baselines — none moved

| check | result | gate |
|---|---|---|
| `pnpm test` | **exactly 1** failure — `package-inventory` ARM B, foreign | exactly 1 ✅ |
| `pnpm check` | **267** `error TS` lines | must not rise above 267 ✅ |
| `pnpm e2e` | 6 × 9 | 6 × 9 ✅ |
| `pnpm lint` | 0 warnings, 0 errors | clean ✅ |
| `pnpm check:citations` | clean | clean ✅ |

`pnpm check` holding at **267** is the number worth noting: S14 adds **zero** new
diagnostics in three typechecked lanes. It reached **268** mid-card, on the `rows="6"`
finding in §4.3, and the fixture was narrowed rather than the budget raised.

### 9.1 The derived tables that moved, re-argued rather than renumbered

| file | figure |
|---|---|
| `react/test/size.test.ts` | S14 budget **329 loc / 1237 nodes** |
| `solid/test/size.test.ts` | S14 budget **340 loc / 1261 nodes** |
| `svelte/test/unbuilt-scenarios.ts` | **new** — first subtraction in this lane |
| `vue/test/unbuilt-scenarios.ts` | **new** — first subtraction in this lane |
| `angular/test/ungated-scenarios.ts` | **new** — first *gate*-rejection declaration in the repo |
| `vue/src/gate/index.ts` 12a / 12b | **unchanged, and that is the re-argument** |

**The size rows are re-argued, not just filled.** S14 is **the first row in either table
whose number does not bound what it renders**: 39 authored hosts render 15 instances and
~200 `<li>`, so a budget on a recursive component measures the *source* and says nothing
about the *output*. Against S13 it is 0.59× on lines and 0.60× on nodes in react — **the two
axes agree to within 1%, which restores the pattern S13 broke.** S13's 19% split was blamed
on its sixteen single-character separator spans; this page has three, and the axes
re-converge. That is S13's explanation confirmed by a second measurement rather than
assumed. The solid premium series is re-derived and still refuses to name a trend: 1.11× /
1.04× / 0.94× / 1.04× / **1.03×**.

**The vue 12a/12b census did NOT move, and that is the correct re-argument.** Both are
censuses of what **this lane ships**, and this lane does not ship S14. The subtraction is
applied inside `scenarioGoldens` — not only in `scenarioCorpus` — precisely because 12a
walks the *emitted templates* (it would try to read an `S14.vue` that does not exist) and
12b counts **printed** prop entries (a golden this lane refuses prints none). So
"thirteen-scenario corpus / TWENTY instances / NINE applicable / TWENTY-FIVE printed
entries" all still hold **by derivation**, and nothing was renumbered or softened. Its
calibration row needed one repair: the planted ordinal is "one past the highest
`scenarioGoldens` returns", which now lands **on** the subtracted slot and would have been
filtered straight back out, leaving the calibration asserting against its own scaffolding.
It now advances past any subtracted ordinal.

---

## 10. `git status --short`

Untracked (new): the fixture, the golden, three `generated/S14.*`, three
`src/emitted/HnItem.tsx`, the qwik `/hn-item` route, three `test/*-scenarios.ts`
declarations. Modified: the compiler test tables, six `regenerate.ts`, react/solid size
tests, the svelte/vue/angular test suites, `demos/shared/hn-css/hn.css`, three
`package.json`, two `App.jsx`, `scripts/demo.mjs`, this note.

`pnpm-lock.yaml`, `pnpm-workspace.yaml` and `website/` show as modified **in the owner's
in-flight state, exactly as at START** — all three fingerprints match §1.

**Nothing was committed.**

---

## 11. Process notes

- **`pkill -f` was never used.** The demo runner was stopped by recorded PID **8945**; the
  six ports were then confirmed free. Both foreign processes were re-verified **alive with
  their original start times**: **64413** (`Mon Jul 27 00:48:52`, port 5175) and **24931**
  (`Thu Jul 30 15:55:20`, port 5178). `pnpm demo`'s preflight moved qwik off 5175 and both
  vue and angular off 5178 without killing anything.
- **No dependency was added.** Playwright was resolved out of `node_modules/.pnpm`.

---

## 12. For the next card

- **The array-prop limit is narrower than the board believes.** §5. `Array<T>` lowers where
  `T[]` refuses. T004's habit tracker should re-measure rather than inherit.
- **Two emitter defects are open and recorded** (§4.1 solid, §4.2 qwik). Both are only
  reachable through a component reference, so **any card that composes will hit them**;
  neither is repaired here.
- **Angular's `imports` inventory ruling is the one thing standing between this lane and a
  fourth shipped lane for S14.** It is one entry plus a floor and floor evidence in
  `packages/frameworks/angular/src/gate/index.ts`, and it may raise the derived
  `ANGULAR_BASELINE_FLOOR` — which is exactly why it is a ruling and not an edit.
- **`hn.css` now carries the item page too.** A third HN page should extend it rather than
  add a sheet; the `:root` / `#root` / `#app` shell neutralisation at the top is what keeps
  the lanes comparable.
- **`vue` answers 200 for `/hn-item` with the S1 body.** It does not serve that page.
