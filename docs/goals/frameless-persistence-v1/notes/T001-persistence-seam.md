# T001 persistence seam scout

Status: **evidence complete; implementation not started**. This note maps a build-against-contract
path for the Judge. It does not change the owner-locked persistence design.

## Executive verdict

Frameless can build nearly all persistence machinery now, without waiting for a Markless vendor
refresh:

1. normalize a fixture/source storage fact into a Frameless-owned persistence record immediately
   after `buildSemanticGraph`;
2. carry that record in enriched IR;
3. have React and Solid emit their seed reads and assignment write-through from that record;
4. have the CLI consolidate all module records into one closed-form pre-paint script, hash it, stage
   it, and describe it in the build receipt;
5. enforce the render-read lowering with artifact-aware gate policies and mutation tests; and
6. prove the behavior in a witness lane calibrated with a broken seed.

The future vendor refresh is a **production-input dependency, not a machinery dependency**. Until
it lands, Frameless cannot honestly compile a real authored `storage()`/`persist` declaration from
the currently pinned packages, but it can build and test every downstream seam against a fixture
record. A separate non-vendor decision can block the final React SSR no-flash claim: the Judge must
choose how the pre-paint value changes visible SSR DOM without creating a hydration mismatch.

## A. Normalized record contract

### Source fact Frameless must receive

The refreshed Markless semantic graph must supply, without Frameless reparsing source:

- a stable graph binding id and module id;
- the authored binding identifier;
- the **resolved, baked localStorage key literal**;
- whether that literal came from the derived or explicit form;
- the authored initial string;
- writability; and
- ordinary semantic read/write records that correlate by graph id.

The key rules are locked: `storage(fallback)` bakes `markless:<identifier>`, while
`storage(key, fallback)` preserves `key` verbatim
(`docs/goals/storage-ergonomics/goal.md:25-35`). The v1 value and driver surface is string plus
localStorage only (`docs/goals/frameless-persistence-v1/goal.md:102-107`).

The minimum vendor-facing shape is therefore:

```ts
type MarklessStorageSourceFact = {
  readonly graphNodeId: string;
  readonly moduleId: string;
  readonly bindingName: string;
  readonly key:
    | {
        readonly origin: "derived";
        readonly sourceIdentifier: string;
        readonly literal: `markless:${string}`;
        readonly bakedAtCompileTime: true;
      }
    | {
        readonly origin: "explicit";
        readonly literal: string; // verbatim; no prefix
        readonly bakedAtCompileTime: true;
      };
  readonly authoredInitial: string;
  readonly writable: boolean;
};
```

`origin` is not required to perform a localStorage read, but it is required to prove the two
different authoring contracts and to support the derived-key rename manifest without guessing. If
the refreshed semantic graph exposes only `{ storage: { key } }`, the adapter may still seed and
write, but it must report key-origin/manifest provenance as unavailable rather than infer origin
from the string (an author can explicitly choose `markless:theme`).

### Frameless-owned record

The adapter should produce one fail-closed, target-neutral record that all later machinery consumes:

```ts
type PersistenceLanding =
  | {
      readonly target: "markless";
      readonly kind: "payload-scripts";
      readonly slotSymbolKey: "tsrx.storage/1";
      readonly slotKey: string; // stable <moduleId>#<resolved-key>/graph-id-derived key
    }
  | {
      readonly target: "react";
      readonly kind: "sync-read-seed-slot";
      readonly graphNodeId: string;
    }
  | {
      readonly target: "solid";
      readonly kind: "sync-read-seed-slot";
      readonly graphNodeId: string;
    };

type FramelessPersistenceRecord = {
  readonly version: "frameless-persistence-record/1";
  readonly graphNodeId: string;
  readonly moduleId: string;
  readonly bindingName: string;
  readonly driver: "localStorage";
  readonly key: MarklessStorageSourceFact["key"];
  readonly authoredInitial: string;
  readonly antiFlashAttribute: string; // fully resolved literal, never recomputed by an emitter
  readonly access: {
    readonly render: boolean;
    readonly handler: boolean;
  };
  readonly seed:
    | {
        readonly lowering: "pre-paint";
        readonly readFailure: "authored-initial";
        readonly corruptedValue: "authored-initial";
        readonly landings: readonly PersistenceLanding[];
      }
    | {
        readonly lowering: "none";
        readonly reason: "no-render-read";
        readonly landings: readonly [];
      };
  readonly writeThrough: {
    readonly trigger: "ordinary-assignment";
    readonly value: "final-committed-string";
    readonly timing: "commit-before-notify";
    readonly writeFailure: "swallow";
    readonly crossTabSync: "off"; // opt-in is later/additive
  };
};
```

