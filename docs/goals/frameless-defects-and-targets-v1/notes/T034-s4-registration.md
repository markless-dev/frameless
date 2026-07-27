# T034 — S4 registered in all six lanes, and Angular ruling 3d finally measured

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree at `8e5f8f3`. Delivers T025's deliverable 2, unblocked by T033
(`notes/T033-nested-repeat.md`).

## 0. Headline, in the order the card ranked it

**ANGULAR RULING 3d IS ENFORCED. IT IS NOT FOLKLORE.** The ratified
`forVariables` order-swap mutant went **RED**, at the lane's own in-box
assertion, with this evidence read out of the witness receipt:

```
angular s4 — RED at in-box assertion
    axis:    Angular ruling 3d — enclosing @for variables passed OUTERMOST FIRST
    mutant:  onH9Click(group, row, $event)  ->  onH9Click(row, group, $event)
    expect:  the handler receives the row where it expects the group, so selection
             reads r2>g1 instead of g1>r2 and `marked` is set to a GROUP id,
             leaving no data-cell-on element
    evidence: expected '[data-selection="true"]' to have text "g1>r2", but it was
             "r2>g1" (page http://127.0.0.1:5173/s4, waited 5000ms)
```

3d moves from "a rule with zero instances **and a known reason there are none**"
(T025 §4.6) to a rule with an instance, a red site and a two-sided calibration.
The instance is the repo's first nested Angular call site emitted over a
**correct** IR; T025 saw the same call site over a broken one and correctly
refused to read anything from it.

**S4 landed in all SIX lanes on the first run.** `pnpm e2e` reports
`6 demos x 4 scenarios, all observations equal` — 24 byte-identical observation
records where there were 18. No emitter threw. No existing golden moved.

**The batch is BLOCKED on eleven files outside `allowed_files`**, all of the same
one class: per-lane inventories that enumerate the scenario corpus as exactly
three files. §6 has the list and the exact change each needs. Nothing was
patched over and none of them was touched.

---

## 1. The zero-read-site count, RE-DERIVED

The card's stop_if is "the S4 IR still carries ANY zero-read site", and its
discipline line is MEASURE, NEVER INHERIT. T033's claim was therefore **not**
taken on trust and the assertion in its test was **not** taken as the
measurement. An independent walk was written against `buildEnrichedIr`'s output
on this tree — its own traversal, its own site collection, its own reader — and
run before any edit:

```
TEMPLATE sites = 16
ZERO-READ TEMPLATE SITES = 0 []
  text:0 text            => state:selection//direct
  text:1 text            => computed:cells//direct
  text:3 text            => state:groups/length/direct
  repeat:0 collection    => state:groups//direct
  repeat:0 key           => state:groups/id/repeat-item
  host h6 data-oracle-group-key => state:groups/id/repeat-item
  host h7 data-rows      => state:groups/id/repeat-item
  repeat:1 collection    => state:groups/rows/repeat-item
  repeat:1 key           => state:groups/rows/id/repeat-item
  host h8  data-oracle-cell-key => state:groups/rows/id/repeat-item
  host h9  data-select   => state:groups/rows/id/repeat-item
  branch-site:0 branch   => state:groups/rows/id/repeat-item | state:marked//direct
  host h10 data-cell-on  => state:groups/rows/id/repeat-item
  host h11 data-cell-off => state:groups/rows/id/repeat-item
  host h12 data-cell-open=> state:groups/rows/id/repeat-item
  host h13 data-open-cell=> state:groups/rows/id/repeat-item

event:2 host=h9 handler[0] => prop:props/onTrace/alias
                            | state:groups/id/repeat-item
                            | state:groups/rows/id/repeat-item
```

Sixteen sites, **zero** empty. T025 measured 7 of 16 empty on the same fixture.
The repair holds.

An exhaustive scan of *every* `reads` array anywhere in the IR — not only DOM
sites — reports `total=29 empty=5`, and the five are named here so the number is
not mistaken for a residue of the defect:

```
ir.components[0].locals[1].reads      // let selection = state('none')
ir.components[0].locals[2].reads      // let marked    = state('none')
ir.records.bindings[1].reads          // prop:props    — the root prop
ir.records.bindings[3].reads          // state:marked
ir.records.bindings[4].reads          // state:selection
```

Three state declarations initialised from string literals, plus the props root.
A literal initializer reads nothing; none of the five is a dynamic DOM site and
none is reachable by the sufficiency test. The registered fixture-family
sufficiency test now runs over S4 on every `pnpm test` and asserts the property
directly.

