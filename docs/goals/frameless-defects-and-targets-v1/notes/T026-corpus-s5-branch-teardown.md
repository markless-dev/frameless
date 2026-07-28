# T026 — S5 conditional branch teardown, six lanes, and a Solid ruling that refused the obvious fixture

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree at `41aaed0`. Follows the pattern T034 established
(`notes/T034-s4-registration.md`); ruling is `notes/T024-corpus-breadth.md` §3, §5.

## 0. Headline

**S5 landed in all SIX lanes.** `pnpm e2e` reports
`6 demos x 5 scenarios, all observations equal` — 30 byte-identical observation
records where there were 24. **No emitter threw on the S5 IR**, so T024's
capability-free ruling holds for this scenario. **No existing golden moved** and
no existing observation string changed.

**The S5 IR carries ZERO zero-read sites, 0 of 14, re-derived rather than
inherited** (§1).

**All six S5 mutants go RED, every one at the lane's own in-box assertion**, with
the same sentence in every lane (§4). They were established by a HAND RUN of the
harness's own steps, because the harness itself is blocked — see §5, which is the
one thing on this card that is not green.

**One design finding, and it changed the fixture.** The Solid dossier gate's
`show-two-arm` policy (T003 ruling 5) rejected the first S5 emission: both arms
of the `<Show>` carried a byte-identical element subtree, and the gate's remedy
is "hoist shared content outside the branch" — which is exactly what this
scenario must not do. §3.

**Two files outside `allowed_files` are needed for `pnpm test` to be green**, and
neither was touched. They are size BUDGETS, not inventories, and this is not a
defect in T035/T036's derivation — the derivation works and picked S5 up with no
edit at all. §6 has the two measured rows.

---

## 1. The zero-read-site count, RE-DERIVED

The card's stop_if is "the S5 IR carries ANY zero-read site" and the discipline
line is MEASURE, NEVER INHERIT. T033's and T034's readers were therefore **not**
reused. The walk written for this card enumerates **no node kinds at all**: it
visits every object in the IR generically, records the KEY PATH at which each
`reads` array sits, and classifies a site as a DOM/dynamic one from that path.
A site kind nobody thought to enumerate cannot be missed by construction.

```
DOM/dynamic sites = 14
ZERO-READ DOM SITES = 0 []
  dynamic-text  text:0          => computed:size//direct
  branch        branch-site:0   => state:phase//direct
  dynamic-text  text:2  arm0    => state:ticks//direct
  dynamic-text  text:3  arm0    => state:seen//direct
  collection            arm0    => state:entries//direct
  key                   arm0    => state:entries/id/repeat-item
  attribute  li  data-oracle-branch-key => state:entries/id/repeat-item
  attribute  button data-pick           => state:entries/id/repeat-item
  dynamic-text  text:6  arm1    => state:ticks//direct
  dynamic-text  text:7  arm1    => state:seen//direct
  events[0] toggle => prop:props/onTrace/alias | state:phase//direct
  events[1] tick   => prop:props/onTrace/alias | state:ticks//direct
  events[2] pick   => prop:props/onTrace/alias | state:entries/id/repeat-item
  events[3] drop   => prop:props/onTrace/alias | state:entries//direct
```

An exhaustive scan of *every* `reads` array anywhere in the IR reports
`total=26 empty=7`, and the seven are named here so the number is not mistaken
for a residue of T025's defect:

```
ir.components[0].locals[0]      // let phase = state('live')
ir.components[0].locals[2]      // let ticks = state(0)
ir.components[0].locals[3]      // let seen  = state('none')
ir.records.bindings[1]  prop:props     — the root prop
ir.records.bindings[3]  state:phase
ir.records.bindings[4]  state:seen
ir.records.bindings[5]  state:ticks
```

Three state declarations initialised from literals, each appearing once as a
local and once as a binding, plus the props root. `locals[1]`
(`entries = state(seed.slice())`) and `locals[4]` (`size`) both read. None of
the seven is a dynamic DOM site. Exactly T034's class, one state wider.

The capability-guard inputs were measured on the same pass, because a throw is
this card's hardest stop condition and predicting it from the emitters would be
the wrong instrument:

```
components=1  imports=0  module.exports=1
elementHandleBindings=0  handleForwards=0  behaviors=0  handleCalls=0
```

Every one is inside the guard the four blocked emitters share
(`svelte/src/emitter/index.ts:710-724` and its three character-for-character
twins). S5 is capability-free by measurement, and none of the six threw.

