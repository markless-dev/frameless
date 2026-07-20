# T004a-ownership-probes (crew scout, executed probes, 2026-07-20)

Executed all five probes against the main checkout through both `buildEnrichedIr` and the pinned `buildSemanticGraph`. Direct Layer A compilation succeeded with `diagnostics: []` for every probe. The product path rebuilt Layer A, then rejected every source with: `Frameless v0 requires exactly one exported component per .tsrx file; found 2.`

No repository or temporary files were written. Both the main checkout and scout worktree remained clean.

## 1. Duplicate local names

Relevant raw Layer A excerpt:

```json
"components": [{ "name": "Alpha" }, { "name": "Beta" }],
"graphBindings": [
  {
    "id": "state:count",
    "name": "count",
    "kind": "state",
    "declarationKind": "let",
    "writable": true,
    "valueKind": "scalar",
    "initialValue": 0,
    "initialValueKnown": true
  },
  {
    "id": "state:count",
    "name": "count",
    "kind": "state",
    "declarationKind": "let",
    "writable": true,
    "valueKind": "scalar",
    "initialValue": 0,
    "initialValueKnown": true
  }
],
"localDeclarations": [
  { "name": "count", "scope": "component", "componentName": "Alpha" },
  { "name": "count", "scope": "component", "componentName": "Beta" }
]
```

The two binding rows are byte-for-byte semantically identical: same `id`, name, kind and value, with no span, component name or foreign key to either `localDeclarations` row. They cannot be told apart as Layer A binding records.

Usage records retain more coordinates:

```json
"events": [
  {
    "id": "event:0",
    "hostNodeId": "h0",
    "eventName": "click",
    "handlerSpans": [{ "start": 111, "end": 124 }]
  },
  {
    "id": "event:1",
    "hostNodeId": "h1",
    "eventName": "click",
    "handlerSpans": [{ "start": 215, "end": 228 }]
  }
],
"stateWrites": [
  {
    "target": "count",
    "writeScope": "handler",
    "componentName": "Alpha",
    "targetSpan": { "start": 117, "end": 122 },
    "operation": "update",
    "updateOperator": "++"
  },
  {
    "target": "count",
    "writeScope": "handler",
    "componentName": "Beta",
    "targetSpan": { "start": 221, "end": 226 },
    "operation": "update",
    "updateOperator": "++"
  }
]
```

`stateReads` have source spans but no graph-node or component identity. `templateReads` have both source spans and `hostNodeId`. Product-parser component spans were Alpha `48..144` and Beta `153..248`, so reads and events can be assigned by span containment. Writes are independently labeled by `componentName`.

Verdict: **AMBIGUOUS** for component-local `graphBindings`: both `count` records collide on every available coordinate. Reads/writes are owner-attributable by component span, and writes additionally by `componentName`, but neither supplies a distinct Layer A binding identity. Name matching at [build.ts](</Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:147>) cannot repair this collision.

## 2. Unexported local child

Relevant raw excerpt:

```json
"components": [{ "name": "Parent" }, { "name": "Child" }],
"componentEdges": [{
  "id": "component-edge:0",
  "parentComponentName": "Parent",
  "childComponentName": "Child",
  "sourceSpan": { "start": 77, "end": 86 },
  "props": [],
  "children": { "childCount": 0 }
}],
"graphBindings": [{
  "id": "state:count",
  "name": "count",
  "kind": "state"
}],
"localDeclarations": [{
  "name": "count",
  "scope": "component",
  "componentName": "Child"
}],
"stateWrites": [{
  "target": "count",
  "writeScope": "handler",
  "componentName": "Child",
  "targetSpan": { "start": 166, "end": 171 },
  "operation": "update"
}]
```

The component list gives the unexported child only `{ "name": "Child" }`; it contains no export status, span, ordinal or ID. The product parser supplies the missing module coordinates: Parent is exported at `48..95`; Child is unexported at `97..193`. The Child event span is `160..173`, its write is `166..171`, and its template read is `176..181`, all inside Child’s range.

Verdict: **ATTRIBUTABLE-BY** top-level component AST range plus `localDeclarations.componentName`, `stateWrites.componentName`, record spans, and the edge’s `parentComponentName`/`childComponentName`. A module-stable Child ID must be Frameless-owned—for example normalized module identity plus top-level component ordinal/name. That ID is an inference derived from the AST, not an identity supplied by Layer A.