This makes the owner rule executable: any render access means `seed.lowering === "pre-paint"`;
handler-only access does not create a seed, and handler reads remain ordinary runtime reads
(`persistence-design-input.md:82-92`). `landings` is target information, not a vendor concern.

The closed-form script should contain only baked literals and bounded operations: obtain each value
with `localStorage.getItem(key)` inside `try/catch`, select the authored initial for missing/read-
failure/corrupt data, write the selected value to the stable landing slot, and set the anti-flash
attribute. It must not import or start a framework, schedule a task, or discover identifiers at
runtime.

### Anti-flash attribute conflict

The adapter should carry a resolved `antiFlashAttribute` so this disagreement is isolated to one
place:

- the persistence charter describes `data-markless-<key>` with colon-to-hyphen sanitization
  (`docs/goals/frameless-persistence-v1/goal.md:68-73`);
- the more specific settled ergonomics oracle says derived `markless:theme` becomes
  `data-markless-theme`, but explicit `theme` becomes `data-theme`
  (`docs/goals/storage-ergonomics/goal.md:44-52`); and
- the local `feat/storage` runtime also uses ``data-${key}``
  (`markless@f4240a1:packages/web/src/storage-plane.ts:41-44`).

The evidence-backed default is therefore `data-${resolvedKey.replaceAll(":", "-")}`, yielding
`data-markless-theme` for a derived key and `data-theme` for an explicit key. The Judge should
ratify that the charter's `data-markless-<key>` wording is shorthand for the derived case. No
emitter should independently reconstruct this name.

### Landing evidence

The pinned 0.1.1 core exports `resumeFromPayloadScripts` and `ResumePayloadScriptsInput`. Its input
contains encoded `stateScript` and `viewScript` plus the resume root/load hooks (vendored
`markless-web-0.1.1.tgz`, `package/dist/payload-document-BBWN178m.d.ts:7-14,78-96`). This verifies a
script-fed Markless landing channel, but **not** storage support in that payload.

The local reference branch gives the more specific future slot contract:

- `Symbol.for("tsrx.storage/1")`;
- slot entries keyed by `<moduleId>#<key>`; and
- seed metadata containing `slotKey`, `driverKey`, and `fallback`
  (`markless@f4240a1:packages/serializer/src/storage-slot.ts:1-42`).

It also shows wake-time reads consuming that slot through a read initializer, with caught
localStorage fallback if no slot exists
(`markless@f4240a1:packages/web/src/payload-graph-construct.ts:76-117`). Frameless should treat the
symbol/key strings as imported protocol facts once the owning package exports them; the adapter
record above states them only to make the present fixture contract concrete.

## B. Vendor refresh and adapter seam

### Current evidence

Frameless pins all Markless packages to local 0.1.1 tarballs
(`package.json:36-43`; `pnpm-lock.yaml:20-27`). The pinned core declaration has only
`state<T>(initial: T): T`; it has no `storage()` or persistence option. Repository search finds no
`persist` semantics under `packages/compiler`, `packages/cli`, or either framework `src`. The
React/Solid emitter fields named `storage` merely classify framework state representation
(`state`/`ref` and `signal`/`store`/`local`), not persistence.

Frameless directly imports `buildSemanticGraph` and `SemanticGraphArtifact` from the vendored
compiler (`packages/compiler/src/build.ts:1-7`) and deliberately stops after that semantic graph
(`packages/compiler/src/build.ts:132-175`). The current enriched record table has bindings,
state reads, and state writes, but no persistence collection
(`packages/compiler/src/schema.ts:459-475`).