Three registered tests now assert this on every `pnpm test`: the sufficiency
count, that the branch is guarded by STATE with both arms populated, and that a
handler and a keyed list live inside the arm that is torn down.

## 2. What landed

### 2.1 The fixture, and why each piece is load-bearing

`packages/compiler/test/fixtures/s5-branch-teardown.tsrx`. Four states
(`phase`, `entries`, `ticks`, `seen`), one computed (`size`), one branch, one
keyed list **inside** the branch, four handlers — two inside the live arm, one
inside the idle arm, one outside.

The axis T024 ratified is subtree destruction, and the corpus had no instance:
`s1`'s branch is selected by a **static** prop (`visible={true}`, the same in
every lane's props) and cannot flip; `s2`'s `@else` arm is **empty**. So S5's
branch is guarded by `phase === 'live'`, a **state** compared to a literal, and
a button outside the branch flips it.

`ticks` and `seen` exist for one reason: they are component state whose **only**
DOM projection lives inside a branch arm. That is what makes "the state survived
the teardown" a measurable claim rather than a description.

`entries` and `size` exist for the sharper reason. `size` is projected
**outside** the branch and `entries` **inside** it, so the idle arm's `drop`
handler mutates a collection whose renderer does not exist at the moment it is
mutated. The rebuilt arm then has to reflect the post-drop state.

### 2.2 The golden

`packages/compiler/test/goldens/s5-branch-teardown.json` created with
`UPDATE_GOLDENS=1 pnpm test`, then proven byte-stable by re-running **without**
it. `git status --short` shows the S1–S4 goldens **unmoved**: the only new file
under `goldens/` is the S5 one.

### 2.3 Six emitters, no throw, byte-stable

All six `regenerate` scripts learned the fixture; all six produced output; none
threw. Byte stability was proven by sha256 across a second regeneration rather
than by `git diff --exit-code`, which is **vacuous for a new file** — the six
`generated/S5.*` are untracked on this tree, so a tracked-content diff would have
reported clean no matter what they contained:

```
2052a182…  packages/frameworks/react/generated/S5.jsx
b9d6e717…  packages/frameworks/solid/generated/S5.jsx
e7fdac6c…  packages/frameworks/qwik/generated/S5.jsx
42217794…  packages/frameworks/svelte/generated/S5.svelte
4bcbfba7…  packages/frameworks/vue/generated/S5.vue
bdefd1c8…  packages/frameworks/angular/generated/S5.ts
```

Identical before and after a second `regenerate` in all six. The
`git diff --exit-code` over the six `generated/` directories is also clean, which
is the S1–S4 half of the same claim.

### 2.4 Six demo routes

`/s5` in every lane, each following that scaffold's own existing convention: a
`switch` arm in the react `App`, a `<Match>` in solid's `<Switch>`, a
`src/routes/s5/index.tsx` in qwik, a `src/routes/s5/+page.svelte` in svelte, a
`v-else` arm in the vue `App` (S4's `v-else` became `v-else-if` so the chain
still terminates in exactly one default), and a fifth entry in Angular's
`app.routes.ts` carrying its props as route `data`. The seed is byte-identical in
all six:

```js
[{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }]
```

Three rows, and the count is deliberate: the scenario drops the first one while
the subtree that renders them does not exist, and then requires the rebuilt arm
to hold exactly the remaining **two**. Two is neither the original three nor
zero, so "rebuilt from a stale snapshot", "rebuilt from nothing" and "rebuilt
correctly" are three distinguishable readings rather than two.

### 2.5 The contract

`three-way-contract.ts` gains `'s5'`, `assertS5`, `measureBranch`,
`requireBranch`, `measureBranchKeys` and a **measured** `resumeSymbols` entry.

`measureRowKeys` and `measureCellKeys` are **byte-unchanged**. S5 keys its rows
with a THIRD attribute, `data-oracle-branch-key`, for exactly the reason S4
introduced the second one: S2's read matches `data-oracle-row-key` globally and
S4's matches `data-oracle-cell-key`, so a scenario reusing either would silently
join that scenario's observation string.

`measureBranchKeys` is deliberately **unscoped**, unlike `measureCellKeys`. S4's
claim is containment, which needs a per-group read; S5's claim is **presence** —
after the flip the list is gone from the document entirely and the correct
reading is `[]`. A scoped reader would have to locate a container that is not
there and would throw where a measurement of zero rows is the observation.

### 2.6 The seven observations, and what each transition isolates

