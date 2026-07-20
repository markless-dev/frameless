# T001 pinned-capability + IR gap map (crew scout, executed probes, 2026-07-20)

## Evidence receipt

### Boundary and provenance

The installed compiler is the vendored `@markless/compiler@0.1.1`; checksum verification passed for all eight tarballs. The compiler tarball hash is `bc0f573b765e2cd3c2e5d546314acd347938ddc99fc05c276f30bf4fe0c800ad`. Its exact source revision is unknown, so commit-level inclusion cannot be inferred from version alone. [PROVENANCE](/Users/jacksm5pro/dev/open-source/frameless/vendor/PROVENANCE:8) [SHA256SUMS](/Users/jacksm5pro/dev/open-source/frameless/vendor/SHA256SUMS:3) [root overrides](/Users/jacksm5pro/dev/open-source/frameless/package.json:33)

`buildEnrichedIr` invokes Layer A at [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:93). Markless error diagnostics are wrapped later at lines 130–138; the relative-import and `/1` shape checks are Frameless-owned. Thus a `MARKLESS_*` diagnostic remains a Layer A rejection even when the product wrapper formats the thrown error.

The core tarball declares:

```ts
declare function element<T extends Element = Element>(): T | undefined;
declare function shared<T>(create: () => T, options?: { scope: 'request' | 'container' | 'page' }): () => T;
```

Its installed playbook explicitly prescribes `element()` with `el={handle}` and `attach={behavior}`. No named-slot authoring API was found in the core tarball.

## Per-construct findings

