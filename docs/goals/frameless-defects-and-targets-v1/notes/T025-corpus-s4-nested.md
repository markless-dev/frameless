# T025 — the corpus mutation harness, and why S4 did not land

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Implements the T024 ruling (`notes/T024-corpus-breadth.md`). Tree at `6a821b6`.

## 0. Headline, in the order the card ranked the two questions

**The calibration passed, and it is the result that outranked the batch.** The
existing corpus CAN be killed: 18 of 18 ratified mutants — one per lane per
scenario, over s1/s2/s3, each byte-verified non-identical — turned its lane's
witness box RED. A further 6 mutants, one per lane, prove the harness's *other*
verdict as well. So the eighteen byte-identical observation strings `pnpm e2e`
compares are measuring the corpus, not decorating it.

**S4 did not land, and it is not a partial matrix — it is a capability finding.**
Scenario S4 was ratified as *capability-free*. It is not. A keyed list of groups
whose groups each contain a keyed list of rows cannot be compiled by the shipped
toolchain at all: `@markless/compiler` 0.1.1's `buildSemanticGraph` does not
resolve the inner repeat's collection when that collection comes from the
enclosing repeat item, so `packages/compiler/src/build.ts:988` never registers
the inner loop variable, **every `row.*` site in the nested row lowers to
`reads: []`**, and the Solid emitter throws on the result. That falsifies §3's
"capability-free" premise for S4 and is a `stop_if` on the card, taken verbatim.

The repair is outside `allowed_files` in three different places at once — the
vendored compiler, `packages/compiler/src/build.ts`, and
`packages/frameworks/solid/src/emitter/index.ts` — so nothing was patched over.

---

## 1. What landed: the corpus mutation harness

`scripts/corpus-mutation.mjs`, exposed as the root script `mutate:corpus`.

For one `(lane, scenario)` pair it applies ONE byte-verified text mutation to
`packages/frameworks/<lane>/generated/<S>.<ext>`, runs that lane's witness box,
requires a failure, records which of the two sanctioned sites the red came from,
then restores from git and verifies the restoration.

### Mutation point

`packages/frameworks/<lane>/generated/`, because every demo's `copy-emitted`
runs first in `dev`/`build`/`build:e2e` and would overwrite a mutation placed in
the demo's own `src/emitted/`. T024 §5.

### The two T018 guards, both live

1. `mutate()` throws when its output is byte-identical to its input, and
   `replaceOnce()` throws unless its anchor occurs **exactly once** in the file
   it is handed. The second guard is the one that matters in practice: a mutant
   anchored on a string that has stopped occurring is silently a no-op, and a
   no-op mutant reports the corpus as unkillable when nothing was killed.
   `--dry-run` exercises both without spawning a browser.
2. Restoration is verified with `git status --porcelain` — not `git diff` —
   over the whole mutation surface, which is **twelve** directories, not six:
   the demo `emitted/` copies are TRACKED, so restoring only `generated/` would
   leave the mutant live for the next `pnpm e2e`. `--porcelain` also catches an
   untracked file a diff of tracked content would miss.

### Preconditions the instrument asserts about itself

- The mutation surface must be clean **before** the first mutation. Otherwise
  no verdict is attributable to the harness's own mutant, and `restore()` would
  discard the operator's uncommitted work on the way out.
- Every requested `(lane, scenario)` must have a ratified mutant before any
  process is spawned. A silently skipped pair would let a run report "every lane
  went red" over a set smaller than the one asked for. `--scenario s4` is
  refused today for exactly this reason, by name.
- `--scenario` has no default. A default scope would make "every lane went red"
  a claim about an unstated set.
- Each witness run must write a **new** receipt: the `latest` run id has to have
  moved, or the harness refuses to read a verdict out of a stale one.
- A failure of the lane's own `copy-emitted` / `build:e2e` is neither of the two
  sanctioned red sites, so it throws rather than being reported as a caught
  mutant.

### One reader, not two

`readThreeWayResults` moved into `scripts/corpus-mutation.mjs` and
`scripts/e2e.mjs` now imports it. The harness's "caught by the cross-lane
observation diff" verdict is only meaningful if it reads the *same* strings the
pipeline diffs; a second copy of the reader would be a second definition of the
observation, and the harness would be calibrating something `pnpm e2e` never
looks at.