| step | what must move | what must not |
| --- | --- | --- |
| `tick` (inside the live arm) | `ticks` | the arm, the rows |
| `pick` (inside the list inside the arm) | `seen` | the arm, the rows |
| `toggle` | the mounted arm; rows to `[]` | `ticks`, `seen` |
| `drop` (inside the IDLE arm) | `size` | the mounted arm, `ticks`, `seen` |
| `toggle` back | the mounted arm; rows to the POST-drop list | `ticks`, `seen` |
| `tick` again (rebuilt arm) | `ticks` | the arm, the rows |

`drop` and the second `toggle` are a pair on purpose, and they are what makes
this a teardown test rather than a visibility test. Everything above them passes
for an emitter that rebuilds the arm from a cached subtree, from the original
prop, or from a snapshot taken at teardown; only they fail it.

The 30 strings, identical in all six lanes:

```
server-rendered arm live holds rows [k1,k2,k3] with size = 3, ticks = 0 and seen = none
after one tick inside the live arm ticks = 1 and seen = none
after picking k2 seen = k2 and the rows are still [k1,k2,k3]
after the flip arm idle holds rows [] with ticks = 1 and seen = k2
after dropping while the live arm is torn down size = 2 and arm idle still holds rows []
after the flip back arm live holds rows [k2,k3] with size = 2, ticks = 1 and seen = k2
after one more tick in the rebuilt arm ticks = 2 and rows are [k2,k3]
1 document request served this page
no console errors and no failed requests
```

### 2.7 Qwik resumed a handler out of a subtree the server never sent

`resumeSymbols.s5` was **measured** off this lane's own `handlerSegments`
evidence. Four segments, in click order, verbatim:

```
BranchBoard.jsx_BranchBoard_component_section_div_button_q_e_click_pnwm0Iro4cY.js
BranchBoard.jsx_BranchBoard_component_section_div_ul_li_button_q_e_click_DmbcW4Vyi08.js
BranchBoard.jsx_BranchBoard_component_section_button_q_e_click_FhhLDdsOJNA.js
BranchBoard.jsx_BranchBoard_component_section_div_button_q_e_click_1_X4FkrWt0H4w.js
```

The first two are handlers resumed from **inside a branch arm**. The fourth is
the idle arm's `drop`, pulled out of a subtree **the server never rendered** —
the idle arm did not exist until the client built it. Every other segment in the
corpus is resumed out of markup the server sent; that one is the first that is
not.

**Six clicks, four segments.** The second `tick`, on the REBUILT arm, fetched
nothing: the rebuilt subtree's handler resolved from a QRL already imported for
the subtree that was destroyed. That is the answer to "did the rebuild rebind" —
yes, and without a second network round trip.

## 3. THE FINDING that changed the fixture — Solid's `show-two-arm` ruling

The first S5 emission put the **same** two elements in both arms:
`<output data-ticks="true">{ticks}</output>` and
`<p data-seen="true">{seen}</p>`, so that one reader would work either side of
the flip. The Solid dossier gate rejected it, verbatim:

```
{
  "file": "generated/S5.jsx",
  "policy": "show-two-arm",
  "dossierRef": "T003 ruling 5",
  "message": "Show contains duplicated-arm element content; hoist shared content outside the branch",
  "line": 24
}
```

`packages/frameworks/solid/src/gate/custom-policies.ts:624-634` normalises every
`JSXElement` subtree in the `<Show>` children and in its `fallback`, and rejects
any structure appearing in both.

**This is not a defect and it was not patched over.** It is a standing ruling
that had never met a scenario with two populated arms — S4's arms differ
(`data-cell-on` vs `data-cell-off`), s2's `@else` is empty, s1's branch never
flips — so S5 is its first real instance, and it was **right**.

But its prescribed remedy, *hoist shared content outside the branch*, is the one
repair this scenario cannot make: the whole claim is that the projections live
**inside** the subtree that gets destroyed. Hoisting them would have produced a
green lane measuring nothing.

So the arms were made to differ instead — `data-live-ticks` / `data-idle-ticks`,
`data-live-seen` / `data-idle-seen` — and the contract's reader derives the
marker from whichever arm is mounted. The fix is strictly better than the
original: the observation now names which arm projected the value, and a lane
that mounted both arms reads `arm live,idle` and fails on the sentence that says
so rather than inside a reader that could not find its element.

Recorded because it is a constraint the next four scenarios inherit: **in the
Solid lane, the two arms of a branch may not share an element subtree.** S6–S8
should be authored knowing that.

## 4. The mutation budget — six mutants, six red sites

One mutant per lane, one axis, spelled in each lane's own repeat idiom:

**The inner list stops being sourced from the `entries` STATE and becomes a fixed
reference to the `seed` PROP** — the collection as it stood when the arm was
first built, and therefore also as it stood when the arm was torn down.

