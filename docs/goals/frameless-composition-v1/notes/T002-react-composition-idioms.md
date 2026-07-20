# T002-react-composition-idioms (crew scout, 2026-07-20)

# React 19 composition lowering dossier

## 1. Shared-state lowering

### Ruling

The enriched IR decides the lowering. The emitter must consume `sharedDefinitionId`, instance/scope, returned cells and methods, and per-component read/call/write records; it must fail closed if those records are absent and never rediscover usage from source.

Selection thresholds:

- Prop threading: exactly one scalar cell, no returned methods, and every reader/writer is a direct child of the generated composite root—no intermediate forwarding edge.
- Scalar context: exactly one scalar cell, no methods, and deeper/fan-out access makes direct-root props inapplicable. Every context consumer then depends on the one changing cell.
- Object context: permitted only when every consumer’s IR read set equals the complete cell set. Otherwise one changed field causes irrelevant consumers to render.
- Provider-scoped store plus `useSyncExternalStore`: required when there are at least two cells with differing component read sets, or when the shared instance exposes any method. Subscribe each component only to the cell IDs in its read records; wire method calls and notifications from call/write records.
- Module store plus `useSyncExternalStore`: rejected by default. Permit only for an explicitly recorded `scope: 'page'`, exactly one page instance, and a client-only lifecycle with no request/container isolation requirement. Never infer singleton scope from module placement.

This follows T001’s finding that the pin retains shared properties, methods, instances, reads, and writes, while `/2` must make ownership explicit ([T001 capability map](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:28)).

### Executed evidence

Method: React DOM client reconciliation under async `act`, without StrictMode. Because jsdom installation failed, the probe used a disposable minimal DOM host implementing the operations needed by `react-dom/client`. Component-body counters measured renders; the stored React `onClick` prop was invoked directly. Babel ran `babel-plugin-react-compiler` first on the original JSX, followed by a disposable JSX-to-`createElement` transform.

Verbatim final output:

```text
react=19.2.3 react-dom=19.2.3 compiler=1.0.0 babel=7.29.7
compiler_output_has_runtime=true
compiler_output_bytes=9609 baseline_output_bytes=5225
baseline context initial A=1 B=1; updateA delta A=1 B=1
baseline provider_store initial A=1 B=1; updateA delta A=1 B=0
baseline module_store initial A=1 B=1; updateA delta A=1 B=0
baseline props initial A=1 B=1; updateA delta A=1 B=0
baseline context_unmemoized initial A=1 B=1; updateA delta A=1 B=1
baseline props_unmemoized initial A=1 B=1; updateA delta A=1 B=1
baseline context_plain initial A=1 B=1; updateA delta A=1 B=1
baseline props_plain initial A=1 B=1; updateA delta A=1 B=1
compiler context initial A=1 B=1; updateA delta A=1 B=1
compiler provider_store initial A=1 B=1; updateA delta A=1 B=0
compiler module_store initial A=1 B=1; updateA delta A=1 B=0
compiler props initial A=1 B=1; updateA delta A=1 B=0
compiler context_unmemoized initial A=1 B=1; updateA delta A=1 B=1
compiler props_unmemoized initial A=1 B=1; updateA delta A=1 B=0
compiler context_plain initial A=1 B=1; updateA delta A=1 B=1
compiler props_plain initial A=1 B=1; updateA delta A=1 B=0
```

Here `context` used a memoized `{a,b}` provider value and `memo` consumers; `provider_store` carried a stable per-cell store through context; `module_store` used the same per-cell subscription without a provider; and `props` used memoized consumers under a composite root.