---

## 2. Two-sided calibration on the EXISTING corpus — 18/18 RED

`pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3`
→ `PASS: 18 mutants, every one RED, every one restored.`

Each lane is run CLEAN first; that baseline must pass and must record
observations for every requested scenario. That is the positive arm, taken on
that lane on that invocation, never inherited from a previous `pnpm e2e`.

### The three axes, and why each mutant attacks its scenario's own claim

| scenario | axis attacked | what red proves |
| --- | --- | --- |
| s1 | derived recomputation after a state transition | the `kit:2 → kit:4` transition is measured, not merely rendered |
| s2 | the keyed-repeat construct itself — which rows it renders | the row set the list produces is measured |
| s3 | cancellation of a real default action **during dispatch** | the page surviving `cancel-submit` is measured |

### The 18 mutants, verbatim, with their red sites

Every one was caught at **site (i), the lane's own in-box assertion**. Evidence
is the sentence the assertion raised, read out of the witness receipt's
`boxes[].error.message` rather than scraped from stdout — where the run-summary
line "0 passed, 1 failed" would have won and reported nothing.

**s1 — `${…count…}` frozen to `1`, so `derived` cannot move**

| lane | mutant | red site | evidence |
| --- | --- | --- | --- |
| react | `${count * multiplier}` → `${1 * multiplier}` | in-box assertion | `expected '[data-value="derived"]' to have text "kit:4", but it was "kit:2"` |
| solid | `${count() * props.multiplier}` → `${1 * props.multiplier}` | in-box assertion | same assertion, same text |
| qwik | `${count.value * props.multiplier}` → `${1 * props.multiplier}` | in-box assertion | same assertion, same text |
| svelte | `${count * multiplier}` → `${1 * multiplier}` | in-box assertion | same assertion, same text |
| vue | `${count.value * props.multiplier}` → `${1 * props.multiplier}` | in-box assertion | same assertion, same text |
| angular | `${this.count * this.multiplier}` → `${1 * this.multiplier}` | in-box assertion | same assertion, same text |

**s2 — the keyed repeat's collection truncated, in each lane's own idiom**

| lane | mutant | red site | evidence |
| --- | --- | --- | --- |
| react | `{todos.map((todo) => (` → `{todos.slice(1).map((todo) => (` | in-box assertion | `expected 'ul li:first-child' attribute 'data-oracle-row-key' to be "a", but it was "b"` |
| solid | `<For each={todos}>` → `<For each={todos.slice(1)}>` | in-box assertion | same |
| qwik | `{todos.map((todo) => (` → `{todos.slice(1).map((todo) => (` | in-box assertion | same |
| svelte | `{#each todos as todo (todo.id)}` → `{#each todos.slice(1) as todo (todo.id)}` | in-box assertion | same |
| vue | `v-for="todo in todos"` → `v-for="todo in todos.slice(1)"` | in-box assertion | same |
| angular | `@for (todo of todos; track todo.id)` → `@for (todo of todos.slice(1); track todo.id)` | in-box assertion | same |

Not inherited between lanes: six different constructs, one per renderer.
Angular's is the only one that had to survive a template parser, and
`todos.slice(1)` does — no arrow function, so it stays inside Angular's template
expression grammar.

**s3 — `cancel-submit`'s `event.preventDefault();` replaced by `void event;`**

| lane | mutant | red site | evidence |
| --- | --- | --- | --- |
| react | `onClick={(event) => { event.preventDefault(); }}` on `data-action="cancel-submit"` → `{ void event; }` | in-box assertion | `clicking [data-action="cancel-submit"] left 2 Document requests on this page…` |
| solid | same shape, same anchor | in-box assertion | same sentence |
| qwik | `onClick$={[ sync$((event) => { event.preventDefault(); }) ]}` → `{ void event; }` | in-box assertion | same sentence |
| svelte | `onclick={(event) => { event.preventDefault(); }}` → `{ void event; }` | in-box assertion | **`navigations: expected 1, observed 2`** — see below |
| vue | `@click="(event) => { event.preventDefault(); }"` → `{ void event; }` | in-box assertion | same sentence as react |
| angular | `onH4Click(event: any): void { event.preventDefault(); }` → `{ void event; }` | in-box assertion | same sentence as react |