## 2. What landed

### 2.1 The compiler

`s4-nested-list.tsrx` joins `FIXTURES`, with its `EXPECTED_HOSTS` row and its
callback row (`flip`, `reorder`, `select`). It is now covered by every
fixture-family test the other three carry: dynamic-site sufficiency, closed graph
reads, no degraded paths, no dangling `graphNodeId`, host inventory, record-table
sort keys, AST operands on lowered writes, the top-level shape allowlist, and the
golden.

`packages/compiler/test/goldens/s4-nested-list.json` was created with
`UPDATE_GOLDENS=1 pnpm test` and then proven stable by re-running **without** it.
`pnpm test` reports `879 passed` on the compiler suite either way, and
`git status --short` shows the S1/S2/S3 goldens **unmoved** — the new golden is
the only new file under `goldens/`.

### 2.2 Six emitters, no throw

All six `regenerate` scripts learned the fixture; all six produced output; none
threw on the S4 IR. `git diff --exit-code` over all six `generated/` directories
after a second regeneration is clean, so the output is byte-stable.

The Angular output is the one worth reproducing, because it is the ruling's
instance:

```html
@for (group of groups; track group.id) {
  <li [attr.data-oracle-group-key]="group.id">
    <ul [attr.data-rows]="group.id">
      @for (row of group.rows; track row.id) {
        <li [attr.data-oracle-cell-key]="row.id">
          <button [attr.data-select]="row.id" (click)="onH9Click(group, row, $event)">
```

```ts
onH9Click(group: any, row: any, event: any): void {
  this.selection = `${group.id}>${row.id}`;
  this.marked = row.id;
```

### 2.3 Six demo routes

`/s4` in every lane, each following that scaffold's own existing convention and
nothing else: a `switch`/`Switch` arm in the react and solid `App`, a
`src/routes/s4/index.tsx` in qwik, a `src/routes/s4/+page.svelte` in svelte, a
`v-else` arm in the vue `App`, and a fourth entry in Angular's `app.routes.ts`
carrying its props as route `data`. The seed is byte-identical in all six.

The seed's ids are drawn from **disjoint alphabets** and that is load-bearing
rather than cosmetic:

```js
[{ id: 'g1', rows: [{ id: 'r1' }, { id: 'r2' }] },
 { id: 'g2', rows: [{ id: 'r3' }] }]
```

If group ids and row ids shared an alphabet, a swapped Angular argument list
could produce a selection string that reads plausibly either way, and the 3d
mutant would have had a weaker red site than the one it got.

### 2.4 The contract, and the reader that carries the nesting

`three-way-contract.ts` gains `'s4'`, `assertS4`, a measured `resumeSymbols`
entry, `measureGroupKeys` and `measureCellKeys`.

`measureRowKeys` is **byte-unchanged**, and deliberately was not refactored into
the shared helper the two new readers use. S4's inner rows carry
`data-oracle-cell-key` precisely so S2's flat `data-oracle-row-key` read keeps
measuring exactly what it measured before a nested list existed; folding the two
into one function would have made S2's observation depend on code S4 also drives.
The duplication is the point.

`measureCellKeys(html, group)` is **scoped to that group's own
`<ul data-rows="…">`**, and that scoping is why the five structural S4 mutants
have a red site at all. A flat read over `data-oracle-cell-key` cannot tell "each
group holds its own rows" — which is what the containment relation a nested
repeat *is* — from "every group renders the same shared row list", and the second
of those is exactly the cross-product shape `@markless/compiler` 0.1.1 could
already resolve while a genuine per-group list lowered every `row.*` site to
`reads: []` (T025 §4.4). Reading per group is what makes S4 measure the nesting
rather than the mere presence of two loops.

### 2.5 The four observations, and what each transition isolates

| step | what must move | what must not |
| --- | --- | --- |
| `select` on an inner row | `selection`, `marked` | either list's order |
| `flip` | every group's INNER row order | the OUTER group order |
| `reorder` | the OUTER group order | any group's inner rows |

`flip` and `reorder` are a pair on purpose: an emitter that collapsed the two
levels into one satisfies `reorder` perfectly and fails `flip`, and an emitter
that lost the outer key does the reverse.

The 24 strings, identical in all six lanes:

```
server-rendered groups g1,g2 hold g1=[r1,r2] g2=[r3] with cells = 3/2 and selection = none
after selecting r2 selection = g1&gt;r2 with the on cell r2
after flip groups g1,g2 hold g1=[r2,r1] g2=[r3] and selection is still g1&gt;r2
after reorder groups g2,g1 hold g2=[r3] g1=[r2,r1] and cells = 3/2
1 document request served this page
no console errors and no failed requests
```