The local Markless `feat/storage` branch confirms the expected delivery location. It records
`storage: { key }` on a `SemanticGraphBinding`
(`markless@f4240a1:packages/compiler/src/artifacts.ts:78-95`) and creates module storage bindings
from the module-scope collector
(`markless@f4240a1:packages/compiler/src/passes/semantic-graph/collect-module-scope.ts:50-65`).
That branch currently recognizes only the older explicit `(key, fallback)` form
(`markless@f4240a1:packages/compiler/src/passes/semantic-graph/collect-storage.ts:13-64`), so it is
reference evidence, not the final contract.

### What the refresh must bring

A usable refresh must bring all of the following together:

1. the `storage()` and/or `state(initial, { persist })` authoring signature;
2. semantic-graph persistence metadata correlated to the graph binding;
3. the final resolved key literal, key origin, authored initial, and writable status;
4. existing read/write graph records for that id, sufficient to distinguish render from handler
   access without source-string matching; and
5. exported storage-slot/protocol constants needed by the Markless landing.

A runtime-only refresh, or a compiler refresh that drops the authored fallback/key origin before
`buildSemanticGraph`, is insufficient.

### Recommended seam

Put one narrow adapter at the `buildSemanticGraph` boundary:

```text
buildSemanticGraph(...)
  -> adaptPersistenceFacts(semanticGraph, sourceFacts)
  -> FramelessPersistenceRecord[]
  -> enrichedIR.records.persistence
```

The call point is immediately after `packages/compiler/src/build.ts:133-140`; construction of the
enriched record table is at `packages/compiler/src/build.ts:411-450`. The enriched IR is already
the target-neutral contract handed to emitters (`packages/compiler/src/schema.ts:484-499`).

Until the refresh:

- a fixture supplies `MarklessStorageSourceFact[]` directly to the adapter;
- the adapter performs the same exact validation and normalization production will use;
- compiler fixtures receive the resulting `records.persistence`;
- React, Solid, CLI artifact assembly, gates, receipts, and witness demo consume only that normalized
  field; and
- production `buildEnrichedIr` reports no persistence records for pinned 0.1.1. It must not grep or
  reparse `storage()` calls as a shadow language implementation.

When the refresh lands, only `sourceFacts` changes from a fixture array to semantic-graph extraction.
Contract fixtures should remain as compatibility tests. A missing/unknown vendor field must fail
closed at the adapter rather than silently emit a fallback-only application.

## C. Frameless hook-point trace

| Concern | Existing hook | Persistence responsibility |
| --- | --- | --- |
| Semantic input | `packages/compiler/src/build.ts:133-154` | Adapt storage facts immediately after `buildSemanticGraph`. |
| Enriched records | `packages/compiler/src/build.ts:411-450`; `packages/compiler/src/schema.ts:459-499` | Add normalized persistence records and validate exact graph/read/write correlation. |
| React target | `packages/frameworks/react/src/emitter/index.ts:3214-3251` | Consume persistence records while classifying state; initialize render-visible state from the sync seed slot before mount. |
| React assignment | `packages/frameworks/react/src/emitter/index.ts:1582-1720,1827-1839` | Extend the existing final-sync lowering so the final persisted value writes once at the commit boundary. |
| React external store | `packages/frameworks/react/src/emitter/index.ts:2430-2532,2629-2768,2872-2883` | Seed the server/client snapshot deliberately; persist after all cell mutations and before listener notification. Do not use an effect. |
| Solid target | `packages/frameworks/solid/src/emitter/index.ts:2920-3011,3382-3420` | Initialize `createSignal`/`createStore` from the sync seed slot. |
| Solid assignment | `packages/frameworks/solid/src/emitter/index.ts:1721-1821,1948-2090` | Wrap the existing setter/reconcile/produce lowering with same-commit write-through; do not add `createEffect`/`onMount`. |
| CLI target emit | `packages/cli/src/node-runtime.ts:67-84,86-186` | After all module IR exists, consolidate the build-level persistence plan; continue supplying each IR artifact to target gates (`:120-146`). |
| Script artifact | `packages/cli/src/node-runtime.ts:188-257` | Generate/stage one deterministic script, compute content SHA-256 and CSP `sha256-<base64>`, then write it and the receipt only after successful target staging. |
| Build receipt | `packages/cli/src/receipts.ts:59-117,121-152,195-252` | Add a build-level persistence artifact record: path, content digest, CSP hash, ordered record/slot identities, and head-before-framework placement. Exact-key validation means this needs an explicitly versioned receipt change. |
| Behavioral receipt | `packages/analyzer/src/receipts.ts:9-72,210-280` | Add a persistence witness section (or a sibling versioned receipt) with pre-activation, write-through, equality, and calibration verdicts. |

