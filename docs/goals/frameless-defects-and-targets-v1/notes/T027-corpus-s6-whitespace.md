# T027 — S6 whitespace-sensitive text, six lanes, and the divergence the axis was ratified to find

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree at `abb5e44`. Follows the pattern T034 and T026 established
(`notes/T034-s4-registration.md`, `notes/T026-corpus-s5-branch-teardown.md`);
ruling is `notes/T024-corpus-breadth.md` §3, §5.

## 0. Headline

**S6 landed in all SIX lanes.** `pnpm e2e` reports
`6 demos x 6 scenarios, all observations equal` — 36 byte-identical observation
records where there were 30. **No emitter threw on the S6 IR**, so T024's
capability-free ruling holds for this scenario, though §3 narrows what
"capability-free" means on this axis. **No existing golden moved** and no
existing observation string changed.

**The S6 IR carries ZERO zero-read sites, 0 of 14**, re-derived with a walker
that enumerates no node kinds at all (§1).

**All six S6 mutants go RED, every one at the lane's own in-box assertion**, with
the same sentence in every lane (§5). Established by a hand run of the harness's
own steps, because the harness itself is blocked — §6.

**THE FINDING, and it is the one this axis was placed third in the order to
catch.** One authored space inside a static text node splits the six lanes
**3–3**. react, qwik and svelte render it; solid, vue and angular erase it. It is
reachable from `.tsrx` source, it passes every gate in this repo, and it was
measured end-to-end in all six real browser lanes rather than read off an AST.
§4. **Nothing was normalised to make it go away**, and it is not in the shipped
fixture; §4.4 says exactly why and what the alternative would have cost.

**Two things this axis turned out NOT to be**, both measured and both narrowing
the finding rather than widening it: the tab/newline half of the Vue-versus-
Angular divergence is unreachable from `.tsrx` (§2), and whitespace carried by
DATA is preserved verbatim by all six lanes (§3.2).

---

## 1. The zero-read-site count, RE-DERIVED

The card's stop_if is "the S6 IR carries ANY zero-read site" and the discipline
line is MEASURE, NEVER INHERIT, so T033's, T034's and T026's readers were not
reused. The walk written for this card **enumerates no node kinds**: it visits
every object in the IR generically, records the KEY PATH at which each `reads`
array sits, and classifies a site from that path. A site kind nobody thought to
enumerate cannot be missed by construction.

```
DOM/dynamic sites (incl. event handlers) = 17
ZERO-READ DOM SITES = 0  []
all `reads` arrays anywhere in the IR: total=31  empty=7
  components.0.locals.0     // let done   = state(1)
  components.0.locals.1     // let unit   = state('px')
  components.0.locals.3     // let joiner = state('|')
  records.bindings.1        // prop:props — the root prop
  records.bindings.2        // state:done
  records.bindings.3        // state:joiner
  records.bindings.6        // state:unit
```

Three state declarations initialised from literals, each appearing once as a
local and once as a binding, plus the props root. `locals.2`
(`note = state(label)`) and `locals.4` (`rows = state(seed.slice())`) both read a
prop; `total` is a computed and reads. None of the seven is a dynamic DOM site.
Exactly S5's class, one state narrower.

The registered test in `enriched-ir.test.ts` counts **14**, not 17, and the
difference is not a disagreement: that walker is the S4/S5 shape and does not
visit `records.events`, whose three handler `reads` arrays are the other three.
Both numbers are reported because only one of them is what the registered test
will keep asserting.

Four registered tests now run on every `pnpm test`: the zero-read count, that
every static text node is `trim()`-stable (§3.1), the compiler's own whitespace
normalisation table (§2), and that the corpus really did gain runs of adjacent
dynamic text with no whitespace between them.

## 2. WHAT THE COMPILER DOES TO TEMPLATE TEXT — measured, and it narrows the axis

T024 ratified this axis on a Vue-versus-Angular disagreement that included the
treatment of a **tab** and a **lone newline**. Half of that turns out to be
unreachable from this toolchain, and it was worth ten minutes to find out before
authoring a fixture around it. MEASURED at `@markless/compiler` 0.1.1, by
building the IR for each shape:

```
authored           IR text node
"two  spaces"  ->  "two  spaces"     a run of SPACES survives verbatim
"a   b"        ->  "a   b"           at any length
"tab\there"    ->  "tab here"        a TAB becomes exactly one space
"tab\t\there"  ->  "tab  here"       one space PER tab — mapped, not condensed
"x\t y"        ->  "x  y"            same
"x\ny"         ->  "x y"             a NEWLINE becomes exactly one space
```

So **an emitter can never be handed a tab or a newline inside template text from
a `.tsrx` source.** The lanes do disagree about those two characters — measured:
Vue's condense turns `tab\there` into `tab here` while Angular's `parseTemplate`
keeps the tab verbatim — but no authored program can reach that disagreement, and
testing it would have been out of envelope.

A run of SPACES is fully reachable, and that is the half §4 reports.

This table is a registered test, so a future compiler bump that starts condensing
`two  spaces` goes red here rather than being discovered as a cross-lane diff.

## 3. What landed

### 3.1 The fixture, and the constraint that shaped every line of it

`packages/compiler/test/fixtures/s6-whitespace-text.tsrx`. Five states (`done`,
`unit`, `note`, `joiner`, `rows`), one computed (`total`), one flat keyed repeat,
three handlers. **No branch** — S5 owns teardown, and avoiding one also avoids
the Solid `show-two-arm` constraint T026 recorded, which is why §3.4 has no
finding to report against it.

Five text runs, each a different shape:

| marker | authored | what it is for |
| --- | --- | --- |
| `data-ratio` | `{done}/{total}` | S2's near-miss, reproduced deliberately |
| `data-glue` | `start{done}{unit}end` | TWO ADJACENT interpolations inside a text run |
| `data-wrap` | `[{note}]` | whitespace carried by DATA, not by the template |
| `data-mixed` | `a<b data-emph>{unit}</b>z` | text / inline element / text, zero whitespace |
| `data-static` | `one two three` | interior single spaces in a static node |
| `data-pair` (per row) | `{row.left}{joiner}{row.right}` | THREE adjacent interpolations, inside a repeat |

**EVERY static text node in the fixture is `trim()`-stable, and that is a
measured constraint, not a style choice.** The Angular emitter's `escapeText`
(`packages/frameworks/angular/src/emitter/index.ts:788`) THROWS on template text
whose own edges are whitespace, and the Vue gate's `condense-stable-text`
(`packages/frameworks/vue/src/gate/index.ts:869`) rejects the emitted result of
the same shape. So `<p>{a} of {b}</p>` — the obvious way to write this scenario —
cannot be authored at all: `" of "` is not trim-stable and the Angular lane
throws before anything is measured.

That is asserted rather than commented, by a registered test, so a future edit
that adds a space next to an interpolation fails in the compiler package instead
of three lanes downstream.

### 3.2 Every space this scenario needs beside a value travels as DATA

Because the template cannot carry one. `label = ' wide  load '` (leading space,
interior DOUBLE space, trailing space) and the `joiner` state (` w2 ` after the
click) are the vehicles, and the split is the scenario's sharpest claim, because
the two halves are **not** treated alike:

```
template whitespace     normalised by three of six lanes   (§4)
interpolated whitespace normalised by NONE of them         (measured, six lanes)
```

`[ wide  load ]` and `[  wide  load  ]` read byte-identically in all six lanes,
including the three that condense the template. That is not an inference from the
compilers' documentation — it is what the six lanes rendered in `pnpm e2e`.

### 3.3 The golden

`packages/compiler/test/goldens/s6-whitespace-text.json`, created with
`UPDATE_GOLDENS=1 pnpm test`, then proven byte-stable by re-running **without**
it. `git status --short` shows the S1–S5 goldens **unmoved**: the only new file
under `goldens/` is the S6 one.

### 3.4 Six emitters, no throw, byte-stable

