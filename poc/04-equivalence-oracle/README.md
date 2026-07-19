# Arcade equivalence oracle calibration

This package validates the oracle that later Arcade emitters will be judged by. It does **not** claim C9: no generated output is present. The package is deliberately oracle-first and contains handwritten conventional React and Solid references plus a mutation corpus.

## Oracle contract (`arcade-equivalence-oracle/1`)

An adapter mounts a component into a supplied host with props/callbacks, dispatches typed actions, waits for its own scheduler with bounded quiescence (500 ms timeout), and unmounts it. No sleeps are used. Every run observes mount, immediately before and after every dispatch, after one microtask, and after quiescence.

The DOM trace preserves namespaces, ordered semantic children, text, sorted attributes, and live `value`, `checked`, `selected`, and `disabled` properties. It also records the document focus target and text selection. Normalization removes only the explicit framework-owned allowlist `data-reactroot` and `data-solid-render-id`; `data-*`, `class`, `style`, and unknown attributes are never broadly removed. Node IDs come from a per-run monotonic `WeakMap`; logical rows marked by `data-oracle-row-key` are checked for remounts, and focus loss is reported when the focused row survives. Callback records retain order, normalized payload fields, action/observation phase, `defaultPrevented`, and per-handler invocation number. Comparison is exact and returns channel/phase/path divergences without fuzzy matching.

jsdom is sufficient because this fixture family needs standards DOM event propagation, live form state, focus/selection, and node object identity, not layout, paint, pointer geometry, or browser navigation. A real browser would be required when those become part of the contract.

## Scenarios

| ID | Coverage | Script |
|---|---|---|
| S1 render-once/locals | destructured props, derived local, closure, visible/guard-return prop matrix, state, setup-once probe | visible mount + increment; hidden mount |
| S2 keyed todo | add/edit/toggle/reorder/remove/empty, always-present list plus sibling empty paragraph, computed count, deep aliased mutation, identity/focus | input, add, focus/edit, toggle, reorder, remove surviving-focus peer, clear |
| S3 event/form | text/checkbox live state, callback order/payload, bubbling, cancellation, multiple writes | text input, checkbox input, submit |

## Adapters and references

React uses `createRoot`, `flushSync`, and React `act`; Solid uses `render` and synchronous reactive propagation followed by bounded microtask quiescence. References under `src/references/` are handwritten hooks/signal implementations for oracle calibration; the emitter's mutation-free size baselines are separate files in `../06-emit-react/test/baselines/`. Scenario definitions under `src/scenarios/` contain only initial props, actions, expected callback names, and purpose.

React S1 uses the same ref-guarded first-render setup strategy as the emitter, keeping
the observable setup call out of the `useState` initializer. StrictMode and
speculative/double-render replay are outside this calibrated contract: the adapter
uses `createRoot` without `<StrictMode>`. The ref guard is therefore asserted once per
ordinary adapter mount, not characterized under development replay.

S2 keeps its `<ul>` in the empty shape and conditionally adds a sibling paragraph
because that is the zero-diagnostic Markless constraint documented in
`../05-enriched-ir/README.md`; the oracle does not normalize or discard the list.

| Mutant | Required detecting channel |
|---|---|
| wrong text | DOM |
| wrong live input property | DOM |
| omitted callback | callback |
| reordered callback | callback |
| index key / row remount | identity |
| missing `preventDefault` | callback |
| duplicate handler call | callback |
| microtask-delayed state | DOM phase/timing |

## Verify

```sh
cd poc/04-equivalence-oracle
pnpm install
pnpm test
```

Pinned versions: React/React DOM 18.3.1, `solid-js` 1.8.22, `solid-js` v2 alias 2.0.0-experimental.16, Vite 5.4.11, vite-plugin-solid 2.11.0, Vitest 2.1.9, and jsdom 25.0.1. Authored with Node 24.15.0 and pnpm 10.33.2.

## Findings

The React and Solid S2 references were reconciled to the Markless-compatible
always-present `<ul>` shape. All three clean React/Solid scenario pairs remain
exactly equivalent, and all eight calibrated mutants remain rejected in their
required channels; no oracle normalization changed.

Solid v2 was investigated and is pinned as `solid2@npm:solid-js@2.0.0-experimental.16`. Its manifest has no `./web` export, so the browser `render` mounting API used by the current Babel/Vite Solid JSX toolchain cannot resolve. The published `vite-plugin-solid@2.11.0` is the available v1-oriented plugin line and has no matching Solid-v2 experimental mounting integration in this environment. `test/contract.test.ts` records the exact package/export evidence. Per the framework-version addendum, runtime cross-framework calibration therefore uses the additionally provided `solid-js@1.8.22` references and labels its adapter `solid-1.8.22-fallback`; Solid v2 is not silently skipped. This blocker feeds W-C2 planning.

A fresh `pnpm install` in the authoring sandbox reached `registry.npmjs.org` but failed DNS resolution with `ENOTFOUND` for the pinned tarballs. The lockfile was resolved offline from the repository's existing exact-version dependency metadata. For implementation validation only, the tests were run against the same pinned dependency tree already installed by another repo-local POC: all 15 tests passed. A clean-environment run of the verify commands above remains required before this package is treated as fully reproduced.

## What this does not prove

This proves that the fixture- and phase-scoped CSR oracle accepts the three clean handwritten pairs and rejects the enumerated defects. It does not prove C9 or any emitter, Markless/Arcade generated output, general framework equivalence, Solid v2 runtime equivalence, framework-version ranges, async semantics, cleanup/attach, slots/children/context, styling, multi-module builds, performance/bundle size, accessibility, SSR/hydration/resume, HMR, type-preserving emission, or generated-code debugging.
