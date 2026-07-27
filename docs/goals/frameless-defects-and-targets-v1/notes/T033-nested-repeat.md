# T033 — a nested repeat sourced from the enclosing repeat item

Worker, 2026-07-27. Board: `docs/goals/frameless-defects-and-targets-v1/state.yaml`.
Tree at `6de994d`. Implements the repair T025 measured and refused to patch over
(`notes/T025-corpus-s4-nested.md` §4).

## 0. Headline

`@for (const row of group.rows; key row.id)` is now expressible, and the case
that still is not fails **loudly** instead of silently.

The whole defect was one `if`. `build.ts` registered a repeat's item name only
when the vendored graph had already resolved the collection; when it had not,
the guard was skipped, the item was never bound, and every read off it lowered
to `reads: []`. **The vendored `@markless/compiler` was not touched.** The
information needed was present locally the entire time: the enclosing item is
already registered, so the collection expression's own derived reads name the
location.

## 1. The witnessed failure, before either repair

Both tests were written first and watched failing.

**Compiler** — `packages/compiler/test/enriched-ir.test.ts`, new
`describe('nested repeats sourced from the enclosing repeat item')`:

```
× S4: no dynamic site inside the nested row lowers to reads: []
  AssertionError: expected [ 'repeat:1 key', …(6) ] to deeply equal []
```

The seven, in full: `repeat:1 key`, `host h8 data-oracle-cell-key`,
`host h9 data-select`, `host h10 data-cell-on`, `host h11 data-cell-off`,
`host h12 data-cell-open`, `host h13 data-open-cell` — the inner repeat's key
and every dynamic binding inside the nested row. Sixteen sites, seven empty.

```
× S4: the inner repeat resolves against the outer item, key included
  AssertionError: expected [] to deeply equal [ { …(3) } ]
× an unresolvable nested collection fails closed LOUDLY, never into reads: []
  AssertionError: promise resolved "{ …(6) }" instead of rejecting
```

The third is the important negative: before the repair the *unresolvable*
`rowsByGroup[group.id]` case did not throw either. It built an IR, quietly, with
zero reads. That silence is what survived five emitters.

**Solid** — `packages/frameworks/solid/test/emitter.test.ts`, new
`describe('nested keyed repeat')`:

```
× validates and emits a nested For whose collection is the outer row
  AssertionError: expected [Function] to not throw an error but
  'Error: TemplateKeyedRepeat repeat:1 has unconsumed key semantics' was thrown
```

Verbatim the sentence T025 recorded, reached from `validateEnrichedIr`.

The T025 measurements were **re-derived, not inherited**, before any edit: 16
sites / 7 zero-read, the same two repeat read-sets, the same Solid throw.

## 2. The repair — `packages/compiler/src/build.ts`

The guard becomes an unconditional registration through a new
`repeatCollectionSource(repeat, collection)`:

1. `repeat.collectionGraphNodeId` set → return it with `repeat.collectionPath`.
   **Byte-for-byte the old path**, which is why nothing in the corpus moved.
2. Otherwise the collection's own `ExpressionSite.reads` must name **exactly
   one** location, with no `*` segment. `group` is already registered as
   `{state:groups, []}`, so `group.rows` derives
   `{state:groups, ['rows'], via: 'repeat-item'}` and `row` registers as
   `{state:groups, ['rows']}`. `row.id` then lowers to
   `state:groups/rows/id/repeat-item`, which is the same
   collectionPath-plus-member-path convention the outer level already used.
3. Otherwise **throw**: `Keyed repeat repeat:1 collection cannot be resolved to
   a single graph location: Layer A left collectionGraphNodeId unset and …`.

Point 3 is the point. The old guard failed closed into silence; this one fails
closed into a sentence.

## 3. The repair — `packages/frameworks/solid/src/emitter/index.ts`

Solid was right and was not weakened. Two assumptions were lifted, both of the
form "a repeat resolves to one state node with an empty path":

- `repeatItems` carried `name → graphNodeId`. It now carries
  `name → {graphNodeId, path}` (`RepeatItemSource`), and
  `reconcileReadSemantics` prefixes that path onto the member suffix. Without
  this, `row.id` reconciles to `state:groups/id` and the emitter rejects the
  *correct* IR.
- The collection selector was `reads.find(via === 'direct')`. It is now
  "**exactly one** read, `direct` or `repeat-item`" — which admits the nested
  case and is **stricter** than before for a multi-read collection, which the
  old `find` would have silently picked a winner from.
