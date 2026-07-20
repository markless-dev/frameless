# T003-solid-composition-idioms (crew scout, 2026-07-20)

# Solid composition evidence dossier

Scope is limited to T001’s buildable-on-pin constructs: default children, same-module `shared()`, direct refs/attach, multi-component modules, and framework-native cross-file component references. Named capture slots, cross-file shared state, forwarded refs, and SSR are excluded.

## 1. CHILDREN / DEFAULT SLOTS

### Ruling

Emit plain `{props.children}` when the default slot is projected opaquely exactly once. Keep the read inside JSX so Solid’s compiled tracking scope preserves reactive child values.

Use `const resolved = children(() => props.children)` only when generated code must read the projection more than once, inspect it, flatten it, iterate it, or call `toArray()`. The helper is not a mandatory wrapper for every slot.

For scenarios spanning several components, generate one composite root and mount that root through the existing adapter. The composite root renders the provider/wrapper and all participating components; it does not create multiple independent Solid mounts.

### Evidence

- Solid’s props documentation says ordinary `props.children` is normally sufficient, while repeated access can recreate child components or elements; it recommends `children()` for that case. [Solid props documentation](https://docs.solidjs.com/concepts/components/props)
- `children()` returns a stable accessor, resolves nested arrays/fragments/zero-argument accessors, and memoizes the resolved result. [Solid children documentation](https://docs.solidjs.com/reference/component-apis/children)
- Solid 1.8.22 implements the helper as two memos: one around the supplied accessor and one around recursive child resolution. Repeated reads therefore reuse the result until a dependency changes. [installed Solid 1.8.22 implementation](/Users/jacksm5pro/dev/open-source/frameless/node_modules/.pnpm/solid-js@1.8.22/node_modules/solid-js/dist/solid.js:556)
- A read-only runtime probe against that exact distribution observed one evaluation at helper creation, no extra evaluation across two reads, and one reevaluation after a signal change. This is consistent with the implementation; it is not browser evidence.
- T001 requires a distinct default-slot projection node and preservation of the authored subtree, not merely `childCount` or an ordinary dynamic-text expression. [T001 capability map](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:26)
- The adapter mounts exactly one supplied component and disposes that Solid render root. [Solid adapter](/Users/jacksm5pro/dev/open-source/frameless/packages/frameworks/solid/src/adapter.ts:6)
- Solid 2’s `For` callback parameters become accessors, but that is a control-flow callback rule, not a reason to emit `props.children()` for default slots. [Solid 2 control-flow ledger](/Users/jacksm5pro/dev/open-source/solid/documentation/solid-2.0/03-control-flow.md:18) The future migration is `item()`/`i()` inside generated `For` callbacks. [migration guide](/Users/jacksm5pro/dev/open-source/solid/documentation/solid-2.0/MIGRATION.md:388)

### Gate rule sketch

- Require component-reference records to own their complete child subtree and require a distinct default-slot projection node in the receiving component.
- One opaque projection occurrence: require `{props.children}` and forbid an unnecessary `children` import.
- Multiple occurrences or an explicit inspection/iteration operation: require exactly one component-local `children(() => props.children)` binding and require all uses to call that binding.
- Reject `props.children()` unless IR explicitly introduces a function-child construct; default children are renderable values, not an accessor API.
- Reject dropped, duplicated, or dynamic-text-lowered projected subtrees.
- Require one generated composite root for multi-component scenarios; reject extra adapter mounts as an implementation of composition.

### Overturn trigger

Overturn if calibrated browser evidence shows single-use `{props.children}` duplicates or loses a child instance; if `/2` adds function children, named slots, or capture-slot semantics; or when a Solid 2 runtime lane replaces the current 1.8.22 fallback and its accessor-child migration is executable rather than ledger-only.

## 2. SAME-MODULE SHARED-STATE LOWERING

### Ruling

Use different Solid idioms according to the recorded lifetime:

- `page`: module-scope `createSignal`/`createStore` state and stable generated actions. This is the only scope for which a simple module singleton is semantically correct.
- `container`: create the state once inside the generated composite root and expose a stable store/accessor/action value through a generated `createContext` provider.
- `request`: in CSR v0, instantiate once inside that same composite root. It is observationally identical to container scope because one CSR render creates one container and there is no server request lifetime. Preserve the `request` tag rather than silently rewriting it to `container`.
- Props threading is not the default for `shared()`. It is admissible only if IR explicitly supplies every component edge and injected prop route. The emitter must not synthesize transport paths by inspecting source or guessing which descendants consume the shared definition.

A module singleton is rejected for `container`: two mounts would otherwise share state. Context is an implementation detail beneath Markless’s provider-free authoring model, not a change to the authored API.

### Evidence

- T001’s executed probe found shared definitions, scope, internal graph bindings, instances, returned graph properties/methods, reads, and definition-level writes in Layer A. It also records that `/1` drops those semantics and requires `/2` to preserve them explicitly. [T001 shared finding](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:28)
- Markless defines `shared()` as resolution of one named dataflow instance for the current graph context; boundaries are dataflow boundaries, not authored provider components. [Markless shared-state specification](/Users/jacksm5pro/dev/open-source/markless/specs/framework/03-state-graph.md:424)
- Its CSR container owns one graph instance, cleanup/unmount boundary, scheduler, event scope, and container-scoped shared state. [Markless CSR container specification](/Users/jacksm5pro/dev/open-source/markless/specs/framework/06-runtime-resumer.md:120)
- Solid’s official context guidance recommends context for subtree sharing and stores for complex context values. [Solid context documentation](https://docs.solidjs.com/concepts/context)
- Solid 1.8.22 `useContext` is a direct owner-context property lookup. Reactive propagation comes from the signal/store placed in the context, not from rerunning consumer components. [Solid 1.8.22 context implementation](/Users/jacksm5pro/dev/open-source/frameless/node_modules/.pnpm/solid-js@1.8.22/node_modules/solid-js/dist/solid.js:544)
- This is materially different from React: React documents that changed context values rerender consuming components. [React `useContext`](https://react.dev/reference/react/useContext) Solid’s lookup is cheap by implementation shape, but no performance benchmark was run.
- Solid stores lazily create property-level reactive tracking and are appropriate for structured shared values. [Solid stores documentation](https://docs.solidjs.com/concepts/stores)
- Ownership warning: owner-dependent computations need a lifetime. Solid’s `createRoot` documentation warns that unmanaged computations can leak and requires explicit disposal for an independent root. [Solid `createRoot`](https://docs.solidjs.com/reference/reactive-utilities/create-root) Bare signals/stores do not themselves require cleanup, but module-scope effects, resources, or cleanup registrations would be unsafe.
- Markless has no general effects; DOM-backed lifetime work belongs to `attach`. Consequently a page singleton may contain lowered cells, stores, plain derived accessors, and methods, but not owner-dependent effects or resources. [Markless state model](/Users/jacksm5pro/dev/open-source/markless/specs/framework/03-state-graph.md:91)
- Solid 2 makes the distinction explicit: module-scope signal/store state is global, context is subtree-scoped, and intentionally detached singleton lifetime must be explicit. [Solid 2 ownership/context ledger](/Users/jacksm5pro/dev/open-source/solid/documentation/solid-2.0/02-signals-derived-ownership.md:17)

Required `/2` mapping, not source reconstruction:

- `SharedDefinition { id, scope, dependencies, graphBindings, returnProperties }` selects lifetime and constructs each scalar signal or structured store.
- `SharedInstance { definitionId, componentId/componentName, localName }` binds a component use to that definition.
- `SharedRead { definitionId, propertyName, path, component/site }` lowers scalar reads to accessor calls and structured reads to store paths.
- `SharedCall { definitionId, methodName, arguments, event/site, order }` selects a recorded generated action.
- `SharedWrite { graphNodeId, path, operation, value/arguments, order }` lowers to the appropriate setter/store operation.

If any of those links is absent or ambiguous, emission stops. The emitter must not parse factory source, infer methods from spelling, or rediscover reads/writes from component AST.

### Gate rule sketch

- Require every shared read, call, and write to resolve through a preserved `sharedDefinitionId` and declared return property/method.
- Require cell lowering by recorded `valueKind`: scalar to signal; object/array to store.
- `page`: require exactly one module-level instance and forbid provider-local recreation.
- `container`/CSR `request`: forbid module-level reactive instances; require one construction in the composite root and one provider enclosing all recorded consumers.
- Require the provider value to be referentially stable and to carry accessors/store/actions, not snapshots.
- Forbid owner-dependent primitives in page singletons unless IR provides an explicit page disposal owner.
- Permit props threading only when an explicit edge/route record accounts for every injected prop and consumer; otherwise reject it.
- Require every recorded write and call exactly once in authored order; reject unused semantic records.

### Overturn trigger

Overturn if a multi-container calibrated test demonstrates a different Markless lifetime; if `/2` supplies explicit prop transport routes that make threading preferable; if shared factories gain effects/resources or cleanup; if cross-file shared state becomes buildable after a vendor refresh; or if a Solid 2 executable lane changes context/ownership APIs.

## 3. DIRECT REFS, IMPERATIVE CALLS, AND ATTACH CLEANUP

### Ruling

Lower a direct Markless `element()` handle to a component-local variable and native Solid ref assignment:

```jsx
let input;
<input ref={input} />
<button onClick={() => input?.focus()}>focus</button>
```

Use a signal setter ref only when IR explicitly models the element’s presence/identity as reactive state. A direct Markless element handle is a lazy DOM locator, not graph state, so `createSignal` is unnecessary and should be rejected by default.

Lower `attach` separately from `el`. For Solid 1.8.22, generate a named `use:` directive for each host’s behavior group. It installs the recorded behavior on that host and explicitly registers any returned cleanup with `onCleanup`. For reactive behavior inputs, the directive owns a tracked installation scope that runs the previous cleanup before reinstalling. Multiple behaviors install in authored order and must be cleaned up in reverse order.

### Evidence

- Solid documents both ref forms: an lvalue assignment and a callback/setter receiving the created element. Assignment happens at creation time before insertion. [Solid refs documentation](https://docs.solidjs.com/concepts/refs)
- The pinned JSX transform distinguishes an assignable lvalue from a constant/function ref: it assigns the element to the former and invokes the latter. [pinned JSX transform](/Users/jacksm5pro/dev/open-source/frameless/node_modules/.pnpm/babel-plugin-jsx-dom-expressions@0.40.7_@babel+core@7.29.7/node_modules/babel-plugin-jsx-dom-expressions/index.js:1523)
- T001 recorded a direct element binding, host ID, behavior with cleanup source, and imperative `focus()` call, while `/1` incorrectly reduced `el`/`attach` to ordinary attributes and lost the call semantics. [T001 direct-ref finding](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:30)
- Markless explicitly separates `element()` lookup from host-owned `attach` setup/cleanup. Behaviors may return cleanup functions, rerun when behavior inputs change, install in array order, and clean up in reverse order. [Markless behavior contract](/Users/jacksm5pro/dev/open-source/markless/specs/framework/04-events-symbols-behaviors.md:32)
- Solid 1 directives execute in the current owner and may register cleanup. [Solid `use:*` documentation](https://docs.solidjs.com/reference/jsx-attributes/use) `onCleanup` runs on component/scope disposal or computation refresh. [Solid `onCleanup`](https://docs.solidjs.com/reference/lifecycle/on-cleanup)
- A returned function from a Markless behavior is not automatically understood by a Solid directive; generated code must consume it and call `onCleanup` explicitly.
- Future ledger: Solid 2 removes `use:` in favor of composable ref/directive factories, and its callback-ref application is ownerless; current Solid-next tests warn when `onCleanup` is called inside such a callback. [Solid 2 DOM ledger](/Users/jacksm5pro/dev/open-source/solid/documentation/solid-2.0/07-dom.md:50) [ownerless callback-ref tests](/Users/jacksm5pro/dev/open-source/solid/packages/solid-web/test/element.spec.tsx:93)

### Gate rule sketch

- Require every element-handle record to resolve to exactly one native host `ref`; reject `el` as an emitted DOM attribute.
- Require plain variable assignment for direct handles; allow setter refs only under an explicit reactive-handle record.
- Allow imperative methods such as `focus()` only from structured handle-call records, preserving optionality, arguments, and event order. Reject selector-based rediscovery.
- Require every behavior record to resolve to its recorded host; reject `attach` as an emitted DOM attribute.
- Require generated Solid 1 directive setup to consume all behavior AST/input records and all cleanup records.
- For changing inputs, require cleanup-before-reinstall and final cleanup on owner disposal.
- For behavior arrays, require authored installation order and explicit reverse cleanup order.

### Overturn trigger

Overturn if browser calibration shows ref assignment timing is insufficient; if `/2` makes handle presence reactive; if behavior records add an explicit in-place update protocol; or when the target moves to Solid 2, where `use:` and callback-ref ownership assumptions must be replaced rather than mechanically retained.

## 4. CSR SCOPE SEMANTICS

### Ruling

- `request`: one instance per CSR `render()` construction epoch, owned by and disposed with the generated root. There is no actual HTTP/request scope in this tranche.
- `container`: one instance per adapter mount/Solid render owner, disposed on unmount.
- `page`: one module singleton per loaded document/module graph, shared by every container importing that generated module and not disposed by an individual container unmount.

In the current adapter’s one-root CSR model, `request` and `container` are intentionally observationally equivalent. `page` differs only when multiple mounts/containers exist. The scope discriminator must nevertheless remain in IR and generated architecture so later SSR or multi-container work does not silently inherit the wrong lifetime.

### Evidence

- T001 confirms the pin records the literal scope options `request | container | page`. [T001 declaration evidence](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:11)
- Markless states that CSR render creates a live container with one graph and cleanup boundary. [CSR render-container specification](/Users/jacksm5pro/dev/open-source/markless/specs/framework/06-runtime-resumer.md:120)
- The current Solid adapter creates and disposes one Solid render owner per mount. [adapter mount/unmount](/Users/jacksm5pro/dev/open-source/frameless/packages/frameworks/solid/src/adapter.ts:10)
- Solid owners determine cleanup and context lookup, and component subtrees run under owners. [Solid owner documentation](https://docs.solidjs.com/reference/reactive-utilities/get-owner)

### Gate rule sketch

- Exhaustively switch on the recorded scope; unknown or absent scope is a fail-closed diagnostic unless `/2` defines a normative default.
- Require request/container instances below the render owner and page instances above it at module scope.
- Preserve the original scope in generated metadata/test receipts even where CSR behavior currently collapses.
- Add a calibrated multi-mount test before claiming page-vs-container isolation; the current single-root analyzer cannot prove that distinction alone.

### Overturn trigger

Overturn when SSR enters scope, when the adapter supports multiple concurrent containers, when navigation introduces a normative lifetime shorter than document/module lifetime, or when Markless defines a distinct CSR request boundary.

## Evidence limits and verification receipt

- Live official Solid documentation was reachable. It currently mixes stable 1.x surfaces with recently updated material, so executable v0 rulings use the installed Solid 1.8.22 distribution as authority and use live docs for documented intent.
- The local Solid checkout is `next` at commit `b59584be993219ac94f37f1da07e2d7d13dcc9e3`, later than the prior beta.9 dossier evidence. It is future-ledger evidence only; the Frameless package remains `solid-1.8.22-fallback` and is not Solid 2 runtime-validated.
- No browser scenario was executed. The `children()` probe exercised only the reactive runtime. Context cost is inferred from direct source shape, not benchmarked.
- Existing analyzer observations can see projected DOM, shared propagation, and focus, but scenario records lack independent expected DOM/focus assertions; calibrated mutants or explicit assertions are still needed to prevent both framework targets from agreeing on the same omission. [T001 analyzer limit](/Users/jacksm5pro/dev/open-source/frameless/docs/goals/frameless-composition-v1/notes/T001-pinned-capability.md:156)
- Cross-file imported `shared()`, typed capture slots, and independently compiled forwarded refs remain outside these rulings.
- No files were created or changed. The worktree, main Frameless checkout, and local Solid checkout all reported clean status after research; no temporary files were used.