All six `regenerate` scripts learned the fixture; all six produced output; none
threw. Byte stability was proven by sha256 across a second regeneration rather
than by `git diff --exit-code`, which is **vacuous for a new file** — the six
`generated/S6.*` are untracked on this tree:

```
b8ef9a25…  packages/frameworks/react/generated/S6.jsx
5c97f42f…  packages/frameworks/solid/generated/S6.jsx
4df568f9…  packages/frameworks/qwik/generated/S6.jsx
95413c6a…  packages/frameworks/svelte/generated/S6.svelte
718bc70c…  packages/frameworks/vue/generated/S6.vue
8bd2770c…  packages/frameworks/angular/generated/S6.ts
```

Identical before and after a second `regenerate` in all six, and identical again
after the twelve hand runs in §5 and §4 had each mutated and restored them. The
`git diff --exit-code` over the six `generated/` directories is also clean, which
is the S1–S5 half of the same claim.

**One emitted shape is worth recording**, because it is the reason §5's mutant is
anchored where it is. The three JSX lanes broke the `glue` run across lines:

```jsx
<p data-glue="true">
	start{done}
	{unit}end
</p>
```

That renders `start1pxend` — JSX discards whitespace adjacent to a newline — and
all three agree with the three lanes that emitted it inline. But it means a
mutant placed at the LINE BOUNDARY would be a silent no-op in react, solid and
qwik and a real edit in svelte, vue and angular, which would have made the
harness's verdict a property of the emitters' line breaking rather than of the
corpus.

### 3.5 Six demo routes