| lane | mutant | red site | evidence |
| --- | --- | --- | --- |
| react | `{entries.map((entry) => (` → `{seed.map((entry) => (` | in-box assertion | `expected '[data-branch-rows="true"] > li:first-child' attribute 'data-oracle-branch-key' to be "k2", but it was "k1"` |
| solid | `<For each={entries}>` → `<For each={props.seed}>` | in-box assertion | same sentence |
| qwik | `{entries.map((entry) => (` → `{props.seed.map((entry) => (` | in-box assertion | same sentence |
| svelte | `{#each entries as entry (entry.id)}` → `{#each seed as entry (entry.id)}` | in-box assertion | same sentence |
| vue | `v-for="entry in entries"` → `v-for="entry in seed"` | in-box assertion | same sentence |
| angular | `@for (entry of entries; track entry.id)` → `@for (entry of seed; track entry.id)` | in-box assertion | same sentence |

Six different constructs, one per renderer, not inherited between lanes. Each
anchors **exactly once** in its file and each changes the bytes, checked
independently of the harness.

**Why this mutant and not the blunter one.** Freezing the branch condition
(`@if (true)`, `v-if="true"`, `<Show when={true}>`) would also go red, on the
very first flip, and would prove only that the guard is consulted. This one is
**silent for five of the seven observations**: `entries` starts as `seed.slice()`,
so the served page, the tick, the pick, the teardown and the drop all read
exactly as they do on a correct lane. It goes red only when the arm comes
**back** — which is the one thing a scenario about teardown exists to measure. A
survivor here would have meant the rebuild step is decorative.

## 5. THE BLOCKER — the harness cannot run against a dirty surface

`pnpm mutate:corpus` refuses to start against a dirty mutation surface, and
`--dry-run` does **not** bypass it: `assertCleanSurface()` runs *before* the
dry-run branch. Registering S5 necessarily adds twelve files to that surface, so
the refusal is unavoidable and it is **correct** — every verdict the harness
issues is "the box behaved differently once ONE known byte range changed", which
is false if something else in the surface had already changed, and its
`restore()` would `git checkout` over uncommitted work.

Verbatim:

```
Error: The mutation surface is dirty before the first mutation, so no verdict
this harness issues would be attributable to its own mutant, and restoring would
discard uncommitted work. Commit or stash first:
?? demos/angular-official/src/emitted/BranchBoard.ts
?? demos/qwik/src/emitted/BranchBoard.jsx
?? demos/react-official/src/emitted/BranchBoard.jsx
?? demos/solid-official/src/emitted/BranchBoard.jsx
?? demos/svelte-official/src/lib/emitted/BranchBoard.svelte
?? demos/vue-official/src/emitted/BranchBoard.vue
?? packages/frameworks/angular/generated/S5.ts
?? packages/frameworks/qwik/generated/S5.jsx
?? packages/frameworks/react/generated/S5.jsx
?? packages/frameworks/solid/generated/S5.jsx
?? packages/frameworks/svelte/generated/S5.svelte
?? packages/frameworks/vue/generated/S5.vue
```

**No temporary commit was created and no history was rewritten.** T034 did that
and unwinding it was avoidable churn; this card was told not to repeat it and did
not.

So the two harness commands are reported **blocked**, for the PM to run after
committing:

```
pnpm mutate:corpus --scenario s5
pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3 --scenario s4
```

### 5.1 What was done instead, and what it is worth

The six red sites in §4 were established by a **hand run of exactly the steps the
harness performs**, minus every git operation: read the pristine bytes, assert the
anchor occurs once, assert the mutant changes the bytes, run the lane's own
`copy-emitted` (`build:e2e` for angular), run its witness box, read the verdict
out of the receipt rather than out of stdout, then restore **from the saved bytes**
and verify with sha256.

All six restored byte-identical, and each demo's `src/emitted/` copy was
re-synced and verified to match its `generated/` source by sha256.

This is **not** a harness verdict and is not offered as one. It cannot classify a
`cross-lane observation diff` red, and it does not exercise the harness's own
`replaceOnce`/`mutate`/`restore` code paths. What it does establish is what the
card asks to be recorded per lane: the mutant bites the emitted text, and the
lane goes red on it, with the raised sentence quoted. The harness run remains
required.

### 5.2 The 24/24 regression check is blocked for the same reason