### The Svelte s3 result is a measured divergence, not a footnote

Five lanes go red at the **Document-request** check inside `assertS3`. Svelte
goes red one assertion later, at `expect.page.outcome`'s `navigations: expected
1, observed 2`, and never trips the Document check at all.

That is SvelteKit's client router intercepting the uncancelled form submit and
resolving it as a client-side navigation instead of a full document load. The
red is real, the mutant is caught, and the lane is not weaker — but *how* a lane
notices a lost `preventDefault()` is a per-framework fact, and any future
statement of the form "the corpus catches a dropped cancellation at the Document
check" is true of five lanes and false of one. MEASURE, NEVER INHERIT: this cell
was read off this lane's own receipt.

---

## 3. Calibrating the harness's OTHER verdict — 6/6, all six lanes

All eighteen mutants above were caught in-box. That is a good result for the
corpus and a bad one for the instrument: the `cross-lane observation diff`
branch of the classifier had issued no verdict, and a verdict path never
observed firing is not a verdict path.

`pnpm mutate:corpus --calibrate-classifier`
→ `PASS: 6 mutants, every one RED, every one restored.`

**The mutant:** `data-empty="true">empty<` → `data-empty="true">none<`,
byte-identical in all six emitted `S2` files, and `replaceOnce` re-proves its
uniqueness per lane on every run.

**Why it lands in the other class:** `assertS2`'s final step asserts only that
`[data-empty="true"]` EXISTS. The element's text is read by `measureText` into
the observation string and asserted nowhere. So every in-box assertion still
passes, the box exits green, and exactly one observation changes:

```
baseline  …,"after clear the empty branch renders and complete = 0/0",…
mutant    …,"after clear the none  branch renders and complete = 0/0",…
```

This arm is the only one that **asserts** its site: reaching "in-box assertion"
here would mean the harness cannot be shown to reach its second verdict, and the
run fails.

It is also the sharper half of the T024 question. "Every lane went red" would
still have been true of a corpus whose eighteen observation strings were
decorative, because the in-box assertions caught everything on their own. This
is the arm that shows the strings themselves carry signal.

**Both verdict classes now have a known member, in all six lanes.**

---

## 4. Why S4 did not land — the measurement, the throw, and the stop

### 4.1 The scenario that was authored

`packages/compiler/test/fixtures/s4-nested-list.tsrx` is committed as the
verbatim reproduction. It is deliberately NOT registered in
`enriched-ir.test.ts`'s `FIXTURES`, has no golden, and is not wired into any
`regenerate.ts` — it compiles to a broken IR and pinning that IR as a golden
would bless it.

It is exactly the ratified shape: `NestedBoard`, a keyed list of groups
(`@for (const group of groups; key group.id)`), each group holding a keyed list
of rows (`@for (const row of group.rows; key row.id)`), a click handler bound
**inside the inner loop that reads BOTH loop variables**
(`selection = \`${group.id}>${row.id}\``), a branch inside the inner row
(`@if (marked === row.id)`), and `data-oracle-cell-key={row.id}` on the inner
rows so `measureRowKeys`' regex over `data-oracle-row-key` is untouched. It uses
no composition, no `elementHandleBindings`, no behaviors, no handle constructs
and exports exactly one component, so it clears every guard T024 §1 quoted.

### 4.2 The throw, verbatim

`packages/frameworks/solid/src/emitter/index.ts:1062`, reached from `emit(ir)`:

```
TemplateKeyedRepeat repeat:1 has unconsumed key semantics
```

`repeat:1` is the inner repeat. The validator requires the repeat's collection
to carry a `via: 'direct'` graph read and the key's `via: 'repeat-item'` read to
agree with the key's member path:

```ts
const collectionRead = node.collection.reads.find((read) => read.via === 'direct');
const path = itemMemberPath(node.key.expression, node.item);
const keyRead = node.key.reads.find((read) => read.via === 'repeat-item');
if (!path || path.length !== 1 || !keyRead || keyRead.path.join('/') !== path.join('/') || !collectionRead)
    throw new Error(`TemplateKeyedRepeat ${node.id} has unconsumed key semantics`);
```

Both halves fail, and the second is the alarming one: the inner repeat's key has
**no reads at all**.

### 4.3 The IR, measured

Dumped from `buildEnrichedIr` over the fixture:

```
repeat:0  item=group
  collection.reads [{"graphNodeId":"state:groups","path":[],"via":"direct"}]
  key.reads        [{"graphNodeId":"state:groups","path":["id"],"via":"repeat-item"}]
repeat:1  item=row
  collection.reads [{"graphNodeId":"state:groups","path":["rows"],"via":"repeat-item"}]
  key.reads        []                     <-- EMPTY
```

And every site inside the nested row is empty the same way:

```
h8  li      attribute data-oracle-cell-key  []
h9  button  attribute data-select           []
h10 span    attribute data-cell-on          []
h11 span    attribute data-cell-off         []
h12 details attribute data-cell-open        []
h13 summary attribute data-open-cell        []
event:2 h9 click reads [prop:props/onTrace, state:groups/id/repeat-item]   <-- no `row` read at all
```

`enriched-ir.test.ts`'s own sufficiency test —
`expect(site.reads.length).toBeGreaterThan(0)` over every dynamic DOM site,
including `node.key` of every `keyed-repeat` — fails on this IR. That is
**measured**, not deduced from reading the test: running the test's own site
collection over this IR reports

```
sites=16  sites with reads.length === 0 => 7
   repeat:1 key
   host h8  data-oracle-cell-key
   host h9  data-select
   host h10 data-cell-on
   host h11 data-cell-off
   host h12 data-cell-open
   host h13 data-open-cell
```

— every dynamic site inside the nested row, and the inner repeat's key.
Registering S4 in `FIXTURES` would have gone red in the compiler suite seven
times before it ever reached an emitter.

### 4.4 The cause, isolated by measurement rather than inferred

`packages/compiler/src/build.ts:987-994` registers a repeat's item name only if
the semantic graph resolved its collection:

```ts
if (repeat.collectionGraphNodeId) {
    repeatItems.set(repeat.itemName, { graphNodeId: …, path: repeat.collectionPath });
}
```

`@markless/compiler` 0.1.1 (`vendor/markless-compiler-0.1.1.tgz`) does not set
that field for the inner repeat. Three probes, run through `buildSemanticGraph`
directly and read out of `graph.keyedRepeats`:

| authored inner collection | resolved? |
| --- | --- |
| `data.rows` — member of a **top-level state object**, not nested | **YES** — `collectionGraphNodeId: "state:data"`, `collectionPath: ["rows"]` |
| `rows` — top-level state, inside an outer `@for` (a cross-product grid) | **YES** — `collectionGraphNodeId: "state:rows"` |
| `group.rows` — member of the **enclosing repeat item**, outer over state | **NO** — field absent, `collectionPath: []` |
| `group.rows` — member of the enclosing repeat item, outer over a **prop** | **NO** — field absent, `collectionPath: []` |
| `rowsByGroup[group.id]` — computed member indexed by the outer item | **NO** — field absent, `collectionPath: []` |

So the gap is not "member expressions" and it is not "nesting". It is precisely
**a repeat item being the source of a nested repeat's collection** — which is
the containment relation "each group contains its own rows" *is*. There is no
authoring of a genuine per-group nested list that the shipped toolchain
resolves, and the cross-product grid that does resolve is a different scenario:
every group would render the same shared row list, so `data-oracle-cell-key`
would repeat across groups, `locate()`'s `indexOf` would measure only the first,
and "inner-row key identity under an outer reorder" would have no referent.

### 4.5 Why the five lanes that *did* emit are not five-sixths of a matrix

React, Qwik, Svelte, Vue and Angular all emitted output for the S4 IR, and the
Angular output is the first nested call site this repo has ever produced:

```
@for (group of groups; track group.id) {
  …
  @for (row of group.rows; track row.id) {
    <button [attr.data-select]="row.id" (click)="onH9Click(group, row, $event)">select</button>
```

`onH9Click(group, row, $event)` — outermost first, as ruling 3d specifies. It
looks like the answer to the question the batch was built to ask. It is not
evidence of anything: `collectEventScopes` builds `forVariables` by walking
`node.item` down the **template**, and never consults the reads. The five lanes
that emitted did so by printing the authored expressions; the IR underneath says
those rows read nothing. Shipping five lanes green would have been a matrix
resting on an IR that four `[]`s wide is simply wrong, which is the "correct
output for the wrong reason" failure this project has already found three times
this session.

`stop_if` is unambiguous — *S4 lands in fewer than SIX lanes → a partial matrix
is a broken oracle, not partial progress* — and so is the throw clause. Stopped.

### 4.6 What ruling 3d still is

**Unmeasured.** The headline the card predicted — that the Angular
`forVariables` order swap stays green and 3d is folklore — was NOT reached. The
swap needs a running nested call site, and there is none, because the corpus
still contains no nested loop. 3d moves from "a rule with zero instances" to
"a rule with zero instances **and a known reason there are none**". That is a
smaller claim than the batch was after, and it is the one the evidence supports.

---

## 5. What this leaves for the board

1. **The harness is landed, calibrated on both verdicts, and reusable as-is.**
   T026 (S5) and T027 (S6) can add mutants to `MUTANTS` without touching the
   runner. Neither of those scenarios needs a nested repeat.
2. **S4 is blocked on a capability, not on effort.** The repair spans
   `@markless/compiler` (vendored — the field is never set), then
   `packages/compiler/src/build.ts:988` (which fails closed on the missing
   field and would need a lowering for a repeat-item-sourced collection), then
   `packages/frameworks/solid/src/emitter/index.ts:1050-1062` (whose
   `keyByState` model assumes every repeat resolves to one state node). All
   three are outside T025's `allowed_files`.
3. **T024 §3's landing order is disturbed but not refuted.** S4 was placed first
   because it was "the cheapest scenario with the sharpest single mutant". The
   cheapness premise is falsified; the sharpness is not. The PM decides whether
   S4 is re-homed to the capability phase alongside IR-8, or whether a nested
   repeat is scoped as its own card ahead of S5.
4. **Phase F's stopping rule needs re-reading.** §6 requires eight scenarios in
   six lanes each. If a nested list cannot be expressed, the honest number for
   the shipped toolchain is not eight either — that is a PM call, not a
   Worker's, and nothing in this batch was reshaped to make a number come out.

## 6. Reproducing every claim in this note

```
# harness, both verdict classes, all six lanes
pnpm mutate:corpus --dry-run --scenario s1 --scenario s2 --scenario s3
pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3
pnpm mutate:corpus --calibrate-classifier

# the S4 throw -- write this to repro.mjs at the workspace root and run it.
# (It has to sit at the root: the .ts imports resolve through the workspace.)
```

```js
import { readFileSync } from 'node:fs';
import { buildEnrichedIr } from './packages/compiler/src/build.ts';
import { emit } from './packages/frameworks/solid/src/emitter/index.ts';
const file = 'packages/compiler/test/fixtures/s4-nested-list.tsrx';
const ir = await buildEnrichedIr({ filename: file, source: readFileSync(file, 'utf8') });
// prints: TemplateKeyedRepeat repeat:1 has unconsumed key semantics
try { emit(ir); } catch (error) { console.log(error.message); }
// and the symptom, in the IR itself: sites inside the nested row read nothing.
console.log(JSON.stringify(ir).includes('"reads":[]'));  // true
```

The vendored half is read the same way, from inside `packages/compiler` so the
`@markless/compiler` specifier resolves:

```js
import { buildSemanticGraph } from '@markless/compiler';
const graph = await buildSemanticGraph({ filename, source });
console.log(JSON.stringify(graph.keyedRepeats, null, 2));
// repeat:0 -> collectionGraphNodeId: "state:groups"
// repeat:1 -> the field is ABSENT, and collectionPath is []
```
