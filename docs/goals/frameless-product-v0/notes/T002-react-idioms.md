# T002 — React 19 idiom dossier (Scout receipt note)

Provenance: Claude research agent with web access (fallback recorded: dossier research
requires live docs verification; crew lacks web). All react.dev citations live-fetched
2026-07-19. Corpus: js-framework-benchmark react-hooks keyed implementation. This
dossier is the normative input to T005 (target-react): the emitter implements it, the
gate enforces it, every gate policy carries a dossierRef into this file.

## Construct rulings (construct | idiom | evidence | gate rule | poc/06 keep/change)

1. STATE CELLS -> useState at top of component; literal initials WITHOUT lazy wrapper;
   lazy arrow initializer only for non-literal/prop-reading initials (pure, StrictMode
   double-invoked). Updates: const-next + direct set (React's documented troubleshooting
   pattern); updater functions reserved for prev-dependent multi-set (none in v0).
   Evidence: react.dev/reference/react/useState. Gate: useState calls top-level before
   guard; initializer literal-or-arrow. poc/06: CHANGE (unwrap literal initials).
2. DERIVED -> derived-in-render CONFIRMED; useMemo NEVER emitted in v0. Threshold rule:
   useMemo only with (a) unbounded-collection iteration + compiler cost annotation, or
   (b) referential stability needed as hook dep. Evidence:
   react.dev/learn/you-might-not-need-an-effect; react.dev/reference/react/useMemo
   ("only as a performance optimization", ~1ms guidance, React Compiler note); corpus:
   benchmark uses zero useMemo. Gate: useMemo/useCallback/memo not in import allowlist.
   poc/06: KEEP.
3. ONCE-PER-INSTANCE SETUP -> render-phase ref-guard in the lint-sanctioned shape:
   const setupDone = useRef(null); if (setupDone.current === null) { ... }.
   Evidence: react.dev/reference/react/useRef caveat (lazy-init exception);
   eslint-plugin-react-hooks v6 refs rule allows exactly this guard. StrictMode stays
   excluded from the calibrated contract (recorded). ESCALATION TRIGGER: if hooks-lint
   v6 recommended flags the guard at T005 (purity rule), overturn to guarded-useEffect
   and reword the zero-effects claim to "zero author-written effects". poc/06: CHANGE
   (shape: boolean guard -> null guard).
4. NON-VISIBLE CELLS -> useRef CONFIRMED (counters never rendered). Handler interplay:
   const id = next.current; next.current = id + 1. Gate: useRef-bound identifiers never
   in JSX; .current only in guard/handlers. poc/06: KEEP hook, CHANGE rebind style.
5. HANDLERS -> const SSA replaces let-rebind prologues; ONE setter call per cell per
   handler (batching is last-wins; intermediate sets are dead work); payloads read the
   consts (post-write semantics preserved byte-identically at the oracle surface).
   preventDefault inline at authored position. Synthetic-event projection to
   defaultPrevented stays (no identity claim). Evidence: useState troubleshooting
   (const nextCount pattern); react.dev/learn/responding-to-events. Gate: const-only in
   JSX-attribute functions; at-most-one-call-per-setter-per-handler; preventDefault
   callee = handler event param. poc/06: CHANGE (S1/S2/S3 prologues; S3 double set).
6. KEYED LISTS -> .map with data-derived key on the mapped element; concat/filter/
   map-with-spread/copy-then-mutate idioms CONFIRMED (react.dev/learn/rendering-lists;
   react.dev/learn/updating-arrays-in-state; corpus conformant). Counter-as-key
   explicitly blessed by docs. Gate: keep index-key AST rule + add
   react/no-array-index-key; key required on map-returned elements. poc/06: KEEP.
7. CONDITIONALS -> ternary with explicit null arm for ALL emitted branches (the &&
   zero-leak footgun is structural since v0 IR conditions are untyped; enforceable via
   react/jsx-no-leaked-render). && becomes permissible when IR carries boolean typing
   (recorded trigger). Guard = early return AFTER all hooks. Evidence:
   react.dev/learn/conditional-rendering. poc/06: KEEP.
8. REFS -> ref-as-prop (React 19); gate REJECTS forwardRef (import or member) and
   string refs. Evidence: react.dev/blog/2024/12/05/react-19 (forwardRef deprecation
   path). v0 emits no refs; rule recorded for when it does. poc/06: KEEP + ADD gate.
9. CONTROLLED INPUTS -> value+onChange / checked+onChange; onInput OVERTURNED
   ("For historical reasons, in React it is idiomatic to use onChange" —
   react.dev/reference/react-dom/components/input); e.target on leaf controls.
   Gate: value|checked requires sibling onChange; onInput forbidden. poc/06: CHANGE
   (all text inputs; checkboxes already correct).
10. COMPONENT SHAPE -> exported function declaration, props destructured in signature,
    .jsx extension, automatic JSX runtime (required by 19); no propTypes/defaultProps
    (removed in 19; ES6 defaults only). Named export retained as harness contract
    (recorded split). Gate: exactly one export function PascalCase per file; single
    ObjectPattern param; jsx-runtime preset. poc/06: KEEP.
11. ORACLE ADAPTER ACT -> ASYNC act resolved (T001 SE decision point): React commits to
    deprecating sync act ("We will deprecate and remove the sync version in the
    future" — react.dev/reference/react/act). Migrate mount/dispatch/unmount to
    await act(async () => ...); widen dispatch to Promise<void>; re-run phase
    calibration + FULL mutant corpus under exact React 19 pins before any emitter
    verdict; IS_REACT_ACT_ENVIRONMENT = true in browser harness.

## Split decisions (threshold-picked, all recorded)
1 setup probe (fidelity + zero-useEffect claim win; lint-flag = overturn trigger);
2 declaration-vs-arrow (react.dev house style wins); 3 &&-vs-ternary (machine safety
wins); 4 target-vs-currentTarget (docs corpus wins); 5 named-vs-default export
(harness contract outranks style); 6 direct-set-vs-updater (docs troubleshooting
pattern + one-set gate rule win).

## Gate diffs vs poc/06 gate
ADD: react-import allowlist {useState, useRef}; named no-forwardRef policy; controlled-
input policy; const-only handlers; one-call-per-setter; ref-guard shape policy;
react/jsx-no-leaked-render; react/no-array-index-key.
CHANGE: ESLint 9 flat config; eslint-plugin-react-hooks ^6 recommended (adds
set-state-in-render, refs, purity — strictly stronger; hand-rolled checks stay as
defense in depth); settings.react.version -> 19.
KEEP: directive ban, undisclosed-import, index-key AST, hook-after-guard, render-phase
setter/effect, no-unused. REMOVE: nothing.

## Emit keep/change summary for T005
Keep: derived-in-render, useRef counter, keyed idioms, ternary-null, guard placement,
component shape, .jsx/automatic runtime, preventDefault placement, checkbox pattern.
Change: onInput->onChange; let-rebinds->const SSA + single final set; literal initials
unwrapped; setup guard null-shape; currentTarget->target on leaf controls; adapter
async act + full 19 recalibration.