- The key/collection agreement check gained
  `keyRead.graphNodeId === collectionRead.graphNodeId` and compares against
  `[...collectionRead.path, ...path]` rather than `path` alone. Also stricter.
- `keyByState` (graphNodeId-keyed) is consumed by the handler identity-mutation
  guard and the array-state coverage check, so it stays graphNodeId-keyed; an
  outer repeat's key is never overwritten by a collection nested inside it. The
  **conflict** check moved to a new `keyByCollection`, keyed by graphNodeId +
  path, because `state:groups` and `state:groups/rows` are different collections
  and may legitimately carry different key fields. That is the single-state-node
  assumption, and it is the only thing that was loosened.

The emitted S4 is idiomatic and needed no lowering work at all — `repeatNode`
already handled nesting; only validation stood in the way:

```jsx
<For each={groups}>{(group) => (
  <li data-oracle-group-key={group.id}>
    <ul data-rows={group.id}>
      <For each={group.rows}>{(row) => (
        <li data-oracle-cell-key={row.id}>
          <button data-select={row.id} onClick={(event) => {
            setSelection(`${group.id}>${row.id}`);
```

Both loop variables are live in the handler, and `reconcile(…, {key: 'id'})`
appears twice — the inner rows live inside the *same* store, so the outer
repeat's key is the one `reconcile` uses and it is not duplicated.

## 4. T025's probe table, re-measured under the repair

Every row run through `buildEnrichedIr` on this tree, not carried over.

| authored inner collection | before | after |
| --- | --- | --- |
| `data.rows` — member of a top-level state object | resolved | resolved, unchanged (`state:data/rows/id`) |
| independent top-level state (cross product) | resolved | resolved, unchanged (`state:rows/id`) |
| `group.rows`, outer over **state** | `reads: []`, silent | **resolved** `state:groups/rows/id` |
| `group.rows`, outer over a **prop** | `reads: []`, silent | **resolved** `prop:props/seed/rows/id` |
| `rowsByGroup[group.id]` — computed index | `reads: []`, silent | **throws, named** |

So the gap T025 bounded as "a repeat item being the source of a nested repeat's
collection" splits in two. The *containment* half — the relation "each group
holds its own rows" — is closed. The *computed-index* half is still
inexpressible, and that is now a stated refusal rather than an empty array. That
is a narrower closure than "nested repeats work", and it is the one the evidence
supports.

## 5. What did NOT change, measured

- `pnpm test` 876/50 (870/50 at dispatch, +6 new). All green.
- All six lanes regenerated; `git status --short` shows **no** generated file
  moved in any lane. The compiler goldens for S1/S2/S3 are byte-equal, so the
  six emitters were fed identical input — the invisibility is by construction,
  and was then confirmed by running all six `regenerate` scripts, not only
  Solid's.
- `pnpm e2e` — 6 demos × 3 scenarios, all observations equal.
- `pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3` — **18/18 RED**,
  every one restored. The oracle is not blunted.

## 6. S4 is still NOT registered, and why that is not a judgement call

Its IR is now clean, so the card's condition for registering it is met — but
registering it in `FIXTURES` requires writing
`packages/compiler/test/goldens/s4-nested-list.json`, and blessing it in the six
emitter lanes requires new files under each `generated/`. Every one of those
paths is outside this card's `allowed_files`, and the emitter goldens are
covered by a `stop_if`. Landing S4 as a corpus scenario is a separate card; this
one made it *possible*.

What this card does leave behind is coverage without a golden: the new
`describe` block in `enriched-ir.test.ts` builds the S4 fixture on every run and
asserts the sufficiency property (no zero-read site) plus the exact resolved
reads for the inner repeat and the two-variable handler, and the Solid suite
validates and emits it.

## 7. Reproducing

```
pnpm test
pnpm check && pnpm lint
pnpm --dir packages/frameworks/solid/ regenerate && git diff --exit-code -- packages/frameworks/solid/generated
pnpm e2e
pnpm mutate:corpus --scenario s1 --scenario s2 --scenario s3
```

To watch the failure again, revert `repeatCollectionSource` to the old
`if (repeat.collectionGraphNodeId) { … }` guard and run
`npx vitest run packages/compiler/test/enriched-ir.test.ts -t 'nested repeats'`.