| Construct | Pinned support — executed | Upstream delta | `frameless-enriched-ir/2` requirement | Verdict |
|---|---|---|---|---|
| Multiple components in one module | Layer A produced `tsrx-semantic-graph` with `components: [{name:'Parent'},{name:'Child'}]`, no diagnostics. Layer B rejected: `Frameless v0 requires exactly one exported component per .tsrx file; found 2.` | Upstream has stable per-component binding identity added in `767f5c0`, including `componentId`, `componentName`, and `bindingId`. [artifacts.ts](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:76) | Remove the one-component guard; give every binding/prop/local explicit component ownership; allow multiple exports; update both emitters, which independently enforce one component today. [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:274) [React validator](/Users/jacksm5pro/dev/open-source/frameless/packages/frameworks/react/src/emitter/index.ts:42) [Solid validator](/Users/jacksm5pro/dev/open-source/frameless/packages/frameworks/solid/src/emitter/index.ts:280) | **buildable-on-pin** |
| Cross-file component reference | Layer A accepted `import { Child } from './child.tsrx'` plus `<Child/>`, recording `component-edge:0`, import metadata, and `children.childCount: 0`. Layer B rejected: `Frameless v0 rejects relative imports in .tsrx modules because cross-TSRX component imports are unsupported: ./child.tsrx`. | Upstream capture/runtime work adds typed per-edge routes, bound resolver rows, and imported-child runtime wiring (`767f5c0`, `61e4634`, `b8844a6`). Those later Markless passes are not consumed by Frameless. | Add a component-reference template node keyed to a preserved component edge, structured prop expressions, module/export linkage, and multi-module emitter orchestration. The current IR drops `semanticGraph.componentEdges` entirely. [build return](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:248) | **buildable-on-pin** for framework-native JSX composition |
| Default children projection | Layer A accepted both same-module and imported `<Frame><p>projected</p></Frame>`, recording `childCount: 1`. Authoring syntax is ordinary `children`: `function Frame({ children }) @{ <section>{children}</section> }`. Same-module product failed at the two-component guard; imported product failed at the relative-import guard. | Upstream render-layer children work includes `b67ddc4` (“children opacity diagnostic and raw template projection”) and `685f907` (“CSR children projection renders components markup-only”). Current fixtures use the same `children` syntax. [panel-frame.tsrx](/Users/jacksm5pro/dev/open-source/markless/packages/vitest-browser/browser/fixtures/panel-frame.tsrx:1) | Add `component-reference` children and a distinct default-slot projection node. `{children}` must not remain an ordinary dynamic-text node. Preserve the authored subtree, not only Layer A’s count. | **buildable-on-pin** |
| Typed capture slots / passthrough routes | Searches of the pinned compiler’s `dist/index.js`, declarations, and README found no `captureSlot`, `boundResolver`, or `passthrough-route` surface. | **Upstream-only:** `767f5c0` introduced AST-owned binding identity and typed capture slots; `61e4634` added the capture ABI; `b8844a6` added bound-ID runtime invocation; `1c2ce1a` added passthrough routes for own props forwarded to imported descendants. [capture route types](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:815) [capture test](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/test/capture-slot-binding.test.ts:207) [passthrough test](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/test/capture-slot-binding.test.ts:495) | Decide whether “slots” means default `children` or Markless’s newer lazy-symbol capture-slot ABI. If the latter, `/2` must consume new vendor records rather than reproduce that analysis. | **blocked-on-vendor-refresh** if capture-slot semantics are required; otherwise default children are buildable |
| Same-module `shared()` | Layer A accepted the documented factory/instance shape, recording a shared definition, returned graph property and method, shared-tagged state binding, instance, template read, and definition-level write. Layer B returned `/1`, but the emitted record table had empty shared reads/writes and no shared definition/instance records. | Upstream `767f5c0` adds `bindingId`/`componentName` to bindings and state reads. [upstream state-read type](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/artifacts.ts:334) The pin lacks these explicit ownership fields. | Add shared definitions, instances, scope, return-property/method records, shared-cell bindings, and per-component read/call/write usage. Preserve `sharedDefinitionId`. **Inference:** the pin’s source spans and host/event associations are sufficient for the enrichment pass to associate the executed same-file example with component AST ranges, but ownership is not explicit and must be locked contractually. Framework emitters must never rediscover this from source. | **buildable-on-pin** for same-module definitions, subject to that ownership design |
| Cross-file imported `shared()` | Layer A rejected an imported `useCounter()` call with `MARKLESS_STATE_HELPER_RETURN_UNSUPPORTED`. The defining module’s `moduleGraphInterface.exports` was empty, so passing its current interface cannot repair the consumer. Product message: `Markless semantic compilation failed for reader.tsrx: MARKLESS_STATE_HELPER_RETURN_UNSUPPORTED: Cannot call imported helper "useCounter" from "./shared.tsrx" as component state because graph analysis is not available for that module.` | **Upstream-only:** commit `de15cdf` added cross-module shared recognition/guards; current `collect-shared.ts` recognizes imported TSRX shared definitions. [collect-shared.ts](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/src/passes/semantic-graph/collect-shared.ts:59) | `/2` needs external shared-definition references and stable cross-module definition IDs, but the current pin cannot produce a valid consumer graph first. | **blocked-on-vendor-refresh** |
| Direct ref plus attach behavior | After wrapping the two rendered roots in a fragment, Layer A produced an element binding, `elementHandleBindings[{hostNodeId:'h0',handleName:'input',componentName:'RefFocus'}]`, a behavior with cleanup source, and a click event. No diagnostics. Layer B returned `/1`, but encoded `el` and `attach` as ordinary dynamic attributes, omitted behaviors/handle bindings, and gave the `input?.focus()` handler no graph reads. | Upstream preserves element-handle calls into lazy event symbols; see `223a33c` and the current emitted-call test. [symbol test](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/test/symbol-modules.test.ts:2010) | Add element-handle bindings, host attachment records, behavior/cleanup AST and inputs, and structured element-handle method calls. `el`/`attach` must not be generic DOM attributes. | **buildable-on-pin** |
| Ref forwarded to another component | A same-module parent/child probe succeeded: Layer A recorded the element graph reference on the component edge and resolved the child host binding. The imported parent alone also recorded the edge prop. However compiling the child file independently rejected `el={props.input}` with `MARKLESS_ELEMENT_HANDLE_PROP_UNSUPPORTED: Cannot bind el={props.input} because this slice only supports element handles passed as direct component props, not through arrays or nested object props.` | Upstream commit `943dcfd` implements prop-forwarded handles through component edges in the full compiler pipeline; its tests cover same-module and imported parent edges. [semantic tests](/Users/jacksm5pro/dev/open-source/markless/packages/compiler/test/semantic-graph.test.ts:530) | `/2` needs incoming-edge knowledge when compiling the child, or a module-link phase that validates and resolves the child handle after both graphs exist. Merely removing the relative-import guard is insufficient. | **needs-decision**; a vendor refresh alone does not define how `buildEnrichedIr` supplies incoming-edge context |

## Exact probe ledger

### 1. Two exported components

```ts
export function Parent() @{
	<div>parent</div>
}

export function Child() @{
	<span>child</span>
}
```

Layer A: graph produced, two components, no diagnostics. Layer B: exact rejection shown in the table.

### 2. Imported child

```ts
import { Child } from "./child.tsrx";

export function Parent() @{
	<Child />
}
```

Layer A: graph produced with `component-edge:0` and import metadata. Layer B: exact relative-import rejection shown above.

### 3. `shared()`

```ts
import { shared, state } from "@markless/core";

export const useCounter = shared(() => {
	let count = state(0);
	return {
		count,
		increment() { count++; },
	};
});

export function Counter() @{
	const counter = useCounter();
	<button onClick={() => counter.increment()}>{counter.count}</button>
}
```