### Where each generated piece belongs

1. **Closed-form pre-paint seed script:** build-level assembly belongs in the CLI, because only the
   CLI sees the complete module set and owns filesystem staging, hashing, and the shared receipt.
   The compiler supplies target-neutral records; it should not acquire DOM/filesystem/framework
   dependencies. Script text must be byte-deterministic over a stable record sort.
2. **React seed slot:** the React emitter reads a synchronous slot in the lazy initializer passed to
   `useState` (`packages/frameworks/react/src/emitter/index.ts:3120-3151`). For external stores,
   `useSyncExternalStore` currently passes the same getter as client and server snapshot
   (`packages/frameworks/react/src/emitter/index.ts:2848-2883`); persistence must define separate
   hydration-safe server/client snapshot behavior rather than accidentally substituting the warm
   slot on only one side.
3. **Solid seed slot:** the Solid emitter supplies the slot value as the initializer to
   `createSignal`/`createStore` (`packages/frameworks/solid/src/emitter/index.ts:2992-3010`).
4. **Markless landing:** the target writes the storage seed into the payload/storage slot before
   calling the pinned `resumeFromPayloadScripts` channel. The pinned export proves payload-script
   ingestion, while the refresh must provide the storage payload/slot record.
5. **Write-through:** attach to the existing assignment-to-setter transformations cited in the
   table, not to reactive effects or subscriptions.
6. **Receipts:** the authoritative artifact/path/digest/CSP data belongs in
   `frameless-build-receipt.json`. The analyzer receipt should reference that build receipt and
   record the behavioral witness outcome, following the existing SSR receipt adaptation pattern
   (`demos/ssr/src/ssr-receipt.ts:223-275`).

## D. Write-through timing and notification atomicity

Write-through must be part of the same lowered commit as the authored assignment, not an
after-render effect:

```text
compute all authored next values in order
  -> commit framework state/store values
  -> localStorage.setItem(final value) in try/catch
  -> update anti-flash attribute in try/catch
  -> notify framework/external-store listeners
```

For a multi-cell React shared action, the current store stages mutations into local cell variables
and a `changed` set (`packages/frameworks/react/src/emitter/index.ts:2495-2532,2629-2722`), then
iterates listeners only after every write has completed (`:2723-2768`). The persistence hook belongs
between those phases and writes each changed persisted cell once using its final value. Calling
`localStorage.setItem` from each low-level write helper would leak intermediate state to external
observers and would no longer match the store's notification-atomic contract.

For ordinary component state, React already converts authored mutations to next-value SSA and
retains only the final setter sync per cell at the authored final-write position
(`packages/frameworks/react/src/emitter/index.ts:1727-1839`). Persist beside that final sync. Solid
rewrites assignments directly to signal/store setters
(`packages/frameworks/solid/src/emitter/index.ts:1773-1819`) and states that event batching exposes
final post-dispatch state (`packages/frameworks/solid/src/emitter/index.ts:3370-3374`); persist in
that setter wrapper/commit path, never through an extra reactive observer.

The Markless reference runtime follows the same principle at a graph level: writes update cells,
mark dirty paths, and schedule one microtask flush
(`markless@f4240a1:packages/runtime/src/graph.ts:376-417`); subscriptions run from the drained dirty
set and journal listeners run afterward (`:306-360`). Its current storage plane is itself a graph
subscription (`markless@f4240a1:packages/web/src/storage-plane.ts:8-38`), useful evidence for
write-through behavior, but Frameless's React shared-store lowering should preserve its stricter
all-writes-before-notify boundary explicitly.