`/s6` in every lane, each following that scaffold's own convention: a `switch`
arm in the react `App`, a `<Match>` in solid's `<Switch>`, a
`src/routes/s6/index.tsx` in qwik, a `src/routes/s6/+page.svelte` in svelte, a
`v-else` arm in the vue `App` (S5's `v-else` became `v-else-if` so the chain still
terminates in exactly one default, exactly as S4's did for S5), and a sixth entry
in Angular's `app.routes.ts` carrying its props as route `data`.

The seed and the label are byte-identical in all six:

```js
[{ id: 'w1', left: 'a', right: 'b' }, { id: 'w2', left: 'c', right: 'd' }]
' wide  load '
```

TWO rows, and the count is deliberate: `joiner` is a single component-level
separator that BOTH rows interpolate, so a lane that rebuilt only the clicked row
reads a mixed `pairs` string. One row could not distinguish that from a correct
update.

The qwik route passes `label` as an **expression** (`label={label}`) rather than
as a JSX string attribute. A string attribute is the one position where a JSX
transform is entitled to normalise whitespace, and the value is the observation.

### 3.6 The contract

`three-way-contract.ts` gains `'s6'`, `assertS6`, `measureExactText`,
`measureTextKeys`, `measureWhitespace`, `requireWhitespace` and a **measured**
`resumeSymbols` entry.

**`measureText` is byte-unchanged, and that is the single most load-bearing
decision in this card.** It ends `.replace(/\s+/g, ' ').trim()` — which is
correct for the five scenarios that read through it and is *exactly the
normalisation S6 exists to measure*. A shared reader, or a flag on the existing
one, would have made this scenario unable to fail. `measureExactText` is a
separate function that keeps the comment- and tag-stripping (React writes
`<!-- -->` between adjacent text children, Solid wraps every interpolation in
`<!--$-->…<!--/-->`) and drops nothing else.

Rows are keyed with `data-oracle-text-key`, a **fourth** key attribute, for the
reason S4 introduced the second and S5 the third: `measureRowKeys`,
`measureCellKeys` and `measureBranchKeys` each match their own attribute
globally, so a scenario reusing one would silently join that scenario's
observation string.

Two independent instruments end up on every S6 reading, which is deliberate:
`measureExactText` reads the **serialized DOM** through `page.content()` and
preserves everything, while `expect.page.text` compares `el.textContent.trim()`
**in the browser**. Every S6 marker's text begins and ends with a non-space
character, so the trim removes nothing and the two must agree.

### 3.7 The six observations

```
server-rendered ratio "1/2", glue "start1pxend", wrap "[ wide  load ]", mixed "apxz", static "one two three" and pairs w1="a|b" w2="c|d"
after one tick ratio "2/2", glue "start2emend" and mixed "aemz" with wrap still "[ wide  load ]"
after padding the note wrap "[  wide  load  ]" and static still "one two three"
after widening w2 pairs w1="a w2 b" w2="c w2 d" and glue still "start2emend"
1 document request served this page
no console errors and no failed requests
```

Every measured string is `JSON.stringify`d into the observation. A failure on
this scenario is by construction a difference of invisible characters, and
`expected "a b" but got "a b"` is not a diagnostic.

| step | what must move | what must not |
| --- | --- | --- |
| `tick` | `ratio`, `glue`, `mixed` | `wrap`, `static`, `pairs` |
| `pad` | `wrap`, and ONLY by whitespace | everything else |
| `widen` (inside a keyed row) | `pairs`, in BOTH rows | `glue`, `static` |

**`pad` could not have been written any other way.** It replaces the interpolated
value with the same value plus one leading and one trailing space, so the update
is invisible to any comparison that trims — including `measureText`, which every
other scenario in the contract reads through. A renderer that diffed text after
normalising it satisfies every other step in the corpus and produces no change at
all here.

### 3.8 Qwik pulled three segments for three clicks

`resumeSymbols.s6` was **measured** off this lane's own `handlerSegments`
evidence. Three segments, in click order, verbatim:

```
WhitespaceBoard.jsx_WhitespaceBoard_component_section_button_q_e_click_C410pHxdYjw.js
WhitespaceBoard.jsx_WhitespaceBoard_component_section_button_q_e_click_1_6HsIOE63DYU.js
WhitespaceBoard.jsx_WhitespaceBoard_component_section_ul_li_button_q_e_click_imyNaruplkc.js
```

Three clicks, three segments, and the one-to-one is the reading: no handler here
shares a QRL with another, so each click paid for exactly its own import. S5's six
clicks pulled four, because a rebuilt subtree resolved out of an already-imported
QRL; S6 has no rebuilt subtree.

## 4. THE FINDING — one space, and the six lanes split 3–3

### 4.1 What was measured, and how

The instrument is **the shipped S6 scenario itself**, run through each lane's own
demo pipeline in a real browser. One byte was changed in each lane's
`generated/S6.*` — the static text node `one two three` became `one  two three`,
a single extra space — then that lane's own `copy-emitted` (`build:e2e` for
angular) and its own witness box were run, and the file was restored from saved
bytes and verified by sha256. Nothing else was touched. This is not an AST
reading and not a documentation claim.

```
authored in the emitted template:  one  two three

react    rendered "one  two three"   PRESERVED   box FAILED (the change reached the DOM)
qwik     rendered "one  two three"   PRESERVED   box FAILED
svelte   rendered "one  two three"   PRESERVED   box FAILED
solid    rendered "one two three"    CONDENSED   box PASSED (the change was erased)
vue      rendered "one two three"    CONDENSED   box PASSED
angular  rendered "one two three"    CONDENSED   box PASSED
```

The three failures raise the same sentence, verbatim:

```
as served the fixed text reads "one  two three", not "one two three".
```

The three passes are the finding. A box that passes here passed because the lane
**erased** the difference; three lanes rendered the author's characters and three
rendered different ones, from one shared IR. `pnpm e2e`'s cross-lane observation
diff would report `s6` divergent, with react/qwik/svelte on one side and
solid/vue/angular on the other.

### 4.2 Confirmed independently, at each lane's own compiler

The end-to-end result above was cross-checked against each template compiler in
isolation, on the string `two  spaces here`, so the mechanism is named and not
merely observed:

```
react    react-dom 19.2.3 renderToString      -> "two  spaces here"
svelte   svelte 5.56.8 compile+render(server) -> "two  spaces here"
solid    babel-preset-solid 1.9.12, ssr       -> "two spaces here"
vue      @vue/compiler-sfc 3.5.40 + SSR       -> "two spaces here"
angular  @angular/compiler 22.0.8 parseTemplate -> Text "two spaces"
```