Both artifacts were produced. Layer A retained the shared semantics; `/1` silently lost them as described above.

The two-component shared probe additionally produced two instance spans but no explicit component name on either instance/read:

```ts
export function Incrementer() @{
	const counter = useCounter();
	<button onClick={() => counter.increment()}>increment</button>
}
export function Reader() @{
	const counter = useCounter();
	<output>{counter.count}</output>
}
```

Layer B then rejected `found 2`.

### 4. `element()` and attach

The initial unwrapped two-root source was rejected by the TSRX parser, before a semantic artifact existed:

`A code block renders a single node; wrap multiple nodes or text in a fragment '<>…</>'.`

Corrected source:

```ts
import { element } from "@markless/core";

export function RefFocus() @{
	const input = element<HTMLInputElement>();
	<>
		<input el={input} attach={(node) => {
			node.dataset.ready = "yes";
			return () => { delete node.dataset.ready; };
		}} />
		<button onClick={() => input?.focus()}>focus</button>
	</>
}
```

Both artifacts were produced; `/1`’s semantic loss is recorded in the table.

### 5. Children

```ts
export function Frame({ children }) @{
	<section>{children}</section>
}

export function Page() @{
	<Frame><p>projected</p></Frame>
}
```

Layer A produced two components, an edge with `childCount: 1`, and no diagnostics. Layer B rejected `found 2`. The imported version produced the same edge count and then hit the relative-import rejection.

### 6. Explicit component-template guard

```ts
export function Parent() @{
	<Child />
}
```

Layer A produced an edge. Layer B rejected verbatim: `Component template nodes are outside this fixture-scoped IR: Child` at [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:438).

## Layer B limits and losses

- `findComponents` currently counts every top-level TSRX function, including unexported local child components, then requires exactly one and separately requires that one to be exported. [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:274)
- The relative-import check rejects the first relative import of any kind, despite its component-specific message. [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:141)
- Component/dynamic template nodes and spreads fail closed. [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:438) [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:452)
- Other unknown template node kinds do **not** universally fail closed: the final fallback returns `[]`, silently dropping them. `/2` must replace this with an explicit exhaustive diagnostic. [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:587)
- `/1` only emits bindings, aliases, events, canonical reads and writes. Component edges, shared definitions/instances, behaviors and element-handle bindings are absent. [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:248)
- Binding environments are keyed only by binding name, which is unsafe once components may reuse local names. [build.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:147)
- The schema has only host/text/dynamic-text/branch/repeat/fragment nodes; it has no component reference or slot projection. [schema.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/schema.ts:143)

## Layer C — analyzer vocabulary

The existing `Action` and `Observation` types can express all three requested behaviors without new action kinds:

- shared propagation: click a selector in component A, then the normal post-dispatch DOM observation sees component B;
- slot content: the mount observation serializes projected DOM;
- ref focus: click the authored focus trigger; `Observation.focus` records the focused node/path and selection. [types.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/analyzer/src/types.ts:5) [types.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/analyzer/src/types.ts:30)

However, `Scenario` only contains props, actions, and expected callbacks; it has no expected DOM or focus assertions. Cross-framework equality alone would allow both implementations to omit slot content or fail to focus. The tranche therefore needs either scenario-level expected DOM/focus assertions or composition-specific calibrated mutants/browser assertions. [scenarios.ts](/Users/jacksm5pro/dev/open-source/frameless/packages/analyzer/src/scenarios.ts:3)

Both adapters mount exactly one supplied root component. [React adapter](/Users/jacksm5pro/dev/open-source/frameless/packages/frameworks/react/src/adapter.ts:7) [Solid adapter](/Users/jacksm5pro/dev/open-source/frameless/packages/frameworks/solid/src/adapter.ts:6) This is sufficient if a generated composite root renders components A and B. Testing independently mounted roots sharing a page/container scope would require an adapter/mount-model extension.

## Honest tranche summary

Today’s pin is sufficient to start `/2` work for multiple components, cross-file framework-native component references, default `children`, same-module `shared()`, and direct refs/attach. The full tranche is not buildable yet: cross-file imported `shared()` is rejected by Layer A; independently compiled child-side forwarded refs are also rejected; and Markless’s typed capture-slot/passthrough machinery exists only upstream. The immediate safe slice is therefore the `/2` component/default-children contract plus direct-ref records, while cross-file shared state is gated on the vendor refresh and cross-file ref ownership needs an architecture decision.

No files were created or changed. Final `frameless` status was clean. The reference checkout retained exactly its pre-existing dirty files; no new reference-repo changes appeared. No temp probe files remained.
