# T003 — Solid idiom dossier (Scout receipt note, for @frameless/target-solid)

Provenance: Claude research agent (fallback recorded: live docs verification needs web;
crew lacks it), 2026-07-19. Evidence: docs.solidjs.com (live via solid-docs source),
local Solid checkout at branch next tag v2.0.0-beta.9 (NEWER than our 2.0.0-exp.16
blocker pin — refresh blocker evidence at T006), js-framework-benchmark keyed/solid +
keyed/solid-store corpora, solid-js@1.8.22 runtime dist, poc/04 references + oracle
serializer, eslint-plugin-solid. Normative input to T006; answers the W-C2 critique
row-reactivity blocker. Full rulings preserved below.

## Construct rulings (condensed; every ruling cited in the receipt)

1. STATE: createSignal for scalars; createStore (top-level array form) for object/array
   cells with member reads/writes — S2 todos OVERTURNED to
   createStore(props.seed.map(t => ({...t}))). Member edits via produce draft mutation
   (v2: produce becomes default — wrapper just drops); structural results (filter/
   concat/reverse) via setTodos(reconcile(<authored expr>, { key: "id" })).
   Evidence: docs stores page (fine-grained mandate); solid-store benchmark corpus.
   Gate: cell-type policy (scalar->signal, object/array->store).
2. DERIVED: plain accessor arrows CONFIRMED; createMemo NEVER in v0 (docs
   derived-signals idiom; memos positioned for expensive/multi-subscriber; corpus has
   zero createMemo). USER-EXPECTATION OVERTURN recorded: "Solid derived = createMemo"
   is not what docs/corpus say for single-subscriber cheap derivations. Threshold
   mirrors T002 ruling 2. Gate: createMemo excluded from import allowlist.
3. ROW REACTIVITY IN <For>: store-backed rows; bindings read bare todo.title/todo.done
   (row proxies create lazy per-property signals — granular updates through reused
   rows). DELETES the todos()&& hack. Per-row-signals corpus idiom recorded but
   rejected (reshapes row data away from IR paths). Focus/identity: store member
   writes preserve === identity; mapArray reuses nodes. Gate: no whole-collection
   accessor call inside row-member bindings.
4. KEYED IDENTITY: <For> + IR key lowered via reconcile(next, {key:"id"}) — matched
   rows keep object identity, DOM, focus. <Index> never (wrong tool; removed in v2).
   Residual boundary documented honestly (For itself never sees the key). v2:
   <For keyed={t=>t.id}> lowers key directly; For children become accessors (the
   breaking bit). Gate: reconcile key === IR key member; existing For-child rules.
5. CONDITIONALS: <Show when fallback> for structural branches; SIBLINGS EMITTED ONCE
   (the S2 duplication fix; generic, no S2-shaped fusion). Calibration receipt: the
   accepted handwritten S2 reference already uses mid-children Show with siblings-once
   and passed the full oracle. Empty-anchor fear defused: oracle serializer keeps only
   element/text nodes; v0 arms always carry elements; emitter fail-closed on
   element-less arms; T001 IR-escalation stop_if stays armed. Ternary retreats to
   attribute/text expression positions. Gate: structural-ternary ban; Show two-arm
   policy.
6. HANDLERS: delegated onX camelCase; ordered setter calls AS AUTHORED (1.x sets are
   synchronous — deliberate divergence from T002's SSA collapse: statement order IS
   the idiom); NO batch() in v0 (v2 removes it; store setters self-batch; oracle
   observes post-handler). stopPropagation forbidden outside on: form (delegation
   caveat). v2 trigger recorded: microtask batching -> read-after-set recalibration.
   Gate: batch excluded; stopPropagation ban; preventDefault callee = event param.
7. CONTROLLED INPUTS: value+onInput for text (Solid-native semantics — deliberate
   inverse of React's onChange ruling, per-target divergence recorded);
   checked+onChange for checkbox; e.currentTarget (calibrated corpus + Solid typing —
   diverges from React's e.target ruling); attr:value dual binding KEPT in v0
   (1.8.22 runtime hardwires value into Properties — plain value never reflects the
   attribute; attr: is the documented forcing namespace; calibrated channel). v2
   overturn recorded: attr: removed -> pair collapses + oracle recalibration.
   Gate: value requires onInput + paired attr:value with identical expression;
   checkbox checked requires onChange; React onChange-on-text forbidden.
8. PROPS: props.x at each reactive read; NO destructuring (docs: breaks reactivity);
   splitProps/mergeProps not emitted in v0 (v2 renames them anyway). Once-captures
   (S1 prefix) and prop-reading initializers wrapped in untrack — v2-forward
   hardening (v2 warns on top-level reactive reads; untrack is the sanctioned intent
   marker; behavior-neutral on 1.8.22). Gate: no props destructuring; once-capture
   reads inside untrack.
9. SETUP + INVISIBLE CELLS: plain statements and plain let CONFIRMED (components run
   once — the whole React guard problem class vanishes). Gate: let cells never in JSX.
10. COMPONENT SHAPE: exported named PascalCase function declaration, single props
    identifier param, .jsx, babel-preset-solid transform (vite-plugin-solid 2.11.0 on
    the 1.8.22 fallback), class NOT className (+ solid/no-react-specific-props).
    React-ism audit of poc/07 output: clean (one cosmetic stray return).
    Gate: import allowlist {solid-js, solid-js/store} named {createSignal,
    createStore, produce, reconcile, untrack, For, Show}; className/htmlFor ban.
11. V2-FORWARD LEDGER: stable — signals, derived arrows, Show, For-each, class,
    delegated events, plain-let, props.x, untrack. v2 migration items (mechanical,
    recorded, none block v0): For accessor children; attr: removal + oracle
    recalibration; store import path + produce/reconcile forms; microtask-batching
    phase recalibration (parallel to React 19 mandate); adapter mount moves to
    @solidjs/web. Package stays NOT v2 runtime-validated; refresh blocker evidence
    against 2.0.0-beta.9.

## Splits (all threshold-picked with overturn triggers)
1 store-vs-signal for todos (store wins; trigger: T006 oracle failure -> proven
signal discipline + /2 IR requirement); 2 Show-vs-ternary (Show; serializer receipt);
3 attr:value (keep; v2 removal recorded); 4 no-batch; 5 untrack once-captures;
6 currentTarget (deliberate React divergence); 7 ordered-sets-vs-SSA (authored order;
v2 re-examination trigger).

## Gate diffs vs poc/07
ADD: eslint-plugin-solid recommended (verify value/attr:value not falsely flagged);
allowlists above; structural-ternary ban; Show policy; controlled-input policy;
collection-accessor-in-row ban; stopPropagation ban; props-destructure ban; untrack
policy; reconcile-key policy. CHANGE: ESLint 9 flat (align with target-react).
KEEP: directive ban, undisclosed-import, unused, render-phase rules, param rules,
index-accessor ban, .map-render ban. REMOVE: nothing.

## Emit summary for T006
Keep: shape, delegated handlers, onInput/currentTarget/checkbox, attr:value pair,
derived arrows, plain-let cells, setup order, preventDefault policy,
data-oracle-row-key, ordered sets. Change: todos->store (+produce/reconcile-keyed,
bare row reads); branch->Show with siblings-once; untrack wrappers; gate rebuild.
Escalations carried: reconcile failure -> split-1 fallback; branch IR insufficiency ->
/2 requirement; v2 = recorded migration debt.