**Solid is the surprise.** It is on the same JSX path as react and qwik, and it
is the only JSX lane that condenses — `babel-plugin-jsx-dom-expressions` 0.40.7
normalises JSX text whitespace before it builds its template string. Nothing in
this repo predicted that, and nothing in this repo would have caught it: the Solid
gate has no whitespace policy at all, because Solid was assumed to behave like
React here.

### 4.3 Why NO gate catches it

Both lanes that documented their whitespace rule guard the same thing, and it is
not this thing. `condenseViolations` (vue) and `whitespaceViolations` (angular)
both reduce to:

```js
if (content !== content.trim() || content.length === 0) // violation
```

That rejects a text node whose **edges** are whitespace. `one  two three` is
`trim()`-stable, so it passes both gates, passes both emitters' `escapeText`
equivalents, type-checks, lints, and renders differently in three of six lanes.
Solid and svelte have no whitespace policy to pass or fail.

The hole is precisely the difference between "no text node may have a whitespace
EDGE" — which is what was implemented — and "no text node's whitespace may be
rewritten by a lane's own template compiler", which is what the divergence is
about. It is reachable from `.tsrx` source: §2 measured that the compiler hands a
run of spaces through verbatim.

### 4.4 What was NOT done about it, and why that is the card's instruction

**No emitter was normalised. No gate was widened. No assertion was weakened.**
The card's stop_if says a cross-lane whitespace divergence must be recorded
verbatim with the lanes' measured strings and must not be normalised away, and
that is what §4.1 is.

**The divergent construct is not in the shipped fixture**, and the reasoning is
stated here rather than left implicit, because it is the one judgement call on
this card:

- Putting `one  two three` in the fixture would have made S6 permanently red in
  three lanes. Phase F's stopping rule requires each scenario to land in **all
  six**, so that outcome is the broken-matrix case, not partial progress — and it
  would have cost the corpus the four whitespace claims S6 *can* prove in six
  lanes (adjacency at four shapes, and interpolated whitespace, §3.2).
- Recording the divergence without shipping it costs nothing: §4.1 is
  reproducible in one command per lane, the mechanism is named per lane in §4.2,
  and §4.3 names the exact predicate that would have to change.
- The alternative reading — that omitting it converts the finding into silence —
  is the one the card forbids, and it is why this section exists at this length
  rather than as a line in a receipt.

**This is an open FINDING for the PM, not a repair this card was scoped to
make.** Deciding whether the six lanes should agree here — and if so, whether by
widening the two gates to reject any multi-space run, by adding a whitespace
policy to the solid and svelte gates, or by ruling the divergence acceptable and
documenting it — is a policy question about the emitters, which this card's
`allowed_files` deliberately does not reach.

## 5. The mutation budget — six mutants, six red sites

One mutant per lane, one axis, spelled in each lane's own interpolation idiom.
T024 §5 ratified the axis in these words: *the mutant must alter exactly one text
node's leading or trailing whitespace.*

**A single space is inserted between the `start` text node and the interpolation
glued to it**, giving that text node a trailing space it did not have. Not a
character changes anywhere else.

| lane | mutant | red site | evidence |
| --- | --- | --- | --- |
| react | `start{done}` → `start {done}` | in-box assertion | `expected '[data-glue="true"]' to have text "start1pxend", but it was "start 1pxend"` |
| solid | `start{done()}` → `start {done()}` | in-box assertion | same sentence |
| qwik | `start{done.value}` → `start {done.value}` | in-box assertion | same sentence |
| svelte | `start{done}{unit}end` → `start {done}{unit}end` | in-box assertion | same sentence |
| vue | `start{{ done }}{{ unit }}end` → `start {{ done }}{{ unit }}end` | in-box assertion | same sentence |
| angular | `start{{ done }}{{ unit }}end` → `start {{ done }}{{ unit }}end` | in-box assertion | same sentence |