The lone `graphBinding` can be assigned to Child by a unique-candidate join in this particular source. That does not generalize across the duplicate-name collision in probe 1.

## 3. Factory-owned writes

Relevant raw excerpt:

```json
"graphBindings": [{
  "id": "shared:/ownership-probes/3-factory-owned-writes.tsrx#useCounter/state:count",
  "name": "count",
  "kind": "state",
  "sharedDefinitionId": "shared:/ownership-probes/3-factory-owned-writes.tsrx#useCounter"
}],
"sharedDefinitions": [{
  "id": "shared:/ownership-probes/3-factory-owned-writes.tsrx#useCounter",
  "name": "useCounter",
  "exportedName": "useCounter",
  "sourceSpan": { "start": 75, "end": 173 }
}],
"sharedInstances": [{
  "definitionId": "shared:/ownership-probes/3-factory-owned-writes.tsrx#useCounter",
  "definitionName": "useCounter",
  "localName": "counter",
  "source": "useCounter()",
  "sourceSpan": { "start": 222, "end": 234 }
}],
"stateWrites": [{
  "target": "count",
  "sharedDefinitionId": "shared:/ownership-probes/3-factory-owned-writes.tsrx#useCounter",
  "writeScope": "helper",
  "targetSpan": { "start": 154, "end": 159 },
  "operation": "update",
  "updateOperator": "++"
}]
```

The factory write sits inside the shared-definition span, carries the definition ID, has `writeScope: "helper"`, and has no `componentName`. It is definition/module-owned, not owned by whichever components instantiate or invoke the shared object.

The component call appears separately as:

```json
{
  "source": "counter.increment",
  "sourceSpan": { "start": 261, "end": 278 }
}
```

Its containing event handler is `255..280`, attached to `h0`; the instance call is `222..234`. Both lie in Caller. Layer A does not emit a component-owned state-write record for calling the method—the actual mutation remains the helper-level definition write.

Verdict: **MODULE-OWNED** for the shared definition, its graph binding, and definition-level reads/writes. The shared instance and method-call usage are **ATTRIBUTABLE-BY** source-span containment and event/host linkage.

## 4. Nested hosts and identical templates

Relevant raw excerpt:

```json
"hostNodes": [
  { "id": "h0", "tagName": "section" },
  { "id": "h1", "tagName": "div" },
  { "id": "h2", "tagName": "button" },
  { "id": "h3", "tagName": "section" },
  { "id": "h4", "tagName": "div" },
  { "id": "h5", "tagName": "button" }
],
"events": [
  {
    "id": "event:0",
    "hostNodeId": "h2",
    "eventName": "click",
    "handlerSpans": [{ "start": 76, "end": 84 }]
  },
  {
    "id": "event:1",
    "hostNodeId": "h5",
    "eventName": "click",
    "handlerSpans": [{ "start": 196, "end": 204 }]
  }
]
```

Layer A host rows have globally unique node IDs but no span, component name or parent-host link. The IDs themselves do not encode ownership.

The executed ordering matches product AST preorder exactly:

- Left AST `7..117`: `section 28..115`, `div 54..105`, `button 59..99` → `h0,h1,h2`.
- Right AST `126..237`: `section 148..235`, `div 174..225`, `button 179..219` → `h3,h4,h5`.

The handler spans independently corroborate that `h2` belongs to Left and `h5` to Right. There is no independent Layer A coordinate for ancestor hosts `h0/h1/h3/h4` beyond array order.

Verdict: **ATTRIBUTABLE-BY** the pin’s observed ordered-host join: walk components in top-level source order, walk each rendered host in AST preorder, consume one `hostNodes` row, require the tag to match, assign the current component ID, then require complete consumption. This is the same cursor contract already used at [build.ts](</Users/jacksm5pro/dev/open-source/frameless/packages/compiler/src/build.ts:426>).

Honest inference: host ordering is an observed positional contract, not an explicit ownership coordinate. Identical templates prove the cursor can separate the two groups, but tag validation could not detect a same-tag permutation. The `/2` contract should pin this with regression probes and fail closed on any count/tag mismatch.