It is **not** claimed here. What can be stated is narrower and was measured: the
six `generated/S1..S4.*` are byte-unchanged (`git diff --exit-code` clean over
all six `generated/` directories), the S1–S4 goldens are unmoved, and the s1–s4
observation strings in this tree's `pnpm e2e` are byte-identical to the ones
T034 recorded. That is evidence the existing budget was not disturbed; it is not
the measurement.

## 6. Two files outside `allowed_files`, and why this is NOT a derivation defect

`pnpm test` is `925 passed / 4 failed`. All four failures are in two files, both
outside this card's `allowed_files`, and neither was touched:

```
packages/frameworks/react/test/size.test.ts
  every scenario in the derived corpus has a recorded emitted budget
  the emitted corpus measures exactly its recorded budget
packages/frameworks/solid/test/size.test.ts
  (the same two)
```

**The derivation is not at fault, and this should not be recorded as one.** T035
and T036 derived the corpus INVENTORY from `goldens/s<n>-*.json`, and it worked
perfectly: every lane's gate, compile, type-check and smoke test picked S5 up
with **zero** hand edits, which is exactly what those cards were for.

What these two tests hold is a **budget** — a per-scenario recorded measurement of
the emitted output's size — and a measurement cannot be derived from the thing it
grades. The test is deliberately exact in both directions, and its own comment
names this case in advance:

> This file recorded budgets for S1/S2/S3 and said nothing at all about S4, so a
> new scenario arrived with NO size budget and nothing went red — an EXEMPTION
> granted by silence. … **S5 will not be measurable-by-omission either.**

It is working as designed. The rows it wants, MEASURED off this tree's emitted
output and ready to paste:

```ts
// packages/frameworks/react/test/size.test.ts, EMITTED_BUDGETS
S5: { physicalLoc: 73, structuralNodes: 343 },

// packages/frameworks/solid/test/size.test.ts, EMITTED_BUDGETS
S5: { physicalLoc: 72, structuralNodes: 357 },
```

Both are smaller than S4 on `structuralNodes` and comparable on `physicalLoc`,
which is what a branch with two populated arms and one flat keyed list costs
against a repeat nested inside a repeat.

## 7. PARALLEL SAFETY — another agent was writing this repo during this card

The card was dispatched with "Tree is clean … Nothing else is running", and
`git status --short` was indeed empty at the first command of this session. It is
not any more, and not because of this card:

```
 M docs/goals/frameless-vue-v1/state.yaml          (mtime 19:00)
?? docs/goals/frameless-vue-v1/notes/T999-vue-audit.md   (mtime 18:59)
```

Both were written **after** this session started and neither is in this card's
`allowed_files`. They are a different goal's board and note, disjoint from
everything touched here and from `MUTATION_SURFACE`, so no verdict above is
attributable to them — but "nothing else is running" was false, and the PM
should know before it dispatches the harness commands, because
`pnpm mutate:corpus` runs `git checkout --` over its surface and a future
concurrent worker inside `packages/frameworks/**` would lose work to it.

## 8. What was NOT done, and why each refusal is the card's

- `measureRowKeys` and `measureCellKeys` untouched, byte for byte.
- No `expectedNavigations` entry relaxed; the table is per lane and unchanged.
- No activation-neutrality assertion weakened. `assertServedActivation` is
  unchanged and S5 goes through it in all six lanes like every other scenario.
- No existing golden regenerated, and no existing observation string moved.
- The compiler and the six emitters were not touched at all. This card adds a
  fixture and registers it; it repairs nothing.
- No temporary commit, no `git reset`, no history rewrite.
- The Solid `show-two-arm` violation was fixed **in the fixture**, never by
  relaxing the gate.

## 9. Reproducing every claim in this note

```
UPDATE_GOLDENS=1 pnpm test && pnpm test          # the golden, created then proven stable
pnpm --dir packages/frameworks/react/ regenerate # and solid, qwik, svelte, vue, angular
pnpm check && pnpm lint && pnpm test:browser
pnpm e2e                                          # 6 demos x 5 scenarios, all observations equal

# the harness needs a COMMITTED mutation surface — see §5
pnpm mutate:corpus --scenario s5
pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3 --scenario s4
git diff --exit-code -- packages/frameworks/*/generated
```

To watch a red site directly without the harness, edit
`packages/frameworks/svelte/generated/S5.svelte` to read
`{#each seed as entry (entry.id)}` and run
`pnpm --dir demos/svelte-official copy-emitted && pnpm --dir demos/svelte-official exec witness run`.
The zero-read measurement in §1 is reproduced by walking `buildEnrichedIr`'s
output over `packages/compiler/test/fixtures/s5-branch-teardown.tsrx`; the three
registered S5 tests assert the same properties on every run.