All storage and attribute writes must catch host exceptions. A failed persistence side effect must
not cancel the framework state commit or suppress its notifications.

## E. Qwik-safe gate policy and mutation

The existing gates already provide the right enforcement mechanics:

- policy inventories carry stable ids and dossier references
  (`packages/frameworks/react/src/gate/index.ts:15-83`; Solid has the equivalent inventory);
- `checkSources` receives both emitted source and optional enriched IR, runs custom policies, and
  marks artifact-required policies unevaluated when provenance is absent
  (`packages/frameworks/react/src/gate/index.ts:367-430`;
  `packages/frameworks/solid/src/gate/index.ts:535-594`);
- CLI builds supply the IR and reject violations or unevaluated policies
  (`packages/cli/src/node-runtime.ts:120-137`); and
- both gate suites maintain a mutation for every published policy
  (`packages/frameworks/react/test/gate.test.ts:556-609`;
  `packages/frameworks/solid/test/gate.test.ts:450-508`).

Add an artifact-required persistence policy to both target gates, even with no Qwik emitter. For
each `records.persistence` entry it should assert:

```text
access.render === true
  => seed.lowering === "pre-paint"
  && seed.landings contains the current target
  && no lowering/task record says visible/eager/effect/mount
```

It should also reject emitted target code that moves the initial storage read into React effects or
Solid `createEffect`/`onMount`. The primary Qwik-safe assertion is record/lowering based, so it does
not pretend React/Solid syntax proves a nonexistent Qwik emitter.

The mutation test should start from a valid fixture artifact, change exactly one render-reachable
record to an explicit mutant such as
`{ seed: { lowering: "eager-visible-task", ... } }` (or remove the pre-paint landing), pass that
artifact through `checkSources`, and require the persistence policy id in `violations`. A companion
source mutant can move a seed read into a target effect. The valid artifact must pass; the mutated
artifact must fail. The policy's dossier-reference type currently admits only older T002/T004
references (`packages/frameworks/react/src/gate/index.ts:15-20`), so the persistence dossier
reference must be added deliberately rather than mislabeled.

## F. Behavioral witness plan

Reuse the SSR lane's two distinct proof modes:

- build and preview, then `preview.request(path)` to inspect served HTML
  (`demos/ssr/claim-a-preactivation-react.box.ts:15-45`);
- `preview.browser.visit(path)` and `expect.page.*` for live behavior
  (`demos/ssr/claim-c-postactivation-react.box.ts:17-40`); and
- mutate a built artifact with `project.edit` to prove the oracle detects a broken result
  (`demos/ssr/calibration-content-prerender.box.ts:34-81` and
  `demos/ssr/calibration-handler-noop-seat.box.ts:22-63`).

A focused `demos/persistence/` is preferable to expanding the UI-kit corpus because it needs
controlled localStorage setup and an activation barrier:

1. Build the same persistence fixture through the CLI for React and Solid.
2. Serve a page whose script order is: consolidated seed, a tiny pre-activation probe, then a
   deliberately gated framework entry.
3. Before navigation, arrange localStorage `theme = "dark"` in the browser context. If witness
   0.7.0 cannot run pre-navigation JavaScript, expose a same-origin setup route/page that sets the
   key and then navigates; do not fake the value in server HTML.
4. `preview.request` asserts the closed-form script is present before the framework entry and that
   its bytes/hash match the build receipt. Raw HTTP alone cannot prove script execution.
5. `preview.browser.visit` stops at the activation barrier. The probe snapshots the anti-flash
   attribute, seed slot, and visible value before importing React/Solid. `expect.page.text` and an
   attribute assertion prove the persisted value is already present while an activation marker is
   still absent.
6. Release activation, require no console errors/failed requests, perform an ordinary assignment,
   and inspect localStorage plus visible DOM. Remount/revisit to prove the written value becomes the
   next seed.
7. Fold React and Solid outcomes into one receipt and require equality over the same cases:
   cold/missing key, warm key, write/remount, read exception/corrupt value, and explicit/derived key.