Events inherit host ownership through `hostNodeId`; their spans provide an independent check. Host-associated behavior and handle records can likewise inherit ownership once the host join succeeds, although those classes were not exercised by these five probes.

## 5. Shared instances

Relevant raw excerpt:

```json
"sharedInstances": [
  {
    "definitionId": "shared:/ownership-probes/5-shared-instances.tsrx#useCounter",
    "definitionName": "useCounter",
    "localName": "counter",
    "source": "useCounter()",
    "sourceSpan": { "start": 227, "end": 239 }
  },
  {
    "definitionId": "shared:/ownership-probes/5-shared-instances.tsrx#useCounter",
    "definitionName": "useCounter",
    "localName": "counter",
    "source": "useCounter()",
    "sourceSpan": { "start": 355, "end": 367 }
  }
],
"localDeclarations": [
  { "name": "counter", "scope": "component", "componentName": "Incrementer" },
  { "name": "counter", "scope": "component", "componentName": "Reader" }
]
```

There is still no explicit component field on either instance. The exact differentiator is `sourceSpan`: Incrementer’s component body is `206..307`, containing instance `227..239`; Reader’s body is `334..405`, containing instance `355..367`.

Usage corroboration:

```json
{ "source": "counter.increment", "sourceSpan": { "start": 266, "end": 283 } }
```

belongs to Incrementer, while:

```json
{
  "hostNodeId": "h1",
  "source": "counter.count",
  "sourceSpan": { "start": 380, "end": 393 },
  "target": { "kind": "text" }
}
```

belongs to Reader.

Verdict: **ATTRIBUTABLE-BY** instance `sourceSpan` contained by the product AST component range, corroborated by `(localName, componentName)` local declarations and event/template-host usage. The definition ID identifies what is instantiated, not who instantiated it.

## Minimal supported algorithm

1. Parse the module through the existing product parser. Enumerate top-level TSRX functions in source order, including unexported functions, and assign Frameless-owned module-stable IDs. Export identity comes from the AST/module export table; Layer A’s component list supplies only names.
2. Attribute every span-bearing record by containment in exactly one component function/body range. If it lies inside a shared-definition span instead, classify it as definition/module-owned. Overlap, no match or multiple matches fails closed.
3. Prefer explicit coordinates when present: `componentName` for local declarations/writes, `sharedDefinitionId` for definition records, edge parent/child names, and `hostNodeId` for host-associated records. Cross-check them against span ownership; disagreement fails closed.
4. Attribute hosts with the executed source-order/preorder cursor join, validating every tag and complete consumption. Events, template reads, behaviors, element handles and repeat records that reference a host inherit that host’s owner.
5. Attribute shared instances by their unique call-site spans. Keep shared definitions, returned properties, shared graph bindings, and helper-level writes module/definition-owned.
6. Resolve component-owned records only when the join has exactly one candidate. Never fall back to a module-global name map.

Covered by executed evidence: components via AST coordinates; component edges; local declarations; events; handler/component writes; state-read ownership by span; template reads; hosts through ordered traversal; shared definitions; shared instances; shared return properties; and definition-level reads/writes.

## Required trimming/vendor gates

- **Component-local `graphBindings` with colliding identities must be vendor-gated or rejected.** Probe 1 proves there is no coordinate that distinguishes the two binding rows. A new Frameless component ID does not create evidence connecting either Layer A row to that ID.
- A unique-candidate binding join may accept non-colliding modules, but it must fail closed as soon as two components produce the same Layer A binding key/signature. The multi-component duplicate-local-name surface therefore cannot be generally claimed on this pin.
- `stateReads` can be assigned an owner by span, but exact binding linkage remains gated wherever the target binding collision above exists; the raw read rows contain no graph node ID.
- Branch sites, async boundaries, aliases, keyed-repeat ownership, behaviors and element handles were not exercised by these five probes. Host-linked instances can inherit host ownership structurally, but any class without a span, explicit component field, shared-definition ID or proven host association remains trimmed until an executed collision probe proves its join.

Bottom line: spans reliably attribute usage and shared instances; helper records are definition-owned; host records can use the pin’s ordered cursor contract. Component-local binding identity is not recoverable for duplicate names and remains the blocker requiring the vendor identity refresh or a deliberately trimmed surface.
