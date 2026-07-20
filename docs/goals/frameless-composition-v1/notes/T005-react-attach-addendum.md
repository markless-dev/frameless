# T005 React attach/behavior lowering addendum (crew scout, 2026-07-20)

## T002 addendum — React 19 attach/behavior lowering

### Ruling

Choose candidate 1: emit one host-level React 19 callback ref, memoized with `useCallback` over the deduplicated union of that host’s tracked behavior inputs.

The callback must:

1. expose the live node to any `ElementHandleBinding`;
2. install behaviors in ascending authored `order`;
3. retain every returned cleanup;
4. return one cleanup function that invokes retained cleanups in descending authored order; and
5. clear the element handle only after behavior cleanup completes.

When a tracked input changes, `useCallback` supplies a different ref function. React cleans up the previous ref before attaching the new one, producing cleanup-then-reinstall. React documents callback-ref setup when the node is added, returned cleanup when it is removed, and cleanup-before-setup when the ref callback changes. [React DOM callback refs](https://react.dev/reference/react-dom/components/common#ref-callback)

```jsx
const attachSearch = useCallback(
  (node) => {
    inputRef.current = node;
    const cleanupA = behaviorA(node, inputA);
    const cleanupB = behaviorB(node, inputB);

    return () => {
      if (typeof cleanupB === "function") cleanupB();
      if (typeof cleanupA === "function") cleanupA();
      inputRef.current = null;
    };
  },
  [inputA, inputB],
);

return <input ref={attachSearch} />;
```

For multiple behaviors on one host, dependency invalidation is host-group atomic: a change to any tracked input tears down the complete group in reverse order and reinstalls it in authored order. This preserves the explicitly required group ordering, although it can replay an unchanged sibling behavior; that limitation is an overturn trigger below.

### Evidence

The Markless contract says behaviors receive the real element, may return cleanup, rerun after input changes, install in array order, and clean up in reverse order. See [T003 §3](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T003-solid-composition-idioms.md:91), the [vendored behavior specification](/Users/jacksm5pro/dev/open-source/markless/specs/framework/04-events-symbols-behaviors.md:43), and [T001’s executed attach probe](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:97).

React 19’s callback-ref contract directly matches host attachment. React invokes the returned cleanup on detach or before installing a different callback. An inline callback would consequently replay on every render; `useCallback` retains its identity while its dependencies compare equal by `Object.is`. [Callback-ref lifecycle](https://react.dev/reference/react-dom/components/common#ref-callback), [`useCallback`](https://react.dev/reference/react/useCallback)

Effects provide weaker fidelity:

- `useEffect` guarantees old cleanup before new setup for one Effect, but generally runs after paint for non-interaction commits. [React `useEffect`](https://react.dev/reference/react/useEffect)
- `useLayoutEffect` runs after the DOM commit and before paint, with cleanup before DOM removal, but it is still later than callback-ref attachment and blocks painting. [React `useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect)
- React’s documentation does not establish reverse cleanup ordering across separate Effects. Therefore emitted behavior order must not depend on separate hook cleanup traversal.

### Executed probe receipt

Executed against `react@19.2.3` and `react-dom@19.2.3` using the real React DOM client reconciler, async `act`, and an isolated minimal DOM host.

Observed callback-ref group:

- mount: `install:A`, `install:B`;
- dependency change: `cleanup:B(one)`, `cleanup:A(one)`, `install:A(two)`, `install:B(two)`;
- unmount: `cleanup:B(two)`, `cleanup:A(two)`;
- every callback-ref installation and cleanup observed `node.parentNode === container`.

Control observations:

- Separate `useEffect` behaviors installed A→B but cleaned A→B. Their unmount cleanups observed the node already detached.
- Separate `useLayoutEffect` behaviors also installed A→B and cleaned A→B in this runtime, although their cleanups observed a live node.
- Under root `StrictMode`, the grouped callback ref produced the expected development sequence: install A→B, cleanup B→A, install A→B. Update and final unmount retained reverse cleanup.

React documents this extra development-only setup/cleanup cycle for both callback refs and Effects. It is a stress test requiring setup and cleanup to mirror one another. [React `StrictMode`](https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-ref-callbacks-in-development)

### Candidate assessment

- Grouped callback ref: best node-liveness and attachment timing; explicit forward/reverse ordering; concise generated output. Dependency changes naturally map to ref replacement.
- Separate `useEffect`s: idiomatic for external systems, but passive timing and unmounted-node cleanup are weaker than Markless’s host-owned contract; reverse group cleanup is not guaranteed.
- Separate `useLayoutEffect`s: node remains live and setup precedes paint, but separate cleanups did not reverse in the probe. A generated grouping controller would be more complex than the ref solution.
- Hybrid ref/effect: duplicates lifecycle authority and introduces races or double cleanup unless backed by a substantial generated state machine. No demonstrated fidelity benefit justifies it here.

### Gate-rule sketch

The React gate should enforce:

- exactly one composed callback ref for each behavior-bearing host;
- no emitted `attach` DOM attribute and no behavior lowered into `useEffect` or `useLayoutEffect`;
- every `BehaviorRecord` resolves to its recorded `componentId` and `hostNodeId` exactly once;
- installation statements follow ascending `order`;
- cleanup calls follow descending `order`, with every `returnsCleanup` result consumed safely;
- the callback’s inline dependency list exactly equals the stable, deduplicated union of recorded `inputs`—no omitted or unrelated dependencies;
- the callback is stabilized rather than recreated on unrelated renders;
- any element handle is assigned before behavior installation and cleared after reverse cleanup;
- mutation tests reject forward cleanup, missing cleanup, reordered installation, missing/extra dependencies, multiple competing host refs, and effect-based bypasses;
- a React 19.2.3 browser calibration covers mount, dependency replacement, conditional detach, unmount, and root StrictMode replay.

### Overturn trigger

Reopen this ruling if:

- Markless requires selective reinstall of only the changed `BehaviorRecord`, making host-group atomic replay observably invalid;
- browser calibration contradicts the executed node-liveness or ordering observations;
- Suspense, Offscreen/Activity, hydration, or resume enters scope and ref replay changes the required lifecycle;
- React changes callback-ref cleanup or identity semantics; or
- `/2` adds an explicit in-place behavior update protocol.

### Evidence limits

The probe used a disposable minimal DOM rather than a browser or jsdom, so it did not measure paint, layout, hydration, Suspense, event delegation, or browser-library behavior. The effect cleanup ordering is an observation from React 19.2.3, not a documented cross-Effect guarantee.

`useCallback` is documented primarily as memoization and React may discard its cache in cases such as initial-mount suspension. Therefore arbitrary behaviors still need symmetric cleanup and replay safety; the compiler cannot make an inherently non-reversible behavior StrictMode-safe. No equivalence claim is made for `returnsCleanup: false` behaviors with irreversible external effects.

The probe workspace was restored to its original three entries (`package.json`, `package-lock.json`, and `node_modules`). The Frameless worktree remained clean; no repository files were written.