The result is decisive: React Compiler did not change context-consumer behavior. B rendered once after A changed both with and without compilation, including the manually memoized context case. The transformed `ContextB` still entered its component body and called `useContext`; only its returned host element was cached. This matches React’s current documentation: changed context values rerender context readers, and `memo` does not block fresh context ([useContext](https://react.dev/reference/react/useContext), [memo with context](https://react.dev/reference/react/memo)).

The compiler did help the clean un-memoized prop control: B changed from `1` to `0`. Its transform cached `<PropsB value={b}>`, consistent with the documented automatic memoization behavior ([React Compiler introduction](https://react.dev/learn/react-compiler/introduction)). It did not improve the already disciplined prop/store candidates.

`useSyncExternalStore` is a fitting implementation because React compares each subscribed snapshot with `Object.is` and rerenders only when that snapshot changes; snapshots must remain stable while unchanged ([useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)).

### Gate rule sketch

- Require explicit shared definition, instance, scope, cell, method, and per-component usage records.
- Reject lowering when component ownership or cell identity is missing.
- Context rule: one cell, or identical full read sets; memoized provider value; no method-bearing returned object.
- Store rule: stable store identity; stable per-cell `subscribe`/`getSnapshot`; immutable or scalar cached snapshots; notify exactly the cell subscriptions identified by writes.
- Module-store rule: explicit page singleton plus client-only contract.
- Never select an idiom by scanning emitted/source identifiers.

### Overturn trigger

Revisit if React adds field/selective context subscriptions, or an executed pinned compiler probe makes B remain at zero for a changed object-context value while B reads only an unchanged field. Also revisit module stores when SSR/request isolation and hydration snapshot contracts are designed and tested.

## 2. Children and slots

### Ruling

Lower the buildable default slot as an opaque `children`/`ReactNode` prop:

```jsx
function Frame({ children }) {
  return <section>{children}</section>;
}
```

Emit authored nested JSX at the component reference and project `children` directly. Do not use `Children.map`, `cloneElement`, or a render prop. Render props are appropriate when the child must lazily receive data from the receiving component; T001 proves only ordinary default projection and records no such callback/data-flow contract.

Generate one composite root that mounts all cooperating components. This matches the existing single-root analyzer model; T001 explicitly finds that both adapters can exercise cross-component behavior through such a root ([analyzer/root evidence](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:166)).

### Evidence

T001 executed same-module and imported `<Frame><p>projected</p></Frame>` probes; Layer A recorded `childCount: 1` using ordinary `children` syntax ([probe ledger](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:122)). React documents nested JSX as the `children` prop and encourages it for wrapper “holes” ([Passing JSX as children](https://react.dev/learn/passing-props-to-a-component)). React also calls lowercase `children` good and encouraged, while warning that the `Children` manipulation API can be fragile; render props are for customization requiring information passed into the rendering function ([Children alternatives](https://react.dev/reference/react/Children)).

### Gate rule sketch

- Require distinct `component-reference` and `default-slot-projection` IR nodes.
- Preserve the authored subtree; `childCount` alone is insufficient.
- Emit one `children` projection unchanged; forbid traversal, cloning, or invocation.
- Reject named/capture slots until vendor capture-route records exist.

### Overturn trigger

Adopt render props or named-slot machinery only when refreshed vendor IR supplies typed lazy capture/passthrough routes. T001 currently marks those vendor-gated ([capture-slot finding](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:27)).

## 3. Refs

### Ruling

For direct element access within a component, emit `useRef(null)`, attach it to the resolved host element, and perform imperative focus from an event handler with the established null guard, e.g. `inputRef.current?.focus()`.

Where the parent owns the handle and linked IR resolves that exact handle through a component edge to a child host, pass it as React 19’s ordinary `ref` prop. Do not emit `forwardRef`.

Do not claim arbitrary forwarding, nested ref transport, or custom imperative handles. `useImperativeHandle` requires an explicit custom-handle contract that the current pin does not provide.

### Evidence

T001 executed the direct `element()` plus `input?.focus()` shape and produced an element binding and host association ([direct-ref probe](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:103)). React documents attaching a ref to an input and calling `focus()` from a handler ([useRef](https://react.dev/reference/react/useRef)). React 19 makes `ref` available as a function-component prop and places `forwardRef` on the deprecation path ([React 19 ref-as-prop](https://react.dev/blog/2024/12/05/react-19)); direct DOM exposure and narrower custom handles are separately documented ([useImperativeHandle](https://react.dev/reference/react/useImperativeHandle)).

T001 also shows that independently compiled child-side forwarding still lacks required incoming-edge context and remains a decision point ([forwarding finding](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:31)).

### Gate rule sketch

- `useRef(null)` only for an IR element-handle binding.
- `ref={handle}` only on the resolved host, or on a component edge whose linked child-host binding is explicit.
- Imperative reads only in recorded handlers/behaviors, with null protection.
- Reject `forwardRef`, string refs, unresolved forwarding, nested/spread handle transport, and `useImperativeHandle` without custom-handle IR.

### Overturn trigger

Expand forwarding only after `/2` has incoming-edge linkage across independently compiled modules and the vendor pin accepts the child-side contract. Add custom handles only when IR records their exposed methods and ownership.

## 4. React Compiler adoption

### Ruling

Generated code must neither require nor assume React Compiler in this tranche. It may be compiled by a consuming application, but correctness and selected render isolation must hold without it.

The executed benefit for these emitted shapes is narrow: it removed B’s parent-driven render for straightforward un-memoized prop threading, but bought nothing for changed context consumers and nothing additional for the per-cell store candidates. React itself describes the compiler as stable but still optional ([compiler introduction](https://react.dev/learn/react-compiler/introduction)). React 19 supplies its runtime, and the executed transform correctly imported `react/compiler-runtime` ([target documentation](https://react.dev/reference/react-compiler/target)).

### Gate rule sketch

- Run semantic/browser coverage against uncompiled generated JSX.
- A compiler-enabled lane may be additive and must produce equivalent observations.
- No generated directive or compiler-runtime import.
- No performance ruling may rely on compiler-only memoization.

### Overturn trigger

Reconsider shipping compiled output only after representative generated corpora show a material measured win, compiled and uncompiled suites both pass, source-map/debugging and package ownership are resolved, and the owning application explicitly adopts the compiler. React recommends testing library output both ways ([compiling libraries](https://react.dev/reference/react-compiler/compiling-libraries)).

## Evidence limits

- jsdom installation was attempted but npm registry access failed with `ENOTFOUND`; no jsdom package was installed.
- The render probe used the real React DOM reconciler and hooks against a minimal DOM host, not a browser or jsdom. It directly invoked React’s stored click callback, so event delegation was outside scope.
- Measurements are render counts, not duration or memory benchmarks; one development-mode mount was used without StrictMode.
- The external stores were synchronous scalar stores with per-cell listener sets. Transitions, Suspense, SSR, hydration, request isolation, teardown races, and method transactions spanning multiple cells were not measured.
- Compiler output was generated from original JSX before the disposable JSX transform; its ES runtime import was mechanically rewritten to CommonJS only for execution.
- Ref and children rulings reuse T001’s executed Markless probes plus live React documentation; no new browser ref/slot probe was run.
- Cross-file imported `shared()`, typed capture slots, and independently compiled forwarded refs remain outside the pinned buildable surface.
- All disposable probe sources and generated outputs were removed. The scratch directory again contains only the PM-provided `package.json`, `package-lock.json`, and `node_modules`. The Frameless worktree is clean.