Six spellings, one per renderer, not inherited between lanes. Each anchors
**exactly once** in its file and each changes the bytes, checked independently of
the harness.

**Why the `start` run and not one of the other five text sites.** It is the only
one all six lanes spell as text immediately followed by an interpolation on the
SAME line — see §3.4. A mutant at a line boundary would have been a silent no-op
in the three JSX lanes.

**Why this mutant and not a blunter one.** It goes red on the scenario's FIRST
reading, before any click, on a one-character difference that `measureText` —
the reader every other scenario in the contract uses — would have collapsed away.
That is the whole reason `measureExactText` exists, and this mutant is what makes
that reader load-bearing rather than decorative. It is also the exact class the
corpus nearly shipped: S2's `1/2` becoming `1 /2`, one authored line, one
invisible character, no error anywhere.

**All six lanes go red at their own in-box assertion.** None reaches the
cross-lane observation diff, which is the same result S1–S5 produce and the
reason `CLASSIFIER_CALIBRATION` exists.

## 6. THE BLOCKER — the harness cannot run against a dirty surface

`pnpm mutate:corpus` refuses to start against a dirty mutation surface, and
`--dry-run` does **not** bypass it: `assertCleanSurface()` runs *before* the
dry-run branch (`corpus-mutation.mjs:719` at dispatch). Registering S6
necessarily adds twelve files to that surface, so the refusal is unavoidable and
it is **correct** — every verdict the harness issues is "the box behaved
differently once ONE known byte range changed", which is false if something else
in the surface had already changed, and its `restore()` would `git checkout` over
uncommitted work.

Verbatim, this run:

```
Error: The mutation surface is dirty before the first mutation, so no verdict
this harness issues would be attributable to its own mutant, and restoring would
discard uncommitted work. Commit or stash first:
?? packages/frameworks/angular/generated/S6.ts
?? packages/frameworks/qwik/generated/S6.jsx
?? packages/frameworks/react/generated/S6.jsx
?? packages/frameworks/solid/generated/S6.jsx
?? packages/frameworks/svelte/generated/S6.svelte
?? packages/frameworks/vue/generated/S6.vue
```

**No temporary commit was created and no history was rewritten.** T034 did that
and unwinding it was avoidable churn; T026 was told not to repeat it and did not,
and neither did this card.

So the two harness commands are reported **blocked**, for the PM to run after
committing:

```
pnpm mutate:corpus --scenario s6
pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3 --scenario s4 --scenario s5
```

### 6.1 What was done instead, and what it is worth

The six red sites in §5 — and the six lanes in §4.1 — were established by a
**hand run of exactly the steps the harness performs**, minus every git
operation: read the pristine bytes, assert the anchor occurs exactly once, assert
the mutant changes the bytes, run the lane's own `copy-emitted` (`build:e2e` for
angular), run its witness box, read the verdict, then restore **from the saved
bytes** and verify with sha256, then re-run the lane's own `copy-emitted` so the
demo copy matches its `generated/` source again.

Twelve such runs happened on this card (six mutants, six divergence probes). All
twelve restored byte-identical; the six sha256 values in §3.4 are unchanged after
all of them, and `git diff --exit-code` over the six `generated/` directories is
clean.

This is **not** a harness verdict and is not offered as one. It cannot classify a
`cross-lane observation diff` red, and it does not exercise the harness's own
`replaceOnce`/`mutate`/`restore` code paths. What it does establish is what the
card asks to be recorded per lane: the mutant bites the emitted text, and the
lane goes red on it, with the raised sentence quoted.

### 6.2 The 30/30 regression check is blocked for the same reason

It is **not** claimed here. What can be stated is narrower and was measured: the
six `generated/S1..S5.*` are byte-unchanged (`git diff --exit-code` clean over
all six `generated/` directories), the S1–S5 goldens are unmoved, and the s1–s5
observation strings in this tree's `pnpm e2e` are byte-identical to the ones T026
recorded — they are printed above the s6 rows in the same matrix.

## 7. The derivation held, and only budgets needed a hand