Calibration must run first against a built-output mutation that changes or removes the seed landing
for one key while leaving the fallback intact. The pre-activation probe must then observe the
fallback/missing attribute and fail the no-flash claim. A second write-through mutant makes
`setItem` a no-op and must fail the write/remount claim. This mirrors the SSR lane's deliberately
broken prerender and handler calibrations.

Important limitation: an inline script in `<head>` can set `<html>` attributes and seed slots, but
it cannot change body nodes that have not been parsed. If the claimed “pre-activation DOM value”
means visible SSR body text, the page needs either a parser-time DOM/serialized-state patch before
the framework entry or another owner-approved landing mechanism. Merely observing the correct
value after `browser.visit` without an activation barrier would not prove no flash.

## G. Risks and Judge decisions

1. **React SSR hydration match — decision required, potentially a behavioral-proof blocker.**
   Should the seed patch SSR DOM/serialized state before hydration, should React render from a
   matched server snapshot and patch through `useSyncExternalStore`, or is a pre-mount client-only
   route acceptable? The current React `useSyncExternalStore` lowering uses the same getter for
   client and server snapshots (`packages/frameworks/react/src/emitter/index.ts:2872-2883`).
   Machinery can proceed, but the final React SSR no-flash claim cannot be made until this is fixed.
2. **Corrupted string definition — decision required.** `getItem` absence and host exceptions can
   always fall back without throwing. An arbitrary string such as `"garbage"` cannot be recognized
   as corrupt from only a string fallback. The Judge must choose a validator/deserialize contract,
   a finite literal-domain record, or define “corrupt” narrowly as unreadable/undecodable storage.
3. **Derived-key collisions across compiled libraries — decision required.** `markless:theme` is
   minification-safe but is not library-scoped. The slot's `<moduleId>#<key>` prevents landing-slot
   collisions, not localStorage driver-key collisions. Preserve verbatim explicit keys for deliberate
   sharing; decide whether derived keys gain a package/build namespace or whether the collision is a
   documented v1 constraint.
4. **Anti-flash explicit-key spelling — ratification required.** Prefer the settled
   `data-${sanitizedResolvedKey}` evidence (`data-theme` for explicit `theme`) and keep the result
   adapter-owned.
5. **Key rename manifest ownership.** The ergonomics goal assigns rename safety to a compiler-emitted
   manifest (`docs/goals/storage-ergonomics/goal.md:36-42`). Confirm whether the refreshed Markless
   compiler emits it or Frameless receipts merely carry it through. Do not implement a second,
   divergent manifest.
6. **CSP representation and placement.** Record both a normal content digest and a CSP source
   expression (`sha256-<base64>`), and specify the consuming app's head-before-framework include.
   Decide whether the artifact is one build-level file or one byte-identical copy per target.
7. **Receipt version.** Both CLI and analyzer validators are exact. Adding artifact/persistence
   fields requires an explicit schema evolution, not unvalidated extra keys.
8. **Markless payload compatibility.** The pinned payload-script API exists, but pinned 0.1.1 has no
   storage protocol/slot. Markless-target execution is blocked on a compatible refresh; React/Solid
   machinery is not.

### Hard-blocker versus buildable matrix

| Item | Buildable against fixture now? | Needs vendor refresh for production? | Needs Judge decision? |
| --- | ---: | ---: | ---: |
| Adapter type/validation and enriched-IR record | Yes | Yes, for real authored input | Only disputed fields |
| Closed-form script planner/generator | Yes | No | Corrupt-value definition |
| React/Solid seed-slot and write-through lowering | Yes | No | React SSR landing |
| Qwik-safe gate policy and mutation | Yes | No | Policy naming/reference only |
| CLI artifact, CSP hash, receipt schema | Yes | No | Receipt version/placement |
| Witness harness and broken-seed calibration | Yes | No | Final SSR value-landing assertion |
| End-to-end CLI build from real `storage()` source | **No** | **Yes** | No |
| Markless storage payload/resume execution | **No** | **Yes** | Protocol compatibility |

The recommended tranche stance is therefore: **build downstream against the normalized contract
now; treat the vendor refresh as the switchover for real source ingestion, not as permission to
begin.**