`&gt;` is not an artefact to be tidied away: the observation is read out of
`page.content()`, and the HTML fragment serializer escapes `>` in a text node.
The in-box assertion beside it goes through `expect.page.text`, which compares
the browser's own `textContent` and therefore asserts the literal `g1>r2`. Two
sites, two spellings, one fact — and the escaped form is identical in all six
lanes because all six are read through the same serializer.

### 2.6 Qwik resumed a handler from inside two nested lists

`resumeSymbols.s4` was **measured** off this lane's own `handlerSegments`
evidence rather than predicted from the emitted output:

```
NestedBoard.jsx_NestedBoard_component_section_ul_li_ul_li_button_q_e_click_bfV0WPU2PeY.js
NestedBoard.jsx_NestedBoard_component_section_button_q_e_click_DQAk0BV20io.js
NestedBoard.jsx_NestedBoard_component_section_button_q_e_click_1_XeuIGoMIWas.js
```

`section_ul_li_ul_li_button` is a handler pulled on demand from inside **two**
nested keyed lists. Every previous segment in the corpus bottoms out at one list
at most — s2's is `section_ul_li_button` — because until a nested repeat became
compilable there was no deeper site to resume into. That is a small, real,
first-of-its-kind reading and it is recorded in the contract beside the entry it
justifies.

## 3. The mutation budget — 6/6 RED, every one restored

`pnpm mutate:corpus --dry-run --scenario s4` → all six anchor uniquely and change
the bytes. `pnpm mutate:corpus --scenario s4` →
`PASS: 6 mutants, every one RED, every one restored.`

| lane | mutant | red site | evidence |
| --- | --- | --- | --- |
| react | `{group.rows.map((row) => (` → `{groups[0].rows.map((row) => (` | in-box assertion | `as served the nested lists read "g1=[r1,r2] g2=[r1,r2]", not "g1=[r1,r2] g2=[r3]"` |
| solid | `<For each={group.rows}>` → `<For each={groups[0].rows}>` | in-box assertion | same sentence |
| qwik | `{group.rows.map((row) => (` → `{groups[0].rows.map((row) => (` | in-box assertion | same sentence |
| svelte | `{#each group.rows as row (row.id)}` → `{#each groups[0].rows as row (row.id)}` | in-box assertion | same sentence |
| vue | `v-for="row in group.rows"` → `v-for="row in groups[0].rows"` | in-box assertion | same sentence |
| angular | `onH9Click(group, row, $event)` → `onH9Click(row, group, $event)` | in-box assertion | `expected '[data-selection="true"]' to have text "g1>r2", but it was "r2>g1"` |

Five different constructs, one per renderer, not inherited between lanes.

**The five structural mutants are deliberately NOT truncations.** Truncating an
inner list would also be caught by a flat count of cell keys, and a flat count is
precisely what `measureCellKeys` was written to be stronger than. `groups[0].rows`
leaves the derived `cells` value at `3/2` in the initial state and the flat set of
cell keys is a permutation of itself; the only thing that moves is **which group
holds which rows**. So the red is attributable to the containment relation and to
nothing else.

**Angular's is the ratified one and it is the only mutant on the table that tests
a standing ruling rather than an emitted construct.** It is not a claim about
correctness; it is the instrument. Had it survived, 3d would have had no red site
anywhere in the corpus and that would have been a finding about the ruling. It
did not survive.

### 3.1 The existing corpus is not blunted — 18/18 STILL RED

`pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3` →
`PASS: 18 mutants, every one RED, every one restored.`

Taken **after** S4 joined the corpus, on this tree, not inherited from T033. The
budget is now 24 mutants over 24 observation records, every one with a named red
site.

## 4. What was NOT done, and why each refusal is the card's

- `measureRowKeys` untouched, byte for byte.
- No `expectedNavigations` entry relaxed; the table is per lane and unchanged.
- No activation-neutrality assertion weakened; `assertServedActivation` is
  unchanged and S4 goes through it in all six lanes like every other scenario.
- No existing golden regenerated. `git status --short` proves it: the only new
  file under `packages/compiler/test/goldens/` is `s4-nested-list.json`.
- The compiler and the emitters were not touched at all. This card registers what
  T033 repaired; it repairs nothing itself.

## 5. One deviation, disclosed