T035/T036's derived corpus inventories picked S6 up with **ZERO edits**
everywhere derivation applies: every lane's gate test, emitter test, parse-emitted
test, type-check test and the compiler's own sufficiency loops all found S6 on
their own. `pnpm test` went from 929 to 944 with no inventory edited.

The only two hand edits were the **size budgets**, in the two files T027's card
correctly added to `allowed_files` after T026 was blocked by their absence. A
budget is a recorded measurement and cannot be derived from the thing it grades.
MEASURED off this tree's emitted output:

```ts
// packages/frameworks/react/test/size.test.ts
S6: { physicalLoc: 73, structuralNodes: 353 },

// packages/frameworks/solid/test/size.test.ts
S6: { physicalLoc: 67, structuralNodes: 351 },
```

Solid records FEWER structural nodes than react here, the reverse of S5: S6 has
no branch, and `<For>` over a flat list costs less than react's `.map()` arrow
once no `<Show>` wrapper is in the way.

**No inventory needed a hand edit, so there is no derivation defect to report.**

## 8. PARALLEL SAFETY — another agent wrote this repo during this card

The card was dispatched with "Tree is clean … a read-only Judge is running on the
Angular board". `git status --short` was empty at the first command of this
session. At the last one it holds two entries that are not this card's and were
not touched by it:

```
 M docs/goals/frameless-angular-v1/state.yaml
?? docs/goals/frameless-angular-v1/notes/T009-control-flow.md
```

That Judge **wrote**, which is worth the PM knowing given it was described as
read-only. Both paths are a different goal's board and note, disjoint from
everything touched here and from `MUTATION_SURFACE` (which contains no
`docs/**`), so no verdict above is attributable to them and `pnpm mutate:corpus`
cannot `git checkout` over them.

## 9. What was NOT done, and why each refusal is the card's

- **`measureText` untouched, byte for byte.** §3.6.
- `measureRowKeys`, `measureCellKeys` and `measureBranchKeys` untouched.
- No `expectedNavigations` entry relaxed; the table is per lane and unchanged.
- No activation-neutrality assertion weakened. `assertServedActivation` is
  unchanged and S6 goes through it in all six lanes like every other scenario.
- No existing golden regenerated, and no existing observation string moved.
- **No emitter's whitespace handling normalised, and no gate widened.** §4.4.
- The compiler and the six emitters were not touched at all. This card adds a
  fixture and registers it; it repairs nothing.
- No temporary commit, no `git reset`, no history rewrite.
- No branch in the fixture, so the Solid `show-two-arm` constraint T026 recorded
  had nothing to bite — deliberately, since S5 owns the teardown axis.

## 10. Reproducing every claim in this note

```
UPDATE_GOLDENS=1 pnpm test && pnpm test          # the golden, created then proven stable (944)
pnpm --dir packages/frameworks/react/ regenerate # and solid, qwik, svelte, vue, angular
pnpm check && pnpm lint && pnpm test:browser     # react 60, solid 49, svelte 13, vue 18
pnpm e2e                                          # 6 demos x 6 scenarios, all observations equal

# the harness needs a COMMITTED mutation surface — see §6
pnpm mutate:corpus --scenario s6
pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3 --scenario s4 --scenario s5
git diff --exit-code -- packages/frameworks/*/generated
```

To watch a red site directly without the harness, edit
`packages/frameworks/svelte/generated/S6.svelte` to read
`start {done}{unit}end` and run
`pnpm --dir demos/svelte-official copy-emitted && pnpm --dir demos/svelte-official exec witness run`.

**To reproduce §4's finding**, do the same edit to `one two three` →
`one  two three` in each lane's `generated/S6.*` and run that lane's
`copy-emitted` and box. react, qwik and svelte go red; solid, vue and angular
pass, because they erased the change. Restore afterwards — the sha256 values in
§3.4 are the check.

The §1 measurement is reproduced by walking `buildEnrichedIr`'s output over
`packages/compiler/test/fixtures/s6-whitespace-text.tsrx`; the four registered S6
tests assert the same properties on every run, and the §2 table is one of them.