`pnpm mutate:corpus` refuses to start against a dirty mutation surface — by
design, and the refusal is correct: every verdict it issues is "the box behaved
differently once ONE known byte range changed", which is false if something else
in the surface had already changed, and its `restore()` would discard uncommitted
work on the way out. Registering S4 necessarily adds twelve files to that surface
(six `generated/`, six demo `emitted/` copies), so the harness could not run
against an uncommitted tree at all.

A **temporary** commit was created solely to satisfy that precondition, the three
harness invocations and the `git diff --exit-code` check were run against it, and
it was then unwound with `git reset --mixed HEAD~1`. `HEAD` is back at `8e5f8f3`
and the working tree carries the same changes it carried before, uncommitted, for
the PM to commit. No commit remains.

## 6. THE BLOCKER — eleven files outside `allowed_files`

`pnpm test` and `pnpm test:browser` fail, **all eleven failures in one class**:
each is a per-lane inventory that enumerates the emitted scenario corpus as
exactly three files, and each now finds four. Not one of them is a defect in S4;
every failure is the assertion `discoverGeneratedFiles()` returning
`[S1, S2, S3, S4]` where a literal `[S1, S2, S3]` was written.

```
packages/frameworks/react/test/gate.test.ts                 discovers, parses, and accepts every checked-in generated component
packages/frameworks/react/test/emitted-typecheck.test.ts    every committed emitted component is discovered   (expected 12 to be 11)
packages/frameworks/solid/test/gate.test.ts                 discovers and accepts every checked-in generated component
packages/frameworks/solid/test/emitted-typecheck.test.ts    every committed emitted component is discovered   (expected 12 to be 11)
packages/frameworks/qwik/test/gate.test.ts                  discovers and accepts the clean S1/S2/S3 emitted corpus
packages/frameworks/svelte/test/gate.test.ts                discovers and accepts the clean S1/S2/S3 emitted corpus
packages/frameworks/svelte/test/compile-emitted.test.ts     covers exactly the three scenario components  (+ a `test.each` list)
packages/frameworks/svelte/test/emitted-smoke.browser.test.ts  discovers exactly the three emitted scenario components
packages/frameworks/vue/test/gate.test.ts                   discovers and accepts the clean S1/S2/S3 emitted corpus
packages/frameworks/vue/test/compile-emitted.test.ts        covers exactly the three scenario components  (+ a `test.each` list)
packages/frameworks/angular/test/gate.test.ts               discovers and accepts the clean S1/S2/S3 emitted corpus
```

Verbatim, from the Angular one:

```
AssertionError: expected [ 'generated/S1.ts', …(3) ] to deeply equal [ 'generated/S1.ts', …(2) ]
  [ "generated/S1.ts", "generated/S2.ts", "generated/S3.ts",
+   "generated/S4.ts",
  ]
```

Every one is outside this card's 46 `allowed_files`, so the card's first stop_if
applies and none was edited.

**This is not bookkeeping, and it should not be waived into the next card as a
one-line list edit.** These are the dossier **gates**: each test asserts the
discovered set and then runs `checkGeneratedFiles()` / the framework's own
compiler / a type-check over it. Because the inventory assertion is the *first*
statement in each test, the run aborts there — so as of this tree **the six
emitted S4 files have not yet been through any lane's gate, its compiler, or its
type-checker.** They have been through the behavioural lane, which is a different
instrument answering a different question.

The change is one line per file (two where a `test.each` list also enumerates the
corpus), but the *result* of making it is a real measurement that has not been
taken. It should be scoped as its own card, and that card should report what the
six gates say about S4 rather than assuming they say nothing.

## 7. Reproducing every claim in this note

```
UPDATE_GOLDENS=1 pnpm test && pnpm test          # the golden, created then proven stable
pnpm --dir packages/frameworks/react/ regenerate # and solid, qwik, svelte, vue, angular
pnpm check && pnpm lint
pnpm e2e                                          # 6 demos x 4 scenarios, all observations equal

# the harness needs a committed mutation surface — see §5
pnpm mutate:corpus --dry-run --scenario s4
pnpm mutate:corpus --scenario s4                              # 6/6 RED
pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3  # 18/18 STILL RED
git diff --exit-code -- packages/frameworks/*/generated
```

To watch ruling 3d's red site directly, edit
`packages/frameworks/angular/generated/S4.ts` to read
`onH9Click(row, group, $event)` and run the angular lane. The zero-read
measurement in §1 is reproduced by walking `buildEnrichedIr`'s output over
`packages/compiler/test/fixtures/s4-nested-list.tsrx`; the registered
`fixture-family sufficiency` test now asserts the same property on every run.
